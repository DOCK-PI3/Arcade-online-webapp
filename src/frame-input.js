// Keep even a short tap pressed across an emulated frame. CDP/WebSocket can
// deliver its down/up events together between two frames of the native core.
export function nativeInputValue(analogInputs, index, value) {
  return analogInputs?.includes(index) ? value * 32767 : value;
}

export function createFrameInput({ readFrame, write }) {
  const buttons = new Map();
  function pump() {
    const frame = readFrame();
    for (const state of buttons.values()) {
      if (state.pending.length && frame > state.frame) {
        state.value = state.pending.shift();
        state.frame = frame;
        write(state.slot, state.index, state.value);
      }
    }
  }
  return {
    set(slot, index, value) {
      const key = `${slot}:${index}`;
      let state = buttons.get(key);
      if (!state) {
        state = { slot, index, value: 0, frame: -1, pending: [] };
        buttons.set(key, state);
      }
      if ((state.pending.at(-1) ?? state.value) === value) return;
      state.pending.push(value);
      pump();
    },
    pump,
    release(slot) {
      for (const [key, state] of buttons) {
        if (state.slot !== slot) continue;
        write(slot, state.index, 0);
        buttons.delete(key);
      }
    },
  };
}
