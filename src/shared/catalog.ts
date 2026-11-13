import type {
  AnimationId,
  EnvironmentPreset,
  EnvironmentSettings,
  FaceId,
  LightingPreset,
  ParticleConfig,
  ShotKind,
} from './types';

export const ANIMATIONS: { id: AnimationId; name: string; description: string; monster?: boolean }[] = [
  { id: 'idle', name: 'Idle', description: 'Gentle breathing and a subtle sway.' },
  { id: 'walk', name: 'Walk', description: 'Relaxed walking cycle.' },
  { id: 'run', name: 'Run', description: 'Fast, energetic running cycle.' },
  { id: 'jump', name: 'Jump', description: 'Crouch, leap and land.' },
  { id: 'wave', name: 'Wave', description: 'Raise a hand and wave hello.' },
  { id: 'point', name: 'Point', description: 'Point forward with confidence.' },
  { id: 'talk', name: 'Talk', description: 'Conversational hand gestures.' },
  { id: 'sit', name: 'Sit', description: 'Settle down into a seated pose.' },
  { id: 'dance', name: 'Dance', description: 'A cheerful looping dance.' },
  { id: 'shrug', name: 'Shrug', description: 'Lift the shoulders. Who knows?' },
  { id: 'lookAround', name: 'Look Around', description: 'Scan the scene left and right.' },
  { id: 'fall', name: 'Fall', description: 'Lose balance and tumble.' },
  { id: 'victory', name: 'Victory', description: 'Celebrate with arms raised.' },
  { id: 'attack', name: 'Attack', description: 'A lunge and strike.', monster: true },
  { id: 'roar', name: 'Roar', description: 'A big, screen-shaking roar.', monster: true },
];

export const FACE_PRESETS: { id: FaceId; name: string }[] = [
  { id: 'neutral', name: 'Neutral' },
  { id: 'happy', name: 'Happy' },
  { id: 'sad', name: 'Sad' },
  { id: 'angry', name: 'Angry' },
  { id: 'surprised', name: 'Surprised' },
  { id: 'scared', name: 'Scared' },
  { id: 'smug', name: 'Smug' },
  { id: 'wink', name: 'Wink' },
  { id: 'determined', name: 'Determined' },
  { id: 'blank', name: 'Blank' },
];

export const CAMERA_SHOTS: { kind: ShotKind; name: string; description: string }[] = [
  { kind: 'wide', name: 'Wide', description: 'Establishing shot that shows the whole scene.' },
  { kind: 'medium', name: 'Medium', description: 'Chest-up framing of the subject.' },
  { kind: 'close', name: 'Close Up', description: 'Tight framing for emotion.' },
  { kind: 'orbit', name: 'Orbit', description: 'Slow cinematic circle around the subject.' },
  { kind: 'low', name: 'Low Angle', description: 'Looking up. Makes a subject feel powerful.' },
  { kind: 'high', name: 'High Angle', description: 'Looking down. Makes a subject feel small.' },
];

export interface PropDef {
  id: string;
  name: string;
  category: 'nature' | 'buildings' | 'furniture' | 'props' | 'vehicles';
  description: string;
}

export const PROPS: PropDef[] = [
  { id: 'prop-house', name: 'House', category: 'buildings', description: 'Cozy little house with a pitched roof.' },
  { id: 'prop-tree', name: 'Tree', category: 'nature', description: 'Round leafy tree.' },
  { id: 'prop-pine', name: 'Pine Tree', category: 'nature', description: 'Tall conifer with layered needles.' },
  { id: 'prop-rock', name: 'Rock', category: 'nature', description: 'A cluster of weathered rocks.' },
  { id: 'prop-fence', name: 'Fence', category: 'buildings', description: 'A short wooden fence section.' },
  { id: 'prop-sign', name: 'Sign', category: 'props', description: 'A blank wooden sign for your story.' },
  { id: 'prop-car', name: 'Car', category: 'vehicles', description: 'Compact blocky car.' },
  { id: 'prop-bench', name: 'Bench', category: 'furniture', description: 'Park bench for quiet conversations.' },
  { id: 'prop-barrel', name: 'Barrel', category: 'props', description: 'Wooden barrel.' },
  { id: 'prop-crate', name: 'Crate', category: 'props', description: 'Sturdy wooden crate.' },
  { id: 'prop-lamp', name: 'Street Lamp', category: 'buildings', description: 'Warm lamp for night scenes.' },
  { id: 'prop-sword', name: 'Sword', category: 'props', description: 'A simple hero sword.' },
];

export interface EnvironmentDef {
  id: EnvironmentPreset;
  name: string;
  description: string;
  backgroundColor: string;
  skyColor: string;
  groundColor: string;
  fogDensity: number;
  lighting: LightingPreset;
}

