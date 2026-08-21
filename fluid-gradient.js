/* ==========================================================================
   fluid-gradient.js — Sandra Chaves y Asociados
   Fondo de FLUIDO CINÉTICO INTERACTIVO (mesh gradient) estilo Oddity-003.

   WebGL puro (sin librerías). Renderiza una malla de triángulos con colores
   interpolados desde 4 puntos de color que orbitan lentamente (paleta
   azul claro / cyan / celeste), con deformación por ondas orgánicas y
   respuesta al puntero: la malla se desplaza y ondula suavemente hacia el
   cursor del usuario.

   Uso (HTML):
     <section class="panel">
       <canvas class="panel__fluid" data-fluid-gradient aria-hidden="true"></canvas>
       ...contenido con z-index por encima...
     </section>

   Opciones vía atributos data-* en el canvas:
     data-colors   = "#38bdf8,#06b6d4,#e0f2fe,#0284c7"   (4 colores hex)
     data-density  = "40x22"                              (columnas x filas)
     data-speed    = "0.55"                               (velocidad de ondas)
     data-amp      = "0.12"                               (amplitud de onda)

   Comportamiento:
   - Respeto prefers-reduced-motion → dibuja UN frame estático.
   - Si no hay WebGL → no hace nada (queda el fallback CSS del panel).
   - Pausa el render cuando el panel sale del viewport (IntersectionObserver).
   - Al activarse, agrega la clase "is-fluid" al contenedor padre para que el
     CSS pueda ocultar el fallback (p. ej. orbes estáticos).
   ========================================================================== */

