# Prumo (Family Plan)

## Problem and objective

Families and individuals often struggle to control their personal finances due to complex, clunky banking spreadsheets or intrusive third-party cloud apps that expose sensitive financial data. Prumo provides an ultra-clean, high-performance, local-first personal and family finance management application. It ensures total privacy with local SQLite storage, seamless local Wi-Fi QR code synchronization to mobile devices, and optional end-to-end encrypted cloud backup via Turso Database.

## Audience and roles

- **Primary Users:** Families, couples, and individuals managing daily household finances, installments, fuel logs, and multiple credit cards.
- **Usage Context:** Desktop/laptop local server at home, complemented by mobile PWA access on smartphones connected to the same local network or synchronized remotely.
- **Roles:** Single-family household shared view; transparent collaborative expense tracking.

## Initial release flows

1. **Dashboard Overview:** Real-time visibility of consolidated bank balance, confirmed/pending income, confirmed/pending expenses, category breakdowns, and monthly projections.
2. **Transaction Management:** Rapid entry of income, expenses, and transfers with visual category badges, payment status tracking, and recurring flags.
3. **Smart Credit Card Tracking:** Multi-card management with closing/due dates, automatic installment scheduling across future billing cycles (*Smart Invoice Cycle*), invoice payment generation, and 6-month forecast.
4. **Recurring Series & Installments:** Intelligent batch handling of recurring bills and installment purchases (e.g., *Installment 2/5*), supporting "Only this" or "This and upcoming" updates.
5. **Fuel Mileage & Cost Tracker:** Fuel log entries with price per liter, fuel type (gasoline/ethanol), total volume, vehicle odometer, average consumption calculation, and automatic expense ledger linkage.
6. **Local-First & Multi-Device Sync:** Local SQLite database persistence with WAL mode on desktop, paired with encrypted mobile pairing via scannable QR Code and optional Turso direct sync.

## MVP

1. Core financial dashboard with visual analytics (Recharts) and cashflow forecast.
2. Complete transaction registry with search, filtering, and CSV/PDF export.
3. Credit card statement and installment tracker.
4. Fuel log module with efficiency metrics.
5. Strict 2-theme architecture (`OLED` pure black & `Claro` daylight).
6. 100% mobile-first PWA responsiveness with offline capability.

## Out of scope

- Direct open-banking API scraping or automated bank credentials integration.
- Public multi-tenant cloud SaaS hosting.
- Third visual themes beyond OLED and Claro (legacy themes permanently excluded).

## Requirements

- **Local Privacy:** Financial records remain private and locally owned (`data/familyplan.db`).
- **Visual Standards:** Strict adherence to Prumo Design System tokens (`#000000` OLED background, `#0D1117` elevated surface, `#6E5440` rustic iron primary accent, `#10B981` income green, `#EF4444` expense red).
- **Responsive PWA:** Mobile viewport constraint (`max-w-lg mx-auto`), touch targets ≥ 44px, safe area insets for notches, zero horizontal scrollbar overflow.
- **Language:** English system documentation and assistant communication; Portuguese/English user interface text.

## Constraints and technical decisions

- **Frontend:** React 18.3.1, TypeScript 5.7.2, Vite 6.0.5, Tailwind CSS 3.4.17, `vite-plugin-pwa` 2.0.0.
- **Backend / Persistence:** Node.js Express 4.21.2 with native `node:sqlite` in WAL mode, combined with `@libsql/client` 0.18.0 for optional Turso cloud sync.
- **Database Architecture:** Retain SQLite & Turso schemas and clients as-is; do not migrate to Drizzle or PostgreSQL.
- **Runtime:** Node.js 22+ (for native `node:sqlite` stability).

## Assumptions and pending decisions

- **Assumption:** Users run the desktop application as the primary node and access the PWA either on the same device or over local Wi-Fi / Turso.
- **Reversible Detail:** Future additions for automated local database backups can be configured in `scripts/`.

## Acceptance criteria

1. Dashboard displays accurate net balance, income totals, expense totals, and forecasts without calculation drift.
2. Installments and recurring rules cleanly update without orphaned future records.
3. Credit card invoices accurately reflect closing date cutoffs.
4. Switching themes instantly toggles between `OLED` (`data-theme="oled"`) and `Claro` (`data-theme="light"`).
5. The UI adheres to `max-w-lg mx-auto` on all viewports with no horizontal clipping.
6. `npx tsc --noEmit` and `npm run build` execute cleanly with zero errors.

## Next delivery

Complete the Vibe Coding Toolkit integration (manifest documentation, ESLint quality gates, subagent orchestration policy, and verification commands).

## Maintenance

Update this document when business requirements, core flows, or MVP acceptance criteria evolve. Detailed technical implementations belong in `docs/architecture.md` and verification records in `docs/setup.md`.
