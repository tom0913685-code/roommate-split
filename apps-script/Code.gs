/**
 * 室友分帳：後端（Google Apps Script，綁定在 Google 試算表上）
 *
 * - 任何人都可以讀取帳目（觀看模式）
 * - 新增、刪除、結算、修改比例：必須帶 LINE 的 ID Token，且是已綁定的成員
 * - 成員綁定：用一次性的邀請碼（setup() 會產生 Circle 的邀請連結）
 */

// ===== 需要填寫的設定 =====
const CHANNEL_ID = '2012761151'; // 用來驗證 LINE ID Token
const LIFF_ID = '2012761151-1s9J91ca';                         // 用來產生邀請連結
// ==========================

const MEMBERS = ['Circle', 'Sparrow'];
const CATS = ['水費', '電費', '瓦斯費', '生活開支', '其他'];
const SHEET_RECORDS = '紀錄';
const SHEET_ARCHIVE = '已結算';
const SHEET_DEFAULTS = '預設比例';
const HEADERS = ['id', '付款日期', '帳單月份', '類別', '名稱／備註', '金額', '付款人', 'Circle 比例(%)', '建立者', '建立時間'];
const KEYS = ['id', 'date', 'month', 'category', 'name', 'amount', 'payer', 'pctC', 'createdBy', 'createdAt'];
const INVITE_DAYS = 7;

// ---------- 第一次使用：在 Apps Script 編輯器選擇 setup 並按「執行」 ----------
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [SHEET_RECORDS, SHEET_ARCHIVE].forEach(name => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const headers = name === SHEET_ARCHIVE ? HEADERS.concat(['結算時間']) : HEADERS;
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@'); // 全部存成文字，避免日期被自動轉換
    sh.setFrozenRows(1);
  });
  if (!ss.getSheetByName(SHEET_DEFAULTS)) {
    const d = ss.insertSheet(SHEET_DEFAULTS);
    d.getRange(1, 1, 1, 2).setValues([['類別', 'Circle 比例(%)']]).setFontWeight('bold');
    d.getRange(2, 1, CATS.length, 2).setValues(CATS.map(c => [c, 50]));
  }
  if (props_().getProperty('member_Circle')) {
    Logger.log('Circle 已經綁定過了，不會產生新的邀請連結。');
    return;
  }
  const code = makeInvite_('Circle');
  Logger.log('設定完成！請 Circle 在手機的 LINE 打開以下連結完成綁定（' + INVITE_DAYS + ' 天內有效）：\n' + inviteUrl_(code, 'Circle'));
}

// 萬一需要重新綁定（例如換 LINE 帳號），手動執行這個函式，再執行 setup()
function resetMembers() {
  MEMBERS.forEach(m => props_().deleteProperty('member_' + m));
  props_().deleteProperty('invite');
  Logger.log('已清除所有成員綁定。');
}

