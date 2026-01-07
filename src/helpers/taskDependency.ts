/**
 * Task dependency management utilities.
 * Handles tracking and validation of task dependencies for GTD workflow.
 */
import { Item } from 'src/components/types';

/**
 * Represents a node in the dependency graph.
 */
export interface DependencyNode {
  item: Item | null;         // The task (null if only referenced as a dependency)
  dependsOn: string | null;  // ID of the task this depends on
  blockedBy: string[];       // IDs of tasks that block this task
  blocking: string[];        // IDs of tasks that are blocked by this task
}

/**
 * A graph representing task dependencies.
 */
export interface DependencyGraph {
  [taskId: string]: DependencyNode;
}

/**
 * Builds a dependency graph from a list of items.
 *
 * The graph tracks:
 * - Which tasks depend on which
 * - Which tasks are blocked
 * - Which tasks are blocking others
 */
export function buildDependencyGraph(items: Item[]): DependencyGraph {
  const graph: DependencyGraph = {};

  // First pass: create nodes for all items with task IDs
  for (const item of items) {
    // Extract task ID from metadata or title
    let taskId = item.data.metadata.taskId;
    if (!taskId) {
      // Try to extract from inline metadata
      if (item.data.metadata.inlineMetadata) {
        const idMeta = item.data.metadata.inlineMetadata.find(
          m => m.key.toLowerCase() === 'id'
        );
        if (idMeta) {
          taskId = String(idMeta.value);
          item.data.metadata.taskId = taskId;
        }
      }

      // Try to extract from title
      if (!taskId) {
        const match = item.data.title.match(/🆔\uFE0F?\s*([^\s]+)/);
        if (match) {
          taskId = match[1];
          item.data.metadata.taskId = taskId;
        }
      }
    }

    if (!taskId) continue;

    // Extract dependsOn from metadata or title
    let dependsOn = item.data.metadata.dependsOn;
    if (!dependsOn) {
      if (item.data.metadata.inlineMetadata) {
        const depMeta = item.data.metadata.inlineMetadata.find(
          m => m.key.toLowerCase() === 'dependson' ||
               m.key.toLowerCase() === 'depends_on' ||
               m.key === '⛔'
        );
        if (depMeta) {
          dependsOn = String(depMeta.value);
          item.data.metadata.dependsOn = dependsOn;
        }
      }

      if (!dependsOn) {
        const match = item.data.title.match(/⛔\uFE0F?\s*([^\s]+)/);
        if (match) {
          dependsOn = match[1];
          item.data.metadata.dependsOn = dependsOn;
        }
      }
    }

    // Create or update the node
    if (!graph[taskId]) {
      graph[taskId] = {
        item,
        dependsOn: dependsOn || null,
        blockedBy: [],
        blocking: [],
      };
    } else {
      // Update existing node
      graph[taskId].item = item;
      if (dependsOn) {
        graph[taskId].dependsOn = dependsOn;
      }
    }

    // Track the dependency relationship
    if (dependsOn) {
      if (!graph[dependsOn]) {
        // Create a placeholder node for the dependency
        graph[dependsOn] = {
          item: null,
          dependsOn: null,
          blockedBy: [],
          blocking: [taskId],
        };
      } else {
        // Add this task to the blocking list of the dependency
        if (!graph[dependsOn].blocking.includes(taskId)) {
          graph[dependsOn].blocking.push(taskId);
        }
      }

      // Add the dependency to the blockedBy list
      if (!graph[taskId].blockedBy.includes(dependsOn)) {
        graph[taskId].blockedBy.push(dependsOn);
      }
    }
  }

  return graph;
}

/**
 * Gets a list of task IDs that are currently blocked.
 *
 * A task is blocked if:
 * - It has a dependency
 * - The dependency exists and is not completed
 */
export function getBlockedTaskIds(items: Item[]): string[] {
  const graph = buildDependencyGraph(items);
  const blocked: string[] = [];

  for (const [taskId, data] of Object.entries(graph)) {
    // Skip tasks without dependencies
    if (!data.dependsOn) continue;

    // Skip tasks without an item (placeholder nodes)
    if (!data.item) continue;

    // Skip completed tasks
    if (data.item.data.checked) continue;

    // Check if the dependency is completed
    const dep = graph[data.dependsOn];
    if (!dep) {
      // Dependency doesn't exist, consider as not blocked
      continue;
    }

    if (!dep.item || dep.item.data.checked) {
      // Dependency is completed or doesn't exist, not blocked
      continue;
    }

    // Task is blocked by an incomplete dependency
    blocked.push(taskId);
  }

  return blocked;
}

/**
 * Gets a list of task IDs that are blocking other tasks.
 */
export function getBlockingTaskIds(items: Item[]): string[] {
  const graph = buildDependencyGraph(items);
  const blocking: string[] = [];

  for (const [taskId, data] of Object.entries(graph)) {
    // Skip completed tasks
    if (data.item && data.item.data.checked) continue;

    // Include tasks that are blocking others
    if (data.blocking.length > 0) {
      blocking.push(taskId);
    }
  }

  return blocking;
}

/**
 * Checks if a specific task can be moved from the waiting state.
 *
 * A task can be moved if:
 * - It has no dependencies, OR
 * - All its dependencies are completed
 */
export function canMoveFromWaiting(item: Item, allItems: Item[]): boolean {
  const dependsOn = item.data.metadata.dependsOn;
  if (!dependsOn) return true;

  // Check if the dependency is completed
  return !allItems.some(other =>
    other.data.metadata.taskId === dependsOn && !other.data.checked
  );
}

/**
 * Gets all tasks that depend on a specific task.
 */
export function getDependentTasks(taskId: string, items: Item[]): Item[] {
  const graph = buildDependencyGraph(items);
  const node = graph[taskId];

  if (!node) return [];

  return node.blocking
    .map(depId => graph[depId]?.item)
    .filter((item): item is Item => item !== null && item !== undefined);
}

/**
 * Checks if there are circular dependencies in the task list.
 *
 * @returns true if circular dependencies are detected
 */
export function hasCircularDependencies(items: Item[]): boolean {
  const graph = buildDependencyGraph(items);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(taskId: string): boolean {
    if (recursionStack.has(taskId)) {
      return true; // Circular dependency detected
    }
    if (visited.has(taskId)) {
      return false; // Already checked
    }

    visited.add(taskId);
    recursionStack.add(taskId);

    const node = graph[taskId];
    if (node && node.dependsOn) {
      if (dfs(node.dependsOn)) {
        return true;
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  for (const taskId of Object.keys(graph)) {
    if (!visited.has(taskId)) {
      if (dfs(taskId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Gets the dependency chain for a task (all tasks it depends on, recursively).
 */
export function getDependencyChain(item: Item, allItems: Item[]): Item[] {
  const graph = buildDependencyGraph(allItems);
  const chain: Item[] = [];
  const visited = new Set<string>();

  function collectDependencies(taskId: string) {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const node = graph[taskId];
    if (!node || !node.dependsOn) return;

    const depNode = graph[node.dependsOn];
    if (depNode && depNode.item) {
      chain.push(depNode.item);
      collectDependencies(node.dependsOn);
    }
  }

  const taskId = item.data.metadata.taskId;
  if (taskId) {
    collectDependencies(taskId);
  }

  return chain;
}
