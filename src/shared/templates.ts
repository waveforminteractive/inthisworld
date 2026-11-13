import { BUNDLED_MUSIC, PARTICLE_PRESETS, environmentSettings } from './catalog';
import { BUILT_IN_CHARACTERS, BUILT_IN_MONSTERS } from './characters';
import {
  createClip,
  createObject,
  createProject,
  createScene,
  createShot,
  normalizeProject,
} from './project';
import type { CharacterDef, Project, Scene, SceneObject } from './types';

export type TemplateId = 'blank' | 'story' | 'skit' | 'monster' | 'showcase';

export interface TemplateDef {
  id: TemplateId;
  name: string;
  description: string;
  accent: string;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'blank',
    name: 'Blank Studio',
    description: 'A clean stage. Add characters, terrain and cameras at your own pace.',
    accent: '#5b8def',
  },
  {
    id: 'story',
    name: '"In This World" Story',
    description: 'A three-scene story with narrator lines, captions, forest, night and camera shots.',
    accent: '#d6a63f',
  },
  {
    id: 'skit',
    name: 'Roblox-Style Skit',
    description: 'Blocky characters, props and a playful two-scene skit setup.',
    accent: '#3fa06a',
  },
  {
    id: 'monster',
    name: 'Monster Short',
    description: 'A dark cave, a titan, particles and dramatic camera angles.',
    accent: '#8e5bd6',
  },
  {
    id: 'showcase',
    name: 'Custom Character Showcase',
    description: 'Line up your cast and show them off with cinematic camera moves.',
    accent: '#e0655c',
  },
];

function cast(id: string): CharacterDef {
  return structuredClone(BUILT_IN_CHARACTERS.find((c) => c.id === id) ?? BUILT_IN_CHARACTERS[0]);
}

function monster(id: string): CharacterDef {
  return structuredClone(BUILT_IN_MONSTERS.find((c) => c.id === id) ?? BUILT_IN_MONSTERS[0]);
}

function shotFor(scene: Scene, kind: Parameters<typeof createShot>[0], start: number, duration: number, target?: string) {
  scene.shots.push(createShot(kind, start, duration, target));
}

function addMusic(scene: Scene, duration: number, index = 0, volume = 0.32) {
  const track = BUNDLED_MUSIC[index] ?? BUNDLED_MUSIC[0];
  scene.clips.push(
    createClip('music', track.name, 0, duration, {
      assetId: track.id,
      audioFile: track.file,
      volume,
      loop: true,
      ducking: true,
      fadeIn: 0.8,
      fadeOut: 1.2,
    }),
  );
}

function addNarration(
  scene: Scene,
  start: number,
  duration: number,
  text: string,
  voiceId = 'narrator-male',
  emotion: 'calm' | 'excited' | 'sad' | 'ominous' | 'cheerful' = 'calm',
) {
  scene.clips.push(
    createClip('narration', 'Narration', start, duration, {
      text,
      voiceId,
      emotion,
      speed: 1,
      pitch: 0,
      volume: 1,
      generated: false,
    }),
  );
  scene.clips.push(createClip('text', 'Caption', start, duration, { text }));
}

