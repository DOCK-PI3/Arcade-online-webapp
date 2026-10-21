import additions from "../config/catalog-additions.json" with { type: "json" };

export const catalogAdditions = additions;
const profiles = new Map(additions.map((game) => [game.id, game]));
export function gameProfile(id) {
  const game = profiles.get(id);
  return game
    ? {
        playMode: game.playMode,
        arcadePlayers: game.arcade_players,
        startTogether: !!game.startTogether,
        controlHint: game.controlHint,
        inputMap: game.inputMap,
        inputMode: game.inputMode,
        analogInputs: game.analogInputs,
        scoreLabel: game.scoreLabel,
        scoreUnit: game.scoreUnit,
        coreOptions: game.coreOptions,
        core: game.core || "fbneo",
        bootFrames: game.bootFrames || 1200,
        bootSequence: game.bootSequence,
        coinSlot: game.coinSlot,
      }
    : {};
}
