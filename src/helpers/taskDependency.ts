/**
 * 任务依赖管理器
 * 处理任务之间的依赖关系和阻塞状态
 */

import { Item } from '../components/types';

/**
 * 依赖图节点
 */
export interface DependencyNode {
  item: Item;
  dependsOn: string | null;
  blockedBy: string[]; // 被哪些任务阻塞
  blocking: string[]; // 阻塞哪些任务
}

export type DependencyGraph = Map<string, DependencyNode>;

/**
 * 从 Item 中提取任务 ID
 */
export function extractTaskId(item: Item): string | undefined {
  const metadata = item.data.metadata;

  // 1. 优先从 inlineMetadata 读取
  if (metadata.inlineMetadata) {
    const idMeta = metadata.inlineMetadata.find((m) => m.key.toLowerCase() === 'id');
    if (idMeta) return String(idMeta.value);
  }

  // 2. 从 title 中的 emoji 提取 (🆔 task-123)
  const match = item.data.title.match(/🆔\s*([^\s]+)/);
  return match ? match[1] : undefined;
}

/**
 * 从 Item 中提取依赖 ID
 */
export function extractDependsOn(item: Item): string | undefined {
  const metadata = item.data.metadata;

  // 1. 从 inlineMetadata 读取
  if (metadata.inlineMetadata) {
    const depMeta =
      metadata.inlineMetadata.find(
        (m) => m.key.toLowerCase() === 'depends_on' || m.key === '⛓'
      );
    if (depMeta) return String(depMeta.value);
  }

  // 2. 从 title 中提取 (⛓ task-123)
  const match = item.data.title.match(/⛓\s*([^\s]+)/);
  return match ? match[1] : undefined;
}

/**
 * 构建依赖图
 */
export function buildDependencyGraph(items: Item[]): DependencyGraph {
  const graph: DependencyGraph = new Map();

  // 第一遍: 创建所有节点
  items.forEach((item) => {
    const taskId = extractTaskId(item);
    if (!taskId) return;

    const dependsOn = extractDependsOn(item);

    graph.set(taskId, {
      item,
      dependsOn: dependsOn || null,
      blockedBy: [],
      blocking: [],
    });
  });

  // 第二遍: 建立依赖关系
  graph.forEach((node, taskId) => {
    if (node.dependsOn) {
      const depNode = graph.get(node.dependsOn);
      if (depNode) {
        // 当前任务依赖 depNode
        depNode.blocking.push(taskId);
        node.blockedBy.push(node.dependsOn);
      }
    }
  });

  return graph;
}

/**
 * 检查任务是否被阻塞
 */
export function isTaskBlocked(item: Item, allItems: Item[]): boolean {
  const dependsOn = extractDependsOn(item);
  if (!dependsOn) return false;

  // 查找依赖任务
  const depTask = allItems.find((i) => extractTaskId(i) === dependsOn);
  if (!depTask) return false; // 依赖任务不存在,不算阻塞

  // 依赖任务未完成才算阻塞
  return !depTask.data.checked;
}

/**
 * 获取所有被阻塞的任务 ID
 */
export function getBlockedTaskIds(items: Item[]): Set<string> {
  const blocked = new Set<string>();
  const graph = buildDependencyGraph(items);

  graph.forEach((node, taskId) => {
    if (node.dependsOn && !node.item.data.checked) {
      const depNode = graph.get(node.dependsOn);
      if (depNode && !depNode.item.data.checked) {
        blocked.add(taskId);
      }
    }
  });

  return blocked;
}

/**
 * 获取任务的所有依赖（递归）
 */
export function getAllDependencies(taskId: string, graph: DependencyGraph): Set<string> {
  const dependencies = new Set<string>();
  const visited = new Set<string>();

  function collect(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const node = graph.get(id);
    if (node?.dependsOn) {
      dependencies.add(node.dependsOn);
      collect(node.dependsOn);
    }
  }

  collect(taskId);
  return dependencies;
}

/**
 * 获取被此任务阻塞的所有任务（递归）
 */
export function getAllBlocking(taskId: string, graph: DependencyGraph): Set<string> {
  const blocking = new Set<string>();
  const visited = new Set<string>();

  function collect(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const node = graph.get(id);
    if (node) {
      node.blocking.forEach((childId) => {
        blocking.add(childId);
        collect(childId);
      });
    }
  }

  collect(taskId);
  return blocking;
}

/**
 * 检测循环依赖
 */
export function detectCircularDependencies(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string, path: string[]) {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph.get(nodeId);
    if (node?.dependsOn) {
      if (recursionStack.has(node.dependsOn)) {
        // 找到循环
        const cycleStart = path.indexOf(node.dependsOn);
        cycles.push([...path.slice(cycleStart), node.dependsOn]);
      } else if (!visited.has(node.dependsOn)) {
        dfs(node.dependsOn, path);
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
  }

  graph.forEach((_, nodeId) => {
    if (!visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  });

  return cycles;
}
