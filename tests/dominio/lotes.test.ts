import { estadoLotes, elegirLotes } from '../../src/dominio/lotes';
import { datosVacios, lote, venta, vaciado } from '../fabrica';

function escenario() {
  const d = datosVacios();
  d.lotes.push(lote('L1', 'p', 50, 1800000, '2026-11-17T12:00:00Z'), lote('L2', 'p', 30, null, '2026-11-18T12:00:00Z'));
  d.ventas.push(venta({ productoId: 'p', loteId: 'L1', cantidad: 45, precioUnitario: 45000 }));
  return d;
}

describe('estadoLotes', () => {
  it('cuenta vendidas, quedan, ingreso y ganancia', () => {
    const [l1, l2] = estadoLotes('p', escenario());
    expect(l1).toMatchObject({ vendidas: 45, vaciadas: 0, quedan: 5, ingreso: 2025000, ganancia: 225000 });
    expect(l2).toMatchObject({ vendidas: 0, quedan: 30, ganancia: null });
  });
  it('los vaciados bajan quedan pero no suman ingreso', () => {
    const d = escenario();
    d.vaciados.push(vaciado('L1', 2));
    expect(estadoLotes('p', d)[0]).toMatchObject({ vaciadas: 2, quedan: 3, ingreso: 2025000 });
  });
  it('las ventas por kilo no tocan los lotes', () => {
    const d = escenario();
    d.ventas.push(venta({ productoId: 'p', loteId: null, unidad: 'kilo', cantidad: 8, precioUnitario: 4000, estado: 'debe' }));
    expect(estadoLotes('p', d)[0]).toMatchObject({ vendidas: 45, quedan: 5 });
  });
  it('ignora lo borrado', () => {
    const d = escenario();
    d.ventas[0].borrado = true;
    expect(estadoLotes('p', d)[0].quedan).toBe(50);
  });
});

describe('elegirLotes', () => {
  it('reparte del más viejo al más nuevo', () => {
    expect(elegirLotes('p', 8, escenario())).toEqual({ partes: [{ loteId: 'L1', cantidad: 5 }, { loteId: 'L2', cantidad: 3 }], excede: false });
  });
  it('si no alcanza, el sobrante va al último lote', () => {
    expect(elegirLotes('p', 40, escenario())).toEqual({ partes: [{ loteId: 'L1', cantidad: 5 }, { loteId: 'L2', cantidad: 35 }], excede: true });
  });
  it('sin lotes', () => {
    expect(elegirLotes('x', 2, escenario())).toEqual({ partes: [{ loteId: null, cantidad: 2 }], excede: true });
  });
});
