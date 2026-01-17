/**
 * Eisenhower 拖拽处理（新方案）
 *
 * 使用原生 Kanban 拖拽机制，通过更新内联字段 [eisenhower::qx] 来改变象限
 * 不需要自定义的拖拽拦截和虚拟映射
 */

import { moment } from 'obsidian';
import { Item } from '../components/types';
import { BoardModifiers } from './boardModifiers';
import {
  setEisenhowerQuadrant,
  EisenhowerQuadrant,
  QUADRANT_PROPERTIES,
} from './eisenhowerMetadata';
import { Priority } from '../parsers/helpers/inlineMetadata';

/**
 * 优先级图标常量
 */
const PRIORITY_ICONS: Record<string, string> = {
  [Priority.Highest]: '🔺',
  [Priority.High]: '⏫',
  [Priority.Medium]: '🔼',
  [Priority.Low]: '🔽',
  [Priority.Lowest]: '⏬',
};

/**
 * 获取优先级图标
 */
function getPriorityIcon(priority: Priority): string {
  return PRIORITY_ICONS[priority] || '';
}

/**
 * 从文本中提取优先级
 */
function extractPriority(text: string): Priority | null {
  if (text.includes('🔺')) return Priority.Highest;
  if (text.includes('⏫')) return Priority.High;
  if (text.includes('🔼')) return Priority.Medium;
  if (text.includes('🔽')) return Priority.Low;
  if (text.includes('⏬')) return Priority.Lowest;
  return null;
}

/**
 * 从文本中提取截止日期（📅 日期格式）
 */
function extractDueDate(text: string): moment.Moment | null {
  // 匹配 📅 YYYY-MM-DD 格式的日期
  const dueDateRegex = /📅\s*(\d{4}-\d{2}-\d{2})/;
  const match = text.match(dueDateRegex);

  if (match && match[1]) {
    const parsedDate = moment(match[1], 'YYYY-MM-DD', false);
    if (parsedDate.isValid()) {
      return parsedDate;
    }
  }

  return null;
}

/**
 * 从文本中移除优先级图标
 */
function removePriorityIcon(text: string): string {
  return text.replace(/[🔺⏫🔼🔽⏬]\uFE0F?\s*/gu, '').trim();
}

/**
 * 从文本中移除截止日期
 */
function removeDueDate(text: string): string {
  return text.replace(/📅\s*\d{4}-\d{2}-\d{2}\s*/g, '').trim();
}

/**
 * 添加优先级图标到文本
 */
function addPriorityIcon(text: string, priority: Priority): string {
  const icon = getPriorityIcon(priority);
  if (!icon) return text;

  // 在 eisenhower 字段之前插入（即在任务内容末尾）
  const eisenhowerPattern = /\[eisenhower::(q[1-4])\]/;
  const match = text.match(eisenhowerPattern);

  if (match && match.index !== undefined) {
    const insertPos = match.index;
    return text.slice(0, insertPos).trimEnd() + ` ${icon} ` + text.slice(insertPos);
  }

  // 没有 eisenhower 字段，添加到末尾
  return text.trimEnd() + ` ${icon}`;
}

/**
 * 添加截止日期到文本
 */
function addDueDate(text: string, date: moment.Moment): string {
  const dateStr = `📅 ${date.format('YYYY-MM-DD')}`;

  // 在 eisenhower 字段之前插入（即在任务内容末尾）
  const eisenhowerPattern = /\[eisenhower::(q[1-4])\]/;
  const match = text.match(eisenhowerPattern);

  if (match && match.index !== undefined) {
    const insertPos = match.index;
    return text.slice(0, insertPos).trimEnd() + ` ${dateStr} ` + text.slice(insertPos);
  }

  // 没有 eisenhower 字段，添加到末尾
  return text.trimEnd() + ` ${dateStr}`;
}

