import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage.tsx'
import { ReplayPage } from './pages/ReplayPage.tsx'
import { MoodMotionPage } from './pages/MoodMotionPage.tsx'
import { ReadingPage } from './pages/ReadingPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { useReplay } from './components/ReplayProvider.tsx'

function TopBar() {
  const { isRecording, startRecording, stopRecording } = useReplay()

  return (
    <header className="border-b border-border bg-panel/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-lg font-semibold tracking-wide text-indigo-300">
            Neutro Demo
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm text-slate-300">
            <Link to="/" className="rounded-md px-3 py-1 hover:bg-white/5">
              Home
            </Link>
            <Link to="/replay" className="rounded-md px-3 py-1 hover:bg-white/5">
              Replay
            </Link>
            <Link to="/demo/mood-motion" className="rounded-md px-3 py-1 hover:bg-white/5">
              Mood + Motion
            </Link>
            <Link to="/reading" className="rounded-md px-3 py-1 hover:bg-white/5">
              Reading
            </Link>
            <Link to="/settings" className="rounded-md px-3 py-1 hover:bg-white/5">
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              isRecording ? 'bg-rose-500/20 text-rose-200' : 'bg-slate-700 text-slate-300'
            }`}
          >
            Replay {isRecording ? 'REC' : 'OFF'}
          </span>
          <button
            onClick={() => void startRecording()}
            disabled={isRecording}
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Start Replay
          </button>
          <button
            onClick={() => void stopRecording()}
            disabled={!isRecording}
            className="rounded-md border border-rose-300/60 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Stop Replay
          </button>
        </div>
      </div>
    </header>
  )
}

function App() {
  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/replay" element={<ReplayPage />} />
          <Route path="/demo/mood-motion" element={<MoodMotionPage />} />
          <Route path="/reading" element={<ReadingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/replay/:id" element={<Navigate to="/replay" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
