import { resumenDia } from '../../src/dominio/cierre';
import { abono, cliente, datosVacios, lote, producto, vaciado, venta } from '../fabrica';

const HOY = '2026-11-17T15:00:00Z';

function muestra() {
  const d = datosVacios();
  d.clientes.push(cliente('m', 'Doña Marta', 'marta'), cliente('pe', 'Don Pedro', 'pedro'));
  d.productos.push(producto('mango', 'mango criollo'), producto('mand', 'mandarina'));
  d.lotes.push(lote('L1', 'mango', 50, null, HOY), lote('L2', 'mand', 8, null, HOY));
  d.ventas.push(
    venta({ clienteId: 'm', productoId: 'mango', loteId: 'L1', cantidad: 2, precioUnitario: 45000, estado: 'debe', prestada: true, creadoEn: HOY }),
    venta({ productoId: 'mango', loteId: 'L1', cantidad: 43, precioUnitario: 45000, estado: 'pago', prestada: false, creadoEn: HOY }),
    venta({ clienteId: 'pe', productoId: 'mand', unidad: 'kilo', cantidad: 8, precioUnitario: 4000, estado: 'debe', creadoEn: HOY }),
    venta({ productoId: 'mand', loteId: 'L2', cantidad: 3, precioUnitario: 60000, estado: 'pago', prestada: false, creadoEn: HOY }),
  );
  d.vaciados.push(vaciado('L2', 2, HOY));
  d.abonos.push(abono('m', 100000, HOY));
  return d;
}

it('resume fiados, abonos y canastillas del día', () => {
  const c = resumenDia('2026-11-17', muestra());
  expect(c.totalFiado).toBe(122000);
  expect(c.abonos).toBe(100000);
  expect(c.fiados).toEqual([
    { clienteId: 'm', descripcion: '2 canast. mango criollo', total: 90000, pendiente: 0 },
    { clienteId: 'pe', descripcion: '8 kg mandarina', total: 32000, pendiente: 32000 },
  ]);
  expect(c.productos.find((p) => p.productoId === 'mango')).toEqual(
    { productoId: 'mango', nombre: 'mango criollo', entraron: 50, vendidas: 45, vaciadas: 0, quedan: 5 });
  expect(c.productos.find((p) => p.productoId === 'mand')).toMatchObject({ entraron: 8, vendidas: 3, vaciadas: 2, quedan: 3 });
  expect(c.prestadasHoy).toBe(2);
  expect(c.contado).toBe(43 * 45000 + 3 * 60000);
});

it('foco 3: una venta de las 8:30 p. m. en Bogotá cuenta ese día', () => {
  const d = datosVacios();
  d.productos.push(producto('mango', 'mango criollo'));
  d.clientes.push(cliente('m', 'Marta', 'marta'));
  d.ventas.push(venta({ clienteId: 'm', productoId: 'mango', cantidad: 1, precioUnitario: 45000, estado: 'debe', creadoEn: '2026-11-18T01:30:00Z' }));
  expect(resumenDia('2026-11-17', d).totalFiado).toBe(45000);
  expect(resumenDia('2026-11-18', d).totalFiado).toBe(0);
});

it('muestra productos vendidos hoy aunque no tengan entrada anotada', () => {
  const d = datosVacios();
  d.productos.push(producto('cri', 'criollo'));
  d.ventas.push(venta({ productoId: 'cri', loteId: null, cantidad: 3, precioUnitario: 60000, estado: 'debe', clienteId: 'g', creadoEn: HOY }));
  expect(resumenDia('2026-11-17', d).productos).toEqual([
    { productoId: 'cri', nombre: 'criollo', entraron: 0, vendidas: 3, vaciadas: 0, quedan: null },
  ]);
});

it('un fiado de hoy que ya se pagó sale como pagado y no cuenta como pendiente', () => {
  const d = datosVacios();
  d.clientes.push(cliente('o', 'Orlando', 'orlando'), cliente('g', 'Gonzalo', 'gonzalo'));
  d.productos.push(producto('cri', 'criollo'));
  d.ventas.push(
    venta({ clienteId: 'o', productoId: 'cri', cantidad: 3, precioUnitario: 60000, estado: 'debe', creadoEn: '2026-11-17T14:00:00Z' }),
    venta({ clienteId: 'g', productoId: 'cri', cantidad: 3, precioUnitario: 60000, estado: 'debe', creadoEn: '2026-11-17T14:10:00Z' }),
  );
  d.abonos.push(abono('o', 180000, '2026-11-17T16:00:00Z'), abono('g', 100000, '2026-11-17T16:00:00Z'));
  const c = resumenDia('2026-11-17', d);
  expect(c.fiados.map((f) => [f.clienteId, f.total, f.pendiente])).toEqual([['o', 180000, 0], ['g', 180000, 80000]]);
  expect(c.totalPendiente).toBe(80000);
});

it('listas de quién pagó hoy y quién quedó debiendo, por cliente', () => {
  const d = datosVacios();
  d.clientes.push(cliente('o', 'Orlando', 'orlando'), cliente('g', 'Gonzalo', 'gonzalo'), cliente('l', 'Luz', 'luz'));
  d.productos.push(producto('cri', 'criollo'));
  d.ventas.push(
    venta({ clienteId: 'o', productoId: 'cri', cantidad: 3, precioUnitario: 60000, estado: 'debe', creadoEn: '2026-11-17T14:00:00Z' }),
    venta({ clienteId: 'g', productoId: 'cri', cantidad: 3, precioUnitario: 60000, estado: 'debe', creadoEn: '2026-11-17T14:10:00Z' }),
    venta({ clienteId: 'g', productoId: 'cri', cantidad: 1, precioUnitario: 60000, estado: 'debe', creadoEn: '2026-11-17T15:10:00Z' }),
  );
  d.abonos.push(
    abono('o', 100000, '2026-11-17T16:00:00Z'), abono('o', 80000, '2026-11-17T17:00:00Z'),
    abono('l', 20000, '2026-11-17T16:30:00Z'), abono('g', 40000, '2026-11-17T16:40:00Z'),
  );
  const c = resumenDia('2026-11-17', d);
  expect(c.pagaron).toEqual([{ clienteId: 'o', valor: 180000 }, { clienteId: 'g', valor: 40000 }, { clienteId: 'l', valor: 20000 }]);
  expect(c.deben).toEqual([{ clienteId: 'g', pendiente: 200000 }]);
});

it('quedó fiado y quedó pago de lo vendido en el día', () => {
  const d = datosVacios();
  d.clientes.push(cliente('o', 'Orlando', 'orlando'), cliente('g', 'Gonzalo', 'gonzalo'));
  d.productos.push(producto('cri', 'criollo'));
  d.ventas.push(
    venta({ clienteId: 'o', productoId: 'cri', cantidad: 2, precioUnitario: 120000, estado: 'debe', creadoEn: '2026-11-17T14:00:00Z' }),
    venta({ clienteId: 'g', productoId: 'cri', cantidad: 3, precioUnitario: 50000, estado: 'debe', creadoEn: '2026-11-17T14:10:00Z' }),
    venta({ productoId: 'cri', cantidad: 5, precioUnitario: 85000, estado: 'pago', creadoEn: '2026-11-17T14:20:00Z' }),
  );
  d.abonos.push(abono('o', 240000, '2026-11-17T16:00:00Z'));
  const c = resumenDia('2026-11-17', d);
  expect(c.quedoFiado).toBe(150000);
  expect(c.quedoPago).toBe(425000 + 240000);
});
