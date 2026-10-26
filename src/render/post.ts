// Screen effects that give the picture its soft "miniature diorama" look:
// ambient occlusion in creases and under eaves, a gentle glow, tilt-shift blur at the top and
// bottom of the screen, and a colour grade (cool shadows, warm light, pastel lift, vignette).
// Quality 'low' skips all of it and renders straight to the screen.
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, TiltShiftEffect, Effect, KernelSize, SMAAEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

export type Quality = 'high' | 'low';

const GRADE = /* glsl */`
uniform vec3 uShadow;
uniform vec3 uLight;
uniform float uSat;
uniform float uLift;
uniform float uVig;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // split toning: shadows lean cool, light leans warm
  c = mix(c, c * uShadow, (1.0 - smoothstep(0.0, 0.45, l)) * 0.6);
  c = mix(c, c * uLight, smoothstep(0.35, 1.0, l) * 0.5);
  c = mix(vec3(l), c, uSat);
  // pastel: lift the darkest tones a touch toward the shadow colour
  c = c * (1.0 - uLift) + uShadow * uLift * 0.35;
  // soft vignette
  vec2 d = uv - 0.5;
  c *= 1.0 - uVig * smoothstep(0.35, 0.85, length(d * vec2(1.1, 1.0)));
  outputColor = vec4(c, inputColor.a);
}`;

class GradeEffect extends Effect {
  constructor() {
    super('Grade', GRADE, {
      uniforms: new Map<string, THREE.Uniform>([
        ['uShadow', new THREE.Uniform(new THREE.Color(0.78, 0.84, 1.05))],
        ['uLight', new THREE.Uniform(new THREE.Color(1.06, 1.0, 0.9))],
        ['uSat', new THREE.Uniform(1.0)],
        ['uLift', new THREE.Uniform(0.04)],
        ['uVig', new THREE.Uniform(0.22)],
      ]),
    });
  }
  u(name: string) { return this.uniforms.get(name)!; }
}

export class Post {
  quality: Quality = 'high';
  aoOn = true;
  tiltOn = true;
  private composer: EffectComposer;
  private ao: any;
  private bloom: BloomEffect;
  private tilt: TiltShiftEffect;
  private grade: GradeEffect;
  private dayShadow = new THREE.Color(0.8, 0.86, 1.04);
  private nightShadow = new THREE.Color(0.72, 0.8, 1.08);
  private dayLight = new THREE.Color(1.07, 1.0, 0.9);
  private nightLight = new THREE.Color(1.12, 0.96, 0.8);

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));
    const ao = new N8AOPostPass(scene, camera, innerWidth, innerHeight);
    Object.assign(ao.configuration, {
      aoRadius: 2.4, distanceFalloff: 1.0, intensity: 3.5, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 8,
      halfRes: true, depthAwareUpsampling: true, gammaCorrection: false, color: new THREE.Color('#2a2440'),
    });
    this.ao = ao;
    this.composer.addPass(ao);
    this.bloom = new BloomEffect({ luminanceThreshold: 0.82, luminanceSmoothing: 0.25, intensity: 0.35, mipmapBlur: true, radius: 0.7 });
    this.tilt = new TiltShiftEffect({ focusArea: 0.42, feather: 0.32, offset: 0.04, kernelSize: KernelSize.VERY_SMALL });
    this.grade = new GradeEffect();
    this.composer.addPass(new EffectPass(camera, new SMAAEffect(), this.bloom, this.tilt));
    this.composer.addPass(new EffectPass(camera, this.grade));
    addEventListener('resize', () => this.composer.setSize(innerWidth, innerHeight));
  }

  setQuality(q: Quality) { this.quality = q; }
  /** after the renderer's pixel ratio changes */
  resize() { this.composer.setSize(innerWidth, innerHeight); }

  /**
   * @param glow   0..1 how much the night lights are on
   * @param night  0..1 night amount
   * @param dist   camera distance (more blur when zoomed in close, like a macro lens)
   */
  render(dt: number, glow: number, night: number, dist: number) {
    if (this.quality === 'low') { this.renderer.render(this.scene, this.camera); return; }
    this.bloom.intensity = 0.2 + glow * 0.45;
    this.bloom.luminanceMaterial.threshold = THREE.MathUtils.lerp(0.95, 0.72, glow);
    // closer = shallower depth of field; wide views keep only a hint of it
    const z = THREE.MathUtils.clamp((dist - 8) / 40, 0, 1);
    this.tilt.focusArea = THREE.MathUtils.lerp(0.95, 1.1, z);
    this.tilt.feather = THREE.MathUtils.lerp(0.4, 0.3, z);
    this.grade.u('uShadow').value.copy(this.dayShadow).lerp(this.nightShadow, night);
    this.grade.u('uLight').value.copy(this.dayLight).lerp(this.nightLight, night);
    this.grade.u('uSat').value = 0.93;
    this.grade.u('uLift').value = THREE.MathUtils.lerp(0.04, 0.0, night);
    this.grade.u('uVig').value = THREE.MathUtils.lerp(0.2, 0.38, night);
    this.ao.configuration.intensity = THREE.MathUtils.lerp(3.5, 2.0, night);
    this.ao.enabled = this.aoOn;
    this.tilt.blendMode.opacity.value = this.tiltOn ? 1 : 0;
    this.composer.render(dt);
  }
}
