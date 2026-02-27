import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/ToastProvider.tsx'
import { CognitiveLoadProvider } from './components/CognitiveLoadProvider.tsx'
import { TaxGuardProvider } from './components/TaxGuardProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <CognitiveLoadProvider>
          <TaxGuardProvider>
            <App />
          </TaxGuardProvider>
        </CognitiveLoadProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
