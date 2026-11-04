// Shared gates for events, radio and dialogue. Bare decision names and decisions.*
// are aliases; other flags live on game.flags. Missing flags never match.
export function flagsMatch(game, flags = {}) {
  return Object.entries(flags).every(([key, value]) => {
    const name = key.startsWith('decisions.') ? key.slice(10) : key;
    const actual = Object.hasOwn(game.decisions || {}, name)
      ? game.decisions[name] : game.flags?.[key];
    return actual !== undefined && actual === value;
  });
}
export function needsMatch(game, needs = {}) {
  return flagsMatch(game, needs.flag)
    && (needs.trustBelow === undefined || game.trust < needs.trustBelow)
    && (needs.trustAbove === undefined || game.trust > needs.trustAbove);
}
