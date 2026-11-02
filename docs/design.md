# Design and Accessibility Specification

This document defines the mandatory visual identity, theme architecture, accessibility guidelines, and mobile-first layout standards for **Prumo**.

---

## 1. Visual Direction & Brand Identity

- **Visual Tone:** Sophisticated, minimalist, high-contrast, and distraction-free. Designed for rapid financial logging and clear overview of household cash flow.
- **Audience:** Everyday mobile users and families seeking immediate clarity on finances without cognitive fatigue.
- **Primary Accent:** Rustic oxidized iron (`#6E5440`) and warm natural linen (`#D0B595`) providing an understated, dependable aesthetic.

---

## 2. Strict Two-Theme System

Prumo supports **only two themes** (`export type AppTheme = 'oled' | 'light'`):

1. **`OLED` (`data-theme="oled"`)** — Default & flagship theme optimized for OLED smartphone displays (pure `#000000` black).
2. **`Claro` (`data-theme="light"`)** — High-contrast daylight theme (`#F8FAFC`).

> [!IMPORTANT]
> Legacy themes (`dark`, `tokyo-night`) are permanently removed. Any unrecognized or legacy theme stored in `localStorage` or backup files automatically normalizes to `'oled'`.

---

## 3. Color Tokens

### OLED Theme (`data-theme="oled"`)
| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Main Background** | `#000000` | Root viewport, main financial card, app background |
| **Surface Cards & Modals** | `#0D1117` | Elevated cards, dialogs, bottom sheets |
| **Interactive Elements & Inputs** | `#161B22` | Form inputs, selects, pills, hover states |
| **Dividers & Outlines** | `#21262D` | `1px` subtle borders and list dividers |
| **Brand Primary** | `#6E5440` | Rustic oxidized iron — primary buttons & brand accents |
| **Brand Hover / Active** | `#7E624B` | Hover/active state for primary brand buttons |
| **Brand Accent / Rope** | `#D0B595` | Warm natural linen — active nav indicators & subtle highlights |
| **Primary Text** | `#F8FAFC` | Headings, primary values, titles |
| **Secondary / Muted Text** | `#94A3B8` | Subtitles, metadata, secondary labels |

### Claro Theme (`data-theme="light"`)
| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Main Background** | `#F8FAFC` | Root viewport & app shell background |
| **Surface Cards** | `#FFFFFF` | Cards, modals, sheets |
| **Interactive Elements & Inputs** | `#F1F5F9` | Form inputs, selects, secondary pills |
| **Borders** | `#E2E8F0` | Card outlines & dividers |
| **Brand Primary** | `#6E5440` | Rustic oxidized iron — primary buttons & active accents |
| **Primary Text** | `#0F172A` | Headings, primary values, titles |
| **Muted Text** | `#64748B` | Subtitles, metadata, secondary labels |

### Functional Semantics (Both Themes)
| Role | Hex | Usage |
| :--- | :--- | :--- |
| **Income / Central FAB** | `#10B981` | Positive cashflow, income badges, central `[+]` FAB |
| **Expenses / Destructive** | `#EF4444` | Outflows, expenses, delete actions |
| **Pending / Forecast** | `#F59E0B` | Unpaid items, warnings, scheduled transactions |

---

## 4. 100% Mobile-First PWA Standard

- **Centered Native Mobile Shell:** The main application header, content area, and bottom navigation bar use a centered mobile-first container (`max-w-lg mx-auto`) so desktop viewports render as a clean centered mobile app without stretched cards.
- **Touch Targets:** All interactive buttons, inputs, selects, and navigation tabs enforce a minimum height of `44px–48px`.
- **Safe Area Insets:** Top headers and bottom navigation bars respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- **Zero Horizontal Overflow & Natural Vertical Scroll:** Use `overflow-x: clip` on `body` only; never set `overflow-x: hidden` or `overscroll-behavior-y: none` on `#root`, `.app-shell`, or `<main>`, ensuring native vertical scrolling (`overflow-y: auto`) works freely across mouse wheel and touch gestures.

---

## 5. Interaction & Accessibility Guidelines

- **Semantic Controls:** Always use semantic HTML (`<button>`, `<input>`, `<dialog>`, `<nav>`).
- **Visible Focus:** Ensure high-contrast keyboard focus indicators on all interactive inputs and buttons.
- **Inline Error Feedback:** Validation errors appear directly adjacent to the input field with high contrast text (`#EF4444`).
- **Reduced Motion:** Interactive transitions respect `@media (prefers-reduced-motion: reduce)` to prevent disorientation.
- **Contrast Ratios:** Text against background meets WCAG 2.1 AA standards (minimum 4.5:1 for normal text, 3:1 for large text and UI components).

---

## 6. Maintenance

Any new component, theme variable, or visual adjustment must be validated against the color tokens and mobile-first constraints described in this document.
