#!/usr/bin/env node
/**
 * Post-codegen script: removes re-exports from generated/types/index.ts that
 * would produce duplicate export errors when api-zod re-exports both
 * ./generated/api (Zod schemas) and ./generated/types (plain TS types).
 *
 * Orval generates Zod schema consts AND plain TypeScript types with the same
 * identifier when a schema is used directly as a request/response body. This
 * script detects those name collisions and prunes the offending lines from
 * types/index.ts so that both wildcard re-exports can coexist safely.
 *
 * This runs automatically after every `pnpm run codegen` invocation, so no
 * manual updates are needed when new endpoints are added.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiZodGenerated = resolve(__dirname, "..", "api-zod", "src", "generated");

// ── 1. Collect all top-level names exported by generated/api.ts ──────────────

const apiTs = readFileSync(resolve(apiZodGenerated, "api.ts"), "utf-8");

// Match: export const Foo, export function Foo, export type { Foo }
const apiExports = new Set([
  ...[...apiTs.matchAll(/^export (?:const|function|class|enum|let|var) (\w+)/gm)].map(
    (m) => m[1],
  ),
  ...[...apiTs.matchAll(/export type \{([^}]+)\}/g)].flatMap((m) =>
    m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()),
  ),
]);

// ── 2. Parse types/index.ts and remove conflicting re-exports ─────────────────

const typesIndexPath = resolve(apiZodGenerated, "types", "index.ts");
const typesIndex = readFileSync(typesIndexPath, "utf-8");

const filteredLines = typesIndex.split("\n").filter((line) => {
  const match = line.match(/^export \* from "\.\/(.+?)(?:\.ts)?";$/);
  if (!match) return true;

  const moduleName = match[1];
  const moduleFile = resolve(apiZodGenerated, "types", `${moduleName}.ts`);

  let moduleContent;
  try {
    moduleContent = readFileSync(moduleFile, "utf-8");
  } catch {
    return true;
  }

  const moduleExports = [
    ...[
      ...moduleContent.matchAll(
        /^export (?:type |interface |const |let |var |enum |function |class )?(\w+)/gm,
      ),
    ].map((m) => m[1]),
    ...[...moduleContent.matchAll(/export type \{([^}]+)\}/g)].flatMap((m) =>
      m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()),
    ),
  ].filter(Boolean);

  const conflicts = moduleExports.filter((name) => apiExports.has(name));
  if (conflicts.length > 0) {
    console.log(
      `[dedup] Removed export of ${moduleName} from types/index.ts` +
        ` (conflicts with Zod schema: ${conflicts.join(", ")})`,
    );
    return false;
  }

  return true;
});

writeFileSync(typesIndexPath, filteredLines.join("\n"), "utf-8");
console.log("[dedup] types/index.ts deduplicated successfully.");
