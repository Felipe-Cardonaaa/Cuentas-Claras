import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './ui/App';
import { supabase } from './sync/supabase';
import { iniciarSincronizacion } from './sync/sincronizar';

registerSW({ immediate: true });
if (supabase) iniciarSincronizacion(supabase);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
