import type {
  CharacterDef,
  CharacterPart,
  ColliderDef,
  ColliderRole,
  FaceId,
  MaterialKind,
  PartKind,
  Vec3,
} from './types';

let seq = 0;
function pid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function makePart(
  kind: PartKind,
  name: string,
  size: Vec3,
  offset: Vec3,
  color: string,
  material: MaterialKind = 'plastic',
  rotation: Vec3 = [0, 0, 0],
): CharacterPart {
  return { id: pid('part'), kind, name, size, offset, rotation, color, material };
}

const ROLE_BY_KIND: Record<PartKind, ColliderRole> = {
  head: 'head',
  torso: 'body',
  armL: 'body',
  armR: 'body',
  legL: 'body',
  legR: 'body',
  handL: 'hands',
  handR: 'hands',
  footL: 'feet',
  footR: 'feet',
  hat: 'trigger',
  hair: 'trigger',
  horn: 'trigger',
  eye: 'trigger',
  tail: 'trigger',
  wing: 'trigger',
  accessory: 'trigger',
};

export function autoColliders(parts: CharacterPart[]): ColliderDef[] {
  return parts
    .filter((p) => ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'handL', 'handR', 'footL', 'footR'].includes(p.kind))
    .map((p) => ({
      id: pid('col'),
      partId: p.id,
      shape: p.kind === 'head' ? 'sphere' : 'box',
      size: [...p.size] as Vec3,
      offset: [...p.offset] as Vec3,
      rotation: [0, 0, 0] as Vec3,
      role: ROLE_BY_KIND[p.kind],
      layer: ROLE_BY_KIND[p.kind] === 'trigger' ? 'trigger' : 'body',
      enabled: true,
    }));
}

interface HumanoidOptions {
  id: string;
  name: string;
  bodyType: 'classic' | 'slim' | 'bulky';
  skin: string;
  shirt: string;
  pants: string;
  shoe?: string;
  hair?: string;
  hat?: string;
  description?: string;
}

export function makeHumanoid(o: HumanoidOptions): CharacterDef {
  const slim = o.bodyType === 'slim';
  const bulky = o.bodyType === 'bulky';
  const legH = slim ? 1.55 : bulky ? 1.3 : 1.4;
  const legW = slim ? 0.5 : bulky ? 0.72 : 0.56;
  const legD = slim ? 0.5 : bulky ? 0.72 : 0.58;
  const torsoH = slim ? 1.5 : bulky ? 1.55 : 1.4;
  const torsoW = slim ? 1.08 : bulky ? 1.62 : 1.26;
  const torsoD = slim ? 0.55 : bulky ? 0.82 : 0.66;
  const armH = slim ? 1.42 : bulky ? 1.34 : 1.3;
  const armW = slim ? 0.38 : bulky ? 0.6 : 0.46;
  const headW = slim ? 0.9 : bulky ? 1.06 : 0.96;
  const headH = headW;
  const shoeH = 0.22;

  const torsoY = legH + torsoH / 2;
  const headY = legH + torsoH + headH / 2 + 0.02;
  const armX = torsoW / 2 + armW / 2;
  const armY = legH + torsoH - armH / 2 + 0.02;
  const parts: CharacterPart[] = [
    makePart('torso', 'Torso', [torsoW, torsoH, torsoD], [0, torsoY, 0], o.shirt),
    makePart('head', 'Head', [headW, headH, headW], [0, headY, 0], o.skin),
    makePart('armL', 'Left Arm', [armW, armH, armW], [-armX, armY, 0], o.skin),
    makePart('armR', 'Right Arm', [armW, armH, armW], [armX, armY, 0], o.skin),
    makePart('legL', 'Left Leg', [legW, legH, legD], [-legW / 2 - 0.02, legH / 2, 0], o.pants),
    makePart('legR', 'Right Leg', [legW, legH, legD], [legW / 2 + 0.02, legH / 2, 0], o.pants),
    makePart('footL', 'Left Foot', [legW + 0.08, shoeH, legD + 0.16], [-legW / 2 - 0.02, shoeH / 2, 0.08], o.shoe ?? '#2b2f38'),
    makePart('footR', 'Right Foot', [legW + 0.08, shoeH, legD + 0.16], [legW / 2 + 0.02, shoeH / 2, 0.08], o.shoe ?? '#2b2f38'),
  ];
  if (o.hair) {
    parts.push(
      makePart('hair', 'Hair', [headW + 0.06, 0.22, headW + 0.06], [0, headY + headH / 2 - 0.05, 0], o.hair, 'matte'),
    );
  }
  if (o.hat) {
    parts.push(
      makePart('hat', 'Hat', [headW + 0.2, 0.16, headW + 0.2], [0, headY + headH / 2 + 0.12, 0], o.hat, 'matte'),
    );
    parts.push(
      makePart('hat', 'Hat Top', [headW * 0.8, 0.35, headW * 0.8], [0, headY + headH / 2 + 0.35, 0], o.hat, 'matte'),
    );
  }

  const faces: FaceId[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'scared', 'smug', 'wink', 'determined', 'blank'];
  return {
    id: o.id,
    name: o.name,
    kind: 'humanoid',
    bodyType: o.bodyType,
    parts,
    faces,
    colliders: autoColliders(parts),
    physics: false,
    rigged: true,
    builtIn: true,
    description: o.description ?? `${o.name} is a friendly ${o.bodyType} blocky character.`,
    accentColor: o.shirt,
  };
}

