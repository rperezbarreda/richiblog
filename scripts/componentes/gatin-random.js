// =========================================
// COMPONENTE: GATÍN ALEATORIO (barra lateral)
// =========================================
// Enseña una foto al azar del santuario —de Tali o de Regis— debajo
// de la navegación. Al ser un sitio estático, cada enlace recarga la
// página entera: no hace falta ningún temporizador ni nada raro, con
// elegir una foto distinta en cada carga ya cambia sola al navegar.
//
// Lee el mismo datos/fotos-santuarios.json que la galería, así que las
// fotos nuevas que genere herramientas/generar-galeria.py aparecen
// aquí solas, sin tocar este archivo.
//
// La miniatura es la que se ve; la foto grande solo se descarga si
// alguien la amplía, igual que en la galería. El visor ya escucha
// clics en cualquier .lightbox-trigger del documento (ver
// scripts/componentes/visor-imagenes.js), así que no hay que engancharlo aquí.
//
// El botón 🔁 saca otra foto sin recargar: el listado se queda en
// memoria desde la primera vez, así que no vuelve a pedir el JSON.

const GATIN_FOTOS_URL = "/datos/fotos-santuarios.json";
// Se recuerda la última foto enseñada para no repetirla en la
// siguiente página: con dos o tres fotos, el azar puro repite
// demasiado y parece que el cuadro esté roto.
const GATIN_ULTIMA_CLAVE = "richi-gatin-ultimo";

// Icono de recargar, dibujado a mano en SVG en vez de usar un emoji o
// un carácter tipo ↻. Con un glifo, el dibujo sale de la fuente que
// tenga instalada quien visita la web: si no es la misma que aquí, el
// navegador lo sustituye por otra y el icono cae descentrado dentro de
// su propio hueco, sin que haya forma de arreglarlo desde el CSS —
// centrar la caja no centra el dibujo. Así se ve exactamente igual en
// todas partes, no hay que subir ningún archivo más y toma el color
// del botón con currentColor, así que cambia solo con el tema y al
// pasar el ratón.
//
// La geometría está calculada para que la tinta quede centrada en el
// lienzo de 24x24: el centro real del dibujo cae en (12.00, 12.00).
const ICONO_RECARGAR =
    '<svg class="gatin-random-reload-icono" viewBox="0 0 24 24"' +
    ' aria-hidden="true" focusable="false">' +
    '<path d="M19.37 12.82A7.4 7.4 0 1 1 14.53 6.51" fill="none"' +
    ' stroke="currentColor" stroke-width="2.9" stroke-linecap="round"/>' +
    '<path d="M18.85 8.08L12.65 9.34L14.91 3.13Z" fill="currentColor"/>' +
    "</svg>";

// El menú se inyecta por fetch (ver scripts/componentes/cargador-fragmentos.js), así que
// este script se ejecuta antes de que exista el hueco donde va.
document.addEventListener("sidebar:loaded", initializeGatinRandom);

async function initializeGatinRandom() {
    const caja = document.querySelector("[data-gatin-random]");
    const cuerpo = caja && caja.querySelector("[data-gatin-body]");
    if (!caja || !cuerpo) {
        return;
    }

    let fotos = [];
    try {
        const respuesta = await window.pedirDatos(GATIN_FOTOS_URL);
        if (!respuesta.ok) {
            throw new Error("La respuesta no fue correcta");
        }
        fotos = aplanarFotos(await respuesta.json());
    } catch (error) {
        return; // se queda oculto, sin hueco vacío ni mensaje de error
    }

    if (fotos.length === 0) {
        return;
    }

    cuerpo.innerHTML = gatinAHtml();
    pintarFoto(cuerpo, elegirFoto(fotos));
    caja.hidden = false;

    const recargar = cuerpo.querySelector("[data-gatin-reload]");
    if (recargar) {
        // Con una sola foto el botón no haría nada: mejor no enseñarlo.
        if (fotos.length < 2) {
            recargar.remove();
        } else {
            recargar.addEventListener("click", () => {
                pintarFoto(cuerpo, elegirFoto(fotos));
            });
        }
    }
}

// Cambia la foto de la ventanita sin tocar el resto del HTML: así el
// botón de recargar no se rehace en cada clic y no pierde el foco del
// teclado a mitad de uso.
function pintarFoto(cuerpo, item) {
    const boton = cuerpo.querySelector(".gatin-random-foto");
    const img = boton && boton.querySelector("img");
    if (!boton || !img) {
        return;
    }

    const carpeta = "/imagenes/santuarios/" + encodeURIComponent(item.gato) + "/";
    img.src = carpeta + encodeURIComponent(item.foto.mini || item.foto.archivo);
    img.alt = item.foto.alt || "Foto del santuario";
    // La foto grande va aparte: el visor la lee de aquí en vez de
    // ampliar la miniatura, que se vería borrosa.
    boton.dataset.completa = carpeta + encodeURIComponent(item.foto.archivo);

    recordarFoto(item);
}

// De { tali: [...], regis: [...] } a una sola lista donde cada foto
// se lleva de quién es, que es lo que hace falta para la ruta.
function aplanarFotos(datos) {
    if (!datos || typeof datos !== "object") {
        return [];
    }
    return Object.keys(datos).reduce((lista, gato) => {
        if (Array.isArray(datos[gato])) {
            datos[gato].forEach((foto) => {
                if (foto && foto.archivo) {
                    lista.push({ gato: gato, foto: foto });
                }
            });
        }
        return lista;
    }, []);
}

function elegirFoto(fotos) {
    const anterior = leerUltimaFoto();
    // Si solo hay una foto no queda otra que repetirla.
    const candidatas =
        fotos.length > 1
            ? fotos.filter((item) => claveDeFoto(item) !== anterior)
            : fotos;
    const utiles = candidatas.length > 0 ? candidatas : fotos;
    return utiles[Math.floor(Math.random() * utiles.length)];
}

function claveDeFoto(item) {
    return item.gato + "/" + item.foto.archivo;
}

// sessionStorage puede fallar (ventana privada, permisos del
// navegador). No es nada crítico, así que si peta se sigue adelante y
// como mucho se repite una foto.
function leerUltimaFoto() {
    try {
        return sessionStorage.getItem(GATIN_ULTIMA_CLAVE);
    } catch (error) {
        return null;
    }
}

function recordarFoto(item) {
    try {
        sessionStorage.setItem(GATIN_ULTIMA_CLAVE, claveDeFoto(item));
    } catch (error) {
        /* sin memoria: solo significa que puede repetirse una foto */
    }
}

// Solo el armazón: la foto concreta la rellena pintarFoto(), que
// escribe src/alt por propiedades y no por HTML, así que aquí no hay
// nada que escapar.
function gatinAHtml() {
    return (
        '<button type="button" class="lightbox-trigger gatin-random-foto">' +
        '<img src="" alt="" decoding="async">' +
        "</button>" +
        '<button type="button" class="gatin-random-reload" data-gatin-reload>' +
        ICONO_RECARGAR +
        '<span class="visually-hidden">Ver otra foto</span>' +
        "</button>"
    );
}
