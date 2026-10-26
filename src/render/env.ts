// Sky, sun and moon, day/night, seasons, weather, clouds, rain, snow, splashes and lightning.
import * as THREE from 'three';
import type { Game } from '../sim/game';
import type { WeatherId, SeasonId } from '../sim/data';
import { SEASON_IDS } from '../sim/data';
import { toon, outlineMat } from './toon';
import { ENV } from './shared';
import { Terrain, WATER_Y } from './terrain';

// ---------- time of day ----------
interface Sky { h: number; top: string; hor: string; sun: string; si: number; hs: string; hg: string; hi: number }
const SKY: Sky[] = [
  { h: 0, top: '#0F1B3D', hor: '#283B66', sun: '#9DB2FF', si: 0.6, hs: '#6A80C4', hg: '#2A3352', hi: 1.25 },
  { h: 4.6, top: '#1D2B57', hor: '#4C5585', sun: '#A9B4F0', si: 0.6, hs: '#7584C2', hg: '#2E3352', hi: 1.2 },
  { h: 6, top: '#6F8ECF', hor: '#FFB892', sun: '#FFB37E', si: 1.4, hs: '#FFD3BE', hg: '#6E6A62', hi: 1.1 },
  { h: 8, top: '#6CB4EC', hor: '#D9EFF8', sun: '#FFF0D6', si: 2.3, hs: '#DCEFFF', hg: '#8C9A6A', hi: 1.25 },
  { h: 15.5, top: '#68B0EA', hor: '#DDEFF5', sun: '#FFEED0', si: 2.3, hs: '#DCEFFF', hg: '#8C9A6A', hi: 1.25 },
  { h: 18, top: '#6E8FD0', hor: '#FFC08C', sun: '#FFAA68', si: 1.9, hs: '#FFD2B0', hg: '#7B6A5A', hi: 1.15 },
  { h: 19.6, top: '#43549E', hor: '#F2937F', sun: '#FF8B6E', si: 1.0, hs: '#B59AC9', hg: '#463E58', hi: 1.0 },
  { h: 21, top: '#0F1B3D', hor: '#283B66', sun: '#9DB2FF', si: 0.6, hs: '#6A80C4', hg: '#2A3352', hi: 1.25 },
  { h: 24, top: '#0F1B3D', hor: '#283B66', sun: '#9DB2FF', si: 0.6, hs: '#6A80C4', hg: '#2A3352', hi: 1.25 },
];
const SKYC = SKY.map(k => ({ ...k, topC: new THREE.Color(k.top), horC: new THREE.Color(k.hor), sunC: new THREE.Color(k.sun), hsC: new THREE.Color(k.hs), hgC: new THREE.Color(k.hg) }));

// ---------- weather ----------
interface Look { over: number; near: number; far: number; cover: number; rain: number; snow: number; wet: number; storm: number; tint: string }
const LOOK: Record<WeatherId, Look> = {
  sunny: { over: 0, near: 45, far: 125, cover: 0.35, rain: 0, snow: 0, wet: 0, storm: 0, tint: '#ffffff' },
  cloudy: { over: 0.45, near: 40, far: 112, cover: 1, rain: 0, snow: 0, wet: 0, storm: 0, tint: '#dfe6ec' },
  rain: { over: 0.75, near: 24, far: 85, cover: 1, rain: 0.55, snow: 0, wet: 0.75, storm: 0, tint: '#a9b6c1' },
  storm: { over: 0.95, near: 16, far: 68, cover: 1, rain: 1, snow: 0, wet: 1, storm: 1, tint: '#6f7b88' },
  fog: { over: 0.6, near: 4, far: 36, cover: 0.3, rain: 0, snow: 0, wet: 0.25, storm: 0, tint: '#e6ecef' },
  snow: { over: 0.6, near: 22, far: 80, cover: 1, rain: 0, snow: 1, wet: 0, storm: 0, tint: '#dfe5ec' },
};
const LKEYS = ['over', 'near', 'far', 'cover', 'rain', 'snow', 'wet', 'storm'] as const;

