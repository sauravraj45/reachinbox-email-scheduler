import { redis } from '../lib/redis';

const HOUR_MS = 60 * 60 * 1000;
const KEY_TTL_S = 2 * 60 * 60;

const hourWindow = (ts = Date.now()) => Math.floor(ts / HOUR_MS);
export const windowStart = (w: number) => w * HOUR_MS;

/**
 * Atomically reserve one send slot in the current clock-hour window for BOTH:
 *   - the sender      (cap: MAX_EMAILS_PER_HOUR_PER_SENDER, shared by every campaign/user)
 *   - the campaign    (cap: the "hourly limit" chosen in the compose form)
 * Nothing is incremented unless both have room, so a rejected attempt never
 * consumes quota. Being a single Lua script, it is safe across any number of
 * worker processes / concurrent jobs.
 *
 * Returns { ok, scope, count } where scope says which limit blocked (or was just reached).
 */
const RESERVE_LUA = `
local s = tonumber(redis.call('GET', KEYS[1]) or '0')
local c = tonumber(redis.call('GET', KEYS[2]) or '0')
local sLimit = tonumber(ARGV[1])
local cLimit = tonumber(ARGV[2])
if s >= sLimit then return {0, 1, s} end
if c >= cLimit then return {0, 2, c} end
s = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
c = redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], ARGV[3])
local reached = 0
if s >= sLimit then reached = 1 elseif c >= cLimit then reached = 2 end
return {1, reached, s}
`;

/**
 * Per-sender minimum gap between sends. Reserves the next free send slot
 * (max(now, last + gap)) and returns how long the caller must wait for it.
 * Concurrent workers get consecutive slots, so sends from one sender are
 * always at least \`gap\` ms apart regardless of concurrency.
 */
const GAP_LUA = `
local now = tonumber(ARGV[1])
local gap = tonumber(ARGV[2])
local last = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = now
if last + gap > now then slot = last + gap end
redis.call('SET', KEYS[1], slot, 'PX', gap + 60000)
return slot - now
`;

/** Order-preserving slot in the next window: earlier overflow gets an earlier slot. */
const NEXT_SLOT_LUA = `
local n = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[1])
return n
`;

export type LimitScope = 'sender' | 'campaign';

export interface ReserveResult {
  ok: boolean;
  /** limit that blocked this reservation, or that this reservation just filled */
  scope: LimitScope | null;
  count: number;
}

export async function reserveHourlySlot(p: {
  senderId: number;
  campaignId: string;
  senderLimit: number;
  campaignLimit: number;
}): Promise<ReserveResult & { window: number }> {
  const window = hourWindow();
  const res = (await redis.eval(
    RESERVE_LUA,
    2,
    `rl:sender:${p.senderId}:${window}`,
    `rl:campaign:${p.campaignId}:${window}`,
    p.senderLimit,
    p.campaignLimit,
    KEY_TTL_S,
  )) as [number, number, number];
  const scope = res[1] === 1 ? 'sender' : res[1] === 2 ? 'campaign' : null;
  return { ok: res[0] === 1, scope, count: res[2], window };
}

export async function reserveSendGap(senderId: number, gapMs: number): Promise<number> {
  if (gapMs <= 0) return 0;
  return Number(await redis.eval(GAP_LUA, 1, `rl:gap:${senderId}`, Date.now(), gapMs));
}

/**
 * When a limit is hit the job is pushed into the next hour window. Each deferred
 * job takes the next sequential slot (spaced by gapMs) so the original order is
 * preserved and the next hour isn't hit by a thundering herd at :00.
 */
export async function nextWindowSlot(scopeKey: string, currentWindow: number, gapMs: number): Promise<number> {
  const next = currentWindow + 1;
  const n = Number(await redis.eval(NEXT_SLOT_LUA, 1, `rl:resched:${scopeKey}:${next}`, KEY_TTL_S));
  return windowStart(next) + (n - 1) * Math.max(gapMs, 100);
}

/** True only for the first caller per (scope, window, user): used to send one Slack alert. */
export async function shouldNotify(key: string): Promise<boolean> {
  return (await redis.set(`rl:notified:${key}`, '1', 'EX', KEY_TTL_S, 'NX')) === 'OK';
}
