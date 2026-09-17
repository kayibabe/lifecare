import { ALL_NAV_GROUPS } from "@/components/Layout";

// Routes reached only by a direct link (e.g. from a patient record), never
// listed in the sidebar, but still needing a role boundary consistent with
// the nearest sidebar equivalent - patient history is clinical-record
// access, so it gets the same roles as Reception/Clinical/Inpatient.
const EXTRA_ROUTE_ROLES = {
  "/patient-history": ["admin", "user", "receptionist", "doctor", "clinician", "nurse", "midwife"],
};

// These pages remain in the legacy route tree for compatibility with old
// links, but are not supported by the self-hosted backend. An empty allowlist
// lets RoleRoute fail closed instead of making hidden pages directly reachable.
const BLOCKED_ROUTES = [
  "/imaging", "/radiology-reports", "/maternal", "/discharge-checklist",
  "/surgical-dashboard", "/surgery-calendar", "/surgical-requisitions",
  "/surgical-dispensing", "/surgical-supply-tracker", "/doctor-schedule",
  "/staff-shifts", "/doctor-handover", "/journey-map", "/patient-outcomes",
  "/patient-feedback", "/moh-reports", "/physician-performance", "/waste",
  "/my-signatures", "/signature-audit", "/inventory-audit", "/surge",
];

// path -> allowed roles, flattened from the sidebar config so the two
// can never drift: hiding a link is not access control, this map is.
export const ROUTE_ROLES = ALL_NAV_GROUPS.reduce((map, group) => {
  for (const item of group.items) map[item.path] = item.roles;
  return map;
}, { ...EXTRA_ROUTE_ROLES });

for (const path of BLOCKED_ROUTES) ROUTE_ROLES[path] = [];
