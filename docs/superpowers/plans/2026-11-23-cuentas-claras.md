# Cuentas Claras — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** PWA para un puesto de plaza que anota ventas por frase (voz o texto), lleva lotes de canastillas, fiados con abonos, canastillas prestadas y cierre del día, con varios usuarios, sin señal y sincronizada.

**Arquitectura:** Lógica del negocio en funciones puras de TypeScript (`src/dominio/`) que calculan todo a partir de los registros guardados. Los registros viven primero en IndexedDB (Dexie), con una cola de salida que se sincroniza con Supabase (Postgres). La interfaz es React con 4 pantallas (Anotar, Clientes, Lotes, Cierre).

**Stack:** Vite 5 + React 18 + TypeScript 5, vite-plugin-pwa, Dexie 4, @supabase/supabase-js 2, Vitest + @testing-library/react + jsdom + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-23-cuentas-claras-design.md` (leerlo junto con este plan). Pantallas de muestra: https://claude.ai/artifact/6c1DhScXQxPawSrBgyrjPU

## Restricciones globales

- Idioma de la interfaz: español de Colombia. Zona horaria para "hoy" y fechas mostradas: `America/Bogota`.
- Dinero: pesos enteros, sin decimales, formato `$45.000` (punto de miles).
- Unidades: solo `canastilla` y `kilo`.
- Funciona igual en Android (Chrome) y iPhone (Safari), instalable como PWA.
- Costo mensual: plan gratuito de Supabase y hosting estático gratuito.
- Botones de al menos 52 px de alto; letra Atkinson Hyperlegible; verde `#1F6B45` para pagado y acciones; deuda con texto `#8A3D06` sobre `#FDEBD8`; fondo `#FBFAF6`; texto `#1C1B19`.
- Nada se guarda sin pasar por la pantalla de confirmación.
- Todo registro lleva `creadoPor`, `creadoEn` y `actualizadoEn` (ISO), y `borrado` (borrado lógico).
- Identificadores de código en español, igual que el dominio.

## Foco de revisión

1. **Precios dictados en palabras o con "mil":** "45 mil", "cuarenta y cinco mil", "$45.000" y "45000" deben dar 45000. Si no se entiende, el mensaje dice qué parte falló. Prueba en la Tarea 3.
2. **Doble guardado:** un doble toque en Guardar o un reintento de sincronización no debe duplicar ventas. Los ids se generan en el cliente y la sincronización usa upsert. Pruebas en las Tareas 10 y 11.
3. **"Hoy" en hora de Colombia:** una venta a las 8:30 p. m. en Bogotá (01:30 UTC del día siguiente) cuenta en el cierre de ese día. Prueba en la Tarea 8.
4. **Corregir recalcula todo:** editar la cantidad de una venta fiada cambia el saldo, el `debe` y las canastillas que quedan en el lote. Prueba en la Tarea 10.
5. **Sin señal y recarga:** una venta guardada sin señal sigue en la cola de salida después de cerrar y abrir la app, y sube cuando vuelve la conexión. Prueba en la Tarea 11.

---

## Estructura de archivos

```
src/
  dominio/
    tipos.ts          tipos de registros e intenciones
    texto.ts          normalizar nombres, números en palabras, precios, formato COP, fechas Bogotá
    parser.ts         frase -> Intencion
    coincidencias.ts  nombre -> coincidencia exacta / parecida / nueva
    lotes.ts          estado de lotes, elegir lotes FIFO, ganancia
    fiados.ts         estado de cuenta, abonos FIFO, validar abono
    canastillas.ts    prestadas por cliente, validar devolución
    cierre.ts         resumen del día
    borrador.ts       intención + datos -> borrador de confirmación o error
  datos/
    db.ts             Dexie: tablas, cola de salida
    repositorio.ts    crear / editar / borrar con historial; consultas
    guardar.ts        borrador confirmado -> registros
  sync/
    mapeo.ts          camelCase <-> snake_case
    sincronizar.ts    subir cola, bajar cambios
    supabase.ts       cliente Supabase
  auth/
    pin.ts            hash y verificación de PIN (PBKDF2)
    sesion.ts         negocio (Supabase) + usuario activo
  ui/
    App.tsx, Navegacion.tsx, estilos.css
    anotar/Anotar.tsx, anotar/Confirmacion.tsx, anotar/useDictado.ts
    clientes/Clientes.tsx
    lotes/Lotes.tsx
    cierre/Cierre.tsx
    comun/Historial.tsx
    acceso/Acceso.tsx
supabase/migrations/0001_inicial.sql
tests/   (mismo árbol que src, archivos *.test.ts / *.test.tsx)
```

---

### Task 1: Proyecto base

