import { create } from 'zustand';
import { clamp, uid } from '../shared/ids';
import {
  createClip,
  createObject,
  createScene,
  createShot,
  defaultExportPreset,
  includedScenes,
} from '../shared/project';
import type {
  CameraShot,
  Clip,
  Project,
  ProjectLoadResult,
  Scene,
  SceneObject,
  ShotKind,
  TrackId,
} from '../shared/types';

export interface Selection {
  type: 'object' | 'clip' | 'shot' | 'scene';
  id: string;
}

export type ModalState =
  | { type: 'settings' }
  | { type: 'licenses' }
  | { type: 'export' }
  | { type: 'character'; objectId?: string; assetId?: string }
  | { type: 'director'; seedIdea?: string }
  | { type: 'errors' }
  | null;

export interface Toast {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'error';
}

interface EditorState {
  project: Project | null;
  projectPath: string | null;
  screen: 'home' | 'editor';
  selection: Selection | null;
  playhead: number;
  playing: boolean;
  cameraPreview: boolean;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  history: Project[];
  future: Project[];
  revision: number;
  modal: ModalState;
  toasts: Toast[];
  showColliders: boolean;
  showGrid: boolean;
  transformMode: 'translate' | 'rotate' | 'scale';

  loadProject: (result: ProjectLoadResult) => void;
  goHome: () => void;
  setModal: (modal: ModalState) => void;
  toast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
  setSelection: (selection: Selection | null) => void;
  setPlayhead: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setCameraPreview: (enabled: boolean) => void;
  setActiveScene: (sceneId: string) => void;
  setShowColliders: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;

  checkpoint: () => void;
  update: (mutator: (project: Project) => void) => void;
  commit: (mutator: (project: Project) => void) => void;
  undo: () => void;
  redo: () => void;
  markSaved: (updatedAt: string) => void;
  setSaving: (saving: boolean) => void;
  renameProject: (name: string) => void;

  currentScene: () => Scene | null;
  updateScene: (sceneId: string, mutator: (scene: Scene) => void, record?: boolean) => void;
  addScene: (name?: string) => void;
  duplicateScene: (sceneId: string) => void;
  deleteScene: (sceneId: string) => void;
  reorderScenes: (from: number, to: number) => void;
  toggleSceneInclude: (sceneId: string) => void;

  addObject: (object: SceneObject, sceneId?: string) => void;
  updateObject: (objectId: string, mutator: (object: SceneObject) => void, record?: boolean) => void;
  removeObject: (objectId: string) => void;
  duplicateObject: (objectId: string) => void;

  addClip: (clip: Clip, sceneId?: string) => void;
  updateClip: (clipId: string, mutator: (clip: Clip) => void, record?: boolean) => void;
  removeClip: (clipId: string) => void;
  splitClip: (clipId: string, atTime: number) => void;

  addShot: (kind: ShotKind, start?: number, targetId?: string) => void;
  updateShot: (shotId: string, mutator: (shot: CameraShot) => void, record?: boolean) => void;
  removeShot: (shotId: string) => void;
}

function clampHistory(history: Project[]): Project[] {
  if (history.length <= 80) return history;
  return history.slice(history.length - 80);
}

