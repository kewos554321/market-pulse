import { Resend } from 'resend';

export interface SignalSummary {
  symbol: string;
  name: string;
  closePrice: number;
  triggeredConditions: string[];
}

export async function sendSignalEmail(
  apiKey: string,
  toEmails: string[],
  date: string,
  signals: SignalSummary[]
): Promise<void> {
  const resend = new Resend(apiKey);

  const listHtml = signals
    .map(
      (s) => `
      <li style="margin-bottom:12px">
        <strong>${s.symbol} ${s.name}</strong><br/>
        收盤價：${s.closePrice}<br/>
        觸發條件：${s.triggeredConditions.join(', ')}
      </li>`
    )
    .join('');

  await resend.emails.send({
    from: 'Market Pulse <onboarding@resend.dev>',
    to: toEmails,
    subject: `[Market Pulse] ${date} 發現 ${signals.length} 支符合條件的標的`,
    html: `
      <h2>今日觸發訊號 (${date})</h2>
      <ul style="padding-left:20px">${listHtml}</ul>
      <hr/>
      <small>由 Market Pulse 自動發送</small>
    `,
  });
}
