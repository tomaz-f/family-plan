# Security, Data Integrity, and Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the critical and high-priority findings from the multi-lens code review: eliminate client-side token leakage, secure family authentication, scrub master keys from URL history, prevent historical data loss on card deletion, ensure atomic installment batching, resolve hook initialization orders, and normalize themes.

**Architecture:** 
- Strip build-time secret injection from `vite.config.ts` and client services, keeping database credentials server-side.
- Tighten endpoint authorization in `server/index.mjs` with explicit family validation.
- Make multi-row database updates in `server/db.mjs` atomic via `turso.batch`.
- Disassociate rather than delete historical transaction records on card removal.
- Reorder React modal state declarations to comply with Temporal Dead Zone rules.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Express 4.21, LibSQL / Turso Client, ESLint 9.

**Spec:** Code review report findings from `2026-11-02` (SEC-01, SEC-02, SEC-03, DATA-01, DATA-02, REACT-02, STYLE-01).

## Global Constraints

- **Language:** English responses, commit messages, and documentation.
- **Strict 2-Theme Architecture:** Only `oled` and `light` are permitted; legacy themes normalize to `oled`.
- **Mobile-First Standard:** Layouts adhere to `max-w-lg mx-auto` with touch targets ≥ 44px and safe area insets.
- **Database Safety:** Preserve SQLite WAL & Turso architecture; never migrate to PostgreSQL or Drizzle.
- **No Automatic Git Push:** Changes staged and committed locally; no automatic push without explicit user request.
- **Automatic Preview Workflow:** Run `npm run build` and launch `npm run preview -- --host` upon task completion.

## Review Focus

1. Verify that `dist/assets/*.js` contains zero instances of database authentication tokens.
2. Verify that unauthenticated requests to `/api/state` without a valid `x-family-id` receive `401 Unauthorized`.
3. Verify that opening a pairing URL with `?key=...` saves the key to `localStorage` and cleans the URL search bar.
4. Verify that deleting a credit card does NOT delete existing transactions that reference the card.
5. Verify that `npm run verify` passes with 0 compiler errors, 0 ESLint errors, and clean production build.

---

### Task 1: [SEC-01] Eliminate Secret Turso Database Token from Client Build

**Files:**
- Modify: `vite.config.ts:24-34`
- Modify: `src/services/tursoService.ts:107-125`

**Steps:**
- [x] Remove `import.meta.env.VITE_TURSO_TOKEN`, `process.env.TURSO_TOKEN`, `process.env.turso_token` from `define` block in `vite.config.ts`.
- [x] In `src/services/tursoService.ts`, remove fallback to `VITE_TURSO_TOKEN` and ensure direct client connections only initialize if a user explicitly provides credentials, preventing compile-time token leakage.
- [x] Run `npm run build` and inspect `dist/assets/*.js` with a script to verify that no secret JWT prefix or token string is present in client bundles.

**Verification Command:**
```powershell
npm run build
Get-ChildItem dist\assets\*.js | Select-String "eyJhbGci"
```
*Expected Result:* Zero matches found. (Verified: 0 matches)

---

### Task 2: [SEC-03] Scrub Master Key from Browser URL After Pairing

**Files:**
- Modify: `src/services/cryptoService.ts:6-24`

**Steps:**
- [x] In `getStoredMasterKey()`, after reading and storing `sanitized` key from `window.location.search`, invoke `window.history.replaceState({}, document.title, window.location.pathname + window.location.hash)` to clean the address bar.
- [x] Ensure the clean sanitized key is returned and stored in `localStorage` without leaving trace in history.

**Verification Command:**
```powershell
npx tsc --noEmit
```
*Expected Result:* Clean TypeScript compilation without errors. (Verified: 0 errors)

---

### Task 3: [SEC-02] Harden Family Space Authentication on Express Server

**Files:**
- Modify: `server/index.mjs:142-156` and API route handlers

**Steps:**
- [x] In `resolveFamilyId(req)`, require a valid sanitized `familyId` provided via header `x-family-id`, query, or body.
- [x] Remove the unauthenticated fallback (`SELECT family_id FROM families ORDER BY created_at ASC LIMIT 1`) that leaked the first family's data to arbitrary LAN callers.
- [x] For initial setup/pairing, maintain explicit endpoints (`/api/families/create`, `/api/families/join`, `/api/families/:id/verify`).
- [x] If no valid `familyId` is provided or found, return `null` and respond with `401 Unauthorized` on protected endpoints (`/api/state`, `/api/transactions`, `/api/settings`).

