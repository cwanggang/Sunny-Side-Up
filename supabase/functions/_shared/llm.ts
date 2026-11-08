// B3.5: the only place LLM calls happen. Every call has a timeout and a fallback, so a slow or
// failing model never breaks a push or a screen.
//
// Models: LLM_MODEL (default claude-haiku-5-5: fast, cheap) for nudge wording;
// LLM_MODEL_IDEAS (default: LLM_MODEL) for hangout ideas — set it to claude-sonnet-5-5 if the
// ideas need more quality.
//
// PRIVACY (plan §9.4): wordNudge() takes ONLY a first name and a circle name. It has no
// parameter for why the nudge exists, so drift and cover nudges are guaranteed to use the
// exact same prompt and inputs. Never pass signals, scores, or is_quiet to the model.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.3.0/helpers/zod';
import { z } from 'npm:zod@4.6.7';
import type { HangoutIdea } from './contract.ts';

const DEFAULT_MODEL = 'claude-haiku-5-5';
const TIMEOUT_MS = 8_000;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  // Reads ANTHROPIC_API_KEY (a Supabase secret). One retry on 429/5xx/connection errors.
  client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  return client;
}

const nudgeModel = () => Deno.env.get('LLM_MODEL') || DEFAULT_MODEL;
const ideasModel = () => Deno.env.get('LLM_MODEL_IDEAS') || nudgeModel();

// ---------------------------------------------------------------- nudges

const NUDGE_SYSTEM = `You write one short push notification for a friend-circle app.
It gently encourages the reader to reach out to a friend.

Rules:
- One sentence, under 90 characters. Casual, warm, a little playful.
- Name the friend. You may mention the circle name.
- Never use pronouns for the friend (no he, she, him, her, his, hers, they, them). Use their name.
- Suggest a tiny action (send an egg, a photo, a voice memo, a quick text) or just catching up.
- Never imply anything is wrong. Never mention mood, health, worry, absence, silence,
  being quiet, being alone, or how long it has been.
- No hashtags, no quotation marks. At most one emoji.
Vary the wording; don't always start the same way.`;

const NudgeSchema = z.object({ message: z.string() });

