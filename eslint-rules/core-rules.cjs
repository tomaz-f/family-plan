"use strict";

const {
  BANNED_CONSOLE_METHODS,
  DEFAULT_MAX_LINES,
  fileName,
  isBaselineIgnored,
  isCheckableSourceFile,
  isTestFile,
} = require("./utils.cjs");

function importsGuardedBinding(node, bindings) {
  return node.specifiers.some((specifier) => {
    if (
      specifier.type === "ImportDefaultSpecifier" ||
      specifier.type === "ImportNamespaceSpecifier"
    ) {
      return true;
    }
    return (
      specifier.type === "ImportSpecifier" &&
      specifier.imported.type === "Identifier" &&
      bindings.has(specifier.imported.name)
    );
  });
}

const maxLines = {
  meta: {
    type: "suggestion",
    docs: { description: "Enforce a source file size budget." },
    messages: {
      tooLong: [
        "File too large ({{lines}} lines | max {{max}}).",
        "",
        "Refactor into smaller, focused units:",
        "  - Business logic -> domain service or use-case module",
        "  - Repeated UI blocks -> reusable sub-component",
        "  - Data access code -> repository or adapter",
        "  - Helper clusters -> domain-specific utility module",
      ].join("\n"),
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "integer", minimum: 1 },
          ignore: { type: "array", items: { type: "string" } },
          includeTests: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] ?? {};
    const max = options.max ?? DEFAULT_MAX_LINES;
    const ignore = options.ignore ?? [];
    const includeTests = options.includeTests ?? false;
    const filename = fileName(context);
    const checkable =
      isCheckableSourceFile(filename) ||
      (includeTests && isTestFile(filename) && !filename.endsWith(".d.ts"));
    if (!checkable || isBaselineIgnored(filename, ignore)) {
      return {};
    }
    return {
      Program(node) {
        const declarationOnly = node.body.every((statement) => {
          if (["ImportDeclaration", "ExportAllDeclaration", "EmptyStatement"].includes(statement.type)) return true;
          if (["ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(statement.type)) {
            if (!statement.declaration) return true;
            statement = statement.declaration;
          }
          return ["TSTypeAliasDeclaration", "TSInterfaceDeclaration"].includes(statement.type);
        });
        if (declarationOnly) return;
        const lines = context.sourceCode.lines.length;
        if (lines > max) {
          context.report({
            loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
            messageId: "tooLong",
            data: { lines, max },
          });
        }
      },
    };
  },
};

const noDirectConsole = {
  meta: {
    type: "problem",
    docs: { description: "Disallow direct console output outside log adapters." },
    messages: {
      banned: "Use {{logger}} instead of console.{{method}}().",
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
          logger: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] ?? {};
    const allow = new Set(options.allow ?? []);
    const logger = options.logger ?? "the project logging helper";
    const filename = fileName(context);
    if (isTestFile(filename)) return {};
    return {
      MemberExpression(node) {
        if (
          node.object.type === "Identifier" &&
          node.object.name === "console" &&
          node.property.type === "Identifier" &&
          BANNED_CONSOLE_METHODS.has(node.property.name) &&
          !allow.has(node.property.name)
        ) {
          context.report({
            node,
            messageId: "banned",
            data: { logger, method: node.property.name },
          });
        }
      },
    };
  },
};

const noDirectDataAccess = {
  meta: {
    type: "problem",
    docs: {
      description: "Keep the database client out of presentation layers.",
    },
    messages: {
      forbidden:
        "Do not import {{module}} from this layer; go through a repository or service instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          modules: { type: "array", items: { type: "string" }, minItems: 1 },
          layers: { type: "array", items: { type: "string" }, minItems: 1 },
          bindings: { type: "array", items: { type: "string" } },
          extensions: { type: "array", items: { type: "string" } },
        },
        required: ["modules", "layers"],
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] ?? {};
    const modules = new Set(options.modules ?? []);
    const layers = options.layers ?? [];
    const bindings = new Set(options.bindings ?? ["db"]);
    const extensions = options.extensions ?? [];
    const filename = fileName(context);
    if (isTestFile(filename)) return {};
    const guarded =
      layers.some((layer) => filename.includes(layer)) ||
      extensions.some((extension) => filename.endsWith(extension));
    if (!guarded) return {};
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value);
        if (!modules.has(source)) return;
        if (!importsGuardedBinding(node, bindings)) return;
        context.report({ node, messageId: "forbidden", data: { module: source } });
      },
    };
  },
};

module.exports = {
  maxLines,
  noDirectConsole,
  noDirectDataAccess,
};
