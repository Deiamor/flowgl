type Listener<T> = (event: T) => void

export class EventEmitter<Events extends Record<string, unknown>> {
  private readonly listeners = {} as { [K in keyof Events]?: Set<Listener<Events[K]>> }

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners[type]
    if (!set) {
      set = new Set()
      this.listeners[type] = set
    }
    set.add(listener)
    return () => this.off(type, listener)
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    this.listeners[type]?.delete(listener)
  }

  emit<K extends keyof Events>(type: K, data: Events[K]): void {
    this.listeners[type]?.forEach(l => l(data))
  }

  dispose(): void {
    for (const key in this.listeners) {
      delete this.listeners[key as keyof Events]
    }
  }
}
