# Manual GitHub setup — one-time after these PRs land

A few items cannot be done from the repository alone — they require the
maintainer to click in the GitHub web UI. Once done they don't need to be
revisited.

## 1. Enable GitHub Discussions

Settings → General → Features → Discussions → **on**.

Then in Discussions → Categories, set up the four categories that
`docs/community.md` references:

| Category | Format | Description |
| --- | --- | --- |
| Q&A | Question / Answer | Library usage questions that aren't bugs. |
| Ideas | Open-ended discussion | Half-formed feature ideas before they become issues. |
| Show & Tell | Open-ended discussion | Projects built with flowgl. Featured on the showcase page. |
| Announcements | Announcement (maintainers post) | Release notes, deprecations, maintainer updates. |

Pin a "Welcome" post in each category linking to the relevant docs page.

## 2. Enable private security advisories

Settings → Security → Code security and analysis → Private vulnerability
reporting → **Enable**.

This makes the `SECURITY.md` link to
`security/advisories/new` work for outside reporters.

## 3. Wire GitHub Sponsors

Settings → Sponsorships → Set up GitHub Sponsors (if not already done on
the `@Deiamor` account). The `.github/FUNDING.yml` already points the
repo's "Sponsor" button at the user, so once the user account is set up
the button lights up automatically.

## 4. Configure issue labels

Settings → Labels. Add (or verify):

| Label | Color | Description |
| --- | --- | --- |
| `good first issue` | `#7057ff` | Scoped down for first-time contributors. |
| `help wanted` | `#008672` | Maintainer time-constrained; PRs welcome. |
| `tenet:T1`–`tenet:T7` | `#0e8a16` | Tags the Tenet the issue touches. |
| `benchmark` | `#fbca04` | Performance / benchmark-related. |
| `regression` | `#d93f0b` | A previously-working behavior is now broken. |
| `migration` | `#1d76db` | About migrating from another library or older flowgl. |
| `accessibility` | `#bfd4f2` | A11y-related. |
| `docs` | `#5319e7` | Documentation. |
| `needs-triage` | `#fef2c0` | Default on new bugs/features; remove when triaged. |

## 5. Deploy the docs site

The Vitepress site under `docs/` builds with `pnpm --filter @flowgl/docs build`
and outputs `docs/.vitepress/dist`. Decide one of:

- **Cloudflare Pages / Workers** — add a second project alongside the demo
  deploy, pointing at `docs/.vitepress/dist`. Use `docs.flowgl.ouranos.kr`
  or claim `flowgl.dev` and point both demo and docs subdomains there.
- **GitHub Pages** — Settings → Pages → Source → GitHub Actions, and add a
  small workflow that builds docs on every push to master and publishes
  the dist directory.

The docs site references `dev.flowgl.ouranos.kr` for the live demo
throughout, so deploying the docs and demo on the same domain is the
cleanest setup.

## 6. Repository settings polish

- Settings → General → "Default branch": `master`. (Already correct.)
- Settings → Branches → "Add branch protection rule" for `master`:
  - Require status checks: `CI` (the existing workflow), and once
    benchmark.yml has run cleanly a few times, `Benchmark` too.
  - Require pull request reviews: 0 reviewers is fine while solo-maintained
    (so you can self-merge), bump to 1 when a co-maintainer joins.
- Settings → General → Repository topics: add `webgl`, `webgl2`,
  `flowchart`, `diagram`, `graph`, `react`, `vue`, `svelte`,
  `typescript`, `zero-dependencies`. Topics are what GitHub Explore
  uses to surface the repo.

## 7. README "Used by" section

When the first external use case lands (a Show & Tell post, an external
issue with a project link, anything), add a "Used by" subsection to the
README pointing at it. Social proof of any size beats no social proof.

---

Last updated: 2026-06-12. If something here has rotted, please open a
PR fixing it.