/**
 * 处理 Eisenhower 视图中的拖拽
 *
 * 当任务从一个象限拖到另一个象限时：
 * 1. 更新 [eisenhower::qx] 内联字段
 * 2. 根据象限属性调整优先级图标和截止日期
 *
 * @param item 被拖拽的任务
 * @param sourcePath 源路径（在 Kanban 中的位置）
 * @param targetQuadrant 目标象限（q1/q2/q3/q4）
 * @param boardModifiers Kanban 板修改器
 */
export async function handleEisenhowerDrop(
  item: Item,
  sourcePath: number[],
  targetQuadrant: EisenhowerQuadrant,
  boardModifiers: BoardModifiers
): Promise<void> {
  console.log(`[Eisenhower Drop] Processing drop for:`, item.data.titleRaw.substring(0, 30));
  console.log(`[Eisenhower Drop] Target quadrant:`, targetQuadrant);

  const targetProps = QUADRANT_PROPERTIES[targetQuadrant];

  // 获取当前象限
  const { getEisenhowerQuadrant } = await import('./eisenhowerMetadata');
  const currentQuadrant = getEisenhowerQuadrant(item.data.titleRaw);

  console.log(`[Eisenhower Drop] Current quadrant:`, currentQuadrant || 'none');

  // 如果象限没有变化，不需要更新
  if (currentQuadrant === targetQuadrant) {
    console.log(`[Eisenhower Drop] Same quadrant, no update needed`);
    return;
  }

  let updatedTitleRaw = item.data.titleRaw;

  // 步骤 1: 更新 eisenhower 内联字段
  updatedTitleRaw = setEisenhowerQuadrant(updatedTitleRaw, targetQuadrant);
  console.log(`[Eisenhower Drop] After setting quadrant:`, updatedTitleRaw.substring(0, 50));

  // 步骤 2: 根据象限属性调整优先级图标
  if (targetProps.isImportant) {
    // 拖到重要象限（Q1, Q2）：添加高优先级图标（如果还没有）
    const currentPriority = extractPriority(updatedTitleRaw);
    if (!currentPriority || currentPriority !== Priority.High) {
      updatedTitleRaw = removePriorityIcon(updatedTitleRaw);
      updatedTitleRaw = addPriorityIcon(updatedTitleRaw, Priority.High);
      console.log(`[Eisenhower Drop] Added high priority icon`);
    }
  } else {
    // 从重要象限拖走：移除优先级图标
    updatedTitleRaw = removePriorityIcon(updatedTitleRaw);
    console.log(`[Eisenhower Drop] Removed priority icon`);
  }

  // 步骤 3: 根据象限属性调整截止日期
  if (targetProps.isUrgent) {
    // 拖到紧急象限（Q1, Q3）：添加今天的日期（如果还没有截止日期）
    const currentDueDate = extractDueDate(updatedTitleRaw);
    if (!currentDueDate) {
      const today = moment();
      updatedTitleRaw = addDueDate(updatedTitleRaw, today);
      console.log(`[Eisenhower Drop] Added due date:`, today.format('YYYY-MM-DD'));
    }
  } else {
    // 从紧急象限拖走：移除截止日期
    updatedTitleRaw = removeDueDate(updatedTitleRaw);
    console.log(`[Eisenhower Drop] Removed due date`);
  }

  console.log(`[Eisenhower Drop] Final titleRaw:`, updatedTitleRaw.substring(0, 80));

  // 步骤 4: 更新任务内容（保持在原 Lane，只更新元数据）
  const updatedItem = {
    ...item,
    data: {
      ...item.data,
      titleRaw: updatedTitleRaw,
      title: updatedTitleRaw, // 同时更新 title
      // metadata 会在下次解析时自动更新
    },
  };

  // 使用 Kanban 的 updateItem 方法更新任务
  // 注意：我们保持在原始位置（sourcePath），只更新内容
  boardModifiers.updateItem(sourcePath, updatedItem);

  console.log(`[Eisenhower Drop] Item updated successfully`);
}
