import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ANIMATIONS,
  BUNDLED_MUSIC,
  BUNDLED_SFX,
  CAMERA_SHOTS,
  EMOTION_PRESETS,
  ENVIRONMENTS,
  FACE_PRESETS,
  LIGHTING_PRESETS,
  PARTICLE_PRESETS,
  STORY_NARRATOR_VOICES,
  environmentSettings,
} from '../shared/catalog';
import { formatTime } from '../shared/ids';
import type {
  AnimationId,
  CameraShot,
  Clip,
  Emotion,
  FaceId,
  LightingPreset,
  ParticleConfig,
  Scene,
  SceneObject,
  TerrainConfig,
  VoiceOption,
} from '../shared/types';
import { useEditor } from '../state/store';
import { createClip } from '../shared/project';
import { Field, Toggle } from '../ui/Modal';
import { IconCamera, IconCopy, IconSparkles, IconTrash, IconWand } from '../ui/Icons';

const TRACK_LABEL: Record<string, string> = {
  animation: 'Animation',
  face: 'Face',
  camera: 'Camera',
  narration: 'Narration',
  music: 'Music',
  sfx: 'Sound effect',
  text: 'Text',
  particles: 'Particles',
  events: 'Event',
};

function Num({
  value,
  onChange,
  step = 0.1,
  min,
  max,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
      step={step}
      min={min}
      max={max}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(next);
      }}
    />
  );
}

function Vec3({
  value,
  onChange,
  step = 0.1,
}: {
  value: [number, number, number];
  onChange: (value: [number, number, number]) => void;
  step?: number;
}) {
  return (
    <div className="vec3">
      {(['X', 'Y', 'Z'] as const).map((axis, index) => (
        <label key={axis}>
          <span>{axis}</span>
          <Num
            value={value[index]}
            step={step}
            onChange={(next) => {
              const copy = [...value] as [number, number, number];
              copy[index] = next;
              onChange(copy);
            }}
          />
        </label>
      ))}
    </div>
  );
}