interface MonsterOptions {
  id: string;
  name: string;
  size: 'small' | 'medium' | 'large';
  body: string;
  accent: string;
  eye: string;
  description: string;
}

export function makeMonster(o: MonsterOptions): CharacterDef {
  const scale = o.size === 'small' ? 0.75 : o.size === 'large' ? 1.9 : 1.15;
  const legH = 0.9 * scale;
  const torsoH = 1.3 * scale;
  const torsoW = 1.5 * scale;
  const torsoD = 1.1 * scale;
  const headW = 1.2 * scale;
  const torsoY = legH + torsoH / 2;
  const headY = legH + torsoH + headW / 2 - 0.1 * scale;
  const parts: CharacterPart[] = [
    makePart('torso', 'Body', [torsoW, torsoH, torsoD], [0, torsoY, 0], o.body, 'matte'),
    makePart('head', 'Head', [headW, headW, headW], [0, headY, 0.12 * scale], o.body, 'matte'),
    makePart('eye', 'Left Eye', [0.22 * scale, 0.22 * scale, 0.12 * scale], [-0.28 * scale, headY + 0.1 * scale, 0.12 * scale + headW / 2], o.eye, 'glow'),
    makePart('eye', 'Right Eye', [0.22 * scale, 0.22 * scale, 0.12 * scale], [0.28 * scale, headY + 0.1 * scale, 0.12 * scale + headW / 2], o.eye, 'glow'),
    makePart('horn', 'Left Horn', [0.2 * scale, 0.7 * scale, 0.2 * scale], [-0.42 * scale, headY + headW / 2 + 0.22 * scale, 0], o.accent, 'matte', [0, 0, -18]),
    makePart('horn', 'Right Horn', [0.2 * scale, 0.7 * scale, 0.2 * scale], [0.42 * scale, headY + headW / 2 + 0.22 * scale, 0], o.accent, 'matte', [0, 0, 18]),
    makePart('armL', 'Left Arm', [0.5 * scale, 1.1 * scale, 0.5 * scale], [-torsoW / 2 - 0.25 * scale, legH + torsoH - 0.45 * scale, 0], o.body, 'matte'),
    makePart('armR', 'Right Arm', [0.5 * scale, 1.1 * scale, 0.5 * scale], [torsoW / 2 + 0.25 * scale, legH + torsoH - 0.45 * scale, 0], o.body, 'matte'),
    makePart('legL', 'Left Leg', [0.55 * scale, legH, 0.6 * scale], [-0.4 * scale, legH / 2, 0], o.body, 'matte'),
    makePart('legR', 'Right Leg', [0.55 * scale, legH, 0.6 * scale], [0.4 * scale, legH / 2, 0], o.body, 'matte'),
    makePart('tail', 'Tail', [0.35 * scale, 0.35 * scale, 1.4 * scale], [0, legH + 0.4 * scale, -torsoD / 2 - 0.55 * scale], o.accent, 'matte', [12, 0, 0]),
  ];
  if (o.size === 'large') {
    parts.push(
      makePart('wing', 'Left Wing', [0.12 * scale, 1.6 * scale, 2.2 * scale], [-torsoW / 2 - 0.1, torsoY + 0.35 * scale, -0.4], o.accent, 'matte', [0, 0, 15]),
      makePart('wing', 'Right Wing', [0.12 * scale, 1.6 * scale, 2.2 * scale], [torsoW / 2 + 0.1, torsoY + 0.35 * scale, -0.4], o.accent, 'matte', [0, 0, -15]),
    );
  }
  return {
    id: o.id,
    name: o.name,
    kind: 'monster',
    bodyType: 'creature',
    parts,
    faces: ['angry', 'determined', 'surprised', 'scared', 'blank'],
    colliders: autoColliders(parts),
    physics: false,
    rigged: true,
    builtIn: true,
    description: o.description,
    accentColor: o.accent,
  };
}

