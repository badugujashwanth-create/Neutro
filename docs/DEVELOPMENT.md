# Development guide

## Supported runtime

The supported product is `apps/web`, built with React, TypeScript, Vite, and Tailwind CSS. Node.js 22 is the CI baseline.

## Install and run

```powershell
cd apps/web
npm ci
npm run dev
```

The primary adaptation workflow requires no environment variables, account, camera, or network service. Copy `.env.example` only when investigating optional paths; never commit real values.

## Targeted verification

After changing preference rules:

```powershell
cd apps/web
npm test -- src/lib/adaptation/preferences.test.ts
```

After changing a UI module, lint the smallest relevant files with `npx eslint <files>`. Run the complete canonical gate only before handoff:

```powershell
npm run lint
npm test
npm run build
npm audit --audit-level=low
```

The root tree remains in CI for regression protection but is legacy and should not receive new product work. See [TEST_REPORT.md](TEST_REPORT.md) for the dated evidence.
