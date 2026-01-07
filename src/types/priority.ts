/**
 * Priority type definitions for Eisenhower Matrix classification.
 * Uses a different namespace from the inlineMetadata Priority enum to avoid conflicts.
 */
export enum EisenhowerPriority {
  Highest = 'highest',
  High = 'high',
  Medium = 'medium',
  None = 'none',
  Low = 'low',
  Lowest = 'lowest',
}

export const EISENHOWER_PRIORITY_ORDER: Record<EisenhowerPriority, number> = {
  [EisenhowerPriority.Highest]: 5,
  [EisenhowerPriority.High]: 4,
  [EisenhowerPriority.Medium]: 3,
  [EisenhowerPriority.None]: 2,
  [EisenhowerPriority.Low]: 1,
  [EisenhowerPriority.Lowest]: 0,
};

export const EISENHOWER_PRIORITY_ICON_MAP: Record<EisenhowerPriority, string> = {
  [EisenhowerPriority.Highest]: '🔺',
  [EisenhowerPriority.High]: '⏫',
  [EisenhowerPriority.Medium]: '🔼',
  [EisenhowerPriority.None]: '',
  [EisenhowerPriority.Low]: '🔽',
  [EisenhowerPriority.Lowest]: '⏬',
};

/**
 * Maps inline metadata priority values (from tasks plugin) to Eisenhower priority.
 * The tasks plugin uses numeric strings '0'-'5', where '0' is highest and '5' is lowest.
 */
export function mapTasksPriorityToEisenhower(tasksPriority: string): EisenhowerPriority {
  switch (tasksPriority) {
    case '0':
      return EisenhowerPriority.Highest;
    case '1':
      return EisenhowerPriority.High;
    case '2':
      return EisenhowerPriority.Medium;
    case '3':
      return EisenhowerPriority.None;
    case '4':
      return EisenhowerPriority.Low;
    case '5':
      return EisenhowerPriority.Lowest;
    default:
      return EisenhowerPriority.None;
  }
}

/**
 * Maps emoji icon to Eisenhower priority.
 */
export function mapIconToEisenhowerPriority(icon: string): EisenhowerPriority | null {
  switch (icon) {
    case '🔺':
      return EisenhowerPriority.Highest;
    case '⏫':
      return EisenhowerPriority.High;
    case '🔼':
      return EisenhowerPriority.Medium;
    case '🔽':
      return EisenhowerPriority.Low;
    case '⏬':
      return EisenhowerPriority.Lowest;
    default:
      return null;
  }
}

/**
 * Determines if a priority is considered "important" for Eisenhower Matrix.
 * High and Highest priorities are considered important.
 */
export function isImportantPriority(priority: EisenhowerPriority): boolean {
  return priority === EisenhowerPriority.Highest || priority === EisenhowerPriority.High;
}