// ---------- 網頁 API ----------
function doGet() {
  return json_({ ok: true, data: state_(), me: null });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  try {
    return json_(handle_(body));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function handle_(b) {
  const action = b.action || 'list';

  // 讀取：登入失效也照樣回傳資料（當作觀看模式）
  if (action === 'list') {
    let me = null, tokenExpired = false;
    if (b.idToken) { try { me = whoami_(b.idToken); } catch (err) { tokenExpired = true; } }
    return result_(me, { tokenExpired: tokenExpired });
  }

  const me = b.idToken ? whoami_(b.idToken) : null;
  if (!me) throw new Error('need_login');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (action === 'join') return join_(me, b);
    if (!me.member) throw new Error('not_member');

    if (action === 'add') addRecords_([sanitize_(b.record, me.member)]);
    else if (action === 'delete') removeIds_([b.id], false);
    else if (action === 'settle') removeIds_(b.ids || [], true);
    else if (action === 'setDefault') setDefault_(b.category, b.pct);
    else if (action === 'import') addRecords_((b.records || []).map(r => sanitize_(r, me.member)));
    else if (action === 'invite') {
      if (MEMBERS.indexOf(b.as) < 0 || props_().getProperty('member_' + b.as)) throw new Error('cannot_invite');
      const code = makeInvite_(b.as);
      return result_(me, { invite: { code: code, as: b.as } });
    }
    else throw new Error('unknown_action');
  } finally {
    lock.releaseLock();
  }
  return result_(me);
}

// ---------- 身分驗證 ----------
function whoami_(idToken) {
  const res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post',
    payload: { id_token: idToken, client_id: CHANNEL_ID },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('token_invalid');
  const p = JSON.parse(res.getContentText());
  const member = MEMBERS.filter(m => props_().getProperty('member_' + m) === p.sub)[0] || null;
  return { userId: p.sub, member: member };
}

function join_(me, b) {
  if (me.member) return result_(me); // 已經綁定過
  const inv = JSON.parse(props_().getProperty('invite') || 'null');
  if (!inv || inv.code !== b.code || inv.as !== b.as || Date.now() > inv.exp) throw new Error('invite_invalid');
  if (props_().getProperty('member_' + inv.as)) throw new Error('already_taken');
  props_().setProperty('member_' + inv.as, me.userId);
  props_().deleteProperty('invite');
  me.member = inv.as;
  return result_(me, { joined: inv.as });
}

function makeInvite_(as) {
  const code = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  props_().setProperty('invite', JSON.stringify({ code: code, as: as, exp: Date.now() + INVITE_DAYS * 864e5 }));
  return code;
}
function inviteUrl_(code, as) {
  return 'https://liff.line.me/' + LIFF_ID + '?invite=' + code + '&as=' + as;
}

// ---------- 資料讀寫 ----------
function state_() {
  const members = {};
  MEMBERS.forEach(m => { members[m] = !!props_().getProperty('member_' + m); });
  return { records: readRecords_(), defaults: readDefaults_(), members: members };
}

function readRecords_() {
  const sh = sheet_(SHEET_RECORDS);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const tz = Session.getScriptTimeZone();
  return sh.getRange(2, 1, n, KEYS.length).getValues().map(row => {
    const r = {};
    KEYS.forEach((k, i) => {
      let v = row[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, k === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd');
      r[k] = v;
    });
    r.id = String(r.id);
    r.amount = Number(r.amount);
    r.pctC = Number(r.pctC);
    return r;
  }).filter(r => r.id);
}

function addRecords_(list) {
  const sh = sheet_(SHEET_RECORDS);
  const existing = {};
  readRecords_().forEach(r => { existing[r.id] = true; });
  const rows = list.filter(r => !existing[r.id]).map(r => KEYS.map(k => r[k]));
  if (!rows.length) return;
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, KEYS.length).setNumberFormat('@').setValues(rows);
}

// archive = true：搬到「已結算」分頁；false：直接刪除
function removeIds_(ids, archive) {
  const sh = sheet_(SHEET_RECORDS);
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const want = {};
  ids.forEach(id => { want[String(id)] = true; });
  const values = sh.getRange(2, 1, n, KEYS.length).getValues();
  if (archive) {
    const now = new Date().toISOString();
    const rows = values.filter(v => want[String(v[0])]).map(v => v.concat([now]));
    if (rows.length) {
      const arch = sheet_(SHEET_ARCHIVE);
      arch.getRange(arch.getLastRow() + 1, 1, rows.length, rows[0].length).setNumberFormat('@').setValues(rows);
    }
  }
  for (let i = values.length - 1; i >= 0; i--) {
    if (want[String(values[i][0])]) sh.deleteRow(i + 2);
  }
}

function readDefaults_() {
  const d = {};
  CATS.forEach(c => { d[c] = 50; });
  const sh = sheet_(SHEET_DEFAULTS);
  const n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, 2).getValues().forEach(([c, p]) => { if (CATS.indexOf(c) >= 0) d[c] = Number(p); });
  return d;
}

function setDefault_(cat, pct) {
  if (CATS.indexOf(cat) < 0) throw new Error('bad_category');
  pct = clampPct_(pct);
  const sh = sheet_(SHEET_DEFAULTS);
  const n = sh.getLastRow() - 1;
  const cats = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(r => r[0]) : [];
  const i = cats.indexOf(cat);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(pct);
  else sh.appendRow([cat, pct]);
}

// 檢查並整理前端送來的資料，避免寫入奇怪的內容
function sanitize_(r, by) {
  if (!r) throw new Error('bad_record');
  const amount = Math.round(Number(r.amount));
  if (!(amount > 0)) throw new Error('bad_amount');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !/^\d{4}-\d{2}$/.test(r.month)) throw new Error('bad_date');
  if (CATS.indexOf(r.category) < 0) throw new Error('bad_category');
  if (MEMBERS.indexOf(r.payer) < 0) throw new Error('bad_payer');
  let name = String(r.name || '').slice(0, 50);
  if (/^[=+\-@]/.test(name)) name = "'" + name; // 避免被試算表當成公式
  return {
    id: String(r.id || Utilities.getUuid()).slice(0, 40),
    date: r.date, month: r.month, category: r.category, name: name,
    amount: amount, payer: r.payer, pctC: clampPct_(r.pctC),
    createdBy: by, createdAt: new Date().toISOString(),
  };
}

// ---------- 小工具 ----------
function result_(me, extra) {
  const out = { ok: true, data: state_(), me: me ? { member: me.member } : null };
  Object.keys(extra || {}).forEach(k => { out[k] = extra[k]; });
  return out;
}
function clampPct_(v) { return Math.min(100, Math.max(0, Math.round(Number(v) || 0))); }
function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function props_() { return PropertiesService.getScriptProperties(); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
