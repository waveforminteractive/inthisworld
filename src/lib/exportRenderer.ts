import * as THREE from 'three';
import type { Project, Scene } from '../shared/types';
import type { ExportOptions } from '../shared/types';
import { buildSceneRuntime } from '../three/sceneRuntime';
import { buildSrt } from '../shared/project';
import { mixProjectAudio } from './audio';

export interface RenderExportOptions {
  scenes: Scene[];
  width: number;
  height: number;
  fps: number;
  crf: number;
  transition: 'cut' | 'fade' | 'crossfade' | 'wipe';
  mode: 'single' | 'separate';
  watermark: boolean;
  testRender: boolean;
  includeAudio: boolean;
  subtitles: boolean;
  outputDir: string;
  projectName: string;
  aspect: '16:9' | '9:16' | '1:1';
}

export interface RenderCallbacks {
  onProgress: (frame: number, total: number, message: string) => void;
  isCancelled: () => boolean;
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 80) || 'Scene';
}

function delay(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Frame encoding failed'))), 'image/jpeg', quality);
  });
}

export async function renderProjectExport(
  project: Project,
  options: RenderExportOptions,
  callbacks: RenderCallbacks,
): Promise<{ ok: boolean; outputs: string[]; error?: string }> {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(options.width, options.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const composite = document.createElement('canvas');
  composite.width = options.width;
  composite.height = options.height;
  const ctx = composite.getContext('2d')!;
  const vignette = ctx.createRadialGradient(
    options.width / 2,
    options.height * 0.46,
    Math.min(options.width, options.height) * 0.28,
    options.width / 2,
    options.height * 0.5,
    Math.max(options.width, options.height) * 0.72,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.72, 'rgba(0,0,0,0.08)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)');

  const outputs: string[] = [];
  let currentJobId: string | null = null;

  const totalSeconds = options.scenes.reduce((sum, s) => sum + s.duration, 0);
  const limitedSeconds = options.testRender ? Math.min(3, totalSeconds) : totalSeconds;

  const drawOverlays = (scene: Scene, localTime: number, sceneIndex: number) => {
    ctx.drawImage(renderer.domElement, 0, 0, options.width, options.height);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, options.width, options.height);
    const fade = 0.45;
    let black = 0;
    let wipe = 0;
    if (options.transition !== 'cut') {
      if (sceneIndex > 0 && localTime < fade) black = Math.max(black, 1 - localTime / fade);
      if (localTime > scene.duration - fade) black = Math.max(black, (localTime - (scene.duration - fade)) / fade);
      if (sceneIndex === 0 && localTime < fade * 0.6) black = Math.max(black, 1 - localTime / (fade * 0.6));
      if (options.transition === 'wipe' && sceneIndex > 0 && localTime < 0.7) {
        wipe = Math.max(0, 1 - localTime / 0.7);
      }
    }
    if (options.transition === 'crossfade' && sceneIndex > 0 && localTime < fade) {
      black = Math.max(black, 0.55 * (1 - localTime / fade));
    }
    if (black > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, black)})`;
      ctx.fillRect(0, 0, options.width, options.height);
    }
    if (wipe > 0) {
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(0, 0, options.width * wipe, options.height);
    }
    if (options.watermark) {
      const text = 'In This World';
      const fontSize = Math.round(options.height * 0.028);
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(text, options.width - fontSize, options.height - fontSize * 0.8);
      ctx.shadowBlur = 0;
    }
  };

  const startJob = async (fileName: string, sceneIds: string[], sceneDurations: Record<string, number>) => {
    const exportOptions: ExportOptions = {
      projectId: project.id,
      projectPath: '',
      outputDir: options.outputDir,
      fileName,
      scenes: sceneIds,
      mode: options.mode,
      transition: options.transition,
      width: options.width,
      height: options.height,
      fps: options.fps,
      crf: options.crf,
      testRender: options.testRender,
      watermark: options.watermark,
      sceneDurations,
    };
    const started = await window.api.export.start(exportOptions);
    if (!started.ok || !started.jobId) throw new Error(started.error ?? 'Could not start export');
    currentJobId = started.jobId;
    if (options.subtitles) {
      const subset = {
        ...project,
        scenes: project.scenes.map((scene) => ({ ...scene, include: sceneIds.includes(scene.id) })),
      };
      const srt = buildSrt(subset);
      if (srt.trim()) await window.api.export.setSubtitle(started.jobId, srt);
    }
    return started.jobId;
  };

  try {
    if (options.mode === 'single') {
      const jobId = await startJob(
        options.projectName,
        options.scenes.map((s) => s.id),
        Object.fromEntries(options.scenes.map((s) => [s.id, s.duration])),
      );
      if (options.includeAudio) {
        const audio = await mixProjectAudio(project, options.scenes);
        if (audio) await window.api.export.writeAudio(jobId, audio);
      }
      let frameIndex = 0;
      const totalFrames = Math.max(1, Math.round(limitedSeconds * options.fps));
      let rendered = 0;
      for (let sceneIndex = 0; sceneIndex < options.scenes.length; sceneIndex++) {
        const scene = options.scenes[sceneIndex];
        const runtime = buildSceneRuntime(project, scene);
        runtime.update(0);
        runtime.frameDefault(options.width / options.height);
        await delay(120);
        const duration = options.testRender
          ? Math.max(0, Math.min(scene.duration, 3 - rendered / options.fps))
          : scene.duration;
        const frames = Math.round(duration * options.fps);
        for (let f = 0; f < frames; f++) {
          if (callbacks.isCancelled()) throw new Error('cancelled');
          const localTime = f / options.fps;
          runtime.update(localTime);
          runtime.applyCamera(localTime, options.width / options.height);
          renderer.render(runtime.scene, runtime.camera);
          drawOverlays(scene, localTime, sceneIndex);
          const blob = await canvasBlob(composite, 0.92);
          const data = await blob.arrayBuffer();
          await window.api.export.writeFrame(jobId, frameIndex, data, 0.92);
          frameIndex += 1;
          rendered += 1;
          callbacks.onProgress(rendered, totalFrames, 'Rendering frames…');
          await delay(0);
        }
        runtime.dispose();
      }
      callbacks.onProgress(Math.min(rendered, totalFrames), totalFrames, 'Encoding MP4…');
      const result = await window.api.export.finish(jobId);
      if (!result.ok || !result.output) throw new Error(result.error ?? 'Encoding failed');
      outputs.push(result.output);
    } else {
      const totalFrames = Math.max(1, Math.round(limitedSeconds * options.fps));
      let rendered = 0;
      for (const scene of options.scenes) {
        if (callbacks.isCancelled()) throw new Error('cancelled');
        const jobId = await startJob(`${options.projectName} - ${sanitize(scene.name)}`, [scene.id], { [scene.id]: scene.duration });
        if (options.includeAudio) {
          const audio = await mixProjectAudio(project, [scene]);
          if (audio) await window.api.export.writeAudio(jobId, audio);
        }
        const runtime = buildSceneRuntime(project, scene);
        runtime.update(0);
        runtime.frameDefault(options.width / options.height);
        await delay(120);
        const duration = options.testRender
          ? Math.max(0, Math.min(scene.duration, 3))
          : scene.duration;
        const frames = Math.round(duration * options.fps);
        for (let f = 0; f < frames; f++) {
          if (callbacks.isCancelled()) throw new Error('cancelled');
          const localTime = f / options.fps;
          runtime.update(localTime);
          runtime.applyCamera(localTime, options.width / options.height);
          renderer.render(runtime.scene, runtime.camera);
          drawOverlays(scene, localTime, 0);
          const blob = await canvasBlob(composite, 0.92);
          const data = await blob.arrayBuffer();
          await window.api.export.writeFrame(jobId, f, data, 0.92);
          rendered += 1;
          callbacks.onProgress(Math.min(rendered, totalFrames), totalFrames, `Rendering ${scene.name}…`);
          await delay(0);
        }
        runtime.dispose();
        const result = await window.api.export.finish(jobId);
        if (!result.ok || !result.output) throw new Error(result.error ?? 'Encoding failed');
        outputs.push(result.output);
      }
    }
    return { ok: true, outputs };
  } catch (error) {
    const message = (error as Error).message;
    if (currentJobId) {
      try {
        await window.api.export.cancel(currentJobId);
      } catch {
        // ignore
      }
    }
    return { ok: false, outputs, error: message };
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
