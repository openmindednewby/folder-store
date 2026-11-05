import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'testing/fakeFolder': 'src/testing/fakeFolder.ts' },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: false,
  treeshake: true,
  minify: false,
  target: 'es2020',
  outDir: 'dist',
});
