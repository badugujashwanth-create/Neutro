# Project Improvement Plan

## Current state

Neutro has an original accessibility-adaptation concept and a clean production build/lint result, but automated behavioral evidence is absent and several integrations are optional.

## Findings

- **Works:** preference-oriented interface, adaptation concepts, reset/navigation surfaces, lint with zero errors, and two production builds.
- **Does not / missing:** measurable adaptation rules, regression tests, accessibility audit, and uniform camera/desktop/cloud behavior.
- **UX / architecture:** UI is coherent; it needs explainable before/after states, keyboard evidence, and a reliable reset.
- **Testing / security:** camera/privacy consent and storage boundaries need explicit tests. No medical benefit can be claimed.
- **Performance / docs / demo:** device/model initialization is unmeasured; optional integrations block a universal live demo.

## Recommendations

### Critical

- Keep the project experimental and preserve explicit non-medical/privacy language.
- Add tests before any flagship claim.

### High value

- Implement deterministic preference-to-interface transformations with explanations and reset behavior.
- Run automated accessibility checks and keyboard workflow tests.

### Optional

- Benchmark camera/local-model paths on one documented device.

## Delivery constraints

- **Priority:** measurable local adaptation; **complexity:** medium; **dependencies:** current web app; optional device integrations excluded from core.
- **Acceptance:** tested transformations, accessible controls, reset/recovery, and no hidden camera action.
- **Excluded:** medical claims, emotion diagnosis, and a broad redesign.
