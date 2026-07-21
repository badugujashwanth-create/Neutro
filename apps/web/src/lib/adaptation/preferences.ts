import type {
  AdaptationPatch,
  AdaptationPreferences,
  AdaptationProfileId,
  ContrastId,
  FontFamilyId,
  MotionId,
  SensoryLoadId,
} from '../../types/adaptation.ts'

export const ADAPTATION_STORAGE_KEY = 'neutro:adaptation:v1'

export const DEFAULT_PREFERENCES: AdaptationPreferences = {
  profile: 'balanced',
  fontFamily: 'system',
  fontScale: 1,
  lineHeight: 1.6,
  letterSpacing: 0,
  contrast: 'standard',
  motion: 'system',
  sensoryLoad: 'standard',
  simplifiedLayout: false,
  focusAssistance: true,
}

export const PROFILE_PRESETS: Record<Exclude<AdaptationProfileId, 'custom'>, AdaptationPreferences> = {
  balanced: DEFAULT_PREFERENCES,
  'reading-focus': {
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
  },
  'low-stimulation': {
    profile: 'low-stimulation',
    fontFamily: 'system',
    fontScale: 1.05,
    lineHeight: 1.7,
    letterSpacing: 0.01,
    contrast: 'soft',
    motion: 'reduced',
    sensoryLoad: 'low',
    simplifiedLayout: true,
    focusAssistance: true,
  },
}

const PROFILE_IDS: AdaptationProfileId[] = ['balanced', 'reading-focus', 'low-stimulation', 'custom']
const FONT_IDS: FontFamilyId[] = ['system', 'readable', 'mono']
const CONTRAST_IDS: ContrastId[] = ['standard', 'high', 'soft']
const MOTION_IDS: MotionId[] = ['system', 'reduced']
const SENSORY_IDS: SensoryLoadId[] = ['standard', 'low']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function enumValue<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback
}

function numberValue(value: unknown, fallback: number, min: number, max: number, step: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const clamped = Math.min(max, Math.max(min, value))
  return Number((Math.round(clamped / step) * step).toFixed(3))
}

export function normalizePreferences(value: unknown): AdaptationPreferences {
  if (!isRecord(value)) return { ...DEFAULT_PREFERENCES }

  return {
    profile: enumValue(value.profile, PROFILE_IDS, DEFAULT_PREFERENCES.profile),
    fontFamily: enumValue(value.fontFamily, FONT_IDS, DEFAULT_PREFERENCES.fontFamily),
    fontScale: numberValue(value.fontScale, DEFAULT_PREFERENCES.fontScale, 0.9, 1.3, 0.05),
    lineHeight: numberValue(value.lineHeight, DEFAULT_PREFERENCES.lineHeight, 1.4, 2, 0.1),
    letterSpacing: numberValue(value.letterSpacing, DEFAULT_PREFERENCES.letterSpacing, 0, 0.08, 0.01),
    contrast: enumValue(value.contrast, CONTRAST_IDS, DEFAULT_PREFERENCES.contrast),
    motion: enumValue(value.motion, MOTION_IDS, DEFAULT_PREFERENCES.motion),
    sensoryLoad: enumValue(value.sensoryLoad, SENSORY_IDS, DEFAULT_PREFERENCES.sensoryLoad),
    simplifiedLayout:
      typeof value.simplifiedLayout === 'boolean'
        ? value.simplifiedLayout
        : DEFAULT_PREFERENCES.simplifiedLayout,
    focusAssistance:
      typeof value.focusAssistance === 'boolean'
        ? value.focusAssistance
        : DEFAULT_PREFERENCES.focusAssistance,
  }
}

export function parseStoredPreferences(serialized: string | null): AdaptationPreferences {
  if (!serialized) return { ...DEFAULT_PREFERENCES }
  try {
    return normalizePreferences(JSON.parse(serialized))
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function selectProfile(profile: Exclude<AdaptationProfileId, 'custom'>): AdaptationPreferences {
  return { ...PROFILE_PRESETS[profile] }
}

export function applyManualPatch(
  preferences: AdaptationPreferences,
  patch: AdaptationPatch,
): AdaptationPreferences {
  return normalizePreferences({ ...preferences, ...patch, profile: 'custom' })
}

export function explainPreferences(preferences: AdaptationPreferences, systemReducedMotion = false): string[] {
  const fontLabels: Record<FontFamilyId, string> = {
    system: 'System UI typeface keeps the interface familiar.',
    readable: 'Readable typeface and wider forms support longer reading.',
    mono: 'Monospaced type gives every character equal width.',
  }
  const contrastLabels: Record<ContrastId, string> = {
    standard: 'Standard contrast preserves the default visual balance.',
    high: 'High contrast strengthens text, borders, and focus cues.',
    soft: 'Soft contrast reduces bright accents and visual intensity.',
  }

  const explanations = [
    fontLabels[preferences.fontFamily],
    `Text is ${Math.round(preferences.fontScale * 100)}% size with ${preferences.lineHeight.toFixed(1)} line spacing.`,
    contrastLabels[preferences.contrast],
    preferences.sensoryLoad === 'low'
      ? 'Low sensory load removes decorative glow and reduces competing accents.'
      : 'Standard sensory load keeps the full visual hierarchy.',
    preferences.simplifiedLayout
      ? 'Simplified layout narrows reading width and hides secondary descriptions.'
      : 'Standard layout keeps supporting descriptions visible.',
    preferences.focusAssistance
      ? 'Focus assistance adds stronger keyboard focus and a reading highlight.'
      : 'Focus assistance is off; browser focus behavior remains available.',
  ]

  if (preferences.motion === 'reduced') {
    explanations.push('Motion is reduced by your Neutro preference.')
  } else if (systemReducedMotion) {
    explanations.push('Motion is reduced because your operating system requests it.')
  } else {
    explanations.push('Motion follows your operating system preference.')
  }

  return explanations
}
