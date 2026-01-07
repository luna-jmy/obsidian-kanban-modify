/**
 * Eisenhower Matrix classifier for organizing tasks into four quadrants:
 * Q1: Important & Urgent (Do First)
 * Q2: Important & Not Urgent (Schedule)
 * Q3: Not Important & Urgent (Delegate)
 * Q4: Not Important & Not Urgent (Don't Do)
 */
import { moment } from 'obsidian';
import { EisenhowerPriority, isImportantPriority, mapTasksPriorityToEisenhower, mapIconToEisenhowerPriority } from 'src/types/priority';
import { Item } from 'src/components/types';

export interface EisenhowerQuadrant {
  items: Item[];
  isImportant: boolean;
  isUrgent: boolean;
}

export interface EisenhowerClassification {
  q1: EisenhowerQuadrant; // Important & Urgent
  q2: EisenhowerQuadrant; // Important & Not Urgent
  q3: EisenhowerQuadrant; // Not Important & Urgent
  q4: EisenhowerQuadrant; // Not Important & Not Urgent
}

/**
 * Checks if a task is blocked by incomplete dependencies.
 */
function isTaskBlocked(item: Item, allItems: Item[]): boolean {
  const dependsOn = item.data.metadata.dependsOn;
  if (!dependsOn) return false;

  return allItems.some(otherItem => {
    const otherTaskId = otherItem.data.metadata.taskId;
    return otherTaskId === dependsOn && !otherItem.data.checked;
  });
}

/**
 * Extracts task priority from the item's metadata or title.
 */
function getTaskPriority(item: Item): EisenhowerPriority {
  const metadata = item.data.metadata;

  // First, try to read from inline metadata (priority field)
  if (metadata.inlineMetadata) {
    const priorityMeta = metadata.inlineMetadata.find(
      m => m.key.toLowerCase() === 'priority'
    );
    if (priorityMeta) {
      // Check if it's the tasks plugin priority format (numeric string)
      const mappedPriority = mapTasksPriorityToEisenhower(priorityMeta.value);
      if (mappedPriority !== EisenhowerPriority.None) {
        return mappedPriority;
      }
      // Try direct enum value match
      const value = priorityMeta.value.toLowerCase();
      if (value === 'highest' || value === '🔺') return EisenhowerPriority.Highest;
      if (value === 'high' || value === '⏫') return EisenhowerPriority.High;
      if (value === 'medium' || value === '🔼') return EisenhowerPriority.Medium;
      if (value === 'low' || value === '🔽') return EisenhowerPriority.Low;
      if (value === 'lowest' || value === '⏬') return EisenhowerPriority.Lowest;
    }
  }

  // Extract priority emoji from title
  const title = item.data.title;
  const priorityIcons = ['🔺', '⏫', '🔼', '🔽', '⏬'];
  for (const icon of priorityIcons) {
    if (title.includes(icon)) {
      const mapped = mapIconToEisenhowerPriority(icon);
      if (mapped) return mapped;
    }
  }

  return EisenhowerPriority.None;
}

/**
 * Checks if a task is urgent (due within 3 days).
 */
function isTaskUrgent(item: Item): boolean {
  const metadata = item.data.metadata;
  if (!metadata.date) return false;

  const threeDaysLater = moment().add(3, 'days').endOf('day');
  return metadata.date.isBefore(threeDaysLater);
}

/**
 * Classifies a list of tasks into the four Eisenhower Matrix quadrants.
 *
 * Tasks are filtered based on:
 * - Completed/cancelled tasks are excluded
 * - Blocked tasks are excluded
 * - Tasks are classified by importance (priority) and urgency (due date)
 */
export function classifyEisenhower(items: Item[]): EisenhowerClassification {
  const result: EisenhowerClassification = {
    q1: { items: [], isImportant: true, isUrgent: true },
    q2: { items: [], isImportant: true, isUrgent: false },
    q3: { items: [], isImportant: false, isUrgent: true },
    q4: { items: [], isImportant: false, isUrgent: false },
  };

  for (const item of items) {
    // Skip completed tasks
    if (item.data.checked) continue;

    // Skip cancelled tasks (marked with [-])
    if (item.data.titleRaw.startsWith('- [-]')) continue;

    // Skip blocked tasks (they can't be acted upon)
    if (isTaskBlocked(item, items)) continue;

    const priority = getTaskPriority(item);
    const isImportant = isImportantPriority(priority);
    const isUrgent = isTaskUrgent(item);

    // Cache classification results in metadata for later use
    item.data.metadata.isImportant = isImportant;
    item.data.metadata.isUrgent = isUrgent;
    item.data.metadata.priority = priority;

    // Classify into appropriate quadrant
    if (isImportant && isUrgent) {
      result.q1.items.push(item);
    } else if (isImportant && !isUrgent) {
      result.q2.items.push(item);
    } else if (!isImportant && isUrgent) {
      result.q3.items.push(item);
    } else {
      result.q4.items.push(item);
    }
  }

  return result;
}

/**
 * Gets the quadrant label for a given quadrant key.
 */
export function getQuadrantLabel(quadrant: keyof EisenhowerClassification): string {
  switch (quadrant) {
    case 'q1':
      return '重要且紧急 (立即执行)';
    case 'q2':
      return '重要不紧急 (计划安排)';
    case 'q3':
      return '不重要但紧急 (委托他人)';
    case 'q4':
      return '不重要不紧急 (尽量不做)';
  }
}

/**
 * Gets the quadrant label in English.
 */
export function getQuadrantLabelEn(quadrant: keyof EisenhowerClassification): string {
  switch (quadrant) {
    case 'q1':
      return 'Do First';
    case 'q2':
      return 'Schedule';
    case 'q3':
      return 'Delegate';
    case 'q4':
      return "Don't Do";
  }
}
