import { describe, expect, it } from 'vitest';
import {
  activeAnimation,
  activeFace,
  activeShot,
  buildSrt,
  captionAt,
  clipsAtTime,
  createClip,
  createProject,
  createScene,
  createShot,
  includedScenes,
  migrateProject,
  normalizeProject,
  resolutionSize,
  sceneAtGlobalTime,
  sceneOffset,
  totalDuration,
} from './project';
import { PROJECT_SCHEMA_VERSION } from './types';

describe('project creation', () => {
  it('creates sensible defaults', () => {
    const project = createProject('  My Story  ');
    expect(project.name).toBe('My Story');
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(project.scenes).toHaveLength(1);
    expect(project.activeSceneId).toBe(project.scenes[0].id);
    expect(project.settings.aspectRatio).toBe('16:9');
    expect(project.settings.autosaveSeconds).toBe(20);
    expect(project.exportPreset.resolution).toBe('1080p');
    expect(project.scenes[0].include).toBe(true);
  });

  it('falls back to an untitled name', () => {
    expect(createProject('   ').name).toBe('Untitled Project');
  });

  it('uses provided scenes', () => {
    const a = createScene('A', 'studio', 4);
    const b = createScene('B', 'forest', 6);
    const project = createProject('Two', [a, b]);
    expect(project.scenes.map((s) => s.name)).toEqual(['A', 'B']);
    expect(project.activeSceneId).toBe(a.id);
  });

  it('clamps clip and shot values on creation', () => {
    const clip = createClip('text', 'Caption', -3, 0.01);
    expect(clip.start).toBe(0);
    expect(clip.duration).toBe(0.1);
    const shot = createShot('close', 2, 5);
    expect(shot.name).toBe('Close Up');
    expect(shot.distance).toBe(4);
  });
});

describe('normalizeProject', () => {
  it('repairs malformed objects and clips', () => {
    const project = normalizeProject({
      name: 'Broken',
      scenes: [
        {
          id: 'scene-1',
          name: 'Bad',
          duration: -5,
          environment: undefined as never,
          objects: [
            {
              id: 'obj-1',
              kind: 'nonsense' as never,
              assetId: 'prop-rock',
              transform: {
                position: [1, 'x', 3] as never,
                rotation: [0, 0] as never,
                scale: [2, 2, 2],
              },
            },
          ],
          clips: [{ id: 'clip-1', track: 'text' as never, start: 500, duration: 2 }],
        },
      ],
    } as any);
    const scene = project.scenes[0];
    expect(scene.duration).toBe(1);
    expect(scene.environment.preset).toBe('studio');
    expect(scene.objects[0].kind).toBe('prop');
    expect(scene.objects[0].transform.position).toEqual([0, 0, 0]);
    expect(scene.objects[0].transform.rotation).toEqual([0, 0, 0]);
    expect(scene.objects[0].transform.scale).toEqual([2, 2, 2]);
    expect(scene.clips[0].start).toBe(0.9);
  });

  it('keeps a valid active scene and ignores unknown ids', () => {
    const project = normalizeProject({
      scenes: [
        { id: 'a', name: 'A', duration: 5 },
        { id: 'b', name: 'B', duration: 5 },
      ],
      activeSceneId: 'missing',
    } as any);
    expect(project.activeSceneId).toBe('a');

    const kept = normalizeProject({
      scenes: [{ id: 'a', name: 'A', duration: 5 }],
      activeSceneId: 'a',
    } as any);
    expect(kept.activeSceneId).toBe('a');
  });
});

describe('migrateProject', () => {
  it('upgrades v1 cameraShots and fills environment', () => {
    const { project, migrated } = migrateProject({
      schemaVersion: 1,
      name: 'Old',
      scenes: [
        {
          id: 's1',
          name: 'Old Scene',
          duration: 8,
          cameraShots: [{ id: 'shot-1', kind: 'close', start: 0, duration: 3 }],
        },
      ],
    });
    expect(migrated).toBe(true);
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(project.scenes[0].shots).toHaveLength(1);
    expect(project.scenes[0].shots[0].kind).toBe('close');
    expect(project.scenes[0].terrain).toBeNull();
    expect(project.scenes[0].environment.preset).toBe('studio');
  });

  it('recovers from garbage input', () => {
    const { project, migrated } = migrateProject(null);
    expect(migrated).toBe(true);
    expect(project.scenes).toHaveLength(1);
  });
});

