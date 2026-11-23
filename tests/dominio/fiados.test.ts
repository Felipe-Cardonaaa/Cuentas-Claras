import { deudores, estadoCuenta, validarAbono } from '../../src/dominio/fiados';
import { abono, cliente, datosVacios, saldoInicial, venta } from '../fabrica';

const fiada = (total: number, creadoEn: string) =>
  venta({ clienteId: 'm', productoId: 'p', cantidad: 1, precioUnitario: total, estado: 'debe', creadoEn });

describe('estadoCuenta', () => {
  it('el abono cubre primero la venta más vieja', () => {
    const d = datosVacios();
    const v1 = fiada(90000, '2026-11-12T14:00:00Z');
    const v2 = fiada(60000, '2026-11-14T14:00:00Z');
    d.ventas.push(v1, v2);
    d.abonos.push(abono('m', 100000, '2026-11-15T21:00:00Z'));
    const c = estadoCuenta('m', d);
    expect(c).toMatchObject({ saldo: 50000, debe: true });
    expect(c.lineas.find((l) => l.id === v1.id)).toMatchObject({ debe: false, pendiente: 0 });
    expect(c.lineas.find((l) => l.id === v2.id)).toMatchObject({ debe: true, pendiente: 50000 });
    expect(c.lineas.map((l) => l.tipo)).toEqual(['venta', 'venta', 'abono']);
  });

  it('el saldo de la libreta es siempre la deuda más vieja', () => {
    const d = datosVacios();
    const v = fiada(20000, '2026-11-10T14:00:00Z');
    const s = saldoInicial('m', 150000, '2026-11-11T14:00:00Z');
    d.ventas.push(v);
    d.saldosIniciales.push(s);
    d.abonos.push(abono('m', 100000, '2026-11-12T14:00:00Z'));
    const c = estadoCuenta('m', d);
    expect(c.todas.find((l) => l.id === s.id)).toMatchObject({ tipo: 'saldoInicial', pendiente: 50000, debe: true });
    expect(c.todas.find((l) => l.id === v.id)).toMatchObject({ pendiente: 20000, debe: true });
  });

  it('las líneas empiezan después del último saldo en cero', () => {
    const d = datosVacios();
    d.ventas.push(fiada(30000, '2026-11-08T14:00:00Z'));
    d.abonos.push(abono('m', 30000, '2026-11-10T14:00:00Z'));
    const nueva = fiada(45000, '2026-11-12T14:00:00Z');
    d.ventas.push(nueva);
    const c = estadoCuenta('m', d);
    expect(c.lineas.map((l) => l.id)).toEqual([nueva.id]);
    expect(c.todas).toHaveLength(3);
  });

  it('las ventas pagadas y lo borrado no cuentan', () => {
    const d = datosVacios();
    d.ventas.push(venta({ clienteId: 'm', productoId: 'p', cantidad: 1, precioUnitario: 10000, estado: 'pago' }));
    const borrada = fiada(5000, '2026-11-12T14:00:00Z');
    borrada.borrado = true;
    d.ventas.push(borrada);
    expect(estadoCuenta('m', d)).toMatchObject({ saldo: 0, debe: false, lineas: [] });
  });
});

describe('validarAbono', () => {
  it('rechaza abonos mayores que la deuda o en cero', () => {
    expect(validarAbono(60000, 50000)).toBe('El abono es mayor que la deuda. Debe $50.000');
    expect(validarAbono(0, 50000)).toBe('El abono debe ser mayor que cero');
    expect(validarAbono(50000, 50000)).toBeNull();
  });
});

it('revisión final: plata redondeada a pesos, sin "debe" fantasma', () => {
  const d = datosVacios();
  d.ventas.push(venta({ clienteId: 'm', productoId: 'p', unidad: 'kilo', cantidad: 1.1, precioUnitario: 3000, estado: 'debe', creadoEn: '2026-11-12T14:00:00Z' }));
  d.abonos.push(abono('m', 3300, '2026-11-13T14:00:00Z'));
  expect(estadoCuenta('m', d)).toMatchObject({ saldo: 0, debe: false });
  const d2 = datosVacios();
  d2.ventas.push(venta({ clienteId: 'm', productoId: 'p', unidad: 'kilo', cantidad: 1.1, precioUnitario: 3000, estado: 'debe' }));
  expect(Number.isInteger(estadoCuenta('m', d2).saldo)).toBe(true);
});

describe('deudores', () => {
  function tres() {
    const d = datosVacios();
    d.clientes.push(cliente('a', 'Ana', 'ana'), cliente('b', 'Beto', 'beto'), cliente('c', 'Carla', 'carla'));
    d.ventas.push(
      venta({ clienteId: 'a', productoId: 'p', cantidad: 1, precioUnitario: 20000, estado: 'debe', creadoEn: '2026-11-15T14:00:00Z' }),
      venta({ clienteId: 'b', productoId: 'p', cantidad: 1, precioUnitario: 90000, estado: 'debe', creadoEn: '2026-11-17T14:00:00Z' }),
      venta({ clienteId: 'c', productoId: 'p', cantidad: 1, precioUnitario: 50000, estado: 'debe', creadoEn: '2026-11-10T14:00:00Z' }),
    );
    d.abonos.push(abono('c', 50000, '2026-11-11T14:00:00Z'));
    return d;
  }
  it('solo los que deben, de mayor a menor deuda, con la fecha de la deuda pendiente más vieja', () => {
    expect(deudores(tres(), 'monto')).toEqual([
      { clienteId: 'b', nombre: 'Beto', saldo: 90000, desde: '2026-11-17T14:00:00Z' },
      { clienteId: 'a', nombre: 'Ana', saldo: 20000, desde: '2026-11-15T14:00:00Z' },
    ]);
  });
  it('ordenados por la deuda más vieja', () => {
    expect(deudores(tres(), 'antiguedad').map((x) => x.nombre)).toEqual(['Ana', 'Beto']);
  });
});
