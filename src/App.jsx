import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { QRCodeCanvas } from 'qrcode.react';
import { Scissors, ShieldCheck, LockKeyhole, LogOut, Search, RefreshCw, Ticket, Gift, CheckCircle2, Clock3, Circle, ExternalLink } from 'lucide-react';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && anon ? createClient(url, anon) : null;
const statuses = {
  available: { label: 'Disponible', cls: 'available' },
  pending: { label: 'En espera', cls: 'pending' },
  assigned: { label: 'Participante confirmado', cls: 'assigned' }
};
const fmt = n => String(n).padStart(2, '0');

export default function App() {
  const [tickets,setTickets] = useState([]);
  const [session,setSession] = useState(null);
  const [loading,setLoading] = useState(true);
  const [message,setMessage] = useState('');
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('all');
  const [selected,setSelected] = useState(null);
  const [form,setForm] = useState({name:'',phone:'',status:'assigned'});
  const [busy,setBusy] = useState(false);
  const [login,setLogin] = useState({email:'',password:''});
  const [qr,setQr] = useState('');
  const [verification,setVerification] = useState(null);

  const configured = Boolean(supabase);
  const params = new URLSearchParams(window.location.search);
  const verifyToken = params.get('verify');

  async function load() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const columns = session ? 'number,status,participant_name,participant_phone,updated_at' : 'number,status,updated_at';
    const {data,error} = await supabase.from('tickets').select(columns).order('number');
    if (error) setMessage(error.message); else setTickets(data || []);
    setLoading(false);
  }
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s)=>setSession(s));
    load();
    return ()=>subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) load(); }, [session]);
  useEffect(() => {
    if (!verifyToken || !supabase) return;
    supabase.functions.invoke('verify-ticket',{body:{token:verifyToken}})
      .then(({data,error})=>setVerification(error ? {valid:false,message:error.message} : data))
      .catch(()=>setVerification({valid:false,message:'No fue posible verificar el código.'}));
  }, [verifyToken]);

  const counts = useMemo(()=>tickets.reduce((a,t)=>(a[t.status]=(a[t.status]||0)+1,a),{available:0,pending:0,assigned:0}),[tickets]);
  const visible = useMemo(()=>tickets.filter(t=>{
    const match = fmt(t.number).includes(query.trim()) || (t.participant_name||'').toLowerCase().includes(query.toLowerCase());
    return match && (filter==='all'||t.status===filter);
  }),[tickets,query,filter]);

  async function signIn(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    const {error} = await supabase.auth.signInWithPassword(login);
    setBusy(false); setMessage(error ? error.message : 'Sesión iniciada.');
  }
  async function signOut() { await supabase.auth.signOut(); setSession(null); setSelected(null); }
  function openTicket(t) {
    setSelected(t);
    setForm({name:t.participant_name||'',phone:t.participant_phone||'',status:t.status});
    setQr('');
  }
  async function saveTicket(e) {
    e.preventDefault(); if (!selected) return;
    setBusy(true); setMessage('');
    const {error} = await supabase.from('tickets').update({
      status:form.status,
      participant_name:form.status==='assigned' ? form.name.trim() : null,
      participant_phone:form.status==='assigned' ? form.phone.trim() : null,
      updated_at:new Date().toISOString()
    }).eq('number',selected.number);
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMessage(`Número ${fmt(selected.number)} actualizado.`); setSelected(null); await load(); }
  }
  async function createQr() {
    if (!selected) return;
    setBusy(true); setMessage('');
    const {data,error} = await supabase.functions.invoke('issue-ticket-qr',{body:{number:selected.number}});
    setBusy(false);
    if (error) setMessage(error.message);
    else setQr(data.url);
  }
  if (verifyToken) return <main className="verify-page"><section className="verify-card"><div className="brand-mark"><Scissors/></div><p className="eyebrow">SKY STUDIO BARBERÍA</p><h1>Verificación de boleta</h1>{!verification ? <p>Comprobando autenticidad...</p> : <><div className={`verify-icon ${verification.valid?'ok':'bad'}`}>{verification.valid?<ShieldCheck/>:<LockKeyhole/>}</div><h2>{verification.valid?'Código auténtico':'Código no válido'}</h2><p>{verification.message}</p>{verification.number!==undefined&&<strong className="big-number">#{fmt(verification.number)}</strong>}</>}<a href={window.location.origin}>Volver a la promoción</a></section></main>;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-icon"><Scissors/></span><span>SKY STUDIO <b>BARBERÍA</b></span></a><div className="top-actions">{session ? <><span className="admin-pill"><ShieldCheck size={15}/> Administrador</span><button className="icon-btn" onClick={signOut} title="Cerrar sesión"><LogOut size={17}/></button></> : <a className="admin-link" href="#admin"><LockKeyhole size={15}/> Acceso administrador</a>}</div></header>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">EXPERIENCIA EXCLUSIVA · PROMOCIÓN GRATUITA</p><h1>Tu estilo.<br/><em>Tu momento.</em></h1><p className="hero-text">Una actividad especial para nuestra comunidad de clientes. Participa por experiencias de barbería diseñadas para ti.</p><div className="hero-tags"><span><ShieldCheck size={15}/> Sin costo de participación</span><span><Ticket size={15}/> 100 números · 00–99</span></div></div>
      <div className="hero-art"><div className="ring"></div><div className="hero-card"><Scissors size={42}/><span>SKY STUDIO</span><small>BARBERÍA · EST. STYLE</small><div className="card-line"></div><b>EXCLUSIVE<br/>CLIENT CLUB</b></div><div className="hero-stamp">SS<br/><small>BARBER</small></div></div>
    </section>
    <main className="content">
      <div className="section-heading"><div><p className="eyebrow">BENEFICIOS</p><h2>Experiencias para ganar</h2></div><span className="free-note"><Gift size={16}/> Participación gratuita</span></div>
      <div className="prize-grid">
        <article className="prize-card featured"><span className="prize-index">01 / EXPERIENCIA</span><div className="prize-icon"><Scissors/></div><h3>Servicio Premium</h3><p>Un servicio premium en Sky Studio Barbería.</p></article>
        <article className="prize-card"><span className="prize-index">02 / EXPERIENCIA</span><div className="prize-icon"><Gift/></div><h3>Servicio VIP</h3><p>Una experiencia VIP para renovar tu estilo.</p></article>
      </div>
      <div className="section-heading number-heading"><div><p className="eyebrow">SELECCIÓN DE NÚMEROS</p><h2>Elige tu número</h2><p className="subtext">Consulta la disponibilidad de los números del 00 al 99.</p></div><button className="refresh-btn" onClick={load}><RefreshCw size={15}/> Actualizar</button></div>
      {!configured && <div className="notice"><b>Configuración pendiente:</b> conecta el proyecto con Supabase siguiendo el archivo README. La cuadrícula se cargará cuando esté configurada.</div>}
      <div className="legend"><span><i className="dot available"></i> Disponible</span><span><i className="dot pending"></i> En espera</span><span><i className="dot assigned"></i> Participante confirmado</span></div>
      <div className="stats"><div><b>{counts.available??100}</b><span>Disponibles</span></div><div><b>{counts.pending??0}</b><span>En espera</span></div><div><b>{counts.assigned??0}</b><span>Confirmados</span></div></div>
      <div className="number-tools"><label className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar número o participante"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos los estados</option><option value="available">Disponible</option><option value="pending">En espera</option><option value="assigned">Confirmado</option></select></div>
      <div className="number-grid">{Array.from({length:100},(_,i)=>{const t=tickets.find(x=>x.number===i);const status=t?.status||'available';return <button key={i} className={`number-tile ${statuses[status].cls}`} onClick={()=>session&&t&&openTicket(t)} title={session?'Administrar número '+fmt(i):statuses[status].label}><b>{fmt(i)}</b><small>{statuses[status].label}</small></button>})}</div>
      <p className="grid-hint">{session?'Selecciona un número para administrar su estado y participante.':'Los datos personales de los participantes no se muestran públicamente.'}</p>
      {session && <section className="admin-panel" id="admin"><div className="section-heading"><div><p className="eyebrow">CONTROL PRIVADO</p><h2>Administración</h2></div><span className="admin-pill"><ShieldCheck size={15}/> Sesión protegida</span></div><p>Elige cualquier número para asignarlo, ponerlo en espera o devolverlo a disponible. Solo un administrador autenticado puede realizar cambios.</p></section>}
      {!session && <section className="admin-login" id="admin"><div className="login-copy"><p className="eyebrow">ACCESO RESTRINGIDO</p><h2>Panel de administración</h2><p>Ingresa con la cuenta de administrador creada en Supabase. Este acceso no tiene registro público.</p></div><form onSubmit={signIn}><label>Correo electrónico<input type="email" required value={login.email} onChange={e=>setLogin({...login,email:e.target.value})} placeholder="admin@tubarberia.com"/></label><label>Contraseña<input type="password" required value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} placeholder="••••••••"/></label><button className="primary-btn" disabled={!configured||busy}>{busy?'Ingresando...':'Ingresar al panel'}</button></form></section>}
      {message && <p className="message">{message}</p>}
    </main>
    <footer><a className="brand" href="#"><span className="brand-icon"><Scissors/></span><span>SKY STUDIO <b>BARBERÍA</b></span></a><p>Estilo que habla por ti. · Actividad promocional gratuita.</p><small>La participación no requiere pago ni compra. Fechas, condiciones y método de selección deben publicarse antes de iniciar la actividad.</small></footer>
    {selected && <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><section className="modal"><button className="modal-close" onClick={()=>setSelected(null)}>×</button><p className="eyebrow">GESTIÓN DE PARTICIPACIÓN</p><h2>Número {fmt(selected.number)}</h2><form onSubmit={saveTicket}><label>Estado<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="available">Disponible</option><option value="pending">En espera</option><option value="assigned">Participante confirmado</option></select></label>{form.status==='assigned'&&<><label>Nombre del participante<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Teléfono<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></>}<button className="primary-btn" disabled={busy}>{busy?'Guardando...':'Guardar cambios'}</button></form>{selected.status==='assigned'&&<button className="secondary-btn" onClick={createQr} disabled={busy}><ShieldCheck size={16}/> Generar QR verificable</button>}{qr&&<div className="qr-output"><QRCodeCanvas value={qr} size={180}/><p>QR firmado · Verificación en línea</p><a href={qr} target="_blank" rel="noreferrer">Abrir verificación <ExternalLink size={13}/></a></div>}</section></div>}
    <div className="toast-space">{loading&&<span><RefreshCw size={13}/> Cargando números…</span>}</div>
  </div>;
}