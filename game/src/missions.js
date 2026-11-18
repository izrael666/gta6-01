// Mission and story definitions for Solmara: five chained jobs for Marisol's crew.
// Each mission is a list of stages; the world tracks the current stage and reports
// progress, and completing every stage pays cash and unlocks the next mission.
// All names, characters and places are original. Every stage target sits on a
// road or sidewalk, just outside its landmark, so the player can always reach it.
export const MISSIONS = [
  {
    id: 1, title: 'First Delivery', giver: 'Marisol Vega',
    briefing: 'Marisol runs the Coral Cafe. Pick up her parcel and take it to the Marina Pier before the lunch crowd notices it is gone.',
    reward: 250,
    stages: [
      { type: 'goto', x: 580, y: 670, label: 'Pick up the parcel at Coral Cafe' },
      { type: 'deliver', x: 3460, y: 670, label: 'Deliver the parcel to Marina Pier' },
    ],
  },
  {
    id: 2, title: 'Getaway Driver', giver: 'Rolo Ferrante',
    briefing: 'Rolo needs a wheelman. Pick him up at his garage, then drive him to the Safehouse. The patrols are out — keep it smooth.',
    reward: 400,
    stages: [
      { type: 'goto', x: 1070, y: 2350, label: 'Pick up Rolo at Rolo Garage' },
      { type: 'drive', x: 2990, y: 2110, label: 'Drive Rolo to the Safehouse (stay in a car)' },
    ],
  },
  {
    id: 3, title: 'The Pickup', giver: 'Marisol Vega',
    briefing: 'Three supply crates are stashed around Downtown. Collect all three and bring the count home — on foot or by car.',
    reward: 500,
    stages: [
      { type: 'collect', x: 1680, y: 1200, label: 'Collect crate 1 of 3 — Downtown' },
      { type: 'collect', x: 2160, y: 720, label: 'Collect crate 2 of 3 — Palm Row' },
      { type: 'collect', x: 1200, y: 1680, label: 'Collect crate 3 of 3 — Old Town' },
    ],
  },
  {
    id: 4, title: 'Hot Pursuit', giver: 'Captain Diaz',
    briefing: 'Diaz tipped you off: the patrols are hunting a lookalike. Lose a 3-star wanted level — shake the police, then reach the Safehouse.',
    reward: 650,
    stages: [
      { type: 'escape', x: 2990, y: 2110, label: 'Lose the police (drop to 0 stars) then reach the Safehouse' },
    ],
  },
  {
    id: 5, title: 'The Solmara Heist', giver: 'Marisol Vega',
    briefing: 'The final job. Grab the vault cash at City Vault, outrun the whole city patrol, and bring it to the Safehouse. Make Solmara yours.',
    reward: 1500,
    stages: [
      { type: 'goto', x: 2500, y: 670, label: 'Reach the City Vault' },
      { type: 'collect', x: 2500, y: 670, label: 'Grab the vault cash' },
      { type: 'escape', x: 2990, y: 2110, label: 'Escape with the cash — reach the Safehouse' },
    ],
  },
];

export function getMission(index) { return MISSIONS[index] || null; }
export function missionCount() { return MISSIONS.length; }
/** The label of the current stage, or a completion line when the mission is done. */
export function currentStageLabel(mission, stageIndex) {
  if (!mission) return 'Free roam — explore Solmara';
  if (stageIndex >= mission.stages.length) return mission.title + ' — complete!';
  return mission.stages[stageIndex].label;
}
/** The world position the player should head for right now, or null. */
export function currentStageTarget(mission, stageIndex) {
  if (!mission || stageIndex >= mission.stages.length) return null;
  const stage = mission.stages[stageIndex];
  return { x: stage.x, y: stage.y, type: stage.type };
}
