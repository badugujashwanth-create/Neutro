# Neutro (Focused Demo Build)

> **Status: Prototype** — The web build succeeds; lint blockers and unverified desktop/cloud components are documented in `docs/TEST_REPORT.md`.

[![Watch the Neutro demo](docs/demo/demo-thumbnail.png)](docs/demo/demo.webm)

> Watch the locally recorded overview of the canonical focused web demo.

Neutro explores privacy-aware tools that help users review digital sessions, reduce reading friction, and respond to cognitive load without presenting the prototype as clinical software.

Canonical runnable app: `apps/web`

This repo is intentionally scoped to three demo features only:

- Global Session Replay
- Mood + Motion Detector (on-device camera processing)
- Reading Mode with PDF/DOCX/TXT import

Legacy root-level modules are kept untouched but are not part of the supported runtime.

## Run

```bash
cd apps/web
npm install
npm run dev
```

## Supported Routes

- `/` Home
- `/replay` Replay sessions and player
- `/demo/mood-motion` Mood + motion scan + stress intervention
- `/reading` Reading mode with import + ruler/bionic/TTS
- `/settings` Minimal local settings

## Demo Script

1. Start replay from the top bar.
2. Open `/reading`, upload a PDF or DOCX, turn on ruler, and start TTS.
3. Open `/demo/mood-motion`, start camera, calibrate, and trigger stress/motion simulation.
4. Confirm high stress triggers calming intervention (blank screen + 432Hz attempt).
5. Stop replay and verify the full cross-route timeline in `/replay`.

## Privacy

- No video frames are uploaded or stored.
- No raw audio is recorded or stored.
- Replay and detectors store only derived values and timestamps.
