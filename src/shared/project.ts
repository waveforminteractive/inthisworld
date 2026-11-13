import { environmentSettings } from './catalog';
import { uid } from './ids';
import {
  PROJECT_SCHEMA_VERSION,
  type CameraShot,
  type CharacterDef,
  type Clip,
  type EnvironmentPreset,
  type ExportPreset,
  type Project,
  type Scene,
  type SceneObject,
  type ShotKind,
  type TrackId,
  type Transform,
  type Vec3,
} from './types';

export function defaultTransform(position: Vec3 = [0, 0, 0]): Transform {
  return { position: [...position], rotation: [0, 0, 0], scale: [1, 1, 1] };
}

export function createScene(name: string, preset: EnvironmentPreset = 'studio', duration = 10): Scene {
  return {
    id: uid('scene'),
    name,
    duration,
    include: true,
    environment: environmentSettings(preset),
    objects: [],
    clips: [],
    shots: [],
    terrain: null,
  };
}

export function createClip(
  track: TrackId,
  name: string,
  start: number,
  duration: number,
  extra: Partial<Clip> = {},
): Clip {
  return {
    id: uid('clip'),
    track,
    name,
    start: Math.max(0, start),
    duration: Math.max(0.1, duration),
    ...extra,
  };
}

export function createShot(kind: ShotKind, start: number, duration: number, targetId?: string): CameraShot {
  const names: Record<ShotKind, string> = {
    wide: 'Wide Shot',
    medium: 'Medium Shot',
    close: 'Close Up',
    orbit: 'Orbit',
    low: 'Low Angle',
    high: 'High Angle',
  };
  return {
    id: uid('shot'),
    name: names[kind],
    start,
    duration,
    kind,
    targetId,
    distance: kind === 'close' ? 4 : kind === 'medium' ? 7 : 12,
    height: kind === 'low' ? 1.2 : kind === 'high' ? 7 : 3.2,
    angle: 0,
  };
}

export function createObject(
  kind: SceneObject['kind'],
  assetId: string,
  name: string,
  position: Vec3,
  character?: CharacterDef,
): SceneObject {
  return {
    id: uid('obj'),
    name,
    kind,
    assetId,
    transform: defaultTransform(position),
    character,
    face: kind === 'character' || kind === 'monster' ? 'neutral' : undefined,
    animation: kind === 'character' || kind === 'monster' ? 'idle' : undefined,
  };
}

export function defaultExportPreset(): ExportPreset {
  return {
    mode: 'single',
    transition: 'cut',
    resolution: '1080p',
    fps: 30,
    crf: 20,
    includeAudio: true,
    watermark: false,
  };
}

export function createProject(name: string, scenes?: Scene[]): Project {
  const now = new Date().toISOString();
  const list = scenes && scenes.length ? scenes : [createScene('Scene 1', 'studio', 10)];
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: uid('proj'),
    name: name.trim() || 'Untitled Project',
    createdAt: now,
    updatedAt: now,
    scenes: list,
    activeSceneId: list[0].id,
    customAssets: [],
    settings: {
      aspectRatio: '16:9',
      cinematicLook: true,
      watermark: false,
      autosaveSeconds: 20,
    },
    exportPreset: defaultExportPreset(),
  };
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asVec3(value: unknown, fallback: Vec3): Vec3 {
  if (Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'number')) {
    return value as Vec3;
  }
  return [...fallback];
}

function normalizeShot(raw: Partial<CameraShot>, index: number): CameraShot {
  const kinds: ShotKind[] = ['wide', 'medium', 'close', 'orbit', 'low', 'high'];
  return {
    id: asString(raw.id, uid('shot')),
    name: asString(raw.name, `Shot ${index + 1}`),
    start: Math.max(0, asNumber(raw.start, 0)),
    duration: Math.max(0.5, asNumber(raw.duration, 5)),
    kind: kinds.includes(raw.kind as ShotKind) ? (raw.kind as ShotKind) : 'wide',
    targetId: typeof raw.targetId === 'string' ? raw.targetId : undefined,
    distance: asNumber(raw.distance, 10),
    height: asNumber(raw.height, 3),
    angle: asNumber(raw.angle, 0),
  };
}

