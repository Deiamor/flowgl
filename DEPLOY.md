# DEPLOY.md

## Environments

### Development (demo)
```bash
pnpm install
pnpm dev          # Vite dev server → http://localhost:5173
```

### Build library
```bash
pnpm build        # 모든 패키지 rollup 빌드
# output: packages/core/dist/flowchart.esm.js, index.cjs.js, index.d.ts
```

### Build demo
```bash
pnpm --filter demo build
# output: demo/dist/index.html, demo/dist/assets/
```

---

## npm 배포

### 버전 bump + 빌드 + 배포 (4개 패키지)
```bash
# 각 패키지에서 버전 bump
cd packages/core    && npm version <patch|minor|major> --no-git-tag-version
cd packages/react   && npm version <patch|minor|major> --no-git-tag-version
cd packages/vue     && npm version <patch|minor|major> --no-git-tag-version
cd packages/svelte  && npm version <patch|minor|major> --no-git-tag-version

# core 빌드 (prepublishOnly 자동 실행: typecheck → test → build)
cd packages/core && npm publish --access public

# 나머지 패키지 배포
cd packages/react   && npm publish --access public
cd packages/vue     && npm publish --access public
cd packages/svelte  && npm publish --access public
```

### 배포된 패키지
| 패키지 | 최신 버전 | npm |
|--------|-----------|-----|
| `@flowgl/core` | 0.1.1 | https://www.npmjs.com/package/@flowgl/core |
| `@flowgl/react` | 0.1.1 | https://www.npmjs.com/package/@flowgl/react |
| `@flowgl/vue` | 0.1.1 | https://www.npmjs.com/package/@flowgl/vue |
| `@flowgl/svelte` | 0.1.1 | https://www.npmjs.com/package/@flowgl/svelte |

---

## 데모 사이트 배포 (Cloudflare Workers)

- **URL**: https://dev.flowgl.ouranos.kr/
- **플랫폼**: Cloudflare Workers (정적 에셋)
- **GitHub 연동**: `master` 브랜치 push 시 자동 빌드·배포
- **설정 파일**: `wrangler.toml` (repo 루트)

### CI 빌드 설정
```
빌드 명령: pnpm --filter demo build
배포 명령: npx wrangler deploy
```

### wrangler.toml
```toml
name = "flowgl"
compatibility_date = "2025-01-01"

[assets]
directory = "./demo/dist"
```

### 수동 배포
```bash
pnpm --filter demo build
npx wrangler deploy
```

---

## 환경 변수
| 변수 | 위치 | 용도 |
|------|------|------|
| `CLOUDFLARE_API_TOKEN` | CI 환경변수 | Workers 배포 인증 (Account 레벨, Pages:Edit 포함) |

## 브라우저 요구사항
- WebGL2 필수: Chrome 56+, Firefox 51+, Safari 15+, Edge 79+
