import { useState, type FormEvent } from 'react';
import type { Producto, Usuario } from '../../dominio/tipos';
import { prepararBorrador, type Borrador, type Elecciones } from '../../dominio/borrador';
import { aNumero } from '../../dominio/texto';
import { cargarDatos } from '../../datos/repositorio';
import { guardarBorrador } from '../../datos/guardar';
import Confirmacion from '../anotar/Confirmacion';

const SIN_ELEGIR: Elecciones = { prestada: {}, resolver: {} };

/** Anota canastillas de un producto que se vaciaron para vender por kilo. */
export default function VaciarCanastillas({ producto, usuario, alTerminar }: { producto: Producto; usuario: Usuario; alTerminar: () => void }) {
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [elecciones, setElecciones] = useState<Elecciones>(SIN_ELEGIR);
  const [guardando, setGuardando] = useState(false);

  async function revisar(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    const n = aNumero(cantidad);
    if (n === null || !(n > 0)) return setError('Escribe cuántas canastillas se vaciaron');
    if (!Number.isInteger(n)) return setError('Las canastillas se cuentan enteras');
    const r = prepararBorrador({ tipo: 'vaciado', producto: producto.nombre, cantidad: n }, await cargarDatos());
    if (!r.ok) return setError(r.error);
    setElecciones(SIN_ELEGIR);
    setBorrador(r.borrador);
  }

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    try {
      await guardarBorrador(borrador, elecciones, usuario.id);
      alTerminar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  if (borrador) {
    return (
      <div className="contenido">
        <Confirmacion borrador={borrador} elecciones={elecciones} cambiar={setElecciones} guardando={guardando}
          alGuardar={guardar} alCorregir={() => setBorrador(null)} />
        {error && <p role="alert" className="error">{error}</p>}
      </div>
    );
  }

  return (
    <form className="tarjeta formulario" aria-label="Vaciar canastillas" onSubmit={revisar}>
      <h2 className="titulo" style={{ fontSize: 20 }}>Vaciar canastillas de {producto.nombre}</h2>
      <p className="suave" style={{ margin: 0 }}>Para vender por kilo. Se descuentan del lote más viejo.</p>
      <label htmlFor="vaciar-cantidad">¿Cuántas canastillas se vaciaron?</label>
      <input id="vaciar-cantidad" inputMode="numeric" placeholder="2" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      {error && <p role="alert" className="error">{error}</p>}
      <div className="dos">
        <button type="button" className="boton secundario" onClick={alTerminar}>Cancelar</button>
        <button type="submit" className="boton principal">Revisar</button>
      </div>
    </form>
  );
}