**Archivos:**
- Crear: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/estilos.css`, `tests/setup.ts`, `tests/ui/App.test.tsx`, `.env.example`, `README.md`

**Interfaces:**
- Produce: `npm test` (Vitest, entorno jsdom, setup con `fake-indexeddb/auto` y `@testing-library/jest-dom`), `npm run build` → `dist/`.

- [ ] **Paso 1:** crear el proyecto Vite React TS e instalar las dependencias del stack. `.env.example` con `VITE_SUPABASE_URL=` y `VITE_SUPABASE_ANON_KEY=`.
- [ ] **Paso 2: prueba que falla** en `tests/ui/App.test.tsx`:

```tsx
it('muestra el nombre de la app', () => {
  render(<App />);
  expect(screen.getByText('Cuentas Claras')).toBeInTheDocument();
});
```

- [ ] **Paso 3:** `npm test` → FALLA (no existe `App`).
- [ ] **Paso 4:** `App` mínimo que muestra "Cuentas Claras". En `estilos.css`, las variables de color y la letra de las restricciones globales, y la fuente cargada desde Google Fonts en `index.html`.
- [ ] **Paso 5:** `npm test` → PASA; `npm run build` → sin errores.
- [ ] **Paso 6:** commit `chore: proyecto base Vite + React + Vitest`.

---

### Task 2: Tipos y utilidades de texto

**Archivos:**
- Crear: `src/dominio/tipos.ts`, `src/dominio/texto.ts`
- Prueba: `tests/dominio/texto.test.ts`

**Interfaces:**
- Produce (`tipos.ts`):

```ts
export type Unidad = 'canastilla' | 'kilo';
export type Estado = 'pago' | 'debe';
export interface Base { id: string; creadoPor: string; creadoEn: string; actualizadoEn: string; borrado: boolean }
export interface Usuario extends Base { nombre: string; pinHash: string; pinSal: string }
export interface Cliente extends Base { nombre: string; nombreNormalizado: string }
export interface Producto extends Base { nombre: string; nombreNormalizado: string }
export interface Lote extends Base { productoId: string; canastillas: number; costoTotal: number | null; costoDetalle: string | null }
export interface Venta extends Base { grupoId: string; clienteId: string | null; productoId: string; loteId: string | null;
  unidad: Unidad; cantidad: number; precioUnitario: number; estado: Estado; prestada: boolean | null }
export interface Vaciado extends Base { loteId: string; cantidad: number }
export interface Abono extends Base { clienteId: string; valor: number }
export interface SaldoInicial extends Base { clienteId: string; valor: number }
export interface Devolucion extends Base { clienteId: string; cantidad: number }
export interface Historial { id: string; tabla: string; registroId: string; usuarioId: string; fecha: string;
  accion: 'crear' | 'editar' | 'borrar'; antes: unknown; despues: unknown }
export interface Datos { clientes: Cliente[]; productos: Producto[]; lotes: Lote[]; ventas: Venta[]; vaciados: Vaciado[];
  abonos: Abono[]; saldosIniciales: SaldoInicial[]; devoluciones: Devolucion[] }
```

- Produce (`texto.ts`):
  - `normalizarNombre(s: string): string`: minúsculas, sin tildes, espacios colapsados y sin "doña", "don", "señora", "señor", "sra", "sr" al inicio.
  - `aNumero(s: string): number | null`: dígitos o palabras de "uno" a "veinte", decenas hasta "noventa" con "y", "cien", "mil" y "medio"/"media" (0,5).
  - `parsearPrecio(s: string): number | null`
  - `formatoCOP(n: number): string`
  - `fechaBogota(iso: string): string`: devuelve `YYYY-MM-DD` en America/Bogota.
  - `horaBogota(iso: string): string`: devuelve `9:42 a. m.`
  - `nombrePropio(s: string): string`: mayúscula inicial en cada palabra, conserva las tildes.

- [ ] **Paso 1: pruebas que fallan:**

```ts
expect(normalizarNombre('  Doña  Martha Ramírez ')).toBe('martha ramirez');
expect(aNumero('dos')).toBe(2); expect(aNumero('12')).toBe(12); expect(aNumero('medio')).toBe(0.5);
for (const s of ['45.000', '45000', '$45.000', '45 mil', 'cuarenta y cinco mil']) expect(parsearPrecio(s)).toBe(45000);
expect(parsearPrecio('1.800.000')).toBe(1800000); expect(parsearPrecio('abc')).toBeNull();
expect(formatoCOP(90000)).toBe('$90.000');
expect(fechaBogota('2026-11-18T01:30:00Z')).toBe('2026-11-17');
expect(nombrePropio('doña marta ramírez')).toBe('Doña Marta Ramírez');
```

- [ ] **Paso 2:** `npx vitest run tests/dominio/texto.test.ts` → FALLA.
- [ ] **Paso 3:** implementar. Fechas con `Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota' })`.
- [ ] **Paso 4:** → PASA.
- [ ] **Paso 5:** commit `feat(dominio): tipos y utilidades de texto`.

---

### Task 3: Intérprete de frases

**Archivos:**
- Crear: `src/dominio/parser.ts`
- Prueba: `tests/dominio/parser.test.ts`

**Interfaces:**
- Consume: `aNumero`, `parsearPrecio`, `nombrePropio` (Tarea 2).
- Produce:

```ts
export interface ItemFrase { cantidad: number; unidad: Unidad; producto: string; precioUnitario: number; prestada: boolean | null }
export type Intencion =
  | { tipo: 'venta'; cliente: string | null; items: ItemFrase[]; estado: Estado | null }
  | { tipo: 'abono'; cliente: string; valor: number }
  | { tipo: 'pagoTotal'; cliente: string }
  | { tipo: 'entrada'; producto: string; cantidad: number; unidad: Unidad; costo: { tipo: 'unitario' | 'total'; valor: number } | null }
  | { tipo: 'vaciado'; producto: string; cantidad: number }
  | { tipo: 'devolucion'; cliente: string; cantidad: number }
  | { tipo: 'saldoInicial'; cliente: string; valor: number };
export type ResultadoFrase = { ok: true; intencion: Intencion } | { ok: false; error: string };
export function parsearFrase(texto: string): ResultadoFrase;
```

