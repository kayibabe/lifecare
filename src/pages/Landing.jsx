import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Stethoscope, User, ArrowRight, ShieldCheck, ClipboardList, CalendarDays,
  FlaskConical, Pill, Receipt, MessageSquare, Lock, CheckCircle2,
  HeartPulse, Phone, MapPin, Clock, ChevronRight, Award, Building2,
  Microscope, Syringe, Bed, UserCheck, BarChart3,
} from "lucide-react";

const SERVICES = [
  { icon: ClipboardList, title: "Electronic Health Records", text: "Unified patient records shared across all departments and visits in real time." },
  { icon: CalendarDays, title: "Appointment Scheduling", text: "Streamlined booking for patients, with smart capacity management for clinical staff." },
  { icon: Microscope, title: "Lab & Diagnostics", text: "Orders, sample tracking, and results flow instantly between clinicians and the laboratory." },
  { icon: Pill, title: "Pharmacy Management", text: "Digital prescriptions dispensed at the counter, with automated refill reminders." },
  { icon: Receipt, title: "Billing & Accounts", text: "Itemised charges tied to each visit, with real-time outstanding balances for patients." },
  { icon: MessageSquare, title: "Secure Messaging", text: "Direct clinic-to-patient communication for results, reminders, and follow-up care." },
  { icon: BarChart3, title: "Analytics & KPIs", text: "Management dashboards for admissions, bed occupancy, caseload, and revenue." },
  { icon: Lock, title: "Access Control & Audit", text: "Every record access is logged and attributed — who viewed what, and when." },
];

const DEPARTMENTS = [
  { icon: Bed, name: "In-Patient Ward" },
  { icon: HeartPulse, name: "Emergency Care" },
  { icon: FlaskConical, name: "Laboratory" },
  { icon: Pill, name: "Pharmacy" },
  { icon: Microscope, name: "Diagnostics" },
  { icon: Syringe, name: "Maternal Health" },
  { icon: Building2, name: "Administration" },
  { icon: UserCheck, name: "Reception" },
];

