// Sky, sun and moon, day/night, seasons, weather, clouds, rain, snow, splashes and lightning.
import * as THREE from 'three';
import type { Game } from '../sim/game';
import type { WeatherId, SeasonId } from '../sim/data';
import { SEASON_IDS } from '../sim/data';
import { toon, outlineMat } from './toon';
import { ENV } from './shared';
import { Terrain, WATER_Y } from './terrain';
import { Lightning } from './lightning';

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

const RAIN_N = 6000, SNOW_N = 7000, DRIFT_N = 2600, SPLASH_N = 320;

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
  private flash = 0; private boltT = 4;
  private lightning = new Lightning();
  private cloudFlashT = 1;
  /** 0..1 eased: a blizzard is blowing (white-out, sideways snow, drifting ground snow) */
  blz = 0;
  /** snow and blowing snow fill the air between the view centre and the camera */
  private toCam = new THREE.Vector3();
  private drift: THREE.Points;
  private drifts = new Float32Array(DRIFT_N * 4);
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
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.radius = 3;
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
    for (let i = 0; i < SNOW_N; i++) { this.flakes[i * 3] = (Math.random() - 0.5) * 36; this.flakes[i * 3 + 1] = Math.random() * 14; this.flakes[i * 3 + 2] = (Math.random() - 0.5) * 36; }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW_N * 3), 3));
    const fs = new Float32Array(SNOW_N);
    for (let i = 0; i < SNOW_N; i++) fs[i] = 0.12 + Math.pow(Math.random(), 3) * 0.3;
    fg.setAttribute('size', new THREE.BufferAttribute(fs, 1));
    this.snow = new THREE.Points(fg, new THREE.ShaderMaterial({
      uniforms: { uMap: { value: dotTexture() }, uScale: { value: innerHeight * 0.9 }, uDim: { value: 1 } },
      transparent: true, depthWrite: false,
      vertexShader: 'attribute float size;uniform float uScale;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=size*uScale/-mv.z;}',
      fragmentShader: 'uniform sampler2D uMap;uniform float uDim;void main(){float a=texture2D(uMap,gl_PointCoord).a;if(a<0.02)discard;gl_FragColor=vec4(vec3(uDim),a*0.95);}',
    }));
    this.snow.frustumCulled = false;
    this.snow.geometry.setDrawRange(0, 0);
    scene.add(this.snow);
    // blowing snow: long thin streaks flying with the wind, thickest near the ground
    for (let i = 0; i < DRIFT_N; i++) this.resetDrift(i, true);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DRIFT_N * 3), 3));
    const dl = new Float32Array(DRIFT_N);
    for (let i = 0; i < DRIFT_N; i++) dl[i] = this.drifts[i * 4 + 3];
    dg.setAttribute('len', new THREE.BufferAttribute(dl, 1));
    // each streak is a point sprite with a thin line drawn inside it, turned to the wind's direction on screen
    this.drift = new THREE.Points(dg, new THREE.ShaderMaterial({
      uniforms: { uScale: { value: innerHeight }, uOp: { value: 0 }, uWind: { value: new THREE.Vector3(1, -0.03, 0.05) }, uAspect: { value: innerWidth / innerHeight } },
      transparent: true, depthWrite: false,
      vertexShader: `attribute float len;uniform float uScale, uAspect;uniform vec3 uWind;varying vec2 vDir;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 a = projectionMatrix * mv;
  vec4 b = projectionMatrix * modelViewMatrix * vec4(position + uWind * 0.5, 1.0);
  vec2 d = (b.xy / b.w - a.xy / a.w) * vec2(uAspect, 1.0);
  vDir = length(d) > 1e-6 ? normalize(d) : vec2(1.0, 0.0);
  gl_Position = a;
  gl_PointSize = min(120.0, len * uScale / -mv.z);
}`,
      fragmentShader: `uniform float uOp;varying vec2 vDir;
void main(){
  vec2 c = gl_PointCoord - 0.5; c.y = -c.y;
  vec2 r = vec2(dot(c, vDir), dot(c, vec2(-vDir.y, vDir.x)));
  // a thin streak, brightest at the leading end
  float a = (1.0 - smoothstep(0.03, 0.08, abs(r.y))) * smoothstep(-0.45, 0.3, r.x) * (1.0 - smoothstep(0.36, 0.48, r.x));
  if (a < 0.02) discard;
  gl_FragColor = vec4(vec3(1.0), min(1.0, a * uOp * 1.05));
}`,
    }));
    this.drift.frustumCulled = false;
    this.drift.geometry.setDrawRange(0, 0);
    scene.add(this.drift);
    scene.add(this.lightning.group);
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
    this.blz += ((game.blizzard ? 1 : 0) - this.blz) * (1 - Math.exp(-dt * 0.8));
    const blz = this.blz;
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
    const o = Math.max(this.w.over, blz * 0.9);
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
    // a blizzard closes in: pale blue-white haze with the far side of town swallowed
    if (blz > 0.01) {
      fog.near = THREE.MathUtils.lerp(fog.near, 8 + view, blz);
      fog.far = THREE.MathUtils.lerp(fog.far, 60 + view * 1.1, blz);
      fog.color.lerp(new THREE.Color('#cfdae6').multiplyScalar(1 - this.night * 0.7), blz * 0.85);
      this.skyHor.lerp(fog.color, blz); this.skyTop.lerp(fog.color, blz * 0.7);
    }
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
    // shadows cover what the camera sees, so zoomed-out towns still sit on their shadows
    const sh = Math.max(22, camDist * 1.05);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - sh) > 0.5) { sc.left = sc.bottom = -sh; sc.right = sc.top = sh; sc.updateProjectionMatrix(); }
    this.sun.target.position.copy(target);
    this.sun.color.copy(sunC);
    this.hemi.color.copy(hs); this.hemi.groundColor.copy(hg);
    this.moon.position.copy(target).add(new THREE.Vector3(0.45, 0.75, -0.48).normalize().multiplyScalar(250));
    (this.moon.material as THREE.MeshBasicMaterial).opacity = this.night * (1 - o);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, this.night - 0.3) * (1 - o) * 1.3;
    // lightning
    if (this.w.storm > 0.6 && game.speed > 0) {
      this.boltT -= dt;
      if (this.boltT <= 0 && camera) {
        this.boltT = 3 + Math.random() * 8;
        const r = this.lightning.strike(target, camera.position, (x, z) => terrain.height(x, z));
        // sound takes longer from further away
        this.onThunder(0.15 + r / 14);
      }
    }
    this.lightning.update(dt);
    this.flash = Math.max(this.flash * Math.exp(-dt * 7), this.lightning.level);
    const flicker = this.flash > 0.05 ? (Math.sin(this.t * 60) > 0 ? 1 : 0.6) : 0;
    this.flashEl.style.opacity = String(this.flash * flicker * 0.3);
    this.sun.intensity = si;
    this.hemi.intensity = hi + this.flash * flicker * 2.2;
    // sheet lightning glowing inside the storm clouds now and then
    if (this.w.storm > 0.4) {
      this.cloudFlashT -= dt;
      if (this.cloudFlashT <= 0) {
        this.cloudFlashT = 0.4 + Math.random() * 2.2;
        const vis = this.clouds.filter(c => c.visible);
        if (vis.length) vis[Math.floor(Math.random() * vis.length)].userData.fl = 1;
      }
    }
    // clouds
    const nightDim = 1 - this.night * 0.65;
    this.cloudMat.color.copy(grey(new THREE.Color('#ffffff')).lerp(new THREE.Color('#ffffff'), 1 - o * 0.7)).multiplyScalar(nightDim);
    this.cloudMat.emissive.copy(this.cloudMat.color);
    const P = new THREE.Vector3();
    this.clouds.forEach((c, j) => {
      c.visible = j < Math.round(this.w.cover * this.clouds.length);
      const mat = c.userData.mat as THREE.MeshToonMaterial;
      mat.color.copy(this.cloudMat.color); mat.emissive.copy(this.cloudMat.emissive);
      const fl = (c.userData.fl ?? 0) * (Math.sin(this.t * 45 + j) > -0.3 ? 1 : 0.3);
      c.userData.fl = (c.userData.fl ?? 0) * Math.exp(-dt * 6);
      if (fl > 0.02) mat.emissive.lerp(new THREE.Color(1.6, 1.7, 2.2), fl);
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
    // the season as the town lives it (in survival a cold spring stays winter, a cold summer is only a spring-like thaw)
    const look = (p: number) => { const id = game.seasonAt(p); return id === 'summer' && game.seasonName(p) === '回暖' ? 'spring' : id; };
    const s0 = look(sp), s1 = look(Math.floor(sp) + 1.5);
    const sk = THREE.MathUtils.smoothstep(sp - Math.floor(sp), 0.8, 1);
    const L0 = SEASON_LOOK[s0], L1 = SEASON_LOOK[s1];
    const lc = (a: string, b: string) => new THREE.Color(a).lerp(new THREE.Color(b), sk);
    terrain.terrainU.uGrass.value.copy(lc(L0.grass, L1.grass));
    ENV.uLeafA.value.copy(lc(L0.a, L1.a));
    ENV.uLeafB.value.copy(lc(L0.b, L1.b));
    ENV.uLeafC.value.copy(lc(L0.c, L1.c));
    ENV.uLeafCMix.value = L0.cmix + (L1.cmix - L0.cmix) * sk;
    const winter = (s0 === 'winter' ? 1 - sk : 0) + (s1 === 'winter' ? sk : 0);
    // frost also settles on any day cold enough, whatever the season
    const frost = THREE.MathUtils.clamp((1 - game.temp) / 12, 0, 1) * 0.55;
    const snowTarget = Math.max(winter * (0.5 + this.w.snow * 0.45), frost, blz);
    this.snowCover += (snowTarget - this.snowCover) * (1 - Math.exp(-dt * 0.25));
    ENV.uSnow.value = this.snowCover;
    ENV.uWet.value = this.w.wet;
    ENV.uWind.value = 0.5 + this.w.storm * 1.6 + this.w.rain * 0.4 + this.w.snow * 0.3 + blz * 2.5;
    ENV.uGlow.value = Math.min(1, this.night * 1.1 + this.w.storm * 0.35);
    const wu = terrain.waterU;
    wu.uTime.value = this.t;
    wu.uRain.value = this.w.wet;
    wu.uSun.value = (1 - o) * (1 - this.night);
    wu.uNight.value = this.night;
    wu.uIce.value = winter * 0.6;
    // ---- precipitation ----
    this.updateRain(dt, target);
    if (camera) this.toCam.subVectors(camera.position, target).setY(0).multiplyScalar(0.35);
    this.updateSnow(dt, target);
    this.updateSplashes(dt, target, terrain);
  }

  private updateRain(dt: number, target: THREE.Vector3) {
    const n = Math.floor(RAIN_N * Math.min(1, this.w.rain * 0.6 + this.w.storm * 0.4));
    this.rain.geometry.setDrawRange(0, n * 2);
    if (!n) return;
    // storms drive the rain in slanting sheets, with gusts that come and go
    const gust = 1 + 0.35 * Math.sin(this.t * 0.7) * Math.sin(this.t * 1.9);
    const wind = (3 + this.w.storm * 9) * gust, fall = 26 + this.w.storm * 12;
    const len = 0.85 + this.w.storm * 0.5;
    const d = this.drops, pos = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      d[j + 1] -= fall * dt; d[j] += wind * dt;
      if (d[j + 1] < 0) { d[j + 1] = 24 + (d[j + 1] % 24); d[j] = (Math.random() - 0.5) * 56; d[j + 2] = (Math.random() - 0.5) * 56; }
      if (d[j] > 28) d[j] = ((d[j] + 28) % 56) - 28;
      const o = i * 6;
      arr[o] = d[j]; arr[o + 1] = d[j + 1]; arr[o + 2] = d[j + 2];
      arr[o + 3] = d[j] - wind / fall * len; arr[o + 4] = d[j + 1] + len; arr[o + 5] = d[j + 2];
    }
    pos.needsUpdate = true;
    (this.rain.material as THREE.LineBasicMaterial).opacity = (0.55 + this.w.storm * 0.25) * (1 - this.night * 0.5);
    this.rain.position.set(target.x, 0, target.z);
  }
  private updateSnow(dt: number, target: THREE.Vector3) {
    const blz = this.blz;
    const n = Math.floor(SNOW_N * Math.min(1, this.w.snow * 0.5 + blz));
    this.snow.geometry.setDrawRange(0, n);
    const mat = this.snow.material as THREE.ShaderMaterial;
    mat.uniforms.uScale.value = innerHeight * 0.9;
    mat.uniforms.uDim.value = 1 - this.night * 0.55;
    if (n) {
      // flakes drift down gently; in a blizzard the wind tears them sideways in swirling gusts
      const gust = 1 + 0.4 * Math.sin(this.t * 0.5) * Math.sin(this.t * 1.3);
      const wind = (0.3 + this.w.storm * 2 + blz * 9) * gust;
      const f = this.flakes, pos = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        f[j + 1] -= (1.3 + (i % 7) * 0.12) * (1 + blz * 0.8) * dt;
        f[j] += (Math.sin(this.t * 0.9 + i) * 0.4 + wind) * dt;
        f[j + 2] += Math.cos(this.t * (0.7 + blz * 2) + i * 1.3) * (0.3 + blz * 1.5) * dt;
        f[j + 1] += Math.sin(this.t * 3 + i * 0.7) * blz * 0.8 * dt;
        if (f[j + 1] < 0) { f[j + 1] = 14 + (f[j + 1] % 14); f[j] = (Math.random() - 0.5) * 36; f[j + 2] = (Math.random() - 0.5) * 36; }
        if (f[j] > 18) f[j] = ((f[j] + 18) % 36) - 18;
        arr[j] = f[j]; arr[j + 1] = f[j + 1]; arr[j + 2] = f[j + 2];
      }
      pos.needsUpdate = true;
      this.snow.position.set(target.x + this.toCam.x, 0, target.z + this.toCam.z);
    }
    // blowing snow streaks
    const m = Math.floor(DRIFT_N * Math.min(1, blz + this.w.snow * this.w.storm * 0.3));
    this.drift.geometry.setDrawRange(0, m);
    if (!m) return;
    const speed = 7 + blz * 9;
    // after a long pause (hidden tab) spread the streaks out again instead of bunching them at the edge
    const respread = dt > 0.5;
    if (respread) for (let i = 0; i < DRIFT_N; i++) this.resetDrift(i, true);
    const step = respread ? 0 : dt;
    const dr = this.drifts, dp = this.drift.geometry.getAttribute('position') as THREE.BufferAttribute;
    const da = dp.array as Float32Array;
    for (let i = 0; i < m; i++) {
      const j = i * 4;
      dr[j] += speed * (0.7 + (i % 5) * 0.12) * step;
      dr[j + 1] += Math.sin(this.t * 2 + i) * 0.3 * step;
      if (dr[j] > 18 || dr[j + 1] < 0.02) this.resetDrift(i, false);
      const o = i * 3;
      da[o] = dr[j]; da[o + 1] = dr[j + 1]; da[o + 2] = dr[j + 2];
    }
    dp.needsUpdate = true;
    const du = (this.drift.material as THREE.ShaderMaterial).uniforms;
    du.uOp.value = 0.85 * Math.min(1, blz * 1.5 + 0.3) * (1 - this.night * 0.5);
    du.uScale.value = innerHeight; du.uAspect.value = innerWidth / innerHeight;
    this.drift.position.set(target.x + this.toCam.x, 0, target.z + this.toCam.z);
  }
  private resetDrift(i: number, init: boolean) {
    const j = i * 4, d = this.drifts;
    d[j] = init ? (Math.random() - 0.5) * 36 : -18 - Math.random() * 4;
    // most streaks skim the ground, some fly higher
    d[j + 1] = Math.random() < 0.6 ? 0.05 + Math.random() * 0.8 : 0.8 + Math.random() * 8;
    d[j + 2] = (Math.random() - 0.5) * 36;
    d[j + 3] = 0.6 + Math.random() * 1.4;
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
