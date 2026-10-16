/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/componentes/ajustes.js
*/
const AJUSTES_TAMANOS = [0.9, 1, 1.15, 1.3, 1.5];
const AJUSTES_GUARDADO_TAMANO = "richi-texto";
const AJUSTES_GUARDADO_INTERLINEADO = "richi-interlineado";
const AJUSTES_GUARDADO_LETRA = "richi-letra";
const AJUSTES_GUARDADO_CRT = "richi-crt";
const AJUSTES_GUARDADO_VOZ = "richi-voz";
const AJUSTES_GUARDADO_MOVIMIENTO = "richi-movimiento";
const AJUSTES = {
    ventana: null,
    abrir: null,
    rango: null,
    paso: 1,
    avisoReloj: 0,
};
document.addEventListener("sidebar:loaded", initializeAjustes);
if (!document.getElementById("sidebar-container")) {
    document.addEventListener("DOMContentLoaded", () => {
        initializeAjustes();
        if (typeof initializeThemeToggle === "function") {
            initializeThemeToggle();
        }
        if (typeof initializeCursorTrailToggle === "function") {
            initializeCursorTrailToggle();
        }
    });
}
document.addEventListener("ajustes:actualizar", () => {
    if (AJUSTES.ventana) {
        pintarAjustesOpciones();
    }
});
function initializeAjustes() {
    const ventana = document.querySelector("[data-ajustes]");
    const abrir = document.querySelector("[data-ajustes-abrir]");
    if (!ventana || !abrir || AJUSTES.ventana) {
        return;
    }
    AJUSTES.ventana = ventana;
    AJUSTES.abrir = abrir;
    armarAjustesPanel(ventana);
    abrir.addEventListener("click", abrirAjustes);
    const cerrar = ventana.querySelector("[data-ajustes-cerrar]");
    if (cerrar) {
        cerrar.addEventListener("click", cerrarAjustes);
    }
    ventana.addEventListener("click", (evento) => {
        if (evento.target !== ventana) {
            return;
        }
        const caja = ventana.getBoundingClientRect();
        const dentro =
            evento.clientX >= caja.left && evento.clientX <= caja.right &&
            evento.clientY >= caja.top && evento.clientY <= caja.bottom;
        if (!dentro) {
            cerrarAjustes();
        }
    });
    AJUSTES.rango = ventana.querySelector("[data-tamano-rango]");
    AJUSTES.paso = pasoDeAjustes(leerAjuste(AJUSTES_GUARDADO_TAMANO, NaN, true));
    if (AJUSTES.rango) {
        AJUSTES.rango.addEventListener("input", () => {
            aplicarAjustesTamano(Number(AJUSTES.rango.value), true);
        });
    }
    aplicarAjustesTamano(AJUSTES.paso, false);
    engancharAjustesOpciones("interlineado");
    engancharAjustesOpciones("letra");
    engancharAjustesOpciones("voz");
    engancharAjustesOpciones("movimiento");
    pintarAjustesOpciones();
    const reiniciar = ventana.querySelector("[data-ajustes-reiniciar]");
    if (reiniciar) {
        reiniciar.addEventListener("click", reiniciarAjustes);
    }
    const crt = ventana.querySelector("[data-crt-boton]");
    if (crt) {
        crt.addEventListener("click", () => {
            ponerAjustesCrt(document.documentElement.dataset.crt !== "si", true);
        });
        pintarAjustesCrt();
    }
}
function abrirAjustes() {
    if (AJUSTES.ventana.open) {
        return;
    }
    if (typeof AJUSTES.ventana.showModal === "function") {
        AJUSTES.ventana.showModal();
        return;
    }
    AJUSTES.ventana.setAttribute("open", "");
    AJUSTES.ventana.classList.add("ajustes-a-mano");
    document.addEventListener("keydown", cerrarAjustesConEscape);
}
function cerrarAjustesConEscape(evento) {
    if (evento.key === "Escape" || evento.key === "Esc") {
        cerrarAjustes();
    }
}
function cerrarAjustes() {
    const ventana = AJUSTES.ventana;
    if (!ventana) {
        return;
    }
    if (typeof ventana.close === "function") {
        ventana.close();
    } else {
        ventana.removeAttribute("open");
    }
    ventana.classList.remove("ajustes-a-mano");
    document.removeEventListener("keydown", cerrarAjustesConEscape);
    if (AJUSTES.abrir && typeof ventana.close !== "function") {
        AJUSTES.abrir.focus();
    }
}
function armarAjustesPanel(ventana) {
    const cuerpo = ventana.querySelector(".ajustes-cuerpo");
    if (!cuerpo) {
        return;
    }
    let lista = cuerpo.querySelector(".ajustes-lista");
    if (!lista) {
        lista = document.createElement("div");
        lista.className = "ajustes-lista";
        const filas = cuerpo.querySelectorAll(":scope > .ajustes-fila");
        if (!filas.length) {
            return;
        }
        cuerpo.insertBefore(lista, filas[0]);
        filas.forEach((fila) => lista.appendChild(fila));
    }
    arreglarAjustesCrt(lista);
    if (!lista.querySelector("[data-movimiento]")) {
        lista.appendChild(armarAjustesMovimiento());
    }
    cuerpo.querySelectorAll(".ajustes-lado, .ajustes-ejemplo, .ajustes-pie")
        .forEach((viejo) => viejo.remove());
    const lado = document.createElement("div");
    lado.className = "ajustes-lado";
    lado.appendChild(armarAjustesEjemplo());
    const viejoReiniciar = cuerpo.querySelector("[data-ajustes-reiniciar]");
    if (viejoReiniciar) {
        const fila = viejoReiniciar.closest(".ajustes-fila") || viejoReiniciar;
        fila.remove();
    }
    lado.appendChild(armarAjustesReiniciar());
    lado.appendChild(armarAjustesPie());
    cuerpo.appendChild(lado);
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
}
function arreglarAjustesCrt(lista) {
    const boton = lista.querySelector("[data-crt-boton]");
    if (!boton || boton.querySelector("[data-crt-estado]")) {
        return;
    }
    let texto = boton.querySelector(".ajustes-crt-texto");
    if (!texto) {
        texto = document.createElement("span");
        texto.className = "ajustes-crt-texto";
        boton.appendChild(texto);
    }
    texto.textContent = "FILTRO ";
    const sigla = document.createElement("abbr");
    sigla.title =
        "Cathode Ray Tube: los monitores de tubo de antes, con sus rayas " +
        "y las esquinas apagadas";
    sigla.textContent = "CRT";
    texto.appendChild(sigla);
    texto.appendChild(document.createTextNode(": "));
    const estado = document.createElement("span");
    estado.setAttribute("data-crt-estado", "");
    estado.textContent = "OFF";
    texto.appendChild(estado);
}
function armarAjustesMovimiento() {
    const fila = document.createElement("div");
    fila.className = "ajustes-fila";
    const nombre = document.createElement("p");
    nombre.className = "ajustes-nombre";
    nombre.id = "ajustes-movimiento-nombre";
    nombre.textContent = "animaciones";
    fila.appendChild(nombre);
    const mandos = document.createElement("div");
    mandos.className = "ajustes-mandos";
    mandos.setAttribute("role", "group");
    mandos.setAttribute("aria-labelledby", nombre.id);
    [
        ["", "normal"],
        ["quieto", "sin animaciones"],
    ].forEach(([valor, etiqueta]) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "ajustes-opcion";
        boton.setAttribute("data-movimiento", valor);
        boton.setAttribute("aria-pressed", "false");
        boton.textContent = etiqueta;
        mandos.appendChild(boton);
    });
    fila.appendChild(mandos);
    return fila;
}
const AJUSTES_CARACTERES =
    "abc def ghi jkl mno pqrs tuv wxyz " +
    "ABC DEF GHI JKL MNO PQRS TUV WXYZ " +
    "0123456789 !\"§ $%& /() =?* '<> #|; ²³~ @`´ ©«» ¤¼× {}";
