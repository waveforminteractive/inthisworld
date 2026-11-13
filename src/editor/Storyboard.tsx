import { useState } from 'react';
import { useEditor } from '../state/store';
import { formatTime } from '../shared/ids';
import { ENVIRONMENTS } from '../shared/catalog';
import { IconCopy, IconPlus, IconTrash } from '../ui/Icons';

export function Storyboard() {
  const project = useEditor((s) => s.project)!;
  const selection = useEditor((s) => s.selection);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const state = useEditor.getState();
  const total = project.scenes.filter((s) => s.include).reduce((sum, s) => sum + s.duration, 0);

  return (
    <section className="storyboard">
      <header className="storyboard-head">
        <div>
          <h2>Storyboard</h2>
          <span className="count">
            {project.scenes.length} scenes · {formatTime(total)} included
          </span>
        </div>
        <button className="btn ghost small" onClick={() => state.addScene()}>
          <IconPlus size={14} /> Add scene
        </button>
      </header>
      <div className="scene-strip">
        {project.scenes.map((scene, index) => {
          const env = ENVIRONMENTS.find((e) => e.id === scene.environment.preset) ?? ENVIRONMENTS[0];
          const active = scene.id === project.activeSceneId;
          return (
            <div
              key={scene.id}
              className={`scene-card ${active ? 'active' : ''} ${scene.include ? '' : 'excluded'} ${
                overIndex === index ? 'drop-target' : ''
              }`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => {
                event.preventDefault();
                if (overIndex !== index) setOverIndex(index);
              }}
              onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) state.reorderScenes(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onClick={() => {
                state.setActiveScene(scene.id);
                state.setSelection({ type: 'scene', id: scene.id });
                state.setPlayhead(0);
              }}
            >
              <div
                className="scene-thumb"
                style={{
                  background: `linear-gradient(180deg, ${env.skyColor} 0%, ${env.groundColor} 100%)`,
                }}
              >
                <span className="scene-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="scene-duration">{formatTime(scene.duration)}</span>
                {!scene.include && <span className="scene-excluded">Skipped</span>}
              </div>
              <div className="scene-meta">
                <input
                  value={scene.name}
                  onClick={(event) => event.stopPropagation()}
                  onFocus={() => state.checkpoint()}
                  onChange={(event) => state.updateScene(scene.id, (target) => (target.name = event.target.value), false)}
                  aria-label="Scene name"
                />
                <span>
                  {scene.objects.length} objects · {scene.clips.length} clips
                </span>
              </div>
              <div className="scene-tools">
                <label
                  className="include-toggle"
                  title="Include in rendered story"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={scene.include}
                    onChange={() => state.toggleSceneInclude(scene.id)}
                  />
                  Include
                </label>
                <button
                  className="icon-btn tiny"
                  title="Duplicate scene"
                  onClick={(event) => {
                    event.stopPropagation();
                    state.duplicateScene(scene.id);
                  }}
                >
                  <IconCopy size={13} />
                </button>
                <button
                  className="icon-btn tiny danger"
                  title="Delete scene"
                  disabled={project.scenes.length <= 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (
                      window.confirm(`Delete “${scene.name}”? Its characters and clips will be removed.`)
                    ) {
                      state.deleteScene(scene.id);
                    }
                  }}
                >
                  <IconTrash size={13} />
                </button>
              </div>
            </div>
          );
        })}
        <button className="scene-add" onClick={() => state.addScene()}>
          <IconPlus size={18} />
          <span>New scene</span>
        </button>
      </div>
      {selection?.type === 'scene' && <span className="sr-only">Scene selected</span>}
    </section>
  );
}
