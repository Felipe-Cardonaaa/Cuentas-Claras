export type Pantalla = 'anotar' | 'clientes' | 'lotes' | 'cierre';

const ICONOS: Record<Pantalla, JSX.Element> = {
  anotar: <path d="M12 5v14M5 12h14" />,
  clientes: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  lotes: <><path d="M3 9h18l-2 11H5z" /><path d="M3 9l3-5h12l3 5" /><path d="M9 13v4M15 13v4" /></>,
  cierre: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
};
const NOMBRES: Record<Pantalla, string> = { anotar: 'Anotar', clientes: 'Clientes', lotes: 'Lotes', cierre: 'Cierre' };

export default function Navegacion({ actual, ir }: { actual: Pantalla; ir: (p: Pantalla) => void }) {
  return (
    <nav className="navegacion" aria-label="Secciones">
      {(Object.keys(NOMBRES) as Pantalla[]).map((p) => (
        <button key={p} type="button" className={p === actual ? 'nav activo' : 'nav'} aria-current={p === actual ? 'page' : undefined} onClick={() => ir(p)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONOS[p]}
          </svg>
          {NOMBRES[p]}
        </button>
      ))}
    </nav>
  );
}
