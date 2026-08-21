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

  /* ---------- 9. Widget flotante de WhatsApp (global) ---------- */
  (function () {
    if (document.getElementById('waWidget')) return;
    var NUMBER = '5493515135058';
    var url = 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent('Hola, quisiera recibir asesoramiento sobre las soluciones de Tango Delta 6');

    var widget = document.createElement('div');
    widget.className = 'wa-widget';
    widget.id = 'waWidget';

    var bubble = document.createElement('div');
    bubble.className = 'wa-bubble';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');
    var bubbleText = document.createElement('p');
    bubbleText.textContent = '👋 ¡Hola! ¿Tenés dudas sobre Tango Delta 6? Chateá con un asesor.';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'wa-bubble__close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.textContent = '×';
    bubble.appendChild(bubbleText);
    bubble.appendChild(closeBtn);

    var link = document.createElement('a');
    link.className = 'wa-btn';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Chatear por WhatsApp');
    link.innerHTML = '<span class="wa-badge" aria-hidden="true">1</span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

    widget.appendChild(bubble);
    widget.appendChild(link);
    document.body.appendChild(widget);

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Mostrar el globo 2s después de entrar, salvo que ya se haya cerrado en la sesión */
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('wa-bubble-dismissed') === '1'; } catch (e) { dismissed = false; }
    if (!dismissed && !reduceMotion) {
      setTimeout(function () { widget.classList.add('is-open'); }, 2000);
    }

    closeBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      widget.classList.remove('is-open');
      try { sessionStorage.setItem('wa-bubble-dismissed', '1'); } catch (e) { /* sin almacenamiento */ }
    });
  })();
})();
