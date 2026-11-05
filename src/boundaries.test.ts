import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(join(ROOT, 'src'));
const production = files.filter((file) => !file.endsWith('.test.ts'));
const PRODUCT_TERMS = ['invoice', 'τιμολ', 'iban', 'vatnumber'];

describe('package boundaries', () => {
  it('with production source, imports only its own files', () => {
    const imports = production.flatMap((file) => readFileSync(file, 'utf8').match(/from '[^.][^']*'/g) ?? []);

    expect(production.length).toBeGreaterThan(3);
    expect(imports).toEqual([]);
  });

  it('with every source file, the readme and the manifest, holds no product term', () => {
    const scanned = [...production, join(ROOT, 'README.md'), join(ROOT, 'package.json')];

    const hits = scanned.filter((file) => PRODUCT_TERMS.some((term) => readFileSync(file, 'utf8').toLowerCase().includes(term)));

    expect(hits).toEqual([]);
  });
});
