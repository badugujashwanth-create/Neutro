import type { ReadingProfile } from '../../types/reading.ts'
import { readJson, writeJson } from '../storage/localJson.ts'

const READING_PROFILE_KEY = 'neutro-reading-profile-v1'

export const DEFAULT_READING_PROFILE: ReadingProfile = {
  fontFamily: 'system',
  fontSize: 20,
  lineSpacing: 1.7,
  letterSpacing: 0.02,
  paragraphWidth: 72,
  theme: 'dark',
  bionicEnabled: false,
  rulerMode: 'off',
  rulerThickness: 80,
  rulerOpacity: 0.45,
  rulerFollowMouse: true,
  ttsSpeed: 1,
  ttsVoiceName: '',
}

export function readReadingProfile(): ReadingProfile {
  return readJson<ReadingProfile>(READING_PROFILE_KEY, DEFAULT_READING_PROFILE)
}

export function saveReadingProfile(profile: ReadingProfile): void {
  writeJson(READING_PROFILE_KEY, profile)
}
