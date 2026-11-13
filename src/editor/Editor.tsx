import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useEditor } from '../state/store';
import { saveCurrentProject } from '../lib/save';
import { TopBar } from './TopBar';
import { AssetLibrary } from './AssetLibrary';
import { Hierarchy } from './Hierarchy';
import { Viewport } from './Viewport';
import { Inspector } from './Inspector';
import { Timeline } from './Timeline';
import { Storyboard } from './Storyboard';
import { DEFAULT_LAYOUT, clampLayout, loadLayout, saveLayout, type PanelLayout } from './panelLayout';

type SplitterAxis = keyof PanelLayout;

export function Editor() {
  const project = useEditor((s) => s.project);
  const playing = useEditor((s) => s.playing);
  const dirty = useEditor((s) => s.dirty);
  const revision = useEditor((s) => s.revision);
  const [layout, setLayout] = useState<PanelLayout>(() => loadLayout());
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    const onResize = () => setLayout((current) => clampLayout(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const resetLayout = () => {
    const next = clampLayout(DEFAULT_LAYOUT);
    setLayout(next);
    saveLayout(next);
  };

  const startResize = (axis: SplitterAxis) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const base = { ...layoutRef.current };
    const move = (pointer: PointerEvent) => {
      const next = { ...base };
      if (axis === 'left') next.left = base.left + (pointer.clientX - startX);
      if (axis === 'right') next.right = base.right - (pointer.clientX - startX);
      if (axis === 'bottom') next.bottom = base.bottom - (pointer.clientY - startY);
      if (axis === 'storyboard') next.storyboard = base.storyboard + (pointer.clientY - startY);
      setLayout(clampLayout(next));
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      document.body.classList.remove('itw-resizing');
      document.body.style.cursor = '';
      setLayout((current) => {
        saveLayout(current);
        return current;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    document.body.classList.add('itw-resizing');
    document.body.style.cursor = axis === 'left' || axis === 'right' ? 'col-resize' : 'row-resize';
  };

  const resizeByKey = (axis: SplitterAxis) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 32 : 8;
    const horizontal = axis === 'left' || axis === 'right';
    const next = { ...layoutRef.current };
    if (horizontal && event.key === 'ArrowLeft') {
      if (axis === 'left') next.left -= step;
      else next.right += step;
    } else if (horizontal && event.key === 'ArrowRight') {
      if (axis === 'left') next.left += step;
      else next.right -= step;
    } else if (!horizontal && event.key === 'ArrowUp') {
      if (axis === 'bottom') next.bottom += step;
      else next.storyboard -= step;
    } else if (!horizontal && event.key === 'ArrowDown') {
      if (axis === 'bottom') next.bottom -= step;
      else next.storyboard += step;
    } else {
      return;
    }
    event.preventDefault();
    const clamped = clampLayout(next);
    setLayout(clamped);
    saveLayout(clamped);
  };


  useEffect(() => {
    if (!project) return;
    void window.api.assets
      .ensureMusic(project.id)
      .catch((error) => window.api.app.logError('Bundled audio generation failed', (error as Error).message));
  }, [project?.id]);

  useEffect(() => {
    if (!dirty || !project) return;
    const seconds = Math.max(6, project.settings.autosaveSeconds || 20);
    const timer = setTimeout(() => {
      if (useEditor.getState().dirty) void saveCurrentProject(true);
    }, seconds * 1000);
    return () => clearTimeout(timer);
  }, [dirty, revision, project?.id]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      const state = useEditor.getState();
      if (!state.playing || !state.project) return;
      const scene = state.project.scenes.find((s) => s.id === state.project!.activeSceneId);
      if (!scene) {
        state.setPlaying(false);
        return;
      }
      const next = state.playhead + dt;
      if (next >= scene.duration) {
        const included = state.project.scenes.filter((s) => s.include);
        const index = included.findIndex((s) => s.id === scene.id);
        const upcoming = included[index + 1];
        if (upcoming) {
          useEditor.setState({
            project: { ...state.project, activeSceneId: upcoming.id },
            playhead: 0,
          });
        } else {
          state.setPlayhead(scene.duration);
          state.setPlaying(false);
          return;
        }
      } else {
        state.setPlayhead(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const state = useEditor.getState();
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveCurrentProject();
        return;
      }
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        if (state.selection?.type === 'object') state.duplicateObject(state.selection.id);
        else if (state.selection?.type === 'scene') state.duplicateScene(state.selection.id);
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        if (!state.playing) state.setCameraPreview(true);
        state.setPlaying(!state.playing);
        return;
      }
      if (event.key === 'Escape') {
        state.setPlaying(false);
        state.setSelection({ type: 'scene', id: state.project?.activeSceneId ?? '' });
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!state.selection) return;
        event.preventDefault();
        if (state.selection.type === 'object') state.removeObject(state.selection.id);
        else if (state.selection.type === 'clip') state.removeClip(state.selection.id);
        else if (state.selection.type === 'shot') state.removeShot(state.selection.id);
        return;
      }
      if (event.key === '1') state.setTransformMode('translate');
      if (event.key === '2') state.setTransformMode('rotate');
      if (event.key === '3') state.setTransformMode('scale');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!project) return null;

  const layoutStyle = {
    '--left-width': `${layout.left}px`,
    '--right-width': `${layout.right}px`,
    '--bottom-height': `${layout.bottom}px`,
    '--storyboard-height': `${layout.storyboard}px`,
  } as CSSProperties;

  return (
    <div className="editor" style={layoutStyle}>
      <TopBar />
      <div className="editor-main">
        <aside className="left-dock">
          <AssetLibrary />
          <Hierarchy />
        </aside>
        <main className="center-dock">
          <Viewport />
        </main>
        <aside className="right-dock">
          <Inspector />
        </aside>
        <div
          className="splitter vertical splitter-left"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize asset panels"
          tabIndex={0}
          title="Drag to resize · double-click to reset"
          onPointerDown={startResize('left')}
          onKeyDown={resizeByKey('left')}
          onDoubleClick={resetLayout}
        />
        <div
          className="splitter vertical splitter-right"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector"
          tabIndex={0}
          title="Drag to resize · double-click to reset"
          onPointerDown={startResize('right')}
          onKeyDown={resizeByKey('right')}
          onDoubleClick={resetLayout}
        />
      </div>
      <div className="bottom-dock">
        <div
          className="splitter horizontal splitter-storyboard"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize storyboard"
          tabIndex={0}
          title="Drag to resize · double-click to reset"
          onPointerDown={startResize('storyboard')}
          onKeyDown={resizeByKey('storyboard')}
          onDoubleClick={resetLayout}
        />
        <Storyboard />
        <Timeline />
      </div>
      <div
        className="splitter horizontal splitter-bottom"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline dock"
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={startResize('bottom')}
        onKeyDown={resizeByKey('bottom')}
        onDoubleClick={resetLayout}
      />
    </div>
  );
}
