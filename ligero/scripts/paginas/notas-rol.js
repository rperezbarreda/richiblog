/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/notas-rol.js
*/
const NOTAS_LISTADO_URL = "/datos/notas_rol/notas-rol.json";
const NOTAS_COLORES = ["verde", "azul", "rojo", "morado"];
initializeNotasRol();
async function initializeNotasRol() {
    const lista = document.querySelector("[data-campana-sesiones]");
    if (!lista) {
        return;
    }
    const datos = (lista.getAttribute("data-campana-datos") || "").trim();
    if (!datos) {
        return;
    }
    let campana = null;
    let publicadas = {};
    try {
        const respuesta = await window.pedirDatos(datos);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        campana = await respuesta.json();
        publicadas = await leerSesionesPublicadas((campana.clave || "").trim());
    } catch (error) {
        lista.innerHTML =
            '<li class="entries-error">No se han podido cargar las sesiones ahora mismo.</li>';
        return;
    }
    pintarCabeceraCampana(campana);
    pintarFichaCampana(campana);
    prepararBotones(campana);
    pintarSesiones(lista, campana, publicadas);
}
async function leerSesionesPublicadas(clave) {
    const respuesta = await window.pedirDatos(NOTAS_LISTADO_URL);
    if (!respuesta.ok) {
        throw new Error("La respuesta no fue correcta");
    }
    const items = await respuesta.json();
    const mapa = {};
    (Array.isArray(items) ? items : []).forEach((item) => {
        if (!clave || (item.campana || "").trim() === clave) {
            mapa[sinExtensionNotas(item.url)] = item;
        }
    });
    return mapa;
}
function sinExtensionNotas(ruta) {
    return (ruta || "").trim().replace(/\.html$/, "").replace(/\/+$/, "");
}
function pintarCabeceraCampana(campana) {
    const nombre = document.querySelector("[data-campana-nombre]");
    if (nombre && (campana.nombre || "").trim()) {
        nombre.textContent = campana.nombre.trim();
    }
    const intro = document.querySelector("[data-campana-intro]");
    if (intro && (campana.intro || "").trim()) {
        intro.textContent = campana.intro.trim();
    }
}
function pintarFichaCampana(campana) {
    const ficha = document.querySelector("[data-campana-ficha]");
    if (!ficha || ficha.hidden) {
        return;
    }
    const gente = new Map(personajesDe(campana.personajes).map((p) => [p.nombre, p]));
    ficha.querySelectorAll(".campana-personaje-token[data-pj]").forEach((boton) => {
        const quien = gente.get(boton.getAttribute("data-pj"));
        if (!quien) {
            return;
        }
        boton.addEventListener("click", () => abrirLaFichaDeUnPj(quien, boton));
        const img = boton.querySelector("img[data-grande]");
        if (img) {
            const grande = imagenSeguraDeMesa(img.getAttribute("data-grande"));
            if (grande) {
                img.addEventListener("error", () => {
                    img.src = grande;
                }, { once: true });
            }
        }
    });
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
}
function personajesDe(crudos) {
    return (Array.isArray(crudos) ? crudos : [])
        .filter((p) => p && (p.nombre || "").toString().trim())
        .map((p) => ({
            nombre: p.nombre.toString().trim(),
            color: NOTAS_COLORES.indexOf(
                (p.color || "").toString().trim().toLowerCase()
            ) === -1
                ? ""
                : (p.color || "").toString().trim().toLowerCase(),
            extra: [
                [
                    (p.clase || "").toString().trim(),
                    Number(p.nivel) ? "nivel " + Number(p.nivel) : "",
                ]
                    .filter(Boolean)
                    .join(" "),
                (p.jugador || "").toString().trim()
                    ? "lo lleva " + p.jugador.toString().trim()
                    : "",
            ]
                .filter(Boolean)
                .join(" · "),
            clase: (p.clase || "").toString().trim(),
            nivel: Number(p.nivel) || 0,
            jugador: (p.jugador || "").toString().trim(),
            token: (p.token || "").toString().trim(),
            token_mini: (p.token_mini || "").toString().trim(),
            ilustracion: (p.ilustracion || "").toString().trim(),
            dndbeyond: (p.dndbeyond || "").toString().trim(),
            pdf: (p.pdf || "").toString().trim(),
            equipo: (Array.isArray(p.equipo) ? p.equipo : [])
                .map((c) => (c || "").toString().trim())
                .filter(Boolean),
            notas: (Array.isArray(p.notas) ? p.notas : [])
                .map((c) => (c || "").toString().trim())
                .filter(Boolean),
        }));
}
function abrirLaFichaDeUnPj(quien, devolverA) {
    window.ventanaModal.abrir({
        titulo: nombreDeArchivoMesa(quien.nombre) + ".nfo",
        clase: "modal-mesa",
        devolverA: devolverA,
        llenar: (cuerpo) => {
            const caja = document.createElement("div");
            caja.className = "mesa-ficha";
            caja.appendChild(fichaDeLaMesa(quien));
            cuerpo.appendChild(caja);
        },
    });
}
function nombreDeArchivoMesa(nombre) {
    return (nombre || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "ficha";
}
function prepararBotones(campana) {
    document.querySelectorAll(".campana-boton[data-por-ver]").forEach((b) => {
        b.removeAttribute("data-por-ver");
        b.hidden = true;
    });
    const cosas = cosasDelBotin(campana);
    const botonBotin = document.querySelector("[data-campana-botin-abrir]");
    if (botonBotin && cosas.length) {
        botonBotin.hidden = false;
        botonBotin.addEventListener("click", () =>
            window.ventanaModal.abrir({
                titulo: "botin.lst",
                clase: "modal-botin",
                devolverA: botonBotin,
                llenar: (cuerpo) => llenarElBotin(cuerpo, cosas),
            })
        );
    }
    const misiones = misionesDe(campana);
    const botonMisiones = document.querySelector("[data-campana-misiones-abrir]");
    if (botonMisiones && misiones.length) {
        botonMisiones.hidden = false;
        botonMisiones.addEventListener("click", () =>
            window.ventanaModal.abrir({
                titulo: "pendientes.txt",
                clase: "modal-misiones",
                devolverA: botonMisiones,
                llenar: (cuerpo) => llenarLasMisiones(cuerpo, misiones),
            })
        );
    }
}
function fichaDeLaMesa(quien) {
    const ficha = document.createDocumentFragment();
    const arte = document.createElement("div");
    arte.className = "mesa-arte";
    const foto = (quien.ilustracion || quien.token || "").trim();
    if (!foto) {
        arte.classList.add("sin-foto");
    }
    arte.appendChild(retratoDeMesa(foto, quien.nombre, "mesa-arte-img", "mesa-arte-mono"));
    const texto = document.createElement("div");
    texto.className = "mesa-texto";
    const titulo = document.createElement("h3");
    titulo.className = "mesa-nombre" + (quien.color ? " pj-" + quien.color : "");
    titulo.textContent = quien.nombre;
    texto.appendChild(titulo);
    if (quien.clase) {
        const linea = document.createElement("p");
        linea.className = "mesa-clase";
        linea.textContent = quien.clase;
        texto.appendChild(linea);
    }
    const datos = document.createElement("dl");
    datos.className = "mesa-datos";
    let hay = false;
    if (quien.nivel) {
        datos.appendChild(datoDeLaMesa("nivel", String(quien.nivel)));
        hay = true;
    }
    if (quien.jugador) {
        datos.appendChild(datoDeLaMesa("lo lleva", quien.jugador));
        hay = true;
    }
    if (hay) {
        texto.appendChild(datos);
    }
    if (quien.equipo.length) {
        texto.appendChild(tituloDeLaMesa("lo que lleva encima"));
        const lista = document.createElement("ul");
        lista.className = "mesa-equipo";
        quien.equipo.forEach((cosa) => {
            const li = document.createElement("li");
            li.textContent = cosa;
            lista.appendChild(li);
        });
        texto.appendChild(lista);
    }
    if (quien.notas.length) {
        texto.appendChild(tituloDeLaMesa("lo que hay que recordar"));
        const lista = document.createElement("ul");
        lista.className = "mesa-notas";
        quien.notas.forEach((nota) => {
            const li = document.createElement("li");
            li.textContent = nota;
            lista.appendChild(li);
        });
        texto.appendChild(lista);
    }
    const fichas = document.createElement("p");
    fichas.className = "mesa-fichas";
    if (quien.dndbeyond) {
        const fuera = document.createElement("a");
        fuera.className = "mesa-ficha-enlace";
        fuera.href = rutaSeguraNotas(quien.dndbeyond);
        fuera.target = "_blank";
        fuera.rel = "noopener noreferrer";
        fuera.textContent = "ficha en D&D Beyond";
        fichas.appendChild(fuera);
    }
    if (quien.pdf) {
        const pdf = document.createElement("a");
        pdf.className = "mesa-ficha-enlace";
        pdf.href = rutaSeguraNotas(quien.pdf);
        pdf.setAttribute("download", "");
        pdf.appendChild(document.createTextNode("ficha en PDF"));
        const icono = document.createElement("span");
        icono.className = "mesa-ficha-icono";
        icono.setAttribute("aria-hidden", "true");
        icono.textContent = "↓";
        pdf.appendChild(icono);
        fichas.appendChild(pdf);
    }
    if (fichas.childNodes.length) {
        texto.appendChild(fichas);
    }
    if (!hay && !quien.equipo.length && !quien.notas.length && !quien.clase
        && !fichas.childNodes.length) {
        const vacio = document.createElement("p");
        vacio.className = "campana-dato-vacio";
        vacio.textContent = "De éste no hay nada apuntado todavía.";
        texto.appendChild(vacio);
    }
    ficha.appendChild(arte);
    ficha.appendChild(texto);
    return ficha;
}
function datoDeLaMesa(nombre, valor) {
    const bloque = document.createElement("div");
    bloque.className = "mesa-dato";
    const dt = document.createElement("dt");
    dt.className = "mesa-dato-nombre";
    dt.textContent = nombre;
    bloque.appendChild(dt);
    const dd = document.createElement("dd");
    dd.className = "mesa-dato-valor";
    dd.textContent = valor;
    bloque.appendChild(dd);
    return bloque;
}
function tituloDeLaMesa(texto) {
    const titulo = document.createElement("h4");
    titulo.className = "mesa-apartado";
    titulo.textContent = texto;
    return titulo;
}
function retratoDeMesa(ruta, nombre, claseImg, claseMono, respaldo) {
    const limpia = imagenSeguraDeMesa(ruta);
    if (limpia) {
        const img = document.createElement("img");
        img.className = claseImg;
        img.src = limpia;
        const grande = imagenSeguraDeMesa(respaldo);
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
function imagenSeguraDeMesa(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^https?:\/\//i.test(limpia)) {
        return limpia;
    }
    return "";
}
const TIPOS_DE_BOTIN = [
    { nombre: "armas", alias: ["arma"] },
    { nombre: "armaduras", alias: ["armadura", "escudos", "escudo"] },
    { nombre: "pociones", alias: ["pocion", "pociones y hierbas", "curacion"] },
    { nombre: "pergaminos", alias: ["pergamino", "conjuros", "hechizos", "pergaminos de conjuro"] },
    { nombre: "equipo", alias: ["utiles", "util", "herramientas", "provisiones"] },
    {
        nombre: "objetos mágicos",
        alias: ["objeto magico", "objetos magicos", "magia", "magicos"],
    },
    { nombre: "dinero", alias: ["monedas", "oro", "tesoro"] },
    { nombre: "otras cosas", alias: ["otros", "otras", "varios", "sin clasificar"] },
];
const BOTIN_SIN_TIPO = "otras cosas";
function comoSeEscribeElTipo(texto) {
    return (texto || "")
        .toString()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
}
function cosasDelBotin(campana) {
    return (Array.isArray(campana.botin) ? campana.botin : []).filter(
        (c) => c && (c.que || "").toString().trim()
    );
}
function apartadoDeCosa(cosa) {
    const tipo = comoSeEscribeElTipo(cosa && cosa.tipo);
    if (!tipo) {
        return BOTIN_SIN_TIPO;
    }
    const encontrado = TIPOS_DE_BOTIN.find(
        (apartado) =>
            comoSeEscribeElTipo(apartado.nombre) === tipo ||
            (apartado.alias || []).some((otro) => comoSeEscribeElTipo(otro) === tipo)
    );
    return encontrado ? encontrado.nombre : BOTIN_SIN_TIPO;
}
function repartirElBotin(cosas) {
    const porApartado = new Map();
    cosas.forEach((cosa) => {
        const donde = apartadoDeCosa(cosa);
        if (!porApartado.has(donde)) {
            porApartado.set(donde, []);
        }
        porApartado.get(donde).push(cosa);
    });
    const apartados = TIPOS_DE_BOTIN.map((apartado) => ({
        nombre: apartado.nombre,
        cosas: porApartado.get(apartado.nombre) || [],
    })).filter((apartado) => apartado.cosas.length);
    porApartado.forEach((suyas, nombre) => {
        if (!TIPOS_DE_BOTIN.some((apartado) => apartado.nombre === nombre)) {
            apartados.push({ nombre: nombre, cosas: suyas });
        }
    });
    return apartados;
}
const BOTIN_TODAS = "todas";
function llenarElBotin(cuerpo, cosas) {
    const apartados = repartirElBotin(cosas);
    const gastadas = cosas.filter((cosa) => cosa && cosa.gastado).length;
    if (apartados.length > 1) {
        pestanasDelBotin(apartados, cuerpo);
    } else {
        const panel = document.createElement("div");
        panel.className = "campana-botin-panel";
        listaDeBotin(cosas, panel);
        cuerpo.appendChild(panel);
    }
    const pie = document.createElement("p");
    pie.className = "campana-botin-cuenta";
    pie.textContent =
        (cosas.length === 1 ? "1 cosa" : cosas.length + " cosas") +
        (gastadas
            ? " · " + gastadas + " gastada" + (gastadas === 1 ? "" : "s") +
              " · quedan " + (cosas.length - gastadas)
            : "");
    cuerpo.appendChild(pie);
}
function pestanasDelBotin(apartados, donde) {
    let juntas = [];
    apartados.forEach((apartado) => {
        juntas = juntas.concat(apartado.cosas);
    });
    const todas = [{ nombre: BOTIN_TODAS, cosas: juntas }].concat(apartados);
    const tira = document.createElement("div");
    tira.className = "campana-botin-pestanas";
    tira.setAttribute("role", "tablist");
    tira.setAttribute("aria-label", "Qué parte del botín se ve");
    const panel = document.createElement("div");
    panel.className = "campana-botin-panel";
    panel.id = "botin-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("tabindex", "0");
    const botones = todas.map((apartado, i) => {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "campana-botin-pestana";
        boton.setAttribute("role", "tab");
        boton.id = "botin-tab-" + i;
        boton.setAttribute("aria-controls", "botin-panel");
        boton.textContent = apartado.nombre;
        const cuantas = document.createElement("span");
        cuantas.className = "campana-botin-pestana-cuenta";
        cuantas.textContent = apartado.cosas.length;
        boton.appendChild(cuantas);
        return boton;
    });
    const elegir = (i, mover) => {
        botones.forEach((b, n) => {
            const suyo = n === i;
            b.setAttribute("aria-selected", suyo ? "true" : "false");
            b.tabIndex = suyo ? 0 : -1;
        });
        panel.setAttribute("aria-labelledby", "botin-tab-" + i);
        panel.textContent = "";
        if (i === 0) {
            apartados.forEach((apartado) => {
                const grupo = document.createElement("section");
                grupo.className = "campana-botin-grupo";
                const titulo = document.createElement("h3");
                titulo.className = "campana-botin-grupo-titulo";
                titulo.textContent = apartado.nombre;
                const cuantas = document.createElement("span");
                cuantas.className = "campana-botin-grupo-cuenta";
                cuantas.textContent =
                    apartado.cosas.length === 1 ? "1 cosa" : apartado.cosas.length + " cosas";
                titulo.appendChild(cuantas);
                grupo.appendChild(titulo);
                listaDeBotin(apartado.cosas, grupo);
                panel.appendChild(grupo);
            });
        } else {
            listaDeBotin(todas[i].cosas, panel);
        }
        panel.scrollTop = 0;
        if (mover) {
            botones[i].focus();
        }
    };
    botones.forEach((boton, i) => {
        boton.addEventListener("click", () => elegir(i, false));
        boton.addEventListener("keydown", (evento) => {
            const salto = { ArrowRight: 1, ArrowLeft: -1, Home: -99, End: 99 }[evento.key];
            if (salto === undefined) {
                return;
            }
            evento.preventDefault();
            const cuantos = botones.length;
            const siguiente =
                salto === -99 ? 0
                : salto === 99 ? cuantos - 1
                : (i + salto + cuantos) % cuantos;
            elegir(siguiente, true);
        });
        tira.appendChild(boton);
    });
    donde.appendChild(tira);
    donde.appendChild(panel);
    elegir(0, false);
}
function listaDeBotin(cosas, donde) {
    const lista = document.createElement("ul");
    lista.className = "campana-botin-lista";
    let gastadas = 0;
    cosas.forEach((cosa) => {
        const fila = document.createElement("li");
        fila.className = "campana-botin-cosa";
        const que = document.createElement("span");
        que.className = "campana-botin-que";
        que.textContent = cosa.que.toString().trim();
        fila.appendChild(que);
        const pie = document.createElement("span");
        pie.className = "campana-botin-donde";
        if (cosa.gastado) {
            fila.classList.add("esta-gastado");
            gastadas += 1;
            const marca = document.createElement("span");
            marca.className = "campana-botin-gastado";
            marca.textContent = "gastado";
            pie.appendChild(marca);
        }
        const numero = Number(cosa.de);
        if (numero) {
            pie.appendChild(trozoDeBotin("sesión " + numero));
        }
        const quien = (cosa.quien || "").toString().trim();
        if (quien) {
            const suyo = trozoDeBotin("lo lleva " + quien);
            suyo.classList.add("campana-botin-quien");
            pie.appendChild(suyo);
        }
        if (pie.childNodes.length) {
            fila.appendChild(pie);
        }
        const efecto = (cosa.efecto || "").toString().trim();
        if (efecto) {
            const caja = document.createElement("span");
            caja.className = "campana-botin-efecto";
            caja.textContent = efecto;
            fila.appendChild(caja);
        }
        const hechizo = hechizoDeCosa(cosa);
        if (hechizo) {
            fila.appendChild(hechizo);
        }
        const retrato = imagenSeguraDeMesa(cosa.imagen);
        if (retrato) {
            fila.classList.add("tiene-foto");
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "campana-botin-foto";
            boton.setAttribute("aria-haspopup", "dialog");
            boton.setAttribute(
                "aria-label", "Ver " + cosa.que.toString().trim() + " en grande");
            const img = document.createElement("img");
            img.className = "campana-botin-foto-img";
            img.src = imagenSeguraDeMesa(retrato);
            img.alt = "";
            img.loading = "lazy";
            img.decoding = "async";
            boton.appendChild(img);
            boton.addEventListener("click", () => window.lupa.abrir({
                ruta: retrato,
                texto: cosa.que.toString().trim(),
                que: "Imagen de",
                devolverA: boton,
            }));
            fila.insertBefore(boton, fila.firstChild);
        }
        lista.appendChild(fila);
    });
    donde.appendChild(lista);
    return gastadas;
}
const DATOS_DE_HECHIZO = [
    ["lanzamiento", "Lanzamiento"],
    ["alcance", "Alcance"],
    ["duracion", "Duración"],
    ["tirada", "Tirada"],
];
function hechizoDeCosa(cosa) {
    const texto = (clave) => (cosa[clave] === undefined || cosa[clave] === null ? "" : cosa[clave]).toString().trim();
    const descripcion = texto("descripcion");
    const datos = DATOS_DE_HECHIZO.filter(([clave]) => texto(clave));
    const nombre = texto("hechizo");
    if (!descripcion && !datos.length && !nombre) {
        return null;
    }
    const caja = document.createElement("details");
    caja.className = "campana-botin-hechizo";
    const tirador = document.createElement("summary");
    tirador.className = "campana-botin-hechizo-tirador";
    tirador.textContent = "Qué hace" + (nombre ? " «" + nombre + "»" : "");
    caja.appendChild(tirador);
    const nivel = texto("nivel");
    const linea = [
        nivel === "" ? "" : (Number(nivel) === 0 ? "Truco" : "Nivel " + nivel),
        texto("escuela"),
    ].filter(Boolean).join(" · ");
    if (linea) {
        const p = document.createElement("p");
        p.className = "campana-botin-hechizo-nivel";
        p.textContent = linea;
        caja.appendChild(p);
    }
    if (datos.length) {
        const lista = document.createElement("dl");
        lista.className = "campana-botin-hechizo-datos";
        datos.forEach(([clave, rotulo]) => {
            const fila = document.createElement("div");
            const dt = document.createElement("dt");
            dt.textContent = rotulo;
            const dd = document.createElement("dd");
            dd.textContent = texto(clave);
            fila.appendChild(dt);
            fila.appendChild(dd);
            lista.appendChild(fila);
        });
        caja.appendChild(lista);
    }
    descripcion.split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((parrafo) => {
        const p = document.createElement("p");
        p.className = "campana-botin-hechizo-texto";
        p.textContent = parrafo;
        caja.appendChild(p);
    });
    return caja;
}
function trozoDeBotin(texto) {
    const trozo = document.createElement("span");
    trozo.className = "campana-botin-trozo";
    trozo.textContent = texto;
    return trozo;
}
function estadoDeMision(cosa) {
    const estado = (cosa.estado || "").toString().trim().toLowerCase();
    if (estado === "completada" || estado === "fallada") {
        return estado;
    }
    return cosa.hecha ? "completada" : "pendiente";
}
function extrasDeMision(trozos) {
    const hay = trozos.filter(Boolean);
    if (!hay.length) {
        return null;
    }
    const extra = document.createElement("span");
    extra.className = "misiones-extra";
    extra.textContent = hay.join(" · ");
    return extra;
}
function sesionesDeMision(cosa) {
    const de = Number(cosa.de);
    const hasta = Number(cosa.hasta);
    if (de && hasta && de !== hasta) {
        return "sesiones " + de + " a " + hasta;
    }
    if (hasta) {
        return "sesión " + hasta;
    }
    return de ? "desde la sesión " + de : "";
}
function misionesDe(campana) {
    return (Array.isArray(campana.misiones) ? campana.misiones : [])
        .map((apartado) => ({
            nombre: (apartado && apartado.nombre ? apartado.nombre : "")
                .toString().trim(),
            cosas: (Array.isArray(apartado && apartado.cosas) ? apartado.cosas : [])
                .filter((c) => c && (c.que || "").toString().trim())
                .map((c) => Object.assign({}, c, { estado: estadoDeMision(c) })),
        }))
        .filter((apartado) => apartado.cosas.length);
}
function llenarLasMisiones(cuerpo, misiones) {
    const nota = document.createElement("div");
    nota.className = "cuaderno-postit misiones-nota";
    let pendientes = 0;
    const cerradas = [];
    misiones.forEach((apartado) => {
        apartado.cosas.filter((c) => c.estado !== "pendiente")
            .forEach((c) => cerradas.push(Object.assign({ apartado: apartado.nombre }, c)));
        const abiertas = apartado.cosas.filter((c) => c.estado === "pendiente");
        if (!abiertas.length) {
            return;
        }
        const caja = document.createElement("details");
        caja.className = "misiones-apartado";
        caja.open = true;
        const tirador = document.createElement("summary");
        tirador.className = "misiones-tirador";
        const titulo = document.createElement("h3");
        titulo.className = "misiones-titulo";
        const flecha = document.createElement("span");
        flecha.className = "misiones-flecha";
        flecha.setAttribute("aria-hidden", "true");
        flecha.textContent = "▾";
        titulo.appendChild(flecha);
        const nombre = document.createElement("span");
        nombre.textContent = apartado.nombre || "sin apartado";
        titulo.appendChild(nombre);
        const quedan = abiertas.length;
        pendientes += quedan;
        const cuenta = document.createElement("span");
        cuenta.className = "misiones-cuenta";
        cuenta.textContent = quedan === 1 ? "queda 1" : "quedan " + quedan;
        titulo.appendChild(cuenta);
        tirador.appendChild(titulo);
        caja.appendChild(tirador);
        const lista = document.createElement("ul");
        lista.className = "cuaderno-tareas";
        abiertas.forEach((cosa) => {
            const fila = document.createElement("li");
            fila.appendChild(document.createTextNode(cosa.que.toString().trim()));
            const numero = Number(cosa.de);
            if (numero) {
                fila.appendChild(document.createTextNode(" "));
                const de = document.createElement("span");
                de.className = "misiones-de";
                de.textContent = "sesión " + numero;
                fila.appendChild(de);
            }
            const extra = extrasDeMision([
                cosa.quien ? "lo pide " + cosa.quien.toString().trim() : "",
                cosa.recompensa ? "recompensa: " + cosa.recompensa.toString().trim() : "",
            ]);
            if (extra) {
                fila.appendChild(extra);
            }
            lista.appendChild(fila);
        });
        caja.appendChild(lista);
        nota.appendChild(caja);
    });
    const pie = document.createElement("p");
    pie.className = "misiones-pie";
    pie.textContent = pendientes === 0
        ? "No queda nada pendiente."
        : (pendientes === 1 ? "Queda 1 cosa por hacer."
            : "Quedan " + pendientes + " cosas por hacer.");
    nota.appendChild(pie);
    if (cerradas.length) {
        nota.appendChild(historicoDeMisiones(cerradas));
    }
    cuerpo.appendChild(nota);
}
function historicoDeMisiones(cerradas) {
    const hechas = cerradas.filter((c) => c.estado === "completada").length;
    const falladas = cerradas.length - hechas;
    const caja = document.createElement("details");
    caja.className = "misiones-historico";
    const tirador = document.createElement("summary");
    tirador.className = "misiones-tirador";
    const titulo = document.createElement("h3");
    titulo.className = "misiones-titulo";
    const flecha = document.createElement("span");
    flecha.className = "misiones-flecha";
    flecha.setAttribute("aria-hidden", "true");
    flecha.textContent = "▾";
    titulo.appendChild(flecha);
    const nombre = document.createElement("span");
    nombre.textContent = "el histórico";
    titulo.appendChild(nombre);
    const cuenta = document.createElement("span");
    cuenta.className = "misiones-cuenta";
    cuenta.textContent = [
        hechas ? hechas + (hechas === 1 ? " completada" : " completadas") : "",
        falladas ? falladas + (falladas === 1 ? " fallida" : " fallidas") : "",
    ].filter(Boolean).join(" · ");
    titulo.appendChild(cuenta);
    tirador.appendChild(titulo);
    caja.appendChild(tirador);
    const lista = document.createElement("ul");
    lista.className = "misiones-hechas";
    cerradas
        .map((c, i) => ({ c, i }))
        .sort((a, b) => (Number(b.c.hasta) || 0) - (Number(a.c.hasta) || 0) || a.i - b.i)
        .forEach(({ c }) => {
            const fallada = c.estado === "fallada";
            const fila = document.createElement("li");
            fila.className = "misiones-hecha" + (fallada ? " es-fallada" : "");
            const marca = document.createElement("span");
            marca.className = "misiones-marca";
            marca.setAttribute("aria-hidden", "true");
            marca.textContent = fallada ? "✗" : "✓";
            fila.appendChild(marca);
            const que = document.createElement("span");
            que.className = "misiones-que";
            que.textContent = c.que.toString().trim();
            fila.appendChild(que);
            const obtenida = (c.obtenida || "").toString().trim();
            const prometida = (c.recompensa || "").toString().trim();
            let premio = "";
            if (obtenida) {
                premio = "recompensa: " + obtenida;
            } else if (fallada && prometida) {
                premio = "se perdió: " + prometida;
            } else if (!fallada) {
                premio = "sin recompensa";
            }
            const extra = extrasDeMision([
                fallada ? "fallida" : "completada",
                sesionesDeMision(c),
                c.apartado,
                c.quien ? "la pidió " + c.quien.toString().trim() : "",
                premio,
            ]);
            fila.appendChild(extra);
            lista.appendChild(fila);
        });
    caja.appendChild(lista);
    return caja;
}
function pintarSesiones(lista, campana, publicadas) {
    const sesiones = (Array.isArray(campana.sesiones) ? campana.sesiones : [])
        .map((sesion) => {
            const publicada = publicadas[sinExtensionNotas(sesion && sesion.url)];
            if (!publicada) {
                return Object.assign({}, sesion, { hecha: false });
            }
            return Object.assign({}, sesion, {
                titulo: publicada.title || sesion.titulo,
                fecha: publicada.date || sesion.fecha,
                hecha: true,
            });
        })
        .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
    if (!sesiones.length) {
        lista.innerHTML =
            '<li class="entries-empty">Todavía no hay notas de esta campaña.</li>';
        return;
    }
    lista.innerHTML = sesiones.map(filaDeSesion).join("");
}
function filaDeSesion(sesion) {
    const numero = Number(sesion.numero) || 0;
    const titulo = (sesion.titulo || "").trim();
    const fecha = (sesion.fecha || "").trim();
    const hecha = !!sesion.hecha;
    const corto = titulo
        .replace(/^\s*sesi[oó]n\s*\d+\s*(?:[·.:\-–—]\s*)?/i, "")
        .trim();
    const dentro =
        '<span class="campana-sesion-meta">' +
        `<span class="campana-sesion-num">sesión ${escaparHtmlNotas(numero)}</span>` +
        (fecha
            ? `<span class="campana-sesion-fecha">${escaparHtmlNotas(fecha)}</span>`
            : "") +
        (hecha
            ? ""
            : '<span class="campana-sesion-aviso">sin publicar</span>') +
        "</span>" +
        `<span class="campana-sesion-titulo">${escaparHtmlNotas(corto)}</span>`;
    const nombre =
        `Sesión ${numero}` +
        (corto ? ", " + corto : "") +
        (fecha ? ", " + fecha : "") +
        (hecha ? "" : ". Todavía sin publicar");
    if (!hecha) {
        return (
            "<li>" +
            `<span class="campana-sesion is-pendiente" aria-label="${escaparHtmlNotas(nombre)}">` +
            dentro +
            "</span></li>"
        );
    }
    return (
        "<li>" +
        `<a class="campana-sesion" href="${escaparHtmlNotas(rutaSeguraNotas(sesion.url))}"` +
        ` aria-label="${escaparHtmlNotas(nombre)}">` +
        dentro +
        "</a></li>"
    );
}
function escaparHtmlNotas(texto) {
    return (texto === null || texto === undefined ? "" : texto.toString())
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function rutaSeguraNotas(url) {
    const limpia = (url || "").trim();
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
