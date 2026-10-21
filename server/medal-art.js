const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const symbols = {
  trophy:
    '<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v6m-5 1h10"/>',
  joystick:
    '<path d="M12 6v10M5 15h14l3 6H2z"/><circle cx="12" cy="4" r="3"/><path d="M17 18h1"/>',
  cabinet:
    '<path d="M5 2h14l-2 12 3 8H4l3-8zM7 5h10l-1 7H8zM7 16h10M11 18v2"/>',
  map: '<path d="m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3zM8 2v17m8-14v17M10 9l2 2 5-5"/>',
  flag: '<path d="M4 22V2h15l-3 4 3 5H4"/><path d="M8 2v4h4V2m0 4v5h4V6M4 6h4v5"/>',
  duel: '<path d="m3 3 7 3 11 15-6-2L3 3zm18 0-7 3L3 21l6-2L21 3zM3 16l5 5m8-18 5 5"/>',
  handshake:
    '<path d="m2 9 5-5 5 2 5-2 5 5-4 4-6-5-4 3-3-2m0 4 6 7 3-1 5-5M8 16l3 3m-1-6 5 5M2 9v5l3 2m17-7v5l-3 2"/>',
  door: '<path d="M4 22V2h12v20M2 22h18M8 11h1m7-5h6m-3-3 3 3-3 3"/>',
  chat: '<path d="M3 3h18v14H9l-6 5zM7 8h10M7 12h7"/>',
  image:
    '<rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 19 6-6 4 3 4-6 5 8"/>',
  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M7 2v5m10-5v5M3 10h18m-14 5 3 3 7-5"/>',
  record: '<path d="m2 18 6-6 4 3 10-12m-7 0h7v7M3 22h18"/>',
  keyboard:
    '<rect x="1" y="5" width="22" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h2M5 13h1m3 0h1m3 0h1m3 0h2M7 16h10"/>',
  controller:
    '<path d="M7 6h10c3 0 6 13 3 14l-5-4H9l-5 4C1 19 4 6 7 6zM8 9v5m-2-2h5M16 10h1m1 3h1"/>',
  palette:
    '<path d="M12 2a10 10 0 1 0 0 20c4 0-2-7 2-7h4c7 0 3-13-6-13z"/><circle cx="7" cy="7" r="1"/><circle cx="13" cy="6" r="1"/><circle cx="18" cy="10" r="1"/><circle cx="5" cy="13" r="1"/>',
  board:
    '<path d="M3 22V12h6v10m0 0V3h6v19m0 0V8h6v14M1 22h22m-12-15h2m-1 0v5"/>',
  factory: '<path d="M2 22V9l7 4V9l7 4V5h4l2 17zM6 17v2m5-2v2m6-2v2M16 2h4"/>',
  crown:
    '<path d="m2 5 5 5 5-8 5 8 5-5-3 13H5zM6 22h12"/><circle cx="12" cy="13" r="2"/>',
};
const colors = {
  play: "#3d85bc",
  scores: "#be8230",
  explore: "#4b9a88",
  rooms: "#7065b2",
  community: "#c96b65",
  habit: "#517dad",
  settings: "#9471af",
  champion: "#cf9d34",
};
const metals = [
  ["#e3aa78", "#a86331"],
  ["#e3ebf3", "#8097ae"],
  ["#ffe59c", "#c99232"],
  ["#b4e6ef", "#4a9cac"],
  ["#ffedaf", "#c08c25"],
];

export function medalSvg(medal) {
  const tier = Math.min(medal.tier || 0, 4),
    [light, dark] = metals[tier],
    color = colors[medal.category] || colors.play;
  const milestone =
    medal.goal === "half"
      ? "½"
      : medal.goal === "all"
        ? "TODO"
        : medal.category === "champion"
          ? "N.º 1"
          : medal.goal;
  const facets = Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    return `<path d="M${80 + 54 * Math.cos(a)} ${75 + 54 * Math.sin(a)}l${5 * Math.cos(a)} ${5 * Math.sin(a)}"/>`;
  }).join("");
  const stars = Array.from(
    { length: tier + 1 },
    (_, i) =>
      `<circle cx="${80 + (i - tier / 2) * 9}" cy="117" r="2.5" fill="${dark}"/>`,
  ).join("");
  const gameLabel = medal.gameId
    ? `<rect x="35" y="139" width="90" height="23" rx="4" fill="#142d3e" stroke="${light}"/><text x="80" y="155" text-anchor="middle" font-family="Arial,sans-serif" font-size="${medal.gameId.length > 8 ? 10 : 12}" font-weight="800" fill="${light}">${escape(medal.gameId.toUpperCase())}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 184" role="img" aria-labelledby="title"><title id="title">${escape(medal.title)}</title><defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".5" stop-color="${dark}"/><stop offset=".72" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><path d="m43 109-12 63 28-14 16 18 6-63m36-4 12 63-28-14-16 18-6-63" fill="${color}" stroke="#142d3e" stroke-width="3"/><path d="m46 128-7 27 15-7m60-20 7 27-15-7" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3"/><circle cx="80" cy="75" r="66" fill="url(#metal)" stroke="#142d3e" stroke-width="3"/><g stroke="${dark}" stroke-width="3">${facets}</g><circle cx="80" cy="75" r="49" fill="#142d3e" stroke="${light}" stroke-width="3"/><circle cx="80" cy="75" r="43" fill="none" stroke="${color}" stroke-width="2"/><g transform="translate(51 42) scale(2.42)" fill="none" stroke="${light}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${symbols[medal.symbol] || symbols.trophy}</g><rect x="49" y="93" width="62" height="24" rx="8" fill="${light}"/><text x="80" y="110" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="800" fill="#142d3e">${escape(milestone)}</text>${stars}${gameLabel}</svg>`;
}
