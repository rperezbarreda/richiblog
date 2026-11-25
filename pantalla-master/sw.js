// =========================================
// EL SERVICE WORKER: guarda la app entera en el dispositivo al
// instalarla y la sirve desde ahí, con o sin conexión.
// ARCHIVO GENERADO por herramientas/precache.py: no lo edites aquí, sino
// en herramientas/sw-plantilla.js. La versión cambia sola cuando cambia
// cualquier archivo, y entonces la app avisa de que hay una nueva.
// =========================================
const VERSION = "f93a298a6f3e";
const CACHE = "pantalla-master-" + VERSION;
const ARCHIVOS = [
    "./",
    "datos/personajes/compendio/2014/bestiario.json",
    "datos/personajes/compendio/2014/conjuros-srd.json",
    "datos/personajes/compendio/2014/reglas.json",
    "datos/personajes/compendio/2014/tienda.json",
    "datos/personajes/compendio/bestiario.json",
    "datos/personajes/compendio/conjuros-srd.json",
    "datos/personajes/compendio/idiomas.json",
    "datos/personajes/compendio/master-tablas.json",
    "datos/personajes/compendio/nombres.json",
    "datos/personajes/compendio/rasgos-srd.json",
    "datos/personajes/compendio/reglas.json",
    "datos/personajes/compendio/tienda.json",
    "datos/personajes/dnd-es.json",
    "estilos/ajustes.css",
    "estilos/app.css",
    "estilos/base.css",
    "estilos/base.responsive.css",
    "estilos/cabecera-ventana.css",
    "estilos/jugadores.css",
    "estilos/lapiz.css",
    "estilos/moderno.css",
    "estilos/pantalla-master.css",
    "estilos/personajes.css",
    "estilos/personajes.responsive.css",
    "estilos/reproductor.css",
    "estilos/sin-movimiento.css",
    "estilos/windows.css",
    "idiomas/ca.js",
    "idiomas/ca.json",
    "idiomas/en.js",
    "idiomas/en.json",
    "idiomas/eu.js",
    "idiomas/eu.json",
    "idiomas/gl.js",
    "idiomas/gl.json",
    "idiomas/lista.json",
    "imagenes/dark_bg.webp",
    "imagenes/guia/formulario.webp",
    "imagenes/guia/pegar.webp",
    "imagenes/guia/resultado.webp",
    "imagenes/icono-180.png",
    "imagenes/icono-192.png",
    "imagenes/icono-512.png",
    "imagenes/icono-maskable-512.png",
    "imagenes/icono.svg",
    "imagenes/white_bg.webp",
    "index.html",
    "jugadores.html",
    "manifest.webmanifest",
    "reproductor.html",
    "scripts/ajustes.js",
    "scripts/app.js",
    "scripts/arranque.js",
    "scripts/jugadores.js",
    "scripts/pantalla-master.js",
    "scripts/personajes.js",
    "scripts/reproductor.js",
    "scripts/tema.js",
    "scripts/ventanas/ambiente.js",
    "scripts/ventanas/bestiario.js",
    "scripts/ventanas/botin.js",
    "scripts/ventanas/calendario.js",
    "scripts/ventanas/conjuros.js",
    "scripts/ventanas/criatura.js",
    "scripts/ventanas/criaturaTurno.js",
    "scripts/ventanas/dibujo.js",
    "scripts/ventanas/documento.js",
    "scripts/ventanas/documentos.js",
    "scripts/ventanas/dungeon.js",
    "scripts/ventanas/efectos.js",
    "scripts/ventanas/encuentros.js",
    "scripts/ventanas/ficha.js",
    "scripts/ventanas/homebrew.js",
    "scripts/ventanas/idiomas.js",
    "scripts/ventanas/inventario.js",
    "scripts/ventanas/jugadores.js",
    "scripts/ventanas/linea.js",
    "scripts/ventanas/monedas.js",
    "scripts/ventanas/musica.js",
    "scripts/ventanas/nombres.js",
    "scripts/ventanas/notas.js",
    "scripts/ventanas/party.js",
    "scripts/ventanas/pj.js",
    "scripts/ventanas/pnj.js",
    "scripts/ventanas/rasgos.js",
    "scripts/ventanas/relaciones.js",
    "scripts/ventanas/relojes.js",
    "scripts/ventanas/sonidos.js",
    "scripts/ventanas/taberna.js",
    "scripts/ventanas/tabla.js",
    "scripts/ventanas/tablas.js",
    "scripts/ventanas/tarjeta.js",
    "scripts/ventanas/tienda.js",
    "scripts/ventanas/tiradas.js",
    "scripts/ventanas/turnos.js",
    "scripts/ventanas/visor.js",
    "sonidos/indice.json",
    "tipografias/atkinson-400-italica.woff2",
    "tipografias/atkinson-400.woff2",
    "tipografias/atkinson-700.woff2",
    "tipografias/atkinson-mono-400-italica.woff2",
    "tipografias/atkinson-mono-400.woff2",
    "tipografias/atkinson-mono-700.woff2",
    "tipografias/caveat-700.woff2",
    "tipografias/dm-mono-400.woff2",
    "tipografias/dm-mono-500.woff2",
    "tipografias/inter-variable.woff2",
    "tipografias/jersey-10-400.woff2",
    "tipografias/noto-bamum.woff2",
    "tipografias/noto-glagolitic.woff2",
    "tipografias/noto-linear-a.woff2",
    "tipografias/noto-meroitic.woff2",
    "tipografias/noto-ogham.woff2",
    "tipografias/noto-ol-chiki.woff2",
    "tipografias/noto-old-hungarian.woff2",
    "tipografias/noto-old-permic.woff2",
    "tipografias/noto-old-persian.woff2",
    "tipografias/noto-old-south-arabian.woff2",
    "tipografias/noto-old-turkic.woff2",
    "tipografias/noto-osage.woff2",
    "tipografias/noto-phoenician.woff2",
    "tipografias/noto-runic.woff2",
    "tipografias/noto-shavian.woff2",
    "tipografias/noto-tifinagh.woff2",
    "tipografias/pangolin-400.woff2",
    "tipografias/patrick-hand-400.woff2",
    "tipografias/pixelify-sans-700.woff2",
    "tipografias/space-grotesk-400.woff2",
    "tipografias/space-grotesk-500.woff2",
    "tipografias/space-grotesk-600.woff2",
    "tipografias/vt323-400.woff2"
];

