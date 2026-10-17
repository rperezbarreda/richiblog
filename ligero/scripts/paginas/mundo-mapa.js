/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/mundo-mapa.js
*/
const ZOOMS_DE_MAPA = [1, 1.5, 2, 3, 4, 6];
const ZOOM_MAXIMO_DE_MAPA = 6;
const PIN_EN_PANTALLA = 15;
initializeMundoMapa();
function initializeMundoMapa() {
    const caja = document.querySelector("[data-mapa]");
    const lienzo = caja && caja.querySelector("[data-mapa-lienzo]");
    const dibujo = lienzo && lienzo.querySelector(".mapa-svg");
    if (!caja || !lienzo || !dibujo) {
        return;
    }
    const mando = {
        caja: caja,
        lienzo: lienzo,
        dibujo: dibujo,
        zoom: 1,
        cifra: caja.querySelector("[data-mapa-cifra]"),
        mas: caja.querySelector("[data-mapa-mas]"),
        menos: caja.querySelector("[data-mapa-menos]"),
        ajustar: caja.querySelector("[data-mapa-ajustar]"),
    };
    if (mando.mas) {
        mando.mas.addEventListener("click", () => moverZoomDeMapa(mando, 1));
    }
    if (mando.menos) {
        mando.menos.addEventListener("click", () => moverZoomDeMapa(mando, -1));
    }
    if (mando.ajustar) {
        mando.ajustar.addEventListener("click", () => ponerZoomDeMapa(mando, 1));
    }
    lienzo.addEventListener("wheel", (evento) => {
        if (evento.shiftKey) {
            return;
        }
        const cuanto = ruedaDeMapa(evento);
        if (cuanto > 0 && mando.zoom <= 1.0005) {
            return;
        }
        evento.preventDefault();
        const paso = Math.max(0.5, Math.min(2, Math.exp(-cuanto / 500)));
        ponerZoomDeMapa(mando, mando.zoom * paso, evento.clientX, evento.clientY);
    }, { passive: false });
    lienzo.addEventListener("keydown", (evento) => {
        if (evento.ctrlKey || evento.metaKey || evento.altKey) {
            return;
        }
        if (evento.key === "+" || evento.key === "=") {
            evento.preventDefault();
            moverZoomDeMapa(mando, 1);
        } else if (evento.key === "-" || evento.key === "_") {
            evento.preventDefault();
            moverZoomDeMapa(mando, -1);
        } else if (evento.key === "0") {
            evento.preventDefault();
            ponerZoomDeMapa(mando, 1);
        }
    });
    window.addEventListener("resize", () => {
        escalarPinesDeMapa(mando);
        mejorarImagenDeMapa(mando);
        pintarEscalaDeMapa(mando);
    });
    prepararArrastreDeMapa(mando);
    prepararCapasDeMapa(caja);
    mejorarImagenDeMapa(mando);
    prepararRegionesDeMapa(caja);
    prepararGloboDeMapa(mando);
    prepararSitiosDeMapa();
    prepararEscalaDeMapa(mando);
    prepararMedirDeMapa(mando);
    ponerZoomDeMapa(mando, 1);
}
function ruedaDeMapa(evento) {
    const cuanto = evento.deltaY || 0;
    if (evento.deltaMode === 1) {
        return cuanto * 16;
    }
    if (evento.deltaMode === 2) {
        return cuanto * 400;
    }
    return cuanto;
}
function moverZoomDeMapa(mando, hacia) {
    const ahora = mando.zoom || 1;
    let destino;
    if (hacia > 0) {
        destino = ZOOMS_DE_MAPA.find((z) => z > ahora + 0.001);
        if (destino === undefined) {
            destino = ZOOM_MAXIMO_DE_MAPA;
        }
    } else {
        const menores = ZOOMS_DE_MAPA.filter((z) => z < ahora - 0.001);
        destino = menores.length ? menores[menores.length - 1] : 1;
    }
    ponerZoomDeMapa(mando, destino);
}
function ponerZoomDeMapa(mando, quiere, anclaX, anclaY) {
    const lienzo = mando.lienzo;
    const antes = mando.zoom || 1;
    const ahora = Math.max(1, Math.min(ZOOM_MAXIMO_DE_MAPA, quiere || 1));
    const caja = lienzo.getBoundingClientRect();
    const haciaX = anclaX === undefined ? lienzo.clientWidth / 2 : anclaX - caja.left;
    const haciaY = anclaY === undefined ? lienzo.clientHeight / 2 : anclaY - caja.top;
    const puntoX = lienzo.scrollLeft + haciaX;
    const puntoY = lienzo.scrollTop + haciaY;
    mando.zoom = ahora;
    lienzo.style.setProperty("--mapa-zoom", ahora);
    lienzo.classList.toggle("se-puede-arrastrar", ahora > 1.0005);
    lienzo.classList.toggle("esta-cerca", ahora >= 1.995);
    if (Math.abs(ahora - antes) > 0.0005) {
        const cuanto = ahora / antes;
        lienzo.scrollLeft = puntoX * cuanto - haciaX;
        lienzo.scrollTop = puntoY * cuanto - haciaY;
    }
    escalarPinesDeMapa(mando);
    mejorarImagenDeMapa(mando);
    pintarEscalaDeMapa(mando);
    if (mando.cifra) {
        mando.cifra.textContent = Math.round(ahora * 100) + "%";
    }
    const abajo = ahora <= 1.0005;
    if (mando.menos) {
        mando.menos.disabled = abajo;
    }
    if (mando.mas) {
        mando.mas.disabled = ahora >= ZOOM_MAXIMO_DE_MAPA - 0.0005;
    }
    if (mando.ajustar) {
        mando.ajustar.disabled = abajo;
    }
}
function prepararArrastreDeMapa(mando) {
    const lienzo = mando.lienzo;
    let arrastre = null;
    let comerElClic = false;
    lienzo.addEventListener("dragstart", (evento) => evento.preventDefault());
    lienzo.addEventListener("pointerdown", (evento) => {
        if (evento.pointerType !== "mouse" || evento.button !== 0) {
            return;
        }
        arrastre = {
            id: evento.pointerId,
            x: evento.clientX,
            y: evento.clientY,
            desdeX: lienzo.scrollLeft,
            desdeY: lienzo.scrollTop,
            movido: false,
        };
    });
    lienzo.addEventListener("pointermove", (evento) => {
        if (!arrastre || evento.pointerId !== arrastre.id) {
            return;
        }
        const vaX = evento.clientX - arrastre.x;
        const vaY = evento.clientY - arrastre.y;
        if (!arrastre.movido && Math.abs(vaX) + Math.abs(vaY) < 6) {
            return;
        }
        if (!arrastre.movido) {
            arrastre.movido = true;
            lienzo.classList.add("esta-arrastrando");
            if (mando.globo) {
                mando.globo.hidden = true;
            }
            try {
                lienzo.setPointerCapture(arrastre.id);
            } catch (error) {
            }
        }
        lienzo.scrollLeft = arrastre.desdeX - vaX;
        lienzo.scrollTop = arrastre.desdeY - vaY;
        evento.preventDefault();
    });
    const soltar = () => {
        if (arrastre && arrastre.movido) {
            comerElClic = true;
        }
        arrastre = null;
        lienzo.classList.remove("esta-arrastrando");
    };
    lienzo.addEventListener("pointerup", soltar);
    lienzo.addEventListener("pointercancel", soltar);
    window.addEventListener("blur", soltar);
    lienzo.addEventListener("click", (evento) => {
        if (comerElClic) {
            comerElClic = false;
            evento.preventDefault();
            evento.stopPropagation();
        }
    }, true);
}
function prepararCapasDeMapa(caja) {
    caja.querySelectorAll("[data-mapa-capa-casilla]").forEach((casilla) => {
        const cual = casilla.getAttribute("data-mapa-capa-casilla");
        casilla.addEventListener("change", () => {
            caja.querySelectorAll("[data-mapa-capa]").forEach((capa) => {
                if (capa.getAttribute("data-mapa-capa") === cual) {
                    capa.classList.toggle("es-apagada", !casilla.checked);
                }
            });
        });
    });
}
function prepararRegionesDeMapa(caja) {
    apagarConCasilla(caja, "[data-mapa-regiones]", ".mapa-dibujos, .mapa-formas");
    apagarConCasilla(caja, "[data-mapa-pines]", ".mapa-pines");
    apagarConCasilla(caja, "[data-mapa-lineas]", ".mapa-lineas");
    apagarConCasilla(caja, "[data-mapa-nombres]", ".mapa-pin-nombre, .mapa-textos");
    prepararNivelesDeMapa(caja);
}
function prepararNivelesDeMapa(caja) {
    const casillas = [...caja.querySelectorAll("[data-mapa-nivel-casilla]")];
    const regiones = caja.querySelector('[data-mapa-nivel="regiones"]');
    const paises = caja.querySelector('[data-mapa-nivel="paises"]');
    const dibujos = caja.querySelector(".mapa-dibujos");
    if (!casillas.length || !regiones || !paises) {
        return;
    }
    const aplicar = () => {
        const marcada = casillas.find((c) => c.checked);
        const cual = marcada ? marcada.value : "paises";
        regiones.classList.toggle("es-apagada", cual !== "regiones" && cual !== "todo");
        paises.classList.toggle("es-apagada", cual === "nada");
        paises.classList.toggle("es-solo-sueltos", cual === "regiones");
        if (dibujos) {
            dibujos.classList.toggle("es-apagada", cual === "nada");
        }
    };
    casillas.forEach((casilla) => casilla.addEventListener("change", aplicar));
    aplicar();
}
function apagarConCasilla(caja, cual, selector) {
    const casilla = caja.querySelector(cual);
    if (!casilla) {
        return;
    }
    const capas = [...caja.querySelectorAll(selector)];
    casilla.addEventListener("change", () => {
        capas.forEach((capa) => capa.classList.toggle("es-apagada", !casilla.checked));
    });
}
function escalarPinesDeMapa(mando) {
    const dibujo = mando.caja.querySelector(".mapa-svg");
    if (!dibujo) {
        return;
    }
    const grupo = mando.caja.querySelector(".mapa-pines");
    const radio = parseFloat(dibujo.getAttribute("data-mapa-radio")
        || (grupo && grupo.getAttribute("data-mapa-radio"))) || 0;
    const caja = dibujo.getBoundingClientRect();
    const lados = (dibujo.getAttribute("viewBox") || "").split(/[\s,]+/);
    const ancho = parseFloat(lados[2]);
    const alto = parseFloat(lados[3]);
    if (!radio || !ancho || !alto || !caja.width) {
        return;
    }
    const anchoReal = Math.min(caja.width, caja.height * (ancho / alto));
    const porUnidad = anchoReal / ancho;
    const cuanto = Math.max(0.15, Math.min(8, PIN_EN_PANTALLA / (radio * porUnidad)));
    dibujo.querySelectorAll("[data-mapa-xy]").forEach((pin) => {
        const sitio = pin.getAttribute("data-mapa-xy");
        const giro = pin.getAttribute("data-mapa-giro");
        pin.setAttribute("transform", "translate(" + sitio + ")" + (giro ? " rotate(" + giro + ")" : "")
            + " scale(" + cuanto.toFixed(3) + ")");
    });
}
function prepararGloboDeMapa(mando) {
    const dibujo = mando.caja.querySelector(".mapa-svg");
    if (!dibujo) {
        return;
    }
    dibujo.querySelectorAll("title").forEach((viejo) => viejo.remove());
    const globo = document.createElement("div");
    globo.className = "mapa-globo";
    globo.setAttribute("aria-hidden", "true");
    globo.hidden = true;
    mando.caja.appendChild(globo);
    mando.globo = globo;
    const quien = (evento) => {
        const donde = evento.target;
        return donde && donde.closest ? donde.closest("[data-mapa-sitio]") : null;
    };
    dibujo.addEventListener("mouseover", (evento) => {
        const sitio = quien(evento);
        if (!sitio) {
            return;
        }
        llenarGloboDeMapa(globo, sitio);
        globo.hidden = false;
        moverGloboDeMapa(mando, evento.clientX, evento.clientY);
    });
    dibujo.addEventListener("mousemove", (evento) => {
        if (!globo.hidden) {
            moverGloboDeMapa(mando, evento.clientX, evento.clientY);
        }
    });
    dibujo.addEventListener("mouseout", (evento) => {
        const va = evento.relatedTarget;
        if (va && va.closest && va.closest("[data-mapa-sitio]") === quien(evento)) {
            return;
        }
        globo.hidden = true;
    });
    mando.lienzo.addEventListener("mouseleave", () => { globo.hidden = true; });
    mando.lienzo.addEventListener("wheel", () => { globo.hidden = true; }, { passive: true });
    window.addEventListener("scroll", () => { globo.hidden = true; }, { passive: true });
}
function llenarGloboDeMapa(globo, sitio) {
    globo.textContent = "";
    const bandera = banderaSeguraDeMapa(sitio.getAttribute("data-mapa-bandera"));
    if (bandera) {
        const img = document.createElement("img");
        img.className = "mapa-globo-bandera";
        img.src = bandera;
        img.alt = "";
        img.width = 120;
        img.height = 80;
        globo.appendChild(img);
    }
    const icono = sitio.getAttribute("data-mapa-icono");
    if (icono) {
        const trozo = document.createElement("span");
        trozo.className = "mapa-globo-icono";
        trozo.textContent = icono;
        globo.appendChild(trozo);
    }
    const nombre = document.createElement("strong");
    nombre.className = "mapa-globo-nombre";
    nombre.textContent = sitio.getAttribute("data-mapa-nombre") || "";
    globo.appendChild(nombre);
    const que = sitio.getAttribute("data-mapa-que");
    if (que) {
        const linea = document.createElement("span");
        linea.className = "mapa-globo-que";
        linea.textContent = que;
        globo.appendChild(linea);
    }
}
function banderaSeguraDeMapa(url) {
    const limpia = (url || "").toString().trim();
    return /^\/(?!\/)/.test(limpia) ? limpia : "";
}
function moverGloboDeMapa(mando, x, y) {
    const globo = mando.globo;
    const caja = mando.caja.getBoundingClientRect();
    const suyo = globo.getBoundingClientRect();
    let izquierda = x - caja.left + 16;
    let arriba = y - caja.top + 18;
    if (izquierda + suyo.width > caja.width - 6) {
        izquierda = Math.max(6, x - caja.left - suyo.width - 12);
    }
    if (arriba + suyo.height > caja.height - 6) {
        arriba = Math.max(6, y - caja.top - suyo.height - 12);
    }
    globo.style.left = Math.round(izquierda) + "px";
    globo.style.top = Math.round(arriba) + "px";
}
function prepararSitiosDeMapa() {
    const lista = document.querySelector(".mapa-sitios");
    const dibujo = document.querySelector(".mapa-svg");
    if (!lista || !dibujo) {
        return;
    }
    const mirar = (evento, si) => {
        const fila = evento.target.closest ? evento.target.closest("[data-mapa-sitio]") : null;
        if (!fila) {
            return;
        }
        const cual = fila.getAttribute("data-mapa-sitio");
        dibujo.querySelectorAll("[data-mapa-sitio]").forEach((forma) => {
            if (forma.getAttribute("data-mapa-sitio") === cual) {
                forma.classList.toggle("esta-mirado", si);
            }
        });
    };
    lista.addEventListener("mouseover", (evento) => mirar(evento, true));
    lista.addEventListener("mouseout", (evento) => mirar(evento, false));
    lista.addEventListener("focusin", (evento) => mirar(evento, true));
    lista.addEventListener("focusout", (evento) => mirar(evento, false));
}
function mejorarImagenDeMapa(mando) {
    const pide = mando.lienzo.clientWidth * (mando.zoom || 1) * (window.devicePixelRatio || 1);
    mando.lienzo.querySelectorAll(".mapa-capa-img[data-mapa-grande]").forEach((imagen) => {
        if (imagen.dataset.mapaCambiando || pide <= 1280 * 1.15) {
            return;
        }
        const grande = banderaSeguraDeMapa(imagen.getAttribute("data-mapa-grande"));
        if (!grande) {
            return;
        }
        imagen.dataset.mapaCambiando = "1";
        const antes = new Image();
        antes.onload = () => {
            imagen.setAttribute("href", grande);
            imagen.removeAttribute("data-mapa-grande");
        };
        antes.onerror = () => {
            delete imagen.dataset.mapaCambiando;
        };
        antes.src = grande;
    });
}
function escalaDelMapa(mando) {
    const d = mando.dibujo;
    const px = parseFloat(d.getAttribute("data-mapa-escala-px"));
    const distancia = parseFloat(d.getAttribute("data-mapa-escala-distancia"));
    if (!px || !distancia) {
        return null;
    }
    let viaje = {};
    try {
        viaje = JSON.parse(d.getAttribute("data-mapa-viaje") || "{}") || {};
    } catch (error) {
        viaje = {};
    }
    return { porPixel: distancia / px, unidad: d.getAttribute("data-mapa-escala-unidad") || "", viaje };
}
function cifraDeMapa(n) {
    return Number(n).toLocaleString("es-ES", { maximumFractionDigits: 1 });
}
function pantallaPorUnidadDeMapa(mando) {
    const d = mando.dibujo;
    const caja = d.getBoundingClientRect();
    const lados = (d.getAttribute("viewBox") || "").split(/[\s,]+/);
    const ancho = parseFloat(lados[2]);
    const alto = parseFloat(lados[3]);
    if (!ancho || !alto || !caja.width) {
        return 0;
    }
    return Math.min(caja.width, caja.height * (ancho / alto)) / ancho;
}
function svgDeMapa(etiqueta, atributos) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", etiqueta);
    Object.keys(atributos || {}).forEach((k) => el.setAttribute(k, String(atributos[k])));
    return el;
}
function prepararEscalaDeMapa(mando) {
    mando.escala = escalaDelMapa(mando);
    if (!mando.escala) {
        return;
    }
    mando.caja.classList.add("tiene-escala-viva");
    const barra = document.createElement("div");
    barra.className = "mapa-escala-viva";
    barra.setAttribute("aria-hidden", "true");
    mando.caja.appendChild(barra);
    mando.barraDeEscala = barra;
}
function pintarEscalaDeMapa(mando) {
    const barra = mando.barraDeEscala;
    const escala = mando.escala;
    if (!barra || !escala) {
        return;
    }
    const porUnidad = pantallaPorUnidadDeMapa(mando);
    if (!porUnidad) {
        return;
    }
    const porPantalla = escala.porPixel / porUnidad;
    const deseado = 180 * porPantalla;
    const potencia = Math.pow(10, Math.floor(Math.log10(deseado)));
    const valor = [5, 2, 1].map((m) => m * potencia).find((v) => v <= deseado);
    const largo = valor / porPantalla;
    const margen = 12;
    const unidad = escala.unidad ? " " + escala.unidad : "";
    const ancho = largo + margen * 2 + 10 + unidad.length * 8;
    const svg = svgDeMapa("svg", { width: Math.ceil(ancho), height: 52, viewBox: "0 0 " + Math.ceil(ancho) + " 52" });
    const y = 30;
    const alto = 8;
    for (let i = 0; i < 4; i++) {
        svg.appendChild(svgDeMapa("rect", {
            x: margen + largo * i / 4, y, width: largo / 4, height: alto,
            class: i % 2 ? "mapa-escala-tramo es-oscuro" : "mapa-escala-tramo",
        }));
    }
    svg.appendChild(svgDeMapa("rect", { x: margen, y, width: largo, height: alto, class: "mapa-escala-borde" }));
    [0, 1, 2, 3, 4].forEach((i) => {
        const x = margen + largo * i / 4;
        const larga = i % 2 === 0;
        svg.appendChild(svgDeMapa("line", {
            x1: x, x2: x, y1: y - (larga ? 8 : 4), y2: y + alto, class: "mapa-escala-raya",
        }));
    });
    [[0, "0"], [2, cifraDeMapa(valor / 2)], [4, cifraDeMapa(valor)]].forEach(([i, texto]) => {
        const letrero = svgDeMapa("text", {
            x: margen + largo * i / 4, y: y - 11, class: "mapa-escala-letra", "text-anchor": "middle",
        });
        letrero.textContent = texto;
        svg.appendChild(letrero);
    });
    if (unidad) {
        const letrero = svgDeMapa("text", { x: margen + largo + 8, y: y + alto, class: "mapa-escala-letra" });
        letrero.textContent = unidad.trim();
        svg.appendChild(letrero);
    }
    barra.replaceChildren(svg);
}
function diasDeViajeDeMapa(distancia, porDia) {
    const dias = distancia / porDia;
    if (dias < 1) {
        const horas = Math.max(1, Math.round(dias * 8));
        return horas === 1 ? "una hora" : "unas " + horas + " horas";
    }
    const medios = Math.round(dias * 2) / 2;
    const enteros = Math.floor(medios);
    const conMedio = medios !== enteros;
    if (enteros === 1) {
        return conMedio ? "un día y medio" : "un día";
    }
    return enteros + (conMedio ? " días y medio" : " días");
}
function prepararMedirDeMapa(mando) {
    const boton = mando.caja.querySelector("[data-mapa-medir]");
    const borrar = mando.caja.querySelector("[data-mapa-medir-borrar]");
    const salida = mando.caja.querySelector("[data-mapa-medida]");
    if (!boton || !mando.escala) {
        return;
    }
    boton.hidden = false;
    borrar.hidden = false;
    mando.caja.appendChild(salida);
    salida.classList.add("es-encima");
    const medida = { activa: false, puntos: [], grupo: null };
    const radio = parseFloat(mando.dibujo.getAttribute("data-mapa-radio")) || 10;
    const pintar = () => {
        if (medida.grupo) {
            medida.grupo.remove();
            medida.grupo = null;
        }
        borrar.disabled = !medida.puntos.length;
        if (!medida.puntos.length) {
            salida.textContent = medida.activa ? "Pulsa en el mapa de un sitio a otro." : "";
            return;
        }
        const grupo = svgDeMapa("g", { class: "mapa-medida-dibujo" });
        const d = medida.puntos.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join("");
        grupo.appendChild(svgDeMapa("path", { d, class: "mapa-medida-borde" }));
        grupo.appendChild(svgDeMapa("path", { d, class: "mapa-medida-raya" }));
        medida.puntos.forEach((p) => {
            const xy = p.x.toFixed(1) + "," + p.y.toFixed(1);
            const punto = svgDeMapa("circle", { r: (radio * 0.4).toFixed(1), class: "mapa-medida-punto",
                "data-mapa-xy": xy, transform: "translate(" + xy + ")" });
            grupo.appendChild(punto);
        });
        mando.dibujo.appendChild(grupo);
        medida.grupo = grupo;
        escalarPinesDeMapa(mando);
        let pixeles = 0;
        for (let i = 1; i < medida.puntos.length; i++) {
            pixeles += Math.hypot(medida.puntos[i].x - medida.puntos[i - 1].x, medida.puntos[i].y - medida.puntos[i - 1].y);
        }
        if (medida.puntos.length < 2) {
            salida.textContent = "Ahora pulsa en el siguiente punto.";
            return;
        }
        const e = mando.escala;
        const distancia = pixeles * e.porPixel;
        let texto = "Distancia: " + cifraDeMapa(distancia) + (e.unidad ? " " + e.unidad : "");
        const viaje = Object.keys(e.viaje).filter((como) => e.viaje[como] > 0);
        if (viaje.length) {
            texto += ". " + viaje.map((como) => como.charAt(0).toUpperCase() + como.slice(1) + ": "
                + diasDeViajeDeMapa(distancia, e.viaje[como])).join(" · ");
        }
        salida.textContent = texto + ".";
    };
    const activar = (si) => {
        medida.activa = si;
        boton.setAttribute("aria-pressed", si ? "true" : "false");
        mando.lienzo.classList.toggle("esta-midiendo", si);
        if (mando.globo) {
            mando.globo.hidden = true;
        }
        pintar();
    };
    boton.addEventListener("click", () => activar(!medida.activa));
    borrar.addEventListener("click", () => {
        medida.puntos = [];
        pintar();
    });
    mando.lienzo.addEventListener("click", (evento) => {
        if (!medida.activa) {
            return;
        }
        evento.preventDefault();
        evento.stopPropagation();
        const matriz = mando.dibujo.getScreenCTM();
        if (!matriz) {
            return;
        }
        const punto = mando.dibujo.createSVGPoint();
        punto.x = evento.clientX;
        punto.y = evento.clientY;
        const p = punto.matrixTransform(matriz.inverse());
        medida.puntos.push({ x: p.x, y: p.y });
        pintar();
    }, true);
    mando.lienzo.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && medida.activa) {
            activar(false);
        }
    });
}
