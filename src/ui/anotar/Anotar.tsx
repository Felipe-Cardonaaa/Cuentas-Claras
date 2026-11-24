import { useEffect, useRef, useState } from 'react';
import type { Usuario } from '../../dominio/tipos';
import { parsearFrase } from '../../dominio/parser';
import { prepararBorrador, type Borrador, type Elecciones } from '../../dominio/borrador';
import { cargarDatos } from '../../datos/repositorio';
import { guardarBorrador } from '../../datos/guardar';
import Confirmacion from './Confirmacion';
import { useDictado } from './useDictado';

const SIN_ELEGIR: Elecciones = { prestada: {}, resolver: {} };

export default function Anotar({ usuario, fraseInicial = '' }: { usuario: Usuario; fraseInicial?: string }) {
  const [frase, setFrase] = useState(fraseInicial);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [elecciones, setElecciones] = useState<Elecciones>(SIN_ELEGIR);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const voz = useDictado();
  const caja = useRef<HTMLTextAreaElement>(null);
  // Si el micrófono de la app falla, se abre el teclado para dictar con el micrófono del teclado.
  useEffect(() => { if (voz.error) caja.current?.focus(); }, [voz.error]);

  useEffect(() => setFrase(fraseInicial), [fraseInicial]);

  async function revisar(texto: string) {
    setMensaje(null);
    setBorrador(null);
    setElecciones(SIN_ELEGIR);
    const p = parsearFrase(texto);
    if (!p.ok) return setError(p.error);
    const r = prepararBorrador(p.intencion, await cargarDatos());
    if (!r.ok) return setError(r.error);
    setError(null);
    setBorrador(r.borrador);
  }

  useEffect(() => {
    if (!voz.escuchando && voz.texto) {
      setFrase(voz.texto);
      void revisar(voz.texto);
    }
  }, [voz.escuchando, voz.texto]);

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    try {
      await guardarBorrador(borrador, elecciones, usuario.id);
      setBorrador(null);
      setFrase('');
      setMensaje('Guardado');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="contenido">
      <label htmlFor="frase" className="negrita etiqueta-grande">¿Qué vendiste?</label>
      <textarea id="frase" ref={caja} rows={3} value={frase} onChange={(e) => { setFrase(e.target.value); setMensaje(null); }}
        placeholder="Marta compró 2 canastillas de mango criollo a 45.000 debe" />
      <div className="microfono">
        {voz.disponible ? (
          <>
            <button type="button" className={voz.escuchando ? 'boton-mic escuchando' : 'boton-mic'}
              aria-label={voz.escuchando ? 'Dejar de escuchar' : 'Hablar para anotar'} onClick={voz.escuchando ? voz.detener : voz.iniciar}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
              </svg>
            </button>
            <span className="suave">{voz.escuchando ? 'Te escucho…' : 'Toca y habla'}</span>
          </>
        ) : (
          <span className="suave">Escribe la venta</span>
        )}
        {voz.error && <p className="aviso">{voz.error}</p>}
      </div>
      <button type="button" className="boton principal" disabled={!frase.trim()} onClick={() => revisar(frase)}>Revisar</button>

      {error && <p role="alert" className="error">{error}</p>}
      {mensaje && <p role="status" className="exito">{mensaje}</p>}
      {borrador && (
        <Confirmacion borrador={borrador} elecciones={elecciones} cambiar={setElecciones} guardando={guardando}
          alGuardar={guardar} alCorregir={() => setBorrador(null)} />
      )}
    </div>
  );
}
