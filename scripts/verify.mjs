#!/usr/bin/env node
/**
 * Prumo Unified Quality Verification Runner
 * Runs:
 * 1. Custom ESLint quality rules self-check
 * 2. TypeScript compilation check (tsc --noEmit)
 * 3. ESLint static analysis
 * 4. Production Vite build check
 */

import { spawnSync } from "node:child_process";

const isWin = process.platform === "win32";

const steps = [
  {
    name: "Quality Rules Self-Check",
    command: process.execPath,
    args: ["scripts/verify-rules.mjs"],
    shell: false,
  },
  {
    name: "TypeScript Compiler Check",
    command: isWin ? "cmd.exe" : "npx",
    args: isWin ? ["/d", "/s", "/c", "npx", "tsc", "--noEmit"] : ["tsc", "--noEmit"],
    shell: false,
  },
  {
    name: "ESLint Static Analysis",
    command: isWin ? "cmd.exe" : "npx",
    args: isWin ? ["/d", "/s", "/c", "npx", "eslint", "."] : ["eslint", "."],
    shell: false,
  },
  {
    name: "Vite Production Build",
    command: isWin ? "cmd.exe" : "npx",
    args: isWin ? ["/d", "/s", "/c", "npx", "vite", "build"] : ["vite", "build"],
    shell: false,
  },
];

console.log("\n🔍 Running Prumo Verification Suite...\n");

for (const step of steps) {
  process.stdout.write(`⏳ [${step.name}] running... `);
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: step.shell,
  });

  if (result.status !== 0) {
    console.error(`\n❌ [${step.name}] failed with exit code ${result.status}.\n`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ [${step.name}] passed.\n`);
}

console.log("🎉 All verification checks passed cleanly!\n");
