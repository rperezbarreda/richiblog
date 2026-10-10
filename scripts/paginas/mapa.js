// =========================================
// MAPA DEL SITIO — la tabla de todas las páginas
// =========================================
// Sale de datos/mapa-del-sitio.json, que escribe
// herramientas/3-generadores/generar-mapa.py recorriendo la web entera. Aquí no se
// decide nada: ni qué páginas hay, ni de qué sección son, ni desde
// cuándo están. Solo se pinta la tabla.
//
// Es una tabla de verdad (<table>, con su cabecera y su <caption>) y no
// una lista maquillada: quien usa un lector de pantalla puede moverse
// por ella celda a celda y oír a qué columna pertenece cada dato.

const MAPA_URL = "/datos/mapa-del-sitio.json";

// Cómo se llama cada sección en la tabla. Lo que no esté aquí sale tal
// cual, así que una sección nueva no se queda en blanco.
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

// =========================================
// ORDEN DE LA TABLA
// =========================================
// Las cuatro columnas se pueden ordenar, y cada una en los dos
// sentidos. De cada una se guarda qué se mira de la página para
// compararlas ("valor") y de qué tipo es ese dato, que es lo que decide
// dos cosas: hacia dónde ordena el primer clic —un texto de la A a la
// Z; una fecha de lo más nuevo a lo más viejo, que es lo que se quiere
// ver antes— y cómo se dice en voz alta.
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
        // Una página que no se ha tocado desde que se publicó enseña una
        // raya, pero por dentro lleva su fecha de creación: al ordenar
        // por esta columna cae donde le toca y no en un montón aparte.
        valor: (p) => momento(p.actualizada || p.fecha),
    },
];

// Cómo se lee cada sentido, según el tipo de dato. "asc" y "desc" son
// los de aria-sort (ascending / descending), que es lo que se escribe
// en el <th> para que un lector de pantalla lo anuncie.
const MAPA_SENTIDOS = {
    texto: { asc: "de la A a la Z", desc: "de la Z a la A" },
    fecha: {
        asc: "de lo más viejo a lo más nuevo",
        desc: "de lo más nuevo a lo más viejo",
    },
};

// Con qué orden se abre la página: por nombre, de la A a la Z. El JSON
// viene ordenado por secciones (lo hace herramientas/3-generadores/generar-mapa.py),
// pero para buscar una página concreta —que es a lo que se viene— la
// lista alfabética es la que se recorre sola. Las secciones siguen a
// un botón de distancia.
const MAPA_ORDEN = { columna: "pagina", direccion: "asc" };

// Las páginas tal como llegaron, sin ordenar: de aquí se parte cada
// vez, así que reordenar veinte veces no va dejando el orden anterior
// metido por debajo.
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
        // pintarFilas() es quien avisa al buscador, así que esto también
        // aplica lo que venga en ?buscar= de la dirección: cuando el
        // buscador se montó, la tabla todavía no tenía ni una fila.
        pintarFilas();
    } catch (error) {
        caja.innerHTML =
            '<p class="entries-error">No se ha podido cargar el mapa ahora mismo.</p>';
    }
}

