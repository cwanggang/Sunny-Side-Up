// Copy of the parts of shared/api.ts that Edge Functions need (plan.md §11 fallback):
// the function bundler only ships files inside supabase/functions/, and shared/api.ts imports
// database.types without a .ts extension, which Deno can't resolve.
// RULE: any change to shared/api.ts must be mirrored here in the same commit.

export const DEMO_KEY_HEADER = 'x-demo-key';

export type PushType = 'interaction' | 'nudge' | 'share_open' | 'spotlight' | 'birthday' | 'moment';

export interface PushPayload {
  type: PushType;
  circle_id: string;
  target_id?: string;
}

export interface HangoutIdeasRequest {
  circle_id: string;
}
export interface HangoutIdea {
  title: string;
  why: string;
  where: string;
}
export interface HangoutIdeasResponse {
  ideas: HangoutIdea[];
}

export interface DeleteAccountResponse {
  ok: true;
}

export interface DemoRunResponse {
  ok: boolean;
  summary: string;
}

export const MEDIA_BUCKET = 'media';
