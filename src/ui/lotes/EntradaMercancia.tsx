import { useState, type FormEvent } from 'react';
import type { Unidad, Usuario } from '../../dominio/tipos';
import type { Intencion } from '../../dominio/parser';
import { prepararBorrador, type Borrador, type Elecciones } from '../../dominio/borrador';
import { aNumero, parsearPrecio } from '../../dominio/texto';
import { cargarDatos } from '../../datos/repositorio';
import { guardarBorrador } from '../../datos/guardar';
import Confirmacion from '../anotar/Confirmacion';

const SIN_ELEGIR: Elecciones = { prestada: {}, resolver: {} };

/** Formulario para anotar la mercancía que entró, sin tener que escribir una frase. */
export default function EntradaMercancia({ usuario, alTerminar }: { usuario: Usuario; alTerminar: () => void }) {
  const [producto, setProducto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState<Unidad>('canastilla');
  const [costo, setCosto] = useState('');
  const [modoCosto, setModoCosto] = useState<'total' | 'unitario'>('total');
  const [error, setError] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [elecciones, setElecciones] = useState<Elecciones>(SIN_ELEGIR);
  const [guardando, setGuardando] = useState(false);

  async function revisar(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!producto.trim()) return setError('Escribe el producto');
    const n = aNumero(cantidad);
    if (n === null || !(n > 0)) return setError('Escribe cuántas entraron');
    if (unidad === 'canastilla' && !Number.isInteger(n)) return setError('Las canastillas se cuentan enteras');
    let valorCosto: { tipo: 'unitario' | 'total'; valor: number } | null = null;
    if (costo.trim()) {
      const v = parsearPrecio(costo);
      if (v === null) return setError('No entendí el costo');
      valorCosto = { tipo: modoCosto, valor: v };
    }
    const intencion: Intencion = { tipo: 'entrada', producto: producto.trim().toLowerCase(), cantidad: n, unidad, costo: valorCosto };
    const r = prepararBorrador(intencion, await cargarDatos());
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

  const opcion = (activa: boolean) => (activa ? 'opcion activa' : 'opcion');
  return (
    <form className="tarjeta formulario" aria-label="Entró mercancía" onSubmit={revisar}>
      <h2 className="titulo" style={{ fontSize: 20 }}>Entró mercancía</h2>
      <label htmlFor="entrada-producto">Producto</label>
      <input id="entrada-producto" autoComplete="off" placeholder="mango criollo" value={producto} onChange={(e) => setProducto(e.target.value)} />

      <label htmlFor="entrada-cantidad">Cantidad</label>
      <input id="entrada-cantidad" inputMode="decimal" placeholder="50" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      <div className="dos">
        <button type="button" aria-pressed={unidad === 'canastilla'} className={opcion(unidad === 'canastilla')} onClick={() => setUnidad('canastilla')}>Canastillas</button>
        <button type="button" aria-pressed={unidad === 'kilo'} className={opcion(unidad === 'kilo')} onClick={() => setUnidad('kilo')}>Kilos</button>
      </div>

      <label htmlFor="entrada-costo">Costo (opcional)</label>
      <input id="entrada-costo" inputMode="numeric" placeholder="1.800.000" value={costo} onChange={(e) => setCosto(e.target.value)} />
      <div className="dos">
        <button type="button" aria-pressed={modoCosto === 'total'} className={opcion(modoCosto === 'total')} onClick={() => setModoCosto('total')}>Total</button>
        <button type="button" aria-pressed={modoCosto === 'unitario'} className={opcion(modoCosto === 'unitario')} onClick={() => setModoCosto('unitario')}>
          {unidad === 'kilo' ? 'Por kilo' : 'Por canastilla'}
        </button>
      </div>

      {error && <p role="alert" className="error">{error}</p>}
      <div className="dos">
        <button type="button" className="boton secundario" onClick={alTerminar}>Cancelar</button>
        <button type="submit" className="boton principal">Revisar</button>
      </div>
    </form>
  );
}
