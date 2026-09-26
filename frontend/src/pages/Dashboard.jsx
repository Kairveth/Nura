import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-4">Bienvenido a Nura</h1>
          <p className="text-lg text-gray-600 mb-4">Email: {user?.email}</p>
          
          <button
            onClick={logout}
            className="bg-red-600 text-white px-4 py-2 rounded font-semibold hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
