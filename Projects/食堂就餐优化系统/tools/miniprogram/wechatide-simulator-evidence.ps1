# wechatide-simulator-evidence.ps1 - WeChat DevTools simulator runtime evidence for T05.
#
# Uses the bundled wechatide CLI to drive the real WeChat runtime in the simulator:
# compile/open pages, read page data / console, run the AppStore flow (profile, target,
# plan, meal logs, export/restore, menu import) on real WXWebAssembly + wx storage,
# then close/reopen the project window to check local-storage restoration.
#
# NOTE: this is DEVTOOLS SIMULATOR evidence, NOT Xiaomi device evidence.
# Project window restart is not a phone process kill.
#
# Prereq: DevTools logged in, service port enabled, client "DeepSeek" authorized.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File tools\miniprogram\wechatide-simulator-evidence.ps1

param(
  [string]$OutDir = 'D:\项目\cpp\.toolchain\tmp\t05\device',
  [string]$ClientName = 'DeepSeek'
)

$ErrorActionPreference = 'Continue'
$w = 'D:\微信小程序\微信web开发者工具\wechatide.cmd'
$project = 'D:\项目\cpp\Projects\食堂就餐优化系统\miniprogram'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Save-Result([string]$name, [string[]]$arguments) {
  $text = & $w -c $ClientName @arguments 2>$null | Out-String
  Set-Content -Path (Join-Path $OutDir $name) -Value $text -Encoding utf8
  Write-Output "== $name =="
  Write-Output $text.Trim()
}

function Shot([string]$name) {
  & $w -c $ClientName simulator_screenshot --project $project --path (Join-Path $OutDir $name) --wait 1 --optimize $false 2>$null | Out-Null
  Write-Output "screenshot -> $name"
}

Write-Output "=== T05 DevTools simulator runtime evidence ==="
Save-Result 'sim-00-status.json' @('check_wechatide_status', '--skill-version', '0.3.11')
& $w -c $ClientName open_project_window --project $project --window-mode fullMode 2>$null | Out-Null
Start-Sleep -Seconds 6
Save-Result 'sim-01-open-page.json' @('simulator_open_page', '--project', $project, '--page', 'pages/home/index')

# A. Reset local data, save profile, compute target, generate plan.
$fnA = @'
async function(){
  var s = getApp().globalData.store;
  var reset = s.resetLocalData();
  var save = s.saveProfile(s.getProfileView().draft);
  var target = await s.computeTarget();
  var plan = await s.refreshPlan();
  var home = s.getHomeView();
  var result = {};
  result.resetOk = reset.ok;
  result.saveOk = save.ok;
  result.profileRevision = s.getProfileView().profileRevision;
  result.targetOk = target.ok;
  result.targetStatus = target.status;
  result.planOk = plan.ok;
  result.planStatus = plan.status;
  result.planKey = plan.planKey;
  result.businessDate = home.businessDate;
  result.mealCount = home.meals.length;
  result.flags = home.flags;
  result.simulated = home.menu.simulated;
  result.breakfastItems = home.meals[0].items.length;
  return result;
}
'@
$fnA = ($fnA -replace '\s+', ' ')
Save-Result 'sim-02-profile-target-plan.json' @('automation_evaluate', '--project', $project, '--fn-source', $fnA)
& $w -c $ClientName automation_page_action --project $project --action callMethod --method reload 2>$null | Out-Null
Save-Result 'sim-03-home-page-data.json' @('automation_page_action', '--project', $project, '--action', 'getData')
Shot 'sim-03-home.png'

