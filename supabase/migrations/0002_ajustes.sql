-- Cuentas Claras: ajustes del negocio compartidos entre celulares (por ahora, la clave del cierre).
-- Correr una sola vez en el SQL Editor de Supabase, después de 0001_inicial.sql.

create table ajustes (
  id uuid primary key, valor jsonb not null,
  creado_por text not null, creado_en timestamptz not null, actualizado_en timestamptz not null,
  borrado boolean not null default false, recibido_en timestamptz not null default now()
);

create trigger ajustes_a_version before update on ajustes for each row execute function ignorar_version_vieja();
create trigger ajustes_recibido before insert or update on ajustes for each row execute function marcar_recibido();
create index ajustes_recibido_idx on ajustes (recibido_en);
alter table ajustes enable row level security;
grant select, insert, update on ajustes to authenticated;
create policy ajustes_negocio on ajustes for all using (es_del_negocio()) with check (es_del_negocio());
