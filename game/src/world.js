// The game's rules and state, with no drawing and no browser in it: the player on
// foot and in cars, traffic, pedestrians, police, the wanted level, combat, pickups,
// the mission chain and the in-game clock. step() advances one fixed step and returns
// what happened as bit flags, so the caller can react without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.
import { BULLET, CAR, CLOCK, CAR_COLORS, PED_COLORS, PICKUP, PLAYER, POLICE, PEDS, TRAFFIC, WANTED, WORLD } from './config.js';
import { districtAt, generateCity, hitsBuilding, randomRoadPoint, randomSidewalkPoint, resolveBuildingCollision, HORIZONTAL_ROADS, VERTICAL_ROADS } from './city.js';
import { getMission, missionCount } from './missions.js';
import { randomInt, randomPick, randomRange } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_OVER = 4;
export const EVENT_MISSION = 8;
export const EVENT_SHOT = 16;
export const EVENT_WANTED = 32;
export const EVENT_CASH = 64;
export const EVENT_STAGE = 128;

function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createWorld(random) {
  const city = generateCity(random);
  const player = { x: 720, y: 720, angle: 0, health: PLAYER.health, ammo: PLAYER.startAmmo, cash: 0, inCar: false, carId: -1, invulnerable: 0, punchTimer: 0, shootTimer: 0, moving: false, speed: 0 };
  const vehicles = [];
  for (let i = 0; i < 40; i += 1) vehicles.push({ id: i, active: false, x: 0, y: 0, angle: 0, speed: 0, color: '#888888', isPolice: false, driver: 'parked', health: 100, turn: 0 });
  const peds = [];
  for (let i = 0; i < 48; i += 1) peds.push({ active: false, x: 0, y: 0, angle: 0, speed: 0, color: '#eeeeee', isCop: false, flee: 0, targetX: 0, targetY: 0, timer: 0 });
  const bullets = [];
  for (let i = 0; i < 32; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const pickups = [];
  for (let i = 0; i < 12; i += 1) pickups.push({ active: false, kind: 'cash', x: 0, y: 0, bob: 0 });
  const particles = [];
  for (let i = 0; i < 80; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '#ffffff', size: 3 });
  const state = {
    player, vehicles, peds, bullets, pickups, particles, city,
    cash: 0, wanted: 0, wantedTimer: 0, elapsed: 0, clockMinutes: CLOCK.startHour * 60 + CLOCK.startMinute,
    missionIndex: 0, missionStage: 0, missionsDone: 0, allMissionsDone: false,
    missionFlash: 0, missionFlashText: '', message: '', messageTimer: 0,
    camera: { x: 720, y: 720 }, district: 'Coral Heights', busted: false, speedKmh: 0,
    pickupTimer: PICKUP.spawnInterval, policeTimer: 0, stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsCompleted: 0 },
  };

  function spawnParticle(x, y, color, count, speed) {
    let made = 0;
    for (const p of particles) {
      if (made >= count) break;
      if (p.active) continue;
      p.active = true; p.x = x; p.y = y;
      const a = random() * Math.PI * 2, s = randomRange(random, speed * 0.3, speed);
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = randomRange(random, 0.3, 0.7); p.color = color; p.size = randomRange(random, 2, 5);
      made += 1;
    }
  }
  function freeVehicle() { for (const v of vehicles) if (!v.active) return v; return null; }
  function freePed() { for (const p of peds) if (!p.active) return p; return null; }
  function freeBullet() { for (const b of bullets) if (!b.active) return b; return null; }
  function freePickup() { for (const p of pickups) if (!p.active) return p; return null; }

  function spawnTrafficCar() {
    const v = freeVehicle(); if (!v) return;
    // Pick a road first, then align the car's heading with that road, so traffic
    // drives along roads instead of cutting across building blocks.
    if (random() < 0.5) {
      v.x = randomPick(random, VERTICAL_ROADS); v.y = randomRange(random, 120, WORLD.height - 120);
      v.angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      v.x = randomRange(random, 120, WORLD.width - 260); v.y = randomPick(random, HORIZONTAL_ROADS);
      v.angle = random() < 0.5 ? 0 : Math.PI;
    }
    v.active = true; v.isPolice = false; v.driver = 'traffic';
    v.speed = randomRange(random, TRAFFIC.speedMin, TRAFFIC.speedMax);
    v.color = randomPick(random, CAR_COLORS); v.health = 100;
  }
  function spawnParkedCar() {
    const v = freeVehicle(); if (!v) return;
    const pt = randomSidewalkPoint(random, city);
    v.active = true; v.x = pt.x; v.y = pt.y; v.isPolice = false; v.driver = 'parked';
    v.angle = randomPick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]); v.speed = 0;
    v.color = randomPick(random, CAR_COLORS); v.health = 100;
  }
  function spawnPed(isCop) {
    const p = freePed(); if (!p) return;
    const pt = randomSidewalkPoint(random, city);
    p.active = true; p.x = pt.x; p.y = pt.y; p.isCop = !!isCop;
    p.angle = random() * Math.PI * 2; p.speed = isCop ? POLICE.footSpeed * 0.6 : randomRange(random, PEDS.speedMin, PEDS.speedMax);
    p.color = isCop ? '#2b4acb' : randomPick(random, PED_COLORS); p.flee = 0; p.timer = randomRange(random, 1, 4);
    p.targetX = pt.x; p.targetY = pt.y;
  }
  function spawnPickup(kind, x, y) {
    const p = freePickup(); if (!p) return;
    p.active = true; p.kind = kind; p.x = x; p.y = y; p.bob = random() * 6;
  }
  function spawnPoliceCar() {
    const v = freeVehicle(); if (!v) return null;
    const near = { x: clamp(player.x + randomRange(random, -500, 500), 120, WORLD.width - 260), y: clamp(player.y + randomRange(random, -400, 400), 120, WORLD.height - 120) };
    v.active = true; v.x = near.x; v.y = near.y; v.isPolice = true; v.driver = 'police';
    v.angle = Math.atan2(player.y - near.y, player.x - near.x); v.speed = POLICE.carSpeed * 0.7;
    v.color = '#22337a'; v.health = 100;
    return v;
  }

  function addWanted(amount) {
    if (state.wanted >= WANTED.max) return;
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
    state.wantedTimer = 0;
  }
  function setMessage(text, seconds) { state.message = text; state.messageTimer = seconds || 3; }

  function startMissionEffects(mission) {
    if (!mission) return;
    if (mission.id === 4) { state.wanted = 3; state.wantedTimer = 0; setMessage('Patrols are on you — lose them!', 4); }
    if (mission.id === 5) setMessage('The Vault job — go!', 4);
  }

  function reset() {
    player.x = 720; player.y = 720; player.angle = 0; player.health = PLAYER.health;
    player.ammo = PLAYER.startAmmo; player.inCar = false; player.carId = -1; player.invulnerable = 0;
    player.punchTimer = 0; player.shootTimer = 0; player.speed = 0;
    for (const v of vehicles) v.active = false;
    for (const p of peds) p.active = false;
    for (const b of bullets) b.active = false;
    for (const p of pickups) p.active = false;
    for (const p of particles) p.active = false;
    state.cash = 0; state.wanted = 0; state.wantedTimer = 0; state.elapsed = 0;
    state.clockMinutes = CLOCK.startHour * 60 + CLOCK.startMinute;
    state.missionIndex = 0; state.missionStage = 0; state.missionsDone = 0; state.allMissionsDone = false;
    state.missionFlash = 0; state.missionFlashText = ''; state.message = ''; state.messageTimer = 0;
    state.busted = false; state.speedKmh = 0; state.pickupTimer = PICKUP.spawnInterval; state.policeTimer = 0;
    state.stats = { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsCompleted: 0 };
    state.camera.x = player.x; state.camera.y = player.y;
    for (let i = 0; i < TRAFFIC.count; i += 1) { if (i < 14) spawnTrafficCar(); else spawnParkedCar(); }
    for (let i = 0; i < PEDS.count; i += 1) spawnPed(false);
    spawnPickup('health', 900, 900); spawnPickup('ammo', 1200, 480); spawnPickup('cash', 1680, 1680);
    startMissionEffects(getMission(0));
  }

  function currentMission() { return state.allMissionsDone ? null : getMission(state.missionIndex); }

  function completeStage() {
    const mission = currentMission(); if (!mission) return 0;
    state.missionStage += 1;
    if (mission.id === 5 && state.missionStage === 2) { state.wanted = 4; state.wantedTimer = 0; setMessage('Vault cash grabbed — RUN!', 4); }
    if (state.missionStage >= mission.stages.length) {
      state.cash += mission.reward; state.missionsDone += 1; state.stats.missionsCompleted += 1;
      state.missionFlash = 3; state.missionFlashText = mission.title + ' complete! +$' + mission.reward;
      spawnParticle(player.x, player.y, '#ffd23f', 24, 220);
      if (state.missionIndex + 1 >= missionCount()) { state.allMissionsDone = true; }
      else { state.missionIndex += 1; state.missionStage = 0; startMissionEffects(getMission(state.missionIndex)); }
      return EVENT_MISSION | EVENT_CASH;
    }
    state.missionFlash = 2; state.missionFlashText = 'Stage done — ' + mission.stages[state.missionStage].label;
    return EVENT_STAGE;
  }

  function enterNearestCar() {
    if (player.inCar) {
      const car = vehicles[player.carId];
      player.inCar = false; player.carId = -1; player.speed = 0;
      if (car) { player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 46; player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 46; car.driver = 'parked'; car.speed = 0; }
      return true;
    }
    let best = null, bestD = 85;
    for (const v of vehicles) {
      if (!v.active || v.driver === 'player') continue;
      const d = dist(player.x, player.y, v.x, v.y);
      if (d < bestD) { bestD = d; best = v; }
    }
    if (!best) return false;
    if (best.driver === 'traffic' || best.driver === 'police') {
      addWanted(WANTED.steal); state.stats.carsStolen += 1;
      setMessage(best.isPolice ? 'You stole a patrol car!' : 'Car stolen — the law noticed!', 3);
      const ped = freePed();
      if (ped && !best.isPolice) { ped.active = true; ped.x = best.x + 40; ped.y = best.y + 40; ped.isCop = false; ped.color = randomPick(random, PED_COLORS); ped.flee = 2; ped.speed = 90; }
    }
    best.driver = 'player'; best.health = Math.max(best.health, 40);
    player.inCar = true; player.carId = best.id; player.x = best.x; player.y = best.y; player.angle = best.angle;
    return true;
  }

  function playerCar() { return player.inCar ? vehicles[player.carId] : null; }

  function shootBullet(aimAngle) {
    if (player.ammo <= 0 || player.shootTimer > 0) return false;
    const b = freeBullet(); if (!b) return false;
    player.ammo -= 1; player.shootTimer = PLAYER.shootRate; state.stats.shotsFired += 1;
    const ox = player.inCar ? 34 : 20;
    b.active = true; b.x = player.x + Math.cos(aimAngle) * ox; b.y = player.y + Math.sin(aimAngle) * ox;
    b.vx = Math.cos(aimAngle) * BULLET.speed; b.vy = Math.sin(aimAngle) * BULLET.speed; b.life = BULLET.life;
    spawnParticle(b.x, b.y, '#ffd23f', 3, 90);
    return true;
  }

  function punch() {
    if (player.punchTimer > 0) return false;
    player.punchTimer = PLAYER.punchRate;
    let hitAny = false;
    for (const p of peds) {
      if (!p.active) continue;
      if (dist(player.x, player.y, p.x, p.y) < PLAYER.punchRange + 14) {
        p.flee = 3; p.x += Math.cos(player.angle) * 26; p.y += Math.sin(player.angle) * 26;
        if (p.isCop) addWanted(WANTED.hitCop); else addWanted(WANTED.hitPed);
        hitAny = true;
      }
    }
    return hitAny;
  }

  function stepPlayer(dt, input) {
    player.punchTimer = Math.max(0, player.punchTimer - dt);
    player.shootTimer = Math.max(0, player.shootTimer - dt);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    const car = playerCar();
    if (car) {
      const throttle = input.my < 0 ? CAR.accel : 0;
      const braking = input.my > 0 && car.speed > 0 ? CAR.brake : 0;
      const reversing = input.my > 0 && car.speed <= 0 ? CAR.reverseAccel : 0;
      car.speed += (throttle - braking + reversing) * dt;
      if (input.my === 0) car.speed -= car.speed * CAR.drag * dt * 2;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const steer = input.mx * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed >= 0 ? 1 : -1);
      car.angle += steer;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (hitsBuilding(city, nx, ny, 26)) {
        if (Math.abs(car.speed) > 240) { player.health -= 4; spawnParticle(car.x, car.y, '#ffaa33', 8, 160); }
        car.speed *= -0.25;
      } else { car.x = nx; car.y = ny; }
      car.x = clamp(car.x, 40, WORLD.width - 220); car.y = clamp(car.y, 40, WORLD.height - 40);
      player.x = car.x; player.y = car.y; player.angle = car.angle; player.speed = Math.abs(car.speed);
      state.speedKmh = Math.round(Math.abs(car.speed) * 0.18);
      if (input.attack) shootBullet(car.angle);
    } else {
      const len = Math.hypot(input.mx, input.my);
      player.moving = len > 0.1;
      if (player.moving) {
        const sp = PLAYER.walkSpeed;
        const nx = player.x + (input.mx / Math.max(1, len)) * sp * dt;
        const ny = player.y + (input.my / Math.max(1, len)) * sp * dt;
        player.angle = Math.atan2(input.my, input.mx);
        if (!hitsBuilding(city, nx, player.y, PLAYER.radius)) player.x = nx;
        if (!hitsBuilding(city, player.x, ny, PLAYER.radius)) player.y = ny;
        player.speed = sp;
      } else player.speed = 0;
      player.x = clamp(player.x, 30, WORLD.width - 210); player.y = clamp(player.y, 30, WORLD.height - 30);
      state.speedKmh = 0;
      if (input.attack) {
        // Armed: shoot toward the aim. Unarmed: punch whatever is in reach.
        const aim = input.aimAngle !== undefined && input.aimAngle !== null ? input.aimAngle : player.angle;
        if (player.ammo > 0) shootBullet(aim);
        else punch();
      }
    }
    if (input.enter) enterNearestCar();
  }

  function stepTraffic(dt) {
    for (const v of vehicles) {
      if (!v.active || v.driver !== 'traffic') continue;
      v.x += Math.cos(v.angle) * v.speed * dt;
      v.y += Math.sin(v.angle) * v.speed * dt;
      const nearX = VERTICAL_ROADS_NEAR(v.x), nearY = HORIZONTAL_ROADS_NEAR(v.y);
      if (nearX !== null && nearY !== null && random() < 0.012) v.angle = randomPick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      if (v.x < 80 || v.x > WORLD.width - 240 || v.y < 80 || v.y > WORLD.height - 80) {
        const pt = randomRoadPoint(random); v.x = pt.x; v.y = pt.y; v.angle = random() < 0.5 ? 0 : Math.PI / 2;
      }
      if (hitsBuilding(city, v.x, v.y, 24)) { v.angle += Math.PI / 2; v.x -= Math.cos(v.angle) * 10; v.y -= Math.sin(v.angle) * 10; }
      if (!player.inCar && dist(v.x, v.y, player.x, player.y) < 34 && player.invulnerable === 0) {
        player.health -= 12; player.invulnerable = 1; state.stats.pedsHit += 1;
        spawnParticle(player.x, player.y, '#ff5d5d', 10, 180);
      }
      for (const o of vehicles) {
        if (o === v || !o.active) continue;
        if (dist(v.x, v.y, o.x, o.y) < 52) { v.speed = Math.min(v.speed, 90); }
      }
    }
  }
  function VERTICAL_ROADS_NEAR(x) { for (const r of [240, 720, 1200, 1680, 2160, 2640, 3120, 3600]) if (Math.abs(x - r) < 40) return r; return null; }
  function HORIZONTAL_ROADS_NEAR(y) { for (const r of [240, 720, 1200, 1680, 2160, 2640]) if (Math.abs(y - r) < 40) return r; return null; }

  function stepPeds(dt) {
    for (const p of peds) {
      if (!p.active) continue;
      p.timer -= dt;
      if (p.isCop) {
        if (state.wanted >= 1) {
          const d = dist(p.x, p.y, player.x, player.y);
          p.angle = Math.atan2(player.y - p.y, player.x - p.x);
          p.speed = POLICE.footSpeed;
          p.x += Math.cos(p.angle) * p.speed * dt; p.y += Math.sin(p.angle) * p.speed * dt;
          if (!player.inCar && d < 28) { state.busted = true; }
          if (player.inCar && d < 40) { const c = playerCar(); if (c) c.speed *= 0.98; }
        } else if (p.timer <= 0) { const pt = randomSidewalkPoint(random, city); p.targetX = pt.x; p.targetY = pt.y; p.timer = randomRange(random, 3, 7); }
        if (state.wanted < 1) {
          const d = dist(p.x, p.y, p.targetX, p.targetY);
          if (d > 12) { p.angle = Math.atan2(p.targetY - p.y, p.targetX - p.x); p.x += Math.cos(p.angle) * 60 * dt; p.y += Math.sin(p.angle) * 60 * dt; }
        }
        continue;
      }
      if (p.flee > 0) {
        p.flee -= dt;
        const a = Math.atan2(p.y - player.y, p.x - player.x);
        p.x += Math.cos(a) * 130 * dt; p.y += Math.sin(a) * 130 * dt;
      } else if (p.timer <= 0) {
        const pt = randomSidewalkPoint(random, city); p.targetX = pt.x; p.targetY = pt.y; p.timer = randomRange(random, 3, 8);
      } else {
        const d = dist(p.x, p.y, p.targetX, p.targetY);
        if (d > 14) { p.angle = Math.atan2(p.targetY - p.y, p.targetX - p.x); p.x += Math.cos(p.angle) * p.speed * dt; p.y += Math.sin(p.angle) * p.speed * dt; }
      }
      if (hitsBuilding(city, p.x, p.y, 10)) { p.targetX = p.x + 60; p.targetY = p.y + 60; }
      p.x = clamp(p.x, 30, WORLD.width - 210); p.y = clamp(p.y, 30, WORLD.height - 30);
      // A car hitting a pedestrian is a crime, but only once per pedestrian:
      // while the same person is already fleeing, it costs no extra wanted star.
      if (player.inCar && dist(p.x, p.y, player.x, player.y) < 36) {
        if (p.flee <= 0) { addWanted(WANTED.hitPed); state.stats.pedsHit += 1; }
        p.flee = 2;
        spawnParticle(p.x, p.y, '#ff5d5d', 8, 150);
        p.x += Math.cos(player.angle) * 40; p.y += Math.sin(player.angle) * 40;
      }
    }
    let activePeds = 0; for (const p of peds) if (p.active) activePeds += 1;
    if (activePeds < PEDS.count) spawnPed(false);
  }

  function stepPolice(dt) {
    const wantCars = state.wanted > 0 ? Math.min(state.wanted, POLICE.maxCars) : 0;
    let policeCars = 0; for (const v of vehicles) if (v.active && v.isPolice && v.driver === 'police') policeCars += 1;
    state.policeTimer -= dt;
    if (policeCars < wantCars && state.policeTimer <= 0) { spawnPoliceCar(); state.policeTimer = 1.2; }
    for (const v of vehicles) {
      if (!v.active || !v.isPolice || v.driver !== 'police') continue;
      // Each patrol car aims at a slightly different point around the player,
      // so they surround instead of stacking on one spot and shredding health.
      const spread = v.id * 2.1;
      const tx = player.x + Math.cos(spread) * 70, ty = player.y + Math.sin(spread) * 70;
      const targetAngle = Math.atan2(ty - v.y, tx - v.x);
      v.angle = angleLerp(v.angle, targetAngle, clamp(2.2 * dt, 0, 1));
      v.speed = POLICE.carSpeed * (0.75 + state.wanted * 0.06);
      v.x += Math.cos(v.angle) * v.speed * dt; v.y += Math.sin(v.angle) * v.speed * dt;
      resolveBuildingCollision(city, v, 26);
      const d = dist(v.x, v.y, player.x, player.y);
      if (d < 58) {
        if (player.inCar) {
          const car = playerCar(); if (car) car.speed *= 0.94;
          // One flat hit, then a grace period: overlapping patrol cars can no
          // longer drain the whole health bar in a second.
          if (player.invulnerable === 0) { player.health -= 5; player.invulnerable = 0.9; spawnParticle(v.x, v.y, '#ffaa33', 6, 120); }
        } else if (state.wanted >= 2) { state.busted = true; }
        else if (player.invulnerable === 0) { player.health -= 6; player.invulnerable = 0.8; }
      }
    }
    let cops = 0; for (const p of peds) if (p.active && p.isCop) cops += 1;
    if (state.wanted >= 3 && cops < 2 && state.policeTimer <= 0) { spawnPed(true); state.policeTimer = 2; }
    if (state.wanted === 0) for (const p of peds) if (p.active && p.isCop) p.active = false;
  }

  function stepBullets(dt) {
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || hitsBuilding(city, b.x, b.y, 4) || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) { b.active = false; continue; }
      for (const p of peds) {
        if (!p.active) continue;
        if (dist(b.x, b.y, p.x, p.y) < 18) {
          b.active = false; p.flee = 3; spawnParticle(p.x, p.y, '#ff5d5d', 10, 160);
          if (p.isCop) addWanted(WANTED.hitCop); else addWanted(WANTED.shoot);
          break;
        }
      }
      if (!b.active) continue;
      for (const v of vehicles) {
        if (!v.active || v.driver === 'player') continue;
        if (dist(b.x, b.y, v.x, v.y) < 30) {
          b.active = false; v.health -= PLAYER.shootDamage;
          spawnParticle(b.x, b.y, '#ffaa33', 6, 140);
          if (v.health <= 0) { v.active = false; spawnParticle(v.x, v.y, '#ff5d5d', 24, 260); addWanted(1); }
          break;
        }
      }
    }
  }

  function stepPickups(dt) {
    let events = 0;
    state.pickupTimer -= dt;
    if (state.pickupTimer <= 0) {
      let active = 0; for (const p of pickups) if (p.active) active += 1;
      if (active < PICKUP.max) { const pt = randomSidewalkPoint(random, city); spawnPickup(randomPick(random, ['health', 'ammo', 'cash']), pt.x, pt.y); }
      state.pickupTimer = PICKUP.spawnInterval;
    }
    for (const p of pickups) {
      if (!p.active) continue;
      p.bob += dt * 3;
      if (dist(p.x, p.y, player.x, player.y) < 36) {
        p.active = false; events |= EVENT_PICKUP;
        if (p.kind === 'health') player.health = Math.min(PLAYER.health, player.health + PICKUP.health);
        else if (p.kind === 'ammo') player.ammo = Math.min(PLAYER.maxAmmo, player.ammo + PICKUP.ammo);
        else { state.cash += PICKUP.cash; events |= EVENT_CASH; }
      }
    }
    return events;
  }

  function stepMission(dt) {
    void dt;
    const mission = currentMission(); if (!mission) return 0;
    const stage = mission.stages[state.missionStage]; if (!stage) return 0;
    if (stage.type === 'escape') {
      if (state.wanted === 0 && dist(player.x, player.y, stage.x, stage.y) < 90) return completeStage();
      return 0;
    }
    if (stage.type === 'drive' && !player.inCar) return 0;
    if (dist(player.x, player.y, stage.x, stage.y) < 80) return completeStage();
    return 0;
  }

  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.clockMinutes += dt * CLOCK.minutesPerSecond;
    if (state.clockMinutes >= 1440) state.clockMinutes -= 1440;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.missionFlash > 0) state.missionFlash -= dt;
    state.district = districtAt(player.x, player.y);
    const safeInput = input || { mx: 0, my: 0, attack: false, enter: false, aimAngle: null };
    if (!harmless) stepPlayer(dt, safeInput);
    stepTraffic(dt);
    stepPeds(dt);
    stepPolice(dt);
    stepBullets(dt);
    if (!harmless) {
      events |= stepPickups(dt);
      if (state.wanted > 0) {
        state.wantedTimer += dt;
        const nearCop = vehicles.some((v) => v.active && v.isPolice && dist(v.x, v.y, player.x, player.y) < 420);
        if (!nearCop && state.wantedTimer > WANTED.hideSeconds && state.wantedTimer > WANTED.decaySeconds) { state.wanted -= 1; state.wantedTimer = 0; events |= EVENT_WANTED; }
      }
      events |= stepMission(dt);
      if (safeInput.attack && player.shootTimer > PLAYER.shootRate - 0.05) events |= EVENT_SHOT;
    }
    for (const pt of particles) {
      if (!pt.active) continue;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.96; pt.vy *= 0.96; pt.life -= dt;
      if (pt.life <= 0) pt.active = false;
    }
    state.camera.x += (player.x - state.camera.x) * Math.min(1, 5 * dt);
    state.camera.y += (player.y - state.camera.y) * Math.min(1, 5 * dt);
    if (player.health <= 0 || state.busted) events |= EVENT_OVER;
    return events;
  }

  function teleport(x, y) { player.x = x; player.y = y; state.camera.x = x; state.camera.y = y; }
  function giveCarAt(x, y) {
    const v = freeVehicle(); if (!v) return null;
    v.active = true; v.x = x; v.y = y; v.angle = 0; v.speed = 0; v.isPolice = false; v.driver = 'player';
    v.color = '#e8e0d0'; v.health = 100; player.inCar = true; player.carId = v.id; player.x = x; player.y = y;
    return v;
  }

  reset();
  return {
    state, reset, step, currentMission, enterNearestCar, addWanted, setMessage,
    teleport, giveCarAt, spawnPoliceCar, startMissionEffects,
    setMission(index, stage) { state.missionIndex = index; state.missionStage = stage || 0; state.allMissionsDone = false; startMissionEffects(getMission(index)); },
    setWanted(n) { state.wanted = n; state.wantedTimer = 0; },
    setCash(n) { state.cash = n; },
  };
}
