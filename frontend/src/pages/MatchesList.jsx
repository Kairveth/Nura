import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export default function MatchesList() {
  const [matches, setMatches] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMatches();
  }, []);

  // Paginado por cursor: 10 matches por petición, "Ver más" pide la siguiente página
  const fetchMatches = async (cursor = null) => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: 10 });
      if (cursor) params.append('cursor', cursor);
      const res = await client.get(`/api/swipes/matches?${params}`);
      setMatches((prev) => (cursor ? [...prev, ...res.data.data] : res.data.data));
      setNextCursor(res.data.next_cursor);
    } catch (err) {
      setError('No pudimos cargar tus matches. Inténtalo de nuevo en un momento.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    setLoadingMore(true);
    fetchMatches(nextCursor);
  };

  return (
    <div className="mx-auto max-w-sm px-6 py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight [font-stretch:88%]">Tus matches</h1>

      <div role="alert" aria-live="polite" className="mt-2 min-h-[1.5rem] text-sm font-semibold text-alert">
        {error}
      </div>

      {loading ? (
        <p className="mt-4 text-mute">Cargando…</p>
      ) : matches.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-white/50 p-6 text-center">
          <p className="font-semibold text-ink">Todavía no tienes matches.</p>
          <p className="mt-2 text-sm text-mute">Cuando dos personas se dicen "me interesa", aparece aquí.</p>
          <Link to="/feed" className="mt-4 inline-block font-semibold text-nura underline underline-offset-4 hover:text-nura-deep">
            Ir a Descubrir
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {matches.map((match) => (
              <li key={match.id} className="rounded-2xl border border-line bg-white/70 p-4">
                <div className="flex gap-4">
                  {match.photo_url ? (
                    <img src={match.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-fog text-xs text-mute">Sin foto</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink">
                        {match.age} años{match.location ? ` · ${match.location}` : ''}
                      </p>
                      {match.unread_count > 0 && (
                        <span className="rounded-full bg-nura px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${match.unread_count} mensajes sin leer`}>
                          +{match.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-mute">{match.description}</p>
                    <p className="mt-1 text-xs text-mute">Match del {dateFmt.format(new Date(match.created_at))}</p>
                  </div>
                </div>
                <Link
                  to={`/matches/${match.id}`}
                  className="mt-3 block h-10 w-full rounded-2xl border border-line text-center text-sm font-semibold leading-10 text-ink transition-colors duration-200 hover:border-nura focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura"
                >
                  Escribir
                </Link>
              </li>
            ))}
          </ul>

          {nextCursor && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 h-12 w-full rounded-2xl border border-line bg-white/70 text-base font-semibold text-ink transition-colors duration-200 hover:border-nura disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura"
            >
              {loadingMore ? 'Cargando…' : 'Ver más'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
