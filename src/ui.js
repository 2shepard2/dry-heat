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
    $('#log').onclick = (e) => { if (e.target.closest('button')) { this.logExpanded = !this.logExpanded; this.renderLog(); } };
    $('#speed').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) game.setSpeed(Number(b.dataset.s));
    });
    $('#objectives').addEventListener('click', (e) => {
      if (e.target.closest('.skip-ahead')) game.beats?.skipAhead();
      else if (e.target.closest('.now')) game.showBeatTarget?.();
    });
    // pointerdown, not click: the HUD re-renders several times a second
    $('#family').addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.card');
      if (!c) return;
      const m = game.family.find((x) => x.id === c.dataset.id);
      game.detailMember = m;
      if (m.ai) { this.refresh(); return; }
      if (game.selected.length === 1 && game.selected[0] === m && !e.shiftKey) game.focusOn(m);
      else game.selectById(c.dataset.id, e.shiftKey);
      this.refresh();
    });
    $('#family').addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      e.preventDefault();
      game.memberMenu(game.family.find((m) => m.id === card.dataset.id), e.clientX, e.clientY);
    });
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#menu')) this.hideMenu();
    }, true);
  }

  log(text, kind = '') {
    this.logLines.push({ t: this.g.sim.clock(), d: this.g.sim.day, text, kind });
    if (this.logLines.length > 60) this.logLines.shift();
    this.renderLog();
  }

  renderLog() {
    const el = $('#log');
    el.innerHTML = `<button aria-expanded="${!!this.logExpanded}">${this.logExpanded ? 'Collapse log' : 'Expand log'}</button>` + this.logLines.slice(this.logExpanded ? -20 : -2).map((l) => `<div class="${l.kind}"><span>${l.t}</span> ${esc(l.text)}</div>`).join('');
  }

  // ---- context menu
  menu(x, y, items, title = '') {
    const el = $('#menu');
    el.innerHTML = (title ? `<div class="mt">${esc(title)}</div>` : '') + items.map((it, i) =>
      `<button class="${it.primary ? 'beat-action' : ''}" data-i="${i}" ${it.disabled ? 'disabled' : ''}>${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</button>`).join('');
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
    $('#clock').innerHTML = `<b>${sim.dateLabel()}</b> · ${sim.clock()}`;
    $('#env').innerHTML = sim.power
      ? `<span>Outside ${out}°F</span><span>Inside ${ins}°F</span><span>Taps: running</span><span>AC: running</span>`
      :
      `<span class="${out >= 110 ? 'bad' : out >= 100 ? 'warn' : ''}">Outside ${out}°F${sim.sun() > 0.2 ? ' ☀' : ''}</span>` +
      `<span class="${ins >= 95 ? 'bad' : ins >= 88 ? 'warn' : ''}">Inside ${ins}°F</span>` +
      `<span class="${water === 'dead' ? 'bad' : water === 'sputtering' ? 'warn' : ''}">Taps: ${water}</span>` +
      (() => { const w = g.waterDays(); const d = w.days; const cls = d < 2 ? 'bad' : d < 4 ? 'warn' : '';
        return `<span class="${cls}" title="Tub, carried and discovered home water, at today's indoor rate (${w.perDay.toFixed(1)} L/day for the family)">Water: ${Math.round(w.liters)} L ≈ ${isFinite(d) ? d.toFixed(1) : '∞'} days</span>`; })() +
      `<span>AC: ${sim.power ? 'running' : 'silent'}</span>` +
      `<span>Car: ${g.systems.car.fuelL.toFixed(1)} L${g.systems.car.running ? ' · AC on' : ''}</span>` +
      `<span>Window shade: ${Math.min(3, g.systems.shades.size)}/3 effective · Solar: ${Math.round(g.systems.watts())} W${g.systems.solar.fan ? ' · fan placed' : ''}</span>`;
    for (const b of document.querySelectorAll('#speed button')) b.classList.toggle('on', Number(b.dataset.s) === sim.speed);

    // objectives
    const guide = sim.power ? g.beats?.guidance() : null;
    set($('#objectives'), '<div class="todo-list">' + g.objectives.map((o) =>
      `<div class="${o.done ? 'done' : o.failed ? 'failed' : o.prologue && !o.current ? 'later' : 'current'}">${o.done ? '☑ ' : o.failed ? '☒ ' : o.prologue && !o.current ? '' : '☐ '}${esc(o.text)}</div>`).join('') + '</div>' +
      (guide ? `<button class="now" title="Center the camera and select the family member"><b>Now:</b> ${esc(guide.text)}${guide.target ? ' <span>Show me ↗</span>' : ''}</button>${guide.canSkip ? '<button class="skip-ahead">Skip ahead ⏩</button>' : ''}` : ''));

    // Compact chips keep all five needs visible without occupying a column.
    set($('#family'), g.family.map((m) => {
      const n = m.needs;
      const glyphs = [['hydration', '◆', 'Water'], ['food', '◒', 'Food'], ['energy', '☾', 'Rest'], ['health', '♥', 'Health'], ['morale', '✦', 'Spirit']];
      return `<button class="card ${g.selected.includes(m) || g.detailMember === m ? 'sel' : ''} ${m.dead ? 'deadc' : ''}" data-id="${m.id}" title="${esc(m.name + ': ' + m.doing())}">
        <span class="portrait" style="--person:#${m.def.color.toString(16)}">${m.name[0]}</span><b>${m.name}</b>
        <span class="glyphs">${glyphs.map(([key, symbol, label]) => `<span class="glyph ${n[key] < 25 ? 'critical' : ''}" style="--fill:${n[key]}%;--need:${n[key] < 25 ? '#ee745d' : n[key] < 50 ? '#e7b653' : '#9acbaf'}" title="${label}: ${Math.round(n[key])}%" aria-label="${label}: ${Math.round(n[key])}%">${symbol}</span>`).join('')}</span>
      </button>`;
    }).join(''));

    this.renderSide();
  }

  renderSide() {
    const g = this.g, sim = g.sim;
    const m = g.detailMember || g.selected[0];
    const inv = $('#inv'), cont = $('#cont');
    $('#side').classList.toggle('hidden', !m);
    if (!m) { set(inv, ''); set(cont, ''); return; }
    const kg = m.kg();
    const [status, kind] = m.status();
    const bars = [['Water', m.needs.hydration], ['Food', m.needs.food], ['Rest', m.needs.energy], ['Health', m.needs.health], ['Spirit', m.needs.morale]].map(([label, value]) => `<div class="bar ${value < 25 ? 'bad' : value < 50 ? 'warn' : ''}"><i style="width:${value}%"></i><label>${label} ${Math.round(value)}%</label></div>`).join('');
    set(inv, `<button class="close-detail" aria-label="Close person panel">×</button><h3>${m.name} · ${m.role}, ${m.age}</h3><div class="${kind}">${status} · core ${m.bodyT.toFixed(1)}°F</div>${m.worn ? `<div class="equipment">Worn: ${esc(ITEMS[m.worn.id].name)}</div>` : ''}${bars}<p class="activity">${esc(m.name + ': ' + m.doing())}</p><button class="autonomy-control">${m.autonomy ? 'Wait for me' : 'Let them be'}</button>${m.ai ? '<button class="person-orders">Give an order</button>' : ''}<h3>${m.name} carries <span class="${kg > m.cap * 0.9 ? 'warn' : ''}">${kg.toFixed(1)} / ${m.cap} kg</span></h3>` +
      '<button class="equipment-control">Worn items / nearby lights</button>' +
      (m.inv.length ? m.inv.map((e, i) => this.itemRow(e, i, 'inv')).join('') : '<div class="hint">Nothing.</div>'));
    inv.onpointerdown = (ev) => {
      if (ev.target.closest('.close-detail')) { g.selected = []; g.detailMember = null; this.refresh(); return; }
      if (ev.target.closest('.autonomy-control')) { m.setAutonomy(!m.autonomy); this.refresh(); return; }
      if (ev.target.closest('.person-orders')) { g.memberMenu(m, ev.clientX, ev.clientY); return; }
      if (ev.target.closest('.equipment-control')) { g.equipmentMenu(m, ev.clientX, ev.clientY); return; }
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
      el.style.display = m.away ? 'none' : '';
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
