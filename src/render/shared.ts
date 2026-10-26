// Uniforms shared by every material in the world, and the toon material used by
// buildings, trees, people and props. Driven each frame by env.ts.
import * as THREE from 'three';
import { ramp } from './toon';

export const ENV = {
  uGlow: { value: 0 },                     // night: windows and lamps light up
  uSnow: { value: 0 },                     // snow cover on upward faces and ground
  uWet: { value: 0 },                      // rain darkens surfaces
  uLeafA: { value: new THREE.Color('#5DB052') },
  uLeafB: { value: new THREE.Color('#77C25F') },
  uLeafC: { value: new THREE.Color('#FFB7CB') },
  uLeafCMix: { value: 0 },                 // share of trees using colour C (blossom, autumn yellow)
  uTime: { value: 0 },
};

/**
 * Toon material reading the baked vertex attributes from assets.ts:
 * glow (lit at night), leaf (seasonal foliage), tint (instance colour applies), plus snow on top faces.
 */
export function worldMaterial(extra: THREE.MeshToonMaterialParameters = {}) {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp, vertexColors: true, ...extra });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, ENV);
    sh.vertexShader = `
attribute float glow;
attribute float leaf;
attribute float tint;
uniform vec3 uLeafA, uLeafB, uLeafC;
uniform float uLeafCMix;
varying float vGlow;
varying float vUp;
` + sh.vertexShader
      .replace('#include <color_vertex>', `
#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
  vColor = vec3( 1.0 );
  #ifdef USE_COLOR
    vColor = color.rgb;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vColor = mix( vColor, vColor * instanceColor.rgb, tint );
  #endif
  vec3 iPos = modelMatrix[3].xyz;
  #ifdef USE_INSTANCING
    iPos += instanceMatrix[3].xyz;
  #endif
  float rnd = fract( sin( dot( iPos.xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  vec3 seasonal = rnd < uLeafCMix ? uLeafC : mix( uLeafA, uLeafB, fract( rnd * 7.13 ) );
  float shade = 0.82 + 0.36 * clamp( dot( color.rgb, vec3( 0.3, 0.59, 0.11 ) ) * 2.2, 0.0, 1.0 );
  vColor = mix( vColor, seasonal * shade, leaf );
#endif
vGlow = glow;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
  vec3 upN = objectNormal;
  #ifdef USE_INSTANCING
    upN = mat3( instanceMatrix ) * upN;
  #endif
  vUp = normalize( mat3( modelMatrix ) * upN ).y;`);
    sh.fragmentShader = `
uniform float uGlow, uSnow, uWet;
varying float vGlow;
varying float vUp;
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.95, 0.97, 1.0 ), uSnow * smoothstep( 0.45, 0.8, vUp ) * ( 1.0 - vGlow ) );
  diffuseColor.rgb *= 1.0 - uWet * 0.12 * step( 0.4, vUp );`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  // night lights: a warm glow, softer on big upward panes (glass roofs) so they do not blind
  totalEmissiveRadiance += vGlow * uGlow * vec3( 1.0, 0.78, 0.42 ) * 0.8 * ( 1.0 - 0.7 * smoothstep( 0.45, 0.85, vUp ) );`);
  };
  return m;
}
