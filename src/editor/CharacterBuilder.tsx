import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BUILT_IN_CHARACTERS,
  BUILT_IN_MONSTERS,
  autoColliders,
  makeHumanoid,
  makeMonster,
  makePart,
} from '../shared/characters';
import { createObject } from '../shared/project';
import { uid } from '../shared/ids';
import type { CharacterDef, CharacterPart, MaterialKind, PartKind } from '../shared/types';
import { useEditor } from '../state/store';
import { animateCharacter, buildCharacter } from '../three/rig';
import { Field, Modal, Toggle } from '../ui/Modal';
import { IconPlus, IconTrash, IconWand } from '../ui/Icons';

const PART_KINDS: PartKind[] = [
  'torso',
  'head',
  'armL',
  'armR',
  'handL',
  'handR',
  'legL',
  'legR',
  'footL',
  'footR',
  'hat',
  'hair',
  'horn',
  'eye',
  'tail',
  'wing',
  'accessory',
];

const MATERIALS: MaterialKind[] = ['matte', 'plastic', 'metal', 'glow'];

const COLORS = ['#e8b98a', '#c58b62', '#f2c14e', '#6c7bff', '#5b8cff', '#ff6b6b', '#7ed957', '#b58cff', '#2f3446'];

function defaultPart(kind: PartKind, index: number): CharacterPart {
  const sizes: Record<string, [number, number, number]> = {
    torso: [1.2, 1.4, 0.65],
    head: [1, 1, 1],
    armL: [0.35, 1.2, 0.35],
    armR: [0.35, 1.2, 0.35],
    handL: [0.3, 0.3, 0.3],
    handR: [0.3, 0.3, 0.3],
    legL: [0.5, 1.3, 0.5],
    legR: [0.5, 1.3, 0.5],
    footL: [0.55, 0.3, 0.8],
    footR: [0.55, 0.3, 0.8],
    hat: [1.1, 0.3, 1.1],
    hair: [1.02, 0.35, 1.02],
    horn: [0.2, 0.6, 0.2],
    eye: [0.2, 0.2, 0.1],
    tail: [0.25, 1, 0.25],
    wing: [1.4, 1, 0.15],
    accessory: [0.35, 0.35, 0.2],
  };
  return makePart(
    kind,
    `${kind[0].toUpperCase()}${kind.slice(1)} ${index + 1}`,
    sizes[kind] ?? [0.5, 0.5, 0.5],
    [0, 1.4, 0],
    COLORS[index % COLORS.length],
    kind === 'eye' ? 'glow' : 'matte',
  );
}

function resolveInitial(payload: { objectId?: string; assetId?: string }, project: NonNullable<ReturnType<typeof useEditor.getState>['project']>): CharacterDef {
  if (payload.objectId) {
    const scene = project.scenes.find((s) => s.id === project.activeSceneId);
    const object = scene?.objects.find((o) => o.id === payload.objectId);
    if (object?.character) return structuredClone(object.character);
    if (object) {
      const fromCustom = project.customAssets.find((a) => a.id === object.assetId && a.character);
      if (fromCustom?.character) return structuredClone(fromCustom.character);
      const builtIn = [...BUILT_IN_CHARACTERS, ...BUILT_IN_MONSTERS].find((c) => c.id === object.assetId);
      if (builtIn) return structuredClone(builtIn);
    }
  }
  if (payload.assetId) {
    const fromCustom = project.customAssets.find((a) => a.id === payload.assetId && a.character);
    if (fromCustom?.character) return structuredClone(fromCustom.character);
    const builtIn = [...BUILT_IN_CHARACTERS, ...BUILT_IN_MONSTERS].find((c) => c.id === payload.assetId);
    if (builtIn) return structuredClone(builtIn);
  }
  return makeHumanoid({
    id: uid('char'),
    name: 'New Hero',
    bodyType: 'classic',
    skin: '#e8b98a',
    shirt: '#5b8cff',
    pants: '#3b4158',
  });
}