export const ENVIRONMENTS: EnvironmentDef[] = [
  {
    id: 'forest',
    name: 'Forest',
    description: 'Soft green light between ancient trees.',
    backgroundColor: '#7fb6c9',
    skyColor: '#b9dfe8',
    groundColor: '#527a3e',
    fogDensity: 0.012,
    lighting: 'day',
  },
  {
    id: 'city',
    name: 'City',
    description: 'Blocks of buildings under a pale sky.',
    backgroundColor: '#8fa3b8',
    skyColor: '#cfdae6',
    groundColor: '#5b6068',
    fogDensity: 0.008,
    lighting: 'day',
  },
  {
    id: 'desert',
    name: 'Desert',
    description: 'Warm dunes and a wide horizon.',
    backgroundColor: '#e8c48a',
    skyColor: '#f7e0b5',
    groundColor: '#c9a063',
    fogDensity: 0.01,
    lighting: 'goldenHour',
  },
  {
    id: 'snow',
    name: 'Snowfield',
    description: 'Quiet cold with soft blue shadows.',
    backgroundColor: '#a9c4dc',
    skyColor: '#dbe8f5',
    groundColor: '#e6eef7',
    fogDensity: 0.02,
    lighting: 'day',
  },
  {
    id: 'cave',
    name: 'Cave',
    description: 'Dark stone lit by glowing pools.',
    backgroundColor: '#15151f',
    skyColor: '#222033',
    groundColor: '#3a3746',
    fogDensity: 0.04,
    lighting: 'dramatic',
  },
  {
    id: 'nightSky',
    name: 'Night Sky',
    description: 'Stars overhead and a cool breeze.',
    backgroundColor: '#0b1026',
    skyColor: '#17204a',
    groundColor: '#1a2333',
    fogDensity: 0.006,
    lighting: 'night',
  },
  {
    id: 'void',
    name: 'Void',
    description: 'An endless dark stage for dramatic moments.',
    backgroundColor: '#08080d',
    skyColor: '#101019',
    groundColor: '#15151d',
    fogDensity: 0.03,
    lighting: 'dramatic',
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'A clean, neutral stage with soft lights.',
    backgroundColor: '#24262e',
    skyColor: '#31343e',
    groundColor: '#3c3f49',
    fogDensity: 0.002,
    lighting: 'studio',
  },
];

export function environmentSettings(preset: EnvironmentPreset): EnvironmentSettings {
  const env = ENVIRONMENTS.find((e) => e.id === preset) ?? ENVIRONMENTS[0];
  return {
    preset: env.id,
    backgroundColor: env.backgroundColor,
    skyColor: env.skyColor,
    fogDensity: env.fogDensity,
    lighting: env.lighting,
    weather: 'none',
  };
}

export const LIGHTING_PRESETS: { id: LightingPreset; name: string; description: string }[] = [
  { id: 'studio', name: 'Studio', description: 'Bright, even, neutral light.' },
  { id: 'day', name: 'Daylight', description: 'Warm sun and clear ambient fill.' },
  { id: 'goldenHour', name: 'Golden Hour', description: 'Low warm sun, long soft shadows.' },
  { id: 'night', name: 'Night', description: 'Cool moonlit ambience.' },
  { id: 'indoor', name: 'Indoor', description: 'Soft interior lamps.' },
  { id: 'dramatic', name: 'Dramatic', description: 'High contrast with deep shadows.' },
];

export interface ParticlePresetDef {
  id: string;
  name: string;
  description: string;
  config: ParticleConfig;
}

function particle(partial: Partial<ParticleConfig>): ParticleConfig {
  return {
    preset: 'dust',
    rate: 24,
    lifetime: 3,
    startSize: 0.18,
    endSize: 0.02,
    speed: 1.2,
    spread: 0.6,
    gravity: 0,
    turbulence: 0.2,
    color: '#ffffff',
    colorEnd: '#888888',
    opacity: 0.8,
    additive: false,
    worldSpace: true,
    ...partial,
  };
}

