import { Link } from "react-router-dom";
import {
  Stethoscope, User, ArrowRight, ShieldCheck, ClipboardList, CalendarDays,
  FlaskConical, Pill, Receipt, MessageSquare, Activity, Lock, CheckCircle2,
  HeartPulse, Users, FileClock,
} from "lucide-react";

const FEATURES = [
  { icon: ClipboardList, title: "Electronic health records", text: "A single longitudinal record per patient, shared across departments and visits, replacing paper files that don't travel with the patient." },
  { icon: CalendarDays, title: "Appointment scheduling", text: "Patients book and reschedule; staff manage clinic capacity and see the day's list by department." },
  { icon: FlaskConical, title: "Lab and diagnostics", text: "Orders and results flow between clinician and lab, with results visible to the patient once released." },
  { icon: Pill, title: "Pharmacy and prescriptions", text: "Prescriptions issued at consultation are visible to pharmacy for dispensing and to the patient for refill reminders." },
  { icon: Receipt, title: "Billing and expenses", text: "Charges are itemised against the visit that generated them, with an outstanding balance always visible to the patient." },
  { icon: MessageSquare, title: "Secure messaging", text: "Hospital-to-patient communication — results, reminders, and follow-up instructions, in one inbox." },
  { icon: Activity, title: "Reporting and KPIs", text: "Admissions, bed occupancy, staff caseload and revenue rolled up for management, without touching individual records." },
  { icon: Lock, title: "Access control and audit", text: "Every record access is logged against a staff identity — who viewed what, and when." },
];

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Role-based access control" },
  { icon: FileClock, text: "Every record access audit-logged" },
  { icon: HeartPulse, text: "One record across every department" },
  { icon: Users, text: "Built for clinicians, patients and staff" },
];