describe('timeline helpers', () => {
  const sceneA = createScene('A', 'studio', 4);
  const sceneB = createScene('B', 'studio', 6);
  const sceneC = createScene('C', 'studio', 3);
  sceneC.include = false;
  const project = createProject('Timeline', [sceneA, sceneB, sceneC]);

  it('sums only included scenes by default', () => {
    expect(totalDuration(project)).toBe(10);
    expect(totalDuration(project, false)).toBe(13);
    expect(includedScenes(project).map((s) => s.id)).toEqual([sceneA.id, sceneB.id]);
  });

  it('computes scene offsets', () => {
    expect(sceneOffset(project, sceneA.id)).toBe(0);
    expect(sceneOffset(project, sceneB.id)).toBe(4);
    expect(sceneOffset(project, sceneC.id)).toBe(10);
  });

  it('maps global time to scenes at boundaries', () => {
    expect(sceneAtGlobalTime(project, 0)).toEqual({ scene: sceneA, localTime: 0 });
    expect(sceneAtGlobalTime(project, 3.9)?.scene.id).toBe(sceneA.id);
    expect(sceneAtGlobalTime(project, 4)).toEqual({ scene: sceneB, localTime: 0 });
    expect(sceneAtGlobalTime(project, 99)).toEqual({ scene: sceneB, localTime: 6 });
  });

  it('finds active clips, faces and animations', () => {
    const scene = createScene('Clips', 'studio', 10);
    const obj = 'obj-1';
    scene.clips = [
      createClip('animation', 'Wave', 1, 2, { targetId: obj, animation: 'wave' }),
      createClip('face', 'Happy', 1, 4, { targetId: obj, face: 'happy' }),
      createClip('text', 'Hi', 2, 1, { text: 'Hi' }),
    ];
    expect(activeAnimation(scene, obj, 0.5)).toBeNull();
    expect(activeAnimation(scene, obj, 2)).toBe('wave');
    expect(activeAnimation(scene, obj, 5)).toBe('wave');
    expect(activeFace(scene, obj, 3)).toBe('happy');
    expect(clipsAtTime(scene, 2)).toHaveLength(3);
    expect(captionAt(scene, 2.5)?.text).toBe('Hi');
    expect(captionAt(scene, 4)).toBeNull();
  });

  it('picks the latest matching camera shot', () => {
    const scene = createScene('Shots', 'studio', 10);
    scene.shots = [createShot('wide', 0, 5), createShot('close', 3, 5)];
    expect(activeShot(scene, 1)?.kind).toBe('wide');
    expect(activeShot(scene, 4)?.kind).toBe('close');
    expect(activeShot(scene, 9)).toBeNull();
  });
});

describe('buildSrt', () => {
  it('orders captions globally and skips blank text', () => {
    const sceneA = createScene('A', 'studio', 10);
    sceneA.clips = [
      createClip('text', 'Later', 5, 2, { text: 'World' }),
      createClip('text', 'First', 1, 2, { text: '  Hello  ' }),
      createClip('text', 'Blank', 3, 1, { text: '   ' }),
    ];
    const sceneB = createScene('B', 'studio', 5);
    sceneB.clips = [createClip('narration', 'Narration', 1, 1, { text: 'Scene two' })];
    const hidden = createScene('Hidden', 'studio', 5);
    hidden.include = false;
    hidden.clips = [createClip('text', 'Ignored', 0, 1, { text: 'Nope' })];

    const srt = buildSrt(createProject('Srt', [sceneA, sceneB, hidden]));
    expect(srt).toBe(
      [
        '1',
        '00:00:01,000 --> 00:00:03,000',
        'Hello',
        '',
        '2',
        '00:00:05,000 --> 00:00:07,000',
        'World',
        '',
        '3',
        '00:00:11,000 --> 00:00:12,000',
        'Scene two',
        '',
      ].join('\n'),
    );
  });
});

describe('resolutionSize', () => {
  it('returns even dimensions for each preset', () => {
    expect(resolutionSize('720p')).toEqual({ width: 1280, height: 720 });
    expect(resolutionSize('1080p')).toEqual({ width: 1920, height: 1080 });
    expect(resolutionSize('4k')).toEqual({ width: 3840, height: 2160 });
  });

  it('swaps dimensions for portrait', () => {
    expect(resolutionSize('1080p', true)).toEqual({ width: 1080, height: 1920 });
  });
});
