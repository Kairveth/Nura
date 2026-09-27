import { Link } from 'react-router-dom';

const LINKS = [
  ['/feed', 'Descubrir', 'Perfiles nuevos, de uno en uno. Hasta 15 al día.'],
  ['/matches', 'Tus matches', 'Las personas con las que hicisteis match.']
];

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-sm px-6 py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight [font-stretch:88%]">Hola de nuevo</h1>
      <p className="mt-2 text-mute">¿Qué te apetece hacer hoy?</p>

      <div className="mt-8 space-y-3">
        {LINKS.map(([to, title, text]) => (
          <Link
            key={to}
            to={to}
            className="block rounded-2xl border border-line bg-white/70 p-4 transition-colors duration-200 hover:border-nura focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nura"
          >
            <p className="font-semibold text-ink">{title}</p>
            <p className="mt-0.5 text-sm text-mute">{text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
