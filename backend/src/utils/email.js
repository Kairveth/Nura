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
      body: JSON.stringify({ from: FROM, to, subject, html })
    });
    if (!res.ok) {
      log('ERROR', 'sendEmail failed', { status: res.status, body: await res.text() });
      return false;
    }
    return true;
  } catch (err) {
    log('ERROR', 'sendEmail error', { message: err.message });
    return false;
  }
};
