# Cuentas Claras — Documento de diseño

Fecha: 2026-11-23 · Estado: borrador para aprobación

Pantallas de muestra: https://claude.ai/artifact/6c1DhScXQxPawSrBgyrjPU
(Anotar venta, Consultar cliente, Lotes, Cierre del día).

Convención: lo que decidió el dueño del proyecto se escribe sin marca. Las
decisiones tomadas por el diseñador sin confirmación explícita llevan
**[decisión del diseñador]**.

---

## 1. Intención

Un negocio familiar de la plaza minorista lleva hoy sus ventas, fiados e
inventario en libretas. Cuentas Claras reemplaza esa libreta por una app de
celular que:

- permite anotar una venta con una frase natural, hablada o escrita
  ("Marta compró 2 canastillas de mango criollo a 45.000 debe");
- lleva la trazabilidad de cada lote de mercancía que entra (a quién se vendió
  cada canastilla, cuántas quedan, si se vendió todo, cuánto se ganó);
- permite consultar un fiado buscando solo el nombre del cliente.

Los usuarios son personas acostumbradas a lo "arcaico": la app debe ser
amigable a la vista y muy sencilla. Si la app es más difícil que la libreta,
fracasa.

## 2. Usuarios y contexto

- 3 a 4 personas de la familia, cada una con su celular, usando la app **al
  mismo tiempo**. 3 Android y 1 iPhone.
- En la plaza se usan datos móviles; la señal puede fallar. La app debe
  permitir anotar sin señal y sincronizar después.
- Idioma: español de Colombia. Moneda: pesos colombianos, sin decimales,
  formato `$45.000`.

## 3. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
1. Anotar ventas, abonos, entradas de mercancía, vaciados y devoluciones de
   canastillas con una frase, por voz o texto, con confirmación antes de guardar.
2. Detectar automáticamente cliente, producto, cantidad, unidad, precio y estado
   (pagó/debe). La fecha y la hora se ponen solas.
3. Inventario por lotes, separados y sumados por producto.
4. Fiados con saldo, abonos y detalle elemento por elemento.
5. Control de canastillas prestadas por cliente.
6. Cierre del día.
7. Trazabilidad total: quién anotó o cambió cada cosa y cuándo.

**No-objetivos (por ahora)**
- Facturación electrónica, impuestos, contabilidad formal.
- Unidades distintas a canastilla y kilo (bultos, cajas, piñas por unidad: el
  negocio no las maneja).
- Registro de ventas por kilo pagadas.
- Ganancia de lo vendido por kilo.
- Publicación en Play Store / App Store.
- Entender frases totalmente libres con IA (posible mejora futura).

**Anti-objetivos (cosas que harían fracasar la app aunque "funcione")**
- Que un error de escritura parta el fiado de un cliente en dos.
- Que se guarde algo sin que la persona vea y confirme lo que la app entendió.
- Que se pierdan datos por falta de señal o por perder un celular.
- Pantallas cargadas, letra pequeña o pasos de más.

## 4. Restricciones

- Debe funcionar igual en Android y iPhone.
- Costo mensual cercano a $0.
- Voz y texto. El micrófono es el botón principal.
- Sin señal: anotar escribiendo debe funcionar siempre.

## 5. Enfoques considerados

| Enfoque | Qué es | A favor | En contra |
|---|---|---|---|
| **A. App web instalable (PWA) + base de datos en la nube con almacenamiento local** | Se abre por enlace y se agrega a la pantalla de inicio. Datos locales primero, sincronizados con Postgres en la nube. Interpretación de frases con reglas propias. | Un solo código para Android e iPhone. Funciona sin señal para anotar escribiendo. $0/mes. Actualizaciones sin tiendas. Rápido de construir. | El dictado por voz del navegador suele necesitar internet en Android. |
| B. App nativa (tiendas) | La misma idea, instalada desde Play Store / App Store. | Voz sin señal en la mayoría de equipos. | USD 99/año (Apple) + USD 25 (Google), revisiones de tienda, más tiempo de construcción. |
| C. Planilla + AppSheet | Hoja de Google con una app generada. | Muy rápido. | No interpreta frases naturales ni permite una interfaz tan simple. Descartado. |

**Elegido: A.** Cubre todo lo pedido en todos los celulares del negocio, sin
costo mensual. Si la voz sin señal se vuelve un problema real, se puede migrar
a B reutilizando la base de datos.

## 6. Conceptos del negocio

- **Cliente**: persona con nombre único. Existe además el "cliente de paso"
  (sin nombre).
- **Producto**: p. ej. "mango criollo", "mandarina", "zapote".
- **Lote**: una entrada de mercancía de un producto en una fecha, contada en
  **canastillas**. Costo opcional.
- **Venta de canastilla entera**: descuenta del lote.
- **Vaciado**: canastillas que se abren para vender por kilo. Descuentan del
  lote igual que una venta. No se registra cuánto se vendió en kilos.
