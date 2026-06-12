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
| `@flowgl/core` | 0.4.2 | https://www.npmjs.com/package/@flowgl/core |
| `@flowgl/react` | 0.4.2 | https://www.npmjs.com/package/@flowgl/react |
| `@flowgl/vue` | 0.4.2 | https://www.npmjs.com/package/@flowgl/vue |
| `@flowgl/svelte` | 0.4.2 | https://www.npmjs.com/package/@flowgl/svelte |

**Deprecated**: `0.4.0` on all four packages — atlas eviction race mis-mapped labels. `npm install` warns and points consumers at 0.4.1+ or a 0.2.6 pin.

### 정식 배포 흐름 (provenance 서명)

```bash
# 1) Bump version across 4 packages, regenerate SBOMs
for pkg in core react vue svelte; do
  python3 -c "import json; p=json.load(open('packages/$pkg/package.json'))
p['version']='X.Y.Z'
json.dump(p, open('packages/$pkg/package.json','w'), indent=2, ensure_ascii=False)"
done
node scripts/generate-sbom.mjs

# 2) Verify locally (typecheck + tests + CDP atlas diag)
pnpm typecheck && pnpm --filter @flowgl/core test
pnpm dev &                                                       # one terminal
brave-debug                                                      # another
node packages/core/scripts/atlas-cjk-diag.mjs http://localhost:5173

# 3) Commit / push / dispatch GitHub Release workflow
git commit -am "release: X.Y.Z" && git push
gh workflow run Release --repo Deiamor/flowgl --ref master -f package=all
```

GitHub Actions runner은 OIDC로 npm provenance를 서명한다. 로컬에서 `npm publish` 직접 호출은 `publishConfig.provenance: true` 때문에 실패한다 — 항상 release.yml dispatch를 통과해야 한다.

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
