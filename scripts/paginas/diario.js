// =========================================
// DIARIO EN FORMATO CALENDARIO
// =========================================
// Monta la página /web/blog/diario.html: una rejilla de mes con un
// cuadrito por día, donde los días que tienen entrada de diario se
// pueden abrir y los vacíos quedan apagados.
//
// Los datos salen de datos/entradas-blog.json, el mismo archivo que alimenta la
// portada y el archivo del año; aquí solo se quedan las entradas
// etiquetadas como "diario". Publicar una entrada nueva con esa
// etiqueta la coloca sola en su día: no hay nada que escribir a mano.
//
// El calendario se dibuja como <table> de verdad (no una rejilla de
// divs) porque es lo que los lectores de pantalla saben recorrer: cada
// celda se anuncia con su día de la semana y su número, y se puede
// saltar de semana en semana con las flechas.

const DIARIO_ETIQUETA = "diario";
// Filas de semana que se dibujan siempre, tenga el mes las que tenga.
const DIARIO_SEMANAS = 6;
const DIARIO_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
// La semana empieza en lunes, como aquí. El índice de getDay() empieza
// en domingo, así que hay que rotarlo (ver diaLunes()).
const DIARIO_DIAS = [
    { corto: "L", largo: "lunes" },
    { corto: "M", largo: "martes" },
    { corto: "X", largo: "miércoles" },
    { corto: "J", largo: "jueves" },
    { corto: "V", largo: "viernes" },
    { corto: "S", largo: "sábado" },
    { corto: "D", largo: "domingo" },
];

let diarioPorDia = new Map(); // "2026-09-12" -> [entrada, entrada…]
let diarioMeses = [];         // meses con algo, de más antiguo a más nuevo
let diarioIndice = 0;         // cuál se está mirando

initializeDiario();

// =========================================
// DIARIO VACÍO
// =========================================
// Con el diario a cero no basta con poner el mensaje dentro del
// calendario: quedaban dos ventanas enormes vacías y dos botones de
// "anterior / siguiente" que no llevaban a ningún sitio. Así que se
// quitan la lista y la barra de meses, y la ventana que queda se
// encoge hasta el tamaño del mensaje.

function vaciarDiario(calendario) {
    calendario.innerHTML =
        '<p class="entries-empty diario-sin-nada">Todavía no hay nada en el' +
        " diario. Aquí irá apareciendo, día a día, lo que publiques con la" +
        " etiqueta «diario».</p>";

    const barra = document.querySelector(".diario-barra");
    if (barra) {
        barra.remove();
    }
    const lista = document.querySelector(".diario-lista");
    if (lista) {
        lista.remove();
    }
    const cuerpo = document.querySelector(".diario-cuerpo");
    if (cuerpo) {
        cuerpo.classList.add("diario-cuerpo-vacio");
    }
}


// =========================================
// BOTÓN DE "VER TODO EL BLOG"
// =========================================
// Lleva al archivo del año más nuevo que tenga algo publicado, sacado
// del propio listado. Si todavía no hay ninguna entrada, el botón se
// quita: no hay ningún archivo al que ir, y un enlace a una página que
// no existe es peor que no tener botón.

