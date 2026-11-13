import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { useEditor } from '../state/store';
import { buildSceneRuntime, type SceneRuntime } from '../three/sceneRuntime';
import { createClip, createObject } from '../shared/project';
import { environmentSettings, PARTICLE_PRESETS } from '../shared/catalog';
import { readDragData, type DragPayload } from '../lib/dnd';
import { focusObject } from './Hierarchy';
import { IconCamera, IconCube, IconGrid, IconSearch } from '../ui/Icons';

function structuralSignature(project: NonNullable<ReturnType<typeof useEditor.getState>['project']>, sceneId: string) {
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) return '';
  return [
    scene.id,
    scene.objects
      .map((o) =>
        [
          o.id,
          o.kind,
          o.assetId,
          o.color ?? '',
          o.character ? `${o.character.id}:${o.character.parts.length}:${o.character.accentColor ?? ''}` : '',
          o.particle ? o.particle.preset : '',
        ].join('~'),
      )
      .join('|'),
    JSON.stringify(scene.environment),
    JSON.stringify(scene.terrain),
    project.customAssets
      .map((a) => `${a.id}:${a.file ?? ''}:${a.type}:${a.character ? a.character.parts.length : ''}`)
      .join('|'),
  ].join('#');
}

function addDragPayload(payload: DragPayload, position: [number, number, number]) {
  const state = useEditor.getState();
  const project = state.project;
  if (!project) return;
  const scene = project.scenes.find((s) => s.id === project.activeSceneId);
  if (!scene) return;

  if (payload.type === 'character' || payload.type === 'monster') {
    state.addObject(createObject(payload.type, payload.id, payload.name, position));
  } else if (payload.type === 'prop') {
    state.addObject(createObject('prop', payload.id, payload.name, position));
  } else if (payload.type === 'model') {
    state.addObject(createObject('imported', payload.id, payload.name, position));
  } else if (payload.type === 'particle') {
    const preset = PARTICLE_PRESETS.find((p) => p.id === payload.id);
    const object = createObject('emitter', `particle-${payload.id}`, `${payload.name} Emitter`, position);
    object.particle = preset ? structuredClone(preset.config) : undefined;
    state.addObject(object);
  } else if (payload.type === 'environment') {
    state.updateScene(scene.id, (target) => {
      target.environment = environmentSettings(payload.id as never);
    });
  } else if (payload.type === 'shot') {
    state.addShot(payload.id as never, state.playhead);
  } else if (payload.type === 'animation') {
    const selected = state.selection?.type === 'object' ? state.selection.id : null;
    if (!selected) {
      state.toast('Select a character first to drop an animation.', 'info');
      return;
    }
    state.updateObject(selected, (object) => {
      object.animation = payload.id as never;
    });
    state.addClip(
      createClip('animation', payload.name, state.playhead, 4, {
        targetId: selected,
        animation: payload.id as never,
      }),
    );
  }
}

function applyTransformFromGroup(objectId: string, group: THREE.Object3D) {
  useEditor.getState().updateObject(
    objectId,
    (object) => {
      object.transform.position = [group.position.x, group.position.y, group.position.z];
      object.transform.rotation = [
        THREE.MathUtils.radToDeg(group.rotation.x),
        THREE.MathUtils.radToDeg(group.rotation.y),
        THREE.MathUtils.radToDeg(group.rotation.z),
      ];
      object.transform.scale = [group.scale.x, group.scale.y, group.scale.z];
    },
    false,
  );
}

