import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './ui/App';
import { supabase } from './sync/supabase';
import { iniciarSincronizacion, type ClienteSync } from './sync/sincronizar';

registerSW({ immediate: true });
// El cliente de Supabase cumple ClienteSync; el cast evita una comparación de tipos demasiado profunda.
if (supabase) iniciarSincronizacion(supabase as unknown as ClienteSync);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
