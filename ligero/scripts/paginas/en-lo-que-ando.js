/* Copia sin comentarios. La escribe actualizar-cabeceras.py: no se edita.
   fuente: /scripts/paginas/en-lo-que-ando.js
*/
const ANDO_SESIONES_URL = "/datos/notas_rol/notas-rol.json";
initializeEnLoQueAndo();
async function initializeEnLoQueAndo() {
    const pagina = document.querySelector("[data-ando-datos]");
    if (!pagina || typeof window.pedirDatos !== "function") {
        return;
    }
    const fuente = (pagina.getAttribute("data-ando-datos") || "").trim();
    if (!fuente) {
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
        const aviso = document.querySelector("[data-ando-vacio]");
        if (aviso) {
            aviso.textContent = "No se ha podido cargar esto ahora mismo.";
            aviso.hidden = false;
        }
        return;
    }
    cabeceraDeAndo(datos);
    let puestos = 0;
    puestos += pintarAhora(datos) ? 1 : 0;
    puestos += (await pintarLaPartida()) ? 1 : 0;
    puestos += pintarEscribiendo(datos) ? 1 : 0;
    puestos += pintarPendientes(datos) ? 1 : 0;
    document.dispatchEvent(new CustomEvent("ventanas:actualizar"));
    const vacio = document.querySelector("[data-ando-vacio]");
    if (vacio && !puestos) {
        vacio.hidden = false;
    }
}
function cabeceraDeAndo(datos) {
    const intro = document.querySelector("[data-ando-intro]");
    if (intro && (datos.intro || "").toString().trim()) {
        intro.textContent = datos.intro.toString().trim();
    }
    const fecha = document.querySelector("[data-ando-fecha]");
    const cuando = (datos.actualizado || "").toString().trim();
    if (fecha && cuando) {
        fecha.textContent = "última vez que toqué esto: " + cuando;
        fecha.hidden = false;
    }
}
function pintarAhora(datos) {
    const caja = document.querySelector("[data-ando-ahora]");
    const cuerpo = document.querySelector("[data-ando-ahora-cuerpo]");
    if (!caja || !cuerpo) {
        return false;
    }
    const cosas = (Array.isArray(datos.ahora) ? datos.ahora : []).filter(
        (c) => c && (c.titulo || "").toString().trim()
    );
    if (!cosas.length) {
        return false;
    }
    cuerpo.textContent = "";
    const lista = document.createElement("dl");
    lista.className = "ando-lista";
    cosas.forEach((cosa) => {
        const bloque = document.createElement("div");
        bloque.className = "ando-cosa";
        const que = document.createElement("dt");
        que.className = "ando-cosa-que";
        que.textContent = (cosa.que || "ahora mismo").toString().trim();
        bloque.appendChild(que);
        const valor = document.createElement("dd");
        valor.className = "ando-cosa-valor";
        valor.appendChild(tituloDeAndo(cosa));
        const de = (cosa.de || "").toString().trim();
        if (de) {
            const autor = document.createElement("span");
            autor.className = "ando-cosa-de";
            autor.textContent = de;
            valor.appendChild(autor);
        }
        const barra = barraDeAndo(cosa);
        if (barra) {
            valor.appendChild(barra);
        }
        const nota = (cosa.nota || "").toString().trim();
        if (nota) {
            const linea = document.createElement("p");
            linea.className = "ando-cosa-nota";
            linea.textContent = nota;
            valor.appendChild(linea);
        }
        bloque.appendChild(valor);
        lista.appendChild(bloque);
    });
    cuerpo.appendChild(lista);
    caja.hidden = false;
    return true;
}
const ANDO_VERBOS = {
    leyendo: "leído",
    viendo: "visto",
    jugando: "jugado",
    escuchando: "escuchado",
};
function barraDeAndo(cosa) {
    const puesto = cosa.porcentaje;
    if (puesto === null || puesto === undefined || puesto === "") {
        return null;
    }
    const crudo = Number(puesto);
    if (!Number.isFinite(crudo)) {
        return null;
    }
    const cuanto = Math.max(0, Math.min(100, Math.round(crudo)));
    const caja = document.createElement("div");
    caja.className = "ando-barra";
    const riel = document.createElement("span");
    riel.className = "ando-barra-riel";
    riel.setAttribute("aria-hidden", "true");
    const lleno = document.createElement("span");
    lleno.className = "ando-barra-lleno";
    lleno.style.width = cuanto + "%";
    riel.appendChild(lleno);
    caja.appendChild(riel);
    const cifra = document.createElement("span");
    cifra.className = "ando-barra-cifra";
    const verbo = ANDO_VERBOS[(cosa.que || "").toString().trim().toLowerCase()] || "";
    cifra.textContent = cuanto + "%" + (verbo ? " " + verbo : "");
    caja.appendChild(cifra);
    return caja;
}
function tituloDeAndo(cosa) {
    const titulo = document.createElement("strong");
    titulo.className = "ando-cosa-titulo";
    titulo.textContent = cosa.titulo.toString().trim();
    const url = rutaSeguraAndo(cosa.enlace);
    if (url === "#") {
        return titulo;
    }
    const enlace = document.createElement("a");
    enlace.className = "ando-enlace";
    enlace.href = rutaSeguraAndo(url);
    enlace.appendChild(titulo);
    return enlace;
}
async function pintarLaPartida() {
    const caja = document.querySelector("[data-ando-rol]");
    const cuerpo = document.querySelector("[data-ando-rol-cuerpo]");
    if (!caja || !cuerpo) {
        return false;
    }
    let sesiones = [];
    try {
        const respuesta = await window.pedirDatos(ANDO_SESIONES_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        const items = await respuesta.json();
        sesiones = Array.isArray(items) ? items : [];
    } catch (error) {
        return false;
    }
    if (!sesiones.length) {
        return false;
    }
    const ultima = sesiones
        .slice()
        .sort((a, b) => fechaDeAndo(b && b.date) - fechaDeAndo(a && a.date))[0];
    if (!ultima) {
        return false;
    }
    let campana = null;
    const clave = (ultima.campana || "").toString().trim();
    if (clave && /^[a-z0-9_-]+$/i.test(clave)) {
        try {
            const respuesta = await window.pedirDatos(
                "/datos/notas_rol/campana-" + clave + ".json"
            );
            if (respuesta.ok) {
                campana = await respuesta.json();
            }
        } catch (error) {
        }
    }
    cuerpo.textContent = "";
    const lista = document.createElement("dl");
    lista.className = "ando-lista";
    const nombre = campana ? (campana.nombre || "").toString().trim() : "";
    if (nombre) {
        lista.appendChild(
            datoDeAndo("la campaña", textoAndo(nombre), "ando-cosa-titulo")
        );
    }
    const sistema = campana ? (campana.sistema || "").toString().trim() : "";
    if (sistema) {
        lista.appendChild(datoDeAndo("el sistema", textoAndo(sistema)));
    }
    const titulo = (ultima.title || "").toString().trim();
    const fecha = (ultima.date || "").toString().trim();
    const url = rutaSeguraAndo(ultima.url);
    const ultimoValor = document.createDocumentFragment();
    if (url !== "#" && titulo) {
        const enlace = document.createElement("a");
        enlace.className = "ando-enlace";
        enlace.href = rutaSeguraAndo(url);
        enlace.textContent = titulo;
        ultimoValor.appendChild(enlace);
    } else if (titulo) {
        ultimoValor.appendChild(textoAndo(titulo));
    }
    if (fecha) {
        const cuando = document.createElement("span");
        cuando.className = "ando-cosa-de";
        cuando.textContent = fecha;
        ultimoValor.appendChild(cuando);
    }
    if (ultimoValor.childNodes.length) {
        lista.appendChild(datoDeAndo("la última partida", ultimoValor));
    }
    const suyas = sesiones.filter(
        (s) => !clave || (s && (s.campana || "").toString().trim() === clave)
    ).length;
    lista.appendChild(
        datoDeAndo(
            "van",
            textoAndo(suyas === 1 ? "1 partida jugada" : suyas + " partidas jugadas")
        )
    );
    if (lista.childNodes.length) {
        cuerpo.appendChild(lista);
    }
    const botones = document.createElement("p");
    botones.className = "ando-botones";
    if (campana) {
        unBotonDeAndo(botones, campana.pagina, "las notas →");
        unBotonDeAndo(botones, campana.npcs, "npcs →");
    }
    if (botones.childNodes.length) {
        cuerpo.appendChild(botones);
    }
    caja.hidden = false;
    return true;
}
function unBotonDeAndo(donde, url, texto) {
    const limpia = rutaSeguraAndo(url);
    if (limpia === "#") {
        return;
    }
    const enlace = document.createElement("a");
    enlace.className = "ando-boton";
    enlace.href = rutaSeguraAndo(limpia);
    enlace.textContent = texto;
    donde.appendChild(enlace);
}
function fechaDeAndo(cadena) {
    const trozos = (cadena || "").toString().trim().split("-");
    if (trozos.length !== 3) {
        return 0;
    }
    const dia = Number(trozos[0]);
    const mes = Number(trozos[1]);
    const anyo = Number(trozos[2]);
    if (!dia || !mes || !anyo) {
        return 0;
    }
    return anyo * 10000 + mes * 100 + dia;
}
function pintarEscribiendo(datos) {
    const caja = document.querySelector("[data-ando-escribiendo]");
    const cuerpo = document.querySelector("[data-ando-escribiendo-cuerpo]");
    if (!caja || !cuerpo) {
        return false;
    }
    const cosas = (Array.isArray(datos.escribiendo) ? datos.escribiendo : []).filter(
        (c) => c && (c.titulo || "").toString().trim()
    );
    if (!cosas.length) {
        return false;
    }
    cuerpo.textContent = "";
    const lista = document.createElement("ul");
    lista.className = "ando-escritos";
    cosas.forEach((cosa) => {
        const fila = document.createElement("li");
        fila.className = "ando-escrito";
        fila.appendChild(tituloDeAndo(cosa));
        const pie = document.createElement("span");
        pie.className = "ando-escrito-pie";
        [(cosa.tipo || "").toString().trim(), (cosa.estado || "").toString().trim()]
            .filter(Boolean)
            .forEach((texto) => {
                const trozo = document.createElement("span");
                trozo.className = "ando-trozo";
                trozo.textContent = texto;
                pie.appendChild(trozo);
            });
        if (pie.childNodes.length) {
            fila.appendChild(pie);
        }
        const nota = (cosa.nota || "").toString().trim();
        if (nota) {
            const linea = document.createElement("p");
            linea.className = "ando-cosa-nota";
            linea.textContent = nota;
            fila.appendChild(linea);
        }
        lista.appendChild(fila);
    });
    cuerpo.appendChild(lista);
    caja.hidden = false;
    return true;
}
function pintarPendientes(datos) {
    const caja = document.querySelector("[data-ando-pendientes]");
    const cuerpo = document.querySelector("[data-ando-pendientes-cuerpo]");
    if (!caja || !cuerpo) {
        return false;
    }
    const cosas = (Array.isArray(datos.pendientes) ? datos.pendientes : []).filter(
        (c) => c && (c.cosa || "").toString().trim()
    );
    if (!cosas.length) {
        return false;
    }
    cuerpo.textContent = "";
    const lista = document.createElement("ul");
    lista.className = "cuaderno-tareas";
    cosas.forEach((cosa) => {
        const li = document.createElement("li");
        if (cosa.hecho) {
            li.className = "hecho";
        }
        li.textContent = cosa.cosa.toString().trim();
        lista.appendChild(li);
    });
    cuerpo.appendChild(lista);
    caja.hidden = false;
    document.dispatchEvent(new CustomEvent("tareas:actualizar"));
    return true;
}
function datoDeAndo(nombre, valor, claseExtra) {
    const bloque = document.createElement("div");
    bloque.className = "ando-cosa";
    const dt = document.createElement("dt");
    dt.className = "ando-cosa-que";
    dt.textContent = nombre;
    bloque.appendChild(dt);
    const dd = document.createElement("dd");
    dd.className = "ando-cosa-valor" + (claseExtra ? " " + claseExtra : "");
    dd.appendChild(valor);
    bloque.appendChild(dd);
    return bloque;
}
function textoAndo(cadena) {
    return document.createTextNode(cadena);
}
function rutaSeguraAndo(url) {
    const limpia = (url || "").toString().trim();
    if (/^\/(?!\/)/.test(limpia) || /^(https?:\/\/|mailto:|#)/i.test(limpia)) {
        return limpia;
    }
    return "#";
}
