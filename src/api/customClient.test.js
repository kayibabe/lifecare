/**
 * Adapter regression tests (audit N9/H1): the FastAPI adapter must map
 * backend field names to the names the pages actually read.
 */
import { describe, it, expect, vi } from 'vitest';
import { createCustomClient, ENTITY_DEFS, formatApiError, UnsupportedFeatureError } from './customClient';

describe('Admission mapping', () => {
  it('preserves the backend admission_date (regression: admitted_at override)', () => {
    const out = ENTITY_DEFS.Admission.fromAPI({
      id: 'a1',
      admission_date: '2026-07-01T08:00:00Z',
      created_at: '2026-07-01T08:00:00Z',
    });
    expect(out.admission_date).toBe('2026-07-01T08:00:00Z');
    expect(out.created_date).toBe('2026-07-01T08:00:00Z');
  });
});

describe('Invoice mapping', () => {
  it('maps backend total → total_amount and computes net_amount without NaN', () => {
    const out = ENTITY_DEFS.Invoice.fromAPI({
      id: 'i1',
      total: 5000,
      amount_paid: 2000,
      balance: 3000,
      created_at: '2026-07-01T08:00:00Z',
    });
    expect(out.total_amount).toBe(5000);
    expect(out.paid_amount).toBe(2000);
    expect(out.net_amount).toBe(2000); // total - balance
    expect(Number.isNaN(out.net_amount)).toBe(false);
  });
});

describe('Visit mapping', () => {
  it('maps encounter fields to the visit names pages read', () => {
    const out = ENTITY_DEFS.Visit.fromAPI({
      id: 'v1',
      encounter_type: 'opd',
      encounter_date: '2026-07-01T08:00:00Z',
      status: 'open',
      created_at: '2026-07-01T08:00:00Z',
      updated_at: '2026-07-01T09:00:00Z',
    });
    expect(out.visit_type).toBe('opd');
    expect(out.visit_date).toBe('2026-07-01T08:00:00Z');
    expect(out.queue_status).toBe('open');
  });
});

describe('Appointment mapping', () => {
  it('splits scheduled_datetime into the date/time fields the page reads', () => {
    const out = ENTITY_DEFS.Appointment.fromAPI({
      id: 'ap1',
      scheduled_datetime: '2026-07-18T09:30:00+00:00',
      appointment_type: 'antenatal',
      provider_id: 'doc-1',
      status: 'scheduled',
      created_at: '2026-07-04T08:00:00Z',
      updated_at: '2026-07-04T08:00:00Z',
    });
    expect(out.appointment_date).toBe('2026-07-18');
    expect(out.appointment_time).toBe('09:30');
    expect(out.doctor_id).toBe('doc-1');
    expect(out.type).toBe('anc');
  });

  it('combines the form fields into scheduled_datetime and maps the type enum', () => {
    const out = ENTITY_DEFS.Appointment.toAPI({
      patient_id: 'p1',
      appointment_date: '2026-07-18',
      appointment_time: '09:30',
      type: 'surgery',
      doctor_id: '',
      notes: 'theatre slot',
    });
    expect(out.scheduled_datetime).toBe('2026-07-18T09:30:00');
    expect(out.appointment_type).toBe('procedure');
    expect(out.provider_id).toBeNull();
    expect(out.appointment_date).toBeUndefined();
    expect(out.type).toBeUndefined();
  });
});

describe('MedicalAidScheme mapping', () => {
  it('maps insurer name to scheme_name', () => {
    const out = ENTITY_DEFS.MedicalAidScheme.fromAPI({
      id: 's1', name: 'MASM', payer_type: 'medical_scheme',
      created_at: '2026-07-04T08:00:00Z',
    });
    expect(out.scheme_name).toBe('MASM');
  });
  it('defaults payer_type to medical_scheme on create', () => {
    const out = ENTITY_DEFS.MedicalAidScheme.toAPI({ scheme_name: 'Liberty Health' });
    expect(out.name).toBe('Liberty Health');
    expect(out.payer_type).toBe('medical_scheme');
  });
});

describe('formatApiError', () => {
  it('formats FastAPI 422 detail arrays', () => {
    const err = { data: { detail: [{ loc: ['body', 'amount'], msg: 'must be greater than 0' }] } };
    expect(formatApiError(err)).toBe('amount: must be greater than 0');
  });
  it('passes through string detail', () => {
    expect(formatApiError({ data: { detail: 'Insufficient stock' } })).toBe('Insufficient stock');
  });
  it('falls back to the error message', () => {
    expect(formatApiError(new Error('boom'))).toBe('boom');
  });
});

describe('consultation mapping', () => {
  it('maps all clinical fields without discarding the diagnosis payload', () => {
    const input = {
      visit_id: 'enc-1', chief_complaint: 'Fever', history_present_illness: 'Three days',
      physical_examination: 'Temp 38.4', assessment: 'Malaria', plan: 'Treat',
      clinical_notes: 'Safety net', diagnoses: [{ code: 'B54', label: 'Malaria' }],
    };
    expect(ENTITY_DEFS.Consultation.toAPI(input)).toEqual({
      chief_complaint: 'Fever', history_present_illness: 'Three days',
      physical_examination: 'Temp 38.4', clinical_notes: 'Safety net',
      subjective: 'Three days', objective: 'Temp 38.4', assessment: 'Malaria',
      plan: 'Treat', diagnoses: [{ code: 'B54', label: 'Malaria' }],
    });
  });
});

describe('unsupported features fail closed', () => {
  it('rejects writes instead of fabricating a successful record', async () => {
    const client = createCustomClient('http://localhost/api/v1');
    await expect(client.entities.DeathCertificate.create({ patient_id: 'p1' }))
      .rejects.toBeInstanceOf(UnsupportedFeatureError);
  });

  it('rejects unknown entities immediately', () => {
    const client = createCustomClient('http://localhost/api/v1');
    expect(() => client.entities.DoesNotExist).toThrow(UnsupportedFeatureError);
  });
});

describe('persisted clinical handlers', () => {
  const response = (body) => ({
    ok: true,
    status: 201,
    headers: { get: () => 'application/json' },
    json: async () => body,
  });

  it('posts allergy capture to the selected patient endpoint', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
    const fetchMock = vi.fn().mockResolvedValue(response({
      id: 'a1', patient_id: 'p1', allergen: 'Penicillin', reaction: 'Rash', severity: 'severe',
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createCustomClient('http://localhost/api/v1');

    const saved = await client.entities.PatientAllergy.create({
      patient_id: 'p1', drug_name: 'Penicillin', reaction_type: 'Rash', severity: 'severe',
    });

    expect(saved.allergen).toBe('Penicillin');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/v1/patients/p1/allergies',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ allergen: 'Penicillin', reaction: 'Rash', severity: 'severe' }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it('posts consultations to the encounter notes endpoint', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
    const fetchMock = vi.fn().mockResolvedValue(response({
      id: 'n1', encounter_id: 'enc-1', author_id: 'doc-1', created_at: '2026-09-14T06:00:00Z',
      chief_complaint: 'Fever', diagnoses: [],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createCustomClient('http://localhost/api/v1');

    const saved = await client.entities.Consultation.create({ visit_id: 'enc-1', chief_complaint: 'Fever' });

    expect(saved.visit_id).toBe('enc-1');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost/api/v1/encounters/enc-1/notes');
    vi.unstubAllGlobals();
  });
});
