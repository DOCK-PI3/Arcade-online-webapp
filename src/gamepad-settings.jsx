import React, { useEffect, useState } from "react";
import {
  connectedGamepad,
  defaultGamepadControls,
  controlLabels,
} from "./shared-controls.js";
import { api } from "./api.js";
export function GamepadSettings({ me, refreshMe, action }) {
  const [buttons, setButtons] = useState({
      ...defaultGamepadControls,
      ...me.gamepadControls,
    }),
    [capturing, setCapturing] = useState(null),
    [padName, setPadName] = useState(
      "Pulsa un botón del mando para detectarlo.",
    );
  useEffect(() => {
    let frame,
      armed = false;
    const poll = () => {
      const pad = connectedGamepad();
      setPadName(pad?.id || "Pulsa un botón del mando para detectarlo.");
      if (capturing && pad) {
        if (!pad.buttons.some((b) => b.pressed)) armed = true;
        const pressed = pad.buttons.findIndex((b) => b.pressed);
        if (armed && pressed >= 0) {
          setButtons((old) => ({ ...old, [capturing]: pressed }));
          setCapturing(null);
        }
      }
      frame = requestAnimationFrame(poll);
    };
    poll();
    return () => cancelAnimationFrame(frame);
  }, [capturing]);
  const names = {
    0: "A / Cruz",
    1: "B / Círculo",
    2: "X / Cuadrado",
    3: "Y / Triángulo",
    8: "View / Select",
    9: "Menu / Start",
    12: "Cruceta arriba",
    13: "Cruceta abajo",
    14: "Cruceta izquierda",
    15: "Cruceta derecha",
  };
  return (
    <section className="gamepad-settings">
      <h3>Mando USB o Bluetooth</h3>
      <p role="status">{padName}</p>
      <p className="form-note">
        Conecta el mando y pulsa uno de sus botones. Para cambiar una acción,
        selecciónala, suelta los botones y pulsa el que quieras asignar. El
        stick izquierdo también mueve al jugador.
      </p>
      <div className="controls-grid">
        {Object.entries(controlLabels).map(([key, label]) => (
          <div key={key}>
            <span>{label}</span>
            <button
              className={"keycap " + (capturing === key ? "capturing" : "")}
              onClick={() => setCapturing(capturing === key ? null : key)}
            >
              {capturing === key
                ? "Pulsa un botón…"
                : names[buttons[key]] || "Botón " + buttons[key]}
            </button>
          </div>
        ))}
      </div>
      <div className="actions">
        <button
          className="button secondary"
          onClick={() => {
            setButtons({ ...defaultGamepadControls });
            setCapturing(null);
          }}
        >
          Restablecer mando Xbox
        </button>
        <button
          className="button"
          onClick={() =>
            action(async () => {
              await api("/profile/gamepad", { method: "PUT", body: buttons });
              await refreshMe();
            }, "Mando guardado. Abre de nuevo la partida para aplicarlo.")
          }
        >
          Guardar mando
        </button>
      </div>
    </section>
  );
}
