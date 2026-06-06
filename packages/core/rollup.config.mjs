import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import { defineConfig } from 'rollup'

const isDev = process.env.MODE === 'development'

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/flowchart.esm.js',
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
    typescript({ tsconfig: './tsconfig.json', declaration: true, declarationDir: 'dist', sourceMap: isDev, outputToFilesystem: true }),
    ...(isDev ? [] : [terser({
      compress: { passes: 2 },
      mangle: { reserved: ['FlowChart', 'generateId'] },
      format: { comments: false },
    })]),
  ],
})
