import { useState } from 'react';
import { resumenDia } from '../../dominio/cierre';
import { fechaBogota, formatoCOP } from '../../dominio/texto';
import { useDatos } from '../useDatos';

export default function Cierre() {
  const datos = useDatos();
  const [fecha, setFecha] = useState(() => fechaBogota(new Date().toISOString()));
  if (!datos) return null;
  const c = resumenDia(fecha, datos);
  const cliente = (id: string) => datos.clientes.find((x) => x.id === id)?.nombre ?? '—';

  return (
    <div className="contenido">
      <h2 className="titulo">Cierre del día</h2>
      <label htmlFor="fecha-cierre" className="suave">Día</label>
      <input id="fecha-cierre" type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />

      <div className="resumen">
        <div className="cifra deuda" aria-label="Quedó debiendo hoy"><span>Quedó debiendo hoy</span><span>{formatoCOP(c.totalPendiente)}</span>
          {c.totalFiado !== c.totalPendiente && <span className="suave" style={{ fontSize: 13, fontWeight: 400 }}>de {formatoCOP(c.totalFiado)} fiados hoy</span>}
        </div>
        <div className="cifra pagado"><span>Abonos hoy</span><span>{formatoCOP(c.abonos)}</span></div>
      </div>

      <section className="tarjeta" aria-label="Pagaron hoy">
        <div className="linea-arriba">
          <span className="negrita">Pagaron hoy</span>
          <span className="texto-pagado">{formatoCOP(c.abonos)}</span>
        </div>
        {c.pagaron.length === 0 ? <span className="suave">Hoy nadie abonó.</span> : (
          <ul className="lista">
            {c.pagaron.map((p) => (
              <li key={p.clienteId} className="linea-arriba" style={{ padding: '8px 0' }}>
                <span>{cliente(p.clienteId)}</span><span className="texto-pagado">{formatoCOP(p.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta" aria-label="Quedaron debiendo">
        <div className="linea-arriba">
          <span className="negrita">Quedaron debiendo</span>
          <span className="texto-deuda">{formatoCOP(c.totalPendiente)}</span>
        </div>
        {c.deben.length === 0 ? <span className="suave">Nadie quedó debiendo de lo fiado hoy.</span> : (
          <ul className="lista">
            {c.deben.map((d) => (
              <li key={d.clienteId} className="linea-arriba" style={{ padding: '8px 0' }}>
                <span>{cliente(d.clienteId)}</span><span className="texto-deuda">{formatoCOP(d.pendiente)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta" aria-label="Fiados del día">
        <span className="negrita">Fiados de hoy</span>
        {c.fiados.length === 0 ? <span className="suave">No hubo fiados.</span> : c.fiados.map((f, i) => (
          <div key={i} className="formulario" style={{ gap: 2 }}>
            <div className="linea-arriba">
              <span>{cliente(f.clienteId)} · {f.descripcion}</span>
              <span className="negrita">{formatoCOP(f.total)}</span>
            </div>
            <div className="linea-abajo" style={{ justifyContent: 'flex-end' }}>
              {f.pendiente === 0 ? <span className="texto-pagado">Pagado</span> : <span className="texto-deuda">Debe {formatoCOP(f.pendiente)}</span>}
            </div>
          </div>
        ))}
      </section>

      <section className="tarjeta" aria-label="Canastillas">
        <span className="negrita">Canastillas</span>
        <table className="tabla">
          <thead>
            <tr><th scope="col">Producto</th><th scope="col">Entr.</th><th scope="col">Vend.</th><th scope="col">Vac.</th><th scope="col">Quedan</th></tr>
          </thead>
          <tbody>
            {c.productos.map((p) => (
              <tr key={p.productoId}>
                <td className="negrita">{p.nombre}</td><td>{p.entraron}</td><td>{p.vendidas}</td><td>{p.vaciadas}</td><td className="negrita">{p.quedan === null ? '—' : p.quedan}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {c.productos.some((p) => p.quedan === null) && (
          <p className="aviso" style={{ fontSize: 15 }}>
            Falta anotar la mercancía que entró de: {c.productos.filter((p) => p.quedan === null).map((p) => p.nombre).join(', ')}.
            Ejemplo: "entraron 50 canastillas de {c.productos.find((p) => p.quedan === null)!.nombre}".
          </p>
        )}
        {c.productos.length === 0 && <p className="suave">Hoy no se movieron canastillas.</p>}
      </section>

      <section className="tarjeta" aria-label="Vendido de contado">
        <div className="linea-arriba">
          <span>Vendido de contado <span className="suave">(canastillas enteras)</span></span>
          <span className="negrita">{formatoCOP(c.contado)}</span>
        </div>
      </section>
    </div>
  );
}
