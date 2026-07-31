const questions = [
  { text: "Segun 4DX, cual es el mayor enemigo de la ejecucion?", options: ["El torbellino del dia a dia", "La falta de talento", "La tecnologia", "El presupuesto"], answer: 0, discipline: "Disciplina 1" },
  { text: "Que significa WIG?", options: ["Meta crucialmente importante", "Indicador historico", "Junta semanal", "Plan de tareas"], answer: 0, discipline: "Disciplina 1" },
  { text: "Una buena WIG debe ir de X a Y para cuando?", options: ["De resultado actual a resultado deseado con fecha", "De actividad a reporte mensual", "De idea a presupuesto", "De problema a culpable"], answer: 0, discipline: "Disciplina 1" },
  { text: "Que tipo de medida predice el logro de la meta?", options: ["Medida predictiva", "Medida historica", "Medida de satisfaccion", "Medida financiera"], answer: 0, discipline: "Disciplina 2" },
  { text: "Una medida predictiva debe ser influenciable por el equipo y...", options: ["predictiva del resultado", "secreta para evitar presion", "larga y detallada", "definida solo por direccion"], answer: 0, discipline: "Disciplina 2" },
  { text: "Para que sirve un tablero convincente?", options: ["Para saber si vamos ganando o perdiendo", "Para archivar evidencias", "Para sustituir juntas", "Para castigar errores"], answer: 0, discipline: "Disciplina 3" },
  { text: "Un tablero 4DX debe ser...", options: ["simple, visible y accionable", "muy tecnico y completo", "solo para gerentes", "actualizado al cierre del ano"], answer: 0, discipline: "Disciplina 3" },
  { text: "Que ocurre en la cadencia de rendicion de cuentas?", options: ["Se revisan compromisos y se crean nuevos", "Se discuten todos los pendientes", "Se evita hablar de resultados", "Se cambia la WIG cada semana"], answer: 0, discipline: "Disciplina 4" },
  { text: "La reunion WIG debe enfocarse principalmente en...", options: ["compromisos para mover medidas predictivas", "temas urgentes del torbellino", "lectura de politicas", "presentaciones largas"], answer: 0, discipline: "Disciplina 4" },
  { text: "Que pasa si todos conocen el marcador?", options: ["El juego cambia y aumenta el compromiso", "Se elimina la necesidad de liderazgo", "Se acaba el torbellino", "Ya no hacen falta medidas"], answer: 0, discipline: "Disciplina 3" },
];

const storageKey = "arcade4dxStaticState";
const playerKey = "arcade4dxStaticPlayerId";
const channel = "BroadcastChannel" in window ? new BroadcastChannel("arcade4dx-static") : null;
const $ = (id) => document.getElementById(id);
let playerId = localStorage.getItem(playerKey) || crypto.randomUUID?.() || Math.random().toString(36).slice(2);
let selectedOption = null;
let state = loadState();
localStorage.setItem(playerKey, playerId);

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

function normalizeState(next) {
  return { ...initialState(), ...next, questions, power: { red: 0, blue: 0, ...(next?.power || {}) }, players: next?.players || {}, answers: next?.answers || {} };
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(storageKey) || "{}"));
  } catch {
    return initialState();
  }
}

function saveState({ broadcast = true, notifyFirebase = true } = {}) {
  state = normalizeState(state);
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (broadcast && channel) channel.postMessage(state);
  render();
  if (notifyFirebase) {
    window.dispatchEvent(new CustomEvent("arcade-state-changed", { detail: { state } }));
  }
}

function publicUrl(file) {
  return new URL(file, window.location.href).href;
}

function currentPlayer() {
  return state.players[playerId];
}

function clearRound() {
  state.answers = {};
  state.winner = null;
  state.finalAttack = null;
  state.lastRound = null;
  selectedOption = null;
}