export function CharacterBuilder({
  payload,
}: {
  payload: { type: 'character'; objectId?: string; assetId?: string };
}) {
  const project = useEditor((s) => s.project)!;
  const close = () => useEditor.getState().setModal(null);
  const toast = useEditor((s) => s.toast);
  const [def, setDef] = useState<CharacterDef>(() => resolveInitial(payload, project));
  const [selectedPartId, setSelectedPartId] = useState<string>(() => def.parts[0]?.id ?? '');
  const [newKind, setNewKind] = useState<PartKind>('accessory');
  const [showColliders, setShowColliders] = useState(false);
  const [saving, setSaving] = useState(false);
  const state = useEditor.getState();
  const selectedPart = def.parts.find((part) => part.id === selectedPartId) ?? def.parts[0] ?? null;
  const isMonster = def.kind === 'monster';

  const patch = (partial: Partial<CharacterDef>) => setDef((current) => ({ ...current, ...partial }));

  const patchPart = (partId: string, partial: Partial<CharacterPart>) =>
    setDef((current) => ({
      ...current,
      parts: current.parts.map((part) => (part.id === partId ? { ...part, ...partial } : part)),
    }));

  const rebuildHumanoid = (bodyType: 'classic' | 'slim' | 'bulky') => {
    const head = def.parts.find((p) => p.kind === 'head');
    const torso = def.parts.find((p) => p.kind === 'torso');
    const legs = def.parts.find((p) => p.kind === 'legL');
    const next = makeHumanoid({
      id: def.id,
      name: def.name,
      bodyType,
      skin: head?.color ?? '#e8b98a',
      shirt: torso?.color ?? '#5b8cff',
      pants: legs?.color ?? '#3b4158',
      hair: def.parts.find((p) => p.kind === 'hair')?.color,
    });
    next.accentColor = def.accentColor;
    setDef(next);
    setSelectedPartId(next.parts[0]?.id ?? '');
  };

  const rebuildMonster = (size: 'small' | 'medium' | 'large') => {
    const torso = def.parts.find((p) => p.kind === 'torso');
    const horn = def.parts.find((p) => p.kind === 'horn');
    const eye = def.parts.find((p) => p.kind === 'eye');
    const next = makeMonster({
      id: def.id,
      name: def.name,
      size,
      body: torso?.color ?? '#59604f',
      accent: horn?.color ?? '#7e8fb8',
      eye: eye?.color ?? '#ffe28a',
      description: def.description ?? 'A homegrown creature.',
    });
    next.accentColor = def.accentColor;
    setDef(next);
    setSelectedPartId(next.parts[0]?.id ?? '');
  };

  const addPart = () => {
    const part = defaultPart(newKind, def.parts.filter((p) => p.kind === newKind).length);
    setDef((current) => ({ ...current, parts: [...current.parts, part] }));
    setSelectedPartId(part.id);
  };

  const removePart = (partId: string) => {
    if (def.parts.length <= 1) return;
    setDef((current) => ({ ...current, parts: current.parts.filter((p) => p.id !== partId) }));
    setSelectedPartId(def.parts.find((p) => p.id !== partId)?.id ?? '');
  };

  const randomize = () => {
    setDef((current) => ({
      ...current,
      parts: current.parts.map((part) => ({
        ...part,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      })),
    }));
  };

  const persistAsset = async (): Promise<{ id: string; name: string }> => {
    const sourceIsCustom = project.customAssets.some((a) => a.id === payload.assetId);
    const id = sourceIsCustom ? payload.assetId! : uid('char');
    const character: CharacterDef = { ...def, id, builtIn: false };
    const asset = await window.api.assets.saveCustomCharacter(project.id, character);
    state.commit((p) => {
      const index = p.customAssets.findIndex((a) => a.id === asset.id);
      if (index >= 0) p.customAssets[index] = asset;
      else p.customAssets.push(asset);
      if (payload.objectId) {
        const scene = p.scenes.find((s) => s.id === p.activeSceneId);
        const object = scene?.objects.find((o) => o.id === payload.objectId);
        if (object) {
          object.assetId = asset.id;
          object.character = undefined;
        }
      }
    });
    setDef(character);
    return asset;
  };

  const saveToLibrary = async () => {
    setSaving(true);
    try {
      await persistAsset();
      toast(`${def.name} saved to My Imports.`, 'success');
      close();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyToObject = () => {
    if (!payload.objectId) return;
    state.updateObject(payload.objectId, (object) => {
      object.character = { ...def, builtIn: false };
      object.name = def.name;
    });
    toast(`${def.name} updated in the scene.`, 'success');
    close();
  };

  const addToScene = async () => {
    setSaving(true);
    try {
      const asset = await persistAsset();
      state.addObject(
        createObject(def.kind === 'monster' ? 'monster' : 'character', asset.id, def.name, [
          Number(((Math.random() - 0.5) * 5).toFixed(2)),
          0,
          Number(((Math.random() - 0.5) * 4).toFixed(2)),
        ]),
      );
      toast(`${def.name} added to the scene.`, 'success');
      close();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={payload.objectId ? 'Edit character' : 'Character builder'}
      subtitle="Blocky, rigged and ready for animation. Saved characters appear in Library → My Imports."
      onClose={close}
      width={1040}
      busy={saving}
      footer={
        <>
          <button className="btn ghost" onClick={close} disabled={saving}>
            Cancel
          </button>
          {payload.objectId ? (
            <>
              <button className="btn ghost" onClick={() => void saveToLibrary()} disabled={saving}>
                Save to library
              </button>
              <button className="btn primary" onClick={applyToObject} disabled={saving}>
                Apply to scene
              </button>
            </>
          ) : (
            <>
              <button className="btn ghost" onClick={() => void saveToLibrary()} disabled={saving}>
                {saving ? 'Saving…' : 'Save to library'}
              </button>
              <button className="btn primary" onClick={() => void addToScene()} disabled={saving}>
                Add to scene
              </button>
            </>
          )}
        </>
      }
    >
      <div className="builder-layout">
        <div className="builder-preview">
          <CharacterPreview def={def} showColliders={showColliders} />
          <div className="builder-preview-tools">
            <Toggle
              label="Collider overlay"
              checked={showColliders}
              onChange={setShowColliders}
              hint="Boxes used for future collisions."
            />
            <button className="btn ghost small" onClick={randomize}>
              <IconWand size={14} /> Randomize colors
            </button>
          </div>
          <div className="builder-presets">
            <span>Body preset</span>
            {isMonster ? (
              <div className="chip-row">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button key={size} className="chip" onClick={() => rebuildMonster(size)}>
                    {size}
                  </button>
                ))}
              </div>
            ) : (
              <div className="chip-row">
                {(['classic', 'slim', 'bulky'] as const).map((body) => (
                  <button
                    key={body}
                    className={`chip ${def.bodyType === body ? 'active' : ''}`}
                    onClick={() => rebuildHumanoid(body)}
                  >
                    {body}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="builder-fields">
          <div className="two-col">
            <Field label="Name">
              <input value={def.name} onChange={(event) => patch({ name: event.target.value })} />
            </Field>
            <Field label="Kind">
              <select
                value={def.kind}
                onChange={(event) => {
                  const kind = event.target.value as CharacterDef['kind'];
                  if (kind === 'monster') rebuildMonster('medium');
                  else rebuildHumanoid('classic');
                }}
              >
                <option value="humanoid">Humanoid</option>
                <option value="monster">Monster</option>
              </select>
            </Field>
          </div>
          <div className="two-col">
            <Field label="Accent color" hint="Library swatch and card color">
              <input
                type="color"
                value={def.accentColor ?? '#6c7bff'}
                onChange={(event) => patch({ accentColor: event.target.value })}
              />
            </Field>
            <Field label="Physics">
              <Toggle
                label="Physics body"
                checked={def.physics}
                onChange={(physics) => patch({ physics })}
              />
            </Field>
          </div>
          <Field label="Description">
            <input
              value={def.description ?? ''}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="A short note about this character"
            />
          </Field>

          <div className="builder-parts">
            <div className="builder-parts-head">
              <h3>Parts ({def.parts.length})</h3>
              <button className="btn ghost small" onClick={() => patch({ colliders: autoColliders(def.parts) })}>
                Rebuild colliders
              </button>
            </div>
            <div className="part-list">
              {def.parts.map((part) => (
                <button
                  key={part.id}
                  className={`part-row ${selectedPartId === part.id ? 'active' : ''}`}
                  onClick={() => setSelectedPartId(part.id)}
                >
                  <span className="part-swatch" style={{ background: part.color }} />
                  <span className="part-name">{part.name}</span>
                  <small>{part.kind}</small>
                </button>
              ))}
            </div>
            <div className="part-add">
              <select value={newKind} onChange={(event) => setNewKind(event.target.value as PartKind)}>
                {PART_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <button className="btn ghost small" onClick={addPart}>
                <IconPlus size={13} /> Add part
              </button>
            </div>
          </div>

          {selectedPart && (
            <div className="part-editor">
              <div className="builder-parts-head">
                <h3>{selectedPart.name}</h3>
                <button
                  className="icon-btn danger"
                  title="Delete part"
                  onClick={() => removePart(selectedPart.id)}
                  disabled={def.parts.length <= 1}
                >
                  <IconTrash size={14} />
                </button>
              </div>
              <div className="two-col">
                <Field label="Part name">
                  <input
                    value={selectedPart.name}
                    onChange={(event) => patchPart(selectedPart.id, { name: event.target.value })}
                  />
                </Field>
                <Field label="Kind">
                  <select
                    value={selectedPart.kind}
                    onChange={(event) =>
                      patchPart(selectedPart.id, { kind: event.target.value as PartKind })
                    }
                  >
                    {PART_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="two-col">
                <Field label="Color">
                  <input
                    type="color"
                    value={selectedPart.color}
                    onChange={(event) => patchPart(selectedPart.id, { color: event.target.value })}
                  />
                </Field>
                <Field label="Material">
                  <select
                    value={selectedPart.material}
                    onChange={(event) =>
                      patchPart(selectedPart.id, { material: event.target.value as MaterialKind })
                    }
                  >
                    {MATERIALS.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Size">
                <Vec3
                  value={selectedPart.size}
                  step={0.05}
                  onChange={(size) => patchPart(selectedPart.id, { size })}
                />
              </Field>
              <Field label="Offset">
                <Vec3
                  value={selectedPart.offset}
                  step={0.05}
                  onChange={(offset) => patchPart(selectedPart.id, { offset })}
                />
              </Field>
              <Field label="Rotation" hint="Degrees">
                <Vec3
                  value={selectedPart.rotation}
                  step={5}
                  onChange={(rotation) => patchPart(selectedPart.id, { rotation })}
                />
              </Field>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Vec3({
  value,
  onChange,
  step,
}: {
  value: [number, number, number];
  onChange: (value: [number, number, number]) => void;
  step: number;
}) {
  return (
    <div className="vec3">
      {(['X', 'Y', 'Z'] as const).map((axis, index) => (
        <label key={axis}>
          <span>{axis}</span>
          <input
            type="number"
            step={step}
            value={Number(value[index].toFixed(3))}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) return;
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

function CharacterPreview({ def, showColliders }: { def: CharacterDef; showColliders: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const defKey = useMemo(() => JSON.stringify(def), [def]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'builder-canvas';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    const rig = buildCharacter(def, showColliders);
    scene.add(rig.group);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x1c202c, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x2b2f3f, 1.4);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb4ff, 1.2);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.target.set(0, rig.height * 0.45, 0);
    camera.position.set(3.2, rig.height * 0.75, 5.4);
    controls.update();

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let raf = 0;
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      animateCharacter(rig, 'idle', t);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      rig.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [defKey, showColliders]);

  return <div className="builder-canvas-wrap" ref={mountRef} />;
}