# B. Meal logs: idempotent confirm, edit, revoke, manual unknown log, summaries, export/restore.
$fnB = @'
async function(){
  var s = getApp().globalData.store;
  var result = {};
  var c1 = s.confirmMeal('breakfast', {});
  var c2 = s.confirmMeal('breakfast', {});
  result.confirm1Ok = c1.ok;
  result.confirm2Ok = c2.ok;
  result.confirm2Duplicate = !!c2.duplicate;
  var logs = s.getLogsView();
  result.breakfastActiveAfterConfirm = logs.meals[0].active.length;
  result.confirmationId = logs.meals[0].active[0].confirmationId;
  result.logItemCount = logs.meals[0].active[0].items.length;
  var recordId = logs.meals[0].active[0].recordId;
  var itemKey = logs.meals[0].active[0].items[0].itemKey;
  var priceBefore = logs.meals[0].active[0].priceKnownCents;
  var edit = s.editLog(recordId, { items: [{ itemKey: itemKey, unitPriceCents: 150 }] });
  result.editOk = edit.ok;
  var logs2 = s.getLogsView();
  result.afterEditActive = logs2.meals[0].active.length;
  result.afterEditHistory = logs2.meals[0].history.length;
  result.priceBefore = priceBefore;
  result.priceAfter = logs2.meals[0].active[0].priceKnownCents;
  result.newRevision = logs2.meals[0].active[0].revision;
  result.supersedes = logs2.meals[0].active[0].supersedesRecordId;
  var revoke = s.revokeLog(logs2.meals[0].active[0].recordId);
  result.revokeOk = revoke.ok;
  var manual = s.addManualLog('lunch', { name: 'Yogurt-unknown', portionCode: 'full', quantity: 1, unitPriceCents: null, priceKnown: false, nutrition: null, note: 'simulator', clientToken: 'sim-manual-1' });
  var manualDup = s.addManualLog('lunch', { name: 'Yogurt-unknown', portionCode: 'full', quantity: 1, unitPriceCents: null, priceKnown: false, nutrition: null, note: 'simulator', clientToken: 'sim-manual-1' });
  result.manualOk = manual.ok;
  result.manualDuplicate = !!manualDup.duplicate;
  var logs3 = s.getLogsView();
  result.intakeEnergy = logs3.intake.energyLabel;
  result.intakeIncomplete = logs3.intake.incompleteNutrients;
  result.priceIncomplete = logs3.intake.priceIncomplete;
  result.budgetMessage = logs3.budget.message;
  var exported = await s.exportBackup();
  result.exportOk = exported.ok;
  result.exportDigest = exported.digest;
  result.exportLength = exported.text.length;
  result.exportFilePath = exported.filePath;
  var pre = await s.preflightRestore(exported.text);
  result.restorePreOk = pre.ok;
  var applied = await s.applyRestore(pre);
  result.restoreOk = applied.ok;
  result.restoreRows = applied.comparison.length;
  var allEqual = true;
  for (var i = 0; i < applied.comparison.length; i += 1) { if (!applied.comparison[i].equal) { allEqual = false; } }
  result.restoreAllEqual = allEqual;
  return result;
}
'@
$fnB = ($fnB -replace '\s+', ' ')
Save-Result 'sim-04-logs-export-restore.json' @('automation_evaluate', '--project', $project, '--fn-source', $fnB)
& $w -c $ClientName automation_navigate --project $project --action reLaunch --url '/pages/logs/index' 2>$null | Out-Null
& $w -c $ClientName automation_page_action --project $project --action callMethod --method reload 2>$null | Out-Null
Save-Result 'sim-05-logs-page-data.json' @('automation_page_action', '--project', $project, '--action', 'getData')
Shot 'sim-05-logs.png'