function ajustarBotonBlog(entradas) {
    const boton = document.querySelector("[data-boton-blog]");
    if (!boton) {
        return;
    }
    const anyos = entradas
        .map((item) => /\/blog\/(\d{4})\//.exec(item.url || ""))
        .filter(Boolean)
        .map((trozo) => Number(trozo[1]));

    if (anyos.length === 0) {
        boton.remove();
        return;
    }
    const anyo = Math.max(...anyos);
    boton.setAttribute("href", `/web/blog/${anyo}/index_${anyo}.html`);
    boton.hidden = false;
}

async function initializeDiario() {
    const calendario = document.querySelector("[data-diario-calendario]");
    if (!calendario) {
        return;
    }

    try {
        const respuesta = await window.pedirDatos("/datos/entradas-blog.json");
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const datos = await respuesta.json();
        const todas = Array.isArray(datos) ? datos : [];
        ajustarBotonBlog(todas);
        const entradas = todas
            .filter((item) => Array.isArray(item.tags) && item.tags.includes(DIARIO_ETIQUETA))
            .map((item) => ({ ...item, fecha: fechaDiario(item.date) }))
            .filter((item) => !isNaN(item.fecha.getTime()));

        if (entradas.length === 0) {
            vaciarDiario(calendario);
            return;
        }

        diarioPorDia = new Map();
        entradas.forEach((item) => {
            const clave = claveDia(item.fecha);
            if (!diarioPorDia.has(clave)) {
                diarioPorDia.set(clave, []);
            }
            diarioPorDia.get(clave).push(item);
        });

        diarioMeses = mesesDelDiario(entradas);
        // Se abre por el mes de hoy si está dentro del rango; si no, por
        // el último que haya.
        diarioIndice = indiceDe(diarioMeses, new Date());
        if (diarioIndice === -1) {
            diarioIndice = diarioMeses.length - 1;
        }

        document.querySelectorAll("[data-diario-ir]").forEach((boton) => {
            // Con un solo mes en todo el rango los dos botones estarían
            // apagados para siempre y parecerían rotos: mejor no
            // ponerlos. En cuanto haya de qué, aparecen solos.
            if (diarioMeses.length < 2) {
                boton.hidden = true;
                return;
            }
            boton.addEventListener("click", () => {
                moverDiario(Number(boton.getAttribute("data-diario-ir")));
            });
        });

        pintarDiario();

        // El tamaño de las casillas se ajusta al hueco que queda de
        // verdad, no a una cuenta fija (ver ajustarCalendario).
        ajustarCalendario();
        let temporizador = null;
        window.addEventListener(
            "resize",
            () => {
                window.clearTimeout(temporizador);
                temporizador = window.setTimeout(ajustarCalendario, 120);
            },
            { passive: true }
        );
    } catch (error) {
        calendario.innerHTML =
            '<p class="entries-error">No se ha podido cargar el diario ahora mismo.</p>';
    }
}

// Los meses por los que se puede pasear: TODOS los del rango, no solo
// aquellos en los que hay algo escrito. Van de la primera entrada al
// último de estos dos: la entrada más nueva o el mes de hoy (así, si
// hoy es septiembre y hay algo escrito con fecha de octubre, se puede
// ir a verlo y volver; y si el diario lleva parado desde mayo, se puede
// llegar hasta el mes actual). Los meses vacíos de en medio se enseñan
// igual, con el calendario apagado: un hueco en el diario también es
// información, y saltárselos hacía que el botón diera brincos raros.
function mesesDelDiario(entradas) {
    const numeros = entradas.map((item) => item.fecha.getFullYear() * 12 + item.fecha.getMonth());
    const hoy = new Date();
    const ahora = hoy.getFullYear() * 12 + hoy.getMonth();

    const desde = Math.min(...numeros);
    const hasta = Math.max(Math.max(...numeros), ahora);

    const meses = [];
    for (let n = desde; n <= hasta; n += 1) {
        meses.push({ anyo: Math.floor(n / 12), mes: n % 12 });
    }
    return meses;
}

function indiceDe(meses, fecha) {
    return meses.findIndex(
        (m) => m.anyo === fecha.getFullYear() && m.mes === fecha.getMonth()
    );
}

function moverDiario(paso) {
    const nuevo = diarioIndice + paso;
    if (nuevo < 0 || nuevo >= diarioMeses.length) {
        return;
    }
    diarioIndice = nuevo;
    pintarDiario();
}

function pintarDiario() {
    const calendario = document.querySelector("[data-diario-calendario]");
    const rotulo = document.querySelector("[data-diario-mes]");
    const lista = document.querySelector("[data-diario-lista]");
    const mes = diarioMeses[diarioIndice];
    if (!calendario || !mes) {
        return;
    }

    const nombreMes = DIARIO_MESES[mes.mes] + " de " + mes.anyo;
    if (rotulo) {
        rotulo.textContent = nombreMes;
    }

    // El título de la ventana de al lado dice de qué mes y año son las
    // entradas, en vez de un "este_mes.txt" que no aclaraba cuál era al
    // moverse por el calendario. Va sin "entradas_" delante: con el
    // prefijo, "entradas_septiembre_2026.txt" no cabía en la barra de la
    // ventana y se partía en dos líneas.
    const titulo = document.querySelector("[data-diario-titulo]");
    if (titulo) {
        titulo.textContent = DIARIO_MESES[mes.mes] + "_" + mes.anyo + ".txt";
    }

    calendario.innerHTML = tablaDelMes(mes, nombreMes);

    // Los botones de mover mes se apagan en los extremos en vez de
    // desaparecer: si cambiaran de sitio, el foco del teclado saltaría.
    document.querySelectorAll("[data-diario-ir]").forEach((boton) => {
        const destino = diarioIndice + Number(boton.getAttribute("data-diario-ir"));
        boton.disabled = destino < 0 || destino >= diarioMeses.length;
    });

    if (lista) {
        lista.innerHTML = listaDelMes(mes);
    }

    // Todos los meses se dibujan con seis semanas, así que el tamaño no
    // debería cambiar al pasar de mes; aun así se recalcula, por si la
    // lista de al lado ha crecido.
    ajustarCalendario();
}

// =========================================
// QUE EL CALENDARIO QUEPA EN LA PANTALLA
// =========================================
// El lado de una casilla (--dia) lo pone el CSS con un clamp, pero una
// cuenta fija en vh no puede saber cuánto ocupan el título, la barra
// del mes o el botón de abajo, que no encogen con la ventana. Resultado:
// en unas medidas sobraba sitio y en otras se quedaba corto por 40px.
//
// Aquí se hace al revés: se empieza por el tamaño más grande y se va
// bajando de dos en dos hasta que el bloque entero cabe sin scroll. Son
// unas pocas medidas seguidas, y solo al cargar y al cambiar el tamaño
// de la ventana.
//
// En estrecho (la vista apilada y el móvil) no se toca: ahí manda el
// ancho y el CSS ya lo resuelve.
const DIARIO_DIA_MAX = 74;
const DIARIO_DIA_MIN = 34;
const DIARIO_ANCHO_APILADO = 1360; // igual que el corte de blog.responsive.css

function ajustarCalendario() {
    const ventana = document.querySelector(".diario-ventana");
    const cuerpo = document.querySelector(".diario-cuerpo");
    if (!ventana || !cuerpo) {
        return;
    }

    if (window.innerWidth <= DIARIO_ANCHO_APILADO) {
        ventana.style.removeProperty("--dia");
        return;
    }

    let dia = DIARIO_DIA_MAX;
    ventana.style.setProperty("--dia", dia + "px");

    while (dia > DIARIO_DIA_MIN && noCabe(cuerpo)) {
        dia -= 2;
        ventana.style.setProperty("--dia", dia + "px");
    }
}

// Solo el alto. El ancho no lo arregla encoger las casillas: por
// estrecha que se ponga la tabla, la ventana nunca baja del ancho de la
// barra del mes, así que mirando también el ancho el bucle se comía
// hasta el mínimo sin conseguir nada. De que quepan a lo ancho se
// encarga el corte de blog.responsive.css, que apila las dos ventanas.
function noCabe(cuerpo) {
    return cuerpo.scrollHeight - cuerpo.clientHeight > 0;
}

function tablaDelMes(mes, nombreMes) {
    const primero = new Date(mes.anyo, mes.mes, 1);
    const dias = new Date(mes.anyo, mes.mes + 1, 0).getDate();
    const hueco = diaLunes(primero.getDay()); // casillas vacías antes del día 1

    const cabecera = DIARIO_DIAS.map(
        (d) =>
            '<th scope="col"><abbr title="' +
            d.largo +
            '">' +
            d.corto +
            "</abbr></th>"
    ).join("");

    const celdas = [];
    for (let i = 0; i < hueco; i += 1) {
        // Fuera del mes: ni número ni nada que anunciar.
        celdas.push('<td class="diario-dia diario-hueco"></td>');
    }
    for (let dia = 1; dia <= dias; dia += 1) {
        celdas.push(celdaDia(mes, dia));
    }
    // Siempre seis semanas, aunque el mes quepa en cuatro o cinco: un
    // mes de 30 días que empieza en domingo necesita seis filas y otro
    // de 28 que empieza en lunes solo cuatro, así que rellenando hasta
    // 42 el calendario mide siempre lo mismo y no pega saltos al pasar
    // de mes.
    while (celdas.length < DIARIO_SEMANAS * 7) {
        celdas.push('<td class="diario-dia diario-hueco"></td>');
    }

    const filas = [];
    for (let i = 0; i < celdas.length; i += 7) {
        filas.push("<tr>" + celdas.slice(i, i + 7).join("") + "</tr>");
    }

    return (
        '<table class="diario-tabla">' +
        '<caption class="visually-hidden">Diario de ' +
        escapeDiario(nombreMes) +
        "</caption>" +
        "<thead><tr>" +
        cabecera +
        "</tr></thead><tbody>" +
        filas.join("") +
        "</tbody></table>"
    );
}

function celdaDia(mes, dia) {
    const fecha = new Date(mes.anyo, mes.mes, dia);
    const entradas = diarioPorDia.get(claveDia(fecha)) || [];
    const hoy = esHoy(fecha) ? " diario-hoy" : "";

    if (entradas.length === 0) {
        return (
            '<td class="diario-dia diario-vacio' +
            hoy +
            '"><span class="diario-numero">' +
            dia +
            "</span></td>"
        );
    }

    // Con varias entradas el mismo día se enlaza la primera y se avisa
    // de cuántas hay; la lista de abajo las tiene todas.
    const principal = entradas[0];
    const titulo =
        entradas.length === 1
            ? principal.title || "Sin título"
            : entradas.map((e) => e.title || "Sin título").join(", ");
    const etiqueta = dia + " de " + DIARIO_MESES[mes.mes] + ": " + titulo;

    return (
        '<td class="diario-dia diario-lleno' +
        hoy +
        '">' +
        '<a class="diario-enlace" href="' +
        escapeDiario(urlSeguraDiario(principal.url)) +
        '" aria-label="' +
        escapeDiario(etiqueta) +
        '">' +
        '<span class="diario-numero" aria-hidden="true">' +
        dia +
        "</span>" +
        (entradas.length > 1
            ? '<span class="diario-cuantas" aria-hidden="true">×' + entradas.length + "</span>"
            : "") +
        "</a></td>"
    );
}

function listaDelMes(mes) {
    const items = [];
    diarioPorDia.forEach((entradas, clave) => {
        const [anyo, numMes] = clave.split("-").map(Number);
        if (anyo === mes.anyo && numMes - 1 === mes.mes) {
            entradas.forEach((item) => items.push(item));
        }
    });

    if (items.length === 0) {
        return '<li class="entries-error">Este mes no tiene nada.</li>';
    }

    return items
        .sort((a, b) => b.fecha - a.fecha)
        .map(
            (item) =>
                '<li class="entry-preview">' +
                '<a class="entry-preview-link" href="' +
                escapeDiario(urlSeguraDiario(item.url)) +
                '">' +
                '<span class="entry-preview-title">' +
                escapeDiario(item.title || "Sin título") +
                "</span>" +
                // <time> con la fecha también en formato de máquina: es
                // lo que hace que se entienda como fecha y no como texto.
                '<time class="entry-preview-date" datetime="' +
                fechaISODiario(item.fecha) +
                '">' +
                item.fecha.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                }) +
                "</time></a></li>"
        )
        .join("");
}

// getDay() cuenta 0 = domingo; aquí la semana empieza en lunes.
function diaLunes(dia) {
    return (dia + 6) % 7;
}

function claveDia(fecha) {
    return (
        fecha.getFullYear() +
        "-" +
        String(fecha.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(fecha.getDate()).padStart(2, "0")
    );
}

function esHoy(fecha) {
    return claveDia(fecha) === claveDia(new Date());
}

// Las fechas del JSON vienen como dd-mm-aaaa.
function fechaDiario(cruda) {
    if (!cruda) {
        return new Date(NaN);
    }
    const partes = cruda.split("-");
    if (partes.length !== 3) {
        return new Date(NaN);
    }
    const [dia, mes, anyo] = partes.map(Number);
    return new Date(anyo, mes - 1, dia);
}

// aaaa-mm-dd a partir de la fecha local. Con toISOString() no vale:
// esa fecha es medianoche de aquí, que en UTC es el día anterior, y
// el atributo habría acabado diciendo un día menos.
function fechaISODiario(fecha) {
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function escapeDiario(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Solo rutas del propio sitio o http(s): así una URL manipulada en el
// JSON no puede colar un "javascript:" en el href.
function urlSeguraDiario(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
