export class EventEmitter {
    constructor() {
        this.listeners = {};
    }
    on(type, listener) {
        let set = this.listeners[type];
        if (!set) {
            set = new Set();
            this.listeners[type] = set;
        }
        set.add(listener);
        return () => this.off(type, listener);
    }
    off(type, listener) {
        this.listeners[type]?.delete(listener);
    }
    emit(type, data) {
        this.listeners[type]?.forEach(l => l(data));
    }
    dispose() {
        for (const key in this.listeners) {
            delete this.listeners[key];
        }
    }
}
//# sourceMappingURL=emitter.js.map