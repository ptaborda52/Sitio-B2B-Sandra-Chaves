/* ==========================================================================
   animations.js — Sandra Chaves y Asociados (maqueta v1)
   Config central parametrizada (window.SCY_ANIM) + GSAP/ScrollTrigger + Lottie.

   Reglas del proyecto:
   - Todo usa gsap.from / autoAlpha → el contenido es visible sin JS.
   - Se respeta prefers-reduced-motion (no se inicializa nada).
   - Cada animación se puede ajustar desde SCY_ANIM sin tocar la lógica.
   ========================================================================== */

/* ---------- Config editable ---------- */
window.SCY_ANIM = {
  durations: { fast: 0.45, base: 0.7, slow: 1.05 },
  easings: { out: 'power3.out', soft: 'power2.out' },
  stagger: { cards: 0.09, tight: 0.05 },
  triggers: { default: 'top 84%', band: 'top 72%' },
  parallax: { soft: 10, strong: 18 },      // yPercent
  counters: { duration: 1.6 },

  /* Lottie en vivo: solo la confirmación del formulario de contacto.
     Los íconos de módulos y el panel de automatización usan SVG estáticos
     (fallback) o imagen real, sin animación. */
  lottie: {
    exito: 'https://assets5.lottiefiles.com/packages/lf20_atippmse.json'
  }
};

