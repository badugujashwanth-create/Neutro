import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage.tsx'
import { AdaptationPage } from './pages/AdaptationPage.tsx'

const ReplayPage = lazy(() => import('./pages/ReplayPage.tsx').then((module) => ({ default: module.ReplayPage })))
const MoodMotionPage = lazy(() => import('./pages/MoodMotionPage.tsx').then((module) => ({ default: module.MoodMotionPage })))
const ReadingPage = lazy(() => import('./pages/ReadingPage.tsx').then((module) => ({ default: module.ReadingPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage.tsx').then((module) => ({ default: module.SettingsPage })))

function TopBar() {
  return (
    <header className="border-b border-border bg-panel/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-lg font-semibold tracking-wide text-indigo-300">
            Neutro
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm text-slate-300">
            <Link to="/" className="rounded-md px-3 py-1 hover:bg-white/5">
              Home
            </Link>
            <Link to="/adapt" className="rounded-md px-3 py-1 hover:bg-white/5">
              Adapt
            </Link>
            <Link to="/reading" className="rounded-md px-3 py-1 hover:bg-white/5">
              Reading
            </Link>
            <Link to="/replay" className="rounded-md px-3 py-1 hover:bg-white/5">
              Local labs
            </Link>
            <Link to="/settings" className="rounded-md px-3 py-1 hover:bg-white/5">
              Settings
            </Link>
          </nav>
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
        <Suspense fallback={<p className="rounded-xl border border-border bg-panel/80 p-6 text-sm text-slate-300" role="status">Loading local module…</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/adapt" element={<AdaptationPage />} />
            <Route path="/replay" element={<ReplayPage />} />
            <Route path="/demo/mood-motion" element={<MoodMotionPage />} />
            <Route path="/reading" element={<ReadingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/replay/:id" element={<Navigate to="/replay" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
