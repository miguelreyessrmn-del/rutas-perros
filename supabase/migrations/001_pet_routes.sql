-- PetGround — Rutas: modelo de datos ampliado (v1, sin auth/RLS — ver README)
-- Seguro de ejecutar sobre datos existentes: solo agrega columnas/tablas, no borra nada.

-- ── 1. Perfil completo de mascota sobre la tabla existente ──────────────────
alter table mascotas_ruta
  add column if not exists propietario_nombre text,
  add column if not exists telefono_principal text,
  add column if not exists telefono_secundario text,
  add column if not exists direccion text,
  add column if not exists latitud double precision,
  add column if not exists longitud double precision,
  add column if not exists google_place_id text,
  add column if not exists referencias text,
  add column if not exists notas text,
  add column if not exists foto_mascota_path text,
  add column if not exists foto_fachada_path text,
  add column if not exists foto_acceso_path text,
  add column if not exists hora_disponible_desde time,
  add column if not exists minutos_atencion integer not null default 5,
  add column if not exists activa boolean not null default true;

comment on column mascotas_ruta.coordenadas is
  'Columna legacy. Se conserva por compatibilidad; los registros nuevos usan latitud/longitud. El cliente migra coordenadas -> latitud/longitud en memoria al leer.';

-- ── 2. Rutas ─────────────────────────────────────────────────────────────
create table if not exists rutas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('optimizada', 'seleccion', 'manual')),
  estado text not null default 'borrador' check (estado in ('borrador', 'en_curso', 'completada', 'cancelada')),
  origen_lat double precision,
  origen_lng double precision,
  distancia_total_metros integer,
  duracion_total_segundos integer,
  polyline text,
  iniciada_at timestamptz,
  finalizada_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 3. Paradas de ruta ───────────────────────────────────────────────────
create table if not exists ruta_paradas (
  id uuid primary key default gen_random_uuid(),
  ruta_id uuid not null references rutas(id) on delete cascade,
  mascota_id bigint references mascotas_ruta(id),
  orden integer not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_curso', 'completada', 'no_disponible', 'omitida')),
  distancia_desde_anterior_metros integer,
  duracion_desde_anterior_segundos integer,
  llegada_estimada timestamptz,
  llegada_real timestamptz,
  completada_at timestamptz,
  notas_operativas text,
  incidencia text,
  checklist jsonb not null default '{}'::jsonb,
  latitud_snapshot double precision,
  longitud_snapshot double precision,
  direccion_snapshot text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ruta_paradas_ruta_id on ruta_paradas(ruta_id);
create index if not exists idx_ruta_paradas_orden on ruta_paradas(ruta_id, orden);
create index if not exists idx_rutas_fecha on rutas(fecha);

-- Los proyectos nuevos de Supabase activan Row Level Security por default en
-- tablas creadas desde cero, aunque el SQL no lo pida explícitamente. Como
-- decidimos posponer auth/RLS a v2, se desactiva aquí para que `rutas` y
-- `ruta_paradas` queden al mismo nivel de acceso que `mascotas_ruta` hoy.
alter table rutas disable row level security;
alter table ruta_paradas disable row level security;

-- ── Nota de seguridad ─────────────────────────────────────────────────────
-- No se habilita Row Level Security en esta fase (v1): la app aún no tiene
-- autenticación (decisión explícita para priorizar el MVP operativo). El
-- acceso vía llave anon queda al mismo nivel que mascotas_ruta hoy. Cuando
-- se agregue Supabase Auth (v2), activar RLS en las 3 tablas + storage.objects
-- y crear políticas por rol (admin/chofer) antes de exponer la app públicamente.
