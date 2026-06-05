import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { apiKeyAuth } from './middleware/auth';
import { watchlistRoutes } from './routes/watchlist';
import { algorithmRoutes } from './routes/algorithms';
import { signalRoutes } from './routes/signals';
import { settingsRoutes } from './routes/settings';
import { recommendationStocksRoutes } from './routes/recommendation-stocks';
import { recommendationsRoutes } from './routes/recommendations';
import { emailRecipientsRoutes } from './routes/emailRecipients';
import { lineWebhookRoutes } from './routes/lineWebhook';
import { groupRoutes } from './routes/groups';
import { fxDailyRoutes } from './routes/fx-daily';
import { algorithmTemplateRoutes } from './routes/algorithm-templates';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', allowHeaders: ['X-API-Key', 'Content-Type'] }));
app.use('*', apiKeyAuth);

app.route('/watchlist', watchlistRoutes);
app.route('/watchlist', algorithmRoutes);
app.route('/signals', signalRoutes);
app.route('/settings', settingsRoutes);
app.route('/recommendation-stocks', recommendationStocksRoutes);
app.route('/recommendations', recommendationsRoutes);
app.route('/email-recipients', emailRecipientsRoutes);
app.route('/line', lineWebhookRoutes);
app.route('/groups', groupRoutes);
app.route('/algorithm-templates', algorithmTemplateRoutes);
app.route('/fx-daily', fxDailyRoutes);

export default app;
