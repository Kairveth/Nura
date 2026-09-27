import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AuthLayout from './components/AuthLayout';
import AppShell from './components/AppShell';
import Signup from './pages/Signup';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import ProfileCreate from './pages/ProfileCreate';
import ProfileFeed from './pages/ProfileFeed';
import MatchesList from './pages/MatchesList';
import Chat from './pages/Chat';
import './index.css';

// Un único router para toda la app: dos árboles de <BrowserRouter> distintos según isAuthenticated
// desmontaban el router entero al iniciar sesión, así que cualquier navigate() disparado en el mismo
// evento (por ejemplo tras registrarse) se perdía.
function RequireAuth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
}

// El destino tras iniciar sesión sale SOLO de aquí (isAuthenticated + justSignedUp), nunca de un
// navigate() imperativo en Signup/Login: dos mecanismos decidiendo la misma redirección competían
// entre sí (uno sobrescribía al otro) y a veces un registro nuevo acababa en /dashboard.
function RedirectIfAuthed() {
  const { isAuthenticated, justSignedUp } = useAuthStore((state) => state);
  if (!isAuthenticated) return <Outlet />;
  return <Navigate to={justSignedUp ? '/profile/create' : '/dashboard'} replace />;
}

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RedirectIfAuthed />}>
          <Route element={<AuthLayout />}>
            <Route path="/" element={<Signup />} />
            <Route path="/login" element={<Login />} />
          </Route>
        </Route>

        {/* Sin guardas: un enlace de email puede llegar con o sin sesión abierta en otra pestaña */}
        <Route element={<AuthLayout />}>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile/create" element={<ProfileCreate />} />
            <Route path="/feed" element={<ProfileFeed />} />
            <Route path="/matches" element={<MatchesList />} />
          </Route>
          {/* Sin AppShell a propósito: una conversación necesita el alto entero, no compartir la
              franja inferior fija con la barra de navegación (excepción, igual que AuthLayout). */}
          <Route path="/matches/:matchId" element={<Chat />} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
