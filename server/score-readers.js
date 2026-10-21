// Layouts are tied to the pinned FBNeo core and the exact ZIPs below.
// The RAM comes from the private server process, never from a browser request.
import {
  catalogScoreLayouts,
  readCatalogScores,
} from "./catalog-score-readers.js";
export const scoreLayouts = {
  ...catalogScoreLayouts,
  columns: {
    // Sega C exposes All Ram; its 68K work RAM is the first 64 KiB.
    size: 201032,
    ranges: [
      [0xc810, 8],
      [0xc828, 2],
      [0xc980, 8],
      [0xc998, 2],
    ],
    sha256: "3b6c6da0b6f5f202ed15e32b14d2d78679395d4ecbb2e961723b9b84030ff9dd",
    // The per-player real-play state excludes attract mode and level selection.
    // Medium/hard begin with bonus points, so zero is not a start condition.
    armOnActive: true,
    finalScoreOnInactive: true,
    version: 2,
  },
  contra: {
    size: 27392,
    ranges: [
      [0x7c, 6],
      [0x88, 6],
    ],
    sha256: "95cb6d23478d8d303e5a62d3ef0e4f99614fc5c8dc39b39c24e026e503ae15b7",
    version: 1,
  },
  mslug: {
    size: 65536,
    ranges: [
      [0x6e94, 16],
      [0x376, 2],
      [0x416, 2],
      [0xfdae, 2],
    ],
    sha256: "67d9497fcf821f690a24ecb39b19bc38cc0052d0a5437f9b697ac3cc197cb4f0",
    version: 1,
  },
  1941: {
    size: 65536,
    ranges: [
      [0xdb6, 8],
      [0xd80, 2],
    ],
    sha256: "d2774da919800192790d718c457dee3c4d57036c57cf71398e1ca1988f1443ba",
    version: 1,
  },
  tetris: {
    size: 94208,
    ranges: [
      [0x2300, 8],
      [0x2318, 1],
      [0x2380, 8],
      [0x2398, 1],
    ],
    sha256: "7104afe3e97f13c716b05c7ea019ddc7acef83950c117c73c276398744663f85",
    version: 1,
  },
  mslug2: {
    size: 65536,
    ranges: [
      [0xe86e, 4],
      [0xe878, 4],
      [0x1276, 2],
      [0x131e, 2],
      [0xfdae, 2],
    ],
    sha256: "1c5946b1959ae9dfca6569164d592df3649f5db30e127ad0c4cd6c2c7b44baad",
    version: 1,
  },
};

function packedBcd(bytes) {
  let value = 0;
  for (const byte of bytes) {
    if (byte >> 4 > 9 || (byte & 15) > 9) return null;
    value = value * 100 + (byte >> 4) * 10 + (byte & 15);
  }
  return value;
}
export function readScores(game, ram) {
  const layout = scoreLayouts[game.id];
  if (!layout || ram.length !== layout.size) return [];
  if (layout.readers) return readCatalogScores(layout, ram);
  const byte = (offset) => ram[offset ^ 1];
  const bcd = (offset) =>
    packedBcd(Array.from({ length: 4 }, (_, i) => byte(offset + i)));
  const results = [];
  for (const slot of [1, 2]) {
    let value, active;
    if (game.id === "columns") {
      const base = 0xc800 + (slot - 1) * 0x170;
      const binary =
        byte(base + 0x10) * 16777216 +
        byte(base + 0x11) * 65536 +
        byte(base + 0x12) * 256 +
        byte(base + 0x13);
      value = bcd(base + 0x14) === binary ? binary : null;
      // This is a bitfield: bit 0 marks participation; bits 1-5 also change
      // during play (including jewel effects). Bits 6/7 mark terminal states.
      // Comparing the entire byte with 1 incorrectly ends live games at 0x07.
      active = (byte(base + 0x28) & 0xc1) === 0x01;
    } else if (game.id === "contra") {
      const score = 0x7c + (slot - 1) * 12;
      value = packedBcd(ram.subarray(score, score + 4));
      active =
        ram[0x81 + (slot - 1) * 12] > 0 && ram[0x81 + (slot - 1) * 12] < 10;
    } else if (game.id === "mslug") {
      const digits = Array.from({ length: 8 }, (_, i) =>
        byte(0x6e94 + (slot - 1) * 8 + i),
      );
      value = digits.every((d) => d < 10)
        ? digits.reduce((n, d) => n * 10 + d, 0)
        : null;
      const lives = byte(slot === 1 ? 0x377 : 0x417);
      active = byte(0xfdae) === 3 && lives > 0 && lives < 10;
    } else if (game.id === "1941") {
      value = bcd(slot === 1 ? 0xdb6 : 0xdba);
      active = !!(byte(0xd80) & (1 << (slot - 1)));
    } else if (game.id === "tetris") {
      const base = 0x2300 + (slot - 1) * 0x80;
      const binary =
        byte(base + 4) * 16777216 +
        byte(base + 5) * 65536 +
        byte(base + 6) * 256 +
        byte(base + 7);
      value = bcd(base) === binary ? binary : null;
      active = ram[base + 0x18] === slot;
    } else if (game.id === "mslug2") {
      value = bcd(slot === 1 ? 0xe86e : 0xe878);
      const lives = byte(slot === 1 ? 0x1276 : 0x131e);
      active = byte(0xfdae) === 3 && lives < 128;
    }
    if (
      value !== null &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= 99999999
    )
      results.push({ slot, value, active });
  }
  return results;
}
