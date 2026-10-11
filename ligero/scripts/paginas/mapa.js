/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/mapa.js
*/
const MAPA_URL = "/datos/sitio/mapa-del-sitio.json";
const MAPA_SECCIONES = {
    portada: "portada",
    blog: "blog",
    relatos: "relatos",
    rol: "rol",
    "notas de rol": "notas de rol",
    santuarios: "santuarios",
    recomendaciones: "recomendaciones",
    otras: "otras páginas",
};
const MAPA_COLUMNAS = [
    {
        clave: "pagina",
        nombre: "página",
        tipo: "texto",
        valor: (p) => (p.titulo || "").trim() || p.url || "",
    },
    {
        clave: "seccion",
        nombre: "sección",
        tipo: "texto",
        valor: (p) => nombreDeSeccion(p),
    },
    {
        clave: "fecha",
        nombre: "creada",
        tipo: "fecha",
        valor: (p) => momento(p.fecha),
    },
    {
        clave: "actualizada",
        nombre: "actualizada",
        tipo: "fecha",
        valor: (p) => momento(p.actualizada || p.fecha),
    },
];
const MAPA_SENTIDOS = {
    texto: { asc: "de la A a la Z", desc: "de la Z a la A" },
    fecha: {
        asc: "de lo más viejo a lo más nuevo",
        desc: "de lo más nuevo a lo más viejo",
    },
};
const MAPA_ORDEN = { columna: "pagina", direccion: "asc" };
let MAPA_PAGINAS = [];
initializeMapa();
async function initializeMapa() {
    const caja = document.querySelector("[data-mapa]");
    if (!caja) {
        return;
    }
    try {
        const respuesta = await window.pedirDatos(MAPA_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const datos = await respuesta.json();
        const paginas = (Array.isArray(datos) ? datos : []).filter(
            (p) => p && (p.url || "").trim()
        );
        if (paginas.length === 0) {
            caja.innerHTML =
                '<p class="entries-empty">El mapa está vacío. Pasa herramientas/3-generadores/generar-mapa.py.</p>';
            return;
        }
        MAPA_PAGINAS = paginas;
        caja.innerHTML = tablaDeMapa(paginas);
        escucharOrden(caja);
        escucharBusqueda();
        pintarFilas();
    } catch (error) {
        caja.innerHTML =
            '<p class="entries-error">No se ha podido cargar el mapa ahora mismo.</p>';
    }
}
function tablaDeMapa(paginas) {
    const cabeceras = MAPA_COLUMNAS.map(
        (columna) =>
            `<th scope="col" role="columnheader" aria-sort="none"` +
            ` data-mapa-columna="${columna.clave}">` +
            `<button type="button" class="mapa-ordenar"` +
            ` data-mapa-ordenar="${columna.clave}">` +
            `${escaparMapa(columna.nombre)}` +
            '<span class="mapa-flecha" aria-hidden="true"></span>' +
            "</button></th>"
    ).join("");
    return (
        `<p class="mapa-cuenta">${paginas.length} página${
            paginas.length === 1 ? "" : "s"
        } publicadas · <span data-mapa-orden></span></p>` +
        '<p class="visually-hidden" role="status" data-mapa-aviso></p>' +
        '<div class="mapa-scroll" tabindex="0" role="region"' +
        ' aria-label="Tabla de páginas, con scroll">' +
        '<table class="mapa-tabla" role="table">' +
        '<caption class="visually-hidden">Todas las páginas de la web.' +
        " Los botones de la cabecera cambian el orden.</caption>" +
        `<thead role="rowgroup"><tr role="row">${cabeceras}</tr></thead>` +
        '<tbody role="rowgroup" data-mapa-cuerpo></tbody>' +
        "</table></div>"
    );
}
function escucharBusqueda() {
    document.addEventListener("buscar:cambiado", esconderFilas);
}
function esconderFilas() {
    if (!window.buscador) {
        return;
    }
    for (const fila of document.querySelectorAll("[data-mapa-cuerpo] tr")) {
        fila.hidden = !window.buscador.pasa(fila);
    }
}
function escucharOrden(caja) {
    caja.addEventListener("click", (evento) => {
        const ordenar = evento.target.closest("[data-mapa-ordenar]");
        if (ordenar) {
            cambiarOrden(ordenar.getAttribute("data-mapa-ordenar"));
        }
    });
}
function cambiarOrden(clave) {
    const columna = MAPA_COLUMNAS.find((c) => c.clave === clave);
    if (!columna) {
        return;
    }
    if (MAPA_ORDEN.columna === clave) {
        MAPA_ORDEN.direccion = MAPA_ORDEN.direccion === "asc" ? "desc" : "asc";
    } else {
        MAPA_ORDEN.columna = clave;
        MAPA_ORDEN.direccion = columna.tipo === "fecha" ? "desc" : "asc";
    }
    pintarFilas();
    avisar(`Ordenado por ${textoDelOrden()}.`);
}
function textoDelOrden() {
    const columna = columnaDelOrden();
    return `${columna.nombre}, ${MAPA_SENTIDOS[columna.tipo][MAPA_ORDEN.direccion]}`;
}
function pintarFilas() {
    const cuerpo = document.querySelector("[data-mapa-cuerpo]");
    if (!cuerpo) {
        return;
    }
    cuerpo.innerHTML = ordenarPaginas().map(filaDeMapa).join("");
    for (const th of document.querySelectorAll("[data-mapa-columna]")) {
        const suya = th.getAttribute("data-mapa-columna") === MAPA_ORDEN.columna;
        th.setAttribute(
            "aria-sort",
            suya
                ? MAPA_ORDEN.direccion === "desc"
                    ? "descending"
                    : "ascending"
                : "none"
        );
    }
    const linea = document.querySelector("[data-mapa-orden]");
    if (linea) {
        linea.textContent = textoDelOrden();
    }
    if (window.buscador) {
        window.buscador.aplicar();
    }
}
function avisar(texto) {
    const hueco = document.querySelector("[data-mapa-aviso]");
    if (hueco) {
        hueco.textContent = texto;
    }
}
function columnaDelOrden() {
    return (
        MAPA_COLUMNAS.find((c) => c.clave === MAPA_ORDEN.columna) ||
        MAPA_COLUMNAS[0]
    );
}
function ordenarPaginas() {
    const columna = columnaDelOrden();
    const vuelta = MAPA_ORDEN.direccion === "desc" ? -1 : 1;
    return MAPA_PAGINAS.slice().sort((a, b) => {
        const uno = comparar(columna, a, b);
        if (uno !== 0) {
            return uno * vuelta;
        }
        return desempatar(columna, a, b);
    });
}
function comparar(columna, a, b) {
    const uno = columna.valor(a);
    const otro = columna.valor(b);
    if (columna.tipo === "fecha") {
        return uno === otro ? 0 : uno < otro ? -1 : 1;
    }
    return comparaTexto(uno, otro);
}
function desempatar(columna, a, b) {
    if (columna.tipo === "fecha") {
        return comparaTexto(tituloDe(a), tituloDe(b));
    }
    const dia = momento(b.fecha) - momento(a.fecha);
    return dia !== 0 ? dia : comparaTexto(tituloDe(a), tituloDe(b));
}
function comparaTexto(uno, otro) {
    return uno.localeCompare(otro, "es", { sensitivity: "base", numeric: true });
}
function tituloDe(pagina) {
    return (pagina.titulo || "").trim() || pagina.url || "";
}
function nombreDeSeccion(pagina) {
    const seccion = (pagina.seccion || "").trim();
    return MAPA_SECCIONES[seccion] || seccion || "";
}
function momento(cruda) {
    const fecha = cuando(cruda).getTime();
    return isNaN(fecha) ? -Infinity : fecha;
}
function filaDeMapa(pagina) {
    const titulo = escaparMapa(tituloDe(pagina));
    const nombre = nombreDeSeccion(pagina) || "—";
    return (
        '<tr role="row">' +
        `<td class="mapa-pagina" role="cell"><a href="${escaparMapa(rutaSeguraMapa(pagina.url))}">${titulo}</a></td>` +
        `<td class="mapa-seccion" role="cell">${escaparMapa(nombre)}</td>` +
        `<td class="mapa-fecha" role="cell"><time datetime="${escaparMapa(isoMapa(pagina.fecha))}">` +
        `${escaparMapa(fechaMapa(pagina.fecha))}</time></td>` +
        celdaActualizada(pagina) +
        "</tr>"
    );
}
function celdaActualizada(pagina) {
    const igual = (pagina.actualizada || "") === (pagina.fecha || "");
    if (igual) {
        return (
            '<td class="mapa-actualizada mapa-actualizada-sin" role="cell">' +
            '<span aria-hidden="true">—</span>' +
            '<span class="visually-hidden">sin cambios desde que se publicó</span>' +
            "</td>"
        );
    }
    return (
        '<td class="mapa-actualizada" role="cell">' +
        `<time datetime="${escaparMapa(isoMapa(pagina.actualizada))}">` +
        `${escaparMapa(fechaMapa(pagina.actualizada))}</time></td>`
    );
}
function cuando(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return new Date(NaN);
    }
    const [dia, mes, anyo] = partes.map(Number);
    return new Date(anyo, mes - 1, dia);
}
function fechaMapa(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return "—";
    }
    const [dia, mes, anyo] = partes.map(Number);
    const fecha = new Date(anyo, mes - 1, dia);
    if (isNaN(fecha.getTime())) {
        return "—";
    }
    return fecha.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
function isoMapa(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return "";
    }
    const [dia, mes, anyo] = partes;
    return `${anyo}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}
function escaparMapa(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function rutaSeguraMapa(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
