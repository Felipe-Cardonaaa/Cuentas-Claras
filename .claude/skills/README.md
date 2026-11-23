# Skills de Claude Code

Cada subcarpeta aquí es un skill que Claude Code carga automáticamente en este repo.

```
.claude/skills/
├── plantilla/
│   └── SKILL.md      ← plantilla de ejemplo
└── <tu-skill>/
    ├── SKILL.md      ← obligatorio
    └── ...           ← scripts, referencias, etc. (opcional)
```

## Usar un skill

- **Manual:** escribe `/<nombre-del-skill>` en Claude Code.
- **Automático:** Claude lo activa solo cuando tu petición coincide con su `description`.

## Traer los skills que ya tienes en claude.ai

Los skills de claude.ai usan el mismo formato (`SKILL.md` + archivos), así que funcionan igual aquí:

1. Descarga el skill desde claude.ai (Configuración → Capacidades/Skills) — viene como `.zip`.
2. Descomprímelo dentro de `.claude/skills/` de modo que quede `.claude/skills/<nombre>/SKILL.md`.
3. Haz commit y push. Desde entonces estará disponible en cada sesión de Claude Code sobre este repo.

> Para tenerlos en **todos** tus proyectos (en tu computador, no en la nube), ponlos en `~/.claude/skills/`.
