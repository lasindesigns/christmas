/**
 * Live Secret Santa assignment.
 *
 * There is no pre-run draw. Each time a player spins, the server randomly picks
 * a person for them. To keep the draw fair - everyone gives exactly one gift and
 * receives exactly one gift - the pick is chosen so that the remaining players
 * can still all be matched without duplicates and without matching themselves.
 */

function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Does a perfect matching exist pairing every giver to a distinct target where
 * a giver can never be paired with themselves? (Kuhn's augmenting-path matching.)
 */
function hasPerfectMatching(givers, targets) {
  if (givers.length !== targets.length) return false;

  const options = new Map();
  for (const giver of givers) {
    options.set(giver, targets.filter((t) => t !== giver));
  }

  const targetOwner = new Map();
  const augment = (giver, visited) => {
    for (const target of options.get(giver)) {
      if (visited.has(target)) continue;
      visited.add(target);
      if (!targetOwner.has(target) || augment(targetOwner.get(target), visited)) {
        targetOwner.set(target, giver);
        return true;
      }
    }
    return false;
  };

  for (const giver of givers) {
    if (!augment(giver, new Set())) return false;
  }
  return true;
}

/**
 * Pick a random target for `currentId`.
 *
 * @param {number} currentId the player who is spinning
 * @param {number[]} givers everyone who has not spun yet (includes currentId)
 * @param {number[]} targets everyone not yet chosen by another player
 * @returns {number|null} the chosen target id, or null if impossible
 */
export function pickRandomTarget(currentId, givers, targets) {
  const candidates = shuffled(targets.filter((t) => t !== currentId));
  const remainingGivers = givers.filter((g) => g !== currentId);

  for (const candidate of candidates) {
    const remainingTargets = targets.filter((t) => t !== candidate);
    if (hasPerfectMatching(remainingGivers, remainingTargets)) {
      return candidate;
    }
  }
  return null;
}
