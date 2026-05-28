const cache = new Map();
/** Parse any CSS color string into normalized [r, g, b, a] via a 1×1 canvas. */
export function parseColor(css) {
    const hit = cache.get(css);
    if (hit)
        return hit;
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d');
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const result = [
        d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255,
    ];
    cache.set(css, result);
    return result;
}
//# sourceMappingURL=color.js.map