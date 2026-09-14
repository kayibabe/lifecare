/**
 * FastAPI adapter that implements the same interface as @base44/sdk.
 * Lets all 48 Base44 pages work against the self-hosted FastAPI backend
 * without any changes to the page components.
 *
 * Usage: exported from base44Client.js when VITE_BASE44_APP_ID / ?app_id= is absent.
 */

// ─── TOKEN MANAGEMENT ────────────────────────────────────────────────────────

const TOKEN_KEY = 'lifecare_access_token';
const REFRESH_KEY = 'lifecare_refresh_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Turn an API error (from the custom adapter or the Base44 SDK) into a readable
 * message. Handles FastAPI's 422 `detail` arrays ([{loc, msg}, ...]),
 * string `detail`, and plain Error messages.
 */
export function formatApiError(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.data?.detail ?? err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join('; ');
  }
  if (typeof detail === 'string') return detail;
  return err?.message || fallback;
}

function setTokens(access, refresh) {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ─── FETCH WRAPPER ────────────────────────────────────────────────────────────

function buildURL(baseURL, path, params) {
  const url = new URL(baseURL + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function doFetch(baseURL, path, options = {}) {
  const { method = 'GET', body, params, headers = {}, _retried = false } = options;
  const token = getToken();
  const isFormData = body instanceof FormData;

  const reqHeaders = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  };

  const res = await fetch(buildURL(baseURL, path, params), {
    method,
    headers: reqHeaders,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    let errData = {};
    try { errData = await res.json(); } catch { /* plain error */ }

    // Auto-refresh on 401
    if (res.status === 401 && !_retried) {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (refresh) {
        try {
          const rr = await fetch(buildURL(baseURL, '/auth/refresh', null), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh }),
          });
          if (rr.ok) {
            const td = await rr.json();
            setTokens(td.access_token, td.refresh_token);
            return doFetch(baseURL, path, { ...options, _retried: true });
          }
        } catch { /**/ }
        clearTokens();
      }
    }

    const err = new Error(errData.detail || errData.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = errData;
    throw err;
  }

  const ct = res.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

function makeHttp(baseURL) {
  return {
    get: (path, { params } = {}) => doFetch(baseURL, path, { params }),
    post: (path, body, { headers } = {}) => doFetch(baseURL, path, { method: 'POST', body, headers }),
    put: (path, body) => doFetch(baseURL, path, { method: 'PUT', body }),
    patch: (path, body) => doFetch(baseURL, path, { method: 'PATCH', body }),
    del: (path) => doFetch(baseURL, path, { method: 'DELETE' }),
  };
}

// ─── ENTITY DEFINITIONS ───────────────────────────────────────────────────────
// For each Base44 entity name: endpoint path, field transforms (both directions),
// and a filterMap for renaming filter keys before sending to FastAPI.

export const ENTITY_DEFS = {
  Patient: {
    endpoint: '/patients',
    fromAPI: (p) => p && ({
      ...p,
      created_date: p.created_at,
      updated_date: p.updated_at,
      insurance_scheme: p.insurance_provider,
      insurance_member_number: p.insurance_number,
    }),
    toAPI: (d) => {
      const out = {
        ...d,
        phone: d.contact_number ?? d.phone,
        emergency_contact_phone: d.emergency_contact_number ?? d.emergency_contact_phone,
        insurance_provider: d.insurance_scheme ?? d.insurance_provider,
        insurance_number: d.insurance_member_number ?? d.insurance_number,
      };
      // Strip empty strings so optional enum/date fields use backend defaults
      for (const k of Object.keys(out)) { if (out[k] === '') out[k] = undefined; }
      return out;
    },
    filterMap: { created_date: 'created_at', updated_date: 'updated_at' },
  },

  // Base44 calls OPD encounters "Visit"
  Visit: {
    endpoint: '/encounters',
    fromAPI: (e) => e && ({
      ...e,
      visit_type: e.encounter_type,
      visit_date: e.encounter_date || e.created_at,
      queue_status: e.queue_status ?? e.status,
      created_date: e.created_at,
      updated_date: e.updated_at,
    }),
    toAPI: (d) => ({
      ...d,
      // Map frontend visit_type labels to backend EncounterType enum (opd|ipd|emergency)
      encounter_type: ({ outpatient: 'opd', inpatient: 'ipd', emergency: 'emergency', anc: 'opd', postnatal: 'opd', procedure: 'opd', initial_intake: 'opd' })[d.visit_type] || d.visit_type || d.encounter_type || 'opd',
      encounter_date: d.visit_date || d.encounter_date,
      queue_status: d.queue_status || d.status || 'waiting',
      status: d.status || (d.queue_status === 'closed' ? 'closed' : 'open'),
    }),
    filterMap: {
      visit_type: 'encounter_type',
      queue_status: 'queue_status',
      visit_date: 'encounter_date',
      created_date: 'created_at',
    },
  },

  LabOrder: {
    endpoint: '/lab/orders',
    fromAPI: (o) => o && ({
      ...o,
      created_date: o.created_at,
      updated_date: o.updated_at,
      // Base44 stores tests as a comma-string; FastAPI stores as items array
      tests: Array.isArray(o.items)
        ? o.items.map((i) => i.test_name || i.test_id).join(', ')
        : o.tests || '',
    }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
  },

  Drug: {
    endpoint: '/pharmacy/drugs',
    fromAPI: (d) => d && ({
      ...d,
      created_date: d.created_at,
      // Normalise stock to a single quantity_in_stock field
      quantity_in_stock: d.quantity_in_stock ??
        (Array.isArray(d.stock)
          ? d.stock.reduce((s, b) => s + (b.quantity_remaining || 0), 0)
          : 0),
    }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
  },

  Prescription: {
    endpoint: '/pharmacy/prescriptions',
    fromAPI: (p) => p && ({ ...p, created_date: p.created_at }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
  },

  PrescriptionItem: {
    endpoint: '/pharmacy/prescription-items',
    fromAPI: (i) => i && ({ ...i, created_date: i.created_at }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
  },

  Ward: {
    endpoint: '/admissions/wards',
    fromAPI: (w) => w && ({ ...w, created_date: w.created_at }),
    toAPI: (d) => d,
    filterMap: {},
  },

  Bed: {
    endpoint: '/admissions/beds',
    fromAPI: (b) => b && ({ ...b, created_date: b.created_at }),
    toAPI: (d) => d,
    filterMap: { status: 'status' },
  },

  Admission: {
    endpoint: '/admissions',
    fromAPI: (a) => a && ({
      ...a,
      created_date: a.created_at,
      // backend field is admission_date (already in the spread) — the old
      // a.admitted_at override clobbered it with undefined
    }),
    toAPI: (d) => d,
    filterMap: { created_date: 'created_at' },
    // Base44 pages use status:"active" to mean currently admitted
    preFilter: (f) => f?.status === 'active' ? { ...f, status: 'admitted' } : f,
  },

  Invoice: {
    endpoint: '/billing/invoices',
    fromAPI: (i) => i && ({
      ...i,
      total_amount: i.total ?? i.total_amount ?? 0,
      paid_amount: i.amount_paid ?? i.paid_amount ?? 0,
      net_amount: (i.total ?? i.total_amount ?? 0) - (i.balance ?? 0),
      created_date: i.created_at,
    }),
    toAPI: (d) => d,
    filterMap: { paid_amount: 'amount_paid', created_date: 'created_at', total_amount: 'total' },
  },

  Payment: {
    endpoint: '/billing/payments',
    fromAPI: (p) => p && ({
      ...p,
      payment_method: p.payment_mode ?? p.payment_method,
      payment_date: p.created_at,
      created_date: p.created_at,
    }),
    toAPI: (d) => d,
    filterMap: { payment_method: 'payment_mode', created_date: 'created_at' },
  },

  InvoiceItem: {
    endpoint: '/billing/invoice-items',
    fromAPI: (i) => i && ({ ...i, created_date: i.created_at }),
    toAPI: (d) => d,
    filterMap: {},
  },

  VitalSigns: {
    endpoint: '/nursing/vitals',
    fromAPI: (v) => v && ({
      ...v,
      created_date: v.recorded_at || v.created_at,
    }),
    toAPI: (d) => d,
    filterMap: {},
  },

  AuditLog: {
    endpoint: '/admin/audit-logs',
    fromAPI: (a) => a && ({ ...a, created_date: a.timestamp || a.created_at }),
    toAPI: (d) => d,
    filterMap: {},
  },

  // Read-only flattened view of resulted lab order items. Result *entry* still
  // flows through the normalized /lab/orders/{id}/results/{item_id} endpoint;
  // creating a LabResult directly from the Base44 page is not wired (see notes).
  LabResult: {
    endpoint: '/lab/results',
    fromAPI: (r) => r && ({ ...r, created_date: r.resulted_at || r.created_at }),
    toAPI: (d) => d,
    filterMap: {},
  },

  User: {
    endpoint: '/admin/users',
    fromAPI: (u) => u && ({
      ...u,
      created_date: u.created_at,
      name: u.full_name,
      email: u.email || `${u.employee_id}@lifecare.local`,
    }),
    toAPI: (d) => d,
    filterMap: {},
  },

  // Base44 page uses appointment_date + appointment_time + type + doctor_id;
  // FastAPI uses a single scheduled_datetime + appointment_type + provider_id.
  Appointment: {
    endpoint: '/appointments',
    updateMethod: 'patch', // backend exposes PATCH /appointments/{id}, not PUT
    fromAPI: (a) => a && ({
      ...a,
      appointment_date: a.scheduled_datetime ? String(a.scheduled_datetime).slice(0, 10) : null,
      appointment_time: a.scheduled_datetime ? String(a.scheduled_datetime).slice(11, 16) : null,
      doctor_id: a.provider_id,
      type: APPT_TYPE_FROM_API[a.appointment_type] || a.appointment_type,
      created_date: a.created_at,
      updated_date: a.updated_at,
    }),
    toAPI: (d) => {
      const out = { ...d };
      if (d.appointment_date) {
        out.scheduled_datetime = `${d.appointment_date}T${d.appointment_time || '08:00'}:00`;
      }
      if (d.type) out.appointment_type = APPT_TYPE_TO_API[d.type] || 'other';
      if ('doctor_id' in d) out.provider_id = d.doctor_id || null;
      // priority/department have no backend column and are dropped by pydantic
      delete out.appointment_date;
      delete out.appointment_time;
      delete out.type;
      delete out.doctor_id;
      return out;
    },
    filterMap: { doctor_id: 'provider_id', created_date: 'created_at' },
  },

  // Insurers and medical schemes both live in /insurance/insurers
  MedicalAidScheme: {
    endpoint: '/insurance/insurers',
    fromAPI: (i) => i && ({ ...i, scheme_name: i.name, created_date: i.created_at }),
    toAPI: (d) => ({
      name: d.scheme_name || d.name,
      payer_type: d.payer_type || 'medical_scheme',
      contact_person: d.contact_person,
      phone: d.phone,
      email: d.email,
      address: d.address,
    }),
    filterMap: {},
  },

  Consultation: {
    endpoint: '/encounters/clinical-notes',
    fromAPI: (note) => note && ({
      ...note,
      visit_id: note.encounter_id,
      doctor_id: note.author_id,
      consultation_date: note.created_at,
      created_date: note.created_at,
      is_draft: false,
      status: 'completed',
    }),
    toAPI: (data) => ({
      chief_complaint: data.chief_complaint || null,
      history_present_illness: data.history_present_illness || null,
      physical_examination: data.physical_examination || null,
      clinical_notes: data.clinical_notes || null,
      subjective: data.history_present_illness || null,
      objective: data.physical_examination || null,
      assessment: data.assessment || null,
      plan: data.plan || null,
      diagnoses: data.diagnoses || null,
    }),
    filterMap: { visit_id: 'encounter_id' },
  },
};

const APPT_TYPE_TO_API = {
  new: 'opd', follow_up: 'follow_up', review: 'follow_up', anc: 'antenatal',
  postnatal: 'other', procedure: 'procedure', surgery: 'procedure', emergency: 'other',
};
const APPT_TYPE_FROM_API = {
  opd: 'new', follow_up: 'follow_up', antenatal: 'anc',
  procedure: 'procedure', immunization: 'other', other: 'other',
};

// Entities with no FastAPI endpoint — return empty data gracefully
// (keeps UI from crashing; features gradually become available as endpoints are added)
const STUB_ENTITIES = new Set([
  'PatientJourney', 'Notification',
  'InvoiceSplit', 'PharmacyDispensing', 'ImagingOrder',
  'ImagingResult', 'SurgicalBooking', 'SurgicalChecklist', 'SurgicalRequisition',
  'SurgicalDispensing', 'SurgicalSupplyKit', 'MaternalVisit', 'NewbornRecord',
  'PartographEntry', 'WardTransfer', 'Discharge', 'Diagnosis',
  'LabReagent', 'AuditFlag', 'IncidentReport', 'DigitalSignature',
  'IPCSurveillance', 'WasteLog', 'WasteCategory', 'DeathCertificate',
  'DHIS2Export', 'DoctorSchedule', 'DoctorHandover', 'ShiftHandoverLog',
  'LoginSession', 'StaffCompliance', 'UserSecurity', 'NurseTask',
  'ClinicalTemplate', 'HandoverTemplate', 'NursingCarePlan', 'ClinicalPlan',
  'ExchangeRate', 'CashierShift',
]);

// ─── FILTER HELPERS ───────────────────────────────────────────────────────────

// Builds FastAPI query params from a Base44 filter object.
// $in operators are skipped here and handled client-side to avoid server-side
// incompatibility with comma-joined values.
function buildParams(filters, def, limit) {
  const params = {};
  if (limit) params.limit = limit;
  if (!filters) return params;

  const fm = def?.filterMap || {};
  for (const [key, val] of Object.entries(filters)) {
    const apiKey = fm[key] ?? key;
    if (val !== null && typeof val === 'object' && '$in' in val) {
      // Handled client-side after fetch
    } else if (val !== null && val !== undefined && typeof val !== 'object') {
      params[apiKey] = val;
    }
  }
  return params;
}

// Post-fetch client-side filter for $in operators.
function applyClientFilter(arr, filters, def) {
  if (!filters) return arr;
  const fm = def?.filterMap || {};
  return arr.filter((item) =>
    Object.entries(filters).every(([key, val]) => {
      if (val !== null && typeof val === 'object' && '$in' in val) {
        const apiKey = fm[key] ?? key;
        // Check both the API field name and original Base44 field name
        return val.$in.includes(item[apiKey]) || val.$in.includes(item[key]);
      }
      return true;
    })
  );
}

// ─── ENTITY HANDLER ───────────────────────────────────────────────────────────

// No-op real-time subscription. Base44 supports live entity subscriptions;
// the FastAPI backend does not (yet), so return an unsubscribe function that
// does nothing. This keeps components that call `.subscribe()` from crashing.
function noopSubscribe() {
  return () => {};
}

export class UnsupportedFeatureError extends Error {
  constructor(feature, operation) {
    super(`${feature} is not supported by the LifeCare backend (${operation})`);
    this.name = 'UnsupportedFeatureError';
    this.code = 'UNSUPPORTED_FEATURE';
  }
}

function unsupportedHandler(entityName) {
  const fail = (operation) => async () => { throw new UnsupportedFeatureError(entityName, operation); };
  return {
    // Known unsupported modules are hidden from navigation. Empty reads keep
    // optional widgets on otherwise-supported pages from taking down the page.
    list: async () => [],
    filter: async () => [],
    get: fail('get'),
    create: fail('create'),
    update: fail('update'),
    delete: fail('delete'),
    subscribe: noopSubscribe,
  };
}

function makeConsultationHandler(http) {
  const def = ENTITY_DEFS.Consultation;
  const normalise = (data) => (Array.isArray(data) ? data : []).map(def.fromAPI);
  return {
    async list(_sortBy, limit) {
      return normalise(await http.get(def.endpoint, { params: { limit: limit || 100 } }));
    },
    async filter(filters, _sortBy, limit) {
      const params = buildParams(filters, def, limit);
      return normalise(await http.get(def.endpoint, { params }));
    },
    async get(id) {
      const all = await http.get(def.endpoint, { params: { limit: 500 } });
      const found = all.find((note) => note.id === id);
      if (!found) throw new Error('Consultation not found');
      return def.fromAPI(found);
    },
    async create(body) {
      if (!body.visit_id) throw new Error('A visit is required to save a consultation');
      const data = await http.post(`/encounters/${body.visit_id}/notes`, def.toAPI(body));
      return def.fromAPI(data);
    },
    async update() { throw new UnsupportedFeatureError('Consultation', 'update; notes are append-only'); },
    async delete() { throw new UnsupportedFeatureError('Consultation', 'delete; notes are append-only'); },
    subscribe: noopSubscribe,
  };
}

function makePatientAllergyHandler(http) {
  const fromAPI = (item) => item && ({
    ...item,
    drug_name: item.allergen,
    reaction_type: item.reaction,
    created_date: item.created_at,
  });
  return {
    async list() {
      throw new Error('PatientAllergy.list requires a patient_id filter');
    },
    async filter(filters) {
      if (!filters?.patient_id) throw new Error('PatientAllergy.filter requires patient_id');
      const data = await http.get(`/patients/${filters.patient_id}/allergies`);
      return data.map(fromAPI);
    },
    async get() { throw new UnsupportedFeatureError('PatientAllergy', 'get without patient context'); },
    async create(body) {
      if (!body.patient_id) throw new Error('A patient is required to save an allergy');
      const data = await http.post(`/patients/${body.patient_id}/allergies`, {
        allergen: body.allergen || body.drug_name,
        reaction: body.reaction || body.reaction_type || null,
        severity: body.severity || 'moderate',
      });
      return fromAPI(data);
    },
    async update() { throw new UnsupportedFeatureError('PatientAllergy', 'update'); },
    async delete() { throw new UnsupportedFeatureError('PatientAllergy', 'delete'); },
    subscribe: noopSubscribe,
  };
}

function liveHandler(def, http) {
  const xform = def.fromAPI || ((x) => x);
  const toAPI = def.toAPI || ((x) => x);

  function normalise(data) {
    const arr = Array.isArray(data) ? data : (data?.items || data?.results || []);
    return arr.map(xform);
  }

  return {
    async list(_sortBy, limit) {
      const data = await http.get(def.endpoint, { params: buildParams(null, def, limit) });
      return normalise(data);
    },

    async filter(filters, _sortBy, limit) {
      const mapped = def.preFilter ? def.preFilter(filters) : filters;
      const data = await http.get(def.endpoint, { params: buildParams(mapped, def, limit) });
      return applyClientFilter(normalise(data), filters, def);
    },

    async get(id) {
      const data = await http.get(`${def.endpoint}/${id}`);
      return xform(data);
    },

    async create(body) {
      const data = await http.post(def.endpoint, toAPI(body));
      return xform(data);
    },

    async update(id, body) {
      const send = def.updateMethod === 'patch' ? http.patch : http.put;
      const data = await send(`${def.endpoint}/${id}`, toAPI(body));
      return xform(data);
    },

    async delete(id) {
      await http.del(`${def.endpoint}/${id}`);
    },

    subscribe: noopSubscribe,
  };
}

// ─── INSURANCE CLAIMS (custom handler) ───────────────────────────────────────
// The claims portal treats a claim as one record with a mutable `status`.
// The FastAPI backend models the lifecycle with dedicated endpoints
// (submit / decision / settle), so update() dispatches on the target status.

const CLAIM_STATUS_FROM_API = {
  draft: 'pending', submitted: 'submitted', approved: 'approved',
  partially_approved: 'partial', rejected: 'rejected', settled: 'paid',
};

function makeInsuranceClaimHandler(http) {
  async function loadLookups() {
    // Join insurer names and invoice→patient links client-side; both lists are
    // clinic-scale. Degrade gracefully if the caller lacks a lookup role.
    let insurers = [];
    let invoices = [];
    try { insurers = await http.get('/insurance/insurers', { params: { active_only: false } }); } catch { /**/ }
    try { invoices = await http.get('/billing/invoices', { params: { limit: 100 } }); } catch { /**/ }
    const insurerName = Object.fromEntries(insurers.map((i) => [i.id, i.name]));
    const invoicePatient = Object.fromEntries(invoices.map((i) => [i.id, i.patient_id]));
    return { insurerName, invoicePatient };
  }

  function xform(c, lookups) {
    if (!c) return c;
    return {
      ...c,
      status: CLAIM_STATUS_FROM_API[c.status] || c.status,
      claim_amount: c.claimed_amount,
      co_pay_amount: c.copay_amount,
      scheme_id: c.insurer_id,
      scheme_name: lookups?.insurerName?.[c.insurer_id],
      patient_id: lookups?.invoicePatient?.[c.invoice_id],
      submitted_date: c.submitted_at,
      created_date: c.created_at,
      updated_date: c.updated_at,
    };
  }

  async function fetchAll(limit) {
    const [claims, lookups] = await Promise.all([
      http.get('/insurance/claims', { params: { limit: limit || 100 } }),
      loadLookups(),
    ]);
    return claims.map((c) => xform(c, lookups));
  }

  return {
    list: (_sortBy, limit) => fetchAll(limit),

    async filter(filters, _sortBy, limit) {
      const all = await fetchAll(limit);
      if (!filters) return all;
      return all.filter((c) =>
        Object.entries(filters).every(([k, v]) => {
          if (v !== null && typeof v === 'object' && '$in' in v) return v.$in.includes(c[k]);
          return v === null || v === undefined || c[k] === v;
        })
      );
    },

    async get(id) {
      const [claim, lookups] = await Promise.all([
        http.get(`/insurance/claims/${id}`),
        loadLookups(),
      ]);
      return xform(claim, lookups);
    },

    async create(body) {
      let insurerId = body.scheme_id;
      if (!insurerId && body.scheme_name) {
        const matches = await http.get('/insurance/insurers', { params: { q: body.scheme_name } });
        insurerId = matches[0]?.id;
      }
      if (!insurerId) throw new Error('Select a valid insurance scheme before saving the claim');
      // claimed_amount is computed server-side as invoice total − co-payment
      const claim = await http.post('/insurance/claims', {
        invoice_id: body.invoice_id,
        insurer_id: insurerId,
        copay_amount: Number(body.co_pay_amount) || 0,
      });
      return xform(claim, null);
    },

    async update(id, body) {
      const target = body?.status;
      let claim;
      if (target === 'submitted') {
        claim = await http.post(`/insurance/claims/${id}/submit`, {});
      } else if (target === 'approved') {
        claim = await http.patch(`/insurance/claims/${id}/decision`, { status: 'approved' });
      } else if (target === 'partial') {
        if (!body.approved_amount) {
          throw new Error('Partial approval needs the approved amount from the insurer remittance');
        }
        claim = await http.patch(`/insurance/claims/${id}/decision`, {
          status: 'partially_approved',
          approved_amount: Number(body.approved_amount),
        });
      } else if (target === 'rejected') {
        claim = await http.patch(`/insurance/claims/${id}/decision`, {
          status: 'rejected',
          rejection_reason: body.rejection_reason || 'Rejected by insurer (recorded via claims portal)',
        });
      } else if (target === 'paid') {
        claim = await http.post(`/insurance/claims/${id}/settle`, {});
      } else {
        throw new Error(`Unsupported claim update: ${JSON.stringify(body)}`);
      }
      return xform(claim, null);
    },

    async delete() {
      throw new Error('Claims cannot be deleted; reject them instead');
    },

    subscribe: noopSubscribe,
  };
}

// ─── FUNCTION HANDLERS ────────────────────────────────────────────────────────

async function invokeFunction(name, params, http) {
  if (name === 'generateDailyReport') {
    const data = await http.get('/admin/stats');
    return { data };
  }

  if (name === 'checkInventoryAlerts') {
    const raw = await http.get('/pharmacy/drugs', { params: { limit: 500 } });
    const drugs = Array.isArray(raw) ? raw : (raw?.items || raw?.results || []);
    const allAlerts = [];
    let lowStock = 0;
    for (const d of drugs) {
      const qty = d.quantity_in_stock ?? (Array.isArray(d.stock) ? d.stock.reduce((s, b) => s + (b.quantity_remaining || 0), 0) : 0);
      const reorder = d.reorder_level ?? 10;
      if (qty === 0) {
        lowStock++;
        allAlerts.push({ severity: 'critical', message: `${d.name}: Out of stock` });
      } else if (qty <= reorder) {
        lowStock++;
        allAlerts.push({ severity: 'warning', message: `${d.name}: Low stock (${qty} remaining)` });
      }
    }
    return { data: { total_alerts: allAlerts.length, alerts: allAlerts, low_stock_count: lowStock, expiring_count: 0, expired_count: 0 } };
  }

  // All other Base44 serverless functions are stubs.
  // Add cases here as FastAPI equivalents are built.
  throw new UnsupportedFeatureError(`Function ${name}`, 'invoke');
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

function makeAuth(http) {
  return {
    async me() {
      if (!getToken()) {
        // Mirror the error shape AuthContext expects for auth_required
        const err = new Error('Not authenticated');
        err.status = 403;
        err.data = { extra_data: { reason: 'auth_required' } };
        throw err;
      }
      const data = await http.get('/auth/me');
      return {
        ...data,
        email: data.email || `${data.employee_id}@lifecare.local`,
      };
    },

    // Primary login method used by CustomLogin.jsx
    async login(employeeId, password) {
      const data = await http.post('/auth/login', { employee_id: employeeId, password });
      setTokens(data.access_token, data.refresh_token);
      return data;
    },

    // Called by Login.jsx (Base44's email/password flow) — treat the email field as employee_id
    async loginViaEmailPassword(email, password) {
      return this.login(email, password);
    },

    // Social/provider login is not supported in custom backend mode
    loginWithProvider(_provider, redirectUrl) {
      console.warn('[lifecare-custom] Social login unavailable in custom backend mode');
      const next = encodeURIComponent(redirectUrl || '/');
      window.location.href = `/custom-login?next=${next}`;
    },

    logout(redirectUrl) {
      clearTokens();
      // Redirect to custom login, preserving the return URL if one was provided
      window.location.href = redirectUrl
        ? `/custom-login?next=${encodeURIComponent(redirectUrl)}`
        : '/custom-login';
    },

    redirectToLogin(returnUrl) {
      // Guard against redirect loops when already on the login page
      if (window.location.pathname.startsWith('/custom-login')) return;
      const next = encodeURIComponent(returnUrl || window.location.pathname);
      window.location.href = `/custom-login?next=${next}`;
    },
  };
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export function createCustomClient(baseURL) {
  const http = makeHttp(baseURL);
  const auth = makeAuth(http);

  return {
    entities: new Proxy(
      {},
      {
        get(_, entityName) {
          if (typeof entityName !== 'string') return undefined;
          if (entityName === 'InsuranceClaim') return makeInsuranceClaimHandler(http);
          if (entityName === 'Consultation') return makeConsultationHandler(http);
          if (entityName === 'PatientAllergy') return makePatientAllergyHandler(http);
          if (STUB_ENTITIES.has(entityName)) return unsupportedHandler(entityName);
          const def = ENTITY_DEFS[entityName];
          if (!def) {
            throw new UnsupportedFeatureError(entityName, 'access');
          }
          return liveHandler(def, http);
        },
      }
    ),

    auth,

    functions: {
      invoke: (name, params) => invokeFunction(name, params, http),
    },

    integrations: {
      Core: {
        UploadFile: async ({ file }) => {
          const form = new FormData();
          form.append('file', file);
          const data = await doFetch(baseURL, '/files/upload', {
            method: 'POST',
            body: form,
          });
          return { data };
        },
      },
    },
  };
}
