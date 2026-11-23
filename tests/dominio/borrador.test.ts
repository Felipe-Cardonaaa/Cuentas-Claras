import { prepararBorrador, listoParaGuardar, revisarElecciones, type Elecciones } from '../../src/dominio/borrador';
import { parsearFrase, type Intencion } from '../../src/dominio/parser';
import { abono, cliente, datosVacios, lote, producto, saldoInicial, venta } from '../fabrica';

function datos() {
  const d = datosVacios();
  d.clientes.push(cliente('m', 'Doña Marta', 'marta'));
  d.productos.push(producto('mango', 'mango criollo'), producto('zap', 'zapote'));
  d.lotes.push(lote('L1', 'mango', 5, null, '2026-11-17T12:00:00Z'), lote('L2', 'zap', 10, null, '2026-11-17T12:00:00Z'));
  return d;
}
const frase = (t: string): Intencion => {
  const r = parsearFrase(t);
  if (!r.ok) throw new Error(r.error);
  return r.intencion;
};
const sinElegir: Elecciones = { prestada: {}, resolver: {} };

describe('prepararBorrador: errores', () => {
  it.each([
    ['vendí 2 canastillas de mango criollo a 45.000 debe', 'Para fiar necesito el nombre del cliente'],
    ['vendí 2 canastillas de mango criollo a 45.000 pagó con canastilla', 'Para prestar canastillas necesito el nombre del cliente'],
    ['Marta compró 3 kilos de zapote a 5.000 pagó', 'Las ventas por kilo pagadas no hace falta anotarlas'],
    ['vendí 3 kilos de zapote a 5.000 debe', 'Para fiar necesito el nombre del cliente'],
    ['Lucía abonó 10.000', 'No conozco a "Lucía"'],
    ['Lucía pagó todo', 'No conozco a "Lucía"'],
    ['Lucía devolvió 1 canastilla', 'No conozco a "Lucía"'],
    ['se vaciaron 2 canastillas de guayaba', 'No conozco el producto "guayaba"'],
  ])('%s', (t, error) => {
    expect(prepararBorrador(frase(t), datos())).toEqual({ ok: false, error });
  });

  it('abono mayor que la deuda', () => {
    const d = datos();
    d.ventas.push(venta({ clienteId: 'm', productoId: 'mango', cantidad: 1, precioUnitario: 50000, estado: 'debe' }));
    expect(prepararBorrador(frase('Marta abonó 60.000'), d)).toEqual({ ok: false, error: 'El abono es mayor que la deuda. Debe $50.000' });
  });
  it('pago total sin deuda', () => {
    expect(prepararBorrador(frase('Marta pagó todo'), datos())).toEqual({ ok: false, error: 'Doña Marta no debe nada' });
  });
  it('devolución mayor que lo prestado', () => {
    expect(prepararBorrador(frase('Marta devolvió 2 canastillas'), datos())).toEqual({ ok: false, error: 'Solo tiene 0 canastillas prestadas' });
  });
  it('saldo de la libreta repetido', () => {
    const d = datos();
    d.saldosIniciales.push(saldoInicial('m', 10000, '2026-11-01T12:00:00Z'));
    expect(prepararBorrador(frase('Marta debía 5.000'), d)).toEqual({ ok: false, error: 'Este cliente ya tiene saldo de la libreta' });
  });
});

