# Security Policy

## Supported Versions

| Package | Version | Status |
| --- | --- | --- |
| `@flowgl/core`, `@flowgl/react`, `@flowgl/vue`, `@flowgl/svelte` | 0.4.x | ✅ supported — fixes land in the next patch |
| All four packages | 0.4.0 | ⚠ deprecated (atlas eviction race); upgrade to 0.4.1+ |
| All four packages | 0.3.x | — no such versions were ever published |
| All four packages | 0.2.x | ✅ supported — pin to 0.2.6 if you cannot move to 0.4.x yet |
| All four packages | ≤ 0.1.x | ❌ end-of-life; no fixes |

Provenance: every published tarball is signed via GitHub Actions OIDC and
listed at [sigstore](https://search.sigstore.dev/). Verify with:

```bash
npm audit signatures @flowgl/core
```

SBOM: every package tarball ships a CycloneDX 1.5 `sbom.json` enumerating
exactly the workspace components the build pulled in. `@flowgl/core` itself
has zero runtime dependencies — its SBOM lists only the package itself.

## Reporting a Vulnerability

**Please do not open a public issue for a security report.**

Use [GitHub's private vulnerability reporting](https://github.com/Deiamor/flowgl/security/advisories/new)
to file a Security Advisory. We get an email when one is filed and will
respond within 72 hours with either an acknowledgement or a request for
more detail.

What to include:

- Affected package(s) and version range
- A minimal proof of concept (a snippet, a repro repo, or a CodeSandbox)
- The impact you observed (which user data / which surface / what an
  attacker would gain)
- Your suggested CVSS rating, if you have one — we'll defer to you on
  severity unless we have a reason to push back

What to expect:

- 72 hours: acknowledgement
- 7 days: tentative fix plan + timeline
- 30 days (or sooner if severity warrants): patch released to npm, CVE
  filed if applicable, public Advisory published, you credited unless
  you prefer to stay anonymous

If your report is more research interest than active vulnerability — a
hardening idea, a defense-in-depth gap, a question about a guarantee
— a regular GitHub issue or a Discussion thread is fine.

## Threat Model — what flowgl claims, briefly

`@flowgl/core` runs in the browser as a user-controlled library. It does
not own a server, a database, or a session, so the threat surfaces are
narrow and well-defined:

1. **Untrusted JSON via `fromJSON` / `importJSON`** — the schema
   validator (`services/json-validate.ts`) rejects malformed input.
   `htmlContent` containing `<script>` tags, `javascript:` URLs, or
   `on*=` inline event handlers is rejected without `skipValidation: true`.
2. **`NodeData.htmlContent`** — rendered into the DOM via `innerHTML`.
   If you pass untrusted strings, set `sanitizeHtml: (s) => DOMPurify.sanitize(s)`
   when constructing the chart. Without a sanitizer, untrusted HTML is
   the consumer's responsibility (a console warning is emitted on first
   use).
3. **Style strings** — colors, dash arrays, font families flow through
   the `services/safe-css.ts` allow-list before they are written to
   `style` attributes or SVG exports. CSS-injection breakouts are blocked.
4. **SVG / PNG export** — exports preserve only what is already on screen.
   No XML external entities; no remote URL fetches.

Anything outside these four surfaces (CSRF, server-side state, auth,
transport, etc.) is out of scope because flowgl does not implement them.

## Coordinated Disclosure

If the report involves a dependency rather than flowgl itself, we may
need to coordinate with that project's maintainers before disclosing.
We will keep you in the loop and won't credit anyone without their
consent.
