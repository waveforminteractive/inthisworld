import * as THREE from 'three';
import type { AnimationId, CharacterDef, CharacterPart, FaceId } from '../shared/types';

const faceCache = new Map<FaceId, THREE.CanvasTexture>();

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createFaceTexture(face: FaceId): THREE.CanvasTexture {
  const cached = faceCache.get(face);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#221c17';
  ctx.strokeStyle = '#221c17';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const eyeY = 96;
  const leftX = 78;
  const rightX = 178;
  const eyeW = 30;
  const eyeH = 38;

  const eye = (x: number, w = eyeW, h = eyeH, y = eyeY) => {
    roundedRect(ctx, x - w / 2, y - h / 2, w, h, Math.min(w, h) / 2);
    ctx.fill();
  };
  const happyEye = (x: number) => {
    ctx.beginPath();
    ctx.arc(x, eyeY + 4, 20, Math.PI * 1.15, Math.PI * 1.85);
    ctx.lineWidth = 12;
    ctx.stroke();
  };
  const sadMouth = (y: number, curve = 26) => {
    ctx.beginPath();
    ctx.arc(128, y + curve, 34, Math.PI * 1.15, Math.PI * 1.85);
    ctx.lineWidth = 10;
    ctx.stroke();
  };
  const smile = (y: number, curve = 26) => {
    ctx.beginPath();
    ctx.arc(128, y - curve, 34, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineWidth = 10;
    ctx.stroke();
  };
  const flatMouth = (y: number, w = 54) => {
    roundedRect(ctx, 128 - w / 2, y, w, 9, 4.5);
    ctx.fill();
  };

  switch (face) {
    case 'happy':
      happyEye(leftX);
      happyEye(rightX);
      smile(178, 24);
      break;
    case 'sad':
      eye(leftX, 26, 30);
      eye(rightX, 26, 30);
      sadMouth(186, 30);
      break;
    case 'angry':
      ctx.save();
      ctx.translate(leftX, eyeY);
      ctx.rotate(0.25);
      eye(0, 34, 22);
      ctx.restore();
      ctx.save();
      ctx.translate(rightX, eyeY);
      ctx.rotate(-0.25);
      eye(0, 34, 22);
      ctx.restore();
      sadMouth(196, 20);
      break;
    case 'surprised':
      roundedRect(ctx, leftX - 21, eyeY - 26, 42, 52, 20);
      ctx.fill();
      roundedRect(ctx, rightX - 21, eyeY - 26, 42, 52, 20);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(128, 192, 22, 28, 0, 0, Math.PI * 2);
      ctx.lineWidth = 9;
      ctx.stroke();
      break;
    case 'scared':
      eye(leftX, 34, 46);
      eye(rightX, 34, 46);
      ctx.beginPath();
      ctx.ellipse(128, 194, 26, 20, 0, 0, Math.PI * 2);
      ctx.lineWidth = 9;
      ctx.stroke();
      break;
    case 'smug':
      ctx.save();
      ctx.translate(leftX, eyeY);
      ctx.rotate(-0.12);
      eye(0, 36, 18);
      ctx.restore();
      ctx.save();
      ctx.translate(rightX, eyeY);
      ctx.rotate(-0.12);
      eye(0, 36, 18);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(98, 190);
      ctx.quadraticCurveTo(140, 208, 166, 180);
      ctx.lineWidth = 9;
      ctx.stroke();
      break;
    case 'wink':
      eye(leftX, 26, 34);
      happyEye(rightX);
      smile(180, 22);
      break;
    case 'determined':
      ctx.save();
      ctx.translate(leftX, eyeY);
      ctx.rotate(0.12);
      eye(0, 34, 28);
      ctx.restore();
      ctx.save();
      ctx.translate(rightX, eyeY);
      ctx.rotate(-0.12);
      eye(0, 34, 28);
      ctx.restore();
      flatMouth(186, 64);
      break;
    case 'blank':
      break;
    case 'neutral':
    default:
      eye(leftX, 26, 38);
      eye(rightX, 26, 38);
      flatMouth(186, 50);
      break;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  faceCache.set(face, texture);
  return texture;
}

export interface CharacterRig {
  group: THREE.Group;
  def: CharacterDef;
  headPivot: THREE.Group | null;
  armL: THREE.Group | null;
  armR: THREE.Group | null;
  legL: THREE.Group | null;
  legR: THREE.Group | null;
  torsoPivot: THREE.Group | null;
  faceMesh: THREE.Mesh | null;
  colliderMeshes: THREE.Object3D[];
  setFace: (face: FaceId) => void;
  height: number;
  dispose: () => void;
}

function materialFor(part: CharacterPart): THREE.MeshStandardMaterial {
  const base = new THREE.MeshStandardMaterial({
    color: new THREE.Color(part.color),
    roughness: part.material === 'matte' ? 0.92 : part.material === 'metal' ? 0.32 : 0.52,
    metalness: part.material === 'metal' ? 0.75 : 0.04,
  });
  if (part.material === 'glow') {
    base.emissive = new THREE.Color(part.color);
    base.emissiveIntensity = 1.6;
    base.roughness = 0.3;
  }
  return base;
}

export function buildCharacter(def: CharacterDef, showColliders = false): CharacterRig {
  const group = new THREE.Group();
  group.userData.characterId = def.id;
  const meshByPart = new Map<string, THREE.Mesh>();
  const headPart = def.parts.find((p) => p.kind === 'head');
  const headPivot = new THREE.Group();
  if (headPart) {
    headPivot.position.set(
      headPart.offset[0],
      headPart.offset[1] - headPart.size[1] / 2,
      headPart.offset[2],
    );
    group.add(headPivot);
  }
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  const torsoPivot = new THREE.Group();
  group.add(torsoPivot);
  const limbPivots: Record<string, THREE.Group> = {
    armL,
    armR,
    legL,
    legR,
  };
  let height = 0;
  const maxY = def.parts.reduce((max, part) => Math.max(max, part.offset[1] + part.size[1] / 2), 0);
  height = maxY;

  const addMesh = (part: CharacterPart, parent: THREE.Object3D, position: THREE.Vector3) => {
    const geometry = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
    const material = materialFor(part);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(part.rotation[0]),
      THREE.MathUtils.degToRad(part.rotation[1]),
      THREE.MathUtils.degToRad(part.rotation[2]),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.partId = part.id;
    parent.add(mesh);
    meshByPart.set(part.id, mesh);
    return mesh;
  };

  const absolute = (part: CharacterPart) => new THREE.Vector3(part.offset[0], part.offset[1], part.offset[2]);

  for (const part of def.parts) {
    if (part.kind === 'head') {
      addMesh(part, headPivot, new THREE.Vector3(0, part.size[1] / 2, 0));
      continue;
    }
    if (part.kind === 'armL' || part.kind === 'armR' || part.kind === 'legL' || part.kind === 'legR') {
      const pivot = limbPivots[part.kind];
      pivot.position.set(part.offset[0], part.offset[1] + part.size[1] / 2, part.offset[2]);
      group.add(pivot);
      addMesh(part, pivot, new THREE.Vector3(0, -part.size[1] / 2, 0));
      continue;
    }
    if (part.kind === 'footL' || part.kind === 'footR') {
      const legPivot = part.kind === 'footL' ? legL : legR;
      const legName = part.kind === 'footL' ? 'legL' : 'legR';
      const legPart = def.parts.find((p) => p.kind === legName);
      const legTop = legPart ? legPart.offset[1] + legPart.size[1] / 2 : 0;
      addMesh(
        part,
        legPivot,
        new THREE.Vector3(part.offset[0] - (legPart?.offset[0] ?? 0), part.offset[1] - legTop, part.offset[2] - (legPart?.offset[2] ?? 0)),
      );
      continue;
    }
    if (['hat', 'hair', 'horn', 'eye'].includes(part.kind) && headPart) {
      const neckY = headPart.offset[1] - headPart.size[1] / 2;
      addMesh(
        part,
        headPivot,
        new THREE.Vector3(part.offset[0] - headPart.offset[0], part.offset[1] - neckY, part.offset[2] - headPart.offset[2]),
      );
      continue;
    }
    if (part.kind === 'tail' || part.kind === 'wing') {
      addMesh(part, group, absolute(part));
      continue;
    }
    addMesh(part, group, absolute(part));
  }

  const faceMesh = headPart
    ? (() => {
        const geo = new THREE.PlaneGeometry(headPart.size[0] * 0.74, headPart.size[1] * 0.5);
        const mat = new THREE.MeshBasicMaterial({
          map: createFaceTexture('neutral'),
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, headPart.size[1] * 0.56, headPart.size[2] / 2 + 0.006);
        headPivot.add(mesh);
        return mesh;
      })()
    : null;

  const colliderMeshes: THREE.Object3D[] = [];
  let colliderGroup: THREE.Group | null = null;
  if (showColliders) {
    colliderGroup = new THREE.Group();
    colliderGroup.name = 'colliders';
    for (const collider of def.colliders) {
      if (!collider.enabled) continue;
      const geometry =
        collider.shape === 'sphere'
          ? new THREE.SphereGeometry(collider.size[0] / 2, 12, 8)
          : collider.shape === 'capsule'
            ? new THREE.CapsuleGeometry(collider.size[0] / 2, Math.max(0.01, collider.size[1] - collider.size[0]), 4, 8)
            : new THREE.BoxGeometry(collider.size[0], collider.size[1], collider.size[2]);
      const helper = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: 0x5affc8, wireframe: true, transparent: true, opacity: 0.55 }),
      );
      helper.position.set(collider.offset[0], collider.offset[1], collider.offset[2]);
      helper.rotation.set(
        THREE.MathUtils.degToRad(collider.rotation[0]),
        THREE.MathUtils.degToRad(collider.rotation[1]),
        THREE.MathUtils.degToRad(collider.rotation[2]),
      );
      colliderGroup.add(helper);
      colliderMeshes.push(helper);
    }
    group.add(colliderGroup);
  }

  let currentFace: FaceId | null = null;
  const setFace = (face: FaceId) => {
    if (face === currentFace || !faceMesh) return;
    currentFace = face;
    const mat = faceMesh.material as THREE.MeshBasicMaterial;
    mat.map = createFaceTexture(face);
    mat.needsUpdate = true;
  };

  return {
    group,
    def,
    headPivot: headPart ? headPivot : null,
    armL,
    armR,
    legL,
    legR,
    torsoPivot,
    faceMesh,
    colliderMeshes,
    setFace,
    height,
    dispose: () => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of mats) {
            mat.dispose();
          }
        }
      });
    },
  };
}

