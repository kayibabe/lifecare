import { Link } from "react-router-dom";
import {
  Stethoscope, User, ArrowRight, ShieldCheck, ClipboardList, CalendarDays,
  FlaskConical, Pill, Receipt, MessageSquare, Activity, Lock,
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

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 aspect-[1240/730] overflow-hidden">
            <img src="/logo.png" alt="LifeCare" className="w-full h-full object-cover object-top" />
          </div>
          <span className="font-heading font-semibold text-base text-foreground">LifeCare HMIS</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4" />
          <span>Patient data handled under clinical data policy</span>
        </div>
      </div>

      {/* Hero */}
      <div className="px-6 md:px-10 pt-16 pb-14 max-w-5xl">
        <p className="text-sm mb-4 tracking-wide font-semibold text-primary uppercase">
          Health Management Information System
        </p>
        <h1 className="font-heading text-4xl md:text-[3.4rem] leading-[1.08] mb-6 font-semibold text-foreground max-w-[16ch]">
          One record, from the first appointment to the last bill.
        </h1>
        <p className="text-lg leading-relaxed mb-10 text-muted-foreground max-w-[52ch]">
          A shared clinical and administrative system connecting front desk, wards, pharmacy,
          lab and billing — so a patient's history follows them, and staff spend less time
          chasing paper.
        </p>
      </div>

      {/* Two-path login */}
      <div className="px-6 md:px-10 pb-16">
        <div className="grid md:grid-cols-2 gap-5 max-w-5xl">
          <Link
            to="/custom-login"
            className="text-left p-7 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/40 transition-all"
          >
            <Stethoscope className="w-6 h-6 text-primary" strokeWidth={1.75} />
            <h2 className="font-heading font-semibold text-lg mt-4 mb-1.5 text-foreground">
              Medical Staff
            </h2>
            <p className="text-sm mb-5 text-muted-foreground">
              Sign in with your staff credentials to access patient records, schedules and wards.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              Staff sign in <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            to="/patient-login"
            className="text-left p-7 rounded-xl border border-border bg-card hover:shadow-md hover:border-chart-2/40 transition-all"
          >
            <User className="w-6 h-6 text-chart-2" strokeWidth={1.75} />
            <h2 className="font-heading font-semibold text-lg mt-4 mb-1.5 text-foreground">
              Patients
            </h2>
            <p className="text-sm mb-5 text-muted-foreground">
              Sign in with the Patient ID from your registration and the phone number on file.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-chart-2">
              Patient sign in <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      </div>

      {/* Feature list */}
      <div className="px-6 md:px-10 pb-20 max-w-5xl">
        <h2 className="font-semibold text-sm mb-1 text-muted-foreground uppercase tracking-wide">
          What the system covers
        </h2>
        <div className="grid md:grid-cols-2 gap-x-10">
          {FEATURES.map((f) => (
            <div key={f.title} className="py-6 border-t border-border">
              <div className="flex items-start gap-4">
                <f.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" strokeWidth={1.75} />
                <div>
                  <h3 className="font-medium mb-1 text-foreground">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground max-w-[42ch]">{f.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 md:px-10 py-8 border-t border-border">
        <p className="text-xs text-muted-foreground">LifeCare Clinical Information System · Secured</p>
      </div>
    </div>
  );
}
