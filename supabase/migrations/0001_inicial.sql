-- Cuentas Claras: esquema inicial.
-- Cada tabla guarda los registros tal como los crea la app; los cálculos (saldos, lotes) se hacen en la app.
-- recibido_en lo pone el servidor y es lo que usan los celulares para bajar cambios.

create or replace function marcar_recibido() returns trigger language plpgsql as $$
begin
  new.recibido_en := now();
  return new;
end $$;

-- Si un celular sube tarde un cambio más viejo que el guardado, se ignora: gana el cambio más reciente.
create or replace function ignorar_version_vieja() returns trigger language plpgsql as $$
begin
  if new.actualizado_en < old.actualizado_en then
    return null;
  end if;
  return new;
end $$;

-- Cuentas de Supabase que pueden ver y escribir los datos del negocio.
-- Después de crear la cuenta del negocio:
--   insert into cuentas_negocio (uid) select id from auth.users where email = 'correo-del-negocio@ejemplo.com';
create table cuentas_negocio (uid uuid primary key);
alter table cuentas_negocio enable row level security;

create or replace function es_del_negocio() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cuentas_negocio where uid = auth.uid())
$$;
grant execute on function es_del_negocio() to authenticated;

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
    -- Los disparadores corren en orden alfabético: primero se descarta la versión vieja, luego se marca recibido_en.
    if t <> 'historial' then
      execute format('create trigger %I_a_version before update on %I for each row execute function ignorar_version_vieja()', t, t);
    end if;
    execute format('create trigger %I_recibido before insert or update on %I for each row execute function marcar_recibido()', t, t);
    execute format('create index %I_recibido_idx on %I (recibido_en)', t, t);
    execute format('alter table %I enable row level security', t);
    -- Acceso explícito para la app (no depende de la opción "Grant API access" del proyecto).
    execute format('grant select, insert, update on %I to authenticated', t);
    execute format('create policy %I_negocio on %I for all using (es_del_negocio()) with check (es_del_negocio())', t, t);
  end loop;
end $$;
