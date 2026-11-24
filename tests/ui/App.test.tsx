import { render, screen } from '@testing-library/react';
import App from '../../src/ui/App';

it('muestra el nombre de la app', () => {
  render(<App />);
  expect(screen.getByText('Cuentas Claras')).toBeInTheDocument();
});

it('la fecha de arriba se actualiza si la app queda abierta de un día para otro', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-11-24T04:59:00Z')); // 11:59 p. m. del 23 en Bogotá
  localStorage.setItem('cuentas-claras:usuario', JSON.stringify({ id: 'u1', nombre: 'Felipe' }));
  const { act: actuar } = await import('@testing-library/react');
  render(<App />);
  expect(screen.getByText(/23 de nov/)).toBeInTheDocument();
  await actuar(async () => { vi.setSystemTime(new Date('2026-11-24T05:01:00Z')); vi.advanceTimersByTime(60_000); });
  expect(screen.getByText(/24 de nov/)).toBeInTheDocument();
  vi.useRealTimers();
  localStorage.clear();
});
