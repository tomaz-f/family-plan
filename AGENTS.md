# Prumo — Agent Instructions

## Product and stack

- **Product and Scope:** [PRODUCT.md](file:///c:/Users/Archtomaz/Downloads/Prumo/PRODUCT.md)
- **Stack:** React 18.3.1, TypeScript 5.7.2, Vite 6.0.5, Tailwind CSS 3.4.17, Express 4.21.2, Node.js (`node:sqlite` + `@libsql/client`).
- **Setup & Validations:** [docs/setup.md](file:///c:/Users/Archtomaz/Downloads/Prumo/docs/setup.md)
- **Architecture:** [docs/architecture.md](file:///c:/Users/Archtomaz/Downloads/Prumo/docs/architecture.md)
- **Design System:** [docs/design.md](file:///c:/Users/Archtomaz/Downloads/Prumo/docs/design.md)
- **Quality Gates:** [docs/quality.md](file:///c:/Users/Archtomaz/Downloads/Prumo/docs/quality.md)
- **Onboarding:** [docs/onboarding.md](file:///c:/Users/Archtomaz/Downloads/Prumo/docs/onboarding.md)

## Canonical commands

- **Install:** `npm ci`
- **Develop (Full Stack):** `npm run dev`
- **Build Production:** `npm run build`
- **Preview Production (Background Server):** `npm run preview -- --host`
- **Start Backend Production:** `npm start`
- **Typecheck:** `npx tsc --noEmit`
- **Lint Check:** `npm run lint`
- **Verify Foundation:** `npm run verify` (runs typecheck, lint, and build)
- **Generate Icons:** `npm run icons`

## Durable working agreements

- **Response Language:** Always respond to all user prompts in **English**.
- **Automatic Preview Workflow:** Every time code modifications are completed, immediately execute `npm run build` and launch `npm run preview -- --host` in the background. Keep it running for immediate browser verification.
- **Version Control Guardrail:** **DO NOT** execute `git commit` or `git push` automatically under any circumstance.
- **Strict 2-Theme Architecture:** Only `OLED` (`data-theme="oled"`) and `Claro` (`data-theme="light"`) are permitted. Legacy themes (`dark`, `tokyo-night`) normalize automatically to `oled`.
- **Mobile-First Standard:** Enforce centered mobile viewport (`max-w-lg mx-auto`), touch targets ≥ 44px, safe area insets, and zero horizontal scrolling.
- **Database Safety:** Preserve existing SQLite WAL and Turso schema structures. Never migrate to PostgreSQL or Drizzle.
- **Ponytail Principle:** Smallest sufficient complete change. Reuse existing components, functions, and patterns. Avoid speculative abstractions.
- **Caveman Principle:** Keep conversation concise, direct, and noise-free. Code, comments, and documentation maintain standard, professional English.

## Subagent orchestration & capability selection

When delegating tasks to subagents:
- **Model Tiers:**
  - `flash_lite` / `flash`: Localized searches, file scanning, reading logs, link checks, mechanical updates, and focused lint refactoring.
  - `pro`: Complex architectural decisions, multi-file refactors, security boundary analysis, or tricky debugging.
- **Single Writer Discipline:** Exactly one agent writes to any specific file at a time. The coordinator manages lockfiles, shared config, and integrated builds.
- **Task Briefing:** Every subagent task receives explicit acceptance criteria, allowed files, and verification commands. Require concise summaries with diff evidence.

## Tools and style

- **Ponytail:** Minimize change surface. Complete the exact requirement without superfluous rewrites.
- **Caveman:** Concise status updates without conversational filler.
- **Superpowers:** Follow Socratic discovery, requirement classification (Spike, Bounded, Architectural), and explicit approval gates.
- **Context7:** Query official up-to-date documentation for library APIs one concept at a time. Never pass secrets or private code in queries.
- **RTK:** When RTK CLI is installed, use supported command filtering; otherwise execute canonical PowerShell commands cleanly.
- **Graphify:** Maintain `.graphifyignore` excluding dependencies, build outputs, and `.env*`.
