import type { eventWithTime, listenerHandler } from '@rrweb/types'
import { record } from 'rrweb'
import type { ReplayBundle, ReplayMarker } from '../../types/replay'

let stopHandler: listenerHandler | undefined
let recordedEvents: eventWithTime[] = []
let markers: ReplayMarker[] = []
let startedAtIso = ''
let startedAtPerf = 0

function nowMsSinceStart(): number {
  if (!startedAtPerf) return 0
  return Math.max(0, performance.now() - startedAtPerf)
}

export function isReplayRecording(): boolean {
  return Boolean(stopHandler)
}

export function startReplayRecording(): boolean {
  if (stopHandler) return false

  recordedEvents = []
  markers = []
  startedAtIso = new Date().toISOString()
  startedAtPerf = performance.now()

  stopHandler = record({
    emit(event) {
      recordedEvents.push(event as eventWithTime)
    },
    recordCrossOriginIframes: false,
    recordCanvas: false,
    maskInputOptions: {
      password: true,
    },
  })

  return Boolean(stopHandler)
}

export function addReplayMarker(label: string, kind: ReplayMarker['kind'] = 'system'): void {
  if (!stopHandler) return
  markers.push({
    id: crypto.randomUUID(),
    atMs: nowMsSinceStart(),
    label,
    kind,
  })
}

export function stopReplayRecording(): ReplayBundle | null {
  if (!stopHandler) return null

  stopHandler()
  stopHandler = undefined

  if (!recordedEvents.length) {
    recordedEvents = []
    markers = []
    startedAtPerf = 0
    return null
  }

  const firstEventTs = recordedEvents[0].timestamp
  const lastEventTs = recordedEvents[recordedEvents.length - 1].timestamp

  const bundle: ReplayBundle = {
    id: crypto.randomUUID(),
    createdAt: startedAtIso,
    durationMs: Math.max(0, lastEventTs - firstEventTs),
    events: recordedEvents,
    markers: markers.sort((a, b) => a.atMs - b.atMs),
  }

  recordedEvents = []
  markers = []
  startedAtPerf = 0
  return bundle
}
