export type AdaptationProfileId = 'balanced' | 'reading-focus' | 'low-stimulation' | 'custom'
export type FontFamilyId = 'system' | 'readable' | 'mono'
export type ContrastId = 'standard' | 'high' | 'soft'
export type MotionId = 'system' | 'reduced'
export type SensoryLoadId = 'standard' | 'low'

export interface AdaptationPreferences {
  profile: AdaptationProfileId
  fontFamily: FontFamilyId
  fontScale: number
  lineHeight: number
  letterSpacing: number
  contrast: ContrastId
  motion: MotionId
  sensoryLoad: SensoryLoadId
  simplifiedLayout: boolean
  focusAssistance: boolean
}

export type AdaptationPatch = Partial<Omit<AdaptationPreferences, 'profile'>>
