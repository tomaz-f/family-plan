// Self-check for the quality/* rules. Uses ESLint's own RuleTester.
// Adapted from the Vibe Coding Toolkit for Prumo.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RuleTester } from "eslint";

const target = process.argv[2] ?? "./eslint-rules/index.cjs";
const plugin = (await import(pathToFileURL(path.resolve(target)).href)).default;

const ruleTester = new RuleTester();
const testFilenames = ["src/order.e2e-spec.ts", "src/order-spec.ts", "src/order-test.js", "src/order.spec.mts", "src/order.test.cts"];
const lines = (count) =>
  Array.from({ length: count }, (_, i) => `const value${i} = ${i};`).join("\n") +
  "\n";

ruleTester.run("quality/max-lines", plugin.rules["max-lines"], {
  valid: [
    ...testFilenames.map((filename) => ({
      name: `test suffix is exempt by default: ${filename}`,
      code: lines(20), filename, options: [{ max: 10 }],
    })),
    {
      name: "a non-index barrel is exempt by content",
      code: Array.from({ length: 20 }, (_, i) => `export * from "./module${i}";`).join("\n"),
      filename: "src/public-api.ts", options: [{ max: 10 }],
    },
    {
      name: "empty statements do not turn a forwarding module into runtime logic",
      code: 'import { value } from "./module";\nexport { value };\n' + ";\n".repeat(20),
      filename: "src/public-api.ts", options: [{ max: 10 }],
    },
    {
      name: "a file under the budget",
      code: lines(3),
      filename: "src/service.ts",
      options: [{ max: 10 }],
    },
    {
      name: "test files are exempt by default",
      code: lines(20),
      filename: "src/service.test.ts",
      options: [{ max: 10 }],
    },
    {
      name: "files inside a test directory are exempt by default",
      code: lines(20),
      filename: "src/__tests__/helpers.ts",
      options: [{ max: 10 }],
    },
    {
      name: "declaration files are never checked",
      code: lines(20),
      filename: "src/types.d.ts",
      options: [{ max: 10 }],
    },
    {
      name: "a pure re-export barrel is exempt by content",
      code: Array.from({ length: 20 }, (_, i) => `export { item${i} } from "./module${i}";`).join("\n"),
      filename: "src/index.ts",
      options: [{ max: 10 }],
    },
    {
      name: "generated output is never checked",
      code: lines(20),
      filename: "src/generated/client.ts",
      options: [{ max: 10 }],
    },
    {
      name: "a baseline entry silences a known offender",
      code: lines(20),
      filename: "src/legacy.ts",
      options: [{ max: 10, ignore: ["src/legacy.ts"] }],
    },
  ],
  invalid: [
    ...testFilenames.map((filename) => ({
      name: `includeTests opts in a test suffix: ${filename}`,
      code: lines(20), filename, options: [{ max: 10, includeTests: true }],
      errors: [{ messageId: "tooLong" }],
    })),
    {
      name: "a similar production suffix is still checked",
      code: lines(20), filename: "src/order-specification.ts", options: [{ max: 10 }],
      errors: [{ messageId: "tooLong" }],
    },
    ...["src/index.ts", "src/components/index.tsx", "src/types.ts", "src/constants.ts", "C:\\repo\\src\\index.ts"].map((filename) => ({
      name: `regular file over the budget: ${filename}`,
      code: lines(20), filename, options: [{ max: 10 }],
      errors: [{ messageId: "tooLong" }],
    })),
  ],
});

console.log("✓ quality/max-lines RuleTester passed.");
