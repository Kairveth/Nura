// Avatar procedural y determinista: NO es una foto, es una mancha tipo aura (la firma de Nura).
// A partir de la semilla (el user_id) sale siempre el mismo dibujo, único por persona pero on-brand.
// Decorativo (aria-hidden): no aporta información, solo da cara a la tarjeta sin usar la foto real.

// Hash entero estable desde la cadena (variante de djb2). Mismo seed = mismo número.
function hash(seed) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h;
}

const BLOBS = ['bg-nura', 'bg-dawn', 'bg-sage'];

export default function Avatar({ seed = '', className = '' }) {
  const h = hash(String(seed));
  // Cada blob toma unos bits del hash para su posición y tamaño; el orden de color rota con el seed.
  const blobs = BLOBS.map((_, i) => {
    const n = h >> (i * 7);
    return {
      color: BLOBS[(h + i) % BLOBS.length],
      top: 8 + ((n >> 0) & 7) * 7, // 8%–57%
      left: 8 + ((n >> 3) & 7) * 7,
      size: 46 + ((n >> 6) & 7) * 6 // 46%–88%
    };
  });

  return (
    <div aria-hidden="true" className={`relative overflow-hidden rounded-2xl bg-fog ${className}`}>
      <div className="animate-breathe absolute inset-0">
        {blobs.map((b, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${b.color}`}
            style={{
              top: `${b.top}%`,
              left: `${b.left}%`,
              width: `${b.size}%`,
              height: `${b.size}%`,
              filter: 'blur(18px)',
              opacity: 0.85 - i * 0.12
            }}
          />
        ))}
      </div>
    </div>
  );
}