// Words that would hint at *why* someone was nudged, or label them. Any hit -> fallback text.
// Pronouns for the friend: we don't know anyone's pronouns, so the name is always used instead.
const PRONOUNS = /\b(he|she|him|her|his|hers)\b/i;
const BANNED = /\b(lonely|alone|depress\w*|sad|worr\w*|quiet|silen\w*|absent|missing|okay\?|ok\?|check(ing)? (in|on)|haven'?t heard|been a while)\b/i;

const NUDGE_FALLBACKS = [
  (n: string) => `Haven't caught up with ${n} lately? Send an egg 🥚`,
  (n: string) => `${n} would love a hello from you today`,
  (n: string) => `Send ${n} a quick photo of your day 📷`,
  (n: string) => `Voice memo for ${n}? Even 10 seconds counts`,
];
const fallbackNudge = (firstName: string) =>
  NUDGE_FALLBACKS[Math.floor(Math.random() * NUDGE_FALLBACKS.length)](firstName);

/** Wording for any nudge. Same prompt for every reason, by construction (see header). */
export async function wordNudge(input: { firstName: string; circleName: string }): Promise<string> {
  const firstName = input.firstName.trim().split(/\s+/)[0] || 'your friend';
  try {
    const res = await anthropic().messages.parse({
      model: nudgeModel(),
      max_tokens: 2000,
      output_config: { effort: 'low', format: zodOutputFormat(NudgeSchema) },
      system: NUDGE_SYSTEM,
      messages: [
        { role: 'user', content: `Friend's first name: ${firstName}\nCircle name: ${input.circleName}` },
      ],
    });
    if (res.stop_reason === 'refusal') return fallbackNudge(firstName);
    const text = res.parsed_output?.message.replace(/["“”]/g, '').trim();
    if (!text || text.length > 120 || BANNED.test(text) || PRONOUNS.test(text) || !text.includes(firstName)) {
      return fallbackNudge(firstName);
    }
    return text;
  } catch (err) {
    logLlmError('wordNudge', err);
    return fallbackNudge(firstName);
  }
}

// ---------------------------------------------------------------- hangout ideas

const IDEAS_SYSTEM = `You suggest hangout ideas for a small group of friends.
Return exactly 3 ideas. Each has:
- title: short and specific (under 40 characters)
- why: one sentence on why it suits this group and day
- where: a kind of place or a well-known public spot in their area (never a private address)
Mix it up: one low-effort, one active or outdoors, one a bit special. Budget-friendly.
If you don't know the area well, suggest kinds of places rather than inventing venue names.`;

const IdeasSchema = z.object({
  ideas: z.array(z.object({ title: z.string(), why: z.string(), where: z.string() })),
});

export function fallbackIdeas(homeArea: string | null): HangoutIdea[] {
  const area = homeArea?.trim() || 'your area';
  return [
    { title: 'Potluck dinner', why: 'Everyone brings one dish, nobody has to plan much.', where: "Whoever's place is biggest" },
    { title: 'Sunset walk', why: 'Easy to fit in and good for actually talking.', where: `A park or trail near ${area}` },
    { title: 'Coffee + bookstore crawl', why: 'Low cost and you can drop in or out.', where: `Downtown ${area}` },
  ];
}

export async function hangoutIdeas(input: {
  memberCount: number;
  homeArea: string | null;
  dayOfWeek: string;
}): Promise<HangoutIdea[]> {
  try {
    const res = await anthropic().messages.parse({
      model: ideasModel(),
      max_tokens: 4000,
      output_config: { effort: 'low', format: zodOutputFormat(IdeasSchema) },
      system: IDEAS_SYSTEM,
      messages: [{
        role: 'user',
        content: `Group size: ${input.memberCount}\nHome area: ${input.homeArea?.trim() || 'not set'}\nDay: ${input.dayOfWeek}`,
      }],
    });
    if (res.stop_reason === 'refusal') return fallbackIdeas(input.homeArea);
    const ideas = (res.parsed_output?.ideas ?? [])
      .filter((i) => i.title.trim() && i.why.trim() && i.where.trim())
      .slice(0, 3);
    return ideas.length === 3 ? ideas : fallbackIdeas(input.homeArea);
  } catch (err) {
    logLlmError('hangoutIdeas', err);
    return fallbackIdeas(input.homeArea);
  }
}

// ---------------------------------------------------------------- profile fact ideas
// Design v0.4: playful "about me" categories. Input is ONLY the category names the person already
// has (never their answers), so nothing personal reaches the model.

const FACT_SYSTEM = `You suggest playful "about me" profile categories for a cozy app where close
friends share one photo a day. Reply with 6 short lowercase category names, 2 to 4 words each,
all different from the ones the person already has. Examples: celebrity crush, current go-to song,
comfort food, hidden talent. Keep them light and friendly; nothing about health, money, politics,
religion, relationships status, or anything sensitive.`;

const FactSchema = z.object({ ideas: z.array(z.string()) });

export const FACT_IDEAS_FALLBACK = [
  'celebrity crush', 'current go-to song', 'comfort food', 'hidden talent', 'dream trip', 'go-to karaoke song',
  'most used emoji', 'unpopular opinion', 'morning or night person', 'last show i binged', 'pet peeve',
  'coffee order', 'first concert', 'favorite smell', 'childhood nickname', 'snack of choice',
];

function shuffled<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** 6 category ideas not already in `have`. `source` says whether Claude or the built-in list answered. */
export async function factIdeas(have: string[]): Promise<{ ideas: string[]; source: 'claude' | 'list' }> {
  const known = new Set(have.map((h) => h.toLowerCase().trim()));
  const fallback = () => ({ ideas: shuffled(FACT_IDEAS_FALLBACK.filter((x) => !known.has(x))).slice(0, 6), source: 'list' as const });
  try {
    const res = await anthropic().messages.parse({
      model: nudgeModel(),
      max_tokens: 1000,
      output_config: { effort: 'low', format: zodOutputFormat(FactSchema) },
      system: FACT_SYSTEM,
      messages: [{ role: 'user', content: `They already have: ${[...known].join(', ') || 'nothing yet'}` }],
    });
    if (res.stop_reason === 'refusal') return fallback();
    const ideas = [...new Set((res.parsed_output?.ideas ?? [])
      .map((x) => x.toLowerCase().trim().replace(/[."]/g, ''))
      .filter((x) => x && x.length <= 32 && !known.has(x)))].slice(0, 6);
    return ideas.length >= 3 ? { ideas, source: 'claude' } : fallback();
  } catch (err) {
    logLlmError('factIdeas', err);
    return fallback();
  }
}

// ---------------------------------------------------------------- errors

function logLlmError(where: string, err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error(`${where}: Anthropic key rejected (check ANTHROPIC_API_KEY secret)`);
  } else if (err instanceof Anthropic.RateLimitError) {
    console.error(`${where}: rate limited, using fallback`);
  } else if (err instanceof Anthropic.APIConnectionTimeoutError) {
    console.error(`${where}: timed out after ${TIMEOUT_MS} ms, using fallback`);
  } else if (err instanceof Anthropic.APIError) {
    console.error(`${where}: API error ${err.status}: ${err.message}`);
  } else {
    console.error(`${where}: unexpected error`, err);
  }
}
