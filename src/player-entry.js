import { io } from "socket.io-client";
import { attachRemoteControls, defaultControls } from "./shared-controls.js";
import { createFrameInput, nativeInputValue } from "./frame-input.js";
import { attachPlayerControls } from "./player-controls.js";
import { captureGameStream } from "./game-stream.js";

const status = document.getElementById("status"),
  video = document.getElementById("remote");
const worker = window.__arcadeWorker;
const roomId =
  worker?.roomId || new URL(location.href).searchParams.get("room");
let socket,
  config,
  stream,
  emulator,
  alive = true,
  detachControls,
  playerControls,
  gameCapture,
  frameInput,
  inputFrame;
const peers = new Map();
const tell = (message) => {
  status.textContent = message;
  status.hidden = !message;
};
const emit = (event, data = {}) =>
  new Promise((resolve, reject) =>
    socket
      .timeout(10000)
      .emit(event, data, (error, result) =>
        error || !result?.ok
          ? reject(
              new Error(result?.error || "No se pudo conectar con la sala."),
            )
          : resolve(result),
      ),
  );
const applyInput = (slot, index, value) => {
  frameInput?.set(slot, index, value);
};
function releaseSlot(slot) {
  frameInput?.release(slot);
}
let previousStats;
async function connectionStats() {
  const pc = peers.get(config.gameHostId)?.pc;
  if (!pc) return "Esperando conexión con el servidor…";
  const stats = await pc.getStats();
  let inbound, pair;
  stats.forEach((s) => {
    if (s.type === "inbound-rtp" && s.kind === "video") inbound = s;
    if (s.type === "transport" && s.selectedCandidatePairId)
      pair = stats.get(s.selectedCandidatePairId);
  });
  if (!inbound) return "Esperando vídeo del servidor…";
  const old = previousStats?.id === inbound.id ? previousStats : null;
  const emitted =
    inbound.jitterBufferEmittedCount - (old?.jitterBufferEmittedCount || 0);
  const delay =
    emitted > 0
      ? ((inbound.jitterBufferDelay - (old?.jitterBufferDelay || 0)) /
          emitted) *
        1000
      : null;
  const fps =
    inbound.framesPerSecond ??
    (old &&
      ((inbound.framesDecoded - old.framesDecoded) * 1000) /
        (inbound.timestamp - old.timestamp));
  previousStats = inbound;
  return [
    `Vídeo: ${Number.isFinite(fps) ? Math.round(fps) + " fps" : "midiendo"}`,
    `Red ida/vuelta: ${Number.isFinite(pair?.currentRoundTripTime) ? Math.round(pair.currentRoundTripTime * 1000) + " ms" : "midiendo"}`,
    `Búfer: ${Number.isFinite(delay) ? Math.round(delay) + " ms" : "midiendo"}`,
    "La red no incluye el tiempo de emulación ni de codificación.",
  ].join(" · ");
}
function peer(userId) {
  if (peers.has(userId)) return peers.get(userId);
  const pc = new RTCPeerConnection({
    iceServers: [],
    bundlePolicy: "max-bundle",
  });
  const entry = { pc, candidates: [], slot: null };
  peers.set(userId, entry);
  pc.onicecandidate = (e) => {
    if (e.candidate)
      emit("game:signal", {
        target: userId,
        signal: { candidate: e.candidate.toJSON() },
      }).catch((e) => tell(e.message));
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(pc.connectionState)) {
      tell(
        "Se ha interrumpido la conexión. Cierra la partida y vuelve a entrar.",
      );
      if (entry.slot) releaseSlot(entry.slot);
    }
  };
  if (config.host) {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  } else
    pc.ontrack = (e) => {
      try {
        if ("jitterBufferTarget" in e.receiver)
          e.receiver.jitterBufferTarget = 0;
      } catch {}
      if (e.streams[0]) {
        if (video.srcObject !== e.streams[0]) video.srcObject = e.streams[0];
      } else {
        video.srcObject ||= new MediaStream();
        video.srcObject.addTrack(e.track);
      }
      video.style.display = "block";
      document.getElementById("game").style.display = "none";
      playerControls.show();
      playerControls.play();
    };
  return entry;
}
async function connectGuest({ userId, slot }) {
  if (!config.host || !stream || peers.has(userId)) return;
  const entry = peer(userId);
  entry.slot = slot;
  await entry.pc.setLocalDescription(await entry.pc.createOffer());
  for (const sender of entry.pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    const parameters = sender.getParameters();
    parameters.degradationPreference = "maintain-framerate";
    for (const encoding of parameters.encodings) {
      encoding.maxBitrate = 4000000;
      encoding.maxFramerate = 60;
    }
    await sender.setParameters(parameters).catch(() => {});
  }
  await emit("game:signal", {
    target: userId,
    signal: { description: entry.pc.localDescription.toJSON() },
  });
}
async function onSignal({ from, signal, slot }) {
  const entry = peer(from);
  entry.slot = slot;
  if (signal.description) {
    await entry.pc.setRemoteDescription(signal.description);
    for (const candidate of entry.candidates)
      await entry.pc.addIceCandidate(candidate);
    entry.candidates = [];
    if (signal.description.type === "offer") {
      await entry.pc.setLocalDescription(await entry.pc.createAnswer());
      await emit("game:signal", {
        target: from,
        signal: { description: entry.pc.localDescription.toJSON() },
      });
    }
  }
  if (signal.candidate) {
    if (entry.pc.remoteDescription)
      await entry.pc.addIceCandidate(signal.candidate);
    else entry.candidates.push(signal.candidate);
  }
}
function stop(payload) {
  if (!alive) return;
  alive = false;
  detachControls?.();
  playerControls?.close();
  cancelAnimationFrame(inputFrame);
  for (const { pc } of peers.values()) pc.close();
  peers.clear();
  stream?.getTracks().forEach((t) => t.stop());
  gameCapture?.close();
  if (emulator?.gameManager) {
    try {
      emulator.gameManager.toggleMainLoop(0);
      emulator.Module?.pauseMainLoop?.();
    } catch {}
  }
  socket?.emit("game:leave", {});
  socket?.disconnect();
  video.srcObject = null;
  document.getElementById("game").style.display = "none";
  video.style.display = "none";
  tell(
    payload?.reason ||
      "Partida desconectada. Cierra esta ventana para volver a la sala.",
  );
}

