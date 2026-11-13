import * as THREE from 'three';
import { ENVIRONMENTS } from '../shared/catalog';
import type { EnvironmentSettings, LightingPreset } from '../shared/types';
import { buildProp } from './props';

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

interface LightingConfig {
  ambient: number;
  hemi: number;
  sun: number;
  sunColor: string;
  sunPosition: [number, number, number];
  fill: string;
  fillIntensity: number;
  fogColor?: string;
}

const LIGHTING: Record<LightingPreset, LightingConfig> = {
  studio: { ambient: 0.8, hemi: 0.9, sun: 1.6, sunColor: '#ffffff', sunPosition: [6, 12, 8], fill: '#dfe8ff', fillIntensity: 0.35 },
  day: { ambient: 0.55, hemi: 0.8, sun: 2.3, sunColor: '#fff2d6', sunPosition: [8, 14, 6], fill: '#bcd8ff', fillIntensity: 0.25 },
  goldenHour: { ambient: 0.45, hemi: 0.6, sun: 2.8, sunColor: '#ffcf8a', sunPosition: [-8, 5, 4], fill: '#ffb67a', fillIntensity: 0.2 },
  night: { ambient: 0.22, hemi: 0.35, sun: 0.55, sunColor: '#8fb6ff', sunPosition: [-6, 10, -4], fill: '#5d7bd6', fillIntensity: 0.2 },
  indoor: { ambient: 0.5, hemi: 0.45, sun: 0.8, sunColor: '#ffe2bd', sunPosition: [0, 9, 3], fill: '#ffd9ad', fillIntensity: 0.3 },
  dramatic: { ambient: 0.16, hemi: 0.22, sun: 1.8, sunColor: '#ffd0a0', sunPosition: [5, 8, -7], fill: '#6a7aff', fillIntensity: 0.18 },
};

export interface EnvironmentRuntime {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
}

