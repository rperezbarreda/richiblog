/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/npcs-rol.js
*/
const NPC_TONOS = {
    aliado: "es-bueno",
    aliada: "es-bueno",
    amigo: "es-bueno",
    amiga: "es-bueno",
    vivo: "es-bueno",
    viva: "es-bueno",
    neutral: "es-normal",
    enemigo: "es-malo",
    enemiga: "es-malo",
    muerto: "es-malo",
    muerta: "es-malo",
    desaparecido: "es-raro",
    desaparecida: "es-raro",
};
const NPC_FUERA = ["muerto", "muerta", "desaparecido", "desaparecida"];
const npcTokensPorSlug = new Map();
initializeNpcsRol();
async function initializeNpcsRol() {
    const lista = document.querySelector("[data-npcs-lista]");
    if (!lista) {
        return;
    }
    const fuente = (lista.getAttribute("data-npcs-datos") || "").trim();
    if (!fuente || typeof window.pedirDatos !== "function") {
        return;
    }
    let datos = null;
    try {
        const respuesta = await window.pedirDatos(fuente);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        datos = await respuesta.json();
    } catch (error) {
        lista.innerHTML =
            '<li class="entries-error">No se ha podido cargar el reparto ahora mismo.</li>';
        return;
    }
    const deLaCampana = (lista.getAttribute("data-campana-datos") || "").trim();
    if (deLaCampana) {
        try {
            const respuesta = await window.pedirDatos(deLaCampana);
            if (respuesta.ok) {
                const campana = await respuesta.json();
                datos.sesiones = campana.sesiones;
                if (!(datos.campana_pagina || "").trim()) {
                    datos.campana_pagina = campana.pagina;
                }
                if (!(datos.nombre || "").trim()) {
                    datos.nombre = campana.nombre;
                }
            }
        } catch (error) {
        }
    }
    pintarCabeceraNpc(datos);
    pintarGruposNpc(lista, datos);
    abrirElDeLaDireccion();
}
function pintarCabeceraNpc(datos) {
    const nombre = document.querySelector("[data-npcs-nombre]");
    if (nombre && (datos.nombre || "").trim()) {
        nombre.textContent = datos.nombre.trim();
    }
    const intro = document.querySelector("[data-npcs-intro]");
    if (intro && (datos.intro || "").trim()) {
        intro.textContent = datos.intro.trim();
    }
    const volver = document.querySelector("[data-npcs-volver]");
    const campana = rutaSeguraNpc(datos.campana_pagina);
    if (volver && campana !== "#") {
        volver.setAttribute("href", campana);
    }
}
function gruposDeNpc(quien) {
    const crudo = quien.categorias !== undefined ? quien.categorias : quien.categoria;
    const lista = (Array.isArray(crudo) ? crudo : [crudo])
        .map((c) => (c || "").toString().trim())
        .filter(Boolean);
    return [...new Set(lista.length ? lista : ["sin clasificar"])];
}
function pintarGruposNpc(lista, datos) {
    const gente = (Array.isArray(datos.personajes) ? datos.personajes : []).filter(
        (p) => p && (p.nombre || "").toString().trim()
    );
    lista.textContent = "";
    npcTokensPorSlug.clear();
    if (!gente.length) {
        const vacio = document.createElement("li");
        vacio.className = "entries-empty";
        vacio.textContent = "Todavía no hay nadie apuntado en esta campaña.";
        lista.appendChild(vacio);
        return;
    }
    const orden = [];
    const porGrupo = new Map();
    gente.forEach((quien) => {
        gruposDeNpc(quien).forEach((grupo) => {
            if (!porGrupo.has(grupo)) {
                porGrupo.set(grupo, []);
                orden.push(grupo);
            }
            porGrupo.get(grupo).push(quien);
        });
    });
    repartirPorApartadosNpc(lista, orden, porGrupo, datos);
    document.dispatchEvent(new CustomEvent("filtros:actualizar"));
}
function apartadosDeNpc(datos) {
    const crudos = Array.isArray(datos.apartados) ? datos.apartados : [];
    return crudos
        .map((uno) => ({
            nombre: (uno && uno.nombre ? uno.nombre : "").toString().trim(),
            categorias: (Array.isArray(uno && uno.categorias) ? uno.categorias : [])
                .map((c) => (c || "").toString().trim())
                .filter(Boolean),
        }))
        .filter((uno) => uno.nombre && uno.categorias.length);
}
function repartirPorApartadosNpc(lista, orden, porGrupo, datos) {
    const apartados = apartadosDeNpc(datos);
    const colocadas = new Set();
    apartados.forEach((apartado) => {
        const suyas = apartado.categorias.filter((c) => porGrupo.has(c));
        if (!suyas.length) {
            return;
        }
        suyas.forEach((c) => colocadas.add(c));
        lista.appendChild(bloqueDeApartadoNpc(apartado, suyas, porGrupo, datos));
    });
    orden.forEach((grupo) => {
        if (colocadas.has(grupo)) {
            return;
        }
        lista.appendChild(bloqueDeGrupoNpc(grupo, porGrupo.get(grupo), datos, 2));
    });
}
function bloqueDeApartadoNpc(apartado, categorias, porGrupo, datos) {
    const bloque = document.createElement("li");
    bloque.className = "npc-apartado";
    bloque.setAttribute("data-npc-apartado", apartado.nombre);
    const caja = document.createElement("details");
    caja.className = "npc-apartado-caja";
    caja.open = !NPC_CERRADOS.has(apartado.nombre);
    caja.addEventListener("toggle", () => recordarApartadoNpc(bloque, caja));
    const tirador = document.createElement("summary");
    tirador.className = "npc-apartado-tirador";
    const titulo = document.createElement("h2");
    titulo.className = "npc-apartado-titulo";
    const flecha = document.createElement("span");
    flecha.className = "npc-apartado-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "▾";
    titulo.appendChild(flecha);
    const nombre = document.createElement("span");
    nombre.textContent = apartado.nombre;
    titulo.appendChild(nombre);
    const cuenta = document.createElement("span");
    cuenta.className = "npc-grupo-cuenta";
    cuenta.setAttribute("data-npc-cuenta-apartado", "");
    titulo.appendChild(cuenta);
    tirador.appendChild(titulo);
    caja.appendChild(tirador);
    const dentro = document.createElement("ul");
    dentro.className = "npc-apartado-grupos";
    const llano = (texto) => (texto || "").toString().trim().toLowerCase();
    const comoElApartado = categorias.filter((c) => llano(c) === llano(apartado.nombre));
    const lasDemas = categorias.filter((c) => llano(c) !== llano(apartado.nombre));
    [...comoElApartado, ...lasDemas].forEach((grupo) => {
        const sinTitulo = llano(grupo) === llano(apartado.nombre) || categorias.length === 1;
        dentro.appendChild(bloqueDeGrupoNpc(grupo, porGrupo.get(grupo), datos, 3, sinTitulo));
    });
    caja.appendChild(dentro);
    bloque.appendChild(caja);
    return bloque;
}
const NPC_CERRADOS = leerCerradosNpc();
function leerCerradosNpc() {
    try {
        const crudo = window.localStorage.getItem("richi-npc-cerrados");
        return new Set(crudo ? JSON.parse(crudo) : []);
    } catch (error) {
        return new Set();
    }
}
function recordarApartadoNpc(bloque, caja) {
    const nombre = bloque.getAttribute("data-npc-apartado");
    if (bloque.hasAttribute("data-npc-forzado")) {
        return;
    }
    if (caja.open) {
        NPC_CERRADOS.delete(nombre);
    } else {
        NPC_CERRADOS.add(nombre);
    }
    try {
        window.localStorage.setItem("richi-npc-cerrados", JSON.stringify([...NPC_CERRADOS]));
    } catch (error) {
    }
}
function bloqueDeGrupoNpc(grupo, gente, datos, nivel, sinTitulo) {
    const bloque = document.createElement("li");
    bloque.className = "npc-grupo";
    bloque.setAttribute("data-npc-grupo", grupo);
    const titulo = document.createElement(nivel === 3 ? "h3" : "h2");
    titulo.className = "npc-grupo-titulo";
    if (nivel === 3) {
        titulo.classList.add("es-de-dentro");
    }
    const nombre = document.createElement("span");
    nombre.textContent = grupo;
    titulo.appendChild(nombre);
    const cuenta = document.createElement("span");
    cuenta.className = "npc-grupo-cuenta";
    cuenta.setAttribute("data-npc-cuenta", "");
    titulo.appendChild(cuenta);
    if (sinTitulo) {
        titulo.classList.add("visually-hidden");
    }
    bloque.appendChild(titulo);
    const rejilla = document.createElement("ul");
    rejilla.className = "npc-rejilla";
    gente.forEach((quien) => {
        const celda = document.createElement("li");
        celda.className = "npc-celda";
        celda.setAttribute("data-categoria", grupo);
        celda.setAttribute("data-npc-quien", (quien.nombre || "").toString().trim());
        celda.appendChild(tokenDeNpc(quien, datos));
        rejilla.appendChild(celda);
    });
    bloque.appendChild(rejilla);
    return bloque;
}
function tokenDeNpc(quien, datos) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "npc-token";
    boton.setAttribute("aria-haspopup", "dialog");
    const estado = (quien.estado || "").toString().trim().toLowerCase();
    if (NPC_FUERA.indexOf(estado) !== -1) {
        boton.classList.add("esta-fuera");
    }
    const marco = document.createElement("span");
    marco.className = "npc-token-marco";
    marco.appendChild(
        retratoNpc(quien.token_mini || quien.token, quien.nombre, "npc-token-img",
            "npc-token-mono", quien.token)
    );
    boton.appendChild(marco);
    const nombre = document.createElement("span");
    nombre.className = "npc-token-nombre";
    nombre.textContent = quien.nombre.toString().trim();
    boton.appendChild(nombre);
    const que = (quien.que || "").toString().trim();
    if (que) {
        const linea = document.createElement("span");
        linea.className = "npc-token-que";
        linea.textContent = que;
        boton.appendChild(linea);
    }
    const trozos = [quien.nombre.toString().trim()];
    if (que) {
        trozos.push(que);
    }
    if (estado) {
        trozos.push(estado);
    }
    boton.setAttribute("aria-label", trozos.join(", ") + ". Abre su ficha");
    boton.addEventListener("click", () => abrirFichaNpc(quien, datos, boton));
    const slug = nombreDeArchivoNpc(quien.nombre.toString().trim());
    if (!npcTokensPorSlug.has(slug)) {
        npcTokensPorSlug.set(slug, { boton: boton, quien: quien, datos: datos });
    }
    return boton;
}
function retratoNpc(ruta, nombre, claseImg, claseMono, respaldo) {
    const limpia = imagenSeguraNpc(ruta);
    if (limpia) {
        const img = document.createElement("img");
        img.className = claseImg;
        img.src = limpia;
        const grande = imagenSeguraNpc(respaldo);
        if (grande && grande !== limpia) {
            img.addEventListener("error", () => {
                img.src = grande;
            }, { once: true });
        }
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        return img;
    }
    const mono = document.createElement("span");
    mono.className = claseMono;
    mono.setAttribute("aria-hidden", "true");
    mono.textContent = (nombre || "?").toString().trim().charAt(0).toUpperCase();
    return mono;
}
document.addEventListener("filtros:cambiado", repasarGruposNpc);
document.addEventListener("filtros:actualizar", repasarGruposNpc);
function repasarGruposNpc() {
    document.querySelectorAll(".npc-grupo").forEach((grupo) => {
        const celdas = [...grupo.querySelectorAll(".npc-celda")];
        const vivas = celdas.filter((celda) => !celda.hidden).length;
        grupo.hidden = vivas === 0;
        const cuenta = grupo.querySelector("[data-npc-cuenta]");
        if (cuenta) {
            cuenta.textContent = vivas === 1 ? "1 ficha" : vivas + " fichas";
        }
    });
    const rebuscando = !!(window.buscador && window.buscador.texto)
        || [...document.querySelectorAll(".filtro-btn")]
            .some((b) => b.getAttribute("aria-pressed") === "true"
                && b.getAttribute("data-categoria") !== "todas");
    document.querySelectorAll(".npc-apartado").forEach((apartado) => {
        const celdas = [...apartado.querySelectorAll(".npc-celda")]
            .filter((celda) => !celda.hidden);
        const cuantos = new Set(celdas.map((celda) => celda.getAttribute("data-npc-quien"))).size;
        apartado.hidden = cuantos === 0;
        const cuenta = apartado.querySelector("[data-npc-cuenta-apartado]");
        if (cuenta) {
            cuenta.textContent = cuantos === 1 ? "1 ficha" : cuantos + " fichas";
        }
        const caja = apartado.querySelector(".npc-apartado-caja");
        if (!caja) {
            return;
        }
        if (rebuscando && cuantos && !caja.open) {
            apartado.setAttribute("data-npc-forzado", "");
            caja.open = true;
        } else if (!rebuscando && apartado.hasAttribute("data-npc-forzado")) {
            caja.open = false;
            apartado.removeAttribute("data-npc-forzado");
        }
    });
}
function rutaSeguraNpc(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
function imagenSeguraNpc(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}
function abrirFichaNpc(quien, datos, boton) {
    const nombre = quien.nombre.toString().trim();
    window.ventanaModal.abrir({
        titulo: nombreDeArchivoNpc(nombre) + ".nfo",
        clase: "modal-npc",
        devolverA: boton,
        llenar: (cuerpo) => {
            const dos = document.createElement("div");
            dos.className = "npc-ficha-dos";
            const foto = (quien.ilustracion || quien.token || "").toString().trim();
            const limpia = imagenSeguraNpc(foto);
            const arte = document.createElement(limpia ? "button" : "div");
            arte.className = "npc-visor-arte";
            if (limpia) {
                arte.type = "button";
                arte.classList.add("es-pulsable");
                arte.setAttribute("aria-label", "Ver el retrato de " + nombre + " en grande");
                arte.addEventListener("click", () => window.lupa.abrir({
                    ruta: limpia,
                    texto: nombre,
                    que: "Retrato de",
                    devolverA: arte,
                }));
            } else {
                arte.classList.add("sin-foto");
            }
            arte.appendChild(
                retratoNpc(foto, nombre, "npc-visor-arte-img", "npc-visor-arte-mono")
            );
            dos.appendChild(arte);
            dos.appendChild(fichaDeNpc(quien, nombre, datos));
            cuerpo.appendChild(dos);
        },
    });
}
function nombreDeArchivoNpc(nombre) {
    return nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "ficha";
}
function fichaDeNpc(quien, nombre, datos) {
    const ficha = document.createElement("div");
    ficha.className = "npc-visor-ficha";
    const titulo = document.createElement("h3");
    titulo.className = "npc-visor-nombre";
    titulo.textContent = nombre;
    ficha.appendChild(titulo);
    const que = (quien.que || "").toString().trim();
    if (que) {
        const linea = document.createElement("p");
        linea.className = "npc-visor-que";
        linea.textContent = que;
        ficha.appendChild(linea);
    }
    const datosLista = document.createElement("dl");
    datosLista.className = "npc-datos";
    let hayDatos = false;
    const donde = (quien.donde || "").toString().trim();
    if (donde) {
        datosLista.appendChild(datoDeNpc("residencia", textoNpc(donde)));
        hayDatos = true;
    }
    const relacion = (quien.relacion || "").toString().trim();
    if (relacion) {
        datosLista.appendChild(datoDeNpc("actitud con el grupo", marcaDeNpc(relacion)));
        hayDatos = true;
    }
    const estado = (quien.estado || "").toString().trim();
    if (estado) {
        datosLista.appendChild(datoDeNpc("estado", marcaDeNpc(estado)));
        hayDatos = true;
    }
    const grupos = gruposDeNpc(quien);
    if (grupos.length) {
        datosLista.appendChild(
            datoDeNpc(grupos.length === 1 ? "grupo" : "grupos", textoNpc(enListaNpc(grupos)))
        );
        hayDatos = true;
    }
    const primera = enlaceDePrimeraNpc(quien, datos);
    if (primera) {
        datosLista.appendChild(datoDeNpc("se le conoció en", primera));
        hayDatos = true;
    }
    if (hayDatos) {
        ficha.appendChild(datosLista);
    }
    const notas = (Array.isArray(quien.notas) ? quien.notas : [])
        .map((n) => (n || "").toString().trim())
        .filter(Boolean);
    if (notas.length) {
        const lista = document.createElement("ul");
        lista.className = "npc-visor-notas";
        notas.forEach((n) => {
            const li = document.createElement("li");
            li.textContent = n;
            lista.appendChild(li);
        });
        ficha.appendChild(lista);
    } else if (!hayDatos) {
        const vacio = document.createElement("p");
        vacio.className = "npc-vacio";
        vacio.textContent = "Todavía no hemos apuntado nada de esta persona.";
        ficha.appendChild(vacio);
    }
    return ficha;
}
function enListaNpc(cosas) {
    if (cosas.length <= 1) {
        return cosas[0] || "";
    }
    return cosas.slice(0, -1).join(", ") + " y " + cosas[cosas.length - 1];
}
function datoDeNpc(nombre, valor) {
    const bloque = document.createElement("div");
    bloque.className = "npc-dato";
    const dt = document.createElement("dt");
    dt.className = "npc-dato-nombre";
    dt.textContent = nombre;
    bloque.appendChild(dt);
    const dd = document.createElement("dd");
    dd.className = "npc-dato-valor";
    dd.appendChild(valor);
    bloque.appendChild(dd);
    return bloque;
}
function textoNpc(cadena) {
    return document.createTextNode(cadena);
}
function marcaDeNpc(palabra) {
    const caja = document.createElement("span");
    caja.className = "npc-marca " + (NPC_TONOS[palabra.toLowerCase()] || "");
    const punto = document.createElement("span");
    punto.className = "npc-marca-punto";
    punto.setAttribute("aria-hidden", "true");
    caja.appendChild(punto);
    caja.appendChild(document.createTextNode(palabra));
    return caja;
}
function enlaceDePrimeraNpc(quien, datos) {
    const numero = Number(quien.primera);
    if (!numero) {
        return null;
    }
    const sesiones = Array.isArray(datos.sesiones) ? datos.sesiones : [];
    const suya = sesiones.filter((s) => Number(s && s.numero) === numero)[0];
    const url = suya ? (suya.url || "").toString().trim() : "";
    if (!url || !/^\//.test(url)) {
        return textoNpc("Sesión " + numero);
    }
    const enlace = document.createElement("a");
    enlace.className = "npc-visor-primera";
    enlace.href = rutaSeguraNpc(url);
    enlace.textContent = "Sesión " + numero;
    return enlace;
}
function abrirElDeLaDireccion() {
    let pedido = "";
    try {
        pedido = new URLSearchParams(window.location.search).get("quien") || "";
    } catch (error) {
        return;
    }
    if (!pedido.trim()) {
        return;
    }
    const suyo = npcTokensPorSlug.get(nombreDeArchivoNpc(pedido));
    if (!suyo) {
        return;
    }
    const celda = suyo.boton.closest(".npc-celda");
    if (celda && celda.hidden) {
        const todas = document.querySelector('[data-filtros] [data-categoria="todas"]');
        if (todas) {
            todas.click();
        }
    }
    const escondido = !!(celda && celda.hidden);
    if (!escondido) {
        try {
            suyo.boton.scrollIntoView({ block: "center", behavior: "auto" });
        } catch (error) {
            suyo.boton.scrollIntoView();
        }
    }
    abrirFichaNpc(suyo.quien, suyo.datos, escondido ? null : suyo.boton);
}
