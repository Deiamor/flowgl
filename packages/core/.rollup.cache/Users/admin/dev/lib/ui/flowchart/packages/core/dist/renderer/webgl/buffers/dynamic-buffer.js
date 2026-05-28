export class DynamicBuffer {
    constructor(gl, initialBytes = 65536) {
        this.gl = gl;
        this.capacityBytes = initialBytes;
        const buf = gl.createBuffer();
        if (!buf)
            throw new Error('DynamicBuffer: createBuffer failed');
        this.buffer = buf;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, initialBytes, gl.DYNAMIC_DRAW);
    }
    upload(data) {
        const gl = this.gl;
        const bytes = data.byteLength;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        if (bytes > this.capacityBytes) {
            this.capacityBytes = bytes * 2;
            gl.bufferData(gl.ARRAY_BUFFER, this.capacityBytes, gl.DYNAMIC_DRAW);
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    }
    dispose() {
        this.gl.deleteBuffer(this.buffer);
    }
}
//# sourceMappingURL=dynamic-buffer.js.map