function normalizeObject(raw: Partial<SceneObject>, index: number): SceneObject {
  const kinds: SceneObject['kind'][] = ['character', 'prop', 'monster', 'emitter', 'imported'];
  const t: Partial<Transform> = raw.transform ?? {};
  const kind = kinds.includes(raw.kind as SceneObject['kind']) ? (raw.kind as SceneObject['kind']) : 'prop';
  return {
    id: asString(raw.id, uid('obj')),
    name: asString(raw.name, `Object ${index + 1}`),
    kind,
    assetId: asString(raw.assetId, kind === 'character' ? 'char-rookie' : 'prop-tree'),
    transform: {
      position: asVec3(t.position, [0, 0, 0]),
      rotation: asVec3(t.rotation, [0, 0, 0]),
      scale: asVec3(t.scale, [1, 1, 1]),
    },
    character: raw.character,
    face: raw.face,
    color: raw.color,
    animation: raw.animation ?? (kind === 'character' || kind === 'monster' ? 'idle' : undefined),
    particle: raw.particle,
    physics: raw.physics ?? false,
    hidden: raw.hidden ?? false,
  };
}

function normalizeClip(raw: Partial<Clip>, sceneDuration: number): Clip {
  const tracks: TrackId[] = ['animation', 'face', 'camera', 'narration', 'music', 'sfx', 'text', 'particles', 'events'];
  const track = tracks.includes(raw.track as TrackId) ? (raw.track as TrackId) : 'animation';
  const start = Math.max(0, asNumber(raw.start, 0));
  const duration = Math.max(0.1, asNumber(raw.duration, 3));
  return {
    id: asString(raw.id, uid('clip')),
    track,
    name: asString(raw.name, track === 'narration' ? 'Narration' : 'Clip'),
    start: Math.min(start, Math.max(0, sceneDuration - 0.1)),
    duration,
    targetId: raw.targetId,
    assetId: raw.assetId,
    animation: raw.animation,
    face: raw.face,
    text: raw.text,
    voiceId: raw.voiceId,
    emotion: raw.emotion,
    speed: raw.speed,
    pitch: raw.pitch,
    audioFile: raw.audioFile,
    volume: raw.volume,
    fadeIn: raw.fadeIn,
    fadeOut: raw.fadeOut,
    loop: raw.loop,
    ducking: raw.ducking,
    generated: raw.generated,
    color: raw.color,
  };
}

function normalizeScene(raw: Partial<Scene>, index: number): Scene {
  const duration = Math.max(1, asNumber(raw.duration, 10));
  const env = raw.environment ?? environmentSettings('studio');
  const scene: Scene = {
    id: asString(raw.id, uid('scene')),
    name: asString(raw.name, `Scene ${index + 1}`),
    duration,
    include: raw.include !== false,
    environment: {
      preset: env.preset ?? 'studio',
      backgroundColor: asString(env.backgroundColor, '#24262e'),
      skyColor: asString(env.skyColor, '#31343e'),
      fogDensity: asNumber(env.fogDensity, 0.002),
      lighting: env.lighting ?? 'studio',
      weather: env.weather ?? 'none',
    },
    objects: Array.isArray(raw.objects) ? raw.objects.map(normalizeObject) : [],
    clips: Array.isArray(raw.clips) ? raw.clips.map((c) => normalizeClip(c, duration)) : [],
    shots: Array.isArray(raw.shots) ? raw.shots.map(normalizeShot) : [],
    terrain: raw.terrain ?? null,
  };
  return scene;
}

export function normalizeProject(raw: Partial<Project> | null | undefined): Project {
  const base = createProject(raw?.name ?? 'Untitled Project');
  if (!raw || typeof raw !== 'object') return base;
  const scenes = Array.isArray(raw.scenes) && raw.scenes.length ? raw.scenes.map(normalizeScene) : base.scenes;
  const activeSceneId = scenes.some((s) => s.id === raw.activeSceneId) ? raw.activeSceneId! : scenes[0].id;
  const settings = raw.settings ?? base.settings;
  const exportPreset = raw.exportPreset ?? base.exportPreset;
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: asString(raw.id, base.id),
    name: asString(raw.name, base.name),
    createdAt: asString(raw.createdAt, base.createdAt),
    updatedAt: asString(raw.updatedAt, base.updatedAt),
    scenes,
    activeSceneId,
    customAssets: Array.isArray(raw.customAssets) ? raw.customAssets : [],
    settings: {
      aspectRatio: settings.aspectRatio ?? '16:9',
      cinematicLook: settings.cinematicLook ?? true,
      watermark: settings.watermark ?? false,
      autosaveSeconds: asNumber(settings.autosaveSeconds, 20),
    },
    exportPreset: {
      mode: exportPreset.mode ?? 'single',
      transition: exportPreset.transition ?? 'cut',
      resolution: exportPreset.resolution ?? '1080p',
      fps: exportPreset.fps ?? 30,
      crf: asNumber(exportPreset.crf, 20),
      includeAudio: exportPreset.includeAudio ?? true,
      watermark: exportPreset.watermark ?? false,
      lastOutputDir: exportPreset.lastOutputDir,
    },
  };
}