describe('prepararBorrador: borradores', () => {
  it('venta de dos productos pide préstamo por línea', () => {
    const r = prepararBorrador(frase('Marta compró 1 canastilla de mango criollo a 45.000 y 1 de zapote a 50.000 debe'), datos());
    if (!r.ok) throw new Error(r.error);
    expect(r.borrador.total).toBe(95000);
    expect(r.borrador.pide).toEqual({ estado: false, prestada: [0, 1], canastillasDeEntrada: false });
    expect(r.borrador.cliente).toEqual({ tipo: 'exacta', id: 'm', nombre: 'Doña Marta' });
  });
  it('avisa si no quedan canastillas suficientes', () => {
    const r = prepararBorrador(frase('Marta compró 8 canastillas de mango criollo a 45.000 debe'), datos());
    if (!r.ok) throw new Error(r.error);
    expect(r.borrador.avisos).toEqual(['Solo quedan 5 canastillas de mango criollo']);
  });
  it('cliente parecido', () => {
    const r = prepararBorrador(frase('Martha compró 1 canastilla de zapote a 50.000 pagó empacado'), datos());
    if (!r.ok) throw new Error(r.error);
    expect(r.borrador.cliente?.tipo).toBe('parecida');
    expect(listoParaGuardar(r.borrador, sinElegir)).toBe(false);
    expect(listoParaGuardar(r.borrador, { ...sinElegir, resolver: { cliente: 'usarParecido' } })).toBe(true);
  });
  it('pago total calcula el saldo', () => {
    const d = datos();
    d.ventas.push(venta({ clienteId: 'm', productoId: 'mango', cantidad: 2, precioUnitario: 45000, estado: 'debe' }));
    d.abonos.push(abono('m', 40000, '2026-11-18T12:00:00Z'));
    const r = prepararBorrador(frase('Marta pagó todo'), d);
    if (!r.ok) throw new Error(r.error);
    expect(r.borrador.valorCalculado).toBe(50000);
  });
  it('entrada en kilos pide canastillas', () => {
    const r = prepararBorrador(frase('entraron 200 kilos de mandarina por 900.000'), datos());
    if (!r.ok) throw new Error(r.error);
    expect(r.borrador.pide.canastillasDeEntrada).toBe(true);
    expect(listoParaGuardar(r.borrador, { ...sinElegir, resolver: {} })).toBe(false);
    expect(listoParaGuardar(r.borrador, { ...sinElegir, canastillasDeEntrada: 8 })).toBe(true);
  });
});

describe('revisarElecciones', () => {
  it('elegir pagó en una venta por kilo da error', () => {
    const r = prepararBorrador(frase('Marta compró 3 kilos de zapote a 5.000'), datos());
    if (!r.ok) throw new Error(r.error);
    expect(revisarElecciones(r.borrador, { ...sinElegir, estado: 'pago' })).toBe('Las ventas por kilo pagadas no hace falta anotarlas');
    expect(listoParaGuardar(r.borrador, { ...sinElegir, estado: 'debe' })).toBe(true);
  });
  it('cliente de paso que se lleva canastilla', () => {
    const r = prepararBorrador(frase('vendí 1 canastilla de zapote a 50.000 pagó'), datos());
    if (!r.ok) throw new Error(r.error);
    expect(revisarElecciones(r.borrador, { ...sinElegir, prestada: { 0: true } })).toBe('Para prestar canastillas necesito el nombre del cliente');
    expect(listoParaGuardar(r.borrador, { ...sinElegir, prestada: { 0: false } })).toBe(true);
  });
});

it('"criollo" en una venta usa "mango criollo" sin preguntar', () => {
  const r = prepararBorrador(frase('Marta compró 1 de criollo a 45.000 pagó empacado'), datos());
  if (!r.ok) throw new Error(r.error);
  expect(r.borrador.lineas[0].producto).toEqual({ tipo: 'exacta', id: 'mango', nombre: 'mango criollo' });
  expect(listoParaGuardar(r.borrador, sinElegir)).toBe(true);
});

it('con sugerencia de escritura hay que elegir antes de guardar', () => {
  const d = datosVacios();
  d.clientes.push(cliente('m', 'Marta', 'marta'));
  const r = prepararBorrador(frase('Marta compró 3 kilos de mandarna a 4.000 debe'), d);
  if (!r.ok) throw new Error(r.error);
  expect(r.borrador.lineas[0].producto).toMatchObject({ tipo: 'nueva', sugerencia: 'mandarina' });
  expect(listoParaGuardar(r.borrador, sinElegir)).toBe(false);
  expect(listoParaGuardar(r.borrador, { ...sinElegir, resolver: { 'producto:0': 'usarSugerencia' } })).toBe(true);
  expect(listoParaGuardar(r.borrador, { ...sinElegir, resolver: { 'producto:0': 'crearNuevo' } })).toBe(true);
});
