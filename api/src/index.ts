import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { apiKeyAuth } from './middleware/auth';
import { watchlistRoutes } from './routes/watchlist';
import { algorithmRoutes } from './routes/algorithms';
import { signalRoutes } from './routes/signals';
import { settingsRoutes } from './routes/settings';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', allowHeaders: ['X-API-Key', 'Content-Type'] }));
app.use('*', apiKeyAuth);

app.route('/watchlist', watchlistRoutes);
app.route('/watchlist', algorithmRoutes);
app.route('/signals', signalRoutes);
app.route('/settings', settingsRoutes);

export default app;
