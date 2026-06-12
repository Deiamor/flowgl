# Discussions Welcome posts — copy-paste source

Pin one Welcome post in each of the four Discussions categories. The
post bodies below are ready to paste; the title is in the heading.
After posting, click ⋯ on the post → **Pin discussion** so it stays at
the top of its category.

URL: https://github.com/Deiamor/flowgl/discussions

---

## Category: **Q&A**

**Title**: `Welcome to Q&A — read this first`

**Body**:

```markdown
Welcome 👋 — this is the right place for **library usage questions**
that don't fit a bug report.

Before asking, please:

1. **Check the docs** — most questions are answered here:
   - [Getting started](https://docs.flowgl.ouranos.kr/guide/getting-started)
   - [Cookbook](https://docs.flowgl.ouranos.kr/cookbook/) — common patterns
   - [Examples gallery](https://dev.flowgl.ouranos.kr/examples/) — 25 runnable scenarios
   - [API reference](https://docs.flowgl.ouranos.kr/api/flowchart)

2. **Search existing Q&A** — your question may already be answered.

3. **Include the version + framework** — `@flowgl/core` 0.4.2 + React 18,
   for example. Behavior across versions can differ.

4. **A 20-line repro beats a paragraph of description** — a
   CodeSandbox / StackBlitz link, or even a code block in the question,
   makes answers much faster.

## When NOT to use Q&A

- **Bug?** Open an [issue](https://github.com/Deiamor/flowgl/issues/new?template=bug_report.yml).
- **Feature idea?** Use the [Ideas](https://github.com/Deiamor/flowgl/discussions/categories/ideas) category.
- **Security issue?** Don't post — file a [private advisory](https://github.com/Deiamor/flowgl/security/advisories/new). See [SECURITY.md](https://github.com/Deiamor/flowgl/blob/master/SECURITY.md).

Once you've checked the above and your question is still unanswered,
open a new discussion. We'll mark the answer when it lands.
```

---

## Category: **Ideas**

**Title**: `Welcome to Ideas — half-formed thoughts welcome`

**Body**:

```markdown
This category is for **feature ideas that aren't quite ready to be
a feature request issue yet**. Half-formed is fine — that's exactly
what discussion is for. Use cases especially welcome.

The flow is usually:

1. You describe a problem you're hitting (or one you can foresee).
2. We talk through whether it's a fit for flowgl's [Core Value
   Tenets](https://github.com/Deiamor/flowgl/blob/master/PRODUCT.md).
3. If the idea is ready and aligned, it gets promoted to a [feature
   request issue](https://github.com/Deiamor/flowgl/issues/new?template=feature_request.yml)
   with your use case attached, then to the
   [roadmap](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md).

## What's likely a no

These are not negotiable:

- New runtime dep in `@flowgl/core` (Tenet T2)
- Framework-specific symbol in core (Tenet T3)
- Renderer feature shipped in only one backend (Tenet T5)

If the idea touches one of these, we can still discuss it — usually
the answer is "ship it as an opt-in companion package" or "behind
a capability flag".

## What's likely a yes

- Better defaults / better DX
- Capabilities that already work but aren't easy to discover
- Performance work
- New examples / cookbook recipes
- Renderer features that meet T5 parity

Drop a thought even if you're not sure — we'll figure out together
whether it has legs.
```

---

## Category: **Show & Tell**

**Title**: `Welcome to Show & Tell — share what you built`

**Body**:

```markdown
Built something with flowgl? Post it here — projects, demos, blog
posts, talks, even gifs. We feature the strong ones on the
[Showcase page](https://docs.flowgl.ouranos.kr/showcase).

Suggested format:

> **Project name + 1-line description**
>
> Screenshot or short gif (drag-and-drop to upload).
>
> What does it do? Who's it for?
>
> What was tricky to make work?
>
> Link to live demo / source / blog post.

## What we like to see

- New use cases we hadn't imagined
- Honest write-ups of what was hard ("we tried X, it didn't work
  because Y, here's what we did instead")
- Performance wins / loss recoveries
- Custom integrations with other libraries

OSS, commercial, internal tools, hobby projects — all welcome.
Single requirement: the link works.

We don't gatekeep. If you're not sure whether your thing is "worth"
showing, it almost certainly is.
```

---

## Category: **Announcements**

**Title**: `Welcome to Announcements — release notes & maintainer updates`

**Body** (maintainer-only category — only Deiamor can post; others can
react and reply):

```markdown
This category is the source of truth for **release notes, deprecation
warnings, and maintainer updates**. Only maintainers post here; the
rest of you can react and reply.

We'll post here whenever:

- A new minor / major release ships
- A patch fixes something users may have hit
- We deprecate a version (e.g., 0.4.0 was deprecated within 1 hour of
  ship due to an atlas eviction race)
- Big roadmap shifts
- Outages or known issues affecting docs / demo deployments

For the full record:

- [CHANGELOG.md](https://github.com/Deiamor/flowgl/blob/master/CHANGELOG.md) — Keep a Changelog format
- [HISTORY.md](https://github.com/Deiamor/flowgl/blob/master/HISTORY.md) — append-only ledger with root-cause notes
- [ROADMAP.md](https://github.com/Deiamor/flowgl/blob/master/ROADMAP.md) — Now / Next / Later / Won't

Subscribe to this category (🔔 top right) to get a notification on
every announcement.

— @Deiamor
```

---

## After posting

For each of the four discussions:

1. Open the post you just created.
2. Click **⋯** (top right) → **Pin discussion**.
3. Confirm.

That keeps them at the top of their category list so new contributors
see them first.
