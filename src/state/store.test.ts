import { beforeEach, describe, expect, it } from 'vitest';
import { createClip, createObject, createProject, createScene } from '../shared/project';
import { useEditor } from './store';

function load(project = createProject('Test')) {
  useEditor.getState().loadProject({ project, path: `C:/tmp/${project.id}/project.json` });
  return project;
}

describe('editor store object/clip operations', () => {
  beforeEach(() => {
    useEditor.setState({
      project: null,
      projectPath: null,
      screen: 'home',
      selection: null,
      playhead: 0,
      playing: false,
      dirty: false,
      history: [],
      future: [],
      revision: 0,
    });
  });

  it('adds, undoes and redoes objects', () => {
    const project = load();
    const object = createObject('prop', 'prop-tree', 'Tree', [1, 0, 2]);
    useEditor.getState().addObject(object);
    expect(useEditor.getState().project!.scenes[0].objects).toHaveLength(1);
    expect(useEditor.getState().selection).toEqual({ type: 'object', id: object.id });

    useEditor.getState().undo();
    expect(useEditor.getState().project!.scenes[0].objects).toHaveLength(0);

    useEditor.getState().redo();
    expect(useEditor.getState().project!.scenes[0].objects).toHaveLength(1);
    expect(useEditor.getState().project!.id).toBe(project.id);
  });

  it('removes clips that target a deleted object', () => {
    load();
    const object = createObject('character', 'char-rookie', 'Rookie', [0, 0, 0]);
    useEditor.getState().addObject(object);
    useEditor.getState().addClip(createClip('animation', 'Wave', 1, 2, { targetId: object.id }));
    expect(useEditor.getState().project!.scenes[0].clips).toHaveLength(1);
    useEditor.getState().removeObject(object.id);
    expect(useEditor.getState().project!.scenes[0].clips).toHaveLength(0);
    expect(useEditor.getState().project!.scenes[0].objects).toHaveLength(0);
  });

  it('clamps clips to the scene duration when added', () => {
    load();
    const clip = createClip('text', 'Late', 500, 5);
    useEditor.getState().addClip(clip);
    const stored = useEditor.getState().project!.scenes[0].clips[0];
    expect(stored.start).toBe(9.9);
    expect(stored.duration).toBe(0.1);
  });

  it('splits a clip at a time inside it', () => {
    load();
    const clip = createClip('narration', 'Talk', 2, 6);
    useEditor.getState().addClip(clip);
    useEditor.getState().splitClip(clip.id, 5);
    const clips = useEditor.getState().project!.scenes[0].clips;
    expect(clips).toHaveLength(2);
    expect(clips[0].start).toBe(2);
    expect(clips[0].duration).toBe(3);
    expect(clips[1].start).toBe(5);
    expect(clips[1].duration).toBe(3);
    expect(clips[1].id).not.toBe(clips[0].id);
  });

  it('clamps split time into the clip', () => {
    load();
    const clip = createClip('narration', 'Talk', 2, 6);
    useEditor.getState().addClip(clip);
    useEditor.getState().splitClip(clip.id, 99);
    const clips = useEditor.getState().project!.scenes[0].clips;
    expect(clips).toHaveLength(2);
    expect(clips[0].duration).toBeCloseTo(5.85);
    expect(clips[1].start).toBeCloseTo(7.85);
    expect(clips[1].duration).toBeCloseTo(0.15);
  });

  it('duplicates a scene and remaps object references', () => {
    const scene = createScene('Original', 'studio', 10);
    const project = createProject('Dup', [scene, createScene('Other', 'studio', 10)]);
    const object = createObject('character', 'char-rookie', 'Rookie', [0, 0, 0]);
    scene.objects.push(object);
    scene.clips.push(createClip('animation', 'Wave', 1, 2, { targetId: object.id }));
    scene.shots.push({
      id: 'shot-1',
      name: 'Shot',
      start: 0,
      duration: 5,
      kind: 'wide',
      targetId: object.id,
      distance: 10,
      height: 3,
      angle: 0,
    });
    load(project);

    useEditor.getState().duplicateScene(scene.id);
    const state = useEditor.getState();
    expect(state.project!.scenes).toHaveLength(3);
    const copy = state.project!.scenes[1];
    expect(copy.name).toBe('Original Copy');
    expect(state.project!.activeSceneId).toBe(copy.id);
    expect(copy.objects[0].id).not.toBe(object.id);
    expect(copy.clips[0].targetId).toBe(copy.objects[0].id);
    expect(copy.shots[0].id).not.toBe('shot-1');
    expect(copy.shots[0].targetId).toBe(copy.objects[0].id);
    expect(copy.clips[0].id).not.toBe(scene.clips[0].id);
  });

  it('keeps at least one scene', () => {
    load();
    const only = useEditor.getState().project!.scenes[0];
    useEditor.getState().deleteScene(only.id);
    expect(useEditor.getState().project!.scenes).toHaveLength(1);
  });

  it('moves between scenes and resets playback', () => {
    const project = load(
      createProject('Nav', [createScene('A', 'studio', 5), createScene('B', 'studio', 5)]),
    );
    const target = project.scenes[1];
    useEditor.getState().setPlaying(true);
    useEditor.getState().setPlayhead(3);
    useEditor.getState().setActiveScene(target.id);
    const state = useEditor.getState();
    expect(state.project!.activeSceneId).toBe(target.id);
    expect(state.playhead).toBe(0);
    expect(state.playing).toBe(false);
  });
});