Reglas: se compara en minúsculas, aceptando las palabras con y sin tilde. Los nombres de cliente y producto salen con `nombrePropio` y conservan las tildes. Los productos salen en minúscula ("mango criollo"). Variaciones aceptadas:
- Verbo de venta: "compró", "se llevó". Con "vendí" no hay cliente.
- Unidad: "canastilla(s)", "canasta(s)" → canastilla; "kilo(s)", "kg" → kilo. Un ítem sin unidad hereda la del anterior; el primero, sin unidad, es canastilla.
- Estado: "debe", "fiado", "quedó debiendo" → debe; "pagó", "de contado" → pago; sin palabra → `null`.
- Préstamo: "empacado" → `prestada: false`; "con canastilla" → `true`. Aplica a todos los ítems de canastilla. Sin palabra → `null`. Los ítems de kilo siempre llevan `null`.
- Entrada: "a <precio>" es costo unitario; "por <precio>" es costo total.

- [ ] **Paso 1: pruebas que fallan** (una por línea de la tabla; el resultado esperado va completo en cada `toEqual`):

| Frase | Esperado |
|---|---|
| `Marta compró 2 canastillas de mango criollo a 45.000 debe` | venta, cliente "Marta", 1 ítem {2, canastilla, "mango criollo", 45000, null}, estado debe |
| `Doña Marta se llevó dos canastas de zapote a 45 mil pagó empacado` | cliente "Doña Marta", {2, canastilla, "zapote", 45000, false}, pago |
| `Marta compró 1 canastilla de mango criollo a 45.000 y 1 de zapote a 50.000 debe` | 2 ítems, los dos de canastilla |
| `vendí 2 canastillas de mango criollo a 45.000 pagó` | cliente `null` |
| `Pedro compró 8 kilos de mandarina a 4.000 debe` | {8, kilo, "mandarina", 4000, null} |
| `Marta compró 2 canastillas de mango a 45.000` | estado `null` |
| `Marta abonó 40.000` | abono 40000 |
| `Marta pagó todo` | pagoTotal |
| `entraron 50 canastillas de mango criollo a 36.000` | entrada, costo unitario 36000 |
| `entraron 200 kilos de mandarina por 900.000` | entrada kilo, costo total 900000 |
| `entraron 30 canastillas de mango criollo` | costo `null` |
| `se vaciaron 2 canastillas de mandarina` | vaciado 2 |
| `Marta devolvió 2 canastillas` | devolución 2 |
| `Marta debía 150.000` | saldoInicial 150000 |
| `Marta compró canastillas de mango a 45.000 debe` | `{ ok: false, error: 'No entendí la cantidad' }` |
| `Marta compró 2 canastillas de mango a mucho debe` | `{ ok: false, error: 'No entendí el precio' }` |
| `hola` | `{ ok: false, error: 'No entendí la frase. Ejemplo: "Marta compró 2 canastillas de mango criollo a 45.000 debe"' }` |

- [ ] **Paso 2:** `npx vitest run tests/dominio/parser.test.ts` → FALLA.
- [ ] **Paso 3:** implementar `parsearFrase`. Primero se quitan del final las palabras de estado y de préstamo, después se prueba cada forma de frase en orden (pagoTotal antes que venta) y se dividen los ítems por " y " antes de un número.
- [ ] **Paso 4:** → PASA.
- [ ] **Paso 5:** commit `feat(dominio): intérprete de frases`.

---

### Task 4: Coincidencias de nombres

**Archivos:**
- Crear: `src/dominio/coincidencias.ts`
- Prueba: `tests/dominio/coincidencias.test.ts`

**Interfaces:**
- Consume: `normalizarNombre`.
- Produce:

```ts
export type Coincidencia =
  | { tipo: 'exacta'; id: string; nombre: string }
  | { tipo: 'parecida'; id: string; nombre: string; escrito: string }
  | { tipo: 'nueva'; escrito: string };
export function buscarCoincidencia(escrito: string, catalogo: { id: string; nombre: string; nombreNormalizado: string }[]): Coincidencia;
export function nombreDisponible(nombre: string, catalogo: { nombreNormalizado: string }[]): boolean;
```

Regla: exacta si los nombres normalizados son iguales. Parecida si la distancia de Levenshtein es ≤ 2 (≤ 1 si el nombre tiene 4 letras o menos), o si uno empieza con el otro ("mango" frente a "mango criollo"). Si hay varias parecidas, gana la de menor distancia.

- [ ] **Paso 1: pruebas que fallan:**

```ts
const cat = [{ id: 'c1', nombre: 'Doña Marta', nombreNormalizado: 'marta' }, { id: 'c2', nombre: 'Pedro', nombreNormalizado: 'pedro' }];
expect(buscarCoincidencia('marta', cat)).toEqual({ tipo: 'exacta', id: 'c1', nombre: 'Doña Marta' });
expect(buscarCoincidencia('Martha', cat)).toEqual({ tipo: 'parecida', id: 'c1', nombre: 'Doña Marta', escrito: 'Martha' });
expect(buscarCoincidencia('Lucía', cat)).toEqual({ tipo: 'nueva', escrito: 'Lucía' });
expect(nombreDisponible('Don Pedro', cat)).toBe(false);
const prods = [{ id: 'p1', nombre: 'mango criollo', nombreNormalizado: 'mango criollo' }];
expect(buscarCoincidencia('mango', prods).tipo).toBe('parecida');
```

- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA.
- [ ] **Paso 5:** commit `feat(dominio): coincidencias de nombres`.

---

### Task 5: Lotes

**Archivos:**
- Crear: `src/dominio/lotes.ts`
- Prueba: `tests/dominio/lotes.test.ts`

**Interfaces:**
- Produce:

```ts
export interface EstadoLote { lote: Lote; vendidas: number; vaciadas: number; quedan: number; ingreso: number; ganancia: number | null }
export function estadoLotes(productoId: string, datos: Datos): EstadoLote[];           // del más viejo al más nuevo, sin borrados
export function elegirLotes(productoId: string, cantidad: number, datos: Datos): { partes: { loteId: string | null; cantidad: number }[]; excede: boolean };
```

