import React, { useEffect, useState } from "react";
import { Gamepad2, Trophy, Users, Clock } from "lucide-react";
import { api } from "./api.js";

export function ProfileOverview() {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("/profile/overview")
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!data) return <p role="status">Cargando tus estadísticas…</p>;
  return (
    <section
      className="personal-overview"
      aria-label="Mis estadísticas de la comunidad"
    >
      <div className="section-heading">
        <h2>Tu actividad en la comunidad</h2>
        <small>
          Miembro desde {new Date(data.memberSince).toLocaleDateString("es-ES")}
        </small>
      </div>
      <div className="personal-stats">
        {[
          [Gamepad2, data.games, "Juegos probados"],
          [Clock, data.participations, "Participaciones"],
          [Trophy, data.submissions.approved, "Resultados registrados"],
          [Users, data.friends, "Amigos"],
        ].map(([Icon, value, label]) => (
          <div key={label}>
            <Icon size={20} />
            <strong>{value.toLocaleString("es-ES")}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="form-note">
        Se cuenta una participación por sala al abrir la conexión de juego; no
        mide tiempo jugado. Las medallas de partidas y exploración cuentan
        cuando el servidor confirma que has empezado a jugar.
      </p>
      <div className="personal-history">
        <section>
          <h3>Mis mejores marcas</h3>
          {data.bestScores.length ? (
            <ul>
              {data.bestScores.map((s) => (
                <li key={s.gameId}>
                  <a href={"#/scores/" + s.gameId}>{s.title}</a>
                  <strong className="numeric">
                    {s.value.toLocaleString("es-ES")}
                    {s.scoreUnit && ` ${s.scoreUnit}`}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Tus marcas aparecerán automáticamente cuando el servidor registre
              un resultado de un juego compatible.
            </p>
          )}
          <div className="personal-submissions">
            <a href="#/scores">Ver mis resultados por juego</a>
          </div>
        </section>
        <section>
          <h3>Mis últimas participaciones</h3>
          {data.recentActivity.length ? (
            <ul>
              {data.recentActivity.map((g, i) => (
                <li key={i}>
                  <a href={"#/scores/" + g.gameId}>{g.title}</a>
                  <time>
                    {new Date(g.lastPlayed).toLocaleDateString("es-ES")}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Tu actividad aparecerá aquí cuando abras una conexión de juego
              desde una sala.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
