import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ADAPTATION_STORAGE_KEY,
  DEFAULT_PREFERENCES,
  applyManualPatch,
  explainPreferences,
  parseStoredPreferences,
  selectProfile,
} from '../lib/adaptation/preferences.ts'
import type { AdaptationPatch, AdaptationPreferences, AdaptationProfileId } from '../types/adaptation.ts'

interface AdaptationContextValue {
  preferences: AdaptationPreferences
  explanations: string[]
  systemReducedMotion: boolean
  chooseProfile: (profile: Exclude<AdaptationProfileId, 'custom'>) => void
  updatePreferences: (patch: AdaptationPatch) => void
  resetPreferences: () => void
}

const AdaptationContext = createContext<AdaptationContextValue | null>(null)

function readInitialPreferences(): AdaptationPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES }
  return parseStoredPreferences(window.localStorage.getItem(ADAPTATION_STORAGE_KEY))
}

export function AdaptationProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readInitialPreferences)
  const [systemReducedMotion, setSystemReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setSystemReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(ADAPTATION_STORAGE_KEY, JSON.stringify(preferences))
    const root = document.documentElement
    const effectiveReducedMotion = preferences.motion === 'reduced' || systemReducedMotion
    root.dataset.adaptFont = preferences.fontFamily
    root.dataset.adaptContrast = preferences.contrast
    root.dataset.adaptMotion = effectiveReducedMotion ? 'reduced' : 'standard'
    root.dataset.adaptSensory = preferences.sensoryLoad
    root.dataset.adaptLayout = preferences.simplifiedLayout ? 'simple' : 'standard'
    root.dataset.adaptFocus = preferences.focusAssistance ? 'strong' : 'standard'
    root.style.setProperty('--adapt-font-scale', String(preferences.fontScale))
    root.style.setProperty('--adapt-line-height', String(preferences.lineHeight))
    root.style.setProperty('--adapt-letter-spacing', `${preferences.letterSpacing}em`)
  }, [preferences, systemReducedMotion])

  const chooseProfile = useCallback((profile: Exclude<AdaptationProfileId, 'custom'>) => {
    setPreferences(selectProfile(profile))
  }, [])

  const updatePreferences = useCallback((patch: AdaptationPatch) => {
    setPreferences((current) => applyManualPatch(current, patch))
  }, [])

  const resetPreferences = useCallback(() => {
    setPreferences({ ...DEFAULT_PREFERENCES })
  }, [])

  const explanations = useMemo(
    () => explainPreferences(preferences, systemReducedMotion),
    [preferences, systemReducedMotion],
  )

  const value = useMemo<AdaptationContextValue>(
    () => ({
      preferences,
      explanations,
      systemReducedMotion,
      chooseProfile,
      updatePreferences,
      resetPreferences,
    }),
    [chooseProfile, explanations, preferences, resetPreferences, systemReducedMotion, updatePreferences],
  )

  return <AdaptationContext.Provider value={value}>{children}</AdaptationContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdaptation(): AdaptationContextValue {
  const context = useContext(AdaptationContext)
  if (!context) throw new Error('useAdaptation must be used within AdaptationProvider')
  return context
}
