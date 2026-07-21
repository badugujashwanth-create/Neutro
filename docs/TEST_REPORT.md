# Test report

Audit date: 2026-07-21

Branch: `phase3-neutro-completion`

Canonical app: `apps/web`

## Targeted implementation evidence

| Check | Result | Evidence |
|---|---|---|
| Changed-file ESLint | Pass | Adaptation core, provider, pages, navigation, and camera-boundary edits pass with zero findings |
| Adaptation rules | Pass | 6 Vitest tests cover deterministic presets, custom overrides, bounds, malformed storage, partial persistence, explanations, reset, and motion boundaries |
| Canonical TypeScript/build | Pass | `tsc -b` and Vite production build completed after the primary workflow was added |
| Canonical dependency audit | Pass | Initial advisories were repaired with non-forced updates; immediate rerun reported 0 vulnerabilities |

## Final repository gate

| Check | Result | Evidence |
|---|---|---|
| Canonical full gate | Pass | ESLint: 0 findings; Vitest: 6/6; TypeScript/Vite build: pass; main JS chunk reduced from 570.00 kB to 336.11 kB through optional-route splitting |
| Legacy CI regression gate | Pass | Root ESLint and TypeScript/Vite production build completed |
| Dependency audits | Pass | Both lockfiles report 0 known vulnerabilities at `--audit-level=low` after non-forced repairs |
| Desktop production-preview workflow | Pass | Playwright verified profile selection, document effects, manual Custom state, explanation, reload persistence, and reset |
| Mobile production-preview workflow | Pass | 390×844 route had no horizontal overflow and exposed a visible keyboard focus target |
| Narrated walkthrough | Pass | MP4: H.264/AAC, 1280×720, 3:15.92, 4,999,311 bytes; WebM: VP8/Opus, 1280×720, 3:14.39, 13,897,506 bytes |
| Media review | Pass | Thumbnail and 10 sampled timeline positions were visually inspected; camera, file picker, accounts, notifications, and private data were absent |
| Audio presence | Pass | Narration measured −20.4 dB mean and −0.2 dB maximum; caption final cue ends before both media durations |

Public pull-request CI, merge, release assets, and logged-out URLs remain release-coordination checks and will be recorded in `PROJECT_COMPLETION_REPORT.md`.

Warnings, failures, and excluded environments will remain explicit even when other checks pass.