function resetPose(rig: CharacterRig): void {
  rig.group.position.set(0, 0, 0);
  rig.group.rotation.set(0, 0, 0);
  for (const pivot of [rig.armL, rig.armR, rig.legL, rig.legR, rig.headPivot, rig.torsoPivot]) {
    if (pivot) pivot.rotation.set(0, 0, 0);
  }
}

export function animateCharacter(rig: CharacterRig, animation: AnimationId | string, t: number): void {
  resetPose(rig);
  const time = t * (animation === 'run' ? 1.7 : 1);
  const swing = Math.sin(time * Math.PI * 2);
  const swing2 = Math.sin(time * Math.PI * 4);
  switch (animation) {
    case 'walk':
      rig.legL?.rotation.set(swing * 0.62, 0, 0);
      rig.legR?.rotation.set(-swing * 0.62, 0, 0);
      rig.armL?.rotation.set(-swing * 0.5, 0, -0.08);
      rig.armR?.rotation.set(swing * 0.5, 0, 0.08);
      rig.headPivot?.rotation.set(swing * 0.03, 0, 0);
      rig.group.position.y = Math.abs(swing2) * 0.05;
      break;
    case 'run':
      rig.legL?.rotation.set(swing * 0.95, 0, 0);
      rig.legR?.rotation.set(-swing * 0.95, 0, 0);
      rig.armL?.rotation.set(-swing * 0.9, 0, -0.12);
      rig.armR?.rotation.set(swing * 0.9, 0, 0.12);
      rig.group.position.y = Math.abs(swing2) * 0.12;
      rig.group.rotation.x = 0.16;
      break;
    case 'jump': {
      const phase = t % 1.6;
      const crouch = phase < 0.2 ? phase / 0.2 : phase < 0.45 ? 1 : phase < 1.1 ? 0 : Math.max(0, 1 - (phase - 1.1) / 0.5);
      rig.group.position.y = Math.max(0, Math.sin(Math.min(1, Math.max(0, (phase - 0.35) / 0.75)) * Math.PI)) * 0.9 - crouch * 0.18;
      rig.legL?.rotation.set(-0.6 * crouch + 0.4, 0, 0);
      rig.legR?.rotation.set(-0.6 * crouch + 0.4, 0, 0);
      rig.armL?.rotation.set(0, 0, -1.2 + crouch * 0.4);
      rig.armR?.rotation.set(0, 0, 1.2 - crouch * 0.4);
      break;
    }
    case 'wave':
      rig.armR?.rotation.set(0, 0, 2.1 + Math.sin(t * Math.PI * 6) * 0.35);
      rig.headPivot?.rotation.set(0, 0, -0.08);
      rig.group.rotation.z = Math.sin(t * Math.PI * 2) * 0.01;
      break;
    case 'point':
      rig.armR?.rotation.set(-1.45, 0.15, 0.1);
      rig.headPivot?.rotation.set(0, -0.12, 0);
      break;
    case 'talk':
      rig.armL?.rotation.set(-0.5 + Math.sin(t * 5) * 0.35, 0, -0.45);
      rig.armR?.rotation.set(-0.5 + Math.sin(t * 5 + 1.4) * 0.4, 0, 0.45);
      rig.headPivot?.rotation.set(Math.sin(t * 4) * 0.05, Math.sin(t * 3) * 0.08, 0);
      break;
    case 'sit':
      rig.group.position.y = -0.55;
      rig.legL?.rotation.set(-1.45, 0, 0);
      rig.legR?.rotation.set(-1.45, 0, 0);
      rig.armL?.rotation.set(-0.35, 0, -0.2);
      rig.armR?.rotation.set(-0.35, 0, 0.2);
      break;
    case 'dance':
      rig.group.rotation.y = Math.sin(t * Math.PI * 2) * 0.35;
      rig.group.position.y = Math.abs(Math.sin(t * Math.PI * 4)) * 0.16;
      rig.armL?.rotation.set(0, 0, -2.4 + Math.sin(t * Math.PI * 4) * 0.4);
      rig.armR?.rotation.set(0, 0, 2.4 - Math.sin(t * Math.PI * 4 + 1) * 0.4);
      rig.legL?.rotation.set(Math.sin(t * Math.PI * 4) * 0.3, 0, 0.1);
      rig.legR?.rotation.set(-Math.sin(t * Math.PI * 4) * 0.3, 0, -0.1);
      rig.headPivot?.rotation.set(0, 0, Math.sin(t * Math.PI * 4) * 0.12);
      break;
    case 'shrug':
      rig.armL?.rotation.set(0, 0, -0.95);
      rig.armR?.rotation.set(0, 0, 0.95);
      rig.headPivot?.rotation.set(0, 0, 0.06);
      rig.group.position.y = Math.sin(t * Math.PI) * 0.02;
      break;
    case 'lookAround':
      rig.headPivot?.rotation.set(0, Math.sin(t * 1.4) * 0.75, 0);
      rig.armL?.rotation.set(0, 0, -0.1);
      rig.armR?.rotation.set(0, 0, 0.1);
      break;
    case 'fall':
      rig.group.rotation.x = Math.min(1.45, t * 1.8);
      rig.group.position.y = Math.max(-0.35, -t * 0.4);
      rig.armL?.rotation.set(0, 0, -1.8);
      rig.armR?.rotation.set(0, 0, 1.8);
      break;
    case 'victory': {
      const bounce = Math.abs(Math.sin(t * Math.PI * 2));
      rig.armL?.rotation.set(0, 0, -2.6);
      rig.armR?.rotation.set(0, 0, 2.6);
      rig.group.position.y = bounce * 0.22;
      rig.headPivot?.rotation.set(-0.12, 0, 0);
      break;
    }
    case 'attack':
      rig.group.rotation.x = 0.1;
      rig.armR?.rotation.set(-1.9 + Math.sin(t * 8) * 0.4, 0, 0.15);
      rig.armL?.rotation.set(0.5, 0, -0.3);
      rig.legL?.rotation.set(0.35, 0, 0);
      rig.legR?.rotation.set(-0.3, 0, 0);
      rig.headPivot?.rotation.set(0.1, 0, 0);
      break;
    case 'roar': {
      const shake = Math.sin(t * 40) * 0.02;
      rig.headPivot?.rotation.set(-0.35 + shake, 0, 0);
      rig.armL?.rotation.set(0, 0, -1.5);
      rig.armR?.rotation.set(0, 0, 1.5);
      rig.group.scale.set(1 + Math.sin(t * 12) * 0.015, 1 + Math.sin(t * 12) * 0.015, 1);
      rig.group.position.y = Math.abs(Math.sin(t * 8)) * 0.05;
      break;
    }
    case 'idle':
    default:
      rig.group.position.y = Math.sin(t * Math.PI * 2) * 0.025;
      rig.headPivot?.rotation.set(Math.sin(t * Math.PI * 2) * 0.015, Math.sin(t * Math.PI) * 0.04, 0);
      rig.armL?.rotation.set(0, 0, -0.04 + Math.sin(t * 2) * 0.02);
      rig.armR?.rotation.set(0, 0, 0.04 - Math.sin(t * 2) * 0.02);
      break;
  }
}
