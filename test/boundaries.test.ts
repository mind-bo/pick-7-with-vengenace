import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
}

describe("import boundaries", () => {
  it("src/web does not import src/worker", () => {
    for (const file of sourceFiles("src/web")) {
      expect(importsOf(file).filter((s) => /\/worker(\/|$)/.test(s)), file).toEqual([]);
    }
  });

  it("src/shared imports only from src/shared", () => {
    for (const file of sourceFiles("src/shared")) {
      expect(importsOf(file).filter((s) => !s.startsWith("./")), file).toEqual([]);
    }
  });

  it.skipIf(!existsSync("src/worker/room.ts"))("src/worker/room.ts imports only src/shared", () => {
    expect(importsOf("src/worker/room.ts").filter((s) => !s.startsWith("../shared/")))
      .toEqual([]);
  });
});
