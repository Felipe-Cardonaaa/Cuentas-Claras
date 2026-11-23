# Skills de Claude Code

Cada subcarpeta es un skill que Claude Code carga automáticamente en este repo.
Úsalos con `/<nombre>` o deja que Claude los active solo según su `description`.

## Diseño de sistemas y arquitectura
| Skill | Para qué | Fuente |
|---|---|---|
| `system-design` | Documentos de diseño con diagramas, supuestos y trade-offs | Anthropic |
| `architecture` | Decisiones de arquitectura (ADR) y evaluación de opciones | Anthropic |
| `tech-debt` | Identificar y priorizar deuda técnica | Anthropic |
| `deploy-checklist` | Checklist antes de desplegar | Anthropic |

## Bases de datos
| Skill | Para qué | Fuente |
|---|---|---|
| `supabase-postgres-best-practices` | Esquemas, índices, RLS, rendimiento en Postgres | Supabase |
| `sql-queries` | Escribir SQL correcto y eficiente | Anthropic |
| `write-query` | Convertir una pregunta en una consulta SQL | Anthropic |

## Crear código en conjunto (flujo de trabajo)
| Skill | Para qué | Fuente |
|---|---|---|
| `brainstorming` | Afinar la idea con preguntas antes de programar | obra/superpowers |
| `writing-plans` | Plan de implementación detallado | obra/superpowers |
| `executing-plans` | Ejecutar un plan por tareas con revisiones | obra/superpowers |
| `test-driven-development` | Rojo → verde → refactor | obra/superpowers |
| `systematic-debugging` | Encontrar la causa raíz antes de arreglar | obra/superpowers |
| `debug` | Depuración guiada (reproducir, aislar, arreglar) | Anthropic |
| `verification-before-completion` | Verificar de verdad antes de decir "listo" | obra/superpowers |
| `requesting-code-review` / `receiving-code-review` | Pedir y procesar revisiones de código | obra/superpowers |
| `subagent-driven-development` / `dispatching-parallel-agents` | Repartir trabajo entre subagentes | obra/superpowers |
| `using-git-worktrees` / `finishing-a-development-branch` | Ramas aisladas y cierre limpio (merge/PR) | obra/superpowers |
| `testing-strategy` / `documentation` | Estrategia de pruebas y documentación técnica | Anthropic |

## Ahorro de tokens
| Skill | Para qué | Fuente |
|---|---|---|
| `caveman` | Respuestas ultra-concisas sin perder datos técnicos (`/caveman`, "stop caveman" para salir) | JuliusBrussee/caveman |

> Consejo: los skills solo gastan ~100 tokens (su descripción) hasta que se activan.
> Usa `/context` para ver qué consume tu contexto.

## Diseño (UI, animación, presentaciones)
`impeccable`, `design-taste-frontend`, `apple-design`, `emil-design-eng`, `break-ui`, `prototype`,
`animate`, `animate-expo`, `animation-performance`, `animation-vocabulary`, `find-animation-opportunities`,
`improve-animations`, `review-animations`, `ask-sonner`, `ppt-master`, y el paquete de diapositivas de
consultoría (`action-title-writer`, `pyramid-storyline-builder`, `executive-summary-builder`,
`slide-density-balancer`, `mece-layout-architect`, `partner-review-checklist`, etc.).

## Añadir más
Copia `plantilla/`, cámbiale el nombre (igual al campo `name:`) y edita `SKILL.md`.
Los skills de terceros conservan su `LICENSE` dentro de su carpeta.
