// Speech bubbles: a short spoken line floats over the speaker's head so the player can
// see who is talking to whom. The log keeps every line for scrollback; the bubble is
// only the short, readable version.
//
// The helpers (lifetime, pacing, overlap push) are pure so they can be tested in Node
// without a DOM. Only createBubbles() touches the document.
import * as THREE from 'three';

export const BUBBLE_BASE = 1.8;      // seconds a bubble needs before it is worth reading
export const BUBBLE_PER_CHAR = 0.06; // extra reading time for a longer line
export const BUBBLE_MIN = 2.5;
export const BUBBLE_MAX = 7;
export const PACE_LEAD = 0.6;         // the next line starts this long before the bubble ends
export const PACE_MIN = 1.6;
export const HURRY_DELAY = 1.4;       // once a beat step is done the conversation hurries
export const FADE_IN = 0.15;
export const FADE_OUT = 0.3;
export const BUBBLE_GAP = 6;          // pixels kept between two overlapping bubbles
export const SITE_NEAR = 8;           // how far a beat target may be from a neighbour's site

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// How long a bubble stays up: long enough to read the line, short enough not to crowd.
export const bubbleLifetime = (text) =>
  clamp(BUBBLE_BASE + BUBBLE_PER_CHAR * String(text ?? '').length, BUBBLE_MIN, BUBBLE_MAX);

// The gap before the next line: the bubble is nearly done when the next one starts.
export const paceDelay = (text) => Math.max(PACE_MIN, bubbleLifetime(text) - PACE_LEAD);

// Two bubbles whose boxes overlap are pushed apart vertically, so a back-and-forth reads
// as two people talking. Pure: returns new boxes, leaves the input alone.
export const pushApart = (boxes, gap = BUBBLE_GAP) => {
  const out = boxes.map((b) => ({ ...b }));
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        if (Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + gap) continue; // side by side, no overlap
        const need = (a.h + b.h) / 2 + gap - Math.abs(a.y - b.y);
        if (need <= 1e-9) continue;
        const shift = need / 2;
        if (a.y <= b.y) { a.y -= shift; b.y += shift; } else { a.y += shift; b.y -= shift; }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
};

// Where a neighbour's place is: Walt, Pruitt and Okafor have a site or a beat prop, not a body.
function siteFor(game, who) {
  const all = [...(game.map?.sites || []), ...(game.map?.prologueProps || [])];
  const hit = all.find((s) => s.key === who || s.kind === who || String(s.key || '').startsWith(who + '-'));
  return hit ? { x: hit.x + 0.5, z: hit.y + 0.5 } : null;
}

export function createBubbles(game, { camera, renderer, host } = {}) {
  const overlay = host || document.getElementById('bubbles') || (() => {
    const div = document.createElement('div');
    div.id = 'bubbles';
    document.body.appendChild(div);
    return div;
  })();
  const bubbles = new Map(); // speaker id -> one bubble, a new line replaces it

  const viewport = () => ({
    w: renderer?.domElement?.clientWidth || globalThis.innerWidth || 0,
    h: renderer?.domElement?.clientHeight || globalThis.innerHeight || 0,
  });

  // The clock stops while the game is paused: a bubble the player is reading stays up.
  const paused = () => !!(game.cutting || (game.sim && !game.sim.speed) || game.beats?.paused);

  // A family member bubbles over their own head. Walt and the neighbours only bubble
  // over their own site, and only when the line belongs to a beat near that site.
  function anchorFor(who, near) {
    const m = game.family?.find((x) => x.id === who);
    if (m) {
      if (m.away || m.dead || m.obj?.visible === false) return null; // off map, on a trip
      // The name tag hangs 0.35 above the head; the bubble sits above the tag, in
      // screen pixels, so the two never fight whatever the zoom is.
      const head = m.asleep ? 0.9 : (m.def?.h || 1.8) + 0.35;
      return { x: m.pos.x, y: head, z: m.pos.z, lift: -34 };
    }
    const site = siteFor(game, who);
    if (!site || !near) return null;
    if (Math.hypot(site.x - near.x, site.z - near.z) > SITE_NEAR) return null;
    return { x: site.x, y: 1.7, z: site.z, lift: -10 };
  }

  function measure(b) {
    b.w = b.node.offsetWidth || 0;
    b.h = b.node.offsetHeight || 0;
  }

  // Say a line. Returns the bubble, or null when this speaker does not get one
  // (off map, off screen, radio, narration): the log line is the caller's business.
  function say(who, text, opts = {}) {
    const t = String(text ?? '');
    if (!t || !who) return null;
    if (!anchorFor(who, opts.near)) return null;
    let b = bubbles.get(who);
    if (!b) {
      const node = document.createElement('div');
      node.className = 'bubble';
      overlay.appendChild(node);
      b = { who, node, age: 0, life: 0, w: 0, h: 0, x: 0, y: 0, near: null };
      bubbles.set(who, b);
    }
    b.near = opts.near || null;
    b.age = 0;
    b.life = bubbleLifetime(t);
    b.node.textContent = t;
    b.node.style.display = '';
    measure(b);
    return b;
  }

  function clear() {
    for (const b of bubbles.values()) b.node.remove();
    bubbles.clear();
  }

  function update(dtReal) {
    const { w: W, h: H } = viewport();
    const frozen = paused();
    const live = [];
    for (const b of [...bubbles.values()]) {
      if (!frozen) b.age += dtReal;
      if (b.age >= b.life) { b.node.remove(); bubbles.delete(b.who); continue; }
      const anchor = anchorFor(b.who, b.near);
      if (!anchor) { b.node.style.display = 'none'; continue; } // walked off the map
      const v = new THREE.Vector3(anchor.x, anchor.y, anchor.z).project(camera);
      if (v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1 || v.z < -1 || v.z > 1) {
        b.node.style.display = 'none'; // off screen: no bubble, the log still has the line
        continue;
      }
      b.node.style.display = '';
      const fade = Math.min(1, b.age / FADE_IN, (b.life - b.age) / FADE_OUT);
      b.node.style.opacity = String(Math.max(0, Math.min(1, fade)));
      b.x = ((v.x + 1) / 2) * W;
      b.y = ((1 - v.y) / 2) * H + (anchor.lift || 0);
      live.push(b);
    }
    // Overlapping bubbles are pushed apart so both can be read.
    const boxes = pushApart(live.map((b) => ({ x: b.x, y: b.y - b.h / 2, w: b.w, h: b.h })));
    live.forEach((b, i) => {
      const box = boxes[i];
      const bottom = box.y + b.h / 2; // the tail hangs off the bottom, pointing at the head
      b.node.style.transform = `translate(${b.x}px, ${bottom}px) translate(-50%, -100%)`;
    });
  }

  return { say, update, clear, bubbles };
}
