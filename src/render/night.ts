// Night atmosphere: warm pools of light under street lamps and around lit houses, a handful of
// real point lights on the lamps nearest the camera (so walls and roofs catch the glow), and
// fireflies drifting over meadows and woods on warm nights.
import * as THREE from 'three';
import type { Game } from '../sim/game';
import { Tile } from '../sim/world';
import type { Terrain } from './terrain';
import { ENV } from './shared';
import { getModel } from './assets';

const LIGHTS = 8;
const FLIES = 2400;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Night {
  group = new THREE.Group();
  private pools: THREE.InstancedMesh;
  private poolMat: THREE.MeshBasicMaterial;
  private lights: THREE.PointLight[] = [];
  private lampPos: THREE.Vector3[] = [];
  private halos: THREE.Points;
  private haloU = { uAmt: { value: 0 }, uScale: { value: 1 } };
  private flies: THREE.Points;
  private flyU = { uTime: ENV.uTime, uAmt: { value: 0 }, uScale: { value: 1 } };
  private pickT = 0;

  constructor(game: Game, private terrain: Terrain, half: number) {
    const tex = glowTexture();
    this.poolMat = new THREE.MeshBasicMaterial({
      map: tex, color: new THREE.Color('#FF9E3D'), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, fog: true,
    });
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.poolMat, 1200);
    this.pools.frustumCulled = false;
    this.pools.count = 0;
    this.pools.renderOrder = 2;
    this.group.add(this.pools);
    // every lamp head gets the same soft halo, so all lamps look lit (the point lights only add light on walls)
    this.halos = new THREE.Points(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      uniforms: { ...this.haloU, uMap: { value: tex } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
uniform float uScale;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uScale * 40.0 * (20.0 / -mv.z);
}`,
      fragmentShader: /* glsl */`
uniform sampler2D uMap;
uniform float uAmt;
void main(){
  float a = texture2D(uMap, gl_PointCoord).a * uAmt;
  gl_FragColor = vec4(vec3(1.0, 0.72, 0.4) * a, a);
}`,
    }));
    this.halos.frustumCulled = false;
    this.group.add(this.halos);
    for (let i = 0; i < LIGHTS; i++) {
      const l = new THREE.PointLight('#FFB25E', 0, 4.5, 1.6);
      this.lights.push(l);
      this.group.add(l);
    }
    // fireflies over grass and woods; each has a home spot it wanders around
    const W = game.W, pos: number[] = [], seed: number[] = [];
    let tries = 0;
    while (pos.length < FLIES * 3 && tries++ < FLIES * 30) {
      const x = Math.floor(Math.random() * W), z = Math.floor(Math.random() * W);
      const t = game.world.tile(x, z);
      if (t !== Tile.Grass) continue;
      if (!game.world.trees[z * W + x] && Math.random() < 0.6) continue;
      const wx = x + Math.random() - half, wz = z + Math.random() - half;
      pos.push(wx, terrain.height(wx, wz) + 0.25 + Math.random() * 0.7, wz);
      seed.push(Math.random() * 100);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
    this.flies = new THREE.Points(fg, new THREE.ShaderMaterial({
      uniforms: { ...this.flyU, uMap: { value: tex } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
attribute float seed;
uniform float uTime, uAmt, uScale;
varying float vA;
void main(){
  float t = uTime * 0.35 + seed;
  vec3 p = position + vec3(sin(t * 1.3) * 0.6 + sin(t * 2.9) * 0.2, sin(t * 1.7) * 0.25, cos(t * 1.1) * 0.6);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float blink = smoothstep(0.2, 0.9, sin(uTime * (1.2 + fract(seed) * 1.5) + seed * 7.0));
  vA = blink * uAmt;
  gl_PointSize = uScale * (5.0 + 3.0 * blink) * (40.0 / -mv.z);
}`,
      fragmentShader: /* glsl */`
uniform sampler2D uMap;
varying float vA;
void main(){
  float a = texture2D(uMap, gl_PointCoord).a * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(1.0, 0.95, 0.55) * 2.2 * a, a);
}`,
    }));
    this.flies.frustumCulled = false;
    this.group.add(this.flies);
    this.group.userData.world = true;
  }

  /** street lamps and lit houses moved: rebuild the light pools */
  sync(lamps: THREE.InstancedMesh, houses: { x: number; z: number; r: number }[]) {
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    this.lampPos = [];
    const top = getModel('lamp').height - 0.08, hp: number[] = [];
    let n = 0;
    for (let i = 0; i < lamps.count && n < 1200; i++) {
      lamps.getMatrixAt(i, M);
      P.setFromMatrixPosition(M);
      this.lampPos.push(P.clone());
      hp.push(P.x, P.y + top, P.z);
      M.compose(P.setY(P.y + 0.04), Q, S.set(2.6, 1, 2.6));
      this.pools.setMatrixAt(n++, M);
    }
    for (const h of houses) {
      if (n >= 1200) break;
      M.compose(P.set(h.x, this.terrain.height(h.x, h.z) + 0.05, h.z), Q, S.set(h.r, 1, h.r));
      this.pools.setMatrixAt(n++, M);
    }
    this.halos.geometry.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    this.pools.count = n;
    this.pools.instanceMatrix.needsUpdate = true;
    this.pickT = 0;
  }

  update(dt: number, glow: number, night: number, target: THREE.Vector3, warm: number, rain: number, highQuality: boolean) {
    this.poolMat.opacity = glow * 0.55;
    this.pools.visible = glow > 0.02;
    // the point lights follow the lamps closest to the middle of the screen; a light only moves
    // after fading out, and lamps that stay near keep their light, so nothing blinks while panning
    this.pickT -= dt;
    if (this.pickT <= 0) {
      this.pickT = 0.4;
      const want = new Set(this.lampPos
        .map(p => ({ p, d: (p.x - target.x) ** 2 + (p.z - target.z) ** 2 }))
        .sort((a, b) => a.d - b.d).slice(0, LIGHTS).map(e => e.p));
      for (const l of this.lights) {
        if (l.userData.lamp && want.has(l.userData.lamp)) want.delete(l.userData.lamp);
        else l.userData.lamp = null;
      }
      const free = [...want];
      for (const l of this.lights) l.userData.next = l.userData.lamp ? null : free.shift() ?? null;
    }
    const k = 1 - Math.exp(-dt * 4);
    for (const l of this.lights) {
      const u = l.userData;
      u.level = u.level ?? 0;
      if (!u.lamp && u.next && u.level < 0.02) {
        u.lamp = u.next; u.next = null;
        l.position.set(u.lamp.x, u.lamp.y + 0.9, u.lamp.z);
      }
      u.level += ((u.lamp && highQuality ? 1 : 0) - u.level) * k;
      l.intensity = u.level * glow * 2.2;
    }
    this.haloU.uAmt.value = glow * 0.9;
    this.haloU.uScale.value = Math.min(2, devicePixelRatio || 1);
    this.halos.visible = glow > 0.02;
    // fireflies: warm, dry nights, not in winter
    this.flyU.uAmt.value = Math.max(0, night - 0.35) / 0.65 * warm * (1 - rain);
    this.flyU.uScale.value = Math.min(2, devicePixelRatio || 1);
    this.flies.visible = this.flyU.uAmt.value > 0.01;
  }
}
