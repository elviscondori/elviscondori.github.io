// ============================================================================
// TesisWeb — interactividad
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {
  // Año actual en el pie de página -----------------------------------------
  var anio = document.getElementById('anio-actual');
  if (anio) {
    anio.textContent = new Date().getFullYear();
  }

  // Menú de navegación (móvil) ---------------------------------------------
  var toggle = document.querySelector('.site-nav__toggle');
  var menu = document.getElementById('nav-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var abierto = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(abierto));
    });

    // Cerrar el menú al pulsar un enlace
    menu.addEventListener('click', function (evento) {
      if (evento.target.tagName === 'A') {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Animación de entrada (reveal) --------------------------------------------
  // Los elementos solo se ocultan vía JS: sin JS todo el contenido es visible.
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var elementos = Array.prototype.slice.call(
    document.querySelectorAll('.reveal')
  );

  if (!reduceMotion && elementos.length && 'IntersectionObserver' in window) {
    elementos.forEach(function (el) {
      el.classList.add('reveal--hidden');
    });

    var observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) {
            return;
          }
          var el = entrada.target;
          var retraso = el.getAttribute('data-reveal-delay') || 0;
          el.style.transitionDelay = retraso + 'ms';
          el.classList.add('reveal--visible');
          observador.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px' }
    );

    elementos.forEach(function (el) {
      observador.observe(el);
    });
  }
});
