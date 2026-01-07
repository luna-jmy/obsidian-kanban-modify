/**
 * GTD (Getting Things Done) workflow classifier.
 * Organizes tasks into four states:
 * - Inbox: New, unprocessed tasks
 * - NextActions: Tasks waiting for dependencies or delegated to others
 * - InProgress: Active tasks being worked on
 * - Done: Completed or cancelled tasks
 */
import { moment } from 'obsidian';
import { GTDState } from 'src/types/gtd';
import { Item } from 'src/components/types';

/**
 * Extracts the task ID from an item's metadata or title.
 */
function getTaskId(item: Item): string | undefined {
  const metadata = item.data.metadata;

  // First, try to read from inline metadata (id field)
  if (metadata.inlineMetadata) {
    const idMeta = metadata.inlineMetadata.find(
      m => m.key.toLowerCase() === 'id'
    );
    if (idMeta) {
      return String(idMeta.value);
    }
  }

  // Extract ID emoji from title (🆔 symbol)
  const match = item.data.title.match(/🆔\uFE0F?\s*([^\s]+)/);
  return match ? match[1] : undefined;
}

/**
 * Extracts the task dependency ID from an item's metadata or title.
 */
function getDependsOn(item: Item): string | undefined {
  const metadata = item.data.metadata;

  // First, try to read from inline metadata (depends_on field)
  if (metadata.inlineMetadata) {
    const depMeta = metadata.inlineMetadata.find(
      m => m.key.toLowerCase() === 'dependson' ||
           m.key.toLowerCase() === 'depends_on' ||
           m.key === '⛔'
    );
    if (depMeta) {
      return String(depMeta.value);
    }
  }

  // Extract dependency emoji from title (⛔ symbol)
  const match = item.data.title.match(/⛔\uFE0F?\s*([^\s]+)/);
  return match ? match[1] : undefined;
}

/**
 * Checks if a task has unfinished dependencies.
 */
function hasUnfinishedDependency(item: Item, allItems: Item[]): boolean {
  const dependsOn = getDependsOn(item);
  if (!dependsOn) return false;

  return allItems.some(otherItem => {
    const otherTaskId = getTaskId(otherItem);
    return otherTaskId === dependsOn && !otherItem.data.checked;
  });
}

/**
 * Checks if a task has waiting/delegated related tags.
 */
function hasWaitingTag(item: Item): boolean {
  const title = item.data.title.toLowerCase();
  const tags = item.data.metadata.tags || [];

  const waitingIndicators = ['#waiting', '#delegated', '#blocked', '#deferred'];

  // Check title
  if (waitingIndicators.some(indicator => title.includes(indicator))) {
    return true;
  }

  // Check tags
  return tags.some(tag =>
    waitingIndicators.some(indicator =>
      tag.toLowerCase().includes(indicator.slice(1))
    )
  );
}

/**
 * Checks if a task has been started.
 * A task is considered started if:
 * - It has a start date that is today or in the past
 * - It has specific tags indicating it's in progress
 * - It uses the in-progress checkbox mark [/]
 */
function isTaskStarted(item: Item): boolean {
  const title = item.data.title.toLowerCase();
  const tags = item.data.metadata.tags || [];
  const metadata = item.data.metadata;

  // Check for started/doing tags
  const startedIndicators = ['#started', '#doing', '#active', '#next', '#inprogress', '#now'];

  if (startedIndicators.some(indicator => title.includes(indicator))) {
    return true;
  }

  if (tags.some(tag =>
    startedIndicators.some(indicator =>
      tag.toLowerCase().includes(indicator.slice(1))
    )
  )) {
    return true;
  }

  // Check start date (if set and has passed)
  if (metadata.date) {
    const today = moment().startOf('day');
    if (metadata.date.isBefore(today) || metadata.date.isSame(today, 'day')) {
      return true;
    }
  }

  // Check for in-progress checkbox mark
  if (item.data.titleRaw.includes('[/]')) {
    return true;
  }

  return false;
}

/**
 * Computes the GTD state for a single task.
 */
export function getGTDState(item: Item, allItems: Item[]): GTDState {
  // Done: Completed or cancelled tasks
  if (item.data.checked) return 'Done';
  if (item.data.titleRaw.startsWith('- [-]')) return 'Done';

  // NextActions: Waiting for dependencies or delegated
  if (hasUnfinishedDependency(item, allItems) || hasWaitingTag(item)) {
    return 'NextActions';
  }

  // InProgress: Task has been started
  if (isTaskStarted(item)) {
    return 'InProgress';
  }

  // Inbox: Default state for new/unprocessed tasks
  return 'Inbox';
}

/**
 * Classification result for GTD workflow.
 */
export interface GTDClassification {
  inbox: Item[];
  nextActions: Item[];
  inProgress: Item[];
  done: Item[];
}

/**
 * Classifies a list of tasks into GTD workflow states.
 */
export function classifyGTD(items: Item[]): GTDClassification {
  const result: GTDClassification = {
    inbox: [],
    nextActions: [],
    inProgress: [],
    done: [],
  };

  for (const item of items) {
    const state = getGTDState(item, items);

    // Cache GTD state and related metadata
    item.data.metadata.gtdState = state;
    item.data.metadata.taskId = getTaskId(item);
    item.data.metadata.dependsOn = getDependsOn(item);

    // Add to appropriate bucket
    switch (state) {
      case 'Inbox':
        result.inbox.push(item);
        break;
      case 'NextActions':
        result.nextActions.push(item);
        break;
      case 'InProgress':
        result.inProgress.push(item);
        break;
      case 'Done':
        result.done.push(item);
        break;
    }
  }

  return result;
}

/**
 * Gets the display label for a GTD state.
 */
export function getGTDStateLabel(state: GTDState): string {
  const labels: Record<GTDState, string> = {
    Inbox: '收集箱',
    NextActions: '等待/授权',
    InProgress: '进行中',
    Done: '已完成',
  };
  return labels[state];
}

/**
 * Gets the display label in English for a GTD state.
 */
export function getGTDStateLabelEn(state: GTDState): string {
  const labels: Record<GTDState, string> = {
    Inbox: 'Inbox',
    NextActions: 'Waiting/Delegated',
    InProgress: 'In Progress',
    Done: 'Done',
  };
  return labels[state];
}

/**
 * Gets the icon for a GTD state.
 */
export function getGTDStateIcon(state: GTDState): string {
  const icons: Record<GTDState, string> = {
    Inbox: '📥',
    NextActions: '⏳',
    InProgress: '🔄',
    Done: '✅',
  };
  return icons[state];
}
