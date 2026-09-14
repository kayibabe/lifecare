import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Surge thresholds
const ER_HIGH = 10;
const ER_CRITICAL = 15;
const EMERGENCY_SPIKE_HIGH = 5;   // emergency-priority visits waiting
const EMERGENCY_SPIKE_CRITICAL = 8;
const BED_HIGH_PCT = 85;          // occupancy %
const BED_CRITICAL_PCT = 95;

function levelFrom(value, high, critical) {
  if (value >= critical) return "critical";
  if (value >= high) return "high";
  return "normal";
}

const RANK = { normal: 0, high: 1, critical: 2 };

/**
 * Computes live patient-surge status across three dimensions:
 * ER / intake overcrowding, bed capacity, and emergency case spike.
 * Polls every 30s.
 */
export function useSurgeStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [erVisits, emergencyVisits, beds] = await Promise.all([
          base44.entities.Visit.filter(
            { visit_type: "emergency", queue_status: { $in: ["waiting", "triaged", "in_consultation"] } },
            "-created_date", 200
          ),
          base44.entities.Visit.filter(
            { priority: "emergency", queue_status: { $in: ["waiting", "triaged"] } },
            "-created_date", 200
          ),
          base44.entities.Bed.list("", 300),
        ]);

        const totalBeds = beds.length;
        const occupiedBeds = beds.filter(b => b.status === "occupied").length;
        const bedPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

        const metrics = [
          {
            key: "er",
            label: "ER / Intake Overcrowding",
            value: erVisits.length,
            display: `${erVisits.length} active ER patients`,
            level: levelFrom(erVisits.length, ER_HIGH, ER_CRITICAL),
          },
          {
            key: "beds",
            label: "Bed Capacity",
            value: bedPct,
            display: `${occupiedBeds}/${totalBeds} beds (${bedPct}%)`,
            level: levelFrom(bedPct, BED_HIGH_PCT, BED_CRITICAL_PCT),
          },
          {
            key: "emergency",
            label: "Emergency Case Spike",
            value: emergencyVisits.length,
            display: `${emergencyVisits.length} emergency cases waiting`,
            level: levelFrom(emergencyVisits.length, EMERGENCY_SPIKE_HIGH, EMERGENCY_SPIKE_CRITICAL),
          },
        ];

        const overall = metrics.reduce((acc, m) => RANK[m.level] > RANK[acc] ? m.level : acc, "normal");

        if (active) setStatus({ metrics, overall, occupiedBeds, totalBeds, bedPct });
      } catch (e) {
        console.error("Surge status load failed:", e);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return { status, loading };
}