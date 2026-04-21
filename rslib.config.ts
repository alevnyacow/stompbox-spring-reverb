import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: ['node 18'],
      dts: true,
      source: {
        entry: {
          index: './src/index.ts',
          next: './src/next.ts',
          express: './src/express.ts',
          ['tape-delay']: './src/tape-delay.ts'
        }
      }
    },
    {
      format: 'cjs',
      syntax: ['node 18'],
      source: {
        entry: {
          index: './src/index.ts',
          next: './src/next.ts',
          express: './src/express.ts',
          ['tape-delay']: './src/tape-delay.ts'
        }
      }
    },
  ],
});
