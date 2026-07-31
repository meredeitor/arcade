(async () => {
const setup = window.arcadeFirebase || {};
const config = setup.firebaseConfig || {};
const roomId = setup.roomId || "capacitacion-4dx";

function setStatus(message, online = false) {
  window.arcadeFirebaseStatus = { message, online };
  window.dispatchEvent(new CustomEvent("arcade-firebase-status", { detail: window.arcadeFirebaseStatus }));
}

function hasConfig() {
  return Boolean(setup.enabled && config.apiKey && config.projectId && config.appId);
}

function normalizedRemoteState(data) {
  return data?.state || window.arcade4dx?.getState();
}

if (!hasConfig()) {
  setStatus("Firebase sin configurar: modo local", false);
} else {
  const [{ initializeApp }, firestore] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js")
  ]);

  const {
    getFirestore,
    doc,
    getDoc,
    onSnapshot,
    setDoc,
    runTransaction,
    serverTimestamp
  } = firestore;

  const app = initializeApp(config);
  const db = getFirestore(app);
  const roomRef = doc(db, "arcadeRooms", roomId);
  let applyingRemote = false;
  let pushTimer = null;

  setStatus(`Conectando Firebase: ${roomId}`, false);

  const firstSnapshot = await getDoc(roomRef);
  if (!firstSnapshot.exists()) {
    await setDoc(roomRef, {
      state: window.arcade4dx?.getState(),
      updatedAt: serverTimestamp()
    });
  }

  onSnapshot(
    roomRef,
    (snapshot) => {
      const data = snapshot.data();
      if (!data?.state || !window.arcade4dx) return;
      applyingRemote = true;
      window.arcade4dx.applyRemoteState(data.state);
      applyingRemote = false;
      setStatus(`Firebase conectado: ${roomId}`, true);
    },
    (error) => {
      setStatus(`Firebase error: ${error.message}`, false);
    }
  );

  window.addEventListener("arcade-state-changed", (event) => {
    if (applyingRemote) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      setDoc(roomRef, {
        state: event.detail.state,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch((error) => setStatus(`Firebase error: ${error.message}`, false));
    }, 180);
  });

  window.addEventListener("arcade-firebase-operation", (event) => {
    if (applyingRemote) return;
    const operation = event.detail;
    runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(roomRef);
      const remoteState = normalizedRemoteState(snapshot.data());
      if (!remoteState) return;

      if (operation.type === "join") {
        remoteState.players = { ...(remoteState.players || {}), [operation.player.id]: operation.player };
      }

      if (operation.type === "answer") {
        remoteState.answers = { ...(remoteState.answers || {}), [operation.answer.playerId]: operation.answer };
      }

      transaction.set(roomRef, {
        state: remoteState,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }).catch((error) => setStatus(`Firebase error: ${error.message}`, false));
  });
}

})();


