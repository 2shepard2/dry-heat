// Turn the cell map into meshes. Everything static is merged per material to stay light on laptop GPUs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { T } from './map.js';
import { makeRng } from './rng.js';

const GROUND = {
  [T.YARD]: [0xb39a74, 0.08], [T.FLOOR]: [0xcdbfa6, 0.03], [T.DOOR]: [0xcdbfa6, 0.03],
  [T.WALL]: [0xcdbfa6, 0], [T.BLOCK]: [0xa59d92, 0], [T.GATE]: [0xa49a86, 0.04],
  [T.POOL]: [0x3c8f9c, 0], [T.CONCRETE]: [0xaaa59c, 0.04], [T.SIDEWALK]: [0xb8b2a6, 0.04],
  [T.ROAD]: [0x3b3a37, 0.05], [T.GARAGE]: [0x8f8a82, 0.03], [T.GDOOR]: [0x8f8a82, 0.03],
};

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export function buildWorld(scene, map) {
  const rng = makeRng('dry-season-ground');
  const pickables = [];
  const lots = map.lots.map(() => ({ upper: new THREE.Group() }));
  for (const l of lots) scene.add(l.upper);

  // ---- ground: one quad per cell with a little color noise so gravel reads as gravel
  {
    const pos = [], col = [], nrm = [];
    const c = new THREE.Color();
    for (let y = 0; y < map.H; y++) {
      for (let x = 0; x < map.W; x++) {
        let t = map.get(x, y);
        if (t === T.FURN) t = map.objects[map.objAt[map.idx(x, y)]].floor ?? T.FLOOR;
        const [hex, jit] = GROUND[t] || GROUND[T.YARD];
        c.setHex(hex);
        const k = 1 + (rng.next() - 0.5) * 2 * jit;
        c.r *= k; c.g *= k; c.b *= k;
        if (t === T.YARD && rng.chance(0.06)) c.setHex(0x8f8a5a); // dead grass / weeds
        const yy = t === T.POOL ? 0.02 : 0;
        const q = [[x, y], [x, y + 1], [x + 1, y + 1], [x, y], [x + 1, y + 1], [x + 1, y]];
        for (const [qx, qz] of q) { pos.push(qx, yy, qz); nrm.push(0, 1, 0); col.push(c.r, c.g, c.b); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // road center line (dashed) and curbs
  {
    const gs = [];
    const zc = map.H / 2;
    for (let x = 0.5; x < map.W; x += 3) gs.push(box(1.5, 0.01, 0.12, x + 0.75, 0.012, zc));
    const m = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshLambertMaterial({ color: 0xc9a43a }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // ---- walls: lower band always visible, upper band + lintels per house (cut away when you're inside)
  const lower = [], blocks = [], upperByLot = map.lots.map(() => []);
  for (let y = 0; y < map.H; y++) {
    for (let x = 0; x < map.W; x++) {
      const t = map.get(x, y);
      const li = map.houseOf(x, y);
      if (t === T.WALL) {
        lower.push(box(1, 1.0, 1, x + 0.5, 0.5, y + 0.5));
        if (li >= 0) upperByLot[li].push(box(1, 1.6, 1, x + 0.5, 1.8, y + 0.5));
      } else if ((t === T.DOOR || t === T.GDOOR) && li >= 0) {
        upperByLot[li].push(box(1, 0.5, 1, x + 0.5, 2.35, y + 0.5));
      } else if (t === T.BLOCK) {
        blocks.push(box(1, 1.8, 0.9, x + 0.5, 0.9, y + 0.5));
      }
    }
  }
  const stucco = new THREE.MeshLambertMaterial({ color: 0xd6c09c });
  const stuccoUp = new THREE.MeshLambertMaterial({ color: 0xd2bb95 });
  const add = (geoms, mat, parent = scene) => {
    if (!geoms.length) return null;
    const m = new THREE.Mesh(mergeGeometries(geoms), mat);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  add(lower, stucco);
  add(blocks, new THREE.MeshLambertMaterial({ color: 0x9e958a }));
  map.lots.forEach((lot, i) => {
    add(upperByLot[i], stuccoUp, lots[i].upper);
    // flat roof with a parapet lip, typical desert ranch
    const b = lot.house;
    const roof = new THREE.Mesh(
      box(b.x1 - b.x0 + 1.3, 0.3, b.y1 - b.y0 + 1.3, (b.x0 + b.x1 + 1) / 2, 2.75, (b.y0 + b.y1 + 1) / 2),
      new THREE.MeshLambertMaterial({ color: lot.home ? 0x8c6b55 : 0x7f6a5c }),
    );
    roof.castShadow = true; roof.receiveShadow = true;
    lots[i].upper.add(roof);
    // swamp cooler / dead AC unit on the roof
    const ac = new THREE.Mesh(box(1.2, 0.8, 1.2, b.x0 + 4.5, 3.3, b.y0 + 3.5), new THREE.MeshLambertMaterial({ color: 0x9a9c9a }));
    ac.castShadow = true;
    lots[i].upper.add(ac);
  });

  // ---- furniture and cars: real meshes so they can be clicked
  for (const o of map.objects) {
    let mesh;
    if (o.car) {
      const g = mergeGeometries([
        box(o.w - 0.2, 0.8, o.h - 0.3, o.x + o.w / 2, 0.6, o.y + o.h / 2),
        box(o.w * 0.55, 0.6, o.h - 0.5, o.x + o.w / 2 - 0.2, 1.3, o.y + o.h / 2),
      ]);
      mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: o.color }));
    } else if (o.kind === 'tub') {
      mesh = new THREE.Mesh(box(0.9, o.h, 0.9, o.x + 0.5, o.h / 2, o.y + 0.5), new THREE.MeshLambertMaterial({ color: o.color }));
      if (o.home) {
        const water = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0x5aa7b8, transparent: true, opacity: 0.85 }));
        water.rotation.x = -Math.PI / 2;
        water.position.set(o.x + 0.5, o.h + 0.01, o.y + 0.5);
        water.visible = false;
        scene.add(water);
        o.water = water;
      }
    } else if (o.ch === 'x') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, o.h, 10).translate(o.x + 0.5, o.h / 2, o.y + 0.5), new THREE.MeshLambertMaterial({ color: o.color }));
    } else {
      const inset = o.ch === 'H' ? 0.02 : 0.08;
      mesh = new THREE.Mesh(box(1 - inset * 2, o.h, 1 - inset * 2, o.x + 0.5, o.h / 2, o.y + 0.5), new THREE.MeshLambertMaterial({ color: o.color }));
    }
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.obj = o;
    o.mesh = mesh;
    scene.add(mesh);
    pickables.push(mesh);
  }

  // ---- dead power lines and a few trees: the street should look like a street
  {
    const poles = [], wires = [];
    const zs = [map.H / 2 - 3.2];
    for (const z of zs) {
      for (let x = 8; x < map.W; x += 20) {
        poles.push(box(0.22, 8, 0.22, x, 4, z));
        poles.push(box(2.4, 0.15, 0.15, x, 7.4, z));
      }
      for (const dx of [-1, 0, 1]) wires.push(box(map.W, 0.03, 0.03, map.W / 2, 7.5, z + dx * 0.9));
    }
    add(poles, new THREE.MeshLambertMaterial({ color: 0x5b4636 }));
    const w = add(wires, new THREE.MeshBasicMaterial({ color: 0x222222 }));
    if (w) w.castShadow = false;

    const trunks = [], crowns = [];
    const tr = makeRng('trees');
    for (const lot of map.lots) {
      const front = lot.north ? 16.5 : map.H - 16.5;
      const x = lot.gx * 20 + (lot.mirror ? 7.5 : 11.5);
      if (tr.chance(0.75)) {
        trunks.push(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 6).translate(x, 1.2, front));
        const cg = new THREE.IcosahedronGeometry(1.4, 0);
        cg.scale(1.3, 0.5, 1.3);
        cg.translate(x, 2.7, front);
        crowns.push(cg);
      }
    }
    add(trunks, new THREE.MeshLambertMaterial({ color: 0x6b5a3a }));
    add(crowns, new THREE.MeshLambertMaterial({ color: 0x7c7f4a, flatShading: true }));
  }

  // invisible plane for ground clicks
  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(map.W * 3, map.H * 3), new THREE.MeshBasicMaterial({ visible: false }));
  pickPlane.rotation.x = -Math.PI / 2;
  pickPlane.position.set(map.W / 2, 0, map.H / 2);
  scene.add(pickPlane);

  return { pickables, pickPlane, lots };
}
