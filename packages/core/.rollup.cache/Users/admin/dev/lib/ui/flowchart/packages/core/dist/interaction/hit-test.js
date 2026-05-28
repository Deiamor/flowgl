export class HitTester {
    findNodeAt(nodes, wx, wy) {
        // Iterate in reverse so topmost (last-added) node wins
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            if (wx >= n.x && wx <= n.x + n.width && wy >= n.y && wy <= n.y + n.height) {
                return n;
            }
        }
        return null;
    }
    findNodesInBox(nodes, minX, minY, maxX, maxY) {
        return nodes.filter(n => n.x < maxX && n.x + n.width > minX &&
            n.y < maxY && n.y + n.height > minY);
    }
}
//# sourceMappingURL=hit-test.js.map