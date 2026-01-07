/**
 * Eisenhower Matrix drag-and-drop handlers.
 * Handles priority and date updates when items are dragged between quadrants.
 */
import { moment } from 'obsidian';
import { EisenhowerPriority, EISENHOWER_PRIORITY_ICON_MAP } from 'src/types/priority';
import { Item } from 'src/components/types';
import { StateManager } from 'src/StateManager';
import { BoardModifiers } from 'src/helpers/boardModifiers';

export interface EisenhowerDropData {
  isImportant: boolean;
  isUrgent: boolean;
}

/**
 * Handles dropping an item into an Eisenhower quadrant.
 * Updates the item's priority and due date based on the quadrant.
 *
 * @param item - The item being dropped
 * @param dropData - The quadrant data (isImportant, isUrgent)
 * @param stateManager - The state manager instance
 * @param boardModifiers - The board modifiers instance
 * @returns The updated item data
 */
export function handleEisenhowerDrop(
  item: Item,
  dropData: EisenhowerDropData,
  stateManager: StateManager,
  boardModifiers: BoardModifiers
): Partial<Item> {
  const todayStr = moment().format('YYYY-MM-DD');
  const metadata = item.data.metadata;

  // Create updated item data
  const updatedItem: Partial<Item> = {
    ...item,
    data: {
      ...item.data,
      metadata: {
        ...metadata,
      },
    },
  };

  // Update priority based on importance
  if (dropData.isImportant) {
    updatedItem.data!.metadata!.priority = EisenhowerPriority.High;

    // Add priority emoji to title if not present
    const hasPriorityEmoji = EISENHOWER_PRIORITY_ICON_MAP[EisenhowerPriority.High];
    if (!item.data.title.includes('⏫') && !item.data.title.includes('🔺')) {
      updatedItem.data!.title = `${hasPriorityEmoji} ${item.data.title}`;
    }
  } else {
    updatedItem.data!.metadata!.priority = EisenhowerPriority.None;

    // Remove priority emoji from title
    updatedItem.data!.title = item.data.title
      .replace(/[🔺⏫🔼🔽⏬]\uFE0F?/g, '')
      .trim();
  }

  // Update due date based on urgency
  if (dropData.isUrgent) {
    if (!metadata.date) {
      // Add today's date if no date exists
      updatedItem.data!.metadata!.date = moment();
      updatedItem.data!.metadata!.dateStr = todayStr;
      updatedItem.data!.title = `${updatedItem.data!.title} 📅 ${todayStr}`;
    }
  } else {
    // Remove due date for non-urgent quadrants
    if (metadata.date) {
      updatedItem.data!.metadata!.date = undefined;
      updatedItem.data!.metadata!.dateStr = undefined;
      updatedItem.data!.title = updatedItem.data!.title
        .replace(/📅\uFE0F?\s*\d{4}-\d{2}-\d{2}/g, '')
        .trim();
    }
  }

  // Update classification metadata
  updatedItem.data!.metadata!.isImportant = dropData.isImportant;
  updatedItem.data!.metadata!.isUrgent = dropData.isUrgent;

  return updatedItem;
}

/**
 * Applies the Eisenhower drop updates to the board.
 * This function should be called after handleEisenhowerDrop to persist changes.
 *
 * @param item - The original item
 * @param updatedItem - The updated item data
 * @param path - The path to the item in the board
 * @param boardModifiers - The board modifiers instance
 */
export function applyEisenhowerUpdate(
  item: Item,
  updatedItem: Partial<Item>,
  path: number[],
  boardModifiers: BoardModifiers
) {
  // Update the item title and metadata
  boardModifiers.updateItem(path, {
    title: updatedItem.data!.title,
    titleRaw: updatedItem.data!.titleRaw || item.data.titleRaw,
    titleSearch: updatedItem.data!.titleSearch || item.data.titleSearch,
    titleSearchRaw: updatedItem.data!.titleSearchRaw || item.data.titleSearchRaw,
    metadata: updatedItem.data!.metadata,
  });
}

/**
 * Calculates the target quadrant for an item based on its current state.
 *
 * @param item - The item to classify
 * @returns The quadrant key ('q1', 'q2', 'q3', 'q4')
 */
export function getTargetQuadrant(item: Item): 'q1' | 'q2' | 'q3' | 'q4' {
  const isImportant = item.data.metadata.isImportant;
  const isUrgent = item.data.metadata.isUrgent;

  if (isImportant && isUrgent) return 'q1';
  if (isImportant && !isUrgent) return 'q2';
  if (!isImportant && isUrgent) return 'q3';
  return 'q4';
}

/**
 * Checks if an item can be moved to a different quadrant.
 * Items with unresolved dependencies should not be moved.
 *
 * @param item - The item to check
 * @returns True if the item can be moved
 */
export function canMoveToQuadrant(item: Item): boolean {
  const hasUnfinishedDependency = item.data.metadata.dependsOn;
  // TODO: Check if dependency is actually completed
  return !hasUnfinishedDependency;
}
