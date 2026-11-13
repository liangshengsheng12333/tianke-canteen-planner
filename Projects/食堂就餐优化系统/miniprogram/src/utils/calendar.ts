/**
 * utils/calendar.ts — 记录页月历的纯日期函数（无 wx 依赖，可被 Node 直接测试）。
 *
 * 边界：只做业务日期字符串（YYYY-MM-DD）与“月历网格”之间的换算；
 * 不读写存储、不判断记录、不计算营养/统计。记录有效性由 domain/logs 判定，
 * 页面只把“有有效记录的日期集合”传进来做标记。
 *
 * 口径（P01 定稿 v2 第 11 节）：
 *  - 星期按周一至周日排列；
 *  - 切换月份时把选中日的“日序号”映射到新月份，没有该日则取新月份最后一天；
 *  - 网格只渲染当月日期，前后补空格，不渲染相邻月日期，避免误点跨月。
 */

export interface CalendarMonth {
  year: number;
  /** 1–12，与 Date 的 0-based 月份区分开 */
  month: number;
}

export interface CalendarCell {
  /** 业务日期 YYYY-MM-DD */
  date: string;
  day: number;
  isToday: boolean;
  selected: boolean;
  hasRecords: boolean;
}

/** 周一至周日。下标与 mondayFirstOffset 的返回值一致。 */
export const WEEKDAY_LABELS: string[] = ['一', '二', '三', '四', '五', '六', '日'];

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** YYYY-MM-DD；非法输入返回 null（不抛错，页面按无效忽略）。 */
export function parseBusinessDate(text: string): CalendarMonth & { day: number } | null {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  if (!isValidMonth(year, month) || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

export function isValidMonth(year: number, month: number): boolean {
  return Number.isInteger(year) && Number.isInteger(month) && year >= 1900 && year <= 9999 && month >= 1 && month <= 12;
}

/** 某年某月的天数；用 UTC 避免本地时区/夏令时干扰。 */
export function daysInMonth(year: number, month: number): number {
  if (!isValidMonth(year, month)) {
    return 0;
  }
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function formatBusinessDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 月度键 YYYY-MM（月汇总的匹配前缀）。 */
export function monthKeyOf(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

export function monthOfDate(date: string): CalendarMonth | null {
  const parsed = parseBusinessDate(date);
  return parsed ? { year: parsed.year, month: parsed.month } : null;
}

export function monthTitle(year: number, month: number): string {
  return `${year}年${month}月`;
}

/** 向前/向后若干月；跨年自动进位。 */
export function shiftMonth(base: CalendarMonth, delta: number): CalendarMonth {
  const index = base.year * 12 + (base.month - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { year, month };
}

/** 日序号夹取到该月合法范围（31 → 30/29/28）。 */
export function clampDay(year: number, month: number, day: number): number {
  const last = daysInMonth(year, month);
  if (last === 0) {
    return 1;
  }
  if (!Number.isFinite(day)) {
    return 1;
  }
  return Math.min(Math.max(Math.trunc(day), 1), last);
}

/**
 * 把某天的“日序号”映射到目标月份：存在该日就用该日，否则取目标月最后一天。
 * 切换月份时用它保证选中日期合法、不跨月沿用无效日。
 */
export function mapDateToMonth(date: string, target: CalendarMonth): string {
  const parsed = parseBusinessDate(date);
  const wantedDay = parsed ? parsed.day : 1;
  const day = clampDay(target.year, target.month, wantedDay);
  return formatBusinessDate(target.year, target.month, day);
}

/** 当月 1 号前需要补的空格数（周一为 0）。 */
export function mondayFirstOffset(year: number, month: number): number {
  const weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=周日
  return (weekday + 6) % 7;
}

/**
 * 生成月历网格：每周一行、周一开头，行内空位用 null 表示。
 * 不渲染相邻月份日期（避免点选到非当月日期后状态与标题不一致）。
 */
export function buildMonthGrid(
  month: CalendarMonth,
  options: { selectedDate: string; todayDate: string; recordDates: string[] },
): (CalendarCell | null)[][] {
  const total = daysInMonth(month.year, month.month);
  const offset = mondayFirstOffset(month.year, month.month);
  const recordSet: Record<string, boolean> = {};
  for (const date of options.recordDates || []) {
    recordSet[date] = true;
  }
  const cells: (CalendarCell | null)[] = [];
  for (let i = 0; i < offset; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= total; day += 1) {
    const date = formatBusinessDate(month.year, month.month, day);
    cells.push({
      date,
      day,
      isToday: date === options.todayDate,
      selected: date === options.selectedDate,
      hasRecords: recordSet[date] === true,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (CalendarCell | null)[][] = [];
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7));
  }
  return weeks;
}