function storyTemplate(): Project {
  const project = createProject('In This World', []);

  const s1 = createScene('A Quiet Morning', 'forest', 12);
  const rookie = createObject('character', 'char-rookie', 'Rookie', [0, 0, 0], cast('char-rookie'));
  s1.objects.push(
    rookie,
    createObject('prop', 'prop-tree', 'Tree', [-5, 0, -3]),
    createObject('prop', 'prop-tree', 'Tree', [4, 0, -4]),
    createObject('prop', 'prop-rock', 'Rock', [3, 0, 1]),
  );
  addMusic(s1, 12, 0, 0.3);
  addNarration(s1, 0.8, 5.6, 'In this world, every morning begins with a choice.');
  s1.clips.push(
    createClip('animation', 'Wave', 2.4, 2, { targetId: rookie.id, animation: 'wave' }),
    createClip('face', 'Happy', 2.4, 3, { targetId: rookie.id, face: 'happy' }),
  );
  shotFor(s1, 'wide', 0, 6);
  shotFor(s1, 'medium', 6, 6, rookie.id);

  const s2 = createScene('The Long Walk', 'forest', 13);
  const scout = createObject('character', 'char-scout', 'Scout', [2.2, 0, 0], cast('char-scout'));
  const rookie2 = createObject('character', 'char-rookie', 'Rookie', [-2.2, 0, 0], cast('char-rookie'));
  s2.objects.push(
    rookie2,
    scout,
    createObject('prop', 'prop-fence', 'Fence', [0, 0, -3]),
    createObject('prop', 'prop-tree', 'Tree', [-6, 0, -5]),
  );
  addMusic(s2, 13, 0, 0.28);
  addNarration(s2, 1, 5.4, 'No one has to walk the whole road alone.');
  s2.clips.push(
    createClip('animation', 'Walk', 0, 13, { targetId: rookie2.id, animation: 'walk' }),
    createClip('animation', 'Walk', 0, 13, { targetId: scout.id, animation: 'walk' }),
    createClip('face', 'Determined', 1, 4, { targetId: scout.id, face: 'determined' }),
  );
  shotFor(s2, 'wide', 0, 5);
  shotFor(s2, 'medium', 5, 8, scout.id);

  const s3 = createScene('The Promise', 'nightSky', 14);
  const rookie3 = createObject('character', 'char-rookie', 'Rookie', [-1.6, 0, 0], cast('char-rookie'));
  const scout3 = createObject('character', 'char-scout', 'Scout', [1.6, 0, 0], cast('char-scout'));
  const fire = createObject('emitter', 'particle-fire', 'Campfire', [0, 0, -1.6]);
  fire.particle = structuredClone(PARTICLE_PRESETS.find((p) => p.id === 'fire')!.config);
  s3.objects.push(rookie3, scout3, fire, createObject('prop', 'prop-rock', 'Rock', [-5, 0, -4]));
  addMusic(s3, 14, 0, 0.3);
  addNarration(s3, 1.2, 6, 'And so they promised: in this world, we will remember each other.', 'narrator-male', 'sad');
  s3.clips.push(
    createClip('face', 'Happy', 2, 8, { targetId: rookie3.id, face: 'happy' }),
    createClip('face', 'Happy', 2, 8, { targetId: scout3.id, face: 'happy' }),
    createClip('animation', 'Victory', 9, 3, { targetId: scout3.id, animation: 'victory' }),
  );
  shotFor(s3, 'medium', 0, 6, rookie3.id);
  shotFor(s3, 'close', 6, 5, scout3.id);
  shotFor(s3, 'wide', 11, 3);

  project.scenes = [s1, s2, s3];
  project.activeSceneId = s1.id;
  return normalizeProject(project);
}

function skitTemplate(): Project {
  const project = createProject('Blocky Skit', []);
  const s1 = createScene('The Bench', 'city', 10);
  const a = createObject('character', 'char-brick', 'Brick', [-1.4, 0, 0], cast('char-brick'));
  const b = createObject('character', 'char-scout', 'Scout', [1.4, 0, 0], cast('char-scout'));
  s1.objects.push(
    a,
    b,
    createObject('prop', 'prop-bench', 'Bench', [0, 0, -2]),
    createObject('prop', 'prop-tree', 'Tree', [-5, 0, -4]),
    createObject('prop', 'prop-sign', 'Sign', [4.5, 0, -1]),
  );
  addMusic(s1, 10, 1, 0.35);
  addNarration(s1, 0.6, 4.2, 'Okay. New rule: whoever tells the best story wins.', 'storybook', 'cheerful');
  s1.clips.push(
    createClip('animation', 'Talk', 0.6, 4, { targetId: a.id, animation: 'talk' }),
    createClip('face', 'Smug', 0.6, 4, { targetId: a.id, face: 'smug' }),
    createClip('face', 'Surprised', 3, 3, { targetId: b.id, face: 'surprised' }),
  );
  shotFor(s1, 'wide', 0, 5);
  shotFor(s1, 'medium', 5, 5, b.id);

  const s2 = createScene('The Dance-Off', 'city', 11);
  const c = createObject('character', 'char-nova', 'Nova', [0, 0, 0], cast('char-nova'));
  const d = createObject('character', 'char-rookie', 'Rookie', [2.6, 0, 0], cast('char-rookie'));
  s2.objects.push(c, d, createObject('prop', 'prop-lamp', 'Street Lamp', [-3, 0, -2]));
  addMusic(s2, 11, 1, 0.4);
  addNarration(s2, 0.4, 3, 'And then... the music took over.', 'narrator-female', 'excited');
  s2.clips.push(
    createClip('animation', 'Dance', 0, 11, { targetId: c.id, animation: 'dance' }),
    createClip('animation', 'Dance', 0, 11, { targetId: d.id, animation: 'dance' }),
    createClip('face', 'Happy', 0, 11, { targetId: c.id, face: 'happy' }),
    createClip('animation', 'Victory', 8, 3, { targetId: d.id, animation: 'victory' }),
  );
  shotFor(s2, 'medium', 0, 6, c.id);
  shotFor(s2, 'wide', 6, 5);

  project.scenes = [s1, s2];
  project.activeSceneId = s1.id;
  return normalizeProject(project);
}

