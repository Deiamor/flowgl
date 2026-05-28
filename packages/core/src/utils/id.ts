let seq = 0

export function generateId(prefix = 'node'): string {
  return `${prefix}_${Date.now().toString(36)}_${(++seq).toString(36)}`
}
