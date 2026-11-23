// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

/** Simula lo mínimo de Supabase: el esquema auth con auth.uid() y auth.role() según la sesión. */
const AUTH_FALSO = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('prueba.rol', true), ''), 'anon') $$;
  create role authenticated;
`;

const NEGOCIO = '11111111-1111-1111-1111-111111111111';
const EXTRANO = '22222222-2222-2222-2222-222222222222';

async function base() {
  const pg = new PGlite();
  await pg.exec(AUTH_FALSO);
  await pg.exec(readFileSync('supabase/migrations/0001_inicial.sql', 'utf8'));
  await pg.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;`);
  await pg.exec(`insert into cuentas_negocio (uid) values ('${NEGOCIO}')`);
  return pg;
}

async function como(pg: PGlite, uid: string) {
  await pg.exec(`set role authenticated; select set_config('prueba.uid', '${uid}', false), set_config('prueba.rol', 'authenticated', false);`);
}

const cliente = (actualizado: string, nombre: string) => `
  insert into clientes (id, nombre, nombre_normalizado, creado_por, creado_en, actualizado_en)
  values ('33333333-3333-3333-3333-333333333333', '${nombre}', 'marta', 'u1', '2026-11-17T12:00:00Z', '${actualizado}')
  on conflict (id) do update set nombre = excluded.nombre, actualizado_en = excluded.actualizado_en`;

it('I4: un cambio viejo que llega tarde no pisa uno más nuevo', async () => {
  const pg = await base();
  await como(pg, NEGOCIO);
  await pg.exec(cliente('2026-11-17T12:00:00Z', 'Marta'));
  await pg.exec(cliente('2026-11-17T15:00:00Z', 'Marta Ruiz'));
  await pg.exec(cliente('2026-11-17T13:00:00Z', 'Marta vieja'));
  const r = await pg.query<{ nombre: string }>('select nombre from clientes');
  expect(r.rows.map((x) => x.nombre)).toEqual(['Marta Ruiz']);
});

it('I5: solo la cuenta del negocio ve y escribe datos', async () => {
  const pg = await base();
  await como(pg, NEGOCIO);
  await pg.exec(cliente('2026-11-17T12:00:00Z', 'Marta'));
  await como(pg, EXTRANO);
  expect((await pg.query('select * from clientes')).rows).toHaveLength(0);
  await expect(pg.exec(cliente('2026-11-17T16:00:00Z', 'Intruso'))).rejects.toThrow();
});

it('el servidor marca recibido_en y no deja dos clientes con el mismo nombre', async () => {
  const pg = await base();
  await como(pg, NEGOCIO);
  await pg.exec(cliente('2026-11-17T12:00:00Z', 'Marta'));
  const r = await pg.query<{ recibido_en: Date }>('select recibido_en from clientes');
  expect(r.rows[0].recibido_en).toBeTruthy();
  await expect(pg.exec(`insert into clientes (id, nombre, nombre_normalizado, creado_por, creado_en, actualizado_en)
    values ('44444444-4444-4444-4444-444444444444', 'Marta', 'marta', 'u2', now(), now())`)).rejects.toThrow(/duplicate key/);
});