export const PARTICLE_PRESETS: ParticlePresetDef[] = [
  {
    id: 'fire',
    name: 'Fire',
    description: 'Rising flames with additive glow.',
    config: particle({ preset: 'fire', rate: 60, lifetime: 1.4, startSize: 0.5, endSize: 0.05, speed: 1.8, spread: 0.35, gravity: 1.4, turbulence: 0.5, color: '#ffb347', colorEnd: '#ff3b1f', additive: true, opacity: 0.9 }),
  },
  {
    id: 'smoke',
    name: 'Smoke',
    description: 'Soft drifting smoke plume.',
    config: particle({ preset: 'smoke', rate: 22, lifetime: 5, startSize: 0.6, endSize: 2.6, speed: 0.7, spread: 0.4, gravity: -0.25, turbulence: 0.5, color: '#8d8d95', colorEnd: '#3a3a42', opacity: 0.35 }),
  },
  {
    id: 'sparks',
    name: 'Sparks',
    description: 'Fast glowing sparks.',
    config: particle({ preset: 'sparks', rate: 40, lifetime: 1.1, startSize: 0.1, endSize: 0.01, speed: 5, spread: 0.7, gravity: 5, turbulence: 0.2, color: '#ffe9a8', colorEnd: '#ff6b1f', additive: true }),
  },
  {
    id: 'dust',
    name: 'Dust',
    description: 'Slow floating motes in the light.',
    config: particle({ preset: 'dust', rate: 18, lifetime: 7, startSize: 0.06, endSize: 0.02, speed: 0.15, spread: 1, gravity: -0.02, turbulence: 0.7, color: '#f7e8c6', colorEnd: '#b6a785', opacity: 0.5 }),
  },
  {
    id: 'rain',
    name: 'Rain',
    description: 'Steady rainfall over the scene.',
    config: particle({ preset: 'rain', rate: 180, lifetime: 1.6, startSize: 0.05, endSize: 0.05, speed: 14, spread: 0.05, gravity: 9, turbulence: 0, color: '#a9c9e8', colorEnd: '#6f94b8', opacity: 0.45, worldSpace: true }),
  },
  {
    id: 'snow',
    name: 'Snow',
    description: 'Gentle falling snowflakes.',
    config: particle({ preset: 'snow', rate: 90, lifetime: 8, startSize: 0.12, endSize: 0.1, speed: 0.9, spread: 0.5, gravity: 0.3, turbulence: 0.8, color: '#ffffff', colorEnd: '#cfe0f0', opacity: 0.8 }),
  },
  {
    id: 'magic',
    name: 'Magic',
    description: 'Swirling enchanted glitter.',
    config: particle({ preset: 'magic', rate: 55, lifetime: 2.6, startSize: 0.14, endSize: 0.02, speed: 2.2, spread: 0.9, gravity: -0.4, turbulence: 1.4, color: '#b58cff', colorEnd: '#4ad9ff', additive: true, opacity: 0.95 }),
  },
  {
    id: 'explosion',
    name: 'Explosion',
    description: 'One-shot burst of fire and debris.',
    config: particle({ preset: 'explosion', rate: 220, lifetime: 1.8, startSize: 0.5, endSize: 0.1, speed: 9, spread: 1, gravity: 3, turbulence: 0.4, color: '#ffd166', colorEnd: '#7a1d0a', additive: true, opacity: 1 }),
  },
  {
    id: 'confetti',
    name: 'Confetti',
    description: 'Colorful celebration confetti.',
    config: particle({ preset: 'confetti', rate: 65, lifetime: 4, startSize: 0.16, endSize: 0.16, speed: 2.6, spread: 0.8, gravity: 1.4, turbulence: 1.2, color: '#ff5f9e', colorEnd: '#4ad9ff', opacity: 1 }),
  },
  {
    id: 'leaves',
    name: 'Leaves',
    description: 'Autumn leaves tumbling in the wind.',
    config: particle({ preset: 'leaves', rate: 28, lifetime: 6, startSize: 0.2, endSize: 0.18, speed: 1.4, spread: 0.9, gravity: 0.15, turbulence: 1.6, color: '#e08a3c', colorEnd: '#9c4a1e', opacity: 0.9 }),
  },
];

export const BUNDLED_MUSIC = [
  { id: 'music-calm', name: 'Calm Theme', file: 'assets/music/calm-loop.wav', mood: 'calm' },
  { id: 'music-adventure', name: 'Adventure', file: 'assets/music/adventure-loop.wav', mood: 'adventure' },
  { id: 'music-ominous', name: 'Ominous Drone', file: 'assets/music/ominous-loop.wav', mood: 'ominous' },
];

export const BUNDLED_SFX = [
  { id: 'sfx-whoosh', name: 'Whoosh', file: 'assets/sfx/whoosh.wav' },
  { id: 'sfx-boom', name: 'Deep Boom', file: 'assets/sfx/boom.wav' },
  { id: 'sfx-sparkle', name: 'Sparkle', file: 'assets/sfx/sparkle.wav' },
];

export const STORY_NARRATOR_VOICES = [
  { id: 'narrator-male', name: 'The Storyteller', description: 'Warm, calm male narrator with storybook pacing.', engine: 'auto' },
  { id: 'narrator-female', name: 'The Storyteller (F)', description: 'Clear, gentle female narrator.', engine: 'auto' },
  { id: 'documentary', name: 'Documentary', description: 'Deeper, measured tone for serious stories.', engine: 'auto' },
  { id: 'storybook', name: 'Soft Storybook', description: 'Softer, slower and close to the listener.', engine: 'auto' },
];

export const EMOTION_PRESETS = [
  { id: 'calm', name: 'Calm', rate: 0.95, pitch: 0 },
  { id: 'excited', name: 'Excited', rate: 1.12, pitch: 2 },
  { id: 'sad', name: 'Sad', rate: 0.82, pitch: -2 },
  { id: 'ominous', name: 'Ominous', rate: 0.78, pitch: -4 },
  { id: 'cheerful', name: 'Cheerful', rate: 1.06, pitch: 1 },
] as const;

export const ASSET_CATEGORIES = [
  'Characters',
  'Animations',
  'Props',
  'Monsters',
  'Environments',
  'Terrain',
  'Particles',
  'Audio/Music',
  'Text/Titles',
  'Effects',
  'Camera',
  'My Imports',
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
