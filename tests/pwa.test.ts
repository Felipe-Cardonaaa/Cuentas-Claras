import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

it('el build genera el manifiesto y el service worker', () => {
  execSync('npx vite build --logLevel error', { stdio: 'pipe' });
  const manifiesto = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
  expect(manifiesto.name).toBe('Cuentas Claras');
  expect(manifiesto.display).toBe('standalone');
  expect(manifiesto.lang).toBe('es-CO');
  expect(existsSync('dist/sw.js')).toBe(true);
}, 120_000);
