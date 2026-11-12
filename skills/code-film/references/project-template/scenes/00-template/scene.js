// Reference scene: shows the contract (DOM + GSAP timeline + a WebGL canvas drawn from t only).
// Copy this folder to scenes/<id>/, set id and duration to match film.json, and replace the content.
import { defineScene, narrate, chapter, ease, tokens, rgb, W, H } from "@film/runtime";

const state = { glow: 0 }; // tweened by the timeline, read by render()
let gl, uTime, uGlow;

defineScene({
  id: "00-template",
  duration: 6,
  setup({ stage, tl, anchor }) {
    // --- WebGL layer, sized in device pixels so a 2× render stays sharp
    const canvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    stage.prepend(canvas);
    gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: true });
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, `#version 300 es
      in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float; out vec4 o;
      uniform vec2 uRes; uniform float uTime, uGlow; uniform vec3 uBg, uPop;
      void main(){
        vec2 uv = (gl_FragCoord.xy - .5 * uRes) / min(uRes.x, uRes.y);
        float d = length(uv);
        float ring = smoothstep(.012, .0, abs(d - .18 - .02 * sin(uTime * 1.5)));
        o = vec4(mix(uBg, uPop, ring * uGlow), 1.);
      }`));
    gl.bindAttribLocation(prog, 0, "p");
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(prog, "uRes"), canvas.width, canvas.height);
    gl.uniform3fv(gl.getUniformLocation(prog, "uBg"), rgb(tokens.bg));
    gl.uniform3fv(gl.getUniformLocation(prog, "uPop"), rgb(tokens.pop1));
    uTime = gl.getUniformLocation(prog, "uTime"); uGlow = gl.getUniformLocation(prog, "uGlow");

    // --- timeline: everything is positioned in absolute seconds, on the cues of film.json
    chapter(tl, 0, "Template");
    tl.to(state, { glow: 1, duration: 1.5, ease: ease.soft }, 0.5)
      .to(state, { glow: 0, duration: 1, ease: ease.soft }, 4.6);
    if (anchor) tl.to(anchor, { x: 200, duration: 1.2, ease: ease.inOut }, 1.5).to(anchor, { x: 0, duration: 1.2, ease: ease.inOut }, 3.6);
    narrate(tl, ["This is a <em>test</em> scene, with gy descenders.", "It will not be in the film."], { at: 1, hold: 3 });
  },
  render(t) {
    gl.uniform1f(uTime, t); gl.uniform1f(uGlow, state.glow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },
});
