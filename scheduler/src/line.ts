import axios from 'axios';
import type { SignalSummary } from './notify.js';

function buildMessageText(date: string, signals: SignalSummary[]): string {
  const lines = [
    `📊 Market Pulse｜${date}`,
    `共 ${signals.length} 支標的觸發條件：`,
    '',
    ...signals.map(
      (s) =>
        `・${s.symbol} ${s.name}  ${s.closePrice}\n  條件：${s.triggeredConditions.join(', ')}`
    ),
  ];
  return lines.join('\n');
}

export async function sendLineGroupMessage(
  channelAccessToken: string,
  groupId: string,
  date: string,
  signals: SignalSummary[]
): Promise<void> {
  const text = buildMessageText(date, signals);
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    {
      to: groupId,
      messages: [{ type: 'text', text }],
    },
    {
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}