Reglas:
- `vendidas` suma las ventas de canastilla del lote, pagas y fiadas. `vaciadas` suma los vaciados. `quedan = canastillas − vendidas − vaciadas` y puede ser negativo.
- `ingreso` = Σ cantidad × precio de las ventas de canastilla. `ganancia = ingreso − costoTotal`, o `null` si el lote no tiene costo.
- `elegirLotes` reparte la cantidad del lote más viejo con `quedan > 0` hacia los más nuevos. Si no alcanza, el sobrante va al último lote con `excede: true`. Sin lotes: `[{ loteId: null, cantidad }]` con `excede: true`.
- Las ventas de kilo no se cuentan en ningún lote.

- [ ] **Paso 1: pruebas que fallan** con lotes L1 (50 canastillas, costo 1.800.000, creado el 17) y L2 (30 canastillas, sin costo, creado el 18):
  - 45 vendidas a 45.000 en L1 → L1 `{ vendidas: 45, quedan: 5, ingreso: 2025000, ganancia: 225000 }`; L2 `ganancia: null`.
  - `elegirLotes(p, 8)` → `partes: [{ loteId: 'L1', cantidad: 5 }, { loteId: 'L2', cantidad: 3 }]`, `excede: false`.
  - `elegirLotes(p, 40)` → `excede: true` y el último trozo en L2.
  - 2 vaciados en L1 → `quedan` baja 2 y `ingreso` no cambia.
  - Una venta de 8 kilos del mismo producto no cambia ningún lote.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA.
- [ ] **Paso 5:** commit `feat(dominio): lotes`.

---

### Task 6: Fiados

**Archivos:**
- Crear: `src/dominio/fiados.ts`
- Prueba: `tests/dominio/fiados.test.ts`

**Interfaces:**
- Produce:

```ts
export interface LineaCuenta { tipo: 'venta' | 'saldoInicial' | 'abono'; id: string; fecha: string; creadoPor: string;
  ventaGrupo?: Venta; total: number; pendiente: number; debe: boolean }
export interface EstadoCuenta { debe: boolean; saldo: number; lineas: LineaCuenta[]; todas: LineaCuenta[] }
export function estadoCuenta(clienteId: string, datos: Datos): EstadoCuenta;
export function validarAbono(valor: number, saldo: number): string | null;
```

Reglas (spec §7.4):
- Las deudas son las ventas con estado `debe` más el saldo inicial, sin borrados. El saldo inicial siempre se trata como la deuda más vieja.
- `saldo = Σ deudas − Σ abonos`.
- Los abonos se aplican de la deuda más vieja a la más nueva. Una deuda cubierta del todo queda con `debe: false, pendiente: 0`; la cubierta en parte queda con `debe: true` y el pendiente que le falta.
- `lineas` son los movimientos desde el último momento en que el saldo acumulado llegó a 0. `todas` es el historial completo. Las dos van en orden de fecha.
- Un pago total (`pagoTotal`) se guarda como un abono por el saldo del momento; esto lo hace la Tarea 9.
- `validarAbono`: si `valor > saldo`, devuelve `` `El abono es mayor que la deuda. Debe ${formatoCOP(saldo)}` ``. Si `valor <= 0`, devuelve `'El abono debe ser mayor que cero'`. Si no, `null`.

- [ ] **Paso 1: pruebas que fallan:**
  - Ventas fiadas de 90.000 (día 12) y 60.000 (día 14) con un abono de 100.000 (día 15) → `saldo: 50000, debe: true`. La de 90.000 queda `{ debe: false, pendiente: 0 }`, la de 60.000 `{ debe: true, pendiente: 50000 }`.
  - Saldo inicial de 150.000 creado después de una venta fiada de 20.000, más un abono de 100.000 → el abono cubre primero el saldo inicial: saldo inicial pendiente 50.000 y venta pendiente 20.000.
  - El saldo llega a 0 el día 10 y hay una venta nueva el día 12 → `lineas` solo trae la del 12; `todas` trae todo.
  - Las ventas con estado `pago` no aparecen.
  - `validarAbono(60000, 50000)` → `'El abono es mayor que la deuda. Debe $50.000'`.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA.
- [ ] **Paso 5:** commit `feat(dominio): fiados y abonos`.

---

### Task 7: Canastillas prestadas

**Archivos:**
- Crear: `src/dominio/canastillas.ts`
- Prueba: `tests/dominio/canastillas.test.ts`

**Interfaces:**
- Produce:

```ts
export function prestadasCliente(clienteId: string, datos: Datos): { total: number; detalle: { venta: Venta; cantidad: number }[] };
export function validarDevolucion(cantidad: number, prestadas: number): string | null;
```

Reglas: `total = Σ cantidad` de las ventas de canastilla con `prestada: true` − Σ devoluciones. `validarDevolucion` devuelve `` `Solo tiene ${prestadas} canastillas prestadas` `` si `cantidad > prestadas`.

- [ ] **Paso 1: pruebas que fallan:** una venta de 1 mango prestada, 1 de zapote prestada, 1 empacada y 1 devolución → `total: 1`. `validarDevolucion(3, 1)` → `'Solo tiene 1 canastillas prestadas'`.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA. **Paso 5:** commit `feat(dominio): canastillas prestadas`.

---

### Task 8: Cierre del día

**Archivos:**
- Crear: `src/dominio/cierre.ts`
- Prueba: `tests/dominio/cierre.test.ts`

