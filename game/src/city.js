// City generation for Solmara: a road grid, named districts, building blocks, parks,
// a beach and marina on the east edge, trees, lamps and parking bays. Everything is
// derived from the seeded RNG, so the same seed builds the same city every time.
import { DISTRICTS, PALETTE, WORLD } from './config.js';
import { randomInt, randomPick, randomRange } from './random.js';

export const ROAD_WIDTH = 96;
export const BLOCK = 480;
export const ROAD_OFFSET = 240;

export const VERTICAL_ROADS = [240, 720, 1200, 1680, 2160, 2640, 3120, 3600];
export const HORIZONTAL_ROADS = [240, 720, 1200, 1680, 2160, 2640];

/** True when a point sits on a road (within half the road width of a road centre line). */
export function isOnRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  for (const rx of VERTICAL_ROADS) if (Math.abs(x - rx) <= half) return true;
  for (const ry of HORIZONTAL_ROADS) if (Math.abs(y - ry) <= half) return true;
  return false;
}
/** The nearest road centre line to a point, as { axis: 'x'|'y', value }. */
export function nearestRoad(x, y) {
  let best = { axis: 'x', value: VERTICAL_ROADS[0], dist: Infinity };
  for (const rx of VERTICAL_ROADS) { const d = Math.abs(x - rx); if (d < best.dist) best = { axis: 'x', value: rx, dist: d }; }
  for (const ry of HORIZONTAL_ROADS) { const d = Math.abs(y - ry); if (d < best.dist) best = { axis: 'y', value: ry, dist: d }; }
  return best;
}
/** A point on a road near (x, y), snapped to the closest lane. */
export function snapToRoad(x, y) {
  const road = nearestRoad(x, y);
  return road.axis === 'x' ? { x: road.value, y } : { x, y: road.value };
}
/** The district name for a world position. */
export function districtAt(x, y) {
  const col = Math.max(0, Math.min(6, Math.floor(x / BLOCK) - 0));
  const row = Math.max(0, Math.min(4, Math.floor(y / BLOCK)));
  const c = Math.max(0, Math.min(DISTRICTS[0].length - 1, Math.floor(x / 540)));
  return DISTRICTS[row][c];
}

const BUILDING_COLORS = [PALETTE.buildingA, PALETTE.buildingB, PALETTE.buildingC, PALETTE.buildingD, PALETTE.buildingE, PALETTE.buildingF];

/** Build the whole city once from the seeded RNG. */
export function generateCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const parking = [];
  const beach = { x: WORLD.width - 190, y: 0, width: 190, height: WORLD.height };
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const bx = ROAD_OFFSET + col * BLOCK + 60;
      const by = ROAD_OFFSET + row * BLOCK + 60;
      const bw = BLOCK - 120;
      const bh = BLOCK - 120;
      // One block in five is a park instead of buildings.
      if (random() < 0.16) {
        parks.push({ x: bx, y: by, width: bw, height: bh, name: randomPick(random, ['Palm Park', 'Sunset Green', 'Coral Gardens', 'Plaza del Sol']) });
        for (let i = 0; i < 7; i += 1) trees.push({ x: bx + random() * bw, y: by + random() * bh, r: 12 + random() * 8 });
        continue;
      }
      const count = randomInt(random, 2, 4);
      for (let i = 0; i < count; i += 1) {
        const w = randomRange(random, 90, 150);
        const h = randomRange(random, 80, 140);
        const x = bx + random() * Math.max(10, bw - w);
        const y = by + random() * Math.max(10, bh - h);
        buildings.push({
          x, y, width: w, height: h, color: randomPick(random, BUILDING_COLORS),
          stories: randomInt(random, 1, 6), label: randomPick(random, ['', '', 'HOTEL', 'CAFE', 'SHOP', 'GARAGE', 'MARKET', 'CLINIC', 'CINEMA', 'OFFICE']),
        });
      }
      for (let i = 0; i < 3; i += 1) trees.push({ x: bx + random() * bw, y: by + random() * bh, r: 10 + random() * 8 });
      if (random() < 0.6) parking.push({ x: bx + 20, y: by + bh - 46, width: 120, height: 34 });
    }
  }
  for (const rx of VERTICAL_ROADS) for (const ry of HORIZONTAL_ROADS) {
    lamps.push({ x: rx + 58, y: ry + 58 });
    lamps.push({ x: rx - 58, y: ry - 58 });
  }
  const landmarks = [
    { x: 480, y: 480, width: 200, height: 150, name: 'Coral Cafe', color: PALETTE.buildingC },
    { x: 1920, y: 960, width: 240, height: 170, name: 'Solmara Bank', color: PALETTE.buildingB },
    { x: 2880, y: 1920, width: 220, height: 160, name: 'Safehouse', color: PALETTE.buildingE },
    { x: 3360, y: 480, width: 200, height: 150, name: 'Marina Pier', color: PALETTE.buildingA },
    { x: 960, y: 2160, width: 220, height: 160, name: 'Rolo Garage', color: PALETTE.buildingD },
    { x: 2400, y: 480, width: 200, height: 150, name: 'City Vault', color: PALETTE.buildingF },
  ];
  return { buildings, trees, lamps, parks, parking, beach, landmarks, verticalRoads: VERTICAL_ROADS, horizontalRoads: HORIZONTAL_ROADS };
}

/** True when a circle at (x, y) with radius r overlaps any building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.width && y + r > b.y && y - r < b.y + b.height) return b;
  }
  for (const l of city.landmarks) {
    if (x + r > l.x && x - r < l.x + l.width && y + r > l.y && y - r < l.y + l.height) return l;
  }
  return null;
}
/** Push a circle out of any building it overlaps; returns true when it was pushed. */
export function resolveBuildingCollision(city, body, r) {
  const b = hitsBuilding(city, body.x, body.y, r);
  if (!b) return false;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const dx = body.x - cx, dy = body.y - cy;
  const overlapX = b.width / 2 + r - Math.abs(dx);
  const overlapY = b.height / 2 + r - Math.abs(dy);
  if (overlapX < overlapY) body.x += dx >= 0 ? overlapX : -overlapX;
  else body.y += dy >= 0 ? overlapY : -overlapY;
  return true;
}
/** A random point on a sidewalk (just off a road), clear of buildings. */
export function randomSidewalkPoint(random, city) {
  for (let tries = 0; tries < 40; tries += 1) {
    const road = random() < 0.5
      ? { axis: 'x', value: randomPick(random, VERTICAL_ROADS) }
      : { axis: 'y', value: randomPick(random, HORIZONTAL_ROADS) };
    const along = randomRange(random, 120, road.axis === 'x' ? WORLD.height - 120 : WORLD.width - 120);
    const off = (random() < 0.5 ? -1 : 1) * (ROAD_WIDTH / 2 + 22);
    const x = road.axis === 'x' ? road.value + off : along;
    const y = road.axis === 'x' ? along : road.value + off;
    if (x > 60 && x < WORLD.width - 220 && y > 60 && y < WORLD.height - 60 && !hitsBuilding(city, x, y, 20)) return { x, y };
  }
  return { x: 720, y: 720 };
}
/** A random point on a road centre line. */
export function randomRoadPoint(random) {
  if (random() < 0.5) return { x: randomPick(random, VERTICAL_ROADS), y: randomRange(random, 120, WORLD.height - 120) };
  return { x: randomRange(random, 120, WORLD.width - 260), y: randomPick(random, HORIZONTAL_ROADS) };
}
