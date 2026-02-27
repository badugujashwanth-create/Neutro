import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { renderBionicSentence } from '../lib/reading/bionic.tsx'
import { extractText, validateReadingFile } from '../lib/reading/fileExtract.ts'
import { readReadingProfile, saveReadingProfile } from '../lib/reading/profile.ts'
import { splitSentences, summarizeText } from '../lib/reading/summarize.ts'
import type { ReadingProfile, ReadingRulerMode, ReadingTheme } from '../types/reading.ts'
import { useReplay } from '../components/ReplayProvider.tsx'

const DEFAULT_TEXT = `Welcome to Reading Mode.

Upload a PDF, DOCX, or TXT file to extract text and apply dyslexia-friendly reading tools.

This page supports:
- adjustable typography
- bionic reading
- reading ruler and mask
- text-to-speech with sentence highlighting
- simple heading outline and in-document search
`

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function themeClass(theme: ReadingTheme): string {
  if (theme === 'light') return 'bg-slate-50 text-slate-900'
  if (theme === 'sepia') return 'bg-amber-50 text-amber-900'
  if (theme === 'high-contrast') return 'bg-black text-yellow-200'
  return 'bg-slate-950 text-slate-100'
}

function fontClass(fontFamily: ReadingProfile['fontFamily']): string {
  return fontFamily === 'opendyslexic' ? 'font-["OpenDyslexic","Verdana","Trebuchet_MS","Arial",sans-serif]' : ''
}

