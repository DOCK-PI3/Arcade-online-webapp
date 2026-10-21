import definitions from "../config/catalog-score-layouts.json" with { type: "json" };

export const catalogScoreLayouts = definitions;

function numberAt(ram, field) {
  if (field.select) {
    const { when, then: yes, else: no } = field.select;
    return numberAt(ram, matches(ram, when) ? yes : no);
  }
  if (field.sum) {
    const values = field.sum.map((part) => numberAt(ram, part));
    if (values.some((value) => value === null)) return null;
    const value = values.reduce((total, part) => total + part, 0);
    return Number.isSafeInteger(value) ? value : null;
  }
  const {
    offset,
    length = 1,
    type = "integer",
    swap = 0,
    endian = "big",
    scale = 1,
  } = field;
  let value = 0;
  for (let i = 0; i < length; i++) {
    const index = offset + (endian === "little" ? length - 1 - i : i);
    const byte = ram[(field.base || 0) + (index ^ swap)];
    if (byte === undefined) return null;
    if (type === "digits") {
      if (byte > 9) return null;
      value = value * 10 + byte;
    } else if (type === "bcd") {
      if (byte >> 4 > 9 || (byte & 15) > 9) return null;
      value = value * 100 + (byte >> 4) * 10 + (byte & 15);
    } else value = value * 256 + byte;
  }
  value *= scale;
  return Number.isSafeInteger(value) ? value : null;
}

function matches(ram, condition) {
  if (condition.all) return condition.all.every((c) => matches(ram, c));
  if (condition.any) return condition.any.some((c) => matches(ram, c));
  let value = numberAt(ram, condition);
  if (value === null) return false;
  if (condition.mask !== undefined) value &= condition.mask;
  return (
    (condition.eq === undefined || value === condition.eq) &&
    (condition.neq === undefined || value !== condition.neq) &&
    (condition.min === undefined || value >= condition.min) &&
    (condition.max === undefined || value <= condition.max)
  );
}

export function readCatalogScores(layout, ram) {
  if (ram.length !== layout.size) return [];
  return layout.readers.flatMap((reader, index) => {
    const value = numberAt(ram, reader.score);
    if (value === null || value < 0 || value > 99999999) return [];
    return [
      {
        slot: index + 1,
        value,
        active: reader.active.every((c) => matches(ram, c)),
      },
    ];
  });
}
