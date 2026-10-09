import { Router } from 'express';
import { config } from '../config';
import { requireAuth, signState, verifyState } from '../auth/auth';
import { exchangeSlackCode, slackAuthorizeUrl, slackConfigured } from '../services/slack.service';

/** Browser-facing OAuth redirects (mounted at /slack). JSON endpoints live in api.routes. */
const router = Router();

const back = (status: string) => `${config.FRONTEND_URL}/dashboard?slack=${encodeURIComponent(status)}`;

router.get('/connect', requireAuth, (req, res) => {
  if (!slackConfigured()) return res.redirect(back('not_configured'));
  res.redirect(slackAuthorizeUrl(signState({ uid: req.user!.id, purpose: 'slack' })));
});

// Note: this request may arrive through an HTTPS tunnel (Slack requires HTTPS redirect
// URIs), so the session cookie may be absent; the signed `state` identifies the user.
router.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  if (error) return res.redirect(back(error));
  if (!code || !state) return res.redirect(back('missing_code'));
  try {
    const { uid } = verifyState<{ uid: string }>(state);
    await exchangeSlackCode(uid, code);
    res.redirect(back('connected'));
  } catch (err) {
    console.error('[slack] oauth callback failed', err);
    res.redirect(back('error'));
  }
});

export default router;