function armarAjustesEjemplo() {
    const caja = document.createElement("div");
    caja.className = "ajustes-ejemplo";
    const barra = document.createElement("div");
    barra.className = "recent-entries-header";
    const titulo = document.createElement("h2");
    titulo.textContent = "ejemplo.txt";
    const mandos = document.createElement("div");
    mandos.className = "window-controls window-controls-small";
    mandos.setAttribute("data-window-controls", "");
    mandos.setAttribute("aria-hidden", "true");
    barra.appendChild(titulo);
    barra.appendChild(mandos);
    caja.appendChild(barra);
    const dentro = document.createElement("div");
    dentro.className = "ajustes-ejemplo-cuerpo";
    dentro.setAttribute("aria-hidden", "true");
    const como = document.createElement("p");
    como.className = "ajustes-ejemplo-titulo";
    como.textContent = "así se va a ver";
    dentro.appendChild(como);
    const texto = document.createElement("p");
    texto.className = "ajustes-ejemplo-texto";
    texto.appendChild(document.createTextNode("«El veloz murciélago hindú comía feliz cardillo y kiwi.» Esto va en "));
    const negrita = document.createElement("strong");
    negrita.textContent = "negrita";
    texto.appendChild(negrita);
    texto.appendChild(document.createTextNode(", esto en "));
    const cursiva = document.createElement("em");
    cursiva.textContent = "cursiva";
    texto.appendChild(cursiva);
    texto.appendChild(document.createTextNode(" y esto es "));
    const enlace = document.createElement("span");
    enlace.className = "ajustes-ejemplo-enlace";
    enlace.textContent = "un enlace";
    texto.appendChild(enlace);
    texto.appendChild(document.createTextNode("."));
    dentro.appendChild(texto);
    const letras = document.createElement("p");
    letras.className = "ajustes-ejemplo-letras";
    letras.textContent = AJUSTES_CARACTERES;
    dentro.appendChild(letras);
    const letrasMono = document.createElement("p");
    letrasMono.className = "ajustes-ejemplo-letras ajustes-ejemplo-letras-mono";
    letrasMono.textContent = AJUSTES_CARACTERES;
    dentro.appendChild(letrasMono);
    const botones = document.createElement("p");
    botones.className = "ajustes-ejemplo-botones";
    const macizo = document.createElement("span");
    macizo.className = "ajustes-ejemplo-boton ajustes-ejemplo-boton-macizo";
    macizo.textContent = "botón macizo";
    const hueco = document.createElement("span");
    hueco.className = "ajustes-ejemplo-boton";
    hueco.textContent = "botón hueco";
    botones.appendChild(macizo);
    botones.appendChild(hueco);
    dentro.appendChild(botones);
    const datos = document.createElement("p");
    datos.className = "ajustes-ejemplo-datos";
    datos.appendChild(document.createTextNode("28 sept 2026 · 3 min · "));
    const etiqueta = document.createElement("span");
    etiqueta.className = "entry-tag";
    etiqueta.textContent = "diario";
    datos.appendChild(etiqueta);
    dentro.appendChild(datos);
    caja.appendChild(dentro);
    return caja;
}
function armarAjustesReiniciar() {
    const fila = document.createElement("div");
    fila.className = "ajustes-fila ajustes-fila-reiniciar";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "ajustes-reiniciar";
    boton.setAttribute("data-ajustes-reiniciar", "");
    const icono = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icono.setAttribute("class", "ajustes-reiniciar-icono");
    icono.setAttribute("viewBox", "0 0 24 24");
    icono.setAttribute("aria-hidden", "true");
    icono.setAttribute("focusable", "false");
    [
        "M4.5 10.5A8 8 0 1 1 5.6 16",
        "M3.4 4.6v6h6",
    ].forEach((d) => {
        const trazo = document.createElementNS("http://www.w3.org/2000/svg", "path");
        trazo.setAttribute("d", d);
        trazo.setAttribute("fill", "none");
        trazo.setAttribute("stroke", "currentColor");
        trazo.setAttribute("stroke-width", "2.4");
        trazo.setAttribute("stroke-linecap", "round");
        trazo.setAttribute("stroke-linejoin", "round");
        icono.appendChild(trazo);
    });
    boton.appendChild(icono);
    const nombre = document.createElement("span");
    nombre.textContent = "reiniciar cambios";
    boton.appendChild(nombre);
    fila.appendChild(boton);
    const aviso = document.createElement("p");
    aviso.className = "ajustes-reiniciar-aviso";
    aviso.setAttribute("role", "status");
    aviso.setAttribute("data-ajustes-reiniciado", "");
    aviso.hidden = true;
    aviso.textContent = "Listo: todo ha vuelto a como venía de fábrica.";
    fila.appendChild(aviso);
    return fila;
}
function armarAjustesPie() {
    const pie = document.createElement("p");
    pie.className = "ajustes-pie";
    pie.appendChild(
        document.createTextNode(
            "Lo elegido se queda guardado en este navegador para la próxima visita. "
        )
    );
    const enlace = document.createElement("a");
    enlace.href = "/web/accesibilidad/accesibilidad.html";
    enlace.textContent = "Más sobre la accesibilidad de la web";
    pie.appendChild(enlace);
    return pie;
}
function leerAjuste(clave, porDefecto, esNumero) {
    try {
        const valor = localStorage.getItem(clave);
        if (valor === null) {
            return porDefecto;
        }
        return esNumero ? parseFloat(valor) : valor;
    } catch (error) {
        return porDefecto;
    }
}
function guardarAjuste(clave, valor, esElDeSiempre) {
    try {
        if (esElDeSiempre) {
            localStorage.removeItem(clave);
        } else {
            localStorage.setItem(clave, String(valor));
        }
    } catch (error) {
    }
}
function pasoDeAjustes(escala) {
    if (!isFinite(escala) || escala <= 0) {
        return AJUSTES_TAMANOS.indexOf(1);
    }
    let mejor = 0;
    for (let i = 1; i < AJUSTES_TAMANOS.length; i += 1) {
        if (Math.abs(AJUSTES_TAMANOS[i] - escala) < Math.abs(AJUSTES_TAMANOS[mejor] - escala)) {
            mejor = i;
        }
    }
    return mejor;
}
function aplicarAjustesTamano(paso, guardar) {
    paso = Math.min(AJUSTES_TAMANOS.length - 1, Math.max(0, Math.round(paso) || 0));
    AJUSTES.paso = paso;
    const escala = AJUSTES_TAMANOS[paso];
    document.documentElement.style.setProperty("--escala", escala);
    if (guardar) {
        guardarAjuste(AJUSTES_GUARDADO_TAMANO, escala, escala === 1);
    }
    if (AJUSTES.rango) {
        AJUSTES.rango.value = String(paso);
        AJUSTES.rango.setAttribute("aria-valuetext", `${Math.round(escala * 100)}%`);
    }
    const valor = AJUSTES.ventana.querySelector("[data-tamano-valor]");
    if (valor) {
        valor.textContent = `${Math.round(escala * 100)}%`;
    }
}
function engancharAjustesOpciones(cual) {
    AJUSTES.ventana.querySelectorAll(`[data-${cual}]`).forEach((boton) => {
        boton.addEventListener("click", () => {
            ponerAjuste(cual, boton.getAttribute(`data-${cual}`), true);
            pintarAjustesOpciones();
            document.dispatchEvent(new CustomEvent("ajustes:actualizar"));
        });
    });
}
function ponerAjuste(cual, valor, guardar) {
    const raiz = document.documentElement;
    if (valor) {
        raiz.setAttribute(`data-${cual}`, valor);
    } else {
        raiz.removeAttribute(`data-${cual}`);
    }
    if (guardar) {
        const claves = {
            interlineado: AJUSTES_GUARDADO_INTERLINEADO,
            letra: AJUSTES_GUARDADO_LETRA,
            voz: AJUSTES_GUARDADO_VOZ,
            movimiento: AJUSTES_GUARDADO_MOVIMIENTO,
        };
        guardarAjuste(claves[cual], valor, !valor);
    }
}
function pintarAjustesOpciones() {
    const raiz = document.documentElement;
    const ahora = {
        interlineado: raiz.getAttribute("data-interlineado") || "",
        letra: raiz.getAttribute("data-letra") || "",
        voz: raiz.getAttribute("data-voz") || "",
        movimiento: raiz.getAttribute("data-movimiento") || "",
    };
    ["interlineado", "letra", "voz", "movimiento"].forEach((cual) => {
        AJUSTES.ventana.querySelectorAll(`[data-${cual}]`).forEach((boton) => {
            const suyo = boton.getAttribute(`data-${cual}`);
            boton.setAttribute("aria-pressed", suyo === ahora[cual] ? "true" : "false");
        });
    });
}
function ponerAjustesCrt(encendido, guardar) {
    const raiz = document.documentElement;
    if (encendido) {
        raiz.dataset.crt = "si";
    } else {
        delete raiz.dataset.crt;
    }
    if (guardar) {
        guardarAjuste(AJUSTES_GUARDADO_CRT, "si", !encendido);
    }
    pintarAjustesCrt();
}
function pintarAjustesCrt() {
    const boton = AJUSTES.ventana.querySelector("[data-crt-boton]");
    if (!boton) {
        return;
    }
    const encendido = document.documentElement.dataset.crt === "si";
    boton.setAttribute("aria-pressed", encendido ? "true" : "false");
    boton.setAttribute(
        "aria-label",
        encendido
            ? "Quitar el filtro CRT"
            : "Poner el filtro CRT"
    );
    const estado = boton.querySelector("[data-crt-estado]");
    if (estado) {
        estado.textContent = encendido ? "ON" : "OFF";
    }
}
function reiniciarAjustes() {
    aplicarAjustesTamano(AJUSTES_TAMANOS.indexOf(1), true);
    ponerAjuste("interlineado", "", true);
    ponerAjuste("letra", "", true);
    ponerAjuste("voz", "", true);
    ponerAjuste("movimiento", "", true);
    ponerAjustesCrt(false, true);
    pintarAjustesOpciones();
    document.dispatchEvent(new CustomEvent("ajustes:actualizar"));
    if (typeof olvidarTemaGuardado === "function") {
        olvidarTemaGuardado();
    }
    const brillito = document.getElementById("cursor-trail-toggle");
    if (brillito && brillito.getAttribute("aria-pressed") === "false") {
        brillito.click();
    }
    const aviso = AJUSTES.ventana.querySelector("[data-ajustes-reiniciado]");
    if (aviso) {
        aviso.hidden = false;
        window.clearTimeout(AJUSTES.avisoReloj);
        AJUSTES.avisoReloj = window.setTimeout(() => {
            aviso.hidden = true;
        }, 4000);
    }
}
