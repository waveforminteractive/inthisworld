import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ProjectMeta } from '../shared/types';
import { formatDate, formatTime } from '../shared/ids';
import { TEMPLATES } from '../shared/templates';
import { useEditor } from '../state/store';
import { Modal } from '../ui/Modal';
import {
  IconCopy,
  IconExport,
  IconFolder,
  IconHome,
  IconPin,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTrash,
} from '../ui/Icons';

function hashCode(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function HomeScreen() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const setModal = useEditor((s) => s.setModal);
  const toast = useEditor((s) => s.toast);

  const refresh = useCallback(async () => {
    try {
      const list = await window.api.projects.list();
      setProjects(list);
    } catch (error) {
      toast(`Could not read projects: ${(error as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (onlyPinned && !p.pinned) return false;
      if (!text) return true;
      return p.name.toLowerCase().includes(text);
    });
    return list.sort((a, b) => {
      if (Boolean(b.pinned) !== Boolean(a.pinned)) return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (sort === 'name') return a.name.localeCompare(b.name);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, query, sort, onlyPinned]);

  const openProject = async (meta: ProjectMeta) => {
    if (busyId) return;
    setBusyId(meta.id);
    try {
      const backups = await window.api.projects.backups(meta.id).catch(() => []);
      const newest = backups[0];
      let result = await window.api.projects.open(meta.id);
      if (newest) {
        const backupTime = new Date(newest.at).getTime();
        const projectTime = new Date(result.project.updatedAt).getTime();
        if (backupTime > projectTime + 2000) {
          const recover = window.confirm(
            `A newer backup from ${formatDate(newest.at)} exists.\n\nRecover unsaved work? Choose Cancel to open the last saved version.`,
          );
          if (recover) {
            result = await window.api.projects.recover(meta.id, newest.file);
            toast('Recovered the latest autosave backup.', 'success');
          }
        }
      }
      useEditor.getState().loadProject(result);
    } catch (error) {
      toast(`Could not open project: ${(error as Error).message}`, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (meta: ProjectMeta) => {
    try {
      await window.api.projects.duplicate(meta.id);
      await refresh();
      toast('Project duplicated.', 'success');
    } catch (error) {
      toast(`Could not duplicate: ${(error as Error).message}`, 'error');
    }
  };

  const remove = async (meta: ProjectMeta) => {
    const ok = window.confirm(`Delete "${meta.name}"?\n\nThe project folder will be moved to the recycle bin.`);
    if (!ok) return;
    try {
      const result = await window.api.projects.delete(meta.id);
      if (result.ok) {
        toast('Project deleted.', 'success');
        await refresh();
      } else {
        toast('Could not delete the project.', 'error');
      }
    } catch (error) {
      toast(`Could not delete: ${(error as Error).message}`, 'error');
    }
  };

  const importArchive = async () => {
    try {
      const imported = await window.api.projects.importArchive();
      if (imported) {
        await refresh();
        toast('Project archive imported.', 'success');
        await openProject(imported);
      }
    } catch (error) {
      toast(`Import failed: ${(error as Error).message}`, 'error');
    }
  };

  return (
    <div className="home">
      <div className="home-glow" />
      <header className="home-head">
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>In This World</h1>
            <p>Offline cinematic story studio</p>
          </div>
        </div>
        <div className="home-actions">
          <button className="btn ghost" onClick={() => setModal({ type: 'licenses' })}>
            Licenses
          </button>
          <button className="btn ghost" onClick={() => setModal({ type: 'settings' })}>
            <IconSettings size={16} /> Settings
          </button>
          <button className="btn secondary" onClick={importArchive}>
            <IconFolder size={16} /> Import archive
          </button>
          <button className="btn primary" onClick={() => setNewOpen(true)}>
            <IconPlus size={16} /> New Project
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <IconSparkles size={14} /> Fully offline
          </span>
          <h2>Small stories. Big worlds.</h2>
          <p>
            Build blocky characters, paint terrain, direct camera shots, write narration, and render a finished MP4 —
            all on your own computer. No account. No cloud. No key required.
          </p>
          <div className="hero-actions">
            <button className="btn primary large" onClick={() => setNewOpen(true)}>
              <IconPlus size={18} /> Start a project
            </button>
            <button className="btn ghost large" onClick={importArchive}>
              Open an archive
            </button>
          </div>
        </div>
        <div className="hero-stage" aria-hidden>
          <div className="stage-sun" />
          <div className="stage-hill hill-a" />
          <div className="stage-hill hill-b" />
          <div className="stage-figure">
            <span className="fig-head" />
            <span className="fig-body" />
            <span className="fig-arm left" />
            <span className="fig-arm right" />
            <span className="fig-leg left" />
            <span className="fig-leg right" />
          </div>
          <div className="stage-star s1" />
          <div className="stage-star s2" />
          <div className="stage-star s3" />
        </div>
      </section>

      <section className="projects-section">
        <div className="section-head">
          <div>
            <h3>Your projects</h3>
            <p>{projects.length} local project{projects.length === 1 ? '' : 's'} · nothing leaves this computer</p>
          </div>
          <div className="project-filters">
            <div className="search-box">
              <IconSearch size={15} />
              <input
                placeholder="Search projects"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button className={`chip ${onlyPinned ? 'active' : ''}`} onClick={() => setOnlyPinned((v) => !v)}>
              <IconPin size={13} /> Pinned
            </button>
            <select value={sort} onChange={(event) => setSort(event.target.value as 'recent' | 'name')}>
              <option value="recent">Recent</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="project-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="project-card skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="home-empty">
            <div className="empty-orb" />
            <h4>{query ? 'No projects match that search' : 'Your first world is waiting'}</h4>
            <p>
              {query
                ? 'Try a different name, or clear the search.'
                : 'Start from a template or a blank studio. Everything is stored locally.'}
            </p>
            {!query && (
              <button className="btn primary" onClick={() => setNewOpen(true)}>
                <IconPlus size={16} /> New Project
              </button>
            )}
          </div>
        ) : (
          <div className="project-grid">
            {filtered.map((meta) => {
              const hash = hashCode(meta.id);
              const hue = hash % 360;
              return (
                <article
                  key={meta.id}
                  className={`project-card ${busyId === meta.id ? 'busy' : ''}`}
                  onDoubleClick={() => void openProject(meta)}
                >
                  <div
                    className="project-thumb"
                    style={{
                      background: `linear-gradient(140deg, hsl(${hue} 42% 34%), hsl(${(hue + 55) % 360} 55% 18%))`,
                    }}
                  >
                    <div className="thumb-grid" />
                    <div className="thumb-figure">
                      <span />
                      <span />
                      <span />
                    </div>
                    {meta.pinned && <span className="pin-badge">Pinned</span>}
                    <span className="thumb-duration">{formatTime(meta.duration)}</span>
                    <button className="thumb-play" onClick={() => void openProject(meta)}>
                      Open
                    </button>
                  </div>
                  <div className="project-info">
                    <div className="project-title-row">
                      <h4 title={meta.name}>{meta.name}</h4>
                      <button
                        className={`icon-btn mini ${meta.pinned ? 'active' : ''}`}
                        title={meta.pinned ? 'Unpin' : 'Pin'}
                        onClick={async () => {
                          await window.api.projects.pin(meta.id, !meta.pinned);
                          await refresh();
                        }}
                      >
                        <IconPin size={14} />
                      </button>
                    </div>
                    <p className="project-meta">
                      {meta.sceneCount} scene{meta.sceneCount === 1 ? '' : 's'} · modified {formatDate(meta.updatedAt)}
                    </p>
                    <div className="project-card-actions">
                      <button className="text-btn" onClick={() => void duplicate(meta)}>
                        <IconCopy size={14} /> Duplicate
                      </button>
                      <button className="text-btn" onClick={() => window.api.projects.reveal(meta.id)}>
                        <IconFolder size={14} /> Folder
                      </button>
                      <button
                        className="text-btn"
                        onClick={async () => {
                          const result = await window.api.projects.exportArchive(meta.id);
                          if (result.ok) toast('Project archive exported.', 'success');
                          else if (result.error !== 'cancelled') toast(result.error ?? 'Archive export failed.', 'error');
                        }}
                      >
                        <IconExport size={14} /> Archive
                      </button>
                      <button className="text-btn danger" onClick={() => void remove(meta)}>
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="home-footer">
        <span>
          <IconHome size={14} /> Local-first studio · Windows · macOS · Linux
        </span>
        <span>Narration: offline TTS · Export: bundled FFmpeg · Director AI: opt-in only</span>
      </footer>

      {newOpen && (
        <NewProjectDialog
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            setNewOpen(false);
          }}
        />
      )}
    </div>
  );
}

function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('My Story');
  const [template, setTemplate] = useState('story');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadProject = useEditor((s) => s.loadProject);
  const toast = useEditor((s) => s.toast);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await window.api.projects.create(name.trim() || 'Untitled Project', template);
      onCreated();
      loadProject(result);
      toast('Project created. Everything is stored locally.', 'success');
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  };

  return (
    <Modal
      title="New Project"
      subtitle="Pick a starting point. You can change everything later."
      onClose={onClose}
      busy={creating}
      width={860}
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void create()} disabled={creating}>
            {creating ? 'Creating…' : 'Create project'}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Project name</span>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void create()}
          placeholder="My Story"
        />
      </label>
      <div className="template-grid">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            className={`template-card ${template === tpl.id ? 'selected' : ''}`}
            onClick={() => setTemplate(tpl.id)}
            style={{ '--accent': tpl.accent } as CSSProperties}
          >
            <span className="template-swatch" />
            <strong>{tpl.name}</strong>
            <p>{tpl.description}</p>
          </button>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}
    </Modal>
  );
}
