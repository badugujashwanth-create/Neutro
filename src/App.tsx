import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage.tsx'
import { ReplayPage } from './pages/ReplayPage.tsx'

function App() {
  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="border-b border-border bg-panel/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold tracking-wide text-indigo-300">
            NEXUS NeuroOS
          </Link>
          <nav className="text-sm text-slate-300">
            <Link className="rounded-md px-3 py-1 hover:bg-white/5" to="/">
              Session Replay
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/replay/:id" element={<ReplayPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
