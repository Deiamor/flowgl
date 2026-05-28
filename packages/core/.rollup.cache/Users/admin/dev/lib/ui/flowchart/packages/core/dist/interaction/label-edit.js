import { DEFAULT_NODE_STYLE } from '../graph/node';
export class LabelEditor {
    constructor() {
        this.input = null;
        this.boundBlur = null;
    }
    startEdit(node, canvas, viewport, onDone) {
        this.stopEdit();
        const style = { ...DEFAULT_NODE_STYLE, ...node.style };
        const [sx, sy] = viewport.worldToScreen(node.x + node.width / 2, node.y + node.height / 2);
        const canvasRect = canvas.getBoundingClientRect();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = node.label;
        input.style.cssText = `
      position: fixed;
      left: ${canvasRect.left + sx}px;
      top:  ${canvasRect.top + sy}px;
      transform: translate(-50%, -50%);
      width: ${Math.max(80, node.width * viewport.zoom - 20)}px;
      padding: 4px 8px;
      border: 2px solid ${style.borderColor};
      border-radius: 4px;
      background: ${style.backgroundColor};
      color: ${style.textColor};
      font-size: ${style.fontSize * viewport.zoom}px;
      font-family: ${style.fontFamily};
      text-align: center;
      outline: none;
      z-index: 8500;
      box-sizing: border-box;
    `;
        let committed = false;
        const commit = () => {
            if (committed)
                return;
            committed = true;
            onDone(input.value.trim() || node.label);
            this.stopEdit();
            // Return focus to canvas so keyboard shortcuts keep working
            canvas.focus();
        };
        // Store a stable reference so removeEventListener works correctly
        this.boundBlur = commit;
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter')
                commit();
            if (e.key === 'Escape') {
                committed = true;
                this.stopEdit();
                canvas.focus();
            }
        });
        input.addEventListener('blur', commit);
        document.body.appendChild(input);
        this.input = input;
        requestAnimationFrame(() => { input.select(); });
    }
    stopEdit() {
        if (!this.input)
            return;
        if (this.boundBlur) {
            this.input.removeEventListener('blur', this.boundBlur);
            this.boundBlur = null;
        }
        this.input.remove();
        this.input = null;
    }
    dispose() { this.stopEdit(); }
}
//# sourceMappingURL=label-edit.js.map