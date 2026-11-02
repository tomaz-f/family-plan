"use strict";

const DEFAULT_MAX_LINES = 350;

const BANNED_CONSOLE_METHODS = new Set([
  "log",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "dir",
  "table",
  "time",
  "timeEnd",
  "timeLog",
  "group",
  "groupEnd",
  "groupCollapsed",
  "count",
  "countReset",
  "assert",
  "profile",
  "profileEnd",
]);

const NON_SOURCE_BASENAME = /[.-](stories|config|conf)\.[^.]+$/;

const IGNORED_PATH_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  "generated",
  "__generated__",
  "migrations",
  "migration",
  "locales",
  "__tests__",
  "__mocks__",
  "fixtures",
  "mocks",
]);

function normalizeFilePath(filename) {
  return filename.replace(/\\/g, "/");
}

function fileName(context) {
  return normalizeFilePath(context.filename ?? context.getFilename());
}

function isTestFile(filename) {
  return /(^|\/)(__tests__|__mocks__|fixtures|mocks)(\/|$)|[.-](test|spec)\.[cm]?[jt]sx?$/.test(
    filename
  );
}

function isCheckableSourceFile(filename) {
  if (filename.endsWith(".d.ts")) return false;
  const segments = filename.split("/");
  for (const segment of segments.slice(0, -1)) {
    if (IGNORED_PATH_SEGMENTS.has(segment)) return false;
  }
  const base = segments[segments.length - 1];
  return !isTestFile(filename) && !NON_SOURCE_BASENAME.test(base);
}

function isBaselineIgnored(filename, ignore) {
  return ignore.some(
    (entry) => filename === entry || filename.endsWith(`/${entry}`)
  );
}

module.exports = {
  BANNED_CONSOLE_METHODS,
  DEFAULT_MAX_LINES,
  fileName,
  isBaselineIgnored,
  isCheckableSourceFile,
  isTestFile,
};
