// Solmara — every tuning number and colour in one place.
// The world is a fixed 3840 x 2880 coastal city; the renderer shows a 1280 x 720
// camera window that follows the player, so no rule below depends on the screen size.
export const WORLD = { width: 3840, height: 2880 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmara.save.v1';
export const BEST_KEY = 'solmara.best.v1';

export const PLAYER = {
  radius: 14, walkSpeed: 270, runSpeed: 330, health: 100,
  punchDamage: 12, punchRange: 42, punchRate: 0.35,
  shootDamage: 25, shootRate: 0.22, startAmmo: 24, maxAmmo: 120,
};

export const CAR = {
  length: 64, width: 32, accel: 620, brake: 900, reverseAccel: 320,
  maxSpeed: 560, maxReverse: 180, turnRate: 2.6, drag: 0.55, grip: 0.9,
};

export const TRAFFIC = { count: 22, speedMin: 130, speedMax: 210 };
export const PEDS = { count: 34, speedMin: 28, speedMax: 62 };
export const POLICE = { maxCars: 5, carSpeed: 520, footSpeed: 250, ramDamage: 9 };

export const WANTED = {
  max: 5, steal: 1, hitPed: 1, shoot: 1, hitCop: 2, ramCop: 2,
  decaySeconds: 26, hideSeconds: 8, speedNearCop: 0,
};

export const PICKUP = { health: 30, ammo: 12, cash: 50, spawnInterval: 9, max: 8 };
export const BULLET = { speed: 820, life: 0.9, radius: 4 };
export const CLOCK = { startHour: 8, startMinute: 12, minutesPerSecond: 1.2 };

export const DISTRICTS = [
  ['Marina Bay', 'Old Port', 'Coral Heights', 'Palm Row', 'Sunset Strip', 'Harbor Lights', 'Cactus Flats'],
  ['Old Port', 'Coral Heights', 'Palm Row', 'Downtown', 'Downtown', 'Harbor Lights', 'Cactus Flats'],
  ['Sandy Shore', 'Palm Row', 'Downtown', 'Downtown', 'Old Town', 'Harbor Lights', 'East Docks'],
  ['Sandy Shore', 'Palm Row', 'Old Town', 'Old Town', 'East Docks', 'East Docks', 'East Docks'],
  ['Beachfront', 'Beachfront', 'Old Town', 'Old Town', 'East Docks', 'East Docks', 'East Docks'],
];

export const PALETTE = {
  backdrop: '#0e1a24', sky: '#f7c873', sand: '#f2d8a0', sea: '#2e7fa8',
  grass: '#7fb069', road: '#3a3f47', roadLine: '#f5d76e', sidewalk: '#b8b0a0',
  buildingA: '#e07856', buildingB: '#4a90a4', buildingC: '#f2a65a', buildingD: '#8a6fa8',
  buildingE: '#5da271', buildingF: '#d95d6e', roof: '#2f3542',
  player: '#ffd23f', playerShirt: '#2ec4b6', cop: '#2b4acb', copCar: '#22337a',
  trafficCar: '#c94f4f', ped: '#e8e0d0', text: '#ffffff', muted: '#c9d4dc',
  panel: 'rgba(12,22,32,0.88)', panelBorder: '#f2c94c', hudBg: 'rgba(10,18,26,0.72)',
  star: '#ffd23f', starEmpty: 'rgba(255,255,255,0.35)', health: '#4ade80', healthLow: '#ef4444',
  marker: '#ffd23f', markerAlt: '#ff5d8f', cash: '#7CFC9A', danger: '#ff5d5d',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const CAR_COLORS = ['#c94f4f', '#4a90a4', '#f2a65a', '#8a6fa8', '#5da271', '#e8e0d0', '#3a6ea5', '#d95d6e', '#7fb069', '#e07856'];
export const PED_COLORS = ['#e8e0d0', '#f2a65a', '#8a6fa8', '#5da271', '#4a90a4', '#d95d6e', '#e07856', '#7fb069'];
