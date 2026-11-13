export const PROJECT_SCHEMA_VERSION = 2;

export type Vec3 = [number, number, number];

export type AnimationId =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'wave'
  | 'point'
  | 'talk'
  | 'sit'
  | 'dance'
  | 'shrug'
  | 'lookAround'
  | 'fall'
  | 'victory'
  | 'attack'
  | 'roar';

export type FaceId =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'scared'
  | 'smug'
  | 'wink'
  | 'determined'
  | 'blank';

export type Emotion = 'calm' | 'excited' | 'sad' | 'ominous' | 'cheerful';

export type LightingPreset = 'studio' | 'day' | 'goldenHour' | 'night' | 'indoor' | 'dramatic';

export type EnvironmentPreset =
  | 'forest'
  | 'city'
  | 'desert'
  | 'snow'
  | 'cave'
  | 'nightSky'
  | 'void'
  | 'studio';

export type Weather = 'none' | 'rain' | 'snow' | 'leaves';

export type TrackId =
  | 'animation'
  | 'face'
  | 'camera'
  | 'narration'
  | 'music'
  | 'sfx'
  | 'text'
  | 'particles'
  | 'events';

export type PartKind =
  | 'head'
  | 'torso'
  | 'armL'
  | 'armR'
  | 'legL'
  | 'legR'
  | 'handL'
  | 'handR'
  | 'footL'
  | 'footR'
  | 'hat'
  | 'hair'
  | 'horn'
  | 'eye'
  | 'tail'
  | 'wing'
  | 'accessory';

export type MaterialKind = 'matte' | 'plastic' | 'metal' | 'glow';

export type ColliderRole = 'body' | 'head' | 'hands' | 'feet' | 'hitbox' | 'trigger';

export type ColliderShape = 'box' | 'sphere' | 'capsule' | 'hull';

