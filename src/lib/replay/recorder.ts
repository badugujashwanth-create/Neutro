import type { eventWithTime, listenerHandler } from '@rrweb/types'
import { record } from 'rrweb'
import type { ReplayBundle } from '../../types/replay'

let stopHandler: listenerHandler | undefined
let recordedEvents: eventWithTime[] = []
let startedAt = ''

export function isReplayRecording(): boolean {
  return Boolean(stopHandler)
}

export function startReplayRecording(): boolean {
  if (stopHandler) return false

  recordedEvents = []
  startedAt = new Date().toISOString()

  stopHandler = record({
    emit(event) {
      recordedEvents.push(event as eventWithTime)
    },
    recordCrossOriginIframes: false,
  })

  return Boolean(stopHandler)
}

export function stopReplayRecording(): ReplayBundle | null {
  if (!stopHandler) return null

  stopHandler()
  stopHandler = undefined

  if (!recordedEvents.length) return null

  const firstEventTs = recordedEvents[0].timestamp
  const lastEventTs = recordedEvents[recordedEvents.length - 1].timestamp

  const bundle: ReplayBundle = {
    id: crypto.randomUUID(),
    createdAt: startedAt,
    durationMs: Math.max(0, lastEventTs - firstEventTs),
    events: recordedEvents,
  }

  recordedEvents = []
  return bundle
}
