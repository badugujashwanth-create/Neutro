export type ReadingTheme = 'dark' | 'light' | 'sepia' | 'high-contrast'
export type ReadingRulerMode = 'off' | 'highlight-band' | 'underline-guide' | 'dim-band'

export interface ReadingProfile {
  fontFamily: 'system' | 'opendyslexic'
  fontSize: number
  lineSpacing: number
  letterSpacing: number
  paragraphWidth: number
  theme: ReadingTheme
  bionicEnabled: boolean
  rulerMode: ReadingRulerMode
  rulerThickness: number
  rulerOpacity: number
  rulerFollowMouse: boolean
  ttsSpeed: number
  ttsVoiceName: string
}
