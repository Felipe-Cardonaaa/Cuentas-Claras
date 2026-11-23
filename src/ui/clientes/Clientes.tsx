import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { Cliente, Datos, Devolucion, Usuario } from '../../dominio/tipos';
import type { Tabla } from '../../datos/db';
import { db } from '../../datos/db';
import type { Conflicto } from '../../sync/sincronizar';
import { deudores, estadoCuenta, type LineaCuenta } from '../../dominio/fiados';
import { prestadasCliente } from '../../dominio/canastillas';
import { describirVenta } from '../../dominio/cierre';
import { fechaBogota, formatoCOP, horaBogota, normalizarNombre } from '../../dominio/texto';
import { useDatos, useNombresUsuarios } from '../useDatos';
import Historial from '../comun/Historial';

interface Props { usuario: Usuario; anotarCon: (frase: string) => void }

function tituloLinea(l: LineaCuenta, datos: Datos): string {
  if (l.tipo === 'saldoInicial') return 'Saldo de la libreta';
  if (l.tipo === 'abono') return 'Abono';
  const p = datos.productos.find((x) => x.id === l.venta!.productoId);
  return describirVenta(l.venta!, p?.nombre ?? '');
}

const TABLA_LINEA: Record<LineaCuenta['tipo'], Tabla> = { venta: 'ventas', abono: 'abonos', saldoInicial: 'saldosIniciales' };

function useConflictos(): Conflicto[] {
  const [c, setC] = useState<Conflicto[]>([]);
  useEffect(() => {
    const sub = liveQuery(() => db.meta.get('conflictos')).subscribe({ next: (m) => setC((m?.valor as Conflicto[]) ?? []), error: () => {} });
    return () => sub.unsubscribe();
  }, []);
  return c;
}