export function migrateProject(raw: any): { project: Project; migrated: boolean } {
  if (!raw || typeof raw !== 'object') {
    return { project: createProject('Recovered Project'), migrated: true };
  }
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
  const copy = structuredClone(raw);
  if (version < 2) {
    if (Array.isArray(copy.scenes)) {
      for (const scene of copy.scenes) {
        if (!scene.shots && Array.isArray(scene.cameraShots)) scene.shots = scene.cameraShots;
        if (scene.terrain === undefined) scene.terrain = null;
        if (!scene.environment) scene.environment = environmentSettings('studio');
      }
    }
    copy.schemaVersion = 2;
  }
  return { project: normalizeProject(copy), migrated: version < PROJECT_SCHEMA_VERSION };
}

export function includedScenes(project: Project): Scene[] {
  return project.scenes.filter((s) => s.include);
}

export function totalDuration(project: Project, includedOnly = true): number {
  return (includedOnly ? includedScenes(project) : project.scenes).reduce((sum, s) => sum + s.duration, 0);
}

export function sceneOffset(project: Project, sceneId: string, includedOnly = true): number {
  let offset = 0;
  for (const scene of includedOnly ? includedScenes(project) : project.scenes) {
    if (scene.id === sceneId) return offset;
    offset += scene.duration;
  }
  return offset;
}

export function activeShot(scene: Scene, time: number): CameraShot | null {
  const sorted = [...scene.shots].sort((a, b) => a.start - b.start);
  let current: CameraShot | null = null;
  for (const shot of sorted) {
    if (shot.start <= time && shot.start + shot.duration > time) current = shot;
  }
  return current;
}

export function sceneAtGlobalTime(project: Project, time: number): { scene: Scene; localTime: number } | null {
  let offset = 0;
  for (const scene of includedScenes(project)) {
    if (time < offset + scene.duration) return { scene, localTime: time - offset };
    offset += scene.duration;
  }
  const scenes = includedScenes(project);
  if (!scenes.length) return null;
  const last = scenes[scenes.length - 1];
  return { scene: last, localTime: last.duration };
}

export function clipsAtTime(scene: Scene, time: number): Clip[] {
  return scene.clips.filter((c) => c.start <= time && c.start + c.duration > time);
}

export function activeAnimation(scene: Scene, objectId: string, time: number): string | null {
  const clips = scene.clips.filter((c) => c.track === 'animation' && c.targetId === objectId);
  let result: string | null = null;
  for (const clip of clips.sort((a, b) => a.start - b.start)) {
    if (clip.start <= time) result = clip.animation ?? 'idle';
  }
  return result;
}

export function activeFace(scene: Scene, objectId: string, time: number): string | null {
  const clips = scene.clips.filter((c) => c.track === 'face' && c.targetId === objectId);
  let result: string | null = null;
  for (const clip of clips.sort((a, b) => a.start - b.start)) {
    if (clip.start <= time) result = clip.face ?? null;
  }
  return result;
}

export function captionAt(scene: Scene, time: number): Clip | null {
  return scene.clips.find((c) => c.track === 'text' && c.start <= time && c.start + c.duration > time) ?? null;
}

export function buildSrt(project: Project): string {
  const lines: string[] = [];
  let index = 1;
  let offset = 0;
  const toStamp = (t: number) => {
    const ms = Math.max(0, Math.round(t * 1000));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };
  for (const scene of includedScenes(project)) {
    const captions = scene.clips
      .filter((c) => (c.track === 'text' || c.track === 'narration') && (c.text?.trim().length ?? 0) > 0)
      .sort((a, b) => a.start - b.start);
    for (const caption of captions) {
      lines.push(String(index++));
      lines.push(`${toStamp(offset + caption.start)} --> ${toStamp(offset + caption.start + caption.duration)}`);
      lines.push(caption.text!.trim());
      lines.push('');
    }
    offset += scene.duration;
  }
  return lines.join('\n');
}

export function resolutionSize(resolution: string, portrait = false): { width: number; height: number } {
  const base = resolution === '720p' ? 720 : resolution === '4k' ? 2160 : 1080;
  const width = Math.round((base * 16) / 9 / 2) * 2;
  if (portrait) return { width: base, height: width };
  return { width, height: base };
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}
