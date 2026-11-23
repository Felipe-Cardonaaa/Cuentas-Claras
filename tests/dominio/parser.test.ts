import { parsearFrase } from '../../src/dominio/parser';

const ok = (intencion: unknown) => ({ ok: true, intencion });

describe('parsearFrase: ventas', () => {
  it('venta fiada de canastillas', () => {
    expect(parsearFrase('Marta compró 2 canastillas de mango criollo a 45.000 debe')).toEqual(ok({
      tipo: 'venta', cliente: 'Marta', estado: 'debe',
      items: [{ cantidad: 2, unidad: 'canastilla', producto: 'mango criollo', precioUnitario: 45000, prestada: null }],
    }));
  });

  it('se llevó, números en palabras, mil, pagó, empacado', () => {
    expect(parsearFrase('Doña Marta se llevó dos canastas de zapote a 45 mil pagó empacado')).toEqual(ok({
      tipo: 'venta', cliente: 'Doña Marta', estado: 'pago',
      items: [{ cantidad: 2, unidad: 'canastilla', producto: 'zapote', precioUnitario: 45000, prestada: false }],
    }));
  });

  it('varios productos; el segundo hereda la unidad', () => {
    expect(parsearFrase('Marta compró 1 canastilla de mango criollo a 45.000 y 1 de zapote a 50.000 debe')).toEqual(ok({
      tipo: 'venta', cliente: 'Marta', estado: 'debe',
      items: [
        { cantidad: 1, unidad: 'canastilla', producto: 'mango criollo', precioUnitario: 45000, prestada: null },
        { cantidad: 1, unidad: 'canastilla', producto: 'zapote', precioUnitario: 50000, prestada: null },
      ],
    }));
  });

  it('vendí = cliente de paso', () => {
    expect(parsearFrase('vendí 2 canastillas de mango criollo a 45.000 pagó')).toEqual(ok({
      tipo: 'venta', cliente: null, estado: 'pago',
      items: [{ cantidad: 2, unidad: 'canastilla', producto: 'mango criollo', precioUnitario: 45000, prestada: null }],
    }));
  });

  it('venta por kilo', () => {
    expect(parsearFrase('Pedro compró 8 kilos de mandarina a 4.000 debe')).toEqual(ok({
      tipo: 'venta', cliente: 'Pedro', estado: 'debe',
      items: [{ cantidad: 8, unidad: 'kilo', producto: 'mandarina', precioUnitario: 4000, prestada: null }],
    }));
  });

  it('sin estado', () => {
    expect(parsearFrase('Marta compró 2 canastillas de mango a 45.000')).toEqual(ok({
      tipo: 'venta', cliente: 'Marta', estado: null,
      items: [{ cantidad: 2, unidad: 'canastilla', producto: 'mango', precioUnitario: 45000, prestada: null }],
    }));
  });

  it('con canastilla y fiado', () => {
    const r = parsearFrase('Marta compró 2 canastillas de mango a 45.000 fiado con canastilla');
    expect(r).toEqual(ok({
      tipo: 'venta', cliente: 'Marta', estado: 'debe',
      items: [{ cantidad: 2, unidad: 'canastilla', producto: 'mango', precioUnitario: 45000, prestada: true }],
    }));
  });

  it('precio dictado en palabras (foco 1)', () => {
    const r = parsearFrase('Marta compró dos canastillas de mango a cuarenta y cinco mil quedó debiendo');
    expect(r).toMatchObject({ ok: true, intencion: { estado: 'debe', items: [{ cantidad: 2, precioUnitario: 45000 }] } });
  });
});

describe('parsearFrase: otras intenciones', () => {
  it('abono', () => {
    expect(parsearFrase('Marta abonó 40.000')).toEqual(ok({ tipo: 'abono', cliente: 'Marta', valor: 40000 }));
  });
  it('pago total', () => {
    expect(parsearFrase('Marta pagó todo')).toEqual(ok({ tipo: 'pagoTotal', cliente: 'Marta' }));
  });
  it('entrada con costo unitario', () => {
    expect(parsearFrase('entraron 50 canastillas de mango criollo a 36.000')).toEqual(ok({
      tipo: 'entrada', producto: 'mango criollo', cantidad: 50, unidad: 'canastilla', costo: { tipo: 'unitario', valor: 36000 },
    }));
  });
  it('entrada en kilos con costo total', () => {
    expect(parsearFrase('entraron 200 kilos de mandarina por 900.000')).toEqual(ok({
      tipo: 'entrada', producto: 'mandarina', cantidad: 200, unidad: 'kilo', costo: { tipo: 'total', valor: 900000 },
    }));
  });
  it('entrada sin costo', () => {
    expect(parsearFrase('entraron 30 canastillas de mango criollo')).toEqual(ok({
      tipo: 'entrada', producto: 'mango criollo', cantidad: 30, unidad: 'canastilla', costo: null,
    }));
  });
  it('vaciado', () => {
    expect(parsearFrase('se vaciaron 2 canastillas de mandarina')).toEqual(ok({ tipo: 'vaciado', producto: 'mandarina', cantidad: 2 }));
  });
  it('devolución', () => {
    expect(parsearFrase('Marta devolvió 2 canastillas')).toEqual(ok({ tipo: 'devolucion', cliente: 'Marta', cantidad: 2 }));
  });
  it('saldo inicial', () => {
    expect(parsearFrase('Marta debía 150.000')).toEqual(ok({ tipo: 'saldoInicial', cliente: 'Marta', valor: 150000 }));
  });
});

describe('parsearFrase: errores', () => {
  it('sin cantidad', () => {
    expect(parsearFrase('Marta compró canastillas de mango a 45.000 debe')).toEqual({ ok: false, error: 'No entendí la cantidad' });
  });
  it('precio ilegible', () => {
    expect(parsearFrase('Marta compró 2 canastillas de mango a mucho debe')).toEqual({ ok: false, error: 'No entendí el precio' });
  });
  it('frase desconocida', () => {
    expect(parsearFrase('hola')).toEqual({
      ok: false, error: 'No entendí la frase. Ejemplo: "Marta compró 2 canastillas de mango criollo a 45.000 debe"',
    });
  });
});
