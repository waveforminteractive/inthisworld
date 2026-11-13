import * as THREE from 'three';
import type { ParticleConfig } from '../shared/types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const vertexShader = `
uniform float uTime;
uniform float uLife;
uniform float uSpeed;
uniform float uSpread;
uniform float uGravity;
uniform float uTurb;
uniform float uEndScale;
attribute vec3 aOffset;
attribute vec3 aVelocity;
attribute float aPhase;
attribute float aSize;
varying float vAlpha;
varying vec3 vColor;
uniform vec3 uColorA;
uniform vec3 uColorB;
void main() {
  float age = mod(uTime + aPhase * uLife, uLife);
  float t = age / uLife;
  vec3 pos = aOffset + aVelocity * age * uSpeed;
  pos.y += 0.5 * uGravity * age * age;
  pos.x += sin(uTime * 1.7 + aPhase * 23.0) * uTurb * 0.35 * age;
  pos.z += cos(uTime * 1.3 + aPhase * 17.0) * uTurb * 0.35 * age;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * mix(1.0, uEndScale, t) * (320.0 / max(0.5, -mv.z));
  vAlpha = (1.0 - t) * 0.98;
  vColor = mix(uColorA, uColorB, t);
}
`;

const fragmentShader = `
varying float vAlpha;
varying vec3 vColor;
uniform float uOpacity;
void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.08, d) * vAlpha * uOpacity;
  gl_FragColor = vec4(vColor, a);
}
`;

export interface ParticleSystemOptions {
  weather?: boolean;
  fallHeight?: number;
}

export class ParticleSystem {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private config: ParticleConfig;

  constructor(config: ParticleConfig, seedText: string, options: ParticleSystemOptions = {}) {
    this.config = config;
    const rand = mulberry32(hashSeed(seedText + config.preset));
    const count = Math.max(12, Math.min(2600, Math.round(config.rate * config.lifetime)));
    const offsets = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const isRain = config.preset === 'rain';
    const isSnow = config.preset === 'snow';
    const isExplosion = config.preset === 'explosion';
    const isLeaves = config.preset === 'leaves';
    const fallHeight = options.fallHeight ?? (isRain ? 14 : isSnow ? 12 : 10);
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      let z: number;
      if (options.weather) {
        x = (rand() - 0.5) * (isRain ? 30 : 26);
        y = fallHeight;
        z = (rand() - 0.5) * (isRain ? 24 : 22);
      } else if (isRain || isSnow) {
        x = (rand() - 0.5) * 26;
        y = rand() * 12;
        z = (rand() - 0.5) * 22;
      } else {
        x = (rand() - 0.5) * 0.7;
        y = (rand() - 0.5) * 0.35 + 0.15;
        z = (rand() - 0.5) * 0.7;
      }
      offsets[i * 3] = x;
      offsets[i * 3 + 1] = y;
      offsets[i * 3 + 2] = z;
      if (options.weather) {
        const drift = isRain ? 0.15 : isLeaves ? 0.8 : 0.3;
        velocities[i * 3] = (rand() - 0.5) * drift;
        velocities[i * 3 + 1] = -((fallHeight + 1.5) / Math.max(0.5, config.lifetime)) * (0.97 + rand() * 0.06);
        velocities[i * 3 + 2] = (rand() - 0.5) * drift;
      } else if (isRain) {
        velocities[i * 3] = (rand() - 0.5) * 0.6;
        velocities[i * 3 + 1] = -1.4 - rand() * 0.4;
        velocities[i * 3 + 2] = (rand() - 0.5) * 0.3;
      } else if (isSnow) {
        velocities[i * 3] = (rand() - 0.5) * 0.4;
        velocities[i * 3 + 1] = -0.25 - rand() * 0.3;
        velocities[i * 3 + 2] = (rand() - 0.5) * 0.4;
      } else if (isExplosion) {
        const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 1.2, rand() * 2 - 1).normalize();
        velocities[i * 3] = dir.x;
        velocities[i * 3 + 1] = Math.abs(dir.y) + 0.3;
        velocities[i * 3 + 2] = dir.z;
      } else if (isLeaves) {
        velocities[i * 3] = (rand() - 0.5) * 1.2;
        velocities[i * 3 + 1] = -0.2 - rand() * 0.4;
        velocities[i * 3 + 2] = (rand() - 0.5) * 1.2;
      } else {
        velocities[i * 3] = (rand() - 0.5) * 1.4 * config.spread;
        velocities[i * 3 + 1] = 0.75 + rand() * 0.7;
        velocities[i * 3 + 2] = (rand() - 0.5) * 1.4 * config.spread;
      }
      phases[i] = rand();
      sizes[i] = config.startSize * (0.55 + rand() * 0.9);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 30);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLife: { value: config.lifetime },
        uSpeed: { value: config.speed },
        uSpread: { value: config.spread },
        uGravity: { value: config.gravity },
        uTurb: { value: config.turbulence },
        uEndScale: { value: Math.max(0.02, config.endSize / Math.max(0.01, config.startSize)) },
        uOpacity: { value: config.opacity },
        uColorA: { value: new THREE.Color(config.color) },
        uColorB: { value: new THREE.Color(config.colorEnd) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: config.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.userData.particlePreset = config.preset;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  setIntensity(scale: number): void {
    this.material.uniforms.uOpacity.value = this.config.opacity * Math.max(0, scale);
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

export function weatherParticles(kind: 'rain' | 'snow' | 'leaves'): ParticleSystem {
  const base: ParticleConfig = {
    preset: kind,
    rate: kind === 'rain' ? 320 : kind === 'snow' ? 160 : 60,
    lifetime: kind === 'rain' ? 4.5 : kind === 'snow' ? 12 : 9,
    startSize: kind === 'rain' ? 0.06 : kind === 'snow' ? 0.16 : 0.22,
    endSize: kind === 'rain' ? 0.05 : kind === 'snow' ? 0.14 : 0.2,
    speed: 1,
    spread: 1,
    gravity: 0,
    turbulence: kind === 'rain' ? 0 : 0.8,
    color: kind === 'rain' ? '#a9c9e8' : kind === 'snow' ? '#ffffff' : '#e08a3c',
    colorEnd: kind === 'rain' ? '#6f94b8' : kind === 'snow' ? '#cfe0f0' : '#9c4a1e',
    opacity: kind === 'rain' ? 0.4 : 0.85,
    additive: false,
    worldSpace: true,
  };
  const system = new ParticleSystem(base, `weather-${kind}`, { weather: true });
  return system;
}
