const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 4174);
const PUBLIC_DIR = path.join(__dirname, "public");

const questions = [
  {
    text: "Segun 4DX, cual es el mayor enemigo de la ejecucion?",
    options: ["El torbellino del dia a dia", "La falta de talento", "La tecnologia", "El presupuesto"],
    answer: 0,
    discipline: "Disciplina 1",
  },
  {
    text: "Que significa WIG?",
    options: ["Meta crucialmente importante", "Indicador historico", "Junta semanal", "Plan de tareas"],
    answer: 0,
    discipline: "Disciplina 1",
  },
  {
    text: "Una buena WIG debe ir de X a Y para cuando?",
    options: ["De resultado actual a resultado deseado con fecha", "De actividad a reporte mensual", "De idea a presupuesto", "De problema a culpable"],
    answer: 0,
    discipline: "Disciplina 1",
  },
  {
    text: "Que tipo de medida predice el logro de la meta?",
    options: ["Medida predictiva", "Medida historica", "Medida de satisfaccion", "Medida financiera"],
    answer: 0,
    discipline: "Disciplina 2",
  },
  {
    text: "Una medida predictiva debe ser influenciable por el equipo y...",
    options: ["predictiva del resultado", "secreta para evitar presion", "larga y detallada", "definida solo por direccion"],
    answer: 0,
    discipline: "Disciplina 2",
  },
  {
    text: "Para que sirve un tablero convincente?",
    options: ["Para saber si vamos ganando o perdiendo", "Para archivar evidencias", "Para sustituir juntas", "Para castigar errores"],
    answer: 0,
    discipline: "Disciplina 3",
  },
  {
    text: "Un tablero 4DX debe ser...",
    options: ["simple, visible y accionable", "muy tecnico y completo", "solo para gerentes", "actualizado al cierre del ano"],
    answer: 0,
    discipline: "Disciplina 3",
  },
  {
    text: "Que ocurre en la cadencia de rendicion de cuentas?",
    options: ["Se revisan compromisos y se crean nuevos", "Se discuten todos los pendientes", "Se evita hablar de resultados", "Se cambia la WIG cada semana"],
    answer: 0,
    discipline: "Disciplina 4",
  },
  {
    text: "La reunion WIG debe enfocarse principalmente en...",
    options: ["compromisos para mover medidas predictivas", "temas urgentes del torbellino", "lectura de politicas", "presentaciones largas"],
    answer: 0,
    discipline: "Disciplina 4",
  },
  {
    text: "Que pasa si todos conocen el marcador?",
    options: ["El juego cambia y aumenta el compromiso", "Se elimina la necesidad de liderazgo", "Se acaba el torbellino", "Ya no hacen falta medidas"],
    answer: 0,
    discipline: "Disciplina 3",
  },
];

const state = {
  phase: "lobby",
  current: 0,
  power: { red: 0, blue: 0 },
  wallHits: 0,
  teams: {
    red: { name: "Equipo Rojo", color: "#ff3b4f" },
    blue: { name: "Equipo Azul", color: "#3aa0ff" },
  },
  players: {},
  answers: {},
  winner: null,
  lastRound: null,
  finalAttack: null,
  questions,
};

const clients = new Set();

function localAddress() {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

function safeState() {
  return {
    ...state,
    playUrl: `http://${localAddress()}:${PORT}/play`,
    displayUrl: `http://${localAddress()}:${PORT}/display`,
    hostUrl: `http://${localAddress()}:${PORT}/host`,
  };
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store" });
  res.end(type.includes("json") ? JSON.stringify(body) : body);
}

function broadcast() {
  const payload = `data: ${JSON.stringify(safeState())}\n\n`;
  for (const client of clients) client.write(payload);
}

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function resetAnswers() {
  state.answers = {};
  state.lastRound = null;
  state.finalAttack = null;
  state.winner = null;
}

async function routeApi(req, res, url) {
  if (url.pathname === "/api/state") return send(res, 200, safeState());

  if (url.pathname === "/api/join" && req.method === "POST") {
    const body = await readJson(req);
    const id = String(body.id || Math.random().toString(36).slice(2));
    const name = String(body.name || "Participante").slice(0, 28);
    const team = body.team === "blue" ? "blue" : "red";
    state.players[id] = { id, name, team };
    broadcast();
    return send(res, 200, { ok: true, id });
  }

  if (url.pathname === "/api/answer" && req.method === "POST") {
    const body = await readJson(req);
    const player = state.players[String(body.id || "")];
    const option = Number(body.option);
    if (!player || state.phase !== "question" || Number.isNaN(option)) {
      return send(res, 400, { ok: false });
    }
    state.answers[player.id] = { playerId: player.id, team: player.team, option, at: Date.now() };
    broadcast();
    return send(res, 200, { ok: true });
  }

  if (url.pathname === "/api/host" && req.method === "POST") {
    const body = await readJson(req);
    const action = String(body.action || "");

    if (action === "start") {
      state.phase = "question";
      resetAnswers();
    }

    if (action === "close") {
      const q = state.questions[state.current];
      const totals = { red: 0, blue: 0 };
      const correct = { red: 0, blue: 0 };
      for (const answer of Object.values(state.answers)) {
        totals[answer.team] += 1;
        if (answer.option === q.answer) correct[answer.team] += 1;
      }
      let winner = null;
      if (correct.red > correct.blue) winner = "red";
      if (correct.blue > correct.red) winner = "blue";
      if (winner) {
        state.power[winner] = Math.min(10, state.power[winner] + 1);
        state.wallHits = Math.min(12, state.wallHits + 1);
      }
      state.lastRound = { totals, correct, winner, answer: q.answer };
      state.phase = "result";
      if (state.power.red >= 10 || state.power.blue >= 10) {
        state.winner = state.power.red >= 10 ? "red" : "blue";
        state.finalAttack = Date.now();
        state.phase = "final";
      }
    }

    if (action === "next") {
      state.current = (state.current + 1) % state.questions.length;
      state.phase = "question";
      resetAnswers();
    }

    if (action === "reset") {
      state.phase = "lobby";
      state.current = 0;
      state.power = { red: 0, blue: 0 };
      state.wallHits = 0;
      state.answers = {};
      state.players = {};
      state.winner = null;
      state.lastRound = null;
      state.finalAttack = null;
    }

    if (action === "power") {
      const team = body.team === "blue" ? "blue" : "red";
      const delta = Number(body.delta || 0);
      state.power[team] = Math.max(0, Math.min(10, state.power[team] + delta));
    }

    broadcast();
    return send(res, 200, { ok: true });
  }

  return false;
}

function serveFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".svg": "image/svg+xml",
  };
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "No encontrado", "text/plain");
    send(res, 200, data, types[ext] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify(safeState())}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    const handled = await routeApi(req, res, url);
    if (handled === false) send(res, 404, { ok: false });
    return;
  }

  const routes = {
    "/": "display.html",
    "/display": "display.html",
    "/host": "host.html",
    "/play": "play.html",
  };
  const requested = routes[url.pathname] || url.pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, "Prohibido", "text/plain");
  serveFile(res, file);
});

server.listen(PORT, "0.0.0.0", () => {
  const ip = localAddress();
  console.log("");
  console.log("4DX Arcade listo");
  console.log(`Pantalla:     http://${ip}:${PORT}/display`);
  console.log(`Facilitador:  http://${ip}:${PORT}/host`);
  console.log(`Participante: http://${ip}:${PORT}/play`);
  console.log("");
});

