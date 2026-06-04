import { Hono } from 'hono';
import { Env } from '../types';

export const lineWebhookRoutes = new Hono<{ Bindings: Env }>();

async function verifyLineSignature(body: string, signature: string, channelSecret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return signature === expected;
}

interface LineEvent {
  type: string;
  source?: {
    type: string;
    groupId?: string;
  };
}

interface LineWebhookBody {
  events: LineEvent[];
}

lineWebhookRoutes.post('/webhook', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('x-line-signature') ?? '';

  const secretRow = await c.env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'line_channel_secret'"
  ).first<{ value: string }>();

  if (secretRow?.value) {
    const valid = await verifyLineSignature(rawBody, signature, secretRow.value);
    if (!valid) {
      console.log('LINE webhook: invalid signature');
      return c.text('Forbidden', 400);
    }
  } else {
    console.log('LINE webhook: no channel secret configured, skipping verification');
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.text('OK', 200);
  }

  for (const event of body.events ?? []) {
    if (event.type === 'join' && event.source?.type === 'group' && event.source.groupId) {
      const groupId = event.source.groupId;
      await c.env.DB.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('line_group_id', ?)"
      ).bind(groupId).run();
      console.log(`LINE webhook: saved groupId ${groupId}`);
    }
  }

  return c.text('OK', 200);
});
