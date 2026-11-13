import { useEffect, useState } from 'react';
import { useEditor } from '../state/store';
import { Modal } from '../ui/Modal';

export function LicensesModal() {
  const close = () => useEditor.getState().setModal(null);
  const [items, setItems] = useState<{ name: string; license: string; note: string }[]>([]);
  useEffect(() => {
    void window.api.app.openLicenses().then(setItems);
  }, []);
  return (
    <Modal
      title="Licenses & attributions"
      subtitle="Every bundled asset is original or permissively licensed. No Roblox assets or trademarks are included."
      onClose={close}
      width={780}
    >
      <div className="license-list">
        {items.map((item) => (
          <div key={item.name} className="license-item">
            <div>
              <strong>{item.name}</strong>
              <span>{item.license}</span>
            </div>
            <p>{item.note}</p>
          </div>
        ))}
      </div>
      <p className="micro-note">
        This app can import models you own. You are responsible for the licenses of files you import.
      </p>
    </Modal>
  );
}

export function ErrorsModal() {
  const close = () => useEditor.getState().setModal(null);
  const [errors, setErrors] = useState<{ at: string; message: string; detail?: string }[]>([]);
  useEffect(() => {
    void window.api.app.readErrors().then(setErrors);
  }, []);
  return (
    <Modal
      title="Local error log"
      subtitle="Plain text, stored only on this computer. No telemetry."
      onClose={close}
      width={760}
    >
      {errors.length === 0 ? (
        <p className="micro-note">No errors have been logged.</p>
      ) : (
        <div className="error-list">
          {errors.map((entry, index) => (
            <div key={`${entry.at}-${index}`} className="error-item">
              <span>{new Date(entry.at).toLocaleString()}</span>
              <strong>{entry.message}</strong>
              {entry.detail && <pre>{entry.detail}</pre>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