const TRUST = [
  "Role-based access control on every route",
  "Full audit trail — every record access logged",
  "Patient portal scoped to the patient's own data",
  "Credentials hashed; no plaintext passwords stored",
  "Sensitive data never exposed in logs or API responses",
  "Access revoked immediately on staff departure",
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled
            ? "rgba(255,255,255,0.97)"
            : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid hsl(var(--border))" : "1px solid transparent",
          boxShadow: scrolled ? "0 1px 24px 0 rgba(0,0,0,0.07)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 overflow-hidden rounded-md flex-shrink-0">
              <img src="/logo.png" alt="LifeCare" className="w-full h-full object-cover object-top" />
            </div>
            <div className="leading-tight">
              <span
                className="block font-heading font-bold text-base tracking-wide transition-colors"
                style={{ color: scrolled ? "hsl(var(--foreground))" : "#fff" }}
              >
                LifeCare
              </span>
              <span
                className="block text-[10px] tracking-widest uppercase transition-colors"
                style={{ color: scrolled ? "hsl(var(--muted-foreground))" : "rgba(255,255,255,0.7)" }}
              >
                Health Management Information System
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: "#access", label: "Patient Access" },
              { href: "#services", label: "Services" },
              { href: "#departments", label: "Departments" },
              { href: "#security", label: "Security" },
            ].map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: scrolled ? "hsl(var(--muted-foreground))" : "rgba(255,255,255,0.85)" }}
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/patient-login"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                color: scrolled ? "hsl(var(--foreground))" : "#fff",
                background: scrolled ? "hsl(var(--muted))" : "rgba(255,255,255,0.12)",
                border: scrolled ? "1px solid hsl(var(--border))" : "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <User className="w-3.5 h-3.5" />
              Patient
            </Link>
            <Link
              to="/custom-login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              Staff Login
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col justify-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0d2d55 0%, #0e4f6e 40%, #0d6e5e 100%)",
        }}
      >
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Radial glow */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 60% 50%, rgba(13,110,94,0.35) 0%, transparent 70%)",
          }}
        />
        {/* Large decorative cross */}
        <svg
          className="absolute right-0 top-0 opacity-[0.04] w-[700px] h-[700px] -translate-y-1/4 translate-x-1/4"
          viewBox="0 0 200 200" fill="white"
        >
          <rect x="80" y="0" width="40" height="200" rx="20" />
          <rect x="0" y="80" width="200" height="40" rx="20" />
        </svg>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-32 pb-24 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest mb-8"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <HeartPulse className="w-3.5 h-3.5" />
              Trusted Healthcare in Malawi
            </div>

            <h1 className="font-heading font-bold text-white leading-[1.06] mb-6"
              style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)" }}>
              Your Health.<br />
              <span style={{ color: "#5ee8c5" }}>Our Priority.</span>
            </h1>

            <p className="text-lg leading-relaxed mb-10 max-w-[50ch]"
              style={{ color: "rgba(255,255,255,0.72)" }}>
              LifeCare brings together every part of your care — consultation,
              lab, pharmacy, and billing — on a single secure digital platform. Better care,
              less paper.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <Link
                to="/patient-login"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.99]"
                style={{
                  background: "linear-gradient(135deg, #5ee8c5, #0d9e80)",
                  color: "#0d2d55",
                  boxShadow: "0 4px 24px rgba(94,232,197,0.4)",
                }}
              >
                <User className="w-4 h-4" />
                Patient Portal
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/custom-login"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/20"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.3)",
                }}
              >
                <Stethoscope className="w-4 h-4" />
                Staff Sign In
              </Link>
            </div>

            <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">Patient data secured and handled under clinical data policy</span>
            </div>
          </div>

          {/* Right: Service highlights panel */}
          <div className="hidden lg:block">
            <div
              className="rounded-2xl p-6 grid grid-cols-2 gap-3"
              style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <div className="col-span-2 mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Integrated patient care platform
                </p>
              </div>
              {[
                { icon: ClipboardList, label: "Medical Records", color: "#5ee8c5" },
                { icon: CalendarDays, label: "Appointments", color: "#7ab8f5" },
                { icon: FlaskConical, label: "Lab Results", color: "#f5a623" },
                { icon: Pill, label: "Pharmacy", color: "#9b8df5" },
                { icon: Receipt, label: "Billing", color: "#f57676" },
                { icon: HeartPulse, label: "Vital Signs", color: "#5ee8c5" },
                { icon: MessageSquare, label: "Messages", color: "#7ab8f5" },
                { icon: ShieldCheck, label: "Secure Access", color: "#7ef590" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02]"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${item.color}22` }}>
                    <item.icon className="w-4 h-4" style={{ color: item.color }} strokeWidth={1.75} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.82)" }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce"
          style={{ color: "rgba(255,255,255,0.4)" }}>
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
            <rect x="5.5" y="0.5" width="5" height="11" rx="2.5" stroke="currentColor" />
            <rect x="7.5" y="3.5" width="1" height="4" rx="0.5" fill="currentColor" />
            <path d="M4 17l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </section>


      {/* ── PORTAL ACCESS ────────────────────────────────────────────────── */}
      <section id="access" className="scroll-mt-16 py-24 px-6 md:px-10 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">Portal Access</span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground mb-4">
              How would you like to proceed?
            </h2>
            <p className="text-muted-foreground max-w-[50ch] mx-auto">
              Two secure pathways — one for our medical team, one for registered patients.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Staff */}
            <Link
              to="/custom-login"
              className="group relative overflow-hidden rounded-2xl p-8 flex flex-col transition-all hover:-translate-y-1 hover:shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #0d2d55 0%, #0e4f6e 100%)",
                boxShadow: "0 4px 32px rgba(13,45,85,0.20)",
              }}
            >
              <div
                className="absolute top-0 right-0 w-48 h-48 opacity-10 -translate-y-1/4 translate-x-1/4"
                style={{ background: "radial-gradient(circle, #7ab8f5 0%, transparent 70%)" }}
              />
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <Stethoscope className="w-7 h-7 text-white" strokeWidth={1.75} />
              </div>
              <h3 className="font-heading font-bold text-white text-2xl mb-3">Medical Staff</h3>
              <p className="text-sm leading-relaxed mb-8 flex-1" style={{ color: "rgba(255,255,255,0.68)" }}>
                Access patient records, manage appointments, process lab orders, dispense
                medications, and generate reports — all from a single role-protected workspace.
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#7ab8f5" }}>
                Sign in as Staff
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Patient */}
            <Link
              to="/patient-login"
              className="group relative overflow-hidden rounded-2xl p-8 flex flex-col transition-all hover:-translate-y-1 hover:shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #065f46 0%, #0d9e80 100%)",
                boxShadow: "0 4px 32px rgba(6,95,70,0.20)",
              }}
            >
              <div
                className="absolute top-0 right-0 w-48 h-48 opacity-10 -translate-y-1/4 translate-x-1/4"
                style={{ background: "radial-gradient(circle, #5ee8c5 0%, transparent 70%)" }}
              />
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <User className="w-7 h-7 text-white" strokeWidth={1.75} />
              </div>
              <h3 className="font-heading font-bold text-white text-2xl mb-3">Patient Portal</h3>
              <p className="text-sm leading-relaxed mb-8 flex-1" style={{ color: "rgba(255,255,255,0.68)" }}>
                View your appointments, lab results, prescriptions, and billing history —
                all in one place. Sign in with your Patient ID and registered phone number.
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#5ee8c5" }}>
                Sign in as Patient
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── DEPARTMENTS ─────────────────────────────────────────────────── */}
      <section id="departments" className="scroll-mt-16 py-24 px-6 md:px-10"
        style={{ background: "hsl(var(--muted))" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">Our Departments</span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground mb-4">
              Comprehensive care under one roof
            </h2>
            <p className="text-muted-foreground max-w-[48ch] mx-auto">
              Every department on a connected system — so information follows the patient,
              not the other way around.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {DEPARTMENTS.map((d) => (
              <div
                key={d.name}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-background border border-border text-center hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <d.icon className="w-6 h-6 text-primary" strokeWidth={1.75} />
                </div>
                <span className="text-xs font-semibold text-foreground leading-tight">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────────────── */}
      <section id="services" className="scroll-mt-16 py-24 px-6 md:px-10 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div>
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">Platform Capabilities</span>
              <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground">
                Every department.<br />One shared record.
              </h2>
            </div>
            <p className="text-muted-foreground max-w-[38ch] md:text-right">
              From the moment a patient walks in to the final billing statement, everything
              is captured and visible to every authorised team member.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map((s, i) => (
              <div
                key={s.title}
                className="group p-6 rounded-2xl border border-border bg-background hover:border-primary/40 hover:shadow-xl hover:-translate-y-1 transition-all"
                style={{
                  transitionDelay: `${i * 30}ms`,
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-colors group-hover:bg-primary group-hover:text-white"
                  style={{ background: "hsl(var(--primary)/0.10)" }}
                >
                  <s.icon className="w-5 h-5 text-primary group-hover:text-white" strokeWidth={1.75} />
                </div>
                <h3 className="font-heading font-semibold text-base mb-2 text-foreground">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section
        className="py-24 px-6 md:px-10"
        style={{ background: "linear-gradient(180deg, hsl(var(--muted)) 0%, hsl(var(--background)) 100%)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary mb-3">Patient Journey</span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground mb-4">
              Care that moves with you
            </h2>
            <p className="text-muted-foreground max-w-[44ch] mx-auto">
              One registration. Every department. A complete record, always current.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div
              className="hidden md:block absolute top-12 left-1/4 right-1/4 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, hsl(var(--primary)/0.4), hsl(var(--primary)/0.4), transparent)",
              }}
            />

            {[
              {
                num: "01",
                icon: UserCheck,
                title: "Register Once",
                text: "Front desk captures the patient's details once at intake — every department after that sees the same record instantly.",
                accent: "#0e4f6e",
              },
              {
                num: "02",
                icon: HeartPulse,
                title: "Connected Care",
                text: "Consultation notes, lab orders, prescriptions, and imaging requests flow between departments automatically, in real time.",
                accent: "#0d6e5e",
              },
              {
                num: "03",
                icon: Receipt,
                title: "Clear Billing",
                text: "Every procedure is itemised the moment it occurs. No chasing paperwork — the balance is always visible to the patient.",
                accent: "#065f46",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="relative flex flex-col items-center text-center p-8 rounded-2xl bg-background border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${step.accent}, ${step.accent}cc)` }}
                >
                  <step.icon className="w-9 h-9 text-white" strokeWidth={1.5} />
                </div>
                <span
                  className="absolute top-4 right-4 font-heading font-bold text-5xl leading-none opacity-[0.06] text-foreground select-none"
                >
                  {step.num}
                </span>
                <h3 className="font-heading font-bold text-xl mb-3 text-foreground">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ─────────────────────────────────────────────────────── */}
      <section
        id="security"
        className="scroll-mt-16 py-24 px-6 md:px-10"
        style={{ background: "linear-gradient(135deg, #0d2d55 0%, #0d4a3a 100%)" }}
      >
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span
              className="inline-block text-xs font-bold uppercase tracking-widest mb-4"
              style={{ color: "#5ee8c5" }}
            >
              Privacy &amp; Security
            </span>
            <h2 className="font-heading font-bold text-white text-3xl md:text-4xl leading-tight mb-6">
              Your records are safe.<br />Full stop.
            </h2>
            <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.68)" }}>
              Clinical data deserves clinical-grade protection. Our system enforces access
              controls at every layer — from the route to the database — and logs every
              interaction so nothing goes unaccounted for.
            </p>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "rgba(94,232,197,0.12)", color: "#5ee8c5", border: "1px solid rgba(94,232,197,0.25)" }}
            >
              <Award className="w-4 h-4" />
              Clinical data handled under formal data policy
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {TRUST.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#5ee8c5" }} strokeWidth={1.75} />
                <span className="text-sm leading-snug" style={{ color: "rgba(255,255,255,0.82)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT STRIP ────────────────────────────────────────────────── */}
      <section className="py-14 px-6 md:px-10 bg-background border-y border-border">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-3 gap-8">
          {[
            { icon: Phone, label: "Emergency & Reception", value: "Available at the clinic" },
            { icon: MapPin, label: "Location", value: "Malawi" },
            { icon: Clock, label: "Hours", value: "Mon – Sat, 7:30 AM – 6:00 PM" },
          ].map((c) => (
            <div key={c.label} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <c.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{c.label}</p>
                <p className="text-sm font-medium text-foreground">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ background: "#0d1f38" }}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-14 grid md:grid-cols-[1.5fr_1fr_1fr] gap-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 overflow-hidden rounded-lg flex-shrink-0">
                <img src="/logo.png" alt="LifeCare" className="w-full h-full object-cover object-top" />
              </div>
              <div>
                <span className="block font-heading font-bold text-white text-base">LifeCare</span>
                <span className="block text-[10px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Health Management Information System
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed mt-4" style={{ color: "rgba(255,255,255,0.5)" }}>
              LifeCare — A modern clinic management platform bringing every department
              together under one secure, integrated system. Care. Connect. Manage.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Patient Access
            </p>
            <div className="flex flex-col gap-3">
              {[
                { to: "/patient-login", label: "Sign in to Patient Portal" },
                { to: "/custom-login", label: "Staff Login" },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
              System
            </p>
            <div className="flex flex-col gap-3">
              {[
                { href: "#services", label: "Services" },
                { href: "#departments", label: "Departments" },
                { href: "#security", label: "Security & Privacy" },
                { href: "#access", label: "Portal Access" },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div
          className="max-w-7xl mx-auto px-6 md:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            © {new Date().getFullYear()} LifeCare Health Management Information System. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#5ee8c5" }} />
            Secured · Clinical Data Policy Compliant
          </div>
        </div>
      </footer>
    </div>
  );
}