function applyWinner(team, manual = false) {
  const q = state.questions[state.current];
  const alreadyScored = Boolean(state.lastRound?.scored);
  const previousScoredWinner = state.lastRound?.scoredWinner || null;
  if (!state.lastRound) {
    state.lastRound = { totals: { red: 0, blue: 0 }, correct: { red: 0, blue: 0 }, winner: team, answer: q.answer, manual, scored: false, scoredWinner: null };
  } else {
    state.lastRound.winner = team;
    state.lastRound.manual = manual;
  }

  if (!alreadyScored) {
    if (team) {
      state.power[team] = Math.min(10, state.power[team] + 1);
      state.wallHits = Math.min(12, state.wallHits + 1);
    }
  } else if (previousScoredWinner !== team) {
    if (previousScoredWinner) state.power[previousScoredWinner] = Math.max(0, state.power[previousScoredWinner] - 1);
    if (team) state.power[team] = Math.min(10, state.power[team] + 1);
    if (previousScoredWinner && !team) state.wallHits = Math.max(0, state.wallHits - 1);
    if (!previousScoredWinner && team) state.wallHits = Math.min(12, state.wallHits + 1);
  }

  state.lastRound.scored = true;
  state.lastRound.scoredWinner = team;
  state.phase = "result";
  state.winner = null;
  state.finalAttack = null;
  if (state.power.red >= 10 || state.power.blue >= 10) {
    state.winner = state.power.red >= 10 ? "red" : "blue";
    state.finalAttack = Date.now();
    state.phase = "final";
  }
}

function closeRoundFromAnswers() {
  const q = state.questions[state.current];
  const totals = { red: 0, blue: 0 };
  const correct = { red: 0, blue: 0 };
  for (const answer of Object.values(state.answers || {})) {
    totals[answer.team] += 1;
    if (answer.option === q.answer) correct[answer.team] += 1;
  }
  let winner = null;
  if (correct.red > correct.blue) winner = "red";
  if (correct.blue > correct.red) winner = "blue";
  const previousScored = Boolean(state.lastRound?.scored);
  const previousScoredWinner = state.lastRound?.scoredWinner || null;
  state.lastRound = { totals, correct, winner, answer: q.answer, manual: false, scored: previousScored, scoredWinner: previousScoredWinner };
  applyWinner(winner, false);
}

function hostAction(action) {
  if (action === "start") {
    state.phase = "question";
    clearRound();
  }
  if (action === "close") closeRoundFromAnswers();
  if (action === "next") {
    state.current = (state.current + 1) % state.questions.length;
    state.phase = "question";
    clearRound();
  }
  if (action === "reset") state = initialState();
  if (action === "redWin") applyWinner("red", true);
  if (action === "blueWin") applyWinner("blue", true);
  if (action === "tie") applyWinner(null, true);
  saveState();
}

function joinPlayer() {
  const name = ($("playerName")?.value || "Participante").slice(0, 28);
  const team = $("team")?.value === "blue" ? "blue" : "red";
  const player = { id: playerId, name, team };
  state.players[playerId] = player;
  saveState({ notifyFirebase: false });
  window.dispatchEvent(new CustomEvent("arcade-firebase-operation", { detail: { type: "join", player } }));
}

function submitAnswer(option) {
  const player = currentPlayer();
  if (!player || state.phase !== "question") return;
  selectedOption = option;
  const answer = { playerId: player.id, team: player.team, option, at: Date.now() };
  state.answers[player.id] = answer;
  saveState({ notifyFirebase: false });
  window.dispatchEvent(new CustomEvent("arcade-firebase-operation", { detail: { type: "answer", answer } }));
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
  $("redCount").textContent = `${playersByTeam("red").length} jugadores`;
  $("blueCount").textContent = `${playersByTeam("blue").length} jugadores`;
  $("discipline").textContent = q.discipline;
  $("question").textContent = state.phase === "lobby" ? "Abre el control del facilitador y lanza la pregunta." : q.text;
  $("phase").textContent = state.phase === "final" ? "Golpe final" : state.phase;
  $("arena")?.classList.toggle("final", state.phase === "final");
  if (state.lastRound) {
    const winner = state.lastRound.winner ? state.teams[state.lastRound.winner].name : "Empate";
    const detail = state.lastRound.manual
      ? "resultado manual"
      : `Rojo ${state.lastRound.correct.red}/${state.lastRound.totals.red} | Azul ${state.lastRound.correct.blue}/${state.lastRound.totals.blue}`;
    $("roundInfo").textContent = `${detail}. Gana: ${winner}. Muro: ${state.wallHits || 0}/12 golpes.`;
  } else {
    $("roundInfo").textContent = `${Object.keys(state.answers || {}).length} respuestas | Muro: ${state.wallHits || 0}/12 golpes`;
  }
}

