import type { eventWithTime } from '@rrweb/types'

export interface ReplayMarker {
  id: string
  atMs: number
  label: string
}

export interface ReplayBundle {
  id: string
  createdAt: string
  durationMs: number
  events: eventWithTime[]
  interventionMarkers?: ReplayMarker[]
}
