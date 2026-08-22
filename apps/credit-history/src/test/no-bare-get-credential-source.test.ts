import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// A silent, zero-argument getCredentialSource() call falls back to mock
// fixtures even when NEXT_PUBLIC_DATA_SOURCE=real. Every session-gated
// surface must go through useCredentialSource(); any other call site must
// pass an explicit options object (e.g. `{ client }` when the owner is
// legitimately unresolved, as in the public verifier).
const THIS_FILE = fileURLToPath(import.meta.url);
const SRC_DIR = dirname(dirname(THIS_FILE));
const BARE_CALL_PATTERN = /getCredentialSource\(\s*\)/;

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, files);
      continue;
    }
    if (full === THIS_FILE) continue;
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.test\.tsx?$/.test(entry)) continue;
    files.push(full);
  }
  return files;
}

describe('getCredentialSource() call sites', () => {
  it('never calls getCredentialSource() with zero arguments', () => {
    const offenders = collectSourceFiles(SRC_DIR)
      .filter((file) => BARE_CALL_PATTERN.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(`${SRC_DIR}/`, ''));

    expect(offenders).toEqual([]);
  });
});
