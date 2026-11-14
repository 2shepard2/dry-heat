// DOM HUD: clock, family cards, inventory/container panels, log, menus, floating name tags.
import { ITEMS, label, entryKg, isLiquid, refillable } from './inventory.js';

const $ = (s) => document.querySelector(s);
const set = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; } };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- pure HUD logic (unit-tested)
// Two-click people. First click: select (parent) or focus (kid). Second click on the same person: open the panel.
// A click on the person whose panel is open closes it. Shift-click adds a parent to the selection.
export function personClick(st, m, shift = false) {
  const { selected = [] } = st;
  if (m.dead) return { act: 'none', picked: st.picked, detail: st.detail };
  if (m.away) return { act: 'open', picked: m, detail: st.detail === m ? null : m };
  if (st.detail === m) return { act: 'close', picked: m, detail: null };
  if (!m.ai && shift) return { act: 'select', picked: m, detail: st.detail ? m : null };
  // a parent who is no longer selected is a fresh first click
  const armed = st.picked === m && (m.ai || selected.includes(m));
  if (armed) return { act: 'open', picked: m, detail: m };
  return { act: m.ai ? 'focus' : 'select', picked: m, detail: null };
}

// Task panel model: Now line elsewhere; at most 2 Also lines, 4 open items, finished ones collapsed.
export function taskModel(objectives, guide, doneOpen = false) {
  const list = (objectives || []).filter((o) => !o.optional);
  const done = list.filter((o) => o.done);
  const open = list.filter((o) => !o.done);
  return { open: open.slice(0, 4), hidden: Math.max(0, open.length - 4), done, doneOpen: !!doneOpen && done.length > 0,
    also: ((guide && guide.chores) || []).slice(0, 2) };
}

