/**
 * GTD (Getting Things Done) workflow state types.
 * Defines the four main states in the GTD flow.
 */
export type GTDState = 'Inbox' | 'NextActions' | 'InProgress' | 'Done';

/**
 * Human-readable labels for GTD states in Chinese.
 */
export const GTD_STATE_LABELS: Record<GTDState, string> = {
  Inbox: '收集箱',
  NextActions: '等待/授权',
  InProgress: '进行中',
  Done: '已完成',
};

/**
 * Icons representing each GTD state.
 */
export const GTD_STATE_ICONS: Record<GTDState, string> = {
  Inbox: '📥',
  NextActions: '⏳',
  InProgress: '🔄',
  Done: '✅',
};

/**
 * English labels for GTD states.
 */
export const GTD_STATE_LABELS_EN: Record<GTDState, string> = {
  Inbox: 'Inbox',
  NextActions: 'Waiting/Delegated',
  InProgress: 'In Progress',
  Done: 'Done',
};

/**
 * Checks if a GTD state represents an active (not completed) task.
 */
export function isActiveGTDState(state: GTDState): boolean {
  return state === 'Inbox' || state === 'NextActions' || state === 'InProgress';
}

/**
 * Checks if a GTD state represents a completed task.
 */
export function isCompletedGTDState(state: GTDState): boolean {
  return state === 'Done';
}

/**
 * Gets the next GTD state in the workflow.
 * Inbox -> InProgress -> Done
 * NextActions -> InProgress -> Done
 */
export function getNextGTDState(state: GTDState): GTDState | null {
  switch (state) {
    case 'Inbox':
      return 'InProgress';
    case 'NextActions':
      return 'InProgress';
    case 'InProgress':
      return 'Done';
    case 'Done':
      return null;
  }
}
