import { useEffect, useState } from 'react';
import type { Estado, Historial as FilaHistorial, Usuario } from '../../dominio/tipos';
import type { Tabla } from '../../datos/db';
import { borrar, editar, historialDe } from '../../datos/repositorio';
import { aNumero, fechaBogota, formatoCOP, horaBogota, parsearPrecio } from '../../dominio/texto';
import { ERROR_FIAR, ERROR_PRESTAR } from '../../dominio/borrador';

type Tipo = 'plata' | 'enteras' | 'cantidad';
interface Campo { clave: string; etiqueta: string; tipo: Tipo }

/** Campos que se pueden corregir por tabla. Las cantidades de una venta por kilo aceptan decimales. */
function camposDe(tabla: Tabla, registro: Record<string, unknown>): Campo[] {
  switch (tabla) {
    case 'ventas':
      return [
        { clave: 'cantidad', etiqueta: 'Cantidad', tipo: registro.unidad === 'kilo' ? 'cantidad' : 'enteras' },
        { clave: 'precioUnitario', etiqueta: 'Precio', tipo: 'plata' },
      ];
    case 'abonos':
    case 'saldosIniciales':
      return [{ clave: 'valor', etiqueta: 'Valor', tipo: 'plata' }];
    case 'devoluciones':
    case 'vaciados':
      return [{ clave: 'cantidad', etiqueta: 'Cantidad', tipo: 'enteras' }];
    case 'lotes':
      return [{ clave: 'canastillas', etiqueta: 'Canastillas', tipo: 'enteras' }];
    default:
      return [];
  }
}

const NOMBRE_CAMPO: Record<string, string> = {
  cantidad: 'cantidad', precioUnitario: 'precio', valor: 'valor', canastillas: 'canastillas', costoTotal: 'costo',
  borrado: 'borrado', estado: 'estado', prestada: 'canastilla prestada',
};
const ES_PLATA = new Set(['precioUnitario', 'valor', 'costoTotal']);

function mostrar(campo: string, v: unknown): string {
  if (typeof v === 'number' && ES_PLATA.has(campo)) return formatoCOP(v);
  if (typeof v === 'number') return String(v).replace('.', ',');
  if (campo === 'estado') return v === 'debe' ? 'debe' : 'pagó';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  return String(v ?? '—');
}

export function describirCambio(h: FilaHistorial, nombres: Record<string, string>): string[] {
  const quien = nombres[h.usuarioId] ?? 'Alguien';
  if (h.accion === 'crear') return [`${quien} lo anotó`];
  if (h.accion === 'borrar') return [`${quien} lo borró`];
  const antes = (h.antes ?? {}) as Record<string, unknown>;
  const despues = (h.despues ?? {}) as Record<string, unknown>;
  return Object.keys(despues).map((k) => `${quien} cambió ${NOMBRE_CAMPO[k] ?? k}: ${mostrar(k, antes[k])} → ${mostrar(k, despues[k])}`);
}

function leer(c: Campo, texto: string): number | string {
  if (c.tipo === 'plata') return parsearPrecio(texto) ?? `${c.etiqueta}: escribe un valor en pesos mayor que cero`;
  const n = aNumero(texto);
  if (n === null || !(n > 0)) return `${c.etiqueta}: escribe un número mayor que cero`;
  if (c.tipo === 'enteras' && !Number.isInteger(n)) return `${c.etiqueta}: las canastillas se cuentan enteras`;
  return n;
}

interface Props {
  tabla: Tabla;
  registro: Record<string, unknown> & { id: string };
  titulo: string;
  usuario: Usuario;
  nombres: Record<string, string>;
  alCerrar: () => void;
}

