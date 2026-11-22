import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        getAllSourceFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('CI Architectural & Codebase Invariants', () => {
  const srcDir = path.resolve(process.cwd(), 'src');
  const allFiles = getAllSourceFiles(srcDir);

  test('Strict NASA Power of 10: strictly zero files exceed 350 lines in src/', () => {
    const offendingFiles: { file: string; lines: number }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lineCount = content.split('\n').length;
      if (lineCount > 350) {
        offendingFiles.push({
          file: path.relative(process.cwd(), file),
          lines: lineCount
        });
      }
    }

    expect(offendingFiles).toEqual([]);
  });

  test('Client-Server Isolation: zero client files import from src/server/', () => {
    const clientFiles = allFiles.filter(
      (f) =>
        !f.includes(path.join('src', 'server')) &&
        !f.includes('__tests__') &&
        !f.endsWith('.d.ts')
    );

    const illegalImports: { file: string; importLine: string }[] = [];

    for (const file of clientFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (
          (line.includes("from '") || line.includes('from "')) &&
          (line.includes('/server/') || line.includes('server/seeds') || line.includes('server/repositories'))
        ) {
          illegalImports.push({
            file: path.relative(process.cwd(), file),
            importLine: line.trim()
          });
        }
      }
    }

    expect(illegalImports).toEqual([]);
  });

  test('Strict Type Safety: zero ": any" types in production business views and components', () => {
    const businessFiles = allFiles.filter(
      (f) =>
        !f.includes('__tests__') &&
        !f.endsWith('.d.ts') &&
        !f.includes('vite-env') &&
        !f.includes('analytics.ts')
    );

    const anyMatches: { file: string; line: string }[] = [];

    for (const file of businessFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        // Match explicit `: any` not inside comments
        if (/:\s*any\b/.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          anyMatches.push({
            file: path.relative(process.cwd(), file),
            line: line.trim()
          });
        }
      }
    }

    expect(anyMatches).toEqual([]);
  });
});
