let seq = 0;
export function generateId(prefix = 'node') {
    return `${prefix}_${Date.now().toString(36)}_${(++seq).toString(36)}`;
}
//# sourceMappingURL=id.js.map