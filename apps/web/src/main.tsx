import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ReplayProvider } from './components/ReplayProvider.tsx'
import { AdaptationProvider } from './components/AdaptationProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AdaptationProvider>
        <ReplayProvider>
          <App />
        </ReplayProvider>
      </AdaptationProvider>
    </HashRouter>
  </StrictMode>,
)
