import { Resend } from 'resend';
import type { ConditionLeaf, ConditionTree } from './types.js';

type Condition = ConditionLeaf | ConditionTree;

function isTree(c: Condition): c is ConditionTree {
  return 'operator' in c;
}

function describeLeaf(c: ConditionLeaf): string {
  switch (c.indicator) {
    case 'RSI':
      return `RSI(14) ${c.op} ${c.value}`;
    case 'CLOSE':
      if (c.ref === 'MA') return `收盤 ${c.op} MA${c.period ?? 20}`;
      return `收盤 ${c.op} ${c.value}`;
    case 'MA':
      return `MA${c.period ?? 20} ${c.op} ${c.value}`;
    case 'VOLUME':
      if (c.ref === 'MA_VOLUME') return `成交量 ${c.op} 均量×${c.multiplier ?? 1}`;
      return `成交量 ${c.op} ${c.value}`;
    case 'MACD_CROSS':
      return c.direction === 'golden' ? 'MACD 黃金交叉' : 'MACD 死亡交叉';
    case 'KD_CROSS':
      return c.direction === 'golden' ? 'KD 黃金交叉' : 'KD 死亡交叉';
    case 'MA_CROSS':
      return c.direction === 'golden' ? 'MA5/20 黃金交叉' : 'MA5/20 死亡交叉';
    case 'BB_LOWER':
      return '收盤 ≤ 布林下軌';
    case 'BB_UPPER':
      return '收盤 ≥ 布林上軌';
    default:
      return (c as ConditionLeaf).indicator;
  }
}

export function describeConditionTree(condition: Condition): string[] {
  if (isTree(condition)) {
    return condition.conditions.flatMap((c) => describeConditionTree(c));
  }
  return [describeLeaf(condition)];
}

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
