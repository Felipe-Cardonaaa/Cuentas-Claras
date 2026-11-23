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
        <div className="cifra deuda"><span>Fiado hoy</span><span>{formatoCOP(c.totalFiado)}</span></div>
        <div className="cifra pagado"><span>Abonos hoy</span><span>{formatoCOP(c.abonos)}</span></div>
      </div>

      <section className="tarjeta" aria-label="Fiados del día">
        <span className="negrita">Fiados de hoy</span>
        {c.fiados.length === 0 ? <span className="suave">No hubo fiados.</span> : c.fiados.map((f, i) => (
          <div key={i} className="linea-arriba">
            <span>{cliente(f.clienteId)} · {f.descripcion}</span>
            <span className="negrita">{formatoCOP(f.total)}</span>
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
