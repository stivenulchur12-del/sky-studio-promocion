
import React, { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Scissors, Crown, Banknote, ShieldCheck, Search,
  LockKeyhole, Sparkles, X, Menu
} from "lucide-react";
import { supabase } from "./supabase";

const BREB_KEY = "1084866569";
const TICKET_PRICE = 20000;

const money = value =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);

function formatTicket(ticket) {
  return {
    number: String(ticket.number).padStart(2, "0"),
    status:
      ticket.status === "reserved" ? "pending" :
      ticket.status === "paid" ? "active" :
      "available",
    customer: "",
    phone: ""
  };
}

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState(false);
  const [transferReported, setTransferReported] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estados del administrador
  const [session, setSession] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminVerified, setAdminVerified] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminReservations, setAdminReservations] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  async function loadTickets() {
    const { data, error } = await supabase
      .from("tickets")
      .select("number, status")
      .order("number", { ascending: true });

    if (error) {
      setNotice("No se pudieron cargar las boletas: " + error.message);
      setLoading(false);
      return;
    }

    setTickets((data || []).map(formatTicket));
    setLoading(false);
  }

  // Comprobar sesión y escuchar cambios de autenticación
  useEffect(() => {
    loadTickets();

    supabase.auth.getSession().then(({ data, error }) => {
      if (!error) {
        setSession(data.session);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);

        if (!newSession) {
          setAdminVerified(false);
          setAdminReservations([]);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const counts = useMemo(() => ({
    available: tickets.filter(t => t.status === "available").length,
    pending: tickets.filter(t => t.status === "pending").length,
    active: tickets.filter(t => t.status === "active").length,
    inactive: 0
  }), [tickets]);

  const visible = tickets.filter(t => {
    const matchesSearch = t.number.includes(search.trim());
    const matchesFilter = filter === "all" || t.status === filter;
    return matchesSearch && matchesFilter;
  });

  // Reservar boleta y recibir el token privado
  async function requestTicket() {
    if (!customer.name.trim() || !customer.phone.trim()) {
      setNotice("Completa tu nombre y celular para solicitar la boleta.");
      return;
    }

    if (!/^[0-9]{10}$/.test(customer.phone.trim())) {
      setNotice("Escribe un celular válido de 10 dígitos.");
      return;
    }

    if (!selected) return;

    setSaving(true);

    const { data, error } = await supabase.rpc("reserve_ticket", {
      p_ticket_number: Number(selected.number),
      p_customer_name: customer.name.trim(),
      p_customer_phone: customer.phone.trim()
    });

    setSaving(false);

    if (error) {
      setNotice(
        error.message.includes("ya no está disponible")
          ? "Esta boleta ya fue reservada. Escoge otra."
          : "No se pudo reservar: " + error.message
      );

      await loadTickets();
      setSelected(null);
      return;
    }

    const reservation = Array.isArray(data) ? data[0] : data;

    if (
      !reservation?.reservation_id ||
      !reservation?.reservation_token
    ) {
      setNotice(
        "La reserva no devolvió el token de seguridad. No continúes con el pago. Contacta al administrador."
      );
      await loadTickets();
      setSelected(null);
      return;
    }

    setSelected({
      ...selected,
      reservationId: reservation.reservation_id,
      reservationToken: reservation.reservation_token
    });

    setPaymentStep(true);
    setTransferReported(false);
    setNotice(`Boleta ${selected.number} reservada por 15 minutos.`);
    await loadTickets();
  }

  async function copyBreBKey() {
    try {
      await navigator.clipboard.writeText(BREB_KEY);
      setNotice("Llave Bre-B copiada correctamente.");
    } catch {
      setNotice("No se pudo copiar. Escribe la llave manualmente.");
    }
  }

  // Reportar transferencia usando el token privado
  async function reportTransfer() {
    if (
      !selected?.reservationId ||
      !selected?.reservationToken
    ) {
      setNotice(
        "No encontramos el código privado de esta reserva. No es posible reportar el pago."
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc("report_transfer", {
      p_reservation_id: selected.reservationId,
      p_token: selected.reservationToken
    });

    setSaving(false);

    if (error) {
      setNotice("No se pudo reportar: " + error.message);
      await loadTickets();
      return;
    }

    setTransferReported(true);
    setNotice("Transferencia reportada. Pago pendiente de verificación.");
  }

  function closePayment() {
    setSelected(null);
    setPaymentStep(false);
    setTransferReported(false);
    setCustomer({ name: "", phone: "" });
  }

  // Iniciar sesión de administrador
  async function adminLogin() {
    if (!adminEmail.trim() || !adminPassword) {
      setNotice("Escribe tu correo y contraseña.");
      return;
    }

    setAdminLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail.trim(),
      password: adminPassword
    });

    setAdminLoading(false);

    if (error) {
      setNotice("No se pudo iniciar sesión: " + error.message);
      return;
    }

    setSession(data.session);
    setAdminPassword("");

    await loadAdminReservations(data.session);
  }

  // Comprobar que el usuario realmente sea administrador
  async function loadAdminReservations(currentSession = session) {
    if (!currentSession?.user?.id) return;

    setAdminLoading(true);
    setAdminVerified(false);

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", currentSession.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      setAdminVerified(false);
      setAdminLoading(false);
      setNotice("Esta cuenta no está autorizada como administradora.");
      return;
    }

    const { data, error } = await supabase
      .from("reservations")
      .select(`
        id,
        ticket_id,
        customer_name,
        customer_phone,
        status,
        expires_at,
        created_at,
        tickets(number)
      `)
      .order("created_at", { ascending: false });

    setAdminLoading(false);

    if (error) {
      setNotice("Error al cargar reservas: " + error.message);
      return;
    }

    setAdminVerified(true);
    setAdminReservations(data || []);
  }

  // Confirmar o rechazar un pago
  async function managePayment(reservationId, action) {
    if (!adminVerified) {
      setNotice("No tienes autorización para realizar esta acción.");
      return;
    }

    const functionName =
      action === "confirm" ? "confirm_payment" : "reject_payment";

    setAdminLoading(true);

    const { error } = await supabase.rpc(functionName, {
      p_reservation_id: reservationId
    });

    setAdminLoading(false);

    if (error) {
      setNotice("No se pudo actualizar el pago: " + error.message);
      return;
    }

    setNotice(
      action === "confirm"
        ? "Pago confirmado correctamente."
        : "Pago rechazado y boleta liberada."
    );

    await loadAdminReservations();
    await loadTickets();
  }

  async function adminLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setNotice("No se pudo cerrar sesión: " + error.message);
      return;
    }

    setSession(null);
    setAdminVerified(false);
    setAdminReservations([]);
    setAdminOpen(false);
    setNotice("Sesión de administrador cerrada.");
  }

  return (
    <div className="app-shell">
      <div className="demo-strip">
        <span className="pulse" />
        CONECTADO A SUPABASE · PAGOS PENDIENTES DE VERIFICACIÓN
      </div>

      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark"><Scissors size={21}/></span>
          <span>SKY <b>STUDIO</b><small>BARBERÍA · SORTEO ESPECIAL</small></span>
        </a>

        <nav className={menuOpen ? "nav open" : "nav"}>
          <a href="#premios" onClick={() => setMenuOpen(false)}>Premios</a>
          <a href="#boletas" onClick={() => setMenuOpen(false)}>Boletas</a>
          <button
            className="nav-admin"
            onClick={() => {
              setAdminOpen(true);
              setMenuOpen(false);

              if (session) {
                loadAdminReservations(session);
              }
            }}
          >
            <LockKeyhole size={15}/> Administración
          </button>
        </nav>

        <button className="mobile-menu" onClick={() => setMenuOpen(v => !v)}>
          <Menu/>
        </button>
      </header>

      <main>
        {/* INICIO DE SESIÓN */}
        {adminOpen && !session && (
          <section className="section-wrap" style={{paddingTop:40}}>
            <div
              className="modal"
              style={{position:"relative", margin:"0 auto", maxWidth:430}}
            >
              <button
                className="close"
                onClick={() => setAdminOpen(false)}
              >
                <X/>
              </button>

              <span className="eyebrow">ACCESO PRIVADO</span>
              <h2>ADMINISTRACIÓN <em>SKY</em></h2>
              <p>Ingresa con tu cuenta de administrador.</p>

              <label>
                Correo electrónico
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="Tu correo de administrador"
                />
              </label>

              <label>
                Contraseña
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Tu contraseña"
                />
              </label>

              <button
                className="primary-btn full"
                onClick={adminLogin}
                disabled={adminLoading}
              >
                {adminLoading ? "Ingresando..." : "Iniciar sesión"}
              </button>
            </div>
          </section>
        )}

        {/* PANEL PRIVADO */}
        {adminOpen && session && (
          <section className="section-wrap" style={{paddingTop:40}}>
            {!adminVerified ? (
              <div style={{textAlign:"center", padding:30}}>
                <p className="fine-print">
                  {adminLoading
                    ? "Verificando permisos de administrador..."
                    : "No se ha podido verificar el acceso de administrador."}
                </p>

                <button
                  className="secondary-btn"
                  onClick={() => loadAdminReservations(session)}
                  disabled={adminLoading}
                >
                  Volver a verificar
                </button>

                <button
                  className="secondary-btn"
                  style={{marginLeft:10}}
                  onClick={adminLogout}
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">PANEL PRIVADO</span>
                    <h2>GESTIÓN <em>DE PAGOS</em></h2>
                    <p>{session.user.email}</p>
                  </div>

                  <button className="secondary-btn" onClick={adminLogout}>
                    Cerrar sesión
                  </button>
                </div>

                <button
                  className="secondary-btn"
                  onClick={() => loadAdminReservations()}
                  disabled={adminLoading}
                >
                  {adminLoading ? "Actualizando..." : "Actualizar reservas"}
                </button>

                <div style={{marginTop:20}}>
                  <p className="fine-print">
                    Total de reservas: {adminReservations.length}
                  </p>

                  {adminReservations.length === 0 ? (
                    <p className="fine-print">
                      Todavía no hay reservas registradas.
                    </p>
                  ) : (
                    <div style={{overflowX:"auto"}}>
                      <table style={{
                        width:"100%",
                        borderCollapse:"collapse",
                        minWidth:650,
                        textAlign:"left"
                      }}>
                        <thead>
                          <tr>
                            {["Boleta","Comprador","Celular","Estado","Acciones"].map(item => (
                              <th
                                key={item}
                                style={{
                                  padding:12,
                                  borderBottom:"1px solid #555"
                                }}
                              >
                                {item}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {adminReservations.map(r => (
                            <tr key={r.id}>
                              <td style={{padding:12}}>
                                {String(r.tickets?.number ?? "").padStart(2,"0")}
                              </td>

                              <td style={{padding:12}}>
                                {r.customer_name}
                              </td>

                              <td style={{padding:12}}>
                                {r.customer_phone}
                              </td>

                              <td style={{padding:12}}>
                                {r.status}
                              </td>

                              <td style={{padding:12}}>
                                {r.status === "pending_review" ? (
                                  <div style={{
                                    display:"flex",
                                    gap:8,
                                    flexWrap:"wrap"
                                  }}>
                                    <button
                                      className="primary-btn"
                                      disabled={adminLoading}
                                      onClick={() => managePayment(r.id, "confirm")}
                                    >
                                      Confirmar
                                    </button>

                                    <button
                                      className="secondary-btn"
                                      disabled={adminLoading}
                                      onClick={() => managePayment(r.id, "reject")}
                                    >
                                      Rechazar
                                    </button>
                                  </div>
                                ) : (
                                  "Sin acciones"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {/* PORTADA */}
        <section className="hero">
          <div className="hero-glow" />

          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14}/> EXPERIENCIA EXCLUSIVA SKY STUDIO
            </div>

            <h1>UN ESTILO.<br/><em>TRES PREMIOS.</em></h1>

            <p>
              Participa en nuestro sorteo especial y vive la experiencia Sky Studio.
            </p>

            <div className="hero-actions">
              <a className="primary-btn" href="#boletas">
                Elegir mi boleta <span>↗</span>
              </a>

              <span className="price-note">
                Boleta <b>$20.000 COP</b>
              </span>
            </div>
          </div>

          <div className="hero-art">
            <div className="orbit orbit-one"/>
            <div className="orbit orbit-two"/>
            <div className="monogram">S<span>S</span></div>
            <div className="hero-caption">
              PRECISIÓN · ESTILO · DISTINCIÓN
            </div>
          </div>

          <div className="hero-bottom">
            <span>00 — 99</span>
            <span>100 BOLETAS</span>
            <span>HUILA · COLOMBIA</span>
          </div>
        </section>

        {/* PREMIOS */}
        <section className="prizes section-wrap" id="premios">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LO QUE PUEDES GANAR</span>
              <h2>PREMIOS <em>EXCLUSIVOS</em></h2>
            </div>

            <p>Tres oportunidades, tres experiencias.</p>
          </div>

          <div className="prize-grid">
            <article className="prize-card featured">
              <div className="prize-number">01 / EFECTIVO</div>
              <Banknote className="prize-icon"/>
              <h3>$300.000</h3>
              <p>En efectivo</p>
              <div className="metal-line"/>
            </article>

            <article className="prize-card">
              <div className="prize-number">02 / EXPERIENCIA</div>
              <Scissors className="prize-icon"/>
              <h3>PREMIUM</h3>
              <p>Servicio premium de barbería</p>
              <div className="metal-line"/>
            </article>

            <article className="prize-card">
              <div className="prize-number">03 / EXPERIENCIA</div>
              <Crown className="prize-icon"/>
              <h3>VIP</h3>
              <p>Servicio VIP de barbería</p>
              <div className="metal-line"/>
            </article>
          </div>
        </section>

        {/* BOLETAS */}
        <section className="tickets-section section-wrap" id="boletas">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ESCOGE TU NÚMERO</span>
              <h2>BOLETAS <em>00–99</em></h2>
            </div>

            <div className="ticket-price">
              <small>VALOR POR BOLETA</small>
              <b>$20.000</b>
            </div>
          </div>

          <div className="status-legend">
            <span><i className="dot available"/> Disponible ({counts.available})</span>
            <span><i className="dot pending"/> Pendiente ({counts.pending})</span>
            <span><i className="dot active"/> Confirmada ({counts.active})</span>
          </div>

          <div className="ticket-tools">
            <label className="search-box">
              <Search size={17}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar número"
              />
            </label>

            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="available">Disponibles</option>
              <option value="pending">Pendientes</option>
              <option value="active">Confirmadas</option>
            </select>
          </div>

          {loading ? (
            <p className="fine-print">
              Cargando boletas desde Supabase...
            </p>
          ) : (
            <div className="ticket-grid">
              {visible.map(t => (
                <button
                  key={t.number}
                  className={`ticket ${t.status}`}
                  onClick={() => {
                    if (t.status === "available") {
                      setSelected(t);
                      setPaymentStep(false);
                      setTransferReported(false);
                    } else {
                      setNotice(`Boleta ${t.number}: ${statusLabel(t.status)}`);
                    }
                  }}
                >
                  <span>{t.number}</span>
                  <small>
                    {t.status === "available" ? "ELEGIR" : statusShort(t.status)}
                  </small>
                </button>
              ))}
            </div>
          )}

          <p className="fine-print">
            <ShieldCheck size={15}/>
            Las reservas se guardan en la base de datos. Los pagos requieren verificación manual.
          </p>
        </section>

        {/* CÓMO PARTICIPAR */}
        <section className="how section-wrap">
          <span className="eyebrow">SENCILLO Y TRANSPARENTE</span>
          <h2>¿CÓMO <em>PARTICIPAR?</em></h2>

          <div className="steps">
            <div>
              <b>01</b>
              <h3>Elige</h3>
              <p>Selecciona un número disponible entre el 00 y el 99.</p>
            </div>

            <div>
              <b>02</b>
              <h3>Solicita</h3>
              <p>Registra tu nombre y celular.</p>
            </div>

            <div>
              <b>03</b>
              <h3>Paga</h3>
              <p>Transfiere por Bre-B y espera la verificación.</p>
            </div>
          </div>
        </section>
      </main>

      {/* PIE DE PÁGINA */}
      <footer>
        <a className="brand" href="#">
          <span className="brand-mark"><Scissors size={19}/></span>
          <span>SKY <b>STUDIO</b><small>BARBERÍA</small></span>
        </a>

        <span>ESTILO QUE SE DISTINGUE.</span>
        <small>© Sky Studio</small>
      </footer>

      {/* MODAL DE COMPRA */}
      {selected && (
        <div className="modal-backdrop" onClick={closePayment}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={closePayment}>
              <X/>
            </button>

            {!paymentStep ? (
              <>
                <span className="eyebrow">SOLICITUD DE BOLETA</span>
                <h2>NÚMERO <em>{selected.number}</em></h2>
                <p>Valor: <b>{money(TICKET_PRICE)}</b></p>

                <label>
                  Nombre completo
                  <input
                    value={customer.name}
                    onChange={e => setCustomer({
                      ...customer,
                      name: e.target.value
                    })}
                    placeholder="Tu nombre"
                  />
                </label>

                <label>
                  Celular
                  <input
                    value={customer.phone}
                    onChange={e => setCustomer({
                      ...customer,
                      phone: e.target.value
                    })}
                    placeholder="Tu número de celular"
                  />
                </label>

                <button
                  className="primary-btn full"
                  onClick={requestTicket}
                  disabled={saving}
                >
                  {saving ? "Reservando..." : "Continuar al pago"}
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">PAGO MEDIANTE NU / BRE-B</span>
                <h2>BOLETA <em>{selected.number}</em></h2>
                <p>Realiza tu transferencia para continuar.</p>

                <h2 style={{
                  textAlign:"center",
                  fontSize:32,
                  margin:"18px 0"
                }}>
                  {money(TICKET_PRICE)}
                </h2>

                <div style={{
                  background:"#fff",
                  padding:12,
                  borderRadius:12,
                  width:"fit-content",
                  margin:"15px auto"
                }}>
                  <img
                    src={`${import.meta.env.BASE_URL}qr-breb.png`}
                    alt="QR de pago Nu Bre-B"
                    style={{
                      width:210,
                      height:210,
                      objectFit:"contain",
                      display:"block"
                    }}
                    onError={e => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>

                <p style={{textAlign:"center"}}>
                  Escanea el QR desde la aplicación de tu banco.
                </p>

                <div style={{
                  textAlign:"center",
                  padding:15,
                  background:"rgba(255,255,255,0.07)",
                  borderRadius:10,
                  margin:"15px 0"
                }}>
                  <small>LLAVE BRE-B</small>
                  <h2 style={{letterSpacing:2, margin:"8px 0"}}>
                    {BREB_KEY}
                  </h2>

                  <button
                    className="secondary-btn"
                    onClick={copyBreBKey}
                  >
                    Copiar llave
                  </button>
                </div>

                {!transferReported ? (
                  <button
                    className="primary-btn full"
                    onClick={reportTransfer}
                    disabled={saving}
                  >
                    {saving
                      ? "Enviando reporte..."
                      : "Ya realicé la transferencia"}
                  </button>
                ) : (
                  <>
                    <p style={{textAlign:"center"}}>
                      <b>¡Gracias!</b><br/>
                      Tu transferencia fue reportada y está pendiente de verificación.
                    </p>

                    <button
                      className="primary-btn full"
                      onClick={closePayment}
                    >
                      Finalizar
                    </button>
                  </>
                )}

                <small style={{display:"block", marginTop:12}}>
                  La reserva dura 15 minutos. Reportar una transferencia no significa que el pago ya esté confirmado.
                </small>
              </>
            )}
          </div>
        </div>
      )}

      {/* MENSAJES */}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")}>
            <X size={16}/>
          </button>
        </div>
      )}
    </div>
  );
}

function statusLabel(s) {
  return {
    available: "Disponible",
    pending: "Pendiente de pago",
    active: "Confirmada"
  }[s];
}

function statusShort(s) {
  return {
    available: "LIBRE",
    pending: "PEND.",
    active: "ACTIVA"
  }[s];
}