**Interfaces:**
- Consume: `fechaBogota`, `estadoLotes`.
- Produce:

```ts
export interface Cierre {
  fecha: string;
  fiados: { clienteId: string; descripcion: string; total: number }[]; totalFiado: number;
  abonos: number;
  productos: { productoId: string; nombre: string; entraron: number; vendidas: number; vaciadas: number; quedan: number }[];
  prestadasHoy: number;
  contado: number;
}
export function resumenDia(fecha: string, datos: Datos): Cierre;   // fecha = 'YYYY-MM-DD' en Bogotá
```

Reglas (spec §7.6):
- Todo se filtra por `fechaBogota(creadoEn) === fecha`.
- `entraron` cuenta los lotes creados ese día. `vendidas` y `vaciadas` son las del día. `quedan` es el total actual de todos los lotes del producto.
- `contado` suma las ventas de canastilla pagadas del día, incluidos los clientes de paso.
- `descripcion` tiene la forma `"2 canast. mango criollo"` o `"8 kg mandarina"`.

- [ ] **Paso 1: pruebas que fallan:**
  - Datos de las pantallas de muestra → `totalFiado: 122000`, `abonos: 100000`, mango `{ entraron: 50, vendidas: 45, vaciadas: 0, quedan: 5 }`.
  - **Foco 3:** una venta con `creadoEn: '2026-11-18T01:30:00Z'` aparece en `resumenDia('2026-11-17', …)` y no en el del 18.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA. **Paso 5:** commit `feat(dominio): cierre del día`.

---

### Task 9: Borrador de confirmación (reglas antes de guardar)

**Archivos:**
- Crear: `src/dominio/borrador.ts`
- Prueba: `tests/dominio/borrador.test.ts`

**Interfaces:**
- Consume: `Intencion`, `buscarCoincidencia`, `elegirLotes`, `estadoCuenta`, `validarAbono`, `prestadasCliente`, `validarDevolucion`.
- Produce:

```ts
export interface LineaBorrador { item: ItemFrase; producto: Coincidencia; partes: { loteId: string | null; cantidad: number }[]; total: number }
export interface Borrador {
  intencion: Intencion;
  cliente: Coincidencia | null;          // null = cliente de paso o intención sin cliente
  productos: Coincidencia[];             // entrada y vaciado
  lineas: LineaBorrador[];               // solo en venta
  total: number;
  pide: { estado: boolean; prestada: number[]; canastillasDeEntrada: boolean };  // índices de líneas sin elegir préstamo
  avisos: string[];
  valorCalculado?: number;               // pagoTotal: saldo actual
}
export type ResultadoBorrador = { ok: true; borrador: Borrador } | { ok: false; error: string };
export function prepararBorrador(intencion: Intencion, datos: Datos): ResultadoBorrador;
export function listoParaGuardar(b: Borrador): boolean;  // estado y préstamos elegidos, coincidencias resueltas
```

Errores, con este texto exacto:
- Venta `debe` sin cliente → `'Para fiar necesito el nombre del cliente'`.
- Venta sin cliente con un ítem de canastilla que tiene `prestada: true` → `'Para prestar canastillas necesito el nombre del cliente'`.
- Venta de kilo con estado `pago` → `'Las ventas por kilo pagadas no hace falta anotarlas'`.
- Venta sin cliente con estado `debe` y un ítem de kilo → el mismo mensaje de fiar.
- Abono: lo que devuelva `validarAbono`. Devolución: lo que devuelva `validarDevolucion`.
- Abono, pagoTotal o devolución a un cliente `nueva` → `` `No conozco a "${escrito}"` ``.
- Saldo inicial cuando el cliente ya tiene uno → `'Este cliente ya tiene saldo de la libreta'`.

Avisos (no impiden guardar):
- `excede` en una línea → `` `Solo quedan ${n} canastillas de ${producto}` ``.

`pide`:
- `estado: true` si la venta trae `estado: null`.
- `prestada`: índices de las líneas de canastilla con `prestada: null`. Mientras quede alguna sin elegir, el cliente de paso se valida otra vez al elegir: si elige "Sí, prestadas" sin nombre, aplica el error de préstamo.
- `canastillasDeEntrada: true` si es una entrada en kilos.

- [ ] **Paso 1: pruebas que fallan:** una por cada error y aviso de arriba (con el texto exacto), más:
  - Venta de 2 ítems → `total` igual a la suma, `pide.prestada` igual a `[0, 1]`.
  - "Martha" con "Marta" en el catálogo → `cliente.tipo === 'parecida'`.
  - pagoTotal con saldo 50.000 → `valorCalculado: 50000`.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA. **Paso 5:** commit `feat(dominio): borrador y reglas`.

---

### Task 10: Base local, repositorio e historial

**Archivos:**
- Crear: `src/datos/db.ts`, `src/datos/repositorio.ts`, `src/datos/guardar.ts`
- Prueba: `tests/datos/repositorio.test.ts`, `tests/datos/guardar.test.ts`

**Interfaces:**
- Produce:

```ts
// db.ts
export type Tabla = 'usuarios'|'clientes'|'productos'|'lotes'|'ventas'|'vaciados'|'abonos'|'saldosIniciales'|'devoluciones';
export class CuentasDB extends Dexie { /* una tabla por Tabla + historial + salida({id, tabla, registro}) + meta({clave, valor}) */ }
export const db: CuentasDB;
// repositorio.ts
export function crear<T extends Base>(tabla: Tabla, datos: Omit<T, keyof Base> & { id?: string }, usuarioId: string): Promise<T>;
export function editar<T extends Base>(tabla: Tabla, id: string, cambios: Partial<T>, usuarioId: string): Promise<T>;
export function borrar(tabla: Tabla, id: string, usuarioId: string): Promise<void>;
export function cargarDatos(): Promise<Datos>;
export function historialDe(registroId: string): Promise<Historial[]>;
// guardar.ts
export function guardarBorrador(b: Borrador, elecciones: { estado?: Estado; prestada: Record<number, boolean>;
  canastillasDeEntrada?: number; resolver: Record<string, 'usarParecido' | 'crearNuevo'> }, usuarioId: string): Promise<void>;
```

