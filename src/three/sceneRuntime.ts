import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { activeFace, activeShot } from '../shared/project';
import { BUILT_IN_CHARACTERS, BUILT_IN_MONSTERS } from '../shared/characters';
import { PARTICLE_PRESETS } from '../shared/catalog';
import type { AnimationId, CameraShot, CharacterDef, FaceId, Project, Scene, SceneObject, ShotKind } from '../shared/types';
import { animateCharacter, buildCharacter, type CharacterRig } from './rig';
import { buildProp } from './props';
import { buildEnvironment, type EnvironmentRuntime } from './environment';
import { createTerrain } from './terrain';
import { ParticleSystem, weatherParticles } from './particles';

export interface RuntimeObject {
  data: SceneObject;
  group: THREE.Group;
  rig: CharacterRig | null;
  particle: ParticleSystem | null;
  mixer: THREE.AnimationMixer | null;
  animatedModel: THREE.Object3D | null;
}

export interface SceneRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  objects: Map<string, RuntimeObject>;
  project: Project;
  sceneData: Scene;
  env: EnvironmentRuntime;
  update: (time: number) => void;
  applyCamera: (time: number, aspect: number) => void;
  frameDefault: (aspect: number) => void;
  focusPoint: (objectId?: string) => THREE.Vector3;
  getGroup: (objectId: string) => THREE.Object3D | null;
  shotAt: (time: number) => CameraShot | null;
  dispose: () => void;
}

function characterFromProject(project: Project, object: SceneObject): CharacterDef | null {
  if (object.character) return object.character;
  const custom = project.customAssets.find((a) => a.id === object.assetId && a.type === 'character' && a.character);
  if (custom?.character) return custom.character;
  return (
    BUILT_IN_CHARACTERS.find((c) => c.id === object.assetId) ??
    BUILT_IN_MONSTERS.find((c) => c.id === object.assetId) ??
    null
  );
}

function withTint(def: CharacterDef, color?: string): CharacterDef {
  if (!color) return def;
  const clone = structuredClone(def);
  for (const part of clone.parts) {
    if (part.kind === 'torso' || part.kind === 'head') part.color = color;
  }
  return clone;
}

const SHOT_DEFAULTS: Record<ShotKind, { distance: number; height: number }> = {
  wide: { distance: 15, height: 5.2 },
  medium: { distance: 9, height: 3.2 },
  close: { distance: 4.6, height: 2.6 },
  orbit: { distance: 11, height: 3.6 },
  low: { distance: 8, height: 0.9 },
  high: { distance: 12, height: 10 },
};

