import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';

/**
 * Fonts are BUNDLED, not fetched. They used to come from fonts.googleapis.com,
 * which is fatal for the native app: launched without a signal, every heading and
 * readout fell back to Georgia and the whole Marble & Gold look collapsed. Local
 * files also mean no third-party request on cold start, which keeps the privacy
 * policy honest.
 *
 * Only the weights the design actually uses, latin subset only — importing the
 * full families would drag in Cyrillic/Vietnamese/Greek-ext for nothing.
 *   Cinzel  400/600/700 — display headings, always uppercase + wide tracking
 *   Spectral 400/500/600 + 500 italic — body copy and flavour lines
 *   JetBrains Mono 500/600/700 — every number and instrument readout
 */
import '@fontsource/cinzel/latin-400.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/spectral/latin-400.css';
import '@fontsource/spectral/latin-500.css';
import '@fontsource/spectral/latin-500-italic.css';
import '@fontsource/spectral/latin-600.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/jetbrains-mono/latin-700.css';

import './ui/theme/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