Reglas:
- Cada `crear`, `editar` y `borrar` escribe, en una sola transacción, el registro, una fila de `historial` (con `antes` y `despues`) y una fila en `salida` con el registro completo.
- Los ids se generan con `crypto.randomUUID()`. `borrar` pone `borrado: true`. `cargarDatos` trae también los borrados; los filtros de `dominio/` los excluyen.
- `crear` de cliente o producto falla con `` `Ya existe un cliente llamado "${nombre}". Usa otro nombre, por ejemplo "${nombre} Pérez"` `` si `nombreDisponible` es falso. Para producto: `'Ya existe un producto con ese nombre'`.
- `guardarBorrador` crea primero los clientes y productos nuevos. Después crea una fila `Venta` por cada parte de cada línea, todas con el mismo `grupoId`. El pagoTotal se guarda como un `Abono` por `valorCalculado`.
- El costo de una entrada se guarda en `costoTotal`: si es unitario, cantidad × valor; si es por kilo, kilos × precio. En `costoDetalle` va el texto, por ejemplo `"200 kg × $4.500"`.
- Para agregar el costo de un lote después, se usa `editar('lotes', id, { costoTotal, costoDetalle })`.
- `guardarBorrador` ignora una segunda llamada con el mismo borrador mientras la primera no termina. Así un doble toque no duplica.

- [ ] **Paso 1: pruebas que fallan** (con fake-indexeddb):
  - `crear` deja una fila en historial y otra en salida.
  - `editar` guarda `antes` y `despues`.
  - `borrar` → el registro queda con `borrado: true` y `estadoCuenta` ya no lo cuenta.
  - Cliente duplicado → el error con su texto exacto.
  - **Foco 2:** dos llamadas seguidas a `guardarBorrador` con el mismo borrador → 1 solo `grupoId` en `ventas`.
  - **Foco 4:** venta fiada de 2 × 45.000; `editar` la cantidad a 3 → `estadoCuenta` da saldo 135000 y en el lote `quedan` baja 1 más.
  - Venta de 8 canastillas con L1 al que le quedan 5 → 2 filas de venta (5 en L1 y 3 en L2) con el mismo `grupoId`.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA. **Paso 5:** commit `feat(datos): base local, repositorio e historial`.

---

### Task 11: Sincronización con Supabase

**Archivos:**
- Crear: `supabase/migrations/0001_inicial.sql`, `src/sync/mapeo.ts`, `src/sync/supabase.ts`, `src/sync/sincronizar.ts`
- Prueba: `tests/sync/sincronizar.test.ts`

**Interfaces:**
- Produce:

```ts
export function aFila(registro: object): Record<string, unknown>;    // camelCase -> snake_case
export function deFila(fila: Record<string, unknown>): object;
export function sincronizar(cliente: SupabaseClient): Promise<{ subidos: number; bajados: number }>;
export function iniciarSincronizacion(cliente: SupabaseClient): () => void;  // al volver 'online', al abrir y cada 30 s
```

SQL:
- Una tabla por cada `Tabla`, con nombres en snake_case (`saldos_iniciales`) y columnas en snake_case. Ids `uuid primary key`. Fechas `timestamptz`.
- Restricción `unique (nombre_normalizado)` en `clientes` y en `productos`, entre los no borrados.
- La tabla `historial` también se sincroniza.
- RLS activado en todas las tablas, con una política que da acceso solo a `auth.role() = 'authenticated'`.

Reglas:
- Subir: se hace upsert por id de cada fila de `salida`, en orden. Cada fila subida se quita de la cola. Si hay un error de red, la fila queda en la cola para reintentar.
- Bajar: por cada tabla, se traen las filas con `actualizado_en > meta.ultimaBajada` y se guardan con `put` en Dexie. Si un registro local tiene `actualizadoEn` más nuevo, gana el local.
- Si dos celulares crean el mismo cliente sin señal, la restricción `unique` hace fallar el upsert. Ese registro se marca `conflicto` en `meta` y la pantalla de Clientes lo muestra para que alguien lo renombre.

- [ ] **Paso 1: pruebas que fallan** con un `SupabaseClient` simulado (un objeto con `from().upsert()` y `from().select().gt()`):
  - Subir 3 filas → la cola queda vacía y `upsert` se llamó 3 veces.
  - **Foco 2:** la misma fila subida 2 veces (reintento) → el upsert se hace por id, sin duplicar.
  - **Foco 5:** un error de red al subir → la fila sigue en la cola. Después de cerrar y reabrir la base (`db.close(); db.open()`), la fila sigue ahí. Un `sincronizar` exitoso la sube.
  - Bajar un registro más viejo que el local → el local no cambia.
  - `deFila(aFila(venta))` da `venta` otra vez.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA. **Paso 5:** commit `feat(sync): sincronización con Supabase`.

---

### Task 12: Acceso: negocio, usuarios y PIN

**Archivos:**
- Crear: `src/auth/pin.ts`, `src/auth/sesion.ts`, `src/ui/acceso/Acceso.tsx`
- Prueba: `tests/auth/pin.test.ts`, `tests/ui/acceso/Acceso.test.tsx`

