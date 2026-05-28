export class DynamicBuffer {
  readonly buffer: WebGLBuffer
  private gl: WebGL2RenderingContext
  private capacityBytes: number

  constructor(gl: WebGL2RenderingContext, initialBytes = 65536) {
    this.gl = gl
    this.capacityBytes = initialBytes
    const buf = gl.createBuffer()
    if (!buf) throw new Error('DynamicBuffer: createBuffer failed')
    this.buffer = buf
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, initialBytes, gl.DYNAMIC_DRAW)
  }

  upload(data: Float32Array): void {
    const gl = this.gl
    const bytes = data.byteLength
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    if (bytes > this.capacityBytes) {
      this.capacityBytes = bytes * 2
      gl.bufferData(gl.ARRAY_BUFFER, this.capacityBytes, gl.DYNAMIC_DRAW)
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data)
  }

  dispose(): void {
    this.gl.deleteBuffer(this.buffer)
  }
}
