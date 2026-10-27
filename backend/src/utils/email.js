import { log } from './logger.js';

// Envío por Resend vía fetch directo (sin su SDK): una sola llamada HTTP, no vale la pena una
// dependencia más para esto. En el dominio de pruebas (`onboarding@resend.dev`) Resend solo entrega
// al email de la propia cuenta; con dominio verificado, `EMAIL_FROM` se cambia y ya llega a cualquiera.
const FROM = process.env.EMAIL_FROM || 'Nura <onboarding@resend.dev>';

export const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    log('ERROR', 'sendEmail skipped: RESEND_API_KEY missing');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
      signal: AbortSignal.timeout(10_000) // un proveedor colgado no puede dejar peticiones esperando para siempre
    });
    if (!res.ok) {
      // Solo el tipo de error: el cuerpo de Resend puede repetir la dirección de destino (PII en los logs)
      const name = await res.json().then((b) => b?.name).catch(() => undefined);
      log('ERROR', 'sendEmail failed', { status: res.status, name });
      return false;
    }
    return true;
  } catch (err) {
    log('ERROR', 'sendEmail error', { message: err.message });
    return false;
  }
};
