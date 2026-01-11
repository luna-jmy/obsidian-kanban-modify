/**
 * Eisenhower Matrix drag-and-drop handlers.
 * Handles priority and date updates when items are dragged between quadrants.
 */
import { moment } from 'obsidian';
import { StateManager } from 'src/StateManager';
import { Item } from 'src/components/types';
import { BoardModifiers } from 'src/helpers/boardModifiers';
import { Priority } from 'src/parsers/helpers/inlineMetadata';
import { EISENHOWER_PRIORITY_ICON_MAP, EisenhowerPriority } from 'src/types/priority';

import { ItemWithPath } from './eisenhowerClassifier';

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
  const dateFormat = stateManager.getSetting('date-format') || 'YYYY-MM-DD';
  const todayStr = moment().format(dateFormat);
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

  let title = item.data.titleRaw;

  // Update priority based on importance
  if (dropData.isImportant) {
    updatedItem.data!.metadata!.priority = EisenhowerPriority.High;

    // Add priority emoji to title if not present
    if (!title.includes('⏫') && !title.includes('🔺')) {
      title = `⏫ ${title}`;
    }
  } else {
    updatedItem.data!.metadata!.priority = EisenhowerPriority.None;

    // Remove priority emoji from title
    title = title.replace(/[🔺⏫🔼🔽⏬]\uFE0F?/gu, '').trim();
  }

  // Update due date based on urgency
  if (dropData.isUrgent) {
    if (!metadata.dateStr) {
      // Add today's date if no date exists
      updatedItem.data!.metadata!.date = moment();
      updatedItem.data!.metadata!.dateStr = todayStr;

      // Avoid doubling if already has a 📅 but no valid dateStr?
      // Unlikely, but let's be safe.
      if (!title.match(/[📅📆🗓]/u)) {
        title = `${title} 📅 ${todayStr}`;
      }
    }
  } else {
    // For non-urgent quadrants (Q2, Q4)
    // Only remove the date if it's currently URGENT (conflict)
    // If the date is already non-urgent (e.g. next month), preserve it.
    if (metadata.date) {
      const urgentDays = (stateManager.getSetting('eisenhower-urgent-days') as number) || 3;
      const mDate = moment.isMoment(metadata.date) ? metadata.date : moment(metadata.date);

      if (mDate.isValid()) {
        const threeDaysLater = moment().add(urgentDays, 'days').endOf('day');
        const isActuallyUrgent =
          mDate.isBefore(threeDaysLater) || mDate.isSame(threeDaysLater, 'day');

        if (isActuallyUrgent) {
          // It's urgent, but we're in a non-urgent quadrant. Remove the date.
          updatedItem.data!.metadata!.date = undefined;
          updatedItem.data!.metadata!.dateStr = undefined;
          title = title.replace(/[📅📆🗓]\uFE0F?\s*\d{4}-\d{2}-\d{2}/gu, '').trim();
        }
      }
    }
  }

  // Update titles
  updatedItem.data!.title = title;
  updatedItem.data!.titleRaw = title;

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
  const newItem: Item = {
    ...item,
    data: {
      ...item.data,
      title: updatedItem.data!.title,
      titleRaw: updatedItem.data!.titleRaw || item.data.titleRaw,
      titleSearch: updatedItem.data!.titleSearch || item.data.titleSearch,
      titleSearchRaw: updatedItem.data!.titleSearchRaw || item.data.titleSearchRaw,
      metadata: updatedItem.data!.metadata,
    },
  };

  boardModifiers.updateItem(path, newItem);
}

/**
 * Calculates the target quadrant for an item based on its current state.
 *
 * @param item - The item to classify
 * @returns The quadrant key ('q1', 'q2', 'q3', 'q4')
 */
export function getTargetQuadrant(item: Item | ItemWithPath): 'q1' | 'q2' | 'q3' | 'q4' {
  const isImportant = (item as ItemWithPath).isImportant ?? item.data.metadata.isImportant;
  const isUrgent = (item as ItemWithPath).isUrgent ?? item.data.metadata.isUrgent;

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
