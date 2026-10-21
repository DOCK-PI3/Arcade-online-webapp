import React, { useState } from "react";
import { Lock } from "lucide-react";
import { api } from "./api.js";
export function AccountSecurity({ action }) {
  const [busy, setBusy] = useState(false);
  return (
    <details className="account-security">
      <summary>
        <Lock size={16} /> Cambiar mi contraseña
      </summary>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            body = Object.fromEntries(new FormData(form));
          setBusy(true);
          const result = await action(
            () => api("/profile/password", { method: "PUT", body }),
            "Contraseña actualizada. Las demás sesiones se han cerrado.",
          );
          if (result) form.reset();
          setBusy(false);
        }}
      >
        <label>
          Contraseña actual
          <input
            name="current"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
          />
        </label>
        <label>
          Nueva contraseña
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={200}
            required
          />
        </label>
        <button className="button secondary" disabled={busy}>
          {busy ? "Guardando…" : "Actualizar contraseña"}
        </button>
      </form>
    </details>
  );
}
