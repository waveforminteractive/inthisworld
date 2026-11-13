import { useEffect, useState } from 'react';
import {
  BUNDLED_MUSIC,
  ENVIRONMENTS,
  PARTICLE_PRESETS,
  environmentSettings,
} from '../shared/catalog';
import { BUILT_IN_CHARACTERS, BUILT_IN_MONSTERS } from '../shared/characters';
import { createClip, createObject, createScene } from '../shared/project';
import { uid } from '../shared/ids';
import type {
  AISettings,
  AnimationId,
  DirectorAction,
  DirectorPlan,
  Emotion,
  FaceId,
  Scene,
  ShotKind,
} from '../shared/types';
import { useEditor } from '../state/store';
import { Field, Modal } from '../ui/Modal';
import { IconSparkles, IconWand } from '../ui/Icons';

const EXAMPLES = [
  'A shy miner finds a glowing crystal under the old forest and must bring it home before the storm.',
  'Two rival scouts race across a snowy ridge to light the beacon first.',
  'A tiny monster learns to dance so the village stops fearing it.',
  'A night-time city chase where a courier outsmarts a shadowy titan.',
];

const SYSTEM_PROMPT = `You are the Director AI inside "In This World", a friendly offline 3D story-video studio for blocky characters.
Turn the user's idea into a short, shootable scene plan using ONLY the JSON schema below.
Return raw JSON only. No markdown, no commentary.

Schema:
{
  "title": "short story title",
  "summary": "one or two sentence summary",
  "actions": [
    {"type":"addScene","name":"Scene name","seconds":8},
    {"type":"setBackdrop","sceneIndex":0,"preset":"forest"},
    {"type":"addCharacter","sceneIndex":0,"character":"Rookie","name":"Rookie"},
    {"type":"setAnimation","sceneIndex":0,"character":"Rookie","animation":"wave"},
    {"type":"addNarration","sceneIndex":0,"text":"Narration line.","emotion":"calm","start":0,"duration":4},
    {"type":"addCaption","sceneIndex":0,"text":"A caption","start":1,"duration":2},
    {"type":"addParticle","sceneIndex":0,"preset":"fire"},
    {"type":"setCameraShot","sceneIndex":0,"kind":"wide","start":0,"duration":4},
    {"type":"setMusic","sceneIndex":0,"mood":"calm"},
    {"type":"setSceneDuration","sceneIndex":0,"seconds":8}
  ]
}

Allowed characters: ${[...BUILT_IN_CHARACTERS, ...BUILT_IN_MONSTERS].map((c) => c.name).join(', ')}.
Allowed backdrops: ${ENVIRONMENTS.map((e) => e.id).join(', ')}.
Allowed animations: idle, walk, run, jump, wave, point, talk, sit, dance, shrug, lookAround, fall, victory, attack, roar.
Allowed emotions: calm, excited, sad, ominous, cheerful.
Allowed camera shots: wide, medium, close, orbit, low, high.
Allowed particle presets: ${PARTICLE_PRESETS.map((p) => p.id).join(', ')}.
Allowed music moods: calm, adventure, ominous.

Rules:
- 2 to 5 scenes. Start every scene with addScene, then setBackdrop, then add 1-2 characters.
- Use sceneIndex to target the scene order in your plan (0-based, addScene actions create those scenes).
- Every scene needs at least one camera shot and one narration or caption line.
- Narration lines should be short (under 30 words) and read aloud naturally.
- Keep it wholesome and cinematic. No real-world brands.`;