export function Viewport() {
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const transformRef = useRef<TransformControls | null>(null);
  const helperRef = useRef<THREE.BoxHelper | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const draggingRef = useRef(false);
  const rebuildRef = useRef<() => void>(() => undefined);
  const viewRef = useRef<{ sceneId: string; position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = useEditor((s) => s.project)!;
  const showColliders = useEditor((s) => s.showColliders);
  const showGrid = useEditor((s) => s.showGrid);
  const cameraPreview = useEditor((s) => s.cameraPreview);
  const playing = useEditor((s) => s.playing);
  const transformMode = useEditor((s) => s.transformMode);
  const sceneId = project.activeSceneId;
  const signature = useMemo(
    () => structuralSignature(project, sceneId) + `#${showColliders ? 'colliders' : ''}`,
    [project, sceneId, showColliders],
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      setError('WebGL is unavailable on this computer, so the 3D viewport cannot start.');
      void window.api.app.logError('WebGL init failed', String(err));
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'viewport-canvas';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      renderer.setSize(width, height, false);
      const camera = runtimeRef.current?.camera;
      if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    const teardownControls = () => {
      transformRef.current?.dispose();
      transformRef.current = null;
      orbitRef.current?.dispose();
      orbitRef.current = null;
      helperRef.current?.dispose();
      helperRef.current = null;
      if (gridRef.current) {
        gridRef.current.parent?.remove(gridRef.current);
        gridRef.current.geometry.dispose();
        (gridRef.current.material as THREE.Material).dispose();
        gridRef.current = null;
      }
    };

    const rebuild = () => {
      const state = useEditor.getState();
      const current = state.project;
      if (!current) return;
      const scene = current.scenes.find((s) => s.id === current.activeSceneId);
      if (!scene) return;

      let runtime: SceneRuntime;
      try {
        runtime = buildSceneRuntime(current, scene, { showColliders: state.showColliders });
      } catch (err) {
        setError('This scene could not be built. Check the error log for details.');
        void window.api.app.logError('Scene build failed', String(err));
        return;
      }

      const previous = runtimeRef.current;
      if (previous) {
        viewRef.current = {
          sceneId: previous.sceneData.id,
          position: previous.camera.position.clone(),
          target: orbitRef.current?.target.clone() ?? new THREE.Vector3(0, 2, 0),
        };
        teardownControls();
        for (const entry of previous.objects.values()) {
          if (entry.group.parent === previous.scene) previous.scene.remove(entry.group);
        }
        try {
          previous.dispose();
        } catch (err) {
          void window.api.app.logError('Scene dispose failed', String(err));
        }
      }

      runtimeRef.current = runtime;
      setError(null);
      const aspect = (mount.clientWidth || 16) / (mount.clientHeight || 9);
      const saved = viewRef.current;
      if (saved && saved.sceneId === scene.id) {
        runtime.camera.position.copy(saved.position);
        runtime.camera.lookAt(saved.target);
      } else {
        runtime.frameDefault(aspect);
      }

      const grid = new THREE.GridHelper(60, 60, 0x5a6178, 0x333846);
      grid.position.y = 0.01;
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.35;
      grid.visible = state.showGrid;
      runtime.scene.add(grid);
      gridRef.current = grid;

      const orbit = new OrbitControls(runtime.camera, renderer.domElement);
      orbit.enableDamping = true;
      orbit.dampingFactor = 0.08;
      orbit.maxPolarAngle = Math.PI * 0.495;
      orbit.minDistance = 2;
      orbit.maxDistance = 90;
      if (saved && saved.sceneId === scene.id) orbit.target.copy(saved.target);
      else orbit.target.set(0, 2, 0);
      orbit.update();
      orbitRef.current = orbit;

      const transform = new TransformControls(runtime.camera, renderer.domElement);
      transform.setSize(0.9);
      transform.addEventListener('dragging-changed', (event) => {
        draggingRef.current = Boolean((event as unknown as { value: boolean }).value);
        if (orbitRef.current) orbitRef.current.enabled = !draggingRef.current;
        if (draggingRef.current) useEditor.getState().checkpoint();
      });
      transform.addEventListener('objectChange', () => {
        const now = useEditor.getState();
        if (now.selection?.type !== 'object') return;
        const group = runtimeRef.current?.getGroup(now.selection.id);
        if (group) applyTransformFromGroup(now.selection.id, group);
      });
      runtime.scene.add(transform.getHelper());
      transformRef.current = transform;
      resize();
    };

    rebuildRef.current = rebuild;
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let down: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      down = null;
      const runtime = runtimeRef.current;
      if (moved > 5 || !runtime || transformRef.current?.dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, runtime.camera);
      const hits = raycaster.intersectObjects(runtime.scene.children, true);
      for (const hit of hits) {
        let node: THREE.Object3D | null = hit.object;
        while (node) {
          const objectId = node.userData?.objectId as string | undefined;
          if (objectId) {
            useEditor.getState().setSelection({ type: 'object', id: objectId });
            return;
          }
          node = node.parent;
        }
      }
      const state = useEditor.getState();
      if (state.project) state.setSelection({ type: 'scene', id: state.project.activeSceneId });
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onFocus = (event: Event) => {
      const objectId = (event as CustomEvent<string>).detail;
      const runtime = runtimeRef.current;
      const orbit = orbitRef.current;
      if (!runtime?.getGroup(objectId) || !orbit) return;
      const point = runtime.focusPoint(objectId);
      const offset = runtime.camera.position.clone().sub(orbit.target);
      orbit.target.copy(point);
      runtime.camera.position.copy(point).add(offset);
      orbit.update();
    };
    window.addEventListener('itw-focus-object', onFocus);

    let raf = 0;
    const animate = () => {
      const state = useEditor.getState();
      const runtime = runtimeRef.current;
      if (!runtime) {
        raf = requestAnimationFrame(animate);
        return;
      }
      const scene = state.project?.scenes.find((s) => s.id === runtime.sceneData.id);
      if (scene) {
        for (const object of scene.objects) {
          const entry = runtime.objects.get(object.id);
          if (!entry) continue;
          entry.group.position.set(...object.transform.position);
          entry.group.rotation.set(
            THREE.MathUtils.degToRad(object.transform.rotation[0]),
            THREE.MathUtils.degToRad(object.transform.rotation[1]),
            THREE.MathUtils.degToRad(object.transform.rotation[2]),
          );
          entry.group.scale.set(...object.transform.scale);
          entry.group.visible = !object.hidden;
        }
      }
      runtime.update(state.playhead);

      const aspect = (mount.clientWidth || 1) / (mount.clientHeight || 1);
      const preview = state.playing || state.cameraPreview;
      if (preview) runtime.applyCamera(state.playhead, aspect);
      else if (Math.abs(runtime.camera.aspect - aspect) > 0.0001) {
        runtime.camera.aspect = aspect;
        runtime.camera.updateProjectionMatrix();
      }

      const orbit = orbitRef.current;
      const transform = transformRef.current;
      if (orbit) {
        orbit.enabled = !preview && !draggingRef.current;
        if (!preview) orbit.update();
      }
      if (transform) {
        transform.enabled = !preview;
        transform.setMode(state.transformMode);
        const group = state.selection?.type === 'object' ? runtime.getGroup(state.selection.id) : null;
        if (group && transform.object !== group) transform.attach(group);
        else if (!group && transform.object) transform.detach();
      }
      if (gridRef.current) gridRef.current.visible = state.showGrid;

      const selectedGroup =
        state.selection?.type === 'object' ? runtime.getGroup(state.selection.id) : null;
      if (selectedGroup) {
        if (!helperRef.current) {
          helperRef.current = new THREE.BoxHelper(selectedGroup, 0xffd166);
          runtime.scene.add(helperRef.current);
        }
        helperRef.current.visible = !state.playing;
        helperRef.current.setFromObject(selectedGroup);
      } else if (helperRef.current) {
        helperRef.current.visible = false;
      }

      renderer.render(runtime.scene, runtime.camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('itw-focus-object', onFocus);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      teardownControls();
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      rebuildRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    rebuildRef.current();
  }, [signature]);

  const groundFromEvent = (event: DragEvent): [number, number, number] => {
    const runtime = runtimeRef.current;
    const mount = mountRef.current;
    if (!runtime || !mount) return [0, 0, 0];
    const rect = mount.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, runtime.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) return [0, 0, 0];
    return [Number(point.x.toFixed(2)), 0, Number(point.z.toFixed(2))];
  };

  const selectedName = useEditor((s) => {
    if (s.selection?.type !== 'object' || !s.project) return null;
    const scene = s.project.scenes.find((x) => x.id === s.project!.activeSceneId);
    return scene?.objects.find((o) => o.id === s.selection!.id)?.name ?? null;
  });

  return (
    <div
      className={`viewport ${dragOver ? 'drag-over' : ''}`}
      ref={mountRef}
      onDragOver={(event) => {
        event.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const payload = readDragData(event);
        if (payload) addDragPayload(payload, groundFromEvent(event));
      }}
    >
      {error && (
        <div className="viewport-error">
          <IconCube size={28} />
          <h3>Viewport unavailable</h3>
          <p>{error}</p>
        </div>
      )}
      <div className="viewport-top">
        <span className={`view-badge ${cameraPreview || playing ? 'camera' : ''}`}>
          {cameraPreview || playing ? <IconCamera size={14} /> : <IconCube size={14} />}
          {cameraPreview || playing ? 'Camera preview' : 'Scene view'}
        </span>
        <div className="viewport-tools">
          <button
            className={transformMode === 'translate' ? 'active' : ''}
            title="Move (1)"
            onClick={() => useEditor.getState().setTransformMode('translate')}
          >
            Move
          </button>
          <button
            className={transformMode === 'rotate' ? 'active' : ''}
            title="Rotate (2)"
            onClick={() => useEditor.getState().setTransformMode('rotate')}
          >
            Rotate
          </button>
          <button
            className={transformMode === 'scale' ? 'active' : ''}
            title="Scale (3)"
            onClick={() => useEditor.getState().setTransformMode('scale')}
          >
            Scale
          </button>
          <button
            className={showGrid ? 'active' : ''}
            title="Grid"
            onClick={() => useEditor.getState().setShowGrid(!showGrid)}
          >
            <IconGrid size={14} />
          </button>
          <button
            title="Frame selection"
            onClick={() => {
              const state = useEditor.getState();
              if (state.selection?.type === 'object') focusObject(state.selection.id);
            }}
          >
            <IconSearch size={14} />
          </button>
        </div>
      </div>
      <div className="viewport-bottom">
        <span>{selectedName ? `Selected · ${selectedName}` : 'Drag assets here · click to select'}</span>
        <span className="viewport-hint">Left drag orbit · wheel zoom · right drag pan</span>
      </div>
      {dragOver && <div className="drop-hint">Drop into the scene</div>}
    </div>
  );
}
