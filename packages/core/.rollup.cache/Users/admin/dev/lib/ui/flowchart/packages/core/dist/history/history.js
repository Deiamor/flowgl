/** Snapshot-based undo/redo history. */
export class History {
    constructor(limit = 100) {
        this.limit = limit;
        this.past = [];
        this.future = [];
    }
    /** Capture the current state before a mutation. */
    save(snapshot) {
        this.past.push(snapshot);
        this.future = [];
        if (this.past.length > this.limit)
            this.past.shift();
    }
    /** Restore the previous state. Returns the snapshot to apply, or null if none. */
    undo(current) {
        if (!this.past.length)
            return null;
        this.future.push(current);
        if (this.future.length > this.limit)
            this.future.shift();
        return this.past.pop();
    }
    /** Re-apply a previously undone state. Returns the snapshot to apply, or null if none. */
    redo(current) {
        if (!this.future.length)
            return null;
        this.past.push(current);
        return this.future.pop();
    }
    canUndo() { return this.past.length > 0; }
    canRedo() { return this.future.length > 0; }
    clear() { this.past = []; this.future = []; }
}
//# sourceMappingURL=history.js.map