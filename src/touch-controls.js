export function usesTouchControls(
  nav = navigator,
  coarse = matchMedia("(pointer: coarse)").matches,
) {
  return !!(
    nav.userAgentData?.mobile ||
    /Android|iPhone|iPad|iPod/i.test(nav.userAgent || "") ||
    (nav.maxTouchPoints > 0 && coarse)
  );
}

// Touch, keyboard and gamepad share the same input ownership in shared-controls.
export function attachTouchControls({
  setAction,
  inputMode,
  onVisibility = () => {},
}) {
  const panel = document.getElementById("touch-controls");
  if (!panel) return { release() {}, close() {} };
  const toggle = document.getElementById("touch-toggle");
  const media = matchMedia("(pointer: coarse)");
  const pointers = new Map();
  const keys = new Map();
  const buttons = [...panel.querySelectorAll("button[data-actions]")];
  const actionNames =
    inputMode === "twin-stick"
      ? {
          a: ["↑", "Palanca derecha arriba"],
          b: ["↓", "Palanca derecha abajo"],
          c: ["←", "Palanca derecha izquierda"],
          d: ["→", "Palanca derecha derecha"],
        }
      : inputMode === "driving"
        ? {
            a: ["Gas", "Acelerar"],
            b: ["Freno", "Frenar"],
            c: ["Marcha ↑", "Subir marcha"],
            d: ["Marcha ↓", "Bajar marcha"],
          }
        : {};
  for (const button of buttons) {
    const name = actionNames[button.dataset.actions];
    if (name) {
      button.textContent = name[0];
      button.setAttribute("aria-label", name[1]);
    }
  }
  let automatic = usesTouchControls(navigator, media.matches),
    override;
  const active = () => override ?? automatic;
  const paint = () => {
    const held = [...pointers.values(), ...keys.values()].flat();
    for (const button of buttons) {
      const pressed = button.dataset.actions
        .split(" ")
        .every((a) => held.includes(a));
      button.classList.toggle("pressed", pressed);
      button.setAttribute("aria-pressed", String(pressed));
    }
  };
  const update = (id, actions) => {
    const previous = pointers.get(id) || [];
    for (const action of previous)
      if (!actions.includes(action))
        setAction(`touch:${id}:${action}`, action, 0);
    for (const action of actions)
      if (!previous.includes(action))
        setAction(`touch:${id}:${action}`, action, 1);
    pointers.set(id, actions);
    paint();
  };
  const releasePointer = (event) => {
    if (!pointers.has(event.pointerId)) return;
    update(event.pointerId, []);
    pointers.delete(event.pointerId);
    if (panel.hasPointerCapture(event.pointerId))
      panel.releasePointerCapture(event.pointerId);
  };
  const release = () => {
    for (const id of [...pointers.keys()]) releasePointer({ pointerId: id });
    for (const [key, actions] of keys)
      for (const action of actions)
        setAction(`touch-key:${key}:${action}`, action, 0);
    keys.clear();
    paint();
  };
  const buttonAt = (element) => {
    const button = element?.closest?.("button[data-actions]");
    return button && panel.contains(button) ? button : null;
  };
  const down = (event) => {
    const button = buttonAt(event.target);
    if (!active() || !button || event.button !== 0) return;
    event.preventDefault();
    panel.setPointerCapture(event.pointerId);
    update(event.pointerId, button.dataset.actions.split(" "));
  };
  const move = (event) => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    const button = buttonAt(
      document.elementFromPoint(event.clientX, event.clientY),
    );
    update(event.pointerId, button ? button.dataset.actions.split(" ") : []);
  };
  const keyboard = (event) => {
    const key = event.code || event.key;
    if (
      !["Enter", " "].includes(event.key) ||
      (event.type === "keydown" ? !buttonAt(event.target) : !keys.has(key))
    )
      return;
    event.preventDefault();
    if (event.type === "keydown" && !keys.has(key)) {
      const actions = buttonAt(event.target).dataset.actions.split(" ");
      keys.set(key, actions);
      for (const action of actions)
        setAction(`touch-key:${key}:${action}`, action, 1);
    } else if (event.type === "keyup") {
      for (const action of keys.get(key) || [])
        setAction(`touch-key:${key}:${action}`, action, 0);
      keys.delete(key);
    }
    paint();
  };
  const show = () => {
    if (!active()) release();
    panel.hidden = !active();
    document.body.classList.toggle("touch-player", active());
    toggle?.setAttribute("aria-pressed", String(active()));
    if (toggle)
      toggle.textContent = active()
        ? "Ocultar controles"
        : "Controles táctiles";
    onVisibility(active());
  };
  const detect = () => {
    automatic = usesTouchControls(navigator, media.matches);
    show();
  };
  const toggleControls = () => {
    override = !active();
    show();
  };
  const contextMenu = (event) => event.preventDefault();
  const visibility = () => {
    if (document.hidden) release();
  };
  panel.addEventListener("pointerdown", down);
  panel.addEventListener("pointermove", move);
  panel.addEventListener("pointerup", releasePointer);
  panel.addEventListener("pointercancel", releasePointer);
  panel.addEventListener("lostpointercapture", releasePointer);
  panel.addEventListener("contextmenu", contextMenu);
  panel.addEventListener("keydown", keyboard);
  window.addEventListener("keyup", keyboard);
  window.addEventListener("blur", release);
  document.addEventListener("visibilitychange", visibility);
  media.addEventListener("change", detect);
  toggle?.addEventListener("click", toggleControls);
  show();
  return {
    release,
    close() {
      release();
      panel.hidden = true;
      document.body.classList.remove("touch-player");
      onVisibility(false);
      panel.removeEventListener("pointerdown", down);
      panel.removeEventListener("pointermove", move);
      panel.removeEventListener("pointerup", releasePointer);
      panel.removeEventListener("pointercancel", releasePointer);
      panel.removeEventListener("lostpointercapture", releasePointer);
      panel.removeEventListener("contextmenu", contextMenu);
      panel.removeEventListener("keydown", keyboard);
      window.removeEventListener("keyup", keyboard);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", detect);
      toggle?.removeEventListener("click", toggleControls);
    },
  };
}
