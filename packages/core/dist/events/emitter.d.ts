type Listener<T> = (event: T) => void;
export declare class EventEmitter<Events extends Record<string, unknown>> {
    private readonly listeners;
    on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void;
    off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void;
    emit<K extends keyof Events>(type: K, data: Events[K]): void;
    dispose(): void;
}
export {};
//# sourceMappingURL=emitter.d.ts.map