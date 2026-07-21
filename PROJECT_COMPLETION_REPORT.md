# Neutro Project Completion Report

## Status

**Release candidate on `phase3-neutro-completion`.** The implementation, local verification, and replacement media qualify for pull-request review. Public release status remains pending until CI, merge, release assets, and logged-out checks agree.

## Ground truth

- The canonical product is `apps/web`; root-level UI modules are legacy and are not part of this pass.
- Reading, local session replay, and an optional camera-based experiment already run in the canonical app.
- The product does not yet provide one unified, persistent preference-to-interface workflow.
- The canonical app has build and lint automation but no behavioral test command.
- Existing media is preserved until the completed interface proves it materially outdated.

## P0 delivery scope

- Add user-controlled profiles for balanced, reading focus, and low stimulation modes.
- Add deterministic manual controls for typography, contrast, motion, sensory load, layout simplification, and focus assistance.
- Provide a live preview, plain-language explanations of every active adaptation, manual override, reset, safe local persistence, and recovery from invalid stored data.
- Make the core workflow keyboard-operable, screen-reader legible, responsive, and compatible with system reduced-motion preferences.
- Reframe camera analysis and replay as optional local labs, not as the product thesis.
- Use explicit non-medical language: Neutro does not diagnose, treat, or infer a health condition.
- Add behavioral tests and CI enforcement for the adaptation rules.

## P1 documentation and release scope

- Align the README, architecture, security, testing, limitations, and public product claims with verified behavior.
- Run the smallest relevant checks after each fix, then one final lint, test, build, dependency, and secret-scan gate.
- Reuse current media unless the finished primary workflow makes it materially outdated; any necessary supporting replacement remains at most 90 seconds.
- Open a pull request, require green CI, merge, tag a release, and verify public assets only when the repository qualifies.

## Excluded scope

- Medical, diagnostic, therapeutic, emotion-detection, or outcome claims.
- Automatic adaptation based on camera inference.
- Accounts, cloud synchronization, clinical validation, or production-user claims.
- Rewriting legacy root modules or undertaking a broad visual redesign.

## Acceptance criteria

- A user can select a profile, tune every supported dimension, understand the resulting changes, preview them, reload with preferences intact, and reset safely.
- Manual changes clearly switch the state to a custom profile.
- System reduced-motion is honored unless the user explicitly selects reduced motion; full motion is never forced.
- Invalid local data falls back to safe defaults.
- Keyboard focus is visible and the workflow uses native, labeled controls with an announced status summary.
- Tests cover presets, overrides, normalization, explanations, persistence boundaries, and reset behavior.
- Code, CI, documentation, release notes, portfolio status, and media make the same honest claims.

## Delivered workflow

- Added Balanced, Reading focus, Low stimulation, and Custom profile states.
- Added deterministic typography, contrast, motion, sensory-load, layout, and focus controls.
- Added safe versioned persistence, malformed-data recovery, live preview, explanations, manual override, and full reset.
- Added system reduced-motion enforcement, visible focus, native labels/fieldsets, an announced summary, and responsive layout behavior.
- Reframed reading, replay, and camera code as optional local labs. Replay and camera remain off by default; camera heuristics cannot adapt the interface or trigger the pause overlay automatically.
- Added route splitting so optional labs load separately from the 336.11 kB main bundle.
- Replaced materially outdated media with a 3:15 narrated, captioned, deterministic browser walkthrough.

## Final verification

| Gate | Result |
|---|---|
| Canonical lint / tests / build | Pass — 0 lint findings, 6/6 tests, TypeScript and Vite build complete |
| Legacy CI regression lint / build | Pass |
| Canonical and root dependency audits | Pass — 0 known vulnerabilities |
| Desktop primary workflow | Pass — profile, Custom override, effects, explanation, persistence, and reset |
| Mobile 390×844 workflow | Pass — no horizontal overflow; keyboard focus visible |
| Media formats | Pass — MP4 H.264/AAC and WebM VP8/Opus, 1280×720, both longer than 3 minutes |
| Media frame/audio/caption review | Pass — sampled frames clean, narration present, final cue within duration |

### Media checksums (SHA-256)

- `demo.mp4`: `63D54E350B89FBB4A36C9464DAF963DAC8D1F9D2B36ED5632EF5DAAB2CA795FD`
- `demo.webm`: `9662BB67F6AAA46562D1EB9A4A767D5356B39ECCC689A051095403816BECEA6C`
- `demo-captions.vtt`: `284540A30AC09002959D8BE20C79829265F6792F68C42DC708673FB6223CE4BC`
- `demo-thumbnail.png`: `464DA60FCA2CFF728869E317C0BBD70C1C39863012DDE0956DC0B717A7A29546`

## Release coordination

- Pull request: pending
- CI: pending
- Merge: pending
- Release: target `v0.6.0`
- Logged-out asset verification: pending
