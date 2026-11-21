-- Sky Studio Barbería: estructura de promoción gratuita.
create extension if not exists pgcrypto;

create table if not exists public.tickets (
  number smallint primary key check (number between 0 and 99),
  status text not null default 'available'
    check (status in ('available','pending','assigned')),
  participant_name text,
  participant_phone text,
  updated_at timestamptz not null default now(),
  check (
    (status = 'assigned' and participant_name is not null and length(trim(participant_name)) > 0)
    or (status <> 'assigned' and participant_name is null and participant_phone is null)
  )
);

insert into public.tickets(number)
select generate_series(0,99)
on conflict (number) do nothing;

alter table public.tickets enable row level security;

-- Lectura pública limitada a número y estado: datos personales nunca se exponen.
drop policy if exists "Public can view ticket availability" on public.tickets;
create policy "Public can view ticket availability"
on public.tickets for select to anon, authenticated
using (true);

-- Solo usuarios autenticados pueden cambiar datos.
drop policy if exists "Authenticated admins can update tickets" on public.tickets;
create policy "Authenticated admins can update tickets"
on public.tickets for update to authenticated
using (true) with check (true);

-- No se permite insertar ni borrar números desde el cliente.
revoke insert, delete on public.tickets from anon, authenticated;
grant select (number,status,updated_at) on public.tickets to anon;
grant select, update on public.tickets to authenticated;

-- La información de contacto solo puede leerla un usuario autenticado.
revoke select (participant_name,participant_phone) on public.tickets from anon;
grant select (participant_name,participant_phone) on public.tickets to authenticated;

create table if not exists public.ticket_qr_issuance (
  ticket_number smallint primary key references public.tickets(number) on delete cascade,
  token_hash text not null,
  issued_at timestamptz not null default now()
);
alter table public.ticket_qr_issuance enable row level security;
revoke all on public.ticket_qr_issuance from anon, authenticated;