function actionLabel(action: DirectorAction): string {
  switch (action.type) {
    case 'addScene':
      return `New scene “${action.name ?? 'Scene'}” · ${action.seconds ?? 8}s`;
    case 'setBackdrop':
      return `Backdrop: ${action.preset ?? 'studio'}`;
    case 'addCharacter':
      return `Cast ${action.name ?? action.character ?? 'character'}`;
    case 'setAnimation':
      return `${action.character ?? 'Character'} · ${action.animation ?? 'idle'}`;
    case 'addNarration':
      return `Narration: “${(action.text ?? '').slice(0, 60)}${(action.text?.length ?? 0) > 60 ? '…' : ''}”`;
    case 'addCaption':
      return `Caption: “${action.text ?? ''}”`;
    case 'addParticle':
      return `Particles: ${action.preset ?? 'dust'}`;
    case 'setCameraShot':
      return `Camera: ${action.kind ?? 'wide'} shot`;
    case 'setMusic':
      return `Music: ${action.mood ?? 'calm'}`;
    case 'setSceneDuration':
      return `Scene length: ${action.seconds ?? 8}s`;
    default:
      return 'Action';
  }
}

function parsePlan(text: string): DirectorPlan {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI response did not contain JSON.');
  const parsed = JSON.parse(text.slice(start, end + 1)) as DirectorPlan;
  if (!parsed || !Array.isArray(parsed.actions)) throw new Error('The AI plan was missing an actions list.');
  const valid = parsed.actions.filter(
    (action) =>
      action &&
      typeof action.type === 'string' &&
      [
        'addScene',
        'addCharacter',
        'setAnimation',
        'addNarration',
        'addCaption',
        'setBackdrop',
        'addParticle',
        'setCameraShot',
        'setMusic',
        'setSceneDuration',
      ].includes(action.type),
  );
  if (!valid.length) throw new Error('The AI plan did not include usable actions.');
  return {
    title: parsed.title || 'Untitled story',
    summary: parsed.summary || '',
    actions: valid.slice(0, 60),
  };
}

