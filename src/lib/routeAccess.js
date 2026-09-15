import { ALL_NAV_GROUPS } from "@/components/Layout";

// Routes reached only by a direct link (e.g. from a patient record), never
// listed in the sidebar, but still needing a role boundary consistent with
// the nearest sidebar equivalent - patient history is clinical-record
// access, so it gets the same roles as Reception/Clinical/Inpatient.
const EXTRA_ROUTE_ROLES = {
  "/patient-history": ["admin", "user", "receptionist", "doctor", "clinician", "nurse", "midwife"],
};

// path -> allowed roles, flattened from the sidebar config so the two
// can never drift: hiding a link is not access control, this map is.
export const ROUTE_ROLES = ALL_NAV_GROUPS.reduce((map, group) => {
  for (const item of group.items) map[item.path] = item.roles;
  return map;
}, { ...EXTRA_ROUTE_ROLES });
