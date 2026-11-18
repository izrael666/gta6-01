// Boot and the one loop for Solmara: input is read every frame, the world advances
// in fixed 1/60 s steps, the renderer paints what is there, and WebAudio follows
// the car and the police. The game moves between five screens: title, play, paused,
// mission complete and game over. Progress (cash, missions unlocked, best cash)
// is saved to localStorage and loaded on the next visit.
//
// ?seed=N fixes the city and traffic. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_MISSION, EVENT_OVER, EVENT_STAGE } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_MISSION, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
// Exposed for play-testing and debugging only; the game never reads it back.
window.__solmaraWorld = world;

function readSave() {
  try { return JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.state.cash, missionIndex: world.state.missionIndex,
      missionsDone: world.state.missionsDone, best: readBest(),
    }));
  } catch { /* Storage can be off: progress then lasts this visit only. */ }
}
function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* See writeSave. */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pendingEnter = false;

  function announce(message) { status.textContent = message; }

  function applySave() {
    const save = readSave();
    if (!save) return;
    if (Number.isFinite(save.cash)) world.state.cash = save.cash;
    if (Number.isInteger(save.missionIndex) && save.missionIndex > 0 && save.missionIndex < 5) {
      world.setMission(save.missionIndex, 0);
    }
    if (Number.isInteger(save.missionsDone)) world.state.missionsDone = save.missionsDone;
  }

  function startGame() {
    world.reset();
    applySave();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Solmara. Mission 1: First Delivery.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.cash > best) { best = world.state.cash; saveBest(best); }
    writeSave();
    audio.busted();
    announce(world.state.busted ? 'Busted. Game over.' : 'Wasted. Game over.');
  }

  function aimAngle() {
    const mouse = input.mouse();
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW.width, rect.height / VIEW.height);
    const offsetX = (rect.width - VIEW.width * scale) / 2;
    const offsetY = (rect.height - VIEW.height * scale) / 2;
    const logicalX = (mouse.x - rect.left - offsetX) / scale;
    const logicalY = (mouse.y - rect.top - offsetY) / scale;
    const wx = world.state.camera.x - VIEW.width / 2 + logicalX;
    const wy = world.state.camera.y - VIEW.height / 2 + logicalY;
    return Math.atan2(wy - world.state.player.y, wx - world.state.player.x);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.ensure(); audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_MISSION) { screen = SCREEN_PLAY; announce('Playing.'); }
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    if (actions & ACTION_ENTER && screen === SCREEN_PLAY) pendingEnter = true;
    if (actions & (ACTION_CONFIRM | ACTION_ENTER) && screen === SCREEN_TITLE) audio.ensure();
  }

  function step() {
    if (screen === SCREEN_TITLE) { world.step(STEP, { mx: 0, my: 0, attack: false, enter: false, aimAngle: 0 }, true); return; }
    const move = input.move();
    const events = world.step(STEP, {
      mx: move.mx, my: move.my,
      attack: input.attackHeld(), enter: pendingEnter, aimAngle: aimAngle(),
    }, false);
    pendingEnter = false;
    audio.ensure();
    audio.setEngine(world.state.player.inCar ? Math.abs(world.state.speedKmh) / 100 : 0, world.state.player.inCar);
    audio.setSiren(world.state.wanted > 0, world.state.elapsed);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_MISSION) {
      // A whole mission is done: pay out, save, and show the mission screen.
      audio.missionComplete(); writeSave();
      if (world.state.cash > best) { best = world.state.cash; saveBest(best); }
      screen = SCREEN_MISSION;
      announce(world.state.allMissionsDone ? 'All missions complete! Solmara is yours.' : world.state.missionFlashText);
    } else if (events & EVENT_STAGE) {
      // One stage of a multi-stage mission: a chime and the next objective.
      // The game keeps running; only a finished mission opens the screen.
      audio.cash();
      announce(world.state.missionFlashText);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) { step(); accumulator -= STEP; }
    } else accumulator = 0;
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
  window.addEventListener('keydown', () => audio.ensure(), { once: true });

  announce('Solmara. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
