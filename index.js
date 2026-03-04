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
// ===================== 世界书入口别名修复（必须放在第一次调用之前） =====================
function openWorldbookModal(){
  try { return openWorldBookModal(); }
  catch(e){
    try { toast('世界书函数未加载：openWorldBookModal'); } catch(_){}
  }
}

  // ===================== 复合菜单 / 弹窗 =====================
function removeEl(id){
  try { doc.getElementById(id)?.remove?.(); } catch(e){}
}

// 只关菜单（不动任何弹窗）
function closeMenuOnly(){
  try { removeEl(ID_MENU); } catch(e){}
}

// 只关“当前弹窗”
function closeModal(id){
  // ★ 浮窗模式的世界书不要关
  try {
    var el = doc.getElementById(id);
    if (el && el.__meowFloatMode) return;
  } catch(e){}
  try { removeEl(id); } catch(e){}
  // 如果已经没有任何弹窗/菜单了，再把遮罩也关掉
  try{
    const hasModal = !!doc.querySelector('.meowModal');
    const hasMenu  = !!doc.getElementById(ID_MENU);
    if (!hasModal && !hasMenu) removeEl(ID_MASK);
  }catch(e){}
}

// 点遮罩：才是“全关”
function closeOverlays(){
  try{
    removeEl(ID_MENU);
    // ★ 检查是否有浮窗模式的世界书
    var hasFloat = false;
    doc.querySelectorAll('.meowModal').forEach(el=>{
      if (el.__meowFloatMode) { hasFloat = true; return; }
      try{ el.remove(); }catch(e){}
    });
    // ★ 浮窗模式下保留遮罩（display:none）避免ensureMask重建
    if (hasFloat) {
      var mask = doc.getElementById(ID_MASK);
      if (mask) mask.style.display = 'none';
    } else {
      removeEl(ID_MASK);
    }
  }catch(e){}
}

function ensureMask(){
  if (doc.getElementById(ID_MASK)) return;
  const m = doc.createElement('div');
  m.id = ID_MASK;
  m.addEventListener('click', closeOverlays, {passive:true});
  doc.documentElement.appendChild(m);
}



function toggleMenu(btnEl){
  // 已开就关
  if (doc.getElementById(ID_MENU)) { closeOverlays(); return; }

  closeOverlays();
  ensureMask();

  const menu = doc.createElement('div');
  menu.id = ID_MENU;
  menu.className = 'meowFanMenu';

  // 取按钮中心点（视口坐标）
  const r = btnEl.getBoundingClientRect();
  let cx = r.left + r.width/2;
  let cy = r.top  + r.height/2;

  const vw = doc.documentElement.clientWidth;
  const vh = doc.documentElement.clientHeight;

  // ===== 自适应方向：优先往“空的那边”开扇形 =====
  // from：扇形起始角（度），span：扇形角度范围，gap：起始留空角
  let from = 210, span = 120, gap = 14; // 默认：朝上（更常用）
  if (cx < vw * 0.22 && cy < vh * 0.22) { from = 330; span = 120; }
  else if (cx > vw * 0.78 && cy < vh * 0.22) { from = 60; span = 120; }
  else if (cx < vw * 0.22 && cy > vh * 0.78) { from = 240; span = 120; }
  else if (cx > vw * 0.78 && cy > vh * 0.78) { from = 150; span = 120; }
  else if (cy < vh * 0.32) { from = 30;  span = 120; }         // 顶部：朝下
  else if (cy > vh * 0.74) { from = 210; span = 120; }         // 底部：朝上
  else if (cx < vw * 0.45) { from = 300; span = 120; }         // 偏左：朝右
  else { from = 120; span = 120; }                             // 偏右：朝左

  // ===== 扇形按钮数量（现在是 4 个：日记/世界书/总结/小手机）=====
  const STEPS = 4;

  // ===== 尺寸参数（保持你的动画/样式，只做“防撞”几何）=====
  const BTN_SIZE = 54;      // 对齐你 CSS 里 .fanBtn 的 54×54
  const BTN_GAP  = 10;      // 你想更松就 12~14
  let   R        = 98;      // 原来 86，4 个按钮会挤；稍微拉开
  const ring     = 18;

  // 背景半径：跟随 R 稍微放大一点
  let bgR = Math.max(120, R + 30);

  // ===== 防撞：确保“相邻按钮中心的弧长” >= BTN_SIZE + BTN_GAP =====
  // 弧长 = R * (span/steps) * (π/180)  => span >= (steps * minArc / R) * (180/π)
  const minArc = BTN_SIZE + BTN_GAP;
  const minSpanDeg = Math.ceil((STEPS * minArc / R) * (180 / Math.PI));
  span = Math.max(span, Math.min(170, minSpanDeg)); // 170 以内避免太夸张



  // 写入 CSS 变量（配合你 CSS 里 #meow-pencil-menu.meowFanMenu）
  menu.style.setProperty('--cx', cx);
  menu.style.setProperty('--cy', cy);
  menu.style.setProperty('--bgR', bgR);
  menu.style.setProperty('--ring', ring);
  menu.style.setProperty('--from', from);
  menu.style.setProperty('--span', span);
  menu.style.setProperty('--gap',  gap);

  // 背景弧形轨道
  const bg = doc.createElement('div');
  bg.className = 'fanBg';
  menu.appendChild(bg);

  // 中心关闭
  const center = doc.createElement('button');
  center.type = 'button';
  center.className = 'fanCenter';
  center.textContent = '×';
  center.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    closeOverlays();
  }, {passive:false});
  menu.appendChild(center);

  // 扇形按钮（4个均分）：日记 / 世界书 / 总结 / 小手机
  function addFanBtn(icon, label, idx, onClick){
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'fanBtn';

    // 均分角度（idx=0..STEPS-1）
    const t = (idx + 0.5) / STEPS;                 // 0~1
    const ang = (from + gap + t * span) * Math.PI / 180;

    const x = Math.cos(ang) * R;
    const y = Math.sin(ang) * R;

    b.style.setProperty('--x', x);
    b.style.setProperty('--y', y);

    // 图标（保持你原风格）
    const ICONS = {
      sum: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18h6"/><path d="M10 22h4"/>
              <path d="M12 2a7 7 0 0 0-4 12c.5.5 1 1.5 1 2h6c0-.5.5-1.5 1-2a7 7 0 0 0-4-12z"/>
            </svg>`,
      wb:  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19a2 2 0 0 1 2-2h14"/><path d="M4 5a2 2 0 0 1 2-2h14v18"/>
            </svg>`,
      diary:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 3h10a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
              <path d="M7 7h10"/><path d="M7 11h10"/><path d="M7 15h7"/>
            </svg>`,
      phone:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="7" y="2.5" width="10" height="19" rx="2"/>
              <path d="M10 5.5h4"/><path d="M12 19h.01"/>
            </svg>`
    };

    const key =
      label === '总结'   ? 'sum' :
      label === '世界书' ? 'wb'  :
      label === '日记'   ? 'diary' :
      (label === '小手机' || label === '手机') ? 'phone' :
      null;

    const iconHTML = key ? ICONS[key] : `${icon}`;
    b.innerHTML = `<div class="i">${iconHTML}</div><div class="t">${label}</div>`;

    b.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      closeOverlays();
      try { onClick && onClick(); } catch(err){}
    }, {passive:false});

    menu.appendChild(b);
  }

  // 你的四个按钮（顺序：日记 → 世界书 → 总结 → 小手机）
  addFanBtn('', '日记',   0, () => { try{ openDiaryModal(); }catch(e){ try{ toast('日记模块未就绪'); }catch(_){ } } });
  addFanBtn('', '世界书', 1, () => { try{ openWorldbookModal(); }catch(e){ try{ toast('世界书模块未就绪'); }catch(_){ } } });
  addFanBtn('', '总结',   2, () => { try{ openSummaryModal(); }catch(e){ try{ toast('总结模块未就绪'); }catch(_){ } } });

  // 小手机：优先走 MEOW.mods.open('phone')，没有就回退 meowOpenPhone
  addFanBtn('', '小手机', 3, () => {
    try{
      if (window.MEOW?.mods?.open) return window.MEOW.mods.open('phone');
      if (typeof window.meowOpenPhone === 'function') return window.meowOpenPhone();
      if (typeof window.meowOpenPhone === 'function') return window.meowOpenPhone();
    }catch(e){}
    try{ toast('小手机模块未注册'); }catch(_){}
  });

  doc.documentElement.appendChild(menu);

  // 触发动画
  requestAnimationFrame(()=> menu.classList.add('show'));
}
function modalShell(id, title, icon){
  // ✅ 只关菜单，不要全关（避免开二级弹窗时误杀上级）
  closeMenuOnly();
  ensureMask();

  // 如果同 id 已存在就先移除（防重复）
  removeEl(id);

  const box = doc.createElement('div');
  box.id = id;
  box.className = 'meowModal';

  box.innerHTML = `
    <div class="hd">
      <div class="title">${icon}<span>${title}</span></div>
      <div class="close">✕</div>
    </div>
    <div class="bd"></div>
  `;

  // ✅ 默认：只关当前这个 id
  box.querySelector('.close').addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    closeModal(id);
  }, {passive:false});

  doc.documentElement.appendChild(box);
  return box.querySelector('.bd');
}


