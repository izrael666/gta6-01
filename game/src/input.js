// Keyboard and pointer input for Solmara. Held keys give a 2D movement vector
// (WASD / arrows, on foot or driving); Space held down is shooting, and the mouse
// button held down is shooting too. One-shot presses (confirm, pause, enter a
// car, mute) are queued as bit flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice. The mouse position is tracked
// so shooting can aim at the cursor.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MUTE = 8;
export const ACTION_ATTACK = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 640, mouseY = 360, mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) held.add(event.code);
    else if (CONFIRM.has(event.code)) {
      // Space is both the menu confirm (one-shot) and the held-down shoot key.
      held.add(event.code);
      if (!event.repeat) actions |= ACTION_CONFIRM;
    }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (ENTER.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });
  target.addEventListener('pointerdown', (event) => {
    mouseDown = true; actions |= ACTION_CONFIRM | ACTION_ATTACK;
    mouseX = event.clientX; mouseY = event.clientY;
  });
  target.addEventListener('pointerup', () => { mouseDown = false; });
  target.addEventListener('pointermove', (event) => { mouseX = event.clientX; mouseY = event.clientY; });

  function hasAny(codes) { for (const c of codes) if (held.has(c)) return true; return false; }
  return {
    /** Movement vector { mx, my }: x right, y down (screen space, before camera). */
    move() {
      const mx = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const my = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      return { mx, my };
    },
    /** True while Space is held (shooting) or the mouse button is held. */
    attackHeld() { return held.has('Space') || mouseDown; },
    mouse() { return { x: mouseX, y: mouseY }; },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
