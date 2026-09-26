import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function MatchesList() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const res = await client.get('/api/swipes/matches');
      setMatches(res.data);
    } catch (err) {
      toast.error('Error loading matches');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Cargando...</div>;
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen space-y-4">
        <h2 className="text-2xl font-bold">Sin matches aún</h2>
        <p className="text-gray-600">Vuelve al feed y haz algunos swipes 💚</p>
        <button
          onClick={() => navigate('/feed')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Ir al feed
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Mis Matches 💚</h1>

        <div className="grid gap-4">
          {matches.map(match => (
            <div
              key={match.id}
              onClick={() => navigate(`/chat/${match.id}`)}
              className="bg-white p-4 rounded-lg shadow hover:shadow-lg cursor-pointer transition"
            >
              <div className="flex gap-4">
                {match.photo_url && (
                  <img
                    src={match.photo_url}
                    alt="match"
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{match.age}</h3>
                  <p className="text-gray-600 text-sm">{match.description}</p>
                  <p className="text-gray-500 text-xs mt-1">Matched {new Date(match.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
