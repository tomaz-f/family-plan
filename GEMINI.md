# Project Workflow Rules & Prumo Design System

## 1. Response Language
- Always respond to all user prompts in **English**.

## 2. Automatic Local Preview Workflow
- Every time you complete code modifications or updates requested by the user, immediately execute the production build and start the local preview server automatically:
  1. `npm run build`
  2. `npm run preview -- --host`
- Keep the preview server process running in the background so the latest compiled production build is immediately accessible for browser testing.
- Do not wait for a separate prompt or instruction from the user to trigger the build and preview.

## 3. Version Control Guardrails
- **DO NOT** execute `git commit` or `git push` automatically under any circumstance.
- Only apply changes to the local working directory unless explicitly instructed by the user to commit or push.

## 4. Strict 2-Theme Architecture (`OLED` & `Claro`)
- Only **TWO** visual themes are permitted across the entire codebase (`AppTheme = 'oled' | 'light'`):
  1. **`OLED`** (`data-theme="oled"`): Default & flagship pure-black theme.
  2. **`Claro`** (`data-theme="light"`): Clean, high-contrast day theme.
- Never reintroduce `"Tokyo Night"` or standard `"Escuro"` (`dark`) themes. Any legacy theme in `localStorage` or backups must automatically fall back to `'oled'`.

## 5. Prumo Visual Identity & Color System Tokens
- **OLED Theme Tokens (`data-theme="oled"`)**:
  - Main Background: `#000000` (Pure OLED Black)
  - Surface Cards & Modals: `#0D1117` (Subtle elevated surfaces)
  - Interactive Elements & Inputs: `#161B22`
  - Dividers & Outlines: `#21262D` (`1px` subtle border)
  - Brand Primary: `#6E5440` (Rustic oxidized iron — primary buttons & active accents)
  - Brand Hover/Active: `#7E624B`
  - Brand Accent/Rope: `#D0B595` (Warm natural linen)
  - Primary Text: `#F8FAFC`
  - Secondary/Muted Text: `#94A3B8`
- **Claro (Light Theme) Tokens (`data-theme="light"`)**:
  - Main Background: `#F8FAFC`
  - Surface Cards: `#FFFFFF`
  - Interactive Elements & Inputs: `#F1F5F9`
  - Borders: `#E2E8F0`
  - Brand Primary: `#6E5440`
  - Primary Text: `#0F172A`
  - Muted Text: `#64748B`
- **Functional Semantics (Both Themes)**:
  - Income / Central FAB Action: `#10B981`
  - Expenses / Destructive: `#EF4444`
  - Pending / Forecast: `#F59E0B`

## 6. Strict 100% Mobile-First PWA Standard
- All layouts, modals, forms, and navigation bars must be designed exclusively for mobile viewports (`max-w-lg mx-auto` centered container on larger screens so cards never stretch or break proportions).
- Enforce generous touch targets (`min-height: 44px–48px`) on all buttons, inputs, selects, and navigation items.
- Always include safe-area inset padding (`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`) for mobile notches and gesture navigation bars.
- Zero horizontal scrollbars (`overflow-x: clip` on `body`; never apply `overflow-x: hidden` or `overscroll-behavior-y: none` to `#root`, `.app-shell`, or `<main>` so natural vertical document scrolling and `sticky` headers remain 100% unlocked).
