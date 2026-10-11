/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/buscar.js
*/
const BUSQ_DATOS = "/datos/sitio/buscador.json";
const BUSQ_CONTEXTO = 90;
const BUSQ_POR_TANDA = 20;
const BUSQ = {
    fichas: null,
    palabras: [],
    encontrados: [],
    pintados: 0,
};
initializeBuscar();
function initializeBuscar() {
    const caja = document.querySelector("[data-buscar-resultados]");
    if (!caja) {
        return;
    }
    const consulta = consultaDeLaDireccion();
    const campo = document.getElementById("q");
    if (campo) {
        campo.value = consulta;
    }
    if (!consulta) {
        decirBusq("Escribe algo arriba y dale a buscar.");
        return;
    }
    document.title = `“${consulta}” · Buscar · El Blog de Richi`;
    buscarDeVerdad(consulta, caja);
}
function consultaDeLaDireccion() {
    try {
        return (new URLSearchParams(window.location.search).get("q") || "").trim();
    } catch (error) {
        return "";
    }
}
async function buscarDeVerdad(consulta, caja) {
    decirBusq("Buscando…");
    try {
        const respuesta = await window.pedirDatos(BUSQ_DATOS);
        if (!respuesta.ok) {
            throw new Error("no se pudo leer el listado");
        }
        BUSQ.fichas = await respuesta.json();
    } catch (error) {
        decirBusq(
            "No he podido cargar el listado de la búsqueda. Prueba a recargar la página."
        );
        return;
    }
    BUSQ.palabras = partirBusq(consulta);
    BUSQ.encontrados = (BUSQ.fichas || [])
        .map((ficha) => puntuarBusq(ficha, BUSQ.palabras))
        .filter((r) => r)
        .sort((a, b) => b.puntos - a.puntos);
    BUSQ.pintados = 0;
    pintarCuentaBusq(consulta);
    caja.innerHTML = "";
    if (!BUSQ.encontrados.length) {
        caja.appendChild(sinResultadosBusq(consulta));
        return;
    }
    const lista = document.createElement("ol");
    lista.className = "busq-lista";
    caja.appendChild(lista);
    pintarTandaBusq(lista, caja);
}
function normalizarBusq(texto) {
    return (texto || "")
        .toLowerCase()
        .replace(/ñ/g, "\u0001")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\u0001/g, "ñ");
}
function esLetraBusq(caracter) {
    return caracter >= "a" && caracter <= "z"
        ? true
        : (caracter >= "0" && caracter <= "9") || caracter === "ñ";
}
function indiceBusq(texto, palabra, desde) {
    let i = texto.indexOf(palabra, desde || 0);
    while (i > 0 && esLetraBusq(texto.charAt(i - 1))) {
        i = texto.indexOf(palabra, i + 1);
    }
    return i;
}
function partirBusq(consulta) {
    return normalizarBusq(consulta)
        .split(/\s+/)
        .filter((p) => p.length > 0);
}
function puntuarBusq(ficha, palabras) {
    const titulo = normalizarBusq(ficha.titulo);
    const seccion = normalizarBusq(ficha.seccion);
    const categorias = normalizarBusq((ficha.categorias || []).join(" "));
    const texto = normalizarBusq(ficha.texto);
    let puntos = 0;
    let donde = null;
    for (const palabra of palabras) {
        const enTitulo = indiceBusq(titulo, palabra);
        const enCategoria = indiceBusq(categorias, palabra);
        const enSeccion = indiceBusq(seccion, palabra);
        const enTexto = indiceBusq(texto, palabra);
        if (enTitulo === -1 && enCategoria === -1 && enSeccion === -1 && enTexto === -1) {
            return null;
        }
        if (enTitulo !== -1) {
            puntos += enTitulo === 0 ? 120 : 80;
        }
        if (enCategoria !== -1) {
            puntos += 40;
        }
        if (enSeccion !== -1) {
            puntos += 15;
        }
        if (enTexto !== -1) {
            puntos += 10;
            if (donde === null) {
                donde = enTexto;
            }
        }
    }
    return {
        ficha,
        puntos,
        donde,
    };
}
function pintarTandaBusq(lista, caja) {
    const hasta = Math.min(BUSQ.pintados + BUSQ_POR_TANDA, BUSQ.encontrados.length);
    for (let i = BUSQ.pintados; i < hasta; i += 1) {
        lista.appendChild(fichaBusq(BUSQ.encontrados[i]));
    }
    BUSQ.pintados = hasta;
    const viejo = caja.querySelector("[data-busq-mas]");
    if (viejo) {
        viejo.remove();
    }
    if (BUSQ.pintados < BUSQ.encontrados.length) {
        const quedan = BUSQ.encontrados.length - BUSQ.pintados;
        const mas = document.createElement("button");
        mas.type = "button";
        mas.className = "busq-mas";
        mas.setAttribute("data-busq-mas", "");
        mas.textContent = `ver ${Math.min(quedan, BUSQ_POR_TANDA)} más (quedan ${quedan})`;
        mas.addEventListener("click", () => {
            const desde = BUSQ.pintados;
            pintarTandaBusq(lista, caja);
            const nuevo = lista.children[desde];
            if (nuevo) {
                const enlace = nuevo.querySelector("a");
                if (enlace) {
                    enlace.focus();
                }
            }
        });
        caja.appendChild(mas);
    }
}
function fichaBusq(resultado) {
    const ficha = resultado.ficha;
    const li = document.createElement("li");
    li.className = "busq-item";
    const cabeza = document.createElement("p");
    cabeza.className = "busq-titulo";
    const enlace = document.createElement("a");
    enlace.href = rutaSeguraBusq(ficha.url);
    enlace.appendChild(resaltarBusq(ficha.titulo));
    cabeza.appendChild(enlace);
    li.appendChild(cabeza);
    const meta = document.createElement("p");
    meta.className = "busq-meta";
    meta.appendChild(trozoBusq("busq-seccion", ficha.seccion));
    if (ficha.fecha) {
        meta.appendChild(trozoBusq("busq-fecha", fechaBusq(ficha.fecha)));
    }
    (ficha.categorias || []).forEach((categoria) => {
        meta.appendChild(trozoBusq("busq-categoria", categoria));
    });
    li.appendChild(meta);
    const trozo = trozoDelTextoBusq(ficha.texto, resultado.donde);
    if (trozo) {
        const parrafo = document.createElement("p");
        parrafo.className = "busq-trozo";
        parrafo.appendChild(resaltarBusq(trozo));
        li.appendChild(parrafo);
    }
    return li;
}
function rutaSeguraBusq(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
function trozoBusq(clase, texto) {
    const span = document.createElement("span");
    span.className = clase;
    span.appendChild(resaltarBusq(texto));
    return span;
}
const BUSQ_MESES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sept", "oct", "nov", "dic",
];
function fechaBusq(cruda) {
    const partes = (cruda || "").split("-");
    if (partes.length !== 3) {
        return cruda || "";
    }
    const mes = BUSQ_MESES[parseInt(partes[1], 10) - 1];
    return mes ? `${partes[0]} ${mes} ${partes[2]}` : cruda;
}
function trozoDelTextoBusq(texto, donde) {
    if (!texto || donde === null || donde === undefined) {
        return "";
    }
    let desde = Math.max(0, donde - BUSQ_CONTEXTO);
    let hasta = Math.min(texto.length, donde + BUSQ_CONTEXTO);
    if (desde > 0) {
        const espacio = texto.indexOf(" ", desde);
        desde = espacio === -1 ? desde : espacio + 1;
    }
    if (hasta < texto.length) {
        const espacio = texto.lastIndexOf(" ", hasta);
        hasta = espacio === -1 ? hasta : espacio;
    }
    const trozo = texto.slice(desde, hasta).trim();
    return (desde > 0 ? "…" : "") + trozo + (hasta < texto.length ? "…" : "");
}
function resaltarBusq(texto) {
    const salida = document.createDocumentFragment();
    const original = texto || "";
    if (!BUSQ.palabras.length || !original) {
        salida.appendChild(document.createTextNode(original));
        return salida;
    }
    const plano = normalizarBusq(original);
    const marcas = [];
    BUSQ.palabras.forEach((palabra) => {
        let desde = 0;
        for (;;) {
            const i = indiceBusq(plano, palabra, desde);
            if (i === -1) {
                break;
            }
            marcas.push([i, i + palabra.length]);
            desde = i + palabra.length;
        }
    });
    if (!marcas.length) {
        salida.appendChild(document.createTextNode(original));
        return salida;
    }
    marcas.sort((a, b) => a[0] - b[0]);
    const juntas = [marcas[0]];
    for (let i = 1; i < marcas.length; i += 1) {
        const ultima = juntas[juntas.length - 1];
        if (marcas[i][0] <= ultima[1]) {
            ultima[1] = Math.max(ultima[1], marcas[i][1]);
        } else {
            juntas.push(marcas[i]);
        }
    }
    let cursor = 0;
    juntas.forEach(([ini, fin]) => {
        if (ini > cursor) {
            salida.appendChild(document.createTextNode(original.slice(cursor, ini)));
        }
        const marca = document.createElement("mark");
        marca.textContent = original.slice(ini, fin);
        salida.appendChild(marca);
        cursor = fin;
    });
    if (cursor < original.length) {
        salida.appendChild(document.createTextNode(original.slice(cursor)));
    }
    return salida;
}
function pintarCuentaBusq(consulta) {
    const cuantos = BUSQ.encontrados.length;
    if (!cuantos) {
        decirBusq(`Ningún resultado para “${consulta}”.`);
        return;
    }
    decirBusq(
        cuantos === 1
            ? `1 resultado para “${consulta}”.`
            : `${cuantos} resultados para “${consulta}”.`
    );
}
function decirBusq(texto) {
    const sitio = document.querySelector("[data-buscar-resumen]");
    if (sitio) {
        sitio.textContent = texto;
    }
}
function sinResultadosBusq(consulta) {
    const caja = document.createElement("div");
    caja.className = "busq-nada";
    const uno = document.createElement("p");
    uno.textContent = `No he encontrado nada con “${consulta}”.`;
    caja.appendChild(uno);
    const dos = document.createElement("p");
    dos.textContent =
        "Prueba con una palabra sola, o con parte de ella: la búsqueda " +
        "mira trozos, así que “panad” encuentra “panadería”.";
    caja.appendChild(dos);
    const tres = document.createElement("p");
    const enlace = document.createElement("a");
    enlace.href = "/web/mapa/mapa.html";
    enlace.textContent = "el mapa del sitio";
    tres.appendChild(document.createTextNode("También puedes mirar "));
    tres.appendChild(enlace);
    tres.appendChild(document.createTextNode(", que lo lista todo."));
    caja.appendChild(tres);
    return caja;
}
