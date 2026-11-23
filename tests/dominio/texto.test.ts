import { normalizarNombre, aNumero, parsearPrecio, formatoCOP, fechaBogota, horaBogota, nombrePropio } from '../../src/dominio/texto';

describe('normalizarNombre', () => {
  it('quita tildes, mayúsculas, espacios y tratamientos', () => {
    expect(normalizarNombre('  Doña  Martha Ramírez ')).toBe('martha ramirez');
    expect(normalizarNombre('Don Pedro')).toBe('pedro');
    expect(normalizarNombre('Sra. Luz')).toBe('luz');
  });
});

describe('aNumero', () => {
  it('lee dígitos y palabras', () => {
    expect(aNumero('dos')).toBe(2);
    expect(aNumero('12')).toBe(12);
    expect(aNumero('medio')).toBe(0.5);
    expect(aNumero('veinte')).toBe(20);
    expect(aNumero('treinta y cinco')).toBe(35);
    expect(aNumero('nada')).toBeNull();
  });
});

describe('parsearPrecio', () => {
  it.each(['45.000', '45000', '$45.000', '45 mil', 'cuarenta y cinco mil'])('%s = 45000', (s) => {
    expect(parsearPrecio(s)).toBe(45000);
  });
  it('millones y basura', () => {
    expect(parsearPrecio('1.800.000')).toBe(1800000);
    expect(parsearPrecio('abc')).toBeNull();
  });
});

describe('formato y fechas', () => {
  it('formatoCOP', () => {
    expect(formatoCOP(90000)).toBe('$90.000');
    expect(formatoCOP(1800000)).toBe('$1.800.000');
  });
  it('fechaBogota usa la hora de Colombia', () => {
    expect(fechaBogota('2026-11-18T01:30:00Z')).toBe('2026-11-17');
  });
  it('horaBogota', () => {
    expect(horaBogota('2026-11-17T14:42:00Z')).toBe('9:42 a. m.');
    expect(horaBogota('2026-11-17T21:20:00Z')).toBe('4:20 p. m.');
  });
  it('nombrePropio conserva tildes', () => {
    expect(nombrePropio('doña marta ramírez')).toBe('Doña Marta Ramírez');
  });
});
