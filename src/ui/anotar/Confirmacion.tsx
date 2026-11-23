import type { Borrador, Elecciones } from '../../dominio/borrador';
import type { Coincidencia } from '../../dominio/coincidencias';
import { listoParaGuardar, revisarElecciones } from '../../dominio/borrador';
import { formatoCOP, horaBogota } from '../../dominio/texto';

interface Props {
  borrador: Borrador;
  elecciones: Elecciones;
  cambiar: (e: Elecciones) => void;
  alGuardar: () => void;
  alCorregir: () => void;
  guardando: boolean;
}

const nombre = (c: Coincidencia) => (c.tipo === 'nueva' ? c.escrito : c.nombre);

function Pregunta({ c, clave, tipo, e, cambiar }: { c: Coincidencia; clave: string; tipo: 'cliente' | 'producto'; e: Elecciones; cambiar: (e: Elecciones) => void }) {
  if (c.tipo !== 'parecida') return null;
  const elegido = e.resolver[clave];
  const elegir = (v: 'usarParecido' | 'crearNuevo') => cambiar({ ...e, resolver: { ...e.resolver, [clave]: v } });
  return (
    <div className="pregunta">
      <p>No conozco {tipo === 'cliente' ? 'a' : 'el producto'} "{c.escrito}". ¿Quisiste decir <strong>{c.nombre}</strong>?</p>
      <div className="dos">
        <button type="button" aria-pressed={elegido === 'usarParecido'} className={elegido === 'usarParecido' ? 'opcion activa' : 'opcion'} onClick={() => elegir('usarParecido')}>
          Sí, es {c.nombre}
        </button>
        <button type="button" aria-pressed={elegido === 'crearNuevo'} className={elegido === 'crearNuevo' ? 'opcion activa' : 'opcion'} onClick={() => elegir('crearNuevo')}>
          {tipo === 'cliente' ? 'No, es cliente nueva' : 'No, es producto nuevo'}
        </button>
      </div>
    </div>
  );
}

