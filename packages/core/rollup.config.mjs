import typescript from '@rollup/plugin-typescript'
import JavaScriptObfuscator from 'javascript-obfuscator'
import { defineConfig } from 'rollup'

const isDev = process.env.MODE === 'development'

function obfuscate() {
  return {
    name: 'javascript-obfuscator',
    renderChunk(code) {
      const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        // Control-flow flattening makes logic harder to follow without significant size cost
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.4,
        deadCodeInjection: false,
        // Hex-style identifiers (_0x1a2b) throughout
        identifierNamesGenerator: 'hexadecimal',
        // Must be false — renaming exports would break consumers
        renameGlobals: false,
        // selfDefending uses eval which breaks strict CSP policies
        selfDefending: false,
        // String array moves literals to an encoded lookup table
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.8,
        // Splitting strings would bloat GLSL shader source strings significantly
        splitStrings: false,
        unicodeEscapeSequence: false,
        numbersToExpressions: false,
      })
      return { code: result.getObfuscatedCode() }
    },
  }
}

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.esm.js',
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
    ...(isDev ? [] : [obfuscate()]),
  ],
})
