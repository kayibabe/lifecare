"""Create clearly labelled demo data for local/UAT analysis.

Run only against a disposable or explicitly designated demo database:
    python seed_demo_data.py

The script is idempotent by the Demo prefix and covers the persisted core
reporting modules: patients, encounters, drugs, stock, lab tests/orders,
prescriptions/items, wards/beds, and invoices. It never runs automatically.
"""
import asyncio
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.patient import Patient, Gender, BloodGroup
from app.models.encounter import Encounter, EncounterType, EncounterStatus
from app.models.pharmacy import Drug, DrugForm, DrugStock, Prescription, PrescriptionItem, PrescriptionStatus
from app.models.lab import LabTest, LabOrder, LabOrderStatus, LabPriority, LabOrderItem
from app.models.admission import Ward, WardType, Bed, BedStatus
from app.models.billing import BillingInvoice, InvoiceStatus, PaymentMode


def uid(): return str(uuid.uuid4())


async def seed():
    async with AsyncSessionLocal() as db:
        admin = (await db.execute(select(User).where(User.role == UserRole.admin))).scalars().first()
        if not admin:
            raise RuntimeError("Create an admin user first (run seed_admin.py); no demo data was written")
        existing = (await db.execute(select(Patient).where(Patient.first_name.like("Demo%")))).scalars().all()
        if existing:
            print(f"Demo data already exists ({len(existing)} demo patients); nothing changed")
            return

        now = datetime.now(timezone.utc)
        patients = []
        for i in range(10):
            patients.append(Patient(id=uid(), mrn=f"DEMO-{i + 1:05d}", first_name=f"Demo{i + 1}", last_name=["Banda", "Phiri", "Mbewe", "Chirwa", "Kumwenda"][i % 5], date_of_birth=date(1980 + i, (i % 12) + 1, (i % 25) + 1), gender=Gender.female if i % 2 else Gender.male, blood_group=[BloodGroup.O_POS, BloodGroup.A_POS, BloodGroup.B_POS][i % 3], phone=f"09990000{i:02d}", district=["Blantyre", "Lilongwe", "Mzuzu"][i % 3], known_allergies="penicillin" if i in (2, 7) else None, chronic_conditions="hypertension" if i in (1, 6) else None, consent_given=True, consent_date=now, created_at=now - timedelta(days=(i * 3) % 31)))
        db.add_all(patients)
        await db.flush()

        encounters = [Encounter(id=uid(), patient_id=p.id, encounter_type=EncounterType.emergency if i == 3 else EncounterType.opd, encounter_date=now - timedelta(days=(i * 2) % 30), status=EncounterStatus.closed if i % 3 else EncounterStatus.open, queue_status="closed" if i % 3 else "waiting", chief_complaint=["Fever", "Cough", "Malaria review", "Injury", "Antenatal review"][i % 5], created_by=admin.id) for i, p in enumerate(patients)]
        db.add_all(encounters)

        drug_specs = [("Paracetamol 500mg", "Analgesic", 120, 20), ("Amoxicillin 500mg", "Antibiotic", 8, 15), ("ORS Sachets", "Rehydration", 0, 20), ("Artemether/Lumefantrine", "Antimalarial", 45, 10), ("Salbutamol Inhaler", "Respiratory", 12, 10), ("Metformin 500mg", "Diabetes", 28, 10), ("Amlodipine 10mg", "Cardiovascular", 6, 12), ("Insulin Regular", "Diabetes", 18, 8), ("Hydrocortisone Cream", "Dermatology", 33, 10), ("Gentamicin Injection", "Antibiotic", 0, 5)]
        drugs = [Drug(id=uid(), name=n, generic_name=n.split()[0], category=c, form=DrugForm.injection if "Injection" in n or "Insulin" in n else DrugForm.tablet, strength=None, unit_of_measure="units", unit_price=Decimal("250.00"), reorder_level=rl, is_controlled=False) for n, c, qty, rl in drug_specs]
        db.add_all(drugs)
        await db.flush()
        db.add_all([DrugStock(id=uid(), drug_id=d.id, batch_number=f"DEMO-B{i + 1:02d}", expiry_date=date.today() + timedelta(days=[420, 90, 30, 210, 18, 500, 75, 300, 150, 12][i]), quantity_received=max(qty, 1), quantity_current=qty, purchase_price=Decimal("100.00"), supplier="Demo Supplier", received_date=date.today() - timedelta(days=15)) for i, (d, (_, _, qty, _)) in enumerate(zip(drugs, drug_specs))])

        tests = [LabTest(id=uid(), name=n, code=f"DEMO-L{i + 1:02d}", category="Routine", sample_type="blood", price=Decimal("1000.00")) for i, n in enumerate(["Full Blood Count", "Malaria Parasite", "Blood Glucose", "Urinalysis", "HIV Test", "Liver Function", "Renal Function", "Pregnancy Test", "Widal Test", "Sickle Cell"])]
        db.add_all(tests)
        await db.flush()
        orders = [LabOrder(id=uid(), encounter_id=e.id, patient_id=e.patient_id, ordered_by_id=admin.id, order_date=e.encounter_date, status=[LabOrderStatus.ordered, LabOrderStatus.resulted, LabOrderStatus.verified][i % 3], priority=LabPriority.urgent if i == 3 else LabPriority.routine, notes="DEMO record") for i, e in enumerate(encounters)]
        db.add_all(orders)
        await db.flush()
        db.add_all([LabOrderItem(id=uid(), lab_order_id=o.id, test_id=tests[i].id, sample_type="blood") for i, o in enumerate(orders)])

        prescriptions = [Prescription(id=uid(), encounter_id=e.id, patient_id=e.patient_id, prescribed_by_id=admin.id, prescribed_at=e.encounter_date, status=PrescriptionStatus.dispensed if i % 2 else PrescriptionStatus.active, notes="DEMO record") for i, e in enumerate(encounters)]
        db.add_all(prescriptions)
        await db.flush()
        db.add_all([PrescriptionItem(id=uid(), prescription_id=r.id, drug_id=drugs[i].id, dose="1 tablet", frequency="twice daily", route="oral", quantity=10, dispensed_quantity=10 if i % 2 else 0, is_dispensed=i % 2 == 1) for i, r in enumerate(prescriptions)])

        wards = [Ward(id=uid(), name=f"Demo Ward {i + 1}", ward_type=[WardType.general, WardType.maternity, WardType.pediatric][i % 3], total_beds=1, floor="1") for i in range(10)]
        db.add_all(wards)
        await db.flush()
        db.add_all([Bed(id=uid(), ward_id=w.id, bed_number=f"D{i + 1:02d}", status=BedStatus.occupied if i % 3 == 0 else BedStatus.available) for i, w in enumerate(wards)])
        db.add_all([BillingInvoice(id=uid(), invoice_number=f"DEMO-INV-{i + 1:04d}", patient_id=p.id, encounter_id=e.id, invoice_date=e.encounter_date, payment_mode=PaymentMode.cash, subtotal=Decimal("5000.00"), total=Decimal("5000.00"), amount_paid=Decimal("5000.00"), balance=Decimal("0.00"), status=InvoiceStatus.paid, created_by_id=admin.id, notes="DEMO record") for i, (p, e) in enumerate(zip(patients, encounters))])
        await db.commit()
        print("Created demo data: 10 patients, encounters, lab orders/tests, drugs/stock, prescriptions/items, wards/beds, and invoices")


if __name__ == "__main__":
    # psycopg's async driver does not support Windows' default Proactor loop.
    # Use a selector loop for this standalone script while leaving the app's
    # normal server startup unchanged.
    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(seed())
        finally:
            loop.close()
    else:
        asyncio.run(seed())
