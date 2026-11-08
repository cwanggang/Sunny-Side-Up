// @ts-nocheck
// Copied VERBATIM from the v0.5 prototype (artifact "liquid.js"): the spilled egg white, a metaball
// field drawn by a WebGL fragment shader (2D canvas fallback). Only the export line is added.

/* liquid.js — the spilled egg white: a metaball field drawn in a fragment shader as one flat white shape */
const Liquid = (() => {
  const MAXB = 40, MAXC = 12;
  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS = `precision highp float;
uniform vec2 res; uniform float dpr; uniform float cover;
uniform vec3 balls[${MAXB}]; uniform int nb;
uniform vec4 caps[${MAXC}]; uniform float capr[${MAXC}]; uniform int nc;
float field(vec2 q, out vec2 g){
  float f = 0.0; g = vec2(0.0);
  for (int i = 0; i < ${MAXB}; i++) { if (i >= nb) break;
    vec3 b = balls[i]; vec2 d = q - b.xy; float d2 = dot(d, d) + 2.0; float r2 = b.z * b.z;
    f += r2 / d2; g += -2.0 * r2 * d / (d2 * d2); }
  for (int i = 0; i < ${MAXC}; i++) { if (i >= nc) break;
    vec4 c = caps[i]; vec2 a = c.xy, ab = c.zw - c.xy;
    float h = clamp(dot(q - a, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
    vec2 d = q - (a + ab * h); float d2 = dot(d, d) + 2.0; float r2 = capr[i] * capr[i];
    f += r2 / d2; g += -2.0 * r2 * d / (d2 * d2); }
  return f;
}
float edge(float f, vec2 g){ return clamp((f - 1.0) / (length(g) + 1e-5) * dpr + 0.5, 0.0, 1.0); }
void main(){
  vec2 q = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  vec2 g; float f = field(q, g) + cover;
  float a = edge(f, g);                      // one flat white with a crisp edge, nothing else
  gl_FragColor = vec4(vec3(a), a);
}`;

  function create(canvas) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return fallback(canvas);
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; } return o; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return fallback(canvas);
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return fallback(canvas);
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n);
    const u = { res: U('res'), dpr: U('dpr'), cover: U('cover'), balls: U('balls'), nb: U('nb'), caps: U('caps'), capr: U('capr'), nc: U('nc') };
    const B = new Float32Array(MAXB * 3), C = new Float32Array(MAXC * 4), CR = new Float32Array(MAXC);
    let dpr = 1;
    function size(w, h) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function draw({ balls = [], caps = [], cover = 0 }) {
      const nb = Math.min(balls.length, MAXB), nc = Math.min(caps.length, MAXC);
      B.fill(0); C.fill(0); CR.fill(0);
      for (let i = 0; i < nb; i++) B.set(balls[i], i * 3);
      for (let i = 0; i < nc; i++) { C.set(caps[i].slice(0, 4), i * 4); CR[i] = caps[i][4]; }
      gl.uniform2f(u.res, canvas.width, canvas.height); gl.uniform1f(u.dpr, dpr); gl.uniform1f(u.cover, cover);
      gl.uniform3fv(u.balls, B); gl.uniform1i(u.nb, nb); gl.uniform4fv(u.caps, C); gl.uniform1fv(u.capr, CR); gl.uniform1i(u.nc, nc);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function clear() { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    return { size, draw, clear, gl: true };
  }

  /* no WebGL: flat circles and a white wash */
  function fallback(canvas) {
    const ctx = canvas.getContext('2d'); let W = 0, H = 0, dpr = 1;
    return {
      gl: false,
      size(w, h) { dpr = Math.min(window.devicePixelRatio || 1, 2); W = w; H = h; canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; },
      draw({ balls = [], caps = [], cover = 0 }) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#FFFFFF';
        for (const [x, y, r] of balls) { ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, 7); ctx.fill(); }
        ctx.lineCap = 'round';
        for (const [x1, y1, x2, y2, r] of caps) { ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = r * 2.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
        if (cover > 0) { ctx.globalAlpha = Math.min(1, cover); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      },
      clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); },
    };
  }

  return { create };
})();


export { Liquid };
