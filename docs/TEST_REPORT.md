# Test report

Audited on 2026-07-17 using the checked-out `portfolio-polish` branch on Windows.

| Command | Result | Evidence / notes |
|---|---|---|
| `npm ci` | Pass | 256 packages installed |
| `npm run build` | Pass | TypeScript and Vite production build completed |
| `npm ci` in `apps/web` | Pass | 286 packages installed for the canonical documented app |
| `npm run build` in `apps/web` | Pass | Canonical app built; Vite warned about chunks larger than 500 kB |
| `npm run lint` | Fail | 7 React hook/refresh errors and 1 dependency warning across root and `apps/web` trees |
| `Automated tests` | Not run | No test script is configured |

## Overall status

Partially verified. Both root and canonical web builds pass, while lint still reports lifecycle/refresh issues and no unit-test script exists.

Warnings and missing checks remain limitations, even when another check passes.
