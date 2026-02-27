# nexus-neuroos (Replay-Only)

Clean rebuild focused on one feature only: **Session Replay**.

## What It Does
- Records in-app DOM activity (clicks, typing, scrolling) using `rrweb`
- Saves each recording locally as a replay bundle (`IndexedDB`, with `localStorage` fallback)
- Replays sessions with:
  - play/pause
  - timeline scrubber
  - speed control (`0.5x`, `1x`, `2x`)
- Lists sessions with delete and clear-all actions

## Privacy
- No webcam capture
- No audio capture
- No server upload
- Records only this app's DOM events in browser-local storage

## Routes
- `/` Home: start/stop recording, session list, replay last session
- `/replay/:id` Replay player with timeline controls

## Run Locally
```bash
npm install
npm run dev
```

App URL: `http://localhost:5173`

## Build
```bash
npm run build
```
