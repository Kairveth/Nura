import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

const POLL_MS = 2000;
const MEETUP_THRESHOLD = 5; // US-010: sugerir quedar a partir de este número de mensajes
const MAX_MESSAGE_LENGTH = 2000;

// Chat es una pantalla aparte, sin la barra inferior de AppShell: aquí solo importa la conversación
// (igual que el flujo de auth tiene su propio espacio, sin competir por la misma franja fija).
export default function Chat() {
  const { matchId } = useParams();
  const myId = useAuthStore((state) => state.user.id);
  const [match, setMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [meetupDismissed, setMeetupDismissed] = useState(() => localStorage.getItem(`meetup-dismissed-${matchId}`) === '1');
  const listRef = useRef(null);
  const latestIdRef = useRef(null);

  useEffect(() => {
    client
      .get(`/api/swipes/matches/${matchId}`)
      .then((res) => setMatch(res.data))
      .catch(() => setError('No pudimos abrir este match.'));
  }, [matchId]);

  const loadMessages = async () => {
    try {
      const res = await client.get(`/api/matches/${matchId}/messages?limit=50`);
      const ordered = [...res.data.data].reverse(); // el servidor manda más reciente primero
      setMessages(ordered);
      latestIdRef.current = ordered[ordered.length - 1]?.id ?? null;
      client.post(`/api/matches/${matchId}/read`).catch(() => {});
    } catch (err) {
      setError('No pudimos cargar la conversación.');
    } finally {
      setLoading(false);
    }
  };

  // Polling cada 2s (MVP: sin WebSocket). Se detiene si la pestaña está en segundo plano.
  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => {
      if (!document.hidden) loadMessages();
    }, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const dismissMeetup = () => {
    localStorage.setItem(`meetup-dismissed-${matchId}`, '1');
    setMeetupDismissed(true);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      await client.post(`/api/matches/${matchId}/messages`, { content });
      setDraft('');
      await loadMessages();
    } catch (err) {
      setError(
        err.response?.status === 429
          ? 'Vas muy rápido. Espera un momento y vuelve a probar.'
          : err.response?.data?.error || 'No pudimos enviar el mensaje.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-fog">
      <header className="flex items-center gap-3 border-b border-line bg-fog/95 px-4 py-3 backdrop-blur">
        <Link
          to="/matches"
          aria-label="Volver a Matches"
          className="rounded-lg px-1 text-xl font-semibold text-mute hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-nura"
        >
          ←
        </Link>
        {match ? (
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">
              {match.age} años{match.location ? ` · ${match.location}` : ''}
            </p>
            <p className="text-xs text-mute">{(match.neurotipos ?? []).join(' · ')}</p>
          </div>
        ) : (
          <p className="text-mute">Cargando…</p>
        )}
      </header>

      {!meetupDismissed && messages.length >= MEETUP_THRESHOLD && (
        <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-2xl border border-sage bg-sage/15 p-3 text-sm text-ink">
          <p>Lleváis unos cuantos mensajes. Si os apetece, es buen momento para proponer quedar.</p>
          <button type="button" onClick={dismissMeetup} aria-label="Cerrar aviso" className="shrink-0 font-semibold text-mute hover:text-ink">
            ✕
          </button>
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-mute">Cargando…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-mute">Todavía no hay mensajes. Escribe el primero.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
              <p
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.sender_id === myId ? 'bg-nura text-white' : 'border border-line bg-white/70 text-ink'
                }`}
              >
                {m.content}
              </p>
            </div>
          ))
        )}
      </div>

      <div role="alert" aria-live="polite" className="min-h-[1.25rem] px-4 text-sm font-semibold text-alert">
        {error}
      </div>

      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-line bg-fog/95 p-3 backdrop-blur">
        <label className="sr-only" htmlFor="chat-draft">
          Mensaje
        </label>
        <textarea
          id="chat-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) handleSend(e);
          }}
          placeholder="Escribe un mensaje…"
          rows={1}
          className="h-12 max-h-32 flex-1 resize-none rounded-2xl border border-line bg-white/70 px-4 py-3 text-base text-ink outline-none focus:border-nura focus:ring-4 focus:ring-nura/20"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="h-12 shrink-0 rounded-2xl bg-nura px-5 text-base font-semibold text-white transition-colors duration-200 hover:bg-nura-deep disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nura"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