// ===================== MEOW 框架壳（最小改动：Core / Bus / Mods / Phone Skeleton） =====================
// 目标：不动现有 UI/动画/功能；只提供后续新增模块的清晰入口与隔离边界。
// 说明：暂不改悬浮扇形菜单入口；你可先在控制台调用：MEOW.mods.open('phone')
(function initMeowFrameworkShell(){
  const G = (typeof window !== 'undefined') ? window : W;
  const MEOW = (G.MEOW = G.MEOW || {});
  if (MEOW.__FRAME_SHELL_V1__) return;
  MEOW.__FRAME_SHELL_V1__ = true;

  // -------- Core：统一出口（不替换旧函数，只引用） --------
  MEOW.core = MEOW.core || {};
  try{
    Object.assign(MEOW.core, {
      W, doc, $q, $qa, toast,
      lsGet, lsSet,
      modalShell,
      closeMenuOnly, closeOverlays, closeModal, ensureMask,
    });
  }catch(e){}

  // -------- TimerRegistry：未来新增模块避免重复 setInterval/setTimeout --------
  if (!MEOW.core.timers){
    MEOW.core.timers = {
      intervals: new Set(),
      timeouts: new Set(),
      addInterval(id){ try{ this.intervals.add(id); }catch(e){} return id; },
      addTimeout(id){ try{ this.timeouts.add(id); }catch(e){} return id; },
      clearAll(){
        try{ for (const id of this.intervals) clearInterval(id); }catch(e){}
        try{ for (const id of this.timeouts) clearTimeout(id); }catch(e){}
        try{ this.intervals.clear(); this.timeouts.clear(); }catch(e){}
      }
    };
  }

  // -------- Bus：模块间通信（避免互相直调内部函数） --------
  if (!MEOW.bus){
    const map = new Map();
    MEOW.bus = {
      on(ev, fn){
        if (!ev || typeof fn !== 'function') return ()=>{};
        const arr = map.get(ev) || [];
        arr.push(fn);
        map.set(ev, arr);
        return ()=>{
          const a = map.get(ev) || [];
          const i = a.indexOf(fn);
          if (i >= 0) a.splice(i, 1);
          map.set(ev, a);
        };
      },
      emit(ev, payload){
        const arr = map.get(ev) || [];
        for (const fn of arr.slice()) {
          try{ fn(payload); }catch(e){}
        }
      },
      offAll(ev){
        try{ map.delete(ev); }catch(e){}
      }
    };
  }

  // -------- Mods：模块注册表（后续新增模块统一挂这里） --------
  if (!MEOW.mods){
    const mods = new Map();
    MEOW.mods = {
      register(id, mod){
        if (!id || !mod) return;
        mods.set(String(id), mod);
      },
      get(id){ return mods.get(String(id)); },
      list(){ return Array.from(mods.keys()); },
      open(id, ...args){
        const m = mods.get(String(id));
        if (!m) { try{ toast('模块未注册：' + id); }catch(e){} return; }
        if (typeof m.__inited === 'undefined'){
          m.__inited = true;
          try{ if (typeof m.initOnce === 'function') m.initOnce(); }catch(e){}
        }
        try{ if (typeof m.open === 'function') return m.open(...args); }catch(e){}
      }
    };
  }

  // -------- 先把旧模块“薄包装”注册进去：不改任何现有实现 --------
  try{
    MEOW.mods.register('summary', { title:'总结', open: ()=>{ try{ openSummaryModal(); }catch(e){ try{ toast('总结模块未就绪'); }catch(_){ } } } });
    MEOW.mods.register('worldbook', { title:'世界书', open: ()=>{ try{ openWorldbookModal(); }catch(e){ try{ toast('世界书模块未就绪'); }catch(_){ } } } });
    MEOW.mods.register('diary', { title:'日记', open: ()=>{ try{ openDiaryModal(); }catch(e){ try{ toast('日记模块未就绪'); }catch(_){ } } } });
  }catch(e){}

// 📱==================== 小手机 Phone System V2（社交系统）====================
// 作用：在酒馆内常驻一个“手机界面”，独立 root，不走现有 modal/mask，避免污染其它弹窗
// 根节点：#meow-phone-root
// 三种模式：
//   1) full  = 全屏手机（默认打开）
//   2) mini  = 可拖拽小窗（右下角可缩放）
//   3) pill  = 药丸悬浮条（轻点展开回 full）
//
// 入口：扇形菜单 → “小手机”按钮（会调用 MEOW.mods.open('phone') 或 meowOpenPhone）
// 模块注册：MEOW.mods.register('phone', { initOnce, open })
//
// App 结构（图标仅用于识别说明，不改变实际 UI）：
//   🏠 桌面 home      💬 聊天 chats      📅 日历 calendar     📰 论坛 forum
//   🌤️ 天气 weather   ✉️ 短信 sms        🌐 浏览器 browser     🖼️ 相册 photos
//   ⚙️ 设置 settings
// ========================================================================
  // -------- Phone System V2：完整社交系统（独立根节点 + 拖拽 + 三模式） --------
  // ===== 小手机模块（phone.js 独立加载）=====
  (function(){
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/gh/z1551170381-ux/shuyuanmi@main/phone.js";
    s.onerror = function(){ try{ toast("⚠️ 小手机模块加载失败"); }catch(e){} };
    document.head.appendChild(s);
  })();

// 🔌 对外 API 标注对外暴露：
// MEOW.mods.open('phone')：打开 full
// G.meowOpenPhone()：兼容旧入口（扇形菜单 fallback 会用）
// MEOW.phone.showMini()/showPill()/hide()：后续你要做快捷键/按钮可直接调
  // 注册小手机模块
  try{
    MEOW.mods.register('phone', {
      title:'小手机',
      initOnce: ()=>{ try{ MEOW.phone.initOnce(); }catch(e){ console.error('[MEOW Phone] initOnce:', e); } },
      open: ()=>{ try{ MEOW.phone.showFull(); }catch(e){ console.error('[MEOW Phone] open:', e); } }
    });
  }catch(e){}

  try{ G.meowOpenPhone = ()=>MEOW.mods.open('phone'); }catch(e){}

})();

/// ===================== 世界书 UI 自适应布局样式（只注入一次） =====================
(function injectMeowWBCSS(){
  // ✅ 用 pickHost() 得到的 doc，避免云酒馆/iframe 注入到错误 document
  if (doc.getElementById('meow-wb-layout-style')) return;

  const style = doc.createElement('style');
  style.id = 'meow-wb-layout-style';
  style.textContent = `
    /* 宽屏：左列表 + 右编辑 */
    #${ID_WB} .meow-wb-split{
      display:flex;
      gap:12px;
    }
    #${ID_WB} .meow-wb-list{
      flex:0 0 320px;
      min-width:260px;
      max-height:60vh;
      overflow:auto;
      -webkit-overflow-scrolling:touch;
    }
    #${ID_WB} .meow-wb-editor{
      flex:1;
      min-width:0;
    }

    /* 窄屏：编辑区改为“抽屉弹出”（由 JS 控制） */
    @media (max-width:720px){
      #${ID_WB} .meow-wb-split{ display:block; }
      #${ID_WB} .meow-wb-editor{ display:none; }
    }
  `;
  (doc.head || doc.documentElement).appendChild(style);
})();
  // ===================== 自动总结：界面（你图一/图二拆分） =====================
  async function fetchJSON(url, opt){
    const res = await fetch(url, opt);
    const txt = await res.text();
    try { return JSON.parse(txt); } catch(e){ return { __raw__: txt, __status__: res.status }; }
  }

  function getVisibleMesTextList(limit){
    const nodes = $qa('.mes');
    const list = [];
    for (let i = nodes.length - 1; i >= 0; i--) {
      const m = nodes[i];
      const txt = (m.querySelector('.mes_text')?.innerText || m.innerText || '').trim();
      if (!txt) continue;
      list.push(txt);
      if (limit && list.length >= limit) break;
    }
    return list.reverse();
  }