function renderHost() {
  if (!$("hostStatus")) return;
  const q = state.questions[state.current];
  $("hostStatus").textContent = `Firebase/PWA | Pregunta ${state.current + 1}/${state.questions.length} | ${Object.keys(state.answers || {}).length} respuestas`;
  $("displayUrl").textContent = publicUrl("index.html");
  if ($("playUrl")) $("playUrl").textContent = publicUrl("play.html");
  $("hostQuestion").innerHTML = `<strong>${q.discipline}</strong><br>${q.text}<br><br>${q.options
    .map((o, i) => `${i + 1}. ${o}${i === q.answer ? " (correcta)" : ""}`)
    .join("<br>")}`;
  const last = state.lastRound || { totals: { red: 0, blue: 0 }, correct: { red: 0, blue: 0 } };
  $("hostRed").textContent = `Energia ${state.power.red}/10 | Jugadores ${playersByTeam("red").length} | Aciertos ${last.correct.red}/${last.totals.red}`;
  $("hostBlue").textContent = `Energia ${state.power.blue}/10 | Jugadores ${playersByTeam("blue").length} | Aciertos ${last.correct.blue}/${last.totals.blue}`;
  $("wallStatus").textContent = `Muro: ${state.wallHits || 0}/12 golpes | ${Math.floor((state.wallHits || 0) / 2)} bloque(s) derribado(s)`;
}

function renderPhone() {
  if (!$("join")) return;
  const player = currentPlayer();
  $("join").hidden = Boolean(player);
  $("game").hidden = !player;
  document.body.classList.toggle("player-entered", Boolean(player));
  if (!player) return;
  const q = state.questions[state.current];
  $("playerBadge").textContent = `${player.name} | ${state.teams[player.team].name}`;
  const avatar = $("playerAvatar");
  if (avatar) {
    avatar.classList.toggle("red-team", player.team === "red");
    avatar.classList.toggle("blue-team", player.team === "blue");
  }
  const phaseLabel = $("phonePhase");
  if (phaseLabel) phaseLabel.textContent = state.phase === "question" ? "Pregunta" : state.phase === "result" ? "Resultado" : state.phase === "final" ? "Final" : "Esperando";
  $("phoneQuestion").textContent = state.phase === "question" ? q.text : "Tu peleador esta listo. Espera la siguiente pregunta.";
  const alreadyAnswered = Boolean(state.answers[player.id]);
  $("phoneStatus").textContent = alreadyAnswered ? "Respuesta enviada" : `${Object.keys(state.answers || {}).length} respuestas recibidas`;
  if (state.phase === "result" && state.lastRound) {
    $("phoneStatus").textContent = `Respuesta correcta: ${q.options[state.lastRound.answer]}`;
  }
  const options = $("options");
  options.innerHTML = "";
  q.options.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.className = `option${selectedOption === index || state.answers[player.id]?.option === index ? " selected" : ""}`;
    btn.textContent = `${index + 1}. ${option}`;
    btn.disabled = state.phase !== "question" || alreadyAnswered;
    btn.addEventListener("click", () => submitAnswer(index));
    options.appendChild(btn);
  });
}

function renderFirebaseStatus(status = window.arcadeFirebaseStatus) {
  const el = $("firebaseStatus");
  if (el && status) {
    el.textContent = status.message;
    el.classList.toggle("online", Boolean(status.online));
  }

  const playerConnection = $("playerConnection");
  if (playerConnection && status) {
    const showError = status.level === "error";
    playerConnection.hidden = !showError;
    playerConnection.textContent = showError ? "Sin conexion con la sala. Revisa internet o recarga." : "";
  }
}

function render() {
  window.arcade4dxState = state;
  window.dispatchEvent(new CustomEvent("arcade-state", { detail: state }));
  renderDisplay();
  renderHost();
  renderPhone();
  renderFirebaseStatus();
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

$("joinBtn")?.addEventListener("click", joinPlayer);

window.addEventListener("storage", () => {
  state = loadState();
  render();
});

window.addEventListener("arcade-firebase-status", (event) => renderFirebaseStatus(event.detail));

if (channel) {
  channel.addEventListener("message", (event) => {
    state = normalizeState(event.data);
    render();
  });
}

window.arcade4dx = {
  getState: () => normalizeState(state),
  applyRemoteState: (remoteState) => {
    const currentAnswer = currentPlayer() ? state.answers[currentPlayer().id]?.option : null;
    state = normalizeState(remoteState);
    selectedOption = currentAnswer ?? state.answers[playerId]?.option ?? null;
    localStorage.setItem(storageKey, JSON.stringify(state));
    render();
  }
};

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
