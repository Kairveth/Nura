import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import toast from 'react-hot-toast';

const NEUROTIPO_OPTIONS = ['TDAH', 'Autismo', 'Dislexia', 'Dispraxia', 'No diagnosticado', 'Prefiero no decir'];

export default function ProfileCreate() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: '',
    age: '',
    location: '',
    neurotipo: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'description' && value.length > 200) return;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await client.post('/api/profiles', form);
      toast.success('Perfil creado');
      setAuth(user, useAuthStore.getState().token);
      navigate('/feed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-8">Completa tu Perfil</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción (máx 200 caracteres)
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Cuéntanos sobre ti..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="4"
              required
            />
            <p className="text-xs text-gray-500 mt-1">{form.description.length}/200</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Edad</label>
            <input
              type="number"
              name="age"
              value={form.age}
              onChange={handleChange}
              min="18"
              max="120"
              placeholder="Tu edad"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ubicación</label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="Ciudad o región"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo Neurodivergencia</label>
            <select
              name="neurotipo"
              value={form.neurotipo}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Selecciona...</option>
              {NEUROTIPO_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Crear Perfil'}
          </button>
        </form>
      </div>
    </div>
  );
}
