import type { NodeData } from '../graph/node';
import type { EdgeData } from '../graph/edge';
export interface Snapshot {
    nodes: NodeData[];
    edges: EdgeData[];
}
/** Snapshot-based undo/redo history. */
export declare class History {
    private readonly limit;
    private past;
    private future;
    constructor(limit?: number);
    /** Capture the current state before a mutation. */
    save(snapshot: Snapshot): void;
    /** Restore the previous state. Returns the snapshot to apply, or null if none. */
    undo(current: Snapshot): Snapshot | null;
    /** Re-apply a previously undone state. Returns the snapshot to apply, or null if none. */
    redo(current: Snapshot): Snapshot | null;
    canUndo(): boolean;
    canRedo(): boolean;
    clear(): void;
}
//# sourceMappingURL=history.d.ts.map