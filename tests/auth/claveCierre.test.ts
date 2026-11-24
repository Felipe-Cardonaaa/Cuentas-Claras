import { db } from '../../src/datos/db';
import { cambiarClaveCierre, crearClaveCierre, hayClaveCierre, verificarClaveCierre } from '../../src/auth/claveCierre';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('crea, verifica y cambia la clave del cierre', async () => {
  expect(await hayClaveCierre()).toBe(false);
  await crearClaveCierre('plaza2026', 'u1');
  expect(await hayClaveCierre()).toBe(true);
  expect(await verificarClaveCierre('plaza2026')).toBe(true);
  expect(await verificarClaveCierre('otra')).toBe(false);
  expect(await cambiarClaveCierre('mala', 'nueva123', 'u1')).toBe('La clave actual no es correcta');
  expect(await cambiarClaveCierre('plaza2026', 'nueva123', 'u1')).toBeNull();
  expect(await verificarClaveCierre('nueva123')).toBe(true);
});

it('la clave se guarda para sincronizar, sin guardar la clave en texto', async () => {
  await crearClaveCierre('plaza2026', 'u1');
  const filas = await db.salida.toArray();
  expect(filas.some((f) => f.tabla === 'ajustes')).toBe(true);
  expect(JSON.stringify(filas)).not.toContain('plaza2026');
});

it('pide al menos 4 caracteres', async () => {
  await expect(crearClaveCierre('123', 'u1')).rejects.toThrow('La clave debe tener al menos 4 caracteres');
});
