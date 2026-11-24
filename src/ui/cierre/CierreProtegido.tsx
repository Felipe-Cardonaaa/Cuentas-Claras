import { useEffect, useState, type FormEvent } from 'react';
import { liveQuery } from 'dexie';
import type { Usuario } from '../../dominio/tipos';
import { crearClaveCierre, hayClaveCierre, verificarClaveCierre } from '../../auth/claveCierre';
import Cierre from './Cierre';

/** El cierre solo se ve con la clave. Se vuelve a pedir cada vez que se entra a esta pantalla. */
export default function CierreProtegido({ usuario }: { usuario: Usuario }) {
  const [hayClave, setHayClave] = useState<boolean | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = liveQuery(() => hayClaveCierre()).subscribe({ next: setHayClave, error: () => {} });
    return () => sub.unsubscribe();
  }, []);

  if (abierto) return <Cierre usuario={usuario} />;
  if (hayClave === null) return null;

  async function entrar(ev: FormEvent) {
    ev.preventDefault();
    if (await verificarClaveCierre(clave)) setAbierto(true);
    else {
      setError('Clave incorrecta');
      setClave('');
    }
  }

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    if (clave !== repetida) return setError('Las claves no coinciden');
    try {
      await crearClaveCierre(clave, usuario.id);
      setAbierto(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!hayClave) {
    return (
      <form className="tarjeta formulario" onSubmit={guardar} aria-label="Crear clave del cierre">
        <h2 className="titulo" style={{ fontSize: 20 }}>Ponle una clave al cierre</h2>
        <p className="suave" style={{ margin: 0 }}>Así solo quien la sepa puede ver el cierre del día. Sirve para todos los celulares.</p>
        <label htmlFor="clave-nueva">Nueva clave del cierre</label>
        <input id="clave-nueva" type="password" autoComplete="new-password" value={clave} onChange={(e) => { setClave(e.target.value); setError(null); }} />
        <label htmlFor="clave-repetida">Repite la clave</label>
        <input id="clave-repetida" type="password" autoComplete="new-password" value={repetida} onChange={(e) => { setRepetida(e.target.value); setError(null); }} />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="boton principal">Guardar clave</button>
      </form>
    );
  }

  return (
    <form className="tarjeta formulario" onSubmit={entrar} aria-label="Entrar al cierre">
      <h2 className="titulo" style={{ fontSize: 20 }}>Cierre del día protegido</h2>
      <label htmlFor="clave-cierre">Clave del cierre</label>
      <input id="clave-cierre" type="password" autoComplete="current-password" value={clave} onChange={(e) => { setClave(e.target.value); setError(null); }} />
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" className="boton principal">Entrar</button>
    </form>
  );
}
