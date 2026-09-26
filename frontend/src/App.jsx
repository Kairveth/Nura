import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AuthLayout from './components/AuthLayout';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProfileCreate from './pages/ProfileCreate';
import ProfileFeed from './pages/ProfileFeed';
import MatchesList from './pages/MatchesList';
import './index.css';

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/" element={<Signup />} />
            <Route path="/login" element={<Login />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile/create" element={<ProfileCreate />} />
        <Route path="/feed" element={<ProfileFeed />} />
        <Route path="/matches" element={<MatchesList />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}