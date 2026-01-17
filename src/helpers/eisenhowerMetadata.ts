/**
 * Eisenhower 象限内联字段处理
 * 使用 [eisenhower::q1] 格式来标识任务所属象限
 * 不再使用虚拟映射，而是基于实际的内联字段进行分类
 */

export const EISENHOWER_METADATA_KEY = 'eisenhower';
export const EISENHOWER_FIELD_PATTERN = /\[eisenhower::(q[1-4])\]/gi;

export type EisenhowerQuadrant = 'q1' | 'q2' | 'q3' | 'q4';

/**
 * 从任务标题中提取象限信息
 */
export function getEisenhowerQuadrant(titleRaw: string): EisenhowerQuadrant | null {
  const match = titleRaw.match(EISENHOWER_FIELD_PATTERN);
  if (match && match.length > 0) {
    const value = match[0].toLowerCase().replace('[eisenhower::', '').replace(']', '');
    if (['q1', 'q2', 'q3', 'q4'].includes(value)) {
      return value as EisenhowerQuadrant;
    }
  }
  return null;
}

/**
 * 设置任务的内联字段
 * 如果字段不存在则添加，如果存在则更新
 */
export function setEisenhowerQuadrant(titleRaw: string, quadrant: EisenhowerQuadrant): string {
  // 先移除现有的 eisenhower 字段（包含前面的空格）
  let result = titleRaw.replace(/\s*\[eisenhower::(q[1-4])\]\s*/gi, '');
  // 移除可能遗留的前导空格（但保留必要的单个空格）
  result = result.replace(/\s{2,}/g, ' ').trim();

  // 插入策略：添加到任务内容的末尾
  // 格式：任务内容 [eisenhower::qx]
  // 注意：不在末尾添加空格，让用户决定是否需要后续内容
  result = result + ` [eisenhower::${quadrant}]`;

  return result;
}

/**
 * 规范化 eisenhower 标签格式
 * 确保标签前后都有正确的空格，以便 Tasks 插件正确解析
 */
export function normalizeEisenhowerTag(titleRaw: string): string {
  // 匹配可能格式错误的标签：前面没空格或后面紧接其他内容
  // 格式 1: text[eisenhower::qx] -> text [eisenhower::qx]
  // 格式 2: text[eisenhower::qx]more -> text [eisenhower::qx] more
  // 格式 3: text [eisenhower::qx]more -> text [eisenhower::qx] more

  let result = titleRaw;

  // 先处理标签前面的空格：非空白字符直接跟标签
  result = result.replace(/(\S)\[eisenhower::(q[1-4])\]/gi, '$1 [eisenhower::$2]');

  // 再处理标签后面的空格：标签后直接跟非空白字符
  result = result.replace(/\[eisenhower::(q[1-4])\](\S)/gi, '[eisenhower::$1] $2');

  return result;
}

/**
 * 移除任务的内联字段
 */
export function removeEisenhowerQuadrant(titleRaw: string): string {
  let result = titleRaw.replace(/\s*\[eisenhower::(q[1-4])\]/gi, '');
  // 移除可能遗留的多个空格
  result = result.replace(/\s{2,}/g, ' ').trim();
  return result;
}

/**
 * 象限属性定义
 */
export interface QuadrantProperties {
  quadrant: EisenhowerQuadrant;
  isImportant: boolean;
  isUrgent: boolean;
  title: string;
  description: string;
}

export const QUADRANT_PROPERTIES: Record<EisenhowerQuadrant, QuadrantProperties> = {
  q1: {
    quadrant: 'q1',
    isImportant: true,
    isUrgent: true,
    title: '重要且紧急 🔴',
    description: '高优先级 + N天内到期',
  },
  q2: {
    quadrant: 'q2',
    isImportant: true,
    isUrgent: false,
    title: '重要不紧急 🟢',
    description: '高优先级 + 无紧急截止日期',
  },
  q3: {
    quadrant: 'q3',
    isImportant: false,
    isUrgent: true,
    title: '不重要但紧急 🟡',
    description: '普通优先级 + N天内到期',
  },
  q4: {
    quadrant: 'q4',
    isImportant: false,
    isUrgent: false,
    title: '不重要不紧急 ⚪',
    description: '普通优先级 + 无紧急截止日期',
  },
};