**Interfaces:**
- Produce:

```ts
export function hashPin(pin: string, sal?: string): Promise<{ hash: string; sal: string }>;  // PBKDF2-SHA256, 100000 iteraciones
export function verificarPin(pin: string, hash: string, sal: string): Promise<boolean>;
export function entrarNegocio(correo: string, clave: string): Promise<string | null>;        // error o null
export function usuarioActivo(): Usuario | null;
export function elegirUsuario(u: Usuario, pin: string): Promise<boolean>;
export function salir(): void;
```

Flujo (spec §7.7):
1. La primera vez en cada celular se entra con la cuenta del negocio (correo y clave de Supabase). La sesión queda guardada.
2. Pantalla "¿Quién eres?": botones grandes con los nombres de los usuarios, y luego un teclado de 4 dígitos.
3. Si no hay usuarios, aparece "Crear el primer usuario" (nombre y PIN dos veces).
4. Desde esa pantalla, cualquier usuario puede agregar otro.
5. El PIN debe tener exactamente 4 dígitos. Un PIN equivocado muestra `'PIN incorrecto'`.
6. El usuario activo se guarda en `localStorage` (con try/catch) y se usa como `creadoPor`.

- [ ] **Paso 1: pruebas que fallan:**
  - `verificarPin('1234', …hashPin('1234'))` → `true`; con `'9999'` → `false`.
  - UI: tocar "Carlos", escribir 1, 2, 3, 4 → entra.
  - UI: un PIN equivocado → aparece `PIN incorrecto`.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA. **Paso 5:** commit `feat(auth): acceso con usuario y PIN`.

---

### Task 13: Pantalla Anotar (texto, voz y confirmación)

**Archivos:**
- Crear: `src/ui/Navegacion.tsx`, `src/ui/anotar/Anotar.tsx`, `src/ui/anotar/Confirmacion.tsx`, `src/ui/anotar/useDictado.ts`
- Modificar: `src/ui/App.tsx` (rutas por estado: anotar | clientes | lotes | cierre)
- Prueba: `tests/ui/anotar/Anotar.test.tsx`, `tests/ui/anotar/useDictado.test.ts`

**Interfaces:**
- Consume: `parsearFrase`, `prepararBorrador`, `listoParaGuardar`, `guardarBorrador`, `cargarDatos`.
- Produce: `useDictado(): { disponible: boolean; escuchando: boolean; iniciar(): void; detener(): void; texto: string; error: string | null }`. Usa `window.SpeechRecognition ?? window.webkitSpeechRecognition` con `lang: 'es-CO'`. Si no está disponible, el botón muestra "Escribe la venta".

Pantalla (seguir el artboard "1 · Anotar venta" de las pantallas de muestra):
- Encabezado con la fecha y "Hola, <usuario>", y un indicador "En línea" / "Sin señal" (`navigator.onLine`).
- Caja de texto con la etiqueta "¿Qué vendiste?", micrófono de 96 px y el texto "Toca y habla".
- Botón "Revisar", o fin del dictado → se muestra la tarjeta de confirmación.

`Confirmacion`:
- Una fila por línea: cantidad × precio = total. Total general. Estado DEBE/PAGÓ.
- Si `pide.estado`, dos botones: [Pagó] [Debe].
- Por cada índice en `pide.prestada`: "¿Se llevó las canastillas?" con [Sí, prestadas] [No, empacado].
- Coincidencia parecida: "No conozco a "Martha". ¿Quisiste decir **Marta**?" con [Sí, es Marta] [No, es cliente nueva]. Igual para productos, con "producto nuevo".
- Si `pide.canastillasDeEntrada`: "¿En cuántas canastillas llegó?" con un campo numérico.
- Avisos en naranja. Botones [Corregir] [Guardar]. Guardar queda deshabilitado mientras `!listoParaGuardar`.
- Un error de `prepararBorrador` o `parsearFrase` se muestra con el texto tal cual.
- Al guardar: el mensaje "Guardado" y la caja de texto vacía.

- [ ] **Paso 1: pruebas que fallan:**
  - Escribir la frase de Marta → Revisar → aparecen `Doña Marta`, `$90.000` y `DEBE`. Guardar está deshabilitado hasta tocar "Sí, prestadas"; después se guarda y existe la venta en Dexie.
  - `vendí 2 canastillas de mango criollo a 45.000 debe` → aparece `Para fiar necesito el nombre del cliente` y no hay botón Guardar.
  - `useDictado` con un `SpeechRecognition` simulado que emite "Marta abonó 40.000" → `texto` es igual a esa frase. Sin API → `disponible: false`.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA. **Paso 5:** commit `feat(ui): pantalla Anotar`.

---

### Task 14: Pantalla Clientes (fiados, abonos, canastillas)

**Archivos:**
- Crear: `src/ui/clientes/Clientes.tsx`, `src/ui/comun/Historial.tsx`
- Prueba: `tests/ui/clientes/Clientes.test.tsx`

**Interfaces:**
- Consume: `estadoCuenta`, `prestadasCliente`, `historialDe`, `editar`, `borrar`.

