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
const REACT_DIR = join(ROOT, 'src', 'react');
const core = production.filter((file) => !file.startsWith(REACT_DIR));
const reactEntry = production.filter((file) => file.startsWith(REACT_DIR));

function outsideImports(sources: string[]): string[] {
  return sources.flatMap((file) => readFileSync(file, 'utf8').match(/from '[^.][^']*'/g) ?? []);
}
const PRODUCT_TERMS = ['invoice', 'τιμολ', 'iban', 'vatnumber'];

describe('package boundaries', () => {
  it('with core source, imports only its own files', () => {
    const imports = outsideImports(core);

    expect(core.length).toBeGreaterThan(3);
    expect(imports).toEqual([]);
  });

  it('with the react entry, imports only its own files and react', () => {
    const imports = outsideImports(reactEntry);

    expect(reactEntry.length).toBeGreaterThan(0);
    expect(new Set(imports)).toEqual(new Set(["from 'react'"]));
  });

  it('with every source file, the readme and the manifest, holds no product term', () => {
    const scanned = [...production, join(ROOT, 'README.md'), join(ROOT, 'package.json')];

    const hits = scanned.filter((file) => PRODUCT_TERMS.some((term) => readFileSync(file, 'utf8').toLowerCase().includes(term)));

    expect(hits).toEqual([]);
  });
});
