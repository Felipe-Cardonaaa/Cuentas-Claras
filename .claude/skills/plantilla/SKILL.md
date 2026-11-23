---
name: plantilla
description: Plantilla de ejemplo para crear nuevos skills. Úsala solo cuando el usuario pida explícitamente "/plantilla" o quiera ver cómo se estructura un skill.
---

# Plantilla de skill

Copia esta carpeta, cámbiale el nombre y edita este archivo para crear un skill nuevo.

## Cómo escribir un buen skill

1. **`name`**: en minúsculas, con guiones, igual al nombre de la carpeta.
2. **`description`**: lo más importante. Claude lee esto para decidir cuándo
   activar el skill. Di *qué hace* y *cuándo usarlo* (palabras clave, situaciones).
3. **Cuerpo**: instrucciones claras, paso a paso, como si se las explicaras a
   un compañero nuevo.

## Instrucciones (reemplaza esta sección)

Cuando se active este skill:

1. Explica al usuario que esta es la plantilla de ejemplo.
2. Muéstrale la estructura de carpetas de `.claude/skills/`.
3. Ofrécele crear un skill nuevo a partir de esta plantilla.

## Archivos de apoyo (opcional)

Puedes añadir junto a este `SKILL.md`:
- `scripts/` — scripts que Claude puede ejecutar.
- `references/` — documentación extra que Claude lee cuando la necesita.
- `assets/` — plantillas, imágenes, etc.
