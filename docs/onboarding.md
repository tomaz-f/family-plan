# Local Preparation and Onboarding

Welcome to **Prumo**. This guide details how to set up, build, and run the project locally.

---

## 1. Prerequisites

- **Node.js:** v22.0.0 or higher (required for native `node:sqlite` module support).
- **npm:** v10+ (tested with npm 11.20.0).
- **Git:** Version 2.30+.
- **Operating System:** Windows, macOS, or Linux (Windows PowerShell tested).

Verify your environment:
```bash
node -v
npm -v
git --version
```

---

## 2. First Run & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tomaz-f/family-plan.git
   cd family-plan
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Configure Environment Variables:**
   Create or verify your `.env` file at the root. For local-only development, SQLite runs without any external configuration. For Turso cloud sync, specify:
   ```env
   turso_db_url=libsql://your-database.turso.io
   turso_token=your-turso-jwt-token
   ```
   *(Note: `.env` is strictly gitignored. Never commit credentials to source control).*

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   This starts the Node.js Express server on `http://localhost:3456`, which automatically serves the local API and launches Vite in development mode.

---

## 3. Database Initialization

- The local SQLite database is stored at `data/familyplan.db`.
- When starting the server (`npm run dev` or `npm start`), `server/db.mjs` automatically initializes required tables with WAL mode enabled.
- No manual SQL migrations or database setup commands are necessary.
- Database files (`*.db`, `*.db-wal`, `*.db-shm`) are strictly excluded from Git.

---

## 4. Production Build & Local Preview

To compile the production frontend and launch the preview server:
```bash
npm run build
npm run preview -- --host
```
The preview server will be available at `http://localhost:4173` (or the network IP printed in the terminal).

To test mobile sync:
1. Ensure your smartphone is connected to the same Wi-Fi network.
2. Open Prumo on your desktop browser.
3. Click the Sync button or open Mobile Sync to scan the generated pairing QR Code.

---

## 5. Verification Commands

Run the canonical checks before creating any branch or submitting code:
```bash
npx tsc --noEmit     # TypeScript typecheck
npm run lint         # ESLint quality gates
npm run verify       # Full verification (typecheck + lint + build)
```

---

## 6. AI Agent Guidelines

If you are using an AI coding assistant, please refer to:
- **[AGENTS.md](../AGENTS.md)**: AI agent instructions, constraints, and subagent rules.
- **[docs/quality.md](quality.md)**: Quality gates, linting rules, and security review prompt.
- **[docs/setup.md](setup.md)**: Toolkit adoption audit and component coverage matrix.