export interface Transform {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface CharacterPart {
  id: string;
  kind: PartKind;
  name: string;
  size: Vec3;
  offset: Vec3;
  rotation: Vec3;
  color: string;
  material: MaterialKind;
}

export interface ColliderDef {
  id: string;
  partId: string;
  shape: ColliderShape;
  size: Vec3;
  offset: Vec3;
  rotation: Vec3;
  role: ColliderRole;
  layer: string;
  enabled: boolean;
}

export interface CharacterDef {
  id: string;
  name: string;
  kind: 'humanoid' | 'monster';
  bodyType: 'classic' | 'slim' | 'bulky' | 'creature';
  parts: CharacterPart[];
  faces: FaceId[];
  colliders: ColliderDef[];
  physics: boolean;
  rigged: boolean;
  builtIn?: boolean;
  description?: string;
  accentColor?: string;
}

export interface ParticleConfig {
  preset: string;
  rate: number;
  lifetime: number;
  startSize: number;
  endSize: number;
  speed: number;
  spread: number;
  gravity: number;
  turbulence: number;
  color: string;
  colorEnd: string;
  opacity: number;
  additive: boolean;
  worldSpace: boolean;
}

export interface TerrainConfig {
  seed: number;
  size: number;
  segments: number;
  amplitude: number;
  type: 'hills' | 'mountains' | 'flat' | 'islands' | 'canyon' | 'random';
  waterLevel: number | null;
  grassColor: string;
  rockColor: string;
  sandColor: string;
  snowColor: string;
}

export interface EnvironmentSettings {
  preset: EnvironmentPreset;
  backgroundColor: string;
  skyColor: string;
  fogDensity: number;
  lighting: LightingPreset;
  weather: Weather;
}

export interface SceneObject {
  id: string;
  name: string;
  kind: 'character' | 'prop' | 'monster' | 'emitter' | 'imported';
  assetId: string;
  transform: Transform;
  character?: CharacterDef;
  face?: FaceId;
  color?: string;
  animation?: AnimationId;
  particle?: ParticleConfig;
  physics?: boolean;
  hidden?: boolean;
}

export type ShotKind = 'wide' | 'medium' | 'close' | 'orbit' | 'low' | 'high';

export interface CameraShot {
  id: string;
  name: string;
  start: number;
  duration: number;
  kind: ShotKind;
  targetId?: string;
  distance: number;
  height: number;
  angle: number;
}

export interface Clip {
  id: string;
  track: TrackId;
  name: string;
  start: number;
  duration: number;
  targetId?: string;
  assetId?: string;
  animation?: AnimationId;
  face?: FaceId;
  text?: string;
  voiceId?: string;
  emotion?: Emotion;
  speed?: number;
  pitch?: number;
  audioFile?: string;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
  ducking?: boolean;
  generated?: boolean;
  color?: string;
}

export interface Scene {
  id: string;
  name: string;
  duration: number;
  include: boolean;
  environment: EnvironmentSettings;
  objects: SceneObject[];
  clips: Clip[];
  shots: CameraShot[];
  terrain: TerrainConfig | null;
}

export interface CustomAsset {
  id: string;
  type: 'character' | 'audio' | 'face' | 'texture' | 'model';
  name: string;
  character?: CharacterDef;
  file?: string;
  tags?: string[];
  favorite?: boolean;
  builtIn?: boolean;
}

export interface ProjectSettings {
  aspectRatio: '16:9' | '9:16' | '1:1';
  cinematicLook: boolean;
  watermark: boolean;
  autosaveSeconds: number;
}

export type ResolutionName = '720p' | '1080p' | '4k';

export interface ExportPreset {
  mode: 'single' | 'separate';
  transition: 'cut' | 'fade' | 'crossfade' | 'wipe';
  resolution: ResolutionName;
  fps: 24 | 30 | 60;
  crf: number;
  includeAudio: boolean;
  watermark: boolean;
  lastOutputDir?: string;
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  scenes: Scene[];
  activeSceneId: string;
  customAssets: CustomAsset[];
  settings: ProjectSettings;
  exportPreset: ExportPreset;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  duration: number;
  sceneCount: number;
  path: string;
  pinned?: boolean;
  missing?: boolean;
}

export type AIProvider = 'opencode' | 'openai' | 'openrouter' | 'groq' | 'together' | 'custom';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  lastTest?: { ok: boolean; message: string; at: string } | null;
}

export interface DirectorAction {
  type:
    | 'addScene'
    | 'addCharacter'
    | 'setAnimation'
    | 'addNarration'
    | 'addCaption'
    | 'setBackdrop'
    | 'addParticle'
    | 'setCameraShot'
    | 'setMusic'
    | 'setSceneDuration';
  sceneIndex?: number;
  name?: string;
  text?: string;
  character?: string;
  animation?: AnimationId;
  emotion?: Emotion;
  preset?: string;
  kind?: ShotKind;
  start?: number;
  duration?: number;
  seconds?: number;
  mood?: string;
}

export interface DirectorPlan {
  title: string;
  summary: string;
  actions: DirectorAction[];
}

export interface TTSRequest {
  text: string;
  voiceId: string;
  emotion: Emotion;
  speed: number;
  pitch: number;
  cacheName: string;
}

export interface TTSResult {
  ok: boolean;
  file?: string;
  duration?: number;
  engine?: string;
  error?: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  engine: string;
}

export interface ExportOptions {
  projectId: string;
  projectPath: string;
  outputDir: string;
  fileName: string;
  scenes: string[];
  mode: 'single' | 'separate';
  transition: 'cut' | 'fade' | 'crossfade' | 'wipe';
  width: number;
  height: number;
  fps: number;
  crf: number;
  audioFile?: string;
  subtitleFile?: string;
  testRender?: boolean;
  watermark?: boolean;
  sceneDurations: Record<string, number>;
}

export interface ExportProgress {
  jobId: string;
  stage: 'render' | 'encode' | 'done' | 'error' | 'cancelled';
  frame: number;
  totalFrames: number;
  message: string;
  output?: string;
}

