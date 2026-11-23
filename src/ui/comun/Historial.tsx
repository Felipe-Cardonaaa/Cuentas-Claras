import { useEffect, useState } from 'react';
import type { Historial as FilaHistorial, Usuario } from '../../dominio/tipos';
import type { Tabla } from '../../datos/db';
import { borrar, editar, historialDe } from '../../datos/repositorio';
import { fechaBogota, formatoCOP, horaBogota } from '../../dominio/texto';

/** Campos que se pueden corregir por tabla. */
const CAMPOS: Partial<Record<Tabla, { clave: string; etiqueta: string }[]>> = {
  ventas: [{ clave: 'cantidad', etiqueta: 'Cantidad' }, { clave: 'precioUnitario', etiqueta: 'Precio' }],
  abonos: [{ clave: 'valor', etiqueta: 'Valor' }],
  saldosIniciales: [{ clave: 'valor', etiqueta: 'Valor' }],
  devoluciones: [{ clave: 'cantidad', etiqueta: 'Cantidad' }],
  vaciados: [{ clave: 'cantidad', etiqueta: 'Cantidad' }],
  lotes: [{ clave: 'canastillas', etiqueta: 'Canastillas' }],
};
const NOMBRE_CAMPO: Record<string, string> = {
  cantidad: 'cantidad', precioUnitario: 'precio', valor: 'valor', canastillas: 'canastillas', costoTotal: 'costo', borrado: 'borrado',
};
const ES_PLATA = new Set(['precioUnitario', 'valor', 'costoTotal']);

function mostrar(campo: string, v: unknown): string {
  if (typeof v === 'number' && ES_PLATA.has(campo)) return formatoCOP(v);
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
  const campos = CAMPOS[tabla] ?? [];
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.clave, String(registro[c.clave] ?? '')])));
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void historialDe(registro.id).then(setFilas); }, [registro.id]);

  async function guardar() {
    const cambios: Record<string, number> = {};
    for (const c of campos) {
      const n = Number(valores[c.clave].replace(/\./g, '').replace(',', '.'));
      if (!(n > 0)) return setError(`${c.etiqueta}: escribe un número mayor que cero`);
      if (n !== registro[c.clave]) cambios[c.clave] = n;
    }
    if (Object.keys(cambios).length > 0) await editar(tabla, registro.id, cambios, usuario.id);
    alCerrar();
  }

  async function confirmarYBorrar() {
    await borrar(tabla, registro.id, usuario.id);
    alCerrar();
  }

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
