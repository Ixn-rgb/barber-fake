-- Ejecuta este archivo en Supabase SQL Editor DESPUÉS de revisar que las tablas
-- services, barbers, appointments y barber_settings ya existen.
-- La función espera: working_days como arreglo con números 0-6 (domingo=0)
-- o nombres de días en inglés/español. Los demás campos siguen el esquema inicial.

update public.services
set price = case
  when lower(name) like '%barba%' then 80
  when lower(name) like '%corte%' then 70
  else price end,
  duration_minutes = case
  when lower(name) like '%barba%' then 60
  when lower(name) like '%corte%' then 45
  else duration_minutes end
where lower(name) like '%corte%';

-- Evita que el navegador inserte directamente citas con precios o duraciones manipulados.
revoke insert on table public.appointments from anon, authenticated;

create or replace function public.get_available_slots(
  p_service_id uuid, p_barber_id uuid, p_date date
)
returns table(slot time)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services%rowtype;
  v_barber public.barbers%rowtype;
  v_settings public.barber_settings%rowtype;
  v_day int;
  v_day_name text;
  v_cursor timestamp;
  v_end timestamp;
  v_duration int;
  v_interval int;
  v_days jsonb;
begin
  select * into v_service from public.services where id=p_service_id and active=true;
  if not found then return; end if;
  select * into v_barber from public.barbers where id=p_barber_id and active=true;
  if not found then return; end if;
  select * into v_settings from public.barber_settings limit 1;
  if not found then return; end if;

  v_day := extract(dow from p_date)::int;
  v_day_name := case v_day
    when 0 then 'domingo' when 1 then 'lunes' when 2 then 'martes'
    when 3 then 'miércoles' when 4 then 'jueves' when 5 then 'viernes'
    else 'sábado' end;
  v_days := to_jsonb(v_settings)->'working_days';
  if v_days is null or not exists (
    select 1 from jsonb_array_elements_text(v_days) d(value)
    where lower(d.value) in (v_day::text, lower(v_day_name),
      case v_day when 0 then 'sunday' when 1 then 'monday' when 2 then 'tuesday'
      when 3 then 'wednesday' when 4 then 'thursday' when 5 then 'friday' else 'saturday' end)
  ) then return; end if;

  v_duration := v_service.duration_minutes;
  v_interval := greatest(coalesce(v_settings.interval_minutes,15),5);
  v_cursor := p_date + v_settings.opening_time;
  v_end := p_date + v_settings.closing_time;

  while v_cursor + make_interval(mins => v_duration) <= v_end loop
    if not exists (
      select 1 from public.appointments a
      where a.barber_id=p_barber_id
        and a.appointment_date=p_date
        and coalesce(a.status,'confirmed') <> 'cancelled'
        and (p_date + a.appointment_time) < v_cursor + make_interval(mins => v_duration)
        and (p_date + a.appointment_time + make_interval(mins => coalesce(a.duration_minutes,0))) > v_cursor
    ) then
      slot := v_cursor::time;
      return next;
    end if;
    v_cursor := v_cursor + make_interval(mins => v_interval);
  end loop;
end;
$$;

create or replace function public.create_booking(
  p_customer_name text,
  p_phone text,
  p_service_id uuid,
  p_barber_id uuid,
  p_date date,
  p_time time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services%rowtype;
  v_id uuid;
begin
  if length(trim(coalesce(p_customer_name,''))) < 2 or length(trim(coalesce(p_phone,''))) < 7 then
    raise exception 'Escribe un nombre y teléfono válidos.';
  end if;
  if p_date < current_date then raise exception 'No puedes reservar una fecha pasada.'; end if;

  -- Serializa reservas del mismo barbero y día para evitar dobles reservas simultáneas.
  perform pg_advisory_xact_lock(hashtext(p_barber_id::text || p_date::text));
  select * into v_service from public.services where id=p_service_id and active=true;
  if not found then raise exception 'El servicio ya no está disponible.'; end if;

  if not exists (
    select 1 from public.get_available_slots(p_service_id,p_barber_id,p_date) s
    where s.slot = p_time
  ) then raise exception 'Ese horario ya no está disponible. Elige otro.'; end if;

  insert into public.appointments
    (customer_name,phone,service_id,barber_id,appointment_date,appointment_time,price,duration_minutes,status)
  values
    (trim(p_customer_name),trim(p_phone),p_service_id,p_barber_id,p_date,p_time,
     v_service.price,v_service.duration_minutes,'confirmed')
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.get_available_slots(uuid,uuid,date) to anon, authenticated;
grant execute on function public.create_booking(text,text,uuid,uuid,date,time) to anon, authenticated;

-- Permite al administrador cambiar el estado de las citas, respetando la función is_barber_admin existente.
drop policy if exists "Admins can update appointments" on public.appointments;
create policy "Admins can update appointments"
on public.appointments for update to authenticated
using (public.is_barber_admin())
with check (public.is_barber_admin());
