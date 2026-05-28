import { createProgram } from '../context'
import { parseColor } from '../util/color'
import type { Viewport } from '../../../viewport/viewport'

const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_ndc;
void main() {
  v_ndc = a_position;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

// World-position derivation from NDC using Viewport.getMatrix() inverse:
//   wx = (ndcX + 1) * cssWidth  / (2 * zoom) - viewX / zoom
//   wy = (1 - ndcY) * cssHeight / (2 * zoom) - viewY / zoom
const FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_ndc;

uniform vec2  u_size;      // canvas CSS pixel dimensions
uniform float u_zoom;
uniform float u_viewX;
uniform float u_viewY;
uniform float u_gridSize;
uniform vec4  u_color;
uniform bool  u_dots;

out vec4 fragColor;

void main() {
  float wx = (v_ndc.x + 1.0) * u_size.x * 0.5 / u_zoom - u_viewX / u_zoom;
  float wy = (1.0 - v_ndc.y) * u_size.y * 0.5 / u_zoom - u_viewY / u_zoom;

  float pw    = 1.0 / u_zoom;
  float alpha = 0.0;

  if (u_dots) {
    float gx   = round(wx / u_gridSize) * u_gridSize;
    float gy   = round(wy / u_gridSize) * u_gridSize;
    float dist = length(vec2(wx - gx, wy - gy));
    float dotR = max(1.5 * pw, 0.5);
    alpha = 1.0 - smoothstep(dotR - pw * 0.5, dotR + pw * 0.5, dist);
  } else {
    vec2  cell = vec2(mod(wx, u_gridSize), mod(wy, u_gridSize));
    float lw   = max(pw, 0.4);
    float onX  = 1.0 - smoothstep(0.0, lw, min(cell.x, u_gridSize - cell.x));
    float onY  = 1.0 - smoothstep(0.0, lw, min(cell.y, u_gridSize - cell.y));
    alpha = clamp(onX + onY, 0.0, 1.0);
  }

  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`

export class GridProgram {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private quadBuf: WebGLBuffer

  private uSize:     WebGLUniformLocation
  private uZoom:     WebGLUniformLocation
  private uViewX:    WebGLUniformLocation
  private uViewY:    WebGLUniformLocation
  private uGridSize: WebGLUniformLocation
  private uColor:    WebGLUniformLocation
  private uDots:     WebGLUniformLocation

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.program = createProgram(gl, VERT, FRAG)

    const buf = gl.createBuffer()
    if (!buf) throw new Error('GridProgram: createBuffer failed')
    this.quadBuf = buf
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  1,  1,
      -1, -1,  1,  1, -1,  1,
    ]), gl.STATIC_DRAW)

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('GridProgram: createVertexArray failed')
    this.vao = vao
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    const aPos = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    const u = (name: string): WebGLUniformLocation => {
      const loc = gl.getUniformLocation(this.program, name)
      if (!loc) throw new Error(`GridProgram: uniform '${name}' not found`)
      return loc
    }
    this.uSize     = u('u_size')
    this.uZoom     = u('u_zoom')
    this.uViewX    = u('u_viewX')
    this.uViewY    = u('u_viewY')
    this.uGridSize = u('u_gridSize')
    this.uColor    = u('u_color')
    this.uDots     = u('u_dots')
  }

  render(
    viewport: Viewport,
    gridSize: number,
    type: 'dots' | 'lines',
    colorStr: string,
  ): void {
    // Scale grid size so cells stay >= 16px on screen regardless of zoom
    let size = gridSize
    while (size * viewport.zoom < 16) size *= 2

    const [r, g, b, a] = parseColor(colorStr)
    const gl = this.gl

    gl.useProgram(this.program)
    gl.uniform2f(this.uSize, viewport.canvasWidth, viewport.canvasHeight)
    gl.uniform1f(this.uZoom, viewport.zoom)
    gl.uniform1f(this.uViewX, viewport.x)
    gl.uniform1f(this.uViewY, viewport.y)
    gl.uniform1f(this.uGridSize, size)
    gl.uniform4f(this.uColor, r, g, b, a)
    gl.uniform1i(this.uDots, type === 'dots' ? 1 : 0)

    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  dispose(): void {
    this.gl.deleteProgram(this.program)
    this.gl.deleteVertexArray(this.vao)
    this.gl.deleteBuffer(this.quadBuf)
  }
}
