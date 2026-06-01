import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

const isDev = process.env.MODE === 'development'

export default defineConfig({
  input: 'src/index.ts',
  external: ['react', 'react/jsx-runtime', '@flowchart/core'],
  output: [
    {
      file: 'dist/flowchart-react.esm.js',
      format: 'esm',
      sourcemap: isDev,
    },
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: isDev,
    },
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      sourceMap: isDev,
      outputToFilesystem: true,
    }),
  ],
})
