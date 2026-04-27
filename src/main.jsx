import React from 'react';
import ReactDOM from 'react-dom/client';
// Game logic is now split into ES modules; import via the barrel.
// TODO: import App from './App' once app.js is migrated to a React module (Phase 3).
import * as Logic from './logic.js'; // eslint-disable-line no-unused-vars

function App() {
  return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
