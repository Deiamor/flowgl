const MENU_STYLE = `
  position: fixed;
  background: #1a2340;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.5);
  padding: 4px;
  z-index: 9000;
  min-width: 170px;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
`;
const ITEM_BASE = `
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 8px 14px; border: none;
  background: transparent; text-align: left;
  font-size: 13px; border-radius: 5px;
  cursor: pointer; transition: background .1s;
  box-sizing: border-box; font-family: inherit;
`;
const SEP_STYLE = `
  height: 1px; margin: 4px 8px;
  background: rgba(255,255,255,0.1);
`;
export class ContextMenu {
    constructor() {
        this.el = null;
        this.subPanel = null;
        this.hideSubTimer = null;
        this.hideOnOutside = (e) => {
            const target = e.target;
            const inMenu = this.el ? this.el.contains(target) : false;
            const inPanel = this.subPanel ? this.subPanel.contains(target) : false;
            if (!inMenu && !inPanel)
                this.hide();
        };
        this.hideOnScroll = () => this.hide();
    }
    show(clientX, clientY, entries) {
        this.hide();
        const menu = document.createElement('div');
        menu.style.cssText = MENU_STYLE;
        menu.style.left = `${clientX}px`;
        menu.style.top = `${clientY}px`;
        for (const entry of entries) {
            if ('separator' in entry && entry.separator) {
                const sep = document.createElement('div');
                sep.style.cssText = SEP_STYLE;
                menu.appendChild(sep);
                continue;
            }
            if ('panel' in entry) {
                menu.appendChild(this.buildSubItem(entry));
                continue;
            }
            menu.appendChild(this.buildItem(entry));
        }
        document.body.appendChild(menu);
        // Clamp to viewport
        const r = menu.getBoundingClientRect();
        if (r.right > window.innerWidth)
            menu.style.left = `${clientX - r.width}px`;
        if (r.bottom > window.innerHeight)
            menu.style.top = `${clientY - r.height}px`;
        this.el = menu;
        requestAnimationFrame(() => {
            document.addEventListener('pointerdown', this.hideOnOutside);
            window.addEventListener('scroll', this.hideOnScroll, true);
        });
    }
    buildItem(item) {
        const btn = document.createElement('button');
        btn.style.cssText = ITEM_BASE;
        btn.style.color = item.destructive ? '#f87171' : '#d1d5db';
        btn.style.opacity = item.disabled ? '0.45' : '1';
        btn.style.cursor = item.disabled ? 'not-allowed' : 'pointer';
        const label = document.createElement('span');
        label.textContent = item.label;
        btn.appendChild(label);
        if (!item.disabled) {
            btn.addEventListener('pointerenter', () => {
                btn.style.background = 'rgba(255,255,255,0.08)';
                this.scheduleHideSub(); // hovering a regular item hides any open sub-panel
            });
            btn.addEventListener('pointerleave', () => {
                btn.style.background = 'transparent';
            });
            btn.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                item.action();
                this.hide();
            });
        }
        return btn;
    }
    buildSubItem(item) {
        const btn = document.createElement('button');
        btn.style.cssText = ITEM_BASE;
        btn.style.color = '#d1d5db';
        btn.style.opacity = item.disabled ? '0.45' : '1';
        btn.style.cursor = item.disabled ? 'not-allowed' : 'pointer';
        const label = document.createElement('span');
        label.textContent = item.label;
        btn.appendChild(label);
        const arrow = document.createElement('span');
        arrow.textContent = '▶';
        arrow.style.cssText = 'font-size: 9px; opacity: 0.55; margin-left: 8px; flex-shrink: 0;';
        btn.appendChild(arrow);
        if (!item.disabled) {
            btn.addEventListener('pointerenter', () => {
                btn.style.background = 'rgba(255,255,255,0.08)';
                this.cancelHideSub();
                this.showSubPanel(btn, item.panel());
            });
            btn.addEventListener('pointerleave', () => {
                btn.style.background = 'transparent';
                this.scheduleHideSub();
            });
        }
        return btn;
    }
    // ── Sub-panel positioning ──────────────────────────────────────────────────
    showSubPanel(anchorEl, panel) {
        this.subPanel?.remove();
        // Measure offscreen first
        panel.style.cssText += '; position: fixed; left: -9999px; top: -9999px;';
        document.body.appendChild(panel);
        const pr = panel.getBoundingClientRect();
        const ar = anchorEl.getBoundingClientRect();
        const mr = this.el.getBoundingClientRect();
        // Horizontal: try right of menu, fall back to left
        const spaceRight = window.innerWidth - mr.right;
        const spaceLeft = mr.left;
        let left;
        if (spaceRight >= pr.width + 8 || spaceRight >= spaceLeft) {
            left = mr.right + 4;
        }
        else {
            left = mr.left - pr.width - 4;
        }
        // Vertical: align top with the hovered item, clamp to viewport
        let top = ar.top;
        top = Math.min(top, window.innerHeight - pr.height - 8);
        top = Math.max(top, 8);
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        this.subPanel = panel;
        panel.addEventListener('pointerenter', () => this.cancelHideSub());
        panel.addEventListener('pointerleave', () => this.scheduleHideSub());
    }
    hideSubPanel() {
        this.subPanel?.remove();
        this.subPanel = null;
    }
    scheduleHideSub() {
        if (this.hideSubTimer !== null)
            return;
        this.hideSubTimer = window.setTimeout(() => {
            this.hideSubTimer = null;
            this.hideSubPanel();
        }, 180);
    }
    cancelHideSub() {
        if (this.hideSubTimer === null)
            return;
        clearTimeout(this.hideSubTimer);
        this.hideSubTimer = null;
    }
    // ─────────────────────────────────────────────────────────────────────────
    hide() {
        this.cancelHideSub();
        this.hideSubPanel();
        if (!this.el)
            return;
        this.el.remove();
        this.el = null;
        document.removeEventListener('pointerdown', this.hideOnOutside);
        window.removeEventListener('scroll', this.hideOnScroll, true);
    }
    dispose() { this.hide(); }
}
//# sourceMappingURL=context-menu.js.map