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
 * 从文本中提取截止日期（📅📆🗓 日期格式）
 * 注意：只提取 due date，不包括 start date (🛫) 或其他日期类型
 */
function extractDueDate(text: string): moment.Moment | null {
  // 匹配 due date emoji: 📅📆🗓（Tasks 插件标准）
  const dueDateRegex = /[📅📆🗓]\s*(\d{4}-\d{2}-\d{2})/u;
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
 * 检查任务是否紧急（仅基于 due date 📅）
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
  // 重要：只检查 due date (📅)，忽略 start date (🛫) 和其他日期类型
  const metadata = item.data.metadata;
  const titleRaw = item.data.titleRaw;

  // 首先从 titleRaw 中提取真正的 due date（📅 格式）
  // 这是最可靠的方法，因为 Kanban 的 metadata.date 可能包含 start date
  const extractedDate = extractDueDate(titleRaw);
  if (extractedDate) {
    const deadline = extractedDate.endOf('day');
    const urgentDeadline = moment().add(urgentDays, 'days').endOf('day');
    const isUrgent = deadline.isSameOrBefore(urgentDeadline);
    console.log(`[Eisenhower] checkUrgency from titleRaw 📅: ${deadline.format('YYYY-MM-DD')} <= ${urgentDeadline.format('YYYY-MM-DD')} = ${isUrgent}`);
    return isUrgent;
  }

  // 检查 inlineMetadata 中的 due 字段（Tasks 插件格式）
  if (metadata.inlineMetadata) {
    const dueField = metadata.inlineMetadata.find((field: any) => field.key === 'due');
    if (dueField && dueField.value) {
      const parsedDate = moment(String(dueField.value), ['YYYY-MM-DD', moment.ISO_8601], false);
      if (parsedDate.isValid()) {
        const deadline = parsedDate.endOf('day');
        const urgentDeadline = moment().add(urgentDays, 'days').endOf('day');
        const isUrgent = deadline.isSameOrBefore(urgentDeadline);
        console.log(`[Eisenhower] checkUrgency from inlineMetadata.due: ${deadline.format('YYYY-MM-DD')} <= ${urgentDeadline.format('YYYY-MM-DD')} = ${isUrgent}`);
        return isUrgent;
      }
    }
  }

  // 最后检查 metadata.date，但需要验证它确实是 due date 而不是 start date
  // 通过检查 titleRaw 是否包含 📅 来验证
  if (metadata.date && moment.isMoment(metadata.date) && titleRaw.includes('📅')) {
    const deadline = moment(metadata.date).endOf('day');
    const urgentDeadline = moment().add(urgentDays, 'days').endOf('day');
    const isUrgent = deadline.isSameOrBefore(urgentDeadline);
    console.log(`[Eisenhower] checkUrgency from metadata.date (with 📅): ${deadline.format('YYYY-MM-DD')} <= ${urgentDeadline.format('YYYY-MM-DD')} = ${isUrgent}`);
    return isUrgent;
  }

  // 备用：检查 dateStr，但同样需要验证是 due date
  if (metadata.dateStr && titleRaw.includes('📅')) {
    const parsedDate = moment(metadata.dateStr, ['YYYY-MM-DD', moment.ISO_8601], false);
    if (parsedDate.isValid()) {
      const deadline = parsedDate.endOf('day');
      const urgentDeadline = moment().add(urgentDays, 'days').endOf('day');
      const isUrgent = deadline.isSameOrBefore(urgentDeadline);
      console.log(`[Eisenhower] checkUrgency from metadata.dateStr (with 📅): ${deadline.format('YYYY-MM-DD')} <= ${urgentDeadline.format('YYYY-MM-DD')} = ${isUrgent}`);
      return isUrgent;
    }
  }

  console.log(`[Eisenhower] checkUrgency: no due date found, returning false`);
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
 * Eisenhower 智能排序
 * 排序规则（按优先级）：
 * 1. 有截止日期的任务排在没有截止日期的任务前面
 * 2. 截止日期越近越靠前
 * 3. 优先级越高越靠前（🔺 > ⏫ > 🔼 > 无 > 🔽 > ⏬）
 * 4. 如果日期和优先级都相同，保持原顺序
 */
export function sortByProject(items: Item[]): Item[] {
  // 优先级数值映射（越小优先级越高）
  const priorityValue: Record<string, number> = {
    '0': 0, // 🔺 Highest
    '1': 1, // ⏫ High
    '2': 2, // 🔼 Medium
    '3': 3, // None (default)
    '4': 4, // 🔽 Low
    '5': 5, // ⏬ Lowest
  };

  return [...items].sort((a, b) => {
    // 步骤 1: 提取截止日期
    const aDate = extractDueDate(a.data.titleRaw);
    const bDate = extractDueDate(b.data.titleRaw);

    // 步骤 2: 有日期的任务排在没有日期的任务前面
    const aHasDate = aDate !== null;
    const bHasDate = bDate !== null;

    if (aHasDate && !bHasDate) return -1;
    if (!aHasDate && bHasDate) return 1;

    // 步骤 3: 如果都有日期，按日期排序（越近越靠前）
    if (aHasDate && bHasDate) {
      const aDaysFromNow = aDate.diff(moment(), 'days');
      const bDaysFromNow = bDate.diff(moment(), 'days');

      // 逾期任务（负数）排最前，然后按天数升序
      if (aDaysFromNow !== bDaysFromNow) {
        return aDaysFromNow - bDaysFromNow;
      }
    }

    // 步骤 4: 日期相同时（或都没有日期），按优先级排序
    const aPriority = getPriorityValue(a, priorityValue);
    const bPriority = getPriorityValue(b, priorityValue);

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // 步骤 5: 都相同，保持原顺序
    return 0;
  });
}

/**
 * 获取任务的优先级数值
 */
function getPriorityValue(item: Item, priorityMap: Record<string, number>): number {
  // 优先从 metadata.priority 读取
  if (item.data.metadata.priority) {
    const value = priorityMap[String(item.data.metadata.priority)];
    if (value !== undefined) return value;
  }

  // 从 inlineMetadata 读取
  if (item.data.metadata.inlineMetadata) {
    const priorityField = item.data.metadata.inlineMetadata.find(
      (field) => field.key === 'priority'
    );
    if (priorityField && priorityField.value) {
      const value = priorityMap[String(priorityField.value).replace(/^[\uFEFF\u200B\u200C\u200D\u2060]/g, '')];
      if (value !== undefined) return value;
    }
  }

  // 从 titleRaw 提取
  const extractedPriority = extractPriority(item.data.titleRaw);
  if (extractedPriority) {
    const value = priorityMap[String(extractedPriority)];
    if (value !== undefined) return value;
  }

  // 默认优先级（无优先级）
  return 3;
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
