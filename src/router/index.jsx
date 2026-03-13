import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth, RequireRole } from './guards'
import AppLayout from '@/components/layout/AppLayout'
import AuthLayout from '@/components/layout/AuthLayout'
import LoginPage from '@/modules/auth/LoginPage'
import DashboardPage from '@/modules/dashboard/DashboardPage'
import CompaniesPage from '@/modules/companies/CompaniesPage'
import MessagesPage from '@/modules/messages/MessagesPage'
import MessageDetailPage from '@/modules/messages/MessageDetailPage'
import JobsPage from '@/modules/jobs/JobsPage'
import AlertsPage from '@/modules/alerts/AlertsPage'
import AdminUsersPage from '@/modules/admin/users/AdminUsersPage'
import AdminCertificatesPage from '@/modules/admin/certificates/AdminCertificatesPage'

export function AppRouter() {
  return (
    <Routes>
      {/* Rotas publicas */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Rotas protegidas */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route
          path="/companies/:contratoId/messages"
          element={<MessagesPage />}
        />
        <Route
          path="/companies/:contratoId/messages/:messageId"
          element={<MessageDetailPage />}
        />

        {/* operator+ */}
        <Route
          path="/jobs"
          element={
            <RequireRole roles={['operator', 'admin', 'owner']}>
              <JobsPage />
            </RequireRole>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireRole roles={['operator', 'admin', 'owner']}>
              <AlertsPage />
            </RequireRole>
          }
        />

        {/* admin+ */}
        <Route
          path="/admin/users"
          element={
            <RequireRole roles={['admin', 'owner']}>
              <AdminUsersPage />
            </RequireRole>
          }
        />
        <Route
          path="/admin/certificates"
          element={
            <RequireRole roles={['admin', 'owner']}>
              <AdminCertificatesPage />
            </RequireRole>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