(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var cfg = window.SCY_ANIM;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Lottie con fallback SVG inline ----------
     HTML: <div data-lottie="dashboard"><svg class="lottie-fallback">…</svg></div>
     Si lottie-web no está, falla la carga o hay reduce-motion → queda el SVG. */
  function initLottie() {
    $$('[data-lottie]').forEach(function (el) {
      var key = el.getAttribute('data-lottie');
      var url = cfg.lottie[key];
      var fallback = el.querySelector('.lottie-fallback');
      if (!url || reduceMotion || !window.lottie) {
        if (fallback) fallback.style.display = 'block';
        return;
      }
      try {
        var anim = window.lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop: el.getAttribute('data-loop') !== 'false',
          autoplay: el.getAttribute('data-autoplay') !== 'false',
          path: url
        });
        /* Referencia pública para poder re-disparar la animación desde
           main.js (p. ej. al mostrar la confirmación del formulario). */
        el.__lottieAnim = anim;
        anim.addEventListener('DOMLoaded', function () {
          if (fallback) fallback.style.display = 'none';
        });
        anim.addEventListener('data_failed', function () {
          if (fallback) fallback.style.display = 'block';
        });
        // Pausar cuando sale del viewport (performance)
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting) { anim.play(); } else { anim.pause(); }
            });
          }, { threshold: 0.15 }).observe(el);
        }
      } catch (e) {
        if (fallback) fallback.style.display = 'block';
      }
    });
  }

  /* Sin movimiento reducido y sin GSAP: contenido visible, solo Lottie/fallbacks */
  if (reduceMotion || !window.gsap) {
    document.documentElement.classList.add('no-gsap');
    initLottie();
    return;
  }

  var gsap = window.gsap;
  var ST = window.ScrollTrigger || null;
  if (ST) gsap.registerPlugin(ST);

  /* ---------- Entradas por [data-anim] ---------- */
  var VARIANTS = {
    'fade-up':    { y: 30, autoAlpha: 0 },
    'fade-in':    { autoAlpha: 0 },
    'fade-left':  { x: -36, autoAlpha: 0 },
    'fade-right': { x: 36, autoAlpha: 0 },
    'scale-in':   { scale: 0.92, autoAlpha: 0 }
  };

  $$('[data-anim]').forEach(function (el) {
    var variant = VARIANTS[el.getAttribute('data-anim')] || VARIANTS['fade-up'];
    var vars = {
      duration: parseFloat(el.getAttribute('data-dur')) || cfg.durations.base,
      ease: cfg.easings.out,
      delay: parseFloat(el.getAttribute('data-delay')) || 0
    };
    Object.keys(variant).forEach(function (k) { vars[k] = variant[k]; });
    if (ST) vars.scrollTrigger = { trigger: el, start: cfg.triggers.default, once: true };
    gsap.from(el, vars);
  });

  /* ---------- Grupos con stagger: [data-anim-group] anima a sus hijos ---------- */
  $$('[data-anim-group]').forEach(function (group) {
    var kids = Array.prototype.slice.call(group.children);
    if (!kids.length) return;
    var vars = {
      y: 28, autoAlpha: 0,
      duration: cfg.durations.base,
      ease: cfg.easings.out,
      stagger: parseFloat(group.getAttribute('data-stagger')) || cfg.stagger.cards
    };
    if (ST) vars.scrollTrigger = { trigger: group, start: cfg.triggers.default, once: true };
    gsap.from(kids, vars);
  });

  /* ---------- Parallax: [data-parallax="soft|strong"] ---------- */
  if (ST) {
    $$('[data-parallax]').forEach(function (el) {
      var strength = el.getAttribute('data-parallax') === 'strong'
        ? cfg.parallax.strong : cfg.parallax.soft;
      gsap.fromTo(el, { yPercent: -strength / 2 }, {
        yPercent: strength / 2,
        ease: 'none',
        scrollTrigger: {
          trigger: el.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  }

  /* ---------- Contadores numéricos: [data-count] ----------
     HTML: <span data-count="79800">79.800</span> — el valor final queda en el
     markup (correcto sin JS y con reduce-motion); acá lo reseteamos a 0 solo
     cuando la animación realmente va a correr. */
  $$('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var fmt = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals
    });
    el.textContent = fmt.format(0);
    var obj = { val: 0 };
    var vars = {
      val: target,
      duration: cfg.counters.duration,
      ease: 'power2.out',
      onUpdate: function () { el.textContent = fmt.format(obj.val); }
    };
    if (ST) vars.scrollTrigger = { trigger: el, start: cfg.triggers.band, once: true };
    gsap.to(obj, vars);
  });

  /* ---------- Diagrama de integraciones: pinning + trazado (desktop) ----------
     En mobile no hay pin: los cables quedan con el dash punteado del CSS. */
  var integr = $('.integr-wrap');
  if (integr && ST) {
    var mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', function () {
      var wires = $$('.wire', integr);
      var dots = $$('.wire-dot', integr);
      var nodes = $$('.integr-node', integr);

      wires.forEach(function (w) {
        var len = w.getTotalLength ? w.getTotalLength() : 300;
        w.style.strokeDasharray = String(len);
        w.style.strokeDashoffset = String(len);
      });

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: integr,
          start: 'top 18%',
          end: '+=' + (wires.length * 130),
          pin: true,
          scrub: 0.6,
          anticipatePin: 1
        }
      });
      if (nodes.length) {
        tl.from(nodes, {
          autoAlpha: 0, y: 18, stagger: 0.12, duration: 0.5, ease: cfg.easings.out
        }, 0);
      }
      wires.forEach(function (w, i) {
        tl.to(w, { strokeDashoffset: 0, duration: 0.5, ease: 'none' }, 0.25 + i * 0.18);
      });
      if (dots.length) {
        tl.from(dots, {
          scale: 0, transformOrigin: '50% 50%', stagger: 0.15, duration: 0.3
        }, 0.6);
      }

      // Cleanup al volver a mobile: restaurar el dash punteado del CSS
      return function () {
        wires.forEach(function (w) {
          w.style.strokeDasharray = '';
          w.style.strokeDashoffset = '';
        });
      };
    });
  }

  /* ---------- Timeline (Nosotros): progreso ligado al scroll ----------
     La línea Capri se dibuja a medida que se recorren los hitos. */
  if (ST) {
    $$('.timeline-progress').forEach(function (bar) {
      gsap.fromTo(bar, { scaleY: 0 }, {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: bar.parentElement,
          start: 'top 80%',
          end: 'bottom 60%',
          scrub: 0.5
        }
      });
    });
  }

  initLottie();

  // Recalcular triggers cuando terminen de cargar imágenes/fuentes
  window.addEventListener('load', function () {
    if (ST) ST.refresh();
  });
})();
