// The block: three lots north of the street, three south (flipped), one street between.
// One cell = one meter. Grid x runs east, y runs south (world z).

export const LOT_W = 20, LOT_H = 19, STREET_H = 6, LOTS_X = 3;
export const W = LOT_W * LOTS_X, H = LOT_H * 2 + STREET_H;

export const T = {
  YARD: 1, FLOOR: 2, WALL: 3, DOOR: 4, BLOCK: 5, GATE: 6, POOL: 7, CONCRETE: 8,
  SIDEWALK: 9, ROAD: 10, GARAGE: 11, GDOOR: 12, FURN: 13,
};
const WALKABLE = new Set([T.YARD, T.FLOOR, T.DOOR, T.GATE, T.CONCRETE, T.SIDEWALK, T.ROAD, T.GARAGE, T.GDOOR]);

// Lot plan, drawn with the street at the bottom.
// # house wall  D door  B cinder-block wall  b gate  P pool  c concrete  s sidewalk  g garage  G garage door
// Furniture letters: see FURN.
const PLAN = [
  'BBBBBBBBBBBBBBBBBBBB',
  'B,,,,,,,,,,,,,,,,,,B',
  'B,,PPPPPPP,,,,,,H,,B',
  'B,,PPPPPPP,,,,,,,,,B',
  'B,,,,,,,,,,,,,,,,,,B',
  'B,###########D#,,,,B',
  'B,#Rn..#kFKZk.#,,,,B',
  'B,#....#......#,,,,B',
  'B,#C...D......#,,,,B',
  'B,###D##...L..######',
  'B,#TW.#.......#SSSS#',
  'B,#...#.......#gggf#',
  'B,#####.......Dgggg#',
  'B,#Rn.D.......#gggg#',
  'B,#CR.#.......#gggg#',
  'Bb#####D#######GGGG#',
  'B,x,,,,c,,,,,,,cccc,',
  ',,,,,,,c,,,,,,,cccc,',
  'ssssssssssssssssssss',
];

export const FURN = {
  R: { kind: 'bed', name: 'Bed', h: 0.5, color: 0x6f7d8c },
  n: { kind: 'container', loot: ['nightstand'], name: 'Nightstand', h: 0.6, color: 0x6b5038 },
  C: { kind: 'container', loot: ['bedroomCloset'], name: 'Closet', h: 2.1, color: 0x7a5c3e },
  k: { kind: 'container', loot: ['kitchenDrawer'], name: 'Kitchen drawers', h: 0.9, color: 0x9b8b74 },
  F: { kind: 'container', loot: ['fridge', 'freezer'], name: 'Fridge', h: 1.8, color: 0xd9d9d6 },
  K: { kind: 'container', loot: ['pantry'], name: 'Pantry', h: 2.1, color: 0x8a7356 },
  Z: { kind: 'sink', name: 'Kitchen sink', h: 0.9, color: 0xb0b5b8 },
  T: { kind: 'container', loot: ['bathroomCabinet'], name: 'Bathroom cabinet', h: 0.9, color: 0xc9c2b4 },
  W: { kind: 'tub', name: 'Bathtub', h: 0.55, color: 0xe8e8e4 },
  L: { kind: 'container', loot: ['livingRoom'], name: 'Couch and side tables', h: 0.8, color: 0x5b4a42 },
  S: { kind: 'container', loot: ['garageShelf'], name: 'Garage shelves', h: 1.8, color: 0x6b6b66 },
  f: { kind: 'container', loot: ['garageFloor'], name: 'Boxes on the garage floor', h: 0.45, color: 0x9c8461 },
  x: { kind: 'container', loot: ['trashCan'], name: 'Trash can', h: 1.05, color: 0x2f4f3a },
  H: { kind: 'container', loot: ['shed'], name: 'Backyard shed', h: 2.2, color: 0x7b7468 },
};

const CHAR_T = {
  '#': T.WALL, D: T.DOOR, B: T.BLOCK, b: T.GATE, P: T.POOL, c: T.CONCRETE, s: T.SIDEWALK,
  g: T.GARAGE, G: T.GDOOR, '.': T.FLOOR, ',': T.YARD,
};

export const LOTS = [
  { id: 'nw', name: "Walt's house", gx: 0, north: true, mirror: true, pool: true },
  { id: 'home', name: 'home', gx: 1, north: true, mirror: false, pool: false, home: true },
  { id: 'ne', name: 'the Pruitt house', gx: 2, north: true, mirror: false, pool: false },
  { id: 'sw', name: 'the Nguyen house', gx: 0, north: false, mirror: false, pool: false },
  { id: 's', name: 'the Okafor house', gx: 1, north: false, mirror: true, pool: true },
  { id: 'se', name: 'the vacant rental', gx: 2, north: false, mirror: true, pool: false },
];

const CARS = [
  { name: 'Family car', lot: 'home', x: 35, y: 16, w: 4, h: 2, color: 0x4a5560 },
  { name: 'Dusty pickup', lot: null, x: 6, y: 19, w: 4, h: 2, color: 0x7a3a2a },
  { name: 'Silver sedan', lot: null, x: 46, y: 23, w: 4, h: 2, color: 0x9a9da0 },
  { name: 'Minivan', lot: 'sw', x: 15, y: H - 18, w: 4, h: 2, color: 0x2f3d55 },
];