function clampPlayhead(project: Project | null, time: number): number {
  if (!project) return 0;
  const scene = project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];
  if (!scene) return 0;
  return clamp(time, 0, Math.max(0, scene.duration - 0.001));
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  projectPath: null,
  screen: 'home',
  selection: null,
  playhead: 0,
  playing: false,
  cameraPreview: false,
  dirty: false,
  saving: false,
  lastSavedAt: null,
  history: [],
  future: [],
  revision: 0,
  modal: null,
  toasts: [],
  showColliders: false,
  showGrid: true,
  transformMode: 'translate',

  loadProject: (result) =>
    set({
      project: result.project,
      projectPath: result.path,
      screen: 'editor',
      selection: { type: 'scene', id: result.project.activeSceneId },
      playhead: 0,
      playing: false,
      dirty: false,
      saving: false,
      lastSavedAt: result.project.updatedAt,
      history: [],
      future: [],
      revision: 0,
    }),
  goHome: () => set({ screen: 'home', playing: false, modal: null, selection: null }),
  setModal: (modal) => set({ modal }),
  toast: (message, kind = 'info') => {
    const id = uid('toast');
    set((state) => ({ toasts: [...state.toasts, { id, message, kind }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  setSelection: (selection) => set({ selection }),
  setPlayhead: (time) => set((state) => ({ playhead: clampPlayhead(state.project, time) })),
  setPlaying: (playing) => set({ playing }),
  setCameraPreview: (cameraPreview) => set({ cameraPreview }),
  setActiveScene: (sceneId) =>
    set((state) => {
      if (!state.project || !state.project.scenes.some((s) => s.id === sceneId)) return state;
      return {
        project: { ...state.project, activeSceneId: sceneId },
        selection: { type: 'scene', id: sceneId },
        playhead: 0,
        playing: false,
      };
    }),
  setShowColliders: (showColliders) => set({ showColliders }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setTransformMode: (transformMode) => set({ transformMode }),

  checkpoint: () =>
    set((state) => {
      if (!state.project) return state;
      return {
        history: clampHistory([...state.history, structuredClone(state.project)]),
        future: [],
      };
    }),
  update: (mutator) =>
    set((state) => {
      if (!state.project) return state;
      const next = structuredClone(state.project);
      mutator(next);
      return { project: next, dirty: true, revision: state.revision + 1 };
    }),
  commit: (mutator) => {
    get().checkpoint();
    get().update(mutator);
  },
  undo: () =>
    set((state) => {
      if (!state.project || !state.history.length) return state;
      const history = [...state.history];
      const previous = history.pop()!;
      return {
        project: previous,
        history,
        future: [structuredClone(state.project), ...state.future].slice(0, 80),
        dirty: true,
        revision: state.revision + 1,
        playhead: clampPlayhead(previous, state.playhead),
        selection: previous.scenes.some((s) => s.id === state.selection?.id) ? state.selection : null,
      };
    }),
  redo: () =>
    set((state) => {
      if (!state.project || !state.future.length) return state;
      const future = [...state.future];
      const next = future.shift()!;
      return {
        project: next,
        future,
        history: clampHistory([...state.history, structuredClone(state.project)]),
        dirty: true,
        revision: state.revision + 1,
        playhead: clampPlayhead(next, state.playhead),
      };
    }),
  markSaved: (updatedAt) =>
    set((state) => ({
      dirty: false,
      saving: false,
      lastSavedAt: updatedAt,
      project: state.project ? { ...state.project, updatedAt } : state.project,
    })),
  setSaving: (saving) => set({ saving }),
  renameProject: (name) =>
    get().commit((project) => {
      project.name = name;
    }),

  currentScene: () => {
    const { project } = get();
    if (!project) return null;
    return project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0] ?? null;
  },
  updateScene: (sceneId, mutator, record = true) => {
    const apply = (project: Project) => {
      const scene = project.scenes.find((s) => s.id === sceneId);
      if (scene) mutator(scene);
    };
    if (record) get().commit(apply);
    else get().update(apply);
  },
  addScene: (name) => {
    get().commit((project) => {
      const scene = createScene(name ?? `Scene ${project.scenes.length + 1}`, 'studio', 10);
      const index = project.scenes.findIndex((s) => s.id === project.activeSceneId);
      project.scenes.splice(index + 1, 0, scene);
      project.activeSceneId = scene.id;
    });
    const project = get().project;
    if (project) {
      set({ selection: { type: 'scene', id: project.activeSceneId }, playhead: 0 });
    }
  },
  duplicateScene: (sceneId) => {
    get().commit((project) => {
      const index = project.scenes.findIndex((s) => s.id === sceneId);
      if (index < 0) return;
      const source = structuredClone(project.scenes[index]);
      source.id = uid('scene');
      source.name = `${source.name} Copy`;
      const objectMap = new Map<string, string>();
      for (const object of source.objects) {
        const newId = uid('obj');
        objectMap.set(object.id, newId);
        object.id = newId;
      }
      const clipMap = new Map<string, string>();
      for (const clip of source.clips) {
        const newId = uid('clip');
        clipMap.set(clip.id, newId);
        clip.id = newId;
        if (clip.targetId && objectMap.has(clip.targetId)) clip.targetId = objectMap.get(clip.targetId);
      }
      for (const shot of source.shots) {
        shot.id = uid('shot');
        if (shot.targetId && objectMap.has(shot.targetId)) shot.targetId = objectMap.get(shot.targetId);
      }
      project.scenes.splice(index + 1, 0, source);
      project.activeSceneId = source.id;
    });
    const project = get().project;
    if (project) set({ selection: { type: 'scene', id: project.activeSceneId }, playhead: 0 });
  },
  deleteScene: (sceneId) => {
    get().commit((project) => {
      if (project.scenes.length <= 1) return;
      const index = project.scenes.findIndex((s) => s.id === sceneId);
      if (index < 0) return;
      project.scenes.splice(index, 1);
      if (project.activeSceneId === sceneId) {
        project.activeSceneId = project.scenes[Math.max(0, index - 1)].id;
      }
    });
    const project = get().project;
    if (project) set({ selection: { type: 'scene', id: project.activeSceneId }, playhead: 0 });
  },
  reorderScenes: (from, to) => {
    get().commit((project) => {
      if (from === to || from < 0 || to < 0 || from >= project.scenes.length || to >= project.scenes.length) return;
      const [scene] = project.scenes.splice(from, 1);
      project.scenes.splice(to, 0, scene);
    });
  },
  toggleSceneInclude: (sceneId) => {
    get().commit((project) => {
      const scene = project.scenes.find((s) => s.id === sceneId);
      if (scene) scene.include = !scene.include;
    });
  },

  addObject: (object, sceneId) => {
    const project = get().project;
    if (!project) return;
    const target = sceneId ?? project.activeSceneId;
    get().commit((p) => {
      const scene = p.scenes.find((s) => s.id === target);
      scene?.objects.push(object);
    });
    set({ selection: { type: 'object', id: object.id } });
  },
  updateObject: (objectId, mutator, record = true) => {
    const project = get().project;
    if (!project) return;
    const sceneId = project.activeSceneId;
    get().updateScene(
      sceneId,
      (scene) => {
        const object = scene.objects.find((o) => o.id === objectId);
        if (object) mutator(object);
      },
      record,
    );
  },
  removeObject: (objectId) => {
    get().commit((project) => {
      for (const scene of project.scenes) {
        scene.objects = scene.objects.filter((o) => o.id !== objectId);
        scene.clips = scene.clips.filter((c) => c.targetId !== objectId);
        for (const shot of scene.shots) if (shot.targetId === objectId) shot.targetId = undefined;
      }
    });
    set((state) => (state.selection?.id === objectId ? { selection: { type: 'scene', id: state.project?.activeSceneId ?? '' } } : state));
  },
  duplicateObject: (objectId) => {
    const project = get().project;
    if (!project) return;
    let newId = '';
    get().commit((p) => {
      const scene = p.scenes.find((s) => s.id === p.activeSceneId);
      if (!scene) return;
      const source = scene.objects.find((o) => o.id === objectId);
      if (!source) return;
      const copy = structuredClone(source);
      copy.id = uid('obj');
      newId = copy.id;
      copy.name = `${source.name} Copy`;
      copy.transform.position = [source.transform.position[0] + 1.5, source.transform.position[1], source.transform.position[2]];
      scene.objects.push(copy);
    });
    if (newId) set({ selection: { type: 'object', id: newId } });
  },

  addClip: (clip, sceneId) => {
    const project = get().project;
    if (!project) return;
    const target = sceneId ?? project.activeSceneId;
    get().commit((p) => {
      const scene = p.scenes.find((s) => s.id === target);
      if (!scene) return;
      clip.start = clamp(clip.start, 0, Math.max(0, scene.duration - 0.1));
      clip.duration = Math.min(clip.duration, Math.max(0.1, scene.duration - clip.start));
      scene.clips.push(clip);
    });
    set({ selection: { type: 'clip', id: clip.id } });
  },
  updateClip: (clipId, mutator, record = true) => {
    const project = get().project;
    if (!project) return;
    get().updateScene(
      project.activeSceneId,
      (scene) => {
        const clip = scene.clips.find((c) => c.id === clipId);
        if (clip) mutator(clip);
      },
      record,
    );
  },
  removeClip: (clipId) => {
    get().commit((project) => {
      for (const scene of project.scenes) scene.clips = scene.clips.filter((c) => c.id !== clipId);
    });
    set((state) => (state.selection?.id === clipId ? { selection: null } : state));
  },
  splitClip: (clipId, atTime) => {
    get().commit((project) => {
      for (const scene of project.scenes) {
        const clipIndex = scene.clips.findIndex((c) => c.id === clipId);
        if (clipIndex < 0) continue;
        const clip = scene.clips[clipIndex];
        const splitAt = clamp(atTime, clip.start + 0.15, clip.start + clip.duration - 0.15);
        if (splitAt <= clip.start + 0.1 || splitAt >= clip.start + clip.duration - 0.1) return;
        const first = structuredClone(clip);
        first.duration = splitAt - clip.start;
        const second = structuredClone(clip);
        second.id = uid('clip');
        second.start = splitAt;
        second.duration = clip.start + clip.duration - splitAt;
        scene.clips.splice(clipIndex, 1, first, second);
        return;
      }
    });
  },

  addShot: (kind, start, targetId) => {
    const project = get().project;
    if (!project) return;
    const scene = project.scenes.find((s) => s.id === project.activeSceneId);
    if (!scene) return;
    const shot = createShot(kind, start ?? get().playhead, Math.max(3, scene.duration - (start ?? get().playhead)), targetId);
    get().commit((p) => {
      const target = p.scenes.find((s) => s.id === p.activeSceneId);
      if (target) target.shots.push(shot);
    });
    set({ selection: { type: 'shot', id: shot.id } });
  },
  updateShot: (shotId, mutator, record = true) => {
    const project = get().project;
    if (!project) return;
    get().updateScene(
      project.activeSceneId,
      (scene) => {
        const shot = scene.shots.find((s) => s.id === shotId);
        if (shot) mutator(shot);
      },
      record,
    );
  },
  removeShot: (shotId) => {
    get().commit((project) => {
      for (const scene of project.scenes) scene.shots = scene.shots.filter((s) => s.id !== shotId);
    });
    set((state) => (state.selection?.id === shotId ? { selection: null } : state));
  },
}));

export function newClip(track: TrackId, name: string, start: number, duration: number, extra: Partial<Clip> = {}): Clip {
  return createClip(track, name, start, duration, extra);
}

export function newObject(kind: SceneObject['kind'], assetId: string, name: string, position: [number, number, number]): SceneObject {
  return createObject(kind, assetId, name, position);
}

export function sceneDurationForExport(project: Project): number {
  return includedScenes(project).reduce((sum, s) => sum + s.duration, 0);
}

export function ensureExportPreset(project: Project): Project {
  if (!project.exportPreset) project.exportPreset = defaultExportPreset();
  return project;
}