// 'Thursday, July 9' -> 'Thu · July 9'; 'Day 1 · Saturday, July 11' -> 'Day 1 · Sat · July 11'
export function dateShort(label) { return String(label).replace(/\b([A-Z][a-z]{2})[a-z]*day, /, '$1 · '); }

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
    $('#house').addEventListener('click', () => { this.houseOpen = !this.houseOpen; this.refresh(); });
    $('#objectives').addEventListener('click', (e) => {
      if (e.target.closest('.done-toggle')) { this.doneOpen = !this.doneOpen; this.refresh(); }
      else if (e.target.closest('.skip-ahead')) game.beats?.skipAhead();
      else if (e.target.closest('.now')) game.showBeatTarget?.();
    });
    // pointerdown, not click: the HUD re-renders several times a second
    $('#family').addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.card');
      if (!c) return;
      const m = game.family.find((x) => x.id === c.dataset.id);
      if (m.dead) return;
      game.clickPerson(m, e.shiftKey);
      this.refresh();
    });
    $('#family').addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      e.preventDefault();
      const m = game.family.find((m) => m.id === card.dataset.id);
      if (!m.dead) game.memberMenu(m, e.clientX, e.clientY);
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
    $('#clock').innerHTML = `<div class="cal">${esc(dateShort(sim.dateLabel()))}</div><div class="time">${sim.clock()}</div>` +
      `<div class="temps"><span class="${out >= 110 ? 'bad' : out >= 100 ? 'warn' : ''}">${out}°F out${sim.sun() > 0.2 ? ' ☀' : ''}</span> · <span class="${ins >= 95 ? 'bad' : ins >= 88 ? 'warn' : ''}">${ins}°F in</span></div>`;
    for (const b of document.querySelectorAll('#speed button')) b.classList.toggle('on', Number(b.dataset.s) === sim.speed);

    // House chip: outage only. In the prologue the taps and the AC are simply on, and say nothing.
    const house = $('#house');
    house.classList.toggle('hidden', !!sim.power);
    if (!sim.power) {
      const w = g.waterDays(), d = w.days, cls = d < 2 ? 'bad' : d < 4 ? 'warn' : '';
      const wtxt = isFinite(d) ? `${d >= 10 ? Math.round(d) : d.toFixed(1)} days` : '∞ days';
      set(house, `<button class="chip" aria-expanded="${!!this.houseOpen}" title="Tub, carried and discovered home water, at today's indoor rate (${w.perDay.toFixed(1)} L/day for the family)">House · <span class="${cls}">Water ${wtxt}</span> ${this.houseOpen ? '▴' : '▾'}</button>` +
        (this.houseOpen ? `<div class="chip-body"><div>Water: ${Math.round(w.liters)} L</div>` +
          (water !== 'running' ? `<div class="${water === 'dead' ? 'bad' : 'warn'}">Taps: ${water}</div>` : '') +
          `<div>Car: ${g.systems.car.fuelL.toFixed(1)} L${g.systems.car.running ? ' · AC on' : ''}</div>` +
          `<div>Window shade: ${Math.min(3, g.systems.shades.size)}/3 effective</div>` +
          `<div>Solar: ${Math.round(g.systems.watts())} W${g.systems.solar.fan ? ' · fan placed' : ''}</div></div>` : ''));
    }

    // task panel: Now, <=2 Also, <=4 open, finished ones behind a toggle. The list shows from the first frame of every phase.
    const guide = sim.power ? g.beats?.guidance() : null;
    const tm = taskModel(g.objectives, guide, this.doneOpen);
    const row = (o) => `<div class="${o.failed ? 'failed' : o.prologue && !o.current ? 'later' : 'current'}">${o.failed ? '☒ ' : o.prologue && !o.current ? '· ' : '☐ '}${esc(o.text)}</div>`;
    set($('#objectives'),
      (guide ? `<button class="now" title="Center the camera and select the family member"><b>Now:</b> ${esc(guide.text)}${guide.target ? ' <span>Show me ↗</span>' : ''}</button>` +
        tm.also.map((c) => `<div class="later">Also: ${esc(c.label)} (${esc(g.family.find((m) => m.id === c.who)?.name || c.who)})</div>`).join('') : '') +
      `<div class="todo-list">${tm.open.map(row).join('')}${tm.hidden ? `<div class="later">+ ${tm.hidden} more</div>` : ''}` +
      (tm.done.length ? `<button class="done-toggle" aria-expanded="${tm.doneOpen}">✓ ${tm.done.length} done ${tm.doneOpen ? '▴' : '▾'}</button>${tm.doneOpen ? tm.done.map((o) => `<div class="done">☑ ${esc(o.text)}</div>`).join('') : ''}` : '') +
      '</div>' + (guide?.canSkip ? '<button class="skip-ahead">Skip ahead ⏩</button>' : ''));

    // Compact chips keep all five needs visible without occupying a column.
    set($('#family'), g.family.map((m) => {
      const n = m.needs;
      const glyphs = [['hydration', '◆', 'Water'], ['food', '◒', 'Food'], ['energy', '☾', 'Rest'], ['health', '♥', 'Health'], ['morale', '✦', 'Spirit']];
      return `<button class="card ${g.selected.includes(m) || g.detailMember === m ? 'sel' : ''} ${m.dead ? 'deadc' : ''}" data-id="${m.id}" ${m.dead ? 'disabled aria-disabled="true"' : ''} title="${esc(m.name + ': ' + m.doing())}">
        <span class="portrait" style="--person:#${m.def.color.toString(16)}">${m.name[0]}</span><b>${m.name}</b>
        <span class="glyphs">${glyphs.map(([key, symbol, label]) => `<span class="glyph ${n[key] < 25 ? 'critical' : ''}" style="--fill:${n[key]}%;--need:${n[key] < 25 ? '#ee745d' : n[key] < 50 ? '#e7b653' : '#9acbaf'}" title="${label}: ${Math.round(n[key])}%" aria-label="${label}: ${Math.round(n[key])}%">${symbol}</span>`).join('')}</span>
      </button>`;
    }).join(''));

    this.renderSide();
  }

  renderSide() {
    const g = this.g, sim = g.sim;
    // The person panel is closed until a second click; an opened container still needs somewhere to show.
    const dm = g.detailMember;
    const m = dm || g.selected.find((x) => g.opens.get(x));
    const inv = $('#inv'), cont = $('#cont');
    $('#side').classList.toggle('hidden', !m);
    if (!m) { set(inv, ''); set(cont, ''); return; }
    if (!dm) set(inv, '');
    const kg = m.kg();
    const [status, kind] = m.status();
    const bars = [['Water', m.needs.hydration], ['Food', m.needs.food], ['Rest', m.needs.energy], ['Health', m.needs.health], ['Spirit', m.needs.morale]].map(([label, value]) => `<div class="bar ${value < 25 ? 'bad' : value < 50 ? 'warn' : ''}"><i style="width:${value}%"></i><label>${label} ${Math.round(value)}%</label></div>`).join('');
    if (dm) set(inv, `<button class="close-detail" aria-label="Close person panel">×</button><h3>${m.name} · ${m.role}, ${m.age}</h3><div class="${kind}">${status} · core ${m.bodyT.toFixed(1)}°F</div>${m.worn ? `<div class="equipment">Worn: ${esc(ITEMS[m.worn.id].name)}</div>` : ''}${bars}<p class="activity">${esc(m.name + ': ' + m.doing())}</p><button class="autonomy-control">${m.autonomy ? 'Wait for me' : 'Let them be'}</button>${m.ai ? '<button class="person-orders">Give an order</button>' : ''}<h3>${m.name} carries <span class="${kg > m.cap * 0.9 ? 'warn' : ''}">${kg.toFixed(1)} / ${m.cap} kg</span></h3>` +
      '<button class="equipment-control">Worn items / nearby lights</button>' +
      (m.inv.length ? m.inv.map((e, i) => this.itemRow(e, i, 'inv')).join('') : '<div class="hint">Nothing.</div>'));
    inv.onpointerdown = (ev) => {
      if (ev.target.closest('.close-detail')) { g.detailMember = null; this.refresh(); return; }
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
      el.style.display = m.away || m.dead ? 'none' : '';
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
