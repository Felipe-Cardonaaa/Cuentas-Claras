import { buscarCoincidencia, buscarProducto, nombreDisponible } from '../../src/dominio/coincidencias';

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

it('"criollo" se parece a "mango criollo" (palabra completa)', () => {
  const prods = [{ id: 'p1', nombre: 'mango criollo', nombreNormalizado: 'mango criollo' }];
  expect(buscarCoincidencia('criollo', prods)).toMatchObject({ tipo: 'parecida', id: 'p1' });
});

describe('productos por palabra', () => {
  const mangos = [
    { id: 'c', nombre: 'mango criollo', nombreNormalizado: 'mango criollo' },
    { id: 't', nombre: 'mango tommy', nombreNormalizado: 'mango tommy' },
    { id: 'f', nombre: 'mango farchin', nombreNormalizado: 'mango farchin' },
  ];
  it('"criollo", "tommy" y "farchin" se reconocen solos', () => {
    expect(buscarProducto('criollo', mangos)).toEqual({ tipo: 'exacta', id: 'c', nombre: 'mango criollo' });
    expect(buscarProducto('Tommy', mangos)).toEqual({ tipo: 'exacta', id: 't', nombre: 'mango tommy' });
    expect(buscarProducto('farchin', mangos)).toEqual({ tipo: 'exacta', id: 'f', nombre: 'mango farchin' });
  });
  it('al revés: "mango criollo" encuentra "criollo"', () => {
    expect(buscarProducto('mango criollo', [{ id: 'c', nombre: 'criollo', nombreNormalizado: 'criollo' }])).toEqual({ tipo: 'exacta', id: 'c', nombre: 'criollo' });
  });
  it('"mango" a secas es ambiguo: pregunta', () => {
    expect(buscarProducto('mango', mangos).tipo).toBe('parecida');
  });
  it('a los clientes no se les aplica: "Marta" no se vuelve "Marta Ruiz" sin preguntar', () => {
    expect(buscarCoincidencia('Marta', [{ id: 'r', nombre: 'Marta Ruiz', nombreNormalizado: 'marta ruiz' }]).tipo).toBe('parecida');
  });
});

describe('¿Quisiste decir…? (errores de escritura en productos)', () => {
  it('corrige palabras contra frutas comunes aunque no haya productos', () => {
    expect(buscarProducto('mayo criollo', [])).toEqual({ tipo: 'nueva', escrito: 'mayo criollo', sugerencia: 'mango criollo' });
    expect(buscarProducto('mandarna', [])).toEqual({ tipo: 'nueva', escrito: 'mandarna', sugerencia: 'mandarina' });
    expect(buscarProducto('aguacte hass', [])).toMatchObject({ sugerencia: 'aguacate hass' });
  });
  it('no sugiere nada si está bien escrito', () => {
    expect(buscarProducto('zapote', [])).toEqual({ tipo: 'nueva', escrito: 'zapote' });
    expect(buscarProducto('mango farchin', [])).toEqual({ tipo: 'nueva', escrito: 'mango farchin' });
  });
  it('si la corrección es un producto que ya existe, lo propone', () => {
    const prods = [{ id: 'm', nombre: 'mandarina', nombreNormalizado: 'mandarina' }];
    expect(buscarProducto('mandarna', prods)).toEqual({ tipo: 'parecida', id: 'm', nombre: 'mandarina', escrito: 'mandarna' });
  });
  it('aprende las palabras de los productos ya anotados', () => {
    const prods = [{ id: 'g', nombre: 'gulupa', nombreNormalizado: 'gulupa' }];
    expect(buscarProducto('gulupa roja', prods).tipo).toBe('exacta');
    expect(buscarProducto('gulpa', prods)).toMatchObject({ tipo: 'parecida', id: 'g' });
  });
});
