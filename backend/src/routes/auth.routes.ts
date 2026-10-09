import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { AUTH_COOKIE, setSessionCookie, signSession, signState, upsertGoogleUser, verifyState } from '../auth/auth';

const router = Router();

const google = () =>
  new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: `${config.BACKEND_URL}/auth/google/callback`,
  });

const loginError = (msg: string) => `${config.FRONTEND_URL}/login?error=${encodeURIComponent(msg)}`;

// Step 1: redirect the browser to Google's consent screen.
router.get('/google', (_req, res) => {
  if (!config.GOOGLE_CLIENT_ID) return res.redirect(loginError('Google OAuth is not configured on the server'));
  const url = google().generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state: signState({ purpose: 'google-login' }),
  });
  res.redirect(url);
});

// Step 2: Google redirects back with ?code -> exchange, verify the ID token, create the session.
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error) return res.redirect(loginError(error));
    if (!code || !state) return res.redirect(loginError('Missing OAuth code'));
    verifyState<{ purpose: string }>(state);

    const client = google();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: config.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) return res.redirect(loginError('Google did not return a profile'));

    const user = await upsertGoogleUser({
      googleId: p.sub,
      email: p.email,
      name: p.name ?? p.email,
      avatar: p.picture ?? null,
    });
    setSessionCookie(res, signSession(user.id));
    res.redirect(`${config.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error('[auth] google callback failed', err);
    res.redirect(loginError('Google login failed'));
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ ok: true });
});

export default router;
