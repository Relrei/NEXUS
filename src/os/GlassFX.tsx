import { useEffect, useRef } from 'react'

// 本物の液体ガラス = CSS backdrop-filter では出せない「屈折(歪み)」をWebGLで実現する。
// 壁紙をテクスチャにして、画面上の .glass-win(窓)の矩形の内側だけ、
// 縁で強くなるレンズ屈折 + 色収差(RGBずらし) + フロスト(簡易ぼかし) をかけて描く。
// 窓の外は透明(discard)なので壁紙/アイコンはそのまま見える。窓CSS側は背景透明にして这の描画を透かす。

const VERT = `
attribute vec2 a;
void main(){ gl_Position = vec4(a, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform vec2 u_img;
uniform vec4 u_rects[16];
uniform int u_count;
uniform float u_radius;

vec2 coverUV(vec2 px){
  float sa = u_res.x / u_res.y;
  float ia = u_img.x / u_img.y;
  vec2 uv = px / u_res;           // x:0..1, y: top->bottom
  vec2 scale = vec2(1.0);
  if (ia > sa) scale.x = sa / ia; else scale.y = ia / sa;
  vec2 c = (uv - 0.5) * scale + 0.5;
  c.y = 1.0 - c.y;                // FLIP_Y したテクスチャに合わせる
  return c;
}

float sdRoundRect(vec2 p, vec2 c, vec2 h, float r){
  vec2 d = abs(p - c) - (h - vec2(r));
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y); // y: top->bottom
  float best = 1e9; vec2 bc = vec2(0.0); vec2 bh = vec2(0.0);
  for (int i = 0; i < 16; i++){
    if (i >= u_count) break;
    vec4 r = u_rects[i];
    vec2 c = r.xy + r.zw * 0.5;
    vec2 h = r.zw * 0.5;
    float sd = sdRoundRect(px, c, h, u_radius);
    if (sd < best){ best = sd; bc = c; bh = h; }
  }
  if (best > 0.5) discard; // 窓の外 = 透明

  // SDFの勾配 = 法線(屈折方向)
  float e = 1.5;
  vec2 n = normalize(vec2(
    sdRoundRect(px + vec2(e,0.0), bc, bh, u_radius) - sdRoundRect(px - vec2(e,0.0), bc, bh, u_radius),
    sdRoundRect(px + vec2(0.0,e), bc, bh, u_radius) - sdRoundRect(px - vec2(0.0,e), bc, bh, u_radius)
  ) + 1e-6);

  float deep = smoothstep(0.0, 44.0, -best); // 0=縁, 1=奥
  float lens = 1.0 - deep;                    // 縁で強い
  vec2 disp = n * lens * 22.0;                 // 縁ほど大きく歪む
  float ca = lens * 3.5;                       // 色収差量

  vec3 col;
  col.r = texture2D(u_tex, coverUV(px + disp + n*ca)).r;
  col.g = texture2D(u_tex, coverUV(px + disp)).g;
  col.b = texture2D(u_tex, coverUV(px + disp - n*ca)).b;

  // フロスト(簡易ぼかし・広め9タップ)
  // 滑らかな13点ぼかし(中心+内輪8+外輪4)。飛び飛びの滲み(ぼやけ)でなく均すぼかしに。
  vec3 blur = col;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(5.0,0.0))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(-5.0,0.0))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(0.0,5.0))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(0.0,-5.0))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(3.5,3.5))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(-3.5,3.5))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(3.5,-3.5))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(-3.5,-3.5))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(10.0,0.0))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(-10.0,0.0))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(0.0,10.0))).rgb;
  blur += texture2D(u_tex, coverUV(px + disp + vec2(0.0,-10.0))).rgb;
  blur /= 13.0;
  col = mix(col, blur, 0.40); // ぼかし40%

  // 黒よりのグレーで染める。透明度約60%(=不透明40%)。
  col = mix(col, vec3(0.16, 0.16, 0.18), 0.40);
  float rim = smoothstep(2.5, 0.0, abs(best + 1.5)); // 縁の内側のリム光
  col += rim * 0.28;

  col *= 0.8; // 全体を20%暗く
  gl_FragColor = vec4(col, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('GlassFX shader:', gl.getShaderInfoLog(s))
    return null
  }
  return s
}

export function GlassFX({ wallpaper, active }: { wallpaper?: string; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active || !wallpaper) return
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true })
    if (!gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('GlassFX link:', gl.getProgramInfoLog(prog)); return
    }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aLoc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(aLoc)
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0)

    const uTex = gl.getUniformLocation(prog, 'u_tex')
    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uImg = gl.getUniformLocation(prog, 'u_img')
    const uRects = gl.getUniformLocation(prog, 'u_rects')
    const uCount = gl.getUniformLocation(prog, 'u_count')
    const uRadius = gl.getUniformLocation(prog, 'u_radius')

    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    // 1pxの仮テクスチャ(画像ロード前)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 20, 255]))

    let imgW = 1, imgH = 1, ready = false
    const img = new Image()
    img.onload = () => {
      imgW = img.naturalWidth; imgH = img.naturalHeight
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      ready = true
    }
    img.src = wallpaper

    const rectsBuf = new Float32Array(64)
    let raf = 0
    let lastKey = ''
    let lastDraw = 0
    // 解像度はフル(クリア=ぼやけ防止)。連続変化時の負荷は描画間引き(下の30fps)で抑える。
    const scale = Math.min(window.devicePixelRatio || 1, 1.25)
    const inset = 2 // 窓枠の内側に収め、CSS角丸との「二重縁」を防ぐ
    const cv = canvas
    const g = gl

    function frame() {
      // キャンバスは main の中(バーの下)にあるので、自身の矩形を基準に座標を取る=バー表示でもズレない。
      const cr = cv.getBoundingClientRect()
      const w = Math.max(1, Math.floor(cr.width * scale))
      const h = Math.max(1, Math.floor(cr.height * scale))
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; lastKey = '' }
      if (ready) {
        const els = document.querySelectorAll<HTMLElement>('.glass-win')
        let n = 0
        els.forEach((el) => {
          if (n >= 16) return
          const r = el.getBoundingClientRect()
          if (r.width < 16 || r.height < 16) return
          rectsBuf[n * 4 + 0] = (r.left - cr.left + inset) * scale
          rectsBuf[n * 4 + 1] = (r.top - cr.top + inset) * scale
          rectsBuf[n * 4 + 2] = (r.width - inset * 2) * scale
          rectsBuf[n * 4 + 3] = (r.height - inset * 2) * scale
          n++
        })
        // 窓配置が変わらなければ再描画しない = 静止時はGPUを一切使わない。
        let key = w + 'x' + h + ':' + n
        for (let i = 0; i < n * 4; i++) key += ',' + (rectsBuf[i] | 0)
        // 変化時は最大~60fpsで追従(静止時は0描画)。
        const now = performance.now()
        if (key !== lastKey && now - lastDraw >= 16) {
          lastKey = key
          lastDraw = now
          g.viewport(0, 0, cv.width, cv.height)
          g.clearColor(0, 0, 0, 0)
          g.clear(g.COLOR_BUFFER_BIT)
          if (n > 0) {
            g.useProgram(prog)
            g.activeTexture(g.TEXTURE0)
            g.bindTexture(g.TEXTURE_2D, tex)
            g.uniform1i(uTex, 0)
            g.uniform2f(uRes, cv.width, cv.height)
            g.uniform2f(uImg, imgW, imgH)
            g.uniform4fv(uRects, rectsBuf)
            g.uniform1i(uCount, n)
            g.uniform1f(uRadius, 12 * scale)
            g.drawArrays(g.TRIANGLES, 0, 3)
          }
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      g.deleteProgram(prog); g.deleteShader(vs); g.deleteShader(fs)
      g.deleteBuffer(buf); g.deleteTexture(tex)
    }
  }, [wallpaper, active])

  if (!active || !wallpaper) return null
  // canvasは置換要素=inset-0だけでは伸びない(デフォルト300x150のまま)。w/h-fullで親(main)を満たす。
  return <canvas ref={ref} className="pointer-events-none absolute left-0 top-0 z-[5] h-full w-full" />
}
