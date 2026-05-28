import { describe, it, expect, beforeEach } from 'vitest';
import { History } from '../history/history';
const snap = (tag) => ({
    nodes: [{ id: tag, label: tag, x: 0, y: 0, width: 120, height: 60 }],
    edges: [],
});
describe('History', () => {
    let h;
    beforeEach(() => { h = new History(); });
    it('starts empty — canUndo and canRedo are false', () => {
        expect(h.canUndo()).toBe(false);
        expect(h.canRedo()).toBe(false);
    });
    it('undo returns null when empty', () => {
        expect(h.undo(snap('current'))).toBeNull();
    });
    it('redo returns null when empty', () => {
        expect(h.redo(snap('current'))).toBeNull();
    });
    it('save enables canUndo', () => {
        h.save(snap('a'));
        expect(h.canUndo()).toBe(true);
    });
    it('undo returns the saved snapshot', () => {
        h.save(snap('before'));
        const result = h.undo(snap('current'));
        expect(result?.nodes[0]?.id).toBe('before');
    });
    it('undo enables canRedo', () => {
        h.save(snap('s1'));
        h.undo(snap('current'));
        expect(h.canRedo()).toBe(true);
    });
    it('redo returns the current snapshot that was passed to undo', () => {
        h.save(snap('s1'));
        h.undo(snap('after-s1'));
        const redone = h.redo(snap('restored'));
        expect(redone?.nodes[0]?.id).toBe('after-s1');
    });
    it('save clears the redo stack', () => {
        h.save(snap('s1'));
        h.undo(snap('c1'));
        expect(h.canRedo()).toBe(true);
        h.save(snap('s2'));
        expect(h.canRedo()).toBe(false);
    });
    it('respects the limit', () => {
        const small = new History(3);
        small.save(snap('1'));
        small.save(snap('2'));
        small.save(snap('3'));
        small.save(snap('4'));
        // Only 3 entries remain; undoing 3 times should exhaust the stack
        small.undo(snap('c'));
        small.undo(snap('c'));
        small.undo(snap('c'));
        expect(small.canUndo()).toBe(false);
    });
    it('clear empties both stacks', () => {
        h.save(snap('a'));
        h.undo(snap('b'));
        h.clear();
        expect(h.canUndo()).toBe(false);
        expect(h.canRedo()).toBe(false);
    });
});
//# sourceMappingURL=history.test.js.map