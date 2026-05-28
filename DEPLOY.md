# DEPLOY.md

## Environments

### Development (demo)
```bash
pnpm install
pnpm dev          # starts Vite dev server at http://localhost:5173
```

### Build library
```bash
pnpm build        # builds all packages via rollup
# output: packages/core/dist/index.esm.js, index.cjs.js, index.d.ts
```

### Publish (future)
```bash
cd packages/core
npm publish --access public
```

## Environment Variables
None required for the library itself.

## Browser Requirements
- WebGL2 (Chrome 56+, Firefox 51+, Safari 15+, Edge 79+)
