// Shared HTML sanitizer entry for every overlay that writes a string
// `content` to `innerHTML`. Pre-0.8.2 every overlay (`Panel`,
// `NodeToolbar`, `EdgeToolbar`, `ViewportPortal`, `EdgeLabel`) had its
// own three-line "if sanitizer is provided, call it, else fall through"
// pattern — and four of the five did NOT emit the warn-once that
// `HtmlOverlay` (the very first user of this pattern) emitted. A host
// app wiring `sanitizeHtml` only to `HtmlOverlay` because that was the
// only one that warned still had five other unsanitized sinks.
//
// 0.8.1 audit flagged this as a BLOCKER/LATENT regression class (same
// shape as the edge-geometry duplication: ten consumers, almost all of
// them wrong). The shared helper closes the class — every overlay
// routes through `sanitizeContent`, every overlay warns once on the
// first unsanitized write.

let warned = false

/**
 * Returns the sanitized HTML string for `raw`. When `sanitizer` is null
 * or undefined, returns `raw` unchanged but emits a one-time console
 * warning so a host app can wire `sanitizeHtml` in.
 *
 * @param raw the user-supplied HTML string
 * @param sanitizer optional sanitizer function (typically `DOMPurify.sanitize`)
 * @param sourceLabel the overlay name, included in the warning so the
 *   warning is actionable (e.g. "NodeToolbar")
 */
export function sanitizeContent(
  raw: string,
  sanitizer: ((s: string) => string) | undefined,
  sourceLabel: string,
): string {
  if (sanitizer) return sanitizer(raw)
  if (!warned) {
    warned = true
    // eslint-disable-next-line no-console
    console.warn(
      `[@flowgl/core] ${sourceLabel}: content was written to innerHTML without a sanitizer. ` +
      `Pass \`sanitizeHtml\` to FlowChart options when content may contain untrusted input. ` +
      `This warning is emitted once per page load across every overlay.`,
    )
  }
  return raw
}

/** Test-only — reset the warn-once flag so each test starts clean. */
export function _resetSanitizeWarning(): void { warned = false }
