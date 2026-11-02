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

const steps = [
  {
    name: "Quality Rules Self-Check",
    command: process.execPath,
    args: ["scripts/verify-rules.mjs"],
  },
  {
    name: "TypeScript Compiler Check",
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["tsc", "--noEmit"],
  },
  {
    name: "ESLint Static Analysis",
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["eslint", "."],
  },
  {
    name: "Vite Production Build",
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["vite", "build"],
  },
];

console.log("\n🔍 Running Prumo Verification Suite...\n");

for (const step of steps) {
  process.stdout.write(`⏳ [${step.name}] running... `);
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error(`\n❌ [${step.name}] failed with exit code ${result.status}.\n`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ [${step.name}] passed.\n`);
}

console.log("🎉 All verification checks passed cleanly!\n");
