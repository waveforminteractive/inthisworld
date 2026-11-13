import { useState } from 'react';
import { useEditor } from '../state/store';
import { saveCurrentProject } from '../lib/save';
import { formatTime } from '../shared/ids';
import {
  IconCamera,
  IconChevron,
  IconExport,
  IconGrid,
  IconHome,
  IconPause,
  IconPlay,
  IconRedo,
  IconSave,
  IconSettings,
  IconSparkles,
  IconStop,
  IconUndo,
  IconUser,
} from '../ui/Icons';

export function TopBar() {
  const project = useEditor((s) => s.project);
  const dirty = useEditor((s) => s.dirty);
  const saving = useEditor((s) => s.saving);
  const playing = useEditor((s) => s.playing);
  const playhead = useEditor((s) => s.playhead);
  const history = useEditor((s) => s.history);
  const future = useEditor((s) => s.future);
  const cameraPreview = useEditor((s) => s.cameraPreview);
  const showColliders = useEditor((s) => s.showColliders);
  const showGrid = useEditor((s) => s.showGrid);
  const [name, setName] = useState(project?.name ?? '');
  const [menu, setMenu] = useState(false);

  if (!project) return null;
  const scene = project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];
  const state = useEditor.getState();

  const play = () => {
    if (playing) {
      state.setPlaying(false);
      return;
    }
    if (playhead >= scene.duration - 0.01) state.setPlayhead(0);
    state.setCameraPreview(true);
    state.setPlaying(true);
  };

  const goHome = async () => {
    if (dirty) await saveCurrentProject(true);
    state.goHome();
  };

  const commitName = () => {
    const next = name.trim();
    if (next && next !== project.name) state.renameProject(next);
    else setName(project.name);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="home-btn" title="Back to projects" onClick={() => void goHome()}>
          <IconHome size={18} />
          <span>In This World</span>
        </button>
        <div className="project-name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
            spellCheck={false}
            aria-label="Project name"
          />
          <span className={`save-state ${dirty ? 'dirty' : ''}`}>
            {saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
          </span>
        </div>
        <div className="toolbar-group">
          <button className="icon-btn" title="Save (Ctrl+S)" onClick={() => void saveCurrentProject()}>
            <IconSave size={17} />
          </button>
          <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={history.length === 0} onClick={() => state.undo()}>
            <IconUndo size={17} />
          </button>
          <button className="icon-btn" title="Redo (Ctrl+Y)" disabled={future.length === 0} onClick={() => state.redo()}>
            <IconRedo size={17} />
          </button>
        </div>
      </div>

      <div className="topbar-center">
        <button className="transport" title="Jump to start" onClick={() => state.setPlayhead(0)}>
          <IconStop size={15} />
        </button>
        <button className="transport play" title={playing ? 'Pause (Space)' : 'Play scene (Space)'} onClick={play}>
          {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>
        <div className="transport-time">
          <strong>{formatTime(playhead)}</strong>
          <span>/ {formatTime(scene.duration)}</span>
        </div>
        <div className="scene-label" title="Active scene">
          {scene.name}
        </div>
      </div>

      <div className="topbar-right">
        <button
          className={`icon-btn ${cameraPreview ? 'active' : ''}`}
          title="Camera preview"
          onClick={() => state.setCameraPreview(!cameraPreview)}
        >
          <IconCamera size={17} />
        </button>
        <button
          className={`icon-btn ${showGrid ? 'active' : ''}`}
          title="Toggle grid"
          onClick={() => state.setShowGrid(!showGrid)}
        >
          <IconGrid size={17} />
        </button>
        <button
          className={`icon-btn ${showColliders ? 'active' : ''}`}
          title="Show colliders"
          onClick={() => state.setShowColliders(!showColliders)}
        >
          <IconUser size={17} />
        </button>
        <button className="btn ghost ai" onClick={() => state.setModal({ type: 'director' })}>
          <IconSparkles size={16} /> Director AI
        </button>
        <button className="btn primary" onClick={() => state.setModal({ type: 'export' })}>
          <IconExport size={16} /> Export
        </button>
        <button className="icon-btn" title="Settings" onClick={() => state.setModal({ type: 'settings' })}>
          <IconSettings size={18} />
        </button>
        <div className="more-menu">
          <button className="icon-btn" title="More" onClick={() => setMenu(!menu)}>
            <IconChevron size={16} />
          </button>
          {menu && (
            <>
              <div className="menu-backdrop" onClick={() => setMenu(false)} />
              <div className="menu">
                <button
                  onClick={() => {
                    setMenu(false);
                    void window.api.projects.reveal(project.id);
                  }}
                >
                  Reveal project folder
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    state.setModal({ type: 'character' });
                  }}
                >
                  Character builder
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    void saveCurrentProject(true).then(() => state.toast('Saved a fresh backup.', 'success'));
                  }}
                >
                  Save snapshot
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    state.setModal({ type: 'settings' });
                  }}
                >
                  Project settings
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
