import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Scissors, CalendarDays, Clock3, Shield, LogOut, RefreshCw, CheckCircle2, XCircle, Settings, Menu } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const WEEK = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const money = n => `$${Number(n).toFixed(0)} MXN`;
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,10);

function ConfigNotice() {
  return <main className="setup"><div className="brand-mark"><Scissors size={30}/></div><p className="eyebrow">CONFIGURACIÓN INICIAL</p><h1>BARBER <span>FAKE</span></h1><p>Agrega las credenciales públicas de tu proyecto Supabase para conectar la página.</p><pre>VITE_SUPABASE_URL=...{"\n"}VITE_SUPABASE_ANON_KEY=...</pre><small>Usa únicamente la clave publishable. Nunca pongas aquí una clave secret o service_role.</small></main>;
}

export default function App() {
  const [view,setView] = useState("home");
  const [services,setServices] = useState([]);
  const [barbers,setBarbers] = useState([]);
  const [settings,setSettings] = useState(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");
  const [serviceId,setServiceId] = useState("");
  const [barberId,setBarberId] = useState("");
  const [date,setDate] = useState(today());
  const [slots,setSlots] = useState([]);
  const [slot,setSlot] = useState("");
  const [customer,setCustomer] = useState("");
  const [phone,setPhone] = useState("");
  const [session,setSession] = useState(null);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [appointments,setAppointments] = useState([]);
  const [adminSettings,setAdminSettings] = useState(null);
  const [busy,setBusy] = useState(false);

  const selectedService = services.find(s => s.id === serviceId);
  const enabledDay = useMemo(() => {
    if (!settings || !date) return false;
    const day = new Date(`${date}T12:00:00`).getDay();
    const days = settings.working_days || [];
    return days.some(d => String(d).toLowerCase() === String(day) || String(d).toLowerCase() === WEEK[day].toLowerCase());
  }, [settings,date]);

  async function loadBase() {
    if (!supabase) return;
    setLoading(true); setError("");
    const [s,b,st,auth] = await Promise.all([
      supabase.from("services").select("*").eq("active",true).order("price"),
      supabase.from("barbers").select("*").eq("active",true).order("name"),
      supabase.from("barber_settings").select("*").limit(1).maybeSingle(),
      supabase.auth.getSession()
    ]);
    if (s.error || b.error || st.error) setError((s.error || b.error || st.error).message);
    setServices(s.data || []); setBarbers(b.data || []); setSettings(st.data || null);
    setSession(auth.data.session);
    setLoading(false);
  }
  useEffect(() => { loadBase(); if (!supabase) return; const {data:{subscription}} = supabase.auth.onAuthStateChange((_e,s) => setSession(s)); return () => subscription.unsubscribe(); }, []);

  useEffect(() => {
    if (!supabase || !serviceId || !barberId || !date || !enabledDay) { setSlots([]); setSlot(""); return; }
    let alive = true;
    supabase.rpc("get_available_slots",{p_service_id:serviceId,p_barber_id:barberId,p_date:date})
      .then(({data,error}) => { if (!alive) return; if (error) setError(error.message); else { setSlots((data||[]).map(x => x.slot)); setSlot(""); }});
    return () => { alive = false; };
  }, [serviceId,barberId,date,enabledDay]);

  async function book(e) {
    e.preventDefault(); setError(""); setSuccess("");
    if (!customer.trim() || !phone.trim() || !slot) return setError("Completa tus datos y selecciona una hora.");
    setBusy(true);
    const {error} = await supabase.rpc("create_booking",{
      p_customer_name:customer.trim(),p_phone:phone.trim(),p_service_id:serviceId,
      p_barber_id:barberId,p_date:date,p_time:slot
    });
    setBusy(false);
    if (error) setError(error.message);
    else { setSuccess("¡Tu cita quedó reservada!"); setCustomer(""); setPhone(""); setSlot(""); 
      const {data} = await supabase.rpc("get_available_slots",{p_service_id:serviceId,p_barber_id:barberId,p_date:date});
      setSlots((data||[]).map(x=>x.slot));
    }
  }

  async function login(e) {
    e.preventDefault(); setBusy(true); setError("");
    const {error} = await supabase.auth.signInWithPassword({email,password});
    setBusy(false); if (error) setError("No se pudo iniciar sesión. Revisa tu correo y contraseña.");
    else { setPassword(""); setView("admin"); }
  }
  async function logout() { await supabase.auth.signOut(); setView("home"); }
  async function loadAdmin() {
    if (!session) return;
    setBusy(true); setError("");
    const [a,st] = await Promise.all([
      supabase.from("appointments").select("id,customer_name,phone,appointment_date,appointment_time,status,price,duration_minutes,services(name),barbers(name)").order("appointment_date",{ascending:true}).order("appointment_time",{ascending:true}),
      supabase.from("barber_settings").select("*").limit(1).maybeSingle()
    ]);
    if (a.error || st.error) setError((a.error || st.error).message);
    setAppointments(a.data || []); setAdminSettings(st.data || null); setBusy(false);
  }
  useEffect(() => { if (view === "admin" && session) loadAdmin(); }, [view,session]);

  async function saveSettings(e) {
    e.preventDefault(); if (!adminSettings) return;
    setBusy(true); setError(""); setSuccess("");
    const {error} = await supabase.from("barber_settings").update({
      opening_time:adminSettings.opening_time, closing_time:adminSettings.closing_time,
      interval_minutes:Number(adminSettings.interval_minutes), working_days:adminSettings.working_days
    }).eq("id",adminSettings.id);
    setBusy(false);
    if (error) setError(error.message); else { setSuccess("Horarios actualizados."); await loadBase(); }
  }
  async function changeStatus(id,status) {
    setBusy(true); const {error} = await supabase.from("appointments").update({status}).eq("id",id);
    setBusy(false); if (error) setError(error.message); else loadAdmin();
  }
  if (!supabase) return <ConfigNotice />;

  return <div className="app-shell">
    <header className="topbar">
      <button className="logo" onClick={()=>setView("home")}><Scissors size={21}/><span>BARBER <b>FAKE</b></span></button>
      <nav><button className={view==="home"?"active":""} onClick={()=>setView("home")}>Inicio</button><button className={view==="booking"?"active":""} onClick={()=>setView("booking")}>Reservar</button><button className={view==="admin"||view==="login"?"active":""} onClick={()=>setView(session?"admin":"login")}><Shield size={15}/> Admin</button></nav>
    </header>

    {view==="home" && <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">BARBERÍA · ESTILO · ACTITUD</p><h1>Bienvenid@ a<br/><span>BARBER FAKE</span></h1><p className="hero-sub">Tu estilo, tu personalidad. Reserva tu espacio y disfruta el servicio.</p><button className="gold-btn" onClick={()=>setView("booking")}>RESERVAR CITA <CalendarDays size={17}/></button></div><div className="hero-art"><div className="ring"><Scissors size={88} strokeWidth={1}/></div><span className="art-caption">EST. BARBER FAKE</span></div></section>
      <section className="section"><div className="section-heading"><p className="eyebrow">SERVICIOS</p><h2>Elige tu <span>estilo</span></h2></div><div className="service-grid">{services.map(s=><article className="service-card" key={s.id}><Scissors/><h3>{s.name}</h3><p>{s.duration_minutes===45?"45 minutos":s.duration_minutes===60?"1 hora":`${s.duration_minutes} minutos`}</p><strong>{money(s.price)}</strong></article>)}</div></section>
      <section className="booking-banner"><div><p className="eyebrow">TU PRÓXIMO CORTE COMIENZA AQUÍ</p><h2>Agenda en unos <span>minutos</span></h2></div><button className="gold-btn" onClick={()=>setView("booking")}>AGENDAR AHORA</button></section>
    </main>}

    {view==="booking" && <main className="content-page"><div className="page-title"><p className="eyebrow">RESERVACIONES</p><h1>Reserva tu <span>cita</span></h1><p>Selecciona el servicio, día y horario disponible.</p></div>
      <form className="panel booking-form" onSubmit={book}>
        <label>1. Servicio<select required value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">Selecciona un servicio</option>{services.map(s=><option key={s.id} value={s.id}>{s.name} · {money(s.price)} · {s.duration_minutes} min</option>)}</select></label>
        <label>2. Barbero<select required value={barberId} onChange={e=>setBarberId(e.target.value)}><option value="">Selecciona un barbero</option>{barbers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label>3. Fecha<input type="date" min={today()} value={date} onChange={e=>setDate(e.target.value)} required/></label>
        <div className="slot-area"><div className="label-line"><label>4. Horarios disponibles</label><span>{enabledDay?"Selecciona una hora":"Día no habilitado"}</span></div>
          {!serviceId||!barberId?<p className="muted">Primero selecciona servicio y barbero.</p>:!enabledDay?<p className="muted">La barbería no tiene habilitado este día.</p>:slots.length===0?<p className="muted">No hay horarios disponibles para esta fecha.</p>:<div className="slots">{slots.map(t=><button type="button" key={t} className={slot===t?"slot selected":"slot"} onClick={()=>setSlot(t)}>{String(t).slice(0,5)}</button>)}</div>}
        </div>
        <div className="form-divider"/>
        <label>Tu nombre<input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Nombre completo" maxLength="100" required/></label>
        <label>Teléfono<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Tu número de contacto" inputMode="tel" maxLength="20" required/></label>
        {selectedService&&<div className="summary"><span>Total de tu servicio</span><b>{money(selectedService.price)}</b></div>}
        {error&&<p className="alert error">{error}</p>}{success&&<p className="alert success"><CheckCircle2 size={17}/>{success}</p>}
        <button className="gold-btn full" disabled={busy||!slot}>{busy?"PROCESANDO...":"CONFIRMAR CITA"}</button>
        <small className="privacy">Tus datos se usan únicamente para gestionar tu reservación.</small>
      </form>
    </main>}

    {view==="login" && <main className="content-page narrow"><div className="page-title"><p className="eyebrow">ACCESO PRIVADO</p><h1>Panel de <span>administración</span></h1></div><form className="panel" onSubmit={login}><label>Correo electrónico<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<p className="alert error">{error}</p>}<button className="gold-btn full" disabled={busy}>INICIAR SESIÓN</button><small className="privacy">Acceso exclusivo para el administrador.</small></form></main>}

    {view==="admin" && <main className="content-page"><div className="admin-head"><div className="page-title"><p className="eyebrow">CONTROL DEL NEGOCIO</p><h1>Panel <span>admin</span></h1></div><button className="outline-btn" onClick={logout}><LogOut size={16}/> Salir</button></div>
      {!session?<div className="panel"><p>Inicia sesión para administrar BARBER FAKE.</p><button className="gold-btn" onClick={()=>setView("login")}>INICIAR SESIÓN</button></div>:<>
      <div className="admin-tabs"><button className="active"><CalendarDays size={16}/> Citas</button><button onClick={()=>document.getElementById("schedule")?.scrollIntoView({behavior:"smooth"})}><Settings size={16}/> Horarios</button><button onClick={loadAdmin}><RefreshCw size={16}/> Actualizar</button></div>
      <section className="panel"><div className="panel-title"><h2>Citas reservadas</h2><span className="count">{appointments.filter(a=>a.status!=="cancelled").length}</span></div>{appointments.length===0?<p className="muted">Todavía no hay citas.</p>:<div className="appointments">{appointments.map(a=><article className="appointment" key={a.id}><div className="appt-date"><b>{new Date(`${a.appointment_date}T12:00:00`).toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}</b><span>{String(a.appointment_time).slice(0,5)}</span></div><div className="appt-info"><b>{a.customer_name}</b><span>{a.services?.name||"Servicio"} · {a.barbers?.name||"Barbero"}</span><small>{a.phone} · {money(a.price)}</small><em className={a.status==="cancelled"?"cancelled":""}>{a.status==="cancelled"?"Cancelada":"Confirmada"}</em></div>{a.status!=="cancelled"&&<button className="icon-btn" title="Cancelar cita" onClick={()=>changeStatus(a.id,"cancelled")}><XCircle size={19}/></button>}</article>)}</div>}</section>
      <section className="panel" id="schedule"><div className="panel-title"><h2>Configurar horarios</h2></div>{adminSettings?<form onSubmit={saveSettings} className="schedule-form"><div className="time-grid"><label>Apertura<input type="time" value={adminSettings.opening_time?.slice(0,5)||"09:00"} onChange={e=>setAdminSettings({...adminSettings,opening_time:e.target.value})}/></label><label>Cierre<input type="time" value={adminSettings.closing_time?.slice(0,5)||"18:00"} onChange={e=>setAdminSettings({...adminSettings,closing_time:e.target.value})}/></label><label>Intervalo entre horarios (minutos)<input type="number" min="5" max="240" value={adminSettings.interval_minutes} onChange={e=>setAdminSettings({...adminSettings,interval_minutes:e.target.value})}/></label></div><label>Días de atención</label><div className="days">{WEEK.map((d,i)=><label className="day-check" key={d}><input type="checkbox" checked={(adminSettings.working_days||[]).some(x=>String(x)===String(i)||String(x).toLowerCase()===d.toLowerCase())} onChange={e=>{const old=adminSettings.working_days||[]; const next=e.target.checked?[...old,i]:old.filter(x=>String(x)!==String(i)&&String(x).toLowerCase()!==d.toLowerCase());setAdminSettings({...adminSettings,working_days:next});}}/><span>{d.slice(0,3)}</span></label>)}</div>{error&&<p className="alert error">{error}</p>}{success&&<p className="alert success">{success}</p>}<button className="gold-btn" disabled={busy}>GUARDAR HORARIOS</button></form>:<p className="muted">No se encontró la configuración de horarios.</p>}</section>
      </>}
    </main>}
    <footer><span>BARBER <b>FAKE</b></span><small>Tu estilo, tu personalidad.</small></footer>
  </div>;
}
