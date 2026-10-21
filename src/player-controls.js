export function attachPlayerControls({ video, report, getConnectionStats }) {
  const doc = video.ownerDocument;
  const bar = doc.getElementById("player-controls");
  const sound = doc.getElementById("audio");
  const enableAudio = doc.getElementById("enable-audio");
  const volume = doc.getElementById("volume");
  const fullscreen = doc.getElementById("fullscreen");
  const diagnostics = doc.getElementById("diagnostics");
  const stats = doc.getElementById("connection-stats");
  const state = doc.getElementById("playback-state");
  let timer,
    reading = false,
    wantsAudio = false,
    userMuted = false,
    closed = false;
  const focus = () => video.focus({ preventScroll: true });
  const sync = () => {
    const silent = video.muted || video.volume === 0;
    sound.textContent = silent ? "Activar sonido" : "Silenciar";
    sound.setAttribute("aria-pressed", String(!silent));
    volume.value = String(Math.round(video.volume * 100));
    volume.setAttribute("aria-valuetext", `${volume.value}%`);
    state.textContent = silent ? "Sonido desactivado" : "Sonido activado";
    if (enableAudio) enableAudio.hidden = !silent || userMuted;
  };
  const play = () => {
    if (closed || !video.srcObject) return Promise.resolve();
    video.muted = userMuted || !wantsAudio;
    // Call play synchronously in the gesture handler: Android can revoke the
    // activation after an await, even though the iframe allows autoplay.
    return video
      .play()
      .then(() => {
        if (!closed) {
          sync();
          report("");
        }
      })
      .catch(async () => {
        if (closed) return;
        video.muted = true;
        sync();
        try {
          await video.play();
        } catch {}
        if (!closed) report("Toca «Jugar con sonido» para activar el audio.");
      });
  };
  const unlock = () => {
    wantsAudio = true;
    userMuted = false;
    if (!video.volume) video.volume = 0.8;
    video.muted = false;
    const result = play();
    sync();
    return result;
  };
  sound.onclick = () => {
    if (video.muted || video.volume === 0) unlock();
    else {
      userMuted = true;
      wantsAudio = false;
      video.muted = true;
    }
    sync();
    focus();
  };
  if (enableAudio)
    enableAudio.onclick = () => {
      unlock();
      focus();
    };
  volume.oninput = () => {
    video.volume = Number(volume.value) / 100;
    userMuted = video.volume === 0;
    wantsAudio = !userMuted;
    play();
    sync();
  };
  volume.onchange = focus;
  const syncFullscreen = () => {
    fullscreen.textContent = doc.fullscreenElement
      ? "Salir de pantalla completa"
      : "Pantalla completa";
    fullscreen.setAttribute("aria-pressed", String(!!doc.fullscreenElement));
    focus();
  };
  fullscreen.disabled = !doc.fullscreenEnabled;
  fullscreen.onclick = () => {
    const request = doc.fullscreenElement
      ? doc.exitFullscreen()
      : doc.documentElement.requestFullscreen();
    request.catch(() =>
      report(
        "El navegador no permite pantalla completa en esta ventana. Prueba a abrir la página en tu navegador habitual.",
      ),
    );
  };
  const updateStats = async () => {
    if (reading || stats.hidden) return;
    reading = true;
    try {
      stats.textContent = await getConnectionStats();
    } catch {
      stats.textContent = "No se pudo consultar la conexión.";
    } finally {
      reading = false;
    }
  };
  diagnostics.onclick = () => {
    stats.hidden = !stats.hidden;
    diagnostics.setAttribute("aria-expanded", String(!stats.hidden));
    clearInterval(timer);
    if (!stats.hidden) {
      updateStats();
      timer = setInterval(updateStats, 2000);
    }
    focus();
  };
  video.addEventListener("volumechange", sync);
  video.addEventListener("pointerdown", focus);
  video.addEventListener("loadedmetadata", focus, { once: true });
  doc.addEventListener("fullscreenchange", syncFullscreen);
  const gesture = (event) => {
    if (
      userMuted ||
      event.repeat ||
      event.target?.closest?.(
        "#audio,#volume,#enable-audio,input,select,textarea",
      )
    )
      return;
    if (!wantsAudio || video.muted || video.paused) unlock();
  };
  const metadata = () => {
    play();
  };
  doc.addEventListener("pointerdown", gesture, true);
  doc.addEventListener("keydown", gesture, true);
  video.addEventListener("loadedmetadata", metadata);
  video.muted = true;
  video.volume = 0.8;
  sync();
  return {
    play,
    show() {
      doc.body.classList.add("remote-player");
      bar.hidden = false;
    },
    close() {
      closed = true;
      clearInterval(timer);
      bar.hidden = true;
      doc.body.classList.remove("remote-player");
      video.removeEventListener("volumechange", sync);
      video.removeEventListener("pointerdown", focus);
      video.removeEventListener("loadedmetadata", focus);
      doc.removeEventListener("fullscreenchange", syncFullscreen);
      doc.removeEventListener("pointerdown", gesture, true);
      doc.removeEventListener("keydown", gesture, true);
      video.removeEventListener("loadedmetadata", metadata);
      if (enableAudio) {
        enableAudio.hidden = true;
        enableAudio.onclick = null;
      }
      sound.onclick =
        volume.oninput =
        volume.onchange =
        fullscreen.onclick =
        diagnostics.onclick =
          null;
    },
  };
}
