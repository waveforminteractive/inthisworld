import * as THREE from 'three';
import type { TerrainConfig } from '../shared/types';

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

function hash2(x: number, z: number, seed: number): number {
  const h = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const v00 = hash2(xi, zi, seed);
  const v10 = hash2(xi + 1, zi, seed);
  const v01 = hash2(xi, zi + 1, seed);
  const v11 = hash2(xi + 1, zi + 1, seed);
  const u = smooth(xf);
  const v = smooth(zf);
  return (v00 * (1 - u) + v10 * u) * (1 - v) + (v01 * (1 - u) + v11 * u) * v;
}

function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * frequency, z * frequency, seed + i * 19) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.05;
  }
  return value / total;
}

export function terrainHeightAt(config: TerrainConfig, x: number, z: number): number {
  const half = config.size / 2;
  const nx = x / half;
  const nz = z / half;
  const seed = config.seed;
  const amp = config.amplitude;
  let h = 0;
  switch (config.type) {
    case 'flat':
      h = fbm(nx * 2, nz * 2, seed, 2) * amp * 0.12;
      break;
    case 'mountains': {
      const ridge = 1 - Math.abs(fbm(nx * 2.6, nz * 2.6, seed, 5) * 2 - 1);
      h = ridge * ridge * amp * 1.35;
      break;
    }
    case 'islands': {
      const dist = Math.sqrt(nx * nx + nz * nz);
      const falloff = Math.max(0, 1 - dist * 1.25);
      h = fbm(nx * 3, nz * 3, seed, 4) * amp * falloff * 1.4 - amp * 0.15;
      break;
    }
    case 'canyon': {
      const channel = Math.abs(nx);
      const carve = Math.min(1, channel * 3.2);
      h = fbm(nx * 3.5, nz * 1.2, seed, 4) * amp * (0.25 + carve * 0.85);
      break;
    }
    case 'random': {
      const choice = Math.floor(hash2(0, 0, seed) * 3);
      if (choice === 0) return terrainHeightAt({ ...config, type: 'mountains' }, x, z);
      if (choice === 1) return terrainHeightAt({ ...config, type: 'hills' }, x, z);
      return terrainHeightAt({ ...config, type: 'canyon' }, x, z);
    }
    case 'hills':
    default:
      h = fbm(nx * 2.2, nz * 2.2, seed, 4) * amp;
      break;
  }
  return h;
}

export function createTerrain(config: TerrainConfig): THREE.Group {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(config.size, config.size, config.segments, config.segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const grass = new THREE.Color(config.grassColor);
  const rock = new THREE.Color(config.rockColor);
  const sand = new THREE.Color(config.sandColor);
  const snow = new THREE.Color(config.snowColor);
  let maxH = 0.01;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const h = terrainHeightAt(config, x, z);
    maxH = Math.max(maxH, h);
    position.setY(i, h);
  }
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const h = position.getY(i);
    const slopeSample = Math.abs(terrainHeightAt(config, x + 0.6, z) - terrainHeightAt(config, x - 0.6, z));
    const t = h / maxH;
    const color = grass.clone();
    if (slopeSample > config.amplitude * 0.08) color.lerp(rock, 0.7);
    else if (t > 0.72) color.lerp(snow, Math.min(1, (t - 0.72) * 3));
    else if (config.waterLevel !== null && h < config.waterLevel + 0.15) color.lerp(sand, 0.65);
    else color.lerp(rock, Math.max(0, t - 0.4) * 0.55);
    color.offsetHSL(0, 0, (hash2(x, z, config.seed + 33) - 0.5) * 0.05);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);

  if (config.waterLevel !== null) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(config.size * 1.4, config.size * 1.4, 1, 1),
      new THREE.MeshStandardMaterial({
        color: '#3a7ea8',
        transparent: true,
        opacity: 0.72,
        roughness: 0.18,
        metalness: 0.35,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = config.waterLevel;
    water.receiveShadow = true;
    water.name = 'itw-water';
    group.add(water);
  }
  group.userData.terrain = config;
  return group;
}

export function defaultTerrain(seed = 42): TerrainConfig {
  return {
    seed,
    size: 60,
    segments: 96,
    amplitude: 4.2,
    type: 'hills',
    waterLevel: null,
    grassColor: '#5c8a45',
    rockColor: '#6f6b63',
    sandColor: '#c8b082',
    snowColor: '#eef3f8',
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

export function scatterPositions(config: TerrainConfig, count: number, seedOffset = 7): { x: number; y: number; z: number }[] {
  const rand = mulberry32(config.seed + seedOffset);
  const positions: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rand() - 0.5) * config.size * 0.8;
    const z = (rand() - 0.5) * config.size * 0.8;
    const y = terrainHeightAt(config, x, z);
    if (config.waterLevel !== null && y < config.waterLevel + 0.05) continue;
    positions.push({ x, y, z });
  }
  return positions;
}
