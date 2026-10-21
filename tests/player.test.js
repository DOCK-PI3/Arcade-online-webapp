import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrameInput, nativeInputValue } from "../src/frame-input.js";
import { GameRuntime } from "../server/game-runtime.js";

test("analog channels receive full native amplitude while digital inputs remain binary", () => {
  const channels = [12, 13, 16, 17, 20, 21, 22, 23];
  for (const index of channels) {
    assert.equal(nativeInputValue(channels, index, 1), 32767);
    assert.equal(nativeInputValue(channels, index, 0), 0);
  }
  assert.equal(nativeInputValue(channels, 0, 1), 1);
  assert.equal(nativeInputValue(undefined, 13, 1), 1);
});

test("short taps and repeated shots survive delivery within one emulated frame", () => {
  let frame = 100;
  const events = [];
  const inputs = createFrameInput({
    readFrame: () => frame,
    write: (...args) => events.push([frame, ...args]),
  });
  inputs.set(1, 0, 1);
  inputs.set(1, 0, 0);
  inputs.set(1, 0, 1);
  inputs.set(1, 0, 0);
  inputs.pump();
  assert.deepEqual(events, [[100, 1, 0, 1]]);
  for (frame = 101; frame <= 103; frame++) inputs.pump();
  assert.deepEqual(events, [
    [100, 1, 0, 1],
    [101, 1, 0, 0],
    [102, 1, 0, 1],
    [103, 1, 0, 0],
  ]);
});

test("simultaneous controls keep their ports and disconnect discards queued presses", () => {
  let frame = 8;
  const events = [];
  const inputs = createFrameInput({
    readFrame: () => frame,
    write: (...args) => events.push(args),
  });
  inputs.set(1, 6, 1);
  inputs.set(1, 8, 1);
  inputs.set(2, 8, 1);
  inputs.set(1, 8, 0);
  inputs.set(1, 8, 1);
  inputs.release(1);
  events.length = 0;
  frame++;
  inputs.pump();
  assert.deepEqual(events, []);
  inputs.set(2, 8, 0);
  assert.deepEqual(events, [[2, 8, 0]]);
});

test("server batches input without parallel browser calls or reordered releases", async () => {
  const calls = [];
  let finishFirst;
  const rt = new GameRuntime({
    root: ".",
    romDir: ".",
    origin: () => "",
    onEvent() {},
    onStop() {},
  });
  const entry = {
    ready: true,
    page: {
      evaluate: async (_fn, batch) => {
        calls.push(batch);
        if (calls.length === 1)
          await new Promise((resolve) => (finishFirst = resolve));
      },
    },
  };
  rt.rooms.set("one", entry);
  await rt.deliver("one", "game:input", { slot: 1, index: 8, value: 1 });
  await rt.deliver("one", "game:input", { slot: 1, index: 6, value: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 2);
  await rt.deliver("one", "game:input", { slot: 1, index: 8, value: 0 });
  assert.equal(calls.length, 1);
  finishFirst();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls[1], [{ slot: 1, index: 8, value: 0 }]);
  calls.length = 0;
  entry.page.evaluate = async (_fn, payload) => calls.push(payload);
  await rt.deliver("one", "game:input", { slot: 1, index: 7, value: 1 });
  await rt.deliver("one", "game:gone", { slot: 1, userId: "alice" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "game:gone");
});
