// test-calendar.mjs — T05U03 月历纯函数验证（Node 直跑 TS，不是微信运行时证据）。
//
// 覆盖：周一起始对齐、每月天数/闰年、跨月跨年、切换月份按日序号映射并夹取月末、
//       今天/选中/有记录三种标记相互独立、网格不混入相邻月份日期。
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-calendar.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const modulePath = path.join(projectRoot, 'miniprogram', 'src', 'utils', 'calendar.ts');

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failures.push(name);
    console.log(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const cal = await import(pathToFileURL(modulePath).href);

function cellsOf(weeks) {
  return weeks.reduce((all, week) => all.concat(week), []);
}
function findCell(weeks, date) {
  return cellsOf(weeks).filter((cell) => cell && cell.date === date)[0] || null;
}

// ===== 基本常量 =====
check('星期标签为周一至周日', JSON.stringify(cal.WEEKDAY_LABELS) === JSON.stringify(['一', '二', '三', '四', '五', '六', '日']));

// ===== 日期解析/格式化 =====
check('合法业务日期可解析', JSON.stringify(cal.parseBusinessDate('2026-10-01')) === JSON.stringify({ year: 2026, month: 10, day: 1 }));
check('非法日期 2026-02-30 被拒绝', cal.parseBusinessDate('2026-02-30') === null);
check('非法月份 2026-13-01 被拒绝', cal.parseBusinessDate('2026-13-01') === null);
check('非补零日期 2026-1-1 被拒绝', cal.parseBusinessDate('2026-1-1') === null);
check('空串被拒绝', cal.parseBusinessDate('') === null);
check('格式化补零', cal.formatBusinessDate(2026, 9, 5) === '2026-09-05');

// ===== 每月天数 =====
check('2026-02 为 28 天', cal.daysInMonth(2026, 2) === 28);
check('2024-02 为 29 天（闰年）', cal.daysInMonth(2024, 2) === 29);
check('2026-10 为 31 天', cal.daysInMonth(2026, 10) === 31);
check('2026-09 为 30 天', cal.daysInMonth(2026, 9) === 30);
check('非法月份返回 0 天', cal.daysInMonth(2026, 13) === 0);

// ===== 跨月/跨年 =====
check('2026-01 前一月为 2025-12', JSON.stringify(cal.shiftMonth({ year: 2026, month: 1 }, -1)) === JSON.stringify({ year: 2025, month: 12 }));
check('2026-12 后一月为 2027-01', JSON.stringify(cal.shiftMonth({ year: 2026, month: 12 }, 1)) === JSON.stringify({ year: 2027, month: 1 }));
check('2026-10 后两月为 2026-12', JSON.stringify(cal.shiftMonth({ year: 2026, month: 10 }, 2)) === JSON.stringify({ year: 2026, month: 12 }));
check('月度键 YYYY-MM', cal.monthKeyOf(2026, 9) === '2026-09');
check('月份标题', cal.monthTitle(2026, 10) === '2026年10月');

// ===== 切换月份：日序号映射 + 月末夹取 =====
const sep2026 = { year: 2026, month: 9 };
check('10-31 映射到 9 月取 9-30', cal.mapDateToMonth('2026-10-31', sep2026) === '2026-09-30');
check('10-15 映射到 9 月保持 15', cal.mapDateToMonth('2026-10-15', sep2026) === '2026-09-15');
check('03-31 映射到 2026-02 取 02-28', cal.mapDateToMonth('2026-03-31', { year: 2026, month: 2 }) === '2026-02-28');
check('03-31 映射到 2024-02 取 02-29', cal.mapDateToMonth('2024-03-31', { year: 2024, month: 2 }) === '2024-02-29');
check('01-31 映射到 2026-02 取 02-28', cal.mapDateToMonth('2026-01-31', { year: 2026, month: 2 }) === '2026-02-28');
check('跨年映射 2026-01-15 → 2025-12-15', cal.mapDateToMonth('2026-01-15', { year: 2025, month: 12 }) === '2025-12-15');
check('无有效日期时映射到目标月 1 号', cal.mapDateToMonth('', { year: 2026, month: 9 }) === '2026-09-01');

// ===== 周一起始偏移 =====
check('2026-10-01 是周四，前面补 3 格', cal.mondayFirstOffset(2026, 10) === 3);
check('2026-10-05 是周一，偏移 0', cal.mondayFirstOffset(2026, 10) === 3 && cal.parseBusinessDate('2026-10-05') !== null);
check('2026-11-01 是周日，偏移 6', cal.mondayFirstOffset(2026, 11) === 6);

// ===== 网格结构 =====
const oct = { year: 2026, month: 10 };
const octWeeks = cal.buildMonthGrid(oct, {
  selectedDate: '2026-10-21',
  todayDate: '2026-10-21',
  recordDates: ['2026-10-19', '2026-10-21'],
});
check('2026-10 网格为整周（35 格）', octWeeks.length === 5 && cellsOf(octWeeks).length === 35);
check('首行前 3 格为空格、第 4 格是 1 号', octWeeks[0][3] && octWeeks[0][3].day === 1 && octWeeks[0][0] === null && octWeeks[0][1] === null && octWeeks[0][2] === null);
check('第二行第一格是 10-05（周一）', octWeeks[1][0] && octWeeks[1][0].date === '2026-10-05');
check('网格只包含当月日期', cellsOf(octWeeks).every((cell) => cell === null || cell.date.slice(0, 7) === '2026-10'));
check('没有相邻月份日期混入', cellsOf(octWeeks).filter((cell) => cell && cell.date.slice(0, 7) !== '2026-10').length === 0);

const todayCell = findCell(octWeeks, '2026-10-21');
check('今天标记落在 10-21', !!todayCell && todayCell.isToday === true);
check('选中标记落在 10-21', !!todayCell && todayCell.selected === true);
check('10-21 有记录标记', !!todayCell && todayCell.hasRecords === true);
const plainCell = findCell(octWeeks, '2026-10-20');
check('普通日期三项标记均为 false', !!plainCell && plainCell.isToday === false && plainCell.selected === false && plainCell.hasRecords === false);
const recordedCell = findCell(octWeeks, '2026-10-19');
check('只有记录的日期：hasRecords=true、非今天非选中', !!recordedCell && recordedCell.hasRecords === true && recordedCell.isToday === false && recordedCell.selected === false);

// 非今天/非选中月份：选中与今天可以不同
const novWeeks = cal.buildMonthGrid({ year: 2026, month: 11 }, {
  selectedDate: '2026-11-02',
  todayDate: '2026-10-21',
  recordDates: [],
});
check('跨月查看时今天标记不出现', cellsOf(novWeeks).every((cell) => cell === null || cell.isToday === false));
check('跨月查看时选中标记跟随选中日期', findCell(novWeeks, '2026-11-02').selected === true);

// 6 周月份：2026-08 从周六开始（偏移 5）+ 31 天 = 36 → 补到 42（6 行）
const augWeeks = cal.buildMonthGrid({ year: 2026, month: 8 }, { selectedDate: '2026-08-01', todayDate: '2026-08-01', recordDates: [] });
check('2026-08 网格为 6 周（42 格）', augWeeks.length === 6 && cellsOf(augWeeks).length === 42);

// 2 月 28 天：起点为周一，正好 4 周
const febWeeks = cal.buildMonthGrid({ year: 2021, month: 2 }, { selectedDate: '2021-02-01', todayDate: '2021-02-01', recordDates: [] });
check('2021-02 从周一开始、共 4 周（28 格）', febWeeks.length === 4 && cellsOf(febWeeks).length === 28 && febWeeks[0][0].day === 1);

console.log(failures.length === 0 ? `\n月历纯函数验证通过（${passed} 项）` : `\n失败 ${failures.length} 项：${failures.join(', ')}`);
process.exitCode = failures.length === 0 ? 0 : 1;