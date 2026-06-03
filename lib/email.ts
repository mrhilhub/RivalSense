import { Resend } from 'resend';

export async function sendAlert(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_FROM_EMAIL) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from: process.env.ALERT_FROM_EMAIL, to, subject, html });
}