export const BUILT_IN_CHARACTERS: CharacterDef[] = [
  makeHumanoid({
    id: 'char-rookie',
    name: 'Rookie',
    bodyType: 'classic',
    skin: '#f2c14e',
    shirt: '#3a77d8',
    pants: '#2f3b57',
    hair: '#2a2018',
    description: 'The dependable blue-shirt hero of every story.',
  }),
  makeHumanoid({
    id: 'char-scout',
    name: 'Scout',
    bodyType: 'slim',
    skin: '#e8b98a',
    shirt: '#3fa06a',
    pants: '#37453c',
    hat: '#d6a63f',
    description: 'A quick-witted explorer with a trusty cap.',
  }),
  makeHumanoid({
    id: 'char-nova',
    name: 'Nova',
    bodyType: 'slim',
    skin: '#c58b62',
    shirt: '#8e5bd6',
    pants: '#3b2b57',
    hair: '#4c2f6e',
    description: 'A curious inventor who lights up the night.',
  }),
  makeHumanoid({
    id: 'char-brick',
    name: 'Brick',
    bodyType: 'bulky',
    skin: '#d69a67',
    shirt: '#d25445',
    pants: '#3e3a35',
    description: 'A gentle giant with a heart of gold.',
  }),
  makeHumanoid({
    id: 'char-miner',
    name: 'Miner',
    bodyType: 'classic',
    skin: '#f0d2a0',
    shirt: '#e0b13f',
    pants: '#4a4235',
    hat: '#e0b13f',
    description: 'Deep down, everyone is looking for something.',
  }),
];

export const BUILT_IN_MONSTERS: CharacterDef[] = [
  makeMonster({
    id: 'monster-gloomlet',
    name: 'Gloomlet',
    size: 'small',
    body: '#4c5a7a',
    accent: '#7e8fb8',
    eye: '#ffe28a',
    description: 'A shy little creature that hums in the dark.',
  }),
  makeMonster({
    id: 'monster-thornbeast',
    name: 'Thornbeast',
    size: 'medium',
    body: '#4e7a4a',
    accent: '#2f5230',
    eye: '#ffd35a',
    description: 'A mossy guardian of the old forest.',
  }),
  makeMonster({
    id: 'monster-void-titan',
    name: 'Void Titan',
    size: 'large',
    body: '#2a2440',
    accent: '#6b4bd6',
    eye: '#b79cff',
    description: 'An ancient colossus wrapped in starlight and shadow.',
  }),
];