$fnE = @'
function(){
  var s = getApp().globalData.store;
  var home = s.getHomeView();
  var logs = s.getLogsView();
  var result = {};
  result.businessDate = home.businessDate;
  result.profileReady = home.profileReady;
  result.menuVersion = home.menu.menuVersion;
  result.planStatus = home.planStatus;
  result.planRequestId = home.requestId;
  result.logsToday = logs.meals[0].active.length + logs.meals[1].active.length + logs.meals[2].active.length;
  result.historyToday = logs.meals[0].history.length + logs.meals[1].history.length + logs.meals[2].history.length;
  result.lockCount = s.getDevView().lockCount;
  result.storageBytes = s.getDevView().storageBytes;
  return result;
}
'@
$fnE = ($fnE -replace '\s+', ' ')
Save-Result 'sim-03b-meal-card-outerwxml.json' @('automation_element_action', '--project', $project, '--action', 'outerWxml', '--selector', '.meal-card')
Save-Result 'sim-05e-before-restart.json' @('automation_evaluate', '--project', $project, '--fn-source', $fnE)
# C. Menu: reject bad hash, accept valid menu, atomic replace invalidates old plan.
$fnC = @'
async function(){
  var s = getApp().globalData.store;
  var result = {};
  if (!s.getLastPlanRequest()) { await s.refreshPlan(); } var catalogSource = s.peekState().catalog; var catalog; if (catalogSource) { catalog = JSON.parse(JSON.stringify(catalogSource)); } else { catalog = JSON.parse(s.getLastPlanRequest()).catalog; }
  var bad = JSON.parse(JSON.stringify(catalog));
  bad.catalogHash = 'sha256:' + Array(65).join('0');
  var badPre = await s.preflightMenu(JSON.stringify({ catalog: bad }), 'bad-menu.json');
  result.badOk = badPre.ok;
  result.badStage = badPre.stage;
  result.badMessage = badPre.message;
  result.menuVersionAfterBad = s.getMenuView().info.menuVersion;
  var good = JSON.parse(JSON.stringify(catalog));
  good.menuVersion = 'menu-simulated-v2-simulator';
  delete good.catalogHash;
  var goodPre = await s.preflightMenu(JSON.stringify({ catalog: good }), 'good-menu.json');
  result.goodPreOk = goodPre.ok;
  result.goodStage = goodPre.stage;
  result.goodMenuVersion = goodPre.catalog ? goodPre.catalog.menuVersion : '';
  result.planExistedBeforeApply = s.peekState().days[s.peekState().activeDate].plan !== null;
  var applied = s.applyMenu(goodPre);
  result.applyOk = applied.ok;
  result.applyMessage = applied.message;
  result.planAfterApplyIsNull = s.peekState().days[s.peekState().activeDate].plan === null;
  result.menuVersion = s.getMenuView().info.menuVersion;
  result.catalogMeta = s.peekState().catalogMeta;
  var refresh = await s.refreshPlan();
  result.planAfterNewMenuOk = refresh.ok;
  result.planAfterNewMenuStatus = refresh.status;
  return result;
}
'@
$fnC = ($fnC -replace '\s+', ' ')
Save-Result 'sim-06-menu-import.json' @('automation_evaluate', '--project', $project, '--fn-source', $fnC)
& $w -c $ClientName automation_navigate --project $project --action reLaunch --url '/pages/menu/index' 2>$null | Out-Null
& $w -c $ClientName automation_page_action --project $project --action callMethod --method reload 2>$null | Out-Null
Save-Result 'sim-07-menu-page-data.json' @('automation_page_action', '--project', $project, '--action', 'getData')
Shot 'sim-07-menu.png'

& $w -c $ClientName automation_navigate --project $project --action reLaunch --url '/pages/profile/index' 2>$null | Out-Null
& $w -c $ClientName automation_page_action --project $project --action callMethod --method reload 2>$null | Out-Null
Save-Result 'sim-05b-profile-page-data.json' @('automation_page_action', '--project', $project, '--action', 'getData')
& $w -c $ClientName automation_navigate --project $project --action reLaunch --url '/pages/dev/index' 2>$null | Out-Null
& $w -c $ClientName automation_page_action --project $project --action callMethod --method reload 2>$null | Out-Null
Save-Result 'sim-05c-dev-page-data.json' @('automation_page_action', '--project', $project, '--action', 'getData')
Save-Result 'sim-05d-hero-text.json' @('automation_element_action', '--project', $project, '--action', 'text', '--selector', '.hero-title')
# D. Open all pages; filter console errors.
foreach ($page in @('pages/home/index','pages/profile/index','pages/logs/index','pages/menu/index','pages/dev/index')) {
  & $w -c $ClientName simulator_open_page --project $project --page $page 2>$null | Out-Null
  Start-Sleep -Milliseconds 700
}
Save-Result 'sim-08-console-errors.json' @('get_simulator_console', '--project', $project, '--command', 'grep -n -i -E "error|fail|exception"')

# E. Close project window and reopen: DevTools-level local storage restoration.

$fnE = ($fnE -replace '\s+', ' ')
Start-Sleep -Seconds 6
& $w -c $ClientName simulator_open_page --project $project --page pages/home/index 2>$null | Out-Null
Start-Sleep -Seconds 3
Start-Sleep -Seconds 2
Save-Result 'sim-10-after-restart.json' @('automation_evaluate', '--project', $project, '--fn-source', $fnE)
Save-Result 'sim-11-home-after-restart.json' @('automation_page_action', '--project', $project, '--action', 'getData')
Shot 'sim-11-home-after-restart.png'

Write-Output "=== done: $OutDir ==="