export default function Historial({ tabla, registro, titulo, usuario, nombres, alCerrar }: Props) {
  const [filas, setFilas] = useState<FilaHistorial[]>([]);
  const campos = camposDe(tabla, registro);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.clave, mostrar(c.tipo === 'plata' ? '' : c.clave, registro[c.clave])])));
  const esVentaCanastilla = tabla === 'ventas' && registro.unidad === 'canastilla';
  const [estado, setEstado] = useState<Estado | undefined>(registro.estado as Estado | undefined);
  const [prestada, setPrestada] = useState<boolean | null>((registro.prestada as boolean | null | undefined) ?? null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void historialDe(registro.id).then(setFilas); }, [registro.id]);

  async function guardar() {
    const cambios: Record<string, unknown> = {};
    for (const c of campos) {
      const v = leer(c, valores[c.clave]);
      if (typeof v === 'string') return setError(v);
      if (v !== registro[c.clave]) cambios[c.clave] = v;
    }
    if (esVentaCanastilla) {
      const sinCliente = registro.clienteId === null;
      if (estado === 'debe' && sinCliente) return setError(ERROR_FIAR);
      if (prestada === true && sinCliente) return setError(ERROR_PRESTAR);
      if (estado !== registro.estado) cambios.estado = estado;
      if (prestada !== registro.prestada) cambios.prestada = prestada;
    }
    if (Object.keys(cambios).length > 0) await editar(tabla, registro.id, cambios as never, usuario.id);
    alCerrar();
  }

  async function confirmarYBorrar() {
    await borrar(tabla, registro.id, usuario.id);
    alCerrar();
  }

  const opcion = (activa: boolean) => (activa ? 'opcion activa' : 'opcion');

  return (
    <section className="tarjeta" aria-label="Historial">
      <h2 className="negrita">{titulo}</h2>
      <ul className="lista">
        {filas.map((h) => describirCambio(h, nombres).map((texto, i) => (
          <li key={`${h.id}-${i}`} className="linea-abajo" style={{ padding: '8px 0' }}>
            <span>{texto}</span><span>{fechaBogota(h.fecha).slice(5)} · {horaBogota(h.fecha)}</span>
          </li>
        )))}
      </ul>
      {campos.length > 0 && (
        <div className="formulario">
          {campos.map((c) => (
            <div key={c.clave} className="formulario">
              <label htmlFor={`campo-${c.clave}`}>{c.etiqueta}</label>
              <input id={`campo-${c.clave}`} inputMode="decimal" value={valores[c.clave]}
                onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })} />
            </div>
          ))}
          {esVentaCanastilla && (
            <>
              <span className="negrita">¿Pagó o debe?</span>
              <div className="dos">
                <button type="button" aria-pressed={estado === 'pago'} className={opcion(estado === 'pago')} onClick={() => setEstado('pago')}>Pagó</button>
                <button type="button" aria-pressed={estado === 'debe'} className={opcion(estado === 'debe')} onClick={() => setEstado('debe')}>Debe</button>
              </div>
              <span className="negrita">¿Se llevó las canastillas?</span>
              <div className="dos">
                <button type="button" aria-pressed={prestada === true} className={opcion(prestada === true)} onClick={() => setPrestada(true)}>Sí, prestadas</button>
                <button type="button" aria-pressed={prestada === false} className={opcion(prestada === false)} onClick={() => setPrestada(false)}>No, empacado</button>
              </div>
            </>
          )}
          {error && <p role="alert" className="error">{error}</p>}
          <button type="button" className="boton principal" onClick={guardar}>Guardar corrección</button>
        </div>
      )}
      {confirmarBorrado ? (
        <div className="dos">
          <button type="button" className="boton secundario" onClick={() => setConfirmarBorrado(false)}>No borrar</button>
          <button type="button" className="boton principal" onClick={confirmarYBorrar}>Sí, borrar</button>
        </div>
      ) : (
        <button type="button" className="boton secundario" onClick={() => setConfirmarBorrado(true)}>Borrar</button>
      )}
      <button type="button" className="enlace" onClick={alCerrar}>Cerrar</button>
    </section>
  );
}
