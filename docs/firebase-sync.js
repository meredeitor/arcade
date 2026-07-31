(async () => {
const setup = window.arcadeFirebase || {};
const config = setup.firebaseConfig || {};
const roomId = setup.roomId || "capacitacion-4dx";
let applyingRemote = false;
let pushState = null;
let runOperation = null;
let pendingState = null;
const pendingOperations = [];

function setStatus(message, online = false, level = online ? "online" : "info") {
  window.arcadeFirebaseStatus = { message, online, level };
  window.dispatchEvent(new CustomEvent("arcade-firebase-status", { detail: window.arcadeFirebaseStatus }));
}

function hasConfig() {
  return Boolean(setup.enabled && config.apiKey && config.projectId && config.appId);
}

function normalizedRemoteState(data) {
  return data?.state || window.arcade4dx?.getState();
}

window.addEventListener("arcade-state-changed", (event) => {
  if (applyingRemote) return;
  if (pushState) {
    pushState(event.detail.state);
    return;
  }
  pendingState = event.detail.state;
});

window.addEventListener("arcade-firebase-operation", (event) => {
  if (applyingRemote) return;
  if (runOperation) {
    runOperation(event.detail);
    return;
  }
  pendingOperations.push(event.detail);
});

if (!hasConfig()) {
  setStatus("Firebase sin configurar: modo local", false, "error");
} else {
  try {
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
    let pushTimer = null;

    setStatus(`Conectando sala: ${roomId}`, false, "connecting");

    const firstSnapshot = await getDoc(roomRef);
    if (!firstSnapshot.exists()) {
      await setDoc(roomRef, {
        state: window.arcade4dx?.getState(),
        updatedAt: serverTimestamp()
      });
    }

    pushState = (nextState) => {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        setDoc(roomRef, {
          state: nextState,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch((error) => setStatus(`Firebase error: ${error.message}`, false, "error"));
      }, 180);
    };

    runOperation = (operation) => {
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
      }).catch((error) => setStatus(`Firebase error: ${error.message}`, false, "error"));
    };

    onSnapshot(
      roomRef,
      (snapshot) => {
        const data = snapshot.data();
        if (!data?.state || !window.arcade4dx) return;
        applyingRemote = true;
        window.arcade4dx.applyRemoteState(data.state);
        applyingRemote = false;
        setStatus(`Firebase conectado: ${roomId}`, true, "online");
      },
      (error) => {
        setStatus(`Firebase error: ${error.message}`, false, "error");
      }
    );

    if (pendingState) {
      pushState(pendingState);
      pendingState = null;
    }
    while (pendingOperations.length) runOperation(pendingOperations.shift());
  } catch (error) {
    setStatus(`Firebase error: ${error.message}`, false, "error");
  }
}

})();
