// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (on foot: walk toward the marker; in a car: a route follower
// that advances through road waypoints in order and never goes back to one it
// already passed, steering by the angle to the next waypoint, and latches done
// once it reaches the last one, so coasting past it never triggers a U-turn),
// so the frame is what a short game really looks like and the same seed always
// gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 10;
const CHASE_SECONDS = 10;
const MISSION_SECONDS = 10;

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
/** Walk straight toward a target point. */
function autopilotWalk(world, target) {
  const p = world.state.player;
  const dx = target.x - p.x, dy = target.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { mx: dx / len, my: dy / len, attack: false, enter: false, aimAngle: Math.atan2(dy, dx) };
}
/**
 * A route follower: it advances through the waypoints in order, moving on when
 * the car comes within 220 px, and coasts to a stop at the last one. The index
 * only ever moves forward, and a done latch keeps it coasting once the route is
 * finished, even as the car rolls a little past the last waypoint.
 */
function makeRouteFollower(waypoints) {
  let index = 0;
  let done = false;
  return function drive(world) {
    const p = world.state.player;
    if (done) return { mx: 0, my: 0, attack: false, enter: false, aimAngle: p.angle };
    while (index < waypoints.length - 1 && Math.hypot(waypoints[index].x - p.x, waypoints[index].y - p.y) < 220) index += 1;
    const target = waypoints[index];
    const distance = Math.hypot(target.x - p.x, target.y - p.y);
    if (index === waypoints.length - 1 && distance < 220) {
      done = true;
      return { mx: 0, my: 0, attack: false, enter: false, aimAngle: p.angle };
    }
    const desired = Math.atan2(target.y - p.y, target.x - p.x);
    const steer = Math.max(-1, Math.min(1, angleDiff(p.angle, desired) * 2.5));
    return { mx: steer, my: -1, attack: false, enter: false, aimAngle: desired };
  };
}

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'start') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, attack: false, enter: false, aimAngle: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'drive') {
    world.giveCarAt(720, 720);
    const drive = makeRouteFollower([{ x: 1680, y: 720 }, { x: 2640, y: 720 }, { x: 3120, y: 720 }]);
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) world.step(STEP, drive(world), false);
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  if (name === 'chase') {
    world.giveCarAt(1440, 1200);
    world.setWanted(3);
    const drive = makeRouteFollower([{ x: 2160, y: 1200 }, { x: 2640, y: 1200 }, { x: 2640, y: 2160 }]);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) world.step(STEP, drive(world), false);
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  // mission (default): on foot near the Coral Cafe, mission 1 in progress.
  world.teleport(700, 700);
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    world.step(STEP, autopilotWalk(world, { x: 580, y: 670 }), false);
    if (state.missionStage > 0) break;
  }
  return { screen: SCREEN_PLAY, best: state.cash };
}