// ---------- seasons ----------
interface SeasonLook { grass: string; a: string; b: string; c: string; cmix: number; ice: number }
const SEASON_LOOK: Record<SeasonId, SeasonLook> = {
  spring: { grass: '#98D871', a: '#8CCF62', b: '#A6DD7C', c: '#FFB3C8', cmix: 0.3, ice: 0 },
  summer: { grass: '#86CC63', a: '#5DB052', b: '#77C25F', c: '#5DB052', cmix: 0, ice: 0 },
  autumn: { grass: '#BFC266', a: '#F2A541', b: '#E2643F', c: '#F4C84B', cmix: 0.35, ice: 0 },
  winter: { grass: '#C9D6C4', a: '#8FB4A2', b: '#DCE6EA', c: '#7FA592', cmix: 0.4, ice: 1 },
};

const RAIN_N = 3000, SNOW_N = 2400, SPLASH_N = 260;

export class Env {
  private skyTop = new THREE.Color(); private skyHor = new THREE.Color();
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  private cloudMat: THREE.MeshToonMaterial;
  private clouds: THREE.Group[] = [];
  private stars: THREE.Points;
  private moon: THREE.Mesh;
  private rain: THREE.LineSegments;
  private drops = new Float32Array(RAIN_N * 3);
  private snow: THREE.Points;
  private flakes = new Float32Array(SNOW_N * 3);
  private splash: THREE.InstancedMesh;
  private splashes: { x: number; y: number; z: number; t: number }[] = [];
  private flash = 0; private boltT = 6;
  private flashEl: HTMLElement;
  // eased state
  private w = { over: 0, near: 45, far: 125, cover: 0.35, rain: 0, snow: 0, wet: 0, storm: 0, tint: new THREE.Color('#ffffff') };
  private snowCover = 0;
  night = 0;
  onThunder: (delay: number) => void = () => {};
  private t = 0;