const WORKFLOW = [
  { step: "01", title: "Register once", text: "Front desk captures a patient's details once at intake — every department after that works from the same record." },
  { step: "02", title: "Care, connected", text: "Consultation notes, lab orders, and prescriptions move between departments automatically, in real time." },
  { step: "03", title: "Billed and tracked", text: "Charges accumulate against the visit as care happens, so the balance shown to a patient is always current." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex items-center justify-between px-6 md:px-10 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 aspect-[1240/730] overflow-hidden rounded-sm">
              <img src="/logo.png" alt="LifeCare" className="w-full h-full object-cover object-top" />
            </div>
            <div className="leading-tight">
              <span className="block font-heading font-semibold text-base text-foreground">LifeCare</span>
              <span className="block text-[11px] text-muted-foreground tracking-wide">Health Management Information System</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#services" className="hover:text-foreground transition-colors">Services</a>
            <a href="#security" className="hover:text-foreground transition-colors">Security</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/patient-login"
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Patient sign in
            </Link>
            <Link
              to="/custom-login"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Staff sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: "radial-gradient(60% 50% at 85% 0%, hsl(var(--primary)/0.10) 0%, transparent 60%), radial-gradient(45% 40% at 100% 30%, hsl(var(--chart-2)/0.10) 0%, transparent 60%)",
          }}
        />
        <div className="px-6 md:px-10 pt-16 md:pt-20 pb-16 max-w-7xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-border bg-card text-xs font-semibold text-primary uppercase tracking-wide">
              <ShieldCheck className="w-3.5 h-3.5" />
              Health Management Information System
            </div>
            <h1 className="font-heading text-4xl md:text-[3.4rem] leading-[1.08] mb-6 font-semibold text-foreground max-w-[16ch]">
              One record, from the first appointment to the last bill.
            </h1>
            <p className="text-lg leading-relaxed mb-8 text-muted-foreground max-w-[52ch]">
              A shared clinical and administrative system connecting front desk, wards, pharmacy,
              lab and billing — so a patient's history follows them, and staff spend less time
              chasing paper.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <Link
                to="/custom-login"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Stethoscope className="w-4 h-4" />
                Staff sign in
              </Link>
              <Link
                to="/patient-login"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border border-border bg-card text-foreground hover:border-chart-2/50 hover:bg-muted/50 transition-colors"
              >
                <User className="w-4 h-4" />
                Patient sign in
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-7 gap-y-3">
              {TRUST_POINTS.map((t) => (
                <div key={t.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <t.icon className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={1.75} />
                  <span>{t.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visual: departments connected around one record */}
          <div className="relative mx-auto w-full max-w-sm aspect-square hidden sm:block">
            <div className="absolute inset-0 rounded-full border border-border/70" />
            <div className="absolute inset-[14%] rounded-full border border-border/50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-28 h-28 rounded-2xl bg-primary text-primary-foreground shadow-lg flex flex-col items-center justify-center gap-1.5">
                <ClipboardList className="w-7 h-7" strokeWidth={1.75} />
                <span className="text-[11px] font-semibold text-center leading-tight px-2">Patient<br />Record</span>
              </div>
            </div>
            {[
              { icon: CalendarDays, label: "Reception", pos: "top-0 left-1/2 -translate-x-1/2" },
              { icon: FlaskConical, label: "Lab", pos: "top-1/2 right-0 -translate-y-1/2" },
              { icon: Pill, label: "Pharmacy", pos: "bottom-0 left-1/2 -translate-x-1/2" },
              { icon: Receipt, label: "Billing", pos: "top-1/2 left-0 -translate-y-1/2" },
            ].map((n) => (
              <div key={n.label} className={`absolute ${n.pos} flex flex-col items-center gap-1.5`}>
                <div className="w-16 h-16 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center">
                  <n.icon className="w-6 h-6 text-chart-2" strokeWidth={1.75} />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">{n.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two-path login */}
      <div className="px-6 md:px-10 pb-20 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-5 max-w-5xl">
          <Link
            to="/custom-login"
            className="group text-left p-7 rounded-xl border border-border bg-card hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Stethoscope className="w-6 h-6 text-primary" strokeWidth={1.75} />
            </div>
            <h2 className="font-heading font-semibold text-lg mb-1.5 text-foreground">
              Medical Staff
            </h2>
            <p className="text-sm mb-5 text-muted-foreground">
              Sign in with your staff credentials to access patient records, schedules and wards.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              Staff sign in
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            to="/patient-login"
            className="group text-left p-7 rounded-xl border border-border bg-card hover:shadow-lg hover:border-chart-2/40 hover:-translate-y-0.5 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-chart-2/10 flex items-center justify-center mb-4">
              <User className="w-6 h-6 text-chart-2" strokeWidth={1.75} />
            </div>
            <h2 className="font-heading font-semibold text-lg mb-1.5 text-foreground">
              Patients
            </h2>
            <p className="text-sm mb-5 text-muted-foreground">
              Sign in with the Patient ID from your registration and the phone number on file.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-chart-2">
              Patient sign in
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div id="how-it-works" className="px-6 md:px-10 pb-20 max-w-7xl mx-auto scroll-mt-20">
        <div className="max-w-2xl mb-10">
          <h2 className="font-semibold text-sm mb-2 text-primary uppercase tracking-wide">How it works</h2>
          <p className="font-heading text-2xl md:text-3xl font-semibold text-foreground">
            Care moves with the patient, not on paper.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {WORKFLOW.map((w) => (
            <div key={w.step} className="p-6 rounded-xl border border-border bg-card">
              <span className="font-heading text-3xl font-bold text-primary/25">{w.step}</span>
              <h3 className="font-heading font-semibold text-base mt-3 mb-2 text-foreground">{w.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{w.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature list */}
      <div id="services" className="px-6 md:px-10 pb-20 max-w-7xl mx-auto scroll-mt-20">
        <div className="max-w-2xl mb-10">
          <h2 className="font-semibold text-sm mb-2 text-primary uppercase tracking-wide">What the system covers</h2>
          <p className="font-heading text-2xl md:text-3xl font-semibold text-foreground">
            Every department, on one shared record.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="font-medium mb-1.5 text-foreground">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Security / trust */}
      <div id="security" className="px-6 md:px-10 pb-20 max-w-7xl mx-auto scroll-mt-20">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-12 grid md:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          <div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
              <ShieldCheck className="w-6 h-6 text-primary" strokeWidth={1.75} />
            </div>
            <h2 className="font-heading text-2xl md:text-3xl font-semibold mb-3 text-foreground">
              Patient data handled under clinical data policy
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground max-w-[46ch]">
              Access to clinical records is restricted by role, every view is attributed to a
              staff identity, and that history is auditable after the fact.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "Role-based access control enforced on every route",
              "Every record access logged against a staff identity",
              "Patient portal access limited to the patient's own record",
              "Passwords and credentials never stored in plain text",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4.5 h-4.5 text-chart-2 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
                <span className="text-sm text-foreground/90 leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="px-6 md:px-10 py-10 max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 aspect-[1240/730] overflow-hidden rounded-sm">
              <img src="/logo.png" alt="LifeCare" className="w-full h-full object-cover object-top" />
            </div>
            <div className="leading-tight">
              <span className="block font-heading font-semibold text-sm text-foreground">LifeCare</span>
              <span className="block text-xs text-muted-foreground">Clinical Information System · Secured</span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/custom-login" className="hover:text-foreground transition-colors">Staff sign in</Link>
            <Link to="/patient-login" className="hover:text-foreground transition-colors">Patient sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
