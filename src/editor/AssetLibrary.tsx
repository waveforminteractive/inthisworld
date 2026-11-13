import { useMemo, useState } from 'react';
import {
  ANIMATIONS,
  ASSET_CATEGORIES,
  BUNDLED_MUSIC,
  BUNDLED_SFX,
  CAMERA_SHOTS,
  ENVIRONMENTS,
  FACE_PRESETS,
  PARTICLE_PRESETS,
  PROPS,
  environmentSettings,
} from '../shared/catalog';
import { BUILT_IN_CHARACTERS, BUILT_IN_MONSTERS } from '../shared/characters';
import { createClip, createObject } from '../shared/project';
import { defaultTerrain, randomSeed } from '../three/terrain';
import type { AssetCategory } from '../shared/catalog';
import type { AnimationId, CustomAsset, FaceId, ShotKind, TerrainConfig, TrackId } from '../shared/types';
import { useEditor } from '../state/store';
import { setDragData } from '../lib/dnd';
import { IconMusic, IconPlus, IconSearch, IconSparkles } from '../ui/Icons';

function randomSpot(): [number, number, number] {
  return [Number(((Math.random() - 0.5) * 7).toFixed(2)), 0, Number(((Math.random() - 0.5) * 5).toFixed(2))];
}

export function AssetLibrary() {
  const project = useEditor((s) => s.project)!;
  const selection = useEditor((s) => s.selection);
  const playhead = useEditor((s) => s.playhead);
  const [category, setCategory] = useState<AssetCategory>('Characters');
  const [query, setQuery] = useState('');
  const state = useEditor.getState();
  const scene = project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];

  const matches = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());

  const selectedObject = useMemo(() => {
    if (selection?.type !== 'object') return null;
    return scene.objects.find((o) => o.id === selection.id) ?? null;
  }, [selection, scene.objects]);

  const addCharacter = (id: string, name: string, monster: boolean) => {
    state.addObject(createObject(monster ? 'monster' : 'character', id, name, randomSpot()));
    state.toast(`${name} added to ${scene.name}.`, 'success');
  };

  const addProp = (id: string, name: string) => {
    state.addObject(createObject('prop', id, name, randomSpot()));
  };

  const addParticle = (id: string, name: string) => {
    const preset = PARTICLE_PRESETS.find((p) => p.id === id);
    const object = createObject('emitter', `particle-${id}`, `${name} Emitter`, [0, 0.4, 0]);
    object.particle = preset ? structuredClone(preset.config) : undefined;
    state.addObject(object);
  };

  const addMusic = (file: string, name: string, id: string) => {
    const sceneId = scene.id;
    state.commit((p) => {
      const target = p.scenes.find((s) => s.id === sceneId);
      if (!target) return;
      target.clips = target.clips.filter((c) => c.track !== 'music');
      target.clips.push(
        createClip('music', name, 0, target.duration, {
          assetId: id,
          audioFile: file,
          volume: 0.7,
          fadeIn: 0.8,
          fadeOut: 1.2,
        }),
      );
    });
    state.toast(`${name} is now the scene soundtrack.`, 'success');
  };

  const addSfx = (file: string, name: string, id: string) => {
    const duration = Math.min(3, Math.max(0.5, scene.duration - playhead));
    state.addClip(createClip('sfx', name, playhead, duration, { assetId: id, audioFile: file, volume: 0.8 }));
  };

  const addAnimation = (id: AnimationId, name: string) => {
    if (!selectedObject || (selectedObject.kind !== 'character' && selectedObject.kind !== 'monster')) {
      state.toast('Select a character or monster first, then click an animation.', 'info');
      return;
    }
    state.updateObject(selectedObject.id, (object) => {
      object.animation = id;
    });
    state.addClip(
      createClip('animation', name, playhead, Math.min(4, Math.max(0.5, scene.duration - playhead)), {
        targetId: selectedObject.id,
        animation: id,
        speed: 1,
      }),
    );
    state.toast(`${name} queued for ${selectedObject.name}.`, 'success');
  };

  const addFace = (id: FaceId, name: string) => {
    if (!selectedObject || (selectedObject.kind !== 'character' && selectedObject.kind !== 'monster')) {
      state.toast('Select a character first to change its expression.', 'info');
      return;
    }
    state.updateObject(selectedObject.id, (object) => {
      object.face = id;
    });
    state.addClip(
      createClip('face', name, playhead, Math.min(3, Math.max(0.5, scene.duration - playhead)), {
        targetId: selectedObject.id,
        face: id,
      }),
    );
  };

  const addNarration = () => {
    state.addClip(
      createClip('narration', 'Narration', playhead, Math.min(5, Math.max(1, scene.duration - playhead)), {
        text: 'Write your narration here, then press Generate.',
        voiceId: 'narrator-male',
        emotion: 'calm',
        speed: 1,
        pitch: 0,
      }),
    );
    state.toast('Narration clip added. Edit the words in the inspector.', 'success');
  };

  const addCaption = () => {
    state.addClip(
      createClip('text', 'Caption', playhead, Math.min(3.5, Math.max(1, scene.duration - playhead)), {
        text: 'A new story begins.',
      }),
    );
  };

  const addShot = (kind: ShotKind) => {
    state.addShot(kind, playhead);
    state.toast('Camera shot added at the playhead.', 'success');
  };

  const applyEnvironment = (id: string) => {
    state.updateScene(scene.id, (target) => {
      target.environment = environmentSettings(id as never);
      if (!target.terrain) target.terrain = defaultTerrain(randomSeed());
    });
    state.toast('Environment changed.', 'success');
  };

  const applyTerrain = (preset: 'hills' | 'mountains' | 'flat' | 'islands') => {
    const base = defaultTerrain(randomSeed());
    const terrain: TerrainConfig = {
      ...base,
      type: preset,
      amplitude: preset === 'mountains' ? 9 : preset === 'flat' ? 0.25 : preset === 'islands' ? 5 : 4.2,
      waterLevel: preset === 'islands' ? 0.4 : null,
    };
    state.updateScene(scene.id, (target) => {
      target.terrain = terrain;
    });
    state.toast(`${preset[0].toUpperCase()}${preset.slice(1)} terrain applied.`, 'success');
  };

  const patchSettings = (mutator: (settings: typeof project.settings) => void) => {
    state.commit((p) => mutator(p.settings));
  };

  const registerAsset = (asset: CustomAsset, openObject = false) => {
    state.commit((p) => {
      if (!p.customAssets.some((a) => a.id === asset.id)) p.customAssets.push(asset);
    });
    if (openObject && asset.type === 'model') {
      const object = createObject('imported', asset.id, asset.name, [0, 0, 0]);
      state.addObject(object);
      state.toast(`${asset.name} imported. Drag more from My Imports.`, 'success');
    } else if (asset.type === 'audio' && asset.file) {
      state.addClip(
        createClip('sfx', asset.name, playhead, 3, {
          assetId: asset.id,
          audioFile: asset.file,
          volume: 0.8,
        }),
      );
      state.toast(`${asset.name} added to the timeline.`, 'success');
    } else {
      state.toast(`${asset.name} added to My Imports.`, 'success');
    }
  };

  const importFile = async (kind: 'audio' | 'face' | 'model') => {
    const asset =
      kind === 'audio'
        ? await window.api.assets.importAudio(project.id)
        : kind === 'face'
          ? await window.api.assets.importFace(project.id)
          : await window.api.assets.importModel(project.id);
    if (asset) registerAsset(asset, true);
  };

  const search = () => query.trim();

  return (
    <section className="asset-library">
      <header className="panel-head">
        <h2>Library</h2>
        <span className="count">{scene.objects.length} in scene</span>
      </header>
      <div className="library-search">
        <IconSearch size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets…" />
      </div>
      <div className="category-row">
        {ASSET_CATEGORIES.map((item) => (
          <button key={item} className={item === category ? 'active' : ''} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="asset-scroll">
        {category === 'Characters' && (
          <>
            <div className="asset-grid">
              {BUILT_IN_CHARACTERS.filter((c) => !search() || matches(c.name)).map((character) => (
                <button
                  key={character.id}
                  className="asset-card"
                  draggable
                  onDragStart={(event) =>
                    setDragData(event, { type: 'character', id: character.id, name: character.name })
                  }
                  onClick={() => addCharacter(character.id, character.name, false)}
                >
                  <span className="swatch" style={{ background: character.accentColor ?? '#6c7bff' }} />
                  <strong>{character.name}</strong>
                  <small>{character.bodyType} · blocky</small>
                </button>
              ))}
              <button className="asset-card create" onClick={() => state.setModal({ type: 'character' })}>
                <span className="swatch plus">
                  <IconPlus size={16} />
                </span>
                <strong>New character</strong>
                <small>Build, color, save</small>
              </button>
            </div>
            <h3 className="asset-subhead">Your characters</h3>
            <div className="asset-grid">
              {project.customAssets
                .filter((a) => a.type === 'character' && a.character)
                .filter((a) => !search() || matches(a.name))
                .map((asset) => (
                  <button
                    key={asset.id}
                    className="asset-card"
                    draggable
                    onDragStart={(event) => setDragData(event, { type: 'character', id: asset.id, name: asset.name })}
                    onClick={() => addCharacter(asset.id, asset.name, false)}
                  >
                    <span className="swatch" style={{ background: asset.character?.accentColor ?? '#8f7bff' }} />
                    <strong>{asset.name}</strong>
                    <small>custom character</small>
                  </button>
                ))}
            </div>
            <h3 className="asset-subhead">Expressions {selectedObject ? `· ${selectedObject.name}` : ''}</h3>
            <div className="chip-row wrap">
              {FACE_PRESETS.map((face) => (
                <button key={face.id} className="chip" onClick={() => addFace(face.id, face.name)}>
                  {face.name}
                </button>
              ))}
            </div>
          </>
        )}

        {category === 'Monsters' && (
          <div className="asset-grid">
            {BUILT_IN_MONSTERS.filter((c) => !search() || matches(c.name)).map((monster) => (
              <button
                key={monster.id}
                className="asset-card"
                draggable
                onDragStart={(event) => setDragData(event, { type: 'monster', id: monster.id, name: monster.name })}
                onClick={() => addCharacter(monster.id, monster.name, true)}
              >
                <span className="swatch" style={{ background: monster.accentColor ?? '#ff6b6b' }} />
                <strong>{monster.name}</strong>
                <small>{monster.bodyType} · monster</small>
              </button>
            ))}
          </div>
        )}

        {category === 'Animations' && (
          <>
            <p className="panel-hint">Click to apply to the selected character and add a clip.</p>
            <div className="asset-grid">
              {ANIMATIONS.filter((a) => !search() || matches(a.name)).map((animation) => (
                <button
                  key={animation.id}
                  className="asset-card compact"
                  draggable
                  onDragStart={(event) =>
                    setDragData(event, { type: 'animation', id: animation.id, name: animation.name })
                  }
                  onClick={() => addAnimation(animation.id, animation.name)}
                >
                  <strong>{animation.name}</strong>
                  <small>{animation.description}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {category === 'Props' && (
          <div className="asset-grid">
            {PROPS.filter((p) => !search() || matches(p.name)).map((prop) => (
              <button
                key={prop.id}
                className="asset-card"
                draggable
                onDragStart={(event) => setDragData(event, { type: 'prop', id: prop.id, name: prop.name })}
                onClick={() => addProp(prop.id, prop.name)}
              >
                <span className="swatch prop" />
                <strong>{prop.name}</strong>
                <small>{prop.category}</small>
              </button>
            ))}
          </div>
        )}

        {category === 'Environments' && (
          <div className="asset-grid">
            {ENVIRONMENTS.filter((env) => !search() || matches(env.name)).map((env) => (
              <button
                key={env.id}
                className="asset-card"
                draggable
                onDragStart={(event) => setDragData(event, { type: 'environment', id: env.id, name: env.name })}
                onClick={() => applyEnvironment(env.id)}
              >
                <span className="swatch env" style={{ background: env.skyColor }} />
                <strong>{env.name}</strong>
                <small>{env.description}</small>
              </button>
            ))}
          </div>
        )}

        {category === 'Terrain' && (
          <>
            <p className="panel-hint">Procedural, deterministic terrain per scene.</p>
            <div className="asset-grid">
              {(['hills', 'mountains', 'islands', 'flat'] as const).map((preset) => (
                <button key={preset} className="asset-card compact" onClick={() => applyTerrain(preset)}>
                  <strong>
                    {preset[0].toUpperCase()}
                    {preset.slice(1)}
                  </strong>
                  <small>{preset === 'flat' ? 'Clean stage floor' : 'Seeded heightfield'}</small>
                </button>
              ))}
              <button
                className="asset-card compact create"
                onClick={() =>
                  state.updateScene(scene.id, (target) => {
                    target.terrain = defaultTerrain(randomSeed());
                  })
                }
              >
                <strong>Randomize</strong>
                <small>New seed</small>
              </button>
              <button
                className="asset-card compact create"
                onClick={() => state.updateScene(scene.id, (target) => (target.terrain = null))}
              >
                <strong>Remove terrain</strong>
                <small>Back to ground plane</small>
              </button>
            </div>
          </>
        )}

        {category === 'Particles' && (
          <div className="asset-grid">
            {PARTICLE_PRESETS.filter((p) => !search() || matches(p.name)).map((preset) => (
              <button
                key={preset.id}
                className="asset-card"
                draggable
                onDragStart={(event) => setDragData(event, { type: 'particle', id: preset.id, name: preset.name })}
                onClick={() => addParticle(preset.id, preset.name)}
              >
                <span className="swatch particle" style={{ background: preset.config.color }} />
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>
        )}

        {category === 'Audio/Music' && (
          <>
            <h3 className="asset-subhead">Soundtrack</h3>
            <div className="asset-grid">
              {BUNDLED_MUSIC.filter((m) => !search() || matches(m.name)).map((music) => (
                <button
                  key={music.id}
                  className="asset-card"
                  onClick={() => addMusic(music.file, music.name, music.id)}
                >
                  <IconMusic size={15} />
                  <strong>{music.name}</strong>
                  <small>{music.mood} · royalty-free</small>
                </button>
              ))}
            </div>
            <h3 className="asset-subhead">Sound effects</h3>
            <div className="asset-grid">
              {BUNDLED_SFX.filter((s) => !search() || matches(s.name)).map((sfx) => (
                <button
                  key={sfx.id}
                  className="asset-card compact"
                  onClick={() => addSfx(sfx.file, sfx.name, sfx.id)}
                >
                  <strong>{sfx.name}</strong>
                  <small>add at playhead</small>
                </button>
              ))}
            </div>
            <h3 className="asset-subhead">Narration</h3>
            <button className="wide-action" onClick={addNarration}>
              <IconSparkles size={15} /> Add narration clip
            </button>
            <p className="panel-hint">Offline text-to-speech. Write the line in the inspector, then Generate.</p>
            {project.customAssets.filter((a) => a.type === 'audio').length > 0 && (
              <>
                <h3 className="asset-subhead">Imported audio</h3>
                <div className="asset-grid">
                  {project.customAssets
                    .filter((a) => a.type === 'audio')
                    .map((asset) => (
                      <button
                        key={asset.id}
                        className="asset-card compact"
                        onClick={() =>
                          asset.file &&
                          state.addClip(
                            createClip('sfx', asset.name, playhead, 3, {
                              assetId: asset.id,
                              audioFile: asset.file,
                              volume: 0.8,
                            }),
                          )
                        }
                      >
                        <strong>{asset.name}</strong>
                        <small>imported</small>
                      </button>
                    ))}
                </div>
              </>
            )}
            <button className="wide-action" onClick={() => void importFile('audio')}>
              <IconPlus size={15} /> Import audio file
            </button>
          </>
        )}

        {category === 'Text/Titles' && (
          <>
            <button className="wide-action" onClick={addCaption}>
              <IconPlus size={15} /> Add caption at playhead
            </button>
            <p className="panel-hint">Captions also become soft subtitles in exported videos.</p>
            <div className="asset-grid">
              <button
                className="asset-card compact"
                onClick={() =>
                  state.addClip(createClip('text', 'Title card', 0, 3, { text: scene.name.toUpperCase() }))
                }
              >
                <strong>Scene title</strong>
                <small>Opens the scene</small>
              </button>
              <button
                className="asset-card compact"
                onClick={() =>
                  addClipSafe(state, scene.id, 'text', 'The End', Math.max(0, scene.duration - 3), 3)
                }
              >
                <strong>The End</strong>
                <small>Closing card</small>
              </button>
            </div>
          </>
        )}

        {category === 'Effects' && (
          <>
            <div className="asset-grid">
              <button
                className={`asset-card compact ${project.settings.cinematicLook ? 'on' : ''}`}
                onClick={() =>
                  patchSettings((settings) => {
                    settings.cinematicLook = !settings.cinematicLook;
                  })
                }
              >
                <strong>Cinematic look</strong>
                <small>{project.settings.cinematicLook ? 'On · vignette + contrast' : 'Off'}</small>
              </button>
              <button
                className={`asset-card compact ${project.settings.watermark ? 'on' : ''}`}
                onClick={() =>
                  patchSettings((settings) => {
                    settings.watermark = !settings.watermark;
                  })
                }
              >
                <strong>Watermark</strong>
                <small>{project.settings.watermark ? 'On · “In This World” mark' : 'Off'}</small>
              </button>
              <button
                className={`asset-card compact ${scene.environment.weather !== 'none' ? 'on' : ''}`}
                onClick={() =>
                  state.updateScene(scene.id, (target) => {
                    target.environment.weather = target.environment.weather === 'none' ? 'rain' : 'none';
                  })
                }
              >
                <strong>Weather</strong>
                <small>{scene.environment.weather}</small>
              </button>
            </div>
            <p className="panel-hint">Particles are under their own tab. Look is applied during preview and export.</p>
          </>
        )}

        {category === 'Camera' && (
          <>
            <p className="panel-hint">Shots layer over the scene timeline. Play the scene to preview them.</p>
            <div className="asset-grid">
              {CAMERA_SHOTS.filter((shot) => !search() || matches(shot.name)).map((shot) => (
                <button
                  key={shot.kind}
                  className="asset-card"
                  draggable
                  onDragStart={(event) =>
                    setDragData(event, { type: 'shot', id: shot.kind, name: shot.name })
                  }
                  onClick={() => addShot(shot.kind)}
                >
                  <span className="swatch camera" />
                  <strong>{shot.name}</strong>
                  <small>{shot.description}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {category === 'My Imports' && (
          <>
            <div className="import-actions">
              <button className="wide-action" onClick={() => void importFile('model')}>
                <IconPlus size={15} /> Import .glb / .gltf model
              </button>
              <button className="wide-action" onClick={() => void importFile('audio')}>
                <IconPlus size={15} /> Import audio
              </button>
              <button className="wide-action" onClick={() => void importFile('face')}>
                <IconPlus size={15} /> Import face image
              </button>
            </div>
            <div className="asset-grid">
              {project.customAssets
                .filter((asset) => !search() || matches(asset.name))
                .map((asset) => (
                  <button
                    key={asset.id}
                    className="asset-card"
                    draggable
                    onDragStart={(event) =>
                      asset.type === 'model'
                        ? setDragData(event, { type: 'model', id: asset.id, name: asset.name })
                        : setDragData(event, { type: 'audio', id: asset.id, name: asset.name, file: asset.file })
                    }
                    onClick={() => {
                      if (asset.type === 'model') {
                        state.addObject(createObject('imported', asset.id, asset.name, randomSpot()));
                      } else if (asset.type === 'character' && asset.character) {
                        addCharacter(asset.id, asset.name, asset.character.kind === 'monster');
                      } else if (asset.type === 'audio' && asset.file) {
                        state.addClip(
                          createClip('sfx', asset.name, playhead, 3, {
                            assetId: asset.id,
                            audioFile: asset.file,
                            volume: 0.8,
                          }),
                        );
                      }
                    }}
                  >
                    <span className="swatch import" />
                    <strong>{asset.name}</strong>
                    <small>{asset.type}</small>
                  </button>
                ))}
              {project.customAssets.length === 0 && <p className="panel-hint">Nothing imported yet.</p>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function addClipSafe(
  state: ReturnType<typeof useEditor.getState>,
  sceneId: string,
  track: TrackId,
  name: string,
  start: number,
  duration: number,
) {
  state.addClip(createClip(track, name, start, duration, { text: name }), sceneId);
}
