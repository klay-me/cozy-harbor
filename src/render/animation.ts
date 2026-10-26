// Shared model animation rules. Keep game and gallery motion identical.
import type * as THREE from 'three';
import type { AnimKind } from './assets';

export interface AnimatedPart { o: THREE.Object3D; kind: AnimKind; name: string; t: number; amp: number }
export interface AnimationContext {
  gdt: number; wind: number; bellOn: boolean; fireOn: boolean;
  working: boolean; depot: boolean; time: number; id: number;
}

export function animatePart(p: AnimatedPart, context: AnimationContext) {
  const { gdt, wind, bellOn, fireOn, working, depot, time, id } = context;
  const o = p.o, work = working && gdt > 0;
  switch (p.kind) {
    case 'spinZ': case 'spinX': {
      if (!work) return;
      const sp = p.name === 'saw' ? 7 : p.name === 'rotor' ? 2.6 : p.name === 'sails' ? 1.1 * wind + 0.4 : p.name === 'gear' ? 0.8 : 1.4;
      if (p.kind === 'spinZ') o.rotation.z -= gdt * sp; else o.rotation.x -= gdt * sp;
      return;
    }
    case 'spinY': {
      if (p.name === 'crane') {
        // slews back and forth between ship and quay, pausing at each end
        if (work || depot) p.t += gdt * 0.35;
        const c = Math.sin(p.t);
        o.rotation.y = 1.25 * Math.sign(c) * Math.pow(Math.abs(c), 0.6);
      } else if (p.name === 'dome') o.rotation.y += gdt * (work ? 0.12 : 0);
      else if (p.name === 'dish') { p.t += gdt * (work ? 0.4 : 0); o.rotation.y = Math.sin(p.t) * 1.4; }
      else if (work) o.rotation.y += gdt * 4;
      return;
    }
    case 'swingX': case 'swingZ': {
      let a = 0;
      if (p.name === 'axe' || p.name === 'hammer') {
        // a quick strike, then lift again
        if (work) p.t += gdt * (p.name === 'hammer' ? 1.6 : 1.1);
        const f = p.t % 1;
        a = (p.name === 'hammer' ? -1 : 1) * (f < 0.75 ? Math.sin(f / 0.75 * Math.PI * 0.5) : 1 - (f - 0.75) / 0.25) * (p.name === 'hammer' ? 1.0 : 1.3);
        if (!work) a = 0;
      } else if (p.name === 'bell' || p.name === 'firebell') {
        const on = p.name === 'bell' ? bellOn : fireOn;
        p.amp += ((on ? 0.7 : 0) - p.amp) * Math.min(1, gdt * 1.5);
        p.t += gdt * (p.name === 'firebell' ? 7 : 3.2);
        a = Math.sin(p.t) * p.amp;
      } else {
        // signs and washing on the line move with the wind
        p.t += Math.max(gdt, 0.016) * (1.6 + wind);
        a = Math.sin(p.t) * 0.07 * wind + Math.sin(p.t * 2.7) * 0.025 * wind;
      }
      if (p.kind === 'swingX') o.rotation.x = a; else o.rotation.z = a;
      return;
    }
    case 'flag':
      p.t += 0.016 * (1.5 + wind * 1.5);
      o.rotation.y = 0.25 * Math.sin(p.t * 2.1) * Math.min(1.5, wind) + 0.12 * Math.sin(p.t * 5.3);
      o.rotation.x = 0.06 * Math.sin(p.t * 3.1);
      return;
    case 'bob':
      o.position.y = o.userData.base + Math.sin(time * 1.8 + id) * 0.03;
      o.rotation.z = Math.sin(time * 1.3 + id) * 0.06;
      return;
  }
}