  constructor(private scene: THREE.Scene) {
    // sky dome
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
      uniforms: { uTop: { value: this.skyTop }, uHor: { value: this.skyHor } }, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 uTop,uHor;varying vec3 vD;\n#include <common>\nvoid main(){gl_FragColor=vec4(mix(uHor,uTop,pow(max(vD.y,0.0),0.55)),1.0);\n#include <colorspace_fragment>\n}',
    }));
    sky.frustumCulled = false;
    scene.add(sky);
    // stars and moon
    const sp: number[] = [];
    for (let i = 0; i < 700; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(1 - Math.random() * 0.9);
      sp.push(Math.sin(v) * Math.cos(u) * 280, Math.cos(v) * 280, Math.sin(v) * Math.sin(u) * 280);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff6dd, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false, transparent: true }));
    scene.add(this.moon);
    // lights
    this.hemi = new THREE.HemisphereLight(0xdcefff, 0x8c9a6a, 1.25);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 140 });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);
    // clouds
    this.cloudMat = toon('#ffffff', { emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.3 });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      const k = 3 + (i % 3);
      // each cloud has its own material so it can fade out when it drifts in front of the view
      const mat = this.cloudMat.clone();
      mat.transparent = true; mat.depthWrite = false;
      g.userData.mat = mat;
      for (let j = 0; j < k; j++) {
        const r = 1.6 + Math.random() * 1.4;
        const geo = new THREE.SphereGeometry(r, 16, 12);
        const m = new THREE.Mesh(geo, mat);
        m.add(new THREE.Mesh(geo, outlineMat(0.08, '#9fb3cf')));
        m.position.set((j - k / 2) * 1.8, Math.random() * 0.8, Math.random());
        g.add(m);
      }
      g.scale.set(1, 0.6, 1);
      g.position.set((Math.random() - 0.5) * 160, 22 + Math.random() * 6, (Math.random() - 0.5) * 160);
      g.userData.v = 0.4 + Math.random() * 0.5;
      scene.add(g);
      this.clouds.push(g);
    }
    // rain streaks
    for (let i = 0; i < RAIN_N; i++) { this.drops[i * 3] = (Math.random() - 0.5) * 56; this.drops[i * 3 + 1] = Math.random() * 24; this.drops[i * 3 + 2] = (Math.random() - 0.5) * 56; }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 6), 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#eef5fb', transparent: true, opacity: 0.7, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.geometry.setDrawRange(0, 0);
    scene.add(this.rain);
    // snowflakes
    for (let i = 0; i < SNOW_N; i++) { this.flakes[i * 3] = (Math.random() - 0.5) * 56; this.flakes[i * 3 + 1] = Math.random() * 22; this.flakes[i * 3 + 2] = (Math.random() - 0.5) * 56; }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW_N * 3), 3));
    this.snow = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, map: dotTexture(), transparent: true, depthWrite: false, opacity: 0.95 }));
    this.snow.frustumCulled = false;
    this.snow.geometry.setDrawRange(0, 0);
    scene.add(this.snow);
    // splash crowns: a thin ring plus three droplets
    const ring = new THREE.TorusGeometry(0.09, 0.012, 4, 14).rotateX(Math.PI / 2);
    const parts: THREE.BufferGeometry[] = [ring];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.SphereGeometry(0.018, 5, 4);
      const a = i * 2.1;
      s.translate(Math.cos(a) * 0.06, 0.07 + i * 0.015, Math.sin(a) * 0.06);
      parts.push(s);
    }
    const merged = mergeSimple(parts);
    this.splash = new THREE.InstancedMesh(merged, new THREE.MeshBasicMaterial({ color: 0xeaf4fb, transparent: true, opacity: 0.8, depthWrite: false }), SPLASH_N);
    this.splash.frustumCulled = false;
    this.splash.count = 0;
    scene.add(this.splash);
    this.flashEl = document.createElement('div');
    this.flashEl.className = 'flash';
    document.body.appendChild(this.flashEl);
  }

  /** for the audio mix */
  mix() { return { rain: this.w.rain, storm: this.w.storm, sunny: 1 - this.w.over, night: this.night, snow: this.w.snow }; }

  update(dt: number, game: Game, target: THREE.Vector3, terrain: Terrain, fog: THREE.Fog, camDist = 26, camera?: THREE.Camera) {
    this.t += dt;
    ENV.uTime.value = this.t;
    const ease = 1 - Math.exp(-dt * 1.5);
    // ---- weather ----
    const wa = LOOK[game.weather.prev], wb = LOOK[game.weather.cur];
    const k = game.weather.blend * game.weather.blend * (3 - 2 * game.weather.blend);
    for (const key of LKEYS) this.w[key] += ((wa[key] + (wb[key] - wa[key]) * k) - this.w[key]) * ease;
    this.w.tint.lerp(new THREE.Color(wa.tint).lerp(new THREE.Color(wb.tint), k), ease);
    // ---- time of day ----
    const h = game.hour;
    let i = 0;
    while (i < SKYC.length - 2 && h >= SKYC[i + 1].h) i++;
    const A = SKYC[i], B = SKYC[i + 1], u = (h - A.h) / (B.h - A.h);
    const top = A.topC.clone().lerp(B.topC, u), hor = A.horC.clone().lerp(B.horC, u);
    const sunC = A.sunC.clone().lerp(B.sunC, u);
    let si = A.si + (B.si - A.si) * u, hi = A.hi + (B.hi - A.hi) * u;
    const hs = A.hsC.clone().lerp(B.hsC, u), hg = A.hgC.clone().lerp(B.hgC, u);
    this.night = game.night;
    // overcast weather washes out the sky and the sun
    const o = this.w.over;
    const grey = (c: THREE.Color) => { const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; return new THREE.Color(l, l, l).multiply(this.w.tint); };
    top.lerp(grey(top).multiplyScalar(1.05), o * 0.85);
    hor.lerp(grey(hor).multiplyScalar(1.0), o * 0.8);
    si *= 1 - o * 0.82;
    hi *= 1 + o * 0.15;
    this.skyTop.copy(top); this.skyHor.copy(hor);
    fog.color.copy(hor);
    // fog starts past the point you are looking at, so zooming out in fog still shows the town
    const view = Math.max(0, camDist - 12);
    fog.near = this.w.near + view; fog.far = this.w.far + view * 1.15;
    // sun / moon direction
    const day = h >= 5.5 && h <= 20;
    let dir: THREE.Vector3;
    if (day) {
      const a = Math.min(1, Math.max(0, (h - 5.5) / 14.5)) * Math.PI;
      const el = Math.max(0.2, Math.sin(a) * 1.05);
      const az = -1.9 + (h - 5.5) / 14.5 * 2.6;
      dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    } else dir = new THREE.Vector3(0.45, 0.75, -0.48).normalize();
    this.sun.position.copy(target).addScaledVector(dir, 60);
    this.sun.target.position.copy(target);
    this.sun.color.copy(sunC);
    this.hemi.color.copy(hs); this.hemi.groundColor.copy(hg);
    this.moon.position.copy(target).add(new THREE.Vector3(0.45, 0.75, -0.48).normalize().multiplyScalar(250));
    (this.moon.material as THREE.MeshBasicMaterial).opacity = this.night * (1 - o);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, this.night - 0.3) * (1 - o) * 1.3;
    // lightning
    if (this.w.storm > 0.6 && game.speed > 0) {
      this.boltT -= dt;
      if (this.boltT <= 0) { this.boltT = 5 + Math.random() * 9; this.flash = 1; this.onThunder(0.3 + Math.random() * 1.4); }
    }
    this.flash *= Math.exp(-dt * 7);
    const flicker = this.flash > 0.05 ? (Math.sin(this.t * 60) > 0 ? 1 : 0.5) : 0;
    this.flashEl.style.opacity = String(this.flash * flicker * 0.45);
    this.sun.intensity = si;
    this.hemi.intensity = hi + this.flash * flicker * 2.5;
    // clouds
    const nightDim = 1 - this.night * 0.65;
    this.cloudMat.color.copy(grey(new THREE.Color('#ffffff')).lerp(new THREE.Color('#ffffff'), 1 - o * 0.7)).multiplyScalar(nightDim);
    this.cloudMat.emissive.copy(this.cloudMat.color);
    const P = new THREE.Vector3();
    this.clouds.forEach((c, j) => {
      c.visible = j < Math.round(this.w.cover * this.clouds.length);
      const mat = c.userData.mat as THREE.MeshToonMaterial;
      mat.color.copy(this.cloudMat.color); mat.emissive.copy(this.cloudMat.emissive);
      // clouds below the camera stay at the edges of the screen; over the middle they turn see-through
      let a = 1;
      if (camera && c.position.y < camera.position.y) {
        P.copy(c.position).project(camera);
        const r = Math.hypot(P.x, P.y * 1.2);
        a = THREE.MathUtils.smoothstep(r, 0.45, 1.05) * 0.85 + 0.15;
      }
      mat.opacity += (a - mat.opacity) * Math.min(1, dt * 4);
      for (const m of c.children) (m.children[0] as THREE.Mesh).visible = mat.opacity > 0.7;
      c.position.x += dt * c.userData.v * (1 + this.w.storm * 2);
      if (c.position.x > target.x + 90) c.position.x = target.x - 90;
    });
    // ---- seasons ----
    const sp = game.seasonPos;
    const s0 = SEASON_IDS[Math.floor(sp) % 4], s1 = SEASON_IDS[(Math.floor(sp) + 1) % 4];
    const sk = THREE.MathUtils.smoothstep(sp - Math.floor(sp), 0.8, 1);
    const L0 = SEASON_LOOK[s0], L1 = SEASON_LOOK[s1];
    const lc = (a: string, b: string) => new THREE.Color(a).lerp(new THREE.Color(b), sk);
    terrain.terrainU.uGrass.value.copy(lc(L0.grass, L1.grass));
    ENV.uLeafA.value.copy(lc(L0.a, L1.a));
    ENV.uLeafB.value.copy(lc(L0.b, L1.b));
    ENV.uLeafC.value.copy(lc(L0.c, L1.c));
    ENV.uLeafCMix.value = L0.cmix + (L1.cmix - L0.cmix) * sk;
    const winter = (s0 === 'winter' ? 1 - sk : 0) + (s1 === 'winter' ? sk : 0);
    const snowTarget = winter * (0.5 + this.w.snow * 0.45);
    this.snowCover += (snowTarget - this.snowCover) * (1 - Math.exp(-dt * 0.25));
    ENV.uSnow.value = this.snowCover;
    ENV.uWet.value = this.w.wet;
    ENV.uGlow.value = Math.min(1, this.night * 1.1 + this.w.storm * 0.35);
    const wu = terrain.waterU;
    wu.uTime.value = this.t;
    wu.uRain.value = this.w.wet;
    wu.uSun.value = (1 - o) * (1 - this.night);
    wu.uNight.value = this.night;
    wu.uIce.value = winter * 0.6;
    // ---- precipitation ----
    this.updateRain(dt, target);
    this.updateSnow(dt, target);
    this.updateSplashes(dt, target, terrain);
  }

  private updateRain(dt: number, target: THREE.Vector3) {
    const n = Math.floor(RAIN_N * this.w.rain);
    this.rain.geometry.setDrawRange(0, n * 2);
    if (!n) return;
    const wind = 3 + this.w.storm * 6, fall = 26 + this.w.storm * 10;
    const d = this.drops, pos = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      d[j + 1] -= fall * dt; d[j] += wind * dt;
      if (d[j + 1] < 0) { d[j + 1] += 24; d[j] = (Math.random() - 0.5) * 56; d[j + 2] = (Math.random() - 0.5) * 56; }
      if (d[j] > 28) d[j] -= 56;
      const o = i * 6;
      arr[o] = d[j]; arr[o + 1] = d[j + 1]; arr[o + 2] = d[j + 2];
      arr[o + 3] = d[j] - wind * 0.05; arr[o + 4] = d[j + 1] + 0.85; arr[o + 5] = d[j + 2];
    }
    pos.needsUpdate = true;
    this.rain.position.set(target.x, 0, target.z);
  }
  private updateSnow(dt: number, target: THREE.Vector3) {
    const n = Math.floor(SNOW_N * this.w.snow);
    this.snow.geometry.setDrawRange(0, n);
    if (!n) return;
    const f = this.flakes, pos = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      f[j + 1] -= (1.3 + (i % 7) * 0.12) * dt;
      f[j] += Math.sin(this.t * 0.9 + i) * 0.4 * dt + 0.3 * dt;
      f[j + 2] += Math.cos(this.t * 0.7 + i * 1.3) * 0.3 * dt;
      if (f[j + 1] < 0) { f[j + 1] += 22; f[j] = (Math.random() - 0.5) * 56; f[j + 2] = (Math.random() - 0.5) * 56; }
      if (f[j] > 28) f[j] -= 56;
      arr[j] = f[j]; arr[j + 1] = f[j + 1]; arr[j + 2] = f[j + 2];
    }
    pos.needsUpdate = true;
    this.snow.position.set(target.x, 0, target.z);
  }
  private updateSplashes(dt: number, target: THREE.Vector3, terrain: Terrain) {
    const want = Math.floor(SPLASH_N * this.w.rain);
    while (this.splashes.length < want) this.splashes.push({ x: 0, y: 0, z: 0, t: Math.random() * 0.45 });
    if (this.splashes.length > want) this.splashes.length = want;
    const M = new THREE.Matrix4(), S = new THREE.Vector3(), V = new THREE.Vector3(), Q = new THREE.Quaternion();
    this.splashes.forEach((s, i) => {
      s.t += dt;
      if (s.t > 0.45) {
        s.t = 0;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 20;
        s.x = target.x + Math.cos(a) * r; s.z = target.z + Math.sin(a) * r;
        s.y = Math.max(terrain.height(s.x, s.z), WATER_Y) + 0.03;
      }
      const k = s.t / 0.45;
      const sc = 0.4 + k * 0.9, hy = Math.sin(Math.PI * Math.min(1, k * 1.3));
      V.set(s.x, s.y, s.z); S.set(sc, Math.max(0.01, hy), sc);
      M.compose(V, Q, S);
      this.splash.setMatrixAt(i, M);
    });
    this.splash.count = this.splashes.length;
    this.splash.instanceMatrix.needsUpdate = true;
  }
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function mergeSimple(geos: THREE.BufferGeometry[]) {
  const pos: number[] = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return out;
}
