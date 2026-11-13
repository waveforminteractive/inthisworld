import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { formatTime } from '../shared/ids';
import { createClip } from '../shared/project';
import type { CameraShot, Clip, TrackId } from '../shared/types';
import { useEditor } from '../state/store';
import { IconPause, IconPlay, IconStop, IconTrash } from '../ui/Icons';

const TRACK_ORDER: { id: TrackId; label: string }[] = [
  { id: 'animation', label: 'Animation' },
  { id: 'face', label: 'Face' },
  { id: 'narration', label: 'Narration' },
  { id: 'music', label: 'Music' },
  { id: 'sfx', label: 'SFX' },
  { id: 'text', label: 'Text' },
  { id: 'particles', label: 'Particles' },
  { id: 'events', label: 'Events' },
];

export function Timeline() {
  const project = useEditor((s) => s.project)!;
  const playhead = useEditor((s) => s.playhead);
  const playing = useEditor((s) => s.playing);
  const selection = useEditor((s) => s.selection);
  const [zoom, setZoom] = useState(80);
  const scrollRef = useRef<HTMLDivElement>(null);
  const state = useEditor.getState();
  const scene = project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];
  const width = Math.max(320, scene.duration * zoom);
  const snap = (value: number) => Math.round(value * 20) / 20;

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !playing) return;
    const x = playhead * zoom;
    if (x < scroller.scrollLeft + 40 || x > scroller.scrollLeft + scroller.clientWidth - 80) {
      scroller.scrollLeft = Math.max(0, x - scroller.clientWidth * 0.35);
    }
  }, [playhead, playing, zoom]);

  const timeFromEvent = (clientX: number) => {
    const scroller = scrollRef.current;
    if (!scroller) return 0;
    const rect = scroller.getBoundingClientRect();
    return Math.max(0, Math.min(scene.duration, (clientX - rect.left + scroller.scrollLeft) / zoom));
  };

  const scrub = (event: ReactPointerEvent) => {
    state.setPlaying(false);
    state.setPlayhead(timeFromEvent(event.clientX));
    const move = (moveEvent: PointerEvent) => state.setPlayhead(timeFromEvent(moveEvent.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const dragClip = (event: ReactPointerEvent, clip: Clip, mode: 'move' | 'resize') => {
    event.stopPropagation();
    const startX = event.clientX;
    const originalStart = clip.start;
    const originalDuration = clip.duration;
    let started = false;
    const move = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / zoom;
      if (!started && Math.abs(moveEvent.clientX - startX) < 3) return;
      if (!started) {
        started = true;
        state.checkpoint();
        state.setSelection({ type: 'clip', id: clip.id });
      }
      if (mode === 'move') {
        const nextStart = Math.max(0, Math.min(scene.duration - originalDuration, snap(originalStart + delta)));
        state.updateClip(clip.id, (target) => (target.start = nextStart), false);
      } else {
        const nextDuration = Math.max(
          0.2,
          Math.min(scene.duration - originalStart, snap(originalDuration + delta)),
        );
        state.updateClip(clip.id, (target) => (target.duration = nextDuration), false);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!started) state.setSelection({ type: 'clip', id: clip.id });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const dragShot = (event: ReactPointerEvent, shot: CameraShot, mode: 'move' | 'resize') => {
    event.stopPropagation();
    const startX = event.clientX;
    const originalStart = shot.start;
    const originalDuration = shot.duration;
    let started = false;
    const move = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / zoom;
      if (!started && Math.abs(moveEvent.clientX - startX) < 3) return;
      if (!started) {
        started = true;
        state.checkpoint();
        state.setSelection({ type: 'shot', id: shot.id });
      }
      if (mode === 'move') {
        const nextStart = Math.max(0, Math.min(scene.duration - originalDuration, snap(originalStart + delta)));
        state.updateShot(shot.id, (target) => (target.start = nextStart), false);
      } else {
        const nextDuration = Math.max(
          0.5,
          Math.min(scene.duration - originalStart, snap(originalDuration + delta)),
        );
        state.updateShot(shot.id, (target) => (target.duration = nextDuration), false);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!started) state.setSelection({ type: 'shot', id: shot.id });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const addCaption = () => {
    state.addClip(
      createClip('text', 'Caption', playhead, Math.min(3, Math.max(1, scene.duration - playhead)), {
        text: 'New caption',
      }),
    );
  };

  const addNarration = () => {
    state.addClip(
      createClip('narration', 'Narration', playhead, Math.min(5, Math.max(1, scene.duration - playhead)), {
        text: 'Write your narration here, then generate it in the inspector.',
        voiceId: 'narrator-male',
        emotion: 'calm',
        speed: 1,
        pitch: 0,
      }),
    );
  };

  const addSfx = () => {
    state.addClip(
      createClip('sfx', 'Sound effect', playhead, Math.min(2, Math.max(0.5, scene.duration - playhead)), {
        audioFile: 'assets/sfx/whoosh.wav',
        assetId: 'sfx-whoosh',
        volume: 0.8,
      }),
    );
  };

  const addAnimation = () => {
    const object =
      selection?.type === 'object' ? scene.objects.find((o) => o.id === selection.id) : null;
    if (!object || (object.kind !== 'character' && object.kind !== 'monster')) {
      state.toast('Select a character to add an animation clip.', 'info');
      return;
    }
    state.addClip(
      createClip('animation', object.animation ?? 'Idle', playhead, 3, {
        targetId: object.id,
        animation: object.animation ?? 'idle',
        speed: 1,
      }),
    );
  };

  const ticks: number[] = [];
  for (let t = 0; t <= scene.duration + 0.001; t += scene.duration > 40 ? 5 : scene.duration > 20 ? 2 : 1) {
    ticks.push(Number(t.toFixed(2)));
  }

  return (
    <section className="timeline">
      <header className="timeline-head">
        <div className="timeline-title">
          <h2>Timeline</h2>
          <span className="count">{formatTime(scene.duration)} · {scene.name}</span>
        </div>
        <div className="timeline-actions">
          <button className="icon-btn" title="Jump to start" onClick={() => state.setPlayhead(0)}>
            <IconStop size={15} />
          </button>
          <button
            className="icon-btn"
            title={playing ? 'Pause' : 'Play'}
            onClick={() => {
              if (playing) state.setPlaying(false);
              else {
                state.setCameraPreview(true);
                state.setPlaying(true);
              }
            }}
          >
            {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
          </button>
          <span className="timeline-clock">{formatTime(playhead)}</span>
          <button className="btn ghost small" onClick={addAnimation}>
            + Animation
          </button>
          <button className="btn ghost small" onClick={addNarration}>
            + Narration
          </button>
          <button className="btn ghost small" onClick={addCaption}>
            + Caption
          </button>
          <button className="btn ghost small" onClick={addSfx}>
            + SFX
          </button>
          {selection?.type === 'clip' && (
            <button className="icon-btn danger" title="Delete clip" onClick={() => state.removeClip(selection.id)}>
              <IconTrash size={15} />
            </button>
          )}
          {selection?.type === 'shot' && (
            <button className="icon-btn danger" title="Delete shot" onClick={() => state.removeShot(selection.id)}>
              <IconTrash size={15} />
            </button>
          )}
          <div className="zoom">
            <button className="icon-btn small" onClick={() => setZoom((z) => Math.max(24, z - 16))} title="Zoom out">
              −
            </button>
            <span>{Math.round(zoom)}</span>
            <button className="icon-btn small" onClick={() => setZoom((z) => Math.min(320, z + 16))} title="Zoom in">
              +
            </button>
          </div>
        </div>
      </header>

      <div className="timeline-body">
        <div className="track-labels">
          <div className="ruler-spacer">Camera</div>
          {TRACK_ORDER.map((track) => (
            <div key={track.id} className="track-label">
              {track.label}
            </div>
          ))}
        </div>
        <div className="timeline-scroll" ref={scrollRef}>
          <div className="timeline-content" style={{ width }}>
            <div className="ruler" onPointerDown={scrub}>
              {ticks.map((tick) => (
                <span key={tick} className="tick" style={{ left: tick * zoom }}>
                  {formatTime(tick).replace(':00', '')}
                </span>
              ))}
            </div>
            <div className="shot-row">
              {scene.shots.map((shot) => (
                <div
                  key={shot.id}
                  className={`shot-block ${selection?.type === 'shot' && selection.id === shot.id ? 'active' : ''}`}
                  style={{ left: shot.start * zoom, width: Math.max(20, shot.duration * zoom) }}
                  onPointerDown={(event) => dragShot(event, shot, 'move')}
                  title={`${shot.name} · ${shot.kind}`}
                >
                  <span>{shot.name}</span>
                  <span className="resize" onPointerDown={(event) => dragShot(event, shot, 'resize')} />
                </div>
              ))}
              {scene.shots.length === 0 && <span className="empty-row">Add camera shots from Library → Camera</span>}
            </div>
            {TRACK_ORDER.map((track) => {
              const clips = scene.clips.filter((clip) => clip.track === track.id);
              return (
                <div key={track.id} className="track-row" data-track={track.id}>
                  {clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`clip ${track.id} ${
                        selection?.type === 'clip' && selection.id === clip.id ? 'active' : ''
                      }`}
                      style={{ left: clip.start * zoom, width: Math.max(16, clip.duration * zoom) }}
                      onPointerDown={(event) => dragClip(event, clip, 'move')}
                      onDoubleClick={() => {
                        if (playhead > clip.start && playhead < clip.start + clip.duration) {
                          state.splitClip(clip.id, playhead);
                        }
                      }}
                      title={`${clip.name} · ${formatTime(clip.start)}–${formatTime(clip.start + clip.duration)}`}
                    >
                      <span className="clip-name">{clip.name}</span>
                      <span className="resize" onPointerDown={(event) => dragClip(event, clip, 'resize')} />
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="playhead-line" style={{ left: playhead * zoom }}>
              <span className="playhead-cap" />
            </div>
          </div>
        </div>
      </div>
      <div className="timeline-foot">
        <span>Double-click a clip to split at the playhead · drag edges to trim</span>
        <span>{scene.clips.length} clips · {scene.shots.length} shots</span>
      </div>
    </section>
  );
}
