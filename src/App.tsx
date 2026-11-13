import { useEffect } from 'react';
import { HomeScreen } from './home/HomeScreen';
import { Editor } from './editor/Editor';
import { SettingsModal } from './app/SettingsModal';
import { LicensesModal, ErrorsModal } from './app/SystemModals';
import { ExportDialog } from './editor/ExportDialog';
import { CharacterBuilder } from './editor/CharacterBuilder';
import { DirectorAI } from './editor/DirectorAI';
import { Toasts } from './ui/Modal';
import { useEditor } from './state/store';

export default function App() {
  const screen = useEditor((s) => s.screen);
  const modal = useEditor((s) => s.modal);
  const project = useEditor((s) => s.project);

  useEffect(() => {
    if (screen === 'editor' && project) document.title = `${project.name} — In This World`;
    else document.title = 'In This World';
  }, [screen, project?.name]);

  return (
    <div className={`app ${screen}`}>
      {screen === 'home' || !project ? <HomeScreen /> : <Editor />}

      {modal?.type === 'settings' && <SettingsModal />}
      {modal?.type === 'licenses' && <LicensesModal />}
      {modal?.type === 'errors' && <ErrorsModal />}
      {modal?.type === 'export' && project && <ExportDialog />}
      {modal?.type === 'character' && project && <CharacterBuilder payload={modal} />}
      {modal?.type === 'director' && project && <DirectorAI seedIdea={modal.seedIdea} />}

      <Toasts />
    </div>
  );
}
