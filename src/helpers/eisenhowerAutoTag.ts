/**
 * Eisenhower 自动标记功能
 * 在启用 Eisenhower 视图时，为所有任务自动添加 [eisenhower::qx] 内联字段
 */

import { Item } from '../components/types';
import { setEisenhowerQuadrant, EisenhowerQuadrant } from './eisenhowerMetadata';
import { classifyEisenhower } from './eisenhowerClassifier';

/**
 * 为单个任务添加内联字段（如果还没有）
 * @returns 返回更新后的 titleRaw，如果不需要更新则返回 null
 */
export function addEisenhowerTagToItem(
  item: Item,
  urgentDays: number = 3
): string | null {
  // 检查是否已经有内联字段
  const existingTag = item.data.titleRaw.match(/\[eisenhower::(q[1-4])\]/i);
  if (existingTag) {
    return null; // 已经有标签，不需要添加
  }

  // 使用分类逻辑确定应该属于哪个象限
  const classified = classifyEisenhower([item], urgentDays);

  // 找到这个任务被分配到哪个象限
  let targetQuadrant: EisenhowerQuadrant | null = null;
  for (const [key, value] of Object.entries(classified)) {
    if (value.items.length > 0) {
      targetQuadrant = key as EisenhowerQuadrant;
      break;
    }
  }

  if (!targetQuadrant) {
    return null; // 无法分类
  }

  // 添加内联字段
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
