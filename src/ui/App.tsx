import { useEffect, useState } from 'react';
import './estilos.css';
import type { Usuario } from '../dominio/tipos';
import { salir, usuarioActivo } from '../auth/sesion';
import Acceso from './acceso/Acceso';
import Anotar from './anotar/Anotar';
import Navegacion, { type Pantalla } from './Navegacion';

function fechaLarga(): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'short' }).format(new Date());
}

function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return enLinea;
}

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(() => usuarioActivo());
  const [pantalla, setPantalla] = useState<Pantalla>('anotar');
  const [frase, setFrase] = useState('');
  const enLinea = useEnLinea();

  if (!usuario) return <Acceso alEntrar={setUsuario} />;

  const anotarCon = (texto: string) => { setFrase(texto); setPantalla('anotar'); };

  return (
    <div className="app">
      <header className="encabezado">
        <div>
          <span className="suave">{fechaLarga()}</span>
          <h1 className="titulo">Hola, {usuario.nombre}</h1>
        </div>
        <div className="encabezado-der">
          <span className={enLinea ? 'estado-red en-linea' : 'estado-red sin-senal'}>{enLinea ? 'En línea' : 'Sin señal'}</span>
          <button type="button" className="enlace" onClick={() => { salir(); setUsuario(null); }}>Cambiar usuario</button>
        </div>
      </header>
      <main className="pantalla">
        {pantalla === 'anotar' && <Anotar usuario={usuario} fraseInicial={frase} />}
        {pantalla !== 'anotar' && <PantallaPendiente pantalla={pantalla} anotarCon={anotarCon} usuario={usuario} />}
      </main>
      <Navegacion actual={pantalla} ir={(p) => { setFrase(''); setPantalla(p); }} />
    </div>
  );
}

// Se reemplaza por las pantallas reales en las tareas siguientes.
function PantallaPendiente(_: { pantalla: Pantalla; anotarCon: (t: string) => void; usuario: Usuario }) {
  return null;
}
