import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const PatientListPage = lazy(() => import('./pages/reception/PatientListPage'))
const RegisterPatientPage = lazy(() => import('./pages/reception/RegisterPatientPage'))
const PatientDetailPage = lazy(() => import('./pages/reception/PatientDetailPage'))
const EncounterListPage = lazy(() => import('./pages/opd/EncounterListPage'))
const NewEncounterPage = lazy(() => import('./pages/opd/NewEncounterPage'))
const EncounterDetailPage = lazy(() => import('./pages/opd/EncounterDetailPage'))
const TriagePage = lazy(() => import('./pages/opd/TriagePage'))
const InvoiceListPage = lazy(() => import('./pages/billing/InvoiceListPage'))
const CreateInvoicePage = lazy(() => import('./pages/billing/CreateInvoicePage'))
const InvoiceDetailPage = lazy(() => import('./pages/billing/InvoiceDetailPage'))
const LabOrderListPage = lazy(() => import('./pages/lab/LabOrderListPage'))
const NewLabOrderPage = lazy(() => import('./pages/lab/NewLabOrderPage'))
const LabOrderDetailPage = lazy(() => import('./pages/lab/LabOrderDetailPage'))
const DrugListPage = lazy(() => import('./pages/pharmacy/DrugListPage'))
const PrescriptionQueuePage = lazy(() => import('./pages/pharmacy/PrescriptionQueuePage'))
const DispensePage = lazy(() => import('./pages/pharmacy/DispensePage'))
const WardViewPage = lazy(() => import('./pages/ipd/WardViewPage'))
const AdmitPatientPage = lazy(() => import('./pages/ipd/AdmitPatientPage'))
const AdmissionDetailPage = lazy(() => import('./pages/ipd/AdmissionDetailPage'))
const NursingStationPage = lazy(() => import('./pages/nursing/NursingStationPage'))
const RecordVitalsPage = lazy(() => import('./pages/nursing/RecordVitalsPage'))
const MARPage = lazy(() => import('./pages/nursing/MARPage'))
const UserListPage = lazy(() => import('./pages/admin/UserListPage'))
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'))

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" role="status" aria-label="Loading page">
      <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

        {/* Reception */}
        <Route path="/reception" element={<ProtectedRoute><PatientListPage /></ProtectedRoute>} />
        <Route path="/reception/register" element={<ProtectedRoute><RegisterPatientPage /></ProtectedRoute>} />
        <Route path="/reception/patients/:patientId" element={<ProtectedRoute><PatientDetailPage /></ProtectedRoute>} />

        {/* OPD */}
        <Route path="/opd" element={<ProtectedRoute><EncounterListPage /></ProtectedRoute>} />
        <Route path="/opd/new" element={<ProtectedRoute><NewEncounterPage /></ProtectedRoute>} />
        <Route path="/opd/:encounterId" element={<ProtectedRoute><EncounterDetailPage /></ProtectedRoute>} />
        <Route path="/opd/:encounterId/triage" element={<ProtectedRoute><TriagePage /></ProtectedRoute>} />

        {/* Billing */}
        <Route path="/billing" element={<Navigate to="/billing/invoices" replace />} />
        <Route path="/billing/invoices" element={<ProtectedRoute><InvoiceListPage /></ProtectedRoute>} />
        <Route path="/billing/invoices/new" element={<ProtectedRoute><CreateInvoicePage /></ProtectedRoute>} />
        <Route path="/billing/invoices/:id" element={<ProtectedRoute><InvoiceDetailPage /></ProtectedRoute>} />

        {/* Lab */}
        <Route path="/lab" element={<Navigate to="/lab/orders" replace />} />
        <Route path="/lab/orders" element={<ProtectedRoute><LabOrderListPage /></ProtectedRoute>} />
        <Route path="/lab/orders/new" element={<ProtectedRoute><NewLabOrderPage /></ProtectedRoute>} />
        <Route path="/lab/orders/:id" element={<ProtectedRoute><LabOrderDetailPage /></ProtectedRoute>} />

        {/* Pharmacy */}
        <Route path="/pharmacy" element={<Navigate to="/pharmacy/drugs" replace />} />
        <Route path="/pharmacy/drugs" element={<ProtectedRoute><DrugListPage /></ProtectedRoute>} />
        <Route path="/pharmacy/prescriptions" element={<ProtectedRoute><PrescriptionQueuePage /></ProtectedRoute>} />
        <Route path="/pharmacy/prescriptions/:id/dispense" element={<ProtectedRoute><DispensePage /></ProtectedRoute>} />

        {/* IPD */}
        <Route path="/ipd" element={<ProtectedRoute><WardViewPage /></ProtectedRoute>} />
        <Route path="/ipd/admit" element={<ProtectedRoute><AdmitPatientPage /></ProtectedRoute>} />
        <Route path="/ipd/:admissionId" element={<ProtectedRoute><AdmissionDetailPage /></ProtectedRoute>} />

        {/* Nursing */}
        <Route path="/nursing" element={<ProtectedRoute><NursingStationPage /></ProtectedRoute>} />
        <Route path="/nursing/vitals" element={<ProtectedRoute><RecordVitalsPage /></ProtectedRoute>} />
        <Route path="/nursing/mar" element={<ProtectedRoute><MARPage /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
        <Route path="/admin/users" element={<ProtectedRoute><UserListPage /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
