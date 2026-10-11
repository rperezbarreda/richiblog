/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/diario.js
*/
const DIARIO_ETIQUETA = "diario";
const DIARIO_SEMANAS = 6;
const DIARIO_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIARIO_DIAS = [
    { corto: "L", largo: "lunes" },
    { corto: "M", largo: "martes" },
    { corto: "X", largo: "miércoles" },
    { corto: "J", largo: "jueves" },
    { corto: "V", largo: "viernes" },
    { corto: "S", largo: "sábado" },
    { corto: "D", largo: "domingo" },
];
let diarioPorDia = new Map();
let diarioMeses = [];
let diarioIndice = 0;
initializeDiario();
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
        const respuesta = await window.pedirDatos("/datos/blog/entradas-blog.json");
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
        diarioIndice = indiceDe(diarioMeses, new Date());
        if (diarioIndice === -1) {
            diarioIndice = diarioMeses.length - 1;
        }
        document.querySelectorAll("[data-diario-ir]").forEach((boton) => {
            if (diarioMeses.length < 2) {
                boton.hidden = true;
                return;
            }
            boton.addEventListener("click", () => {
                moverDiario(Number(boton.getAttribute("data-diario-ir")));
            });
        });
        pintarDiario();
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
    const titulo = document.querySelector("[data-diario-titulo]");
    if (titulo) {
        titulo.textContent = DIARIO_MESES[mes.mes] + "_" + mes.anyo + ".txt";
    }
    calendario.innerHTML = tablaDelMes(mes, nombreMes);
    document.querySelectorAll("[data-diario-ir]").forEach((boton) => {
        const destino = diarioIndice + Number(boton.getAttribute("data-diario-ir"));
        boton.disabled = destino < 0 || destino >= diarioMeses.length;
    });
    if (lista) {
        lista.innerHTML = listaDelMes(mes);
    }
    ajustarCalendario();
}
const DIARIO_DIA_MAX = 74;
const DIARIO_DIA_MIN = 34;
const DIARIO_ANCHO_APILADO = 1360;
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
function noCabe(cuerpo) {
    return cuerpo.scrollHeight - cuerpo.clientHeight > 0;
}
function tablaDelMes(mes, nombreMes) {
    const primero = new Date(mes.anyo, mes.mes, 1);
    const dias = new Date(mes.anyo, mes.mes + 1, 0).getDate();
    const hueco = diaLunes(primero.getDay());
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
        celdas.push('<td class="diario-dia diario-hueco"></td>');
    }
    for (let dia = 1; dia <= dias; dia += 1) {
        celdas.push(celdaDia(mes, dia));
    }
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
                '<span class="entry-preview-meta">' +
                '<time class="entry-preview-date" datetime="' +
                fechaISODiario(item.fecha) +
                '">' +
                item.fecha.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                }) +
                "</time>" +
                minutosDiario(item) +
                "</span></a></li>"
        )
        .join("");
}
function minutosDiario(item) {
    const minutos = Number(item && item.minutos);
    if (!minutos || minutos < 1) {
        return "";
    }
    return '<span class="entry-preview-minutos">' + minutos + " min</span>";
}
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
function urlSeguraDiario(url) {
    const limpia = (url === null || url === undefined ? "" : url.toString()).trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "#";
}