// Cada archivo se pide con «?v=VERSION» y sin la caché del navegador: así
// no se cuela uno viejo que tuviera guardado el navegador o Cloudflare (el
// sitio va detrás). Se guarda con su nombre de siempre.
self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ARCHIVOS.map((a) => {
        const u = new URL(a, self.location);
        u.searchParams.set("v", VERSION);
        return fetch(u, { cache: "reload" }).then((r) => {
            if (!r.ok) {
                throw new Error(a + ": " + r.status);
            }
            return c.put(a, r);
        });
    }))));
});

// La nueva sólo entra cuando la app lo pide («↻ actualizar»), o sola si
// no había ninguna.
self.addEventListener("message", (e) => {
    if (e.data === "activar") {
        self.skipWaiting();
    }
});

self.addEventListener("activate", (e) => {
    e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.indexOf("pantalla-master-") === 0 && k !== CACHE)
        .map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Primero lo guardado; si no está (un sonido que no se precarga), a la
// red, y se guarda para la próxima.
self.addEventListener("fetch", (e) => {
    const u = new URL(e.request.url);
    if (e.request.method !== "GET" || u.origin !== location.origin) {
        return;
    }
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).then((resp) => {
        if (resp.ok && resp.type === "basic") {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return resp;
    }).catch(() => (e.request.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
