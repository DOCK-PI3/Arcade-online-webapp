import { test } from "node:test";
import assert from "node:assert/strict";
import {
  connectedGamepad,
  attachRemoteControls,
  defaultControls,
} from "../src/shared-controls.js";
test("gamepad discovery tolerates empty ports and prefers the standard Xbox mapping", () => {
  const xbox = { connected: true, index: 2, mapping: "standard" };
  assert.equal(connectedGamepad([null, { connected: false }, xbox]), xbox);
  assert.equal(
    connectedGamepad([{ connected: true, mapping: "" }, null, xbox]),
    xbox,
  );
  assert.equal(connectedGamepad([null]), null);
});
for (const [name, inputMap, fireIndex, inputMode] of [
  [
    "USB gamepad buttons, custom mapping, focus loss and disconnect release inputs",
    {},
    8,
  ],
  [
    "Forgotten Worlds maps its primary gamepad button to the native attack port",
    { a: 11, b: 0, c: 8, d: 9 },
    11,
  ],
  [
    "88 Games maps its primary gamepad button to the first running button",
    { a: 0, b: 1, c: 8, d: 9 },
    0,
  ],
  [
    "twin sticks preserve independent arms and release both on disconnect",
    { a: 23, b: 22, c: 21, d: 20 },
    23,
    "twin-stick",
  ],
  [
    "driving maps steering axes and pedals to their native channels",
    { left: 17, right: 16, a: 13, b: 12, c: 0, d: 8 },
    13,
    "driving",
  ],
])
  test(name, () => {
    const names = [
      "window",
      "document",
      "navigator",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ];
    const saved = Object.fromEntries(
      names.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]),
    );
    let tick,
      focused = true;
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    let pads = [
      null,
      {
        connected: true,
        index: 1,
        id: "Xbox USB fixture",
        mapping: "standard",
        buttons,
        axes: [0, 0, 0, 0],
      },
    ];
    const doc = new EventTarget();
    doc.getElementById = () => null;
    doc.visibilityState = "visible";
    doc.hasFocus = () => focused;
    for (const [name, value] of Object.entries({
      window: new EventTarget(),
      document: doc,
      navigator: { getGamepads: () => pads },
      requestAnimationFrame: (fn) => ((tick = fn), 1),
      cancelAnimationFrame: () => {},
    }))
      Object.defineProperty(globalThis, name, { value, configurable: true });
    const events = [];
    const detach = attachRemoteControls(
      defaultControls,
      (...event) => events.push(event),
      { gamepadControls: { a: 3, d: 0 }, inputMap, inputMode },
    );
    try {
      buttons[3].pressed = true;
      tick();
      assert.deepEqual(events, [[fireIndex, 1]]);
      tick();
      assert.equal(events.length, 1);
      focused = false;
      tick();
      assert.deepEqual(events.at(-1), [fireIndex, 0]);
      focused = true;
      buttons[3].pressed = false;
      buttons[9].pressed = true;
      tick();
      assert.deepEqual(events.at(-1), [3, 1]);
      pads = [];
      tick();
      assert.deepEqual(events.at(-1), [3, 0]);
      pads = [
        null,
        {
          connected: true,
          index: 1,
          mapping: "standard",
          buttons,
          axes: [-1, 0, 0, -1],
        },
      ];
      buttons[9].pressed = false;
      tick();
      assert.ok(
        events.some(
          ([index, value]) => index === (inputMap.left ?? 6) && value === 1,
        ),
      );
      if (inputMode === "twin-stick") {
        assert.deepEqual(events.at(-1), [23, 1]);
        buttons[3].pressed = true;
        tick();
        const count = events.length;
        pads[1].axes[3] = 0;
        tick();
        assert.equal(
          events.length,
          count,
          "face button still owns the right arm",
        );
      }
      pads = [];
      tick();
      assert.ok(
        events.some(
          ([index, value]) => index === (inputMap.left ?? 6) && value === 0,
        ),
      );
      if (inputMode === "twin-stick") assert.deepEqual(events.at(-1), [23, 0]);
    } finally {
      detach();
      for (const name of names) {
        if (saved[name]) Object.defineProperty(globalThis, name, saved[name]);
        else delete globalThis[name];
      }
    }
  });
