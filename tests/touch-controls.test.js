import { test } from "node:test";
import assert from "node:assert/strict";
import { usesTouchControls } from "../src/touch-controls.js";
import { attachPlayerControls } from "../src/player-controls.js";
import {
  attachRemoteControls,
  defaultControls,
} from "../src/shared-controls.js";

test("multitouch, keyboard ownership, sliding and cancellation cannot leave buttons held", () => {
  const globals = [
    "window",
    "document",
    "navigator",
    "matchMedia",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ];
  const saved = Object.fromEntries(
    globals.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
  );
  const classes = () => ({ toggle() {}, remove() {} });
  const makeButton = (actions) => ({
    dataset: { actions },
    classList: classes(),
    setAttribute() {},
    closest() {
      return this;
    },
  });
  const fire = makeButton("a"),
    diagonal = makeButton("up right"),
    other = makeButton("down left");
  const buttons = [fire, diagonal, other],
    panel = new EventTarget(),
    toggle = new EventTarget(),
    doc = new EventTarget(),
    win = new EventTarget(),
    media = new EventTarget(),
    captured = new Set();
  let underFinger = other,
    tick;
  panel.querySelectorAll = () => buttons;
  panel.contains = (b) => buttons.includes(b);
  panel.setPointerCapture = (id) => captured.add(id);
  panel.hasPointerCapture = (id) => captured.has(id);
  panel.releasePointerCapture = (id) => captured.delete(id);
  toggle.setAttribute = () => {};
  doc.getElementById = (id) =>
    id === "touch-controls" ? panel : id === "touch-toggle" ? toggle : null;
  doc.elementFromPoint = () => underFinger;
  doc.body = { classList: classes() };
  doc.visibilityState = "visible";
  doc.hasFocus = () => true;
  media.matches = true;
  for (const [key, value] of Object.entries({
    window: win,
    document: doc,
    navigator: { userAgent: "Android", getGamepads: () => [] },
    matchMedia: () => media,
    requestAnimationFrame: (fn) => {
      tick = fn;
      return 1;
    },
    cancelAnimationFrame: () => {},
  }))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  const events = [];
  const detach = attachRemoteControls(
    defaultControls,
    (...args) => events.push(args),
    { inputMap: { a: 11 } },
  );
  const pointer = (type, id, target = fire) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperties(e, {
      pointerId: { value: id },
      button: { value: 0 },
      target: { value: target },
      clientX: { value: 10 },
      clientY: { value: 10 },
    });
    panel.dispatchEvent(e);
  };
  const key = (type) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperty(e, "key", { value: "z" });
    win.dispatchEvent(e);
  };
  try {
    pointer("pointerdown", 1);
    pointer("pointerdown", 2, diagonal);
    tick();
    assert.deepEqual(events, [
      [11, 1],
      [4, 1],
      [7, 1],
    ]);
    key("keydown");
    pointer("pointercancel", 1);
    tick();
    assert.ok(
      !events.some(([index, value]) => index === 11 && value === 0),
      "touch release must preserve the same keyboard button",
    );
    key("keyup");
    assert.deepEqual(events.at(-1), [11, 0]);
    pointer("pointermove", 2, diagonal);
    assert.ok(events.some(([i, v]) => i === 4 && v === 0));
    assert.ok(events.some(([i, v]) => i === 7 && v === 0));
    assert.deepEqual(events.slice(-2), [
      [5, 1],
      [6, 1],
    ]);
    pointer("lostpointercapture", 2);
    assert.deepEqual(events.slice(-2), [
      [5, 0],
      [6, 0],
    ]);
    pointer("pointerdown", 3);
    toggle.dispatchEvent(new Event("click"));
    assert.deepEqual(events.at(-1), [11, 0]);
    assert.equal(panel.hidden, true);
    toggle.dispatchEvent(new Event("click"));
    pointer("pointerdown", 4);
    win.dispatchEvent(new Event("blur"));
    assert.deepEqual(events.at(-1), [11, 0]);
    const enterDown = new Event("keydown", { cancelable: true });
    Object.defineProperties(enterDown, {
      key: { value: "Enter" },
      code: { value: "Enter" },
      target: { value: fire },
    });
    panel.dispatchEvent(enterDown);
    assert.deepEqual(events.at(-1), [11, 1]);
    const enterUp = new Event("keyup", { cancelable: true });
    Object.defineProperties(enterUp, {
      key: { value: "Enter" },
      code: { value: "Enter" },
    });
    win.dispatchEvent(enterUp);
    assert.deepEqual(
      events.at(-1),
      [11, 0],
      "virtual button keyup must release after focus leaves the panel",
    );
  } finally {
    detach();
    for (const name of globals) {
      if (saved[name]) Object.defineProperty(globalThis, name, saved[name]);
      else delete globalThis[name];
    }
  }
});