export interface AppError {
  at: string;
  message: string;
  detail?: string;
}

export interface ApiError {
  ok: false;
  error: string;
}

export interface ProjectLoadResult {
  project: Project;
  path: string;
}

export interface WindowApi {
  platform: string;
  projects: {
    list: () => Promise<ProjectMeta[]>;
    create: (name: string, templateId: string) => Promise<ProjectLoadResult>;
    open: (id: string) => Promise<ProjectLoadResult>;
    save: (project: Project) => Promise<{ ok: boolean; updatedAt: string; error?: string }>;
    duplicate: (id: string) => Promise<ProjectMeta>;
    delete: (id: string) => Promise<{ ok: boolean }>;
    reveal: (id: string) => Promise<void>;
    pin: (id: string, pinned: boolean) => Promise<void>;
    importArchive: () => Promise<ProjectMeta | null>;
    exportArchive: (id: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
    backups: (id: string) => Promise<{ file: string; at: string }[]>;
    recover: (id: string, file: string) => Promise<ProjectLoadResult>;
  };
  assets: {
    importAudio: (projectId: string) => Promise<CustomAsset | null>;
    importFace: (projectId: string) => Promise<CustomAsset | null>;
    importModel: (projectId: string) => Promise<CustomAsset | null>;
    readFile: (projectId: string, file: string) => Promise<ArrayBuffer | null>;
    writeWave: (projectId: string, name: string, base64: string) => Promise<string>;
    ensureMusic: (projectId: string) => Promise<CustomAsset[]>;
    saveCustomCharacter: (projectId: string, character: CharacterDef) => Promise<CustomAsset>;
    deleteCustom: (projectId: string, assetId: string) => Promise<{ ok: boolean }>;
    assetUrl: (projectId: string, file: string) => string;
  };
  tts: {
    listVoices: () => Promise<VoiceOption[]>;
    generate: (projectId: string, req: TTSRequest) => Promise<TTSResult>;
    probe: () => Promise<{ piper: boolean; sapi: boolean; note: string }>;
  };
  export: {
    chooseFolder: () => Promise<string | null>;
    start: (options: ExportOptions) => Promise<{ ok: boolean; jobId?: string; error?: string }>;
    writeFrame: (jobId: string, index: number, data: ArrayBuffer, quality: number) => Promise<void>;
    writeAudio: (jobId: string, data: ArrayBuffer) => Promise<string>;
    setSubtitle: (jobId: string, content: string) => Promise<void>;
    finish: (jobId: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
    cancel: (jobId: string) => Promise<void>;
    onProgress: (cb: (p: ExportProgress) => void) => () => void;
    detectFfmpeg: () => Promise<{ ok: boolean; path?: string; error?: string }>;
    exportSrt: (projectId: string, content: string, fileName: string) => Promise<string | null>;
    exportStems: (projectId: string, kind: 'narration' | 'music', data: ArrayBuffer, name: string) => Promise<string | null>;
  };
  ai: {
    getSettings: () => Promise<AISettings>;
    saveSettings: (settings: Omit<AISettings, 'hasKey'> & { key?: string }) => Promise<AISettings>;
    clearKey: () => Promise<AISettings>;
    fetchModels: () => Promise<{ ok: boolean; models?: string[]; error?: string }>;
    test: () => Promise<{ ok: boolean; message: string }>;
    chat: (messages: { role: string; content: string }[]) => Promise<{ ok: boolean; text?: string; error?: string }>;
    privacyNotice: () => Promise<string>;
  };
  app: {
    getInfo: () => Promise<{ version: string; projectsRoot: string; ffmpeg: string | null }>;
    logError: (message: string, detail?: string) => Promise<void>;
    readErrors: () => Promise<AppError[]>;
    openLicenses: () => Promise<{ name: string; license: string; note: string }[]>;
    openExternal: (url: string) => Promise<void>;
    openPath: (target: string) => Promise<void>;
    showItemInFolder: (target: string) => Promise<void>;
  };
}