function detectHeadings(lines: string[]): string[] {
  return lines
    .filter((line) => line.length > 3 && line.length < 90)
    .filter((line) => /^#{1,6}\s/.test(line) || /:$/.test(line) || (line === line.toUpperCase() && /\w/.test(line)))
    .slice(0, 24)
}

export function ReadingPage() {
  const { addMarker, isRecording } = useReplay()

  const [fileName, setFileName] = useState('Demo text')
  const [text, setText] = useState(DEFAULT_TEXT)
  const [directText, setDirectText] = useState(DEFAULT_TEXT)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [profile, setProfile] = useState<ReadingProfile>(() => readReadingProfile())
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [ttsIndex, setTtsIndex] = useState(0)
  const [ttsPlaying, setTtsPlaying] = useState(false)
  const [rulerY, setRulerY] = useState(180)
  const [searchTerm, setSearchTerm] = useState('')
  const [scrollProgress, setScrollProgress] = useState(0)

  const viewerRef = useRef<HTMLDivElement | null>(null)
  const speechRef = useRef<{ cancelled: boolean }>({ cancelled: false })

  const paragraphs = useMemo(() => text.split('\n').map((line) => line.trim()).filter(Boolean), [text])
  const sentences = useMemo(() => splitSentences(text), [text])
  const headings = useMemo(() => detectHeadings(text.split('\n').map((line) => line.trim()).filter(Boolean)), [text])
  const summaryPoints = useMemo(() => summarizeText(text, 4), [text])
  const wordCount = useMemo(() => {
    const trimmed = text.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
  }, [text])

  const searchCount = useMemo(() => {
    const term = searchTerm.trim()
    if (!term) return 0
    return text.toLowerCase().split(term.toLowerCase()).length - 1
  }, [searchTerm, text])

  useEffect(() => {
    saveReadingProfile(profile)
  }, [profile])

  useEffect(() => {
    const onVoicesChanged = () => setVoices(window.speechSynthesis.getVoices())
    onVoicesChanged()
    window.speechSynthesis.onvoiceschanged = onVoicesChanged
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  useEffect(() => () => {
    speechRef.current.cancelled = true
    window.speechSynthesis.cancel()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        setProfile((previous) => {
          const nextMode = previous.rulerMode === 'off' ? 'highlight-band' : 'off'
          if (isRecording) {
            addMarker(`Ruler ${nextMode === 'off' ? 'OFF' : 'ON'}`, 'reading')
          }
          return { ...previous, rulerMode: nextMode }
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addMarker, isRecording])

  const updateProfile = <K extends keyof ReadingProfile>(key: K, value: ReadingProfile[K]) => {
    if (isRecording && key === 'rulerMode') {
      addMarker(`Ruler ${(value as string) === 'off' ? 'OFF' : 'ON'}`, 'reading')
    }
    if (isRecording && key === 'bionicEnabled') {
      addMarker(`Bionic ${(value as boolean) ? 'ON' : 'OFF'}`, 'reading')
    }
    setProfile((previous) => ({ ...previous, [key]: value }))
  }

  const onUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const validationError = validateReadingFile(file)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setErrorMessage(null)
    setLoadingFile(true)
    setFileName(file.name)

    try {
      const extracted = await extractText(file)
      if (!extracted) {
        throw new Error('Could not extract readable text from file.')
      }
      setText(extracted)
      setDirectText(extracted)
      setTtsIndex(0)
      if (isRecording) {
        addMarker(`File Uploaded: ${file.name}`, 'reading')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to read file.')
    } finally {
      setLoadingFile(false)
      event.target.value = ''
    }
  }

  const applyDirectText = () => {
    const trimmed = directText.trim()
    if (!trimmed) {
      setErrorMessage('Please enter text before applying.')
      return
    }
    setErrorMessage(null)
    setFileName('Manual text')
    setText(trimmed)
    setTtsIndex(0)
    if (isRecording) {
      addMarker('Manual Text Applied', 'reading')
    }
  }

  const speakFrom = (index: number) => {
    if (index >= sentences.length) {
      setTtsPlaying(false)
      return
    }
    if (speechRef.current.cancelled) return

    const utterance = new SpeechSynthesisUtterance(sentences[index])
    utterance.rate = profile.ttsSpeed
    if (profile.ttsVoiceName) {
      const selected = voices.find((voice) => voice.name === profile.ttsVoiceName)
      if (selected) utterance.voice = selected
    }
    utterance.onend = () => {
      if (speechRef.current.cancelled) return
      const nextIndex = index + 1
      setTtsIndex(nextIndex)
      speakFrom(nextIndex)
    }
    window.speechSynthesis.speak(utterance)
  }

  const onPlayTts = () => {
    speechRef.current.cancelled = false
    window.speechSynthesis.cancel()
    setTtsPlaying(true)
    if (isRecording) addMarker('TTS Started', 'tts')
    speakFrom(ttsIndex)
  }

  const onPauseResumeTts = () => {
    if (!ttsPlaying) return
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      return
    }
    window.speechSynthesis.pause()
  }

  const onStopTts = () => {
    speechRef.current.cancelled = true
    setTtsPlaying(false)
    setTtsIndex(0)
    window.speechSynthesis.cancel()
    if (isRecording) addMarker('TTS Stopped', 'tts')
  }

  const applyRuler = profile.rulerMode !== 'off'
  const highlightedSentence = sentences[ttsIndex] ?? ''

  const renderParagraph = (paragraph: string) => {
    if (profile.bionicEnabled) {
      return paragraph.split('. ').map((line, lineIndex, arr) => (
        <span key={`${line}-${lineIndex}`}>
          {renderBionicSentence(line)}
          {lineIndex < arr.length - 1 ? '. ' : ''}
        </span>
      ))
    }

    if (!searchTerm.trim()) {
      return paragraph
    }

    const matcher = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')
    return paragraph.split(matcher).map((part, index) => {
      if (part.toLowerCase() === searchTerm.toLowerCase()) {
        return (
          <mark key={`${part}-${index}`} className="rounded bg-amber-300/50 px-0.5 text-inherit">
            {part}
          </mark>
        )
      }
      return <span key={`${part}-${index}`}>{part}</span>
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-panel/80 p-6">
        <h1 className="text-2xl font-semibold text-slate-100">Reading Mode</h1>
        <p className="mt-1 text-sm text-slate-300">Upload PDF, DOCX, or TXT and apply dyslexia-friendly reading aids.</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.32fr_0.68fr]">
        <article
          ref={viewerRef}
          onScroll={(event) => {
            const target = event.currentTarget
            const denominator = Math.max(1, target.scrollHeight - target.clientHeight)
            setScrollProgress((target.scrollTop / denominator) * 100)
          }}
          onMouseMove={(event) => {
            if (!profile.rulerFollowMouse) return
            const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
            setRulerY(event.clientY - rect.top + event.currentTarget.scrollTop)
          }}
          className={`relative max-h-[70vh] overflow-auto rounded-2xl border border-border p-6 ${themeClass(profile.theme)} ${fontClass(profile.fontFamily)}`}
          style={{
            fontSize: `${profile.fontSize}px`,
            lineHeight: profile.lineSpacing,
            letterSpacing: `${profile.letterSpacing}em`,
          }}
        >
          {applyRuler && profile.rulerMode === 'dim-band' && (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 bg-black/60" style={{ height: Math.max(0, rulerY - profile.rulerThickness / 2) }} />
              <div
                className="pointer-events-none absolute inset-x-0 bg-black/60"
                style={{ top: rulerY + profile.rulerThickness / 2, bottom: 0, opacity: profile.rulerOpacity }}
              />
            </>
          )}
          {applyRuler && profile.rulerMode === 'highlight-band' && (
            <div
              className="pointer-events-none absolute inset-x-0 bg-indigo-400/20"
              style={{ top: Math.max(0, rulerY - profile.rulerThickness / 2), height: profile.rulerThickness, opacity: profile.rulerOpacity }}
            />
          )}
          {applyRuler && profile.rulerMode === 'underline-guide' && (
            <div
              className="pointer-events-none absolute inset-x-0 border-t-2 border-amber-300"
              style={{ top: rulerY, opacity: profile.rulerOpacity }}
            />
          )}

          <div className="relative z-10 mx-auto" style={{ maxWidth: `${profile.paragraphWidth}ch` }}>
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="mb-4">
                {renderParagraph(paragraph)}
              </p>
            ))}

            {ttsPlaying && highlightedSentence && (
              <div className="mt-6 rounded-lg border border-indigo-300/40 bg-indigo-500/10 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-indigo-200">Speaking Now</p>
                <p className="mt-1 font-medium">{highlightedSentence}</p>
              </div>
            )}
          </div>
        </article>

        <aside className="space-y-5 rounded-2xl border border-border bg-panel/80 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Reading Controls</h2>

          <label className="block text-sm text-slate-200">
            Upload Document
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(event) => void onUploadFile(event)}
              className="mt-1 block w-full rounded border border-border bg-slate-900/80 px-2 py-1 text-sm"
            />
          </label>
          <p className="text-xs text-slate-400">Current source: {fileName}</p>
          {loadingFile && <p className="text-xs text-cyan-200">Extracting text...</p>}
          {errorMessage && <p className="text-xs text-rose-200">{errorMessage}</p>}

          <label className="block text-sm text-slate-200">
            Add Text Directly
            <textarea
              value={directText}
              onChange={(event) => setDirectText(event.target.value)}
              rows={6}
              className="mt-1 block w-full rounded border border-border bg-slate-900/80 px-2 py-2 text-sm"
              placeholder="Paste or type text here..."
            />
          </label>
          <button
            onClick={applyDirectText}
            className="rounded-md border border-cyan-300/60 px-3 py-1.5 text-sm text-cyan-100 hover:bg-cyan-500/20"
          >
            Apply Text
          </button>

          <div className="rounded border border-border bg-slate-950/40 p-3 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">Summary</p>
            <p className="mt-1 text-slate-400">Words: {wordCount}</p>
            <div className="mt-2 space-y-1">
              {summaryPoints.length === 0 && <p className="text-slate-500">No summary available yet.</p>}
              {summaryPoints.map((line, index) => (
                <p key={`${line}-${index}`}>- {line}</p>
              ))}
            </div>
          </div>

          <label className="block text-sm text-slate-200">
            Search in document
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-slate-900/80 px-2 py-1 text-sm"
              placeholder="Search phrase..."
            />
          </label>
          <p className="text-xs text-slate-400">Matches: {searchCount}</p>

          <div className="rounded border border-border bg-slate-950/40 p-3 text-xs text-slate-300">
            <p>Progress: {scrollProgress.toFixed(0)}%</p>
            <div className="mt-1 h-2 rounded bg-slate-800">
              <div className="h-2 rounded bg-indigo-400" style={{ width: `${clamp(scrollProgress, 0, 100)}%` }} />
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-200">
            <label>
              Font
              <select value={profile.fontFamily} onChange={(event) => updateProfile('fontFamily', event.target.value as ReadingProfile['fontFamily'])} className="mt-1 w-full rounded border border-border bg-slate-900/80 px-2 py-1">
                <option value="system">System</option>
                <option value="opendyslexic">OpenDyslexic (fallback)</option>
              </select>
            </label>
            <label>
              Theme
              <select value={profile.theme} onChange={(event) => updateProfile('theme', event.target.value as ReadingTheme)} className="mt-1 w-full rounded border border-border bg-slate-900/80 px-2 py-1">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="sepia">Sepia</option>
                <option value="high-contrast">High Contrast</option>
              </select>
            </label>

            <label>
              Font size: {profile.fontSize}
              <input type="range" min={14} max={34} value={profile.fontSize} onChange={(event) => updateProfile('fontSize', Number(event.target.value))} className="w-full accent-indigo-400" />
            </label>
            <label>
              Line spacing: {profile.lineSpacing.toFixed(2)}
              <input type="range" min={1.2} max={2.4} step={0.05} value={profile.lineSpacing} onChange={(event) => updateProfile('lineSpacing', Number(event.target.value))} className="w-full accent-indigo-400" />
            </label>
            <label>
              Letter spacing: {profile.letterSpacing.toFixed(2)}
              <input type="range" min={0} max={0.2} step={0.01} value={profile.letterSpacing} onChange={(event) => updateProfile('letterSpacing', Number(event.target.value))} className="w-full accent-indigo-400" />
            </label>
            <label>
              Paragraph width: {profile.paragraphWidth}ch
              <input type="range" min={45} max={90} value={profile.paragraphWidth} onChange={(event) => updateProfile('paragraphWidth', Number(event.target.value))} className="w-full accent-indigo-400" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={profile.bionicEnabled} onChange={(event) => updateProfile('bionicEnabled', event.target.checked)} />
              Bionic reading
            </label>
          </div>

          <div className="border-t border-border pt-4 text-sm text-slate-200">
            <p className="font-semibold">Reading Ruler (Ctrl+Shift+L)</p>
            <label className="mt-2 block">
              Mode
              <select value={profile.rulerMode} onChange={(event) => updateProfile('rulerMode', event.target.value as ReadingRulerMode)} className="mt-1 w-full rounded border border-border bg-slate-900/80 px-2 py-1">
                <option value="off">Off</option>
                <option value="highlight-band">Highlight band</option>
                <option value="underline-guide">Underline guide</option>
                <option value="dim-band">Dim except band</option>
              </select>
            </label>
            <label>
              Thickness: {profile.rulerThickness}
              <input type="range" min={20} max={180} value={profile.rulerThickness} onChange={(event) => updateProfile('rulerThickness', Number(event.target.value))} className="w-full accent-indigo-400" />
            </label>
            <label>
              Opacity: {profile.rulerOpacity.toFixed(2)}
              <input type="range" min={0.1} max={1} step={0.05} value={profile.rulerOpacity} onChange={(event) => updateProfile('rulerOpacity', Number(event.target.value))} className="w-full accent-indigo-400" />
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={profile.rulerFollowMouse} onChange={(event) => updateProfile('rulerFollowMouse', event.target.checked)} />
              Follow mouse
            </label>
          </div>

          <div className="border-t border-border pt-4 text-sm text-slate-200">
            <p className="font-semibold">Text-to-Speech</p>
            <label className="mt-2 block">
              Voice
              <select value={profile.ttsVoiceName} onChange={(event) => updateProfile('ttsVoiceName', event.target.value)} className="mt-1 w-full rounded border border-border bg-slate-900/80 px-2 py-1">
                <option value="">Default voice</option>
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Speed: {profile.ttsSpeed.toFixed(1)}
              <input type="range" min={0.5} max={2} step={0.1} value={profile.ttsSpeed} onChange={(event) => updateProfile('ttsSpeed', Number(event.target.value))} className="w-full accent-indigo-400" />
            </label>
            <div className="mt-2 flex gap-2">
              <button onClick={onPlayTts} className="rounded bg-emerald-500 px-3 py-1.5 text-white hover:bg-emerald-400">Play</button>
              <button onClick={onPauseResumeTts} className="rounded border border-border px-3 py-1.5 hover:bg-slate-800/60">Pause/Resume</button>
              <button onClick={onStopTts} className="rounded border border-rose-300/60 px-3 py-1.5 text-rose-100 hover:bg-rose-500/20">Stop</button>
            </div>
          </div>

          <div className="border-t border-border pt-4 text-sm text-slate-200">
            <p className="font-semibold">Document Outline</p>
            <div className="mt-2 max-h-32 space-y-1 overflow-auto rounded border border-border bg-slate-950/40 p-2 text-xs text-slate-300">
              {headings.length === 0 && <p className="text-slate-500">No heading-like lines detected.</p>}
              {headings.map((heading, index) => (
                <p key={`${heading}-${index}`}>{heading}</p>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
