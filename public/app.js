let state = null;
let playerId = localStorage.getItem("arcade4dxPlayerId") || "";
let selectedOption = null;

const $ = (id) => document.getElementById(id);

function post(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

function playersByTeam(team) {
  return Object.values(state.players || {}).filter((p) => p.team === team);
}

function renderFakeQr(url) {
  const box = $("fakeQr");
  if (!box) return;
  box.innerHTML = "";
  const seed = Array.from(url).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  for (let i = 0; i < 81; i += 1) {
    const finder =
      (i < 21 && i % 9 < 3) ||
      (i < 27 && i % 9 > 5) ||
      (i > 53 && i % 9 < 3);
    const bit = finder || ((i * 17 + seed * 7 + (i % 5) * 11) % 6 < 3);
    const cell = document.createElement("span");
    cell.style.opacity = bit ? "1" : "0";
    box.appendChild(cell);
  }
}

function renderDisplay() {
  if (!$("redPower")) return;
  const q = state.questions[state.current];
  $("redPower").style.width = `${state.power.red * 10}%`;
  $("bluePower").style.width = `${state.power.blue * 10}%`;
  const redShell = $("redShell");
  const blueShell = $("blueShell");
  if (redShell) redShell.classList.toggle("charged", state.power.red >= 10);
  if (blueShell) blueShell.classList.toggle("charged", state.power.blue >= 10);
  $("redCount").textContent = `${playersByTeam("red").length} jugadores`;
  $("blueCount").textContent = `${playersByTeam("blue").length} jugadores`;
  $("playUrl").textContent = state.playUrl;
  const scanBox = document.querySelector(".scan-box");
  if (scanBox) scanBox.classList.toggle("hidden", state.phase !== "lobby");
  const qrImg = $("qrImg");
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(state.playUrl)}`;
  }

  $("discipline").textContent = q.discipline;
  $("question").textContent =
    state.phase === "lobby" ? "Escanea, elige equipo y preparate para ejecutar." : q.text;
  $("phase").textContent = state.phase === "final" ? "Golpe final" : state.phase;

  const arena = $("arena");
  if (arena) arena.classList.toggle("final", state.phase === "final");

  if (state.lastRound) {
    const winner = state.lastRound.winner ? state.teams[state.lastRound.winner].name : "Empate";
    $("roundInfo").textContent =
      `Aciertos: Rojo ${state.lastRound.correct.red}/${state.lastRound.totals.red} | Azul ${state.lastRound.correct.blue}/${state.lastRound.totals.blue}. Gana: ${winner}. Muro: ${state.wallHits || 0}/12 golpes.`;
  } else {
    $("roundInfo").textContent = `${Object.keys(state.answers || {}).length} respuestas recibidas`;
  }
}

function renderHost() {
  if (!$("hostStatus")) return;
  const q = state.questions[state.current];
  $("hostStatus").textContent = `Pantalla: ${state.displayUrl} | Jugadores: ${Object.keys(state.players).length}`;
  const hostPlayUrl = $("hostPlayUrl");
  if (hostPlayUrl) hostPlayUrl.textContent = state.playUrl;
  $("hostQuestion").innerHTML = `<strong>${q.discipline}</strong><br>${q.text}<br><br>${q.options
    .map((o, i) => `${i + 1}. ${o}${i === q.answer ? " (correcta)" : ""}`)
    .join("<br>")}`;
  const last = state.lastRound || { totals: { red: 0, blue: 0 }, correct: { red: 0, blue: 0 } };
  $("hostRed").textContent = `Energia ${state.power.red}/10 | Aciertos ${last.correct.red}/${last.totals.red}`;
  $("hostBlue").textContent = `Energia ${state.power.blue}/10 | Aciertos ${last.correct.blue}/${last.totals.blue}`;
  const wallStatus = $("wallStatus");
  if (wallStatus) wallStatus.textContent = `Muro: ${state.wallHits || 0}/12 golpes | ${(Math.floor((state.wallHits || 0) / 2))} bloque(s) derribado(s)`;
}

function currentPlayer() {
  return state.players[playerId];
}

function renderPhone() {
  if (!$("join")) return;
  const player = currentPlayer();
  $("join").hidden = Boolean(player);
  $("game").hidden = !player;
  if (!player) return;

  const q = state.questions[state.current];
  $("playerBadge").textContent = `${player.name} | ${state.teams[player.team].name}`;
  $("phoneQuestion").textContent =
    state.phase === "question" ? q.text : "Espera a que el facilitador lance la pregunta.";
  $("phoneStatus").textContent =
    state.phase === "result" && state.lastRound
      ? `Respuesta correcta: ${q.options[state.lastRound.answer]}`
      : `${Object.keys(state.answers || {}).length} respuestas recibidas`;

  const alreadyAnswered = Boolean(state.answers[player.id]);
  const options = $("options");
  options.innerHTML = "";
  q.options.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.className = `option${selectedOption === index ? " selected" : ""}`;
    btn.textContent = `${index + 1}. ${option}`;
    btn.disabled = state.phase !== "question" || alreadyAnswered;
    btn.addEventListener("click", async () => {
      selectedOption = index;
      await post("/api/answer", { id: player.id, option: index });
      renderPhone();
    });
    options.appendChild(btn);
  });
}

function render() {
  if (!state) return;
  window.arcade4dxState = state;
  window.dispatchEvent(new CustomEvent("arcade-state", { detail: state }));
  renderDisplay();
  renderHost();
  renderPhone();
}

function connect() {
  const events = new EventSource("/events");
  events.onmessage = (event) => {
    const previousQuestion = state && state.current;
    state = JSON.parse(event.data);
    if (previousQuestion !== null && previousQuestion !== state.current) selectedOption = null;
    render();
  };
}

document.addEventListener("click", async (event) => {
  const action = event.target.dataset.action;
  if (action) await post("/api/host", { action });

  const power = event.target.dataset.power;
  if (power) {
    await post("/api/host", {
      action: "power",
      team: power,
      delta: Number(event.target.dataset.delta || 0),
    });
  }
});

if ($("joinBtn")) {
  $("joinBtn").addEventListener("click", async () => {
    const body = {
      id: playerId,
      name: $("playerName").value || "Participante",
      team: $("team").value,
    };
    const result = await post("/api/join", body);
    playerId = result.id;
    localStorage.setItem("arcade4dxPlayerId", playerId);
  });
}

connect();