function Opciones<T extends string | boolean>({ titulo, valor, opciones, elegir }: {
  titulo: string; valor: T | undefined; opciones: { valor: T; texto: string }[]; elegir: (v: T) => void;
}) {
  return (
    <div className="pregunta">
      <p className="negrita">{titulo}</p>
      <div className="dos">
        {opciones.map((o) => (
          <button key={String(o.valor)} type="button" aria-pressed={valor === o.valor} className={valor === o.valor ? 'opcion activa' : 'opcion'} onClick={() => elegir(o.valor)}>
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

function titulo(b: Borrador): string {
  switch (b.intencion.tipo) {
    case 'venta': return '¿Guardar esta venta?';
    case 'abono': return '¿Guardar este abono?';
    case 'pagoTotal': return '¿Guardar el pago de toda la deuda?';
    case 'devolucion': return '¿Guardar la devolución?';
    case 'saldoInicial': return '¿Guardar el saldo de la libreta?';
    case 'entrada': return '¿Guardar la mercancía que entró?';
    case 'vaciado': return '¿Guardar las canastillas vaciadas?';
  }
}

export default function Confirmacion({ borrador: b, elecciones: e, cambiar, alGuardar, alCorregir, guardando }: Props) {
  const i = b.intencion;
  const estado = i.tipo === 'venta' ? (i.estado ?? e.estado) : undefined;
  const error = revisarElecciones(b, e);
  const listo = listoParaGuardar(b, e);

  return (
    <section className="tarjeta confirmacion" aria-label="Confirmación">
      <h2>{titulo(b)}</h2>
      <dl className="filas">
        {b.cliente && (<><dt>Cliente</dt><dd className="negrita">{nombre(b.cliente)}{b.cliente.tipo === 'nueva' ? ' (nuevo)' : ''}</dd></>)}
        {i.tipo === 'venta' && !b.cliente && (<><dt>Cliente</dt><dd className="negrita">Cliente de paso</dd></>)}
        {i.tipo === 'venta' && b.lineas.map((l, n) => (
          <div key={n} className="fila-linea">
            <dt>Producto</dt>
            <dd>
              <span className="negrita">{nombre(l.producto)}{l.producto.tipo === 'nueva' ? ' (nuevo)' : ''}</span>
              <span> · {l.item.cantidad} {l.item.unidad === 'kilo' ? 'kg' : (l.item.cantidad === 1 ? 'canastilla' : 'canastillas')} × {formatoCOP(l.item.precioUnitario)} = <span className="negrita">{formatoCOP(l.total)}</span></span>
            </dd>
          </div>
        ))}
        {(i.tipo === 'entrada' || i.tipo === 'vaciado') && (<><dt>Producto</dt><dd className="negrita">{nombre(b.productos[0])}{b.productos[0].tipo === 'nueva' ? ' (nuevo)' : ''}</dd></>)}
        {i.tipo === 'entrada' && (<><dt>Entraron</dt><dd>{i.cantidad} {i.unidad === 'kilo' ? 'kg' : 'canastillas'}{i.costo ? ` · costo ${i.costo.tipo === 'total' ? formatoCOP(i.costo.valor) : `${formatoCOP(i.costo.valor)} c/u`}` : ' · sin costo'}</dd></>)}
        {i.tipo === 'vaciado' && (<><dt>Vaciadas</dt><dd>{i.cantidad} canastillas</dd></>)}
        {i.tipo === 'devolucion' && (<><dt>Devolvió</dt><dd>{i.cantidad} canastillas</dd></>)}
        {(i.tipo === 'venta' || i.tipo === 'abono' || i.tipo === 'pagoTotal' || i.tipo === 'saldoInicial') && (<><dt>Total</dt><dd className="negrita grande">{formatoCOP(b.total)}</dd></>)}
        {estado && (<><dt>Estado</dt><dd><span className={estado === 'debe' ? 'etiqueta deuda' : 'etiqueta pagado'}>{estado === 'debe' ? 'DEBE' : 'PAGÓ'}</span></dd></>)}
        <dt>Fecha</dt><dd>hoy, {horaBogota(new Date().toISOString())}</dd>
      </dl>

      {b.cliente && <Pregunta c={b.cliente} clave="cliente" tipo="cliente" e={e} cambiar={cambiar} />}
      {(i.tipo === 'venta' ? b.lineas.map((l) => l.producto) : b.productos).map((c, n) => (
        <Pregunta key={n} c={c} clave={`producto:${n}`} tipo="producto" e={e} cambiar={cambiar} />
      ))}

      {b.pide.estado && (
        <Opciones titulo="¿Pagó o queda debiendo?" valor={e.estado} elegir={(v) => cambiar({ ...e, estado: v })}
          opciones={[{ valor: 'pago', texto: 'Pagó' }, { valor: 'debe', texto: 'Debe' }]} />
      )}
      {b.pide.prestada.map((n) => (
        <Opciones key={n} titulo={b.lineas.length > 1 ? `¿Se llevó las canastillas de ${nombre(b.lineas[n].producto)}?` : '¿Se llevó las canastillas?'}
          valor={e.prestada[n]} elegir={(v) => cambiar({ ...e, prestada: { ...e.prestada, [n]: v } })}
          opciones={[{ valor: true, texto: 'Sí, prestadas' }, { valor: false, texto: 'No, empacado' }]} />
      ))}
      {b.pide.canastillasDeEntrada && (
        <div className="pregunta">
          <label htmlFor="canastillas-entrada" className="negrita">¿En cuántas canastillas llegó?</label>
          <input id="canastillas-entrada" inputMode="numeric" value={e.canastillasDeEntrada ?? ''}
            onChange={(ev) => cambiar({ ...e, canastillasDeEntrada: Number(ev.target.value.replace(/\D/g, '')) || undefined })} />
        </div>
      )}

      {b.avisos.map((a) => <p key={a} className="aviso">{a}</p>)}
      {error && <p role="alert" className="error">{error}</p>}

      <div className="dos">
        <button type="button" className="boton secundario" onClick={alCorregir}>Corregir</button>
        <button type="button" className="boton principal" disabled={!listo || guardando} onClick={alGuardar}>Guardar</button>
      </div>
    </section>
  );
}
