import { useMemo, useRef, useState } from 'react';
import { buildSrt, includedScenes, resolutionSize } from '../shared/project';
import { formatTime } from '../shared/ids';
import { useEditor } from '../state/store';
import { renderProjectExport } from '../lib/exportRenderer';
import { saveCurrentProject } from '../lib/save';
import { Field, Modal, Toggle } from '../ui/Modal';
import { IconExport, IconFolder } from '../ui/Icons';

type Transition = 'cut' | 'fade' | 'crossfade' | 'wipe';

export function ExportDialog() {
  const project = useEditor((s) => s.project)!;
  const close = () => useEditor.getState().setModal(null);
  const toast = useEditor((s) => s.toast);
  const preset = project.exportPreset;
  const [mode, setMode] = useState<'single' | 'separate'>(preset.mode);
  const [transition, setTransition] = useState<Transition>(preset.transition);
  const [resolution, setResolution] = useState(preset.resolution);
  const [fps, setFps] = useState<24 | 30 | 60>(preset.fps);
  const [crf, setCrf] = useState(preset.crf);
  const [includeAudio, setIncludeAudio] = useState(preset.includeAudio);
  const [watermark, setWatermark] = useState(preset.watermark || project.settings.watermark);
  const [subtitles, setSubtitles] = useState(true);
  const [testRender, setTestRender] = useState(false);
  const [outputDir, setOutputDir] = useState(preset.lastOutputDir ?? '');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ frame: 0, total: 0, message: '' });
  const [result, setResult] = useState<{ ok: boolean; outputs: string[]; error?: string } | null>(null);
  const cancelled = useRef(false);

  const scenes = useMemo(() => includedScenes(project), [project]);
  const duration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const { width, height } = useMemo(() => {
    const base = resolutionSize(resolution, project.settings.aspectRatio === '9:16');
    if (project.settings.aspectRatio === '1:1') return { width: base.height, height: base.height };
    return base;
  }, [resolution, project.settings.aspectRatio]);
  const totalSeconds = testRender ? Math.min(3, duration) : duration;
  const totalFrames = Math.max(1, Math.round(totalSeconds * fps));
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.frame / progress.total) * 100)) : 0;

  const chooseFolder = async () => {
    const folder = await window.api.export.chooseFolder();
    if (folder) setOutputDir(folder);
  };

  const start = async () => {
    if (scenes.length === 0) {
      toast('Include at least one scene in your story.', 'info');
      return;
    }
    if (!outputDir) {
      toast('Choose an output folder first.', 'info');
      return;
    }
    cancelled.current = false;
    setResult(null);
    setExporting(true);
    setProgress({ frame: 0, total: totalFrames, message: 'Preparing render…' });
    useEditor.getState().commit((p) => {
      p.exportPreset = {
        mode,
        transition,
        resolution,
        fps,
        crf,
        includeAudio,
        watermark,
        lastOutputDir: outputDir,
      };
    });
    await saveCurrentProject(true);
    try {
      const outcome = await renderProjectExport(
        project,
        {
          scenes,
          width,
          height,
          fps,
          crf,
          transition,
          mode,
          watermark,
          testRender,
          includeAudio,
          subtitles,
          outputDir,
          projectName: project.name,
          aspect: project.settings.aspectRatio,
        },
        {
          onProgress: (frame, total, message) => setProgress({ frame, total, message }),
          isCancelled: () => cancelled.current,
        },
      );
      setResult(outcome);
      if (outcome.ok) {
        toast(
          outcome.outputs.length === 1
            ? 'Export complete.'
            : `${outcome.outputs.length} scene videos exported.`,
          'success',
        );
      } else if (outcome.error === 'cancelled') {
        toast('Export cancelled.', 'info');
      } else {
        toast(outcome.error ?? 'Export failed.', 'error');
      }
    } catch (error) {
      setResult({ ok: false, outputs: [], error: (error as Error).message });
      toast((error as Error).message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const saveSrt = async () => {
    const content = buildSrt(project);
    if (!content.trim()) {
      toast('Add captions or narration first.', 'info');
      return;
    }
    const path = await window.api.export.exportSrt(project.id, content, `${project.name}.srt`);
    if (path) toast('Subtitles saved.', 'success');
  };

  return (
    <Modal
      title="Export video"
      subtitle={`${scenes.length} scenes · ${formatTime(duration)} · ${width}×${height} · ${fps} fps`}
      onClose={close}
      width={760}
      busy={exporting}
      footer={
        exporting ? (
          <>
            <button className="btn ghost danger" onClick={() => (cancelled.current = true)}>
              Cancel export
            </button>
            <span className="export-progress-label">
              {progress.message} {percent}%
            </span>
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={close}>
              Close
            </button>
            <button className="btn primary" onClick={() => void start()}>
              <IconExport size={16} /> {testRender ? 'Render 3-second test' : 'Render MP4'}
            </button>
          </>
        )
      }
    >
      {exporting && (
        <div className="export-progress">
          <div className="progress-track">
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="progress-meta">
            <span>{progress.message}</span>
            <span>
              {progress.frame} / {progress.total || totalFrames} frames
            </span>
          </div>
          <p className="micro-note">Rendering happens locally with your GPU. You can keep the app open.</p>
        </div>
      )}

      {!exporting && (
        <>
          <div className="export-grid">
            <Field label="Mode">
              <div className="segmented">
                <button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>
                  One story video
                </button>
                <button className={mode === 'separate' ? 'active' : ''} onClick={() => setMode('separate')}>
                  Separate scenes
                </button>
              </div>
            </Field>
            <Field label="Transitions">
              <select value={transition} onChange={(event) => setTransition(event.target.value as Transition)}>
                <option value="cut">Hard cut</option>
                <option value="fade">Fade to black</option>
                <option value="crossfade">Soft dissolve</option>
                <option value="wipe">Wipe</option>
              </select>
            </Field>
            <Field label="Resolution" hint={`${width} × ${height}`}>
              <select value={resolution} onChange={(event) => setResolution(event.target.value as typeof resolution)}>
                <option value="720p">720p · fast</option>
                <option value="1080p">1080p · recommended</option>
                <option value="4k">4K · slow</option>
              </select>
            </Field>
            <Field label="Frame rate">
              <select value={fps} onChange={(event) => setFps(Number(event.target.value) as 24 | 30 | 60)}>
                <option value={24}>24 fps · cinematic</option>
                <option value={30}>30 fps · standard</option>
                <option value={60}>60 fps · smooth</option>
              </select>
            </Field>
            <Field label="Quality" hint="Lower CRF = higher quality and larger file">
              <input
                type="range"
                min={16}
                max={30}
                value={crf}
                onChange={(event) => setCrf(Number(event.target.value))}
              />
            </Field>
            <Field label="Output folder">
              <div className="path-box">
                <code>{outputDir || 'No folder selected'}</code>
                <button className="btn ghost small" onClick={() => void chooseFolder()}>
                  <IconFolder size={14} /> Choose
                </button>
              </div>
            </Field>
          </div>

          <div className="export-options">
            <Toggle label="Include audio" hint="Narration, music and effects mixed offline." checked={includeAudio} onChange={setIncludeAudio} />
            <Toggle
              label="Burn captions as subtitles"
              hint="Adds a soft subtitle track from caption and narration clips."
              checked={subtitles}
              onChange={setSubtitles}
            />
            <Toggle
              label="Watermark"
              hint="Small “In This World” mark in the lower right."
              checked={watermark}
              onChange={setWatermark}
            />
            <Toggle
              label="Test render"
              hint="Renders only the first 3 seconds so you can check the look."
              checked={testRender}
              onChange={setTestRender}
            />
          </div>

          <div className="export-summary">
            <div>
              <strong>{totalFrames.toLocaleString()}</strong>
              <span>frames</span>
            </div>
            <div>
              <strong>{formatTime(totalSeconds)}</strong>
              <span>runtime</span>
            </div>
            <div>
              <strong>{scenes.length}</strong>
              <span>{mode === 'single' ? 'scenes in one file' : 'files'}</span>
            </div>
            <div>
              <strong>~{Math.max(1, Math.round((width * height * fps * 0.02) / 8 / 1024))}</strong>
              <span>MB per minute</span>
            </div>
          </div>

          <button className="btn ghost" onClick={() => void saveSrt()}>
            Save subtitles (.srt)
          </button>

          {result && (
            <div className={`export-result ${result.ok ? 'ok' : 'bad'}`}>
              <strong>{result.ok ? 'Render complete' : 'Render failed'}</strong>
              {result.error && <p>{result.error}</p>}
              {result.outputs.map((output) => (
                <div key={output} className="output-row">
                  <code>{output}</code>
                  <button className="btn ghost small" onClick={() => void window.api.app.showItemInFolder(output)}>
                    Show in folder
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="micro-note">
            Video is encoded with the bundled FFmpeg. If your computer cannot render 4K in a reasonable time,
            try 1080p.
          </p>
        </>
      )}
    </Modal>
  );
}