- **Venta por kilo**: solo se anota si es **fiada**. No afecta los lotes.
- **Fiado**: venta con estado "debe".
- **Abono**: pago parcial o total de lo que debe un cliente.
- **Canastilla prestada**: cuando se vende canastilla entera y el producto no se
  empaca, el cliente se lleva la canastilla y debe devolverla.
- **Usuario**: miembro de la familia que usa la app.

## 7. Reglas del negocio

### 7.1 Ventas
1. Formato base: `<cliente> compró <cantidad> <canastilla(s)|kilo(s)> de <producto> a <precio> <pagó|debe> [empacado|con canastilla]`.
2. El precio dicho es **por unidad** (por canastilla o por kilo). Total = cantidad × precio.
3. Fecha, hora y usuario se registran solos.
4. La frase debe decir `pagó` o `debe`. Si falta, la confirmación lo pide
   (no se guarda sin estado). **[decisión del diseñador]**
5. **Cliente de paso**: si la frase no tiene cliente (p. ej. "vendí 2 canastillas
   de mango criollo a 45.000 pagó"), queda como "cliente de paso". Solo se permite
   si está **pagada** y **no** se presta canastilla. Para fiar o prestar
   canastilla siempre hace falta nombre; si falta, la app no guarda y explica:
   "Para fiar necesito el nombre del cliente".
6. **Ventas por kilo pagadas no se anotan.** Si alguien lo intenta, la app avisa
   que no hace falta anotarlas y no guarda. **[decisión del diseñador]**
7. **Canastilla prestada**: en toda venta de canastilla entera, la confirmación
   pregunta "¿Se llevó las canastillas? [Sí, prestadas] [No, empacado]". Si la
   frase ya dice "empacado" o "con canastilla", viene preseleccionado. No se
   puede guardar sin elegir. Nunca se pregunta en ventas por kilo.
8. Antes de guardar, **siempre** se muestra una pantalla de confirmación con lo
   entendido (cliente, producto, lote, cantidad × precio = total, estado,
   canastillas, fecha/hora) y los botones Guardar / Corregir.

### 7.2 Clientes y productos
1. Nunca puede haber dos clientes con el mismo nombre. Si se intenta crear uno
   repetido, la app bloquea y explica por qué, sugiriendo diferenciarlo
   ("Juan Pérez", "Juan aguacates").
2. La comparación de nombres ignora mayúsculas, tildes y espacios extra
   ("marta" = "Marta"). **[decisión del diseñador]**
3. Si la frase nombra un cliente o producto que no existe, la app **pregunta antes
   de crear**, sugiriendo el más parecido: "No conozco a 'Martha'. ¿Quisiste
   decir **Marta**? [Sí, es Marta] [No, es cliente nueva]". Igual para productos.
4. "Doña", "Don", "señora" al inicio del nombre se tratan como tratamiento, no
   como parte del nombre, al buscar coincidencias. **[decisión del diseñador]**

### 7.3 Lotes e inventario
1. Entrada: "entraron 50 canastillas de mango criollo [a 36.000 | por 1.800.000]".
2. Si la entrada se dice en kilos ("entraron 200 kilos de mandarina [a 4.500]"),
   la app pregunta "¿En cuántas canastillas llegó?" y el lote queda en
   canastillas. El costo se guarda como kilos × precio.
3. **Costo opcional**, se puede poner al registrar la entrada o después (p. ej. al
   final del día). Se acepta como precio por unidad o como total.
4. Los lotes se ven **separados y sumados** por producto.
5. Las ventas de canastilla entera y los vaciados descuentan del **lote más viejo**
   que tenga canastillas disponibles. Nadie elige lote al anotar.
6. Vaciado: "se vaciaron 2 canastillas de mandarina".
7. Los lotes con sobrantes siguen disponibles los días siguientes.
8. Si una venta o vaciado supera lo disponible (puede pasar al sincronizar ventas
   hechas sin señal), se permite guardar con aviso, y el lote muestra la
   diferencia para revisar. **[decisión del diseñador]**
9. **Ganancia del lote** (solo si tiene costo): total de canastillas enteras
   vendidas (pagadas + fiadas) − costo. Las canastillas vaciadas no suman
   ingreso. Mientras el lote no tenga costo, no se muestra ganancia.
10. Cada lote permite ver a quién se vendió cada canastilla, con fecha, hora y
    quién lo anotó.

### 7.4 Fiados y abonos
1. Consulta: se busca el nombre y aparece `DEBE: SÍ/NO`, saldo, canastillas
   prestadas y el detalle elemento por elemento (fecha, hora, producto, cantidad
   × precio, quién lo anotó, estado de cada venta).
2. Saldo = suma de ventas fiadas − suma de abonos.
3. Abono: "Marta abonó 40.000". Pago total: "Marta pagó todo".
4. El abono se resta del total adeudado y, para el detalle, se aplica a las
   ventas fiadas **de la más vieja a la más nueva**: cada venta cubierta por
   completo pasa a `debe = no`; la venta cubierta en parte queda en `debe = sí`
   con su valor pendiente nuevo.
5. Un abono mayor que el saldo se rechaza con un mensaje que muestra el saldo
   actual. **[decisión del diseñador]**
6. En base de datos, cada venta tiene una columna booleana `debe` y su valor
   (total y pendiente).

### 7.5 Canastillas prestadas
1. Cada cliente lleva un conteo de canastillas prestadas, aparte de la plata, con
   el detalle de qué venta las originó.
2. Devolución: "Marta devolvió 2 canastillas".
3. No se puede devolver más de las prestadas (mensaje explicativo).
   **[decisión del diseñador]**

### 7.6 Cierre del día
Pantalla con:
- Fiados de hoy (cliente, producto, total) y total fiado hoy.
- Abonos recibidos hoy.
- Canastillas por producto: entraron, vendidas, vaciadas, quedan.
- Canastillas prestadas hoy.
- Opcional: "vendido de contado" = canastillas enteras pagadas hoy (incluye
  clientes de paso).

### 7.7 Usuarios, trazabilidad y correcciones
1. Cada persona entra con su nombre y un PIN de 4 dígitos.
2. Todo registro (venta, abono, entrada, costo, vaciado, devolución) guarda
   usuario, fecha y hora exactas.
3. **Cualquier usuario** puede corregir o borrar cualquier registro. Cada cambio
   queda en un historial con quién, cuándo, valor anterior y valor nuevo. Borrar
   es lógico: el registro queda marcado como borrado y visible en el historial.
4. Las correcciones recalculan saldos, `debe`, lotes y canastillas prestadas.
5. Cualquier usuario puede agregar un usuario nuevo (nombre + PIN). El primer
   usuario se crea al instalar la app por primera vez. **[decisión del diseñador]**

### 7.8 Detalle de la consulta de cliente
El detalle muestra los movimientos desde la última vez que el saldo del cliente
quedó en 0 (ventas fiadas, pagadas o pendientes, y abonos), y un enlace a
"ver todo el historial". **[decisión del diseñador]**

## 8. Cómo se construye (lo decidido)

- **Tipo de app**: aplicación web instalable (PWA), instalable en Android y
  iPhone desde el navegador.
- **Base de datos**: Postgres administrado en la nube (Supabase), plan gratuito.
- **Local primero**: cada registro se guarda en el celular y se envía a la nube
  cuando hay señal. Los 4 celulares ven los mismos datos. Los registros son
  eventos que se suman (no se sobrescriben), así dos personas vendiendo sin señal
  no se pisan; el inventario puede mostrar de más por un rato y se corrige al
  sincronizar.
- **Voz**: reconocimiento de voz del navegador en español de Colombia. Si no
  está disponible (p. ej. sin señal), se escribe.
- **Interpretación de frases**: reglas propias en español, que funcionan sin
  internet. Debe aceptar variaciones comunes: "45.000", "45000", "45 mil";
  "canastilla/canastillas/canasta"; "kilo/kilos/kg"; "compró/se llevó";
  "debe/fiado/quedó debiendo"; "pagó/de contado"; números en palabras del dictado
  ("dos canastillas"). La lista exacta de variaciones queda al constructor,
  probada con frases reales.
- **Diseño visual**: según las pantallas de muestra: letra grande de alta
  legibilidad (Atkinson Hyperlegible), verde para pagado/acciones, naranja para
  deuda, botones grandes (≥ 52 px de alto), barra inferior con Anotar, Clientes,
  Lotes, Cierre.

## 9. Modelo de datos (orientativo)

- `usuarios` (id, nombre, pin_hash)
- `clientes` (id, nombre, nombre_normalizado único)
- `productos` (id, nombre, nombre_normalizado único)
- `lotes` (id, producto_id, fecha, canastillas, costo_total null, costo_detalle, creado_por, creado_en)
- `ventas` (id, cliente_id null, producto_id, lote_id null, unidad canastilla|kilo, cantidad, precio_unitario, total, estado pagó|debe, debe bool, pendiente, canastilla_prestada bool null, creado_por, creado_en, borrado)
- `vaciados` (id, lote_id, cantidad, creado_por, creado_en, borrado)
- `abonos` (id, cliente_id, valor, creado_por, creado_en, borrado)
- `devoluciones_canastilla` (id, cliente_id, cantidad, creado_por, creado_en, borrado)
- `historial` (id, tabla, registro_id, usuario_id, fecha, antes json, despues json, accion)

El constructor puede ajustarlo (p. ej. calcular `debe` y `pendiente` en vistas
en lugar de guardarlos), siempre que la consulta por nombre muestre la columna
`debe` y el valor por venta.

## 10. Lo que queda al constructor

- Framework de la interfaz, librería de almacenamiento local y método de
  sincronización.
- Cómo se implementa el ingreso con PIN sobre Supabase (debe ser: elegir nombre +
  4 dígitos) y las reglas de acceso, de modo que solo los usuarios del negocio
  vean los datos.
- Hospedaje de la app web.
- Algoritmo de "nombre más parecido" (p. ej. distancia de edición sobre nombres
  normalizados).
- Copias de seguridad de la base de datos.
- Pruebas: el intérprete de frases y las reglas de saldo, abonos, lotes y
  canastillas deben tener pruebas automáticas.
