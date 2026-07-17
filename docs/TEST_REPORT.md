# Test report

Audited on 2026-07-17 using the checked-out `portfolio-polish` branch on Windows.

| Command | Result | Evidence / notes |
|---|---|---|
| `npm ci` | Pass | 256 packages installed |
| `npm run build` | Pass | TypeScript and Vite production build completed |
| `npm ci` in `apps/web` | Pass | 286 packages installed for the canonical documented app |
| `npm run build` in `apps/web` | Pass | Canonical app built; Vite warned about chunks larger than 500 kB |
| `npm run lint` | Pass | ESLint completed with zero errors and zero warnings across both trees |
| Type checking | Pass | Both production build commands completed their `tsc -b` phase |
| Canonical preview startup | Pass | Vite preview returned HTTP 200 with the expected root element |
| Formatter | Not run | No formatter command or formatter dependency is configured |
| `Automated tests` | Not run | No test script is configured |

## Finding classification and correction

| Finding | Classification | Correction |
|---|---|---|
| Initial replay loads in two providers | Unsafe lifecycle pattern | Load storage in a cancellable promise callback instead of invoking state-setting helpers synchronously from effects |
| Stress overlay reset | Actual lifecycle bug | Mount a dedicated active overlay so its timer state resets through component lifecycle |
| Session selection effect | Derived-state/code-quality issue | Resolve the selected session during render and reset controls in explicit user actions |
| Two replayer reset effects | Unsafe pattern | Keep external-player construction in effects and move React state resets to async/user callbacks |
| Toast hook exported with provider component | Fast Refresh configuration issue | Move the context hook to a non-component module |
| Replay speed dependency | Actual behavioral warning | Configure speed explicitly through the player API instead of recreating the player on every speed change |

## Overall status

Verified for lint, type checking, two production builds, and canonical preview startup. No automated test script exists, and Vite still reports a large canonical bundle chunk.

Warnings and missing checks remain limitations, even when another check passes.
