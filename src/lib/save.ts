import { useEditor } from '../state/store';

let savingPromise: Promise<boolean> | null = null;

export async function saveCurrentProject(quiet = false): Promise<boolean> {
  if (savingPromise) return savingPromise;
  const state = useEditor.getState();
  if (!state.project) return false;
  const project = state.project;
  const revision = state.revision;
  state.setSaving(true);
  savingPromise = (async () => {
    try {
      const result = await window.api.projects.save(project);
      if (!result.ok) {
        useEditor.getState().setSaving(false);
        useEditor.getState().toast(result.error ?? 'Could not save the project.', 'error');
        void window.api.app.logError('Project save failed', result.error);
        return false;
      }
      const current = useEditor.getState();
      if (current.revision === revision) {
        current.markSaved(result.updatedAt);
      } else {
        useEditor.setState({ saving: false, dirty: true, lastSavedAt: result.updatedAt });
      }
      if (!quiet) current.toast('Project saved.', 'success');
      return true;
    } catch (error) {
      useEditor.getState().setSaving(false);
      useEditor.getState().toast((error as Error).message, 'error');
      void window.api.app.logError('Project save exception', (error as Error).stack);
      return false;
    } finally {
      savingPromise = null;
    }
  })();
  return savingPromise;
}