Pantalla (artboard "2 · Consultar cliente"):
- Campo "Buscar por nombre" que filtra con `normalizarNombre` y muestra coincidencias mientras se escribe.
- Tarjeta del cliente con `DEBE: SÍ` (colores de deuda) o `DEBE: NO` (verde), Saldo y "Canastillas prestadas".
- "De dónde sale la deuda": cada línea de `lineas` con fecha, hora, "anotó <usuario>" y el estado (`Pagada`, `Debe $X`, abono en verde con signo menos). El saldo inicial aparece como "Saldo de la libreta". Al final, el enlace "Ver todo el historial".
- Botones "Registrar abono" y "Devolvió canast." que abren Anotar con la frase empezada ("Marta abonó ", "Marta devolvió ").
- Tocar una línea abre `Historial` con [Corregir] [Borrar] y la lista de cambios ("Carlos cambió cantidad: 5 → 3"). Borrar pide confirmación.
- Si `meta` tiene un conflicto de nombre, se muestra un aviso para renombrar.

- [ ] **Paso 1: pruebas que fallan:**
  - Con el ejemplo de la spec (90.000 + 60.000, abono 100.000), buscar "marta" → aparecen `DEBE: SÍ`, `$50.000`, `Pagada` y `Debe $50.000`.
  - Corregir la cantidad desde Historial → el saldo cambia en pantalla.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA. **Paso 5:** commit `feat(ui): pantalla Clientes`.

---

### Task 15: Pantallas Lotes y Cierre

**Archivos:**
- Crear: `src/ui/lotes/Lotes.tsx`, `src/ui/cierre/Cierre.tsx`
- Prueba: `tests/ui/lotes/Lotes.test.tsx`, `tests/ui/cierre/Cierre.test.tsx`

**Interfaces:**
- Consume: `estadoLotes`, `resumenDia`, `editar` (costo del lote), `fechaBogota`.

Lotes (artboard "3 · Lotes", ya sin kilos ni plata de lo vaciado):
- Una tarjeta por producto con el total "quedan" y cada lote: fecha, "X de N vendidas", barra de avance y "vaciadas".
- Lote con costo: "Costo $… · vendido $… · +$ganancia".
- Lote sin costo: el texto "Sin costo · se puede agregar después" y el botón "Agregar costo", que abre un campo con "total" o "por canastilla".
- Lote con `quedan < 0`: "Revisar: se anotaron N de más".
- "Ver a quién se vendió cada una" despliega las ventas del lote con cliente (o "Cliente de paso"), cantidad, hora y usuario.
- Botón "+ Entró mercancía" que abre Anotar con "entraron ".

Cierre (artboard "4 · Cierre del día"): fiado hoy, abonos hoy, fiados de hoy, tabla de canastillas (Entr., Vend., Vac., Quedan), "Canastillas prestadas hoy" y "Vendido de contado". Un selector de fecha permite ver días anteriores.

- [ ] **Paso 1: pruebas que fallan:**
  - Lotes con los datos de la Tarea 5 → aparecen `45 de 50 vendidas` y `+$225.000`; agregar el costo de 1.200.000 a L2 → aparece la ganancia de L2.
  - Cierre con los datos de la Tarea 8 → aparecen `$122.000` y `$100.000`, y en la fila del mango `50 45 0 5`.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar. **Paso 4:** → PASA. **Paso 5:** commit `feat(ui): pantallas Lotes y Cierre`.

---

### Task 16: PWA instalable, sin señal y publicación

**Archivos:**
- Modificar: `vite.config.ts` (vite-plugin-pwa: `registerType: 'autoUpdate'`, manifest con `name: 'Cuentas Claras'`, `lang: 'es-CO'`, `theme_color: '#1F6B45'`, `background_color: '#FBFAF6'`, `display: 'standalone'`, íconos de 192 y 512 px), `src/main.tsx` (registrar el service worker e `iniciarSincronizacion`), `README.md`
- Crear: `public/icono-192.png`, `public/icono-512.png`
- Prueba: `tests/pwa.test.ts`

- [ ] **Paso 1: prueba que falla:** después de `npm run build`, `dist/manifest.webmanifest` existe con `name === 'Cuentas Claras'` y `display === 'standalone'`, y `dist/sw.js` existe.
- [ ] **Paso 2:** → FALLA. **Paso 3:** configurar. **Paso 4:** → PASA.
- [ ] **Paso 5:** `README.md` en español:
  1. Crear un proyecto en Supabase (plan gratuito).
  2. Ejecutar `supabase/migrations/0001_inicial.sql`.
  3. Crear el usuario del negocio en Authentication.
  4. Copiar la URL y la anon key en `.env`.
  5. Publicar `dist/` en un hosting estático gratuito (Netlify o Vercel).
  6. Instalar en el celular. Android: menú ⋮ → "Agregar a pantalla de inicio". iPhone: Compartir → "Agregar a inicio".
- [ ] **Paso 6:** `npm test` → todo PASA; `npm run build` → sin errores.
- [ ] **Paso 7:** commit `feat: PWA instalable y guía de publicación`.

---

## Cobertura de la spec

| Spec | Tareas |
|---|---|
| §7.1 Ventas (frases, precio unitario, estado, cliente de paso, kilo pagado, préstamo, varios productos, confirmación) | 3, 9, 13 |
| §7.2 Clientes y productos (únicos, normalización, preguntar antes de crear) | 2, 4, 9, 10, 13 |
| §7.3 Lotes (entrada, kilos → canastillas, costo opcional, FIFO, vaciado, exceso, ganancia, trazabilidad) | 5, 9, 10, 15 |
| §7.4 Fiados (saldo, abonos FIFO, pago total, abono mayor, saldo inicial) | 6, 9, 14 |
| §7.5 Canastillas prestadas | 7, 9, 14 |
| §7.6 Cierre | 8, 15 |
| §7.7 Usuarios, trazabilidad, correcciones | 10, 12, 14 |
| §7.8 Detalle desde el último saldo en 0 | 6, 14 |
| §8 PWA, local primero, voz, diseño | 1, 11, 13, 16 |
