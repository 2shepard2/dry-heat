// DOM HUD: clock, family cards, inventory/container panels, log, menus, floating name tags.
import { ITEMS, label, entryKg, isLiquid, refillable } from './inventory.js';

const $ = (s) => document.querySelector(s);
const set = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(game) {
    this.g = game;
    this.logLines = [];
    this.tags = new Map();
    this.dirty = true;
    $('#speed').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) game.setSpeed(Number(b.dataset.s));
    });
    // pointerdown, not click: the HUD re-renders several times a second
    $('#family').addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.card');
      if (!c) return;
      const m = game.family.find((x) => x.id === c.dataset.id);
      if (m.ai) { game.memberMenu(m, e.clientX + 12, e.clientY); return; }
      if (game.selected.length === 1 && game.selected[0] === m && !e.shiftKey) game.focusOn(m);
      else game.selectById(c.dataset.id, e.shiftKey);
      this.refresh();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#menu')) this.hideMenu();
    }, true);
  }

  log(text, kind = '') {
    this.logLines.push({ t: this.g.sim.clock(), d: this.g.sim.day, text, kind });
    if (this.logLines.length > 60) this.logLines.shift();
    const el = $('#log');
    el.innerHTML = this.logLines.slice(-9).map((l) => `<div class="${l.kind}"><span>${l.t}</span> ${esc(l.text)}</div>`).join('');
  }

  // ---- context menu
  menu(x, y, items, title = '') {
    const el = $('#menu');
    el.innerHTML = (title ? `<div class="mt">${esc(title)}</div>` : '') + items.map((it, i) =>
      `<button data-i="${i}" ${it.disabled ? 'disabled' : ''}>${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`).join('');
    el.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    el.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
    el.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
    el.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.hideMenu();
      items[Number(b.dataset.i)].fn?.();
    };
  }
  hideMenu() { $('#menu').classList.add('hidden'); }

  // ---- per-frame-ish refresh (called ~5x/sec)
  refresh() {
    const g = this.g, sim = g.sim;
    const out = Math.round(sim.outdoor()), ins = Math.round(sim.indoor);
    const p = sim.pressure();
    const water = p > 0.6 ? 'running' : p > 0.05 ? 'sputtering' : 'dead';
    $('#clock').innerHTML = `<b>Day ${sim.day}</b> · ${sim.clock()}`;
    $('#env').innerHTML =
      `<span class="${out >= 110 ? 'bad' : out >= 100 ? 'warn' : ''}">Outside ${out}°F${sim.sun() > 0.2 ? ' ☀' : ''}</span>` +
      `<span class="${ins >= 95 ? 'bad' : ins >= 88 ? 'warn' : ''}">Inside ${ins}°F</span>` +
      `<span class="${water === 'dead' ? 'bad' : water === 'sputtering' ? 'warn' : ''}">Taps: ${water}</span>` +
      (() => { const w = g.waterDays(); const d = w.days; const cls = d < 2 ? 'bad' : d < 4 ? 'warn' : '';
        return `<span class="${cls}" title="Tub plus carried water, at today's indoor rate (${w.perDay.toFixed(1)} L/day for the family)">Water: ${Math.round(w.liters)} L ≈ ${isFinite(d) ? d.toFixed(1) : '∞'} days</span>`; })();
    for (const b of document.querySelectorAll('#speed button')) b.classList.toggle('on', Number(b.dataset.s) === sim.speed);

    // objectives
    $('#objectives').innerHTML = g.objectives.map((o) =>
      `<div class="${o.done ? 'done' : o.failed ? 'failed' : ''}">${o.done ? '☑' : o.failed ? '☒' : '☐'} ${esc(o.text)}</div>`).join('');

    // family cards
    set($('#family'), g.family.map((m) => {
      const [st, sk] = m.status();
      const sel = g.selected.includes(m);
      const bar = (k, v) => `<div class="bar ${v < 25 ? 'bad' : v < 50 ? 'warn' : ''}"><i style="width:${v}%"></i><label>${k}</label></div>`;
      const n = m.needs;
      const pr = m.progress();
      return `<div class="card ${sel ? 'sel' : ''} ${m.dead ? 'deadc' : ''}" data-id="${m.id}">
        <div class="nm">${sel ? '<span class="sel-mark">▶ </span>' : ''}<b>${m.name}</b> <span>${m.role}, ${m.age} · ${m.mass} kg</span></div>
        <div class="st ${sk}">${st} · core ${m.bodyT.toFixed(1)}°F <span class="felt">feels ${Math.round(m.felt)}°${m.wetMin > 0 ? ' · wet' : ''}</span></div>
        ${bar(`Water −${m.deficit.toFixed(1)} L`, n.hydration)}${bar('Food', n.food)}${bar('Rest', n.energy)}${bar('Health', n.health)}${bar('Spirit', n.morale)}
        <div class="do">${esc(m.doing())}${pr !== null ? ` <em>${Math.round(pr * 100)}%</em>` : ''}</div>
      </div>`;
    }).join(''));

    this.renderSide();
  }

  renderSide() {
    const g = this.g, sim = g.sim;
    const m = g.selected[0];
    const inv = $('#inv'), cont = $('#cont');
    if (!m) { set(inv, '<div class="hint">Click a family member to see what they carry.</div>'); set(cont, ''); return; }
    const kg = m.kg();
    set(inv, `<h3>${m.name} carries <span class="${kg > m.cap * 0.9 ? 'warn' : ''}">${kg.toFixed(1)} / ${m.cap} kg</span></h3>` +
      (m.inv.length ? m.inv.map((e, i) => this.itemRow(e, i, 'inv')).join('') : '<div class="hint">Nothing.</div>'));
    inv.onpointerdown = (ev) => {
      const r = ev.target.closest('.item');
      if (r) g.itemMenu(m, Number(r.dataset.i), ev.clientX, ev.clientY);
    };

    const open = g.opens.get(m) || null;
    if (!open) { set(cont, ''); return; }
    set(cont, `<h3>${esc(open.name)}${open.home ? '' : ' <span class="warn">(not yours)</span>'}
      ${open.items.length ? '<button id="takeall">Take all</button>' : ''}</h3>` +
      (open.items.length ? open.items.map((e, i) => this.itemRow(e, i, 'cont')).join('') : '<div class="hint">Empty.</div>'));
    cont.onpointerdown = (ev) => {
      if (ev.target.id === 'takeall') { g.takeAll(m, open); this.renderSide(); return; }
      const r = ev.target.closest('.item');
      if (r) { g.take(m, open, Number(r.dataset.i), ev.shiftKey); this.renderSide(); }
    };
    void sim;
  }

  itemRow(e, i, where) {
    const it = ITEMS[e.id];
    const tip = `${it.desc || ''}${it.use ? '\n' + Object.entries(it.use).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') : ''}`;
    const flag = isLiquid(e) && e.left < 0.05 ? ' empty' : '';
    return `<div class="item cat-${it.cat}${flag}" data-i="${i}" data-where="${where}" title="${esc(tip)}">
      <span>${esc(label(e, this.g.sim))}</span><small>${entryKg(e).toFixed(1)} kg</small></div>`;
  }

  // floating name tags over heads
  tagsUpdate(camera, renderer) {
    const host = $('#tags');
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    for (const m of this.g.family) {
      let el = this.tags.get(m);
      if (!el) { el = document.createElement('div'); el.className = 'tag'; host.appendChild(el); this.tags.set(m, el); }
      const v = m.pos.clone();
      v.y += m.asleep || m.dead ? 0.9 : m.def.h + 0.35;
      v.project(camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      const pr = m.progress();
      const [st, sk] = m.status();
      const showSt = sk === 'bad' || m.dead;
      el.className = `tag ${this.g.selected.includes(m) ? 'sel' : ''} ${showSt ? sk : ''}`;
      el.innerHTML = `${m.name}${showSt ? ` · ${st}` : ''}${pr !== null ? `<i style="width:${pr * 100}%"></i>` : ''}`;
    }
  }
}

export { refillable };
