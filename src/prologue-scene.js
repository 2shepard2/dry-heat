// One transparent plane and a handful of our own figures; no extra lights or shadows.
import * as THREE from 'three';
import { makeFigure } from './figure.js';

export function prologueScene(game, scene, cam) {
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(84, 38), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float time;
      void main() {
        float x = vUv.x, y = vUv.y;
        float edge = smoothstep(0., .16, x) * smoothstep(1., .84, x) * smoothstep(0., .16, y) * smoothstep(1., .84, y);
        float wave = .11 * sin(x * 9. + time * .12) + .035 * sin(x * 23. - time * .08);
        float green = exp(-pow((y - .43 - wave) / .09, 2.));
        float violet = exp(-pow((y - .63 - wave * .7) / .13, 2.));
        float folds = .65 + .35 * pow(.5 + .5 * sin(x * 140. + y * 7. + time * .2), 2.);
        vec3 color = vec3(.18, .86, .46) * green + vec3(.48, .22, .8) * violet;
        gl_FragColor = vec4(color, edge * folds * max(green, violet) * .48);
      }`,
  }));
  sky.rotation.x = -Math.PI / 2; sky.position.set(29, 10, 13); sky.visible = false; sky.renderOrder = 1;
  scene.add(sky);
  const neighbors = [0x99917b, 0x777c96, 0xc0a17f, 0x6a947e].map((color, i) => {
    const fig = makeFigure().scene;
    fig.traverse((o) => { if (o.isMesh && o.material.name !== 'Skin') { o.material = o.material.clone(); o.material.color.setHex(color); } });
    fig.scale.setScalar(i === 0 ? .9 : 1);
    const phone = new THREE.Mesh(new THREE.BoxGeometry(.09, .16, .025), new THREE.MeshBasicMaterial({ color: 0xc7deed }));
    phone.position.set(.3, 1.3, .24); fig.add(phone);
    fig.position.set(20 + i * 5, 0, 20 + i % 2 * 3); fig.visible = false; scene.add(fig); return fig;
  });
  let active = false, savedCamera;
  return {
    set(on, beat) {
      if (active && !on) {
        if (savedCamera) { cam.target.copy(savedCamera.target); cam.zoom = savedCamera.zoom; }
        for (const m of game.family) { m.pos.y = 0; m.stopTask(true); }
      }
      if (on && !active) {
        savedCamera = { target: cam.target.clone(), zoom: cam.zoom };
        cam.target.set(28, 0, 20); cam.zoom = 1.2;
        const spots = [[27, 21], [28, 21], [30, 22], [27, 21]];
        game.family.forEach((m, i) => { m.stopTask(true); m.pos.set(spots[i][0] + .5, i === 3 ? 1.4 : 0, spots[i][1] + .5); });
      }
      active = on; sky.visible = on;
      neighbors.forEach((o, i) => { o.visible = on || (i === 0 && beat?.id === 'p4a'); });
      if (beat?.id === 'p4a') neighbors[0].position.set(15.5, 0, 20.5);
      else neighbors[0].position.set(20, 0, 20);
    },
    update(seconds) {
      sky.material.uniforms.time.value = seconds;
      if (active) {
        const marcus = game.family.find((m) => m.id === 'marcus');
        const theo = game.family.find((m) => m.id === 'theo');
        if (marcus && theo) theo.pos.set(marcus.pos.x, 1.4, marcus.pos.z);
      }
    },
  };
}
