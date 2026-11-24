import { useState } from 'react';
import type { Datos, Lote, Usuario } from '../../dominio/tipos';
import { estadoLotes, type EstadoLote } from '../../dominio/lotes';
import { formatoCOP, horaBogota, parsearPrecio } from '../../dominio/texto';
import { editar } from '../../datos/repositorio';
import { useDatos, useNombresUsuarios } from '../useDatos';
import Historial from '../comun/Historial';
import EntradaMercancia from './EntradaMercancia';
import VaciarCanastillas from './VaciarCanastillas';
import type { Producto } from '../../dominio/tipos';
import type { Tabla } from '../../datos/db';

interface Abierto { tabla: Tabla; registro: Record<string, unknown> & { id: string }; titulo: string }

interface Props { usuario: Usuario; anotarCon: (frase: string) => void }

export function etiquetaFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(iso)).replace(/\./g, '').replace(',', '');
}

function AgregarCosto({ e, usuario }: { e: EstadoLote; usuario: Usuario }) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState('');
  const [modo, setModo] = useState<'total' | 'canastilla'>('total');
  const [error, setError] = useState<string | null>(null);
  if (!abierto) return <button type="button" className="boton secundario" onClick={() => setAbierto(true)}>Agregar costo</button>;
  async function guardar() {
    const v = parsearPrecio(valor);
    if (v === null || v <= 0) return setError('No entendí el costo');
    const costoTotal = modo === 'total' ? v : v * e.lote.canastillas;
    const costoDetalle = modo === 'total' ? `${e.lote.canastillas} canast. por ${formatoCOP(v)}` : `${e.lote.canastillas} canast. × ${formatoCOP(v)}`;
    await editar<Lote>('lotes', e.lote.id, { costoTotal, costoDetalle }, usuario.id);
    setAbierto(false);
  }
  return (
    <div className="formulario">
      <label htmlFor={`costo-${e.lote.id}`}>Costo</label>
      <input id={`costo-${e.lote.id}`} inputMode="numeric" value={valor} onChange={(ev) => setValor(ev.target.value)} />
      <div className="dos">
        <button type="button" aria-pressed={modo === 'total'} className={modo === 'total' ? 'opcion activa' : 'opcion'} onClick={() => setModo('total')}>Total</button>
        <button type="button" aria-pressed={modo === 'canastilla'} className={modo === 'canastilla' ? 'opcion activa' : 'opcion'} onClick={() => setModo('canastilla')}>Por canastilla</button>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="button" className="boton principal" onClick={guardar}>Guardar costo</button>
    </div>
  );
}