function monsterTemplate(): Project {
  const project = createProject('The Hollow', []);
  const s1 = createScene('Something Wakes', 'cave', 12);
  const titan = createObject('monster', 'monster-void-titan', 'Void Titan', [0, 0, -1], monster('monster-void-titan'));
  titan.animation = 'idle';
  const magic = createObject('emitter', 'particle-magic', 'Ethereal Mist', [0, 0.5, 0]);
  magic.particle = structuredClone(PARTICLE_PRESETS.find((p) => p.id === 'magic')!.config);
  s1.objects.push(
    titan,
    magic,
    createObject('prop', 'prop-rock', 'Rock', [-5, 0, -4]),
    createObject('prop', 'prop-rock', 'Rock', [5, 0, -3]),
  );
  addMusic(s1, 12, 2, 0.38);
  addNarration(s1, 0.6, 5, 'Deep beneath the world, something old began to breathe.', 'documentary', 'ominous');
  s1.clips.push(
    createClip('animation', 'Idle', 0, 7, { targetId: titan.id, animation: 'idle' }),
    createClip('animation', 'Roar', 7, 5, { targetId: titan.id, animation: 'roar' }),
    createClip('face', 'Angry', 7, 5, { targetId: titan.id, face: 'angry' }),
  );
  shotFor(s1, 'wide', 0, 5);
  shotFor(s1, 'low', 5, 4, titan.id);
  shotFor(s1, 'close', 9, 3, titan.id);

  const s2 = createScene('The Guardian', 'nightSky', 12);
  const hero = createObject('character', 'char-brick', 'Brick', [-3, 0, 1], cast('char-brick'));
  const titan2 = createObject('monster', 'monster-void-titan', 'Void Titan', [2, 0, -2], monster('monster-void-titan'));
  const fire = createObject('emitter', 'particle-explosion', 'Blast', [2, 1.2, -2]);
  fire.particle = structuredClone(PARTICLE_PRESETS.find((p) => p.id === 'explosion')!.config);
  s2.objects.push(hero, titan2, fire);
  addMusic(s2, 12, 2, 0.4);
  addNarration(s2, 0.8, 5.5, 'One small guardian. One impossible shadow. One last stand.', 'documentary', 'ominous');
  s2.clips.push(
    createClip('animation', 'Run', 0, 6, { targetId: hero.id, animation: 'run' }),
    createClip('animation', 'Attack', 6, 6, { targetId: hero.id, animation: 'attack' }),
    createClip('animation', 'Roar', 5, 7, { targetId: titan2.id, animation: 'roar' }),
    createClip('face', 'Determined', 3, 9, { targetId: hero.id, face: 'determined' }),
  );
  shotFor(s2, 'high', 0, 4);
  shotFor(s2, 'medium', 4, 4, hero.id);
  shotFor(s2, 'wide', 8, 4);

  project.scenes = [s1, s2];
  project.activeSceneId = s1.id;
  return normalizeProject(project);
}

function showcaseTemplate(): Project {
  const project = createProject('Character Showcase');
  const scene = createScene('The Cast', 'studio', 14);
  const positions: [string, number][] = [
    ['char-rookie', -6],
    ['char-scout', -3],
    ['char-nova', 0],
    ['char-brick', 3],
    ['char-miner', 6],
  ];
  for (const [id, x] of positions) {
    const def = cast(id);
    const obj = createObject('character', id, def.name, [x, 0, 0], def);
    obj.animation = 'idle';
    scene.objects.push(obj);
    scene.clips.push(createClip('face', 'Happy', 0, 14, { targetId: obj.id, face: 'happy' }));
  }
  addMusic(scene, 14, 1, 0.35);
  shotFor(scene, 'wide', 0, 5);
  shotFor(scene, 'orbit', 5, 9, scene.objects[2].id);
  project.scenes = [scene];
  project.activeSceneId = scene.id;
  return normalizeProject(project);
}

export function createProjectFromTemplate(templateId: string, name: string): Project {
  switch (templateId) {
    case 'story':
      return reidentify(storyTemplate(), name);
    case 'skit':
      return reidentify(skitTemplate(), name);
    case 'monster':
      return reidentify(monsterTemplate(), name);
    case 'showcase':
      return reidentify(showcaseTemplate(), name);
    case 'blank':
    default:
      return createProject(name);
  }
}

function reidentify(project: Project, name: string): Project {
  project.name = name.trim() || project.name;
  project.createdAt = new Date().toISOString();
  project.updatedAt = project.createdAt;
  return normalizeProject(project);
}

export function welcomeProject(): Project {
  return reidentify(storyTemplate(), 'Welcome to In This World');
}

export function castLibrary(): { id: string; name: string; def: CharacterDef; kind: 'character' | 'monster' }[] {
  return [
    ...BUILT_IN_CHARACTERS.map((def) => ({ id: def.id, name: def.name, def, kind: 'character' as const })),
    ...BUILT_IN_MONSTERS.map((def) => ({ id: def.id, name: def.name, def, kind: 'monster' as const })),
  ];
}

export function emitterObject(presetId: string, position: [number, number, number] = [0, 0, 0]): SceneObject | null {
  const preset = PARTICLE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  const obj = createObject('emitter', `particle-${preset.id}`, preset.name, position);
  obj.particle = structuredClone(preset.config);
  return obj;
}

export function defaultEnvironmentScene(name: string): Scene {
  const scene = createScene(name, 'forest', 12);
  scene.environment = environmentSettings('forest');
  return scene;
}
