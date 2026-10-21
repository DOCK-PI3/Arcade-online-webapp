// Adapter for the pinned EmulatorJS/OpenAL backend. Sources can be recreated
// after boot; a recording snapshot only connects the sources present that instant.
export async function captureGameStream(emulator, canvas, fps = 60) {
  const stream = canvas.captureStream(fps);
  if (!stream.getVideoTracks().length)
    throw new Error("No se pudo compartir la imagen del juego.");
  let context;
  for (let i = 0; i < 100; i++) {
    context = emulator.Module.AL?.currentCtx?.audioCtx;
    if (context) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!context) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error(
      "No se pudo iniciar el audio del juego. Vuelve a preparar la partida.",
    );
  }
  await context.resume();
  const destination = context.createMediaStreamDestination();
  const connected = new Set();
  const update = () => {
    const sources = new Set(
      Object.values(emulator.Module.AL?.currentCtx?.sources || {})
        .map((source) => source?.gain)
        .filter((node) => node?.context === context),
    );
    for (const node of connected)
      if (!sources.has(node)) {
        try {
          node.disconnect(destination);
        } catch {}
        connected.delete(node);
      }
    // OpenAL can disconnect and reconnect the same gain node during startup.
    // AudioNode.connect is idempotent for an existing connection, so restore
    // the tap even when the source object's identity has not changed.
    for (const node of sources) {
      node.connect(destination);
      connected.add(node);
    }
  };
  update();
  for (const track of destination.stream.getAudioTracks())
    stream.addTrack(track);
  const timer = setInterval(update, 100);
  return {
    stream,
    close() {
      clearInterval(timer);
      for (const node of connected) {
        try {
          node.disconnect(destination);
        } catch {}
      }
      connected.clear();
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
