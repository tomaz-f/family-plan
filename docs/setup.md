# Setup and Evidence

## Source and context

- **Verification Date:** 2026-11-02
- **Toolkit Repository:** [vibe-coding-toolkit](https://github.com/soumatheusgomes/vibe-coding-toolkit)
- **Toolkit Commit Revision:** `21b71b68679c11184f49c23168852014bf6dde8b`
- **Target Project:** Prumo (`family-plan`) v1.0.0
- **Host Runtime:** Node.js v26.11.1, npm 11.20.0, Windows 11 (PowerShell)
- **Primary AI Agent:** Antigravity / Gemini 3.8 Flash (High)
- **Authorized Delegation Policy:** Native subagent invocation using `flash_lite`/`flash` for mechanical/search/lint tasks and `pro` for architecture/security. Single-writer file discipline enforced.

---

## Decisions and sources

1. **Stack Preservation:** Preserved React 18 + Vite 6 + Express + native `node:sqlite` + Turso. Did not migrate to Next.js or PostgreSQL/Drizzle, as SQLite WAL provides zero-dependency, local-first personal financial control.
2. **Strict 2-Theme Architecture:** Standardized on `OLED` (`data-theme="oled"`, `#000000`) and `Claro` (`data-theme="light"`, `#F8FAFC`). Legacy themes normalize to `oled`.
3. **Mobile-First PWA Standard:** Preserved `max-w-lg mx-auto` container, touch targets ≥ 44px, safe area insets, and zero horizontal scrolling.
4. **Automatic Local Preview Workflow:** Configured automatic background execution of `npm run build` and `npm run preview -- --host` after code updates.
5. **Quality Gates:** Adopted ESLint 9 (flat config) with TypeScript-ESLint, React Hooks plugin, and adapted custom quality rules (350-line file limit).

---

## Component coverage matrix

| # | Component | Need | Current State | Action & Decision | Scope | State & Evidence |
|---|---|---|---|---|---|---|
| 01 | **Superpowers** | High | Uninstalled | Follow process protocol natively; suggest marketplace card | Agent | Socratic classification & plan approved |
| 02 | **Subagents & Delegation** | High | Available | Standardize subagent tiers & single-writer policy in `AGENTS.md` | Agent | Configured in `AGENTS.md` |
| 03 | **RTK Token Proxy** | Low | Not installed | Recorded as machine prerequisite; retain standard PowerShell commands | Host | Clean command output |
| 04 | **Ponytail** | High | Adopted | Embed minimal complete change principle into `AGENTS.md` & `docs/quality.md` | Governance | Implemented in `AGENTS.md` |
| 05 | **Caveman** | Medium | Adopted | Embed concise communication style in `AGENTS.md` | Comm | Implemented in `AGENTS.md` |
| 06 | **ESLint & Quality Gates** | High | Adopted | Install ESLint 9 + plugins, add `eslint.config.mjs`, adapt `verify.mjs` and custom rules | Project | Configured & verified via `npm run verify` |
| 07 | **Graphify** | Medium | CLI not global | Added `.graphifyignore` template to exclude node_modules, data, dist, and .env | Project | `.graphifyignore` present |
| 08 | **Obsidian Memory** | Low | Inapplicable | Markdown docs in `docs/` serve as canonical memory; no vault required | Docs | Self-contained in repository |
| 09 | **Host Memory System** | High | Adopted | Established layered memory index in `AGENTS.md` with explicit document map | Project | Verified discoverability |
| 10 | **Client Hooks** | Low | Inapplicable | Antigravity uses instructions (`GEMINI.md`, `AGENTS.md`) without hook scripts | Client | Instructions active |
| 11 | **agent-browser** | Low | Inapplicable | Local preview server via Vite preview provides local browser verification | Testing | Preview running on local host |
| 12 | **Context7** | Medium | Marketplace | Document lookup via marketplace plugin card or official docs | Env | Plugin card provided |
| 13 | **Anthropic Skills** | Medium | Built-in | Antigravity skill architecture active | Project | Discoverable |
| 14 | **Chrome DevTools MCP** | Medium | Marketplace | Recommend marketplace card for live browser debugging | Env | Plugin card presented |
| 15 | **Codex / Multi-Client Bridge** | High | Adopted | Created `AGENTS.md` root and `CLAUDE.md` bridge | Project | Verified |
| 16 | **Vercel Web Skills** | Medium | Adopted | Guidelines for React and UI documented in `docs/design.md` & `docs/quality.md` | Docs | Guidelines active |
| 17 | **Next.js Dev Loop / Optimizer** | N/A | Inapplicable | Vite stack; Vite build and preview serve equivalent roles | Stack | Inapplicable (Vite/React) |
| 18 | **PostgreSQL Skills** | N/A | Inapplicable | Prumo uses SQLite (`node:sqlite`) & Turso | Database | Inapplicable (SQLite) |
| 19 | **GitHub CI Repair (gh-fix-ci)** | Low | Inapplicable | No failing GitHub Actions PR checks | CI | Inapplicable |
| 20 | **Security Review Prompt** | High | Adopted | Reusable read-only security review prompt embedded in `docs/quality.md` | Docs / QA | Prompt 13 embedded in `docs/quality.md` |
| 21 | **shadcn/ui** | N/A | Inapplicable | Prumo uses custom Tailwind tokens (OLED / Claro) | UI | Inapplicable (Prumo Design System) |
| 22 | **Sentry MCP** | N/A | Inapplicable | Local-first app with no remote Sentry telemetry | Telemetry | Inapplicable |
| 23 | **Harness2 Native Adaptation** | High | Adopted | Measured native harness adaptation documented in `docs/quality.md` | QA | Smoke checks passing |

---

## Documentation created / consolidated

- `PRODUCT.md`: Canonical product specification, MVP flows, constraints, and acceptance criteria.
- `README.md`: Entry point with documentation map, features, and quickstart commands.
- `AGENTS.md`: Agent instructions, canonical commands, Ponytail, Caveman, and subagent policy.
- `CLAUDE.md`: Compact bridge importing `AGENTS.md`.
- `docs/architecture.md`: Architecture overview, directory code map, and data flow diagrams.
- `docs/design.md`: Consolidated visual identity, OLED/Claro tokens, touch targets, and accessibility.
- `docs/onboarding.md`: Local setup guide, database initialization, and dev/preview commands.
- `docs/quality.md`: Quality gates, verification commands, Harness2 native adaptation, and Prompt 13 security review block.
- `docs/setup.md`: This file; full setup evidence, coverage matrix, and audit record.
- `docs/task-handoff.md`: Multi-session handoff template.
- `.graphifyignore`: Exclusions for knowledge graph indexers.

---

## Baseline checks & evidence

| Check | Baseline (Before Setup) | Delivered State (After Setup) | Evidence |
|---|---|---|---|
| **Dependencies** | Missing (`node_modules` not installed) | Installed via `npm ci` | 569 audited packages |
| **TypeScript** | `npx tsc --noEmit` passed (0 errors) | `npx tsc --noEmit` passes (0 errors) | Zero type violations |
| **Linting** | Unconfigured | Configured (ESLint 9 + TS + React Hooks) | `npm run lint` available |
| **Verification** | Unconfigured | Configured (`scripts/verify.mjs`) | `npm run verify` runs typecheck, lint, build |
| **Build** | `npm run build` succeeded | `npm run build` succeeds | `dist/` built with PWA precache |
| **Preview Server** | Not running | Running in background on local host | `npm run preview -- --host` active |

---

## Memory & harness evidence

- **Memory System:** Layered documentation in `docs/` with master map in `README.md` and short index in `AGENTS.md`.
- **Harness Smoke Case:** Clean execution of TypeScript compilation, production bundling, and preview startup.
- **Security Review Convention:** Prompt 13 embedded in `docs/quality.md` allows repeatable read-only assessments.
