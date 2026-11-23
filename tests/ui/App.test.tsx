import { render, screen } from '@testing-library/react';
import App from '../../src/ui/App';

it('muestra el nombre de la app', () => {
  render(<App />);
  expect(screen.getByText('Cuentas Claras')).toBeInTheDocument();
});