(function () {
  'use strict';

  var DPR_CAP = 2;

  function createProgram(gl, vsSrc, fsSrc) {
    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        if (window.console) console.error('fluid-gradient: shader error →', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }
    var vs = compile(gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console) console.error('fluid-gradient: link error →', gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  var VERT = [
    'attribute vec2 aPos;',
    'attribute vec3 aColor;',
    'varying vec3 vColor;',
    'void main() {',
    '  vColor = aColor;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying vec3 vColor;',
    'void main() {',
    '  gl_FragColor = vec4(vColor, 1.0);',
    '}'
  ].join('\n');

  /* ---------- Utilidades de color ---------- */
  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return [0.5, 0.8, 1];
    return [
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255
    ];
  }

  /* ---------- Instancia del renderer ---------- */
  function FluidGradient(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts;
    this.gl = null;
    this.prog = null;
    this.buffers = null;
    this.verts = null;
    this.vertexCount = 0;
    this.cols = opts.density[0];
    this.rows = opts.density[1];
    this.amp = opts.amp;
    this.speed = opts.speed;
    this.colors = opts.colors.map(hexToRgb);
    this.controls = [
      { x: -0.7, y: -0.6, r: 0.26, ph: 0.0 },
      { x: 0.75, y: -0.55, r: 0.24, ph: 2.1 },
      { x: 0.62, y: 0.72,  r: 0.22, ph: 4.2 },
      { x: -0.62, y: 0.6,  r: 0.27, ph: 1.1 }
    ];
    this.mouse = { x: 0, y: 0 };     // valor suavizado
    this.target = { x: 0, y: 0 };    // valor objetivo (puntero)
    this.t = 0;
    this.running = false;
    this._raf = 0;
    this._reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._init();
  }

  FluidGradient.prototype._init = function () {
    var canvas = this.canvas;
    var gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!gl) return; // fallback CSS del panel queda intacto
    this.gl = gl;

    var prog = createProgram(gl, VERT, FRAG);
    if (!prog) return;
    this.prog = prog;
    gl.useProgram(prog);

    this._aPos = gl.getAttribLocation(prog, 'aPos');
    this._aColor = gl.getAttribLocation(prog, 'aColor');

    var stride = 5 * 4; // 2 floats pos + 3 floats color
    var posBuf = gl.createBuffer();
    var colBuf = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(this._aPos);
    gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, stride, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.enableVertexAttribArray(this._aColor);
    gl.vertexAttribPointer(this._aColor, 3, gl.FLOAT, false, stride, 8);

    this.buffers = { pos: posBuf, col: colBuf };
    this._buildIndices();
    this._resize();

    // Puntero: se escucha en el contenedor padre para que reaccione también
    // cuando el mouse pasa sobre el contenido (tarjetas, etc.).
    var host = canvas.parentElement || canvas;
    host.addEventListener('pointermove', this._onMove.bind(this));
    host.addEventListener('pointerleave', this._onLeave.bind(this));

    // Pausa fuera del viewport
    if ('IntersectionObserver' in window) {
      var self = this;
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) self._start(); else self._stop();
        });
      }, { threshold: 0.05 }).observe(canvas);
    }

    this._resizeObserver = new ResizeObserver(this._resize.bind(this));
    this._resizeObserver.observe(canvas.parentElement || canvas);

    canvas.parentElement && canvas.parentElement.classList.add('is-fluid');

    if (this._reduced) {
      this._render(0);
    } else {
      this._start();
    }
  };

  FluidGradient.prototype._buildIndices = function () {
    var cols = this.cols, rows = this.rows;
    var count = 0;
    var idx = new Uint16Array((cols - 1) * (rows - 1) * 6);
    var k = 0;
    for (var j = 0; j < rows - 1; j++) {
      for (var i = 0; i < cols - 1; i++) {
        var a = j * cols + i;
        var b = a + 1;
        var c = a + cols;
        var d = c + 1;
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
    }
    this.vertexCount = idx.length;
    var gl = this.gl;
    var idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.buffers.idx = idxBuf;
  };

  FluidGradient.prototype._onMove = function (e) {
    var rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var nx = (e.clientX - rect.left) / rect.width;
    var ny = (e.clientY - rect.top) / rect.height;
    this.target.x = nx * 2 - 1;      // → [-1, 1]
    this.target.y = 1 - ny * 2;      // invertir Y (GL hacia arriba)
  };

  FluidGradient.prototype._onLeave = function () {
    this.target.x = 0;
    this.target.y = 0;
  };

  FluidGradient.prototype._resize = function () {
    var canvas = this.canvas;
    var host = canvas.parentElement || canvas;
    var w = host.clientWidth || 1;
    var h = host.clientHeight || 1;
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (this.gl) this.gl.viewport(0, 0, canvas.width, canvas.height);
  };

  FluidGradient.prototype._start = function () {
    if (this.running || this._reduced || !this.gl) return;
    this.running = true;
    var self = this;
    var last = 0;
    function loop(ts) {
      if (!self.running) return;
      var dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016;
      last = ts;
      self.t += dt;
      // Suavizado del cursor (easing)
      self.mouse.x += (self.target.x - self.mouse.x) * 0.06;
      self.mouse.y += (self.target.y - self.mouse.y) * 0.06;
      self._render(dt);
      self._raf = requestAnimationFrame(loop);
    }
    this._raf = requestAnimationFrame(loop);
  };

  FluidGradient.prototype._stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  };

  /* Recalcula posiciones y colores de la malla y sube el buffer al GPU. */
  FluidGradient.prototype._render = function (dt) {
    var gl = this.gl;
    if (!gl || !this.prog) return;
    var cols = this.cols, rows = this.rows;
    var amp = this.amp;
    var t = this.t;
    var cx = this.mouse.x;
    var cy = this.mouse.y;
    var colors = this.colors;
    var controls = this.controls;

    // Mover los 4 puntos de color en órbitas lentas
    var pts = [];
    for (var c = 0; c < 4; c++) {
      var o = controls[c];
      pts.push({
        x: o.x + o.r * Math.cos(t * 0.18 * this.speed * 3 + o.ph),
        y: o.y + o.r * Math.sin(t * 0.14 * this.speed * 3 + o.ph * 1.6)
      });
    }

    var n = cols * rows;
    var data = new Float32Array(n * 5);
    var k = 0;

    for (var j = 0; j < rows; j++) {
      var vy = (j / (rows - 1)) * 2 - 1;
      for (var i = 0; i < cols; i++) {
        var vx = (i / (cols - 1)) * 2 - 1;

        /* --- Ondas orgánicas (bucle suave y continuo) --- */
        var w1 = Math.sin(vx * 1.7 + t * 0.5 * this.speed) * Math.cos(vy * 1.35 - t * 0.42 * this.speed);
        var w2 = Math.sin(vx * 2.6 - t * 0.72 * this.speed) * Math.cos(vy * 2.2 + t * 0.6 * this.speed);
        var w3 = Math.sin((vx + vy) * 1.9 + t * 0.3 * this.speed);
        var nx = vx + amp * (w1 + w2 * 0.55 + w3 * 0.3);
        var ny = vy + amp * (w2 - w1 * 0.5 + w3 * 0.35);

        /* --- Influencia del cursor (empuje radial + onda) --- */
        var dx = vx - cx;
        var dy = vy - cy;
        var d2 = dx * dx + dy * dy;
        var inf = Math.exp(-d2 * 2.4);
        var push = 0.16;
        nx += dx * inf * push;
        ny += dy * inf * push;
        var dist = Math.sqrt(d2);
        var wave = Math.sin(dist * 7.0 - t * 2.6 * this.speed) * inf * push * 0.8;
        nx += dx * wave;
        ny += dy * wave;

        /* --- Color: mezcla ponderada de los 4 puntos --- */
        var r = 0, g = 0, b = 0, wsum = 0;
        for (var c2 = 0; c2 < 4; c2++) {
          var qx = pts[c2].x - vx;
          var qy = pts[c2].y - vy;
          var wgt = 1 / (qx * qx + qy * qy + 0.09);
          var col = colors[c2];
          r += col[0] * wgt;
          g += col[1] * wgt;
          b += col[2] * wgt;
          wsum += wgt;
        }
        r /= wsum; g /= wsum; b /= wsum;

        data[k++] = nx;
        data[k++] = ny;
        data[k++] = r;
        data[k++] = g;
        data[k++] = b;
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.pos);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.col);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, this.vertexCount, gl.UNSIGNED_SHORT, 0);
  };

  /* ---------- Inicialización automática ---------- */
  function parseOptions(canvas) {
    var colorsAttr = canvas.getAttribute('data-colors');
    var colors = colorsAttr
      ? colorsAttr.split(',').map(function (s) { return s.trim(); })
      : ['#38bdf8', '#06b6d4', '#e0f2fe', '#0284c7'];

    var density = [40, 22];
    var dAttr = canvas.getAttribute('data-density');
    if (dAttr) {
      var parts = dAttr.split('x');
      if (parts.length === 2) {
        var c = parseInt(parts[0], 10) || density[0];
        var r = parseInt(parts[1], 10) || density[1];
        density = [c, r];
      }
    }

    return {
      colors: colors.slice(0, 4),
      density: density,
      speed: parseFloat(canvas.getAttribute('data-speed')) || 0.55,
      amp: parseFloat(canvas.getAttribute('data-amp')) || 0.12
    };
  }

  function init() {
    var canvases = document.querySelectorAll('canvas[data-fluid-gradient]');
    Array.prototype.forEach.call(canvases, function (canvas) {
      if (canvas.__fluidGradient) return;
      canvas.__fluidGradient = new FluidGradient(canvas, parseOptions(canvas));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.SCYFluid = {
    init: init,
    version: '1.0.0'
  };
})();
