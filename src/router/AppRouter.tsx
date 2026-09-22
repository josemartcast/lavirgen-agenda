import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FullPageSpinner } from '../components/ui/Spinner';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthLayout } from '../components/layout/AuthLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { OnboardingPage } from '../features/auth/OnboardingPage';
import { AgendaPage } from '../features/agenda/AgendaPage';
import { AppointmentForm } from '../features/agenda/AppointmentForm';
import { ClientsPage } from '../features/clients/ClientsPage';
import { ClientDetailPage } from '../features/clients/ClientDetailPage';
import { ServicesPage } from '../features/services/ServicesPage';
import { ConfigPage } from '../features/config/ConfigPage';
import { SchedulePage } from '../features/config/SchedulePage';
import { ClosuresPage } from '../features/config/ClosuresPage';

function ProtectedRoute({ children, ownerOnly = false }: { children: React.ReactNode; ownerOnly?: boolean }) {
  const { user, userDoc, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (ownerOnly && userDoc?.role !== 'owner') return <Navigate to="/agenda" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, userDoc, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (userDoc?.role === 'owner' && !userDoc.onboardingDone) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/agenda" replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route path="/onboarding" element={
          <ProtectedRoute ownerOnly>
            <OnboardingPage />
          </ProtectedRoute>
        } />

        <Route element={<AppLayout />}>
          <Route path="/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
          <Route path="/cita/nueva" element={<ProtectedRoute><AppointmentForm /></ProtectedRoute>} />
          <Route path="/cita/:id/editar" element={<ProtectedRoute><AppointmentForm /></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
          <Route path="/clientes/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
          <Route path="/servicios" element={<ProtectedRoute ownerOnly><ServicesPage /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute><ConfigPage /></ProtectedRoute>} />
          <Route path="/configuracion/horario" element={<ProtectedRoute ownerOnly><SchedulePage /></ProtectedRoute>} />
          <Route path="/configuracion/cierres" element={<ProtectedRoute ownerOnly><ClosuresPage /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
