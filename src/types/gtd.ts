/**
 * GTD 状态枚举
 */

export enum GTDState {
  Inbox = 'inbox',
  Next = 'next',
  Waiting = 'waiting',
  Done = 'done',
}

export const GTD_STATE_ICON_MAP: Record<GTDState, string> = {
  [GTDState.Inbox]: '📥',
  [GTDState.Next]: '🔄',
  [GTDState.Waiting]: '⏳',
  [GTDState.Done]: '✅',
};
