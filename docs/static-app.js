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

const storageKey = "arcade4dxStaticState";
const channel = "BroadcastChannel" in window ? new BroadcastChannel("arcade4dx-static") : null;
const $ = (id) => document.getElementById(id);

function initialState() {
  return {
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
}

let state = loadState();

function loadState() {
  try {
    return { ...initialState(), ...JSON.parse(localStorage.getItem(storageKey) || "{}"), questions };
  } catch {
    return initialState();
  }
}

function saveState(broadcast = true) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (broadcast && channel) channel.postMessage(state);
  render();
}

function publicUrl(file) {
  return new URL(file, window.location.href).href;
}

function applyWinner(team) {
  state.lastRound = {
    totals: { red: 0, blue: 0 },
    correct: { red: 0, blue: 0 },
    winner: team,
    answer: state.questions[state.current].answer,
    manual: true,
  };
  if (team) {
    state.power[team] = Math.min(10, state.power[team] + 1);
    state.wallHits = Math.min(12, state.wallHits + 1);
  }
  state.phase = "result";
  if (state.power.red >= 10 || state.power.blue >= 10) {
    state.winner = state.power.red >= 10 ? "red" : "blue";
    state.finalAttack = Date.now();
    state.phase = "final";
  }
  saveState();
}

function hostAction(action) {
  if (action === "start") {
    state.phase = "question";
    state.winner = null;
    state.finalAttack = null;
    state.lastRound = null;
  }
  if (action === "next") {
    state.current = (state.current + 1) % state.questions.length;
    state.phase = "question";
    state.winner = null;
    state.finalAttack = null;
    state.lastRound = null;
  }
  if (action === "reset") {
    state = initialState();
  }
  if (action === "redWin") applyWinner("red");
  if (action === "blueWin") applyWinner("blue");
  if (action === "tie") applyWinner(null);
  saveState();
}

function playersByTeam(team) {
  return Object.values(state.players || {}).filter((p) => p.team === team);
}

function renderDisplay() {
  if (!$("redPower")) return;
  const q = state.questions[state.current];
  $("redPower").style.width = `${state.power.red * 10}%`;
  $("bluePower").style.width = `${state.power.blue * 10}%`;
  $("redShell")?.classList.toggle("charged", state.power.red >= 10);
  $("blueShell")?.classList.toggle("charged", state.power.blue >= 10);
  $("redCount").textContent = playersByTeam("red").length ? `${playersByTeam("red").length} jugadores` : "Modo manual";
  $("blueCount").textContent = playersByTeam("blue").length ? `${playersByTeam("blue").length} jugadores` : "Modo manual";
  $("discipline").textContent = q.discipline;
  $("question").textContent =
    state.phase === "lobby" ? "Abre el control del facilitador y lanza la pregunta." : q.text;
  $("phase").textContent = state.phase === "final" ? "Golpe final" : state.phase;
  $("arena")?.classList.toggle("final", state.phase === "final");

  if (state.lastRound) {
    const winner = state.lastRound.winner ? state.teams[state.lastRound.winner].name : "Empate";
    $("roundInfo").textContent = `Gana: ${winner}. Muro: ${state.wallHits || 0}/12 golpes.`;
  } else {
    $("roundInfo").textContent = `Muro: ${state.wallHits || 0}/12 golpes`;
  }
}

function renderHost() {
  if (!$("hostStatus")) return;
  const q = state.questions[state.current];
  $("hostStatus").textContent = `Modo PWA estatica | Pregunta ${state.current + 1}/${state.questions.length}`;
  $("displayUrl").textContent = publicUrl("index.html");
  $("hostQuestion").innerHTML = `<strong>${q.discipline}</strong><br>${q.text}<br><br>${q.options
    .map((o, i) => `${i + 1}. ${o}${i === q.answer ? " (correcta)" : ""}`)
    .join("<br>")}`;
  $("hostRed").textContent = `Energia ${state.power.red}/10`;
  $("hostBlue").textContent = `Energia ${state.power.blue}/10`;
  $("wallStatus").textContent = `Muro: ${state.wallHits || 0}/12 golpes | ${Math.floor((state.wallHits || 0) / 2)} bloque(s) derribado(s)`;
}

function render() {
  window.arcade4dxState = state;
  window.dispatchEvent(new CustomEvent("arcade-state", { detail: state }));
  renderDisplay();
  renderHost();
}

document.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  if (action) hostAction(action);

  const team = event.target.dataset.power;
  if (team) {
    state.power[team] = Math.max(0, Math.min(10, state.power[team] + Number(event.target.dataset.delta || 0)));
    saveState();
  }
});

window.addEventListener("storage", () => {
  state = loadState();
  render();
});

if (channel) {
  channel.addEventListener("message", (event) => {
    state = { ...initialState(), ...event.data, questions };
    render();
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
