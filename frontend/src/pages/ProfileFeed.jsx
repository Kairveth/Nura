import { useState, useEffect } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function ProfileFeed() {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    age_min: '',
    age_max: '',
    location: '',
    neurotipo: ''
  });

  useEffect(() => {
    fetchFeed();
  }, [filters]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const res = await client.get(`/api/profiles/feed?${params}`);
      setProfiles(res.data);
      setCurrentIndex(0);
    } catch (err) {
      toast.error('Error loading profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action) => {
    if (currentIndex >= profiles.length) {
      toast.info('No más perfiles disponibles');
      return;
    }

    const profile = profiles[currentIndex];

    try {
      const res = await client.post('/api/swipes', {
        swiped_id: profile.user_id,
        action
      });

      if (res.data.match) {
        toast.success('¡Match! 💚');
      } else {
        toast.success(action === 'yes' ? '✓' : '✕', { duration: 500 });
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= profiles.length) {
        toast.info('Alcanzaste el final del feed');
      }
      setCurrentIndex(nextIndex);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error en swipe');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Cargando...</div>;
  }

  if (profiles.length === 0 || currentIndex >= profiles.length) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen space-y-4">
        <h2 className="text-2xl font-bold">No hay más perfiles</h2>
        <button
          onClick={() => setCurrentIndex(0)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Reiniciar feed
        </button>
      </div>
    );
  }

  const profile = profiles[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Filtros */}
      <div className="bg-white p-4 border-b flex gap-2 overflow-x-auto">
        <input
          type="number"
          placeholder="Edad min"
          value={filters.age_min}
          onChange={(e) => setFilters(prev => ({ ...prev, age_min: e.target.value }))}
          className="px-3 py-1 border rounded text-sm"
        />
        <input
          type="number"
          placeholder="Edad max"
          value={filters.age_max}
          onChange={(e) => setFilters(prev => ({ ...prev, age_max: e.target.value }))}
          className="px-3 py-1 border rounded text-sm"
        />
        <select
          value={filters.neurotipo}
          onChange={(e) => setFilters(prev => ({ ...prev, neurotipo: e.target.value }))}
          className="px-3 py-1 border rounded text-sm"
        >
          <option value="">Todos neurotipo</option>
          <option value="TDAH">TDAH</option>
          <option value="Autismo">Autismo</option>
          <option value="Dislexia">Dislexia</option>
        </select>
      </div>

      {/* Profile Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-lg shadow-lg overflow-hidden">
          {profile.photo_url && (
            <img
              src={profile.photo_url}
              alt={profile.user_id}
              className="w-full h-96 object-cover"
            />
          )}
          <div className="p-6">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-2xl font-bold">{profile.age}</h2>
              <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
                {profile.neurotipo}
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-2">{profile.location}</p>
            <p className="text-gray-700 line-clamp-3">{profile.description}</p>
          </div>
        </div>
      </div>

      {/* Swipe Buttons */}
      <div className="bg-white border-t p-4 flex gap-4 justify-center">
        <button
          onClick={() => handleSwipe('no')}
          className="bg-red-500 text-white px-8 py-3 rounded-full text-xl font-bold hover:bg-red-600"
        >
          ✕
        </button>
        <button
          onClick={() => handleSwipe('yes')}
          className="bg-green-500 text-white px-8 py-3 rounded-full text-xl font-bold hover:bg-green-600"
        >
          ✓
        </button>
      </div>
    </div>
  );
}
