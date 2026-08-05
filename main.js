/* ==========================================================================
   main.js — Sandra Chaves y Asociados (maqueta v1)
   Interacciones sin dependencias: header, navegación mobile, mega menú,
   acordeones, formulario multi-paso, calculadora ROI, video de héroe.
   Las animaciones de scroll/Lottie viven en animations.js
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  document.documentElement.classList.remove('no-js');

  /* ---------- 1. Header: borde/sombra al hacer scroll ---------- */
  var header = $('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- 2. Navegación mobile ---------- */
  var navToggle = $('.nav-toggle');
  var mobilePanel = $('.mobile-panel');
  if (navToggle && mobilePanel) {
    var setMobile = function (open) {
      mobilePanel.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      document.body.style.overflow = open ? 'hidden' : '';
    };
    navToggle.addEventListener('click', function () {
      setMobile(!mobilePanel.classList.contains('is-open'));
    });
    $$('a', mobilePanel).forEach(function (a) {
      a.addEventListener('click', function () { setMobile(false); });
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && mobilePanel.classList.contains('is-open')) setMobile(false);
    });
  }

  /* ---------- 3. Mega menú: click/touch/teclado (el hover lo resuelve CSS) ---------- */
  var closeAllMegas = function (except) {
    $$('.nav-mega.is-open').forEach(function (item) {
      if (item === except) return;
      item.classList.remove('is-open');
      var b = $('.nav-mega-btn', item);
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  };
  $$('.nav-mega').forEach(function (item) {
    var btn = $('.nav-mega-btn', item);
    if (!btn) return;
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var willOpen = !item.classList.contains('is-open');
      closeAllMegas(item);
      item.classList.toggle('is-open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('.nav-mega')) closeAllMegas(null);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeAllMegas(null);
  });

  /* ---------- 4. Acordeones (10 razones / FAQ) ----------
     Estructura: [data-accordion] > .acc-item > .acc-btn + .acc-panel
     data-accordion="single" → solo un ítem abierto a la vez. */
  $$('[data-accordion]').forEach(function (acc) {
    var single = acc.getAttribute('data-accordion') === 'single';
    $$('.acc-item', acc).forEach(function (item) {
      var btn = $('.acc-btn', item);
      if (!btn) return;
      btn.addEventListener('click', function () {
        var willOpen = !item.classList.contains('is-open');
        if (single) {
          $$('.acc-item.is-open', acc).forEach(function (other) {
            other.classList.remove('is-open');
            var b = $('.acc-btn', other);
            if (b) b.setAttribute('aria-expanded', 'false');
          });
        }
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });
  });

  /* ---------- 5. Formulario multi-paso ---------- */
  var FREE_DOMAINS = [
    'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.ar', 'hotmail.es',
    'outlook.com', 'outlook.com.ar', 'outlook.es', 'live.com', 'live.com.ar',
    'msn.com', 'yahoo.com', 'yahoo.com.ar', 'yahoo.es', 'icloud.com', 'me.com',
    'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net',
    'yandex.com', 'mail.com', 'fibertel.com.ar', 'speedy.com.ar', 'arnet.com.ar',
    'ciudad.com.ar'
  ];
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  $$('form[data-multistep]').forEach(function (form) {
    var steps = $$('fieldset[data-step]', form);
    var indicators = $$('.form-steps li', form);
    var success = $('.form-success'); // panel de confirmación (fuera del form)
    var current = 0;
    if (!steps.length) return;

    function showStep(i) {
      current = Math.max(0, Math.min(i, steps.length - 1));
      steps.forEach(function (fs, idx) {
        fs.classList.toggle('is-active', idx === current);
      });
      indicators.forEach(function (li, idx) {
        li.classList.toggle('is-active', idx === current);
        li.classList.toggle('is-done', idx < current);
        if (idx === current) li.setAttribute('aria-current', 'step');
        else li.removeAttribute('aria-current');
      });
      var first = $('input, select, textarea', steps[current]);
      if (first) first.focus({ preventScroll: true });
    }

    function setError(field, msg) {
      var wrap = field.closest('.field');
      if (!wrap) return;
      wrap.classList.add('has-error');
      var err = $('.field-err', wrap);
      if (err) err.textContent = msg;
      field.setAttribute('aria-invalid', 'true');
    }
    function clearError(field) {
      var wrap = field.closest('.field');
      if (!wrap) return;
      wrap.classList.remove('has-error');
      field.removeAttribute('aria-invalid');
    }

    function validateStep(i) {
      var ok = true;
      var firstInvalid = null;
      function fail(field, msg) {
        setError(field, msg);
        ok = false;
        if (!firstInvalid) firstInvalid = field;
      }
      $$('[required]', steps[i]).forEach(function (field) {
        clearError(field);
        var v = (field.value || '').trim();
        if (field.type === 'checkbox') {
          if (!field.checked) fail(field, 'Necesitamos tu consentimiento para contactarte.');
          return;
        }
        if (!v) {
          fail(field, 'Este campo es obligatorio.');
          return;
        }
        if (field.type === 'email') {
          if (!EMAIL_RE.test(v)) {
            fail(field, 'Revisá el formato del email.');
            return;
          }
          if (field.hasAttribute('data-corp-email')) {
            var domain = v.split('@')[1].toLowerCase();
            var isFree = FREE_DOMAINS.some(function (d) {
              return domain === d || domain.slice(-(d.length + 1)) === '.' + d;
            });
            if (isFree) {
              fail(field, 'Usá tu email corporativo (no aceptamos casillas gratuitas como Gmail o Hotmail).');
            }
          }
        }
      });
      // Llevar el foco al primer campo con error (navegación por teclado / lectores de pantalla)
      if (!ok && firstInvalid) firstInvalid.focus({ preventScroll: true });
      return ok;
    }

    $$('[data-next]', form).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (validateStep(current)) showStep(current + 1);
      });
    });
    $$('[data-prev]', form).forEach(function (btn) {
      btn.addEventListener('click', function () { showStep(current - 1); });
    });
    // Permitir volver a pasos ya completados tocando el indicador
    // Accesible por teclado: role="button" + tabindex + Enter/Espacio
    indicators.forEach(function (li, idx) {
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      var go = function () { if (idx < current) showStep(idx); };
      li.addEventListener('click', go);
      li.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          go();
        }
      });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!validateStep(current)) return;
      /* REEMPLAZAR: conectar con backend / CRM / email transaccional.
         La maqueta simula el envío con un estado de carga (~900 ms),
         muestra la confirmación y vuelca los datos en consola.
         Al integrar el backend: reemplazar el setTimeout por el fetch
         y, en caso de error, rehabilitar el botón y restaurar el label
         (submitBtn.dataset.label). */
      var data = {};
      $$('input, select, textarea', form).forEach(function (f) {
        if (f.name) data[f.name] = f.type === 'checkbox' ? f.checked : f.value;
      });
      var submitBtn = $('[type="submit"]', form);
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.label = submitBtn.textContent;
        submitBtn.textContent = 'Enviando…';
      }
      form.setAttribute('aria-busy', 'true');
      window.setTimeout(function () {
        if (window.console) console.log('[maqueta] Lead capturado:', data);
        form.removeAttribute('aria-busy');
        form.hidden = true;
        if (success) {
          success.hidden = false;
          // Re-disparar el Lottie de éxito (autoplay desactivado en el HTML)
          var sl = $('[data-lottie]', success);
          if (sl && sl.__lottieAnim) {
            try { sl.__lottieAnim.goToAndPlay(0); } catch (e) {}
          }
          var h = $('h2, h3', success);
          if (h) {
            h.setAttribute('tabindex', '-1');
            h.focus({ preventScroll: true });
          }
        }
      }, 900);
    });

    showStep(0);
  });

  /* ---------- 6. Calculadora ROI ----------
     Fórmula transparente (maqueta):
     ahorro mensual = personas × horas manuales semanales × 4,33 semanas
                      × costo hora × 60% de recupero por automatización. */
  var roi = $('[data-roi]');
  if (roi) {
    var inEmp = $('#roi-empleados');
    var inHoras = $('#roi-horas');
    var inCosto = $('#roi-costo');
    var outMes = $('.roi-amount', roi);
    var outAnual = $('[data-roi-anual]', roi);
    var SEMANAS_MES = 4.33;
    var RECUPERO = 0.6;
    var fmt = new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', maximumFractionDigits: 0
    });
    var calc = function () {
      var emp = parseFloat(inEmp && inEmp.value) || 0;
      var h = parseFloat(inHoras && inHoras.value) || 0;
      var c = parseFloat(inCosto && inCosto.value) || 0;
      var mensual = emp * h * SEMANAS_MES * c * RECUPERO;
      if (outMes) outMes.textContent = fmt.format(Math.round(mensual));
      if (outAnual) outAnual.textContent = fmt.format(Math.round(mensual * 12));
    };
    [inEmp, inHoras, inCosto].forEach(function (input) {
      if (input) input.addEventListener('input', calc);
    });
    calc();
  }

  /* ---------- 7. Año dinámico en footer ---------- */
  $$('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- 9. QR de contacto ----------
     HTML: <span class="c-qr" data-qr="https://wa.me/..."></span>
     qrcodejs (davidshimjs) vía CDN; si la librería no cargó, se oculta
     el wrapper completo y el enlace de texto sigue funcionando. */
  $$('[data-qr]').forEach(function (el) {
    if (!window.QRCode) {
      var wrap = el.closest('.c-qr-wrap');
      if (wrap) wrap.hidden = true;
      return;
    }
    try {
      new window.QRCode(el, {
        text: el.getAttribute('data-qr'),
        width: 78,
        height: 78,
        colorDark: '#002B5B',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
      });
    } catch (e) {
      var w = el.closest('.c-qr-wrap');
      if (w) w.hidden = true;
    }
  });

  /* ---------- 8. Videos de héroe: fallback + pausa fuera de pantalla ---------- */
  $$('video[data-hero-video]').forEach(function (video) {
    var hide = function () { video.style.display = 'none'; };
    video.addEventListener('error', hide);
    $$('source', video).forEach(function (s) { s.addEventListener('error', hide); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var p = video.play();
            if (p && p.catch) p.catch(function () { /* autoplay bloqueado */ });
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.1 }).observe(video);
    }
  });
})();
