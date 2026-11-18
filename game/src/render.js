// Drawing only: the world's state and the current screen in, pixels out. A camera
// follows the player across the city; buildings get a sun-side shadow for depth,
// cars and people are drawn top-down, and the HUD carries cash, health, wanted
// stars, ammo, the clock, the mission objective and a live minimap.
import { PALETTE, VIEW, WORLD, FONT, PLAYER } from './config.js';
import { currentStageLabel, currentStageTarget, getMission } from './missions.js';
import { districtAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_MISSION = 'mission';

const MINIMAP = { x: 1036, y: 16, width: 228, height: 168 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight || '');
    if (!fonts.has(key)) fonts.set(key, (weight ? weight + ' ' : '') + size + 'px ' + FONT);
    context.font = fonts.get(key); context.fillStyle = color; context.textAlign = align || 'left'; context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }
  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y); context.arcTo(x + w, y, x + w, y + h, r); context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r); context.arcTo(x, y, x + w, y, r); context.closePath();
  }
  function drawCar(x, y, angle, color, isPolice, scale) {
    const s = scale || 1;
    context.save(); context.translate(x, y); context.rotate(angle); context.scale(s, s);
    context.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(-30, -14, 64, 32, 8); context.fill();
    context.fillStyle = color; roundRect(-32, -16, 64, 32, 8); context.fill();
    context.fillStyle = 'rgba(180,220,255,0.85)'; roundRect(-8, -13, 16, 26, 4); context.fill();
    context.fillStyle = 'rgba(20,20,30,0.8)'; roundRect(14, -12, 10, 24, 3); context.fill();
    context.fillStyle = '#ffd23f'; context.fillRect(30, -13, 3, 5); context.fillRect(30, 8, 3, 5);
    context.fillStyle = '#ff5d5d'; context.fillRect(-33, -13, 3, 5); context.fillRect(-33, 8, 3, 5);
    if (isPolice) { context.fillStyle = '#ffffff'; context.fillRect(-2, -16, 12, 6); context.fillStyle = '#ff2222'; context.fillRect(-2, -16, 6, 6); context.fillStyle = '#2244ff'; context.fillRect(4, -16, 6, 6); }
    context.restore();
  }
  function drawPerson(x, y, angle, color, isCop) {
    context.save(); context.translate(x, y);
    context.fillStyle = 'rgba(0,0,0,0.3)'; context.beginPath(); context.arc(2, 3, 11, 0, Math.PI * 2); context.fill();
    context.fillStyle = color; context.beginPath(); context.arc(0, 0, 11, 0, Math.PI * 2); context.fill();
    context.fillStyle = isCop ? '#1a2a6b' : '#222222'; context.beginPath(); context.arc(0, 0, 5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = color; context.lineWidth = 3; context.beginPath();
    context.moveTo(0, 0); context.lineTo(Math.cos(angle) * 14, Math.sin(angle) * 14); context.stroke();
    context.restore();
  }
  function drawCity(state, camX, camY) {
    const city = state.city;
    const x0 = camX - VIEW.width / 2, y0 = camY - VIEW.height / 2;
    context.fillStyle = '#8fc7a0'; context.fillRect(x0, y0, VIEW.width, VIEW.height);
    // Beach and sea on the east edge.
    context.fillStyle = PALETTE.sand; context.fillRect(city.beach.x, 0, city.beach.width, WORLD.height);
    context.fillStyle = PALETTE.sea; context.fillRect(WORLD.width - 70, 0, 70, WORLD.height);
    context.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 12; i += 1) context.fillRect(WORLD.width - 78, (i * 240 + 80) % WORLD.height, 8, 26);
    // Parks.
    for (const park of city.parks) { context.fillStyle = PALETTE.grass; context.fillRect(park.x, park.y, park.width, park.height); }
    // Roads.
    context.fillStyle = PALETTE.road;
    for (const rx of city.verticalRoads) context.fillRect(rx - 48, 0, 96, WORLD.height);
    for (const ry of city.horizontalRoads) context.fillRect(0, ry - 48, WORLD.width, 96);
    context.strokeStyle = PALETTE.roadLine; context.lineWidth = 3; context.setLineDash([26, 22]);
    for (const rx of city.verticalRoads) { context.beginPath(); context.moveTo(rx, 0); context.lineTo(rx, WORLD.height); context.stroke(); }
    for (const ry of city.horizontalRoads) { context.beginPath(); context.moveTo(0, ry); context.lineTo(WORLD.width, ry); context.stroke(); }
    context.setLineDash([]);
    // Sidewalks as pale strips beside roads.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of city.verticalRoads) { context.fillRect(rx - 62, 0, 10, WORLD.height); context.fillRect(rx + 52, 0, 10, WORLD.height); }
    for (const ry of city.horizontalRoads) { context.fillRect(0, ry - 62, WORLD.width, 10); context.fillRect(0, ry + 52, WORLD.width, 10); }
    // Landmarks and buildings with a sun shadow.
    for (const b of city.landmarks) {
      context.fillStyle = 'rgba(0,0,0,0.25)'; context.fillRect(b.x + 8, b.y + 10, b.width, b.height);
      context.fillStyle = b.color; context.fillRect(b.x, b.y, b.width, b.height);
      context.fillStyle = PALETTE.roof; context.fillRect(b.x + 8, b.y + 8, b.width - 16, b.height - 16);
      text(b.name, b.x + b.width / 2, b.y + b.height / 2 + 6, 20, '#ffffff', 'center', 'bold');
    }
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.22)'; context.fillRect(b.x + 6, b.y + 8, b.width, b.height);
      context.fillStyle = b.color; context.fillRect(b.x, b.y, b.width, b.height);
      context.fillStyle = 'rgba(255,255,255,0.18)'; context.fillRect(b.x, b.y, b.width, 10);
      context.fillStyle = PALETTE.roof;
      for (let s = 0; s < b.stories; s += 1) context.fillRect(b.x + 10 + (s % 3) * 22, b.y + 18 + Math.floor(s / 3) * 20, 14, 12);
      if (b.label) text(b.label, b.x + b.width / 2, b.y + b.height - 8, 13, 'rgba(255,255,255,0.9)', 'center', 'bold');
    }
    for (const t of city.trees) {
      context.fillStyle = 'rgba(0,0,0,0.2)'; context.beginPath(); context.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#3e8e4f'; context.beginPath(); context.arc(t.x, t.y, t.r, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#5da271'; context.beginPath(); context.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); context.fill();
    }
    // Mission marker: a pulsing beacon.
    const mission = state.allMissionsDone ? null : getMission(state.missionIndex);
    const target = currentStageTarget(mission, state.missionStage);
    if (target) {
      const pulse = 1 + Math.sin(state.elapsed * 5) * 0.15;
      context.save(); context.translate(target.x, target.y); context.scale(pulse, pulse);
      context.fillStyle = 'rgba(255,210,63,0.25)'; context.beginPath(); context.arc(0, 0, 46, 0, Math.PI * 2); context.fill();
      context.fillStyle = PALETTE.marker; context.beginPath(); context.arc(0, 0, 14, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#222222'; text('!', 0, 6, 20, '#222222', 'center', 'bold');
      context.restore();
      context.strokeStyle = PALETTE.marker; context.lineWidth = 3; context.setLineDash([10, 8]);
      context.beginPath(); context.moveTo(state.player.x, state.player.y); context.lineTo(target.x, target.y); context.stroke(); context.setLineDash([]);
    }
  }
  function drawWorld(state) {
    const camX = state.camera.x, camY = state.camera.y;
    const x0 = camX - VIEW.width / 2, y0 = camY - VIEW.height / 2;
    context.save();
    context.beginPath(); context.rect(0, 0, VIEW.width, VIEW.height); context.clip();
    context.translate(-x0, -y0);
    drawCity(state, camX, camY);
    for (const p of state.pickups) {
      if (!p.active) continue;
      const bob = Math.sin(p.bob) * 3;
      context.fillStyle = p.kind === 'health' ? '#4ade80' : p.kind === 'ammo' ? '#f2c94c' : '#7CFC9A';
      context.beginPath(); context.arc(p.x, p.y + bob, 13, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#10202e'; text(p.kind === 'health' ? '+' : p.kind === 'ammo' ? 'A' : '$', p.x, p.y + bob + 5, 15, '#10202e', 'center', 'bold');
    }
    for (const v of state.vehicles) if (v.active) drawCar(v.x, v.y, v.angle, v.color, v.isPolice, 1);
    for (const p of state.peds) if (p.active) drawPerson(p.x, p.y, p.angle, p.color, p.isCop);
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.fillStyle = '#ffe066'; context.beginPath(); context.arc(b.x, b.y, 4, 0, Math.PI * 2); context.fill();
    }
    for (const pt of state.particles) {
      if (!pt.active) continue;
      context.fillStyle = pt.color; context.globalAlpha = Math.max(0, pt.life * 1.6);
      context.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size); context.globalAlpha = 1;
    }
    const pl = state.player;
    if (!pl.inCar) {
      if (pl.invulnerable === 0 || Math.floor(pl.invulnerable * 10) % 2 === 1) drawPerson(pl.x, pl.y, pl.angle, PALETTE.playerShirt, false);
      context.fillStyle = PALETTE.player; context.beginPath(); context.arc(pl.x, pl.y, 4, 0, Math.PI * 2); context.fill();
    }
    context.restore();
    // Sun vignette for the coastal look.
    const grad = context.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, 'rgba(255,200,110,0.10)'); grad.addColorStop(1, 'rgba(255,200,110,0)');
    context.fillStyle = grad; context.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  function drawMinimap(state) {
    const sx = MINIMAP.width / WORLD.width, sy = MINIMAP.height / WORLD.height;
    context.fillStyle = 'rgba(10,18,26,0.85)'; roundRect(MINIMAP.x - 6, MINIMAP.y - 6, MINIMAP.width + 12, MINIMAP.height + 12, 10); context.fill();
    context.strokeStyle = PALETTE.panelBorder; context.lineWidth = 2; roundRect(MINIMAP.x - 6, MINIMAP.y - 6, MINIMAP.width + 12, MINIMAP.height + 12, 10); context.stroke();
    context.save(); context.beginPath(); context.rect(MINIMAP.x, MINIMAP.y, MINIMAP.width, MINIMAP.height); context.clip();
    context.fillStyle = '#3e6b4f'; context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.width, MINIMAP.height);
    context.fillStyle = PALETTE.road;
    for (const rx of state.city.verticalRoads) context.fillRect(MINIMAP.x + rx * sx - 2, MINIMAP.y, 4, MINIMAP.height);
    for (const ry of state.city.horizontalRoads) context.fillRect(MINIMAP.x, MINIMAP.y + ry * sy - 2, MINIMAP.width, 4);
    context.fillStyle = PALETTE.sea; context.fillRect(MINIMAP.x + (WORLD.width - 70) * sx, MINIMAP.y, 70 * sx, MINIMAP.height);
    const mission = state.allMissionsDone ? null : getMission(state.missionIndex);
    const target = currentStageTarget(mission, state.missionStage);
    if (target) { context.fillStyle = PALETTE.marker; context.beginPath(); context.arc(MINIMAP.x + target.x * sx, MINIMAP.y + target.y * sy, 6, 0, Math.PI * 2); context.fill(); }
    for (const v of state.vehicles) if (v.active && v.isPolice) { context.fillStyle = '#5b8cff'; context.fillRect(MINIMAP.x + v.x * sx - 2, MINIMAP.y + v.y * sy - 2, 5, 5); }
    context.fillStyle = '#ffffff'; context.beginPath(); context.arc(MINIMAP.x + state.player.x * sx, MINIMAP.y + state.player.y * sy, 5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = PALETTE.player; context.lineWidth = 2; context.beginPath(); context.arc(MINIMAP.x + state.player.x * sx, MINIMAP.y + state.player.y * sy, 5, 0, Math.PI * 2); context.stroke();
    context.restore();
    text('SOLMARA', MINIMAP.x + MINIMAP.width / 2, MINIMAP.y + MINIMAP.height + 16, 11, PALETTE.muted, 'center', 'bold');
  }
  function drawHud(state, best) {
    context.fillStyle = PALETTE.hudBg; roundRect(12, 12, 330, 108, 12); context.fill();
    text('$' + state.cash, 28, 44, 30, PALETTE.cash, 'left', 'bold');
    text('BEST $' + best, 28, 70, 14, PALETTE.muted, 'left');
    // Health bar.
    context.fillStyle = 'rgba(255,255,255,0.2)'; roundRect(28, 80, 180, 16, 8); context.fill();
    context.fillStyle = state.player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    roundRect(28, 80, Math.max(0, 180 * state.player.health / PLAYER.health), 16, 8); context.fill();
    text(Math.round(state.player.health) + ' HP', 218, 94, 14, '#ffffff', 'left', 'bold');
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text('★', 360 + i * 30, 46, 30, i < state.wanted ? PALETTE.star : PALETTE.starEmpty, 'left');
    }
    text(state.wanted > 0 ? 'WANTED' : 'CLEAN', 360, 72, 13, state.wanted > 0 ? PALETTE.danger : PALETTE.muted, 'left', 'bold');
    // Ammo + speed + clock.
    text(state.player.inCar ? '🚗 ' + state.speedKmh + ' km/h' : 'ON FOOT', 360, 100, 15, '#ffffff', 'left');
    text('AMMO ' + state.player.ammo, 28, 152, 16, '#ffffff', 'left', 'bold');
    const hh = Math.floor(state.clockMinutes / 60), mm = Math.floor(state.clockMinutes % 60);
    text(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  •  ' + state.district, 28, 180, 16, '#ffffff', 'left', 'bold');
    // Mission objective panel.
    const mission = state.allMissionsDone ? null : getMission(state.missionIndex);
    context.fillStyle = PALETTE.hudBg; roundRect(12, VIEW.height - 92, 560, 80, 12); context.fill();
    context.strokeStyle = PALETTE.panelBorder; context.lineWidth = 2; roundRect(12, VIEW.height - 92, 560, 80, 12); context.stroke();
    text(mission ? 'MISSION ' + mission.id + '/5 — ' + mission.title : 'ALL MISSIONS COMPLETE', 28, VIEW.height - 62, 16, PALETTE.marker, 'left', 'bold');
    text(currentStageLabel(mission, state.missionStage), 28, VIEW.height - 34, 16, '#ffffff', 'left');
    text(mission ? mission.giver : 'Solmara is yours.', 28, VIEW.height - 12, 12, PALETTE.muted, 'left');
    drawMinimap(state);
    if (state.missionFlash > 0) {
      context.fillStyle = 'rgba(255,210,63,0.92)'; roundRect(VIEW.width / 2 - 260, 130, 520, 54, 12); context.fill();
      text(state.missionFlashText, VIEW.width / 2, 166, 24, '#10202e', 'center', 'bold');
    }
    if (state.messageTimer > 0) text(state.message, VIEW.width / 2, 210, 20, '#ffffff', 'center', 'bold');
    text('WASD move/drive • E enter car • Space/click shoot • P pause • M mute', VIEW.width / 2, VIEW.height - 8, 12, 'rgba(255,255,255,0.65)', 'center');
  }
  function drawPanel(title, lines, prompt, accent) {
    const width = 680, height = 170 + lines.length * 34;
    const x = (VIEW.width - width) / 2, y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel; roundRect(x, y, width, height, 16); context.fill();
    context.strokeStyle = accent || PALETTE.panelBorder; context.lineWidth = 3; roundRect(x, y, width, height, 16); context.stroke();
    text(title, VIEW.width / 2, y + 64, 44, '#ffffff', 'center', 'bold');
    lines.forEach((line, i) => text(line, VIEW.width / 2, y + 116 + i * 34, 20, PALETTE.muted, 'center'));
    text(prompt, VIEW.width / 2, y + height - 30, 22, PALETTE.marker, 'center', 'bold');
  }
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    context.setTransform(scale, 0, 0, scale, (canvas.width - VIEW.width * scale) / 2, (canvas.height - VIEW.height * scale) / 2);
  }
  function draw(state, screen, best) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop; context.fillRect(0, 0, canvas.width, canvas.height);
    const ratio = window.devicePixelRatio || 1;
    const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    context.setTransform(scale, 0, 0, scale, (canvas.width - VIEW.width * scale) / 2, (canvas.height - VIEW.height * scale) / 2);
    void ratio;
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMARA', ['A sun-soaked open-world crime story — original city, original crew.', 'Explore on foot and by car. Steal cars, dodge the patrols, run 5 missions.', 'WASD / arrows to move and drive • E to enter a car • Space or click to shoot', 'Best cash so far: $' + best, ''], 'Press Space or click to start', PALETTE.marker);
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', ['The city waits for you.', 'M mute sound • P or Esc to resume'], 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      const lines = state.busted ? ['The patrols caught you. Solmara keeps its secrets.', 'Cash kept: $' + state.cash + ' • Missions done: ' + state.missionsDone + ' / 5'] : ['You went down in Solmara.', 'Cash kept: $' + state.cash + ' • Missions done: ' + state.missionsDone + ' / 5'];
      drawPanel(state.busted ? 'BUSTED!' : 'WASTED!', lines, 'Press Space or click to play again', PALETTE.danger);
    } else if (screen === SCREEN_MISSION) {
      drawPanel('MISSION COMPLETE', [state.missionFlashText, 'Cash: $' + state.cash + ' • Missions done: ' + state.missionsDone + ' / 5'], 'Press Space to continue');
    }
  }
  window.addEventListener('resize', resize);
  return { draw, viewSize() { return { width: VIEW.width, height: VIEW.height }; } };
}