export function Inspector() {
  const project = useEditor((s) => s.project)!;
  const selection = useEditor((s) => s.selection);
  const [voices, setVoices] = useState<VoiceOption[]>(STORY_NARRATOR_VOICES);
  const [busyClip, setBusyClip] = useState<string | null>(null);
  const state = useEditor.getState();
  const scene = project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];
  const object =
    selection?.type === 'object' ? scene.objects.find((o) => o.id === selection.id) ?? null : null;
  const clip = selection?.type === 'clip' ? scene.clips.find((c) => c.id === selection.id) ?? null : null;
  const shot = selection?.type === 'shot' ? scene.shots.find((s) => s.id === selection.id) ?? null : null;

  useEffect(() => {
    void window.api.tts
      .listVoices()
      .then((list) => list.length && setVoices(list))
      .catch(() => undefined);
  }, []);

  const characters = useMemo(
    () => scene.objects.filter((o) => o.kind === 'character' || o.kind === 'monster'),
    [scene.objects],
  );

  const editScene = (mutator: (target: Scene) => void, record = true) =>
    state.updateScene(scene.id, mutator, record);

  const generateNarration = async (target: Clip) => {
    if (!target.text?.trim()) {
      state.toast('Write the narration line first.', 'info');
      return;
    }
    setBusyClip(target.id);
    try {
      const result = await window.api.tts.generate(project.id, {
        text: target.text,
        voiceId: target.voiceId ?? 'narrator-male',
        emotion: (target.emotion ?? 'calm') as Emotion,
        speed: target.speed ?? 1,
        pitch: target.pitch ?? 0,
        cacheName: target.id,
      });
      if (!result.ok || !result.file) {
        state.toast(result.error ?? 'Narration failed.', 'error');
        return;
      }
      state.updateClip(target.id, (entry) => {
        entry.audioFile = result.file;
        if (result.duration && result.duration > 0.2) {
          entry.duration = Number(result.duration.toFixed(2));
        }
      });
      state.toast(`Narration ready (${result.engine ?? 'offline'}).`, 'success');
    } catch (error) {
      state.toast((error as Error).message, 'error');
    } finally {
      setBusyClip(null);
    }
  };

  const addAnimationClip = () => {
    if (!object) return;
    state.addClip(
      createClip('animation', object.animation ?? 'Idle', state.playhead, 3, {
        targetId: object.id,
        animation: object.animation ?? 'idle',
        speed: 1,
      }),
    );
  };

  if (selection?.type === 'object' && object) {
    return (
      <Panel title="Inspector" subtitle={object.name}>
        <Field label="Name">
          <input
            value={object.name}
            onFocus={() => state.checkpoint()}
            onChange={(event) =>
              state.updateObject(object.id, (target) => (target.name = event.target.value), false)
            }
          />
        </Field>
        <div className="inspector-meta">
          <span>{object.kind}</span>
          <span>{object.kind === 'imported' ? 'imported model' : object.assetId}</span>
        </div>
        <div className="inspector-section">
          <h3>Transform</h3>
          <Field label="Position">
            <Vec3
              value={object.transform.position}
              onChange={(value) =>
                state.updateObject(object.id, (target) => (target.transform.position = value), false)
              }
            />
          </Field>
          <Field label="Rotation" hint="Degrees">
            <Vec3
              value={object.transform.rotation}
              step={1}
              onChange={(value) =>
                state.updateObject(object.id, (target) => (target.transform.rotation = value), false)
              }
            />
          </Field>
          <Field label="Scale">
            <Vec3
              value={object.transform.scale}
              step={0.05}
              onChange={(value) =>
                state.updateObject(object.id, (target) => (target.transform.scale = value), false)
              }
            />
          </Field>
        </div>

        {(object.kind === 'character' || object.kind === 'monster') && (
          <div className="inspector-section">
            <h3>Performance</h3>
            <Field label="Base animation">
              <select
                value={object.animation ?? 'idle'}
                onChange={(event) =>
                  state.updateObject(object.id, (target) => {
                    target.animation = event.target.value as AnimationId;
                  })
                }
              >
                {ANIMATIONS.map((animation) => (
                  <option key={animation.id} value={animation.id}>
                    {animation.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expression">
              <select
                value={object.face ?? 'neutral'}
                onChange={(event) =>
                  state.updateObject(object.id, (target) => {
                    target.face = event.target.value as FaceId;
                  })
                }
              >
                {FACE_PRESETS.map((face) => (
                  <option key={face.id} value={face.id}>
                    {face.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Accent tint">
              <input
                type="color"
                value={object.color ?? object.character?.accentColor ?? '#6c7bff'}
                onChange={(event) =>
                  state.updateObject(object.id, (target) => {
                    target.color = event.target.value;
                  })
                }
              />
            </Field>
            <button className="btn ghost" onClick={addAnimationClip}>
              <IconWand size={15} /> Add animation clip at playhead
            </button>
            <button
              className="btn ghost"
              onClick={() => state.setModal({ type: 'character', objectId: object.id, assetId: object.assetId })}
            >
              Edit character rig
            </button>
          </div>
        )}

        {object.kind === 'emitter' && object.particle && (
          <ParticleEditor
            config={object.particle}
            onChange={(config) =>
              state.updateObject(object.id, (target) => (target.particle = config), false)
            }
          />
        )}

        <div className="inspector-section">
          <Toggle
            label="Hidden"
            hint="Hidden objects are excluded from preview and export."
            checked={Boolean(object.hidden)}
            onChange={(hidden) => state.updateObject(object.id, (target) => (target.hidden = hidden))}
          />
          <div className="row-actions">
            <button className="btn ghost" onClick={() => state.duplicateObject(object.id)}>
              <IconCopy size={14} /> Duplicate
            </button>
            <button className="btn ghost danger" onClick={() => state.removeObject(object.id)}>
              <IconTrash size={14} /> Delete
            </button>
          </div>
        </div>
      </Panel>
    );
  }

  if (selection?.type === 'clip' && clip) {
    return (
      <Panel title="Clip" subtitle={`${TRACK_LABEL[clip.track] ?? clip.track} · ${clip.name}`}>
        <Field label="Name">
          <input
            value={clip.name}
            onFocus={() => state.checkpoint()}
            onChange={(event) =>
              state.updateClip(clip.id, (target) => (target.name = event.target.value), false)
            }
          />
        </Field>
        <div className="two-col">
          <Field label="Start" hint={formatTime(clip.start)}>
            <Num
              value={clip.start}
              min={0}
              max={scene.duration}
              onChange={(value) => state.updateClip(clip.id, (target) => (target.start = value), false)}
            />
          </Field>
          <Field label="Duration" hint={formatTime(clip.duration)}>
            <Num
              value={clip.duration}
              min={0.1}
              max={scene.duration}
              onChange={(value) => state.updateClip(clip.id, (target) => (target.duration = value), false)}
            />
          </Field>
        </div>

        {(clip.track === 'animation' || clip.track === 'face') && (
          <Field label="Target character">
            <select
              value={clip.targetId ?? ''}
              onChange={(event) =>
                state.updateClip(clip.id, (target) => {
                  target.targetId = event.target.value || undefined;
                })
              }
            >
              <option value="">— none —</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {clip.track === 'animation' && (
          <>
            <Field label="Animation">
              <select
                value={clip.animation ?? 'idle'}
                onChange={(event) =>
                  state.updateClip(clip.id, (target) => {
                    target.animation = event.target.value as AnimationId;
                  })
                }
              >
                {ANIMATIONS.map((animation) => (
                  <option key={animation.id} value={animation.id}>
                    {animation.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Speed">
              <Num
                value={clip.speed ?? 1}
                step={0.05}
                min={0.25}
                max={3}
                onChange={(value) => state.updateClip(clip.id, (target) => (target.speed = value), false)}
              />
            </Field>
          </>
        )}

        {clip.track === 'face' && (
          <Field label="Expression">
            <select
              value={clip.face ?? 'neutral'}
              onChange={(event) =>
                state.updateClip(clip.id, (target) => {
                  target.face = event.target.value as FaceId;
                })
              }
            >
              {FACE_PRESETS.map((face) => (
                <option key={face.id} value={face.id}>
                  {face.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {clip.track === 'text' && (
          <Field label="Caption text">
            <textarea
              rows={3}
              value={clip.text ?? ''}
              onFocus={() => state.checkpoint()}
              onChange={(event) =>
                state.updateClip(clip.id, (target) => (target.text = event.target.value), false)
              }
            />
          </Field>
        )}

        {clip.track === 'narration' && (
          <div className="inspector-section narration">
            <h3>Narration</h3>
            <Field label="Line">
              <textarea
                rows={5}
                value={clip.text ?? ''}
                placeholder="Write a line of narration…"
                onFocus={() => state.checkpoint()}
                onChange={(event) =>
                  state.updateClip(clip.id, (target) => (target.text = event.target.value), false)
                }
              />
            </Field>
            <Field label="Voice">
              <select
                value={clip.voiceId ?? 'narrator-male'}
                onChange={(event) =>
                  state.updateClip(clip.id, (target) => (target.voiceId = event.target.value))
                }
              >
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} · {voice.engine}
                  </option>
                ))}
              </select>
            </Field>
            <div className="two-col">
              <Field label="Emotion">
                <select
                  value={clip.emotion ?? 'calm'}
                  onChange={(event) =>
                    state.updateClip(clip.id, (target) => {
                      const emotion = event.target.value as Emotion;
                      const preset = EMOTION_PRESETS.find((e) => e.id === emotion);
                      target.emotion = emotion;
                      if (preset) {
                        target.speed = preset.rate;
                        target.pitch = preset.pitch;
                      }
                    })
                  }
                >
                  {EMOTION_PRESETS.map((emotion) => (
                    <option key={emotion.id} value={emotion.id}>
                      {emotion.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Speed">
                <Num
                  value={clip.speed ?? 1}
                  step={0.05}
                  min={0.5}
                  max={2}
                  onChange={(value) => state.updateClip(clip.id, (target) => (target.speed = value), false)}
                />
              </Field>
            </div>
            <Field label="Pitch">
              <Num
                value={clip.pitch ?? 0}
                step={1}
                min={-10}
                max={10}
                onChange={(value) => state.updateClip(clip.id, (target) => (target.pitch = value), false)}
              />
            </Field>
            <button
              className="btn primary"
              disabled={busyClip === clip.id}
              onClick={() => void generateNarration(clip)}
            >
              <IconSparkles size={15} /> {busyClip === clip.id ? 'Generating offline…' : 'Generate narration'}
            </button>
            {clip.audioFile ? (
              <p className="micro-note ok">Audio ready · {clip.audioFile.split('/').pop()}</p>
            ) : (
              <p className="micro-note">No audio yet. Generation stays on this computer.</p>
            )}
          </div>
        )}

        {(clip.track === 'music' || clip.track === 'sfx' || clip.track === 'narration') && (
          <div className="inspector-section">
            <h3>Audio</h3>
            {clip.track !== 'narration' && (
              <Field label="Source">
                <select
                  value={clip.audioFile ?? ''}
                  onChange={(event) => {
                    const file = event.target.value;
                    const library = [...BUNDLED_MUSIC, ...BUNDLED_SFX];
                    const match = library.find((item) => item.file === file);
                    state.updateClip(clip.id, (target) => {
                      target.audioFile = file || undefined;
                      target.assetId = match?.id;
                    });
                  }}
                >
                  <option value="">— none —</option>
                  {clip.track === 'music' && (
                    <optgroup label="Soundtrack">
                      {BUNDLED_MUSIC.map((music) => (
                        <option key={music.id} value={music.file}>
                          {music.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Effects">
                    {BUNDLED_SFX.map((sfx) => (
                      <option key={sfx.id} value={sfx.file}>
                        {sfx.name}
                      </option>
                    ))}
                  </optgroup>
                  {project.customAssets.filter((a) => a.type === 'audio' && a.file).length > 0 && (
                    <optgroup label="Imported">
                      {project.customAssets
                        .filter((a) => a.type === 'audio' && a.file)
                        .map((asset) => (
                          <option key={asset.id} value={asset.file}>
                            {asset.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </Field>
            )}
            <Field label="Volume">
              <Num
                value={clip.volume ?? 1}
                step={0.05}
                min={0}
                max={2}
                onChange={(value) => state.updateClip(clip.id, (target) => (target.volume = value), false)}
              />
            </Field>
            <div className="two-col">
              <Field label="Fade in">
                <Num
                  value={clip.fadeIn ?? 0}
                  step={0.1}
                  min={0}
                  max={5}
                  onChange={(value) => state.updateClip(clip.id, (target) => (target.fadeIn = value), false)}
                />
              </Field>
              <Field label="Fade out">
                <Num
                  value={clip.fadeOut ?? 0}
                  step={0.1}
                  min={0}
                  max={5}
                  onChange={(value) => state.updateClip(clip.id, (target) => (target.fadeOut = value), false)}
                />
              </Field>
            </div>
          </div>
        )}

        <div className="row-actions">
          <button
            className="btn ghost"
            onClick={() => state.splitClip(clip.id, state.playhead)}
            disabled={state.playhead <= clip.start || state.playhead >= clip.start + clip.duration}
          >
            Split at playhead
          </button>
          <button className="btn ghost danger" onClick={() => state.removeClip(clip.id)}>
            <IconTrash size={14} /> Delete
          </button>
        </div>
      </Panel>
    );
  }

  if (selection?.type === 'shot' && shot) {
    return (
      <Panel title="Camera shot" subtitle={shot.name}>
        <Field label="Name">
          <input
            value={shot.name}
            onFocus={() => state.checkpoint()}
            onChange={(event) =>
              state.updateShot(shot.id, (target) => (target.name = event.target.value), false)
            }
          />
        </Field>
        <Field label="Shot type">
          <select
            value={shot.kind}
            onChange={(event) =>
              state.updateShot(shot.id, (target) => {
                target.kind = event.target.value as CameraShot['kind'];
              })
            }
          >
            {CAMERA_SHOTS.map((kind) => (
              <option key={kind.kind} value={kind.kind}>
                {kind.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Look at">
          <select
            value={shot.targetId ?? ''}
            onChange={(event) =>
              state.updateShot(shot.id, (target) => {
                target.targetId = event.target.value || undefined;
              })
            }
          >
            <option value="">Whole scene</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="two-col">
          <Field label="Start" hint={formatTime(shot.start)}>
            <Num
              value={shot.start}
              min={0}
              max={scene.duration}
              onChange={(value) => state.updateShot(shot.id, (target) => (target.start = value), false)}
            />
          </Field>
          <Field label="Duration" hint={formatTime(shot.duration)}>
            <Num
              value={shot.duration}
              min={0.5}
              max={scene.duration}
              onChange={(value) => state.updateShot(shot.id, (target) => (target.duration = value), false)}
            />
          </Field>
        </div>
        <div className="three-col">
          <Field label="Distance">
            <Num
              value={shot.distance}
              min={2}
              max={60}
              onChange={(value) => state.updateShot(shot.id, (target) => (target.distance = value), false)}
            />
          </Field>
          <Field label="Height">
            <Num
              value={shot.height}
              min={-2}
              max={30}
              onChange={(value) => state.updateShot(shot.id, (target) => (target.height = value), false)}
            />
          </Field>
          <Field label="Angle">
            <Num
              value={shot.angle}
              step={5}
              onChange={(value) => state.updateShot(shot.id, (target) => (target.angle = value), false)}
            />
          </Field>
        </div>
        <button
          className="btn ghost"
          onClick={() => {
            state.setPlayhead(shot.start);
            state.setCameraPreview(true);
            state.setPlaying(true);
          }}
        >
          <IconCamera size={15} /> Preview this shot
        </button>
        <button className="btn ghost danger" onClick={() => state.removeShot(shot.id)}>
          <IconTrash size={14} /> Delete shot
        </button>
      </Panel>
    );
  }

  return (
    <Panel title="Scene" subtitle={scene.name}>
      <Field label="Scene name">
        <input
          value={scene.name}
          onFocus={() => state.checkpoint()}
          onChange={(event) => editScene((target) => (target.name = event.target.value), false)}
        />
      </Field>
      <div className="two-col">
        <Field label="Duration" hint={formatTime(scene.duration)}>
          <Num
            value={scene.duration}
            min={1}
            max={600}
            onChange={(value) => editScene((target) => (target.duration = value))}
          />
        </Field>
        <Field label="Include in story">
          <Toggle
            label="Included"
            checked={scene.include}
            onChange={() => state.toggleSceneInclude(scene.id)}
          />
        </Field>
      </div>

      <div className="inspector-section">
        <h3>Backdrop</h3>
        <Field label="Environment">
          <select
            value={scene.environment.preset}
            onChange={(event) =>
              editScene((target) => {
                target.environment = environmentSettings(event.target.value as never);
              })
            }
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lighting">
          <select
            value={scene.environment.lighting}
            onChange={(event) =>
              editScene((target) => {
                target.environment.lighting = event.target.value as LightingPreset;
              })
            }
          >
            {LIGHTING_PRESETS.map((light) => (
              <option key={light.id} value={light.id}>
                {light.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Weather">
          <select
            value={scene.environment.weather}
            onChange={(event) =>
              editScene((target) => {
                target.environment.weather = event.target.value as never;
              })
            }
          >
            <option value="none">None</option>
            <option value="rain">Rain</option>
            <option value="snow">Snow</option>
            <option value="leaves">Leaves</option>
          </select>
        </Field>
        <div className="two-col">
          <Field label="Sky color">
            <input
              type="color"
              value={scene.environment.skyColor}
              onChange={(event) => editScene((target) => (target.environment.skyColor = event.target.value))}
            />
          </Field>
          <Field label="Fog density">
            <Num
              value={scene.environment.fogDensity}
              step={0.002}
              min={0}
              max={0.2}
              onChange={(value) => editScene((target) => (target.environment.fogDensity = value))}
            />
          </Field>
        </div>
      </div>

      <div className="inspector-section">
        <h3>Terrain</h3>
        {scene.terrain ? (
          <TerrainEditor
            terrain={scene.terrain}
            onChange={(terrain) => editScene((target) => (target.terrain = terrain))}
          />
        ) : (
          <p className="micro-note">No terrain on this scene. Add it from Library → Terrain.</p>
        )}
      </div>

      <div className="inspector-section">
        <h3>Project look</h3>
        <Field label="Aspect ratio">
          <select
            value={project.settings.aspectRatio}
            onChange={(event) =>
              state.commit((p) => {
                p.settings.aspectRatio = event.target.value as typeof p.settings.aspectRatio;
              })
            }
          >
            <option value="16:9">16:9 · Cinematic</option>
            <option value="9:16">9:16 · Vertical</option>
            <option value="1:1">1:1 · Square</option>
          </select>
        </Field>
        <Toggle
          label="Cinematic look"
          hint="Vignette and gentle contrast in preview and export."
          checked={project.settings.cinematicLook}
          onChange={(cinematicLook) =>
            state.commit((p) => {
              p.settings.cinematicLook = cinematicLook;
            })
          }
        />
        <Toggle
          label="Watermark"
          hint="Adds a small “In This World” mark to exported frames."
          checked={project.settings.watermark}
          onChange={(watermark) =>
            state.commit((p) => {
              p.settings.watermark = watermark;
            })
          }
        />
      </div>

      <div className="inspector-section">
        <h3>Story</h3>
        <p className="micro-note">
          {project.scenes.length} scenes · {project.scenes.filter((s) => s.include).length} included ·{' '}
          {project.customAssets.length} imported assets
        </p>
        <div className="row-actions">
          <button className="btn ghost" onClick={() => state.addScene()}>
            Add scene
          </button>
          <button
            className="btn ghost danger"
            disabled={project.scenes.length <= 1}
            onClick={() => {
              if (
                window.confirm(
                  `Delete “${scene.name}”? Characters and clips in this scene will be removed from the project.`,
                )
              ) {
                state.deleteScene(scene.id);
              }
            }}
          >
            <IconTrash size={14} /> Delete scene
          </button>
        </div>
      </div>
    </Panel>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="inspector">
      <header className="panel-head">
        <h2>{title}</h2>
        <span className="count" title={subtitle}>
          {subtitle}
        </span>
      </header>
      <div className="inspector-scroll">{children}</div>
    </section>
  );
}

function ParticleEditor({
  config,
  onChange,
}: {
  config: ParticleConfig;
  onChange: (config: ParticleConfig) => void;
}) {
  const update = (partial: Partial<ParticleConfig>) => onChange({ ...config, ...partial });
  return (
    <div className="inspector-section">
      <h3>Particles</h3>
      <Field label="Preset">
        <select
          value={config.preset}
          onChange={(event) => {
            const preset = PARTICLE_PRESETS.find((p) => p.id === event.target.value);
            if (preset) onChange(structuredClone(preset.config));
          }}
        >
          {PARTICLE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="two-col">
        <Field label="Rate">
          <Num value={config.rate} step={1} min={1} max={400} onChange={(rate) => update({ rate })} />
        </Field>
        <Field label="Lifetime">
          <Num value={config.lifetime} step={0.1} min={0.2} max={20} onChange={(lifetime) => update({ lifetime })} />
        </Field>
      </div>
      <div className="two-col">
        <Field label="Start color">
          <input type="color" value={config.color} onChange={(event) => update({ color: event.target.value })} />
        </Field>
        <Field label="End color">
          <input
            type="color"
            value={config.colorEnd}
            onChange={(event) => update({ colorEnd: event.target.value })}
          />
        </Field>
      </div>
      <div className="two-col">
        <Field label="Speed">
          <Num value={config.speed} step={0.1} min={0} max={30} onChange={(speed) => update({ speed })} />
        </Field>
        <Field label="Opacity">
          <Num value={config.opacity} step={0.05} min={0} max={1} onChange={(opacity) => update({ opacity })} />
        </Field>
      </div>
      <Toggle label="Additive glow" checked={config.additive} onChange={(additive) => update({ additive })} />
    </div>
  );
}

function TerrainEditor({
  terrain,
  onChange,
}: {
  terrain: TerrainConfig;
  onChange: (terrain: TerrainConfig) => void;
}) {
  const update = (partial: Partial<TerrainConfig>) => onChange({ ...terrain, ...partial });
  return (
    <>
      <Field label="Shape">
        <select value={terrain.type} onChange={(event) => update({ type: event.target.value as TerrainConfig['type'] })}>
          {(['hills', 'mountains', 'flat', 'islands', 'canyon', 'random'] as const).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>
      <div className="two-col">
        <Field label="Seed">
          <Num value={terrain.seed} step={1} onChange={(seed) => update({ seed: Math.round(seed) })} />
        </Field>
        <Field label="Height">
          <Num value={terrain.amplitude} step={0.2} min={0} max={24} onChange={(amplitude) => update({ amplitude })} />
        </Field>
      </div>
      <div className="two-col">
        <Field label="Grass">
          <input type="color" value={terrain.grassColor} onChange={(event) => update({ grassColor: event.target.value })} />
        </Field>
        <Field label="Rock">
          <input type="color" value={terrain.rockColor} onChange={(event) => update({ rockColor: event.target.value })} />
        </Field>
      </div>
      <Field label="Water level" hint="Leave off for dry land">
        <select
          value={terrain.waterLevel === null ? 'off' : 'on'}
          onChange={(event) => update({ waterLevel: event.target.value === 'on' ? 0.4 : null })}
        >
          <option value="off">Off</option>
          <option value="on">Sea level</option>
        </select>
      </Field>
    </>
  );
}
