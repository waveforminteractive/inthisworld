import type { Clip, Project, Scene, TrackId } from '../shared/types';
import { includedScenes, totalDuration } from '../shared/project';

const SAMPLE_RATE = 48000;
let sharedContext: AudioContext | null = null;
const bufferCache = new Map<string, Promise<AudioBuffer | null>>();

function context(): AudioContext {
  if (!sharedContext) sharedContext = new AudioContext({ sampleRate: SAMPLE_RATE });
  return sharedContext;
}

export async function loadAudioBuffer(projectId: string, file: string): Promise<AudioBuffer | null> {
  const key = `${projectId}::${file}`;
  const cached = bufferCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const data = await window.api.assets.readFile(projectId, file);
      if (!data) return null;
      const ctx = context();
      return await ctx.decodeAudioData(data.slice(0));
    } catch {
      return null;
    }
  })();
  bufferCache.set(key, promise);
  return promise;
}

function clipHasAudio(clip: Clip, tracks: TrackId[]): boolean {
  return tracks.includes(clip.track) && Boolean(clip.audioFile);
}

function narrationIntervals(scene: Scene): { start: number; end: number }[] {
  return scene.clips
    .filter((c) => c.track === 'narration' && c.start < scene.duration)
    .map((c) => ({ start: c.start, end: Math.min(scene.duration, c.start + c.duration) }))
    .sort((a, b) => a.start - b.start);
}

function scheduleClip(
  ctx: OfflineAudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  clip: Clip,
  offset: number,
  duckingIntervals: { start: number; end: number }[],
  tracks: TrackId[],
): void {
  const start = offset + clip.start;
  const requested = Math.max(0.05, clip.duration);
  const playable = clip.loop ? requested : Math.min(requested, buffer.duration);
  if (playable <= 0.01) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = Boolean(clip.loop);
  const gain = ctx.createGain();
  const base = Math.max(0, Math.min(2, clip.volume ?? (clip.track === 'music' ? 0.3 : clip.track === 'sfx' ? 0.8 : 1)));
  const fadeIn = Math.max(0, clip.fadeIn ?? 0);
  const fadeOut = Math.max(0, clip.fadeOut ?? 0);
  const startAt = clip.start;
  const endAt = clip.start + playable;
  const duck = clip.track === 'music' && clip.ducking !== false && tracks.includes('narration');
  const duckLevel = base * 0.32;
  gain.gain.setValueAtTime(fadeIn > 0 ? 0.0001 : base, start);
  if (fadeIn > 0) gain.gain.linearRampToValueAtTime(base, start + fadeIn);
  if (duck) {
    for (const interval of duckingIntervals) {
      const duckStart = offset + interval.start;
      const duckEnd = offset + interval.end;
      if (duckEnd <= start || duckStart >= start + playable) continue;
      const localStart = Math.max(start, duckStart);
      const localEnd = Math.min(start + playable, duckEnd);
      if (localEnd <= localStart) continue;
      gain.gain.setTargetAtTime(duckLevel, Math.max(start, localStart - 0.18), 0.12);
      gain.gain.setTargetAtTime(base, localEnd + 0.08, 0.28);
    }
  }
  if (fadeOut > 0) {
    const fadeStart = Math.max(start, start + playable - fadeOut);
    gain.gain.setValueAtTime(base, fadeStart);
    gain.gain.linearRampToValueAtTime(0.0001, start + playable);
  }
  source.connect(gain);
  gain.connect(destination);
  source.start(start, 0, playable);
  source.stop(start + playable + 0.02);
}

export async function mixProjectAudio(
  project: Project,
  scenes: Scene[],
  sampleRate = SAMPLE_RATE,
  tracks: TrackId[] = ['narration', 'music', 'sfx'],
): Promise<ArrayBuffer | null> {
  const audible = scenes.some((scene) => scene.clips.some((clip) => clipHasAudio(clip, tracks)));
  if (!audible) return null;
  let duration = scenes.reduce((sum, s) => sum + s.duration, 0);
  duration = Math.max(duration, 0.5);
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.92;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.18;
  master.connect(limiter);
  limiter.connect(ctx.destination);

  let offset = 0;
  for (const scene of scenes) {
    const ducking = narrationIntervals(scene);
    const clips = scene.clips.filter((c) => clipHasAudio(c, tracks)).sort((a, b) => a.start - b.start);
    for (const clip of clips) {
      if (!clip.audioFile) continue;
      const buffer = await loadAudioBuffer(project.id, clip.audioFile);
      if (!buffer) continue;
      try {
        scheduleClip(ctx, master, buffer, clip, offset, ducking, tracks);
      } catch {
        // skip broken clip, keep rendering the rest
      }
    }
    offset += scene.duration;
  }
  const rendered = await ctx.startRendering();
  return audioBufferToWav(rendered);
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const channels = Math.min(2, buffer.numberOfChannels);
  const length = buffer.length;
  const bytesPerSample = 2;
  const dataSize = length * channels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return arrayBuffer;
}

export async function mixForExport(project: Project, selectedScenes: string[]): Promise<ArrayBuffer | null> {
  const scenes = project.scenes.filter((scene) => selectedScenes.includes(scene.id));
  return mixProjectAudio(project, scenes);
}

export async function mixStem(project: Project, kind: 'narration' | 'music'): Promise<ArrayBuffer | null> {
  const scenes = includedScenes(project);
  const tracks: TrackId[] = kind === 'narration' ? ['narration'] : ['music', 'sfx'];
  return mixProjectAudio(project, scenes, SAMPLE_RATE, tracks);
}

export function audioDuration(project: Project): number {
  return totalDuration(project);
}
