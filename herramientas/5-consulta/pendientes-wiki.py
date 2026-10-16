#!/usr/bin/env python3
# =========================================
# LO QUE FALTA EN LA WIKI
# =========================================
# La lista de pendientes de la wiki: no cambia nada, solo mira los .md de
# wiki/ y cuenta lo que queda por hacer.
#
#     python herramientas/5-consulta/pendientes-wiki.py
#     python herramientas/5-consulta/pendientes-wiki.py --todo    (con todos los detalles)
#
# Cuenta:
#
#   - PÁGINAS QUE FALTAN: los [[enlaces]] a páginas que todavía no existen
#     (salen en rojo en la web), de la que más veces se nombra a la que
#     menos, y desde dónde.
#   - «POR DECIDIR»: los campos de las fichas que siguen diciendo eso, por
#     campo (capital: 107 páginas…).
#   - TEXTO DE RELLENO: las páginas que aún tienen párrafos de relleno.
#   - PÁGINAS DE EJEMPLO: las de wiki/Ejemplos/, en lorem ipsum.
#   - ENTRADILLAS A MEDIAS: las que se quedaron como las dejó la plantilla
#     («**Elfos** es»).
#   - IMÁGENES QUE FALTAN: las que pide una ficha y no están en
#     wiki/_imagenes/.

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from comun import RAIZ, es_del_mundo  # noqa: E402

VAULT = RAIZ / "wiki"
LINEA = RAIZ / "datos" / "wiki" / "linea-de-tiempo.json"
RE_ENLACE = re.compile(r"!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]")
RE_FM = re.compile(r"^---\n(.*?)\n---\n?", re.S)
IMAGEN = (".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg")


def llano(texto):
    return texto.strip().lower()


def main():
    todo = "--todo" in sys.argv
    paginas = {}
    for archivo in sorted(VAULT.rglob("*.md")):
        if es_del_mundo(archivo, VAULT) and "_system" not in archivo.relative_to(VAULT).parts:
            paginas[llano(archivo.stem)] = archivo
    imagenes = {llano(a.name) for a in VAULT.rglob("*") if a.suffix.lower() in IMAGEN}
    existen = set(paginas)
    existen |= {llano(a.stem) for a in VAULT.rglob("*.cmap")}
    try:
        linea = json.loads(LINEA.read_text(encoding="utf-8"))
        existen |= {llano(e.get("nombre", "")) for e in linea.get("eventos", [])}
        existen |= {llano(e.get("nombre", "")) for e in linea.get("eras", [])}
        existen.add("línea de tiempo")
    except (OSError, ValueError):
        pass

    faltan = defaultdict(set)
    por_decidir = Counter()
    por_decidir_en = defaultdict(list)
    relleno, entradillas, sin_imagen, ejemplos = [], [], [], []
    for nombre, archivo in paginas.items():
        texto = archivo.read_text(encoding="utf-8")
        m = RE_FM.match(texto)
        # Sin las líneas de comentario (las explicaciones de las plantillas
        # ponen ejemplos como [[Una]], que no son enlaces de verdad).
        frontmatter = "\n".join(l for l in (m.group(1) if m else "").split("\n")
                                 if not l.lstrip().startswith("#"))
        cuerpo = texto[m.end():] if m else texto
        cuerpo_sin_notas = re.sub(r"<!--.*?-->", "", cuerpo, flags=re.S)
        for e in RE_ENLACE.finditer(frontmatter + "\n" + cuerpo_sin_notas):
            objetivo = e.group(1).strip()
            if e.group(0).startswith("!") or re.search(r"\.(webp|png|jpe?g|gif|svg)\b", objetivo, re.I):
                continue
            if llano(objetivo) not in existen:
                faltan[objetivo].add(archivo.stem)
        for linea in frontmatter.split("\n"):
            if "por decidir" in linea and ":" in linea:
                campo = linea.split(":", 1)[0].strip()
                por_decidir[campo] += 1
                por_decidir_en[archivo.stem].append(campo)
            mi = re.match(r"^(image|bandera|blasón|blason|escudo):\s*(.+)$", linea.strip())
            if mi:
                for pedida in re.findall(r"[\w\-./]+\.(?:webp|png|jpe?g|gif|svg)", mi.group(2), re.I):
                    if llano(Path(pedida).name) not in imagenes:
                        sin_imagen.append((archivo.stem, pedida))
        if "Texto de relleno" in cuerpo_sin_notas:
            relleno.append(archivo.stem)
        if "Lorem ipsum" in cuerpo_sin_notas:
            ejemplos.append(archivo.stem)
        primero = next((p.strip() for p in re.split(r"\n\s*\n", cuerpo_sin_notas) if p.strip()), "")
        if re.search(r"\*\*[^*]+\*\*\s+(es|son|fue|fueron)\s*$", primero):
            entradillas.append(archivo.stem)

    print("\n  ==================================")
    print("  LO QUE FALTA EN LA WIKI")
    print("  ==================================")
    print(f"  {len(paginas)} páginas en wiki/.\n")

    print(f"  PÁGINAS QUE FALTAN (se enlazan y no existen): {len(faltan)}")
    for objetivo, desde in sorted(faltan.items(), key=lambda kv: (-len(kv[1]), kv[0].lower()))[:None if todo else 15]:
        print(f"     {objetivo}  ← {len(desde)}: {', '.join(sorted(desde)[:4])}{'…' if len(desde) > 4 else ''}")
    if not todo and len(faltan) > 15:
        print(f"     … y {len(faltan) - 15} más (con --todo salen todas)")

    print(f"\n  CAMPOS «POR DECIDIR»: {sum(por_decidir.values())}, en {len(por_decidir_en)} páginas")
    for campo, n in por_decidir.most_common():
        print(f"     {campo:<20} {n}")
    if todo:
        for pagina, campos in sorted(por_decidir_en.items()):
            print(f"     · {pagina}: {', '.join(campos)}")

    print(f"\n  CON TEXTO DE RELLENO: {len(relleno)}")
    if todo:
        for p in sorted(relleno):
            print(f"     · {p}")

    print(f"\n  PÁGINAS DE EJEMPLO (en lorem ipsum, para borrar cuando sobren): {len(ejemplos)}")
    for p in sorted(ejemplos):
        print(f"     · {p}")

    print(f"\n  ENTRADILLAS A MEDIAS (como las dejó la plantilla): {len(entradillas)}")
    for p in sorted(entradillas):
        print(f"     · {p}")

    print(f"\n  IMÁGENES QUE FALTAN: {len(sin_imagen)}")
    for pagina, imagen in sorted(sin_imagen):
        print(f"     · {imagen}  (la pide {pagina})")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
