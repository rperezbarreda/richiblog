// =========================================
// CARGADOR GENÉRICO DE COMPONENTES
// =========================================
// Se encarga solo de pedir el fragmento HTML e inyectarlo en el
// contenedor indicado. No sabe nada sobre sidebar, quotes, ni
// ningún componente concreto — cada uno le pasa su propia
// función "onLoaded" para inicializarse después de inyectarse.
//
// Uso:
//   loadComponent("mi-contenedor", "/components/mi-cosa.html", () => {
//       inicializarMiCosa();
//   });
//
// CUIDADO CON EL AVISO: NO SE DA ANTES DE TIEMPO
// ----------------------------------------------
// El aviso de "ya está puesto" (onLoaded, y el sidebar:loaded que manda
// barra-lateral.js) espera a que el navegador haya terminado de leer la
// página. No es una manía: media docena de scripts se enganchan a ese
// aviso —el de los ajustes, el del tema, el del gatín, el de los
// enlaces de fuera— y todos van con defer, o sea que se ejecutan uno
// detrás de otro al final.
//
// Desde que el menú se pide en el <head> (ver actualizar-cabeceras.py),
// el trozo de HTML puede estar ya aquí cuando arranca barra-lateral.js.
// Si el aviso saliera en ese mismo momento, saldría ENTRE un script y el
// siguiente: los que vinieran detrás todavía no se habrían enganchado y
// se lo perderían. Pasó, y de la peor manera posible: el botón de
// accesibilidad aparecía pero no abría nada.
//
// Esperando a DOMContentLoaded no hay carrera que valga: para entonces
// se han ejecutado todos los scripts con defer, estén o no listos los
// fragmentos.

async function loadComponent(elementId, file, onLoaded) {
    const container = document.getElementById(elementId);
    if (!container) {
        return;
    }

    try {
        // ¿Viene ya escrito en la página? La barra lateral sí: la copia
        // dentro de cada página herramientas/3-generadores/actualizar-cabeceras.py
        // (data-fragmento="barra-lateral"). Entonces no hay nada que pedir:
        // solo esperar a que estén todos los scripts y avisar.
        if (container.hasAttribute("data-fragmento") && container.children.length) {
            if (typeof onLoaded === "function") {
                await cuandoEsteLeidaLaPagina();
                onLoaded();
            }
            return;
        }
        // ¿Lo pidió ya cargador-scripts.js nada más empezar? La barra
        // lateral sí: la pide él, antes de que el navegador termine de
        // leer la página, porque es lo primero que hace falta ver. Si
        // está, aquí no se pide nada; se espera a lo que ya venía de
        // camino. Si no (cualquier otro fragmento, o si aquello falló),
        // se pide ahora como siempre.
        const adelanto = window.adelantoDeFragmentos || {};
        let html = adelanto[file] ? await adelanto[file] : null;

        if (html === null) {
            // Con su versión en la dirección: si no, al cambiar la
            // barra lateral quien ya había entrado seguía viendo la de
            // antes (ver el comentario de cargador-scripts.js).
            const response = await fetch(window.conVersion(file));

            if (!response.ok) {
                throw new Error(`No se pudo cargar ${file}`);
            }

            html = await response.text();
        }

        container.innerHTML = html;
        // Un fragmento puede llevar otros dentro (<!--! fragmento: buscar -->,
        // ver actualizar-cabeceras.py). Escritos en la página ya vienen
        // puestos; pedidos así, se ponen aquí.
        await ponerFragmentosDentro(container);

        if (typeof onLoaded === "function") {
            await cuandoEsteLeidaLaPagina();
            onLoaded();
        }

    } catch (error) {
        console.error(`Error cargando el componente (${file}):`, error);
    }
}

// La espera de arriba. Se prepara AQUÍ, al cargarse este archivo, y no
// dentro de loadComponent(): este archivo va con defer, así que esto
// corre seguro antes de que la página esté leída y el apunte llega a
// tiempo.
//
// Ojo con document.readyState, que para esto engaña: pasa a
// "interactive" en cuanto se acaba de leer el HTML, o sea ANTES de que
// se ejecuten los scripts con defer. Preguntarle si vale "loading" daba
// que no cuando todavía quedaban scripts por correr, que es justo el
// caso que esto quiere evitar. Solo "complete" (que llega más tarde, con
// las imágenes) es una respuesta de fiar.
const FRAGMENTOS_PAGINA_LEIDA = new Promise((seguir) => {
    if (document.readyState === "complete") {
        seguir();
        return;
    }
    document.addEventListener("DOMContentLoaded", seguir, { once: true });
});

function cuandoEsteLeidaLaPagina() {
    return FRAGMENTOS_PAGINA_LEIDA;
}


// Los <!--! fragmento: nombre --> de dentro de un fragmento pedido: cada
// uno se cambia por fragmentos/<nombre>.html (que puede llevar otros).
async function ponerFragmentosDentro(raiz, vueltas) {
    if ((vueltas || 0) > 4) {
        return;
    }
    const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_COMMENT);
    const marcas = [];
    while (recorrido.nextNode()) {
        const m = /^!\s*fragmento:\s*([\w-]+)\s*$/.exec(recorrido.currentNode.nodeValue.trim());
        if (m) {
            marcas.push([recorrido.currentNode, m[1]]);
        }
    }
    for (const [marca, nombre] of marcas) {
        try {
            const ruta = "/fragmentos/" + nombre + ".html";
            const respuesta = await fetch(window.conVersion ? window.conVersion(ruta) : ruta);
            if (!respuesta.ok) {
                continue;
            }
            const leido = new DOMParser().parseFromString(await respuesta.text(), "text/html");
            const trozo = document.createDocumentFragment();
            [...leido.body.childNodes].forEach((n) => trozo.appendChild(document.importNode(n, true)));
            const caja = document.createElement("div");
            caja.appendChild(trozo);
            await ponerFragmentosDentro(caja, (vueltas || 0) + 1);
            marca.replaceWith(...caja.childNodes);
        } catch (error) {
            // Sin ese trozo, y ya está: el resto del fragmento sí está.
        }
    }
}
