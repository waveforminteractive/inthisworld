import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

window.addEventListener('error', (event) => {
  void window.api?.app.logError(event.message, event.error?.stack);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason);
  void window.api?.app.logError('Unhandled rejection (renderer)', reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
