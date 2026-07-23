// ============================================================================
// TesisWeb — juego «Sé el hiperplano»
// El jugador traza una línea que separa dos clases de objetos y la compara
// con el hiperplano de máximo margen que encontraría un SVM lineal.
// ============================================================================

document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('juego-canvas');
  if (!canvas || !canvas.getContext) {
    return;
  }

  var MUNDO = 10; // el plano de características va de 0 a 10 en ambos ejes
  var PUNTOS_POR_CLASE = 9;
  var CLASE_TUERCA = -1; // arriba-izquierda
  var CLASE_TORNILLO = 1; // abajo-derecha

  var COLORES = {
    tuerca: '#7A2237',
    tornillo: '#2E6FB0',
    lineaJugador: '#48484A',
    lineaSvm: '#7A2237',
    margenSvm: '#CF7A8A',
    rejilla: '#E8E8ED',
    borde: '#D2D2D7',
    eje: '#86868B',
    anilloError: '#C0392B',
    anilloSoporte: '#9C3850',
    fondoPlano: '#FFFFFF'
  };

  var ctx = canvas.getContext('2d');
  var overlay = document.getElementById('juego-overlay');
  var btnJugar = document.getElementById('juego-jugar');
  var statPrecision = document.getElementById('juego-precision');
  var statMargen = document.getElementById('juego-margen');
  var statPuntaje = document.getElementById('juego-puntaje');
  var mensajeEl = document.getElementById('juego-mensaje');
  var btnSvm = document.getElementById('juego-btn-svm');
  var btnNueva = document.getElementById('juego-btn-nueva');

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var estado = {
    activo: false,
    puntos: [], // {x, y, clase}
    lineaJugador: null, // {q: {x,y}, n: {x,y} normal unitaria}
    evaluacion: null, // {precision, fallos, margen, razonMargen, puntaje}
    svm: null, // {q, n, margen, soportes}
    svmVisible: false,
    svmAlfa: 0
  };

  // Utilidades vectoriales ---------------------------------------------------
  function resta(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  function producto(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function modulo(a) {
    return Math.hypot(a.x, a.y);
  }

  function escala(a, k) {
    return { x: a.x * k, y: a.y * k };
  }

  function unitario(a) {
    return escala(a, 1 / (modulo(a) || 1));
  }

  function distPuntoSegmento(p, a, b) {
    var ab = resta(b, a);
    var len2 = producto(ab, ab);
    var t = len2 === 0 ? 0 : producto(resta(p, a), ab) / len2;
    t = Math.max(0, Math.min(1, t));
    var proy = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    return { d: modulo(resta(p, proy)), punto: proy };
  }

  // Cierre convexo (cadena monótona de Andrew)
  function cierreConvexo(puntos) {
    var p = puntos.slice().sort(function (a, b) {
      return a.x - b.x || a.y - b.y;
    });
    if (p.length <= 2) {
      return p;
    }
    function cruz(o, a, b) {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }
    var inferior = [];
    p.forEach(function (pt) {
      while (
        inferior.length >= 2 &&
        cruz(inferior[inferior.length - 2], inferior[inferior.length - 1], pt) <= 0
      ) {
        inferior.pop();
      }
      inferior.push(pt);
    });
    var superior = [];
    p.slice().reverse().forEach(function (pt) {
      while (
        superior.length >= 2 &&
        cruz(superior[superior.length - 2], superior[superior.length - 1], pt) <= 0
      ) {
        superior.pop();
      }
      superior.push(pt);
    });
    inferior.pop();
    superior.pop();
    return inferior.concat(superior);
  }

  // SVM lineal exacto (máximo margen) ----------------------------------------
  // En 2D, con clases separables, el hiperplano de máximo margen es la
  // mediatriz del segmento más corto entre los cierres convexos de ambas
  // clases. Se busca ese segmento probando vértice contra arista.
  function entrenarSvm(puntos) {
    var tuercas = puntos.filter(function (p) {
      return p.clase === CLASE_TUERCA;
    });
    var tornillos = puntos.filter(function (p) {
      return p.clase === CLASE_TORNILLO;
    });
    var cierreA = cierreConvexo(tuercas);
    var cierreB = cierreConvexo(tornillos);

    var mejor = { d: Infinity, pa: null, pb: null };

    function considerar(pa, pb) {
      var d = modulo(resta(pb, pa));
      if (d < mejor.d) {
        mejor = { d: d, pa: pa, pb: pb };
      }
    }

    function verticesContraAristas(vertices, cierre, invertir) {
      vertices.forEach(function (v) {
        for (var i = 0; i < cierre.length; i++) {
          var a = cierre[i];
          var b = cierre[(i + 1) % cierre.length];
          var cercano = distPuntoSegmento(v, a, b).punto;
          if (invertir) {
            considerar(cercano, v);
          } else {
            considerar(v, cercano);
          }
        }
      });
    }

    verticesContraAristas(cierreA, cierreB, false); // pa en tuercas, pb en tornillos
    verticesContraAristas(cierreB, cierreA, true);

    var q = {
      x: (mejor.pa.x + mejor.pb.x) / 2,
      y: (mejor.pa.y + mejor.pb.y) / 2
    };
    var n = unitario(resta(mejor.pb, mejor.pa)); // apunta hacia los tornillos
    var margen = mejor.d / 2;

    var soportes = [];
    puntos.forEach(function (p) {
      if (Math.abs(producto(resta(p, q), n)) <= margen + 1e-6) {
        soportes.push(p);
      }
    });

    return { q: q, n: n, margen: margen, soportes: soportes };
  }

  // Generación de rondas -------------------------------------------------------
  function nuevaRonda() {
    var phi = ((20 + Math.random() * 50) * Math.PI) / 180;
    // Normal oculta apuntando hacia abajo-derecha (zona de tornillos)
    var n = { x: Math.cos(phi), y: -Math.sin(phi) };
    var centro = {
      x: 5 + (Math.random() - 0.5) * 1.6,
      y: 5 + (Math.random() - 0.5) * 1.6
    };

    var puntos = [];
    var cuentas = {};
    cuentas[CLASE_TUERCA] = 0;
    cuentas[CLASE_TORNILLO] = 0;
    var intentos = 0;

    while (
      (cuentas[CLASE_TUERCA] < PUNTOS_POR_CLASE ||
        cuentas[CLASE_TORNILLO] < PUNTOS_POR_CLASE) &&
      intentos++ < 5000
    ) {
      var p = {
        x: 0.8 + Math.random() * (MUNDO - 1.6),
        y: 0.8 + Math.random() * (MUNDO - 1.6)
      };
      var d = producto(resta(p, centro), n);
      if (Math.abs(d) < 0.55 || Math.abs(d) > 3.9) {
        continue;
      }
      var clase = d > 0 ? CLASE_TORNILLO : CLASE_TUERCA;
      if (cuentas[clase] >= PUNTOS_POR_CLASE) {
        continue;
      }
      var muyCerca = puntos.some(function (otro) {
        return modulo(resta(otro, p)) < 0.55;
      });
      if (muyCerca) {
        continue;
      }
      p.clase = clase;
      puntos.push(p);
      cuentas[clase]++;
    }

    estado.puntos = puntos;
    estado.lineaJugador = null;
    estado.evaluacion = null;
    estado.svm = entrenarSvm(puntos);
    estado.svmVisible = false;
    estado.svmAlfa = 0;

    btnSvm.disabled = true;
    statPrecision.textContent = '—';
    statMargen.textContent = '—';
    statPuntaje.textContent = '—';
    fijarMensaje(
      estado.activo
        ? 'Arrastra sobre el plano para trazar tu línea separadora.'
        : 'Pulsa «Jugar» y arrastra sobre el plano para trazar tu línea separadora.',
      null
    );
    dibujar();
  }

  // Evaluación de la línea del jugador ------------------------------------------
  function evaluarLinea() {
    var q = estado.lineaJugador.q;
    var n = estado.lineaJugador.n;
    var aciertos = 0;

    estado.puntos.forEach(function (p) {
      var lado = producto(resta(p, q), n) > 0 ? 1 : -1;
      if (lado === p.clase) {
        aciertos++;
      }
    });
    // La orientación de la línea no importa: se toma la mejor de las dos.
    if (aciertos < estado.puntos.length - aciertos) {
      estado.lineaJugador.n = escala(n, -1);
      aciertos = estado.puntos.length - aciertos;
    }

    var fallos = [];
    var distanciaMinima = Infinity;
    estado.puntos.forEach(function (p) {
      var s = producto(resta(p, estado.lineaJugador.q), estado.lineaJugador.n);
      if ((s > 0 ? 1 : -1) !== p.clase) {
        fallos.push(p);
      }
      distanciaMinima = Math.min(distanciaMinima, Math.abs(s));
    });

    var total = estado.puntos.length;
    var precision = (total - fallos.length) / total;
    var margen = fallos.length === 0 ? distanciaMinima : 0;
    var razonMargen = Math.min(margen / estado.svm.margen, 1);
    var puntaje = Math.round(precision * 70 + razonMargen * 30);

    estado.evaluacion = {
      precision: precision,
      fallos: fallos,
      margen: margen,
      razonMargen: razonMargen,
      puntaje: puntaje
    };

    statPrecision.textContent = Math.round(precision * 100) + '%';
    statMargen.textContent =
      fallos.length === 0 ? Math.round(razonMargen * 100) + '%' : '0%';
    statPuntaje.textContent = puntaje + ' / 100';

    var pct = Math.round(razonMargen * 100);
    if (fallos.length > 0) {
      fijarMensaje(
        'Tu línea clasifica mal ' +
          fallos.length +
          ' objeto' +
          (fallos.length > 1 ? 's' : '') +
          ' (marcados en rojo). Traza otra línea para intentarlo de nuevo.',
        'error'
      );
    } else if (razonMargen >= 0.85) {
      fijarMensaje(
        '¡Excelente! Separaste todo con un margen del ' +
          pct +
          '% del óptimo. Compárate con el SVM.',
        'exito'
      );
    } else if (razonMargen >= 0.5) {
      fijarMensaje(
        'Separación perfecta, pero tu margen es el ' +
          pct +
          '% del óptimo. ¿Puedes dejar más espacio a ambos lados?',
        'info'
      );
    } else {
      fijarMensaje(
        'Separaste bien, aunque tu línea pasa muy cerca de algunos puntos ' +
          '(margen: ' +
          pct +
          '% del óptimo). Intenta alejarla de ambas clases.',
        'info'
      );
    }

    btnSvm.disabled = false;
  }

  function fijarMensaje(texto, tipo) {
    mensajeEl.textContent = texto;
    mensajeEl.className = 'juego-mensaje' + (tipo ? ' juego-mensaje--' + tipo : '');
  }

  // Render ------------------------------------------------------------------------
  var vista = { margen: 40, escala: 1, ox: 0, oy: 0, ancho: 0, alto: 0 };

  function redimensionar() {
    var caja = canvas.parentElement.getBoundingClientRect();
    if (caja.width === 0) {
      return;
    }
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(caja.width * dpr);
    canvas.height = Math.round(caja.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vista.ancho = caja.width;
    vista.alto = caja.height;
    vista.escala = Math.min(
      (caja.width - vista.margen * 2) / MUNDO,
      (caja.height - vista.margen * 2) / MUNDO
    );
    vista.ox = (caja.width - MUNDO * vista.escala) / 2;
    vista.oy = (caja.height - MUNDO * vista.escala) / 2;
    dibujar();
  }

  function aPantalla(p) {
    return {
      x: vista.ox + p.x * vista.escala,
      y: vista.alto - vista.oy - p.y * vista.escala
    };
  }

  function aMundo(px, py) {
    return {
      x: (px - vista.ox) / vista.escala,
      y: (vista.alto - vista.oy - py) / vista.escala
    };
  }

  function trazarRectangulo(x, y, ancho, alto, radio) {
    if (ctx.roundRect) {
      ctx.roundRect(x, y, ancho, alto, radio);
    } else {
      ctx.rect(x, y, ancho, alto);
    }
  }

  function dibujarRecta(q, n, color, grosor, guiones) {
    // Dirección de la recta: perpendicular a la normal
    var u = { x: -n.y, y: n.x };
    var a = aPantalla({ x: q.x + u.x * 40, y: q.y + u.y * 40 });
    var b = aPantalla({ x: q.x - u.x * 40, y: q.y - u.y * 40 });
    var origen = aPantalla({ x: 0, y: MUNDO });
    ctx.save();
    ctx.beginPath();
    ctx.rect(origen.x, origen.y, MUNDO * vista.escala, MUNDO * vista.escala);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = grosor;
    if (guiones) {
      ctx.setLineDash(guiones);
    }
    ctx.stroke();
    ctx.restore();
  }

  function dibujar(vistaPrevia) {
    ctx.clearRect(0, 0, vista.ancho, vista.alto);

    var origen = aPantalla({ x: 0, y: MUNDO });
    var lado = MUNDO * vista.escala;

    // Fondo del plano
    ctx.fillStyle = COLORES.fondoPlano;
    ctx.strokeStyle = COLORES.borde;
    ctx.lineWidth = 1;
    ctx.beginPath();
    trazarRectangulo(origen.x, origen.y, lado, lado, 8);
    ctx.fill();
    ctx.stroke();

    // Rejilla
    ctx.strokeStyle = COLORES.rejilla;
    ctx.lineWidth = 0.5;
    for (var i = 1; i < MUNDO; i++) {
      var v = aPantalla({ x: i, y: 0 });
      var h = aPantalla({ x: 0, y: i });
      ctx.beginPath();
      ctx.moveTo(v.x, origen.y);
      ctx.lineTo(v.x, origen.y + lado);
      ctx.moveTo(origen.x, h.y);
      ctx.lineTo(origen.x + lado, h.y);
      ctx.stroke();
    }

    // Etiquetas de ejes
    ctx.fillStyle = COLORES.eje;
    ctx.font = '11px Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Elongación del objeto →',
      origen.x + lado / 2,
      origen.y + lado + 24
    );
    ctx.save();
    ctx.translate(origen.x - 16, origen.y + lado / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Redondez del objeto →', 0, 0);
    ctx.restore();

    // Solución del SVM (debajo de los puntos)
    if (estado.svmVisible && estado.svm) {
      ctx.save();
      ctx.globalAlpha = estado.svmAlfa;
      var svm = estado.svm;
      var qMas = {
        x: svm.q.x + svm.n.x * svm.margen,
        y: svm.q.y + svm.n.y * svm.margen
      };
      var qMenos = {
        x: svm.q.x - svm.n.x * svm.margen,
        y: svm.q.y - svm.n.y * svm.margen
      };
      dibujarRecta(qMas, svm.n, COLORES.margenSvm, 1, [4, 4]);
      dibujarRecta(qMenos, svm.n, COLORES.margenSvm, 1, [4, 4]);
      dibujarRecta(svm.q, svm.n, COLORES.lineaSvm, 2, [7, 5]);
      ctx.restore();
    }

    // Línea del jugador
    if (vistaPrevia) {
      var a = aPantalla(vistaPrevia.a);
      var b = aPantalla(vistaPrevia.b);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = COLORES.lineaJugador;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (estado.lineaJugador) {
      dibujarRecta(
        estado.lineaJugador.q,
        estado.lineaJugador.n,
        COLORES.lineaJugador,
        2
      );
    }

    // Puntos
    estado.puntos.forEach(function (p) {
      var c = aPantalla(p);
      var fallado =
        estado.evaluacion && estado.evaluacion.fallos.indexOf(p) !== -1;
      var soporte =
        estado.svmVisible &&
        estado.svmAlfa > 0.5 &&
        estado.svm.soportes.indexOf(p) !== -1;

      if (fallado) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = COLORES.anilloError;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (soporte) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = COLORES.anilloSoporte;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (p.clase === CLASE_TUERCA) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = COLORES.tuerca;
        ctx.fill();
      } else {
        ctx.fillStyle = COLORES.tornillo;
        ctx.beginPath();
        trazarRectangulo(c.x - 6, c.y - 6, 12, 12, 3);
        ctx.fill();
      }
    });
  }

  // Revelación animada de la solución del SVM -----------------------------------
  function revelarSvm() {
    estado.svmVisible = true;

    if (reduceMotion) {
      estado.svmAlfa = 1;
      dibujar();
    } else {
      estado.svmAlfa = 0;
      var inicio = performance.now();
      var animar = function (t) {
        estado.svmAlfa = Math.min((t - inicio) / 450, 1);
        dibujar();
        if (estado.svmAlfa < 1) {
          requestAnimationFrame(animar);
        }
      };
      requestAnimationFrame(animar);
    }

    var sinFallos =
      estado.evaluacion && estado.evaluacion.fallos.length === 0;
    var pct = estado.evaluacion
      ? Math.round(estado.evaluacion.razonMargen * 100)
      : 0;
    fijarMensaje(
      'La línea punteada burdeos es la solución del SVM y los puntos con ' +
        'anillo son sus vectores de soporte. ' +
        (sinFallos
          ? 'Tu margen alcanzó el ' + pct + '% del óptimo.'
          : 'Observa cómo maximiza la distancia hacia ambas clases.'),
      'info'
    );
  }

  // Activación (evita capturar el scroll táctil sin intención de jugar) ----------
  function activar() {
    estado.activo = true;
    overlay.hidden = true;
    canvas.style.touchAction = 'none';
    if (!estado.lineaJugador) {
      fijarMensaje('Arrastra sobre el plano para trazar tu línea separadora.', null);
    }
  }

  function desactivar() {
    if (!estado.activo) {
      return;
    }
    estado.activo = false;
    overlay.hidden = false;
    canvas.style.touchAction = 'pan-y';
    btnJugar.textContent = 'Seguir jugando';
  }

  btnJugar.addEventListener('click', activar);

  // Al salir la sección del viewport, se vuelve a mostrar el overlay para que
  // el tablero no atrape el scroll en la siguiente pasada.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) {
          desactivar();
        }
      });
    }).observe(canvas);
  }

  // Interacción con el puntero -----------------------------------------------------
  var inicioArrastre = null;

  function posicionPuntero(evento) {
    var caja = canvas.getBoundingClientRect();
    return { px: evento.clientX - caja.left, py: evento.clientY - caja.top };
  }

  canvas.addEventListener('pointerdown', function (evento) {
    if (!estado.activo) {
      return;
    }
    evento.preventDefault();
    try {
      canvas.setPointerCapture(evento.pointerId);
    } catch (e) {
      // sin captura el arrastre funciona igual dentro del lienzo
    }
    var pos = posicionPuntero(evento);
    inicioArrastre = aMundo(pos.px, pos.py);
  });

  canvas.addEventListener('pointermove', function (evento) {
    if (!inicioArrastre) {
      return;
    }
    var pos = posicionPuntero(evento);
    dibujar({ a: inicioArrastre, b: aMundo(pos.px, pos.py) });
  });

  canvas.addEventListener('pointerup', function (evento) {
    if (!inicioArrastre) {
      return;
    }
    var pos = posicionPuntero(evento);
    var fin = aMundo(pos.px, pos.py);
    var dir = resta(fin, inicioArrastre);

    if (modulo(dir) < 0.4) {
      inicioArrastre = null;
      dibujar();
      return; // arrastre demasiado corto: se ignora
    }

    estado.lineaJugador = {
      q: inicioArrastre,
      n: unitario({ x: -dir.y, y: dir.x })
    };
    inicioArrastre = null;
    evaluarLinea();
    dibujar();
  });

  canvas.addEventListener('pointercancel', function () {
    inicioArrastre = null;
    dibujar();
  });

  btnSvm.addEventListener('click', revelarSvm);
  btnNueva.addEventListener('click', nuevaRonda);

  if ('ResizeObserver' in window) {
    new ResizeObserver(redimensionar).observe(canvas.parentElement);
  } else {
    window.addEventListener('resize', redimensionar);
  }

  nuevaRonda();
  redimensionar();
});