test("touch detection includes Android tablets in desktop mode without enabling mouse-only PCs", () => {
  assert.equal(
    usesTouchControls(
      {
        userAgent: "Mozilla/5.0 (Linux; Android 14; Tablet)",
        maxTouchPoints: 5,
      },
      false,
    ),
    true,
  );
  assert.equal(
    usesTouchControls({ userAgent: "desktop", maxTouchPoints: 10 }, true),
    true,
  );
  assert.equal(
    usesTouchControls({ userAgent: "desktop", maxTouchPoints: 0 }, false),
    false,
  );
  assert.equal(
    usesTouchControls({ userAgent: "desktop", maxTouchPoints: 10 }, false),
    false,
  );
});

function fixture() {
  class Element extends EventTarget {
    hidden = true;
    textContent = "";
    value = "80";
    attributes = {};
    setAttribute(k, v) {
      this.attributes[k] = v;
    }
    focus() {}
  }
  const ids = Object.fromEntries(
    [
      "player-controls",
      "audio",
      "enable-audio",
      "volume",
      "fullscreen",
      "diagnostics",
      "connection-stats",
      "playback-state",
    ].map((id) => [id, new Element()]),
  );
  const doc = new EventTarget();
  doc.getElementById = (id) => ids[id];
  doc.body = { classList: { add() {}, remove() {} } };
  const video = new Element();
  video.ownerDocument = doc;
  video.srcObject = {};
  video.volume = 0.8;
  video.muted = true;
  video.paused = false;
  let blocked = false;
  const attempts = [],
    reports = [];
  video.play = () => {
    attempts.push(video.muted);
    return blocked && !video.muted
      ? Promise.reject(new Error("NotAllowedError"))
      : Promise.resolve();
  };
  const controls = attachPlayerControls({
    video,
    report: (m) => reports.push(m),
    getConnectionStats: async () => "",
  });
  return {
    ids,
    doc,
    video,
    controls,
    attempts,
    reports,
    block(value) {
      blocked = value;
    },
  };
}
const settle = () => new Promise((r) => setImmediate(r));

test("blocked Android audio falls back to video and retries synchronously on a gesture", async () => {
  const f = fixture();
  try {
    f.block(true);
    f.ids["enable-audio"].onclick();
    assert.equal(
      f.attempts[0],
      false,
      "unmuted play must happen inside the handler",
    );
    await settle();
    assert.deepEqual(f.attempts, [false, true]);
    assert.equal(f.video.muted, true);
    assert.equal(f.ids["enable-audio"].hidden, false);
    f.block(false);
    f.ids["enable-audio"].onclick();
    await settle();
    assert.equal(f.video.muted, false);
    assert.equal(f.ids["enable-audio"].hidden, true);
    assert.equal(f.ids.audio.attributes["aria-pressed"], "true");
  } finally {
    f.controls.close();
  }
});

test("manual mute survives gameplay gestures and a replacement media stream", async () => {
  const f = fixture();
  try {
    f.doc.dispatchEvent(new Event("pointerdown"));
    await settle();
    assert.equal(f.video.muted, false);
    f.ids.audio.onclick();
    f.doc.dispatchEvent(new Event("pointerdown"));
    f.doc.dispatchEvent(new Event("keydown"));
    f.video.srcObject = { replacement: true };
    await f.controls.play();
    assert.equal(f.video.muted, true);
    assert.equal(f.ids["enable-audio"].hidden, true);
    f.ids.volume.value = "35";
    f.ids.volume.oninput();
    await settle();
    assert.equal(f.video.muted, false);
    assert.equal(f.video.volume, 0.35);
    const count = f.attempts.length;
    f.controls.close();
    f.doc.dispatchEvent(new Event("pointerdown"));
    await settle();
    assert.equal(f.attempts.length, count);
  } finally {
    f.controls.close();
  }
});