**Verification Command:**
```powershell
node --check server/index.mjs
```
*Expected Result:* Syntax check passes with code 0. (Verified: exit code 0)

---

### Task 4: [DATA-01] Preserve Historical Transactions When Credit Card is Removed

**Files:**
- Modify: `server/db.mjs:860-870` (`deleteCreditCard`)

**Steps:**
- [x] Replace `DELETE FROM transactions WHERE family_id = ? AND cardId = ?` with `UPDATE transactions SET cardId = NULL WHERE family_id = ? AND cardId = ?`.
- [x] Ensure card deletion deletes only the card from `credit_cards`, while unlinking associated transactions so historical expenses, balances, and reports remain intact.

**Verification Command:**
```powershell
node --check server/db.mjs
```
*Expected Result:* Syntax check passes with code 0. (Verified: exit code 0)

---

### Task 5: [DATA-02] Make Multi-Month Installment and Series Operations Atomic

**Files:**
- Modify: `server/db.mjs:630-655` (`saveTransaction`)
- Modify: `server/db.mjs:724-750` (`updateTransaction`)
- Modify: `server/db.mjs:787-797` (`deleteTransaction`)

**Steps:**
- [x] In `saveTransaction`, collect all `futureEntries` statements and execute them in an atomic `turso.batch([...], 'write')` call together with the primary transaction.
- [x] In `updateTransaction`, collect `updatedSeriesEntries` and execute them via `turso.batch` to prevent partial updates.
- [x] In `deleteTransaction`, batch multiple deletions when `deleteIds` is provided.

**Verification Command:**
```powershell
node --check server/db.mjs
```
*Expected Result:* Syntax check passes with code 0. (Verified: exit code 0)

---

### Task 6: [REACT-02] Fix Temporal Dead Zone State Hook Declarations in Modals

**Files:**
- Modify: `src/components/TransactionModal.tsx:110-145`
- Modify: `src/components/CreditCardExpenseModal.tsx:110-140`

**Steps:**
- [x] In `TransactionModal.tsx`, move `const [categoryPickerOpen, setCategoryPickerOpen] = useState(...)` above the `useEffect` that updates `categoryPickerOpen`.
- [x] In `CreditCardExpenseModal.tsx`, move `const [categoryPickerOpen, setCategoryPickerOpen] = useState(...)` above the `useEffect` that updates `categoryPickerOpen`.
- [x] Ensure no state setter is referenced before its `useState` declaration line.

**Verification Command:**
```powershell
npm run lint
```
*Expected Result:* Zero TDZ or initialization errors reported. (Verified: 0 errors)

---

### Task 7: [STYLE-01] Enforce Strict 2-Theme Validation on Server Settings Endpoint

**Files:**
- Modify: `server/db.mjs:366-368` (`updateSettings`)

**Steps:**
- [x] Replace `['light', 'dark', 'tokyo-night', 'oled'].includes(theme)` with strict normalization:
  ```js
  const validTheme = theme === 'light' ? 'light' : 'oled';
  await setSetting(familyId, 'theme', validTheme);
  ```
- [x] Guarantee that legacy themes (`dark`, `tokyo-night`) automatically normalize to `oled` when received by the server.

**Verification Command:**
```powershell
node --check server/db.mjs
```
*Expected Result:* Syntax check passes with code 0. (Verified: exit code 0)

---

### Task 8: Full Verification Suite & Local Preview

**Files:**
- Validate: entire repository

**Steps:**
- [x] Run `npm run verify` to confirm rule tester, `tsc --noEmit`, `eslint .`, and `vite build` all succeed.
- [x] Launch `npm run preview -- --host` in the background and verify HTTP 200 response on `http://localhost:4174/family-plan/`.
- [x] Review `git status` and verify changes.

**Verification Command:**
```powershell
npm run verify
```
*Expected Result:* "All verification checks passed cleanly!" (Verified: all 4 checks passed)
