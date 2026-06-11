/**
 * Whitelist validators for CSS values that get interpolated into attribute
 * contexts (SVG export, inline styles). Centralised here so every path that
 * accepts caller-supplied colour / numeric / dash-array data goes through
 * the same allow-list.
 *
 * Why a module: previously these lived as private methods on `FlowChart`
 * (svg-export.ts inlined a copy, label-edit.ts had a third copy). One source
 * of truth makes the security contract auditable.
 */

const COLOR_PATTERNS: RegExp[] = [
  /^#[0-9a-fA-F]{3,8}$/,                  // #rgb, #rgba, #rrggbb, #rrggbbaa
  /^rgba?\(\s*[\d.,%\s]+\)$/,              // rgb(...) / rgba(...)
  /^hsla?\(\s*[\d.,%\s]+\)$/,              // hsl(...) / hsla(...)
  /^[a-zA-Z]{1,32}$/,                      // CSS named colour (red, transparent, …)
]

/**
 * Return `c` if it matches a known-safe CSS colour shape, otherwise `fallback`.
 *
 * Rejects any string containing `<`, `>`, `"`, `;`, `{`, `}`, etc — i.e.
 * the characters that could escape an attribute context and start a tag,
 * a style property, or an expression.
 */
export function safeColor(c: string | undefined, fallback: string): string {
  if (typeof c !== 'string' || c.length > 64) return fallback
  for (const re of COLOR_PATTERNS) if (re.test(c)) return c
  return fallback
}

/**
 * Return `n` if it's a finite number in `[0, 1_000_000]`, otherwise `fallback`.
 * Used for widths, radii, font sizes — anywhere a user-supplied scalar lands
 * in an attribute that won't accept `Infinity` / `NaN` / negative values.
 */
export function safeNumber(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e6) return fallback
  return n
}

/**
 * Validate a dash array: must be a non-empty array of finite non-negative
 * numbers, each ≤ 10000. Returns the SVG `stroke-dasharray` string on
 * success, `null` to signal the caller to omit the attribute on failure.
 */
export function safeDashArray(arr: unknown): string | null {
  if (!Array.isArray(arr) || arr.length === 0) return null
  if (!arr.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e4)) return null
  return arr.join(' ')
}

/**
 * Validate a font-family string for inline-style interpolation: reject
 * any character that could break out of the property declaration
 * (`<>;{}`) and cap the length at 200.
 */
export function safeFontFamily(s: string | undefined, fallback: string): string {
  if (typeof s !== 'string' || s.length > 200) return fallback
  if (/[<>;{}]/.test(s)) return fallback
  return s
}
