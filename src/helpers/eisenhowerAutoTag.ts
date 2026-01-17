/**
 * Eisenhower 自动标记功能
 * 在启用 Eisenhower 视图时，为所有任务自动添加 [eisenhower::qx] 内联字段
 */

import { Item } from '../components/types';
import { setEisenhowerQuadrant, EisenhowerQuadrant } from './eisenhowerMetadata';
import { classifyEisenhower, checkImportance, checkUrgency } from './eisenhowerClassifier';

/**
 * 为单个任务添加或更新内联字段
 * @returns 返回更新后的 titleRaw，如果不需要更新则返回 null
 */
export function addEisenhowerTagToItem(
  item: Item,
  urgentDays: number = 3
): string | null {
  // 直接使用 checkImportance 和 checkUrgency 计算目标象限
  // 不使用 classifyEisenhower，因为它会读取现有的 eisenhower 标签
  const isImportant = checkImportance(item);
  const isUrgent = checkUrgency(item, urgentDays, false);

  let targetQuadrant: EisenhowerQuadrant;
  if (isImportant && isUrgent) {
    targetQuadrant = 'q1';
  } else if (isImportant && !isUrgent) {
    targetQuadrant = 'q2';
  } else if (!isImportant && isUrgent) {
    targetQuadrant = 'q3';
  } else {
    targetQuadrant = 'q4';
  }

  console.log(`[Eisenhower AutoTag] Item: "${item.data.titleRaw.substring(0, 30)}" -> isImportant=${isImportant}, isUrgent=${isUrgent}, target=${targetQuadrant}`);

  // 检查是否已经有内联字段
  const existingTag = item.data.titleRaw.match(/\[eisenhower::(q[1-4])\]/i);
  if (existingTag) {
    const currentQuadrant = existingTag[1].toLowerCase() as EisenhowerQuadrant;
    // 如果当前标签与目标象限一致，不需要更新
    if (currentQuadrant === targetQuadrant) {
      console.log(`[Eisenhower AutoTag] Tag already correct: ${currentQuadrant}`);
      return null;
    }
    console.log(`[Eisenhower AutoTag] Tag needs update: ${currentQuadrant} -> ${targetQuadrant}`);
  } else {
    console.log(`[Eisenhower AutoTag] No existing tag, will add: ${targetQuadrant}`);
  }

  // 添加或更新内联字段
  const newTitleRaw = setEisenhowerQuadrant(item.data.titleRaw, targetQuadrant);
  return newTitleRaw;
}

/**
 * 批量为所有任务添加内联字段
 * @returns 返回需要更新的任务列表 { item, newTitleRaw }
 */
export function addEisenhowerTagsToAllItems(
  items: Item[],
  urgentDays: number = 3
): Array<{ item: Item; newTitleRaw: string }> {
  const updates: Array<{ item: Item; newTitleRaw: string }> = [];

  items.forEach((item) => {
    const newTitleRaw = addEisenhowerTagToItem(item, urgentDays);
    if (newTitleRaw) {
      updates.push({ item, newTitleRaw });
    }
  });

  return updates;
}