export function buildEnvironment(scene: THREE.Scene, settings: EnvironmentSettings): EnvironmentRuntime {
  const envDef = ENVIRONMENTS.find((e) => e.id === settings.preset) ?? ENVIRONMENTS[0];
  const group = new THREE.Group();
  group.name = 'environment';
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const skyColor = new THREE.Color(settings.skyColor);
  const horizonColor = new THREE.Color(settings.backgroundColor);
  const fog = new THREE.FogExp2(horizonColor.getHex(), Math.max(0.0005, settings.fogDensity));
  scene.fog = fog;
  scene.background = horizonColor.clone();

  const skyGeo = new THREE.SphereGeometry(160, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: skyColor },
      bottomColor: { value: horizonColor },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vWorld = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorld; void main(){ float h = clamp(vWorld.y * 0.5 + 0.5, 0.0, 1.0); vec3 c = mix(bottomColor, topColor, pow(h, 0.8)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  group.add(sky);
  disposables.push(skyGeo, skyMat);

  const groundGeo = new THREE.PlaneGeometry(320, 320);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(envDef.groundColor),
    roughness: 0.96,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);
  disposables.push(groundGeo, groundMat);

  const lighting = LIGHTING[settings.lighting] ?? LIGHTING.studio;
  const hemi = new THREE.HemisphereLight(settings.skyColor, envDef.groundColor, lighting.hemi);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(lighting.fill, lighting.ambient);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(lighting.sunColor, lighting.sun);
  sun.position.set(...lighting.sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -32;
  sun.shadow.camera.right = 32;
  sun.shadow.camera.top = 32;
  sun.shadow.camera.bottom = -32;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(lighting.fill, lighting.fillIntensity);
  fill.position.set(-8, 6, -10);
  scene.add(fill);

  const rand = mulberry32(envDef.id.length * 7919 + 13);
  const decor = new THREE.Group();
  decor.name = 'decor';
  group.add(decor);

  const addProp = (id: string, x: number, z: number, scale = 1, rotationY = 0) => {
    const prop = buildProp(id);
    if (!prop) return;
    prop.group.position.set(x, 0, z);
    prop.group.scale.setScalar(scale);
    prop.group.rotation.y = rotationY;
    decor.add(prop.group);
  };

  const ringPositions = (count: number, minRadius: number, maxRadius: number) => {
    const result: { x: number; z: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.4;
      const radius = minRadius + rand() * (maxRadius - minRadius);
      result.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
    }
    return result;
  };

  switch (settings.preset) {
    case 'forest': {
      for (const p of ringPositions(26, 14, 42)) addProp(rand() > 0.45 ? 'prop-tree' : 'prop-pine', p.x, p.z, 0.8 + rand() * 0.7, rand() * Math.PI);
      for (const p of ringPositions(10, 6, 16)) {
        if (Math.abs(p.x) < 4 && Math.abs(p.z) < 4) continue;
        addProp('prop-rock', p.x, p.z, 0.5 + rand() * 0.7, rand() * Math.PI);
      }
      break;
    }
    case 'city': {
      for (const p of ringPositions(22, 20, 48)) {
        const h = 6 + rand() * 16;
        const geo = new THREE.BoxGeometry(4 + rand() * 4, h, 4 + rand() * 4);
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.6, 0.06, 0.32 + rand() * 0.22),
          roughness: 0.8,
        });
        const building = new THREE.Mesh(geo, mat);
        building.position.set(p.x, h / 2, p.z);
        building.castShadow = true;
        building.receiveShadow = true;
        decor.add(building);
        disposables.push(geo, mat);
      }
      addProp('prop-lamp', -8, 8, 1, 0);
      addProp('prop-lamp', 8, -6, 1, 0);
      break;
    }
    case 'desert': {
      for (const p of ringPositions(16, 12, 40)) addProp('prop-rock', p.x, p.z, 0.5 + rand() * 1.1, rand() * Math.PI);
      break;
    }
    case 'snow': {
      for (const p of ringPositions(22, 14, 44)) addProp('prop-pine', p.x, p.z, 0.7 + rand() * 0.6, rand() * Math.PI);
      for (const p of ringPositions(8, 8, 24)) addProp('prop-rock', p.x, p.z, 0.4 + rand() * 0.5, rand() * Math.PI);
      break;
    }
    case 'cave': {
      for (const p of ringPositions(18, 10, 30)) addProp('prop-rock', p.x, p.z, 1 + rand() * 2.2, rand() * Math.PI);
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.ConeGeometry(0.5 + rand(), 4 + rand() * 7, 5);
        const mat = new THREE.MeshStandardMaterial({ color: '#4b4453', roughness: 0.95 });
        const spike = new THREE.Mesh(geo, mat);
        const angle = rand() * Math.PI * 2;
        const radius = 16 + rand() * 12;
        spike.position.set(Math.cos(angle) * radius, spike.geometry.boundingSphere?.radius ?? 3, Math.sin(angle) * radius);
        decor.add(spike);
        disposables.push(geo, mat);
      }
      break;
    }
    case 'nightSky': {
      const starGeo = new THREE.BufferGeometry();
      const stars: number[] = [];
      for (let i = 0; i < 1500; i++) {
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(rand() * 0.95);
        const r = 120;
        stars.push(Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(theta) * r);
      }
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
      const starMat = new THREE.PointsMaterial({ color: '#e8f0ff', size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.9 });
      const starPoints = new THREE.Points(starGeo, starMat);
      decor.add(starPoints);
      disposables.push(starGeo, starMat);
      for (const p of ringPositions(12, 18, 40)) addProp('prop-pine', p.x, p.z, 0.7 + rand() * 0.4, rand() * Math.PI);
      break;
    }
    case 'void': {
      for (const p of ringPositions(8, 20, 44)) addProp('prop-rock', p.x, p.z, 0.6 + rand() * 1.2, rand() * Math.PI);
      break;
    }
    case 'studio':
    default:
      break;
  }

  const water = group.getObjectByName('itw-water') as THREE.Mesh | undefined;
  const update = (time: number) => {
    if (water) {
      const mat = water.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.68 + Math.sin(time * 0.8) * 0.04;
      water.position.y += Math.sin(time * 1.2) * 0.0004;
    }
  };

  return {
    group,
    update,
    dispose: () => {
      scene.remove(hemi);
      scene.remove(ambient);
      scene.remove(sun);
      scene.remove(fill);
      for (const item of disposables) item.dispose();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose();
        }
      });
    },
  };
}
