import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

export default function ClaimsCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [claims, setClaims] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [daysClaims, setDaysClaims] = useState([]);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      const data = await base44.entities.InsuranceClaim.list("-submitted_date", 300);
      setClaims(data);
    } catch (e) {
      console.error(e);
    }
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getClaimsForDate = (date) => {
    return claims.filter(c => {
      const claimDate = c.submitted_date ? new Date(c.submitted_date) : new Date(c.created_date);
      return (
        claimDate.getFullYear() === date.getFullYear() &&
        claimDate.getMonth() === date.getMonth() &&
        claimDate.getDate() === date.getDate()
      );
    });
  };

  const handleDateClick = (day) => {
    const selected = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(selected);
    setDaysClaims(getClaimsForDate(selected));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const STATUS_COLORS = {
    pending: "bg-chart-4/10 text-chart-4",
    submitted: "bg-chart-1/10 text-chart-1",
    approved: "bg-chart-3/10 text-chart-3",
    paid: "bg-clinical-normal/10 text-clinical-normal",
    rejected: "bg-destructive/10 text-destructive"
  };

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Claims Calendar
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded hover:bg-muted">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold min-w-[150px] text-center">{monthName}</span>
            <button onClick={nextMonth} className="p-1.5 rounded hover:bg-muted">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {days.map(day => {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dayClaims = getClaimsForDate(date);
            const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString();

            return (
              <button
                key={day}
                onClick={() => handleDateClick(day)}
                className={`aspect-square rounded-lg text-sm font-medium transition-all relative ${
                  isSelected ? "bg-primary/20 border border-primary" : "hover:bg-muted border border-border/50"
                }`}
              >
                <span className="absolute top-1 right-1">{day}</span>
                {dayClaims.length > 0 && (
                  <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5 justify-center">
                    {dayClaims.slice(0, 2).map((c, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          c.status === "paid" ? "bg-chart-3" :
                          c.status === "rejected" ? "bg-destructive" :
                          c.status === "approved" ? "bg-chart-3/50" :
                          "bg-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details */}
      {selectedDate && daysClaims.length > 0 && (
        <div className="p-4 bg-muted/30 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            {selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} — {daysClaims.length} claim(s)
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {daysClaims.map(c => (
              <div key={c.id} className={`p-2 rounded text-xs ${STATUS_COLORS[c.status] || "bg-muted"}`}>
                <p className="font-medium">{c.scheme_name} — MWK {(c.claim_amount || 0).toLocaleString()}</p>
                <p className="text-[10px] opacity-75">ID: {c.id.slice(0, 8)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}