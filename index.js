(() => {
  if (window.MEOW_PENCIL_SUITE_V2) return;
  window.MEOW_PENCIL_SUITE_V2 = true;
  window.MEOW_PENCIL_SUITE_VER = 'meow_suite_v8';

  // ===================== 加载提示 =====================
  setTimeout(function(){ try{ toast('✦ 喵喵套件已加载'); }catch(e){} }, 1500);

  // ===================== 基础 =====================
  const ID_BTN  = 'meow-float-pencil';
  const KEY_POS = 'meow_pencil_pos_suite_v1';

  const ID_MENU = 'meow-pencil-menu';
  const ID_MASK = 'meow-pencil-mask';

  const ID_SUMMARY = 'meow-summary-modal';
  const ID_WB      = 'meow-wb-modal';
  const ID_DIARY   = 'meow-diary-modal';

  const LS_API   = 'meow_sum_api_v1';
  const LS_PROMP = 'meow_sum_prompt_v1';
  const LS_PRE   = 'meow_sum_presets_v1';
const LS_LAST_OUT = 'meow_last_summary_out_v1';

  const LS_DIARY = 'meow_diary_quotes_v1';
  const LS_WB    = 'meow_worldbook_local_v1';
  const LS_WB_V2 = LS_WB; // ✅ 兼容：你后面用到 LS_WB_V2，但实际我们统一用 LS_WB
const LS_AUTO  = 'meow_auto_enabled_v1';
  const LS_API_PRESETS   = 'meow_api_presets_v1';      // 命名API预设列表
  const LS_PROMPT_PRESETS= 'meow_prompt_presets_v1';   // 命名总结词预设列表
  const LS_AUTO_ON       = 'meow_auto_summary_on_v1';  // 自动总结开关
  const LS_TABLE_GROUPS  = 'meow_table_groups_v1';     // 表格总结条目组（仅提示词管理）
  const LS_SUM_PROGRESS  = 'meow_sum_progress_v1';     // 最近一次“已总结楼层/最近N”记录
const LS_AUTO_SEND_PACK = 'meow_auto_send_pack_v1';
const LS_CHAT_TABLE    = 'meow_chat_table_v1';
const LS_INLINE_ON     = 'meow_inline_inject_on_v1';
const LS_INLINE_PARSE  = 'meow_inline_parse_on_v1';
const LS_INLINE_PROMPT = 'meow_inline_prompt_v1';
const LS_INLINE_PROMPT_PRESETS = 'meow_inline_prompt_presets_v1';
const LS_AUTO_WRITE_ON = 'meow_auto_write_on_v1';
const LS_INJECT_POS    = 'meow_inject_pos_v1';
const LS_INJECT_DEPTH  = 'meow_inject_depth_v1';
const LS_INJECT_ROLE   = 'meow_inject_role_v1';
const LS_INJECT_SCAN   = 'meow_inject_scan_v1';
const LS_SKIP_LAST_N   = 'meow_skip_last_n_v1';
const LS_UPLOAD_WB_ON  = 'meow_upload_wb_on_v1';


  function pickHost() {
    const cand = [];
    try { cand.push(window.top); } catch(e){}
    try { cand.push(window.parent); } catch(e){}
    cand.push(window);
    for (const w of cand) {
      try {
        const d = w.document;
        if (d && d.documentElement) return { W: w, doc: d };
      } catch(e){}
    }
    return { W: window, doc: document };
  }

  let { W, doc } = pickHost();
  const $q  = (s) => { try { return doc.querySelector(s); } catch(e){ return null; } };
  const $qa = (s) => { try { return Array.from(doc.querySelectorAll(s)); } catch(e){ return []; } };

  function getScrollRoot() {
    return $q('.simplebar-content-wrapper') || $q('#chat') || doc.scrollingElement || doc.documentElement;
  }

  function normPx(v, max) {
    v = Math.max(8, Math.min(max - 48, v));
    return Math.round(v);
  }

  function lsGet(key, fallback) {
    try {
      const v = W.localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch(e){ return fallback; }
  }

  // ✅ 原始写入（不给同步层触发递归）
  function lsSetRaw(key, val) {
    try { W.localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
  }

  // ✅ 业务写入（保留原行为 + 同步层钩子）
  function lsSet(key, val) {
    try { lsSetRaw(key, val); } catch(e){}

    // 同步层已初始化后，自动标记脏数据 + 防抖上传
    try{
      const sync = window.MEOW_SYNC;
      if (sync && typeof sync.markDirty === 'function') {
        sync.markDirty(key);
        if (typeof sync.schedulePush === 'function') sync.schedulePush(`lsSet:${String(key)}`);
      }
    }catch(e){}
  }
function meowPickAnchorIndexForSummary(ctx, preferIndex){
  try{
    const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : null;
    if (!chat || !chat.length) return -1;
    const n = chat.length;
    const i = Number.isFinite(preferIndex) ? (preferIndex|0) : -1;
    if (i >= 0 && i < n) return i;
    return n - 1; // 默认挂到最后一条消息
  }catch(e){ return -1; }
}

function meowGetBranchSummaries(ctx){
  const out = [];
  try{
    const chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : null;
    if (!chat) return out;
    for (let i=0;i<chat.length;i++){
      const msg = chat[i];
      const s = msg && msg.extra && msg.extra.meow_summary;
      if (s && typeof s.text === 'string'){
        out.push({ index:i, ...s });
      }
    }
  }catch(e){}
  return out;
}

function saveLastOut(v, meta={}, preferAnchorIndex){
  const text = String(v ?? '');
  // ✅ 首选：挂到 ST chat 文件（extra 字段）里，天然随分支/聊天切换
  try{
    const ctx = (typeof meowGetSTCtx === 'function') ? meowGetSTCtx() : null;
    if (ctx && Array.isArray(ctx.chat) && ctx.chat.length){
      const anchor = meowPickAnchorIndexForSummary(ctx, preferAnchorIndex);
      if (anchor >= 0){
        const msg = ctx.chat[anchor];
        if (msg){
          if (!msg.extra || typeof msg.extra !== 'object') msg.extra = {};
          msg.extra.meow_summary = Object.assign({
            text,
            createdAt: Date.now()
          }, (meta && typeof meta === 'object') ? meta : {});
          try{
            if (typeof ctx.saveChat === 'function') ctx.saveChat();
          }catch(e){}
          // ✅ 同步一份到 per-chat state（方便世界书可视化回写/上传逻辑复用）
          try{
            const uid0 = (meta && meta.chatUID) ? String(meta.chatUID) : '';
            let uid = uid0 || (typeof meowGetChatUID === 'function' ? String(meowGetChatUID()||'') : '');
            if (uid && uid.startsWith('fallback:')) uid = String(W.__MEOW_SUM_ACTIVE_UID__ || uid);
            if (uid && typeof meowSaveChatState === 'function') meowSaveChatState(uid, { out: text });
          }catch(e){}
          return true;
        }
      }
    }
  }catch(e){}
  // ✅ 兜底：老版本/无 ctx 时仍写 localStorage（避免直接报错）
  try { lsSet(LS_LAST_OUT, text); } catch(e){}
  return false;
}

function loadLastOut(opts={}){
  const noFallback = !!opts.noFallback;
  try{
    const ctx = (typeof meowGetSTCtx === 'function') ? meowGetSTCtx() : null;
    if (ctx && Array.isArray(ctx.chat)){
      const list = meowGetBranchSummaries(ctx);
      if (list.length){
        // 取当前分支里最后一个 summary
        return String(list[list.length - 1].text ?? '');
      }
      return '';
    }
  }catch(e){}
  if (noFallback) return '';
  try { return lsGet(LS_LAST_OUT, ''); } catch(e){ return ''; }
}

function loadLastOutSmall(opts={}){
  const noFallback = !!opts.noFallback;
  try{
    const ctx = (typeof meowGetSTCtx === 'function') ? meowGetSTCtx() : null;
    if (ctx && Array.isArray(ctx.chat)){
      let last = '';
      for (let i=0;i<ctx.chat.length;i++){
        const msg = ctx.chat[i];
        const s = msg && msg.extra && msg.extra.meow_summary_small;
        if (s && typeof s.text === 'string' && String(s.text).trim()){
          last = String(s.text);
        }
      }
      return last || '';
    }
  }catch(e){}
  if (noFallback) return '';
  return '';
}
// ===================== 世界书直写入层（TavernHelper API，跨端稳定）=====================
const MEOW_WB_API = (() => {
  function pickTH(){
    // 兼容 top / parent / self
    try { if (window.TavernHelper) return window.TavernHelper; } catch(e){}
    try { if (window.top && window.top.TavernHelper) return window.top.TavernHelper; } catch(e){}
    try { if (window.parent && window.parent.TavernHelper) return window.parent.TavernHelper; } catch(e){}
    return null;
  }

  async function getPrimaryLorebook(){
    const th = pickTH();
    if (!th || typeof th.getCurrentCharPrimaryLorebook !== 'function') {
      throw new Error('TavernHelper not ready / getCurrentCharPrimaryLorebook missing');
    }
    const primary = await th.getCurrentCharPrimaryLorebook();
    if (!primary) throw new Error('No Primary Lorebook (当前角色未绑定主世界书)');
    return { th, primary };
  }

  function normalizeEntryPayload(base, patch){
    // base: 现有条目；patch: 你要改的字段
    const type = patch.type || base?.type || 'constant';
    const enabled = (typeof patch.enabled === 'boolean') ? patch.enabled : (typeof base?.enabled === 'boolean' ? base.enabled : true);
    const prevent_recursion = (typeof patch.prevent_recursion === 'boolean') ? patch.prevent_recursion : (typeof base?.prevent_recursion === 'boolean' ? base.prevent_recursion : true);

    // keys 兼容：不给就沿用旧的；给了就用新的
    const keys = Array.isArray(patch.keys) ? patch.keys : (Array.isArray(base?.keys) ? base.keys : []);

    // content / comment：必须明确
    const content = (typeof patch.content === 'string') ? patch.content : (typeof base?.content === 'string' ? base.content : '');
    const comment = (typeof patch.comment === 'string') ? patch.comment : (typeof base?.comment === 'string' ? base.comment : '');

    // order：创建时常用，更新时不一定需要；这里两边都保留
    const order = (typeof patch.order === 'number') ? patch.order : (typeof base?.order === 'number' ? base.order : undefined);

    return { type, enabled, prevent_recursion, keys, content, comment, order };
  }

  async function listEntries(){
    const { th, primary } = await getPrimaryLorebook();
    if (typeof th.getLorebookEntries !== 'function') throw new Error('getLorebookEntries missing');
    const all = await th.getLorebookEntries(primary);
    return { th, primary, all: Array.isArray(all) ? all : [] };
  }

  async function upsertByComment({ comment, content, keys = [], enabled = true, type = 'constant', order = 99999, prevent_recursion = true }){
    const { th, primary, all } = await listEntries();
    const exist = all.find(e => e && e.comment === comment);

    if (exist && exist.uid && typeof th.setLorebookEntries === 'function') {
      const payload = normalizeEntryPayload(exist, { comment, content, keys, enabled, type, order, prevent_recursion });
      await th.setLorebookEntries(primary, [{
        uid: exist.uid,
        comment: payload.comment,
        content: payload.content,
        keys: payload.keys,
        enabled: payload.enabled,
        type: payload.type,
        prevent_recursion: payload.prevent_recursion,
        ...(typeof payload.order === 'number' ? { order: payload.order } : {}),
      }]);
      return { ok: true, mode: 'update', uid: exist.uid };
    }

    if (typeof th.createLorebookEntries !== 'function') throw new Error('createLorebookEntries missing');
    const payload = normalizeEntryPayload(null, { comment, content, keys, enabled, type, order, prevent_recursion });
    await th.createLorebookEntries(primary, [{
      comment: payload.comment,
      content: payload.content,
      keys: payload.keys,
      enabled: payload.enabled,
      type: payload.type,
      order: payload.order,
      prevent_recursion: payload.prevent_recursion,
    }]);
    return { ok: true, mode: 'create' };
  }

  // 你以后想用 uid 精准更新也可以（可选）
  async function upsertByUid({ uid, comment, content, keys, enabled, type, order, prevent_recursion }){
    const { th, primary, all } = await listEntries();
    const exist = all.find(e => e && e.uid === uid);
    if (!exist) throw new Error('uid not found');
    if (typeof th.setLorebookEntries !== 'function') throw new Error('setLorebookEntries missing');

    const payload = normalizeEntryPayload(exist, { uid, comment, content, keys, enabled, type, order, prevent_recursion });
    await th.setLorebookEntries(primary, [{
      uid: exist.uid,
      comment: payload.comment,
      content: payload.content,
      keys: payload.keys,
      enabled: payload.enabled,
      type: payload.type,
      prevent_recursion: payload.prevent_recursion,
      ...(typeof payload.order === 'number' ? { order: payload.order } : {}),
    }]);
    return { ok: true, mode: 'update', uid: exist.uid };
  }

  async function canWrite(){
    try {
      const { th } = await getPrimaryLorebook();
      return !!(th && typeof th.getLorebookEntries === 'function' && (typeof th.createLorebookEntries === 'function' || typeof th.setLorebookEntries === 'function'));
    } catch(e){
      return false;
    }
  }

  async function deleteByComment(comment){
    try{
      const { th, primary, all } = await listEntries();
      const exist = all.find(e => String(e.comment||e.memo||'') === String(comment));
      if (!exist || !exist.uid) return { ok:false, reason:'not_found' };
      if (typeof th.deleteLorebookEntry === 'function'){
        await th.deleteLorebookEntry(primary, exist.uid);
        return { ok:true, mode:'delete' };
      }
      // 兜底：用 setLorebookEntries 把 content 清空
      if (typeof th.setLorebookEntries === 'function'){
        await th.setLorebookEntries(primary, [{ uid: exist.uid, content:'[已删除]', enabled:false }]);
        return { ok:true, mode:'disabled' };
      }
      return { ok:false, reason:'no_delete_api' };
    }catch(e){ return { ok:false, reason:String(e?.message||e) }; }
  }
  return { pickTH, canWrite, listEntries, upsertByComment, upsertByUid, deleteByComment };


})(); // ✅ 修复：先正确结束 MEOW_WB_API IIFE，避免后续同步层被 return 吃掉


// ===================== MEOW 跨端自动同步（同一云酒馆换设备：基于 SillyTavern 服务器持久化） =====================
// 目标：不动任何 UI；让本脚本所有 meow_* localStorage 数据在“同一云酒馆”下跨设备一致。
// 做法：把 localStorage 的打包快照写入 SillyTavern 的 extensionSettings（服务器保存）；换设备/重开页面时拉取并回填 localStorage。
// 补充：如果是“电脑本地 + 云酒馆两套”，用 exportPack / importPack 做手动同步包。

const MEOW_SYNC_STORE_NS = 'meow_sync_store_v1';   // 放在 extensionSettings 下
const LS_SYNC_META   = 'meow_sync_meta_v1';       // { map:{key:mtime}, lastPullAt, lastPushAt, rev }
const LS_SYNC_CFG    = 'meow_sync_cfg_v1';        // 自动同步配置（会随 pack 走）
const LS_SYNC_DEVICE = 'meow_sync_device_id_v1';  // 设备ID（会随 pack 走）
const LS_SYNC_STAGE  = 'meow_sync_stage_v1';      // 最近一次导出包（便于手动复制）

function meowSyncNow(){ return Date.now(); }
function meowSyncRandomId(){ return 'dev_' + Math.random().toString(36).slice(2,10) + '_' + Date.now().toString(36); }
function meowSyncDeviceId(){
  let id = lsGet(LS_SYNC_DEVICE, '');
  if (!id){
    id = meowSyncRandomId();
    try{ if (typeof lsSetRaw === 'function') lsSetRaw(LS_SYNC_DEVICE, id); }catch(e){}
  }
  return id;
}

function meowSyncCfg(){
  return lsGet(LS_SYNC_CFG, {
    auto: true,
    autoPullOnBoot: true,
    autoPullOnFocus: true,
    autoPullIntervalMs: 60000,
    autoPushDebounceMs: 1800,
    transport: 'st_server',
    scope: 'global',
  });
}
function meowSyncSaveCfg(patch){
  const cfg = { ...meowSyncCfg(), ...(patch||{}) };
  try{ if (typeof lsSetRaw === 'function') lsSetRaw(LS_SYNC_CFG, cfg); }catch(e){}
  try{ meowSyncStampKey(LS_SYNC_CFG); }catch(e){}
  return cfg;
}

// ✅ 同步白名单（显式 + 前缀兜底）
const MEOW_SYNC_KEYS = [
  KEY_POS,
  LS_API, LS_PROMP, LS_PRE,
  LS_DIARY, LS_WB, LS_AUTO,
  LS_API_PRESETS, LS_PROMPT_PRESETS, LS_AUTO_ON,
  LS_TABLE_GROUPS, LS_SUM_PROGRESS, LS_AUTO_SEND_PACK,
  // per-chat 仓库（用字面量避免 TDZ）
  'meow_sum_by_chat_v1',
  'meow_wb_by_chat_v1',
  'meow_chat_table_v1',
  // 世界书/美化相关
  'meow_wb_theme_v1',
  'meow_wb_beauty_v4',
  'meow_wb_textview_custom_v1',
  'meow_wb_legacy_disabled_v1',
  // 同步层自身
  LS_SYNC_CFG,
  LS_SYNC_DEVICE,
];
const MEOW_SYNC_PREFIXES = ['meow_'];

// 不把“元数据/临时导出”本身打进包（避免自引用膨胀）
const MEOW_SYNC_BLACKLIST = new Set([ LS_SYNC_META, LS_SYNC_STAGE ]);

function meowSyncListKeys(){
  const set = new Set(MEOW_SYNC_KEYS.filter(Boolean));
  try{
    for (let i = 0; i < W.localStorage.length; i++){
      const k = W.localStorage.key(i);
      if (!k) continue;
      if (MEOW_SYNC_BLACKLIST.has(k)) continue;
      if (MEOW_SYNC_PREFIXES.some(p => String(k).startsWith(p))) set.add(k);
    }
  }catch(e){}
  return Array.from(set);
}

function meowSyncGetMeta(){
  const m = lsGet(LS_SYNC_META, { map:{}, lastPullAt:0, lastPushAt:0, rev:0 });
  m.map ||= {};
  return m;
}
function meowSyncSaveMeta(m){
  try{ if (typeof lsSetRaw === 'function') lsSetRaw(LS_SYNC_META, m); }catch(e){}
}
function meowSyncStampKey(key, t){
  if (!key || MEOW_SYNC_BLACKLIST.has(key)) return;
  if (!String(key).startsWith('meow_') && !MEOW_SYNC_KEYS.includes(key)) return;
  const m = meowSyncGetMeta();
  m.map[key] = t || meowSyncNow();
  m.rev = (m.rev||0) + 1;
  meowSyncSaveMeta(m);
}

function meowBuildSyncPack(){
  const keys = meowSyncListKeys();
  const meta = meowSyncGetMeta();
  const now = meowSyncNow();
  const items = {};

  // ✅ 防止“空配置”覆盖另一端真配置（尤其 iOS 新设备首次运行）
  function isMeaningfulKV(k, raw){
    const key = String(k||'');
    const s = String(raw||'').trim();

    // API 配置：至少有 baseUrl/apiKey/model 之一才算“有意义”
    if (key === LS_API){
      try{
        const j = JSON.parse(s || '{}');
        const baseUrl = String(j?.baseUrl || j?.url || '').trim();
        const apiKey  = String(j?.apiKey  || j?.key || '').trim();
        const model   = String(j?.model   || '').trim();
        return !!(baseUrl || apiKey || model);
      }catch(e){
        return s.length > 2;
      }
    }

    if (!s) return false;
    if (s === '{}' || s === '[]' || s === 'null') return false;
    return true;
  }

  for (const k of keys){
    if (!k || MEOW_SYNC_BLACKLIST.has(k)) continue;
    try{
      const raw = W.localStorage.getItem(k);
      if (raw == null) continue;
      if (!isMeaningfulKV(k, raw)) continue;
      items[k] = { raw, t: Number(meta.map?.[k] || now) || now };
    }catch(e){}
  }
  return { _meowSync: 1, deviceId: meowSyncDeviceId(), updatedAt: now, items };
}

function meowMergeSyncPack(pack, opt={}){
  if (!pack || pack._meowSync !== 1 || !pack.items || typeof pack.items !== 'object') return { ok:false, reason:'bad_pack' };
  const meta = meowSyncGetMeta(); meta.map ||= {};
  let changed=0, skipped=0;
  const keys = Object.keys(pack.items||{});
  for (const k of keys){
    if (!k || MEOW_SYNC_BLACKLIST.has(k)) { skipped++; continue; }
    const allowed = String(k).startsWith('meow_') || MEOW_SYNC_KEYS.includes(k) || !!opt.allowAnyKey;
    if (!allowed) { skipped++; continue; }
    const it = pack.items[k];
    if (!it || typeof it.raw !== 'string') { skipped++; continue; }
    const remoteT = Number(it.t||0)||0;
    const localT  = Number(meta.map[k]||0)||0;
    if (!opt.force && localT > remoteT) { skipped++; continue; }
    try{ W.localStorage.setItem(k, it.raw); meta.map[k] = remoteT || meowSyncNow(); changed++; }catch(e){ skipped++; }
  }
  meta.lastPullAt = meowSyncNow();
  if (changed) meta.rev = (meta.rev||0) + 1;
  meowSyncSaveMeta(meta);
  return { ok:true, changed, skipped, total: keys.length };
}

function meowExportSyncPack(pretty=false){
  const txt = JSON.stringify(meowBuildSyncPack(), null, pretty ? 2 : 0);
  try{ if (typeof lsSetRaw === 'function') lsSetRaw(LS_SYNC_STAGE, txt); }catch(e){}
  return txt;
}
function meowImportSyncPack(text, opt={}){
  let pack=null;
  try{ pack = JSON.parse(String(text||'')); }catch(e){ return { ok:false, reason:'json_parse_failed' }; }
  return meowMergeSyncPack(pack, opt);
}

// ===================== 服务器通道（SillyTavern extensionSettings） =====================
function meowPickST(){
  const cand = [];
  try { cand.push(window); } catch(e){}
  try { cand.push(window.top); } catch(e){}
  try { cand.push(window.parent); } catch(e){}
  for (const w of cand){
    try{
      if (w && w.SillyTavern && typeof w.SillyTavern.getContext === 'function') return w.SillyTavern;
    }catch(e){}
  }
  return null;
}
function meowGetSTCtx(){
  try{
    const st = meowPickST();
    return st && typeof st.getContext === 'function' ? st.getContext() : null;
  }catch(e){ return null; }
}
function meowGetServerStore(){
  const ctx = meowGetSTCtx();
  if (!ctx || !ctx.extensionSettings) return null;
  ctx.extensionSettings[MEOW_SYNC_STORE_NS] ||= { v:1, updatedAt:0, deviceId:'', pack:null };
  return { ctx, store: ctx.extensionSettings[MEOW_SYNC_STORE_NS] };
}
function meowSaveServerStore(){
  try{
    const ctx = meowGetSTCtx();
    // ⚠️ 重要：保持 this 绑定
    if (ctx && typeof ctx.saveSettingsDebounced === 'function') return ctx.saveSettingsDebounced();
    if (ctx && typeof ctx.saveSettings === 'function') return ctx.saveSettings();
  }catch(e){}
}

async function meowPushSyncToServer(){
  const cfg = meowSyncCfg();
  if (cfg.transport !== 'st_server') return { ok:false, reason:'transport_off' };

  const st = meowGetServerStore();
  if (!st) return { ok:false, reason:'st_not_ready' };

  const pack = meowBuildSyncPack();
  st.store.pack = pack;
  st.store.updatedAt = pack.updatedAt;
  st.store.deviceId  = pack.deviceId;
  st.store.v = 1;

  meowSaveServerStore();

  const m = meowSyncGetMeta(); m.lastPushAt = meowSyncNow(); meowSyncSaveMeta(m);
  return { ok:true, bytes: JSON.stringify(pack).length, updatedAt: pack.updatedAt, total:Object.keys(pack.items||{}).length };
}

async function meowPullSyncFromServer(opt={}){
  const cfg = meowSyncCfg();
  if (cfg.transport !== 'st_server') return { ok:false, reason:'transport_off' };

  const st = meowGetServerStore();
  if (!st || !st.store || !st.store.pack) return { ok:false, reason:'remote_empty' };

  const pack = st.store.pack;
  const res = meowMergeSyncPack(pack, { force: !!opt.force });
  res.remoteUpdatedAt = Number(st.store.updatedAt||0)||0;
  res.deviceId = String(st.store.deviceId||'');
  return res;
}

// 启动拉取：优先从服务器回填；服务器空时不做“空数据做种子”（避免把真配置顶掉）
async function bootSyncPull(opt={}){
  const cfg = meowSyncCfg();
  if (!cfg.autoPullOnBoot && !opt.force) return { ok:false, reason:'boot_pull_off' };

  const pull = await meowPullSyncFromServer({ force: !!opt.force }).catch(e=>({ ok:false, reason:e?.message||'pull_error' }));
  if (pull && pull.ok) return pull;

  // 服务器空：只有当本机确实有“有意义的数据”才做种子
  try{
    const pack = meowBuildSyncPack();
    const meaningful = Object.keys(pack.items||{}).filter(k=>k!==LS_SYNC_CFG && k!==LS_SYNC_DEVICE).length;
    if (meaningful > 0){
      const pushed = await meowPushSyncToServer().catch(e=>({ ok:false, reason:e?.message||'push_error' }));
      return pushed.ok ? { ok:false, reason:'seeded_remote', seeded:true } : pushed;
    }
  }catch(e){}

  return pull;
}

// ===================== 调度：防抖推送 + 轻量启动/回焦点拉取 =====================
const __MEOW_SYNC_STATE__ = { timer:null, init:false };

function scheduleSync(){
  const cfg = meowSyncCfg();
  if (!cfg.auto) return;
  clearTimeout(__MEOW_SYNC_STATE__.timer);
  __MEOW_SYNC_STATE__.timer = setTimeout(async ()=>{
    try{ await meowPushSyncToServer(); }catch(e){}
  }, Math.max(400, Number(cfg.autoPushDebounceMs||1800)));
}

window.MEOW_SYNC = {
  KEYS: MEOW_SYNC_KEYS,
  listKeys: meowSyncListKeys,
  cfg: meowSyncCfg,
  saveCfg: meowSyncSaveCfg,
  exportPack: meowExportSyncPack,
  importPack: meowImportSyncPack,
  pushNow: meowPushSyncToServer,
  pullNow: meowPullSyncFromServer,
  bootPull: bootSyncPull,
  schedulePush: scheduleSync,
  markDirty(key){ try{ meowSyncStampKey(key); }catch(e){} },
};

// ✅ 兼容：脚本可能跑在 iframe；把句柄同时挂到 globalThis/top/parent，便于 iOS 控制台调用
(function(){
  try{
    const api = window.MEOW_SYNC;
    if (!api) return;
    try{ globalThis.MEOW_SYNC = api; }catch(e){}
    try{ window.MEOW_SYNC = api; }catch(e){}
    try{ window.top && (window.top.MEOW_SYNC = api); }catch(e){}
    try{ window.parent && (window.parent.MEOW_SYNC = api); }catch(e){}
  }catch(e){}
})();

// 初始化：启动先拉一次；focus/定时轻拉取 + 定时推送兜底
setTimeout(()=>{
  try{
    if (__MEOW_SYNC_STATE__.init) return;
    __MEOW_SYNC_STATE__.init = true;

    bootSyncPull({ force:true }).catch(()=>{});

    window.addEventListener('focus', ()=>{
      try{
        const cfg = meowSyncCfg();
        if (!cfg.auto || !cfg.autoPullOnFocus) return;
        bootSyncPull({ force:true });
      }catch(e){}
    }, { passive:true });

    const ms = Math.max(20000, Number(meowSyncCfg().autoPullIntervalMs||60000));
    setInterval(()=>{
      try{
        if (!meowSyncCfg().auto) return;
        bootSyncPull({ force:false }).catch(()=>{});
        scheduleSync();
      }catch(e){}
    }, ms);
  }catch(e){}
}, 0);



// ===================== 表格总结条目组：存储 / 管理（仅提示词注入） =====================
  function tgLoad(){
    return lsGet(LS_TABLE_GROUPS, {
      groups: [
        {
          id: 'people',
          name: '人物表',
          note: '角色信息结构化',
          fields: [
            { key:'角色名', prompt:'提取或更新角色名（可多角色）。' },
            { key:'外貌',   prompt:'用可观察特征描述外貌，避免空话。' },
            { key:'性格',   prompt:'用行为/语言特征概括性格，不要读心。' }
          ],
          rules: {
            inject: '把新信息写入对应字段；没有信息则留空。',
            update: '已有字段只在出现明显变化时更新，避免重复。',
            modify: '内容有冲突时，以最新楼层为准并注明冲突点。',
            delete: '明确被否定/作废的信息，从字段中移除并标注“已作废”。'
          }
        }
      ],
      enabledIds: ['people'] // 默认启用的人物表
    });
  }
  function tgSave(db){ lsSet(LS_TABLE_GROUPS, db); }

  function tgFindGroup(db, id){
    return (db.groups || []).find(g => String(g.id) === String(id));
  }

 function tgBuildInjectionText(){
  try {
    // ===== 唯一来源：直接读世界书模块 LS_WB =====
    const LS_KEY = (typeof LS_WB !== 'undefined') ? LS_WB : 'meow_worldbook_local_v1';
    let db = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      db = raw ? JSON.parse(raw) : null;
    } catch(e) { db = null; }
    if (!db || db.v !== 4) return '';

    const tabs   = Array.isArray(db.tabs) ? db.tabs.slice() : [];
    const frames = db.frames || {};
    const show   = db.show   || {};

    // 按 order 排序
    tabs.sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));

    // 只收集 show[tabId] !== false 的板块（开关来源 = 图1 酒馆世界书基础设置页）
    const active = [];
    for (const t of tabs) {
      const tid = String(t?.id || '').trim();
      if (!tid) continue;
      if (show[tid] === false) continue;   // 开关关掉的跳过
      let fr = frames[tid];
      // ★ 如果框架规则不存在，用默认值（确保注入文本完整）
      if (!fr) {
        const defMap = {
          time: { note:'时间/地点/天气/氛围等', fields:[
            { key:'时间', prompt:'发生的时间（尽量具体）' },
            { key:'地点', prompt:'发生地点（可分层级）' },
            { key:'环境', prompt:'天气/光照/声音/人群等可观测要素' },
            { key:'规则', prompt:'本回合有效的限制/代价/约束' },
          ]},
          role: { note:'人物卡/关系/状态等', fields:[
            { key:'角色名', prompt:'角色姓名/称呼' },
            { key:'身份', prompt:'身份/阵营/立场/工作' },
            { key:'外貌', prompt:'外观特征（可观测）' },
            { key:'性格', prompt:'该角色的性格特点概述' },
            { key:'关系', prompt:'与{{user}}的关系' },
            { key:'好感', prompt:'对{{user}}的好感' },
            { key:'状态', prompt:'当前角色的状态' },
          ]},
          plot: { note:'阶段性大纲/走向', fields:[
            { key:'主线', prompt:'主线推进到哪里' },
            { key:'冲突', prompt:'当前主要矛盾/对立' },
            { key:'伏笔', prompt:'新增或被触发的伏笔' },
            { key:'下一步', prompt:'下一步最可能发生的节点' },
          ]},
          event:{ note:'事件记录/线索', fields:[
            { key:'事件', prompt:'发生了什么（简洁）' },
            { key:'参与', prompt:'参与者/相关者' },
            { key:'结果', prompt:'产生的结果/变化' },
            { key:'线索', prompt:'新线索/证据/暗示' },
          ]},
          task: { note:'任务/约定/待办', fields:[
            { key:'约定', prompt:'双方约定/誓言/规则' },
            { key:'待办', prompt:'待办事项清单' },
            { key:'期限', prompt:'截止/触发条件' },
            { key:'风险', prompt:'违约代价/风险提示' },
          ]},
          item: { note:'道具/物品/资源', fields:[
            { key:'物品', prompt:'物品名称/类别' },
            { key:'来源', prompt:'获取方式/归属' },
            { key:'用途', prompt:'用途/效果（客观）' },
            { key:'状态', prompt:'耐久/次数/缺损' },
          ]},
        };
        const base = defMap[tid];
        if (!base) continue;
        fr = {
          enabled: true, note: base.note, fields: base.fields,
          rules: {
            inject: '把本组"组备注+字段定义+规则"注入总提示词，作为本组总结规范。',
            add:    '当出现新信息：新增行；尽量不重复旧内容。',
            modify: '当信息变化：更新对应字段；必要时合并/拆分行；保持字段语义稳定。',
            del:    '当信息无效：明确标记删除原因；不要悄悄丢失信息。',
          }
        };
      }
      active.push({ tid, tab: t, fr });
    }
    if (!active.length) return '';

    // ===== 拼装注入文本 =====
    let out = '\n\n【表格总结条目注入】\n你需要在输出表格时，同时遵守下列板块的字段与规则：\n';

    for (const { tid, tab, fr } of active) {
      const name = tab.name || tid;
      out += `\n  【${name}】\n`;

      // 组备注
      if (fr.note) out += `  备注：${fr.note}\n`;

      // 字段
      const fields = Array.isArray(fr.fields) ? fr.fields : [];
      if (fields.length) {
        out += `  字段：\n`;
        for (const f of fields) {
          const k = String(f?.key || '').trim();
          if (!k) continue;
          out += `  - ${k}：${f.prompt || ''}\n`;
        }
      }

      // 规则
      const r = fr.rules || {};
      const rInject  = String(r.inject  || '').trim();
      const rAdd     = String(r.add     || '').trim();
      const rModify  = String(r.modify  || '').trim();
      const rDel     = String(r.del || r.delete || '').trim();
      if (rInject || rAdd || rModify || rDel) {
        out += `  规则：\n`;
        if (rInject) out += `  - 注入：${rInject}\n`;
        if (rAdd)    out += `  - 新增：${rAdd}\n`;
        if (rModify) out += `  - 修改：${rModify}\n`;
        if (rDel)    out += `  - 删除：${rDel}\n`;
      }
    }

    out += '\n\n【输出格式硬性要求】\n' +
      '必须按"分组段落"输出，每组以一行段首标记：例如【role】、【event】。\n' +
      '每个分组段落下面再输出该组的表格内容。\n';

    return out.trim();
  } catch (e) {
    // 全程 try/catch 兜底：出错就返回空字符串，绝不让总结弹窗炸掉
    try { console.warn('[MEOW] tgBuildInjectionText failed', e); } catch(_){}
    return '';
  }
}

  function tgSaveProgress(obj){
    lsSet(LS_SUM_PROGRESS, {
      t: Date.now(),
      ...obj
    });
    // ✅ 同步写入 per-chat 状态（修复切换聊天后进度不刷新）
    try{
      const uid = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : (window.__MEOW_SUM_ACTIVE_UID__ || '');
      if (uid) meowSaveChatState(uid, { lastFrom: obj.lastFrom||null, lastTo: obj.lastTo||null, lastN: obj.lastN||null });
    }catch(e){}
  }
  function tgLoadProgress(optUID){
    // ✅ 优先从 per-chat 状态读（修复切换聊天后进度显示"暂无"）
    try{
      const uid = optUID || (typeof meowGetChatUID === 'function' ? meowGetChatUID() : '') || window.__MEOW_SUM_ACTIVE_UID__ || '';
      if (uid){
        const st = meowLoadChatState(uid);
        if (st && (st.lastFrom || st.lastTo || st.lastN)){
          return { t: st.updatedAt||0, lastFrom: st.lastFrom, lastTo: st.lastTo, lastN: st.lastN };
        }
      }
    }catch(e){}
    return lsGet(LS_SUM_PROGRESS, { t:0 });
  }


// ===================== CSS 注入（全局干净版：保留现有效果；移除世界书相关；结构合并） =====================
(function injectCSS(){
  const sid = 'meow_pencil_suite_css_v1';
  try { doc.getElementById(sid)?.remove?.(); } catch(e){}
  const st = doc.createElement('style');
  st.id = sid;

  st.textContent = `
/* =========================================================
   0) 输入光标高亮（你确认好用的那套）
   ========================================================= */
textarea:focus, [contenteditable="true"]:focus{
  caret-color: rgba(233,223,201,1) !important;
  outline: 2px solid rgba(233,223,201,.80) !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 2px rgba(0,0,0,.20), 0 0 18px rgba(233,223,201,.22) !important;
}
.meow_pencil_flash{ animation: meowPencilFlash .55s ease-in-out 1; }
@keyframes meowPencilFlash{
  0%{ box-shadow: 0 0 0 0 rgba(233,223,201,.0); }
  40%{ box-shadow: 0 0 0 4px rgba(233,223,201,.35); }
  100%{ box-shadow: 0 0 0 0 rgba(233,223,201,.0); }
}

/* =========================================================
   1) 主题变量（Meow Glass · 当前最终效果那套）
   ========================================================= */
:root{
  --meow-bg: rgba(255,255,255,.52);
  --meow-bg-strong: rgba(255,255,255,.66);
  --meow-card: rgba(255,255,255,.56);

  --meow-line: rgba(28,24,18,.12);
  --meow-line-2: rgba(28,24,18,.08);

  --meow-text: rgba(46,38,30,.82);
  --meow-sub:  rgba(46,38,30,.62);

  --meow-accent: rgba(198,186,164,.85);
  --meow-accent-soft: rgba(198,186,164,.35);

  --meow-shadow: 0 20px 60px rgba(0,0,0,.12);

  --meow-input: rgba(255,255,255,.68);
  --meow-input-line: rgba(28,24,18,.14);
}

/* =========================================================
   2) 遮罩（最终效果：更淡）
   ========================================================= */
#${ID_MASK}{
  position:fixed; inset:0;
  z-index:2147483000;
  -webkit-tap-highlight-color:transparent;
  background: rgba(0,0,0,.07) !important;
}

/* =========================================================
   3) 悬浮按钮（保持你现在的小、低存在感）
   ========================================================= */
#${ID_BTN}{
  position:fixed;
  width:40px;height:40px;
  border-radius:999px;
  display:flex;align-items:center;justify-content:center;

  background: rgba(255,255,255,.14);
  border: 1px solid rgba(255,255,255,.18);
  box-shadow: 0 10px 26px rgba(0,0,0,.25);
  z-index:2147483400;

  user-select:none;
  touch-action:none;
  -webkit-tap-highlight-color:transparent;
}
#${ID_BTN} .ico{
  font-size:18px;
  opacity:.92;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,.35));
}
#${ID_BTN}.armed{
  outline: 2px solid rgba(233,223,201,.55);
  outline-offset: 2px;
}

/* =========================================================
   4) 复合菜单（最终效果：玻璃）
   ========================================================= */
#${ID_MENU}{
  position:fixed;
  z-index:2147483200;
  width: 230px;
  border-radius: 16px;
  overflow:hidden;

  background: var(--meow-bg) !important;
  border: 1px solid var(--meow-line) !important;
  box-shadow: var(--meow-shadow) !important;
  backdrop-filter: blur(14px) saturate(1.06) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.06) !important;
}
#${ID_MENU} .item{
  display:flex; align-items:center; justify-content:space-between;
  gap:10px;
  padding:12px 12px;
  font-size:14px;
  color: var(--meow-text) !important;
  border-top: 1px solid var(--meow-line-2) !important;
}
#${ID_MENU} .item:first-child{ border-top:none; }
#${ID_MENU} .sub{
  font-size:12px;
  color: var(--meow-sub) !important;
  margin-top:2px;
}
#${ID_MENU} .left{ display:flex; flex-direction:column; }
#${ID_MENU} .chev{ color: rgba(46,38,30,.35); }

/* =========================================================
   5) 通用弹窗（安全区修复 + 玻璃最终样式）
   ========================================================= */
.meowModal{
  position:fixed;
  inset: max(10px, env(safe-area-inset-top,0px)) 10px
         max(10px, env(safe-area-inset-bottom,0px)) 10px;

  height: calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 20px);

  transform:none !important;
  width:auto !important;
  max-height:none !important;

  overflow:auto;
  -webkit-overflow-scrolling:touch;

  background: var(--meow-bg-strong) !important;
  border: 1px solid var(--meow-line) !important;
  border-radius: 16px;
  box-shadow: var(--meow-shadow) !important;
  z-index:2147483300;

  backdrop-filter: blur(16px) saturate(1.08) !important;
  -webkit-backdrop-filter: blur(16px) saturate(1.08) !important;
}
.meowModal .hd{
  position:sticky;
  top:0;
  z-index:2;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:14px 14px 12px;

  background: var(--meow-hd-bg, var(--meow-bg-strong, rgba(255,255,255,.74))) !important;
  border-bottom: 1px solid var(--meow-line) !important;
}
.meowModal .title{
  font-size:16px;
  color: var(--meow-text) !important;
  font-weight: 900 !important;
  display:flex; align-items:center; gap:8px;
}
.meowModal .close{
  cursor:pointer;
  width:34px; height:34px;
  border-radius:10px;
  display:flex; align-items:center; justify-content:center;

  background: var(--meow-card, rgba(255,255,255,.58)) !important;
  border: 1px solid var(--meow-line) !important;
  color: var(--meow-text, rgba(46,38,30,.60)) !important;
}
.meowModal .bd{ padding:14px; }
/* ===== 总结 + 日记模块紧凑化（对齐世界书模块） ===== */
#meow-summary-modal .bd,
#meow-diary-modal .bd{
  padding:10px;
}
#meow-summary-modal .sec,
#meow-diary-modal .sec{
  padding:10px;
  margin-bottom:8px;
}
#meow-summary-modal .sec h3,
#meow-diary-modal .sec h3{
  margin:0 0 8px 0 !important;
  font-size:13px;
  padding:8px 10px !important;
}
#meow-summary-modal label,
#meow-diary-modal label{
  font-size:11px;
  margin:6px 0 4px;
}
#meow-summary-modal input,
#meow-summary-modal select,
#meow-summary-modal textarea,
#meow-diary-modal input,
#meow-diary-modal select,
#meow-diary-modal textarea{
  font-size:13px;
  padding:8px 10px;
  border-radius:10px;
}
#meow-summary-modal textarea{
  min-height:80px;
}
#meow-summary-modal .hint,
#meow-diary-modal .hint{
  font-size:11px;
  line-height:1.4;
}
#meow-summary-modal .btn,
#meow-diary-modal .btn{
  padding:7px 10px;
  font-size:12px;
  border-radius:10px;
}
#meow-summary-modal .btn.danger{
  background:rgba(220,53,69,.12);
  color:#c9302c;
  border-color:rgba(220,53,69,.2);
}
#meow_ct_table th input:focus,
#meow_ct_table td textarea:focus{
  background:rgba(0,0,0,.02) !important;
}
/* V3: details折叠箭头动画 */
#meow_tpl_sec[open] > summary .meow-tpl-arrow{ transform:rotate(90deg); }
#meow_tpl_sec > summary::-webkit-details-marker{ display:none; }
#meow_tpl_sec > summary::marker{ content:''; }
/* V3: 底部规则折叠箭头动画 */
#meow_ct_rules_sec[open] > summary .meow-rules-arrow{ transform:rotate(90deg); }
#meow_ct_rules_sec > summary::-webkit-details-marker{ display:none; }
#meow_ct_rules_sec > summary::marker{ content:''; }
/* V3: 表格条目卡片网格 */
.meow-entry-grid{
  display:grid; grid-template-columns:1fr 1fr 1fr;
  gap:6px; margin:8px 0;
}
.meow-entry-card{
  padding:10px 4px 8px; border-radius:12px;
  border:1px solid var(--meow-line,rgba(28,24,18,.10));
  background:var(--meow-card,rgba(255,255,255,.35));
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  font-size:11px; text-align:center;
  cursor:pointer; position:relative;
  transition:all .18s; user-select:none;
  box-shadow:0 1px 4px rgba(0,0,0,.03);
  color:var(--meow-text) !important;
}
.meow-entry-card:hover{
  background:var(--meow-accent-soft,rgba(255,255,255,.45));
  box-shadow:0 2px 8px rgba(0,0,0,.06);
}
.meow-entry-card.active{
  border-color:var(--meow-accent, rgba(139,115,85,.35)) !important;
  background:var(--meow-accent-soft, rgba(198,186,164,.15)) !important;
  box-shadow:0 2px 10px rgba(0,0,0,.06) !important;
}
.meow-entry-card.active::after{
  content:''; position:absolute; top:5px; right:5px;
  width:5px; height:5px; border-radius:50%;
  background:var(--meow-accent, rgba(139,115,85,.5));
}
.meow-entry-card .ico{ font-size:15px; display:block; margin-bottom:3px; filter:grayscale(.3) opacity(.75); }
.meow-entry-card.active .ico{ filter:grayscale(0) opacity(.9); }
.meow-entry-card .name{ font-weight:600; color:var(--meow-sub,rgba(46,38,30,.55)); font-size:10.5px; }
.meow-entry-card.active .name{ color:var(--meow-text,rgba(46,38,30,.82)); font-weight:700; }
.meow-entry-add{
  border:1.5px dashed var(--meow-line,rgba(28,24,18,.10)) !important;
  background:transparent !important; backdrop-filter:none !important;
  color:var(--meow-sub,rgba(46,38,30,.35)); font-size:18px;
  display:flex; align-items:center; justify-content:center;
  min-height:50px; box-shadow:none !important;
}
.meow-entry-add:hover{ border-color:rgba(139,115,85,.3) !important; color:rgba(139,115,85,.55); }
/* 表格可点击hover */
#meow_ct_table th.meow-cell-click,
#meow_ct_table td.meow-cell-click{
  cursor:pointer;
  transition:background .15s;
}
#meow_ct_table th.meow-cell-click:hover{ background:var(--meow-accent-soft, rgba(139,115,85,.12)) !important; }
#meow_ct_table td.meow-cell-click:hover{ background:var(--meow-accent-soft, rgba(139,115,85,.06)) !important; }
/* 表格滚动条细化（图4风格）*/
#meow_ct_table_wrap{ scrollbar-width:thin; scrollbar-color:rgba(139,115,85,.18) transparent; }
#meow_ct_table_wrap::-webkit-scrollbar{ width:3px; height:3px; }
#meow_ct_table_wrap::-webkit-scrollbar-track{ background:transparent; }
#meow_ct_table_wrap::-webkit-scrollbar-thumb{ background:rgba(139,115,85,.22); border-radius:4px; }
/* 折叠箭头旋转 */
#meow_shared_sec[open] > summary .meow-shared-arrow{ transform:rotate(90deg); }
#meow_tpl_sec[open] > summary .meow-tpl-arrow{ transform:rotate(90deg); }
details[open] > summary .meow-save-arrow{ transform:rotate(90deg); }
details[open] > summary .meow-data-arrow{ transform:rotate(90deg); }
details[open] > summary .meow-pack-arrow{ transform:rotate(90deg); }
/* 单元格编辑弹窗 */
.meow-cell-popup-overlay{
  position:fixed;top:0;left:0;right:0;bottom:0;
  background:transparent;z-index:99999;
  display:flex;align-items:center;justify-content:center;
  pointer-events:auto;
}
.meow-cell-popup{
  background:var(--meow-bg-strong, rgba(255,252,248,.98));
  border-radius:16px;padding:18px 20px;
  min-width:280px;max-width:380px;width:88%;
  box-shadow:0 16px 48px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.04);
  border:1px solid var(--meow-line, rgba(28,24,18,.1));
  max-height:80vh;overflow-y:auto;
  backdrop-filter:blur(16px) saturate(1.08);
  -webkit-backdrop-filter:blur(16px) saturate(1.08);
}
.meow-cell-popup label{
  display:block;font-size:11px;font-weight:600;margin:0 0 4px;
  color:var(--meow-sub,rgba(46,38,30,.62));
}
.meow-cell-popup input,
.meow-cell-popup textarea{
  width:100%;box-sizing:border-box;
  border:1px solid var(--meow-input-line,rgba(28,24,18,.14));
  border-radius:10px;padding:9px 11px;font-size:13px;outline:none;
  background:var(--meow-input,rgba(255,255,255,.68));
  color:var(--meow-text,rgba(46,38,30,.82));
  margin-bottom:10px;
  box-shadow:none;
}
.meow-cell-popup textarea{ resize:vertical;min-height:60px; }
.meow-cell-popup input:focus,
.meow-cell-popup textarea:focus{ border-color:var(--meow-accent, rgba(139,115,85,.45)); }
.meow-cell-popup .meow-popup-btns{
  display:flex;gap:8px;justify-content:flex-end;margin-top:4px;
}
.meow-cell-popup .meow-popup-btns button{
  padding:7px 16px;border-radius:10px;font-size:12px;font-weight:600;
  border:1px solid var(--meow-line,rgba(28,24,18,.12));
  cursor:pointer;background:var(--meow-card,rgba(255,255,255,.56));
  color:var(--meow-text,rgba(46,38,30,.82));
  transition:all .15s;
}
.meow-cell-popup .meow-popup-btns button:hover{ background:rgba(198,186,164,.15); }
.meow-cell-popup .meow-popup-btns button.primary{
  background:var(--meow-accent,rgba(198,186,164,.85));
  color:var(--meow-text,rgba(46,38,30,.85));border-color:var(--meow-accent-soft,rgba(139,115,85,.2));
}
.meow-cell-popup .meow-popup-btns button.primary:hover{ background:var(--meow-accent,rgba(178,166,144,.9)); }
.meow-cell-popup .meow-popup-btns button.danger{
  color:#c9302c;border-color:rgba(220,53,69,.2);background:rgba(220,53,69,.06);
}
.meow-cell-popup .meow-popup-btns button.danger:hover{ background:rgba(220,53,69,.12); }
#meow-summary-modal .row,
#meow-diary-modal .row{
  gap:8px;
}
/* 总结模块的 switch 开关也小一点 */
#meow-summary-modal .meowSwitch .txt{
  font-size:13px;
}
.meowModal .sec{
  padding:12px;
  border-radius:14px;
  background: var(--meow-card) !important;
  border: 1px solid var(--meow-line) !important;
  margin-bottom:12px;
  box-shadow: 0 8px 22px var(--meow-shadow, rgba(0,0,0,.05)) !important;
}
.meowModal .sec h3{
  margin:0 0 12px 0 !important;
  font-size:14px;
  color: var(--meow-text, rgba(72,60,48,.80)) !important;
  font-weight: 900 !important;
  display:flex; align-items:center; gap:8px;

  padding: 10px 12px !important;
  border-radius: 14px !important;
  background: var(--meow-hd-bg, var(--meow-card, rgba(255,255,255,.44))) !important;
  border: 1px solid var(--meow-accent-soft) !important;
}

.meowModal .row{ display:flex; gap:10px; flex-wrap:wrap; }
.meowModal label{
  font-size:12px;
  color: var(--meow-sub) !important;
  display:block;
  margin:8px 0 6px;
}

.meowModal input, .meowModal select, .meowModal textarea{
  width:100%;
  background: var(--meow-input) !important;
  color: var(--meow-text) !important;
  border: 1px solid var(--meow-input-line) !important;
  border-radius: 12px;
  padding:10px 10px;
  outline:none;
  font-size:14px;
  box-shadow: none !important;
}
.meowModal textarea{ min-height:110px; resize:vertical; }
.meowModal input::placeholder,
.meowModal textarea::placeholder{
  color: var(--meow-sub, rgba(46,38,30,.34)) !important;
}

.meowModal .hint,
.meowModal .sec .hint{
  font-size:12px;
  color: var(--meow-sub) !important;
  line-height:1.5;
}
.meowModal code{ color: var(--meow-text, rgba(46,38,30,.72)) !important; }

/* =========================================================
   6) 按钮（保持你现在分层视觉）
   ========================================================= */
.meowModal .btn{
  padding:10px 12px;
  border-radius: 12px;
  border: 1px solid var(--meow-line, rgba(120,110,95,.16)) !important;
  background: var(--meow-card, rgba(255,255,255,.62)) !important;
  color: var(--meow-text, rgba(80,68,52,.76)) !important;
  font-size:14px;
  box-shadow: 0 4px 10px var(--meow-shadow, rgba(0,0,0,.04)) !important;
}
.meowModal .btn.primary{
  background: var(--meow-accent-soft, rgba(232,224,208,.20)) !important;
  border: 1px solid var(--meow-accent, rgba(190,175,145,.55)) !important;
  color: var(--meow-text, rgba(90,72,48,.92)) !important;
  font-weight: 600 !important;
  box-shadow: 0 6px 14px var(--meow-shadow, rgba(190,175,145,.20)) !important;
}
.meowModal .btn.primary:hover{
  background: var(--meow-accent, rgba(238,230,214,.72)) !important;
}
.meowModal .btn.danger{
  background: rgba(247,238,237,.64) !important;
  border: 1px solid rgba(180,130,120,.42) !important;
  color: rgba(120,78,70,.88) !important;
}

/* 高级设置 summary */
.meowModal details > summary{
  color: var(--meow-text, rgba(72,60,48,.76)) !important;
  font-weight: 900 !important;
  background: var(--meow-hd-bg, var(--meow-card, rgba(255,255,255,.42))) !important;
  border: 1px solid var(--meow-accent-soft) !important;
  border-radius: 14px !important;
}
.meowModal details > summary *{
  color: var(--meow-text, rgba(72,60,48,.76)) !important;
}

/* =========================================================
   7) Meow Switch（只绑定总结弹窗；避免污染世界书）
   ========================================================= */
#meow-summary-modal .meowSwitch{
  display:flex;
  align-items:center;
  gap:10px;
  margin:10px 0 6px;
  user-select:none;
}
#meow-summary-modal .meowSwitch input[type="checkbox"]{
  -webkit-appearance:none !important;
  appearance:none !important;
  background-image:none !important;
  outline:none !important;
  box-shadow:none !important;
  accent-color: transparent !important;

  width:46px !important;
  height:26px !important;
  border-radius:999px !important;

  background: rgba(0,0,0,.14) !important;
  border: 1px solid rgba(120,110,95,.18) !important;

  position:relative !important;
  flex:0 0 auto !important;
  cursor:pointer !important;
  box-shadow: none !important;
  transition: background .18s ease, border-color .18s ease, box-shadow .18s ease !important;
}
#meow-summary-modal .meowSwitch input[type="checkbox"]::after{
  content:"";
  position:absolute;
  top:2px; left:2px;
  width:22px; height:22px;
  border-radius:999px;
  background: var(--meow-card, rgba(255,255,255,.92));
  border: 1px solid var(--meow-line, rgba(28,24,18,.12));
  box-shadow: 0 6px 14px rgba(0,0,0,.10);
  transform: translateX(0);
  transition: transform .18s ease !important;
}
#meow-summary-modal .meowSwitch input[type="checkbox"]:checked{
  background: var(--meow-accent, rgba(225,215,196,.78)) !important;
  border-color: var(--meow-accent, rgba(198,186,164,.95)) !important;
  box-shadow: none !important;
}
#meow-summary-modal .meowSwitch input[type="checkbox"]:checked::after{
  transform: translateX(20px);
  background: var(--meow-card, rgba(255,255,255,.96));
  border-color: var(--meow-accent, rgba(198,186,164,.60));
}
#meow-summary-modal .meowSwitch .txt{
  color: var(--meow-sub) !important;
  font-size: 13px;
  font-weight: 700;
}

/* =========================================================
   8) 扇形菜单 · Frosted Arc（保持你现在的图2/图3效果）
   ========================================================= */
#${ID_MENU}.meowFanMenu{
  position: fixed;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  z-index: 2147483647;
  overflow: visible !important;
  pointer-events: none;

  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
#${ID_MENU}.meowFanMenu .fanBg{
  position:absolute;
  left:calc(var(--cx) * 1px);
  top: calc(var(--cy) * 1px);
  width:calc(var(--bgR) * 2px);
  height:calc(var(--bgR) * 2px);
  transform:translate(calc(var(--bgR) * -1px), calc(var(--bgR) * -1px));
  border-radius:999px;

  background:
    conic-gradient(
      from calc((var(--from) - 90) * 1deg),
      rgba(255,255,255,.00) 0deg,
      rgba(255,255,255,.00) calc(var(--gap) * 1deg),
      rgba(255,255,255,.55) calc(var(--gap) * 1deg),
      rgba(255,255,255,.32) calc((var(--gap) + var(--span)) * 1deg),
      rgba(255,255,255,.00) calc((var(--gap) + var(--span)) * 1deg)
    );

  -webkit-mask: radial-gradient(
    farthest-side,
    transparent calc(100% - var(--ring)),
    #000 calc(100% - var(--ring) + 1px)
  );
  mask: radial-gradient(
    farthest-side,
    transparent calc(100% - var(--ring)),
    #000 calc(100% - var(--ring) + 1px)
  );

  backdrop-filter: blur(14px) saturate(1.06);
  -webkit-backdrop-filter: blur(14px) saturate(1.06);

  filter: drop-shadow(0 18px 40px rgba(0,0,0,.18));
  border:1px solid rgba(255,255,255,.38);
  box-shadow: 0 0 0 1px rgba(0,0,0,.08) inset, 0 16px 34px rgba(0,0,0,.16);

  opacity:0;
  transition: opacity .14s ease;
  pointer-events:none;
}
#${ID_MENU}.meowFanMenu.show .fanBg{ opacity:1; }

#${ID_MENU}.meowFanMenu .fanItem{
  background: rgba(255,255,255,.72) !important;
  border: 1px solid rgba(255,255,255,.55) !important;
  box-shadow: none !important;
}
#${ID_MENU} .fanBtn .i{ color:rgba(35,35,35,.72); }
#${ID_MENU} .fanBtn{
  box-shadow:none !important;
  border:1px solid rgba(255,255,255,.55) !important;
  background:rgba(255,255,255,.72) !important;
}

#${ID_MENU}.meowFanMenu .fanCenter{
  position:absolute;
  left:calc(var(--cx) * 1px);
  top: calc(var(--cy) * 1px);
  transform:translate(-50%,-50%);
  width:56px; height:56px;
  border-radius:999px;
  border:1px solid rgba(28,24,18,.14);
  background: rgba(255,255,255,.72);
  box-shadow: 0 10px 26px rgba(0,0,0,.12);
  color: rgba(46,38,30,.78);
  font-weight:900;
  pointer-events:auto;
}

#${ID_MENU}.meowFanMenu .fanBtn{
  position:absolute;
  left:calc(var(--cx) * 1px);
  top: calc(var(--cy) * 1px);
  transform:translate(-50%,-50%) translate(calc(var(--x) * 1px), calc(var(--y) * 1px));
  width:54px; height:54px;
  border-radius:999px;
  border:1px solid rgba(120,110,95,.16);
  background: rgba(255,255,255,.62);
  box-shadow: 0 12px 26px rgba(0,0,0,.10);
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  gap:2px;
  pointer-events:auto;

  opacity:0;
  transform-origin:center;
  transition: opacity .14s ease, transform .16s ease;
}
#${ID_MENU}.meowFanMenu.show .fanBtn{ opacity:1; }

#${ID_MENU}.meowFanMenu .fanBtn .i{ font-size:18px; line-height:18px; }
#${ID_MENU}.meowFanMenu .fanBtn .t{
  font-size:12px;
  font-weight:900;
  letter-spacing:.2px;
  color: rgba(80,68,52,.86);
}

/* =========================================================
   9) 统一交互鼠标/触控反馈（保持你现在的体验）
   ========================================================= */
.meowModal .btn,
.meowModal button,
#${ID_MENU} .fanBtn,
#${ID_MENU} .fanCenter,
#${ID_MENU} .item,
.meowModal summary,
.meowModal .close{
  cursor: pointer !important;
}
.meowModal input:not([type="checkbox"]),
.meowModal textarea,
.meowModal select{
  cursor: text !important;
}

/* =========================================================
   11) 总结加载动画
   ========================================================= */
.meowLoadingOverlay{
  position:fixed;
  inset:0;
  z-index:2147483600;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:18px;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.meowSpinner{
  width:64px; height:64px;
  border-radius:999px;
  border: 4px solid rgba(233,223,201,.15);
  border-top-color: rgba(233,223,201,1);
  border-right-color: rgba(233,223,201,.5);
  animation: meowSpin .9s cubic-bezier(.4,.1,.6,.9) infinite;
  box-shadow: 0 0 24px rgba(233,223,201,.35), inset 0 0 12px rgba(233,223,201,.08);
}
@keyframes meowSpin{
  to{ transform:rotate(360deg); }
}
.meowLoadingText{
  color: rgba(255,255,255,.95);
  font-size:15px;
  font-weight:800;
  text-shadow: 0 2px 12px rgba(0,0,0,.5);
  text-align:center;
  max-width:80vw;
  letter-spacing:.3px;
}
.meowLoadingBar{
  width:min(220px, 65vw);
  height:5px;
  border-radius:999px;
  background: rgba(255,255,255,.12);
  overflow:hidden;
  box-shadow: inset 0 1px 0 rgba(0,0,0,.2);
}
.meowLoadingBarInner{
  height:100%;
  border-radius:999px;
  background: linear-gradient(90deg, rgba(233,223,201,.6), rgba(233,223,201,1));
  box-shadow: 0 0 10px rgba(233,223,201,.5);
  transition: width .4s ease;
}
/* --- 总结执行提示（不遮罩、不阻塞操作） --- */
.meowSumToast{
  position:fixed;
  left:50%;
  top:14px;
  transform:translate3d(-50%,0,0);
  z-index:2147483601;
  display:flex;
  flex-direction:column;
  gap:8px;
  padding:10px 12px;
  min-width:min(360px, 86vw);
  background: rgba(29,29,29,.38);
  border:1px solid rgba(255,255,255,.18);
  border-radius:14px;
  box-shadow:0 10px 28px rgba(0,0,0,.35);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  pointer-events:none;
}
.meowSumToast .row{
  display:flex;
  align-items:center;
  gap:10px;
}
.meowSpinnerTiny{
  width:18px; height:18px;
  border-radius:999px;
  border:2px solid rgba(233,223,201,.18);
  border-top-color: rgba(233,223,201,1);
  border-right-color: rgba(233,223,201,.55);
  animation: meowSpin .9s cubic-bezier(.4,.1,.6,.9) infinite;
  box-shadow: 0 0 10px rgba(233,223,201,.25);
}
.meowSumToast .txt{
  color: rgba(255,255,255,.96);
  font-size:13px;
  font-weight:800;
  letter-spacing:.2px;
  text-shadow: 0 2px 10px rgba(0,0,0,.45);
  line-height:1.2;
}
.meowSumToast .bar{
  width:100%;
  height:4px;
  border-radius:999px;
  background: rgba(255,255,255,.12);
  overflow:hidden;
}
.meowSumToast .bar > i{
  display:block;
  height:100%;
  width:0%;
  border-radius:999px;
  background: linear-gradient(90deg, rgba(233,223,201,.55), rgba(233,223,201,1));
  box-shadow: 0 0 10px rgba(233,223,201,.45);
  transition: width .35s ease;
}



/* =========================================================
   10) 重要：世界书相关全局样式已移除
       世界书（WBV4）由模块内部 #wbv4_root 隔断样式接管
   ========================================================= */
`;

  (doc.head || doc.documentElement).appendChild(st);
})();

  // ===================== 小提示 =====================
  function toast(msg) {
    try {
      const t = doc.createElement('div');
t.className = 'meowToastLight';
      t.textContent = msg;
      t.style.cssText = `
        position:fixed; left:50%; top:18%;
        transform:translate3d(-50%,0,0);
        background:rgba(29, 29, 29, 0.52);
        color:#fff; padding:10px 12px;
        border:1px solid rgba(255,255,255,.18);
        border-radius:12px;
        font-size:14px;
        z-index:2147483650;
        box-shadow:0 10px 28px rgba(0,0,0,.35);
        max-width:78vw;
        text-align:center;
        pointer-events:none;
      `;
      doc.querySelectorAll('.meowToastLight').forEach(x=>x.remove());
(doc.documentElement || doc.body).appendChild(t);
setTimeout(()=>t.remove(), 1600);   // ✅ 自动消失
    } catch(e){}
  }

function showSumLoading(msg, progress){
  // ✅ 顶部小提示：不遮罩、不阻塞操作
  let box = doc.querySelector('.meowSumToast');
  if (!box){
    box = doc.createElement('div');
    box.className = 'meowSumToast';
    box.innerHTML = `
      <div class="row"><div class="meowSpinnerTiny"></div><div class="txt"></div></div>
      <div class="bar"><i style="width:0%"></i></div>
    `;
    (doc.documentElement || doc.body).appendChild(box);
  }
  const t = box.querySelector('.txt');
  if (t) t.textContent = msg || '总结中…';
  const bar = box.querySelector('.bar > i');
  if (bar && typeof progress === 'number'){
    bar.style.width = Math.min(100, Math.max(0, progress)) + '%';
  }
}

function hideSumLoading(){
  doc.querySelectorAll('.meowSumToast').forEach(el => el.remove());
}

  // ===================== 定位编辑（保持你确认好的） =====================
  function mesFromPoint(x, y) {
    try {
      const els = doc.elementsFromPoint ? doc.elementsFromPoint(x, y) : [doc.elementFromPoint(x, y)];
      for (const el of (els || [])) {
        if (!el) continue;
        const mes = el.closest?.('.mes');
        if (mes) return { mes, hit: el };
      }
      return null;
    } catch(e){ return null; }
  }

  const norm = (s) => String(s || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  let __mirror = null;
  function scrollTextareaToCaret(ta, caret) {
    try {
      if (!__mirror) {
        __mirror = doc.createElement('div');
        __mirror.style.cssText = `
          position:absolute; left:-9999px; top:-9999px;
          visibility:hidden; pointer-events:none;
          white-space:pre-wrap; word-wrap:break-word;
        `;
        (doc.body || doc.documentElement).appendChild(__mirror);
      }
      const cs = W.getComputedStyle(ta);
      __mirror.style.width = ta.clientWidth + 'px';
      __mirror.style.font = cs.font;
      __mirror.style.fontSize = cs.fontSize;
      __mirror.style.fontFamily = cs.fontFamily;
      __mirror.style.fontWeight = cs.fontWeight;
      __mirror.style.lineHeight = cs.lineHeight;
      __mirror.style.letterSpacing = cs.letterSpacing;
      __mirror.style.padding = cs.padding;
      __mirror.style.border = cs.border;
      __mirror.style.boxSizing = cs.boxSizing;

      const raw = ta.value || '';
      const before = raw.slice(0, caret);
      const after  = raw.slice(caret);

      __mirror.textContent = before;

      const mark = doc.createElement('span');
      mark.textContent = after.length ? after[0] : ' ';
      mark.style.cssText = `display:inline-block; width:1px; height:1em;`;
      __mirror.appendChild(mark);

      const caretY = mark.offsetTop;
      ta.scrollTop = Math.max(0, caretY - ta.clientHeight * 0.35);
    } catch(e){}
  }

  function bestMatchIndex(raw, snippet, ratioFallback) {
    const rawWS = raw
      .replace(/\r/g,'')
      .replace(/[ \t]+/g,' ')
      .replace(/\n{3,}/g,'\n\n');
    const sn = norm(snippet);
    if (!sn) return -1;

    const hits = [];
    let from = 0;
    while (true) {
      const p = rawWS.indexOf(sn, from);
      if (p < 0) break;
      hits.push(p);
      from = p + Math.max(1, Math.floor(sn.length / 2));
      if (hits.length > 30) break;
    }
    if (!hits.length) return -1;

    const target = Math.floor(rawWS.length * (ratioFallback || 0.5));
    let best = hits[0], bestD = Math.abs(hits[0] - target);
    for (const p of hits) {
      const d = Math.abs(p - target);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function placeCaretSmart(ta, snippet, ratioFallback) {
    const raw = ta.value || '';
    if (!raw) return;

    let ratio = Math.max(0.05, Math.min(0.95, ratioFallback || 0.5));
    let caret = -1;

    const p = bestMatchIndex(raw, snippet, ratio);
    if (p >= 0) caret = p + Math.floor(norm(snippet).length / 2);
    else caret = Math.floor(raw.length * ratio);

    caret = Math.max(0, Math.min(raw.length, caret));

    const a = Math.max(0, caret - 1);
    const b = Math.min(raw.length, caret + 1);

    try { ta.focus(); } catch(e){}
    try { ta.setSelectionRange(a, b); } catch(e){}

    scrollTextareaToCaret(ta, caret);

    try {
      ta.classList.add('meow_pencil_flash');
      setTimeout(() => ta.classList.remove('meow_pencil_flash'), 650);
    } catch(e){}

    setTimeout(() => {
      const mid = Math.max(0, Math.min(raw.length, a + 1));
      try { ta.focus(); } catch(e){}
      try { ta.setSelectionRange(mid, mid); } catch(e){}
      scrollTextareaToCaret(ta, mid);
    }, 240);
  }

  function openEdit(mes, ratio = 0.5, snippet = '') {
    if (!mes) return;

    const btn =
      mes.querySelector('.mes_edit') ||
      mes.querySelector('.fa-pencil') ||
      mes.querySelector('.fa-edit') ||
      mes.querySelector('[class*="mes_edit"]') ||
      mes.querySelector('[class*="edit"]') ||
      mes.querySelector('[title*="Edit"],[aria-label*="Edit"]');

    if (btn) btn.click();

    const start = Date.now();
    const timer = setInterval(() => {
      const ta = $q('#curEditTextarea') || $q('textarea:focus') || $q('textarea');
      if (ta) {
        clearInterval(timer);
        try { ta.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch(e){}
        placeCaretSmart(ta, snippet, ratio);
      } else if (Date.now() - start > 3600) {
        clearInterval(timer);
      }
    }, 80);
  }

  // ===== 模块动态加载（worldbook / summary / diary）=====
  (function loadModules(){
    var base = 'https://raw.githubusercontent.com/z1551170381-ux/shuyuanmi/main/';
    ['worldbook.js','summary.js','diary.js'].forEach(function(name){
      var s = document.createElement('script');
      s.src = base + name;
      s.onerror = function(){ try{ toast('⚠️ ' + name + ' 加载失败'); }catch(e){} };
      document.head.appendChild(s);
    });
  })();

  // 初次挂载 + 兜底重试
  let ok = mount();
  if (!ok){
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (mount() || tries > 10) clearInterval(t);
    }, 500);
  }
})();
