# Security policy

## Supported scope

Security fixes target the canonical browser app in `apps/web` on the latest `main` release. Legacy root modules, Tauri artifacts, and Supabase artifacts are retained for history but are not supported or deployed by this release.

## Privacy boundaries

- Adaptation settings use versioned browser `localStorage` and contain presentation preferences only.
- Camera access is off by default and requires an explicit browser permission plus a Start action. Frames are processed on-device and are not intentionally uploaded or persisted.
- Experimental camera labels are unvalidated, are not health data, and cannot change adaptation preferences.
- Replay is off by default. When enabled, its local event log may include text rendered in the page; do not record secrets, private documents, or personal data.
- Reading imports are user-selected local files. Treat their contents as sensitive and clear local data on a shared device.

## Configuration rules

- Keep credentials in ignored local environment files or an external secret manager.
- Commit placeholders only in `.env.example`.
- Rotate any credential that was ever committed; deleting the current file does not erase Git history.
- Use synthetic or public sample data in tests and media.
- Do not expose the Vite development server to an untrusted network.

## Reporting

Use GitHub private vulnerability reporting when available. Otherwise, contact the owner through a verified GitHub profile channel without placing tokens, private URLs, personal data, or exploit details in a public issue.

This portfolio prototype provides no production support or response-time commitment.
