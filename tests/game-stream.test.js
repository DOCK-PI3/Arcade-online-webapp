import { test } from "node:test";
import assert from "node:assert/strict";
import { captureGameStream } from "../src/game-stream.js";

test("audio capture follows OpenAL sources created or replaced after game startup and cleans up", async () => {
  const tracks = [
    {
      kind: "video",
      stops: 0,
      stop() {
        this.stops++;
      },
    },
  ];
  const audio = {
    kind: "audio",
    stops: 0,
    stop() {
      this.stops++;
    },
  };
  const destination = { stream: { getAudioTracks: () => [audio] } };
  let resumed = false;
  const context = {
    resume: async () => {
      resumed = true;
    },
    createMediaStreamDestination: () => destination,
  };
  const node = () => ({
    context,
    connected: new Set(),
    connect(n) {
      this.connected.add(n);
    },
    disconnect(n) {
      this.connected.delete(n);
    },
  });
  const first = node(),
    next = node();
  const emulator = {
    Module: { AL: { currentCtx: { audioCtx: context, sources: [] } } },
  };
  const stream = {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === "video"),
    addTrack: (t) => tracks.push(t),
  };
  const capture = await captureGameStream(emulator, {
    captureStream: () => stream,
  });
  try {
    assert.equal(resumed, true);
    assert.ok(tracks.includes(audio));
    emulator.Module.AL.currentCtx.sources[1] = { gain: first };
    await new Promise((r) => setTimeout(r, 130));
    assert.ok(
      first.connected.has(destination),
      "late-created audio must join the live stream",
    );
    first.disconnect(destination);
    await new Promise((r) => setTimeout(r, 130));
    assert.ok(
      first.connected.has(destination),
      "OpenAL rewiring the same node must not silence the stream",
    );
    emulator.Module.AL.currentCtx.sources[1] = { gain: next };
    await new Promise((r) => setTimeout(r, 130));
    assert.equal(first.connected.size, 0);
    assert.ok(
      next.connected.has(destination),
      "a recreated source must replace the old one",
    );
  } finally {
    capture.close();
  }
  assert.equal(next.connected.size, 0);
  assert.ok(tracks.every((t) => t.stops === 1));
});

test("a missing video track fails before starting any audio resources", async () => {
  await assert.rejects(
    captureGameStream(
      { Module: {} },
      { captureStream: () => ({ getVideoTracks: () => [] }) },
    ),
    /imagen del juego/,
  );
});
