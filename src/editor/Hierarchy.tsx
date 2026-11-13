import { useMemo, useState } from 'react';
import { useEditor } from '../state/store';
import { IconEye, IconPlus, IconSearch, IconTrash, IconUser } from '../ui/Icons';

export function focusObject(objectId: string) {
  window.dispatchEvent(new CustomEvent('itw-focus-object', { detail: objectId }));
}

export function Hierarchy() {
  const project = useEditor((s) => s.project)!;
  const selection = useEditor((s) => s.selection);
  const [query, setQuery] = useState('');
  const state = useEditor.getState();
  const scene = project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];
  const visible = useMemo(
    () => scene.objects.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())),
    [scene.objects, query],
  );

  return (
    <section className="hierarchy">
      <header className="panel-head">
        <h2>Scene cast</h2>
        <div className="head-actions">
          <button className="icon-btn small" title="New character" onClick={() => state.setModal({ type: 'character' })}>
            <IconPlus size={14} />
          </button>
          <span className="count">{scene.objects.length}</span>
        </div>
      </header>
      <div className="library-search small">
        <IconSearch size={13} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this scene…" />
      </div>
      <div className="hierarchy-list">
        <button
          className={`hierarchy-item scene ${selection?.type === 'scene' ? 'active' : ''}`}
          onClick={() => state.setSelection({ type: 'scene', id: scene.id })}
        >
          <span className="kind-dot scene" />
          <span className="name">{scene.name}</span>
          <small>{scene.objects.length} objects</small>
        </button>
        {visible.map((object) => (
          <div
            key={object.id}
            className={`hierarchy-item ${selection?.type === 'object' && selection.id === object.id ? 'active' : ''} ${
              object.hidden ? 'hidden' : ''
            }`}
            onClick={() => state.setSelection({ type: 'object', id: object.id })}
            onDoubleClick={() => focusObject(object.id)}
          >
            <span className={`kind-dot ${object.kind}`} />
            <span className="name">{object.name}</span>
            <span className="row-tools">
              <button
                className="icon-btn tiny"
                title={object.hidden ? 'Show' : 'Hide'}
                onClick={(event) => {
                  event.stopPropagation();
                  state.updateObject(object.id, (target) => {
                    target.hidden = !target.hidden;
                  });
                }}
              >
                <IconEye size={13} />
              </button>
              <button
                className="icon-btn tiny danger"
                title="Remove"
                onClick={(event) => {
                  event.stopPropagation();
                  state.removeObject(object.id);
                }}
              >
                <IconTrash size={13} />
              </button>
            </span>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="hierarchy-empty">
            <IconUser size={20} />
            <p>{query ? 'No matches.' : 'Add characters and props from the library.'}</p>
          </div>
        )}
      </div>
    </section>
  );
}