export function DirectorAI({ seedIdea }: { seedIdea?: string }) {
  const project = useEditor((s) => s.project)!;
  const close = () => useEditor.getState().setModal(null);
  const toast = useEditor((s) => s.toast);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [idea, setIdea] = useState(seedIdea ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<DirectorPlan | null>(null);
  const state = useEditor.getState();

  useEffect(() => {
    void window.api.ai.getSettings().then(setSettings).catch(() => undefined);
  }, []);

  const generate = async () => {
    if (!idea.trim()) {
      setError('Describe the story you want first.');
      return;
    }
    if (!settings?.enabled) {
      setError('Director AI is disabled. Open Settings → Director AI to connect a provider.');
      return;
    }
    if (!settings.hasKey || !settings.baseUrl || !settings.model) {
      setError('Add a provider, model and API key in Settings → Director AI first.');
      return;
    }
    setBusy(true);
    setError('');
    setPlan(null);
    try {
      const result = await window.api.ai.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Story idea: ${idea.trim()}\n\nCurrent project: "${project.name}" with ${project.scenes.length} scenes. Keep the plan self-contained.`,
        },
      ]);
      if (!result.ok || !result.text) {
        setError(result.error ?? 'The AI request failed.');
        return;
      }
      setPlan(parsePlan(result.text));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!plan) return;
    const nameResolver = (name?: string) => {
      if (!name) return [...BUILT_IN_CHARACTERS, ...BUILT_IN_MONSTERS][0];
      const lowered = name.toLowerCase();
      const builtIn = [...BUILT_IN_CHARACTERS, ...BUILT_IN_MONSTERS].find(
        (c) => c.name.toLowerCase() === lowered || c.id.toLowerCase() === lowered,
      );
      if (builtIn) return builtIn;
      const custom = project.customAssets.find(
        (a) => a.character && a.name.toLowerCase() === lowered,
      );
      return custom?.character ?? [...BUILT_IN_CHARACTERS, ...BUILT_IN_MONSTERS][0];
    };

    state.checkpoint();
    state.update((p) => {
      const sceneIds = p.scenes.map((s) => s.id);
      const getScene = (index = 0): Scene | undefined => {
        const id = sceneIds[index];
        return p.scenes.find((s) => s.id === id);
      };

      const ensureScene = (action: DirectorAction): Scene => {
        const index = action.sceneIndex ?? 0;
        let scene = getScene(index);
        if (!scene) {
          scene = createScene(action.name ?? `Scene ${p.scenes.length + 1}`, 'forest', action.seconds ?? 8);
          p.scenes.push(scene);
          sceneIds.push(scene.id);
        }
        return scene;
      };

      for (const action of plan.actions) {
        if (action.type === 'addScene') {
          const index = Math.max(0, Math.min(action.sceneIndex ?? sceneIds.length, sceneIds.length));
          const scene = createScene(
            action.name ?? `Scene ${p.scenes.length + 1}`,
            'forest',
            action.seconds ?? 8,
          );
          p.scenes.splice(index, 0, scene);
          sceneIds.splice(index, 0, scene.id);
        }
      }

      for (const action of plan.actions) {
        if (action.type === 'addScene') continue;
        const scene = ensureScene(action);
        switch (action.type) {
          case 'setBackdrop': {
            const found = ENVIRONMENTS.find((env) => env.id === action.preset);
            scene.environment = environmentSettings(found?.id ?? 'forest');
            break;
          }
          case 'addCharacter': {
            const character = nameResolver(action.character ?? action.name);
            const object = createObject(
              character.kind === 'monster' ? 'monster' : 'character',
              character.id,
              action.name ?? character.name,
              [Number(((Math.random() - 0.5) * 4).toFixed(2)), 0, Number(((Math.random() - 0.5) * 3).toFixed(2))],
            );
            object.face = 'neutral' as FaceId;
            scene.objects.push(object);
            break;
          }
          case 'setAnimation': {
            const target = scene.objects.find(
              (o) =>
                (o.kind === 'character' || o.kind === 'monster') &&
                (!action.character || o.name.toLowerCase() === action.character.toLowerCase()),
            ) ?? scene.objects.find((o) => o.kind === 'character' || o.kind === 'monster');
            if (target) target.animation = (action.animation ?? 'idle') as AnimationId;
            break;
          }
          case 'addNarration': {
            const text = action.text?.trim();
            if (!text) break;
            const duration = Math.max(
              1,
              Math.min(scene.duration, action.duration ?? Math.min(8, Math.max(2, text.split(/\s+/).length / 2.4))),
            );
            scene.clips.push(
              createClip('narration', 'Narration', action.start ?? 0, duration, {
                text,
                voiceId: 'narrator-male',
                emotion: (action.emotion ?? 'calm') as Emotion,
                speed: 1,
                pitch: 0,
              }),
            );
            break;
          }
          case 'addCaption': {
            if (!action.text?.trim()) break;
            scene.clips.push(
              createClip('text', 'Caption', action.start ?? 0, Math.min(scene.duration, action.duration ?? 3), {
                text: action.text,
              }),
            );
            break;
          }
          case 'addParticle': {
            const preset = PARTICLE_PRESETS.find((p) => p.id === action.preset) ?? PARTICLE_PRESETS[0];
            const object = createObject('emitter', `particle-${preset.id}`, `${preset.name} Emitter`, [0, 0.4, 0]);
            object.particle = structuredClone(preset.config);
            scene.objects.push(object);
            break;
          }
          case 'setCameraShot': {
            scene.shots.push({
              id: uid('shot'),
              name: `${action.kind ?? 'wide'} shot`,
              start: action.start ?? 0,
              duration: Math.max(
                0.5,
                Math.min(scene.duration - (action.start ?? 0), action.duration ?? scene.duration),
              ),
              kind: (action.kind ?? 'wide') as ShotKind,
              distance: 12,
              height: 3.2,
              angle: 0,
            });
            break;
          }
          case 'setMusic': {
            const mood = (action.mood ?? 'calm').toLowerCase();
            const music =
              BUNDLED_MUSIC.find((m) => m.mood === mood) ??
              BUNDLED_MUSIC.find((m) => m.name.toLowerCase().includes(mood)) ??
              BUNDLED_MUSIC[0];
            scene.clips = scene.clips.filter((c) => c.track !== 'music');
            scene.clips.push(
              createClip('music', music.name, 0, scene.duration, {
                assetId: music.id,
                audioFile: music.file,
                volume: 0.6,
                fadeIn: 1,
                fadeOut: 1.5,
              }),
            );
            break;
          }
          case 'setSceneDuration': {
            if (action.seconds) scene.duration = Math.max(2, Math.min(300, action.seconds));
            break;
          }
          default:
            break;
        }
      }
      const firstNew = p.scenes.find((s) => sceneIds.includes(s.id) && !project.scenes.some((old) => old.id === s.id));
      if (firstNew) p.activeSceneId = firstNew.id;
    });
    const activeSceneId = useEditor.getState().project?.activeSceneId;
    if (activeSceneId) state.setSelection({ type: 'scene', id: activeSceneId });
    state.setPlayhead(0);
    toast(`Director plan applied to “${project.name}”.`, 'success');
    close();
  };

  return (
    <Modal
      title="Director AI"
      subtitle="Optional helper. Your idea is sent only when you click Generate."
      onClose={close}
      width={820}
      busy={busy}
      footer={
        <>
          <button className="btn ghost" onClick={close} disabled={busy}>
            Close
          </button>
          <button className="btn ghost" onClick={() => void generate()} disabled={busy}>
            <IconSparkles size={15} /> {busy ? 'Thinking…' : plan ? 'Try another plan' : 'Generate plan'}
          </button>
          <button className="btn primary" onClick={apply} disabled={!plan || busy}>
            <IconWand size={15} /> Apply plan
          </button>
        </>
      }
    >
      {!settings?.enabled ? (
        <div className="callout warn">
          <strong>Director AI is off</strong>
          <p>
            The studio works fully offline without it. To enable optional AI planning, connect any
            OpenAI-compatible provider in Settings → Director AI. The app never sends anything in the
            background.
          </p>
          <button className="btn ghost" onClick={() => state.setModal({ type: 'settings' })}>
            Open AI settings
          </button>
        </div>
      ) : !settings.hasKey ? (
        <div className="callout warn">
          <strong>No API key yet</strong>
          <p>Add a provider, model and key in Settings. Keys are stored with your operating system's secure storage.</p>
          <button className="btn ghost" onClick={() => state.setModal({ type: 'settings' })}>
            Open AI settings
          </button>
        </div>
      ) : (
        <p className="micro-note">
          Connected to {settings.provider} · {settings.model}. Only the text below is sent.
        </p>
      )}

      <Field label="Story idea">
        <textarea
          rows={4}
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          placeholder="A shy miner finds a glowing crystal under the old forest…"
          disabled={busy}
        />
      </Field>
      <div className="chip-row wrap">
        {EXAMPLES.map((example) => (
          <button key={example} className="chip" onClick={() => setIdea(example)} disabled={busy}>
            {example.slice(0, 46)}…
          </button>
        ))}
      </div>

      {error && <div className="callout error">{error}</div>}

      {busy && (
        <div className="ai-thinking">
          <span className="spinner" />
          <p>Writing scenes, camera shots and narration. This can take a few seconds.</p>
        </div>
      )}

      {plan && (
        <div className="plan-preview">
          <header>
            <div>
              <h3>{plan.title}</h3>
              <p>{plan.summary}</p>
            </div>
            <span>{plan.actions.filter((a) => a.type === 'addScene').length} scenes</span>
          </header>
          <ol className="plan-actions">
            {plan.actions.map((action, index) => (
              <li key={index}>
                <span className={`action-kind ${action.type}`}>{action.type}</span>
                <span>{actionLabel(action)}</span>
              </li>
            ))}
          </ol>
          <p className="micro-note">
            Applying adds these scenes to this project. Everything stays editable in the timeline.
          </p>
        </div>
      )}
    </Modal>
  );
}