export function buildSceneRuntime(
  project: Project,
  sceneData: Scene,
  options: { showColliders?: boolean } = {},
): SceneRuntime {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 500);
  camera.position.set(11, 8, 16);
  camera.lookAt(0, 2, 0);

  const env = buildEnvironment(scene, sceneData.environment);
  scene.add(env.group);

  let terrainGroup: THREE.Group | null = null;
  if (sceneData.terrain) {
    terrainGroup = createTerrain(sceneData.terrain);
    scene.add(terrainGroup);
  }

  let weather: ParticleSystem | null = null;
  if (sceneData.environment.weather !== 'none') {
    weather = weatherParticles(sceneData.environment.weather);
    scene.add(weather.points);
  }

  const objects = new Map<string, RuntimeObject>();
  const loader = new GLTFLoader();
  const pendingLoads: { cancel: () => void }[] = [];

  for (const data of sceneData.objects) {
    const group = new THREE.Group();
    group.name = data.name;
    group.position.set(...data.transform.position);
    group.rotation.set(
      THREE.MathUtils.degToRad(data.transform.rotation[0]),
      THREE.MathUtils.degToRad(data.transform.rotation[1]),
      THREE.MathUtils.degToRad(data.transform.rotation[2]),
    );
    group.scale.set(...data.transform.scale);
    group.visible = !data.hidden;
    group.userData.objectId = data.id;

    let rig: CharacterRig | null = null;
    let particle: ParticleSystem | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let animatedModel: THREE.Object3D | null = null;

    if (data.kind === 'character' || data.kind === 'monster') {
      const def = characterFromProject(project, data);
      if (def) {
        rig = buildCharacter(withTint(def, data.color), options.showColliders ?? false);
        group.add(rig.group);
        rig.group.userData.objectId = data.id;
        if (data.face) rig.setFace(data.face);
      }
    } else if (data.kind === 'emitter') {
      const config = data.particle ?? PARTICLE_PRESETS.find((p) => `particle-${p.id}` === data.assetId)?.config;
      if (config) {
        particle = new ParticleSystem(config, data.id);
        group.add(particle.points);
      }
    } else if (data.kind === 'imported') {
      const asset = project.customAssets.find((a) => a.id === data.assetId && (a.type === 'model' || a.type === 'texture'));
      if (asset?.file) {
        const url = `itw-asset://${project.id}/${asset.file.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}`;
        let cancelled = false;
        loader.load(
          url,
          (gltf) => {
            if (cancelled) return;
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const targetHeight = 2.4;
            const scale = size.y > 0.001 ? targetHeight / size.y : 1;
            model.scale.setScalar(scale);
            const box2 = new THREE.Box3().setFromObject(model);
            model.position.y = -box2.min.y;
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            group.add(model);
            animatedModel = model;
            if (gltf.animations.length) {
              mixer = new THREE.AnimationMixer(model);
              mixer.clipAction(gltf.animations[0]).play();
            }
          },
          undefined,
          () => {
            // missing or broken import: show a quiet placeholder
          },
        );
        pendingLoads.push({ cancel: () => (cancelled = true) });
      }
    } else {
      const prop = buildProp(data.assetId);
      if (prop) group.add(prop.group);
    }

    scene.add(group);
    objects.set(data.id, { data, group, rig, particle, mixer, animatedModel });
  }

  const focusPoint = (objectId?: string): THREE.Vector3 => {
    if (objectId) {
      const runtime = objects.get(objectId);
      if (runtime) {
        if (runtime.rig) return new THREE.Vector3(0, runtime.rig.height * 0.58, 0).applyMatrix4(runtime.group.matrixWorld);
        const box = new THREE.Box3().setFromObject(runtime.group);
        if (!box.isEmpty()) return box.getCenter(new THREE.Vector3());
        return runtime.group.position.clone();
      }
    }
    const candidates = [...objects.values()].filter((o) => o.data.kind === 'character' || o.data.kind === 'monster');
    if (candidates.length) {
      const avg = new THREE.Vector3();
      for (const c of candidates) avg.add(focusPoint(c.data.id));
      return avg.divideScalar(candidates.length);
    }
    return new THREE.Vector3(0, 2, 0);
  };

  const shotAt = (time: number) => activeShot(sceneData, time);

  const applyShot = (shot: CameraShot, time: number, aspect: number) => {
    camera.aspect = aspect;
    const defaults = SHOT_DEFAULTS[shot.kind] ?? SHOT_DEFAULTS.wide;
    const distance = shot.distance || defaults.distance;
    const height = shot.height || defaults.height;
    const target = focusPoint(shot.targetId);
    if (shot.kind === 'orbit') {
      const angle = THREE.MathUtils.degToRad(shot.angle) + time * 0.35;
      camera.position.set(
        target.x + Math.sin(angle) * distance,
        target.y + height,
        target.z + Math.cos(angle) * distance,
      );
    } else {
      camera.position.set(target.x, target.y + height, target.z + distance);
    }
    const look = target.clone();
    if (shot.kind === 'low') look.y += 1.2;
    if (shot.kind === 'high') look.y -= 0.6;
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  };

  const frameDefault = (aspect: number) => {
    camera.aspect = aspect;
    const target = focusPoint();
    camera.position.set(target.x + 9, Math.max(5, target.y + 4), target.z + 15);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };

  const applyCamera = (time: number, aspect: number) => {
    const shot = shotAt(time);
    if (shot) applyShot(shot, time, aspect);
    else frameDefault(aspect);
  };

  const update = (time: number) => {
    env.update(time);
    weather?.update(time);
    for (const runtime of objects.values()) {
      const { data, rig, particle, mixer } = runtime;
      if (rig) {
        const face = (activeFace(sceneData, data.id, time) as FaceId | null) ?? data.face ?? 'neutral';
        rig.setFace(face);
        const animClip = sceneData.clips
          .filter((c) => c.track === 'animation' && c.targetId === data.id && c.start <= time && c.start + c.duration > time)
          .sort((a, b) => b.start - a.start)[0];
        const anim = (animClip?.animation ?? data.animation ?? 'idle') as AnimationId;
        const localTime = animClip ? Math.max(0, time - animClip.start) : time;
        animateCharacter(rig, anim, localTime);
      }
      if (particle) particle.update(time);
      if (mixer) mixer.update(1 / 60);
    }
    if (terrainGroup) {
      const water = terrainGroup.getObjectByName('itw-water') as THREE.Mesh | undefined;
      if (water) {
        const mat = water.material as THREE.MeshStandardMaterial;
        mat.opacity = 0.62 + Math.sin(time * 0.9) * 0.06;
      }
    }
  };

  return {
    scene,
    camera,
    objects,
    project,
    sceneData,
    env,
    update,
    applyCamera,
    frameDefault,
    focusPoint,
    getGroup: (objectId: string) => objects.get(objectId)?.group ?? null,
    shotAt,
    dispose: () => {
      for (const load of pendingLoads) load.cancel();
      for (const runtime of objects.values()) {
        runtime.rig?.dispose();
        runtime.particle?.dispose();
        runtime.mixer?.stopAllAction();
      }
      weather?.dispose();
      env.dispose();
      if (terrainGroup) {
        terrainGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) m.dispose();
          }
        });
      }
      scene.clear();
    },
  };
}