function VentasDelLote({ e, datos, nombres, abrir }: { e: EstadoLote; datos: Datos; nombres: Record<string, string>; abrir: (a: Abierto) => void }) {
  const ventas = datos.ventas.filter((v) => !v.borrado && v.loteId === e.lote.id && v.unidad === 'canastilla');
  const vaciados = datos.vaciados.filter((v) => !v.borrado && v.loteId === e.lote.id);
  if (ventas.length + vaciados.length === 0) return <p className="suave">Todavía no hay ventas de este lote.</p>;
  const cliente = (id: string | null) => (id ? datos.clientes.find((c) => c.id === id)?.nombre ?? '—' : 'Cliente de paso');
  return (
    <ul className="lista">
      {ventas.map((v) => (
        <li key={v.id}>
          <button type="button" className="linea-boton" onClick={() => abrir({ tabla: 'ventas', registro: v as never, titulo: `${cliente(v.clienteId)} · ${v.cantidad}` })}>
            <span className="linea-arriba">
              <span>{cliente(v.clienteId)} · {v.cantidad}</span>
              <span className="suave">{horaBogota(v.creadoEn)} · {nombres[v.creadoPor] ?? '—'}</span>
            </span>
          </button>
        </li>
      ))}
      {vaciados.map((v) => (
        <li key={v.id}>
          <button type="button" className="linea-boton" onClick={() => abrir({ tabla: 'vaciados', registro: v as never, titulo: `Vaciadas · ${v.cantidad}` })}>
            <span className="linea-arriba">
              <span>Vaciadas · {v.cantidad}</span>
              <span className="suave">{horaBogota(v.creadoEn)} · {nombres[v.creadoPor] ?? '—'}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Lotes({ usuario, anotarCon }: Props) {
  const datos = useDatos();
  const nombres = useNombresUsuarios();
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [vaciando, setVaciando] = useState<Producto | null>(null);
  if (!datos) return null;
  if (entrando) return <EntradaMercancia usuario={usuario} alTerminar={() => setEntrando(false)} />;
  if (vaciando) return <VaciarCanastillas producto={vaciando} usuario={usuario} alTerminar={() => setVaciando(null)} />;
  if (abierto) {
    return (
      <div className="contenido">
        <Historial tabla={abierto.tabla} registro={abierto.registro} titulo={abierto.titulo} usuario={usuario} nombres={nombres} alCerrar={() => setAbierto(null)} />
      </div>
    );
  }
  const productos = datos.productos.filter((p) => !p.borrado)
    .map((p) => ({ p, estados: estadoLotes(p.id, datos) }))
    .filter((x) => x.estados.length > 0);

  return (
    <div className="contenido">
      <div className="linea-arriba">
        <h2 className="titulo">Mercancía</h2>
        <button type="button" className="boton principal" style={{ width: 'auto' }} onClick={() => setEntrando(true)}>+ Entró mercancía</button>
      </div>
      {productos.length === 0 && <p className="suave">Todavía no ha entrado mercancía.</p>}
      {productos.map(({ p, estados }) => {
        const quedan = estados.reduce((s, e) => s + e.quedan, 0);
        return (
          <section key={p.id} className="tarjeta" aria-label={p.nombre}>
            <div className="linea-arriba">
              <span className="grande negrita">{p.nombre}</span>
              <span><span className="grande negrita">{quedan}</span> quedan</span>
            </div>
            <button type="button" className="boton secundario" aria-label={`Vaciar canastillas de ${p.nombre}`} disabled={quedan <= 0}
              onClick={() => setVaciando(p)}>
              Vaciar canastillas
            </button>
            {estados.map((e) => {
              const avance = e.lote.canastillas > 0 ? Math.min(100, Math.max(0, ((e.vendidas + e.vaciadas) / e.lote.canastillas) * 100)) : 0;
              const fecha = etiquetaFecha(e.lote.creadoEn);
              return (
                <div key={e.lote.id} className="formulario" aria-label={`Lote ${fecha} · ${e.lote.canastillas} canastillas`} role="group">
                  <div className="linea-arriba">
                    <span className="negrita">Lote {fecha}</span>
                    <span className="suave">{e.vendidas} de {e.lote.canastillas} vendidas</span>
                  </div>
                  <div className="barra"><div style={{ width: `${avance}%` }} /></div>
                  {e.vaciadas > 0 && <span className="suave">Vaciadas: {e.vaciadas}</span>}
                  {e.quedan < 0 && <span className="aviso">Revisar: se anotaron {-e.quedan} de más</span>}
                  {e.ganancia !== null ? (
                    <div className="linea-abajo">
                      <span>Costo {formatoCOP(e.lote.costoTotal!)} · vendido {formatoCOP(e.ingreso)}</span>
                      <span className={e.ganancia >= 0 ? 'texto-pagado' : 'texto-deuda'}>{e.ganancia >= 0 ? `+${formatoCOP(e.ganancia)}` : formatoCOP(e.ganancia)}</span>
                    </div>
                  ) : (
                    <>
                      <span className="texto-deuda" style={{ fontSize: 14 }}>Sin costo · se puede agregar después</span>
                      <AgregarCosto e={e} usuario={usuario} />
                    </>
                  )}
                  <div className="linea-arriba">
                    <button type="button" className="enlace"
                      onClick={() => setAbiertos({ ...abiertos, [e.lote.id]: !abiertos[e.lote.id] })}>
                      Ver a quién se vendió cada una
                    </button>
                    <button type="button" className="enlace"
                      onClick={() => setAbierto({ tabla: 'lotes', registro: e.lote as never, titulo: `Lote ${fecha} · ${p.nombre}` })}>
                      Corregir lote
                    </button>
                  </div>
                  {abiertos[e.lote.id] && <VentasDelLote e={e} datos={datos} nombres={nombres} abrir={setAbierto} />}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
