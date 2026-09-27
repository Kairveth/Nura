import { useEffect, useState } from 'react';
import client from '../api/client';
import Field from '../components/Field';
import { useAuthStore } from '../store/authStore';

const PAGE_SIZE = 10;
const NEUROTIPO_OPTIONS = ['TDAH', 'Autismo', 'Dislexia', 'Dispraxia', 'No diagnosticado', 'Prefiero no decir'];
const validAge = (v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 18 && Number(v) <= 120;
const hasFilters = (f) => Object.values(f).some(Boolean);

// Señales de compatibilidad, calculadas aquí mismo (no hay algoritmo de recomendación en el MVP):
// hechos literales, nunca un porcentaje ni una puntuación. Máximo 2, para no saturar la tarjeta.
const compatChips = (mine, card) => {
  if (!mine) return [];
  const chips = [];
  if (mine.neurotipo && card.neurotipo === mine.neurotipo) chips.push(`Mismo neurotipo: ${card.neurotipo}`);
  if (mine.location && card.location && mine.location.trim().toLowerCase() === card.location.trim().toLowerCase()) {
    chips.push(`Misma ubicación: ${card.location}`);
  }
  if (Number.isInteger(mine.age) && Number.isInteger(card.age) && Math.abs(mine.age - card.age) <= 3) {
    chips.push('Edad parecida');
  }
  return chips.slice(0, 2);
};

export default function ProfileFeed() {
  const userId = useAuthStore((state) => state.user.id);
  const [myProfile, setMyProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipesToday, setSwipesToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [error, setError] = useState('');
  const [matchBanner, setMatchBanner] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ age_min: '', age_max: '', location: '', neurotipo: '' });

  useEffect(() => {
    client.get(`/api/profiles/${userId}`).then((res) => setMyProfile(res.data)).catch(() => {});
  }, [userId]);

  // Espera a que el usuario termine de escribir antes de pedir el feed
  useEffect(() => {
    const timer = setTimeout(() => fetchFeed(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (!matchBanner) return;
    const timer = setTimeout(() => setMatchBanner(''), 3000);
    return () => clearTimeout(timer);
  }, [matchBanner]);

  // Una página cada vez (cursor). Los perfiles ya valorados no vuelven, así que se reemplaza la
  // página en lugar de acumular: la memoria del cliente no crece con el uso.
  const fetchFeed = async (cursor = null) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE });
      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;
        if ((key === 'age_min' || key === 'age_max') && !validAge(value)) return;
        params.append(key, value);
      });
      if (cursor) params.append('cursor', cursor);

      const res = await client.get(`/api/profiles/feed?${params}`);
      setProfiles(res.data.data);
      setNextCursor(res.data.next_cursor);
      setSwipesToday(res.data.swipes_today);
      setDailyLimit(res.data.daily_limit);
      setCurrentIndex(0);
    } catch (err) {
      setError('No pudimos cargar perfiles. Inténtalo de nuevo en un momento.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action) => {
    if (currentIndex >= profiles.length || swiping) return;
    const profile = profiles[currentIndex];
    setSwiping(true);
    setError('');

    try {
      const res = await client.post('/api/swipes', { swiped_id: profile.user_id, action });
      setSwipesToday(res.data.swipes_today);

      if (res.data.match) {
        setMatchBanner(`Es un match con el perfil de ${profile.location || 'esa persona'}. Podéis empezar a escribiros.`);
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= profiles.length && nextCursor) {
        await fetchFeed(nextCursor);
      } else {
        setCurrentIndex(nextIndex);
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setSwipesToday(err.response.data.limit ?? dailyLimit);
      } else {
        setError(err.response?.data?.error === 'Already swiped this profile' ? 'Ya habías valorado este perfil.' : 'No pudimos guardar tu respuesta. Inténtalo de nuevo.');
      }
    } finally {
      setSwiping(false);
    }
  };

  const clearFilters = () => setFilters({ age_min: '', age_max: '', location: '', neurotipo: '' });
  const dailyLimitReached = swipesToday >= dailyLimit;
  const profile = profiles[currentIndex];

  return (
    <div className="mx-auto max-w-sm px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight [font-stretch:88%]">Descubrir</h1>
          <p className="mt-1 text-sm text-mute">
            {swipesToday}/{dailyLimit} hoy
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className="h-10 rounded-2xl border border-line bg-white/70 px-4 text-sm font-semibold text-ink transition-colors duration-200 hover:border-nura focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura"
        >
          Filtros{hasFilters(filters) ? ' ·' : ''}
        </button>
      </div>

      {filtersOpen && (
        <div className="mb-6 space-y-4 rounded-2xl border border-line bg-white/50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Edad mín."
              name="age_min"
              type="number"
              inputMode="numeric"
              min="18"
              max="120"
              value={filters.age_min}
              onChange={(e) => setFilters((f) => ({ ...f, age_min: e.target.value }))}
            />
            <Field
              label="Edad máx."
              name="age_max"
              type="number"
              inputMode="numeric"
              min="18"
              max="120"
              value={filters.age_max}
              onChange={(e) => setFilters((f) => ({ ...f, age_max: e.target.value }))}
            />
          </div>
          <Field
            label="Ubicación"
            name="location"
            placeholder="Ciudad o región"
            value={filters.location}
            onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
          />
          <Field as="select" label="Tipo de neurodivergencia" name="neurotipo" value={filters.neurotipo} onChange={(e) => setFilters((f) => ({ ...f, neurotipo: e.target.value }))}>
            <option value="">Todos</option>
            {NEUROTIPO_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Field>
          {hasFilters(filters) && (
            <button type="button" onClick={clearFilters} className="text-sm font-semibold text-mute underline underline-offset-4 hover:text-ink">
              Quitar filtros
            </button>
          )}
        </div>
      )}

      {matchBanner && (
        <div role="status" className="mb-4 rounded-2xl border border-sage bg-sage/15 p-4 text-sm font-semibold text-ink">
          {matchBanner}
        </div>
      )}

      <div role="alert" aria-live="polite" className="mb-2 min-h-[1.5rem] text-sm font-semibold text-alert">
        {error}
      </div>

      {loading ? (
        <p className="text-mute">Cargando…</p>
      ) : dailyLimitReached ? (
        <div className="rounded-2xl border border-line bg-white/50 p-6 text-center">
          <p className="font-semibold text-ink">Ya viste tus {dailyLimit} perfiles de hoy.</p>
          <p className="mt-2 text-sm text-mute">Vuelve mañana con la cabeza despejada: así decides mejor, no más rápido.</p>
        </div>
      ) : !profile ? (
        <div className="rounded-2xl border border-line bg-white/50 p-6 text-center">
          <p className="font-semibold text-ink">No hay más perfiles por ahora.</p>
          <p className="mt-2 text-sm text-mute">
            {hasFilters(filters) ? 'Prueba a quitar algún filtro.' : 'Vuelve más tarde: se suman perfiles nuevos.'}
          </p>
          {hasFilters(filters) && (
            <button type="button" onClick={clearFilters} className="mt-4 font-semibold text-nura underline underline-offset-4 hover:text-nura-deep">
              Quitar filtros
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="overflow-hidden rounded-2xl border border-line bg-white/70">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="" className="aspect-[4/5] w-full object-cover" />
            ) : (
              <div className="grid aspect-[4/5] w-full place-items-center bg-fog text-mute">Sin foto</div>
            )}
            <div className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xl font-semibold text-ink">
                  {profile.age} años{profile.location ? ` · ${profile.location}` : ''}
                </p>
              </div>
              <p className="mt-1 text-sm font-semibold text-mute">{profile.neurotipo}</p>

              {compatChips(myProfile, profile).length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {compatChips(myProfile, profile).map((chip) => (
                    <li key={chip} className="rounded-full border border-sage bg-sage/15 px-3 py-1 text-xs font-semibold text-ink">
                      {chip}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-4 text-ink">{profile.description}</p>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => handleSwipe('no')}
              disabled={swiping}
              className="h-12 flex-1 rounded-2xl border border-line bg-white/70 text-base font-semibold text-ink transition-colors duration-200 hover:border-nura disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura"
            >
              Pasar
            </button>
            <button
              type="button"
              onClick={() => handleSwipe('yes')}
              disabled={swiping}
              className="h-12 flex-1 rounded-2xl bg-nura text-base font-semibold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-nura-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nura"
            >
              Me interesa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
