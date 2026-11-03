// Our own low-poly person: a jointed figure built from boxes, with idle/walk/run clips.
// Same shape as a loaded glTF ({ scene, animations }) so family.js clones and animates it the same way.
// Origin at the feet, facing +Z, 1.8 units tall before scaling.
import * as THREE from 'three';

const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const D = Math.PI / 180;

function part(name, w, h, d, mat, y = -h / 2) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, y, 0), mat);
  m.name = name + 'Mesh';
  return m;
}
function joint(name, x, y, z) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

export function makeFigure() {
  // "Clothes" gets each person's colour, "Joints" a darker shade of it (trousers, shoes); "Skin" stays as is.
  const clothes = new THREE.MeshLambertMaterial({ color: 0x888888, name: 'Clothes' });
  const pants = new THREE.MeshLambertMaterial({ color: 0x555555, name: 'Joints' });
  const skin = new THREE.MeshLambertMaterial({ color: 0xb08a6e, name: 'Skin' });

  const root = new THREE.Group();
  root.name = 'figure';
  const hips = joint('hips', 0, 0.95, 0);
  root.add(hips);
  hips.add(part('pelvis', 0.34, 0.16, 0.2, pants, 0));

  const spine = joint('spine', 0, 0.06, 0);
  hips.add(spine);
  spine.add(part('torso', 0.38, 0.5, 0.22, clothes, 0.25));
  const neck = joint('neck', 0, 0.52, 0);
  spine.add(neck);
  neck.add(part('head', 0.2, 0.24, 0.22, skin, 0.15));

  for (const [s, x] of [['L', 1], ['R', -1]]) {
    const sh = joint('shoulder' + s, 0.24 * x, 0.46, 0);
    spine.add(sh);
    sh.add(part('upperArm' + s, 0.1, 0.3, 0.11, clothes));
    const el = joint('elbow' + s, 0, -0.3, 0);
    sh.add(el);
    el.add(part('foreArm' + s, 0.085, 0.28, 0.09, skin));

    const th = joint('thigh' + s, 0.1 * x, -0.04, 0);
    hips.add(th);
    th.add(part('thighM' + s, 0.14, 0.44, 0.15, pants));
    const kn = joint('knee' + s, 0, -0.44, 0);
    th.add(kn);
    kn.add(part('shin' + s, 0.12, 0.42, 0.13, pants));
    kn.add(part('foot' + s, 0.12, 0.07, 0.24, pants, -0.42).translateZ(0.05));
  }
  return { scene: root, animations: [idleClip(), gaitClip('walk', 1.0, 28, 22, 0.035, 4), gaitClip('run', 0.62, 45, 40, 0.06, 14)] };
}

// one full stride: legs swing opposite to arms, knees bend on the back swing, hips bob twice
function gaitClip(name, T, leg, arm, bob, lean) {
  const n = 8, times = [], tr = {};
  const add = (k, q) => (tr[k] ||= []).push(...q.toArray());
  const pos = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T, a = (i / n) * Math.PI * 2, s = Math.sin(a);
    times.push(t);
    add('thighL', Q(-s * leg * D)); add('thighR', Q(s * leg * D));
    add('kneeL', Q(Math.max(0, Math.sin(a + 1.2)) * leg * 1.3 * D)); add('kneeR', Q(Math.max(0, Math.sin(a + Math.PI + 1.2)) * leg * 1.3 * D));
    add('shoulderL', Q(s * arm * D)); add('shoulderR', Q(-s * arm * D));
    add('elbowL', Q(-(12 + 10 * Math.max(0, s)) * D)); add('elbowR', Q(-(12 + 10 * Math.max(0, -s)) * D));
    add('spine', Q(lean * D, s * 4 * D, 0));
    pos.push(0, 0.95 + Math.abs(Math.cos(a)) * bob - bob, 0);
  }
  const tracks = Object.entries(tr).map(([k, v]) => new THREE.QuaternionKeyframeTrack(`${k}.quaternion`, times, v));
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, pos));
  return new THREE.AnimationClip(name, T, tracks);
}

function idleClip() {
  const T = 3.2, n = 8, times = [], sp = [], arms = { L: [], R: [] }, pos = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    times.push((i / n) * T);
    sp.push(...Q((2 + Math.sin(a) * 1.5) * D).toArray());
    arms.L.push(...Q(0, 0, (4 + Math.sin(a) * 1) * D).toArray());
    arms.R.push(...Q(0, 0, -(4 + Math.sin(a) * 1) * D).toArray());
    pos.push(0, 0.95 + Math.sin(a) * 0.004, 0);
  }
  const zero = Q().toArray();
  const still = (k) => new THREE.QuaternionKeyframeTrack(`${k}.quaternion`, [0], zero);
  return new THREE.AnimationClip('idle', T, [
    new THREE.QuaternionKeyframeTrack('spine.quaternion', times, sp),
    new THREE.QuaternionKeyframeTrack('shoulderL.quaternion', times, arms.L),
    new THREE.QuaternionKeyframeTrack('shoulderR.quaternion', times, arms.R),
    new THREE.VectorKeyframeTrack('hips.position', times, pos),
    ...['thighL', 'thighR', 'kneeL', 'kneeR', 'elbowL', 'elbowR'].map(still),
  ]);
}
