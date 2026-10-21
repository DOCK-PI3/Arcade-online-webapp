import React, { useState, useEffect, useRef } from "react";
import { Award, Lock, Check, Search, X, RefreshCw } from "lucide-react";
import { api } from "./api.js";

const count = (n) => Number(n).toLocaleString("es-ES");
const date = (n) =>
  new Date(n).toLocaleDateString("es-ES", {
    timeZone: "Atlantic/Canary",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const links = {
  play: ["#/rooms", "Buscar una partida"],
  scores: ["#/scores", "Ver los marcadores"],
  explore: ["#/home", "Explorar el catálogo"],
  rooms: ["#/rooms", "Ir a las salas"],
  community: ["#/friends", "Ir a mis amigos"],
  habit: ["#/rooms", "Buscar una partida"],
  settings: ["#/profile/opciones", "Ir a mis opciones"],
};

export function MedalsPanel() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [category, setCategory] = useState("all"),
    [status, setStatus] = useState("all"),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(24),
    [selected, setSelected] = useState(null);
  const dialog = useRef(null),
    sequence = useRef(0);
  async function load() {
    const request = ++sequence.current;
    try {
      const next = await api("/profile/medals");
      if (request === sequence.current) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (request === sequence.current) setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const refresh = () => {
      if (document.visibilityState !== "hidden") load();
    };
    window.addEventListener("arcade:medals", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      sequence.current++;
      window.removeEventListener("arcade:medals", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => setLimit(24), [category, status, query]);
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [selected]);
  if (!data)
    return (
      <section className="medals-loading" aria-label="Mis medallas">
        {error ? (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <button className="button secondary" onClick={load}>
              Volver a intentar
            </button>
          </>
        ) : (
          <p role="status">Abriendo tu vitrina…</p>
        )}
      </section>
    );
  const recent = data.medals
    .filter((m) => m.earnedAt)
    .sort((a, b) => b.earnedAt - a.earnedAt)
    .slice(0, 5);
  const visible = data.medals.filter(
    (m) =>
      (category === "all" || category === m.category) &&
      (status === "all" || (status === "earned") === !!m.earnedAt) &&
      `${m.title} ${m.description}`
        .toLocaleLowerCase("es")
        .includes(query.toLocaleLowerCase("es")),
  );
  const completed = data.total
    ? Math.round((data.earned / data.total) * 100)
    : 0;
  const destination =
    selected?.category === "champion"
      ? [`#/scores/${selected.gameId}`, "Ver este marcador"]
      : links[selected?.category];
  return (
    <section className="medals-section" aria-label="Mis medallas">
      <div className="medal-cabinet">
        <div className="medal-cabinet-copy">
          <h2>
            <Award aria-hidden="true" size={28} /> Tu vitrina del salón
          </h2>
          <p>
            Abre salas, prueba recreativas y deja tu nombre en los marcadores.
          </p>
          <div className="medal-collection-count">
            <strong>{count(data.earned)}</strong>
            <span>de {count(data.total)} medallas conseguidas</span>
          </div>
          <progress
            value={data.earned}
            max={data.total || 1}
            aria-label="Medallas conseguidas"
          />
          <small>
            {completed}% de tu colección · {data.generalCount} retos del salón y
            una medalla por juego.
          </small>
        </div>
        <div
          className="medal-shelf"
          aria-label={
            recent.length
              ? "Últimas medallas conseguidas"
              : "Tu próxima medalla"
          }
        >
          {recent.length ? (
            recent.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                aria-label={`Ver medalla ${m.title}`}
              >
                <img src={m.image} alt="" width="92" height="106" />
                <span>{m.title}</span>
              </button>
            ))
          ) : (
            <div className="medal-shelf-empty">
              <img src="/medals/scores-1.svg" alt="" width="110" height="127" />
              <p>
                Tu primera medalla te espera.
                <br />
                Crea una sala y empieza a jugar.
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="medal-explainer">
        Se conceden automáticamente y se quedan contigo. Las puntuaciones
        cuentan una vez por partida finalizada. Los retos de exploración usan
        los {data.catalogSize} juegos activos.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="medal-tools">
        <label className="medal-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Buscar medallas"
            placeholder="Busca una medalla o un reto…"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Categoría
          <select
            aria-label="Categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary small" onClick={load}>
          <RefreshCw size={15} />
          Actualizar
        </button>
      </div>
      <div className="medal-results-bar">
        <div className="medal-filters" aria-label="Filtrar por estado">
          {[
            ["all", "Todas"],
            ["earned", "Conseguidas"],
            ["locked", "Por conseguir"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={status === id}
              className={status === id ? "selected" : ""}
              onClick={() => setStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <span role="status">
          {count(visible.length)}{" "}
          {visible.length === 1 ? "medalla" : "medallas"}
        </span>
      </div>
      {visible.length ? (
        <div className="medal-grid">
          {visible.slice(0, limit).map((m) => (
            <button
              key={m.id}
              className={`medal-tile ${m.earnedAt ? "earned" : "locked"}`}
              onClick={() => setSelected(m)}
              aria-label={`Ver ${m.title}. ${m.earnedAt ? "Conseguida" : "Por conseguir"}`}
            >
              <img src={m.image} alt="" width="86" height="99" loading="lazy" />
              <div className="medal-tile-content">
                <span className="medal-state">
                  {m.earnedAt ? (
                    <>
                      <Check size={13} />
                      Conseguida
                    </>
                  ) : (
                    <>
                      <Lock size={12} />
                      Por conseguir
                    </>
                  )}
                </span>
                <h3>{m.title}</h3>
                <p>{m.description}</p>
                <div className="medal-progress">
                  <progress
                    value={m.progress}
                    max={m.goal || 1}
                    aria-label={`Progreso de ${m.title}`}
                  />
                  <small>
                    {m.earnedAt
                      ? date(m.earnedAt)
                      : m.goal
                        ? `${count(m.progress)} / ${count(m.goal)}`
                        : "Sin juegos activos"}
                  </small>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="medals-empty">
          <Award size={32} />
          <h3>No hay medallas con estos filtros</h3>
          <p>Prueba otra categoría o busca un reto diferente.</p>
          <button
            className="text-button"
            onClick={() => {
              setCategory("all");
              setStatus("all");
              setQuery("");
            }}
          >
            Mostrar todas
          </button>
        </div>
      )}
      {visible.length > limit && (
        <button
          className="button secondary medal-more"
          onClick={() => setLimit((n) => n + 24)}
        >
          Mostrar más medallas ({count(visible.length - limit)} restantes)
        </button>
      )}
      {selected && (
        <dialog
          className="medal-dialog"
          ref={dialog}
          aria-labelledby="medal-detail-title"
          onClose={() => setSelected(null)}
          onClick={(e) => {
            if (e.target === dialog.current) dialog.current.close();
          }}
        >
          <button
            className="icon-button medal-dialog-close"
            aria-label="Cerrar detalle de medalla"
            onClick={() => dialog.current.close()}
          >
            <X size={22} />
          </button>
          <img
            src={selected.image}
            alt={`Insignia de ${selected.title}`}
            width="160"
            height="184"
          />
          <span className="medal-state">
            {selected.earnedAt ? (
              <>
                <Check size={15} />
                Conseguida el {date(selected.earnedAt)}
              </>
            ) : (
              <>
                <Lock size={14} />
                Por conseguir
              </>
            )}
          </span>
          <h2 id="medal-detail-title">{selected.title}</h2>
          <p>{selected.description}</p>
          <progress
            value={selected.progress}
            max={selected.goal || 1}
            aria-label="Progreso de la medalla"
          />
          <p className="medal-detail-progress">
            {count(selected.progress)} de {count(selected.goal)} ·{" "}
            {selected.earnedAt
              ? "Esta medalla ya es tuya"
              : "Sigue jugando para conseguirla"}
          </p>
          {selected.category === "champion" && (
            <p className="form-note">
              Conservarás esta medalla aunque otra persona supere tu marca.
            </p>
          )}
          {selected.retired ? (
            <p>
              Este juego está fuera del catálogo activo. Tu medalla se conserva.
            </p>
          ) : (
            destination && (
              <a className="button" href={destination[0]}>
                {destination[1]}
              </a>
            )
          )}
        </dialog>
      )}
    </section>
  );
}
