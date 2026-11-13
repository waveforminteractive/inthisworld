import { useEffect, useState } from 'react';
import type { AISettings, AIProvider, VoiceOption } from '../shared/types';
import { useEditor } from '../state/store';
import { Field, Modal, Toggle } from '../ui/Modal';
import { IconChevron, IconSparkles } from '../ui/Icons';

const PROVIDERS: { id: AIProvider; name: string; baseUrl: string; note: string }[] = [
  {
    id: 'opencode',
    name: 'OpenCode',
    baseUrl: 'https://opencode.ai/inference/openai/v1',
    note: 'Paste your OpenCode Console API key. Paid models (or an OpenCode Go plan) are the reliable choice for external apps.',
  },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', note: 'Use your own OpenAI API key.' },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    note: 'Hundreds of models through one OpenAI-compatible key.',
  },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', note: 'Fast hosted inference.' },
  { id: 'together', name: 'Together', baseUrl: 'https://api.together.xyz/v1', note: 'Open models through a unified API.' },
  { id: 'custom', name: 'Custom', baseUrl: '', note: 'Any OpenAI-compatible server, including your own.' },
];

type Tab = 'ai' | 'studio' | 'narration';

export function SettingsModal() {
  const close = () => useEditor.getState().setModal(null);
  const setModal = useEditor((s) => s.setModal);
  const toast = useEditor((s) => s.toast);
  const [tab, setTab] = useState<Tab>('ai');
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [privacy, setPrivacy] = useState('');
  const [info, setInfo] = useState<{ version: string; projectsRoot: string; ffmpeg: string | null } | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [ttsProbe, setTtsProbe] = useState<{ piper: boolean; sapi: boolean; note: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [ai, notice, appInfo, voiceList, probe] = await Promise.all([
          window.api.ai.getSettings(),
          window.api.ai.privacyNotice(),
          window.api.app.getInfo(),
          window.api.tts.listVoices(),
          window.api.tts.probe(),
        ]);
        setSettings(ai);
        setPrivacy(notice);
        setInfo(appInfo);
        setVoices(voiceList);
        setTtsProbe(probe);
      } catch (error) {
        setStatus((error as Error).message);
      }
    })();
  }, []);

  const save = async (extra?: { fetchModels?: boolean; test?: boolean }) => {
    if (!settings) return;
    setBusy(extra?.fetchModels ? 'models' : extra?.test ? 'test' : 'save');
    try {
      const next = await window.api.ai.saveSettings({
        enabled: settings.enabled,
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        model: settings.model,
        key: keyInput.trim() || undefined,
      });
      setSettings(next);
      setKeyInput('');
      if (extra?.fetchModels) {
        const result = await window.api.ai.fetchModels();
        if (result.ok && result.models) {
          setModels(result.models);
          setStatus(`Found ${result.models.length} models. Pick one from the list.`);
          if (!next.model && result.models.length) {
            const preferred = result.models.find((m) => /gpt|claude|gemini|qwen|glm|pickle/i.test(m)) ?? result.models[0];
            setSettings({ ...next, model: preferred });
          }
        } else {
          setStatus(result.error ?? 'Could not fetch models.');
        }
      } else if (extra?.test) {
        const result = await window.api.ai.test();
        setStatus(result.message);
        setSettings(await window.api.ai.getSettings());
        toast(result.ok ? 'Director AI connected.' : result.message, result.ok ? 'success' : 'error');
      } else {
        toast('AI settings saved.', 'success');
      }
    } catch (error) {
      setStatus((error as Error).message);
      toast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const clearKey = async () => {
    try {
      const next = await window.api.ai.clearKey();
      setSettings(next);
      setStatus('API key removed from secure storage.');
      toast('API key cleared.', 'success');
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };

  const provider = PROVIDERS.find((p) => p.id === settings?.provider) ?? PROVIDERS[0];

  return (
    <Modal
      title="Settings"
      subtitle="Offline by default. Director AI is the only optional network feature."
      onClose={close}
      width={880}
      footer={
        <>
          <button className="btn ghost" onClick={close}>
            Close
          </button>
          <button className="btn primary" onClick={() => void save()} disabled={Boolean(busy) || !settings}>
            {busy === 'save' ? 'Saving…' : 'Save settings'}
          </button>
        </>
      }
    >
      <div className="settings-layout">
        <nav className="settings-nav">
          <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
            <IconSparkles size={16} /> Director AI
          </button>
          <button className={tab === 'narration' ? 'active' : ''} onClick={() => setTab('narration')}>
            Narration engine
          </button>
          <button className={tab === 'studio' ? 'active' : ''} onClick={() => setTab('studio')}>
            Studio & files
          </button>
        </nav>

        <div className="settings-body">
          {tab === 'ai' && settings && (
            <>
              <div className="callout">
                <strong>Optional · remote · user-connected</strong>
                <p>{privacy}</p>
              </div>
              <Toggle
                label="Enable Director AI"
                hint="Disabled by default. Nothing is sent until you click an AI action."
                checked={settings.enabled}
                onChange={(enabled) => setSettings({ ...settings, enabled })}
              />
              <div className="provider-pills">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    className={`chip ${settings.provider === p.id ? 'active' : ''}`}
                    onClick={() =>
                      setSettings({ ...settings, provider: p.id, baseUrl: p.baseUrl || settings.baseUrl })
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <p className="micro-note">{provider.note}</p>
              <Field label="Base URL" hint="OpenAI-compatible root, usually ending in /v1">
                <input
                  value={settings.baseUrl}
                  onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </Field>
              <Field label="API key" hint={settings.hasKey ? 'A key is stored securely. Leave blank to keep it.' : 'Stored in the OS keychain, never in project files.'}>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(event) => setKeyInput(event.target.value)}
                  placeholder={settings.hasKey ? '••••••••••••••••' : 'sk-…'}
                  autoComplete="off"
                />
              </Field>
              <div className="row-actions">
                <button className="btn ghost" onClick={() => void save({ fetchModels: true })} disabled={Boolean(busy)}>
                  {busy === 'models' ? 'Fetching…' : 'Fetch models'}
                </button>
                <button className="btn ghost" onClick={() => void save({ test: true })} disabled={Boolean(busy)}>
                  {busy === 'test' ? 'Testing…' : 'Test connection'}
                </button>
                {settings.hasKey && (
                  <button className="btn ghost danger" onClick={() => void clearKey()}>
                    Clear key
                  </button>
                )}
                <span className={`status-pill ${settings.hasKey ? 'ok' : ''}`}>
                  {settings.hasKey ? 'Key stored' : 'No key'}
                </span>
              </div>
              <Field label="Model" hint="Fetch models or type a model ID">
                <input
                  value={settings.model}
                  onChange={(event) => setSettings({ ...settings, model: event.target.value })}
                  placeholder="model-id"
                  list="ai-models"
                />
                <datalist id="ai-models">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
              {status && <div className="status-line">{status}</div>}
              {settings.lastTest && (
                <p className={`micro-note ${settings.lastTest.ok ? 'ok' : 'bad'}`}>
                  Last test: {settings.lastTest.message}
                </p>
              )}
              <p className="micro-note">
                OpenCode: free-tier chat models generally require the OpenCode client, so paid models (or an OpenCode Go
                subscription) are the reliable choice from this app. Availability and pricing are set by OpenCode and may
                change. No default key is bundled.
              </p>
            </>
          )}

          {tab === 'narration' && (
            <>
              <div className="callout">
                <strong>Offline narration</strong>
                <p>{ttsProbe?.note ?? 'Checking narration engine…'}</p>
              </div>
              <div className="voice-grid">
                {voices.map((voice) => (
                  <div key={voice.id} className="voice-card">
                    <strong>{voice.name}</strong>
                    <p>{voice.description}</p>
                    <span>{voice.engine}</span>
                  </div>
                ))}
              </div>
              <p className="micro-note">
                Add Piper voices to <code>resources/piper/voices</code> with a matching <code>.onnx</code> file to use
                neural narration. Without Piper, Windows uses the installed offline System.Speech voices. No audio ever
                leaves the computer.
              </p>
            </>
          )}

          {tab === 'studio' && (
            <>
              <Field label="Projects folder">
                <div className="path-box">
                  <code>{info?.projectsRoot ?? 'Loading…'}</code>
                  <button className="btn ghost small" onClick={() => info && window.api.app.openPath(info.projectsRoot)}>
                    Open
                  </button>
                </div>
              </Field>
              <Field label="FFmpeg">
                <div className="path-box">
                  <code>{info?.ffmpeg ?? 'Not detected — MP4 export will be unavailable'}</code>
                </div>
              </Field>
              <div className="row-actions">
                <button className="btn ghost" onClick={() => setModal({ type: 'licenses' })}>
                  Licenses & attributions <IconChevron size={14} />
                </button>
                <button className="btn ghost" onClick={() => setModal({ type: 'errors' })}>
                  Error log
                </button>
              </div>
              <div className="callout">
                <strong>Privacy</strong>
                <p>
                  This studio makes no background requests and collects no telemetry. Projects, caches and narration stay
                  on disk. The only outbound requests are to the AI endpoint you configure, and only when you ask for an AI
                  action.
                </p>
              </div>
              <p className="micro-note">Version {info?.version ?? '—'}</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
