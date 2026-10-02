// События редуктора (план, 13.3.3). Вид подписан на события и никогда не меняет состояние напрямую.

import type { Intent, ItemKind } from './state';

export type DenyReason = 'bedrock' | 'noSticks' | 'fuseBusy' | 'noPath' | 'liftLocked';
export type WakeCause = 'blast' | 'proximity' | 'timer' | 'vein';

export type GameEvent =
  | { type: 'STEP'; from: number; to: number; shelter: boolean }
  | { type: 'PLANTED'; cell: number; stand: number; fuseS: number }
  | { type: 'FUSE_COUNTDOWN'; n: number; cell: number }
  | { type: 'BLAST'; origin: number; cells: number[]; rays: [number, number, number, number] }
  | { type: 'ROCK_CRACKED'; cell: number }
  | { type: 'ROCK_DESTROYED'; cell: number; was: number }
  | { type: 'VEIN_OPENED'; cell: number }
  | { type: 'POCKET_OPENED'; cell: number }
  | { type: 'PICKUP'; kind: ItemKind; cell: number; itemId: number }
  | { type: 'KOBOLD_WAKE'; id: number; cause: WakeCause }
  | { type: 'KOBOLD_CROUCH'; id: number; cell: number; next: number }
  | { type: 'KOBOLD_STEP'; id: number; from: number; to: number }
  | { type: 'KOBOLD_STUNNED'; id: number; cell: number }
  | { type: 'KOBOLD_RECOVERED'; id: number; anger: number }
  | { type: 'KOBOLD_ANGER'; id: number; anger: number }
  | { type: 'CAUGHT'; id: number; cell: number }
  | { type: 'HERO_BLASTED'; cell: number }
  | { type: 'ESCAPED'; score: number; stars: 0 | 1 | 2 | 3; close: boolean }
  | { type: 'DENIED'; reason: DenyReason; cell: number }
  | { type: 'INTENT'; intent: Intent; auto: boolean }
  | { type: 'READY' }
  | { type: 'ACTION_SPENT' }
  | { type: 'ANSWERED'; correct: boolean; timeMs: number; fuseBurning: boolean }
  | { type: 'NO_SHELTER'; cell: number }
  | { type: 'PAUSED' }
  | { type: 'RESUMED' };

export type GameEventType = GameEvent['type'];
