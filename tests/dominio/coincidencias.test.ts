import { buscarCoincidencia, nombreDisponible } from '../../src/dominio/coincidencias';

const cat = [
  { id: 'c1', nombre: 'Doña Marta', nombreNormalizado: 'marta' },
  { id: 'c2', nombre: 'Pedro', nombreNormalizado: 'pedro' },
];

describe('buscarCoincidencia', () => {
  it('exacta ignorando tratamiento y mayúsculas', () => {
    expect(buscarCoincidencia('marta', cat)).toEqual({ tipo: 'exacta', id: 'c1', nombre: 'Doña Marta' });
  });
  it('parecida por error de escritura', () => {
    expect(buscarCoincidencia('Martha', cat)).toEqual({ tipo: 'parecida', id: 'c1', nombre: 'Doña Marta', escrito: 'Martha' });
  });
  it('nueva si nada se parece', () => {
    expect(buscarCoincidencia('Lucía', cat)).toEqual({ tipo: 'nueva', escrito: 'Lucía' });
  });
  it('producto parecido por prefijo', () => {
    const prods = [{ id: 'p1', nombre: 'mango criollo', nombreNormalizado: 'mango criollo' }];
    expect(buscarCoincidencia('mango', prods).tipo).toBe('parecida');
  });
  it('nombres cortos: solo 1 letra de diferencia', () => {
    const c = [{ id: 'x', nombre: 'Ana', nombreNormalizado: 'ana' }];
    expect(buscarCoincidencia('Eva', c).tipo).toBe('nueva');
    expect(buscarCoincidencia('Ama', c).tipo).toBe('parecida');
  });
});

describe('nombreDisponible', () => {
  it('rechaza el mismo nombre con otro tratamiento', () => {
    expect(nombreDisponible('Don Pedro', cat)).toBe(false);
    expect(nombreDisponible('Pedro Pérez', cat)).toBe(true);
  });
});
