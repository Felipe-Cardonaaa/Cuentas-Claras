-- Cuentas Claras: esquema inicial.
-- Cada tabla guarda los registros tal como los crea la app; los cálculos (saldos, lotes) se hacen en la app.
-- recibido_en lo pone el servidor y es lo que usan los celulares para bajar cambios.

create or replace function marcar_recibido() returns trigger language plpgsql as $$
begin
  new.recibido_en := now();
  return new;
end $$;

create table usuarios (
  id uuid primary key, nombre text not null, pin_hash text not null, pin_sal text not null,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);

create table clientes (
  id uuid primary key, nombre text not null, nombre_normalizado text not null,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);
create unique index clientes_nombre_unico on clientes (nombre_normalizado) where not borrado;

create table productos (
  id uuid primary key, nombre text not null, nombre_normalizado text not null,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);
create unique index productos_nombre_unico on productos (nombre_normalizado) where not borrado;

create table lotes (
  id uuid primary key, producto_id uuid not null, canastillas integer not null,
  costo_total bigint, costo_detalle text,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);

create table ventas (
  id uuid primary key, grupo_id uuid not null, cliente_id uuid, producto_id uuid not null, lote_id uuid,
  unidad text not null check (unidad in ('canastilla', 'kilo')), cantidad numeric not null,
  precio_unitario bigint not null, estado text not null check (estado in ('pago', 'debe')), prestada boolean,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);

create table vaciados (
  id uuid primary key, lote_id uuid not null, cantidad integer not null,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);

create table abonos (
  id uuid primary key, cliente_id uuid not null, valor bigint not null,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);

create table saldos_iniciales (
  id uuid primary key, cliente_id uuid not null, valor bigint not null,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);

create table devoluciones (
  id uuid primary key, cliente_id uuid not null, cantidad integer not null,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);

create table historial (
  id uuid primary key, tabla text not null, registro_id uuid not null, usuario_id text not null,
  fecha timestamptz not null, accion text not null check (accion in ('crear', 'editar', 'borrar')),
  antes jsonb, despues jsonb, recibido_en timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['usuarios','clientes','productos','lotes','ventas','vaciados','abonos','saldos_iniciales','devoluciones','historial']
  loop
    execute format('create trigger %I_recibido before insert or update on %I for each row execute function marcar_recibido()', t, t);
    execute format('create index %I_recibido_idx on %I (recibido_en)', t, t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_negocio on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;