function tablaDeMapa(paginas) {
    // Las filas no se escriben aquí: las pone pintarFilas(), que es
    // quien las ordena. Así el primer pintado y los siguientes pasan por
    // el mismo sitio y no hay dos versiones de la misma fila.
    const cabeceras = MAPA_COLUMNAS.map(
        (columna) =>
            // aria-sort va en el <th>, que es donde lo buscan los
            // lectores de pantalla, y el CSS se cuelga de ese mismo
            // atributo (como los filtros del blog con aria-pressed):
            // así no hay manera de que la flecha que se ve y el orden
            // que se anuncia digan cosas distintas.
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
        // Lo que cambia al reordenar se dice aquí, para quien no ve la
        // tabla moverse.
        '<p class="visually-hidden" role="status" data-mapa-aviso></p>' +
        // tabindex y role para poder desplazar la tabla con el teclado
        // cuando no cabe de ancho (móvil): sin esto, con teclado no hay
        // forma de llegar a la columna de la derecha.
        '<div class="mapa-scroll" tabindex="0" role="region"' +
        ' aria-label="Tabla de páginas, con scroll">' +
        // Los role= van escritos a propósito aunque un <table> ya los
        // traiga de serie: en el móvil el CSS convierte las filas en
        // bloques (display: block) para que quepan, y eso, sin los
        // roles, le quita al navegador la idea de que esto es una tabla
        // — quien la oye dejaría de saber en qué columna está cada dato.
        '<table class="mapa-tabla" role="table">' +
        '<caption class="visually-hidden">Todas las páginas de la web.' +
        " Los botones de la cabecera cambian el orden.</caption>" +
        `<thead role="rowgroup"><tr role="row">${cabeceras}</tr></thead>` +
        '<tbody role="rowgroup" data-mapa-cuerpo></tbody>' +
        "</table></div>"
    );
}

// =========================================
// BUSCAR
// =========================================
// El campo es el mismo componente que llevan el archivo del blog, los
// relatos y el portfolio de rol (scripts/componentes/buscador.js): él
// dice quién pasa la búsqueda y esconde quien haya pintado la lista.
// Aquí lo que se esconde son filas de la tabla.

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

// =========================================
// ORDENAR
// =========================================

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
    // La misma columna otra vez: se le da la vuelta. Otra columna:
    // empieza por su sentido de siempre.
    if (MAPA_ORDEN.columna === clave) {
        MAPA_ORDEN.direccion = MAPA_ORDEN.direccion === "asc" ? "desc" : "asc";
    } else {
        MAPA_ORDEN.columna = clave;
        MAPA_ORDEN.direccion = columna.tipo === "fecha" ? "desc" : "asc";
    }
    pintarFilas();
    avisar(`Ordenado por ${textoDelOrden()}.`);
}

// Lo que se ve en la línea de arriba y lo que se dice en voz alta salen
// de la misma función, para que no puedan contarse cosas distintas.
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

    // Las filas son otras, así que lo que estuviera buscado hay que
    // volver a aplicarlo: si no, al reordenar reaparecerían las que la
    // búsqueda había escondido.
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

// La columna por la que está ordenada la tabla. Siempre hay una: la
// página abre ordenada por nombre. Si alguna vez quedara apuntada una
// que no existe, se vuelve a la primera en vez de dejar la tabla sin
// ordenar.
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
        // El desempate no se invierte: dos páginas de la misma sección
        // se quedan siempre en el mismo sitio una respecto a la otra, y
        // así la tabla no baila al dar la vuelta a la columna.
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
        // Dos páginas del mismo día, por título.
        return comparaTexto(tituloDe(a), tituloDe(b));
    }
    // Dos páginas de la misma sección (o con el mismo título), la más
    // nueva primero, que es el orden de siempre.
    const dia = momento(b.fecha) - momento(a.fecha);
    return dia !== 0 ? dia : comparaTexto(tituloDe(a), tituloDe(b));
}

// Con localeCompare y no con < : en español hay tildes y eñes, y "Ñ"
// va después de "N" y no al final del abecedario. numeric para que
// "Blog 2026" no quede detrás de "Blog 10000".
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

// Una fecha dd-mm-aaaa en número, para poder restarlas. Lo que no se
// entiende se va al principio, no en medio de la tabla.
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

// Una página que no se ha tocado desde que se publicó no repite la
// misma fecha dos veces: una raya se lee mejor que dos columnas
// idénticas. Lo que significa esa raya va escrito para quien la escuche,
// que si no oiría "guión" y a otra cosa.
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

// =========================================
// FECHAS — dd-mm-aaaa en el JSON
// =========================================

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

// Solo rutas del propio sitio o http(s).
function rutaSeguraMapa(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
