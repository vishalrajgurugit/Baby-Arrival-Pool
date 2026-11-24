import {collection, live, rpc, db} from './server.ts';

type Confirmation = {reference:string; name:string; email:string; day:number; period:string; secondDay?:number; secondPeriod?:string; giftRequested:boolean};
export type EmailStatus = 'disabled'|'submitted'|'already_requested'|'unavailable';

export function confirmationText(entry: Confirmation, giftsOpen: boolean, recipient?: string) {
  const lines = [
    `Hello ${entry.name},`, '',
    entry.secondDay ? 'Your two predictions for Mahuvagara Baby Arrival Pool are saved.' : 'Your prediction for Mahuvagara Baby Arrival Pool is saved.',
    `Prediction: January ${entry.day}, 2027 · ${entry.period} (Toronto time)`,
    ...(entry.secondDay ? [`Second prediction: January ${entry.secondDay}, 2027 · ${entry.secondPeriod} (Toronto time)`] : []),
    `Confirmation reference: ${entry.reference}`, '',
  ];
  if (entry.giftRequested && giftsOpen && recipient) {
    lines.push(`Send $5 CAD by Interac e-Transfer to ${recipient}.`,
      entry.secondDay ? 'This single $5 gift covers both predictions. Include your confirmation reference in the transfer message.' : 'Include your confirmation reference in the transfer message.',
      'The organizer will confirm receipt manually. This email is not a payment receipt.',
      'All gifts go to the baby. There are no monetary prizes.');
  } else if (!entry.giftRequested) {
    lines.push(entry.secondDay ? 'No payment is due for these predictions.' : 'No payment is due for this prediction.');
  } else {
    lines.push('Gift instructions are currently unavailable. Please check with the organizer.');
  }
  lines.push('', 'Thank you for celebrating with our family!');
  return lines.join('\n');
}

// Claim once in PostgreSQL before contacting the provider. Never automatically retry
// uncertain deliveries: provider idempotency expires, while this durable claim does not.
export async function sendPredictionEmail(entry: Confirmation): Promise<EmailStatus> {
  if (!live() || process.env.EMAIL_ENABLED !== 'true') return 'disabled';
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || /[\r\n]/.test(from)) return 'unavailable';
  let claimed = false;
  try {
    claimed = await rpc<boolean>('claim_prediction_email', {p_reference:entry.reference});
    if (!claimed) return 'already_requested';
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST', signal:AbortSignal.timeout(5000),
      headers:{'Authorization':'Bearer ' + apiKey, 'Content-Type':'application/json',
        'Idempotency-Key':'prediction/' + entry.reference},
      body:JSON.stringify({from, to:[entry.email], subject:'Your Mahuvagara Baby Arrival Pool prediction',
        text:confirmationText(entry, collection(), process.env.INTERAC_TRANSFER_EMAIL)}),
    });
    const result = response.ok ? await response.json() : null;
    const accepted = typeof result?.id === 'string' && result.id.length > 0;
    // If bookkeeping fails after acceptance, retain the permanent claim and do not resend.
    await db('prediction_email_delivery?reference=eq.' + encodeURIComponent(entry.reference), 'PATCH', {
      status:accepted ? 'submitted':'failed', provider_id:accepted ? result.id:null,
    }).catch(() => {});
    return accepted ? 'submitted':'unavailable';
  } catch {
    if (claimed) {
      await db('prediction_email_delivery?reference=eq.' + encodeURIComponent(entry.reference), 'PATCH',
        {status:'unknown'}).catch(() => {});
    }
    return 'unavailable';
  }
}
