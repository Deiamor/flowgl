const EDITING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
export class KeyboardHandler {
    constructor(canvas, opts) {
        this.canvas = canvas;
        this.onKeyDown = (e) => {
            const tag = e.target?.tagName ?? '';
            if (EDITING_TAGS.has(tag))
                return;
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    opts.onDelete();
                    break;
                case 'Escape':
                    opts.onEscape();
                    break;
                case 'z':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        if (e.shiftKey)
                            opts.onRedo();
                        else
                            opts.onUndo();
                    }
                    break;
                case 'y':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        opts.onRedo();
                    }
                    break;
                case 'a':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        opts.onSelectAll();
                    }
                    break;
            }
        };
        // Attach to canvas so only the focused instance handles events
        canvas.addEventListener('keydown', this.onKeyDown);
    }
    dispose() {
        this.canvas.removeEventListener('keydown', this.onKeyDown);
    }
}
//# sourceMappingURL=keyboard.js.map