export default function Clientes({ usuario, anotarCon }: Props) {
  const datos = useDatos();
  const nombres = useNombresUsuarios();
  const conflictos = useConflictos();
  const [busqueda, setBusqueda] = useState('');
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [verTodo, setVerTodo] = useState(false);
  const [abierta, setAbierta] = useState<LineaCuenta | null>(null);
  const [devolucionAbierta, setDevolucionAbierta] = useState<Devolucion | null>(null);
  const [orden, setOrden] = useState<'monto' | 'antiguedad'>('monto');

  const q = normalizarNombre(busqueda);
  const vivos = datos?.clientes.filter((c) => !c.borrado) ?? [];
  const encontrados = q ? vivos.filter((c) => c.nombreNormalizado.includes(q)) : [];
  const elegido: Cliente | undefined =
    vivos.find((c) => c.id === elegidoId) ?? (encontrados.length === 1 ? encontrados[0] : vivos.find((c) => c.nombreNormalizado === q));

  return (
    <div className="contenido">
      <h2 className="titulo">Clientes</h2>
      {conflictos.map((c, i) => (
        <p key={i} className="aviso">
          Se creó "{(c.registro as { nombre?: string }).nombre}" en dos celulares sin señal. Cámbiale el nombre a uno de los dos.
        </p>
      ))}
      <label htmlFor="buscar" className="suave">Buscar por nombre</label>
      <input id="buscar" value={busqueda} autoComplete="off"
        onChange={(e) => { setBusqueda(e.target.value); setElegidoId(null); setAbierta(null); setDevolucionAbierta(null); setVerTodo(false); }} />

      {!q && !elegido && datos && <QuienMeDebe datos={datos} orden={orden} cambiarOrden={setOrden} elegir={setElegidoId} />}
      {!q && elegido && (
        <button type="button" className="enlace" style={{ alignSelf: 'flex-start' }} onClick={() => { setElegidoId(null); setAbierta(null); setDevolucionAbierta(null); }}>
          ← Volver a la lista
        </button>
      )}

      {!elegido && encontrados.length > 1 && (
        <div className="lista-usuarios">
          {encontrados.map((c) => (
            <button key={c.id} type="button" className="boton grande" onClick={() => setElegidoId(c.id)}>{c.nombre}</button>
          ))}
        </div>
      )}
      {q && !elegido && encontrados.length === 0 && <p className="suave">No hay ningún cliente con ese nombre.</p>}

      {elegido && datos && (() => {
        const cuenta = estadoCuenta(elegido.id, datos);
        const prestadas = prestadasCliente(elegido.id, datos).total;
        const lineas = verTodo ? cuenta.todas : cuenta.lineas;
        const primerNombre = elegido.nombre;
        return (
          <>
            <section className="tarjeta" aria-label="Resumen del cliente">
              <div className="linea-arriba">
                <span className="grande negrita">{elegido.nombre}</span>
                <span className={cuenta.debe ? 'etiqueta deuda' : 'etiqueta pagado'}>{cuenta.debe ? 'DEBE: SÍ' : 'DEBE: NO'}</span>
              </div>
              <div className="resumen">
                <div className="cifra"><span className="suave">Saldo</span><span>{formatoCOP(cuenta.saldo)}</span></div>
                <div className="cifra"><span className="suave">Canastillas prestadas</span><span>{prestadas}</span></div>
              </div>
            </section>

            {devolucionAbierta ? (
              <Historial tabla="devoluciones" registro={devolucionAbierta as never} titulo={`Devolvió ${devolucionAbierta.cantidad} canastillas`}
                usuario={usuario} nombres={nombres} alCerrar={() => setDevolucionAbierta(null)} />
            ) : abierta ? (
              <Historial
                tabla={TABLA_LINEA[abierta.tipo]}
                registro={(abierta.venta ?? findRegistro(datos, abierta)) as unknown as Record<string, unknown> & { id: string }}
                titulo={tituloLinea(abierta, datos)} usuario={usuario} nombres={nombres} alCerrar={() => setAbierta(null)}
              />
            ) : (
              <>
                <h3 className="negrita" style={{ margin: 0 }}>De dónde sale la deuda</h3>
                {lineas.length === 0 ? <p className="suave">No tiene deudas pendientes.</p> : (
                  <ul className="lista tarjeta" style={{ padding: '0 16px' }}>
                    {lineas.map((l) => (
                      <li key={l.id}>
                        <button type="button" className="linea-boton" onClick={() => setAbierta(l)}>
                          <span className="linea-arriba">
                            <span className="negrita">{tituloLinea(l, datos)}</span>
                            <span className={l.tipo === 'abono' ? 'texto-pagado' : 'negrita'}>{l.tipo === 'abono' ? `−${formatoCOP(l.total)}` : formatoCOP(l.total)}</span>
                          </span>
                          <span className="linea-abajo">
                            <span>{fechaBogota(l.fecha).slice(5)} · {horaBogota(l.fecha)} · anotó {nombres[l.creadoPor] ?? '—'}</span>
                            {l.tipo !== 'abono' && (l.debe
                              ? <span className="texto-deuda">Debe {formatoCOP(l.pendiente)}</span>
                              : <span className="texto-pagado">Pagada</span>)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {datos.devoluciones.some((d) => !d.borrado && d.clienteId === elegido.id) && (
                  <>
                    <h3 className="negrita" style={{ margin: 0 }}>Canastillas devueltas</h3>
                    <ul className="lista tarjeta" style={{ padding: '0 16px' }}>
                      {datos.devoluciones.filter((d) => !d.borrado && d.clienteId === elegido.id).map((d) => (
                        <li key={d.id}>
                          <button type="button" className="linea-boton" onClick={() => setDevolucionAbierta(d)}>
                            <span className="linea-arriba">
                              <span>Devolvió {d.cantidad} {d.cantidad === 1 ? 'canastilla' : 'canastillas'}</span>
                              <span className="suave">{fechaBogota(d.creadoEn).slice(5)} · {horaBogota(d.creadoEn)}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {!verTodo && cuenta.todas.length > cuenta.lineas.length && (
                  <button type="button" className="enlace" onClick={() => setVerTodo(true)}>Ver todo el historial</button>
                )}
                <div className="dos">
                  <button type="button" className="boton secundario" onClick={() => anotarCon(`${primerNombre} abonó `)}>Registrar abono</button>
                  <button type="button" className="boton secundario" onClick={() => anotarCon(`${primerNombre} devolvió `)}>Devolvió canast.</button>
                </div>
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}

function findRegistro(datos: Datos, l: LineaCuenta) {
  if (l.tipo === 'abono') return datos.abonos.find((a) => a.id === l.id);
  return datos.saldosIniciales.find((s) => s.id === l.id);
}

function diasDesde(iso: string): string {
  const dias = Math.floor((Date.parse(fechaBogota(new Date().toISOString())) - Date.parse(fechaBogota(iso))) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'hace 1 día';
  return `hace ${dias} días`;
}

function QuienMeDebe({ datos, orden, cambiarOrden, elegir }: {
  datos: Datos; orden: 'monto' | 'antiguedad'; cambiarOrden: (o: 'monto' | 'antiguedad') => void; elegir: (id: string) => void;
}) {
  const lista = deudores(datos, orden);
  const total = lista.reduce((s, d) => s + d.saldo, 0);
  return (
    <section className="tarjeta" aria-label="¿Quién me debe?">
      <div className="linea-arriba">
        <span className="grande negrita">¿Quién me debe?</span>
        <span className="etiqueta deuda">{lista.length}</span>
      </div>
      <span className="negrita">Total que les deben: {formatoCOP(total)}</span>
      <div className="dos">
        <button type="button" aria-pressed={orden === 'monto'} className={orden === 'monto' ? 'opcion activa' : 'opcion'} onClick={() => cambiarOrden('monto')}>Más deuda</button>
        <button type="button" aria-pressed={orden === 'antiguedad'} className={orden === 'antiguedad' ? 'opcion activa' : 'opcion'} onClick={() => cambiarOrden('antiguedad')}>Más antigua</button>
      </div>
      {lista.length === 0 ? <p className="suave">Nadie debe nada.</p> : (
        <ul className="lista">
          {lista.map((d) => (
            <li key={d.clienteId}>
              <button type="button" className="linea-boton" onClick={() => elegir(d.clienteId)}>
                <span className="linea-arriba">
                  <span className="negrita">{d.nombre}</span>
                  <span className="texto-deuda">{formatoCOP(d.saldo)}</span>
                </span>
                <span className="linea-abajo">
                  <span>Debe desde el {fechaBogota(d.desde).slice(5).split('-').reverse().join('/')}</span>
                  <span>{diasDesde(d.desde)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
