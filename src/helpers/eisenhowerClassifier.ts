/**
 * Eisenhower 分类器
 * 将任务按照重要性和紧急性分类到四个象限
 *
 * 新方案：优先使用内联字段 [eisenhower::qx] 进行分类
 * 如果不存在内联字段，则按照优先级和日期规则自动计算并添加字段
 */

import { moment } from 'obsidian';
import { Item } from '../components/types';
import { Priority } from '../parsers/helpers/inlineMetadata';
import { isTaskBlocked } from './taskDependency';
import {
  getEisenhowerQuadrant,
  EisenhowerQuadrant as MetadataQuadrant,
} from './eisenhowerMetadata';
import { t } from 'src/lang/helpers';

// Priority 字符串值常量（用于安全比较）
const PRI_HIGHEST = '0';
const PRI_HIGH = '1';
const PRI_MEDIUM = '2';
const PRI_NONE = '3';
const PRI_LOW = '4';
const PRI_LOWEST = '5';

/**
 * 检查是否为高优先级
 */
function isHighPriority(priority: Priority | null | string): boolean {
  if (!priority) {
    return false;
  }
  // 确保将优先级转换为字符串进行比较
  const priorityStr = String(priority);
  return priorityStr === PRI_HIGHEST || priorityStr === PRI_HIGH;
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
 * Eisenhower 象限
 */
export interface EisenhowerQuadrant {
  items: Item[];
  isImportant: boolean;
  isUrgent: boolean;
}

export interface EisenhowerClassification {
  q1: EisenhowerQuadrant; // 重要且紧急
  q2: EisenhowerQuadrant; // 重要不紧急
  q3: EisenhowerQuadrant; // 不重要但紧急
  q4: EisenhowerQuadrant; // 不重要不紧急
}

/**
 * 从 inlineMetadata 中读取优先级
 */
function getPriorityFromInlineMetadata(item: Item): Priority | null {
  if (!item.data.metadata.inlineMetadata) {
    return null;
  }

  const priorityField = item.data.metadata.inlineMetadata.find(
    (field) => field.key === 'priority'
  );

  if (!priorityField) {
    return null;
  }

  // 确保返回字符串类型的优先级，并去除 BOM 字符
  let priorityValue = String(priorityField.value);
  // 移除 BOM (U+FEFF) 和其他可能的不可见字符
  priorityValue = priorityValue.replace(/^[\uFEFF\u200B\u200C\u200D\u2060]/g, '');

  return priorityValue as Priority;
}

/**
 * 检查任务是否重要
 */
export function checkImportance(item: Item): boolean {
  // 1. 从 metadata.priority 读取（拖拽后可能被设置）
  if (item.data.metadata.priority) {
    const isHigh = isHighPriority(item.data.metadata.priority);
    return isHigh;
  }

  // 2. 从 inlineMetadata 中读取优先级（解析 markdown 时设置）
  const inlinePriority = getPriorityFromInlineMetadata(item);
  if (inlinePriority) {
    const isHigh = isHighPriority(inlinePriority);
    return isHigh;
  }

  // 3. 从 titleRaw 中提取优先级（备用方法）
  const priority = extractPriority(item.data.titleRaw);
  const isHigh = isHighPriority(priority);
  return isHigh;
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
 * 检查任务是否紧急
 * @param item 任务项
 * @param urgentDays 紧急判断天数，默认 3
 * @param useCache 是否使用缓存值（默认 false，确保实时计算）
 */
export function checkUrgency(item: Item, urgentDays: number = 3, useCache: boolean = false): boolean {
  // 1. 从缓存读取（仅当明确要求使用缓存时）
  if (useCache && item.data.metadata.isUrgent !== undefined) {
    return item.data.metadata.isUrgent;
  }

  // 2. 检查到期日期（实时计算）
  const metadata = item.data.metadata;

  // 优先检查 date（moment 对象）
  if (metadata.date && moment.isMoment(metadata.date)) {
    const deadline = moment(metadata.date).endOf('day');
    const urgentDeadline = moment().add(urgentDays, 'days').endOf('day');
    const isUrgent = deadline.isSameOrBefore(urgentDeadline);
    return isUrgent;
  }

  // 备用：检查 dateStr（原始日期字符串）
  if (metadata.dateStr) {
    const parsedDate = moment(metadata.dateStr, ['YYYY-MM-DD', moment.ISO_8601], false);
    if (parsedDate.isValid()) {
      const deadline = parsedDate.endOf('day');
      const urgentDeadline = moment().add(urgentDays, 'days').endOf('day');
      const isUrgent = deadline.isSameOrBefore(urgentDeadline);
      return isUrgent;
    }
  }

  // 检查 dueDate 字段（截止日期字符串）
  const dueDate = (metadata as any).dueDate;
  if (dueDate) {
    const parsedDate = moment(String(dueDate), ['YYYY-MM-DD', moment.ISO_8601], false);
    if (parsedDate.isValid()) {
      const deadline = parsedDate.endOf('day');
      const urgentDeadline = moment().add(urgentDays, 'days').endOf('day');
      const isUrgent = deadline.isSameOrBefore(urgentDeadline);
      return isUrgent;
    }
  }

  // 从 titleRaw 中提取截止日期（📅 格式）
  const titleRaw = item.data.titleRaw;
  const extractedDate = extractDueDate(titleRaw);
  if (extractedDate) {
    const deadline = extractedDate.endOf('day');
    const urgentDeadline = moment().add(urgentDays, 'days').endOf('day');
    const isUrgent = deadline.isSameOrBefore(urgentDeadline);
    return isUrgent;
  }

  return false;
}

/**
 * 将任务列表分类到 Eisenhower 四象限
 *
 * 新方案：
 * 1. 优先使用 [eisenhower::qx] 内联字段
 * 2. 如果不存在字段，则按规则计算并标记
 */
export function classifyEisenhower(
  items: Item[],
  urgentDays: number = 3
): EisenhowerClassification {
  const result: EisenhowerClassification = {
    q1: { items: [], isImportant: true, isUrgent: true },
    q2: { items: [], isImportant: true, isUrgent: false },
    q3: { items: [], isImportant: false, isUrgent: true },
    q4: { items: [], isImportant: false, isUrgent: false },
  };

  items.forEach((item) => {
    // 过滤条件 1: 跳过已完成
    if (item.data.checked) return;

    // 过滤条件 2: 跳过已取消 (- [-])
    if (item.data.titleRaw.trim().startsWith('- [-]')) return;

    // 过滤条件 3: 跳过被阻塞的任务
    if (isTaskBlocked(item, items)) return;

    // 新方案：优先从内联字段读取象限
    const metadataQuadrant = getEisenhowerQuadrant(item.data.titleRaw);

    let targetQuadrant: 'q1' | 'q2' | 'q3' | 'q4';

    if (metadataQuadrant) {
      // 已有内联字段，直接使用
      targetQuadrant = metadataQuadrant;
      console.log(`[Eisenhower] Using metadata field for "${item.data.titleRaw.substring(0, 30)}": ${metadataQuadrant}`);
    } else {
      // 没有内联字段，按规则计算
      const isImportant = checkImportance(item);
      const isUrgent = checkUrgency(item, urgentDays, false);

      console.log(`[Eisenhower] Auto-classifying "${item.data.titleRaw.substring(0, 30)}": isImportant=${isImportant}, isUrgent=${isUrgent}`);

      // 分类到象限
      if (isImportant && isUrgent) {
        targetQuadrant = 'q1';
      } else if (isImportant && !isUrgent) {
        targetQuadrant = 'q2';
      } else if (!isImportant && isUrgent) {
        targetQuadrant = 'q3';
      } else {
        targetQuadrant = 'q4';
      }
    }

    // 添加到对应象限
    result[targetQuadrant].items.push(item);
  });

  return result;
}

/**
 * 按项目标签排序 (#project 的任务排在前面)
 */
export function sortByProject(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const aHasProject = a.data.title.toLowerCase().includes('#project');
    const bHasProject = b.data.title.toLowerCase().includes('#project');

    if (aHasProject && !bHasProject) return -1;
    if (!aHasProject && bHasProject) return 1;
    return 0;
  });
}

/**
 * 获取象限索引
 * @param isImportant 是否重要
 * @param isUrgent 是否紧急
 * @returns 0=Q1, 1=Q2, 2=Q3, 3=Q4
 */
export function getQuadrantIndex(isImportant: boolean, isUrgent: boolean): number {
  if (isImportant && isUrgent) return 0;
  if (isImportant && !isUrgent) return 1;
  if (!isImportant && isUrgent) return 2;
  return 3;
}

/**
 * 获取象限显示名称
 */
export function getQuadrantName(isImportant: boolean, isUrgent: boolean): string {
  if (isImportant && isUrgent) return t('Important & Urgent') + ' 🔴';
  if (isImportant && !isUrgent) return t('Important & Not Urgent') + ' 🟢';
  if (!isImportant && isUrgent) return t('Not Important & Urgent') + ' 🟡';
  return t('Not Important & Not Urgent') + ' ⚪';
}