export function buildMap() {
  const type = new Uint8Array(W * H);
  const objAt = new Int32Array(W * H).fill(-1);
  const lotAt = new Int8Array(W * H).fill(-1);
  const objects = [];
  const lots = LOTS.map((l) => ({ ...l, house: { x0: 1e9, y0: 1e9, x1: -1, y1: -1 } }));
  const idx = (x, y) => y * W + x;

  // street
  for (let y = LOT_H; y < LOT_H + STREET_H; y++) for (let x = 0; x < W; x++) type[idx(x, y)] = T.ROAD;

  lots.forEach((lot, li) => {
    for (let r = 0; r < LOT_H; r++) {
      for (let c = 0; c < LOT_W; c++) {
        let ch = PLAN[r][c];
        if (ch === 'P' && !lot.pool) ch = ',';
        const lx = lot.mirror ? LOT_W - 1 - c : c;
        const x = lot.gx * LOT_W + lx;
        const y = lot.north ? r : H - 1 - r;
        const i = idx(x, y);
        lotAt[i] = li;
        if (r >= 5 && r <= 15 && c >= 2) {
          const hb = lot.house;
          hb.x0 = Math.min(hb.x0, x); hb.x1 = Math.max(hb.x1, x);
          hb.y0 = Math.min(hb.y0, y); hb.y1 = Math.max(hb.y1, y);
        }
        if (FURN[ch]) {
          const f = FURN[ch];
          const inGarage = 'Sf'.includes(ch);
          const outside = 'xH'.includes(ch);
          type[i] = T.FURN;
          objAt[i] = objects.length;
          objects.push({
            id: objects.length, ch, ...f, x, y, w: 1, h: 1, lot: li, home: !!lot.home,
            floor: inGarage ? T.GARAGE : outside ? T.YARD : T.FLOOR,
            searched: false, items: [],
          });
        } else {
          type[i] = CHAR_T[ch] ?? T.YARD;
        }
      }
    }
  });

  for (const car of CARS) {
    const li = car.lot ? lots.findIndex((l) => l.id === car.lot) : -1;
    const o = {
      id: objects.length, kind: 'container', loot: ['carCabin', 'carTrunk'], name: car.name,
      x: car.x, y: car.y, w: car.w, h: car.h, color: car.color, car: true, lot: li,
      home: car.lot === 'home', searched: false, items: [],
    };
    for (let y = car.y; y < car.y + car.h; y++) {
      for (let x = car.x; x < car.x + car.w; x++) {
        o.floor = o.floor ?? type[idx(x, y)];
        type[idx(x, y)] = T.FURN;
        objAt[idx(x, y)] = o.id;
      }
    }
    objects.push(o);
  }

  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const map = {
    W, H, type, objAt, lotAt, objects, lots,
    idx, inB,
    get: (x, y) => (inB(x, y) ? type[idx(x, y)] : 0),
    walkable: (x, y) => inB(x, y) && WALKABLE.has(type[idx(x, y)]),
    under(x, y) {
      const t = map.get(x, y);
      return t === T.FURN ? objects[objAt[idx(x, y)]].floor ?? T.FLOOR : t;
    },
    isIndoor(x, y) {
      const t = map.under(x, y);
      return t === T.FLOOR || t === T.DOOR || t === T.GARAGE || t === T.GDOOR;
    },
    isGarage(x, y) { const t = map.under(x, y); return t === T.GARAGE || t === T.GDOOR; },
    houseOf(x, y) {
      for (let i = 0; i < lots.length; i++) {
        const b = lots[i].house;
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return i;
      }
      return -1;
    },
    objCells(o) {
      const out = [];
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) out.push([x, y]);
      return out;
    },
    // Walkable cells next to an object (4-neighbours), where someone stands to use it.
    useCells(o) {
      const out = [];
      for (const [x, y] of map.objCells(o)) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (map.walkable(nx, ny) && !out.some(([a, b]) => a === nx && b === ny)) out.push([nx, ny]);
        }
      }
      return out;
    },
  };
  map.home = lots.find((l) => l.home);
  map.tub = objects.find((o) => o.kind === 'tub' && o.home);
  // Interaction sites use existing walkable neighbours without changing collision cells.
  // West / south windows remain walls; main adds low, clickable panes and finished panels.
  map.sites = [
    { key: 'west-bedroom', kind: 'window', name: 'West bedroom window', x: 22, y: 7, axis: 'west' },
    { key: 'west-front-bedroom', kind: 'window', name: 'West front bedroom window', x: 22, y: 14, axis: 'west' },
    { key: 'south-bedroom', kind: 'window', name: 'South bedroom window', x: 24, y: 15, axis: 'south' },
    { key: 'south-living', kind: 'window', name: 'South living window', x: 30, y: 15, axis: 'south' },
    { key: 'tarp', kind: 'tarp', name: 'Yard shade posts', x: 28, y: 3 },
    { key: 'grill', kind: 'grill', name: 'Yard grill', x: 33, y: 3 },
    { key: 'panel', kind: 'panel', name: 'Electrical panel — small solar circuit', x: 38, y: 13 },
    { key: 'fan', kind: 'fan', name: 'Living room fan spot', x: 31, y: 12 },
    { key: 'walt', kind: 'walt', name: "Walt's front door", x: 12, y: 15 },
  ].map((s) => ({ ...s, w: 1, h: 1, home: s.kind !== 'walt', site: true }));
  return map;
}
