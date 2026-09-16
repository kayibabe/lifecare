import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/api/apiClient";
import { formatApiError } from "@/api/customClient";
import {
  Calendar, FileClock, Receipt, MessageSquare, Plus, X, LogOut, Save, Mail, MailOpen,
} from "lucide-react";

const TABS = [
  { key: "appointments", label: "Appointments", icon: Calendar },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "history", label: "Medical history", icon: FileClock },
  { key: "billing", label: "Billing", icon: Receipt },
];

const statusColors = {
  scheduled: "bg-chart-1/10 text-chart-1",
  checked_in: "bg-primary/10 text-primary",
  in_progress: "bg-chart-2/10 text-chart-2",
  completed: "bg-chart-3/10 text-chart-3",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-muted text-muted-foreground",
  pending: "bg-chart-4/10 text-chart-4",
  paid: "bg-chart-3/10 text-chart-3",
  partially_paid: "bg-chart-2/10 text-chart-2",
};

function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function PatientPortal() {
  const [checking, setChecking] = useState(true);
  const [patient, setPatient] = useState(null);
  const [authFailed, setAuthFailed] = useState(false);

  const [activeTab, setActiveTab] = useState("appointments");
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [showBooking, setShowBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({ date: "", time: "", visit_reason: "" });
  const [bookingError, setBookingError] = useState("");
  const [booking, setBooking] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [a, inv, enc, labs, msgs] = await Promise.all([
        apiClient.patientPortal.listAppointments(),
        apiClient.patientPortal.listInvoices(),
        apiClient.patientPortal.listEncounters(),
        apiClient.patientPortal.listLabResults(),
        apiClient.patientPortal.listMessages(),
      ]);
      setAppointments(a);
      setInvoices(inv);
      setEncounters(enc);
      setLabResults(labs);
      setMessages(msgs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await apiClient.patientAuth.me();
        if (cancelled) return;
        setPatient(me);
        setChecking(false);
        await loadAll();
      } catch {
        if (!cancelled) {
          setAuthFailed(true);
          setChecking(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loadAll]);

  useEffect(() => {
    if (authFailed) {
      window.location.href = "/patient-login";
    }
  }, [authFailed]);

  const handleLogout = () => {
    apiClient.patientAuth.logout();
  };

  const handleBook = async (e) => {
    e.preventDefault();
    setBookingError("");
    if (!bookingForm.date || !bookingForm.time) {
      setBookingError("Please choose a date and time.");
      return;
    }
    setBooking(true);
    try {
      await apiClient.patientPortal.bookAppointment({
        scheduled_datetime: `${bookingForm.date}T${bookingForm.time}:00`,
        visit_reason: bookingForm.visit_reason || undefined,
      });
      setShowBooking(false);
      setBookingForm({ date: "", time: "", visit_reason: "" });
      const a = await apiClient.patientPortal.listAppointments();
      setAppointments(a);
    } catch (err) {
      console.error('[PatientPortal] bookAppointment error:', err);
      const msg = !err?.status
        ? "Unable to reach the server. Check your internet connection and try again."
        : formatApiError(err, "Unable to book appointment. Please try again.");
      setBookingError(msg);
    } finally {
      setBooking(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await apiClient.patientPortal.markMessageRead(id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read_at: new Date().toISOString() } : m)));
    } catch (e) {
      console.error(e);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (authFailed || !patient) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 aspect-[1240/730] overflow-hidden">
            <img src="/logo.png" alt="LifeCare" className="w-full h-full object-cover object-top" />
          </div>
          <span className="font-heading font-semibold text-sm text-foreground">LifeCare</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Log out
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
            {patient.first_name?.[0]}{patient.last_name?.[0]}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{patient.mrn}</p>
            <h1 className="font-heading text-xl font-semibold text-foreground">
              Welcome back, {patient.first_name}
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 pb-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === t.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" strokeWidth={1.9} /> {t.label}
              {t.key === "messages" && messages.some((m) => !m.read_at) && (
                <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              )}
            </button>
          ))}
        </div>

        {loadingData ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading your records…</div>
        ) : (
          <>
            {activeTab === "appointments" && (
              <div>
                <button
                  onClick={() => setShowBooking(true)}
                  className="mb-5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Book new appointment
                </button>
                {appointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No appointments yet.</p>
                ) : (
                  <div className="bg-card rounded-xl border border-border/60 divide-y divide-border overflow-hidden">
                    {appointments.map((a) => (
                      <div key={a.id} className="px-5 py-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-foreground">{formatDateTime(a.scheduled_datetime)}</p>
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">
                            {a.appointment_type?.replace(/_/g, " ")}
                            {a.visit_reason ? ` · ${a.visit_reason}` : ""}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || "bg-muted text-muted-foreground"}`}>
                          {a.status?.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "messages" && (
              <div className="bg-card rounded-xl border border-border/60 divide-y divide-border overflow-hidden">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No messages from the hospital yet.</p>
                ) : (
                  messages.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => !m.read_at && handleMarkRead(m.id)}
                      className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {m.read_at ? (
                            <MailOpen className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <Mail className="w-3.5 h-3.5 text-primary" />
                          )}
                          <p className={`text-sm ${m.read_at ? "font-medium text-foreground" : "font-semibold text-foreground"}`}>
                            {m.subject}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground pl-5.5">{m.body}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-heading font-semibold text-sm mb-3 text-foreground">Visits</h4>
                  {encounters.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No visits recorded yet.</p>
                  ) : (
                    <div className="bg-card rounded-xl border border-border/60 divide-y divide-border overflow-hidden">
                      {encounters.map((e) => (
                        <div key={e.id} className="px-5 py-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-foreground">{formatDateTime(e.encounter_date)}</p>
                            {e.chief_complaint && <p className="text-xs text-muted-foreground mt-0.5">{e.chief_complaint}</p>}
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary uppercase">
                            {e.encounter_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-heading font-semibold text-sm mb-3 text-foreground">Lab results</h4>
                  {labResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No lab results yet.</p>
                  ) : (
                    <div className="bg-card rounded-xl border border-border/60 divide-y divide-border overflow-hidden">
                      {labResults.map((r) => (
                        <div key={r.id} className="px-5 py-4">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm text-foreground">{r.test_name}</p>
                            {r.result_flag && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.result_flag === "normal" ? "bg-chart-3/10 text-chart-3" : "bg-destructive/10 text-destructive"}`}>
                                {r.result_flag}
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-1">
                            <span className="font-semibold font-mono">{r.result_value}</span>{" "}
                            {r.result_unit && <span className="text-muted-foreground">{r.result_unit}</span>}
                          </p>
                          {r.reference_range && <p className="text-xs text-muted-foreground mt-0.5">Reference: {r.reference_range}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div>
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No invoices yet.</p>
                ) : (
                  <div className="bg-card rounded-xl border border-border/60 divide-y divide-border overflow-hidden">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="px-5 py-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-foreground">{inv.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(inv.invoice_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm text-foreground">MWK {inv.total?.toLocaleString()}</p>
                          {inv.balance > 0 && (
                            <p className="text-xs text-destructive">Balance: MWK {inv.balance.toLocaleString()}</p>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || "bg-muted text-muted-foreground"}`}>
                            {inv.status?.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Booking modal */}
      {showBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBooking(false)} />
          <div className="relative bg-card rounded-xl p-6 shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-semibold text-foreground">Book an appointment</h3>
              <button onClick={() => setShowBooking(false)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={bookingForm.date}
                  onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Time *</label>
                <input
                  type="time"
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={bookingForm.time}
                  onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Reason for visit</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm h-20 resize-none"
                  value={bookingForm.visit_reason}
                  onChange={(e) => setBookingForm({ ...bookingForm, visit_reason: e.target.value })}
                  placeholder="Briefly describe why you're booking…"
                />
              </div>

              {bookingError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3.5 py-2.5">
                  <p className="text-sm text-destructive leading-snug">{bookingError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={booking}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5 inline mr-1" /> {booking ? "Booking…" : "Book appointment"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBooking(false)}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