async function boot() {
  if (!roomId) throw new Error("No se ha seleccionado una sala.");
  if (!window.isSecureContext)
    throw new Error(
      "Para jugar desde otro dispositivo se necesita HTTPS en la red local. Consulta la guía de instalación.",
    );
  if (!window.RTCPeerConnection)
    throw new Error("Este navegador no admite las conexiones de juego.");
  let me;
  if (worker) {
    config = worker;
    const handlers = new Map();
    socket = {
      connected: true,
      on: (name, fn) => handlers.set(name, fn),
      emit: (name, data, ack) =>
        window
          .arcadeWorkerEvent(name, data || {})
          .then((result) => ack?.(result))
          .catch(() => ack?.({ ok: false })),
      timeout() {
        return {
          emit: (name, data, ack) =>
            window
              .arcadeWorkerEvent(name, data)
              .then((result) => ack(null, result))
              .catch((error) => ack(error)),
        };
      },
      disconnect() {},
    };
    window.arcadeWorkerDeliver = (name, data) => handlers.get(name)?.(data);
  } else {
    const meResponse = await fetch("/api/auth/me");
    me = await meResponse.json();
    if (!me.user) throw new Error("Inicia sesión antes de jugar.");
    const response = await fetch(
      `/api/rooms/${encodeURIComponent(roomId)}/emulator`,
    );
    config = await response.json();
    if (!response.ok) throw new Error(config.error);
    if (!config.host) {
      // A running room can send its media before game:join/room:watch finish.
      // Install the controls before opening the socket so ontrack cannot race it.
      playerControls = attachPlayerControls({
        video,
        report: tell,
        getConnectionStats: connectionStats,
      });
      document.getElementById("game").style.display = "none";
      video.style.display = "block";
      video.controls = true;
      playerControls.show();
    }
    socket = io({
      auth: { csrf: me.csrf },
      reconnection: false,
      transports: ["websocket"],
    });
    await new Promise((r, j) => {
      socket.once("connect", r);
      socket.once("connect_error", j);
    });
  }
  socket.on("game:signal", (payload) =>
    onSignal(payload).catch((e) => tell(e.message)),
  );
  socket.on("game:peer", (payload) =>
    connectGuest(payload).catch((e) => tell(e.message)),
  );
  socket.on("game:input", ({ slot, index, value }) =>
    applyInput(slot, index, value),
  );
  socket.on("game:inputs", (inputs) => {
    for (const { slot, index, value } of inputs) applyInput(slot, index, value);
  });
  socket.on("game:release", ({ slot }) => releaseSlot(slot));
  socket.on("game:gone", ({ userId, slot }) => {
    const p = peers.get(userId);
    if (p) {
      releaseSlot(p.slot);
      p.pc.close();
      peers.delete(userId);
    } else if (slot) releaseSlot(slot);
    if (userId === config.gameHostId && !config.host)
      tell("El anfitrión ha salido. La partida se ha interrumpido.");
  });
  socket.on("game:stop", stop);
  socket.on("game:error", ({ error }) => tell(error));
  socket.on("disconnect", () => {
    if (alive) {
      tell("Se ha perdido la conexión con el servidor.");
      stop();
    }
  });
  const joined = worker
    ? { hostId: "server", hostReady: false }
    : await emit("game:join", { roomId });
  config.gameHostId = joined.hostId;
  if (!worker) await emit("room:watch", { roomId });
  socket.on("room:closed", stop);
  if (!config.host) {
    tell(
      joined.hostReady
        ? "Conectando con el anfitrión…"
        : "Iniciando el juego en el servidor…",
    );
    detachControls = attachRemoteControls(
      { ...defaultControls, ...config.controls },
      (index, value) => {
        if (socket.connected)
          socket.emit("game:input", { index, value }, (result) => {
            if (result?.ok === false) tell(result.error);
          });
      },
      {
        gamepadControls: config.gamepadControls,
        inputMap: config.game.inputMap,
        inputMode: config.game.inputMode,
        onTouchVisibility: (enabled) => {
          video.controls = !enabled;
          parent.postMessage(
            { type: "arcade:touch", enabled },
            location.origin,
          );
        },
        onGamepad: (id) => {
          document.getElementById("gamepad-state").textContent = id
            ? "Mando conectado"
            : "Pulsa un botón del mando para detectarlo.";
        },
      },
    );
    return;
  }
  let biosFile = "";
  if (config.biosUrl) {
    const bios = await fetch(config.biosUrl);
    if (!bios.ok) throw new Error("No se pudo descargar la BIOS.");
    biosFile = new File([await bios.arrayBuffer()], config.game.bios, {
      type: "application/zip",
    });
  }
  const map = {
    up: 4,
    down: 5,
    left: 6,
    right: 7,
    a: 8,
    b: 0,
    c: 9,
    d: 1,
    coin: 2,
    start: 3,
    ...config.game.inputMap,
  };
  const controls = { 0: {}, 1: {}, 2: {}, 3: {} };
  for (const [key, index] of Object.entries(map))
    controls[0][index] = {
      value: { ...defaultControls, ...config.controls }[key],
      value2: {
        up: "DPAD_UP",
        down: "DPAD_DOWN",
        left: "DPAD_LEFT",
        right: "DPAD_RIGHT",
        a: "BUTTON_1",
        b: "BUTTON_2",
        c: "BUTTON_3",
        d: "BUTTON_4",
        coin: "SELECT",
        start: "START",
      }[key],
    };
  Object.assign(window, {
    EJS_player: "#game",
    EJS_core: config.game.core || "fbneo",
    EJS_gameUrl: config.romUrl,
    EJS_biosUrl: biosFile,
    EJS_dontExtractBIOS: true,
    EJS_gameName: config.game.title,
    EJS_gameID: config.game.id,
    EJS_pathtodata: "/emulator/",
    EJS_language: "es-ES",
    EJS_DEBUG_XX: true,
    EJS_threads: false,
    EJS_disableLocalStorage: true,
    EJS_startOnLoaded: !!worker,
    EJS_defaultOptions: {
      webgl2Enabled: "enabled",
      "fbneo-allow-depth-32": "disabled",
      ...config.game.coreOptions,
    },
    EJS_defaultControls: controls,
    EJS_Buttons: {
      netplay: false,
      cheat: false,
      saveState: false,
      loadState: false,
    },
    EJS_ready: () => tell(""),
    EJS_onGameStart: async () => {
      try {
        emulator = window.EJS_emulator;
        const canvas = document.querySelector("#game canvas");
        if (!canvas) throw new Error("No se encontró la imagen del juego.");
        gameCapture = await captureGameStream(emulator, canvas, 60);
        stream = gameCapture.stream;
        for (const track of stream?.getVideoTracks() || [])
          track.contentHint = "motion";
        if (!stream?.getVideoTracks().length)
          throw new Error("No se pudo compartir la imagen del juego.");
        // A host may only use its assigned port; guests are injected by server-authorized messages.
        const simulate = emulator.gameManager.simulateInput.bind(
          emulator.gameManager,
        );
        emulator.gameManager.simulateInput = (player, index, value) => {
          if (player === 0) simulate(0, index, value);
        };
        frameInput = createFrameInput({
          readFrame: () => emulator.gameManager.functions.getFrameNum(),
          write: (slot, index, value) =>
            emulator.gameManager.functions.simulateInput(
              slot - 1,
              index,
              nativeInputValue(config.game.analogInputs, index, value),
            ),
        });
        const pump = () => {
          if (!alive) return;
          frameInput.pump();
          inputFrame = requestAnimationFrame(pump);
        };
        pump();
        await emit("game:ready");
        tell("");
        if (!worker)
          parent.postMessage({ type: "arcade:started" }, location.origin);
      } catch (e) {
        tell(e.message);
      }
    },
  });
  const script = document.createElement("script");
  script.src = "/emulator/loader.js";
  script.onerror = () => tell("No se pudo cargar el emulador.");
  document.head.appendChild(script);
}
window.addEventListener("pagehide", stop);
boot().catch((e) => {
  tell(e.message);
  socket?.disconnect();
});
