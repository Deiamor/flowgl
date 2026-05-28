export interface MenuItem {
    label: string;
    action: () => void;
    destructive?: boolean;
    disabled?: boolean;
    separator?: false;
}
export interface SubMenuItem {
    label: string;
    /** Called once to build the sub-panel DOM when the item is first hovered. */
    panel: () => HTMLElement;
    disabled?: boolean;
    separator?: false;
}
export interface MenuSeparator {
    separator: true;
}
export type MenuEntry = MenuItem | SubMenuItem | MenuSeparator;
export declare class ContextMenu {
    private el;
    private subPanel;
    private hideSubTimer;
    private readonly hideOnOutside;
    private readonly hideOnScroll;
    constructor();
    show(clientX: number, clientY: number, entries: MenuEntry[]): void;
    private buildItem;
    private buildSubItem;
    private showSubPanel;
    private hideSubPanel;
    private scheduleHideSub;
    private cancelHideSub;
    hide(): void;
    dispose(): void;
}
//# sourceMappingURL=context-menu.d.ts.map