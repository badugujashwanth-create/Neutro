import type { eventWithTime } from '@rrweb/types'

export interface ReplayMarker {
  id: string
  atMs: number
  label: string
  kind?: 'stress' | 'motion' | 'reading' | 'tts' | 'system' | 'intervention'
}

export interface ReplayBundle {
  id: string
  createdAt: string
  durationMs: number
  events: eventWithTime[]
  markers: ReplayMarker[]
}
