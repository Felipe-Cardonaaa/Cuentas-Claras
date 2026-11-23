import { useEffect, useState, type FormEvent } from 'react';
import type { Usuario } from '../../dominio/tipos';
import { crearUsuario, elegirUsuario, entrarNegocio, negocioListo, usuariosDisponibles } from '../../auth/sesion';

type Paso = 'cargando' | 'negocio' | 'elegir' | 'pin' | 'crear';

export default function Acceso({ alEntrar }: { alEntrar: (u: Usuario) => void }) {
  const [paso, setPaso] = useState<Paso>('cargando');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function recargar() {
    if (!(await negocioListo())) return setPaso('negocio');
    setUsuarios(await usuariosDisponibles());
    setPaso('elegir');
  }
  useEffect(() => { void recargar(); }, []);

  async function tecla(d: string) {
    if (!elegido) return;
    const nuevo = (pin + d).slice(0, 4);
    setPin(nuevo);
    setError(null);
    if (nuevo.length < 4) return;
    if (await elegirUsuario(elegido, nuevo)) alEntrar(elegido);
    else {
      setError('PIN incorrecto');
      setPin('');
    }
  }

  if (paso === 'cargando') return <main className="pantalla acceso" aria-busy="true" />;

  if (paso === 'negocio') return <EntrarNegocio alListo={recargar} />;

  if (paso === 'crear') {
    return (
      <CrearUsuario
        primero={usuarios.length === 0}
        alCrear={async (u) => {
          if (usuarios.length === 0) {
            alEntrar(u);
          } else {
            await recargar();
          }
        }}
        alCancelar={() => setPaso('elegir')}
      />
    );
  }

  if (paso === 'pin' && elegido) {
    return (
      <main className="pantalla acceso">
        <h1 className="titulo">Hola, {elegido.nombre}</h1>
        <p className="suave">Escribe tu PIN</p>
        <div className="puntos" aria-label={`${pin.length} de 4 números`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'punto lleno' : 'punto'} />)}
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="teclado">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="tecla" onClick={() => tecla(d)}>{d}</button>
          ))}
          <button type="button" className="tecla secundaria" onClick={() => { setPaso('elegir'); setPin(''); setError(null); }}>Volver</button>
          <button type="button" className="tecla" onClick={() => tecla('0')}>0</button>
          <button type="button" className="tecla secundaria" onClick={() => setPin(pin.slice(0, -1))}>Borrar</button>
        </div>
      </main>
    );
  }

  return (
    <main className="pantalla acceso">
      <h1 className="titulo">Cuentas Claras</h1>
      {usuarios.length === 0 ? (
        <button type="button" className="boton principal" onClick={() => setPaso('crear')}>Crear el primer usuario</button>
      ) : (
        <>
          <p className="suave">¿Quién eres?</p>
          <div className="lista-usuarios">
            {usuarios.map((u) => (
              <button key={u.id} type="button" className="boton grande" onClick={() => { setElegido(u); setPin(''); setPaso('pin'); }}>
                {u.nombre}
              </button>
            ))}
          </div>
          <button type="button" className="boton secundario" onClick={() => setPaso('crear')}>Agregar usuario</button>
        </>
      )}
    </main>
  );
}

function EntrarNegocio({ alListo }: { alListo: () => void }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const e = await entrarNegocio(correo, clave);
    if (e) setError(e);
    else alListo();
  }
  return (
    <main className="pantalla acceso">
      <h1 className="titulo">Cuentas Claras</h1>
      <p className="suave">Solo la primera vez en este celular: entra con la cuenta del negocio.</p>
      <form onSubmit={enviar} className="formulario">
        <label htmlFor="correo">Correo del negocio</label>
        <input id="correo" type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <label htmlFor="clave">Clave</label>
        <input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="boton principal">Entrar</button>
      </form>
    </main>
  );
}

function CrearUsuario({ primero, alCrear, alCancelar }: { primero: boolean; alCrear: (u: Usuario) => void; alCancelar: () => void }) {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [repetido, setRepetido] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (pin !== repetido) return setError('Los PIN no coinciden');
    try {
      const u = await crearUsuario(nombre, pin);
      if (primero) await elegirUsuario(u, pin);
      alCrear(u);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="pantalla acceso">
      <h1 className="titulo">{primero ? 'Crear el primer usuario' : 'Agregar usuario'}</h1>
      <form onSubmit={enviar} className="formulario">
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label htmlFor="pin">PIN de 4 números</label>
        <input id="pin" inputMode="numeric" type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        <label htmlFor="pin2">Repite el PIN</label>
        <input id="pin2" inputMode="numeric" type="password" maxLength={4} value={repetido} onChange={(e) => setRepetido(e.target.value.replace(/\D/g, ''))} />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="boton principal">Crear</button>
        {!primero && <button type="button" className="boton secundario" onClick={alCancelar}>Cancelar</button>}
      </form>
    </main>
  );
}