/* ✅ 在这里插入 */
function getMesTextByFloorRange(from, to) {
  const nodes = $qa('.mes');
  const list = [];

  for (const m of nodes) {
    // ✅ 优先用 mesid 属性（不受正则隐藏影响）
    let floor = NaN;

    // 方式1：mesid 属性
    const mesid = m.getAttribute('mesid') || m.dataset?.mesid;
    if (mesid != null && mesid !== '') {
      floor = parseInt(mesid, 10);
    }

    // 方式2：正文里的 #数字（兜底）
    if (isNaN(floor)) {
      const text = (m.querySelector('.mes_text')?.innerText || m.innerText || '');
      const match = text.match(/#(\d+)/);
      if (match) floor = parseInt(match[1], 10);
    }

    if (isNaN(floor)) continue;
    if (floor < from || floor > to) continue;

    // ✅ 取内容：优先 .mes_text 的文本
    const content = (m.querySelector('.mes_text')?.innerText || m.innerText || '').trim();
    if (content) {
      list.push({ floor, text: content });
    }
  }

  // 按楼层排序
  list.sort((a, b) => a.floor - b.floor);
  return list.map(x => x.text);
}

 function normalizeBaseUrl(input){
  let u = String(input || '').trim();
  if (!u) return '';
  u = u.replace(/\/+$/,'');          // 去尾 /
  // 如果已经以 /v1 结尾就不动
  if (/\/v1$/i.test(u)) return u;
  // 如果末尾像 /v1/xxx（用户填了更深的路径），尽量截到 /v1
  const m = u.match(/^(.*\/v1)(\/.*)?$/i);
  if (m && m[1]) return m[1];
  // 否则默认补 /v1
  return u + '/v1';
}

async function callLLM(baseUrl, apiKey, model, prompt, content){
  const root = normalizeBaseUrl(baseUrl);
  const url  = root + '/chat/completions';

  const body = {
    model,
    messages: [
      { role:'system', content: prompt || '请对以下内容做结构化总结。' },
      { role:'user',   content }
    ],
    temperature: 0.4
  };

  const headers = { 'Content-Type':'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const j = await fetchJSON(url, { method:'POST', headers, body: JSON.stringify(body) });

  const out =
    j?.choices?.[0]?.message?.content ||
    j?.choices?.[0]?.text ||
    j?.output_text ||
    j?.__raw__ ||
    JSON.stringify(j).slice(0, 1200);

  return out;
}

// ====== 兼容版：尽量从不同 /models 路径拉取模型列表（拿不到也不崩）======
async function loadModels(baseUrl, apiKey){
  const clean = String(baseUrl || '').trim().replace(/\/+$/,'');
  if (!clean) return [];

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  // 常见的几种实现：/v1/models、/models、/openai/v1/models（有些代理这样挂）
  const candidates = [
    clean + '/v1/models',
    clean + '/models',
    clean + '/openai/v1/models',
    clean.replace(/\/v1$/,'') + '/v1/models',
  ];

  async function tryOne(url){
    try{
      const res = await fetch(url, { method:'GET', headers, mode:'cors', cache:'no-store' });
      if (!res.ok) return null;
      const j = await res.json().catch(()=>null);
      if (!j) return null;

      // OpenAI 兼容：{ data:[{id:"gpt-4o-mini"}] }
      if (Array.isArray(j.data)) {
        const ids = j.data.map(x => x?.id).filter(Boolean);
        return ids.length ? ids : null;
      }

      // 另一种：{ models:[{name:"..."}] }
      if (Array.isArray(j.models)) {
        const ids = j.models.map(x => x?.id || x?.name).filter(Boolean);
        return ids.length ? ids : null;
      }

      // 极简：{ list:["a","b"] }
      if (Array.isArray(j.list)) {
        const ids = j.list.map(x => (typeof x === 'string' ? x : (x?.id||x?.name))).filter(Boolean);
        return ids.length ? ids : null;
      }

      return null;
    }catch(e){
      return null; // 可能 CORS / 网络错误
    }
  }

  for (const url of candidates){
    const got = await tryOne(url);
    if (got && got.length) return got;
  }
  return [];
}
// ===================== [修复] worldbook 名称解析兜底 =====================
// 作用：上传到酒馆世界书时，拿到“当前应写入的世界书名字”
// 你的代码里调用了 meowResolveWorldbookNamePreferFallback，但函数缺失会导致白屏
function meowResolveWorldbookNamePreferFallback(opt){
  opt = opt || {};

  // 1) 优先用显式传入
  if (typeof opt.worldbook === 'string' && opt.worldbook.trim()) return opt.worldbook.trim();
  if (typeof opt.worldbookName === 'string' && opt.worldbookName.trim()) return opt.worldbookName.trim();

  // 2) 其次尝试从 localStorage 里读你可能保存的“当前选择世界书”
  // 注意：这里不强依赖具体 key，尽量兼容。你如果有固定 key，可把它加到候选里。
  const keyCandidates = [
    'meow_wb_selected_name_v1',
    'meow_wb_selected_v1',
    'meow_worldbook_selected_v1',
    'worldbook_selected',
    'world_info_selected'
  ];

  try{
    for (const k of keyCandidates){
      const v = localStorage.getItem(k);
      if (!v) continue;

      // 可能是纯字符串，也可能是 JSON
      try{
        const j = JSON.parse(v);
        if (typeof j === 'string' && j.trim()) return j.trim();
        if (j && typeof j.name === 'string' && j.name.trim()) return j.name.trim();
        if (j && typeof j.worldbook === 'string' && j.worldbook.trim()) return j.worldbook.trim();
      }catch(_){
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
  }catch(e){}

  // 3) 最后兜底：给空字符串，由下游逻辑决定写到“当前/默认世界书”
  // 这样不会崩 UI，但如果下游必须要 name，你会看到 toast/console 提示
  return '';
}


// ===================== ✅ Per-Chat 总结仓库（自动加载/自动保存） =====================
const LS_SUM_BY_CHAT = 'meow_sum_by_chat_v1';

function meowGetChatUID(){
  // ===== 1) SillyTavern getContext（你的云酒馆 ctx_chatId 自带聊天名+时间戳，完美唯一） =====
  try{
    const ctx = (window.SillyTavern?.getContext?.() ||
                 window.top?.SillyTavern?.getContext?.() ||
                 window.parent?.SillyTavern?.getContext?.());
    if (ctx){
      // ctx.chatId 格式："重来试试 - 2026-01-31@11h04m36s879ms"（每个聊天不同）
      const chatId   = String(ctx.chatId || '').trim();
      const chatFile = String(ctx.chat_file_name || '').trim();
      const charName = String(ctx.name2 || ctx.characterName || '').trim();

      // 优先 chatId（你的云酒馆 chatId 带时间戳，一定唯一）
      if (chatId && chatId.length > 10) return `st:${chatId}`;
      // 其次 chat_file_name（本地版常有）
      if (chatFile && chatFile.length > 10) return `st:${charName}:${chatFile}`;
      // 兜底：getCurrentChatId 方法
      const fnId = String(ctx.getCurrentChatId?.() || '').trim();
      if (fnId && fnId.length > 10) return `st:fn:${fnId}`;
    }
  }catch(e){}

  // ===== 2) TavernHelper =====
  try{
    const th = (window.TavernHelper || window.top?.TavernHelper || window.parent?.TavernHelper);
    if (th){
      const methods = ['getCurrentChatId', 'getChatFileName', 'getCurrentChatName', 'getChatId'];
      for (const m of methods){
        if (typeof th[m] === 'function'){
          const v = String(th[m]() || '').trim();
          if (v && v.length > 15) return `th:${m}:${v}`;
        }
      }
    }
  }catch(e){}

  // ===== 3) localStorage =====
  try{
    const keys = ['chat_file_name','chat_file','selected_chat','selectedChat','active_chat'];
    for (const k of keys){
      const v = (window.localStorage.getItem(k) || '').trim();
      if (v && v.length > 10) return `ls:${k}:${v}`;
    }
  }catch(e){}

  // ===== 4) URL =====
  try{
    const u = location.pathname + '|' + location.search + '|' + location.hash;
    if (u && u.length > 10 && u !== '||') return `url:${u}`;
  }catch(e){}

  return `fallback:${Date.now()}`;
}

// ✅ 全局：从 DOM 实时读取当前聊天最新楼层号
function meowGetLatestFloorFromDOM(){
  try{
    const _$qa = (typeof $qa === 'function') ? $qa : ((s)=>{ try{ return Array.from(document.querySelectorAll(s)); }catch(e){ return []; } });
    const nodes = _$qa('.mes');
    for (let i = nodes.length - 1; i >= 0; i--){
      const m = nodes[i];

      // ✅ 优先：正文里的 #数字（你的抓取规则以它为准）
      const text = (m.querySelector('.mes_text')?.innerText || m.innerText || '');
      const match = text.match(/#(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n)) return n;
      }

      // 兜底：mesid（有些主题/版本没有 #楼层）
      const mesid = m.getAttribute('mesid') || m.dataset?.mesid;
      if (mesid != null && mesid !== '') {
        const n = parseInt(mesid, 10);
        if (Number.isFinite(n)) return n;
      }
    }
  }catch(e){}
  // 兜底：用 SillyTavern context chat 长度（一般是 0-based）
  try{
    const ctx = (window.SillyTavern?.getContext?.() ||
                 window.top?.SillyTavern?.getContext?.() ||
                 window.parent?.SillyTavern?.getContext?.());
    if (ctx?.chat?.length) return ctx.chat.length - 1;
  }catch(e){}
  return null;
}

// ✅ 全局：强制确保当前 LS_WB 属于当前聊天（打开任何弹窗前调用）
function meowForceWBSyncForCurrentChat(){
  try{
    const uid = meowGetChatUID();
    if (!uid || uid.startsWith('fallback:')) return;
    const wb = lsGet(LS_WB, null);
    const owner = wb?._chatUID || '';
    if (owner === uid) return; // 已经是当前聊天的，不用动

    void(0)&&console.log('[MEOW][ForceSync] WB 归属不匹配:', owner.slice(0,20), '→', uid.slice(0,20));
    // 保存旧的
    if (owner) meowSaveWBForChat(owner);
    // 加载新的
    const loaded = meowLoadWBForChat(uid);
    if (!loaded){
      const fresh = (typeof meowMakeFreshWB === 'function') ? meowMakeFreshWB(uid) : null;
      if (fresh){
        lsSet(LS_WB, fresh);
        meowSaveWBForChat(uid);
      }
    }
    try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
  }catch(e){}
}

function meowLoadChatState(uid){
  const db = lsGet(LS_SUM_BY_CHAT, { map:{} });
  return db.map?.[uid] || {
    out:'', progress:null, updatedAt:0, target:null, bookName:'',
    lastFrom:null, lastTo:null, lastN:null          // ← 新增：per-chat 进度
  };
}
function meowSaveChatState(uid, patch){
  const db = lsGet(LS_SUM_BY_CHAT, { map:{} });
  db.map ||= {};
  const cur = db.map[uid] || {
    out:'', progress:null, updatedAt:0, target:null, bookName:'',
    lastFrom:null, lastTo:null, lastN:null
  };
  db.map[uid] = { ...cur, ...patch, updatedAt: Date.now() };
  const entries = Object.entries(db.map);
  if (entries.length > 200){
    entries.sort((a,b)=>(a[1]?.updatedAt||0)-(b[1]?.updatedAt||0));
    const keep = entries.slice(entries.length-200);
    db.map = Object.fromEntries(keep);
  }
  lsSet(LS_SUM_BY_CHAT, db);
}

// ✅ 监听聊天切换：只做“hashchange/popstate + 低频观察”，不高频轮询
// ✅ 聊天切换监听（支持多回调 + 传递 oldUID）
function meowBindChatAutoLoad(onChange){
  // 支持多个模块各自注册回调（总结模块、世界书模块各注册一次）
  if (!window.__MEOW_CHAT_CBS__) window.__MEOW_CHAT_CBS__ = [];
  if (typeof onChange === 'function') window.__MEOW_CHAT_CBS__.push(onChange);

  // 监听器只启动一次
  if (window.__MEOW_CHAT_WATCHER__) return;
  window.__MEOW_CHAT_WATCHER__ = true;

  let last = meowGetChatUID();

  const fire = ()=>{
    const now = meowGetChatUID();
    if (now !== last){
      const prev = last;   // ← 旧 UID，世界书切换需要它
      last = now;
      for (const cb of (window.__MEOW_CHAT_CBS__ || [])){
        try{ cb(now, prev); }catch(e){}
      }
    }
  };

  window.addEventListener('hashchange', fire, {passive:true});
  window.addEventListener('popstate', fire, {passive:true});

  // 只监听 body 直接子节点变化（不监听聊天消息内部），避免消息频繁触发
  try{
    const root = document.body || document.documentElement;
    const obs = new MutationObserver(()=>{
      if (window.__MEOW_CHAT_FIRE_TO__) clearTimeout(window.__MEOW_CHAT_FIRE_TO__);
      window.__MEOW_CHAT_FIRE_TO__ = setTimeout(fire, 600); // 防抖加到600ms
    });
    obs.observe(root, {childList:true, subtree:false}); // 不监听子树
  }catch(e){}
}
// ===================== Per-Chat 世界书自动切换 =====================
// ===================== Per-Chat 世界书自动切换（V2：标记所有权 + 延迟初始化） =====================

const LS_WB_BY_CHAT = 'meow_wb_by_chat_v1';

  // ===== 补齐：per-chat 世界书快照 存/取（修复 meowSaveWBForChat 未定义导致的链路中断）=====
  function meowSaveWBForChat(chatUID){
    try{
      // 快照已废弃，WB数据跟随chat context，不再存储
      return true;
      const uid = String(chatUID||''); if (!uid) return false;
      const cur = lsGet(LS_WB, null);
      if (!cur || cur.v !== 4) return false;
      cur._chatUID = uid;
      const box = lsGet(LS_WB_BY_CHAT, { map:{} });
      box.map ||= {};
      box.map[uid] = { t: Date.now(), data: cur };
      lsSet(LS_WB_BY_CHAT, box);
      return true;
    }catch(e){ return false; }
  }

  function meowLoadWBForChat(chatUID){
    try{
      // 快照已废弃，直接返回false走远端加载
      return false;
      const uid = String(chatUID||''); if (!uid) return false;
      const box = lsGet(LS_WB_BY_CHAT, { map:{} });
      const snap = box?.map?.[uid];
      if (!snap || !snap.data || snap.data.v !== 4) return false;

      const db = snap.data;
      db._chatUID = uid;
      lsSet(LS_WB, db);
      return true;
    }catch(e){ return false; }
  }

// ===================== 聊天UID短哈希（用于酒馆世界书条目隔离） =====================
function meowChatHash(uid){
  // 三重哈希 → 输出 14+ 字符，避免碰撞
  const s = String(uid || '');
  let h1 = 0, h2 = 5381, h3 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    h1 = ((h1 << 5) - h1 + c) | 0;        // Java hashCode
    h2 = ((h2 << 5) + h2 + c) | 0;        // djb2
    h3 = (h3 ^ c) * 0x01000193 | 0;       // FNV-1a
  }
  return 'c'
    + Math.abs(h1).toString(36).padStart(6,'0').slice(0,6)
    + Math.abs(h2).toString(36).padStart(4,'0').slice(0,4)
    + Math.abs(h3).toString(36).padStart(4,'0').slice(0,4);
}

// meowTaggedComment 不变，保持原样
function meowTaggedComment(comment, __chatUID){
  const base = String(comment || '').trim();
  const uid  = String(__chatUID || '').trim();
  const tag  = (uid && typeof meowChatHash === 'function') ? meowChatHash(uid) : '';

  // 已经是 [cxxxx] 开头就不再二次包裹（兼容旧数据/手写）
  if (/^\[c[a-z0-9]{6,}\]/.test(base)) return base;

  // 兼容旧格式：[MEOW]xxx
  const cleaned = base.startsWith('[MEOW]') ? base.slice(6) : base;

  if (!tag) return `[MEOW]${cleaned}`;
  return `[${tag}][MEOW]${cleaned}`;
}


// 核心：切换酒馆世界书条目的 enabled 状态
// 当前聊天的条目 → enabled=true；其他聊天的条目 → enabled=false
// 核心：切换酒馆世界书条目的 enabled 状态
// 当前聊天的条目 → enabled=true；其他聊天的条目 → enabled=false
// 额外：把“旧版本无 [cxxxx] 前缀的 Summary/六板块常量条目”自动禁用，避免新聊天没总结时仍生效上一份
// 核心：切换酒馆世界书条目的 enabled 状态（✅防卡死版：合并请求/尽量批量/只禁旧一次）
async function meowToggleTavernEntries(currentChatUID){
  const uid = String(currentChatUID || '');

  // 合并频繁调用（切换聊天/重试/总结写入会连着触发）
  meowToggleTavernEntries.__queued = uid;
  if (meowToggleTavernEntries.__running) return;

  meowToggleTavernEntries.__running = true;

  const _W = (typeof W !== 'undefined') ? W : window;
  const _lsGet = (typeof lsGet === 'function')
    ? lsGet
    : ((k,d)=>{ try{ const v=_W.localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } });
  const _lsSet = (typeof lsSet === 'function')
    ? lsSet
    : ((k,v)=>{ try{ _W.localStorage.setItem(k, JSON.stringify(v)); }catch(e){} });

  const LS_LEGACY_OFF = 'meow_wb_legacy_disabled_v1';

  async function _sleep0(){ return new Promise(r=>setTimeout(r,0)); }

  async function _setEntries(th, primary, updates){
    if (!updates.length) return true;

    // 先试最轻量（如果 TavernHelper 接受 partial update，会极大减负）
    try{
      const minimal = updates.map(u => ({ uid: u.uid, enabled: u.enabled }));
      await th.setLorebookEntries(primary, minimal);
      return true;
    } catch(e){}

    // 再试中等量
    try{
      const mid = updates.map(u => ({ uid: u.uid, enabled: u.enabled, comment: u.comment }));
      await th.setLorebookEntries(primary, mid);
      return true;
    } catch(e){}

    // 最后兜底：全字段
    const chunkSize = 30;
    for (let i=0;i<updates.length;i+=chunkSize){
      const part = updates.slice(i, i+chunkSize);
      try { await th.setLorebookEntries(primary, part); } catch(e){}
      await _sleep0(); // ✅让出主线程，避免切换聊天直接卡死
    }
    return true;
  }

  try{
    while (true){
      const curUID = meowToggleTavernEntries.__queued;
      meowToggleTavernEntries.__queued = '';

      if (!curUID) break;

      const now = Date.now();
      if (meowToggleTavernEntries.__lastUID === curUID && (now - (meowToggleTavernEntries.__lastAt||0) < 800)){
        continue;
      }

      if (typeof MEOW_WB_API === 'undefined') continue;
      const canDo = await MEOW_WB_API.canWrite?.();
      if (!canDo) continue;

      const listed = await MEOW_WB_API.listEntries?.();
      const th = listed?.th;
      const primary = listed?.primary;
      const all = listed?.all;

      if (!th || !primary || !Array.isArray(all) || !all.length) continue;

      const tagPrefix = '[' + (typeof meowChatHash === 'function' ? meowChatHash(curUID) : '') + ']';
      if (tagPrefix === '[]') continue;

      const isTagged = (c)=>/^\[c[a-z0-9]{6,}\]/.test(String(c||''));
      const tagged = all.filter(e => e && isTagged(e.comment));

      // 没有任何带 tag 的条目，就不用折腾（避免白跑）
      if (!tagged.length){
        meowToggleTavernEntries.__lastUID = curUID;
        meowToggleTavernEntries.__lastAt = Date.now();
        continue;
      }

      const updates = [];

      // 当前聊天 tag：启用；其他聊天 tag：禁用
      for (const e of tagged){
        const c = String(e.comment||'');
        const shouldEnable = c.startsWith(tagPrefix);
        const isEnabled = (e.enabled !== false);

        if (shouldEnable && !isEnabled){
          updates.push({ uid:e.uid, enabled:true, comment:e.comment, content:e.content, keys:e.keys, type:e.type||'constant', order:e.order, prevent_recursion:(e.prevent_recursion!==false) });
        } else if (!shouldEnable && isEnabled){
          updates.push({ uid:e.uid, enabled:false, comment:e.comment, content:e.content, keys:e.keys, type:e.type||'constant', order:e.order, prevent_recursion:(e.prevent_recursion!==false) });
        }
      }

      // 旧无 tag 的“常量总结条目”只禁用一次，避免每次切换都扫一遍/写一遍
      const legacyDone = !!_lsGet(LS_LEGACY_OFF, false);
      if (!legacyDone){
        const LEGACY_COMMENTS = ['Summary','时空信息','角色详情','故事大纲','事件详情','任务约定','道具物品'];
        const legacy = all.filter(e=>{
          if (!e || !e.comment) return false;
          const c = String(e.comment).trim();
          if (isTagged(c)) return false;
          if (!LEGACY_COMMENTS.includes(c)) return false;
          if (String(e.type || 'constant') !== 'constant') return false;
          if (Number(e.order) !== 9999) return false;
          if (e.prevent_recursion === false) return false;
          return (e.enabled !== false);
        });

        for (const e of legacy){
          updates.push({ uid:e.uid, enabled:false, comment:e.comment, content:e.content, keys:e.keys, type:e.type||'constant', order:e.order, prevent_recursion:(e.prevent_recursion!==false) });
        }

        _lsSet(LS_LEGACY_OFF, true);
      }

      await _setEntries(th, primary, updates);

      meowToggleTavernEntries.__lastUID = curUID;
      meowToggleTavernEntries.__lastAt = Date.now();
    }
  } catch(e){
    try{ console.warn('[MEOW] meowToggleTavernEntries fail:', e); }catch(_){}
  } finally {
    meowToggleTavernEntries.__running = false;

    // 如果执行期间又来了新 UID，请求合并后再跑一轮
    if (meowToggleTavernEntries.__queued){
      const next = meowToggleTavernEntries.__queued;
      meowToggleTavernEntries.__queued = '';
      setTimeout(()=>{ try{ meowToggleTavernEntries(next); }catch(e){} }, 0);
    }
  }
}

// ✅ 新逻辑：切聊天时覆盖酒馆世界书内容（不是切 enabled）
// ✅ 核心：切聊天同步酒馆世界书（先清后填，读 per-chat 快照）
// ✅ 同步：把“当前聊天”的本地世界书（WBV4 cards）推到酒馆世界书
// 目标：跨端可读 + 按聊天隔离 + 允许同一 Tab 多条卡片都各自成为酒馆条目
// comment 统一格式： [cHASH][MEOW]<tabId>::<cardId>::<title>
// 兼容旧数据：也支持读取/保留 [cHASH][MEOW]Summary / [cHASH][MEOW]时空信息 这类旧格式
async function meowSyncTavernForChat(chatUID, opt = {}){
  const uid = String(chatUID || '');
  if (!uid || uid.startsWith('fallback:')) return { ok:false, reason:'no_uid' };

  // 节流：同一个 UID 1.5 秒内不重复执行（避免 iOS 发烫）
  const now = Date.now();
  if (meowSyncTavernForChat._lastUID === uid &&
      (now - (meowSyncTavernForChat._lastAt||0)) < 1500){
    return { ok:true, skipped:true };
  }

  if (meowSyncTavernForChat._running){
    meowSyncTavernForChat._next = uid;
    return { ok:true, queued:true };
  }
  meowSyncTavernForChat._running = true;

  const _sleep0 = ()=>new Promise(r=>setTimeout(r,0));
  const _trim = (s)=>String(s||'').trim();
  const _normTitle = (s)=>_trim(s).replace(/\s+/g,' ').slice(0, 80);
  const _isSkipText = (t)=>{
    const x = _trim(t);
    if (!x) return true;
    const SKIP = [
      '未总结：这里会显示"总结模块-表格模式"上传/回写后的内容。你也可以先在这里编辑预设内容。',
      '新页初始预设条目：可承接表格总结结果。',
    ];
    return SKIP.includes(x);
  };

  try{
    if (typeof MEOW_WB_API === 'undefined') return { ok:false, reason:'no_th' };
    const canDo = await MEOW_WB_API.canWrite?.();
    if (!canDo) return { ok:false, reason:'cant_write' };

    const listed = await MEOW_WB_API.listEntries?.();
    const th = listed?.th;
    const primary = listed?.primary;
    const all = Array.isArray(listed?.all) ? listed.all : [];
    if (!th || !primary) return { ok:false, reason:'no_primary' };

    const tagPrefix = '[' + (typeof meowChatHash === 'function' ? meowChatHash(uid) : '') + ']';
    if (tagPrefix === '[]') return { ok:false, reason:'no_hash' };

    // ========== 1) 读本地快照（优先 per-chat 存储；其次读当前 LS_WB 且 owner=uid）==========
    let chatWB = null;
    try{
      const store = lsGet(LS_WB_BY_CHAT, { map:{} });
      const snap = store?.map?.[uid];
      if (snap?.data?.v === 4) chatWB = snap.data;
    }catch(e){}

    if (!chatWB){
      try{
        const cur = lsGet(LS_WB, null);
        if (cur && cur.v === 4 && String(cur._chatUID||'') === uid) chatWB = cur;
      }catch(e){}
    }

    const chatState = (typeof meowLoadChatState === 'function') ? (meowLoadChatState(uid) || {}) : {};

    // ✅ 兜底：如果 per-chat state 没有 out/outSmall，则从当前分支 chat.extra 读取
    try{
      if (!_trim(chatState.out)){
        const ex = _trim(loadLastOut({ noFallback:true }));
        if (ex) chatState.out = ex;
      }
      if (!_trim(chatState.outSmall)){
        const exs = _trim(loadLastOutSmall({ noFallback:true }));
        if (exs) chatState.outSmall = exs;
      }
    }catch(e){}

    // ========== 2) 生成“应当存在”的酒馆条目清单（每张卡片=一条）==========
    const want = [];
    const wantSet = new Set();

    if (chatWB && Array.isArray(chatWB.cards) && chatWB.cards.length){
      const tabs = Array.isArray(chatWB.tabs) ? chatWB.tabs : [];
      const tabNameById = new Map(tabs.map(t=>[String(t?.id||''), String(t?.name||t?.id||'')]));
      for (const c of chatWB.cards){
        const text = _trim(c?.text);
        if (_isSkipText(text)) continue;

        const tabId  = _trim(c?.tab) || _trim(chatWB.active) || 'time';
        const cardId = _trim(c?.id)  || ('w_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16));
        const title0 = _normTitle(c?.title || c?.key || tabNameById.get(tabId) || '条目') || '条目';

        const comment = `${tagPrefix}[MEOW]${tabId}::${cardId}::${title0}`;
        want.push({ comment, content:text, keys:[tabId] });
        wantSet.add(comment);
      }
    }

    // big / small summary 兜底
    if (_trim(chatState.out)){
      const comment = `${tagPrefix}[MEOW]Summary`;
      want.push({ comment, content:_trim(chatState.out), keys:['Summary'] });
      wantSet.add(comment);
    }
    if (_trim(chatState.outSmall)){
      const comment = `${tagPrefix}[MEOW]SummarySmall`;
      want.push({ comment, content:_trim(chatState.outSmall), keys:['SummarySmall'] });
      wantSet.add(comment);
    }

    // ========== 3) 禁用“该聊天 tag 下但已不存在”的旧条目（只动当前 chat 的）==========
    const remoteMine = all.filter(e=>{
      const c = String(e?.comment||'');
      return c.startsWith(tagPrefix+'[MEOW]');
    });

    const toDisable = remoteMine.filter(e=>{
      const c = String(e?.comment||'');
      if (!c) return false;
      if (wantSet.has(c)) return false;
      return (e.enabled !== false);
    });

    if (toDisable.length){
      const chunk = 30;
      for (let i=0;i<toDisable.length;i+=chunk){
        const part = toDisable.slice(i, i+chunk).map(e=>({ uid:e.uid, enabled:false }));
        try{ await th.setLorebookEntries(primary, part); }catch(e){}
        await _sleep0();
      }
    }

    // ========== 4) upsert “应当存在”的条目并启用 ===========
    for (const it of want){
      try{
        await MEOW_WB_API.upsertByComment({
          comment: it.comment,
          content: it.content,
          keys: it.keys || [],
          enabled: true,
          type: 'constant',
          order: 9999,
          prevent_recursion: true
        });
      }catch(e){}
      await _sleep0();
    }

    // ========== 5) 最后再切一次 enabled（确保“未进入该聊天时不污染”）==========
    if (!opt.noToggle && typeof meowToggleTavernEntries === 'function'){
      try{ await meowToggleTavernEntries(uid); }catch(e){}
    }

    meowSyncTavernForChat._lastUID = uid;
    meowSyncTavernForChat._lastAt  = Date.now();

    if (meowSyncTavernForChat._next){
      const next = meowSyncTavernForChat._next;
      meowSyncTavernForChat._next = '';
      setTimeout(()=>{ try{ meowSyncTavernForChat(next, opt); }catch(e){} }, 120);
    }

    return { ok:true, wrote: want.length, disabled: toDisable.length };
  } catch(e){
    return { ok:false, reason: e?.message || String(e) };
  } finally {
    meowSyncTavernForChat._running = false;
  }
}

// 从酒馆世界书读回当前聊天的条目 → 回填本地世界书（跨端同步核心）
async function meowLoadWBFromTavern(__chatUID){
  try {
    if (typeof MEOW_WB_API === 'undefined' || typeof MEOW_WB_API.listEntries !== 'function') return false;
    const canDo = await MEOW_WB_API.canWrite();
    if (!canDo) return false;

    const { all } = await MEOW_WB_API.listEntries();
    if (!Array.isArray(all) || !all.length) return false;

    const tagPrefix = '[' + meowChatHash(__chatUID) + ']';
    const matched = all.filter(e => {
      const c = String(e?.comment || '');
      return c.startsWith(tagPrefix+'[MEOW]');
    });
    if (!matched.length) return false;

    const db = lsGet(LS_WB, null);
    if (!db || db.v !== 4) return false;

    db.cards ||= [];
    db.tabs  ||= [];

    const _trim = (s)=>String(s||'').trim();

    const tabIdByName = new Map();
    for (const t of db.tabs){
      const id = _trim(t?.id);
      const nm = _trim(t?.name || t?.id);
      if (nm) tabIdByName.set(nm, id || nm);
      if (id) tabIdByName.set(id, id);
    }

    const ALIAS = {
      '时空':'time','时空信息':'time','时间':'time',
      '角色':'role','角色详情':'role','角色信息':'role','人物':'role',
      '故事':'plot','故事大纲':'plot','大纲':'plot','剧情':'plot',
      '事件':'event','事件详情':'event',
      '任务':'task','任务约定':'task','待办':'task',
      '道具':'item','道具物品':'item','物品':'item'
    };

    let gotAnyCard = false;

    for (const entry of matched){
      const comment = String(entry?.comment || '');
      const content = String(entry?.content || '');
      if (!_trim(content)) continue;

      let rest = comment.slice(tagPrefix.length);
      if (!rest.startsWith('[MEOW]')) continue;
      rest = rest.slice(6);

      if (rest === 'Summary' || rest === 'SummarySmall'){
        // ✅ 从世界书回填时也写到 chat.extra（避免把大文本塞回 localStorage）
        try{
          if (rest === 'Summary'){
            saveLastOut(content, { source:'worldinfo', kind:'Summary', syncedAt: Date.now() });
            try{ meowSaveChatState(__chatUID, { out: String(content||''), lastSummaryAt: Date.now() }); }catch(e){}
            try{
              const o = doc.querySelector('#meow-summary-modal #meow_out');
              if (o){ o.value = String(content||''); o.dispatchEvent(new Event('input', {bubbles:true})); }
            }catch(e){}
            try{ meowRefreshAutoPackPrompt(false); }catch(e){}
          }else{
            // 小总结单独挂一个字段，不影响主总结读取
            try{
              const ctx = (typeof meowGetSTCtx === 'function') ? meowGetSTCtx() : null;
              if (ctx && Array.isArray(ctx.chat) && ctx.chat.length){
                const a = meowPickAnchorIndexForSummary(ctx, -1);
                const msg = ctx.chat[a];
                if (msg){
                  if (!msg.extra || typeof msg.extra !== 'object') msg.extra = {};
                  msg.extra.meow_summary_small = { text: String(content ?? ''), createdAt: Date.now(), source:'worldinfo', kind:'SummarySmall', syncedAt: Date.now() };
                  try{ if (typeof ctx.saveChat === 'function') ctx.saveChat(); }catch(e){}
                }
              }
            }catch(e){}
            try{ meowSaveChatState(__chatUID, { outSmall: String(content||''), lastSummarySmallAt: Date.now() }); }catch(e){}
          }
        }catch(e){}
        continue;
      }

      let tabId = '';
      let cardId = '';
      let title = '';

      const parts = rest.split('::');
      if (parts.length >= 3){
        tabId  = _trim(parts[0]);
        cardId = _trim(parts[1]);
        title  = _trim(parts.slice(2).join('::'));
      } else {
        const name = _trim(rest);
        tabId = tabIdByName.get(name) || ALIAS[name] || name;
        title = name || tabId || '条目';
        cardId = '';
      }

      if (!tabId) tabId = db.tabs?.[0]?.id || 'time';

      if (!db.tabs.find(t=>String(t?.id)===String(tabId))){
        db.tabs.push({ id:tabId, name:tabId, order:(db.tabs.length+1)*10 });
      }

      let card = null;
      if (cardId){
        card = db.cards.find(c=>String(c?.id)===String(cardId));
      }
      if (!card){
        card = db.cards.find(c=>String(c?.tab)===String(tabId));
      }
      if (!card){
        const nid = cardId || ('w_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16));
        card = { id:nid, tab:tabId, title:title||tabId, key:title||tabId, text:'', template:'', note:'', page:'a', order:0 };
        db.cards.push(card);
      }

      card.tab   = tabId;
      card.title = title || card.title || tabId;
      card.key   = card.key || card.title || tabId;
      card.text  = content;
      card.page  = 'a';

      gotAnyCard = true;
    }

    if (!gotAnyCard) return false;

    db._chatUID = __chatUID;
    lsSet(LS_WB, db);
    return true;
  } catch(e){
    return false;
  }
}


function meowSwitchWBChat(oldUID, newUID){
  const uidOld = String(oldUID || '');
  const uidNew = String(newUID || '');
  if (!uidNew) return;

  // 1) 先保存旧聊天（本地快照）
  if (uidOld) meowSaveWBForChat(uidOld);

  (async ()=>{
    // 2) 先切酒馆世界书 enabled（保证“未进入该聊天时不污染”）
    try{ await meowToggleTavernEntries(uidNew); }catch(e){}

    // 3) 优先从酒馆世界书拉取该聊天（跨端真源）
    let loadedRemote = false;
    try{ loadedRemote = await meowLoadWBFromTavern(uidNew); }catch(e){ loadedRemote = false; }

    if (loadedRemote){
      try{ meowSaveWBForChat(uidNew); }catch(e){}
      try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
    } else {
      // 4) 酒馆没有 → 读本地快照；没有就创建空白
      let loadedLocal = false;
      try{ loadedLocal = meowLoadWBForChat(uidNew); }catch(e){ loadedLocal = false; }

      if (!loadedLocal){
        let fresh = null;
        try{ fresh = (typeof meowMakeFreshWBForChat === 'function') ? meowMakeFreshWBForChat() : null; }catch(e){ fresh=null; }
        if (!fresh){
          try{ fresh = (typeof meowMakeFreshWB === 'function') ? meowMakeFreshWB(uidNew) : null; }catch(e){ fresh=null; }
        }
        if (fresh){
          try{ fresh._chatUID = uidNew; }catch(e){}
          try{ lsSet(LS_WB, fresh); }catch(e){}
          try{ meowSaveWBForChat(uidNew); }catch(e){}
        }
      }

      try{ window.MEOW_WB_REFRESH?.(); }catch(e){}

      // 5) 本地有数据但远端没有 → 推一次（让另一台设备能读到）
      try{
        if (typeof meowSyncTavernForChat === 'function'){
          setTimeout(()=>{ try{ meowSyncTavernForChat(uidNew); }catch(e){} }, 180);
        }
      }catch(e){}
    }

    // 6) 更新总结模块的活跃 UID
    try{
      window.__MEOW_SUM_ACTIVE_UID__ = uidNew;
      if (typeof window.__MEOW_SUM_CHAT_SWITCH__ === 'function'){
        window.__MEOW_SUM_CHAT_SWITCH__(uidNew);
      }
    }catch(e){}
  })();
}
// ----- 检查当前 LS_WB 是否属于当前聊天（标记法）-----
function meowEnsureWBBelongsToChat(uid){
  try{
    const wb = lsGet(LS_WB, null);
    if (!wb || wb.v !== 4) return;

    const owner = wb._chatUID || '';

    // 如果 LS_WB 已经属于当前聊天，不用动
    if (owner === uid) return;

    // 如果有所有者（是别的聊天的数据）→ 先保存给它，再加载自己的
    if (owner) meowSaveWBForChat(owner);

    // 加载自己的
    const loaded = meowLoadWBForChat(uid);
    if (!loaded){
      const fresh = meowMakeFreshWB(uid);
      if (fresh){
        lsSet(LS_WB, fresh);
        meowSaveWBForChat(uid);
      }
    }

    try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
  }catch(e){}
}

// 延迟初始化：等消息加载完再检测（云酒馆消息加载比较慢）
setTimeout(()=>{
  try{
    const initUID = meowGetChatUID();
    // 如果拿到的是临时ID（char: 开头），1秒后再试一次
    if (initUID.startsWith('char:')){
      setTimeout(()=>{
        const retry = meowGetChatUID();
        meowEnsureWBBelongsToChat(retry);
meowToggleTavernEntries(retry);
      }, 2000);
    } else {
      meowEnsureWBBelongsToChat(initUID);
meowToggleTavernEntries(initUID);
    }
  }catch(e){}
}, 2000); // 从 1500 改为 2000，给云酒馆更多加载时间


// 注册聊天切换回调（延迟重检：确保消息已加载后再取指纹）
meowBindChatAutoLoad((newUID, oldUID)=>{
  // 先用传入的 newUID 做初步切换（至少保存旧数据）
  const quickOld = oldUID;

  // 延迟 1.2 秒后重新检测 UID（等消息加载完），用指纹版
  setTimeout(()=>{
    const realUID = meowGetChatUID();
    meowSwitchWBChat(quickOld, realUID);
  }, 1200);
});

// ✅ 全局：总结模块聊天切换监听（不依赖弹窗是否打开）
// 和世界书一样带延迟，确保云酒馆 context 已刷新
meowBindChatAutoLoad((newUID, oldUID)=>{
  setTimeout(()=>{
    const realUID = meowGetChatUID();
    // fallback: 开头说明拿不到真实 UID，不切换（避免数据错乱）
    if (realUID.startsWith('fallback:')) return;

    // 更新全局追踪变量（给 openSummaryModal 打开时用）
    window.__MEOW_SUM_ACTIVE_UID__ = realUID;

    // 如果总结弹窗正在打开，实时切换显示
    if (typeof window.__MEOW_SUM_CHAT_SWITCH__ === 'function'){
      window.__MEOW_SUM_CHAT_SWITCH__(realUID);
    }
  }, 1400); // 比世界书稍晚 200ms，避免同时读写冲突
});

// 加载指定聊天的世界书快照到 LS_WB
function meowLoadWBForChat(uid){
  if (!uid) return false;
  try{
    const store = lsGet(LS_WB_BY_CHAT, { map:{} });
    const entry = store.map?.[uid];
    if (entry && entry.data && entry.data.v === 4){
      entry.data._chatUID = uid; // ✅ 确保标记归属
      lsSet(LS_WB, entry.data);
      return true;
    }
  }catch(e){}
  return false;
}

// 为新聊天创建一份空白世界书（保留模板结构，清空内容）
function meowMakeFreshWBForChat(){
  try{
    const tpl = lsGet(LS_WB, null);
    if (tpl && tpl.v === 4){
      const fresh = JSON.parse(JSON.stringify(tpl));
      // ✅ 彻底清空卡片（不保留旧卡片结构，新分支应该是空白的）
      fresh.cards = [];
      fresh.q = '';
      fresh.active = (fresh.tabs || [])[0]?.id || 'time';
      delete fresh._chatUID; // 由调用方设置
      return fresh;
    }
    // 没有模板时，创建最小 v4 结构
    const BASE = [
      { id:'time',  name:'时空信息', icon:'⏳' },
      { id:'role',  name:'角色详情', icon:'👤' },
      { id:'plot',  name:'故事大纲', icon:'📜' },
      { id:'event', name:'事件详情', icon:'🧾' },
      { id:'task',  name:'任务约定', icon:'✅' },
      { id:'item',  name:'道具物品', icon:'🎒' },
    ];
    return {
      v:4,
      tabs: BASE.map((t,i)=>({ id:t.id, name:t.name, icon:t.icon, order:i })),
      active: 'time', q:'', cards:[],
      show: Object.fromEntries(BASE.map(t=>[t.id,true])),
      frames:{}
    };
  }catch(e){ return null; }
}
// ✅ 补齐：meowMakeFreshWB 别名（避免 undefined 报错）
function meowMakeFreshWB(uid){
  const fresh = meowMakeFreshWBForChat();
  if (fresh && uid) fresh._chatUID = uid;
  return fresh;
}

// 切换聊天时的完整流程：保存旧 → 加载新（或新建空白）→ ✅切换酒馆条目 + 总结状态
function meowSwitchWBChat(oldUID, newUID){
  // 1) 保存当前世界书给旧聊天
  if (oldUID) meowSaveWBForChat(oldUID);

  // 2) 尝试加载新聊天的世界书
  const loaded = meowLoadWBForChat(newUID);

  if (!loaded){
    // 新聊天，没有历史快照 → 创建空白世界书（保留模板结构）
    const fresh = meowMakeFreshWBForChat();
    if (fresh){
      lsSet(LS_WB, fresh);
      meowSaveWBForChat(newUID); // 立刻保存快照
    }
  }

  // 3) 刷新世界书 UI（如果正在打开）
  try{ window.MEOW_WB_REFRESH?.(); }catch(e){}

  // ✅ 4) 切换酒馆世界书条目（防抖：避免关闭聊天时频繁触发API导致卡顿）
  if (window.__meowToggleTimer__) clearTimeout(window.__meowToggleTimer__);
  window.__meowToggleTimer__ = setTimeout(async ()=>{
    try{ await meowToggleTavernEntries(newUID); }catch(e){}
  }, 800);

  // ✅ 5) 同步更新总结模块的全局 UID 追踪 + 触发弹窗刷新
  try{
    window.__MEOW_SUM_ACTIVE_UID__ = newUID;
    if (typeof window.__MEOW_SUM_CHAT_SWITCH__ === 'function'){
      window.__MEOW_SUM_CHAT_SWITCH__(newUID);
    }
  }catch(e){}
}

// ===================== V3: 预览浮窗（聊天输入框上方） =====================
function openChatFloatingPanel() {
  var ID_WB_M = (typeof ID_WB !== 'undefined') ? ID_WB : 'meow-wb-modal';
  // 在 doc 和 document 都找（可能已被移到iframe内）
  var modal = doc.getElementById(ID_WB_M);
  if (!modal) try { modal = document.getElementById(ID_WB_M); } catch(e){}
  // 也搜索所有iframe
  if (!modal) {
    try {
      var frames = doc.querySelectorAll('iframe');
      for (var fi = 0; fi < frames.length && !modal; fi++) {
        try { modal = frames[fi].contentDocument.getElementById(ID_WB_M); } catch(e){}
      }
    } catch(e){}
  }

  // ===== 还原：浮窗 → 弹窗 =====
  if (modal && modal.__meowFloatMode) {
    // 移回原来的 document
    if (modal.__meowOrigParent) {
      try { modal.__meowOrigParent.appendChild(modal); } catch(e){}
    }
    modal.classList.remove('meow-wb-float');
    modal.style.cssText = '';
    modal.__meowFloatMode = false;
    try{ clearInterval(modal.__meowFloatVarSync); }catch(e){}
    // 还原隐藏的元素
    var hd = modal.querySelector('.hd'); if(hd) hd.style.display = '';
    var els = modal.querySelectorAll('.wbv4Search,.wbv4Mini,.wbv4Bottom,#wbv4_custom_html');
    for(var i=0;i<els.length;i++) els[i].style.display = '';
    var bd2 = modal.querySelector('.bd'); if(bd2) bd2.style.cssText = '';
    var top2 = modal.querySelector('.wbv4Top'); if(top2) top2.style.cssText = '';
    var body2 = modal.querySelector('.wbv4Body'); if(body2) body2.style.cssText = '';
    var btn = modal.querySelector('#wbv4_rule'); if(btn) btn.textContent = '📊 打开预览浮窗';
    var fc = modal.querySelector('#meow-wb-float-ctrl'); if(fc) fc.remove();
    // 恢复遮罩
    try { var m = doc.getElementById('meow-pencil-mask'); if(m) m.style.display = ''; } catch(e){}
    return;
  }

  // ===== 如果弹窗不存在 → 先打开世界书 =====
  if (!modal) {
    try { openWorldBookModal(); } catch(e) {
      try { openWorldbookModal(); } catch(e2) { toast('请先打开世界书'); return; }
    }
    modal = doc.getElementById(ID_WB_M);
    if (!modal) { toast('世界书弹窗未找到'); return; }
  }

  // ===== 找到 iframe 内的挂载点 =====
  var sendArea = doc.querySelector('#send_textarea');
  if (sendArea) sendArea = sendArea.closest('.form_create') || sendArea.closest('form') || sendArea.parentNode;
  if (!sendArea) sendArea = doc.querySelector('#send_form') || doc.querySelector('form');
  // 找到 sendArea 所在的 document
  var iframeDoc = sendArea ? (sendArea.ownerDocument || document) : document;

  // ===== 记住原位置，然后移到 sendArea 旁（确保可见）=====
  modal.__meowOrigParent = modal.parentNode;
  modal.__meowFloatMode = true;
  var mountParent = sendArea.parentNode;
  if(mountParent && getComputedStyle(mountParent).position === 'static') mountParent.style.position = 'relative';
  mountParent.insertBefore(modal, sendArea);

  // ===== 注入浮窗CSS + 复制WB样式到iframe =====
  if (!iframeDoc.getElementById('meow-wb-float-css')) {
    var st = iframeDoc.createElement('style');
    st.id = 'meow-wb-float-css';
    st.textContent = [
      '.meow-wb-float > .hd { display:none!important; }',
      '.meow-wb-float .wbv4Search { display:none!important; }',
      '.meow-wb-float #wbv4_custom_html { display:none!important; }',
      '.meow-wb-float .wbv4Mini { display:none!important; }',
      '.meow-wb-float .wbv4Bottom { display:none!important; }',
      // 表格：横向可滚动，不强制换行
      '.meow-wb-float .wbv4Card { overflow-x:auto!important; }',
      '.meow-wb-float table { width:max-content!important;min-width:100%!important;border-collapse:collapse!important; }',
      '.meow-wb-float th { white-space:nowrap!important; }',
      // td最多3行，超出隐藏
      '.meow-wb-float td { max-width:200px!important;word-break:break-word!important;white-space:normal!important;overflow:hidden!important;text-overflow:ellipsis!important;max-height:4.2em!important;line-height:1.4!important;vertical-align:top!important; }',
      // 竖向滚动条：overlay不占位，极细
      '.meow-wb-float .wbv4Body { overflow-y:auto!important;scrollbar-width:none!important; }',
      '@supports (overflow-y:overlay) { .meow-wb-float .wbv4Body { overflow-y:overlay!important; } }',
      '.meow-wb-float .wbv4Body::-webkit-scrollbar { width:2px!important;background:transparent!important; }',
      '.meow-wb-float .wbv4Body::-webkit-scrollbar-track { background:transparent!important; }',
      '.meow-wb-float .wbv4Body::-webkit-scrollbar-thumb { background:rgba(0,0,0,.06)!important;border-radius:4px!important; }',
      // 横向滚动条：极细+低调
      '.meow-wb-float .wbv4Card::-webkit-scrollbar { height:2px!important; }',
      '.meow-wb-float .wbv4Card::-webkit-scrollbar-track { background:transparent!important; }',
      '.meow-wb-float .wbv4Card::-webkit-scrollbar-thumb { background:rgba(0,0,0,.08)!important;border-radius:4px!important; }',
      '.meow-wb-float .wbv4Card { scrollbar-width:thin!important;scrollbar-color:rgba(0,0,0,.08) transparent!important; }',
      // 卡片间距紧凑
      '.meow-wb-float .wbv4List { gap:6px!important; }',
      '.meow-wb-float .wbv4CardWrap { margin-bottom:0!important; }',
    ].join('\n');
    (iframeDoc.head || iframeDoc.documentElement).appendChild(st);
  }
  // 复制世界书样式到iframe（否则卡片/tab无样式）
  if (!iframeDoc.getElementById('wbv4_style_in_iframe')) {
    var origStyle = doc.getElementById('wbv4_style_scoped_only_root');
    if (origStyle) {
      var st2 = iframeDoc.createElement('style');
      st2.id = 'wbv4_style_in_iframe';
      st2.textContent = origStyle.textContent;
      (iframeDoc.head || iframeDoc.documentElement).appendChild(st2);
      // 同步scoped style变化
      try {
        new MutationObserver(function(){
          var os = doc.getElementById('wbv4_style_scoped_only_root');
          var is2 = iframeDoc.getElementById('wbv4_style_in_iframe');
          if(os && is2 && os.textContent !== is2.textContent) is2.textContent = os.textContent;
        }).observe(origStyle, {childList:true, characterData:true, subtree:true});
      } catch(e){}
    }
    // 也复制主题动态样式（含tab颜色、按钮颜色等）
    var themeStyle = doc.getElementById('meow_global_theme_inject');
    if (themeStyle && !iframeDoc.getElementById('meow_theme_in_iframe')) {
      var st3 = iframeDoc.createElement('style');
      st3.id = 'meow_theme_in_iframe';
      st3.textContent = themeStyle.textContent;
      (iframeDoc.head || iframeDoc.documentElement).appendChild(st3);
      // ★ 持续同步：美化自定义改了主题时同步到iframe
      try {
        new MutationObserver(function(){
          var ts = doc.getElementById('meow_global_theme_inject');
          var ti = iframeDoc.getElementById('meow_theme_in_iframe');
          if(ts && ti && ts.textContent !== ti.textContent) ti.textContent = ts.textContent;
        }).observe(themeStyle, {childList:true, characterData:true, subtree:true});
      } catch(e){}
    }
    // 复制meowModal基础样式
    var baseStyles = doc.querySelectorAll('style');
    for (var si = 0; si < baseStyles.length; si++) {
      if (baseStyles[si].textContent && baseStyles[si].textContent.indexOf('.meowModal') >= 0 && !baseStyles[si].id) {
        var st4 = iframeDoc.createElement('style');
        st4.id = 'meow_modal_base_in_iframe';
        st4.textContent = baseStyles[si].textContent;
        (iframeDoc.head || iframeDoc.documentElement).appendChild(st4);
        break;
      }
    }
  }

  // ===== 切换到浮窗模式 =====
  modal.classList.add('meow-wb-float');
  var panelH = 280;
  // 内联保底：absolute定位在sendArea上方
  var baseCSS = 'position:absolute!important;bottom:100%!important;left:0!important;right:0!important;top:auto!important;height:'+panelH+'px!important;max-height:420px!important;min-height:80px!important;border-radius:14px 14px 0 0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;z-index:2147483100!important;background:var(--meow-bg-strong,rgba(245,242,238,.97))!important;border:1px solid var(--meow-line,rgba(0,0,0,.08))!important;border-bottom:none!important;box-shadow:0 -6px 24px rgba(0,0,0,.12)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;transition:none;';
  // 追加CSS变量
  try {
    var cs = getComputedStyle(doc.documentElement);
    var vars = ['--meow-bg-strong','--meow-bg','--meow-text','--meow-sub','--meow-line','--meow-accent','--meow-card','--meow-shadow','--meow-input-line','--meow-accent-soft','--meow-hd-bg','--meow-inner-bg'];
    for (var vi = 0; vi < vars.length; vi++) {
      var val = cs.getPropertyValue(vars[vi]).trim();
      if (val) baseCSS += vars[vi] + ':' + val + ';';
    }
  } catch(e){}
  modal.style.cssText = baseCSS;

  // ===== 隐藏不需要的部分（inline保底）=====
  var hd = modal.querySelector('.hd'); if(hd) hd.style.display = 'none';
  var allHide = modal.querySelectorAll('.wbv4Search,.wbv4Mini,.wbv4Bottom,#wbv4_custom_html');
  for(var hi=0;hi<allHide.length;hi++) allHide[hi].style.display = 'none';

  // bd撑满
  var bd = modal.querySelector('.bd');
  if(bd) bd.style.cssText = 'padding:0!important;flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;';
  // Tab栏紧凑
  var top2 = modal.querySelector('.wbv4Top');
  if(top2) top2.style.cssText = 'flex-shrink:0!important;padding:4px 8px 0!important;';
  // 内容区可滚动
  var body2 = modal.querySelector('.wbv4Body');
  if(body2) body2.style.cssText = 'flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;padding:4px 8px 10px!important;scrollbar-width:none;';

  // 隐藏遮罩
  try { var mask = doc.getElementById('meow-pencil-mask'); if(mask) mask.style.display = 'none'; } catch(e){}

  // ===== MutationObserver：WB可能re-render，持续隐藏不需要的部分 =====
  // 只监听直接子节点变化，避免美化面板操作触发闪烁
  try {
    var _floatObs = new MutationObserver(function(muts){
      if(!modal.__meowFloatMode) { _floatObs.disconnect(); return; }
      // 只在子节点确实变化时执行
      var needFix = false;
      for(var mi=0;mi<muts.length;mi++){ if(muts[mi].addedNodes.length||muts[mi].removedNodes.length){ needFix=true; break; } }
      if(!needFix) return;
      var els = modal.querySelectorAll('.wbv4Bottom,.wbv4Search,.wbv4Mini,#wbv4_custom_html');
      for(var i=0;i<els.length;i++) if(els[i].style.display!=='none') els[i].style.display='none';
      var hd2=modal.querySelector('.hd'); if(hd2&&hd2.style.display!=='none') hd2.style.display='none';
    });
    _floatObs.observe(modal, {childList:true});
    // 也监听 bd 的直接子节点（WB renderAll重建内容）
    var bdObs = modal.querySelector('.bd');
    if(bdObs) _floatObs.observe(bdObs, {childList:true});
  } catch(e){}

  // 更新按钮文字
  var btn = modal.querySelector('#wbv4_rule');
  if (btn) btn.textContent = '↩ 还原弹窗';

  // ===== 控制按钮（拖拽条 + 还原 + 关闭）=====
  if (!modal.querySelector('#meow-wb-float-ctrl')) {
    var ctrl = iframeDoc.createElement('div');
    ctrl.id = 'meow-wb-float-ctrl';
    ctrl.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:7px 0 3px;flex-shrink:0;position:relative;cursor:ns-resize;user-select:none;-webkit-user-select:none;touch-action:none;z-index:20;';
    ctrl.innerHTML = '<div style="width:36px;height:3px;border-radius:2px;background:rgba(0,0,0,.12);pointer-events:none;"></div>';

    var btnWrap = iframeDoc.createElement('div');
    btnWrap.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;gap:8px;z-index:21;';
    // 阻止按钮区域触发拖拽
    btnWrap.addEventListener('mousedown', function(e){ e.stopPropagation(); }, {passive:false});
    btnWrap.addEventListener('touchstart', function(e){ e.stopPropagation(); }, {passive:false});

    var restoreBtn = iframeDoc.createElement('div');
    restoreBtn.textContent = '↩';
    restoreBtn.title = '还原弹窗';
    restoreBtn.style.cssText = 'font-size:11px;color:rgba(80,68,52,.55);cursor:pointer;padding:2px 6px;border-radius:6px;line-height:1;';
    restoreBtn.addEventListener('click', function(e){ e.stopPropagation(); openChatFloatingPanel(); }, {passive:false});

    var closeBtn = iframeDoc.createElement('div');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'font-size:11px;color:rgba(0,0,0,.3);cursor:pointer;padding:2px 4px;line-height:1;';
    closeBtn.addEventListener('click', function(e){
      e.stopPropagation();
      // 先还原到原位
      if(modal.__meowOrigParent) try{modal.__meowOrigParent.appendChild(modal);}catch(ex){}
      // 还原子元素样式
      var hd2=modal.querySelector('.hd');if(hd2)hd2.style.display='';
      var els2=modal.querySelectorAll('.wbv4Search,.wbv4Mini,.wbv4Bottom,#wbv4_custom_html');
      for(var i2=0;i2<els2.length;i2++)els2[i2].style.display='';
      var bd3=modal.querySelector('.bd');if(bd3)bd3.style.cssText='';
      var tp3=modal.querySelector('.wbv4Top');if(tp3)tp3.style.cssText='';
      var by3=modal.querySelector('.wbv4Body');if(by3)by3.style.cssText='';
      modal.__meowFloatMode = false;
      try{ clearInterval(modal.__meowFloatVarSync); }catch(ex){}
      modal.classList.remove('meow-wb-float');
      modal.style.cssText = '';
      try { ctrl.remove(); } catch(ex){}
      try { closeModal(ID_WB_M); } catch(ex) { modal.remove(); }
      // 恢复遮罩
      try { var m2 = doc.getElementById('meow-pencil-mask'); if(m2) m2.style.display = ''; } catch(ex){}
    }, {passive:false});

    btnWrap.appendChild(restoreBtn);
    btnWrap.appendChild(closeBtn);
    ctrl.appendChild(btnWrap);
    modal.insertBefore(ctrl, modal.firstChild);

    // ===== 拖拽调高度（绑在ctrl上）=====
    var dragging = false, sY = 0, sH = 0;
    ctrl.addEventListener('mousedown', function(e){
      if(e.target !== ctrl && !e.target.style.pointerEvents) return; // 不响应按钮点击
      dragging = true; sY = e.clientY; sH = panelH;
      e.preventDefault(); e.stopPropagation();
    }, {passive:false});
    ctrl.addEventListener('touchstart', function(e){
      dragging = true; sY = e.touches[0].clientY; sH = panelH;
      e.preventDefault(); e.stopPropagation();
    }, {passive:false});

    iframeDoc.addEventListener('mousemove', function(e){
      if(!dragging) return; e.preventDefault();
      panelH = Math.max(80, Math.min(600, sH + (sY - e.clientY)));
      modal.style.setProperty('height', panelH + 'px', 'important');
    }, {passive:false});
    iframeDoc.addEventListener('touchmove', function(e){
      if(!dragging) return;
      panelH = Math.max(80, Math.min(600, sH + (sY - e.touches[0].clientY)));
      modal.style.setProperty('height', panelH + 'px', 'important');
    }, {passive:false});
    iframeDoc.addEventListener('mouseup', function(){ dragging = false; });
    iframeDoc.addEventListener('touchend', function(){ dragging = false; });
  }

  // ===== 定期同步主题CSS变量 + 动态样式（美化自定义改色时）=====
  modal.__meowFloatVarSync = setInterval(function(){
    if(!modal.__meowFloatMode){ clearInterval(modal.__meowFloatVarSync); return; }
    try{
      var cs = getComputedStyle(doc.documentElement);
      var vars = ['--meow-bg-strong','--meow-bg','--meow-text','--meow-sub','--meow-line','--meow-accent','--meow-card','--meow-shadow','--meow-input-line','--meow-accent-soft','--meow-input','--meow-line-2','--meow-hd-bg','--meow-inner-bg'];
      for(var vi=0;vi<vars.length;vi++){
        var val = cs.getPropertyValue(vars[vi]).trim();
        if(val) modal.style.setProperty(vars[vi], val);
      }
      // 同步动态主题样式（tab颜色/按钮颜色）
      var ts = doc.getElementById('meow_global_theme_inject');
      var ti = iframeDoc.getElementById('meow_theme_in_iframe');
      if(ts && ti && ts.textContent !== ti.textContent) ti.textContent = ts.textContent;
      // 同步scoped样式
      var os = doc.getElementById('wbv4_style_scoped_only_root');
      var is2 = iframeDoc.getElementById('wbv4_style_in_iframe');
      if(os && is2 && os.textContent !== is2.textContent) is2.textContent = os.textContent;
    }catch(e){}
  }, 1200);

  void(0)&&console.log('[MEOW][Float] 世界书浮窗模式, modal在:', modal.ownerDocument === iframeDoc ? 'iframe内' : '外部');
}

// ===================== V3: API 设置独立弹窗 =====================
function openAPISettingsPanel() {
  var ID_API = 'meow-api-settings-modal';
  var bd2 = modalShell(ID_API, 'API 设置', '🔑');

  var apiNow    = lsGet(LS_API, { baseUrl:'', apiKey:'', model:'' });
  var apiPresets = lsGet(LS_API_PRESETS, { list: [] });
  var presetOpts = '';
  for (var pi = 0; pi < (apiPresets.list||[]).length; pi++) {
    presetOpts += '<option value="' + pi + '">' + String(apiPresets.list[pi].name||'未命名').replace(/</g,'&lt;') + '</option>';
  }

  bd2.innerHTML =
    '<div class="sec">' +
      '<div class="row" style="margin-bottom:10px;">' +
        '<div style="flex:1;min-width:160px;"><label>API 预设</label><select id="meow_api_ps2"><option value="">（选择预设）</option>' + presetOpts + '</select></div>' +
        '<div style="display:flex;gap:10px;align-items:flex-end;">' +
          '<button class="btn" id="meow_api_ps_save2">💾 存为预设</button>' +
          '<button class="btn danger" id="meow_api_ps_del2">🗑️ 删除预设</button>' +
        '</div>' +
      '</div>' +
      '<div class="row">' +
        '<div style="flex:1;min-width:160px;"><label>API 基础 URL</label><input id="meow_ab2" placeholder="例如 https://api.openai.com/v1" value="' + (apiNow.baseUrl||'').replace(/"/g,'&quot;') + '"></div>' +
        '<div style="flex:1;min-width:160px;"><label>API Key（可空）</label><input id="meow_ak2" placeholder="sk-..." value="' + (apiNow.apiKey||'').replace(/"/g,'&quot;') + '"></div>' +
      '</div>' +
      '<div class="row" style="margin-top:10px;">' +
        '<div style="flex:1;min-width:160px;"><label>模型</label><input id="meow_am2" placeholder="例如 gpt-4o-mini" value="' + (apiNow.model||'').replace(/"/g,'&quot;') + '"></div>' +
        '<div style="flex:1;min-width:160px;"><label>状态</label><div class="hint" id="meow_as2" style="margin-top:6px;">当前URL：' + (apiNow.baseUrl || '未设置') + ' ｜ 模型：' + (apiNow.model || '未选') + '</div></div>' +
      '</div>' +
      '<div class="row" style="margin-top:10px;">' +
        '<button class="btn" id="meow_lm2">📦 拉取模型列表</button>' +
        '<button class="btn" id="meow_sa2">💾 保存</button>' +
        '<button class="btn danger" id="meow_ca2">🧹 清空</button>' +
      '</div>' +
      '<div class="hint" style="margin-top:8px;">baseUrl 填到 /v1 为止（脚本会自动拼 /chat/completions 与 /models）。</div>' +
    '</div>';

  var _b = bd2.querySelector('#meow_ab2');
  var _k = bd2.querySelector('#meow_ak2');
  var _m = bd2.querySelector('#meow_am2');
  var _s = bd2.querySelector('#meow_as2');
  var _ps = bd2.querySelector('#meow_api_ps2');

  function _rp() {
    var box = lsGet(LS_API_PRESETS, { list: [] });
    if (_ps) {
      var h = '<option value="">(选择预设)</option>';
      for (var ri = 0; ri < (box.list||[]).length; ri++) h += '<option value="' + ri + '">' + String(box.list[ri].name||'未命名').replace(/</g,'&lt;') + '</option>';
      _ps.innerHTML = h;
    }
  }

  bd2.querySelector('#meow_sa2').addEventListener('click', function() {
    var v = { baseUrl: (_b.value||'').trim(), apiKey: (_k.value||'').trim(), model: (_m.value||'').trim() };
    lsSet(LS_API, v);
    if (_s) _s.textContent = '当前URL：' + (v.baseUrl||'未设置') + ' ｜ 模型：' + (v.model||'未选');
    toast('已保存API配置');
    // 同步到总结窗隐藏字段
    try { var m = doc.querySelector('#meow-summary-modal');
      if (m) { var e1=m.querySelector('#meow_api_base'); if(e1)e1.value=v.baseUrl; var e2=m.querySelector('#meow_api_key'); if(e2)e2.value=v.apiKey; var e3=m.querySelector('#meow_model_input'); if(e3)e3.value=v.model; }
    } catch(e){}
  }, {passive:false});

  bd2.querySelector('#meow_ca2').addEventListener('click', function() {
    lsSet(LS_API, { baseUrl:'', apiKey:'', model:'' });
    if (_b) _b.value=''; if (_k) _k.value=''; if (_m) _m.value='';
    if (_s) _s.textContent = '当前URL：未设置 ｜ 模型：未选';
    toast('已清空API配置');
  }, {passive:false});

  bd2.querySelector('#meow_api_ps_save2').addEventListener('click', function() {
    var name = (prompt('给这个 API 预设起个名字：') || '').trim();
    if (!name) { toast('已取消'); return; }
    var item = { name: name, baseUrl:(_b.value||'').trim(), apiKey:(_k.value||'').trim(), model:(_m.value||'').trim() };
    var box = lsGet(LS_API_PRESETS, { list: [] });
    var idx = -1;
    for (var si = 0; si < (box.list||[]).length; si++) { if (String(box.list[si].name||'') === name) { idx = si; break; } }
    if (idx >= 0) box.list[idx] = item; else box.list.unshift(item);
    box.list = box.list.slice(0, 40);
    lsSet(LS_API_PRESETS, box);
    toast('已保存为API预设'); _rp();
  }, {passive:false});

  bd2.querySelector('#meow_api_ps_del2').addEventListener('click', function() {
    var i = parseInt(_ps.value || '', 10);
    if (isNaN(i)) { toast('先选择一个预设'); return; }
    var box = lsGet(LS_API_PRESETS, { list: [] });
    box.list.splice(i, 1); lsSet(LS_API_PRESETS, box);
    toast('已删除API预设'); _rp();
  }, {passive:false});

  _ps.addEventListener('change', function() {
    var i = parseInt(_ps.value || '', 10);
    if (isNaN(i)) return;
    var box = lsGet(LS_API_PRESETS, { list: [] });
    var p = (box.list||[])[i]; if (!p) return;
    if (_b) _b.value = p.baseUrl || '';
    if (_k) _k.value = p.apiKey || '';
    if (_m) _m.value = p.model || '';
    if (_s) _s.textContent = '当前URL：' + (p.baseUrl||'未设置') + ' ｜ 模型：' + (p.model||'未选');
    lsSet(LS_API, { baseUrl: p.baseUrl||'', apiKey: p.apiKey||'', model: p.model||'' });
    toast('已载入：' + (p.name||'预设'));
  }, {passive:false});

  bd2.querySelector('#meow_lm2').addEventListener('click', async function() {
    var baseUrl = (_b.value || '').trim();
    var apiKey  = (_k.value || '').trim();
    if (!baseUrl) { toast('先填 API 基础 URL'); return; }
    toast('加载模型中…');
    try {
      var names = await loadModels(baseUrl, apiKey);
      if (!names || !names.length) { toast('没拿到模型列表'); return; }
      var bd3 = modalShell('meow-model-picker', '选择模型', '📦');
      var btns = '';
      for (var ni = 0; ni < Math.min(names.length, 200); ni++) {
        btns += '<button class="btn" data-mpick="' + String(names[ni]).replace(/"/g,'&quot;') + '" style="text-align:left;">' + String(names[ni]).replace(/</g,'&lt;') + '</button>';
      }
      bd3.innerHTML = '<div class="sec"><h3>可用模型（点一下自动填入）</h3><div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow:auto;">' + btns + '</div></div>';
      bd3.querySelectorAll('[data-mpick]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var mm = btn.getAttribute('data-mpick') || '';
          if (_m) _m.value = mm;
          var cfg = lsGet(LS_API, {});
          lsSet(LS_API, { baseUrl:(_b.value||''), apiKey:(_k.value||''), model:mm });
          if (_s) _s.textContent = '当前URL：' + ((_b.value||'')||'未设置') + ' ｜ 模型：' + (mm||'未选');
          toast('已选择模型并写入');
          closeModal('meow-model-picker');
        }, {passive:false});
      });
      toast('拿到 ' + names.length + ' 个模型');
    } catch(e) { toast('加载失败'); }
  }, {passive:false});
}


  // ===== 浮窗按钮挂载 =====
  function mount(){
    ({ W, doc } = pickHost());

    // 清旧
    try { doc.getElementById(ID_BTN)?.remove?.(); } catch(e){}

    if (!doc.body && doc.readyState === 'loading') return false;

    const b = doc.createElement('div');
    b.id = ID_BTN;

    // 更好看的图标（你要的“好看+存在感低”）
    b.innerHTML = `<span class="ico">✧</span>`;

    const saved = lsGet(KEY_POS, null);
    let x = saved?.x ?? (doc.documentElement.clientWidth - 52);
    let y = saved?.y ?? (doc.documentElement.clientHeight * 0.55 - 20);
    b.style.left = `${normPx(x, doc.documentElement.clientWidth)}px`;
    b.style.top  = `${normPx(y, doc.documentElement.clientHeight)}px`;

    let dragging=false, moved=false;
    let startX=0,startY=0, baseX=0, baseY=0;
    const DRAG_THRESHOLD = 6;

    let pressTimer = null;
    const LONGPRESS_MS = 520; // 给你足够时间“进入定位”，不会点一下就编辑
    let longPressed = false;

    function clearPress(){
      if (pressTimer){ clearTimeout(pressTimer); pressTimer = null; }
    }

    function onDown(ev){
      const p = ev.touches ? ev.touches[0] : ev;
      dragging=true; moved=false; longPressed=false;

      startX=p.clientX; startY=p.clientY;
      baseX=parseFloat(b.style.left)||0;
      baseY=parseFloat(b.style.top)||0;

      clearPress();
      pressTimer = setTimeout(() => {
        pressTimer = null;
        longPressed = true;
        closeOverlays();
        enterPickMode();
      }, LONGPRESS_MS);

      ev.preventDefault();
      ev.stopPropagation();
    }

    function onMove(ev){
      if (!dragging) return;
      const p = ev.touches ? ev.touches[0] : ev;
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD){
        moved = true;
        clearPress(); // 一旦拖动就取消长按
      }

      const nx = normPx(baseX + dx, doc.documentElement.clientWidth);
      const ny = normPx(baseY + dy, doc.documentElement.clientHeight);
      b.style.left = `${nx}px`;
      b.style.top  = `${ny}px`;

      ev.preventDefault();
      ev.stopPropagation();
    }

    function onUp(ev){
      if (!dragging) return;
      dragging=false;

      const nx = parseFloat(b.style.left)||0;
      const ny = parseFloat(b.style.top)||0;
      lsSet(KEY_POS, { x:nx, y:ny });

      // 结束时清定时器（但别误触发）
      clearPress();

      // 拖动就只是拖动
      if (moved) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }

      // 长按刚触发过：抬手不做任何事（避免“长按一下就进编辑”）
      if (longPressed) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }

      // 普通单击逻辑：
      // 1) 如果已经锁定了目标消息 -> 进入精准编辑
      // 2) 否则 -> 打开菜单（三功能）
      if (pickedMes) {
        closeOverlays();
        openEdit(pickedMes, pickedRatio, pickedSnippet || '');
        // 进编辑后解除 armed
        setTimeout(() => { pickedMes = null; setArmed(false); }, 300);
      } else {
  toggleMenu(b);
}

      ev.preventDefault();
      ev.stopPropagation();
    }

    b.addEventListener('touchstart', onDown, {passive:false});
    b.addEventListener('touchmove',  onMove, {passive:false});
    b.addEventListener('touchend',   onUp,   {passive:false});

    b.addEventListener('mousedown', onDown, {passive:false});
    doc.addEventListener('mousemove', onMove, {passive:false});
    doc.addEventListener('mouseup',   onUp,   {passive:false});

    (doc.body || doc.documentElement).appendChild(b);

    W.addEventListener('resize', () => {
      try{
        const bb = doc.getElementById(ID_BTN);
        if (!bb) return;
        const nx2 = normPx(parseFloat(bb.style.left)||0, doc.documentElement.clientWidth);
        const ny2 = normPx(parseFloat(bb.style.top)||0, doc.documentElement.clientHeight);
        bb.style.left = `${nx2}px`;
        bb.style.top  = `${ny2}px`;
      } catch(e){}
    });

    return true;
  }


  // ===== 模块动态加载 =====
  (function(){
    var base = 'https://cdn.jsdelivr.net/gh/z1551170381-ux/shuyuanmi@main/';
    ['worldbook.js','summary.js','diary.js'].forEach(function(name){
      var s = document.createElement('script');
      s.src = base + name;
      s.onerror = function(){ try{ toast('⚠️ '+name+' 加载失败'); }catch(e){} };
      document.head.appendChild(s);
    });
  })();

  let ok = mount();
  if (!ok){
    let tries = 0;
    const t = setInterval(()=>{ tries++; if(mount()||tries>10) clearInterval(t); }, 500);
  }
})();
