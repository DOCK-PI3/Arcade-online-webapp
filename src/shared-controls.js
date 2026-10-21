import { attachTouchControls } from "./touch-controls.js";

export const defaultControls = {
  up: "up arrow",
  down: "down arrow",
  left: "left arrow",
  right: "right arrow",
  a: "z",
  b: "x",
  c: "a",
  d: "s",
  coin: "shift",
  start: "enter",
};
export const controlLabels = {
  up: "Arriba",
  down: "Abajo",
  left: "Izquierda",
  right: "Derecha",
  a: "Botón A",
  b: "Botón B",
  c: "Botón C",
  d: "Botón D",
  coin: "Crédito",
  start: "Inicio",
};
export const defaultGamepadControls = {
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  coin: 8,
  start: 9,
};
export function connectedGamepad(pads = navigator.getGamepads?.() || []) {
  const connected = Array.from(pads).filter((p) => p?.connected);
  return (
    connected.find((p) => p.mapping === "standard") || connected[0] || null
  );
}
export const keyName = (e) =>
  ({
    ArrowUp: "up arrow",
    ArrowDown: "down arrow",
    ArrowLeft: "left arrow",
    ArrowRight: "right arrow",
    " ": "space",
    Escape: "esc",
    Control: "ctrl",
  })[e.key] || e.key.toLowerCase();
export function attachRemoteControls(
  controls,
  send,
  {
    gamepadControls = defaultGamepadControls,
    onGamepad = () => {},
    inputMap = {},
    inputMode,
    onTouchVisibility = () => {},
  } = {},
) {
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
      ...inputMap,
    },
    pressed = new Map();
  let frame;
  let previousPad;
  const set = (source, index, value) => {
    const old = pressed.get(source);
    if (value && old === undefined) {
      const wasDown = [...pressed.values()].includes(index);
      pressed.set(source, index);
      if (!wasDown) send(index, 1);
    }
    if (!value && old !== undefined) {
      pressed.delete(source);
      if (![...pressed.values()].includes(old)) send(old, 0);
    }
  };
  const keyboard = (e) => {
    if (
      e.target?.closest?.(
        "input,select,textarea,button,[contenteditable='true']",
      )
    )
      return;
    const action = Object.keys(controls).find(
      (k) => controls[k] === keyName(e),
    );
    if (!action) return;
    e.preventDefault();
    set("key:" + action, map[action], e.type === "keydown" ? 1 : 0);
  };
  let touch;
  const release = () => {
    touch?.release();
    for (const index of new Set(pressed.values())) send(index, 0);
    pressed.clear();
  };
  const gamepad = () => {
    if (document.visibilityState !== "hidden" && document.hasFocus()) {
      const pad = connectedGamepad();
      if (previousPad !== pad?.index) {
        for (const [source, index] of [...pressed])
          if (source.startsWith("pad:") || source.startsWith("axis:"))
            set(source, index, 0);
        onGamepad(pad?.id || null);
        previousPad = pad?.index;
      }
      if (pad) {
        for (const [action, button] of Object.entries({
          ...defaultGamepadControls,
          ...gamepadControls,
        }))
          set(
            "pad:" + action,
            map[action],
            pad.buttons[button]?.pressed ? 1 : 0,
          );
        set("axis:up", map.up, pad.axes[1] < -0.45 ? 1 : 0);
        set("axis:down", map.down, pad.axes[1] > 0.45 ? 1 : 0);
        set("axis:left", map.left, pad.axes[0] < -0.45 ? 1 : 0);
        set("axis:right", map.right, pad.axes[0] > 0.45 ? 1 : 0);
        if (inputMode === "twin-stick") {
          set("axis:right-stick-up", map.a, pad.axes[3] < -0.45 ? 1 : 0);
          set("axis:right-stick-down", map.b, pad.axes[3] > 0.45 ? 1 : 0);
          set("axis:right-stick-left", map.c, pad.axes[2] < -0.45 ? 1 : 0);
          set("axis:right-stick-right", map.d, pad.axes[2] > 0.45 ? 1 : 0);
        }
      } else
        for (const [source, index] of [...pressed])
          if (source.startsWith("pad:") || source.startsWith("axis:"))
            set(source, index, 0);
    } else release();
    frame = requestAnimationFrame(gamepad);
  };
  const visibility = () => {
    if (document.hidden) release();
  };
  window.addEventListener("keydown", keyboard);
  window.addEventListener("keyup", keyboard);
  window.addEventListener("blur", release);
  document.addEventListener("visibilitychange", visibility);
  touch = attachTouchControls({
    inputMode,
    setAction: (source, action, value) => set(source, map[action], value),
    onVisibility: onTouchVisibility,
  });
  frame = requestAnimationFrame(gamepad);
  return () => {
    cancelAnimationFrame(frame);
    touch.close();
    release();
    window.removeEventListener("keydown", keyboard);
    window.removeEventListener("keyup", keyboard);
    window.removeEventListener("blur", release);
    document.removeEventListener("visibilitychange", visibility);
  };
}
