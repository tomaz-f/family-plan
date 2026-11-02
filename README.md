# Prumo (Family Plan)

> **Local-First Family Financial Control & Multi-Device Sync App**

Prumo is an ultra-fast, privacy-first personal and family finance management application. It runs locally on your desktop/server using SQLite (WAL mode) and synchronizes seamlessly across mobile devices on your local Wi-Fi via QR Code, with optional Turso Database cloud sync.

---

## 🗺️ Documentation Map

- **[PRODUCT.md](PRODUCT.md)** — Core product vision, target audience, MVP features, business rules, and constraints.
- **[AGENTS.md](AGENTS.md)** — AI agent working agreements, canonical commands, and subagent policies.
- **[CLAUDE.md](CLAUDE.md)** — Multi-client bridge importing `AGENTS.md`.
- **[docs/architecture.md](docs/architecture.md)** — Software architecture, technology stack, directory map, and boundaries.
- **[docs/design.md](docs/design.md)** — Prumo Design System specification, 2-theme tokens (`OLED` & `Claro`), and mobile-first standards.
- **[docs/onboarding.md](docs/onboarding.md)** — Local development environment setup, first-time run, and database setup.
- **[docs/quality.md](docs/quality.md)** — Quality gates, ESLint rules, verification scripts, and security review protocols.
- **[docs/setup.md](docs/setup.md)** — Toolkit adoption evidence, catalog coverage matrix, and audit records.

---

## 🚀 Key Features

- **Consolidated Dashboard:**
  - Real-time net bank balance with quick-action transaction modals.
  - Confirmed vs. projected income and expense tracking.
  - Monthly cash flow charts, category distributions, and daily spending velocity (Recharts).

- **Installment & Recurring Tracker:**
  - Intelligent installment tracking across series (e.g., *Installment 2/5*).
  - Batch editing and cancellation ("Only this" or "This and upcoming").

- **Credit Card Management:**
  - Support for multiple cards with individual limits, closing dates, and due dates.
  - Automated invoice cycle routing based on purchase date and card closing dates (*Smart Invoice Cycle*).
  - 6-month forward liability projection and one-click invoice payment settling.

- **Fuel Log & Efficiency Tracker:**
  - Log fuel stops with fuel type (gasoline/ethanol), odometer reading, price per liter, and total cost.
  - Real-time average consumption (km/L) and cost-per-km metrics linked directly to expenses.

- **Local-First Privacy & Multi-Device Sync:**
  - Local SQLite persistence in WAL mode (`data/familyplan.db`).
  - Fast, encrypted mobile pairing over local Wi-Fi via scannable QR Code.
  - Optional cloud backup and direct synchronization via Turso.

- **Strict 2-Theme Design System:**
  - **OLED Theme (`data-theme="oled"`):** Pure-black `#000000` design optimized for mobile OLED screens.
  - **Claro Theme (`data-theme="light"`):** Clean, high-contrast daylight theme (`#F8FAFC`).
  - Mobile-first shell (`max-w-lg mx-auto`) with safe area insets and minimum 44px touch targets.

---

## 🛠️ Stack & Technologies

- **Frontend:** React 18, TypeScript 5, Vite 6, Tailwind CSS 3, `vite-plugin-pwa` 2, Lucide React, Recharts.
- **Backend / Local Server:** Node.js Express 4 + native `node:sqlite` (WAL mode) + Turso client (`@libsql/client`).
- **Exporting & Utilities:** jsPDF, QRCode.

---

## 📦 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v22+ (recommended for native `node:sqlite` support).
- [Git](https://git-scm.com/).

### Installation
```bash
git clone https://github.com/tomaz-f/family-plan.git
cd family-plan
npm ci
```

### Development Mode
```bash
npm run dev
```

### Production Build & Local Preview
```bash
npm run build
npm run preview -- --host
```

Access the app:
- **Desktop:** `http://localhost:3456` (or `http://localhost:4173` for Vite preview)
- **Mobile (Same Wi-Fi):** Scan the QR Code displayed in the app settings or visit the local network IP.

---

## 🔒 Privacy & Security

All financial transactions are stored locally on your device (`data/familyplan.db`). Database files, WAL files, and personal backup exports are strictly ignored by `.gitignore`.
