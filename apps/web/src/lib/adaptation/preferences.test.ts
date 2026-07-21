import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCES,
  applyManualPatch,
  explainPreferences,
  normalizePreferences,
  parseStoredPreferences,
  selectProfile,
} from './preferences.ts'

describe('adaptation preferences', () => {
  it('returns deterministic presets without sharing mutable state', () => {
    const first = selectProfile('reading-focus')
    const second = selectProfile('reading-focus')

    expect(first).toEqual({
      profile: 'reading-focus',
      fontFamily: 'readable',
      fontScale: 1.1,
      lineHeight: 1.8,
      letterSpacing: 0.02,
      contrast: 'standard',
      motion: 'system',
      sensoryLoad: 'standard',
      simplifiedLayout: true,
      focusAssistance: true,
    })
    expect(first).not.toBe(second)
  })

  it('marks manual overrides custom and constrains numeric inputs', () => {
    const updated = applyManualPatch(selectProfile('balanced'), {
      fontScale: 4,
      lineHeight: 0.5,
      letterSpacing: 0.043,
      contrast: 'high',
    })

    expect(updated.profile).toBe('custom')
    expect(updated.fontScale).toBe(1.3)
    expect(updated.lineHeight).toBe(1.4)
    expect(updated.letterSpacing).toBe(0.04)
    expect(updated.contrast).toBe('high')
  })

  it('recovers safely from malformed or invalid stored data', () => {
    expect(parseStoredPreferences('{not-json')).toEqual(DEFAULT_PREFERENCES)
    expect(parseStoredPreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(
      parseStoredPreferences(JSON.stringify({
        profile: 'unknown',
        motion: 'force-motion',
        focusAssistance: 'yes',
        fontScale: Number.POSITIVE_INFINITY,
      })),
    ).toEqual(DEFAULT_PREFERENCES)
  })

  it('preserves valid fields while filling missing persistence fields', () => {
    const normalized = normalizePreferences({
      profile: 'custom',
      contrast: 'soft',
      simplifiedLayout: true,
    })

    expect(normalized).toEqual({
      ...DEFAULT_PREFERENCES,
      profile: 'custom',
      contrast: 'soft',
      simplifiedLayout: true,
    })
  })

  it('explains user and system motion boundaries separately', () => {
    const systemExplanation = explainPreferences(DEFAULT_PREFERENCES, true)
    const userExplanation = explainPreferences(selectProfile('low-stimulation'), false)

    expect(systemExplanation).toContain('Motion is reduced because your operating system requests it.')
    expect(userExplanation).toContain('Motion is reduced by your Neutro preference.')
    expect(userExplanation).toContain('Low sensory load removes decorative glow and reduces competing accents.')
  })

  it('reset defaults never force full motion', () => {
    expect(DEFAULT_PREFERENCES.motion).toBe('system')
    expect(DEFAULT_PREFERENCES.profile).toBe('balanced')
  })
})
