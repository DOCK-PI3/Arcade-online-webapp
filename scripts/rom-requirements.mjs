import definitions from "../config/catalog-romsets.json" with { type: "json" };
import { catalogAdditions } from "../server/catalog.js";
import { scoreLayouts } from "../server/score-readers.js";

export const sourceSets = {
  fbneo: {
    name: "FinalBurn Neo 1.0.0.3 (a2594cf)",
    format: "Arcade only, Non-Merged",
    reference:
      "https://docs.libretro.com/library/fbneo/#building-romsets-for-fbneo",
  },
  mame: {
    name: "MAME 0.287",
    format: "ROMs, merged",
    reference: "https://docs.mamedev.org/usingmame/aboutromsets.html",
  },
};
const base = [
  {
    id: "columns",
    title: "Columns (World)",
    max_players: 2,
    rom: "columns.zip",
    bios: null,
  },
  {
    id: "contra",
    title: "Contra",
    max_players: 2,
    rom: "contra.zip",
    bios: null,
  },
  {
    id: "mslug",
    title: "Metal Slug",
    max_players: 2,
    rom: "mslug.zip",
    bios: "neogeo.zip",
  },
  {
    id: "mslug2",
    title: "Metal Slug 2",
    max_players: 2,
    rom: "mslug2.zip",
    bios: "neogeo.zip",
  },
  {
    id: "1941",
    title: "1941: Counter Attack",
    max_players: 2,
    rom: "1941.zip",
    bios: null,
  },
];
const expansion = new Set([
  "3wonders",
  "avsp",
  "cclimber",
  "cclimbr2",
  "demonwld",
  "frogger",
  "gijoe",
  "gradius",
  "joemac",
  "kickoff",
  "kof98",
  "maglord",
  "mercs",
  "mwalk",
  "narc",
  "orunners",
]);
const byId = new Map(definitions.map((d) => [d.id, d]));
export function romRequirements() {
  const games = [...base, ...catalogAdditions.filter((g) => g.enabled)]
    .map((g) => {
      const def = byId.get(g.id),
        layout = scoreLayouts[g.id];
      if (!def || !layout || def.expected_sha256 !== layout.sha256)
        throw Error("ROM definition/reader mismatch: " + g.id);
      return {
        id: g.id,
        title: g.title,
        archive: g.rom,
        bios: g.bios,
        players: g.max_players,
        core: g.core || "fbneo",
        sourceSet:
          def.copy_approved_archive || expansion.has(g.id) ? "fbneo" : "mame",
        preparation: def.copy_approved_archive
          ? "original-archive"
          : "rebuild-components",
        sha256: layout.sha256,
        sourceArchives: [
          ...new Set([g.id, ...(def.parents || [def.parent])]),
        ].map((id) => id + ".zip"),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
  const bios = [...new Set(games.map((g) => g.bios).filter(Boolean))].map(
    (archive) => {
      const id = archive.slice(0, -4),
        def = byId.get(id),
        users = games.filter((g) => g.bios === archive);
      const expected =
        id === "neogeo"
          ? "00692b80cf7ad6bdddcc436d065c5e2453ca272632aae1d791f672eb280dd457"
          : scoreLayouts[users[0].id].biosSha256;
      if (!def || def.expected_sha256 !== expected)
        throw Error("BIOS definition/reader mismatch: " + id);
      return {
        id,
        archive,
        sha256: expected,
        sourceSet: id === "neogeo" ? "fbneo" : "mame",
        preparation: def.copy_approved_archive
          ? "original-archive"
          : "rebuild-components",
        requiredBy: users.map((g) => g.id),
      };
    },
  );
  return { schemaVersion: 1, emulatorJs: "4.2.3", sourceSets, games, bios };
}
