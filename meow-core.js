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
  position:absolute;top:0;left:0;right:0;bottom:0;
  background:rgba(0,0,0,.08);z-index:99999;
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

  // ===== 🔌 暴露给外部插件（如 meow-phone.js）使用的接口 =====
  try {
    Object.assign(MEOW.core, {
      MEOW_WB_API: (typeof MEOW_WB_API !== 'undefined') ? MEOW_WB_API : null,
      meowGetSTCtx: (typeof meowGetSTCtx === 'function') ? meowGetSTCtx : null,
      meowGetChatUID: function(){ return (typeof meowGetChatUID === 'function') ? meowGetChatUID() : ''; },
    });
  } catch(e){}


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

// ✅ 全局：确保世界书 UI 是最新的（简化版：快照已废弃，只刷 UI）
function meowForceWBSyncForCurrentChat(){
  try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
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

 function openSummaryModal(){
  window.__MEOW_SUM_MODAL_OPEN_TS__ = Date.now(); // ★ 记录打开时间，用于抑制初始化 toast
  const bd = modalShell(ID_SUMMARY, '全自动总结', '🧠');

  // ★ 在标题栏 close 按钮左侧插入 API 按钮
  try{
    const hdEl = bd.parentElement.querySelector('.hd');
    if (hdEl){
      const closeBtn = hdEl.querySelector('.close');
      if (closeBtn){
        // 创建右侧容器包裹 API + close
        const rightWrap = doc.createElement('div');
        rightWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
        const apiBtn = doc.createElement('div');
        apiBtn.id = 'meow_open_api_panel';
        apiBtn.style.cssText = 'cursor:pointer;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:600;border:1px solid var(--meow-line,rgba(28,24,18,.12));background:var(--meow-card,rgba(255,255,255,.56));color:var(--meow-sub,rgba(46,38,30,.62));white-space:nowrap;';
        apiBtn.textContent = '⚙ API';
        apiBtn.addEventListener('click', function(e){ e.stopPropagation(); openAPISettingsPanel(); }, {passive:false});
        rightWrap.appendChild(apiBtn);
        // 把 close 移入 rightWrap
        closeBtn.parentNode.insertBefore(rightWrap, closeBtn);
        rightWrap.appendChild(closeBtn);
      }
    }
  }catch(e){}

  // ===== 内置三种模式提示词（仅“大/小/表格基础提示词”）=====
  const BUILTIN = {
    big:   '按“时间-地点-人物-事件-线索-待办”结构总结，尽量具体，避免空话。',
    small: '把内容压缩为要点，保留时间地点人物事件变化，不要扩写。',
    table: '用表格输出：列=时间|地点|人物|事件|线索|待办；行=按发生顺序；简洁不废话。'
  };
// ✅ 尽量从角色设置/聊天面板里找“关联世界书名”
function meowFindRoleWorldName(){
  // 常见选择器（不同酒馆版本会变，所以做宽松）
  const cand = [
    '#character_world_select',
    'select[name="character_world"]',
    'select[name="worldbook"]',
    '#worldbook_select',
    '#char_world_select',
  ];
  for (const sel of cand){
    const el = document.querySelector(sel);
    const opt = el?.selectedOptions?.[0];
    const name = (opt?.textContent || opt?.innerText || '').trim();
    if (name) return name;
  }

  // 兜底：从 WorldInfo 面板当前选中世界书（如果正好开着）
  try{
    const sel = document.querySelector('#world_editor_select') || document.querySelector('#world_info');
    const opt = sel?.selectedOptions?.[0];
    const name = (opt?.textContent || opt?.innerText || '').trim();
    if (name) return name;
  }catch(e){}

  return '';
}

// ✅ 通过 TavernHelper 写入酒馆世界书（替代旧的桥接层）
async function meowWriteWorldInfoSafe(payload, opts) {
  const { worldName, title, key, content, memo } = payload || {};
  const text = content || '';
  const comment = title || key || 'Summary';
  const keys = key ? key.split(',').map(s=>s.trim()).filter(Boolean) : ['Summary'];

  // 优先用 MEOW_WB_API（TavernHelper 直连）
  try {
    if (typeof MEOW_WB_API !== 'undefined' && typeof MEOW_WB_API.upsertByComment === 'function') {
      const canDo = await MEOW_WB_API.canWrite();
      if (canDo) {
        await MEOW_WB_API.upsertByComment({
          comment: comment,
          content: text,
          keys: keys,
          enabled: true,
          type: 'constant',
          order: 9999,
          prevent_recursion: true
        });
        return { ok: true, mode: 'tavernhelper' };
      }
    }
  } catch(e) {
    console.warn('[MEOW] TavernHelper write failed:', e);
  }

  // 其次试旧桥接层（兼容保留）
  try {
    const fn = window.meowSyncToWorldInfo ||
               window.top?.meowSyncToWorldInfo ||
               window.parent?.meowSyncToWorldInfo;
    if (typeof fn === 'function') {
      const ret = await fn(payload);
      if (ret === true || (ret && (ret.ok || ret.success))) {
        return { ok: true, mode: 'bridge' };
      }
    }
  } catch(e) {}

  return { ok: false, reason: 'no_write_method' };
}

// ✅ 兜底：本地世界书写入（避免 pushToLocalWBSection 未定义导致自动写入中断）
function pushToLocalWBSection(text, key){
  try{
    // 你本地世界书 v4 用这个最稳：写到 overview 分组（或你想要的分组）
    wbSaveSummaryToGroup('overview', key, text);
  }catch(e){
    // 最后兜底：直接塞 localStorage
    const wb = lsGet(LS_WB_V2, { entries: [] });
    wb.entries.unshift({ t: Date.now(), key, text });
    wb.entries = wb.entries.slice(0, 500);
    lsSet(LS_WB_V2, wb);
  }
}
function insertToChatInput(text){
  const t = String(text || '').trim();
  if (!t) return false;

  // 常见输入框（不同主题/版本可能不同）
  const ta =
    doc.querySelector('#send_textarea') ||
    doc.querySelector('textarea#send_textarea') ||
    doc.querySelector('textarea[placeholder*="Message"]') ||
    doc.querySelector('textarea');

  if (!ta) return false;

  const sep = ta.value && !ta.value.endsWith('\n') ? '\n\n' : '';
  ta.value = ta.value + sep + t;
  ta.dispatchEvent(new Event('input', { bubbles:true }));
  try{ ta.focus(); }catch(e){}
  return true;
}
// ===================== 每次发送前：自动附加记忆包（不依赖一次性按钮） =====================
function buildMeowPack(outTextOptional){
  // ✅ 修复：优先从 per-chat 状态读取总结，避免跨聊天串数据
  let outText = String(outTextOptional||'').trim();

  if (!outText){
    try{
      // ✅ 优先：当前分支 chat.extra.meow_summary（天然随分支切换）
      outText = String(loadLastOut({ noFallback:true }) || '').trim();
      // ✅ 迁移兜底：旧版本 st.out → 写入 extra
      if (!outText){
        const uid = meowGetChatUID();
        const st = meowLoadChatState(uid);
        if (st && typeof st.out === 'string' && st.out){
          try{ saveLastOut(st.out, { migratedFrom:'chatState', migratedAt: Date.now() }); }catch(e){}
          outText = String(st.out).trim();
        }
      }
    }catch(e){}
  }

  // ✅ 从 chat metadata 读取调表数据
  let tableText = '';
  try{
    const tblData = (typeof meowTableMetaRead === 'function') ? meowTableMetaRead() : null;
    if (tblData && tblData.cols && tblData.cols.length && tblData.rows && tblData.rows.length){
      const tblName = tblData.name || '调表';
      tableText = `[调表·${tblName}]\n`;
      tableText += tblData.cols.join(' | ') + '\n';
      tblData.rows.forEach(row => {
        tableText += (tblData.cols||[]).map((_,ci)=> (row[ci]||'')).join(' | ') + '\n';
      });
    }
  }catch(e){}

  // 读仓库（世界书可视化 cards — 仅本地 UI 数据，非酒馆世界书）
  let repo = '';
  try{
    const db = lsGet(LS_WB, null);

    if (db?.v === 4 && Array.isArray(db.cards)){
      repo = db.cards
        .slice()
        .filter(c => c && (c.text || c.title || c.key))
        .slice(0, 12)
        .map(c => `【${c.tab}｜${c.title || c.key || '条目'}】\n${String(c.text||'').trim()}`)
        .join('\n\n');
    }
    else if (db?.list && Array.isArray(db.list)){
      repo = db.list
        .slice(0, 12)
        .map(x => `【${x.key||x.title||'条目'}】\n${String(x.content||'').trim()}`)
        .join('\n\n');
    }
  }catch(e){}

  const pack =
`[MEOW-记忆包]
（以下内容供本轮对话参考；不要逐字复述，优先用于一致性。）

${outText ? `[本次总结]\n${outText}\n\n` : ''}${tableText ? `${tableText}\n` : ''}[仓库摘要]
${repo || '（仓库为空或未读取到）'}
[/MEOW-记忆包]`;

  return pack;
}

// ===================== 记忆包注入（v8: 多层保障，适配云酒馆）=====================
// 问题根因：W = window.top（pickHost 选的），但 ST 的 fetch 和 API 跑在 iframe 的 window 里
// 解决：1) ST 事件系统 2) 所有 window 的 fetch 都钩 3) 按钮钩子兜底

// --- 收集所有可达的 window 对象 ---
function meowAllWindows(){
  var wins = [];
  try{ wins.push(window); }catch(e){}
  try{ if(window.top && window.top !== window) wins.push(window.top); }catch(e){}
  try{ if(window.parent && window.parent !== window && window.parent !== window.top) wins.push(window.parent); }catch(e){}
  return wins;
}

// --- 获取 ST context（遍历所有 window）---
function meowPickSTCtx(){
  var wins = meowAllWindows();
  for(var i=0;i<wins.length;i++){
    try{
      var w = wins[i];
      if(w.SillyTavern && typeof w.SillyTavern.getContext === 'function'){
        var ctx = w.SillyTavern.getContext();
        if(ctx) return ctx;
      }
    }catch(e){}
  }
  return null;
}


// --- 获取注入设置 ---
function meowGetInjectSettings(){
  return {
    pos:   parseInt(lsGet(LS_INJECT_POS, 2), 10),
    depth: parseInt(lsGet(LS_INJECT_DEPTH, 1), 10),
    role:  String(lsGet(LS_INJECT_ROLE, 'system')),
    scan:  String(lsGet(LS_INJECT_SCAN, 'false')) === 'true'
  };
}

// --- setExtensionPrompt 正确签名 ---
function meowInjectViaST(pack){
  // setExtensionPrompt 已禁用，改用 CHAT_COMPLETION_PROMPT_READY 事件注入
  // 事件注入能直接插入聊天消息之间，提示词查看器可见
  void(0)&&console.log('[MEOW][Pack] setExtensionPrompt 已禁用，使用事件注入');
  return false;
}

function meowClearSTInjection(){
  try{
    var ctx = meowPickSTCtx();
    if(ctx && typeof ctx.setExtensionPrompt === 'function'){
      ctx.setExtensionPrompt('meow_memory_pack', '', 0, 0, false, 'system');
    }
  }catch(e){}
}

// --- 刷新记忆包注入 ---
function meowRefreshAutoPackPrompt(forceClear){
  var on = !!lsGet(LS_AUTO_SEND_PACK, false);
  if(!on || forceClear){
    meowClearSTInjection();
    W.__MEOW_EXT_PACK_LAST__ = '';
    return false;
  }
  var pack = buildMeowPack('');
  if(!pack || !String(pack).trim()){
    console.warn('[MEOW][Pack] buildMeowPack 返回空');
    meowClearSTInjection();
    return false;
  }
  // 防重复
  if(String(W.__MEOW_EXT_PACK_LAST__||'') === pack) return true;
  W.__MEOW_EXT_PACK_LAST__ = pack;
  void(0)&&console.log('[MEOW][Pack] 记忆包长度:', pack.length, '开始注入...');
  return meowInjectViaST(pack);
}

// --- 层2: fetch 拦截（钩所有 window，确保命中 ST 的 fetch）---
function meowHookFetchAll(){
  var wins = meowAllWindows();
  for(var i=0;i<wins.length;i++){
    (function(w){
      try{
        if(!w || typeof w.fetch !== 'function') return;
        var key = '__MEOW_FETCH_PACK_HOOKED_V8__';
        if(w[key]) return;
        w[key] = true;

        var _origFetch = w.fetch;

        function shouldIntercept(url){
          try{
            var u = String(url||'');
            // 只拦本域的 API 请求
            if(!/\/api\//i.test(u)) return false;
            if(!/(backends|openai|chat|generate|completion)/i.test(u)) return false;
            try{
              var parsed = new URL(u, w.location.href);
              if(parsed.origin !== w.location.origin) return false;
            }catch(e){}
            return true;
          }catch(e){ return false; }
        }

        function tryInject(body){
          // fetch hook 已禁用，改用 CHAT_COMPLETION_PROMPT_READY 事件注入
          return null;
          if(!lsGet(LS_AUTO_SEND_PACK, false)) return null;

          var pack = buildMeowPack('');
          if(!pack || !String(pack).trim()) return null;

          var marker = '[MEOW-\u8bb0\u5fc6\u5305]';
          var injDepth = parseInt(lsGet(LS_INJECT_DEPTH, 1), 10) || 1;

          // === 格式A: OpenAI兼容 {messages:[{role,content}]} ===
          if(body && Array.isArray(body.messages)){
            var msgs = body.messages;
            // 检查是否已注入
            for(var j=0;j<msgs.length;j++){
              var mc = msgs[j];
              var mcText = (mc && typeof mc.content === 'string') ? mc.content
                : (mc && Array.isArray(mc.content)) ? mc.content.map(function(p){ return p.text||''; }).join('') : '';
              if(mcText.indexOf(marker) >= 0) return null;
            }
            // 找插入位置：从末尾数 injDepth 条非system消息
            var insertAt = -1;
            var nonSysCount = 0;
            for(var k=msgs.length-1;k>=0;k--){
              var r = msgs[k] && msgs[k].role;
              if(r === 'system') continue; // 跳过system消息
              nonSysCount++;
              if(nonSysCount === injDepth){
                insertAt = k; break;
              }
            }
            // 如果深度超出范围，插到第一条非system消息之前
            if(insertAt < 0){
              for(var k2=0;k2<msgs.length;k2++){
                if(msgs[k2] && msgs[k2].role !== 'system'){ insertAt = k2; break; }
              }
            }
            // 最后兜底：插到末尾之前
            if(insertAt < 0) insertAt = Math.max(0, msgs.length - 1);

            var sysMsg = { role:'system', content: String(pack) };
            msgs.splice(insertAt, 0, sysMsg);
            void(0)&&console.log('[MEOW][Pack] ✅ fetch拦截注入成功(messages格式):', pack.length, 'chars → idx', insertAt, '/ 深度', injDepth, '(win:', i, ')');
            return body;
          }

          // === 格式B: Gemini原生 {contents:[{role,parts}]} ===
          if(body && Array.isArray(body.contents)){
            var contents = body.contents;
            // 检查是否已注入
            for(var j2=0;j2<contents.length;j2++){
              var parts = contents[j2] && contents[j2].parts;
              if(Array.isArray(parts)){
                for(var p=0;p<parts.length;p++){
                  if(parts[p] && typeof parts[p].text === 'string' && parts[p].text.indexOf(marker) >= 0) return null;
                }
              }
            }
            // 从末尾数injDepth条找插入位置
            var insertAt2 = -1;
            var cnt2 = 0;
            for(var k3=contents.length-1;k3>=0;k3--){
              cnt2++;
              if(cnt2 === injDepth){ insertAt2 = k3; break; }
            }
            if(insertAt2 < 0) insertAt2 = Math.max(0, contents.length - 1);
            // Gemini注入用user role + text part
            var geminiMsg = { role:'user', parts:[{ text: '[记忆参考]\n' + pack }] };
            contents.splice(insertAt2, 0, geminiMsg);
            void(0)&&console.log('[MEOW][Pack] ✅ fetch拦截注入成功(Gemini格式):', pack.length, 'chars → idx', insertAt2, '/ 深度', injDepth, '(win:', i, ')');
            return body;
          }

          console.warn('[MEOW][Pack] 未识别请求格式，无法注入');
          return null;
        }

        w.fetch = function(input, init){
          var url = (typeof input === 'string') ? input
            : (input && typeof input.url === 'string') ? input.url : '';
          
          if(!shouldIntercept(url)){
            return _origFetch.apply(this, arguments);
          }

          // 同步路径：init.body 是 string
          if(init && typeof init.body === 'string'){
            try{
              var bodyObj = JSON.parse(init.body);
              var out = tryInject(bodyObj);
              if(out){
                var newInit = {};
                for(var p in init) newInit[p] = init[p];
                newInit.body = JSON.stringify(out);
                return _origFetch.call(this, input, newInit);
              }
            }catch(e){}
            return _origFetch.apply(this, arguments);
          }

          // 异步路径：input 是 Request
          var self = this;
          var args = arguments;
          return (async function(){
            try{
              if(input && typeof input.clone === 'function' && (!init || init == null || !init.body)){
                var ct = '';
                try{ ct = input.headers.get('content-type')||''; }catch(e){}
                if(/json/i.test(ct)){
                  var txt = await input.clone().text();
                  if(txt){
                    try{
                      var bodyObj2 = JSON.parse(txt);
                      var out2 = tryInject(bodyObj2);
                      if(out2){
                        return _origFetch.call(self, new Request(input, { body: JSON.stringify(out2) }), init);
                      }
                    }catch(e){}
                  }
                }
              }
            }catch(e){}
            return _origFetch.apply(self, args);
          })();
        };

        void(0)&&console.log('[MEOW][Pack] ✅ fetch hook 已挂载 (window #' + i + ')');
      }catch(e){
        console.warn('[MEOW][Pack] fetch hook 失败 (window #' + i + '):', e);
      }
    })(wins[i]);
  }
}
meowHookFetchAll();

// --- 层3: ST 事件系统（GENERATION_STARTED 时刷新 extension prompt）---
function meowHookSTEvents(){
  try{
    var ctx = meowPickSTCtx();
    if(!ctx || !ctx.eventSource || !ctx.event_types){
      console.warn('[MEOW][Pack] ST 事件系统不可用，跳过事件钩子');
      return;
    }
    var et = ctx.event_types;

    // GENERATION_STARTED: 用户点发送后，ST 开始构建提示词之前
    if(et.GENERATION_STARTED){
      window.__meowHandlerGenStarted = function(){
        window.__MEOW_INJECTED_THIS_GEN__ = false;
        window.__MEOW_PARSED_THIS_GEN__ = false;
        void(0)&&console.log('[MEOW][Pack] 事件: GENERATION_STARTED');
        try{ meowRefreshAutoPackPrompt(false); }catch(e){}
      };
      ctx.eventSource.on(et.GENERATION_STARTED, window.__meowHandlerGenStarted);
      void(0)&&console.log('[MEOW][Pack] ✅ 已挂载 GENERATION_STARTED 事件');
    }

    // CHAT_COMPLETION_PROMPT_READY: 提示词组装完毕，最后机会修改
    if(et.CHAT_COMPLETION_PROMPT_READY){
      window.__meowHandlerPromptReady = function(data){
        // 防止同一次生成多次触发重复注入
        if(window.__MEOW_INJECTED_THIS_GEN__) { void(0)&&console.log('[MEOW][Pack] 本次生成已注入，跳过重复'); return; }
        void(0)&&console.log('[MEOW][Pack] 事件: CHAT_COMPLETION_PROMPT_READY');
        // data.chat 是实际的消息数组容器
        var msgArr = null;
        if(data && Array.isArray(data.messages)) msgArr = data.messages;
        else if(data && data.chat && Array.isArray(data.chat.messages)) msgArr = data.chat.messages;
        else if(data && Array.isArray(data.chat)) msgArr = data.chat;
        void(0)&&console.log('[MEOW][Pack] data keys:', data ? Object.keys(data).join(',') : 'null',
          '| chat类型:', data && data.chat ? (Array.isArray(data.chat) ? 'array('+data.chat.length+')' : typeof data.chat+' keys:'+Object.keys(data.chat||{}).slice(0,5).join(',')) : 'null',
          '| msgArr条数:', msgArr ? msgArr.length : 'null');
        var _autoOn = lsGet(LS_AUTO_SEND_PACK, false);
        void(0)&&console.log('[MEOW][Pack] 开关状态:', _autoOn, '| dryRun:', data && data.dryRun);
        if(!_autoOn) { void(0)&&console.log('[MEOW][Pack] 开关未开，跳过'); return; }
        if(data && data.dryRun) { void(0)&&console.log('[MEOW][Pack] dryRun=true，跳过'); return; }
        try{
          if(msgArr){
            var marker = '[MEOW-\u8bb0\u5fc6\u5305]';
            void(0)&&console.log('[MEOW][Pack] msgArr[0]结构:', JSON.stringify(msgArr[0]).slice(0,100));
            // 检查是否已注入（防重复）
            var already = msgArr.some(function(m){
              var txt = m && (typeof m.content === 'string' ? m.content : '');
              return txt.indexOf(marker) >= 0;
            });
            if(!already){
              var pack = buildMeowPack('');
              void(0)&&console.log('[MEOW][Pack] pack长度:', pack ? pack.length : 0, '| already=', already);
              if(pack && String(pack).trim()){
                var injDepth = parseInt(lsGet(LS_INJECT_DEPTH, 1), 10) || 1;
                // 深度=从末尾数第N条（所有消息，不跳过system）
                var insertAt = Math.max(0, msgArr.length - injDepth);
                void(0)&&console.log('[MEOW][Pack] injDepth=', injDepth, '| 总条数=', msgArr.length, '| insertAt=', insertAt);
                // === 收集随聊前置/后置内容 ===
                var inlineOn2  = !!lsGet(LS_INLINE_ON, false);
                var parseOn2   = !!lsGet(LS_INLINE_PARSE, true);
                var beforePmt  = '';
                var afterPmt   = '';
                if(inlineOn2){
                  try{
                    var thinkPmt2 = lsGet(LS_INLINE_PROMPT, '') || MEOW_INLINE_DEFAULT_PROMPT;
                    beforePmt = thinkPmt2;
                  }catch(e2){}
                }
                if(parseOn2){
                  afterPmt = '【表格回写】请在回复正文末尾，输出一个 meow_table JSON 块来同步更新表格（系统会自动解析并折叠，用户不会看到）：\n```meow_table\n{"updates":[{"group":"条目组名","row":0,"data":{"字段名":"值"}}]}\n```';
                }

                // === 合并成一条消息注入：[前置] + [记忆包] + [后置] ===
                var combined = '';
                if(beforePmt) combined += beforePmt + '\n\n';
                combined += String(pack);
                if(afterPmt)  combined += '\n\n' + afterPmt;
                msgArr.splice(insertAt, 0, { role:'system', content: combined });

                // 禁用 setExtensionPrompt 的随聊注入，避免重复
                try{
                  var ctx4 = meowPickSTCtx();
                  if(ctx4 && typeof ctx4.setExtensionPrompt === 'function'){
                    ctx4.setExtensionPrompt('meow_inline_prompt', '', 0, 0, false, 'system');
                  }
                }catch(e3){}

                window.__MEOW_INJECTED_THIS_GEN__ = true;
                void(0)&&console.log('[MEOW][Pack] ✅ PROMPT_READY注入完成(合并): 总长', combined.length, '| idx', insertAt, '/ 深度', injDepth);
                // 验证splice是否影响原data
                if(data.chat === msgArr) void(0)&&console.log('[MEOW][Pack] data.chat是直接引用 ✅');
                else if(data.chat && data.chat.messages === msgArr) void(0)&&console.log('[MEOW][Pack] data.chat.messages是直接引用 ✅');
                else void(0)&&console.log('[MEOW][Pack] ⚠️ msgArr不是data的直接引用，splice可能无效！');
              }
            }
          }
        }catch(e){ console.warn('[MEOW][Pack] PROMPT_READY注入失败:', e); }
      };
      ctx.eventSource.on(et.CHAT_COMPLETION_PROMPT_READY, window.__meowHandlerPromptReady);
      void(0)&&console.log('[MEOW][Pack] ✅ 已挂载 CHAT_COMPLETION_PROMPT_READY 事件');
    }
  }catch(e){
    console.warn('[MEOW][Pack] ST 事件挂载失败:', e);
  }
}
meowHookSTEvents();

// --- 层4: 按钮钩子（点击/回车发送前刷新 extension prompt）---
function ensureAutoSendHook(){
  if(W.__MEOW_AUTO_SEND_HOOKED_V8__) return;
  W.__MEOW_AUTO_SEND_HOOKED_V8__ = true;

  function injectPackIfNeed(){
    if(!lsGet(LS_AUTO_SEND_PACK, false)){
      try{ meowRefreshAutoPackPrompt(true); }catch(e){}
      return false;
    }
    try{ return meowRefreshAutoPackPrompt(false); }catch(e){ return false; }
  }

  function bindSendButton(){
    // 在所有 window 的 document 上找按钮
    var wins = meowAllWindows();
    var found = false;
    for(var i=0;i<wins.length;i++){
      try{
        var d = wins[i].document;
        var btn = d.querySelector('#send_but') || d.querySelector('button[title*="Send"]');
        if(!btn || btn.__MEOW_SEND_V8__) continue;
        btn.__MEOW_SEND_V8__ = true;
        found = true;

        var early = function(){ try{ injectPackIfNeed(); }catch(e){} };
        btn.addEventListener('pointerdown', early, {capture:true, passive:true});
        btn.addEventListener('mousedown', early, {capture:true, passive:true});
        btn.addEventListener('touchstart', early, {capture:true, passive:true});
        btn.addEventListener('click', early, {capture:true, passive:true});
        void(0)&&console.log('[MEOW][Pack] ✅ 发送按钮钩子已绑定 (window #' + i + ')');
      }catch(e){}
    }
    return found;
  }

  function bindEnterSend(){
    var wins = meowAllWindows();
    var found = false;
    for(var i=0;i<wins.length;i++){
      try{
        var d = wins[i].document;
        var ta = d.querySelector('#send_textarea') || d.querySelector('textarea');
        if(!ta || ta.__MEOW_ENTER_V8__) continue;
        ta.__MEOW_ENTER_V8__ = true;
        found = true;
        ta.addEventListener('keydown', function(e){
          if(e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
          try{ injectPackIfNeed(); }catch(err){}
        }, {capture:true, passive:true});
      }catch(e){}
    }
    return found;
  }

  var tries = 0;
  var t = setInterval(function(){
    tries++;
    var okBtn = bindSendButton();
    var okTa = bindEnterSend();
    if((okBtn && okTa) || tries > 80) clearInterval(t);
  }, 300);
}
ensureAutoSendHook();

// ===================== 暴露调试接口到 window =====================
window.__meow = {
  refresh: function(){ meowRefreshAutoPackPrompt(false); },
  clear:   function(){ meowRefreshAutoPackPrompt(true); },
  pack:    function(){ return buildMeowPack(''); },
  inject:  function(){ meowInlineInjectIfNeeded(); },
  ctx:     function(){ return meowPickSTCtx(); },
  status:  function(){
    var ctx = meowPickSTCtx();
    void(0)&&console.log('ST ctx:', ctx ? '✅找到' : '❌找不到');
    if(ctx) void(0)&&console.log('setExtensionPrompt:', typeof ctx.setExtensionPrompt);
    var pack = buildMeowPack('');
    void(0)&&console.log('记忆包长度:', pack ? pack.length : 0);
    void(0)&&console.log('当前注入设置:', JSON.stringify(meowGetInjectSettings()));
  },
  // 自动探测哪个position值能让内容出现在提示词查看器
  findPos: function(){
    var ctx = meowPickSTCtx();
    if(!ctx || typeof ctx.setExtensionPrompt !== 'function'){
      console.error('找不到ctx或setExtensionPrompt');
      return;
    }
    void(0)&&console.log('开始测试各个position值，每次注入后请查看提示词查看器...');
    var testContent = '[MEOW-位置测试] 如果你在提示词查看器看到这条，说明当前position值正确！';
    var depth = parseInt(lsGet(LS_INJECT_DEPTH, 1), 10) || 1;
    // 清除旧的
    try{ ctx.setExtensionPrompt('meow_pos_test', '', 0, 0, false, 'system'); }catch(e){}
    // 测试当前设置
    var pos = parseInt(lsGet(LS_INJECT_POS, 3), 10);
    ctx.setExtensionPrompt('meow_pos_test', testContent, pos, depth, false, 'system');
    void(0)&&console.log('已用position=' + pos + ', depth=' + depth + '注入测试内容，请查看提示词查看器');
    void(0)&&console.log('如果看不到，运行: window.__meow.testPos(2) 或 testPos(1) 或 testPos(0)');
  },
  testPos: function(pos){
    var ctx = meowPickSTCtx();
    if(!ctx) return console.error('找不到ctx');
    var depth = parseInt(lsGet(LS_INJECT_DEPTH, 1), 10) || 1;
    var testContent = '[MEOW-位置测试 pos=' + pos + '] 如果你看到这条，position=' + pos + '是正确值！';
    ctx.setExtensionPrompt('meow_pos_test', testContent, pos, depth, false, 'system');
    void(0)&&console.log('已注入 position=' + pos + ', depth=' + depth + '，请刷新提示词查看器查看');
  },
  setPos: function(pos){
    lsSet(LS_INJECT_POS, pos);
    void(0)&&console.log('已保存 position=' + pos + '，下次注入生效');
    meowRefreshAutoPackPrompt(false);
  }
};
void(0)&&console.log('[MEOW] 调试接口已暴露：window.__meow.status() 查看状态');
void(0)&&console.log('[MEOW] 找不到位置？运行 window.__meow.findPos() 然后查看提示词查看器');

// ===================== V3: 随聊注入钩子 =====================
function meowInlineInjectIfNeeded() {
  var inlineOn = !!lsGet(LS_INLINE_ON, false);
  var parseOn  = !!lsGet(LS_INLINE_PARSE, true);
  var anyOn = inlineOn || parseOn;
  var inj = meowGetInjectSettings();

  if (!anyOn) {
    try {
      var ctx = meowPickSTCtx();
      if (ctx && typeof ctx.setExtensionPrompt === 'function') {
        ctx.setExtensionPrompt('meow_inline_prompt', '', inj.pos, inj.depth, inj.scan, inj.role);
      }
    } catch(e){}
    return false;
  }

  try {
    var parts = [];

    if (inlineOn) {
      var thinkPmt = lsGet(LS_INLINE_PROMPT, '') || MEOW_INLINE_DEFAULT_PROMPT;
      try {
        var tgDb2 = (typeof tgLoad === 'function') ? tgLoad() : lsGet(LS_TABLE_GROUPS, { groups: [] });
        var groups2 = (tgDb2 && tgDb2.groups) ? tgDb2.groups : [];
        var enabledIds2 = (tgDb2 && tgDb2.enabledIds) ? tgDb2.enabledIds : groups2.map(function(g2){ return g2.id; });
        var activeG = groups2.filter(function(g3){ return enabledIds2.indexOf(g3.id) >= 0; });
        if (activeG.length) {
          thinkPmt += '\n\n--- \u5f53\u524d\u542f\u7528\u7684\u8868\u683c\u6761\u76ee\u5b9a\u4e49 ---\n';
          activeG.forEach(function(g4){
            thinkPmt += '\u300a' + (g4.name||g4.id) + '\u300b\u5b57\u6bb5\uff1a' +
              (g4.fields||[]).map(function(f){ return f.key||f.name; }).join('\u3001') + '\n';
          });
        }
        var td2 = (typeof meowTableMetaRead === 'function') ? meowTableMetaRead() : null;
        if (td2 && td2.colPrompts && td2.cols) {
          var hasP = false;
          for (var pk2 in td2.colPrompts){ if (td2.colPrompts[pk2]){ hasP = true; break; } }
          if (hasP) {
            thinkPmt += '\n--- \u5f53\u524d\u8868\u683c\u5217\u5b57\u6bb5\u63d0\u793a ---\n';
            for (var cpi2 = 0; cpi2 < td2.cols.length; cpi2++) {
              var cp2 = td2.colPrompts[cpi2];
              if (cp2) thinkPmt += '\u300c' + (td2.cols[cpi2]||'\u5217'+cpi2) + '\u300d\uff1a' + cp2 + '\n';
            }
          }
        }
      } catch(e2){}
      parts.push(thinkPmt);
    }

    if (parseOn) {
      var parsePmt = '\u3010\u8868\u683c\u56de\u5199\u3011\u8bf7\u5728\u56de\u590d\u6b63\u6587\u672b\u5c3e\uff0c\u8f93\u51fa\u4e00\u4e2a meow_table JSON \u5757\u6765\u540c\u6b65\u66f4\u65b0\u8868\u683c\uff08\u7cfb\u7edf\u4f1a\u81ea\u52a8\u89e3\u6790\u5e76\u6298\u53e0\uff0c\u7528\u6237\u4e0d\u4f1a\u770b\u5230\uff09\uff1a\n```meow_table\n{"updates":[{"group":"\u6761\u76ee\u7ec4\u540d","row":0,"data":{"\u5b57\u6bb5\u540d":"\u5024"}}]}\n```';
      parts.push(parsePmt);
    }

    if (!parts.length) return false;
    var pmt2 = parts.join('\n\n---\n\n');
    var ctx3 = meowPickSTCtx();
    if (!ctx3 || typeof ctx3.setExtensionPrompt !== 'function') return false;
    ctx3.setExtensionPrompt('meow_inline_prompt', pmt2, inj.pos, inj.depth, inj.scan, inj.role);
    void(0)&&console.log('[MEOW][Inline] \u2705 \u968f\u804a\u63d0\u793a\u8bcd\u5df2\u6ce8\u5165(\u53cc\u5f00\u5173\u5408\u5e76), len=' + pmt2.length);
    return true;
  } catch(e) { console.warn('[MEOW][Inline] \u6ce8\u5165\u5931\u8d25:', e); return false; }
}

(function extendSendHookForInline() {
  if (W.__MEOW_INLINE_HOOKED_V1__) return;
  W.__MEOW_INLINE_HOOKED_V1__ = true;

  function bindIS() {
    var wins = meowAllWindows(); var found = false;
    for (var i = 0; i < wins.length; i++) {
      try {
        var d2 = wins[i].document;
        var btn2 = d2.querySelector('#send_but') || d2.querySelector('button[title*="Send"]');
        if (!btn2 || btn2.__MEOW_IL_V1__) continue;
        btn2.__MEOW_IL_V1__ = true; found = true;
        var inj2 = function(){ try { meowInlineInjectIfNeeded(); } catch(e){} };
        btn2.addEventListener('pointerdown', inj2, {capture:true, passive:true});
        btn2.addEventListener('mousedown', inj2, {capture:true, passive:true});
      } catch(e){}
    }
    return found;
  }
  function bindIE() {
    var wins = meowAllWindows(); var found = false;
    for (var i = 0; i < wins.length; i++) {
      try {
        var d2 = wins[i].document;
        var ta2 = d2.querySelector('#send_textarea') || d2.querySelector('textarea');
        if (!ta2 || ta2.__MEOW_ILE_V1__) continue;
        ta2.__MEOW_ILE_V1__ = true; found = true;
        ta2.addEventListener('keydown', function(e2){
          if (e2.key !== 'Enter' || e2.shiftKey || e2.ctrlKey || e2.altKey || e2.metaKey) return;
          try { meowInlineInjectIfNeeded(); } catch(err){}
        }, {capture:true, passive:true});
      } catch(e){}
    }
    return found;
  }
  var tries2 = 0;
  var t2 = setInterval(function(){ tries2++; var a = bindIS(); var b = bindIE(); if ((a && b) || tries2 > 80) clearInterval(t2); }, 350);
})();

// ===================== V3: AI 回复拦截 → 解析 meow_table → 回写 → 折叠 =====================
(function initMeowTableReplyObserver() {
  if (W.__MEOW_TABLE_OBS_V1__) return;
  W.__MEOW_TABLE_OBS_V1__ = true;
  var lastMC = 0;
  var obTimer = null;

  // 云酒馆：消息在 ST iframe 里，需要找正确的 document
  function getMsgDoc() {
    // 尝试所有 iframe，找有 .mes_text 的那个
    try {
      var frames = window.top ? window.top.document.querySelectorAll('iframe') : document.querySelectorAll('iframe');
      for (var fi = 0; fi < frames.length; fi++) {
        try {
          var fd = frames[fi].contentDocument || frames[fi].contentWindow?.document;
          if (fd && fd.querySelector('.mes_text')) return fd;
        } catch(e){}
      }
    } catch(e){}
    // 兜底：用 doc（当前 document）
    return doc;
  }

  function checkNew() {
    if (!lsGet(LS_INLINE_PARSE, true)) return;
    try {
      var msgDoc = getMsgDoc();
      var msgs = msgDoc.querySelectorAll('.mes[is_user="false"] .mes_text, .mes[is_bot="true"] .mes_text');
      // 如果找不到，尝试其他选择器
      if (!msgs || msgs.length === 0) {
        msgs = msgDoc.querySelectorAll('.mes_text');
      }
      void(0)&&console.log('[MEOW][Observer] checkNew: msgs=', msgs ? msgs.length : 0, '| lastMC=', lastMC);
      if (!msgs || msgs.length <= lastMC) { if (msgs) lastMC = msgs.length; return; }
      for (var i = lastMC; i < msgs.length; i++) {
        var el = msgs[i];
        if (el.__meowParsed) continue;
        el.__meowParsed = true;
        var txt = el.textContent || el.innerText || '';
        void(0)&&console.log('[MEOW][Observer] 检查msg', i, '| 含meow_table:', txt.indexOf('meow_table') >= 0, '| 前50字:', txt.slice(0,50));
        if (txt.indexOf('meow_table') < 0) continue;
        var ups = parseMeowTableJSON(txt);
        void(0)&&console.log('[MEOW][Observer] parseMeowTableJSON结果:', ups ? ups.length+'条' : 'null');
        if (ups && ups.length) {
          if (window.__MEOW_PARSED_THIS_GEN__) {
            // GENERATION_ENDED 已处理，DOM只负责折叠显示
            void(0)&&console.log('[MEOW] DOM收到已解析标记，只做折叠');
            break;
          }
          window.__MEOW_PARSED_THIS_GEN__ = true;
          var ok = applyMeowTableUpdates(ups);
          var ok2 = applyMeowTableToWBCards(ups);
          if (ok || ok2) {
            void(0)&&console.log('[MEOW][Inline] ✅ DOM兜底解析回写 ' + ups.length + ' 条');
            toast('📊 已自动更新（' + ups.length + '条）');
            try { if (typeof window.__meowRefreshInlinePreview === 'function') window.__meowRefreshInlinePreview(); } catch(e){}
          }
        }
      }
      lastMC = msgs.length;
      foldMeowTableBlocks();
    } catch(e) { console.warn('[MEOW][Observer] error:', e); }
  }

  // DOM Observer 已禁用，改用 GENERATION_ENDED 事件（避免跨iframe扫描卡顿）
  void(0)&&console.log('[MEOW][Observer] DOM Observer已禁用，使用GENERATION_ENDED事件');

  // GENERATION_ENDED：直接从ST消息数组读最后一条AI回复（最快，不依赖DOM渲染）
  try {
    var ctx5 = meowPickSTCtx();
    if (ctx5 && ctx5.eventSource && ctx5.event_types && ctx5.event_types.GENERATION_ENDED) {
      window.__meowHandlerGenEnded = function(){
        // 先尝试直接从ST上下文读消息
        try {
          var chat = ctx5.chat || (ctx5.getContext && ctx5.getContext().chat);
          if (Array.isArray(chat) && chat.length) {
            for (var ci = chat.length-1; ci >= 0; ci--) {
              var msg = chat[ci];
              if (msg && !msg.is_user && msg.mes) {
                var txt = msg.mes;
                if (txt.indexOf('updates') >= 0) {
                  // 用消息索引持久化去重：按角色聊天ID存已解析的消息下标集合
                  var ups = parseMeowTableJSON(txt);
                  if (ups && ups.length) {
                    var chatKey = (typeof __chatUID !== 'undefined' ? __chatUID : 'default');
                    var parsedLog = lsGet('meow_parsed_msgs_v1', {});
                    parsedLog[chatKey] = parsedLog[chatKey] || [];
                    if (parsedLog[chatKey].indexOf(ci) >= 0) {
                      void(0)&&console.log('[MEOW] 消息idx', ci, '已解析过，跳过');
                      return;
                    }
                    parsedLog[chatKey].push(ci);
                    lsSet('meow_parsed_msgs_v1', parsedLog);
                    window.__MEOW_PARSED_THIS_GEN__ = true;
                    applyMeowTableUpdates(ups);
                    applyMeowTableToWBCards(ups);
                    foldMeowTableBlocks();
                    toast('📊 已自动更新（' + ups.length + '条）');
                    void(0)&&console.log('[MEOW] ✅ GENERATION_ENDED解析成功:', ups.length, '条');
                    return;
                  }
                }
                break;
              }
            }
          }
        } catch(e2){}
        // 兜底：延迟触发DOM检查
        setTimeout(checkNew, 500);
      };
      ctx5.eventSource.on(ctx5.event_types.GENERATION_ENDED, window.__meowHandlerGenEnded);
      // 聊天切换时清理所有监听，防止卡死
      if(ctx5.event_types.CHAT_CHANGED){
        ctx5.eventSource.on(ctx5.event_types.CHAT_CHANGED, function(){
          try{
            if(window.__meowHandlerGenStarted) ctx5.eventSource.removeListener(ctx5.event_types.GENERATION_STARTED, window.__meowHandlerGenStarted);
            if(window.__meowHandlerGenEnded)   ctx5.eventSource.removeListener(ctx5.event_types.GENERATION_ENDED,  window.__meowHandlerGenEnded);
            if(window.__meowHandlerPromptReady) ctx.eventSource.removeListener(et.CHAT_COMPLETION_PROMPT_READY, window.__meowHandlerPromptReady);
            void(0)&&console.log('[MEOW] ✅ 聊天切换，已清理所有事件监听');
          }catch(e){}
        });
      }
      void(0)&&console.log('[MEOW][Observer] ✅ 已挂载 GENERATION_ENDED 事件');
    }
  } catch(e){}
})();



  // ===== 读取存储 =====
  const apiNow    = lsGet(LS_API, { baseUrl:'', apiKey:'', model:'' });
  const promptNow = lsGet(LS_PROMP, '');
  const apiPresets    = lsGet(LS_API_PRESETS, { list: [] });
  const promptPresets = lsGet(LS_PROMPT_PRESETS, { list: [] });
  const autoOn   = !!lsGet(LS_AUTO_ON, true);
  const prog     = tgLoadProgress();

  // ✅ 实时从 DOM 读取最新楼层（不依赖存储，新分支也能显示）
  const _domFloor = meowGetLatestFloorFromDOM();
  if (_domFloor != null && !prog.lastTo) prog.lastTo = _domFloor;
  // 如果存储的 lastTo 比 DOM 的小，也更新（说明有新消息）
  if (_domFloor != null && prog.lastTo && _domFloor > prog.lastTo) prog.lastTo = _domFloor;

  // ✅ 强制确保世界书数据属于当前聊天
  try{ meowForceWBSyncForCurrentChat(); }catch(e){}

  // ===== V3 UI：顶部按钮 + Tab切换 + 后置/随聊 双Tab + 数据管理 =====
  var inlinePromptNow = lsGet(LS_INLINE_PROMPT, '') || MEOW_INLINE_DEFAULT_PROMPT;
  var inlinePromptPresets = lsGet(LS_INLINE_PROMPT_PRESETS, { list: [] });
  var inlineOn    = !!lsGet(LS_INLINE_ON, false);
  var inlineParse = !!lsGet(LS_INLINE_PARSE, true);
  var autoWriteOn = !!lsGet(LS_AUTO_WRITE_ON, false);
  var uploadWbOn  = !!lsGet(LS_UPLOAD_WB_ON, true);
  var _ilpOpts = (inlinePromptPresets.list||[]).map(function(p,i){ return '<option value="'+i+'">'+String(p.name||'未命名').replace(/</g,'&lt;')+'</option>'; }).join('');

  bd.innerHTML = `
    <!-- V3 Tab栏 -->
    <div id="meow_tab_bar" style="display:flex;gap:0;margin:8px 0 12px;background:var(--meow-card,rgba(255,255,255,.56));border:1px solid var(--meow-line,rgba(28,24,18,.12));border-radius:10px;padding:3px;">
      <div class="meow-tab-btn meow-tab-active" data-tab="post" style="flex:1;text-align:center;padding:8px 0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;color:rgba(46,38,30,.85);background:var(--meow-accent,rgba(198,186,164,.85));transition:all .15s;">📝 后置填表</div>
      <div class="meow-tab-btn" data-tab="inline" style="flex:1;text-align:center;padding:8px 0;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;color:var(--meow-sub,rgba(46,38,30,.45));background:transparent;transition:all .15s;">💬 随聊填表</div>
    </div>

    <!-- ========== TAB: 后置填表 ========== -->
    <div id="meow_tab_post" class="meow-tab-content">

      <div class="sec">
        <h3>✏️ 提示词</h3>
        <div class="row" style="margin-bottom:10px;">
          <div style="flex:1;min-width:160px;">
            <label>预设</label>
            <select id="meow_prompt_preset_select">
              <option value="">（选择预设）</option>
              ${(promptPresets.list||[]).map(function(p,i){return '<option value="'+i+'">'+String(p.name||'未命名')+'</option>';}).join('')}
            </select>
          </div>
          <div style="flex:1;min-width:100px;">
            <label>模式</label>
            <select id="meow_mode">
              <option value="big" selected>大总结（事件总结）</option>
              <option value="small">小总结（更概括）</option>
              <option value="table">表格总结（总结词 + 条目组注入）</option>
              <option value="custom">自定义（不改提示词）</option>
            </select>
          </div>
        </div>
        <div class="row" style="gap:6px;margin-bottom:8px;">
          <button class="btn" id="meow_prompt_preset_save" style="font-size:11px;padding:4px 8px;">💾 存</button>
          <button class="btn danger" id="meow_prompt_preset_del" style="font-size:11px;padding:4px 8px;">🗑 删</button>
        </div>
        <label>系统提示词</label>
        <textarea id="meow_prompt_area" placeholder="例如：按 时间-地点-人物-事件-线索-待办 结构总结…">${(promptNow||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
        <div class="row" style="margin-top:8px;">
          <button class="btn primary" id="meow_save_prompt">💾 保存当前总结词</button>
        </div>
      </div>

      <div class="sec">
        <h3>⚙️ 抓取与执行</h3>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div class="meowSwitch"><input id="meow_auto_on" class="sw" type="checkbox"><div class="txt">自动总结</div></div>
          <div class="meowSwitch"><input id="meow_auto_write_on" class="sw" type="checkbox" ${autoWriteOn ? 'checked' : ''}><div class="txt">自动写入</div></div>
        </div>
        <div class="row" style="margin-top:8px;">
          <div style="flex:1;min-width:120px;">
            <label>From（已到: ${prog.lastFrom || '无'}）</label>
            <input id="meow_floor_from" type="number" placeholder="最近N条">
          </div>
          <div style="flex:1;min-width:120px;">
            <label>To（最新: ${prog.lastTo || '无'}）</label>
            <input id="meow_floor_to" type="number" placeholder="最新楼层">
          </div>
        </div>
        <div class="row" style="margin-top:6px;">
          <div style="flex:1;min-width:100px;">
            <label id="meow_lbl_interval">间隔 N</label>
            <input id="meow_interval" type="number" value="20">
          </div>
          <div style="flex:1;min-width:100px;">
            <label id="meow_lbl_offset">偏移 X</label>
            <input id="meow_offset" type="number" value="10">
          </div>
          <div style="flex:1;min-width:100px;">
            <label>跳过末尾</label>
            <input id="meow_skip_last" type="number" value="0" placeholder="0">
          </div>
        </div>
        <div class="row" style="margin-top:6px;">
          <div style="flex:1;min-width:120px;">
            <label>上传目标</label>
            <select id="meow_upload_target">
              <option value="st_role" selected>角色世界书</option>
              <option value="st_wb">指定世界书</option>
              <option value="wb_local">本地世界书</option>
            </select>
          </div>
          <div style="flex:1;min-width:120px;">
            <label>&nbsp;</label>
            <button class="btn primary" id="meow_run_auto" style="width:100%;">⚙️ 执行总结</button>
          </div>
        </div>
        <div class="hint" id="meow_run_hint" style="margin-top:6px;">
          已总结：${prog.lastFrom && prog.lastTo ? '第'+prog.lastFrom+'~'+prog.lastTo+'楼（共'+(prog.lastTo-prog.lastFrom+1)+'条）' : '暂无'} ｜ 最近N：${prog.lastN || 30}
        </div>
      </div>

    </div><!-- end #meow_tab_post -->

    <!-- ========== TAB: 随聊填表 ========== -->
    <div id="meow_tab_inline" class="meow-tab-content" style="display:none;">

      <div class="sec">
        <h3>💬 随聊提示词</h3>
        <div class="row" style="margin-bottom:8px;gap:6px;align-items:flex-end;">
          <div style="flex:1;">
            <label>预设</label>
            <select id="meow_inline_prompt_preset_select">
              <option value="">（选择预设）</option>
              ${_ilpOpts}
            </select>
          </div>
          <button class="btn" id="meow_inline_prompt_preset_save" style="font-size:11px;padding:4px 8px;">💾 存</button>
          <button class="btn danger" id="meow_inline_prompt_preset_del" style="font-size:11px;padding:4px 8px;">🗑 删</button>
        </div>
        <label>随聊注入提示词</label>
        <textarea id="meow_inline_prompt_area" placeholder="请在回复正文后，输出 meow_table JSON 块更新表格…" style="min-height:60px;">${(inlinePromptNow||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
        <button class="btn primary" id="meow_save_inline_prompt" style="margin-top:8px;">💾 保存随聊提示词</button>
        <div style="margin-top:8px;padding:7px 10px;border-radius:8px;background:rgba(198,186,164,.12);font-size:11px;color:var(--meow-sub,rgba(46,38,30,.55));line-height:1.5;">
          💡 此提示词会注入正文前，AI 回复时同步更新表格并以 meow_table 输出。
        </div>
      </div>


      <div class="sec">
        <h3>🔌 随聊开关</h3>
        <div class="meowSwitch">
          <input id="meow_inline_on" class="sw" type="checkbox" ${inlineOn ? 'checked' : ''}>
          <div class="txt">启用随聊注入</div>
        </div>
        <div class="hint" style="margin-top:4px;margin-bottom:10px;">开启后：每次发送时注入"先构思角色/物件/故事→再写正文"提示词，AI 边写正文边填表，而不是写完再调表。</div>
        <div class="meowSwitch">
          <input id="meow_inline_parse" class="sw" type="checkbox" ${inlineParse ? 'checked' : ''}>
          <div class="txt">自动解析回写表格</div>
        </div>
        <div class="hint" style="margin-top:4px;">开启后：注入"回复末尾输出固定 meow_table JSON 格式"提示词，系统自动解析并回写表格（AI 返回可解析 JSON），结果从正文折叠隐藏。</div>
        <div style="margin-top:8px;padding:7px 10px;border-radius:8px;background:rgba(198,186,164,.1);font-size:11px;color:var(--meow-sub,rgba(46,38,30,.55));line-height:1.6;">
          💡 两个开关的提示词合并后以<b>「注入详细设置」</b>里配置的位置/深度注入，与记忆包注入机制一致。<br>
          可同时开启：先构思（随聊注入）→ 写正文 → 输出 JSON（自动解析回写）。
        </div>
      </div>


    </div><!-- end #meow_tab_inline -->

    <!-- ========== 输出与写入 ========== -->
    <div class="sec">
      <h3>📄 输出与写入</h3>
      <textarea id="meow_out" placeholder="这里显示总结结果..." style="min-height:140px;"></textarea>
      <div class="row" style="margin-top:10px;">
        <button class="btn" id="meow_copy_out">📋 复制结果</button>
        <button class="btn" id="meow_view_wb">📚 查看本地世界书</button>
        <button class="btn" id="meow_upload_out">⬆ 上传到酒馆世界书</button>
        <button class="btn danger" id="meow_clear_out">🧹 清除</button>
      </div>
      <div class="hint" style="margin-top:8px;">"上传到酒馆世界书"走数据层写入（TavernHelper/桥接层）。</div>
      <!-- 记忆包注入开关（独立可见）-->
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--meow-line,rgba(28,24,18,.08));">
        <div class="meowSwitch">
          <input id="meow_auto_send_pack" class="sw" type="checkbox">
          <div class="txt">每次发送自动附加记忆包</div>
        </div>
        <div class="hint" style="margin-top:4px;">开启后：你每次点发送，都会把【仓库摘要】自动带给 AI</div>
        <!-- 注入详细设置（折叠）- 同时控制随聊注入的位置 -->
        <details style="margin-top:8px;">
          <summary style="list-style:none;cursor:pointer;padding:6px 10px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--meow-sub,rgba(46,38,30,.55));background:var(--meow-card,rgba(255,255,255,.56));border:1px solid var(--meow-line,rgba(28,24,18,.08));border-radius:8px;user-select:none;">
            <span style="transition:transform .2s;display:inline-block;" class="meow-pack-arrow">▶</span> 注入详细设置（记忆包 + 随聊注入 共用）
          </summary>
          <div style="padding:8px 4px 0;">
            <div class="row" style="margin-top:6px;">
              <div style="flex:1;min-width:100px;">
                <label>位置</label>
                <select id="meow_inject_pos">
                  <option value="0">0 · 整个提示词最顶部（角色卡之前）</option>
                  <option value="1">1 · 角色卡之后 / 聊天区顶部</option>
                  <option value="2" selected>2 · 聊天消息之间（深度N，★推荐）</option>
                  <option value="3">3 · 静态提示词区内（深度N）</option>
                  <option value="4">4 · 作者注释 上方</option>
                  <option value="5">5 · 作者注释 下方</option>
                </select>
              </div>
              <div style="flex:1;min-width:80px;">
                <label>深度</label>
                <input id="meow_inject_depth" type="number" value="1" min="0">
              </div>
            </div>
            <div class="row" style="margin-top:8px;">
              <div style="flex:1;min-width:100px;">
                <label>角色</label>
                <select id="meow_inject_role">
                  <option value="system" selected>system</option>
                  <option value="user">user</option>
                  <option value="assistant">assistant</option>
                </select>
              </div>
              <div style="flex:1;min-width:80px;">
                <label>扫描</label>
                <select id="meow_inject_scan">
                  <option value="false" selected>关闭</option>
                  <option value="true">开启</option>
                </select>
              </div>
            </div>
            <div class="hint" style="margin-top:6px;">
              ⭐ 推荐：<b>位置2·聊天消息之间</b>，深度=从底部数想插到哪条消息之前（如深度=35）。<br>
              注意："梦境世界已构建完成"等<b>静态系统提示词无法被插入其中</b>——它属于角色卡内容，不是聊天消息。记忆包只能插在真正的对话消息之间。<br>
              对应 setExtensionPrompt(name, value, position, depth, scan, role)
            </div>
          </div>
        </details>
      </div>
    </div>

    <!-- ========== 共享模块 ========== -->
    <div class="sec" id="meow_shared_sec" style="padding:10px 14px 10px;margin-bottom:8px;">
      <div style="font-size:13px;font-weight:700;color:var(--meow-sub,rgba(46,38,30,.55));margin-bottom:10px;display:flex;align-items:center;gap:6px;letter-spacing:.02em;">
        🔧 共享模块
      </div>
      <div style="padding:0;">

      <details class="sec" id="meow_tpl_sec" style="padding:0;margin-bottom:8px;">
        <summary style="list-style:none;cursor:pointer;padding:10px 14px;display:flex;align-items:center;gap:6px;font-weight:700;user-select:none;font-size:13px;">
          <span style="transition:transform .2s;display:inline-block;" class="meow-tpl-arrow">▶</span><span>🧩 模板与表格</span>
        </summary>
        <div style="padding:0 14px 12px;">

        <!-- ===== 当前模板 · 选择表格条目组预设 ===== -->
        <div class="row" style="margin:10px 0 6px;align-items:flex-end;">
          <div style="flex:1;min-width:140px;">
            <label style="font-size:12px;opacity:.7;">当前模板 · 选择表格条目组预设</label>
            <select id="meow_ct_group_select">
              <option value="">（选择模板）</option>
            </select>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="btn" id="meow_ct_init" style="font-size:11px;padding:4px 8px;">🔄 初始化</button>
            <button class="btn" id="meow_ct_preset_save" style="font-size:11px;padding:4px 8px;">💾 存</button>
            <button class="btn danger" id="meow_ct_preset_del" style="font-size:11px;padding:4px 8px;">🗑 删</button>
          </div>
        </div>

        <!-- ===== 表格条目卡片网格 ===== -->
        <div id="meow_ct_card_grid" class="meow-entry-grid"></div>

        <!-- ===== 表格预览 ===== -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 6px;">
          <span style="font-size:13px;font-weight:600;">表格预览</span>
          <div style="display:flex;gap:6px;">
            <button class="btn" id="meow_tg_preview_hdr" style="font-size:11px;padding:3px 8px;">👁 注入预览</button>
            <button class="btn" id="meow_ct_add_col" style="font-size:11px;padding:3px 8px;">＋列</button>
          </div>
        </div>

        <div id="meow_ct_table_wrap" style="overflow-x:auto;max-height:400px;overflow-y:auto;border:1px solid var(--meow-line,rgba(28,24,18,.12));border-radius:10px;background:var(--meow-card,rgba(255,255,255,.56));">
          <div id="meow_ct_empty" style="padding:24px;text-align:center;color:var(--meow-sub,rgba(46,38,30,.45));font-size:13px;">当前聊天暂无调表数据，请选择条目卡片并点击"初始化"开始。</div>
          <table id="meow_ct_table" style="display:none;width:100%;border-collapse:collapse;font-size:12px;"></table>
        </div>


        <div id="meow_tpl_cards" style="display:none;"></div>

        <!-- ===== 底部规则（注入/新增/修改/删除）===== -->
        <details id="meow_ct_rules_sec" style="margin-top:10px;border:1px solid var(--meow-line,rgba(28,24,18,.12));border-radius:10px;overflow:hidden;">
          <summary style="cursor:pointer;padding:7px 10px;display:flex;align-items:center;gap:6px;background:rgba(198,186,164,.06);user-select:none;list-style:none;font-size:12px;font-weight:600;color:var(--meow-sub,rgba(46,38,30,.62));">
            <span style="transition:transform .2s;display:inline-block;" class="meow-rules-arrow">▶</span> 📏 底部规则（注入/新增/修改/删除）
          </summary>
          <div style="padding:10px 12px;" id="meow_ct_rules_body">
            <div class="meowSwitch" style="margin-bottom:8px;">
              <input id="meow_ct_rule_enabled" class="sw" type="checkbox" checked>
              <div class="txt" style="font-size:12px;">启用注入</div>
            </div>
            <div class="hint" style="margin-bottom:8px;">开启后，本组规则会注入总结总提示词</div>
            <label style="font-size:11px;margin-bottom:4px;">组备注</label>
            <textarea id="meow_ct_rule_note" placeholder="人物卡/关系/状态等" style="min-height:36px;resize:vertical;"></textarea>
            <label style="font-size:11px;margin-top:8px;margin-bottom:4px;">注入</label>
            <textarea id="meow_ct_r_inj" placeholder="把本组[组备注+字段定义+规则]注入总提示词" style="min-height:36px;resize:vertical;"></textarea>
            <label style="font-size:11px;margin-top:8px;margin-bottom:4px;">新增</label>
            <textarea id="meow_ct_r_add" placeholder="当出现新信息：新增行；尽量不重复旧内容" style="min-height:36px;resize:vertical;"></textarea>
            <label style="font-size:11px;margin-top:8px;margin-bottom:4px;">修改</label>
            <textarea id="meow_ct_r_mod" placeholder="当信息变化：更新对应字段；必要时合并/拆分行" style="min-height:36px;resize:vertical;"></textarea>
            <label style="font-size:11px;margin-top:8px;margin-bottom:4px;">删除</label>
            <textarea id="meow_ct_r_del" placeholder="当信息无效：明确标记删除原因" style="min-height:36px;resize:vertical;"></textarea>
            <div class="row" style="margin-top:10px;gap:6px;">
              <button class="btn primary" id="meow_ct_rule_save" style="font-size:11px;">💾 保存规则</button>
            </div>
          </div>
        </details>

        <div class="row" style="margin-top:8px;gap:6px;">
          <button class="btn primary" id="meow_ct_to_wbv">💾 保存</button>
          <button class="btn" id="meow_ct_export">📋 复制</button>
          <button class="btn" id="meow_open_tg" style="font-size:11px;">打开世界书条目管理</button>
          <button class="btn danger" id="meow_ct_clear" style="margin-left:auto;">🗑</button>
        </div>
        <div class="hint" id="meow_ct_status" style="margin-top:6px;"></div>
        </div>
      </details>

    <details class="sec" style="padding:0;margin-bottom:8px;">
      <summary style="list-style:none;cursor:pointer;padding:10px 14px;display:flex;align-items:center;gap:6px;font-weight:700;user-select:none;font-size:13px;">
        <span style="transition:transform .2s;display:inline-block;" class="meow-save-arrow">▶</span><span>💾 保存到目标（本地/酒馆）</span>
      </summary>
      <div style="padding:0 14px 12px;">
        <div class="row">
          <div style="flex:1;min-width:160px;">
            <label>保存目标</label>
            <select id="meow_save_target">
              <option value="wb_local" selected>本地世界书（脚本内仓库）</option>
              <option value="st_wb">酒馆世界书（按世界书名写入）</option>
            </select>
          </div>
          <div style="flex:1;min-width:160px;">
            <label>世界书名（当目标=酒馆世界书时必填）</label>
            <input id="meow_save_book" placeholder="例如：记忆大纲 / 酒馆里真实世界书名">
          </div>
        </div>
        <label style="margin-top:8px;">条目 Key（可多个，用英文逗号隔开）</label>
        <input id="meow_save_keys" placeholder="例如：Summary, Timeline, Clues">
        <div class="row" style="margin-top:10px;">
          <button class="btn primary" id="meow_save_multi">💾 保存到以上目标</button>
        </div>
      </div>
    </details>

    <details class="sec" style="padding:0;margin-bottom:8px;">
      <summary style="list-style:none;cursor:pointer;padding:10px 14px;display:flex;align-items:center;gap:6px;font-weight:700;user-select:none;font-size:13px;">
        <span style="transition:transform .2s;display:inline-block;" class="meow-data-arrow">▶</span><span>💾 数据管理</span>
      </summary>
      <div style="padding:0 14px 12px;">
        <div class="row" style="gap:6px;">
          <button class="btn" id="meow_export_chat">📤 导出当前聊天</button>
          <button class="btn" id="meow_export_all">📤 导出全部预设</button>
        </div>
        <div class="row" style="gap:6px;margin-top:6px;">
          <button class="btn" id="meow_import_data">📥 导入 (JSON)</button>
          <input type="file" id="meow_import_file" accept=".json" style="display:none;">
        </div>
        <div class="hint" style="margin-top:6px;">包含：API预设 · 提示词预设 · 模板定义 · 表格数据 · 注入配置</div>
      </div>
    </details>

      </div>
    </div>


    <!-- 隐藏的API字段（兼容旧代码fallback） -->
    <input type="hidden" id="meow_api_base" value="${(apiNow.baseUrl||'').replace(/"/g,'&quot;')}">
    <input type="hidden" id="meow_api_key" value="${(apiNow.apiKey||'').replace(/"/g,'&quot;')}">
    <input type="hidden" id="meow_model_input" value="${(apiNow.model||'').replace(/"/g,'&quot;')}">
    <div id="meow_api_state" style="display:none;"></div>
  `;
// ===================== 跟随聊天调表 V3：chat metadata 架构 =====================
// 存储层：SillyTavern chat_metadata['meow.table.v1']
// 本地缓存：localStorage LS_CHAT_TABLE（快速渲染 + 离线保底）
// 世界书：零污染，不写入任何条目
// 注入：发送时从 metadata 拼"记忆包"

const MEOW_META_TABLE_KEY = 'meow.table.v1';
const MEOW_META_SUMMARY_KEY = 'meow.summary.v1';

// ===== 模板定义（与世界书可视化 tab 一一对应） =====
const MEOW_CT_TEMPLATES = {
  tpl_time:  { name:'时空信息', tab:'time',
    cols:['时间','地点','环境','规则'],
    colPrompts:{0:'发生的时间（尽量具体）',1:'发生地点（可分层级）',2:'天气/光照/声音/人群等可观测要素',3:'本回合有效的限制/代价/约束'}
  },
  tpl_role:  { name:'角色详情', tab:'role',
    cols:['角色名','身份','外貌','性格','关系','好感','状态'],
    colPrompts:{0:'角色姓名/称呼',1:'身份/阵营/立场/工作',2:'外观特征（可观测）',3:'该角色的性格特点概述',4:'与{{user}}的关系',5:'对{{user}}的好感',6:'当前角色的状态'}
  },
  tpl_plot:  { name:'故事大纲', tab:'plot',
    cols:['主线','冲突','伏笔','下一步'],
    colPrompts:{0:'主线推进到哪里',1:'当前主要矛盾/对立',2:'新增或被触发的伏笔',3:'下一步最可能发生的节点'}
  },
  tpl_event: { name:'事件详情', tab:'event',
    cols:['事件','参与','结果','线索'],
    colPrompts:{0:'发生了什么（简洁）',1:'参与者/相关者',2:'产生的结果/变化',3:'新线索/证据/暗示'}
  },
  tpl_task:  { name:'任务约定', tab:'task',
    cols:['约定','待办','期限','风险'],
    colPrompts:{0:'双方约定/誓言/规则',1:'待办事项清单',2:'截止/触发条件',3:'违约代价/风险提示'}
  },
  tpl_item:  { name:'道具物品', tab:'item',
    cols:['物品','来源','用途','状态'],
    colPrompts:{0:'物品名称/类别',1:'获取方式/归属',2:'用途/效果（客观）',3:'耐久/次数/缺损'}
  },
  tpl_custom:{ name:'自定义',   tab:'custom',cols:['列1','列2','列3'], colPrompts:{} },
};

// ===== chat metadata 读写层 =====
function meowMetaRead(key){
  try{
    const ctx = meowGetSTCtx();
    if (!ctx) return null;
    // 确保 chat_metadata 存在
    if (!ctx.chat_metadata) ctx.chat_metadata = {};
    const val = ctx.chat_metadata[key];
    return (val && typeof val === 'object') ? val : null;
  }catch(e){ return null; }
}

function meowMetaWrite(key, data){
  try{
    const ctx = meowGetSTCtx();
    if (!ctx) return false;
    if (!ctx.chat_metadata) ctx.chat_metadata = {};
    ctx.chat_metadata[key] = data;
    // 保存到服务端（云酒馆自动跨端同步）
    if (typeof ctx.saveMetadata === 'function') ctx.saveMetadata();
    else if (typeof ctx.saveChatDebounced === 'function') ctx.saveChatDebounced();
    else if (typeof ctx.saveChat === 'function') ctx.saveChat();
    else if (typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
    return true;
  }catch(e){
    console.warn('[MEOW][Meta] write fail:', key, e);
    return false;
  }
}

// 防抖写入（编辑时用）
let __meowMetaWriteTimer = null;
function meowMetaWriteDebounced(key, data, delay){
  if (__meowMetaWriteTimer) clearTimeout(__meowMetaWriteTimer);
  // 立即写入内存中的 chat_metadata（不等防抖），只延迟持久化
  try{
    const ctx = meowGetSTCtx();
    if (ctx){
      if (!ctx.chat_metadata) ctx.chat_metadata = {};
      ctx.chat_metadata[key] = data;
    }
  }catch(e){}
  __meowMetaWriteTimer = setTimeout(()=>{
    meowMetaWrite(key, data);
  }, delay || 600);
}

// ===== 1) meowGetCurrentChatUID =====
function meowGetCurrentChatUID(){
  return meowGetChatUID();
}

// ===== 2) meowTableMetaRead() — 从 chat_metadata 读调表 =====
function meowTableMetaRead(){
  const data = meowMetaRead(MEOW_META_TABLE_KEY);
  if (!data || !data.cols || !data.cols.length) return null;
  if (data.cleared) return null;
  return data;
}

// ===== 3) meowTableMetaWrite(data) — 写调表到 chat_metadata =====
function meowTableMetaWrite(data, debounce){
  if (debounce){
    meowMetaWriteDebounced(MEOW_META_TABLE_KEY, data, 600);
  } else {
    meowMetaWrite(MEOW_META_TABLE_KEY, data);
  }
  // 同步写本地缓存（离线保底 + 快速渲染）
  const uid = meowGetCurrentChatUID();
  if (uid) meowTableLocalSave(uid, data);
}

// ===== 4) meowTableLocalLoad(chat_uid) — 本地缓存读 =====
function meowTableLocalLoad(chat_uid){
  try{
    if (!chat_uid) return null;
    const db = lsGet(LS_CHAT_TABLE, { map:{} });
    return db.map?.[chat_uid] || null;
  }catch(e){ return null; }
}

// ===== 5) meowTableLocalSave(chat_uid, data) — 本地缓存写 =====
function meowTableLocalSave(chat_uid, data){
  try{
    if (!chat_uid) return;
    const db = lsGet(LS_CHAT_TABLE, { map:{} });
    db.map ||= {};
    db.map[chat_uid] = { ...data, updated_at: Date.now(), chat_uid };
    const entries = Object.entries(db.map);
    if (entries.length > 200){
      entries.sort((a,b)=>(a[1]?.updated_at||0)-(b[1]?.updated_at||0));
      db.map = Object.fromEntries(entries.slice(-200));
    }
    lsSet(LS_CHAT_TABLE, db);
  }catch(e){}
}

// ===== 6) meowTableSyncCurrent(reason) =====
// 优先 metadata → 本地缓存兜底 → 都没有就是空
function meowTableSyncCurrent(reason){
  const uid = meowGetCurrentChatUID();
  if (!uid || uid.startsWith('fallback:')) return null;
  void(0)&&console.log('[MEOW][CT] sync:', reason, uid.slice(0,25));

  // A) 从 metadata 读
  let meta = meowTableMetaRead();

  // B) 从本地缓存读
  let local = meowTableLocalLoad(uid);

  // C) 合并：metadata 优先（因为它跟着 chatId 走，天然隔离）
  if (meta){
    // metadata 有数据 → 更新本地缓存
    meowTableLocalSave(uid, meta);
    return meta;
  }
  if (local){
    // metadata 没有但本地有（可能是旧数据迁移过来的）→ 写入 metadata
    meowTableMetaWrite(local, false);
    return local;
  }
  return null; // 空白
}

// ===================== V4: 多条目表格管理层 =====================
const MEOW_META_MULTI_KEY = 'meow.tables.v2';
const MEOW_DEFAULT_ENTRIES = [
  { id:'role',  name:'角色详情', icon:'👤' },
  { id:'time',  name:'时空信息', icon:'🌍' },
  { id:'plot',  name:'故事大纲', icon:'📖' },
  { id:'event', name:'事件详情', icon:'📌' },
  { id:'item',  name:'道具物品', icon:'🎒' },
  { id:'task',  name:'任务约定', icon:'📋' },
];
// 读多条目集合
function meowMultiTableRead(){
  try{
    const raw = meowMetaRead(MEOW_META_MULTI_KEY);
    if (raw && raw.entries && typeof raw.entries === 'object') return raw;
    // 迁移：如果没有 v2 但有 v1 单表数据
    const oldSingle = meowTableMetaRead();
    if (oldSingle && oldSingle.cols){
      const entryId = oldSingle.template_id
        ? (MEOW_CT_TEMPLATES[oldSingle.template_id]?.tab || 'role')
        : 'role';
      const multi = { activeEntry: entryId, entries:{}, customEntries:[] };
      multi.entries[entryId] = oldSingle;
      meowMetaWrite(MEOW_META_MULTI_KEY, multi);
      return multi;
    }
    return null;
  }catch(e){ return null; }
}
// 写多条目集合
function meowMultiTableWrite(multi){
  try{ meowMetaWriteDebounced(MEOW_META_MULTI_KEY, multi, 600); }catch(e){}
}
// 获取当前活跃条目的数据
function meowMultiGetActive(multi){
  if (!multi) return null;
  const id = multi.activeEntry || 'role';
  return multi.entries?.[id] || null;
}
// 保存当前活跃条目的数据
function meowMultiSetActive(multi, data){
  if (!multi) return;
  const id = multi.activeEntry || 'role';
  if (!multi.entries) multi.entries = {};
  multi.entries[id] = data;
}
// 切换活跃条目
function meowMultiSwitch(multi, newEntryId){
  if (!multi) return;
  multi.activeEntry = newEntryId;
  // 同步到单表接口（兼容）
  const data = multi.entries?.[newEntryId] || null;
  if (data && data.cols){
    meowTableMetaWrite(data, false);
  }
}
// 获取全部条目列表（默认+自定义）
function meowMultiGetEntryList(multi){
  const list = MEOW_DEFAULT_ENTRIES.map(e=>({...e}));
  if (multi && Array.isArray(multi.customEntries)){
    multi.customEntries.forEach(c => list.push({...c}));
  }
  return list;
}
// 添加自定义条目
function meowMultiAddCustomEntry(multi, name, icon){
  if (!multi) return null;
  if (!multi.customEntries) multi.customEntries = [];
  const id = 'custom_' + Date.now();
  multi.customEntries.push({ id, name: name||'自定义', icon: icon||'📌' });
  return id;
}

// ===== 渲染 =====

// ===================== V3: 单元格编辑弹窗 =====================
function meowCTCellPopup(opts) {
  // opts: { title, fields: [{label, key, value, type:'input'|'textarea'}], onConfirm(values), onDelete?(), anchorEl? }

  // ★ 防重复：关闭已有弹窗
  var oldOverlay = doc.querySelector('.meow-cell-popup-overlay');
  if (oldOverlay) oldOverlay.remove();

  var overlay = doc.createElement('div');
  overlay.className = 'meow-cell-popup-overlay';
  var popup = doc.createElement('div');
  popup.className = 'meow-cell-popup';

  var h = '<div style="font-size:14px;font-weight:800;margin-bottom:14px;color:var(--meow-text,rgba(46,38,30,.82));display:flex;align-items:center;gap:6px;"><span style="font-size:16px;">✏️</span> ' + (opts.title||'编辑') + '</div>';
  var fields = opts.fields || [];
  for (var fi = 0; fi < fields.length; fi++) {
    var f = fields[fi];
    h += '<label>' + (f.label||'') + '</label>';
    if (f.type === 'textarea') {
      h += '<textarea data-popup-key="' + (f.key||fi) + '">' + String(f.value||'').replace(/</g,'&lt;') + '</textarea>';
    } else {
      h += '<input data-popup-key="' + (f.key||fi) + '" value="' + String(f.value||'').replace(/"/g,'&quot;') + '">';
    }
  }
  h += '<div class="meow-popup-btns">';
  if (typeof opts.onDelete === 'function') {
    h += '<button class="danger" data-popup-act="delete">删除</button>';
  }
  h += '<button data-popup-act="cancel">取消</button>';
  h += '<button class="primary" data-popup-act="confirm">确定</button>';
  h += '</div>';
  popup.innerHTML = h;
  overlay.appendChild(popup);

  // ★ 插入到模态窗口内部（backdrop-filter 创建层叠上下文，必须在内部才可见）
  var modalHost = doc.getElementById('meow-summary-modal') || doc.getElementById('meow-diary-modal') || doc.body;

  // ★ 关键：overlay 用 absolute 覆盖整个滚动内容区，不是 fixed 覆盖可视区
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = 'auto';
  overlay.style.height = Math.max(modalHost.scrollHeight, modalHost.clientHeight) + 'px';

  modalHost.appendChild(overlay);

  // ★ 弹窗定位：计算锚点在 modal 滚动内容中的绝对位置
  if (opts.anchorEl) {
    overlay.style.display = 'block'; // 不用 flex 居中
    try {
      // 计算 anchorEl 相对于 modalHost 的偏移
      var anchorTop = 0, anchorLeft = 0;
      var el = opts.anchorEl;
      while (el && el !== modalHost) {
        anchorTop += el.offsetTop || 0;
        anchorLeft += el.offsetLeft || 0;
        el = el.offsetParent;
      }
      var anchorH = opts.anchorEl.offsetHeight || 20;
      var popW = popup.offsetWidth || 300;
      var modalW = modalHost.clientWidth || 400;

      // 弹窗放在锚点正下方
      var top = anchorTop + anchorH + 8;
      var left = Math.max(8, Math.min(anchorLeft, modalW - popW - 16));

      popup.style.position = 'absolute';
      popup.style.top = top + 'px';
      popup.style.left = left + 'px';
      popup.style.margin = '0';
    } catch(e){}
  } else {
    // 无锚点：在当前滚动位置居中
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'flex-start';
    overlay.style.justifyContent = 'center';
    overlay.style.paddingTop = (modalHost.scrollTop + Math.round(modalHost.clientHeight * 0.15)) + 'px';
  }

  // Focus first input
  setTimeout(function(){
    var first = popup.querySelector('input,textarea');
    if (first) {
      // 保存所有父级滚动位置，防止 focus 导致跳动
      var scrollers = [];
      try {
        var p = popup.parentElement;
        while (p) {
          if (p.scrollTop > 0 || p.scrollLeft > 0) {
            scrollers.push({ el: p, top: p.scrollTop, left: p.scrollLeft });
          }
          p = p.parentElement;
        }
      } catch(e){}
      first.focus({ preventScroll: true });
      // 还原滚动位置（兜底：某些浏览器不支持 preventScroll）
      try {
        for (var si = 0; si < scrollers.length; si++) {
          scrollers[si].el.scrollTop = scrollers[si].top;
          scrollers[si].el.scrollLeft = scrollers[si].left;
        }
      } catch(e){}
    }
  }, 50);

  overlay.addEventListener('click', function(e) {
    var act = e.target.getAttribute('data-popup-act');
    if (act === 'cancel' || e.target === overlay) {
      overlay.remove();
      return;
    }
    if (act === 'confirm') {
      var vals = {};
      var inputs = popup.querySelectorAll('[data-popup-key]');
      for (var i = 0; i < inputs.length; i++) {
        vals[inputs[i].getAttribute('data-popup-key')] = inputs[i].value;
      }
      overlay.remove();
      if (typeof opts.onConfirm === 'function') opts.onConfirm(vals);
      return;
    }
    if (act === 'delete') {
      overlay.remove();
      if (typeof opts.onDelete === 'function') opts.onDelete();
      return;
    }
  });

  // Enter in single input = confirm
  popup.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { overlay.remove(); return; }
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      popup.querySelector('[data-popup-act="confirm"]').click();
    }
  });
}


// ★ 自动从框架规则 fields 填充空的 colPrompts（确保表头提示词与注入预览一致）
function _autoFillColPrompts(data){
  if (!data || !data.cols) return;
  if (!data.colPrompts) data.colPrompts = {};
  // 检查是否所有 colPrompts 都已有值
  var allFilled = true;
  for (var i = 0; i < data.cols.length; i++){
    if (!data.colPrompts[i]) { allFilled = false; break; }
  }
  if (allFilled) return; // 全部已填，不需要补
  try {
    var entryId = data.template_id || '';
    // template_id 可能是 tpl_role → 提取 role
    var idMap = { tpl_role:'role', tpl_time:'time', tpl_plot:'plot', tpl_event:'event', tpl_item:'item', tpl_task:'task' };
    if (idMap[entryId]) entryId = idMap[entryId];
    if (!entryId) {
      try { var m = typeof getMulti === 'function' ? getMulti() : null; if (m) entryId = m.activeEntry || ''; } catch(e2){}
    }
    // ★ 直接从 MEOW_CT_TEMPLATES 读取 colPrompts
    var tplMap2 = { role:'tpl_role', time:'tpl_time', plot:'tpl_plot', event:'tpl_event', item:'tpl_item', task:'tpl_task' };
    var tplKey = tplMap2[entryId];
    var tplCP = (tplKey && MEOW_CT_TEMPLATES[tplKey]) ? MEOW_CT_TEMPLATES[tplKey].colPrompts : null;
    if (tplCP) {
      var dirty = false;
      for (var ci = 0; ci < data.cols.length; ci++){
        if (!data.colPrompts[ci] && tplCP[ci]){
          data.colPrompts[ci] = tplCP[ci];
          dirty = true;
        }
      }
      if (dirty){
        data.rev = (data.rev||0) + 1;
        data.updated_at = Date.now();
        try { meowTableMetaWrite(data, true); } catch(e3){}
      }
    }
  } catch(e){}
}

function meowCTRender(tableEl, emptyEl, data){
  if (!data || !data.cols || !data.cols.length){
    if (tableEl) tableEl.style.display = 'none';
    if (emptyEl){ emptyEl.style.display = ''; emptyEl.textContent = '当前聊天暂无调表数据，请选择条目卡片并点击"初始化"开始。'; }
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (!tableEl) return;
  _autoFillColPrompts(data); // ★ 自动补全空的字段提示词
  tableEl.style.display = '';

  var esc = function(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var html = '<thead><tr>';
  for (var ci = 0; ci < data.cols.length; ci++) {
    var colPrompt = (data.colPrompts && data.colPrompts[ci]) ? data.colPrompts[ci] : '';
    var tip = colPrompt ? ' title="' + esc(colPrompt) + '"' : '';
    html += '<th data-ct-hcol="' + ci + '"' + tip + ' style="padding:6px 8px;border:1px solid var(--meow-line,rgba(28,24,18,.08));background:var(--meow-accent-soft,rgba(198,186,164,.15));font-weight:700;min-width:80px;font-size:11px;user-select:none;color:var(--meow-text,rgba(46,38,30,.7));cursor:pointer;">' + esc(data.cols[ci]) + '</th>';
  }
  html += '<th style="padding:4px 6px;border:1px solid var(--meow-line,rgba(28,24,18,.08));width:24px;background:var(--meow-accent-soft,rgba(198,186,164,.08));font-size:10px;color:var(--meow-sub,rgba(46,38,30,.3));text-align:center;cursor:pointer;" class="meow-cell-click" data-ct-addcol="1" title="添加列">＋</th>';
  html += '</tr></thead><tbody>';
  for (var ri = 0; ri < (data.rows||[]).length; ri++) {
    html += '<tr>';
    var row = data.rows[ri];
    for (var rci = 0; rci < (data.cols||[]).length; rci++) {
      var val = (row && row[rci]) ? row[rci] : '';
      var display = esc(val);
      if (!display) display = '<span style="opacity:.25;font-style:italic;font-size:10px;">—</span>';
      html += '<td style="padding:5px 8px;border:1px solid var(--meow-line,rgba(28,24,18,.06));font-size:12px;line-height:1.5;vertical-align:top;color:var(--meow-text,rgba(46,38,30,.75));">' + display + '</td>';
    }
    html += '<td style="padding:4px;border:1px solid var(--meow-line,rgba(28,24,18,.06));text-align:center;"><span title="删行" data-ct-delrow="' + ri + '" style="cursor:pointer;opacity:.3;font-size:10px;color:rgba(200,60,60,.6);">✕</span></td>';
    html += '</tr>';
  }
  // 添加行按钮行
  html += '<tr><td colspan="' + (data.cols.length + 1) + '" style="padding:6px;text-align:center;border:1px solid var(--meow-line,rgba(28,24,18,.04));cursor:pointer;color:var(--meow-accent,rgba(139,115,85,.75));font-size:11px;font-weight:600;" class="meow-cell-click" data-ct-preview-row="1">👁 注入预览</td></tr>';
  html += '</tbody>';
  tableEl.innerHTML = html;
}

// 表格 → 纯文本（TSV）
function meowCTToText(data){
  if (!data || !data.cols) return '';
  let out = data.cols.join('\t') + '\n';
  (data.rows||[]).forEach(row=>{
    out += (data.cols||[]).map((_,ci)=> (row[ci]||'')).join('\t') + '\n';
  });
  return out.trim();
}

// 表格 → 写入世界书可视化（仅 UI 联动显示，不写入酒馆世界书）
function meowCTWriteToWBV(data){
  try{
    if (!data || !data.cols || !data.template_id) return false;
    const tpl = MEOW_CT_TEMPLATES[data.template_id];
    if (!tpl || !tpl.tab) return false;
    const tabId = tpl.tab;

    const db = lsGet(LS_WB, null);
    if (!db || db.v !== 4) return false;

    // 清除该 tab 下的旧卡片
    db.cards = (db.cards || []).filter(c => c.tab !== tabId);

    // 每行一张卡片
    (data.rows||[]).forEach((row, ri)=>{
      const title = row[0] || `行${ri+1}`;
      const parts = [];
      (data.cols||[]).forEach((col, ci)=>{
        if (row[ci]) parts.push(`${col}: ${row[ci]}`);
      });
      db.cards.push({
        id: 'ct_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16),
        tab: tabId,
        title: title,
        key: data.cols[0] || '',
        text: parts.join('\n'),
        template: '', note: '', page: 'a', order: ri
      });
    });

    lsSet(LS_WB, db);
    try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
    return true;
  }catch(e){ return false; }
}

// ===================== V3 Phase1：数据层新增函数 =====================

// ===== V3: 随聊填表默认提示词 =====
var MEOW_INLINE_DEFAULT_PROMPT = '你在回复正文之前，先在内心构思：\n' +
  '1. 当前场景中有哪些角色？他们是什么样的？\n' +
  '2. 场景中有什么物件、道具？\n' +
  '3. 故事发展到什么阶段？有什么伏笔和冲突？\n\n' +
  '基于以上思考，在回复正文后，输出一个 meow_table JSON 块来更新表格：\n' +
  '```meow_table\n' +
  '{\n' +
  '  "updates": [\n' +
  '    { "group": "角色详情", "row": 0, "data": {"角色名":"xxx","外貌":"xxx","性格":"xxx","关系":"xxx","状态":"xxx"} },\n' +
  '    { "group": "时空信息", "row": 0, "data": {"时间":"xxx","地点":"xxx","环境":"xxx"} }\n' +
  '  ]\n' +
  '}\n' +
  '```\n' +
  '注意：JSON 块会被系统自动解析并折叠，用户不会看到。';

// ===== V3: 解析 AI 回复中的 meow_table JSON 块 =====
function parseMeowTableJSON(aiReply) {
  if (!aiReply || typeof aiReply !== 'string') return null;
  var results = [];

  // 方式1：标准 ```meow_table 代码块
  var regex = /```meow_table\s*\n([\s\S]*?)\n```/g;
  var matches = [];
  var m;
  while ((m = regex.exec(aiReply)) !== null) matches.push(m);
  for (var i = 0; i < matches.length; i++) {
    try {
      var obj = JSON.parse(matches[i][1]);
      if (obj && Array.isArray(obj.updates)) {
        for (var j = 0; j < obj.updates.length; j++) results.push(obj.updates[j]);
      }
    } catch(e) { console.warn('[MEOW] meow_table JSON parse failed:', e); }
  }
  // 方式2：裸 JSON（AI没按格式输出但内容正确）
  if (!results.length) {
    try {
      var jsonRe = /\{\s*"updates"\s*:\s*\[/;
      var jStart = aiReply.search(jsonRe);
      if (jStart >= 0) {
        var depth = 0, jEnd = -1;
        for (var ci = jStart; ci < aiReply.length; ci++) {
          if (aiReply[ci] === '{') depth++;
          else if (aiReply[ci] === '}') { depth--; if (depth === 0) { jEnd = ci + 1; break; } }
        }
        if (jEnd > jStart) {
          var rawObj = JSON.parse(aiReply.slice(jStart, jEnd));
          if (rawObj && Array.isArray(rawObj.updates)) {
            void(0)&&console.log('[MEOW] 裸JSON解析成功:', rawObj.updates.length, '条');
            for (var ri = 0; ri < rawObj.updates.length; ri++) results.push(rawObj.updates[ri]);
          }
        }
      }
    } catch(e2) { void(0)&&console.log('[MEOW] 裸JSON解析失败:', e2.message); }
  }
  return results.length ? results : null;
}

// ===== V3: 将解析出的 updates 写入表格数据 =====
function applyMeowTableUpdates(updates) {
  if (!Array.isArray(updates) || !updates.length) return false;
  var data = meowTableMetaRead() || { cols: [], rows: [], name: '' };
  var changed = false;
  for (var ui = 0; ui < updates.length; ui++) {
    var u = updates[ui];
    if (!u || !u.data || typeof u.data !== 'object') continue;
    var action = u.action || 'upsert';
    var targetCols = data.cols || [];
    var dataKeys = Object.keys(u.data);
    if (!targetCols.length && dataKeys.length) {
      data.cols = dataKeys;
      targetCols = data.cols;
      data.rows = data.rows || [];
    }
    if (action === 'delete') {
      if (u.match && data.rows) {
        var mk = Object.keys(u.match)[0];
        var mv = u.match[mk];
        if (mk === 'row' && typeof mv === 'number') {
          if (data.rows[mv]) { data.rows.splice(mv, 1); changed = true; }
        } else {
          var dci = targetCols.indexOf(mk);
          if (dci >= 0) {
            var dri = -1;
            for (var di = 0; di < data.rows.length; di++) {
              if (String(data.rows[di][dci] || '').trim() === String(mv).trim()) { dri = di; break; }
            }
            if (dri >= 0) { data.rows.splice(dri, 1); changed = true; }
          }
        }
      }
      continue;
    }
    data.rows = data.rows || [];
    var rowIdx = -1;
    if (u.match) {
      var matchKey = Object.keys(u.match)[0];
      var matchVal = u.match[matchKey];
      if (matchKey === 'row' && typeof matchVal === 'number') {
        rowIdx = matchVal;
      } else {
        var mci = targetCols.indexOf(matchKey);
        if (mci >= 0) {
          for (var mi = 0; mi < data.rows.length; mi++) {
            if (String(data.rows[mi][mci] || '').trim() === String(matchVal).trim()) { rowIdx = mi; break; }
          }
        }
      }
    } else if (typeof u.row === 'number') {
      rowIdx = u.row;
    }
    var newRow = targetCols.map(function(col) {
      return u.data.hasOwnProperty(col) ? String(u.data[col] || '') : '';
    });
    if (rowIdx >= 0 && rowIdx < data.rows.length) {
      targetCols.forEach(function(col, ci2) {
        if (u.data.hasOwnProperty(col) && String(u.data[col] || '').trim()) {
          data.rows[rowIdx][ci2] = String(u.data[col]);
        }
      });
    } else {
      data.rows.push(newRow);
    }
    changed = true;
  }
  if (changed) {
    data.rev = (data.rev || 0) + 1;
    data.updated_at = Date.now();
    meowTableMetaWrite(data, false);
  }
  return changed;
}

// ===== V3: 将 meow_table updates 同步写入WB可视化卡片 =====

// ===== 从 WB 本地数据重新生成 elOut 内容（公共函数，增删改都调）=====
function meowSyncElOutFromWB() {
  try {
    var db = lsGet((typeof LS_WB !== 'undefined') ? LS_WB : 'meow_worldbook_local_v1', null);
    if (!db || !Array.isArray(db.cards)) return;
    var lines = [];
    (db.tabs||[]).forEach(function(t){
      var tcards = db.cards.filter(function(c){ return c.tab===t.id && c.text && c.text.trim(); });
      if(tcards.length){
        lines.push('=== '+t.name+' ===');
        tcards.forEach(function(c){ lines.push(c.text); });
      }
    });
    var newOut = lines.join('\n');
    // 写存储
    try{ lsSet('meow_last_summary_out_v1', newOut); }catch(e){}
    // 直接更新弹窗（如果开着）
    try{ if(typeof window.__meowUpdateElOut === 'function') window.__meowUpdateElOut(newOut); }catch(e){}
    try{ if(typeof window.top?.__meowUpdateElOut === 'function') window.top.__meowUpdateElOut(newOut); }catch(e){}
    // 派发事件兜底
    try{ window.dispatchEvent(new CustomEvent('meow_out_updated', { detail:{ text:newOut } })); }catch(e){}
    try{ window.top?.dispatchEvent(new CustomEvent('meow_out_updated', { detail:{ text:newOut } })); }catch(e){}
  } catch(e) { console.warn('[MEOW] meowSyncElOutFromWB failed:', e); }
}

function applyMeowTableToWBCards(updates) {
  if (!Array.isArray(updates) || !updates.length) return false;

  try {
    var DB_KEY = (typeof LS_WB !== 'undefined') ? LS_WB : 'meow_worldbook_local_v1';
    var db = lsGet(DB_KEY, null);
    void(0)&&console.log('[MEOW] applyToWBCards: db=', db ? 'v'+db.v+' tabs:'+((db.tabs||[]).length)+' cards:'+((db.cards||[]).length) : 'null', '| updates:', updates.length);
    // DB不存在或格式不对时自动初始化
    if (!db || db.v !== 4) {
      db = { v:4, tabs:[], cards:[], _chatUID: (typeof __chatUID !== 'undefined' ? __chatUID : '') };
      void(0)&&console.log('[MEOW] 自动初始化空DB');
    }
    db.cards = db.cards || [];
    var changed = false;

    for (var i = 0; i < updates.length; i++) {
      var u = updates[i];
      if (!u || !u.group || !u.data) continue;
      var groupName = String(u.group);

      // 找匹配的 tab（按名称或ID），找不到就自动新建
      db.tabs = db.tabs || [];
      var tab = db.tabs.find(function(t){ return t.name === groupName || t.id === groupName; });
      if (!tab) {
        var newTabId = 'tab_ai_' + groupName.replace(/[^a-zA-Z0-9一-龥]/g,'_') + '_' + Date.now();
        tab = { id: newTabId, name: groupName, icon: '📝', color: '#8b9cf7' };
        db.tabs.push(tab);
        void(0)&&console.log('[MEOW] 自动新建tab:', groupName);
      }
      var tabId = tab.id;

      // 找该 tab 下 row 对应的卡片，没有就新建
      var rowIdx = typeof u.row === 'number' ? u.row : 0;
      var tabCards = db.cards.filter(function(c){ return c.tab === tabId; });
      tabCards.sort(function(a,b){ return (a.order||0)-(b.order||0); });

      var card = tabCards[rowIdx];
      if (!card) {
        // 新建卡片
        var maxOrder = tabCards.reduce(function(m,c){ return Math.max(m, c.order||0); }, 0);
        card = { id: 'ai_'+Date.now()+'_'+rowIdx, tab: tabId, title: groupName+'（第'+(rowIdx+1)+'行）', key:'', text:'', template:'', note:'', page:'a', order: maxOrder+1 };
        db.cards.push(card);
      }

      // 把 data 字段拼成文字写入 card.text
      var lines = [];
      var keys = Object.keys(u.data);
      for (var k = 0; k < keys.length; k++) {
        var val = u.data[keys[k]];
        if (val !== null && val !== undefined && String(val).trim()) {
          lines.push(keys[k] + '：' + String(val));
        }
      }
      if (lines.length) {
        card.text = lines.join(' | ');
        changed = true;
      }
    }

    if (changed) {
      lsSet(DB_KEY, db);
      // 多种方式触发刷新，覆盖 top/iframe/当前window
      // 派发 CustomEvent，WB弹窗监听后刷新
      try{ window.dispatchEvent(new CustomEvent('meow_wb_updated')); }catch(e){}
      try{ window.top?.dispatchEvent(new CustomEvent('meow_wb_updated')); }catch(e){}
      try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
      try{ window.top?.MEOW_WB_REFRESH?.(); }catch(e){}
      try{ meowSyncElOutFromWB(); }catch(e2){}
      void(0)&&console.log('[MEOW] ✅ WB数据已写入');
    }
    return changed;
  } catch(e) {
    console.warn('[MEOW] applyMeowTableToWBCards failed:', e);
    return false;
  }
}

// ===== V3: 构建随聊注入提示词 =====
function buildInlinePrompt() {
  var base = lsGet(LS_INLINE_PROMPT, '') || MEOW_INLINE_DEFAULT_PROMPT;
  try {
    var tgDb = (typeof tgLoad === 'function') ? tgLoad() : lsGet(LS_TABLE_GROUPS, { groups: [] });
    var groups = (tgDb && tgDb.groups) ? tgDb.groups : [];
    var enabledIds = (tgDb && tgDb.enabledIds) ? tgDb.enabledIds : groups.map(function(g){ return g.id; });
    var activeGroups = groups.filter(function(g){ return enabledIds.indexOf(g.id) >= 0; });
    if (activeGroups.length) {
      base += '\n\n--- 当前启用的表格条目定义 ---\n';
      for (var gi = 0; gi < activeGroups.length; gi++) {
        var g = activeGroups[gi];
        var fieldNames = (g.fields || []).map(function(f){ return f.key || f.name; }).join('、');
        base += '【' + (g.name || g.id) + '】字段：' + fieldNames + '\n';
      }
      base += '\n请在正文后输出 meow_table JSON 块更新以上表格。\n';
      base += '格式：```meow_table\n{"updates":[{"group":"组名","row":行号,"data":{字段:值}}]}\n```\n';
    }
    // V3: 追加当前表格的列提示词
    var tableData = (typeof meowTableMetaRead === 'function') ? meowTableMetaRead() : null;
    if (tableData && tableData.colPrompts && tableData.cols) {
      var hasPrompts = false;
      for (var pk in tableData.colPrompts) { if (tableData.colPrompts[pk]) { hasPrompts = true; break; } }
      if (hasPrompts) {
        base += '\n--- 当前表格列字段提示 ---\n';
        for (var cpi = 0; cpi < tableData.cols.length; cpi++) {
          var cp = tableData.colPrompts[cpi];
          if (cp) base += '「' + (tableData.cols[cpi]||'列'+cpi) + '」：' + cp + '\n';
        }
      }
    }
  } catch(e) { console.warn('[MEOW][Inline] buildInlinePrompt error:', e); }
  return base;
}

// ===== V3: 导出全部预设数据 =====
function exportAllData() {
  var result = {
    _meowExport: 1,
    version: (typeof window !== 'undefined' && window.MEOW_PENCIL_SUITE_VER) || 'unknown',
    exportedAt: Date.now(),
    apiConfig: lsGet(LS_API, {}),
    apiPresets: lsGet(LS_API_PRESETS, { list: [] }),
    promptConfig: lsGet(LS_PROMP, ''),
    promptPresets: lsGet(LS_PROMPT_PRESETS, { list: [] }),
    inlinePromptConfig: lsGet(LS_INLINE_PROMPT, ''),
    inlinePromptPresets: lsGet(LS_INLINE_PROMPT_PRESETS, { list: [] }),
    tableGroups: lsGet(LS_TABLE_GROUPS, {}),
    chatTable: meowTableMetaRead(),
    autoConfig: {
      autoOn: lsGet(LS_AUTO_ON, false),
      autoWriteOn: lsGet(LS_AUTO_WRITE_ON, false),
      autoSendPack: lsGet(LS_AUTO_SEND_PACK, false),
      inlineOn: lsGet(LS_INLINE_ON, false),
      inlineParse: lsGet(LS_INLINE_PARSE, false),
      uploadWbOn: lsGet(LS_UPLOAD_WB_ON, true),
      progress: tgLoadProgress(),
    },
    worldbook: lsGet(LS_WB, null),
  };
  try {
    var blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = 'meow_export_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
    toast('已导出全部预设');
  } catch(e) { toast('导出失败：' + (e.message || e)); }
  return result;
}

// ===== V3: 导出当前聊天数据 =====
function exportCurrentChat() {
  var uid = meowGetChatUID();
  var result = {
    _meowExport: 1, type: 'chat', chatUID: uid, exportedAt: Date.now(),
    table: meowTableMetaRead(), summary: loadLastOut(), progress: tgLoadProgress(uid),
  };
  try {
    var blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = 'meow_chat_' + uid.slice(0,12) + '_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
    toast('已导出当前聊天数据');
  } catch(e) { toast('导出失败：' + (e.message || e)); }
  return result;
}

// ===== V3: 导入数据 =====
function importMeowData(jsonStr) {
  try {
    var d = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    if (!d || !d._meowExport) { toast('无效的导入文件'); return false; }
    var count = 0;
    if (d.apiConfig)        { lsSet(LS_API, d.apiConfig); count++; }
    if (d.apiPresets)       { lsSet(LS_API_PRESETS, d.apiPresets); count++; }
    if (d.promptConfig)     { lsSet(LS_PROMP, d.promptConfig); count++; }
    if (d.promptPresets)    { lsSet(LS_PROMPT_PRESETS, d.promptPresets); count++; }
    if (d.inlinePromptConfig)  { lsSet(LS_INLINE_PROMPT, d.inlinePromptConfig); count++; }
    if (d.inlinePromptPresets) { lsSet(LS_INLINE_PROMPT_PRESETS, d.inlinePromptPresets); count++; }
    if (d.tableGroups)      { lsSet(LS_TABLE_GROUPS, d.tableGroups); count++; }
    if (d.worldbook)        { lsSet(LS_WB, d.worldbook); count++; }
    if (d.autoConfig) {
      if (d.autoConfig.autoOn !== undefined) lsSet(LS_AUTO_ON, d.autoConfig.autoOn);
      if (d.autoConfig.autoWriteOn !== undefined) lsSet(LS_AUTO_WRITE_ON, d.autoConfig.autoWriteOn);
      if (d.autoConfig.autoSendPack !== undefined) lsSet(LS_AUTO_SEND_PACK, d.autoConfig.autoSendPack);
      if (d.autoConfig.inlineOn !== undefined) lsSet(LS_INLINE_ON, d.autoConfig.inlineOn);
      if (d.autoConfig.inlineParse !== undefined) lsSet(LS_INLINE_PARSE, d.autoConfig.inlineParse);
      if (d.autoConfig.uploadWbOn !== undefined) lsSet(LS_UPLOAD_WB_ON, d.autoConfig.uploadWbOn);
      count++;
    }
    if (d.chatTable && d.chatTable.cols) { meowTableMetaWrite(d.chatTable, false); count++; }
    toast('已导入 ' + count + ' 项配置');
    return true;
  } catch(e) { toast('导入失败：' + (e.message || e)); return false; }
}

// ===== V3: 折叠聊天中的 meow_table 代码块 =====
function foldMeowTableBlocks() {
  try {
    // 云酒馆：消息在 iframe 里
    var foldDoc = doc;
    try {
      var frames2 = (window.top || window).document.querySelectorAll('iframe');
      for (var fi2 = 0; fi2 < frames2.length; fi2++) {
        try {
          var fd2 = frames2[fi2].contentDocument || frames2[fi2].contentWindow?.document;
          if (fd2 && fd2.querySelector('.mes_text')) { foldDoc = fd2; break; }
        } catch(e){}
      }
    } catch(e){}
    var codeBlocks = foldDoc.querySelectorAll('.mes .mes_text pre code');
    for (var i = 0; i < codeBlocks.length; i++) {
      var block = codeBlocks[i];
      var pre = block.parentElement;
      if (!pre || pre.__meowFolded) continue;
      var prevSib = pre.previousSibling || pre.previousElementSibling;
      var prevText = prevSib ? (prevSib.textContent || '') : '';
      var blockText = (block.textContent || '').trim();
      if (blockText.charAt(0) === '{' && (prevText.indexOf('meow_table') >= 0 || (block.className && block.className.indexOf('meow_table') >= 0))) {
        pre.__meowFolded = true;
        var wrapper = doc.createElement('details');
        wrapper.style.cssText = 'margin:4px 0;padding:4px 8px;border-radius:8px;background:rgba(120,200,140,0.08);border:1px solid rgba(120,200,140,0.15);';
        wrapper.innerHTML = '<summary style="cursor:pointer;font-size:12px;color:rgba(120,200,140,0.8);font-weight:600;user-select:none;">📊 表格已自动更新（点击展开JSON）</summary>';
        var clone = pre.cloneNode(true);
        wrapper.appendChild(clone);
        pre.replaceWith(wrapper);
      }
    }
  } catch(e) { console.warn('[MEOW] foldMeowTableBlocks error:', e); }
}

// ===================== V3 Phase1 END =====================

// ===================== wbvLayoutHTML (below) =====================
// ===================== WBV2 · 新布局（手机优先单列卡片流） =====================
function wbvLayoutHTML(){
  return `
  <div class="wbvTop">
    <div class="wbvHdr">
      <div class="wbvHdrBtns">
        <button class="wbvIcon" data-act="upload" title="上传同步">⬆</button>
        <button class="wbvIcon" data-act="settings" title="设置">⚙</button>
        <button class="wbvIcon" data-act="close" title="关闭">✕</button>
      </div>
      <div class="wbvTabs" role="tablist">
        <button class="wbvTab isOn" data-tab="time">时空</button>
        <button class="wbvTab" data-tab="role">角色</button>
        <button class="wbvTab" data-tab="outline">大纲</button>
        <button class="wbvTab" data-tab="event">事件</button>
        <button class="wbvTab" data-tab="task">任务</button>
        <button class="wbvTab" data-tab="item">道具</button>
        <button class="wbvTab" data-tab="tpl">表格模板</button>
      </div>
      <div class="wbvSearch">
        <input id="wbv_search" placeholder="搜索：标题 / Key / 正文 / 模板">
      </div>
    </div>
  </div>

  <div class="wbvBody">
    <div class="wbvList" id="wbv_list"></div>
    <div class="wbvEdit" id="wbv_edit" hidden></div>
  </div>

  <div class="wbvBottom">
    <button class="wbvBtm" data-act="beauty" title="美化自定义">✨</button>
    <button class="wbvBtm wbvBtmPlus" data-act="add" title="新增条目">＋</button>
    <button class="wbvBtm" data-act="tpl" title="表格条目模板">▦</button>
  </div>
  `;
}

function wbvBindLayoutEvents(bd, db, rerender){
  // 顶栏三按钮
  bd.querySelector('[data-act="close"]')?.addEventListener('click', ()=> closeOverlays(), {passive:true});
  bd.querySelector('[data-act="settings"]')?.addEventListener('click', ()=>{
    // 复用你现有设置渲染：切到“设置页/设置模式”
    wbvOpenSettings(bd, db, rerender); // 没有就先用你之前 renderSettings 的入口函数名
  }, {passive:false});
  bd.querySelector('[data-act="upload"]')?.addEventListener('click', ()=>{
    wbvUploadSyncWorldBook(db); // 这里挂你的一键同步逻辑
  }, {passive:false});

  // Tab 切换（手机单列：只变“当前模块”并重绘列表）
  bd.querySelectorAll('.wbvTab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      bd.querySelectorAll('.wbvTab').forEach(b=>b.classList.remove('isOn'));
      btn.classList.add('isOn');
      db.ui ||= {}; db.ui.tab = btn.dataset.tab;
      wbvRenderListCards(bd, db);  // 你下一步要实现：按 tab 渲染卡片流
    }, {passive:true});
  });

  // 搜索常驻
  bd.querySelector('#wbv_search')?.addEventListener('input', ()=>{
    db.ui ||= {}; db.ui.q = bd.querySelector('#wbv_search').value || '';
    wbvRenderListCards(bd, db);
  }, {passive:true});

  // 底部三键
  bd.querySelector('[data-act="add"]')?.addEventListener('click', ()=>{
    const id = wbvAddEntry(db);            // 新增普通条目
    db.ui ||= {}; db.ui.editing = id;
    wbvOpenEdit(bd, db, id);              // 新增后进入编辑
  }, {passive:false});

  bd.querySelector('[data-act="tpl"]')?.addEventListener('click', ()=>{
    wbvSwitchToTplTab(bd, db);            // 进入“表格模板(注入提示词/规则)”
  }, {passive:true});

  bd.querySelector('[data-act="beauty"]')?.addEventListener('click', ()=>{
    wbvOpenBeauty(bd, db);                // 进入“自定义CSS/HTML”
  }, {passive:true});
}

  // ===== 工具 =====
  const $ = (sel) => bd.querySelector(sel);
  const on = (sel, evt, fn) => { const el = $(sel); if (el) el.addEventListener(evt, fn, {passive:false}); return el; };

function jumpToWBGroup(groupId){
  closeOverlays();
  openWorldbookModal();
  setTimeout(()=>{
    try{
      const box = doc.getElementById(ID_WB);
      if (!box) return;
      const sel = box.querySelector('#wb_group_sel');
      if (sel){
        sel.value = String(groupId || 'overview');
        sel.dispatchEvent(new Event('change', {bubbles:true}));
      }
      box.querySelector('#wb_list_wrap')?.scrollIntoView({block:'start', behavior:'smooth'});
    }catch(e){}
  }, 220);
}

function renderWBTemplateCards(){
  const wrap = $('#meow_tpl_cards');
  if (!wrap) return;

  // 清空，避免残留
  wrap.innerHTML = '';

  // ✅ 从 WBV4（openWorldBookModal 用的同一个 LS_WB）读取 tabs
  let db = null;
  try{
    db = (typeof lsGet === 'function') ? lsGet(LS_WB, null) : null;
  }catch(e){ db = null; }

  // fallback：默认6块
  const DEFAULT_TABS = [
    { id:'time',  name:'时空信息', icon:'🕰️', order:10 },
    { id:'role',  name:'角色信息', icon:'👤', order:20 },
    { id:'plot',  name:'故事大纲', icon:'📜', order:30 },
    { id:'event', name:'事件详情', icon:'🗓️', order:40 },
    { id:'task',  name:'任务约定', icon:'✅', order:50 },
    { id:'item',  name:'道具物品', icon:'🎒', order:60 },
  ];

  let tabs = DEFAULT_TABS;

  if (db && db.v === 4 && Array.isArray(db.tabs) && db.tabs.length){
    tabs = db.tabs.slice().sort((a,b)=>(a.order??0)-(b.order??0)).map(t=>({
      id: String(t.id||'').trim(),
      name: String(t.name||t.id||'').trim(),
      icon: String(t.icon||''),
      order: t.order ?? 0
    })).filter(t=>t.id);
  }

  wrap.innerHTML = tabs.map(t=>{
    const title = String((t.icon||'') + ' ' + (t.name||t.id)).trim();
    const tid = String(t.id).replace(/"/g,'&quot;');
    return `
<button class="btn" type="button" data-tpl-tab="${tid}"
style="text-align:left;padding:8px 10px;font-size:12px;border-radius:10px;">
<div style="font-weight:700;color:var(--meow-text);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
</button>
`;
  }).join('') || `<div class="hint">世界书里还没有板块。</div>`;

  // 点击：跳到世界书对应 tab（不是 group）
  wrap.querySelectorAll('[data-tpl-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const tabId = btn.getAttribute('data-tpl-tab');
      closeOverlays();
      openWorldbookModal();
      setTimeout(()=>{
        try{
          const db2 = (typeof lsGet==='function') ? lsGet(LS_WB, null) : null;
          if (db2 && db2.v===4){
            db2.active = tabId;
            (typeof lsSet==='function') && lsSet(LS_WB, db2);
          }
          window.MEOW_WB_REFRESH?.();
        }catch(e){}
      }, 220);
    }, {passive:false});
  });

  // 管理入口：直接打开世界书（你也可以改成跳某个tab）
  $('#meow_tpl_go_manage')?.addEventListener('click', ()=>{
    closeOverlays();
    openWorldbookModal();
  }, {passive:false});
}
renderWBTemplateCards();
// ✅ 打开总结窗时，确保世界书模板已同步到表格条目组（避免“新增模板但总结窗没刷新”）
try{ syncToTableInject( (typeof wbLoad==='function') ? wbLoad() : lsGet(LS_WB, null) ); }catch(e){}

  // ===== 元素引用 =====
  const elBase   = $('#meow_api_base');
  const elKey    = $('#meow_api_key');
  const elModelI = $('#meow_model_input');
  const elState  = $('#meow_api_state');

  const elApiPresetSel = $('#meow_api_preset_select');
  const elPromptPresetSel = $('#meow_prompt_preset_select');

  const elPrompt = $('#meow_prompt_area');
  const elOut    = $('#meow_out');
  const elMode   = $('#meow_mode');
  const elAutoOn = $('#meow_auto_on');

// ===================== V3: Tab 切换 =====================
(function initV3Tabs(){
  var tabBar = bd.querySelector('#meow_tab_bar');
  var tabPost = bd.querySelector('#meow_tab_post');
  var tabInline = bd.querySelector('#meow_tab_inline');
  if (!tabBar || !tabPost || !tabInline) return;

  function switchTab(key){
    var btns = tabBar.querySelectorAll('.meow-tab-btn');
    for (var i = 0; i < btns.length; i++) {
      var isAct = btns[i].getAttribute('data-tab') === key;
      btns[i].style.color = isAct ? 'rgba(46,38,30,.85)' : 'var(--meow-sub,rgba(46,38,30,.45))';
      btns[i].style.background = isAct ? 'var(--meow-accent,rgba(198,186,164,.85))' : 'transparent';
      btns[i].style.fontWeight = isAct ? '700' : '500';
    }
    tabPost.style.display = key === 'post' ? '' : 'none';
    tabInline.style.display = key === 'inline' ? '' : 'none';
    if (key === 'inline') try { refreshInlineTbl(); } catch(e){}
  }

  var tabBtns = tabBar.querySelectorAll('.meow-tab-btn');
  for (var i = 0; i < tabBtns.length; i++) {
    (function(btn){ btn.addEventListener('click', function(){ switchTab(btn.getAttribute('data-tab')); }, {passive:true}); })(tabBtns[i]);
  }

  function refreshInlineTbl(){
    // Render card grid in inline tab
    var inlineGrid = bd.querySelector('#meow_inline_card_grid');
    var inlineTbl  = bd.querySelector('#meow_inline_table');
    var inlineEmpty = bd.querySelector('#meow_inline_empty');

    try{
      var multi = (typeof meowMultiTableRead === 'function') ? meowMultiTableRead() : null;
      if (!multi) multi = { activeEntry:'role', entries:{}, customEntries:[] };
      var entryList = (typeof meowMultiGetEntryList === 'function') ? meowMultiGetEntryList(multi) : [];
      var activeId = multi.activeEntry || 'role';

      // Render card grid
      if (inlineGrid){
        var gh = '';
        for (var ei=0; ei<entryList.length; ei++){
          var ent = entryList[ei];
          var isAct = (ent.id === activeId);
          var hasD = multi.entries && multi.entries[ent.id] && multi.entries[ent.id].cols && multi.entries[ent.id].cols.length > 0;
          gh += '<div class="meow-entry-card' + (isAct?' active':'') + '" data-inline-entry="' + ent.id + '">';
          gh += '<span class="ico">' + (ent.icon||'📌') + '</span>';
          gh += '<span class="name">' + ent.name + '</span>';
          if (hasD && !isAct) gh += '<span style="position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:rgba(139,115,85,.5);"></span>';
          gh += '</div>';
        }
        inlineGrid.innerHTML = gh;
        // Bind clicks — switch active entry (shared with post tab)
        inlineGrid.querySelectorAll('[data-inline-entry]').forEach(function(card){
          card.addEventListener('click', function(){
            var eid = card.getAttribute('data-inline-entry');
            // Use the shared switchToEntry if available
            if (typeof window.__meowSwitchEntry === 'function'){
              window.__meowSwitchEntry(eid);
              refreshInlineTbl();
            }
          }, {passive:false});
        });
      }

      // Render table preview
      var d = multi.entries && multi.entries[activeId] ? multi.entries[activeId] : null;
      if (!d || !d.cols || !d.cols.length) d = (window.__meowReadCurrentData || function(){return null})();

      // ★ 如果仍无数据，自动用模板默认列初始化
      if ((!d || !d.cols || !d.cols.length) && typeof window.__meowGetDefaultCols === 'function'){
        var def = window.__meowGetDefaultCols(activeId);
        d = { template_id: def.tplKey||activeId, name: def.name, cols: def.cols, colPrompts:def.colPrompts||{}, rows:[new Array(def.cols.length).fill('')], rev:1, updated_at:Date.now() };
        if (!multi.entries) multi.entries = {};
        multi.entries[activeId] = d;
        try{ (typeof meowMultiTableWrite==='function') && meowMultiTableWrite(multi); (typeof meowTableMetaWrite==='function') && meowTableMetaWrite(d, false); }catch(e2){}
      }

      if (inlineTbl && inlineEmpty){
        if (!d || !d.cols || !d.cols.length){
          inlineTbl.style.display = 'none';
          inlineEmpty.style.display = '';
          inlineEmpty.textContent = '暂无表格数据，请选择条目卡片并在后置 Tab 初始化';
        } else {
          inlineEmpty.style.display = 'none';
          inlineTbl.style.display = '';
          (typeof meowCTRender === 'function') && meowCTRender(inlineTbl, null, d);
        }
      }
    }catch(e){ console.warn('[MEOW] refreshInlineTbl error:', e); }
  }

  // Inline tab +行/+列 buttons
  (function(){
    var inAddRow = bd.querySelector('#meow_inline_add_row');
    var inAddCol = bd.querySelector('#meow_inline_add_col');
    if (inAddRow) inAddRow.addEventListener('click', function(){
      var data = (window.__meowReadCurrentData || meowTableMetaRead || function(){return null})();
      if (!data || !data.cols){ toast('请先在后置 Tab 初始化表格'); return; }
      var fields = data.cols.map(function(c,i){ return { label: c || ('列'+i), key: 'c'+i, value: '', type: 'input' }; });
      meowCTCellPopup({
        title: '添加新行',
        fields: fields,
        onConfirm: function(vals){
          var newRow = data.cols.map(function(_,i){ return vals['c'+i] || ''; });
          data.rows = data.rows || [];
          data.rows.push(newRow);
          data.rev = (data.rev||0) + 1;
          data.updated_at = Date.now();
          meowTableMetaWrite(data, false);
          if (typeof window.__meowSyncActiveBack === 'function') window.__meowSyncActiveBack(data);
          refreshInlineTbl();
        }
      });
    }, {passive:false});

    if (inAddCol) inAddCol.addEventListener('click', function(){
      var data = (window.__meowReadCurrentData || meowTableMetaRead || function(){return null})();
      if (!data || !data.cols){ toast('请先在后置 Tab 初始化表格'); return; }
      meowCTCellPopup({
        title: '添加新列',
        fields: [
          { label:'字段名', key:'name', value:'', type:'input' },
          { label:'发送给 AI 的字段含义提示词', key:'prompt', value:'', type:'textarea' }
        ],
        onConfirm: function(vals){
          var name = (vals.name || '').trim();
          if (!name){ toast('请输入字段名'); return; }
          data.cols.push(name);
          (data.rows||[]).forEach(function(r){ r.push(''); });
          if (!data.colPrompts) data.colPrompts = {};
          if (vals.prompt) data.colPrompts[data.cols.length - 1] = vals.prompt;
          data.rev = (data.rev||0) + 1;
          data.updated_at = Date.now();
          meowTableMetaWrite(data, false);
          if (typeof window.__meowSyncActiveBack === 'function') window.__meowSyncActiveBack(data);
          refreshInlineTbl();
        }
      });
    }, {passive:false});

    // Inline table cell click events
    var inlineTbl = bd.querySelector('#meow_inline_table');
    if (inlineTbl && !inlineTbl.__meowInlineBound){
      inlineTbl.__meowInlineBound = true;
      inlineTbl.addEventListener('click', function(e){
        var el = e.target.closest ? e.target.closest('[data-ct-delrow],[data-ct-hcol],[data-ct-addcol],[data-ct-preview-row]') : e.target;
        if (!el) return;
        var data = (window.__meowReadCurrentData || meowTableMetaRead || function(){return null})();
        if (!data) return;

        // 表头点击：编辑字段名 + 字段含义
        if (el.hasAttribute('data-ct-hcol')){
          var ci = parseInt(el.getAttribute('data-ct-hcol'), 10);
          if (!Number.isFinite(ci) || ci < 0 || !data.cols || ci >= data.cols.length) return;
          var oldName = data.cols[ci] || '';
          var oldPrompt = (data.colPrompts && data.colPrompts[ci]) || '';
          meowCTCellPopup({
            title: '编辑表头「' + oldName + '」',
            fields: [
              { label:'字段名', key:'name', value: oldName, type:'input' },
              { label:'发送给 AI 的字段含义提示词', key:'prompt', value: oldPrompt, type:'textarea' }
            ],
            anchorEl: el,
            onConfirm: function(vals){
              var name = (vals.name || '').trim();
              if (!name){ toast('请输入字段名'); return; }
              data.cols[ci] = name;
              if (!data.colPrompts) data.colPrompts = {};
              data.colPrompts[ci] = (vals.prompt || '').trim();
              data.rev = (data.rev||0) + 1;
              data.updated_at = Date.now();
              meowTableMetaWrite(data, false);
              if (typeof window.__meowSyncActiveBack === 'function') window.__meowSyncActiveBack(data);
              refreshInlineTbl();
            },
            onDelete: function(){
              if (data.cols.length <= 1){ toast('至少保留一列'); return; }
              data.cols.splice(ci, 1);
              (data.rows||[]).forEach(function(r){ r.splice(ci, 1); });
              var newCP = {};
              for (var k in (data.colPrompts||{})){
                var ki = parseInt(k, 10);
                if (ki < ci) newCP[ki] = data.colPrompts[ki];
                else if (ki > ci) newCP[ki - 1] = data.colPrompts[ki];
              }
              data.colPrompts = newCP;
              data.rev = (data.rev||0) + 1;
              data.updated_at = Date.now();
              meowTableMetaWrite(data, false);
              if (typeof window.__meowSyncActiveBack === 'function') window.__meowSyncActiveBack(data);
              refreshInlineTbl();
              toast('已删除列「' + oldName + '」');
            }
          });
          return;
        }

        if (el.hasAttribute('data-ct-delrow')){
          var ri = parseInt(el.getAttribute('data-ct-delrow'),10);
          if (Number.isFinite(ri) && data.rows && data.rows.length > 1){
            data.rows.splice(ri,1);
            data.rev = (data.rev||0)+1; data.updated_at = Date.now();
            meowTableMetaWrite(data,false);
            if (typeof window.__meowSyncActiveBack==='function') window.__meowSyncActiveBack(data);
            refreshInlineTbl();
          }
          return;
        }
        // 注入预览行点击
        if (el.hasAttribute('data-ct-preview-row')){
          var pBtn = bd ? bd.querySelector('#meow_tg_preview_hdr') : null;
          if (pBtn) pBtn.click();
          return;
        }
        // 表格内 ＋列
        if (el.hasAttribute('data-ct-addcol')){
          if (!data.cols){ toast('请先初始化'); return; }
          meowCTCellPopup({ title:'添加新列', fields:[
            {label:'字段名',key:'name',value:'',type:'input'},
            {label:'发送给 AI 的字段含义提示词',key:'prompt',value:'',type:'textarea'}
          ], onConfirm:function(v){
            var nm=(v.name||'').trim(); if(!nm){toast('请输入字段名');return;}
            data.cols.push(nm); (data.rows||[]).forEach(function(r){r.push('');}); if(!data.colPrompts)data.colPrompts={}; if(v.prompt)data.colPrompts[data.cols.length-1]=v.prompt;
            data.rev=(data.rev||0)+1; data.updated_at=Date.now(); meowTableMetaWrite(data,false); if(typeof window.__meowSyncActiveBack==='function')window.__meowSyncActiveBack(data); refreshInlineTbl();
          }});
          return;
        }
      });
    }
  })();
  window.__meowRefreshInlinePreview = refreshInlineTbl;
})();

// ===================== V3: 顶部按钮绑定 =====================
// API button click is now bound directly on the element in the header

// ===================== V3: 数据管理绑定 =====================
on('#meow_export_chat', 'click', function(){ exportCurrentChat(); });
on('#meow_export_all', 'click', function(){ exportAllData(); });
on('#meow_import_data', 'click', function(){
  var fi = bd.querySelector('#meow_import_file');
  if (fi) fi.click();
});
(function(){
  var fi2 = bd.querySelector('#meow_import_file');
  if (fi2) fi2.addEventListener('change', function(e){
    var file = e.target && e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){ try { importMeowData(ev.target.result); } catch(err){ toast('导入失败'); } };
    reader.readAsText(file);
  }, {passive:false});
})();

// ===================== V3: 清除输出 =====================
on('#meow_clear_out', 'click', function(){
  if (!confirm('确定清除？这会同时清空总结内容和可视化世界书本地数据。')) return;
  if (elOut) elOut.value = '';
  // 清除总结存储
  try{ saveLastOut('', {}); }catch(e){}
  try{ meowSaveChatState(__chatUID, { out: '', lastSummaryEditAt: Date.now() }); }catch(e){}
  // 清空可视化本地DB（LS_WB）
  try{
    var emptyDB = { v:4, tabs:[], cards:[], _chatUID: __chatUID };
    lsSet('meow_worldbook_local_v1', emptyDB);
  }catch(e){}
  // 清空 per-chat WB 快照
  try{
    var wbBox = lsGet('meow_wb_by_chat_v1', { map:{} });
    if (wbBox && wbBox.map && __chatUID) delete wbBox.map[__chatUID];
    lsSet('meow_wb_by_chat_v1', wbBox);
  }catch(e){}
  // 刷新WB可视化
  try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
  toast('已全部清除');
});

// ===================== V3: 随聊Tab事件 =====================
on('#meow_save_inline_prompt', 'click', function(){
  var ta = bd.querySelector('#meow_inline_prompt_area');
  lsSet(LS_INLINE_PROMPT, ta ? ta.value : '');
  toast('已保存随聊提示词');
});

on('#meow_inline_prompt_preset_save', 'click', function(){
  var name = (prompt('给这个随聊提示词预设起个名字：') || '').trim();
  if (!name) { toast('已取消'); return; }
  var ta = bd.querySelector('#meow_inline_prompt_area');
  var item = { name: name, text: String(ta ? ta.value : '').trim() };
  var box = lsGet(LS_INLINE_PROMPT_PRESETS, { list: [] });
  var idx = -1;
  for (var si = 0; si < (box.list||[]).length; si++) { if (String(box.list[si].name||'') === name) { idx = si; break; } }
  if (idx >= 0) box.list[idx] = item; else box.list.unshift(item);
  box.list = box.list.slice(0, 80);
  lsSet(LS_INLINE_PROMPT_PRESETS, box);
  toast('已保存为随聊预设');
  var sel = bd.querySelector('#meow_inline_prompt_preset_select');
  if (sel) {
    var h = '<option value="">(选择预设)</option>';
    for (var ri2 = 0; ri2 < (box.list||[]).length; ri2++) h += '<option value="' + ri2 + '">' + String(box.list[ri2].name||'未命名').replace(/</g,'&lt;') + '</option>';
    sel.innerHTML = h;
  }
});

on('#meow_inline_prompt_preset_del', 'click', function(){
  var sel = bd.querySelector('#meow_inline_prompt_preset_select');
  var i = parseInt(sel ? sel.value : '', 10);
  if (isNaN(i)) { toast('先选择一个预设'); return; }
  var box = lsGet(LS_INLINE_PROMPT_PRESETS, { list: [] });
  box.list.splice(i, 1); lsSet(LS_INLINE_PROMPT_PRESETS, box);
  toast('已删除随聊预设');
  if (sel) {
    var h = '<option value="">(选择预设)</option>';
    for (var ri3 = 0; ri3 < (box.list||[]).length; ri3++) h += '<option value="' + ri3 + '">' + String(box.list[ri3].name||'未命名').replace(/</g,'&lt;') + '</option>';
    sel.innerHTML = h;
  }
});

(function(){
  var ipSel = bd.querySelector('#meow_inline_prompt_preset_select');
  if (ipSel) ipSel.addEventListener('change', function(){
    var i = parseInt(ipSel.value || '', 10);
    if (isNaN(i)) return;
    var box = lsGet(LS_INLINE_PROMPT_PRESETS, { list: [] });
    var p = (box.list||[])[i]; if (!p) return;
    var ta = bd.querySelector('#meow_inline_prompt_area');
    if (ta) ta.value = p.text || '';
    lsSet(LS_INLINE_PROMPT, p.text || '');
    toast('已载入：' + (p.name||'预设'));
  }, {passive:false});
})();

// 随聊开关持久化 + 实时更新注入
(function(){
  var ioEl = bd.querySelector('#meow_inline_on');
  if (ioEl) ioEl.addEventListener('change', function(e){
    lsSet(LS_INLINE_ON, !!e.target.checked);
    try{ meowInlineInjectIfNeeded(); }catch(err){}
    toast(e.target.checked ? '随聊注入已开启，下次发送生效' : '随聊注入已关闭');
  }, {passive:true});
  var ipEl = bd.querySelector('#meow_inline_parse');
  if (ipEl) ipEl.addEventListener('change', function(e){
    lsSet(LS_INLINE_PARSE, !!e.target.checked);
    try{ meowInlineInjectIfNeeded(); }catch(err){}
    toast(e.target.checked ? '自动解析回写已开启，下次发送生效' : '自动解析回写已关闭');
  }, {passive:true});
  var awEl = bd.querySelector('#meow_auto_write_on');
  if (awEl) awEl.addEventListener('change', function(e){ lsSet(LS_AUTO_WRITE_ON, !!e.target.checked); }, {passive:true});
  var uwEl = bd.querySelector('#meow_upload_wb_on');
  if (uwEl) uwEl.addEventListener('change', function(e){ lsSet(LS_UPLOAD_WB_ON, !!e.target.checked); }, {passive:true});
})();

// 随聊输出按钮
on('#meow_copy_out_inline', 'click', function(){
  var ta = bd.querySelector('#meow_out_inline');
  var text = ta ? ta.value : '';
  if (!text) { toast('无内容'); return; }
  try { navigator.clipboard.writeText(text); toast('已复制'); } catch(e){ toast('复制失败'); }
});
on('#meow_clear_out_inline', 'click', function(){
  var ta = bd.querySelector('#meow_out_inline');
  if (ta) ta.value = '';
  toast('已清除');
});


// ===================== ✅ 打开总结窗：自动加载当前聊天总结（V2：全局监听 + 延迟校验） =====================

// 1) 立即取 UID 并加载（让用户先看到内容，不白屏）
let __chatUID = meowGetChatUID();
if (__chatUID.startsWith('fallback:') || __chatUID.startsWith('char:')) {
  __chatUID = window.__MEOW_SUM_ACTIVE_UID__ || __chatUID;
}
window.__MEOW_SUM_ACTIVE_UID__ = __chatUID;

let st0 = meowLoadChatState(__chatUID);

// ===================== ✅ 楼层输入：自动保存（修复“关掉弹窗不记住”） =====================
const elFloorFromI = $('#meow_floor_from');
const elFloorToI   = $('#meow_floor_to');

// 回填上次手动填写的 From/To（不影响“已总结到/最新”标签）
try{
  if (elFloorFromI && st0?.uiFloorFrom != null) elFloorFromI.value = String(st0.uiFloorFrom);
  if (elFloorToI   && st0?.uiFloorTo   != null) elFloorToI.value   = String(st0.uiFloorTo);
}catch(e){}

function meowPersistFloorInputs(reason){
  try{
    const fRaw = String(elFloorFromI?.value || '').trim();
    const tRaw = String(elFloorToI?.value   || '').trim();
    const f = fRaw ? parseInt(fRaw, 10) : null;
    const t = tRaw ? parseInt(tRaw, 10) : null;

    // 1) 永远保存“你输入框里填的值”（下次打开不用再打）
    try{ meowSaveChatState(__chatUID, { uiFloorFrom: f, uiFloorTo: t }); }catch(e){}

    // 2) 如果你两个都填了：视为“手动校正已总结进度”（你需要的修复）
    if (Number.isFinite(f) && Number.isFinite(t)){
      const lo = Math.min(f, t), hi = Math.max(f, t);
      try{ meowSaveChatState(__chatUID, { lastFrom: lo, lastTo: hi, lastN: null, manualProgress: true }); }catch(e){}
      try{ tgSaveProgress({ lastFrom: lo, lastTo: hi, lastN: null }); }catch(e){}

      // 刷新标签显示
      try{
        const lf = elFloorFromI?.previousElementSibling;
        if (lf) lf.textContent = `楼层 From（已总结到: ${lo || '暂无'}）`;
        const lt = elFloorToI?.previousElementSibling;
        const realLatest = meowGetLatestFloorFromDOM();
        if (lt) lt.textContent = `楼层 To（最新: ${realLatest || hi || '暂无'}）`;
        const hint = $('#meow_run_hint');
        if (hint) hint.textContent = `已总结：${lo && hi ? `第${lo}~${hi}楼（共${hi-lo+1}条）` : '暂无'} ｜ 最近N：${st0?.lastN || 30}`;
      }catch(e){}
    }
  }catch(e){}
}

if (elFloorFromI && !elFloorFromI.__meowFloorBind){
  elFloorFromI.__meowFloorBind = true;
  elFloorFromI.addEventListener('input', ()=> meowPersistFloorInputs('input'), {passive:true});
  elFloorFromI.addEventListener('change',()=> meowPersistFloorInputs('change'),{passive:true});
}
if (elFloorToI && !elFloorToI.__meowFloorBind){
  elFloorToI.__meowFloorBind = true;
  elFloorToI.addEventListener('input', ()=> meowPersistFloorInputs('input'), {passive:true});
  elFloorToI.addEventListener('change',()=> meowPersistFloorInputs('change'),{passive:true});
}

// 回填输出区（优先从 chat.extra.meow_summary 读取，天然随分支切换）
if (elOut){
  let _out = loadLastOut({ noFallback:true });
  // ✅ 迁移：旧版本存的是 per-chat state 的 st0.out
  if (!_out && st0 && typeof st0.out === 'string' && st0.out){
    try{ saveLastOut(st0.out, { migratedFrom:'chatState', migratedAt: Date.now() }); }catch(e){}
    _out = st0.out;
  }
  elOut.value = _out || '';
}

// 回填上次选择的写入目标/书名
const tgtSel = $('#meow_upload_target');
if (tgtSel && st0?.target) tgtSel.value = st0.target;
const bookIpt = $('#meow_save_book');
if (bookIpt && st0?.bookName) bookIpt.value = st0.bookName;

// 回填 per-chat 进度到 label
try{
  const pFrom = st0?.lastFrom;
  const pTo   = st0?.lastTo;
  const pN    = st0?.lastN;
  // ✅ "最新楼层" 始终从 DOM 实时读取，不依赖存储
  const _realFloor = meowGetLatestFloorFromDOM();
  const displayTo = _realFloor || pTo;
  const lf = $('#meow_floor_from')?.previousElementSibling;
  if (lf) lf.textContent = `楼层 From（已总结到: ${pFrom || '暂无'}）`;
  const lt = $('#meow_floor_to')?.previousElementSibling;
  if (lt) lt.textContent = `楼层 To（最新: ${displayTo || '暂无'}）`;
  const hint = $('#meow_run_hint');
  if (hint) hint.textContent = `已总结：${pFrom && pTo ? `第${pFrom}~${pTo}楼（共${pTo-pFrom+1}条）` : '暂无'} ｜ 最近N：${pN || 30}`;
}catch(e){}

// ✅ 回填 per-chat 保存的模式和提示词
if (elMode && st0?.mode) {
  elMode.value = st0.mode;
  refreshRuleLabels();
}
if (elPrompt && st0?.prompt) {
  elPrompt.value = st0.prompt;
}

// 2) 延迟 800ms 二次校验：云酒馆 context 可能还没刷新
//    如果真实 UID 和初次不同，自动切到正确聊天
setTimeout(()=>{
  try{
    const freshUID = meowGetChatUID();
    if (freshUID.startsWith('fallback:')) return; // 拿不到就算了

    // ✅ 强制确保世界书数据属于当前聊天（延迟后再确认一次）
    try{ meowForceWBSyncForCurrentChat(); }catch(e){}

    if (freshUID === __chatUID){
      // UID 没变，但仍然刷新一次楼层（DOM可能刚加载完）
      try{
        const _rf = meowGetLatestFloorFromDOM();
        if (_rf != null){
          const lt = doc.querySelector('#meow-summary-modal #meow_floor_to')?.previousElementSibling;
          if (lt) lt.textContent = `楼层 To（最新: ${_rf}）`;
        }
      }catch(e){}
      return;
    }

    // UID 变了：说明初次取的是旧值，现在纠正
    __chatUID = freshUID;
    window.__MEOW_SUM_ACTIVE_UID__ = freshUID;
    const st = meowLoadChatState(freshUID);

    const curOut = doc.querySelector('#meow-summary-modal #meow_out');
    if (curOut){
    let _out = loadLastOut({ noFallback:true });
    if (!_out && st && typeof st.out === 'string' && st.out){
      try{ saveLastOut(st.out, { migratedFrom:'chatState', migratedAt: Date.now() }); }catch(e){}
      _out = st.out;
    }
    curOut.value = _out || '';
  }

    // ✅ 更新进度 label（"最新"从DOM读）
    try{
      const _rf2 = meowGetLatestFloorFromDOM();
      const lf2 = doc.querySelector('#meow-summary-modal #meow_floor_from')?.previousElementSibling;
      if (lf2) lf2.textContent = `楼层 From（已总结到: ${st?.lastFrom || '暂无'}）`;
      const lt2 = doc.querySelector('#meow-summary-modal #meow_floor_to')?.previousElementSibling;
      if (lt2) lt2.textContent = `楼层 To（最新: ${_rf2 || st?.lastTo || '暂无'}）`;
      const h2 = doc.querySelector('#meow-summary-modal #meow_run_hint');
      if (h2) h2.textContent = `已总结：${st?.lastFrom && st?.lastTo ? `第${st.lastFrom}~${st.lastTo}楼（共${st.lastTo-st.lastFrom+1}条）` : '暂无'} ｜ 最近N：${st?.lastN || 30}`;
    }catch(e){}

    // 回填写入目标/书名
    const tgt2 = doc.querySelector('#meow-summary-modal #meow_upload_target');
    if (tgt2 && st?.target) tgt2.value = st.target;
    const book2 = doc.querySelector('#meow-summary-modal #meow_save_book');
    if (book2 && st?.bookName) book2.value = st.bookName;

    // ★ 静默校正，不弹 toast（这是打开弹窗时的初始化，不是用户主动切换聊天）
    void(0)&&console.log('[MEOW] 初始 UID 校正:', __chatUID.slice(0,30), '→', freshUID.slice(0,30));
  }catch(e){}
}, 800);

// 3) 输出变化：实时写回当前聊天（per-chat）
// 注册全局更新函数（直接调用，不依赖事件）
window.__meowUpdateElOut = function(text){
  if(elOut){
    elOut.value = text;
    try{ saveLastOut(text, { editedBy:'auto', editedAt:Date.now() }); }catch(err){}
    try{ meowSaveChatState(__chatUID, { out: text, lastSummaryEditAt: Date.now() }); }catch(err){}
  }
};
try{ window.top.__meowUpdateElOut = window.__meowUpdateElOut; }catch(e){}
// 监听 WB 解析完成后的更新事件（弹窗关着时也能存）
window.addEventListener('meow_out_updated', function(e){
  if(e.detail && e.detail.text !== undefined){
    if(elOut) elOut.value = e.detail.text;
    try{ saveLastOut(e.detail.text, { editedBy:'auto', editedAt:Date.now() }); }catch(err){}
    try{ meowSaveChatState(__chatUID, { out: e.detail.text, lastSummaryEditAt: Date.now() }); }catch(err){}
  }
});

if (elOut && !elOut.__meowChatBind){
  elOut.__meowChatBind = true;
  elOut.addEventListener('input', ()=>{
    // ✅ 总结内容只挂到 chat 消息 extra（随分支/聊天走），不再塞 localStorage
    try{ saveLastOut(elOut.value, { editedBy:'manual', editedAt: Date.now() }); }catch(e){}
    try{ meowSaveChatState(__chatUID, { out: String(elOut.value||''), lastSummaryEditAt: Date.now() }); }catch(e){}
  }, {passive:true});
}

// 4) 定义切换函数：全局回调（改动1）会调用它
//    不再在这里注册 meowBindChatAutoLoad（已在全局注册，避免重复累积）
window.__MEOW_SUM_CHAT_SWITCH__ = (newUID)=>{
  try{
    __chatUID = newUID;
    window.__MEOW_SUM_ACTIVE_UID__ = newUID;
    const st = meowLoadChatState(newUID);

    // ✅ 强制确保世界书数据也切换到新聊天
    try{ meowForceWBSyncForCurrentChat(); }catch(e){}

    // 输出区
    const curOut = doc.querySelector('#meow-summary-modal #meow_out');
    if (curOut){
    let _out = loadLastOut({ noFallback:true });
    if (!_out && st && typeof st.out === 'string' && st.out){
      try{ saveLastOut(st.out, { migratedFrom:'chatState', migratedAt: Date.now() }); }catch(e){}
      _out = st.out;
    }
    curOut.value = _out || '';
  }

    // ✅ 重新计算最新楼层（从 DOM 读取）
    let latestFloor = null;
    try{
      const nodes = $qa('.mes');
      for (let i = nodes.length - 1; i >= 0; i--){
        const m = nodes[i];
        const mesid = m.getAttribute('mesid') || m.dataset?.mesid;
        if (mesid != null && mesid !== '') {
          const n = parseInt(mesid, 10);
          if (Number.isFinite(n)) { latestFloor = n; break; }
        }
        const text = (m.querySelector('.mes_text')?.innerText || m.innerText || '');
        const match = text.match(/#(\d+)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (Number.isFinite(n)) { latestFloor = n; break; }
        }
      }
    }catch(e){}

    // 进度 label：用 per-chat 数据 + 实时楼层
    try{
      const pFrom = st?.lastFrom;
      const pTo   = st?.lastTo;
      const pN    = st?.lastN;
      const displayTo = latestFloor || pTo;
      const lf2 = doc.querySelector('#meow-summary-modal #meow_floor_from')?.previousElementSibling;
      if (lf2) lf2.textContent = `楼层 From（已总结到: ${pFrom || '暂无'}）`;
      const lt2 = doc.querySelector('#meow-summary-modal #meow_floor_to')?.previousElementSibling;
      if (lt2) lt2.textContent = `楼层 To（最新: ${displayTo || '暂无'}）`;
      const h2 = doc.querySelector('#meow-summary-modal #meow_run_hint');
      if (h2) h2.textContent = `已总结：${pFrom && pTo ? `第${pFrom}~${pTo}楼（共${pTo-pFrom+1}条）` : '暂无'} ｜ 最近N：${pN || 30}`;
    }catch(e){}

    // 写入目标/书名
    const tgt2 = doc.querySelector('#meow-summary-modal #meow_upload_target');
    if (tgt2 && st?.target) tgt2.value = st.target;
    const book2 = doc.querySelector('#meow-summary-modal #meow_save_book');
    if (book2 && st?.bookName) book2.value = st.bookName;

    // ✅ 新增：恢复模式选择（表格/大总结/小总结/自定义）
    const modeEl = doc.querySelector('#meow-summary-modal #meow_mode');
    if (modeEl && st?.mode) {
      modeEl.value = st.mode;
      modeEl.dispatchEvent(new Event('change', {bubbles:true}));
    }

    // ✅ 新增：恢复提示词
    const promptEl = doc.querySelector('#meow-summary-modal #meow_prompt_area');
    if (promptEl && st?.prompt) promptEl.value = st.prompt;

    void(0)&&console.log('[MEOW][ChatSwitch] 切换总结到:', newUID.slice(0,30), st?.out ? '(有总结)' : '(暂无总结)');
    // ★ 仅在总结弹窗可见时才弹 toast
    var _sumModal = doc.getElementById('meow-summary-modal');
    if (_sumModal && _sumModal.offsetParent !== null){
      toast(`已切换到该聊天${st?.out ? '（有总结）' : '（暂无总结）'}`);
    }
  }catch(e){}
};


// ===================== 跟随聊天调表 V4：多条目卡片 + UI 绑定 =====================
(function initChatTableV4(){
  const tableEl  = doc.querySelector('#meow_ct_table');
  const emptyEl  = doc.querySelector('#meow_ct_empty');
  const statusEl = doc.querySelector('#meow_ct_status');
  const gridEl   = doc.querySelector('#meow_ct_card_grid');
  const getCUID  = ()=> __chatUID || window.__MEOW_SUM_ACTIVE_UID__ || meowGetCurrentChatUID();

  // ======== 多条目数据层 ========
  function getMulti(){
    return meowMultiTableRead() || { activeEntry:'role', entries:{}, customEntries:[] };
  }
  function saveMulti(multi){
    meowMultiTableWrite(multi);
    // 同步活跃条目到单表接口（兼容旧逻辑）
    const active = multi.entries?.[multi.activeEntry];
    if (active && active.cols){
      meowTableMetaWrite(active, false);
    }
  }
  function getActiveData(multi){
    return meowMultiGetActive(multi) || null;
  }

  // ======== 当前表格数据缓存（用于点击事件可靠读取）========
  let __currentData = null;

  // 可靠读取当前表格数据（metadata → 缓存 → multi → null）
  function readCurrentData(){
    return meowTableMetaRead() || __currentData || getActiveData(getMulti()) || null;
  }
  window.__meowReadCurrentData = readCurrentData;

  // ======== 刷新表格 UI ========
  function refreshUI(data){
    __currentData = data; // 缓存
    meowCTRender(tableEl, emptyEl, data);
    if (statusEl){
      if (data?.cols?.length){
        const multi = getMulti();
        const entryList = meowMultiGetEntryList(multi);
        const ent = entryList.find(e=>e.id===multi.activeEntry);
        statusEl.textContent = `${data.cols.length}列 × ${(data.rows||[]).length}行 · ${ent?.name||multi.activeEntry} · 自动保存到聊天元数据`;
      } else {
        statusEl.textContent = '';
      }
    }
  }

  // ======== 从表格读回数据 ========
  function readFromDOM(){
    const uid = getCUID();
    return meowTableMetaRead() || meowTableLocalLoad(uid) || null;
  }

  // ======== 同步并渲染 ========
  function doSync(reason){
    const data = meowTableSyncCurrent(reason);
    const multi = getMulti();
    // 如果有旧单表数据但多表为空，自动迁移
    if (data && data.cols && (!multi.entries || !Object.keys(multi.entries).length)){
      const entryId = data.template_id ? (MEOW_CT_TEMPLATES[data.template_id]?.tab || 'role') : 'role';
      multi.activeEntry = entryId;
      if (!multi.entries) multi.entries = {};
      multi.entries[entryId] = data;
      saveMulti(multi);
    }

    // ★ 如果当前活跃条目无数据，自动用模板默认列初始化
    const activeId = multi.activeEntry || 'role';
    let activeData = multi.entries?.[activeId] || null;
    if (!activeData || !activeData.cols || !activeData.cols.length){
      const def = getDefaultColsForEntry(activeId);
      activeData = {
        template_id: def.tplKey || activeId,
        name: def.name,
        cols: def.cols,
        colPrompts: def.colPrompts || {},
        rows: [new Array(def.cols.length).fill('')],
        rev: 1,
        updated_at: Date.now()
      };
      if (!multi.entries) multi.entries = {};
      multi.entries[activeId] = activeData;
      multi.activeEntry = activeId;
      saveMulti(multi);
      meowTableMetaWrite(activeData, false);
    }

    renderCardGrid(multi);
    refreshUI(activeData);
  }

  // ======== 渲染卡片网格 ========
  function renderCardGrid(multi){
    if (!gridEl) return;
    multi = multi || getMulti();
    const list = meowMultiGetEntryList(multi);
    const activeId = multi.activeEntry || 'role';
    let html = '';
    for (let i=0; i<list.length; i++){
      const e = list[i];
      const isActive = (e.id === activeId);
      const hasData = multi.entries?.[e.id]?.cols?.length > 0;
      html += `<div class="meow-entry-card${isActive?' active':''}" data-entry-id="${e.id}" title="${e.name}${hasData?' (有数据)':''}">`;
      html += `<span class="ico">${e.icon||'📌'}</span>`;
      html += `<span class="name">${e.name}</span>`;
      if (hasData && !isActive){
        html += `<span style="position:absolute;top:4px;right:4px;width:5px;height:5px;border-radius:50%;background:rgba(139,115,85,.4);"></span>`;
      }
      html += '</div>';
    }
    // ＋添加条目 按钮
    html += '<div class="meow-entry-card meow-entry-add" data-entry-id="__add__" title="添加自定义条目">＋</div>';
    gridEl.innerHTML = html;

    // 绑定点击事件
    gridEl.querySelectorAll('[data-entry-id]').forEach(function(card){
      card.addEventListener('click', function(){
        const eid = card.getAttribute('data-entry-id');
        if (eid === '__add__'){
          addCustomEntry();
          return;
        }
        switchToEntry(eid);
      }, {passive:false});
    });
  }

  // ======== 根据 entryId 获取默认模板列 ========
  function getDefaultColsForEntry(entryId){
    const tplMap = { role:'tpl_role', time:'tpl_time', plot:'tpl_plot', event:'tpl_event', item:'tpl_item', task:'tpl_task' };
    const tplKey = tplMap[entryId];
    if (tplKey && MEOW_CT_TEMPLATES[tplKey]){
      const tpl = MEOW_CT_TEMPLATES[tplKey];
      return {
        cols: [...tpl.cols],
        name: tpl.name,
        tplKey,
        colPrompts: Object.assign({}, tpl.colPrompts || {})
      };
    }
    // 自定义条目
    const multi = getMulti();
    const entryList = meowMultiGetEntryList(multi);
    const ent = entryList.find(e=>e.id===entryId);
    return { cols: ['列1','列2','列3'], name: ent?.name || entryId, tplKey: entryId, colPrompts: {} };
  }

  // ======== 切换到指定条目 ========
  function switchToEntry(entryId){
    const multi = getMulti();
    const oldId = multi.activeEntry || '';

    // 保存当前活跃条目的数据
    if (oldId){
      const curData = meowTableMetaRead();
      if (curData && curData.cols){
        if (!multi.entries) multi.entries = {};
        multi.entries[oldId] = curData;
      }
    }

    // 切换
    multi.activeEntry = entryId;

    // 加载新条目的数据到单表接口
    let newData = multi.entries?.[entryId] || null;

    // ★ 如果该条目没有数据，自动用模板默认列初始化
    if (!newData || !newData.cols || !newData.cols.length){
      const def = getDefaultColsForEntry(entryId);
      newData = {
        template_id: def.tplKey || entryId,
        name: def.name,
        cols: def.cols,
        colPrompts: def.colPrompts || {},
        rows: [new Array(def.cols.length).fill('')],
        rev: 1,
        updated_at: Date.now()
      };
      if (!multi.entries) multi.entries = {};
      multi.entries[entryId] = newData;
    }

    saveMulti(multi);
    meowTableMetaWrite(newData, false);

    renderCardGrid(multi);
    refreshUI(newData);
    loadRulesForActiveEntry(entryId);
  }

  // ======== 添加自定义条目 ========
  function addCustomEntry(){
    meowCTCellPopup({
      title: '添加自定义表格条目',
      fields: [
        { label:'条目名称', key:'name', value:'', type:'input' },
        { label:'图标（Emoji）', key:'icon', value:'📌', type:'input' }
      ],
      onConfirm: function(vals){
        const name = (vals.name||'').trim();
        if (!name){ toast('请输入条目名称'); return; }
        const multi = getMulti();
        const newId = meowMultiAddCustomEntry(multi, name, vals.icon||'📌');
        // 为新条目创建空表格
        if (!multi.entries) multi.entries = {};
        multi.entries[newId] = {
          template_id: '', name: name,
          cols: ['列1','列2','列3'],
          rows: [['','','']],
          colPrompts: {}, rev:1, updated_at: Date.now()
        };
        saveMulti(multi);
        switchToEntry(newId);
        toast('已添加「' + name + '」');
      }
    });
  }

  // ======== 初次加载 ========
  doSync('openModal');

  // ======== 表格编辑事件（点击弹窗编辑）========
  if (tableEl && !tableEl.__meowCTV4Bound){
    tableEl.__meowCTV4Bound = true;

    tableEl.addEventListener('click', (e)=>{
      const el = e.target.closest ? e.target.closest('[data-ct-delrow],[data-ct-hcol],[data-ct-cell-r],[data-ct-addrow],[data-ct-addcol]') : e.target;
      if (!el) return;

      // 删行
      if (el.hasAttribute('data-ct-delrow')){
        const data = readCurrentData();
        if (!data) return;
        const ri = parseInt(el.getAttribute('data-ct-delrow'),10);
        if (Number.isFinite(ri) && data.rows?.length > 1){
          data.rows.splice(ri,1);
          data.rev = (data.rev||0) + 1;
          data.updated_at = Date.now();
          syncActiveBack(data);
          refreshUI(data);
        }
        return;
      }

      // 注入预览行点击
      if (el.hasAttribute('data-ct-preview-row')){
        var previewBtn = bd.querySelector('#meow_tg_preview_hdr') || bd.querySelector('#meow_tg_preview');
        if (previewBtn) previewBtn.click();
        return;
      }

      // 表头点击：编辑字段名 + 字段含义
      if (el.hasAttribute('data-ct-hcol')){
        const data = readCurrentData();
        if (!data?.cols) return;
        const ci = parseInt(el.getAttribute('data-ct-hcol'), 10);
        if (!Number.isFinite(ci) || ci < 0 || ci >= data.cols.length) return;
        const oldName = data.cols[ci] || '';
        const oldPrompt = (data.colPrompts && data.colPrompts[ci]) || '';
        meowCTCellPopup({
          title: '编辑表头「' + oldName + '」',
          fields: [
            { label:'字段名', key:'name', value: oldName, type:'input' },
            { label:'发送给 AI 的字段含义提示词', key:'prompt', value: oldPrompt, type:'textarea' }
          ],
          anchorEl: el,
          onConfirm: function(vals){
            const name = (vals.name || '').trim();
            if (!name){ toast('请输入字段名'); return; }
            data.cols[ci] = name;
            if (!data.colPrompts) data.colPrompts = {};
            data.colPrompts[ci] = (vals.prompt || '').trim();
            data.rev = (data.rev||0) + 1;
            data.updated_at = Date.now();
            syncActiveBack(data);
            refreshUI(data);
          },
          onDelete: function(){
            if (data.cols.length <= 1){ toast('至少保留一列'); return; }
            data.cols.splice(ci, 1);
            (data.rows||[]).forEach(function(r){ r.splice(ci, 1); });
            // 重建 colPrompts 索引
            var newCP = {};
            for (var k in (data.colPrompts||{})){
              var ki = parseInt(k, 10);
              if (ki < ci) newCP[ki] = data.colPrompts[ki];
              else if (ki > ci) newCP[ki - 1] = data.colPrompts[ki];
            }
            data.colPrompts = newCP;
            data.rev = (data.rev||0) + 1;
            data.updated_at = Date.now();
            syncActiveBack(data);
            refreshUI(data);
            toast('已删除列「' + oldName + '」');
          }
        });
        return;
      }

      // 表格内 ＋列 按钮
      if (el.hasAttribute('data-ct-addcol')){
        const data = readCurrentData();
        if (!data?.cols){ toast('请先初始化'); return; }
        meowCTCellPopup({
          title: '添加新列',
          fields: [
            { label:'字段名', key:'name', value:'', type:'input' },
            { label:'发送给 AI 的字段含义提示词', key:'prompt', value:'', type:'textarea' }
          ],
          onConfirm: function(vals){
            const name = (vals.name || '').trim();
            if (!name){ toast('请输入字段名'); return; }
            data.cols.push(name);
            (data.rows||[]).forEach(function(r){ r.push(''); });
            if (!data.colPrompts) data.colPrompts = {};
            if (vals.prompt) data.colPrompts[data.cols.length - 1] = vals.prompt;
            data.rev = (data.rev||0) + 1;
            data.updated_at = Date.now();
            syncActiveBack(data);
            refreshUI(data);
          }
        });
        return;
      }
    });
  }

  // 保存表格数据到单表和多表
  function syncActiveBack(data){
    meowTableMetaWrite(data, false);
    const multi = getMulti();
    meowMultiSetActive(multi, data);
    saveMulti(multi);
  }

  // ===== 暴露给随聊 Tab 使用 =====
  window.__meowSwitchEntry = function(eid){
    switchToEntry(eid);
    // 同时刷新随聊 Tab 的卡片
    try{ if (typeof window.__meowRefreshInlinePreview === 'function') window.__meowRefreshInlinePreview(); }catch(e){}
  };
  window.__meowSyncActiveBack = syncActiveBack;
  window.__meowGetDefaultCols = getDefaultColsForEntry;
  window.__meowRefreshPostCards = function(){ renderCardGrid(getMulti()); refreshUI(getActiveData(getMulti())); };

  // ======== 初始化（初始化当前活跃条目的表格）========
  on('#meow_ct_init', 'click', ()=>{
    const multi = getMulti();
    const activeId = multi.activeEntry || 'role';

    // 找到对应模板
    const def = getDefaultColsForEntry(activeId);
    let tplName = def.name;
    let tplCols = def.cols;
    let tplColPrompts = def.colPrompts || {};

    const existing = meowTableMetaRead();
    if (existing?.cols?.length > 0){
      if (!confirm('还原「' + tplName + '」的默认列设置？当前数据将被清空。')) return;
    }
    const data = {
      template_id: def.tplKey || activeId,
      name: tplName,
      cols: tplCols,
      colPrompts: tplColPrompts,
      rows: [new Array(tplCols.length).fill('')],
      rev: 1,
      updated_at: Date.now()
    };
    syncActiveBack(data);
    renderCardGrid(getMulti());
    refreshUI(data);
    toast('已还原「' + tplName + '」默认设置');
  });

  // ======== 添加行（弹窗填写各列值）========
  on('#meow_tg_preview_hdr', 'click', ()=>{
    var previewBtn = bd.querySelector('#meow_tg_preview');
    if (previewBtn) { previewBtn.click(); } else {
      // fallback: open preview directly
      try{ meowOpenInjectPreview && meowOpenInjectPreview(); }catch(e){}
    }
  });

  // ======== 添加列（弹窗填写列名+提示词）========
  on('#meow_ct_add_col', 'click', ()=>{
    const data = readCurrentData();
    if (!data?.cols){ toast('请先选择条目卡片并初始化'); return; }
    meowCTCellPopup({
      title: '添加新列',
      fields: [
        { label:'字段名', key:'name', value:'', type:'input' },
        { label:'发送给 AI 的字段含义提示词', key:'prompt', value:'', type:'textarea' }
      ],
      onConfirm: function(vals){
        const name = (vals.name || '').trim();
        if (!name){ toast('请输入字段名'); return; }
        data.cols.push(name);
        (data.rows||[]).forEach(function(r){ r.push(''); });
        if (!data.colPrompts) data.colPrompts = {};
        if (vals.prompt) data.colPrompts[data.cols.length - 1] = vals.prompt;
        data.rev = (data.rev||0) + 1;
        data.updated_at = Date.now();
        syncActiveBack(data);
        refreshUI(data);
      }
    });
  });

  // ======== 写入世界书可视化 ========
  on('#meow_ct_to_wbv', 'click', ()=>{
    const data = readFromDOM();
    if (!data?.cols){ toast('无数据'); return; }
    const ok = meowCTWriteToWBV(data);
    if (ok){
      toast('已写入世界书可视化 ✓');
    } else {
      try{
        const text = meowCTToText(data);
        pushToLocalWBSection(text, data.name || '调表');
        toast('已写入本地世界书 ✓');
      }catch(e){ toast('写入失败'); }
    }
  });

  // ======== 复制 ========
  on('#meow_ct_export', 'click', ()=>{
    const data = readFromDOM();
    if (!data){ toast('无数据'); return; }
    const text = meowCTToText(data);
    try{ navigator.clipboard.writeText(text); toast('已复制'); }catch(e){
      try{
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta); toast('已复制');
      }catch(e2){ toast('复制失败'); }
    }
  });

  // ======== 清空（当前条目）========
  on('#meow_ct_clear', 'click', ()=>{
    const multi = getMulti();
    const activeId = multi.activeEntry || 'role';
    const entryList = meowMultiGetEntryList(multi);
    const ent = entryList.find(e=>e.id===activeId);
    if (!confirm('确认清空当前条目「' + (ent?.name||activeId) + '」的表格数据？')) return;

    // 清该条目
    if (multi.entries) delete multi.entries[activeId];
    saveMulti(multi);

    meowMetaWrite(MEOW_META_TABLE_KEY, null);
    const uid = getCUID();
    const db = lsGet(LS_CHAT_TABLE, { map:{} });
    if (db.map) delete db.map[uid];
    lsSet(LS_CHAT_TABLE, db);

    renderCardGrid(multi);
    refreshUI(null);
    toast('已清空');
  });

  // ======== 聊天切换回调 ========
  const _prevSwitch = window.__MEOW_SUM_CHAT_SWITCH__;
  window.__MEOW_SUM_CHAT_SWITCH__ = (newUID)=>{
    try{ if (typeof _prevSwitch === 'function') _prevSwitch(newUID); }catch(e){}
    refreshUI(null);
    if (emptyEl) emptyEl.textContent = '正在加载…';
    setTimeout(()=> doSync('chatSwitch'), 100);
  };

  // ======== 默认折叠 ========
  var detailsEl = doc.querySelector('#meow_tpl_sec');
  if (detailsEl) detailsEl.removeAttribute('open');

  // ======== 表格条目组预设 存/删 ========
  const LS_GROUP_PRESETS = 'meow_ct_group_presets_v1';

  function refreshGroupSelect(){
    const sel = doc.querySelector('#meow_ct_group_select');
    if (!sel) return;
    sel.innerHTML = '<option value="">(选择模板)</option>';
    sel.innerHTML += '<option value="default">默认预设（6条目）</option>';
    const gp = lsGet(LS_GROUP_PRESETS, { list:[] });
    for (let gi=0; gi<gp.list.length; gi++){
      const opt = doc.createElement('option');
      opt.value = 'gp_' + gi;
      opt.textContent = '⭐ ' + (gp.list[gi].name || '自定义组' + gi);
      sel.appendChild(opt);
    }
  }
  refreshGroupSelect();

  // 初始化：用选中的组预设初始化全部条目
  // （重载 #meow_ct_init 的行为 — 如果选了组预设，则批量初始化）
  const origInitHandler = doc.querySelector('#meow_ct_init');
  if (origInitHandler){
    // 已绑定了上面的 on('#meow_ct_init') 用于单条目初始化
    // 但如果 group_select 有选值，走批量初始化
  }

  on('#meow_ct_preset_save', 'click', ()=>{
    const multi = getMulti();
    if (!multi.entries || !Object.keys(multi.entries).length){
      toast('当前无表格数据可保存为组预设'); return;
    }
    const name = (prompt('表格条目组预设名称：') || '').trim();
    if (!name) return;
    const gp = lsGet(LS_GROUP_PRESETS, { list:[] });
    gp.list.push({
      name: name,
      entries: JSON.parse(JSON.stringify(multi.entries)),
      customEntries: multi.customEntries ? JSON.parse(JSON.stringify(multi.customEntries)) : [],
      savedAt: Date.now()
    });
    lsSet(LS_GROUP_PRESETS, gp);
    refreshGroupSelect();
    toast('已保存组预设「' + name + '」');
  });

  on('#meow_ct_preset_del', 'click', ()=>{
    const sel = doc.querySelector('#meow_ct_group_select');
    const val = sel?.value;
    if (!val || !val.startsWith('gp_')){ toast('只能删除自定义组预设'); return; }
    const idx = parseInt(val.replace('gp_',''),10);
    const gp = lsGet(LS_GROUP_PRESETS, { list:[] });
    if (!gp.list[idx]){ toast('预设不存在'); return; }
    if (!confirm('确认删除组预设「' + (gp.list[idx].name||'') + '」？')) return;
    gp.list.splice(idx, 1);
    lsSet(LS_GROUP_PRESETS, gp);
    refreshGroupSelect();
    toast('已删除');
  });

  // 加载组预设
  const gpSel = doc.querySelector('#meow_ct_group_select');
  if (gpSel){
    gpSel.addEventListener('change', function(){
      // 仅标记选中，不自动初始化，等用户点"初始化"
    }, {passive:true});
  }

  // ======== 底部规则绑定 ========
  function loadRulesForActiveEntry(entryId){
    try{
      if (!entryId) return;
      const db = lsGet(LS_WB, null);
      if (!db || db.v !== 4) return;
      const fr = (db.frames && db.frames[entryId]) || null;
      const defRules = {
        inject: '把本组"组备注+字段定义+规则"注入总提示词，作为本组总结规范。',
        add:    '当出现新信息：新增行；尽量不重复旧内容。',
        modify: '当信息变化：更新对应字段；必要时合并/拆分行；保持字段语义稳定。',
        del:    '当信息无效：明确标记删除原因；不要悄悄丢失信息。',
      };
      const elEnabled = doc.querySelector('#meow_ct_rule_enabled');
      const elNote    = doc.querySelector('#meow_ct_rule_note');
      const elInj     = doc.querySelector('#meow_ct_r_inj');
      const elAdd     = doc.querySelector('#meow_ct_r_add');
      const elMod     = doc.querySelector('#meow_ct_r_mod');
      const elDel     = doc.querySelector('#meow_ct_r_del');
      if (elEnabled) elEnabled.checked = fr ? (fr.enabled !== false) : true;
      if (elNote)    elNote.value = fr?.note || '';
      if (elInj)     elInj.value  = fr?.rules?.inject || defRules.inject;
      if (elAdd)     elAdd.value  = fr?.rules?.add    || defRules.add;
      if (elMod)     elMod.value  = fr?.rules?.modify || defRules.modify;
      if (elDel)     elDel.value  = fr?.rules?.del    || defRules.del;
    }catch(e){ console.warn('[MEOW] loadRules error:', e); }
  }

  on('#meow_ct_rule_save', 'click', ()=>{
    try{
      const multi = getMulti();
      const entryId = multi.activeEntry || 'role';
      const db = lsGet(LS_WB, null);
      if (!db || db.v !== 4){ toast('世界书数据未初始化'); return; }
      if (!db.frames) db.frames = {};
      if (!db.frames[entryId]) db.frames[entryId] = { enabled:true, note:'', fields:[], rules:{} };
      const fr = db.frames[entryId];
      const elEnabled = doc.querySelector('#meow_ct_rule_enabled');
      const elNote    = doc.querySelector('#meow_ct_rule_note');
      const elInj     = doc.querySelector('#meow_ct_r_inj');
      const elAdd     = doc.querySelector('#meow_ct_r_add');
      const elMod     = doc.querySelector('#meow_ct_r_mod');
      const elDel     = doc.querySelector('#meow_ct_r_del');
      fr.enabled = elEnabled ? !!elEnabled.checked : true;
      fr.note    = elNote ? elNote.value.trim() : '';
      fr.rules = {
        inject: elInj ? elInj.value.trim() : '',
        add:    elAdd ? elAdd.value.trim() : '',
        modify: elMod ? elMod.value.trim() : '',
        del:    elDel ? elDel.value.trim() : '',
      };
      lsSet(LS_WB, db);
      try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
      toast('规则已保存');
    }catch(e){ toast('保存规则失败：' + (e?.message||e)); }
  });

  // 初始加载规则
  setTimeout(function(){
    const multi = getMulti();
    loadRulesForActiveEntry(multi.activeEntry || 'role');
  }, 200);

})();

on('#meow_inject_chat', 'click', ()=> {
  const outText = String(elOut?.value || '').trim();
  if (!outText) { toast('输出为空：先执行总结'); return; }

  // 你可按需改：这里把“本次输出 + 你的本地世界书仓库摘要”一起塞进聊天输入框
  let repo = '';
  try{
    const db = lsGet(LS_WB, null);
    // 如果你用的是 WB_V4（cards结构），就把每个 tab 的第一条卡片正文打包
    if (db?.v === 4 && Array.isArray(db.cards)){
      const pick = db.cards
        .slice()
        .filter(c => c && c.text)
        .slice(0, 12) // 避免太长
        .map(c => `【${c.tab}｜${c.title || c.key || '条目'}】\n${String(c.text).trim()}`)
        .join('\n\n');
      repo = pick;
    }else if (db?.list){
      // 兼容你桥接层的 list 镜像
      repo = db.list.slice(0, 12).map(x=>`【${x.key||x.title||'条目'}】\n${x.content||''}`).join('\n\n');
    }
  }catch(e){}

  const pack =
`[MEOW-记忆包]
（以下内容是本地仓库摘要/本次总结，供你在本轮对话中参考；不要逐字复述，优先用于推理一致性。）

[本次总结]
${outText}

[仓库摘要]
${repo || '（仓库为空或未读取到）'}
[/MEOW-记忆包]`;

  const ok = insertToChatInput(pack);
  toast(ok ? '已插入聊天输入框' : '插入失败：找不到聊天输入框');
});
  // ===== 预设下拉刷新 =====
  function refreshPresetSelects(){
    try{
      const apiBox = lsGet(LS_API_PRESETS, { list: [] });
      const pBox   = lsGet(LS_PROMPT_PRESETS, { list: [] });

      if (elApiPresetSel){
        const cur = elApiPresetSel.value;
        elApiPresetSel.innerHTML =
          `<option value="">（选择预设）</option>` +
          (apiBox.list||[]).map((p,i)=>`<option value="${i}">${String(p.name||'未命名')}</option>`).join('');
        elApiPresetSel.value = cur;
      }

      if (elPromptPresetSel){
        const cur2 = elPromptPresetSel.value;
        elPromptPresetSel.innerHTML =
          `<option value="">（选择预设）</option>` +
          (pBox.list||[]).map((p,i)=>`<option value="${i}">${String(p.name||'未命名')}</option>`).join('');
        elPromptPresetSel.value = cur2;
      }
    }catch(e){}
  }

  // ===== 自动写入开关 =====
  if (elAutoOn) {
    elAutoOn.checked = !!lsGet(LS_AUTO_ON, true);
    elAutoOn.addEventListener('change', () => {
      lsSet(LS_AUTO_ON, !!elAutoOn.checked);
      void(0)&&console.log('[MEOW][AutoSwitch] 自动写入开关切换:', elAutoOn.checked ? '开启' : '关闭');
      toast(elAutoOn.checked ? '自动写入已开启' : '自动写入已关闭');
    }, { passive:false });
  }

// ===== 每次发送自动附加"记忆包"开关 =====
const elAutoSend = $('#meow_auto_send_pack');
if (elAutoSend){
  elAutoSend.checked = !!lsGet(LS_AUTO_SEND_PACK, false);
  elAutoSend.addEventListener('change', ()=>{
    lsSet(LS_AUTO_SEND_PACK, !!elAutoSend.checked);
    try{ meowRefreshAutoPackPrompt(!elAutoSend.checked); }catch(e){}
    toast(elAutoSend.checked ? '已开启：每次发送自动附加记忆包' : '已关闭：不再自动附加');
  }, {passive:false});
}

// ===== 记忆包注入位置/深度/角色/扫描 =====
(function(){
  const elPos   = $('#meow_inject_pos');
  const elDepth = $('#meow_inject_depth');
  const elRole  = $('#meow_inject_role');
  const elScan  = $('#meow_inject_scan');
  if (elPos)   elPos.value   = String(lsGet(LS_INJECT_POS, 2));
  if (elDepth) elDepth.value = String(lsGet(LS_INJECT_DEPTH, 1));
  if (elRole)  elRole.value  = String(lsGet(LS_INJECT_ROLE, 'system'));
  if (elScan)  elScan.value  = String(lsGet(LS_INJECT_SCAN, 'false'));
  function saveInject(){
    if (elPos)   lsSet(LS_INJECT_POS, parseInt(elPos.value,10)||2);
    if (elDepth) lsSet(LS_INJECT_DEPTH, parseInt(elDepth.value,10)||1);
    if (elRole)  lsSet(LS_INJECT_ROLE, elRole.value||'system');
    if (elScan)  lsSet(LS_INJECT_SCAN, elScan.value||'false');
    // 同步刷新随聊注入（因为它复用同一套位置/深度设置）
    try{ meowInlineInjectIfNeeded(); }catch(e){}
    // 同步刷新记忆包
    try{ meowRefreshAutoPackPrompt(false); }catch(e){}
  }
  [elPos,elDepth,elRole,elScan].forEach(el=>{
    if(el) el.addEventListener('change', saveInject, {passive:true});
  });
})();

// ===== 保留最后N层不总结 =====
(function(){
  const elSkip = $('#meow_skip_last');
  if (elSkip){
    elSkip.value = String(lsGet(LS_SKIP_LAST_N, 0));
    elSkip.addEventListener('change', ()=>{
      lsSet(LS_SKIP_LAST_N, Math.max(0, parseInt(elSkip.value,10)||0));
    }, {passive:true});
  }
})();

  
// ===== 自动总结：区间/频率输入持久化（关弹窗不丢）=====
(function(){
  try{
    const uid = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : '';
    const st  = (typeof meowLoadChatState === 'function') ? meowLoadChatState(uid) : {};
    const elI = $('#meow_interval');
    const elO = $('#meow_offset');
    const elF = $('#meow_floor_from');
    const elT = $('#meow_floor_to');

    // 1) 初次回填（优先 per-chat；其次全局进度；最后默认值）
    try{
      if (elI) elI.value = String((st && st.interval != null) ? st.interval : (lsGet('meow_sum_interval_v1', null) ?? elI.value ?? 20));
      if (elO) elO.value = String((st && st.batchSize != null) ? st.batchSize : (lsGet('meow_sum_batch_v1', null) ?? elO.value ?? 10));
    }catch(e){}

    // 2) 监听保存：输入变化立即写入
    function save(){
      const interval = Math.max(1, parseInt(elI?.value || '20', 10));
      const batchSize = Math.max(1, parseInt(elO?.value || '10', 10));
      // per-chat
      try{ if (typeof meowSaveChatState === 'function') meowSaveChatState(uid, { interval, batchSize }); }catch(e){}
      // 额外全局兜底（防止某些版本 per-chat 写失败）
      try{ lsSet('meow_sum_interval_v1', interval); lsSet('meow_sum_batch_v1', batchSize); }catch(e){}
    }

    function saveFloors(){
      const fromRaw = String(elF?.value || '').trim();
      const toRaw   = String(elT?.value || '').trim();
      const lastFrom = fromRaw ? parseInt(fromRaw,10) : null;
      const lastTo   = toRaw   ? parseInt(toRaw,10)   : null;
      try{ if (typeof meowSaveChatState === 'function') meowSaveChatState(uid, { lastFrom, lastTo }); }catch(e){}
      try{ tgSaveProgress({ lastFrom, lastTo }); }catch(e){}
    }

    [elI, elO].forEach(el=>{
      if (!el) return;
      el.addEventListener('input', save, {passive:true});
      el.addEventListener('change', save, {passive:true});
      el.addEventListener('blur', save, {passive:true});
    });
    [elF, elT].forEach(el=>{
      if (!el) return;
      el.addEventListener('input', saveFloors, {passive:true});
      el.addEventListener('change', saveFloors, {passive:true});
      el.addEventListener('blur', saveFloors, {passive:true});
    });
  }catch(e){}
})();
// ===== 模式切换：写入基础提示词；表格模式后续会在“执行时”注入条目组 =====
  function applyModeToPrompt(mode){
    if (!elPrompt) return;
    if (mode === 'custom') return;
    const t = BUILTIN[mode] || BUILTIN.big;
    elPrompt.value = t;
    lsSet(LS_PROMP, elPrompt.value || '');
  }
  if (elMode && !String(promptNow || '').trim()) applyModeToPrompt(elMode.value || 'big');

  // ===== 偏移量文案：表格模式更直观 =====
  function refreshRuleLabels(){
    const mode = elMode?.value || 'big';
    const a = $('#meow_lbl_interval');
    const b = $('#meow_lbl_offset');

    if (!a || !b) return;

    if (mode === 'table'){
      a.textContent = '每 N 层自动更新一次';
      b.textContent = '每批次更新楼层数';
    } else {
      a.textContent = '间隔 N（条）';
      b.textContent = '偏移量 X（条）';
    }
  }
  refreshRuleLabels();
  on('#meow_mode', 'change', () => {
  const mode = elMode.value;
  refreshRuleLabels();
  applyModeToPrompt(mode);
  // ✅ 保存模式到 per-chat
  meowSaveChatState(__chatUID, { mode: mode });
});

  // ===== 表格条目组 =====
  on('#meow_open_tg', 'click', ()=> {
  if (typeof openWorldBookModal === 'function') {
    openWorldBookModal();
  } else {
    toast('世界书模块未加载');
  }
});
  on('#meow_tg_preview_hdr', 'click', ()=>{
    // 注入预览（表头替换按钮）
    var origBtn = bd.querySelector('#meow_tg_preview');
    if (origBtn) { origBtn.click(); return; }
    const inj = tgBuildInjectionText ? tgBuildInjectionText() : null;
    if (!inj) { toast('当前没有启用的条目组'); return; }
    const bdPv = modalShell('meow-tg-preview', '本次注入预览', '👀');
    bdPv.innerHTML = `<div class="sec"><h3>👀 注入内容</h3><textarea style="min-height:260px;">${inj.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea></div>`;
  });
  on('#meow_tg_preview', 'click', ()=>{
    const inj = tgBuildInjectionText();
    if (!inj) { toast('当前没有启用的条目组'); return; }
    const bd2 = modalShell('meow-tg-preview', '本次注入预览', '👀');
    bd2.innerHTML = `
      <div class="sec">
        <h3>👀 注入内容</h3>
        <textarea style="min-height:260px;">${inj.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
      </div>
    `;
  });

  // ===== API：保存/清空 =====
  on('#meow_save_api', 'click', () => {
    const v = {
      baseUrl: (elBase?.value || '').trim(),
      apiKey:  (elKey?.value  || '').trim(),
      model:   (elModelI?.value || '').trim()
    };
    lsSet(LS_API, v);
    if (elState) elState.textContent = `当前URL：${v.baseUrl || '未设置'} ｜ 模型：${v.model || '未选'}`;
    toast('已保存API配置');
  });

  on('#meow_clear_api', 'click', () => {
    lsSet(LS_API, { baseUrl:'', apiKey:'', model:'' });
    if (elBase) elBase.value = '';
    if (elKey)  elKey.value  = '';
    if (elModelI) elModelI.value = '';
    if (elState) elState.textContent = `当前URL：未设置 ｜ 模型：未选`;
    toast('已清空API配置');
  });

  // ===== API：预设 保存 / 删除 / 下拉调取 =====
  on('#meow_api_preset_save', 'click', () => {
    const name = (prompt('给这个 API 预设起个名字：') || '').trim();
    if (!name) { toast('已取消'); return; }

    const item = {
      name,
      baseUrl: (elBase?.value || '').trim(),
      apiKey:  (elKey?.value  || '').trim(),
      model:   (elModelI?.value || '').trim()
    };

    const box = lsGet(LS_API_PRESETS, { list: [] });
    const idx = (box.list||[]).findIndex(x => String(x.name||'') === name);
    if (idx >= 0) box.list[idx] = item;
    else box.list.unshift(item);
    box.list = box.list.slice(0, 40);
    lsSet(LS_API_PRESETS, box);

    toast('已保存为API预设');
    refreshPresetSelects();
  });

  on('#meow_api_preset_del', 'click', () => {
    const i = parseInt(elApiPresetSel?.value || '', 10);
    if (!Number.isFinite(i)) { toast('先选择一个预设'); return; }
    const box = lsGet(LS_API_PRESETS, { list: [] });
    box.list.splice(i, 1);
    lsSet(LS_API_PRESETS, box);
    toast('已删除API预设');
    refreshPresetSelects();
  });

  on('#meow_api_preset_select', 'change', () => {
    const i = parseInt(elApiPresetSel?.value || '', 10);
    if (!Number.isFinite(i)) return;
    const box = lsGet(LS_API_PRESETS, { list: [] });
    const p = box.list?.[i];
    if (!p) return;
    if (elBase) elBase.value = p.baseUrl || '';
    if (elKey)  elKey.value  = p.apiKey  || '';
    if (elModelI) elModelI.value = p.model || '';
    if (elState) elState.textContent = `当前URL：${p.baseUrl || '未设置'} ｜ 模型：${p.model || '未选'}`;
    lsSet(LS_API, { baseUrl: p.baseUrl||'', apiKey:p.apiKey||'', model:p.model||'' });
    toast(`已载入：${p.name || '预设'}`);
  });

  // ===== Prompt：保存当前 =====
  on('#meow_save_prompt', 'click', () => {
  lsSet(LS_PROMP, elPrompt?.value || '');
  // ✅ 同时保存到 per-chat
  meowSaveChatState(__chatUID, { prompt: elPrompt?.value || '' });
  toast('已保存当前总结词');
});

  // ===== Prompt：预设 保存 / 删除 / 下拉调取 =====
  on('#meow_prompt_preset_save', 'click', () => {
    const name = (prompt('给这个 总结词 预设起个名字：') || '').trim();
    if (!name) { toast('已取消'); return; }
    const item = { name, text: String(elPrompt?.value || '').trim() };

    const box = lsGet(LS_PROMPT_PRESETS, { list: [] });
    const idx = (box.list||[]).findIndex(x => String(x.name||'') === name);
    if (idx >= 0) box.list[idx] = item;
    else box.list.unshift(item);
    box.list = box.list.slice(0, 80);
    lsSet(LS_PROMPT_PRESETS, box);

    toast('已保存为总结词预设');
    refreshPresetSelects();
  });

  on('#meow_prompt_preset_del', 'click', () => {
    const i = parseInt(elPromptPresetSel?.value || '', 10);
    if (!Number.isFinite(i)) { toast('先选择一个预设'); return; }
    const box = lsGet(LS_PROMPT_PRESETS, { list: [] });
    box.list.splice(i, 1);
    lsSet(LS_PROMPT_PRESETS, box);
    toast('已删除总结词预设');
    refreshPresetSelects();
  });

  on('#meow_prompt_preset_select', 'change', () => {
    const i = parseInt(elPromptPresetSel?.value || '', 10);
    if (!Number.isFinite(i)) return;
    const box = lsGet(LS_PROMPT_PRESETS, { list: [] });
    const p = box.list?.[i];
    if (!p) return;
    if (elPrompt) elPrompt.value = p.text || '';
    lsSet(LS_PROMP, elPrompt?.value || '');
    if (elMode) elMode.value = 'custom';
    refreshRuleLabels();
    toast(`已载入：${p.name || '预设'}`);
  });

// ===== 世界书入口 / 输出复制 =====
on('#meow_view_wb', 'click', () => openWorldbookModal());

on('#meow_copy_out', 'click', async () => {
  try{ await navigator.clipboard.writeText(elOut?.value || ''); toast('已复制'); }
  catch(e){ toast('复制失败（iOS 有时会拦）'); }
});
// ✅ 输出区：手动上传到“酒馆世界书”（真正写入 World Info 数据层）
// 说明：默认走“角色绑定世界书”；你也可以临时指定一个世界书名
on('#meow_upload_out', 'click', async ()=>{
  const outText = String(elOut?.value || '').trim();
  if (!outText) { toast('输出为空：先执行总结'); return; }

  const bdUp = modalShell('meow-upload-out-modal', '上传到酒馆世界书', '⬆');
  bdUp.innerHTML = `
    <div class="sec">
      <h3>上传目标</h3>
      <label>条目 Key（= 酒馆条目的 comment 字段）</label>
      <input id="meow_up_key" value="Summary">
      <div class="hint" style="margin-top:8px;">
        会通过 TavernHelper 直接写入当前角色绑定的主世界书。<br>
        已有同名条目 → 更新内容；没有 → 新建。
      </div>
      <div class="row" style="margin-top:10px;">
        <button class="btn primary" id="meow_up_go">确认上传</button>
        <button class="btn" id="meow_up_cancel">取消</button>
      </div>
    </div>
  `;

  bdUp.querySelector('#meow_up_cancel')?.addEventListener('click', ()=>{
    closeModal('meow-upload-out-modal');
  }, {passive:false});

  bdUp.querySelector('#meow_up_go')?.addEventListener('click', async ()=>{
    const key = String(bdUp.querySelector('#meow_up_key')?.value || 'Summary').trim() || 'Summary';
    const keys = key.split(',').map(s=>s.trim()).filter(Boolean);
    toast('写入中...');
    try {
      // 优先 TavernHelper
      if (typeof MEOW_WB_API !== 'undefined' && typeof MEOW_WB_API.upsertByComment === 'function') {
        const canDo = await MEOW_WB_API.canWrite();
        if (canDo) {
          // ✅按聊天隔离：comment 自动加 [cxxxx] 前缀，但 keys 保持原样（Summary 等仍好读/好触发）
const __chatUID = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : '';
const baseComment = (Array.isArray(keys) && keys.length) ? keys[0] : (key || 'Summary');
const taggedComment = (typeof meowTaggedComment === 'function')
  ? meowTaggedComment(baseComment, __chatUID || '')
  : baseComment;

await MEOW_WB_API.upsertByComment({
  comment: taggedComment,
  content: outText,
  keys: (Array.isArray(keys) && keys.length) ? keys : [baseComment],
  enabled: true,
  type: 'constant',
  order: 9999,
  prevent_recursion: true
});

// 立刻切一次 enabled，保证当前聊天马上生效、别的聊天马上失效
try { if (typeof meowToggleTavernEntries === 'function') await meowToggleTavernEntries(__chatUID || ''); } catch(e){}

toast('已写入酒馆世界书（按聊天隔离）');
closeModal('meow-upload-out-modal');
return;

        }
      }
      // 其次试旧桥接
      const fn = window.meowSyncToWorldInfo ||
                 window.top?.meowSyncToWorldInfo ||
                 window.parent?.meowSyncToWorldInfo;
      if (typeof fn === 'function') {
        const ret = await fn({ key, title: key, content: outText });
        if (ret === true || (ret && (ret.ok || ret.success))) {
          toast('已写入酒馆世界书');
          closeModal('meow-upload-out-modal');
          return;
        }
      }
      toast('写入失败：TavernHelper 和桥接层均不可用');
    } catch(e) {
      toast('写入异常：' + (e?.message || e));
    }
  }, {passive:false});
});

on('#meow_save_multi', 'click', async ()=>{
  const outText = String(elOut?.value || '').trim();
  if (!outText) { toast('先执行总结，输出为空'); return; }

  const target = ($('#meow_save_target')?.value || 'wb_local');
  const book   = String($('#meow_save_book')?.value || '').trim();
  const keysRaw= String($('#meow_save_keys')?.value || '').trim();

  const keys = keysRaw
    ? keysRaw.split(',').map(s=>s.trim()).filter(Boolean)
    : ['Summary'];

  // 本地世界书：写进 overview 分组
  function saveLocal(key, text){
    try{
      wbSaveSummaryToGroup('overview', key, text);
    }catch(e){
      const wb = lsGet(LS_WB_V2, { entries: [] });
      wb.entries.unshift({ t: Date.now(), key, text });
      wb.entries = wb.entries.slice(0, 500);
      lsSet(LS_WB_V2, wb);
    }
  }

  // ✅ 酒馆世界书写入：做一层“兼容封装”
 // ✅ 酒馆世界书写入：兼容多种返回值/多窗口
async function writeToSillyTavernWorldInfo({ bookName, entryKeys, text }){
  const fn =
    window.meowSyncToWorldInfo ||
    window.top?.meowSyncToWorldInfo ||
    window.parent?.meowSyncToWorldInfo;

  if (typeof fn !== 'function') return false;

  const isOk = (ret) => {
    if (ret === true) return true;
    if (!ret) return false;
    if (ret === 'ok' || ret === 'OK') return true;
    if (typeof ret === 'object' && (ret.ok === true || ret.success === true)) return true;
    return false;
  };

  // 形态 A：fn({book, keys, text})
  try{
    const retA = await fn({ book: bookName, keys: entryKeys, text });
    if (isOk(retA)) return true;
  }catch(e){}

  // 形态 B：fn(book, key, text)
  try{
    let okAny = false;
    for (const k of entryKeys){
      const retB = await fn(bookName, k, text);
      if (isOk(retB)) okAny = true;
    }
    if (okAny) return true;
  }catch(e){}

  // 形态 C：fn({bookName, entries:[{key,text}]})
  try{
    const retC = await fn({ bookName, entries: entryKeys.map(k=>({ key:k, text })) });
    if (isOk(retC)) return true;
  }catch(e){}

  return false;
}


  // 酒馆世界书写入
let ok = false;
try {
  // 优先 TavernHelper
  if (typeof MEOW_WB_API !== 'undefined' && typeof MEOW_WB_API.upsertByComment === 'function') {
    const canDo = await MEOW_WB_API.canWrite();
    if (canDo) {
      const __chatUID = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : '';
for (const k of keys){
  const base = String(k || '').trim();
  if (!base) continue;

  const tagged = (typeof meowTaggedComment === 'function')
    ? meowTaggedComment(base, __chatUID || '')
    : base;

  await MEOW_WB_API.upsertByComment({
    comment: tagged,
    content: outText,
    keys: [base],          // keys 不带 tag
    enabled: true,
    type: 'constant',
    order: 9999,
    prevent_recursion: true
  });
}

// 写完立即切一次，避免你肉眼看到“还是上一份在生效”
try { if (typeof meowToggleTavernEntries === 'function') await meowToggleTavernEntries(__chatUID || ''); } catch(e){}

ok = true;

    }
  }
  // 回退：旧桥接
  if (!ok) {
    const fn = window.meowSyncToWorldInfo ||
               window.top?.meowSyncToWorldInfo ||
               window.parent?.meowSyncToWorldInfo;
    if (typeof fn === 'function') {
      for (const k of keys) {
        const ret = await fn({ book: book || '', key: k, title: k, content: outText });
        if (ret === true || (ret && (ret.ok || ret.success))) ok = true;
      }
    }
  }
} catch(e){
  ok = false;
}

  if (ok){
    toast('完成（已写入酒馆世界书）');
  } else {
    toast('写入失败：请先打开 World Info，并确认目标世界书存在');
  }
});

  // ====== 兼容：拉取模型列表（若接口不兼容也不崩）=====
  on('#meow_load_models', 'click', async () => {
    const baseUrl = (elBase?.value || '').trim();
    const apiKey  = (elKey?.value  || '').trim();
    if (!baseUrl) { toast('先填 API 基础 URL'); return; }
    toast('加载模型中…');
    try{
  const names = await loadModels(baseUrl, apiKey);
  if (!names || !names.length){
    toast('没拿到模型列表（接口不兼容/CORS/未实现 /models）');
    return;
  }

  // 弹一个小窗让你点选，并写回模型输入框
  const bd2 = modalShell('meow-model-picker', '选择模型', '📦');
  bd2.innerHTML = `
    <div class="sec">
      <h3>可用模型（点一下自动填入）</h3>
      <div class="hint">如果列表太长，直接在上方“模型输入框”里手填也可以。</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow:auto;">
        ${names.slice(0,200).map(n=>`
          <button class="btn" data-mpick="${String(n).replace(/"/g,'&quot;')}" style="text-align:left;">
            ${String(n).replace(/</g,'&lt;').replace(/>/g,'&gt;')}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  bd2.querySelectorAll('[data-mpick]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const m = btn.getAttribute('data-mpick') || '';
      if (elModelI) elModelI.value = m;
      const cfg = lsGet(LS_API, { baseUrl:'', apiKey:'', model:'' });
      lsSet(LS_API, { ...cfg, baseUrl: (elBase?.value||cfg.baseUrl||''), apiKey:(elKey?.value||cfg.apiKey||''), model:m });
      if (elState) elState.textContent = `当前URL：${(elBase?.value||'')||'未设置'} ｜ 模型：${m||'未选'}`;
      toast('已选择模型并写入');
      closeModal('meow-model-picker');
    }, {passive:false});
  });

  toast(`拿到 ${names.length} 个模型`);
} catch(e){
  toast('加载失败：可能 CORS / 接口不兼容 / URL 不对');
}

  });

  // ===================== 【执行总结】核心：From/To 默认到最新 + 表格注入 + 记录已总结 =====================
  on('#meow_run_auto', 'click', async () => {
    __chatUID = meowGetChatUID();
    const cfg = lsGet(LS_API, { baseUrl:'', apiKey:'', model:'' });
    const baseUrl = ((elBase?.value || cfg.baseUrl) || '').trim();
    const apiKey  = ((elKey?.value  || cfg.apiKey ) || '').trim();
    const model   = ((elModelI?.value|| cfg.model ) || '').trim();

    if (!baseUrl) { toast('先填 API 基础 URL'); return; }
    if (!model)   { toast('先填 模型'); return; }

    const mode = elMode?.value || 'big';

    const interval = Math.max(1, parseInt($('#meow_interval')?.value || '20', 10)); // 每N层自动总结一次
    const batchSize = Math.max(1, parseInt($('#meow_offset')?.value || '10', 10)); // 每批次更新楼层数

    // 1) 读楼层范围：如果填了 From，但 To 不填，则默认到最新楼层
    const fromRaw = String($('#meow_floor_from')?.value || '').trim();
    const toRaw   = String($('#meow_floor_to')?.value   || '').trim();
    const from = fromRaw ? parseInt(fromRaw, 10) : NaN;
    let   to   = toRaw   ? parseInt(toRaw,   10) : NaN;

    // 计算“最新楼层”（优先 #数字，其次 mesid）
    const latestFloor = meowGetLatestFloorFromDOM();

    // ✅ 如果 To 填得超过最新楼层，自动夹到最新
    if (Number.isFinite(to) && Number.isFinite(latestFloor) && to > latestFloor) to = latestFloor;

    // ✅ 保留最后N层不总结
    const skipLastN = Math.max(0, parseInt(lsGet(LS_SKIP_LAST_N, 0), 10) || 0);
    if (skipLastN > 0 && Number.isFinite(latestFloor)){
      const effectiveMax = latestFloor - skipLastN;
      if (effectiveMax < 1){ toast('保留最后'+skipLastN+'层后无内容可总结'); return; }
      if (Number.isFinite(to) && to > effectiveMax) to = effectiveMax;
      // 对后面 autoRange 也限制
      if (!Number.isFinite(to)) to = effectiveMax;
    }

    // 1) 如果只填了 From：默认取到最新楼层
    if (Number.isFinite(from) && !Number.isFinite(to)){
      to = Number.isFinite(latestFloor) ? latestFloor : from;
    }

    // 2) 如果 From/To 都没填：默认取“最新楼层往回 X 条”
    let autoRange = null;
    if (!Number.isFinite(from) && !Number.isFinite(to) && Number.isFinite(latestFloor)){
      const hi = latestFloor;
      const lo = Math.max(1, hi - batchSize + 1);
      autoRange = { lo, hi };
    }
    // 2) 抓取内容：支持按间隔N分批
    let chunks = [];  // [{from, to, text}]
    let usedFrom = null, usedTo = null, usedN = null;

    if (Number.isFinite(from) && Number.isFinite(to)) {
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      usedFrom = lo; usedTo = hi;
      // 按 batchSize 拆批（每批处理 batchSize 个楼层）
      for (let batchStart = lo; batchStart <= hi; batchStart += batchSize){
        const batchEnd = Math.min(batchStart + batchSize - 1, hi);
        const arr = getMesTextByFloorRange(batchStart, batchEnd);
        const txt = (arr || []).join('\n\n---\n\n');
        if (txt.trim()){
          chunks.push({ from: batchStart, to: batchEnd, text: txt });
        }
      }

      if (!chunks.length) { toast('这个楼层区间没抓到消息（检查气泡里是否有 #数字）'); return; }
      toast(`总结中（楼层 ${lo} ~ ${hi}，共 ${chunks.length} 批）…`);
      showSumLoading(`总结中… 0/${chunks.length}`, 0);
    } else {
      // ✅ 没填楼层：默认取“最新楼层往回 X 楼”（X = 偏移量/每次更新楼层数）
      let singleChunk = '';
      usedFrom = null; usedTo = null; usedN = null;

      if (autoRange){
        try{
          const arr = getMesTextByFloorRange(autoRange.lo, autoRange.hi);
          singleChunk = (arr || []).join('\n\n---\n\n');
          if (singleChunk.trim()){
            usedFrom = autoRange.lo;
            usedTo   = autoRange.hi;
          }
        }catch(e){}
      }

      // 兜底：如果没有 #楼层可抓，退回“最近 X 条可见气泡”
      if (!singleChunk.trim()){
        singleChunk = getVisibleMesTextList(batchSize).join('\n\n---\n\n');
        usedN = batchSize;

        // 尝试从这批气泡里反推 From/To（优先 #数字，其次 mesid）
        try{
          const mesNodes = $qa('.mes');
          const startIdx = Math.max(0, mesNodes.length - batchSize);
          const floors = [];
          for (let i = startIdx; i < mesNodes.length; i++){
            const txt = (mesNodes[i].querySelector('.mes_text')?.innerText || mesNodes[i].innerText || '');
            const fm = txt.match(/#(\d+)/);
            if (fm) floors.push(parseInt(fm[1], 10));
            else {
              const mid = mesNodes[i].getAttribute('mesid') || mesNodes[i].dataset?.mesid;
              if (mid != null && mid !== '' && !isNaN(mid)) floors.push(parseInt(mid, 10));
            }
          }
          if (floors.length){
            usedFrom = Math.min(...floors);
            usedTo   = Math.max(...floors);
          }
        }catch(e){}
      }

      if (!singleChunk.trim()) { toast('没有可总结的内容'); return; }

      chunks.push({ from: usedFrom, to: usedTo, text: singleChunk });
      toast(`总结中（默认取最新 ${batchSize} 楼：${usedFrom||'?'} ~ ${usedTo||'?'}）…`);
      showSumLoading(`总结中… 0/${chunks.length}`, 0);
    }

    // 3) 构造最终系统提示词
    let promptText = String(elPrompt?.value || '').trim();
    if (mode === 'table'){
      const inj = tgBuildInjectionText();
      if (inj) promptText = (promptText ? (promptText + '\n\n' + inj) : inj);
    }

    // 4) 逐批调模型，合并输出
    let allOuts = [];
    let out = '';
    try{
      for (let bi = 0; bi < chunks.length; bi++){
        const ck = chunks[bi];
        const batchLabel = `\n===== 第${bi+1}/${chunks.length}批（楼层 ${ck.from||'?'} ~ ${ck.to||'?'}） =====\n`;

        showSumLoading(`正在总结第 ${bi+1}/${chunks.length} 批（楼层 ${ck.from||'?'}~${ck.to||'?'}）`, Math.round((bi/chunks.length)*100));

        const batchOut = await callLLM(baseUrl, apiKey, model, promptText, ck.text);
        const trimmed = String(batchOut || '').trim();
        allOuts.push({ from: ck.from, to: ck.to, text: trimmed, label: batchLabel });
      }

      // 合并所有批次
      out = allOuts.map(b => b.label + b.text).join('\n').trim();
      hideSumLoading();
if (elOut) elOut.value = out;
      // ✅ 生成结果写入 chat.extra.meow_summary，并让 ST 持久化到 jsonl
      try{ saveLastOut(out, { generated:true, generatedAt: Date.now() }); }catch(e){}
      // 轻状态：只记录时间/进度等，不再存大文本
      try{ meowSaveChatState(__chatUID, { lastSummaryAt: Date.now() }); }catch(e){}

      function splitSectionsByTag(text){
        const map = {};
        const src = String(text || '').replace(/\r/g, '');
        const lines = src.split('\n');
        let cur = '';
        let buf = [];
        const flush = () => { const body = buf.join('\n').trim(); if (cur && body) map[cur] = body; };
        for (let i = 0; i < lines.length; i++){
          const raw = String(lines[i] || '');
          const s = raw.trim();
          let m = s.match(/^(?:【\s*([^】\n]{1,50})\s*】|\[\s*([^\]\n]{1,50})\s*\]|\(\s*([^)\\n]{1,50})\s*\)|（\s*([^）\n]{1,50})\s*）)$/);
          if (!m) m = s.match(/^#{1,6}\s*([^\n#]{1,50})\s*$/);
          if (m){
            const title = String(m[1] || m[2] || m[3] || m[4] || m[5] || '').trim();
            if (title){ flush(); cur = title; buf = []; continue; }
          }
          if (cur) buf.push(raw);
        }
        flush();
        return map;
      }
    } catch(e){
      toast('调用失败：检查URL/密钥/接口兼容');
hideSumLoading();
      return;
    }

    // 5) 记录"已总结楼层/最近N"：写入 per-chat 状态（不再用全局 tgSaveProgress）
    const progPatch = {};
    if (usedFrom != null && usedTo != null){
      progPatch.lastFrom = usedFrom;
      progPatch.lastTo   = usedTo;
      progPatch.lastN    = null;
    } else {
      progPatch.lastFrom = null;
      progPatch.lastTo   = null;
      progPatch.lastN    = usedN;
    }
    meowSaveChatState(__chatUID, progPatch);
    // 兼容：也写一份全局（旧逻辑不崩）
    tgSaveProgress(progPatch);

    // 更新界面 label
    const hint = $('#meow_run_hint');
    if (hint){
      const pf = progPatch.lastFrom, pt = progPatch.lastTo, pn = progPatch.lastN;
      hint.textContent = `已总结：${pf && pt ? `第${pf}~${pt}楼（共${pt-pf+1}条）` : '暂无'} ｜ 最近N：${pn || 30}`;
    }
    try {
      const lf = document.querySelector('#meow_floor_from')?.previousElementSibling;
      if (lf) lf.textContent = `楼层 From（已总结到: ${progPatch.lastFrom || '暂无'}）`;
      const lt = document.querySelector('#meow_floor_to')?.previousElementSibling;
      if (lt) lt.textContent = `楼层 To（最新: ${progPatch.lastTo || '暂无'}）`;
    } catch(e){}

// ===================== 6) 自动写入（黑科技稳定版：分流→落镜像→写酒馆→失败入队） =====================
const autoWrite = !!lsGet(LS_AUTO_ON, true);
void(0)&&console.log('[MEOW][AutoWrite] 开关状态:', autoWrite ? '开启' : '关闭');
const isTable = (mode === 'table');

// 分区解析：优先用你上面已经写好的 splitSectionsByTag
function meowSplitSections(text){
  try{
    const m = splitSectionsByTag(text);
    if (m && Object.keys(m).length) return m;
  }catch(e){}
  return {};
}

// 写入目标：st_role / st_wb / wb_local
const target = (($('#meow_upload_target') || $('#meow_save_target'))?.value || 'st_role');

// 解析目标世界书名
let worldName = '';
if (target === 'st_role'){
  // 优先用 TavernHelper 获取主世界书名
  try {
    if (typeof MEOW_WB_API !== 'undefined' && typeof MEOW_WB_API.canWrite === 'function') {
      const canDo = await MEOW_WB_API.canWrite();
      if (canDo) {
        worldName = '__TH_DIRECT__'; // 标记：不需要 worldName，TavernHelper 自动定位
      }
    }
  } catch(e){}
  // 回退：DOM 选择器
  if (!worldName) {
    try { worldName = (typeof meowFindRoleWorldName === 'function') ? meowFindRoleWorldName() : ''; } catch(e){ worldName=''; }
  }
} else if (target === 'st_wb'){
  worldName = String($('#meow_save_book')?.value || '').trim();
}

// 本地世界书写入（你已有 pushToLocalWBSection 兜底）
function writeLocal(key, text){
  pushToLocalWBSection(String(text||''), String(key||''));
}

// 统一写一个条目
// 统一写一个条目（✅所有模式都按聊天隔离：comment 自动加 [cxxxx] 前缀）
// ===================== ✅统一写一个条目（所有模式共用，按聊天隔离）=====================
async function writeEntry(key, text){
  const k = String(key || '').trim();
  const t = String(text || '').trim();
  if (!k || !t) return { ok:false, reason:'empty' };

  // 1) 本地世界书
  if (target === 'wb_local'){
    try{ writeLocal(k, t); }catch(e){}
    return { ok:true, where:'local' };
  }

  // 2) 酒馆世界书：TavernHelper 直写（推荐，跨端稳）
  if (worldName === '__TH_DIRECT__'){
    try{
      // comment 必须带 chatUID 前缀，才能让“同名条目”在不同聊天里各自一份
      const tagged = (typeof meowTaggedComment === 'function')
        ? meowTaggedComment(k, __chatUID || '')
        : `[${__chatUID || 'NOCHAT'}] ${k}`;

      // 直写：不要 listEntries 全量扫描，直接 upsertByComment
      await MEOW_WB_API.upsertByComment({
        comment: tagged,
        content: t,
        keys: [k],                 // keys 不带 tag，保持稳定检索
        enabled: true,
        type: 'constant',
        order: 9999,
        prevent_recursion: true
      });

      // ✅关键：写完后，按 chatUID 启用本聊天、禁用其它聊天（否则看起来会“污染”）
      try{
        if (typeof meowToggleTavernEntries === 'function') {
          // 做一个轻量节流，避免切换聊天/连点导致发烫卡死
          const now = Date.now();
          if (!window.__MEOW_TOGGLE_LOCK__) window.__MEOW_TOGGLE_LOCK__ = { t:0 };
          if (now - window.__MEOW_TOGGLE_LOCK__.t > 800){
            window.__MEOW_TOGGLE_LOCK__.t = now;
            await meowToggleTavernEntries(__chatUID || '');
          }
        }
      }catch(e){}

      return { ok:true, where:'st_th' };
    }catch(e){
      return { ok:false, reason:'th_fail: ' + (e?.message || e) };
    }
  }

  // 3) 酒馆世界书：非 TH 直写（你原来的 safe 写入）
  if (!worldName){
    return { ok:false, reason:'no_world_name' };
  }

  const payload = {
    worldName,
    title: (typeof meowTaggedComment === 'function')
  ? meowTaggedComment(k, __chatUID || '')
  : k,
    key: k,
    content: t,
    memo: `[MEOW 自动总结写入] chat=${__chatUID || ''} key=${k}`
  };

  const r = await meowWriteWorldInfoSafe(payload, { __chatUID: __chatUID || '' });
  return (r && r.ok) ? { ok:true, where:'st', skipped:!!r.skipped } : { ok:false, reason: r?.reason || 'write_fail' };
}
// ===================== ✅writeEntry 结束（不要删下面的 (async ()=>{ ）=====================

(async ()=>{
  if (!autoWrite){
    toast('完成（未自动写入）');
    return;
  }

  // 目标是酒馆但没拿到世界书名：直接提示，不要硬写（避免死循环）
  if ((target === 'st_role' || target === 'st_wb') && !worldName){
    toast('未找到目标世界书名：请在角色设置选择世界书，或填写“酒馆指定世界书名”');
    return;
  }

  // 非表格：整段写 Summary
  if (!isTable){
    const r = await writeEntry('Summary', out);
    // ✅ 修复：直接用 lsGet/lsSet 读写世界书（loadDB/saveDB 是 openWorldBookModal 内部函数，这里调不到）
    try {
      const _LS = (typeof LS_WB !== 'undefined') ? LS_WB : 'meow_worldbook_local_v1';
      const wdb = lsGet(_LS, null);
      if (wdb && wdb.v === 4) {
        wdb.cards ||= [];
        const firstTab = (wdb.tabs||[])[0]?.id;
        if (firstTab) {
          let card = wdb.cards.find(c => String(c.tab) === firstTab);
          if (!card){
            card = { id:'w_'+Math.random().toString(16).slice(2), tab:firstTab, title:'Summary', key:'Summary', text:'', template:'', note:'', page:'a', order:0 };
            wdb.cards.push(card);
          }
          card.text = out;
          card.page = 'a';
        }
        lsSet(_LS, wdb);
      }
    } catch(e){}
    // ✅ 刷新世界书可视化
    try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
meowSaveChatState(__chatUID, { target: target, bookName: worldName });
meowSaveWBForChat(__chatUID);
await meowToggleTavernEntries(__chatUID);
    if (r.ok) toast(r.skipped ? '完成（Summary 未变化，已跳过重复写入）' : '完成（已写入 Summary）');
    else toast('写入失败：已落地镜像并入队（稍后打开 World Info 会自动补写）');
    return;
  }3

  // ✅ 表格：动态匹配分区 → 按条目组写入 + 自动新建 + 卡片同步
// ✅表格模式也必须按聊天启用/禁用，避免不同聊天注入串台
try{
  meowSaveChatState(__chatUID, { target: target, bookName: worldName });
  meowSaveWBForChat(__chatUID);
}catch(e){}
try{
  if (typeof meowToggleTavernEntries === 'function') await meowToggleTavernEntries(__chatUID || '');
}catch(e){}

  // ===================== 表格模式写入：分区优先；无分区时按表头智能归类 =====================

// 1) 从可视化世界书(WB_V4)取 tab 顺序、名称、字段(用于智能识别)
function _meowGetWBV4Meta(){
  try{
    // ✅ 修复：直接从 localStorage 读世界书数据（loadDB 是世界书弹窗内部函数，这里调不到）
    const _LS = (typeof LS_WB !== 'undefined') ? LS_WB : 'meow_worldbook_local_v1';
    const db = lsGet(_LS, null);
    if (db && db.v === 4){
      const tabs = Array.isArray(db.tabs) ? db.tabs.slice() : [];
      tabs.sort((a,b)=>(a?.order ?? 0) - (b?.order ?? 0));
      return { ok:true, db, tabs, frames:(db.frames || {}), show:(db.show || {}) };
    }
  }catch(e){}
  return { ok:false, db:null, tabs:[], frames:{}, show:{} };
}

// 2) 识别分区：支持 【xxx】/[xxx]/(xxx)/（xxx） 或 Markdown 标题 # xxx
function _meowSplitSectionsLoose(text){
  const map = {};
  const lines = String(text || '').replace(/\r/g,'').split('\n');

  let cur = '';
  let buf = [];

  const flush = ()=>{
    const body = buf.join('\n').trim();
    if (cur && body) map[cur] = body;
  };

  for (let i=0;i<lines.length;i++){
    const line = String(lines[i] || '');

    // 【分区】/[分区]/(分区)/（分区）
    let m = line.match(/^\s*(?:【|\[|\(|（)\s*([^】\]\)）]{1,50})\s*(?:】|\]|\)|）)\s*$/);

    // Markdown 标题：# 分区名 / ## 分区名
    if (!m){
      m = line.match(/^\s*#{1,6}\s*([^\n#]{1,50})\s*$/);
    }

    if (m){
      flush();
      cur = String(m[1] || '').trim();
      buf = [];
      continue;
    }

    if (cur) buf.push(line);
  }

  flush();
  return map;
}

// 3) 取第一张 Markdown 表格表头
function _meowGetMdTableHeaders(text){
  const lines = String(text || '').replace(/\r/g,'').split('\n');

  for (let i=0;i<lines.length-1;i++){
    const a = lines[i].trim();
    const b = lines[i+1].trim();

    if (!a.includes('|') || !b.includes('|')) continue;

    // 典型分隔线：| --- | :---: | ---: |
    const sep = b.replace(/\s/g,'');
    if (!/-{2,}/.test(sep)) continue;

    const head = a.replace(/^\|/,'').replace(/\|$/,'');
    const cells = head
      .split('|')
      .map(s=>s.trim())
      .filter(Boolean)
      .map(s=>s.replace(/[*_`]/g,'').trim());

    if (cells.length) return cells;
  }

  return [];
}

// 4) 无分区时：按“表头字段”猜测写入哪个 tab
function _meowGuessTabByTable(outText, meta){
  const tabs = (meta.tabs || []).map(t=>({
    tid: String(t?.id || '').trim(),
    name: String(t?.name || t?.id || '').trim(),
    order: (t?.order ?? 0)
  }));

  const activeTabs = tabs.filter(x=>{
    if (!x.tid) return false;
    if (meta.show && meta.show[x.tid] === false) return false;
    if (!meta.frames || !meta.frames[x.tid]) return false;
    return true;
  });

  // 只开了一个分区开关：直接写进去（最符合你“条目组开关联动”的预期）
  if (activeTabs.length === 1) return { ...activeTabs[0], score: 999 };

  const headers = _meowGetMdTableHeaders(outText);
  if (!headers.length) return null;

  let best = null;

  for (const t of activeTabs){
    const fr = meta.frames[t.tid] || {};
    const fkeys = (Array.isArray(fr.fields) ? fr.fields : [])
      .map(f=>String(f?.key || '').trim())
      .filter(Boolean);

    let score = 0;

    for (const hk0 of headers){
      const hk = String(hk0 || '').trim();
      if (!hk) continue;

      for (const fk0 of fkeys){
        const fk = String(fk0 || '').trim();
        if (!fk) continue;

        if (hk === fk) { score += 2; break; }
        if (hk.length>=2 && fk.length>=2 && (hk.includes(fk) || fk.includes(hk))) { score += 1; break; }
      }
    }

    if (!best || score > best.score || (score === best.score && t.order < best.order)){
      best = { ...t, score };
    }
  }

  if (!best || best.score <= 0) return null;
  return best;
}

// 5) 先按分区切；切不出来就用表头猜归属 tab（避免“未识别分区”兜底 Summary）
const wbMeta = _meowGetWBV4Meta();
let sec = _meowSplitSectionsLoose(out);
let guessed = null;

if (!sec || !Object.keys(sec).length){
  guessed = _meowGuessTabByTable(out, wbMeta);
  if (guessed){
    // 用 tab 的 name 当作“分区名”，让后续 matchSecToTab 能命中
    const k = guessed.name || guessed.tid;
    sec = { [k]: out };
  }
}

// 6) 写入顺序：优先用 WB_V4 的 tab 顺序；没有才用默认
let dynamicOrder = [];
if (wbMeta.ok && Array.isArray(wbMeta.tabs) && wbMeta.tabs.length){
  dynamicOrder = wbMeta.tabs.map(t => [String(t.id || ''), String(t.name || t.id || '')]);
}
if (!dynamicOrder.length) {
  // 保持你原来的兜底结构（只在没有 WB_V4 时才会用到）
  dynamicOrder = [
    ['time','时空信息'],['role','角色详情'],['plot','故事大纲'],
    ['event','事件详情'],['task','任务约定'],['item','道具物品'],
  ];
}

// 7) 分区名 -> tabId 匹配（✅ 修复：支持英文变体 + 别名映射）
function matchSecToTab(secKey, order){
  const sk = String(secKey || '').trim();
  const skL = sk.toLowerCase();
  // 去掉下划线/连字符/空格后的纯净版（time_space → timespace）
  const skClean = skL.replace(/[_\-\s]+/g, '');

  // ===== 别名映射：LLM 可能输出的各种英文/中文变体 → 标准 gid =====
  const ALIAS = {
    // time 系
    'time':'time', 'time_space':'time', 'timespace':'time', 'timeline':'time',
    '时空':'time', '时空信息':'time', '时间':'time', '时间地点':'time',
    // role 系
    'role':'role', 'roles':'role', 'character':'role', 'characters':'role', 'people':'role',
    '角色':'role', '角色详情':'role', '角色信息':'role', '人物':'role',
    // plot 系
    'plot':'plot', 'story':'plot', 'outline':'plot', 'storyline':'plot',
    '大纲':'plot', '故事大纲':'plot', '故事':'plot', '剧情':'plot',
    // event 系
    'event':'event', 'events':'event', 'incident':'event', 'incidents':'event',
    '事件':'event', '事件详情':'event', '事件记录':'event',
    // task 系
    'task':'task', 'tasks':'task', 'quest':'task', 'quests':'task', 'todo':'task',
    '任务':'task', '任务约定':'task', '约定':'task', '待办':'task',
    // item 系
    'item':'item', 'items':'item', 'props':'item', 'inventory':'item', 'equipment':'item',
    '道具':'item', '道具物品':'item', '物品':'item', '物资':'item',
  };

  // 1) 精确别名匹配（支持原名 + 去下划线版）
  const aliasGid = ALIAS[skL] || ALIAS[skClean];
  if (aliasGid){
    const found = order.find(([gid]) => gid === aliasGid);
    if (found) return found;
  }

  // 2) 对 order 里每个 tab 做多层匹配
  for (const [gid, name] of order){
    const nameL = name.toLowerCase();
    const gidL  = gid.toLowerCase();

    // 精确匹配
    if (skL === nameL || skL === gidL) return [gid, name];

    // 包含匹配（双向）
    if (skL.length >= 2 && nameL.length >= 2){
      if (skL.includes(nameL) || nameL.includes(skL)) return [gid, name];
    }

    // gid 包含匹配（time_space 包含 time）
    if (gidL.length >= 3 && skClean.includes(gidL)) return [gid, name];

    // 前两字符匹配（中文场景）
    if (sk.length >= 2 && name.length >= 2 && sk.slice(0,2) === name.slice(0,2)) return [gid, name];
  }

  return null;
}

// 8) 写入世界书：显示名用中文(cn)，稳定键用 gid(time/role/...)；并自动把旧的 time 条目改名为中文
async function _meowWriteEntryNamed(gid, cn, text){
  const id = String(gid || '').trim();
  const title = String(cn || gid || '').trim();
  const t = String(text || '').trim();
  if (!id || !title || !t) return { ok:false, reason:'empty' };

  // 1) 本地：用 gid
  if (target === 'wb_local'){
    writeLocal(id, t);
    return { ok:true, where:'local' };
  }

  // 2) TavernHelper 直写：comment 带聊天前缀，隔离不同聊天
  if (worldName === '__TH_DIRECT__'){
    try{
      const taggedTitle = meowTaggedComment(title, __chatUID);
      const { all } = await MEOW_WB_API.listEntries();

      // 查找带前缀的条目
      const byTagged = all.find(e => e && e.comment === taggedTitle);
      // 也查旧的不带前缀的（兼容迁移）
      const byOldTitle = all.find(e => e && e.comment === title);
      const byOldId    = all.find(e => e && e.comment === id);

      if (byTagged && byTagged.uid){
        // 已有带前缀条目 → 直接更新
        await MEOW_WB_API.upsertByUid({
          uid: byTagged.uid,
          comment: taggedTitle,
          content: t,
          keys: [id],
          enabled: true,
          type: 'constant',
          order: 9999,
          prevent_recursion: true
        });
        return { ok:true, where:'st_th', mode:'update' };
      }

      // 新建带前缀条目（不动旧条目，避免破坏其他聊天数据）
      await MEOW_WB_API.upsertByComment({
        comment: taggedTitle,
        content: t,
        keys: [id],
        enabled: true,
        type: 'constant',
        order: 9999,
        prevent_recursion: true
      });
      return { ok:true, where:'st_th', mode:'create' };
    }catch(e){
      return { ok:false, reason:'th_fail: ' + (e?.message || e) };
    }
  }

  // 3) 其它目标
  if (!worldName) return { ok:false, reason:'no_world_name' };
  const taggedTitle = meowTaggedComment(title, __chatUID);
  const payload = {
    worldName,
    title: taggedTitle,
    key: id,
    content: t,
    memo: `[MEOW] chat=${__chatUID || ''} gid=${id}`
  };
  const r = await meowWriteWorldInfoSafe(payload, { __chatUID: __chatUID || '' });
  return r && r.ok ? { ok:true, where:'st', mode:r.mode } : { ok:false, reason:r?.reason || 'write_fail' };
}

// 9) 真正写入：每个分区一个条目（显示中文，键用 time/role...）
let wrote = 0;
const writtenGids = [];

for (const secKey of Object.keys(sec)){
  const body = String(sec[secKey] || '').trim();
  if (!body) continue;

  const match = matchSecToTab(secKey, dynamicOrder);
  if (!match) continue;

  const [gid, cn] = match;
  const r = await _meowWriteEntryNamed(gid, cn, `【${cn}】\n${body}`);
  if (r.ok){ wrote++; writtenGids.push(gid); }
}

// 10) 仍然写入 0 个：兜底 Summary（修复 loadDB 作用域 + 刷新世界书）
if (!wrote){
  const r = await writeEntry('Summary', out);

  // ✅ 修复：直接 lsGet/lsSet（loadDB 是 openWorldBookModal 局部函数，这里不可调）
  try {
    const _LS = (typeof LS_WB !== 'undefined') ? LS_WB : 'meow_worldbook_local_v1';
    const wdb = lsGet(_LS, null);
    if (wdb && wdb.v === 4) {
      wdb.cards ||= [];
      const firstTab = (wdb.tabs || [])[0]?.id;
      if (firstTab) {
        let card = wdb.cards.find(c => String(c.tab) === firstTab);
        if (!card) {
          card = { id:'w_'+Math.random().toString(16).slice(2), tab:firstTab, title:'Summary', key:'Summary', text:'', template:'', note:'', page:'a', order:0 };
          wdb.cards.push(card);
        }
        card.text = out;
        card.page = 'a';
      }
      lsSet(_LS, wdb);
    }
  } catch(e){}

  try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
  meowSaveChatState(__chatUID, { target: target, bookName: worldName });
meowSaveWBForChat(__chatUID);
await meowToggleTavernEntries(__chatUID);
  if (r.ok) toast('完成（未识别分区，已兜底写入 Summary）');
  else toast('写入失败：无法写入世界书');
  return;
}

// 11) 同步到世界书可视化：按批次创建多条目
try {
  const _W = (typeof W !== 'undefined') ? W : window;
  const _lsGet = (typeof lsGet === 'function') ? lsGet : ((k, d)=>{ try{ const v = _W.localStorage.getItem(k); return v? JSON.parse(v): d; }catch(e){ return d; } });
  const _lsSet = (typeof lsSet === 'function') ? lsSet : ((k, v)=>{ try{ _W.localStorage.setItem(k, JSON.stringify(v)); }catch(e){} });
  const LS_DB = (typeof LS_WB !== 'undefined') ? LS_WB : 'meow_worldbook_local_v1';
  const db = _lsGet(LS_DB, null);

  if (db && db.v === 4) {
    db.cards ||= [];
    db.tabs  ||= [];

    // 按分区（secKey → tab）组织：每个分区可能有多个批次
    // allOuts = [{from, to, text, label}]，sec = {secKey: fullText}
    // 但 sec 是合并后的，我们需要按批次拆开

    // 重新按批次+分区拆分
    const batchSections = []; // [{batchIdx, from, to, secKey, gid, cn, body}]

    for (let bi = 0; bi < allOuts.length; bi++) {
      const batch = allOuts[bi];
      const batchSec = (typeof _meowSplitSectionsLoose === 'function')
        ? _meowSplitSectionsLoose(batch.text)
        : (typeof splitSectionsByTag === 'function' ? splitSectionsByTag(batch.text) : {});

      if (!batchSec || !Object.keys(batchSec).length) {
        // 无分区：整批作为一个条目
        batchSections.push({
          batchIdx: bi,
          from: batch.from,
          to: batch.to,
          secKey: '_whole',
          gid: dynamicOrder[0]?.[0] || 'time',
          cn: dynamicOrder[0]?.[1] || '总结',
          body: batch.text.trim()
        });
        continue;
      }

      for (const sk of Object.keys(batchSec)) {
        const body = String(batchSec[sk] || '').trim();
        if (!body) continue;

        const match = (typeof matchSecToTab === 'function')
          ? matchSecToTab(sk, dynamicOrder)
          : null;
        if (!match) continue;

        const [gid, cn] = match;
        batchSections.push({
          batchIdx: bi,
          from: batch.from || allOuts[bi]?.from,
          to: batch.to || allOuts[bi]?.to,
          secKey: sk,
          gid, cn, body
        });
      }
    }

    // 按 gid 分组
    const byGid = {};
    for (const item of batchSections) {
      if (!byGid[item.gid]) byGid[item.gid] = [];
      byGid[item.gid].push(item);
    }

    // 每个 gid：清除旧的脚本卡片 → 创建新卡片（每批一张）
    function uid(){ return 'w_'+Math.random().toString(16).slice(2)+'_'+Date.now().toString(16); }

    for (const [gid, items] of Object.entries(byGid)) {
      // 删除该 tab 下所有旧卡片
      db.cards = db.cards.filter(c => String(c.tab) !== gid);

      // 每批一张卡片
      items.sort((a, b) => a.batchIdx - b.batchIdx);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const floorLabel = (it.from && it.to) ? `楼层${it.from}~${it.to}` : `第${it.batchIdx+1}批`;
        db.cards.push({
          id: uid(),
          tab: gid,
          title: `${it.cn}（${floorLabel}）`,
          key: gid,
          text: `【${it.cn}】（${floorLabel}）\n${it.body}`,
          template: '',
          note: '',
          page: 'a',
          order: i
        });
      }
    }

    // 没被分到的 tab 保留原卡片不动
    _lsSet(LS_DB, db);
  }
} catch(e){
  console.warn('[MEOW] 可视化同步失败:', e);
}

meowSaveChatState(__chatUID, { target: target, bookName: worldName });
meowSaveWBForChat(__chatUID);

// ✅ 刷新世界书可视化（如果世界书弹窗正在打开，立刻更新卡片内容）
try{ window.MEOW_WB_REFRESH?.(); }catch(e){}

await meowToggleTavernEntries(__chatUID);
if (guessed){
  toast(`完成（已按表头识别为「${guessed.name || guessed.tid}」，写入 ${wrote} 个：${writtenGids.join(',')}）`);
} else {
  toast(`完成（表格已写入 ${wrote} 个：${writtenGids.join(',')}）`);
}
})();
  });
}
// ============ Summary -> WorldBook 分流写入（people/story/events） ============
function parseSummaryTables(summaryText){
  const blocks = {};
  // 取 "* 1:xxx" 到下一个 "* n:" 之间
  const re = /^\*\s*(\d+):([^\n]+)\n([\s\S]*?)(?=^\*\s*\d+:|\s*$)/gm;
  let m;
  while ((m = re.exec(summaryText))) {
    const idx = Number(m[1]);
    const title = (m[2]||'').trim();
    const body = (m[3]||'').trim();
    blocks[idx] = { title, body };
  }

  function parseCSVTable(body){
    // 找到 【表格内容】 后面的纯CSV
    const p = body.split('【表格内容】')[1] || body;
    const lines = p.split('\n').map(s=>s.trim()).filter(Boolean);
    if (!lines.length) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(s=>s.trim());
    const rows = [];
    for (let i=1;i<lines.length;i++){
      const cols = lines[i].split(',').map(s=>s.trim());
      if (!cols.length || cols[0]==='（此表格当前为空）') continue;
      const obj = {};
      headers.forEach((h, j)=> obj[h] = (cols[j] ?? '').trim());
      rows.push(obj);
    }
    return { headers, rows };
  }

  const t1 = blocks[1] ? parseCSVTable(blocks[1].body) : {rows:[]}; // 角色特征
  const t2 = blocks[2] ? parseCSVTable(blocks[2].body) : {rows:[]}; // 社交
  const t4 = blocks[4] ? parseCSVTable(blocks[4].body) : {rows:[]}; // 事件
  const t5 = blocks[5] ? parseCSVTable(blocks[5].body) : {rows:[]}; // 物品

  return { t1, t2, t4, t5 };
}

// day1/day2…：按日期升序编号（更可靠）
function buildDayMap(eventRows){
  const dates = [...new Set(eventRows.map(r=>r['2:日期']).filter(Boolean))].sort();
  const map = new Map();
  dates.forEach((d, i)=> map.set(d, `day${i+1}`));
  return map;
}

// 你本地世界书结构示例：{ groups: { people:[], story:[], events:[] } }
function upsertEntry(list, key, patch){
  const i = list.findIndex(e => e.key === key);
  if (i >= 0) list[i] = { ...list[i], ...patch, key };
  else list.push({ key, ...patch });
}

function summaryToWorldBook(summaryText, wb){
  const { t1, t2, t4, t5 } = parseSummaryTables(summaryText);
  wb.groups ||= {};
  wb.groups.people ||= [];
  wb.groups.story  ||= [];
  wb.groups.events ||= [];

  // people：特征表 + 社交表合并
  const relByName = new Map();
  t2.rows.forEach(r=>{
    const name = r['0:角色名'];
    if (!name) return;
    relByName.set(name, {
      relation: r['1:对<user>关系'] || '',
      attitude:  r['2:对<user>态度'] || '',
      favor:     r['3:对<user>好感'] || ''
    });
  });

  t1.rows.forEach(r=>{
    const name = r['0:角色名'];
    if (!name) return;
    const rel = relByName.get(name) || {};
    upsertEntry(wb.groups.people, name, {
      type: 'person',
      title: name,
      data: {
        body: r['1:身体特征'] || '',
        personality: r['2:性格'] || '',
        job: r['3:职业'] || '',
        hobby: r['4:爱好'] || '',
        likes: r['5:喜欢的事物（作品、虚拟人物、物品等）'] || '',
        home: r['6:住所'] || '',
        note: r['7:其他重要信息'] || '',
        ...rel
      }
    });
  });

  // events：逐条 entry + 按日期 dayN 分组标签
  const dayMap = buildDayMap(t4.rows);
  t4.rows.forEach((r, idx)=>{
    const date = r['2:日期'] || '';
    const day = dayMap.get(date) || 'dayX';
    const key = `E:${day}:${idx+1}`;
    upsertEntry(wb.groups.events, key, {
      type: 'event',
      title: `${day} ${date}`.trim(),
      tags: [day, date].filter(Boolean),
      data: {
        roles: r['0:角色'] || '',
        brief: r['1:事件简述'] || '',
        date,
        place: r['3:地点'] || '',
        mood: r['4:情绪'] || ''
      }
    });
  });

  // story：按 day 聚合成时间线段落（用于折叠时间线概览）
  const byDay = new Map();
  t4.rows.forEach((r)=>{
    const date = r['2:日期'] || '';
    const day = dayMap.get(date) || 'dayX';
    const arr = byDay.get(day) || [];
    arr.push(r);
    byDay.set(day, arr);
  });

  [...byDay.entries()].forEach(([day, arr])=>{
    const date = arr[0]?.['2:日期'] || '';
    const key = `S:${day}`;
    const lines = arr.map((r, i)=> `${i+1}. ${r['1:事件简述']||''}（${r['3:地点']||''}）`).join('\n');
    upsertEntry(wb.groups.story, key, {
      type: 'story',
      title: `${day} ${date}`.trim(),
      data: { date, timeline: lines }
    });
  });

  // 可选：物品写进 story 或单独 items（你没要求分组，我先挂到 story 的“items”）
  if (t5.rows.length){
    const items = t5.rows.map(r=>({
      owner: r['0:拥有人']||'',
      desc: r['1:物品描述']||'',
      name: r['2:物品名']||'',
      reason: r['3:重要原因']||'',
    }));
    upsertEntry(wb.groups.story, `S:items`, { type:'items', title:'重要物品', data:{ items } });
  }

  return wb;
}

// ===================== 世界书模块（可视化表格 WB_V4_FINAL · REWRITE）=====================
// 用法：你的菜单/按钮里调用 openWorldBookModal() 即可
// 兼容：如存在 tgSave( {groups, enabledIds} ) 会同步“总结模块-表格模式注入”
// 兼容：如存在 window.meowSyncToWorldInfo / window.meowOpenWorldInfoUI 会联动酒馆世界书
function openWorldBookModal(){
  // ✅ 打开世界书前：强制确保 LS_WB 属于当前聊天（修复分支显示旧数据）
  try{ meowForceWBSyncForCurrentChat(); }catch(e){}
  // ---------- host / utils（尽量“直连全局”，但不让 iOS 因未定义直接炸） ----------
  const _W   = (typeof W   !== 'undefined') ? W   : window;
  const _doc = (typeof doc !== 'undefined') ? doc : document;

  const _toast = (typeof toast === 'function') ? toast : ((m)=>{ try{ _W.toastr?.info?.(String(m)); }catch(e){} });
  const _lsGet = (typeof lsGet === 'function') ? lsGet : ((k, d)=>{ try{ const v = localStorage.getItem(k); return v? JSON.parse(v): d; }catch(e){ return d; }});
  const _lsSet = (typeof lsSet === 'function') ? lsSet : ((k, v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} });

  const _modalShell = (typeof modalShell === 'function')
    ? modalShell
    : ((id, title, icon)=>{
        // 兜底：极简弹窗（一般不会走到这里）
        let m = _doc.getElementById(id);
        if (m) m.remove?.();
        m = _doc.createElement('div');
        m.id = id;
        m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:14px;';
        m.innerHTML = `
          <div class="hd" style="display:flex;align-items:center;gap:10px;padding:12px 12px;border-radius:14px 14px 0 0;background:#fff;width:min(920px,96vw);">
            <div style="font-weight:900;">${icon||''} ${title||''}</div>
            <div style="flex:1;"></div>
            <button class="close" style="border:0;background:#eee;border-radius:10px;padding:6px 10px;">×</button>
          </div>
          <div class="bd" style="width:min(920px,96vw);max-height:86vh;overflow:auto;background:#fff;border-radius:0 0 14px 14px;padding:12px;"></div>
        `;
        _doc.body.appendChild(m);
        m.querySelector('.close')?.addEventListener('click', ()=>m.remove?.(), {passive:true});
        return m.querySelector('.bd');
      });

  // ---------- 常量 ----------
  const ID_WB_MODAL = (typeof ID_WB !== 'undefined') ? ID_WB : 'meow-wb-modal';
  const LS_DB       = (typeof LS_WB !== 'undefined') ? LS_WB : 'meow_worldbook_local_v1';
  const LS_RULE     = 'meow_wb_frames_v4';    // 预留（你现在没单独用它也不影响）
  const LS_BEAUTY   = 'meow_wb_beauty_v4';

  const BASE_TABS = [
    { id:'time',  name:'时空信息', icon:'⏳' },
    { id:'role',  name:'角色详情', icon:'👤' },
    { id:'plot',  name:'故事大纲', icon:'📜' },
    { id:'event', name:'事件详情', icon:'🧾' },
    { id:'task',  name:'任务约定', icon:'✅' },
    { id:'item',  name:'道具物品', icon:'🎒' },
  ];

  // ---------- utils ----------
  function uid(){ return 'w_'+Math.random().toString(16).slice(2)+'_'+Date.now().toString(16); }
  function esc(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function snippet(s, n){
    s = String(s||'').trim();
    if (!s) return '（空）';
    return s.length>n ? (s.slice(0,n)+'…') : s;
  }

  // ---------- data ----------
  // db = { v:4, tabs:[{id,name,icon,order}], active, q, cards:[{id,tab,title,key,text,template,note,page,order}], frames:{tabId:{enabled,note,fields[],rules{inject,add,modify,del}}}, show:{tabId:true/false} }
  function defaultFrame(tabId){
    const map = {
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
    const base = map[String(tabId)] || { note:'', fields:[{key:'字段1',prompt:''}] };
    return {
      enabled: true,
      note: base.note,
      fields: base.fields.slice(0),
      rules: {
        inject: '把本组“组备注+字段定义+规则”注入总提示词，作为本组总结规范。',
        add:    '当出现新信息：新增行；尽量不重复旧内容。',
        modify: '当信息变化：更新对应字段；必要时合并/拆分行；保持字段语义稳定。',
        del:    '当信息无效：明确标记删除原因；不要悄悄丢失信息。',
      }
    };
  }

  function makeDefaultDB(){
    const db = {
      v:4,
      tabs: BASE_TABS.map((t,i)=>({ id:t.id, name:t.name, icon:t.icon, order:i })),
      active: BASE_TABS[0].id,
      q:'',
      show: Object.fromEntries(BASE_TABS.map(t=>[t.id,true])),
      frames:{},
      cards:[],
    };
    db.tabs.forEach(t=>{
      db.frames[t.id] = defaultFrame(t.id);
      db.cards.push({
        id: uid(),
        tab: t.id,
        title: t.name,
        key: '',
        text: '未总结：这里会显示“总结模块-表格模式”上传/回写后的内容。你也可以先在这里编辑预设内容。',
        template: '',
        note: '',
        page: 'a',
        order: 0
      });
    });
    return db;
  }

  function loadDB(){
    const db = _lsGet(LS_DB, null);
    if (!db || db.v !== 4) {
      const nd = makeDefaultDB();
      // ✅ 标记归属
      try{ nd._chatUID = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : ''; }catch(e){}
      _lsSet(LS_DB, nd);
      return nd;
    }

    // ✅ 检查数据归属：如果不属于当前聊天，创建空白（修复分支显示旧数据）
    try{
      const curUID = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : '';
      const dbOwner = db._chatUID || '';
      // ✅ 条件：当前 UID 有效 且 (数据有归属但不匹配 或 数据无归属标记但有旧卡片内容)
      const needSwitch = curUID && curUID.length > 10 && !curUID.startsWith('fallback:') &&
        ((dbOwner && dbOwner !== curUID) || (!dbOwner && db.cards && db.cards.some(c => c && c.text && c.text.trim() && !c.text.startsWith('未总结'))));
      if (needSwitch){
        void(0)&&console.log('[MEOW][WB] loadDB 检测到数据不属于当前聊天:', dbOwner.slice(0,25), '→ 当前:', curUID.slice(0,25));
        // 保存给旧聊天
        try{
          if (typeof meowSaveWBForChat === 'function') meowSaveWBForChat(dbOwner);
        }catch(e){}
        // 尝试加载当前聊天的快照
        let loaded = false;
        try{
          if (typeof meowLoadWBForChat === 'function') loaded = meowLoadWBForChat(curUID);
        }catch(e){}
        if (loaded){
          const reloaded = _lsGet(LS_DB, null);
          if (reloaded && reloaded.v === 4){
            reloaded._chatUID = curUID;
            reloaded.tabs ||= [];
            reloaded.cards ||= [];
            reloaded.frames ||= {};
            reloaded.show ||= {};
            if (!reloaded.tabs.length) reloaded.tabs = BASE_TABS.map((t,i)=>({ id:t.id,name:t.name,icon:t.icon,order:i }));
            if (!reloaded.active) reloaded.active = reloaded.tabs[0]?.id || 'time';
            reloaded.tabs.forEach(t=>{
              if (!reloaded.frames[t.id]) reloaded.frames[t.id] = defaultFrame(t.id);
              if (reloaded.show[t.id] == null) reloaded.show[t.id] = true;
            });
            return reloaded;
          }
        }
        // 没有快照 → 创建空白
        const nd = makeDefaultDB();
        nd._chatUID = curUID;
        _lsSet(LS_DB, nd);
        try{
          if (typeof meowSaveWBForChat === 'function') meowSaveWBForChat(curUID);
        }catch(e){}
        return nd;
      }
      // 如果 dbOwner 为空（旧数据），标记当前聊天
      if (!dbOwner && curUID && curUID.length > 10){
        db._chatUID = curUID;
      }
    }catch(e){}

    db.tabs ||= [];
    db.cards ||= [];
    db.frames ||= {};
    db.show ||= {};
    if (!db.tabs.length) db.tabs = BASE_TABS.map((t,i)=>({ id:t.id,name:t.name,icon:t.icon,order:i }));
    if (!db.active) db.active = db.tabs[0]?.id || 'time';
    db.tabs.forEach(t=>{
      if (!db.frames[t.id]) db.frames[t.id] = defaultFrame(t.id);
      if (db.show[t.id] == null) db.show[t.id] = true;
    });
    return db;
  }
  function saveDB(db){
  // ✅ 保存前确保标记归属
  try{
    if (!db._chatUID){
      db._chatUID = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : '';
    }
  }catch(e){}
  _lsSet(LS_DB, db);
  // 世界书数据已保存；tgBuildInjectionText 会直接从 LS_WB 读取，无需桥接
  // ✅ 同步保存到 per-chat 快照
  try{
    if (db._chatUID && typeof meowSaveWBForChat === 'function') meowSaveWBForChat(db._chatUID);
  }catch(e){}
}
 

  // ---------- 美化自定义（仅CSS/HTML预留，不混入别的弹窗） ----------
  function getBeauty(){
    const raw = _lsGet(LS_BEAUTY, null);
    const b = (raw && typeof raw === 'object') ? raw : {};
    return {
      css: String(b.css || ''),
      html: String(b.html || ''),
      // default | sans | serif | mono | custom_file | custom_url
      fontMode: String(b.fontMode || 'default'),
      fontName: String(b.fontName || ''),
      fontData: String(b.fontData || ''), // data:...（导文件）
      fontUrl:  String(b.fontUrl  || '')  // https://... 或 /...（直链）
    };
  }

  function applyBeauty(root){
    if (!root) return;
    const b = getBeauty();

    // 0) 字体（只作用于 #wbv4_root，不污染其它模块）
    let stFont = root.querySelector('#wbv4_userfont');
    if (!stFont){
      stFont = _doc.createElement('style');
      stFont.id = 'wbv4_userfont';
      root.appendChild(stFont);
    }

    function cssUrl(u){
      // 用单引号包 url('...')，只需转义 '
      return String(u || '').trim().replace(/'/g, "\\'");
    }
    function guessFmt(u){
      const s = String(u||'').split('?')[0].split('#')[0].toLowerCase();
      if (s.endsWith('.woff2')) return 'woff2';
      if (s.endsWith('.woff'))  return 'woff';
      if (s.endsWith('.ttf'))   return 'truetype';
      if (s.endsWith('.otf'))   return 'opentype';
      return '';
    }

    const mode = String(b.fontMode || 'default');
    let fontCss = '';

    if (mode === 'custom_file' && String(b.fontData||'').startsWith('data:')){
      fontCss += `@font-face{font-family:"MEOW_USER_FONT";src:url("${b.fontData}");font-display:swap;}\n`;
      fontCss += `#wbv4_root{font-family:"MEOW_USER_FONT",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;}\n`;
    }
    else if (mode === 'custom_url' && String(b.fontUrl||'').trim()){
      const u = cssUrl(b.fontUrl);
      const fmt = guessFmt(b.fontUrl);
      const fmtPart = fmt ? ` format("${fmt}")` : '';
      fontCss += `@font-face{font-family:"MEOW_USER_FONT";src:url('${u}')${fmtPart};font-display:swap;}\n`;
      fontCss += `#wbv4_root{font-family:"MEOW_USER_FONT",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;}\n`;
    }
    else if (mode === 'serif'){
      fontCss += `#wbv4_root{font-family:ui-serif,Georgia,"Times New Roman",Times,serif;}\n`;
    }
    else if (mode === 'sans'){
      fontCss += `#wbv4_root{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;}\n`;
    }
    else if (mode === 'mono'){
      fontCss += `#wbv4_root{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;}\n`;
    }
    // default：不改字体

    stFont.textContent = fontCss;

    // 1) 用户 CSS
    let st = root.querySelector('#wbv4_usercss');
    if (!st){
      st = _doc.createElement('style');
      st.id = 'wbv4_usercss';
      root.appendChild(st);
    }
    st.textContent = String(b.css || '');

    // 2) 用户 HTML（插到顶部搜索框下方）
    const slot = root.querySelector('#wbv4_custom_html');
    if (slot) slot.innerHTML = String(b.html || '');
  }

  // ---------- CSS（全部集中在这里；每次打开都强制更新，保证你改完立刻生效） ----------
// ---------- UI 基础 CSS（隔断版：只接管 #wbv4_root 内部，不碰外层弹窗壳 .hd/.bd/#ID_WB） ----------
const STYLE_ID = 'wbv4_style_scoped_only_root';

function ensureWbv4Style(){
  let st = _doc.getElementById(STYLE_ID);
  if (!st){
    st = _doc.createElement('style');
    st.id = STYLE_ID;
    _doc.head.appendChild(st);
  }

  // 关键：全部以 #wbv4_root 为作用域，不依赖外层弹窗 id
  st.textContent = `
/* ===== WBV4 Scoped Only Root (V3 patch: bottom pinned + sub-modals full-width + card tools hidden) ===== */

/* 让“主弹窗 .bd”成为稳定的高度容器，给 #wbv4_root 100% 高度的参照
   只作用于世界书主弹窗，不污染别的弹窗 */
/* 世界书主弹窗外壳：flex 不滚动 */
#meow-wb-modal{
display:flex !important;
flex-direction:column !important;
overflow:hidden !important;
}
#meow-wb-modal .hd{
flex:0 0 auto;
position:relative;
}
#meow-wb-modal .bd{
flex:1 1 auto;
min-height:0;
display:flex;
flex-direction:column;
overflow:hidden;
padding:14px;
}
/* 主根容器：撑满高度，底部栏才能“贴底”
   ✅ 重要：这里不要重新定义 --meow-text/--meow-sub 等全局主题变量
   否则会拦截“美化自定义”的文字色调/明度滑块，导致正文变黑/不跟随 */
#wbv4_root{
  /* 直接吃全局主题变量（美化自定义滑块写在 :root 的那套） */
  color: var(--meow-text, rgba(46,38,30,88));

  display:flex;
  flex-direction:column;
  flex:1 1 auto;
  min-height:0;
}

/* 兜底：确保“当前：… /（空）”这块继承到主题字体色 */
#wbv4_root .wbv4Body,
#wbv4_root #wbv4_hint,
#wbv4_root #wbv4_list{
  color: inherit;
}

/* 顶部吸顶：更贴外框 + 更矮 */
#wbv4_root .wbv4Top{
  position:sticky;
  top:0;
  z-index:50;

  margin:-6px -6px 8px;
  padding:8px 10px 8px;

  background: linear-gradient(180deg, rgba(255,255,255,.78), rgba(246,243,238,.58)) !important;
  border: 1px solid var(--meow-line) !important;
  border-radius: 16px;

  backdrop-filter: blur(14px) saturate(1.06);
  -webkit-backdrop-filter: blur(14px) saturate(1.06);
  box-shadow: 0 8px 18px rgba(0,0,0,.06);
}

/* Tabs：更紧凑 */
#wbv4_root .wbv4Tabs{
  display:flex;
  gap:8px;
  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:thin;
  scrollbar-color:rgba(139,115,85,.12) transparent;
  padding:2px 2px 3px;
  touch-action:pan-x;
}
#wbv4_root .wbv4Tabs::-webkit-scrollbar{ height:2px; }
#wbv4_root .wbv4Tabs::-webkit-scrollbar-track{ background:transparent; }
#wbv4_root .wbv4Tabs::-webkit-scrollbar-thumb{ background:rgba(139,115,85,.15); border-radius:2px; }

#wbv4_root .wbv4Tab{
  flex:0 0 auto;
  width:clamp(92px, 30vw, 140px);
  height:34px;
  padding:0 12px;

  border-radius:999px;
  border:1px solid var(--meow-line, rgba(120,110,95,.16)) !important;
  background: var(--meow-card, rgba(255,255,255,.64)) !important;
  color: var(--meow-text, rgba(80,68,52,.82)) !important;

  font-size:12px;
  font-weight:900;

  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;

  display:inline-flex;
  align-items:center;
  justify-content:center;
  line-height:1;

  box-shadow: 0 6px 14px rgba(0,0,0,.04);
}
#wbv4_root .wbv4Tab.on{
  background: var(--meow-accent, rgba(225,215,196,.78)) !important;
  border-color: var(--meow-accent, rgba(198,186,164,.95)) !important;
  color: var(--meow-text, rgba(90,72,48,.92)) !important;
  box-shadow: 0 10px 20px rgba(0,0,0,.08);
}
#wbv4_root .wbv4Tab.plus{
  width:42px;
  padding:0;
}

/* 搜索框：更细 */
#wbv4_root .wbv4Search{ margin-top:6px; }
#wbv4_root .wbv4Search input{
  width:100%;
  height:28px;

  border-radius:999px;
  padding:0 12px;

  border:1px solid var(--meow-input-line) !important;
  background: var(--meow-input, rgba(255,255,255,.62)) !important;
  color: var(--meow-text) !important;

  outline:none;
  box-shadow: none;
  font-size:12px;
}
#wbv4_root .wbv4Search input::placeholder{ color: var(--meow-sub, rgba(46,38,30,.30)) !important; }

/* 中间滚动区：把滚动锁在这里，底部栏才“固定在底部不动” */
#wbv4_root .wbv4Body{
flex:1 1 auto;
min-height:0;
overflow:auto;
-webkit-overflow-scrolling:touch;
padding:10px 2px 10px;
}
#wbv4_root .wbv4Mini{
  font-size:12px;
  color: var(--meow-sub, rgba(46,38,30,56));
  padding:2px 4px 8px;
}

/* 卡片 */
#wbv4_root .wbv4List{ display:flex; flex-direction:column; gap:10px; }

#wbv4_root .wbv4Card{
  border-radius:16px;
  border:1px solid var(--meow-line) !important;
  background: var(--meow-card) !important;
  padding:12px;
  box-shadow: var(--meow-shadow);

  /* ✅关键：卡片内默认文字颜色全部继承主题字体色 */
  color: var(--meow-text, rgba(46,38,30,88)) !important;
}

/* 卡片内所有元素默认继承（防止某些元素被外部默认样式写死成黑） */
#wbv4_root .wbv4Card *{
  color: inherit;
}

#wbv4_root .wbv4TitleRow{
  display:flex; gap:8px; align-items:center;
  padding:7px 10px;
  border-radius:10px;
  background: var(--meow-hd-bg, var(--meow-card, rgba(255,255,255,.44)));
}

#wbv4_root .wbv4Title{
  font-weight:900; font-size:14px;
  flex:1; min-width:0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  /* ✅跟随卡片 inherit */
  color: inherit !important;
}

#wbv4_root .wbv4Key{
  font-size:12px;
  max-width:45%;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  /* ✅Key 走副文字色 */
  color: var(--meow-sub) !important;
}

#wbv4_root .wbv4Text{
  margin-top:8px;
  font-size:13px;
  line-height:1.45;
  white-space:pre-wrap;
  word-break:break-word;
  /* ✅正文跟随卡片 inherit（主题字体色） */
  color: inherit !important;
}

/* 列表面更简洁：把“编辑/框架规则/确认回写同步”和圆点隐藏（它们会放到卡片背面弹窗里） */
#wbv4_root .wbv4Dots,
#wbv4_root .wbv4Tools{ display:none !important; }

/* 主面板底部三按钮：真贴底（始终在底部），并跟随安全区 */
#wbv4_root .wbv4Bottom{
flex:0 0 auto;
z-index:60;
margin:0 -6px -6px;
padding:10px 10px calc(10px + env(safe-area-inset-bottom,0px));
display:flex;
gap:8px;
border-radius:0 0 16px 16px;
background: var(--meow-bg-strong, rgba(255,255,255,.82)) !important;
border-top: 1px solid var(--meow-line) !important;
backdrop-filter: blur(14px) saturate(1.06);
-webkit-backdrop-filter: blur(14px) saturate(1.06);
box-shadow: 0 -4px 12px rgba(0,0,0,.04);
}
#wbv4_root .wbv4Bottom button{
  flex:1;
  height:36px;
  padding:0 12px;

  border-radius:999px;
  border:1px solid var(--meow-line, rgba(120,110,95,.16)) !important;
  background: var(--meow-card, rgba(255,255,255,.62)) !important;
  color: var(--meow-text, rgba(80,68,52,.84)) !important;

  font-size:12px;
  font-weight:900;

  display:inline-flex;
  align-items:center;
  justify-content:center;
  line-height:1;

  box-shadow: 0 6px 14px rgba(0,0,0,.04);
}

/* =========================
   次级弹窗统一：输入框满宽长条 + 按钮文字居中
   只作用于这四个弹窗ID
========================= */
#meow_wbv4_edit,
#meow_wbv4_frame,
#meow_wbv4_base,
#meow_wbv4_beauty{
  --wbv4FieldRadius: 18px;
}

/* 文案略小 */
#meow_wbv4_edit .wbv4Mini,
#meow_wbv4_frame .wbv4Mini,
#meow_wbv4_base .wbv4Mini,
#meow_wbv4_beauty .wbv4Mini{
  font-size:12px;
  line-height:1.4;
  color: var(--meow-sub, rgba(46,38,30,56));
}

/* 行布局：右侧必须吃满（✅修复：输入框变宽，长方形） */
#meow_wbv4_edit .wbv4Row,
#meow_wbv4_frame .wbv4Row,
#meow_wbv4_base .wbv4Row,
#meow_wbv4_beauty .wbv4Row{
  display:flex;
  gap:10px;
  align-items:flex-start; /* textarea 顶对齐 */
  margin-top:10px;
}

/* 左侧标签：固定小一些，别挤压 */
#meow_wbv4_edit .wbv4Row .l,
#meow_wbv4_frame .wbv4Row .l,
#meow_wbv4_base .wbv4Row .l,
#meow_wbv4_beauty .wbv4Row .l{
  flex:0 0 78px;
  width:auto;
  padding-top:0;
  font-size:12px;
  color: var(--meow-sub, rgba(46,38,30,56));
}

/* ✅关键：右侧内容区撑满 */
#meow_wbv4_edit .wbv4Row .r,
#meow_wbv4_frame .wbv4Row .r,
#meow_wbv4_base .wbv4Row .r,
#meow_wbv4_beauty .wbv4Row .r{
  flex:1 1 auto;
  min-width:0;
}

/* ✅输入控件“长条满宽”，兼容 .r 自己是 flex 的情况（字段行有按钮） */
#meow_wbv4_edit .wbv4Row .r textarea,
#meow_wbv4_frame .wbv4Row .r textarea,
#meow_wbv4_base .wbv4Row .r textarea,
#meow_wbv4_beauty .wbv4Row .r textarea{
  width:100% !important;
  min-width:0 !important;
}

#meow_wbv4_edit .wbv4Row .r input,
#meow_wbv4_frame .wbv4Row .r input,
#meow_wbv4_base .wbv4Row .r input,
#meow_wbv4_beauty .wbv4Row .r input,
#meow_wbv4_edit .wbv4Row .r select,
#meow_wbv4_frame .wbv4Row .r select,
#meow_wbv4_base .wbv4Row .r select,
#meow_wbv4_beauty .wbv4Row .r select{
  width:100% !important;
  min-width:0 !important;
  flex:1 1 auto;
}
`;
}
ensureWbv4Style();

  // ---------- 渲染外壳 ----------
  const bd = _modalShell(ID_WB_MODAL, '世界书', '📚');

  // ===== 视图模式：table=表格可视化 | big=大总结 | small=小总结 | custom=自定义 =====
  let __wbViewMode = 'table';

// ===== 注入头部：标题更大 + 视图切换更短 + 🎨在×左边（保持上一版位置，不拉成长条）=====
(function _injectHdExtras(){
  const modal = _doc.getElementById(ID_WB_MODAL);
  if (!modal) return;

  const hd = modal.querySelector('.hd');
  if (!hd) return;

  // 兼容不同主题的关闭按钮选择器
  const closeBtn =
    hd.querySelector('.close') ||
    hd.querySelector('[data-action="close"]') ||
    hd.querySelector('.btn-close') ||
    hd.querySelector('button');

  // 防重复注入（切换聊天/重复打开时别越插越多）
  if (hd.querySelector('#wbv4_view_mode') || hd.querySelector('#wbv4_theme_hd_wrap')) return;

  // 不要强改 display:flex（有的主题头部本来就有自己的布局，强改会“变长条/裁切”）
  // 只做轻量对齐
  hd.style.justifyContent = 'flex-start';
  hd.style.gap = '8px';

  // 标题：让“世界书”更大一点
  const titleSpan = hd.querySelector('.title span') || hd.querySelector('.title');
  if (titleSpan){
    titleSpan.style.fontSize = '16px';
    titleSpan.style.fontWeight = '900';
    titleSpan.style.whiteSpace = 'nowrap';
  }

  // 视图切换：短文本，避免把头部撑成长条
  const sel = _doc.createElement('select');
  sel.id = 'wbv4_view_mode';
  sel.style.cssText =
    'margin-left:6px;font-size:12px;font-weight:800;' +
    'border:1px solid rgba(0,0,0,.10);border-radius:10px;' +
    'padding:3px 8px;background:rgba(255,255,255,.62);' +
    'color:rgba(46,38,30,.82);outline:none;cursor:pointer;' +
    'appearance:auto;max-width:160px;';

  // 注意：把“可视化”做短，不要“表格可视化 ▾”这种长文案
  sel.innerHTML =
    '<option value="table">可视化（表格版）</option>' +
    '<option value="big">大总结</option>' +
    '<option value="small">小总结</option>' +
    '<option value="custom">自定义</option>';

  // 把下拉紧跟在标题文字后面（这点和你“上一版本挺好”一致）
  if (titleSpan) titleSpan.after(sel);
  else hd.appendChild(sel);

  // 🎨按钮：保持上一版策略，用 margin-left:auto 把它推到右边贴近×
  const themeWrap = _doc.createElement('div');
  themeWrap.id = 'wbv4_theme_hd_wrap';
  themeWrap.style.cssText =
    'position:relative;display:inline-flex;align-items:center;' +
    'margin-left:auto;flex:0 0 auto;z-index:2147483640;';

  
  themeWrap.innerHTML = `
    <button id="wbv4_theme_btn"
      style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;
      background:rgba(255,255,255,.58);border:1px solid rgba(0,0,0,.10);color:rgba(46,38,30,.60);
      cursor:pointer;font-size:16px;position:relative;z-index:2147483641;"
      title="外观自定义">🎨</button>

   <div id="wbv4_theme_panel"
  style="display:none;position:fixed;right:16px;top:64px;z-index:2147483647;pointer-events:auto;
  width:min(310px,86vw);max-height:78vh;overflow:auto;-webkit-overflow-scrolling:touch;
  padding:14px;border-radius:16px;background:rgba(255,255,255,.96);border:1px solid rgba(0,0,0,.08);
  box-shadow:0 16px 40px rgba(0,0,0,.20);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);">
      <div style="font-weight:900;font-size:13px;color:rgba(46,38,30,.85);margin-bottom:10px;">外观自定义</div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:rgba(46,38,30,.55);display:block;margin-bottom:4px;">整体明暗：<span id="wbv4_bright_val">中性</span></label>
        <input type="range" id="wbv4_theme_bright" min="-50" max="50" value="0" style="width:100%;cursor:pointer;touch-action:pan-x;">
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:rgba(46,38,30,55);display:block;margin-bottom:4px;">主色调</label>
        <input type="color" id="wbv4_theme_color" value="#c6baa4" style="width:100%;height:36px;border:none;border-radius:10px;cursor:pointer;background:transparent;">
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;" id="wbv4_color_presets"></div>
      </div>
<div style="margin-bottom:12px;">
  <label style="font-size:11px;color:rgba(46,38,30,55);display:block;margin-bottom:4px;">面板色调（仅此面板）</label>
  <input type="color" id="wbv4_panel_tint" value="#ffffff"
    style="width:100%;height:36px;border:none;border-radius:10px;cursor:pointer;background:transparent;">
  <label style="font-size:11px;color:rgba(46,38,30,55);display:block;margin:8px 0 4px;">面板不透明度：<span id="wbv4_panel_alpha_val">96</span>%</label>
  <input type="range" id="wbv4_panel_alpha" min="60" max="100" value="96" style="width:100%;cursor:pointer;touch-action:pan-x;">
</div>

            <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:rgba(46,38,30,.55);display:block;margin-bottom:4px;">卡片透明度：<span id="wbv4_alpha_val">72</span>%</label>
        <input type="range" id="wbv4_theme_alpha" min="0" max="100" value="72" style="width:100%;cursor:pointer;touch-action:pan-x;">
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:rgba(46,38,30,.55);display:block;margin-bottom:4px;">顶栏明度：<span id="wbv4_hd_bright_val">中性</span></label>
        <input type="range" id="wbv4_hd_bright" min="-50" max="50" value="0" style="width:100%;cursor:pointer;touch-action:pan-x;">
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:rgba(46,38,30,.55);display:block;margin-bottom:4px;">内容区明度：<span id="wbv4_inner_bright_val">中性</span></label>
        <input type="range" id="wbv4_inner_bright" min="-50" max="50" value="0" style="width:100%;cursor:pointer;touch-action:pan-x;">
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:rgba(46,38,30,55);display:block;margin-bottom:4px;">字体色调</label>
        <input type="color" id="wbv4_text_tint" value="#2e261e" style="width:100%;height:36px;border:none;border-radius:10px;cursor:pointer;background:transparent;">
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;" id="wbv4_text_presets"></div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:rgba(46,38,30,.55);display:block;margin-bottom:4px;">字体颜色明度：<span id="wbv4_text_bright_val">中性</span></label>
        <input type="range" id="wbv4_text_bright" min="-50" max="50" value="0" style="width:100%;cursor:pointer;touch-action:pan-x;">
      </div>

<!-- ✅ 补回：字号 -->
<div style="margin-bottom:12px;">
  <label style="font-size:11px;color:rgba(46,38,30,55);display:block;margin-bottom:4px;">
    字号：<span id="wbv4_font_val">13</span>px
  </label>
  <input type="range" id="wbv4_theme_font" min="10" max="22" step="1" value="13"
    style="width:100%;cursor:pointer;touch-action:pan-x;">
</div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:rgba(46,38,30,.55);display:block;margin-bottom:4px;">字体</label>
        <select id="wbv4_theme_family" style="width:100%;height:34px;border-radius:10px;border:1px solid rgba(0,0,0,.08);padding:0 10px;font-size:12px;background:rgba(255,255,255,.85);outline:none;">
          <option value="">默认（跟随系统）</option>
          <option value="'Noto Sans SC',sans-serif">思源黑体</option>
          <option value="'Noto Serif SC',serif">思源宋体</option>
          <option value="'Microsoft YaHei',sans-serif">微软雅黑</option>
          <option value="'PingFang SC',sans-serif">苹方</option>
          <option value="'KaiTi',serif">楷体</option>
          <option value="'LXGW WenKai',cursive">霞鹜文楷</option>
          <option value="monospace">等宽字体</option>
        </select>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:rgba(46,38,30,.55);display:block;margin-bottom:4px;">字重：<span id="wbv4_weight_val">正常</span></label>
        <input type="range" id="wbv4_theme_weight" min="100" max="900" step="100" value="400" style="width:100%;cursor:pointer;touch-action:pan-x;">
      </div>

      <div style="margin-bottom:8px;">
        <label style="font-size:11px;color:rgba(46,38,30,.55);display:block;margin-bottom:4px;">圆角：<span id="wbv4_radius_val">16</span>px</label>
        <input type="range" id="wbv4_theme_radius" min="0" max="28" value="16" style="width:100%;cursor:pointer;touch-action:pan-x;">
      </div>

      <div style="display:flex;gap:8px;margin-top:10px;">
        <button id="wbv4_theme_reset"
          style="flex:1;height:30px;font-size:11px;border-radius:10px;border:1px solid rgba(0,0,0,.08);
          background:rgba(255,255,255,.7);cursor:pointer;color:rgba(46,38,30,.7);font-weight:700;">重置默认</button>
      </div>
    </div>
  `;
  // 插入：放在×左边（你原来的效果）
  if (closeBtn) hd.insertBefore(themeWrap, closeBtn);
  else hd.appendChild(themeWrap);
  // ===== 让面板脱离 tabs 的层叠上下文：移动到 modal 根节点下（避免被 Tab 盖住）=====
  try{
    const panel = themeWrap.querySelector('#wbv4_theme_panel');
    if (panel && panel.parentElement !== modal) {
      modal.appendChild(panel); // 挪到 modal 根节点下
    }
  }catch(e){}
// ===== 主题落地：面板色调 + 卡片透明度（只影响 WBV4，不动其他模块）=====
(function wbv4ThemeApplyWire(){
  try{
    const modal = _doc.getElementById(ID_WB_MODAL);
    if (!modal) return;
    // root 不在这里捕获，改为 apply() 每次实时查询，避免 bd.innerHTML 未赋值时取到 null


    // 放一个专用 style（只覆盖 WBV4 卡片）
    let st = modal.querySelector('#wbv4_theme_style');
    if (!st){
      st = _doc.createElement('style');
      st.id = 'wbv4_theme_style';
      modal.appendChild(st);
    }

    // 取控件
    const panel = modal.querySelector('#wbv4_theme_panel');

    const inpAccent = modal.querySelector('#wbv4_theme_color');
    const inpAlpha  = modal.querySelector('#wbv4_theme_alpha');

    const inpPanelTint  = modal.querySelector('#wbv4_panel_tint');
    const inpPanelAlpha = modal.querySelector('#wbv4_panel_alpha');

    const alphaVal = modal.querySelector('#wbv4_alpha_val');
    const panelAlphaVal = modal.querySelector('#wbv4_panel_alpha_val');

    function hexToRgb(hex){
      const h = String(hex||'').replace('#','').trim();
      if (h.length !== 6) return {r:255,g:255,b:255};
      return {
        r: parseInt(h.slice(0,2),16),
        g: parseInt(h.slice(2,4),16),
        b: parseInt(h.slice(4,6),16),
      };
    }

    
    function apply(){
      // 实时查询 root（bd.innerHTML 可能晚于本函数初次运行才赋值）
      const root = modal.querySelector('#wbv4_root');

      // 1) 卡片透明度
      const a = inpAlpha ? (Number(inpAlpha.value||72)/100) : 0.72;
      if (alphaVal) alphaVal.textContent = String(Math.round(a*100));

      // 2) 主色调
      const accent = inpAccent ? String(inpAccent.value||'#c6baa4') : '#c6baa4';

      if (root) {
        root.style.setProperty('--meow-accent', accent);
        root.style.setProperty('--wbv4-card-alpha', String(a));
      }
      // 同时写全局（让其他模块也生效）
      _doc.documentElement.style.setProperty('--meow-accent', accent);

      // 3) 面板色调：只作用于小面板本身
      if (panel && inpPanelTint && inpPanelAlpha){
        const tint = hexToRgb(inpPanelTint.value);
        const pa = Number(inpPanelAlpha.value||96)/100;
        if (panelAlphaVal) panelAlphaVal.textContent = String(Math.round(pa*100));
        panel.style.background = `rgba(${tint.r},${tint.g},${tint.b},${pa})`;
      }

      // 4) 把“卡片透明度”真正落到卡片背景（你页面里卡片类名不同也没关系，我做了多选择器兜底）
      st.textContent = `
        /* WBV4 Card Alpha Patch */
        #${ID_WB_MODAL} #wbv4_root .wbv4Card,
        #${ID_WB_MODAL} #wbv4_root .wbv4-card,
        #${ID_WB_MODAL} #wbv4_root .wbv4Item,
        #${ID_WB_MODAL} #wbv4_root .wbv4_list_item,
        #${ID_WB_MODAL} #wbv4_root .wbv4List > * {
          background: rgba(255,255,255,var(--wbv4-card-alpha,0.72)) !important;
        }
      `;
    }

    // 绑定：任何变化都重新 apply（不重绘结构，只改变量与样式）
    [inpAccent, inpAlpha, inpPanelTint, inpPanelAlpha].forEach(el=>{
      if (!el) return;
      el.addEventListener('input', apply, { passive:true });
      el.addEventListener('change', apply, { passive:true });
    });

    // 初次落地
    apply();

  }catch(e){}
})();

})();

  bd.innerHTML = `
    <div class="wbv4" id="wbv4_root">
      <div class="wbv4Top">
        <div class="wbv4Tabs" id="wbv4_tabs"></div>
        <div class="wbv4Search"><input id="wbv4_q" placeholder="搜索：标题/Key/正文/模板"></div>
        <div id="wbv4_custom_html"></div>
      </div>

      <div class="wbv4Body">
        <div class="wbv4Mini" id="wbv4_hint"></div>
        <div class="wbv4List" id="wbv4_list"></div>
      </div>

      <div class="wbv4Bottom">
        <button id="wbv4_base">酒馆世界书基础设置</button>
        <button id="wbv4_rule">📊 打开预览浮窗</button>
        <button id="wbv4_beauty">美化自定义</button>
      </div>
    </div>
  `;

  const root  = bd.querySelector('#wbv4_root');
  const $tabs = bd.querySelector('#wbv4_tabs');
  const $q    = bd.querySelector('#wbv4_q');
  const $hint = bd.querySelector('#wbv4_hint');
  const $list = bd.querySelector('#wbv4_list');

  function ensureTabCard(db, tabId){
    const has = db.cards.some(c=>String(c.tab)===String(tabId));
    if (has) return;
    const t = db.tabs.find(x=>x.id===tabId) || { id:tabId, name:tabId };
    const max = db.cards.filter(c=>c.tab===tabId).reduce((m,c)=>Math.max(m, c.order??0), 0);
    db.cards.push({ id:uid(), tab:tabId, title:t.name, key:'', text:'未总结：这里会显示上传/回写后的内容。', template:'', note:'', page:'a', order:max+1 });
  }

  function renderTabs(db){
    const arr = db.tabs.slice().sort((a,b)=>(a.order??0)-(b.order??0));
    $tabs.innerHTML = '';
    arr.forEach(t=>{
      const el = _doc.createElement('button');
      el.type='button';
      el.className = 'wbv4Tab' + (db.active===t.id ? ' on':'');
      el.textContent = `${t.icon||''} ${t.name||t.id}`.trim();
      el.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        db.active = t.id;
        saveDB(db);
        renderAll();
        // 同步浮窗预览
        try{ if(typeof window.__meowFloatRefresh==='function') window.__meowFloatRefresh(t.id); else if(typeof _W.__meowFloatRefresh==='function') _W.__meowFloatRefresh(t.id); }catch(ex){}
      }, {passive:false});
      $tabs.appendChild(el);
    });

    const plus = _doc.createElement('button');
    plus.type='button';
    plus.className='wbv4Tab plus';
    plus.textContent = '+';
    plus.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      addNewTab();
    }, {passive:false});
    $tabs.appendChild(plus);
    // 不 scrollIntoView：不回跳

    // ★ 电脑端：鼠标滚轮横向滚动 tab 条
    if (!$tabs.__meowWheelBound){
      $tabs.__meowWheelBound = true;
      $tabs.addEventListener('wheel', function(e){
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){
          e.preventDefault();
          $tabs.scrollLeft += e.deltaY;
        }
      }, {passive:false});

      // ★ 手机端：阻止 tab 横滑冒泡到聊天区（防止误触 swipe-to-reroll）
      let _touchStartX = 0;
      $tabs.addEventListener('touchstart', function(e){
        _touchStartX = e.touches[0].clientX;
      }, {passive:true});
      $tabs.addEventListener('touchmove', function(e){
        const dx = Math.abs(e.touches[0].clientX - _touchStartX);
        if (dx > 5) e.stopPropagation(); // 横滑超过5px就吞掉，不让外层接收
      }, {passive:false});
    }
  }

  function renderList(db){
    const tabId = String(db.active);
    ensureTabCard(db, tabId);

    const q = String(db.q||'').trim().toLowerCase();
    const fr = db.frames?.[tabId] || defaultFrame(tabId);

    let items = db.cards
      .filter(c=>String(c.tab)===tabId)
      .slice()
      .sort((a,b)=>(a.order??0)-(b.order??0));

    if (q){
      items = items.filter(c=>{
        const hay = [c.title,c.key,c.text,c.template,c.note, JSON.stringify(fr)].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    const injectState = (fr.enabled===false) ? '本组注入：关' : '本组注入：开';
    $hint.textContent = `当前：${(db.tabs.find(t=>t.id===tabId)?.name||tabId)} | ${injectState} | 可在"表格条目框架规则"里配置`;

    // ===== 解析文本为表格行 =====
    function parseTextToTable(text){
      const src = String(text||'').trim();
      if (!src) return null;

      const lines = src.split('\n').map(l=>l.trim()).filter(Boolean);

      // 尝试 Markdown 表格：找 header + separator + rows
      for (let i = 0; i < lines.length - 1; i++){
        const a = lines[i];
        const b = lines[i+1];
        if (!a.includes('|') || !b.includes('|')) continue;
        if (!/-{2,}/.test(b.replace(/\s/g,''))) continue;

        const headers = a.replace(/^\|/,'').replace(/\|$/,'')
          .split('|').map(s=>s.trim()).filter(Boolean);
        if (!headers.length) continue;

        const rows = [];
        for (let j = i + 2; j < lines.length; j++){
          const row = lines[j];
          if (!row.includes('|')) break;
          const cells = row.replace(/^\|/,'').replace(/\|$/,'')
            .split('|').map(s=>s.trim());
          rows.push(cells);
        }
        if (rows.length) return { headers, rows };
      }

      // 尝试 CSV 风格（逗号分隔）
      const csvLines = lines.filter(l => l.includes(',') && !l.startsWith('【') && !l.startsWith('#'));
      if (csvLines.length >= 2){
        const headers = csvLines[0].split(',').map(s=>s.trim());
        const rows = csvLines.slice(1).map(l => l.split(',').map(s=>s.trim()));
        if (headers.length >= 2) return { headers, rows };
      }

      return null;
    }

    // ===== 解析 "key：value | key：value" 管道分隔文本为 key-value 对 =====
    function parsePipeText(text){
      const src = String(text||'').trim();
      if (!src) return null;
      // 按 | 分割，每段尝试解析 key：value 或 key:value
      const segments = src.split(/[|｜]/).map(s=>s.trim()).filter(Boolean);
      if (segments.length < 2) return null; // 至少2个字段才走表格
      const result = [];
      for (const seg of segments){
        // 匹配 "key：value" 或 "key: value"（中英文冒号都支持）
        const m = seg.match(/^([^：:]+)[：:](.+)$/);
        if (m){
          result.push({ k: m[1].trim(), v: m[2].trim() });
        } else {
          result.push({ k: '', v: seg.trim() });
        }
      }
      // 至少有一半以上的段有 key 才算有效表格
      const withKey = result.filter(r=>r.k).length;
      if (withKey < result.length * 0.4) return null;
      return result;
    }

    // ===== 构建 HTML =====
    let html = '';
    for (const c of items){
      const table = parseTextToTable(c.text);

      if (table && table.headers.length){
        // 表格视图（紧凑版）
        html += `
  <div class="wbv4CardWrap" data-id="${esc(c.id)}">
    <div class="wbv4Card" data-open="${esc(c.id)}" style="padding:6px;overflow-x:auto;">
      <div class="wbv4TitleRow" style="margin-bottom:4px;">
        <div class="wbv4Title" style="font-size:12px;">${esc(c.title||'未命名')}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;line-height:1.4;table-layout:auto;">
        <thead>
          <tr>${table.headers.map(h=>`<th style="text-align:left;padding:3px 6px;border-bottom:2px solid var(--meow-line,rgba(0,0,0,.1));font-weight:800;color:var(--meow-text,rgba(72,60,48,.90));white-space:nowrap;font-size:10px;">${esc(h)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${table.rows.map(row=>`<tr>${row.map((cell,ci)=>`<td style="padding:3px 6px;border-bottom:1px solid var(--meow-line,rgba(0,0,0,.05));color:var(--meow-text);word-break:break-word;max-width:120px;vertical-align:top;">${esc(cell)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
      } else {
        // ★ 智能视图：尝试解析 "key：value | key：value" 格式为横向紧凑表格
        const pipeTable = parsePipeText(c.text);
        if (pipeTable && pipeTable.length){
          html += `
  <div class="wbv4CardWrap" data-id="${esc(c.id)}">
    <div class="wbv4Card" data-open="${esc(c.id)}" style="padding:6px;overflow-x:auto;">
      <div class="wbv4TitleRow" style="margin-bottom:4px;">
        <div class="wbv4Title" style="font-size:12px;">${esc(c.title||'未命名')}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;line-height:1.4;table-layout:auto;">
        <thead><tr>${pipeTable.map(kv=>`<th style="padding:3px 6px;border-bottom:2px solid var(--meow-line,rgba(0,0,0,.1));font-weight:800;color:var(--meow-text,rgba(72,60,48,.85));white-space:nowrap;font-size:10px;">${esc(kv.k||'—')}</th>`).join('')}</tr></thead>
        <tbody><tr>${pipeTable.map(kv=>`<td style="padding:3px 6px;border-bottom:1px solid var(--meow-line,rgba(0,0,0,.05));color:var(--meow-text);word-break:break-word;max-width:120px;overflow:hidden;display:table-cell;vertical-align:top;">${esc(kv.v)}</td>`).join('')}</tr></tbody>
      </table>
    </div>
  </div>`;
        } else {
          // 纯文本视图（无法解析时，限制3行）
          html += `
  <div class="wbv4CardWrap" data-id="${esc(c.id)}">
    <div class="wbv4Card" data-open="${esc(c.id)}">
      <div class="wbv4TitleRow">
        <div class="wbv4Title">${esc(c.title||'未命名')}</div>
        <div class="wbv4Key">${esc(c.key||'')}</div>
      </div>
      <div class="wbv4Text" style="white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.4;color:var(--meow-text);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${esc(c.text||'（空）')}</div>
    </div>
  </div>`;
        }
      }
    }

    $list.innerHTML = html || `<div class="wbv4Mini">暂无条目</div>`;
    bindListEvents(db);
  }
function openCardBack(db, cardId){
  const c = db.cards.find(x=>String(x.id)===String(cardId));
  if (!c) return;
  const tabId = String(c.tab);
  const ID_EDIT = 'meow_wbv4_edit';
  const bd2 = _modalShell(ID_EDIT, `编辑：${c.title||'条目'}`, '✎');
  bd2.innerHTML = `
    <div class="wbv4Mini">编辑后点"确认回写同步"会保存到本地并尝试写入酒馆世界书。</div>
    <div class="wbv4Row"><div class="l">标题</div><div class="r"><input id="e_title"></div></div>
    <div class="wbv4Row"><div class="l">Key</div><div class="r"><input id="e_key"></div></div>
    <div class="wbv4Row"><div class="l">正文内容</div><div class="r"><textarea id="e_text"></textarea></div></div>
    <div class="wbv4Tools" style="margin-top:12px;">
      <button class="wbv4Btn" id="e_save">确认回写同步</button>
      <button class="wbv4Btn" id="e_add">新增一条</button>
      <button class="wbv4Btn" id="e_del">删除本条</button>
    </div>
    <div style="margin-top:auto;padding-top:16px;">
  <button class="wbv4Btn" id="e_frame" style="width:100%;height:42px;border-radius:999px;">去模板与表格</button>
</div>
  `;
  bd2.querySelector('#e_title').value = c.title||'';
  bd2.querySelector('#e_key').value = c.key||'';
  bd2.querySelector('#e_text').value = c.text||'';

  // === 确认回写同步（只更新已有酒馆条目，不新建） ===
  bd2.querySelector('#e_save').addEventListener('click', async ()=>{
    const db2 = loadDB();
    const cc = db2.cards.find(x=>String(x.id)===String(cardId));
    if (!cc) return;
    cc.title = bd2.querySelector('#e_title').value.trim();
    cc.key   = bd2.querySelector('#e_key').value.trim();
    cc.text  = bd2.querySelector('#e_text').value;
    saveDB(db2);
    try {
      if (typeof MEOW_WB_API !== 'undefined' && typeof MEOW_WB_API.listEntries === 'function') {
        const { all } = await MEOW_WB_API.listEntries();
        const commentKey = cc.title || cc.key || '条目';
        const exist = all.find(e => String(e.comment||e.memo||'') === commentKey);
        if (exist && exist.uid) {
          const keys = cc.key ? cc.key.split(',').map(s=>s.trim()).filter(Boolean) : [commentKey];
          await MEOW_WB_API.upsertByComment({ comment: commentKey, content: cc.text||'', keys, enabled:true });
          _toast('✅ 已更新酒馆世界书');
        } else {
          _toast('已保存到本地（酒馆无此条目，请通过总结模块上传新建）');
        }
      } else {
        _toast('已保存到本地');
      }
    } catch(e) {
      _toast('已保存，回写失败：'+(e?.message||e));
    }
    renderAll();
    try{ meowSyncElOutFromWB(); }catch(e){}
    try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
  }, {passive:false});

  // === 新增一条 ===
  bd2.querySelector('#e_add').addEventListener('click', ()=>{
    const db2 = loadDB();
    const max = db2.cards.filter(x=>x.tab===tabId).reduce((m,x)=>Math.max(m, x.order??0), 0);
    const nc = { id:uid(), tab:tabId, title:'新条目', key:'', text:'', template:'', note:'', page:'a', order:max+1 };
    db2.cards.push(nc);
    saveDB(db2);
    renderAll();
    openCardBack(db2, nc.id);
  }, {passive:false});

  // === 删除本条 ===
  bd2.querySelector('#e_del').addEventListener('click', async ()=>{
    const db2 = loadDB();
    const same = db2.cards.filter(x=>x.tab===tabId);
    if (same.length<=1){ _toast('至少保留1条'); return; }
    const delCard = db2.cards.find(x=>String(x.id)===String(cardId));
    db2.cards = db2.cards.filter(x=>String(x.id)!==String(cardId));
    saveDB(db2);
    renderAll();
    _doc.getElementById(ID_EDIT)?.remove?.();
    try{ meowSyncElOutFromWB(); }catch(e){}
    // 同步删除酒馆世界书对应条目
    if(delCard){
      try{
        const commentKey = delCard.title || delCard.key || '条目';
        if(typeof MEOW_WB_API !== 'undefined' && typeof MEOW_WB_API.deleteByComment === 'function'){
          const r = await MEOW_WB_API.deleteByComment(commentKey);
          _toast(r.ok ? '已删除（含酒馆世界书）' : '已删除本地（酒馆世界书删除失败）');
        } else {
          _toast('已删除本地');
        }
      }catch(e){ _toast('已删除本地'); }
    } else {
      _toast('已删除');
    }
    try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
  }, {passive:false});

  // === 去改框架规则 ===
  bd2.querySelector('#e_frame').addEventListener('click', ()=>{
    // 关闭编辑弹窗，打开总结模块，跳到模板与表格
    closeModal(ID_EDIT);
    setTimeout(()=>{
      try { openSummaryModal(); } catch(e){}
      setTimeout(()=>{
        var sharedSec = doc.querySelector('#meow_shared_sec');
        if (sharedSec) sharedSec.open = true;
        var tplSec = doc.querySelector('#meow_tpl_sec');
        if (tplSec) {
          tplSec.open = true;
          tplSec.scrollIntoView({behavior:'smooth',block:'start'});
        }
      }, 300);
    }, 200);
  }, {passive:false});
}  function bindListEvents(db){
    // 点卡：进入编辑（圆点/工具区不触发）
    $list.querySelectorAll('[data-open]').forEach(el=>{
  el.addEventListener('click', (ev)=>{
    const id = el.getAttribute('data-open');
    openCardBack(loadDB(), id);
  }, {passive:false});
});

    // 工具按钮
    

    // 拖拽排序（同Tab内）
    let dragId = '';
    let overId = '';
    const wraps = [...$list.querySelectorAll('.wbv4CardWrap[data-id]')];
    wraps.forEach(w=>{
      w.addEventListener('dragstart', (ev)=>{
        dragId = w.getAttribute('data-id')||'';
        try{ ev.dataTransfer.setData('text/plain', dragId); }catch(e){}
      });
      w.addEventListener('dragover', (ev)=>{ ev.preventDefault(); overId = w.getAttribute('data-id')||''; });
      w.addEventListener('dragend', ()=>{
        if (dragId && overId && dragId!==overId){
          const a = db.cards.find(x=>String(x.id)===String(dragId));
          const b = db.cards.find(x=>String(x.id)===String(overId));
          if (a && b && a.tab===b.tab){
            const ao = a.order??0, bo = b.order??0;
            a.order = bo; b.order = ao;
            saveDB(db);
            renderAll();
          }
        }
        dragId=''; overId='';
      });
    });
  }

  function addNewTab(){
    const db = loadDB();
    const name = (prompt('新增模板页名称：', '新板块')||'').trim();
    if (!name) return;
    const id = (prompt('板块ID（英文/数字，唯一）：', name.replace(/\s+/g,'_'))||'').trim();
    if (!id) return;
    if (db.tabs.some(t=>String(t.id)===String(id))){
      _toast('该ID已存在');
      return;
    }
    const maxOrder = db.tabs.reduce((m,t)=>Math.max(m, t.order??0), 0);
    db.tabs.push({ id, name, icon:'📌', order:maxOrder+1 });
    db.show[id] = true;
    db.frames[id] = defaultFrame(id);
    db.cards.push({ id:uid(), tab:id, title:name, key:'', text:'新页初始预设条目：可承接表格总结结果。', template:'', note:'', page:'a', order:0 });
    db.active = id;
    saveDB(db);
    
    renderAll();
  }


  function openFrameRule(db, tabId){
    const t  = db.tabs.find(x=>x.id===tabId) || { id:tabId, name:tabId };
    const fr = db.frames?.[tabId] || defaultFrame(tabId);

    const ID_FR = 'meow_wbv4_frame';
    const bd2 = _modalShell(ID_FR, `框架规则：${t.name}`, '🧩');

    bd2.innerHTML = `
      <div class="wbv4Mini">上半部分=组备注+字段定义；下半部分=注入/新增/修改/删除规则。保存后会同步到总结表格注入。</div>

      <div class="wbv4Row">
  <div class="l">启用注入</div>
  <div class="r">
    <label style="display:flex;align-items:center;gap:10px;">
      <input id="fr_on" type="checkbox" ${fr.enabled!==false?'checked':''}>
    </label>
    <div class="wbv4Mini" style="padding:6px 0 0;">开启后，本组会注入总结总提示词</div>
  </div>
</div>

      <div class="wbv4Row"><div class="l">组备注</div><div class="r"><textarea id="fr_note"></textarea></div></div>

      <div class="wbv4Mini" style="margin-top:12px;">字段定义（左=字段名；右=备注提示词）</div>
      <div id="fr_fields"></div>

      <div class="wbv4Tools" style="margin-top:10px;">
        <button class="wbv4Btn" id="fr_add">+ 新增字段</button>
      </div>

      <div class="wbv4Mini" style="margin-top:14px;">底部规则</div>
      <div class="wbv4Row"><div class="l">注入</div><div class="r"><textarea id="r_inj"></textarea></div></div>
      <div class="wbv4Row"><div class="l">新增</div><div class="r"><textarea id="r_add"></textarea></div></div>
      <div class="wbv4Row"><div class="l">修改</div><div class="r"><textarea id="r_mod"></textarea></div></div>
      <div class="wbv4Row"><div class="l">删除</div><div class="r"><textarea id="r_del"></textarea></div></div>

      <div class="wbv4Tools" style="margin-top:12px;">
        <button class="wbv4Btn" id="fr_save">注入确认并保存</button>
        <button class="wbv4Btn" id="fr_close">关闭</button>
      </div>
    `;

    bd2.querySelector('#fr_note').value = fr.note||'';
    bd2.querySelector('#r_inj').value  = fr.rules?.inject||'';
    bd2.querySelector('#r_add').value  = fr.rules?.add||'';
    bd2.querySelector('#r_mod').value  = fr.rules?.modify||'';
    bd2.querySelector('#r_del').value  = fr.rules?.del||'';

    const $fields = bd2.querySelector('#fr_fields');
    function drawFields(){
      $fields.innerHTML = (fr.fields||[]).map((f,i)=>`
        <div class="wbv4Row" style="margin-top:8px;">
          <div class="l"><input data-k="${i}" value="${esc(f.key||'')}" placeholder="字段名"></div>
          <div class="r" style="display:flex;gap:8px;">
            <input data-p="${i}" value="${esc(f.prompt||'')}" placeholder="备注提示词">
            <button class="wbv4Btn" data-del="${i}" style="width:52px;">删</button>
          </div>
        </div>
      `).join('');

      $fields.querySelectorAll('[data-k]').forEach(inp=>{
        inp.addEventListener('input', ()=>{
          fr.fields[parseInt(inp.getAttribute('data-k'),10)].key = inp.value;
        }, {passive:true});
      });
      $fields.querySelectorAll('[data-p]').forEach(inp=>{
        inp.addEventListener('input', ()=>{
          fr.fields[parseInt(inp.getAttribute('data-p'),10)].prompt = inp.value;
        }, {passive:true});
      });
      $fields.querySelectorAll('[data-del]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          fr.fields.splice(parseInt(btn.getAttribute('data-del'),10), 1);
          drawFields();
        }, {passive:false});
      });
    }
    drawFields();

    bd2.querySelector('#fr_add').addEventListener('click', ()=>{
      fr.fields.push({ key:`字段${fr.fields.length+1}`, prompt:'' });
      drawFields();
    }, {passive:false});

    bd2.querySelector('#fr_save').addEventListener('click', ()=>{
      const db2 = loadDB();
      fr.enabled = !!bd2.querySelector('#fr_on').checked;
      fr.note = bd2.querySelector('#fr_note').value.trim();
      fr.rules = {
        inject: bd2.querySelector('#r_inj').value.trim(),
        add:    bd2.querySelector('#r_add').value.trim(),
        modify: bd2.querySelector('#r_mod').value.trim(),
        del:    bd2.querySelector('#r_del').value.trim(),
      };
      db2.frames[tabId] = fr;
      saveDB(db2);
      syncToTableInject(db2);
      renderAll();
      _toast('已保存并同步到总结注入');
    }, {passive:false});

    bd2.querySelector('#fr_close').addEventListener('click', ()=>{
      _doc.getElementById(ID_FR)?.remove?.();
    }, {passive:false});
  }

    function openBaseSetting(){
    const ID_ST = 'meow_wbv4_base';
    const bd2 = _modalShell(ID_ST, '酒馆世界书基础设置', '⚙');

    const db = loadDB();     const tabs = Array.isArray(db.tabs) ? db.tabs.slice() : [];

    // ===================== 关键：不要再用 .wbv4Row 的 l/r 两列布局 =====================
    // base 设置页改成“左文案 + 右开关”的独立行结构，避免长文案被挤成竖排
    const BASE_IDS = new Set(['time','role','plot','event','task','item']);

// 尝试从 TavernHelper 读取酒馆世界书条目信息（异步，先用缓存或空）
const _stEntryCache = {};
(async ()=>{
  try {
    if (typeof MEOW_WB_API !== 'undefined' && typeof MEOW_WB_API.listEntries === 'function') {
      const { all } = await MEOW_WB_API.listEntries();
      for (const e of all) {
        if (e && e.comment) _stEntryCache[e.comment] = e;
      }
      // 重新渲染展开区的酒馆属性
      bd2.querySelectorAll('[data-st-info]').forEach(el => {
        const tid = el.getAttribute('data-st-info');
        const tabName = (db.tabs||[]).find(t=>t.id===tid)?.name || tid;
        const entry = _stEntryCache[tabName] || null;
        if (entry) {
          const posNames = ['角色定义之前','角色定义之后','作者注释之前','作者注释之后','@D'];
          el.innerHTML = `
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${entry.enabled !== false ? '#4ade80' : '#f87171'};"></span>
              <span style="font-size:11px;color:var(--meow-sub);">${entry.enabled !== false ? '启用' : '禁用'}</span>
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${entry.type === 'vectorized' ? '#60a5fa' : '#d4d4d4'};margin-left:6px;"></span>
              <span style="font-size:11px;color:var(--meow-sub);">${entry.type === 'vectorized' ? '向量化' : (entry.type||'constant')}</span>
            </div>
            <div style="font-size:11px;color:var(--meow-sub);line-height:1.5;">
              位置: ${posNames[entry.position] || entry.position || '角色定义之前'}
              ｜ 深度: ${entry.depth ?? '-'}
              ｜ 顺序: ${entry.order ?? '-'}
              ｜ 触发%: ${entry.probability ?? 100}
            </div>
            <div style="font-size:11px;color:var(--meow-sub);margin-top:2px;">
              关键词: ${(entry.keys||[]).join(', ') || '（无）'}
            </div>
          `;
        } else {
          el.innerHTML = `<div style="font-size:11px;color:var(--meow-sub);">（未在酒馆世界书中找到对应条目）</div>`;
        }
      });
    }
  } catch(e) { /* 静默：读不到不影响UI */ }
})();

const baseHtml = tabs.map(tab => {
  const tabName = tab.name || tab.id;
  const isOn = (db.show || {})[tab.id] !== false;
  const isDeletable = !['time','char','story','event','task','item'].includes(tab.id);

  return `
  <div class="wbv4BaseRow" data-tabid="${tab.id}" style="
    border-radius:16px;padding:14px 16px;
    margin-bottom:10px;
  ">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <div>
        <div style="font-weight:900;font-size:14px;">${tabName}</div>
        <div style="font-size:11px;margin-top:2px;">控制本板块是否参与"表格注入组"</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        ${isDeletable ? `<button class="wbv4BaseDelBtn" data-tabid="${tab.id}" style="
          font-size:11px;padding:2px 10px;border-radius:12px;border:1px solid rgba(0,0,0,.1);
          background:rgba(255,255,255,.8);cursor:pointer;color:rgba(46,38,30,.6);
        ">删除</button>` : ''}
        <label style="position:relative;width:48px;height:26px;display:inline-block;">
          <input type="checkbox" class="wbv4BaseToggle" data-tabid="${tab.id}" ${isOn ? 'checked' : ''}
            style="opacity:0;width:0;height:0;position:absolute;">
          <span class="wbv4ToggleTrack" style="
            position:absolute;inset:0;border-radius:13px;cursor:pointer;transition:.3s;
          "></span>
          <span class="wbv4ToggleThumb" style="
            position:absolute;top:3px;left:${isOn ? '25px' : '3px'};width:20px;height:20px;
            border-radius:50%;transition:.3s;
            box-shadow:0 1px 4px rgba(0,0,0,.15);
          "></span>
        </label>
      </div>
    </div>

    <!-- ✅ 酒馆条目状态+设置（默认折叠，点卡片行展开） -->
    <div class="wbv4TavernLink" data-tabid="${tab.id}" style="
      display:none;
      margin-top:10px;padding:12px;border-radius:12px;
      background:rgba(0,0,0,.035);
    ">
      <!-- 状态显示 -->
      <div class="wbv4TvStatus" data-tabid="${tab.id}" style="
        font-size:12px;line-height:1.6;color:rgba(46,38,30,.55);
        padding:8px 10px;border-radius:8px;
        background:rgba(255,255,255,.55);margin-bottom:10px;
      ">检测中…</div>

      <!-- 关键词：满宽输入框 -->
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;color:rgba(46,38,30,.42);margin-bottom:5px;">关键词（英文逗号分隔）</div>
        <input type="text" class="wbv4TvKeys" data-tabid="${tab.id}"
          placeholder="例：Summary, 时空信息"
          style="width:100%;box-sizing:border-box;padding:8px 10px;
          border-radius:10px;border:1px solid rgba(0,0,0,.08);
          font-size:12px;background:rgba(255,255,255,.82);
          outline:none;color:rgba(46,38,30,.82);">
      </div>

      <!-- 开关：竖排，iOS/PC 都不挤 -->
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
          padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.52);">
          <input type="checkbox" class="wbv4TvEnabled" data-tabid="${tab.id}"
            style="width:17px;height:17px;flex:0 0 auto;cursor:pointer;">
          <span style="font-size:12px;font-weight:600;color:rgba(46,38,30,.80);">🔵 启用条目</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
          padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.52);">
          <input type="checkbox" class="wbv4TvConstant" data-tabid="${tab.id}"
            style="width:17px;height:17px;flex:0 0 auto;cursor:pointer;">
          <span style="font-size:12px;font-weight:600;color:rgba(46,38,30,.80);">🟢 常驻注入（constant）</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;
          padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.52);">
          <input type="checkbox" class="wbv4TvVector" data-tabid="${tab.id}"
            style="width:17px;height:17px;flex:0 0 auto;cursor:pointer;">
          <span style="font-size:12px;font-weight:600;color:rgba(46,38,30,.80);">🧲 向量化</span>
        </label>
      </div>

      <!-- 保存按钮：满宽 -->
      <button class="wbv4TvSave" data-tabid="${tab.id}" style="
        width:100%;padding:9px 0;border-radius:10px;
        border:1px solid rgba(180,165,140,.45);
        background:rgba(180,165,140,.18);cursor:pointer;
        color:rgba(46,38,30,.78);font-size:12px;font-weight:700;
        box-sizing:border-box;">保存到酒馆</button>
    </div>

  </div>`;
}).join('');


    bd2.innerHTML = `
      <style>
        /* 仅影响本弹窗：#meow_wbv4_base */
        #meow_wbv4_base .wbv4Mini{
          font-size:12px; line-height:1.45;
          color: var(--meow-sub, rgba(46,38,30,.56));
          margin-bottom:10px;
        }

#meow_wbv4_base .wbv4SwitchGroup{
  margin-top:10px;
  border:1px solid var(--meow-line, rgba(0,0,0,.06));
  background: var(--meow-card, rgba(255,255,255,.66));
  border-radius:16px;
  box-shadow: 0 10px 22px rgba(0,0,0,.04);
  overflow:hidden;
}
#meow_wbv4_base .wbv4SwitchGroup .wbv4SwitchRow{
  margin-top:0;
  border:none;
  box-shadow:none;
  border-radius:0;
}
#meow_wbv4_base .wbv4SwitchExpand{
  background: var(--meow-bg, rgba(246,243,238,.5));
}
        /* 行容器：左侧文案自适应，右侧开关固定宽度 */
        #meow_wbv4_base .wbv4SwitchRow{
          display:flex;
          gap:12px;
          align-items:center;
          padding:12px 12px;
          border:1px solid var(--meow-line, rgba(0,0,0,.06));
          background: var(--meow-card, rgba(255,255,255,.66));
          border-radius:16px;
          box-shadow: 0 10px 22px rgba(0,0,0,.04);
          margin-top:10px;
        }

        #meow_wbv4_base .wbv4SwitchText{
          flex:1 1 auto;
          min-width:0;
        }
        #meow_wbv4_base .wbv4SwitchText .t{
          font-weight:900;
          font-size:14px;
          color: var(--meow-text, rgba(46,38,30,.88));
          line-height:1.2;
          word-break:break-word;
        }
        #meow_wbv4_base .wbv4SwitchText .s{
          margin-top:4px;
          font-size:12px;
          color: var(--meow-sub, rgba(46,38,30,.56));
          line-height:1.35;
          word-break:break-word;
        }

        /* 右侧开关：用 checkbox + 假开关，避免原生样式在 iOS 上奇怪变形 */
        #meow_wbv4_base .wbv4SwitchCtl{
          flex:0 0 auto;
          width:64px;
          display:flex;
          justify-content:flex-end;
          align-items:center;
          position:relative;
        }
        #meow_wbv4_base .wbv4SwitchCtl input{
          position:absolute;
          inset:0;
          opacity:0;
          margin:0;
        }
        #meow_wbv4_base .wbv4SwitchFake{
          width:56px;
          height:30px;
          border-radius:999px;
          background: rgba(0,0,0,.10);
          border:1px solid var(--meow-line, rgba(0,0,0,.08));
          box-shadow: none;
          position:relative;
          display:inline-block;
        }
        #meow_wbv4_base .wbv4SwitchFake::after{
          content:'';
          position:absolute;
          top:50%;
          left:3px;
          width:24px;
          height:24px;
          border-radius:999px;
          transform: translateY(-50%);
          background: var(--meow-card, rgba(255,255,255,.92));
          border:1px solid var(--meow-line, rgba(0,0,0,.08));
          box-shadow: 0 8px 16px rgba(0,0,0,.08);
          transition: transform .16s ease, left .16s ease;
        }
        #meow_wbv4_base .wbv4SwitchCtl input:checked + .wbv4SwitchFake{
          background: var(--meow-accent, rgba(225,215,196,.90));
          border-color: var(--meow-accent, rgba(198,186,164,.95));
        }
        #meow_wbv4_base .wbv4SwitchCtl input:checked + .wbv4SwitchFake::after{
          left:29px;
        }

        /* 底部按钮区：保持你现有 wbv4Btn 风格，只保证高度居中 */
        #meow_wbv4_base .wbv4Tools{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:12px;
        }
        #meow_wbv4_base .wbv4Tools .wbv4Btn{
          height:36px;
          padding:0 14px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          line-height:1;
        }
      </style>

      <div class="wbv4Mini">这里放基础设置（当前版本：板块显示与注入开关）。保存会同步到总结表格注入。</div>

      <div id="st_show">${baseHtml}</div>

      <div class="wbv4Tools" style="margin-top:12px;">
  <button class="wbv4Btn" id="st_preview_inject">查看本次注入预览</button>
  <button class="wbv4Btn" id="st_open_native">打开酒馆世界书</button>
  <button class="wbv4Btn" id="st_close">关闭</button>
</div>
    `;
// 手风琴：点行标题展开/收起酒馆详情区
bd2.querySelectorAll('.wbv4BaseRow').forEach(row=>{
  row.addEventListener('click', (ev)=>{
    // 点开关或删除按钮时不触发展开
    if (ev.target.closest('label') || ev.target.closest('.wbv4BaseDelBtn')) return;
    const tid = row.getAttribute('data-tabid');
    if (!tid) return;
    const detail = row.querySelector('.wbv4TavernLink');
    if (!detail) return;
    const wasOpen = detail.style.display !== 'none';
    // 先收起所有
    bd2.querySelectorAll('.wbv4TavernLink').forEach(el=>{ el.style.display='none'; });
    // 之前是关的就展开，并异步加载酒馆状态
    if (!wasOpen) {
      detail.style.display = 'block';
      const stInfo = detail.querySelector('.wbv4TvStatus');
      if (stInfo && stInfo.textContent === '检测中…') {
        _loadSTEntryForTab(tid, stInfo.parentElement || detail, db);
      }
    }
  }, {passive:false});
});

    // 绑定开关
    bd2.querySelectorAll('[data-show]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const db2 = loadDB();
        db2.show ||= {};
        db2.show[inp.getAttribute('data-show')] = !!inp.checked;
        saveDB(db2);
        
        renderAll();
      }, {passive:true});
    });

bd2.querySelectorAll('[data-del-tab]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const tabId = btn.getAttribute('data-del-tab');
    if (!tabId) return;
    if (!confirm(`确定删除板块「${tabId}」？（会删除该板块下所有条目，并更新表格注入组）`)) return;

    const db2 = loadDB();

    // 1) 删 tabs / frames / show
    db2.tabs = (db2.tabs||[]).filter(t=>String(t.id)!==String(tabId));
    if (db2.frames) delete db2.frames[tabId];
    if (db2.show)   delete db2.show[tabId];

    // 2) 删 cards（该板块全部条目）
    db2.cards = (db2.cards||[]).filter(c=>String(c.tab)!==String(tabId));

    // 3) 修正 active
    if (String(db2.active) === String(tabId)){
      db2.active = db2.tabs?.[0]?.id || 'time';
    }

    saveDB(db2);
    
    renderAll();
    _toast('已删除板块');
  }, {passive:false});
});

bd2.querySelector('#st_preview_inject')?.addEventListener('click', ()=>{
  const inj = (typeof tgBuildInjectionText === 'function') ? tgBuildInjectionText() : '';
  if (!inj) { _toast('当前没有启用的条目组'); return; }
  const bd3 = _modalShell('meow-tg-preview', '本次注入预览', '👀');
  bd3.innerHTML = `
    <div class="sec">
      <h3>👀 注入内容</h3>
      <textarea style="min-height:260px;">${String(inj).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
    </div>
  `;
}, {passive:false});
    // 打开原生世界书
    bd2.querySelector('#st_open_native')?.addEventListener('click', ()=>{
  try {
    // 多级查找酒馆世界书 UI 按钮（兼容 local / cloud / iOS 各版本）
    const _d = (typeof doc !== 'undefined') ? doc : document;
    const _td = (() => { try { return window.top?.document; } catch(e) { return null; } })();
    const _pd = (() => { try { return window.parent?.document; } catch(e) { return null; } })();
    const docs = [_d, _td, _pd].filter(Boolean);

    // SillyTavern 常见的世界书按钮选择器（按优先级）
    const selectors = [
      '#WIDrawerIcon',                          // 经典本地版抽屉图标
      '#world_info_button',                      // 部分版本
      '[data-i18n="WI/Core/WorldInfoBtn"]',      // i18n 版
      'div[id*="world_info"] .drawer-icon',      // 模糊匹配
      '#worldInfoDrawer .drawer-icon',           // drawer 图标
      '.drawer-icon.fa-globe',                   // FontAwesome 地球图标
      '#third_party_extension_world_info',       // 第三方扩展
    ];

    let clicked = false;
    for (const d of docs) {
      if (clicked) break;
      for (const sel of selectors) {
        try {
          const btn = d.querySelector(sel);
          if (btn) {
            btn.click();
            clicked = true;
            break;
          }
        } catch(e){}
      }
    }

    if (!clicked) {
      // 最后尝试：SillyTavern getContext API
      try {
        const ctx = (window.SillyTavern?.getContext?.() ||
                     window.top?.SillyTavern?.getContext?.() ||
                     window.parent?.SillyTavern?.getContext?.());
        if (ctx && typeof ctx.openWorldInfo === 'function') {
          ctx.openWorldInfo();
          clicked = true;
        }
      } catch(e){}
    }

    if (!clicked) {
      _toast('未找到酒馆世界书按钮，请手动打开（侧栏 → 世界书图标）');
    }
  } catch(e) {
    _toast('打开失败：'+(e?.message||e));
  }
}, {passive:false});
// ===== 异步：读取酒馆世界书条目状态 =====
(async function loadTavernStatus(){
  if (typeof MEOW_WB_API === 'undefined') return;
  try{
    const canDo = await MEOW_WB_API.canWrite?.();
    if (!canDo) return;
    const listed = await MEOW_WB_API.listEntries?.();
    const all = listed?.all;
    if (!Array.isArray(all)) return;

    // 遍历每个 tab，找酒馆里对应的 [MEOW] 条目
    bd2.querySelectorAll('.wbv4TavernLink').forEach(row => {
      const tabId = row.dataset.tabid;
      const tab = tabs.find(t => t.id === tabId);
      const tabName = tab?.name || tabId;
      const comment = `[MEOW]${tabName}`;

      const entry = all.find(e => e?.comment === comment);
      const statusEl = row.querySelector('.wbv4TvStatus');
      const keysEl = row.querySelector('.wbv4TvKeys');
      const enabledEl = row.querySelector('.wbv4TvEnabled');
      const constantEl = row.querySelector('.wbv4TvConstant');
      const vectorEl = row.querySelector('.wbv4TvVector');

      if (!entry){
        if (statusEl) statusEl.innerHTML = `<span style="color:rgba(200,120,60,.8);">⚠ 酒馆中暂无 [MEOW]${tabName} 条目（总结后自动创建）</span>`;
        return;
      }

      if (statusEl) statusEl.innerHTML = `<span style="color:rgba(80,140,80,.85);">✓ 已找到 [MEOW]${tabName}（UID: ${String(entry.uid||'').slice(0,8)}…）</span>`;

      // 回填
      if (keysEl) keysEl.value = Array.isArray(entry.keys) ? entry.keys.join(', ') : (entry.key || '');
      if (enabledEl) enabledEl.checked = entry.enabled !== false;
      if (constantEl) constantEl.checked = entry.type === 'constant' || entry.constant === true;
      if (vectorEl) vectorEl.checked = entry.vectorized === true || entry.selective === true;
    });
  }catch(e){
    console.warn('[MEOW] 读取酒馆条目状态失败:', e);
  }
})();

// ===== "保存到酒馆" 按钮 =====
bd2.querySelectorAll('.wbv4TvSave').forEach(btn => {
  btn.addEventListener('click', async () => {
    const tabId = btn.dataset.tabid;
    const tab = tabs.find(t => t.id === tabId);
    const tabName = tab?.name || tabId;
    const comment = `[MEOW]${tabName}`;
    const row = btn.closest('.wbv4TavernLink');

    const keysStr = row.querySelector('.wbv4TvKeys')?.value || tabName;
    const enabled = row.querySelector('.wbv4TvEnabled')?.checked ?? true;
    const constant = row.querySelector('.wbv4TvConstant')?.checked ?? true;
    const vectorized = row.querySelector('.wbv4TvVector')?.checked ?? false;

    const keys = keysStr.split(',').map(s=>s.trim()).filter(Boolean);

    try{
      btn.textContent = '保存中…';
      btn.disabled = true;

      await MEOW_WB_API.upsertByComment({
        comment: comment,
        keys: keys,
        enabled: enabled,
        type: constant ? 'constant' : 'selective',
        vectorized: vectorized,
        order: 9999,
        prevent_recursion: true
      });

      btn.textContent = '✓ 已保存';
      setTimeout(()=>{ btn.textContent = '保存到酒馆'; btn.disabled = false; }, 1500);
      _toast(`${tabName} 酒馆设置已更新`);
    }catch(e){
      btn.textContent = '保存失败';
      setTimeout(()=>{ btn.textContent = '保存到酒馆'; btn.disabled = false; }, 1500);
      console.warn('[MEOW] 保存酒馆设置失败:', e);
    }
  });
});

    // 关闭
    bd2.querySelector('#st_close')?.addEventListener('click', ()=>{
      _doc.getElementById(ID_ST)?.remove?.();
    }, {passive:false});
  }

  function openBeauty(){
    const ID_B = 'meow_wbv4_beauty';
    const bd2 = _modalShell(ID_B, '美化自定义', '🎨');
    const b = getBeauty();

    bd2.innerHTML = `
      <div class="wbv4Mini">这里只管理美化（CSS/HTML/字体）。CSS 仅作用于世界书弹窗根容器，不污染其它模块。</div>

      <div class="wbv4Row">
        <div class="l">字体</div>
        <div class="r">
          <select id="b_font_mode">
            <option value="default">默认（不改）</option>
            <option value="sans">无衬线（系统）</option>
            <option value="serif">衬线（系统）</option>
            <option value="mono">等宽（系统）</option>
            <option value="custom_file">自定义字体（导入文件）</option>
            <option value="custom_url">自定义字体（URL直链）</option>
          </select>

          <div id="b_file_box" style="margin-top:10px;">
            <div class="wbv4Mini" id="b_file_state" style="margin-bottom:8px;"></div>
            <div class="wbv4Tools" style="margin-top:8px;">
              <button class="wbv4Btn" id="b_font_pick">选择字体文件</button>
              <button class="wbv4Btn" id="b_font_clear">清除文件字体</button>
            </div>
            <input id="b_font_file" type="file" accept=".woff2,.woff,.ttf,.otf" style="display:none;">
            <div class="wbv4Mini" style="margin-top:8px;">建议 woff2/woff（文件太大会存不进本地存储）。</div>
          </div>

          <div id="b_url_box" style="margin-top:10px;">
            <div class="wbv4Mini" id="b_url_state" style="margin-bottom:8px;"></div>
            <input id="b_font_url" placeholder="https://.../xxx.woff2 或 /fonts/xxx.woff2">
            <div class="wbv4Tools" style="margin-top:8px;">
              <button class="wbv4Btn" id="b_url_use">使用这个URL</button>
              <button class="wbv4Btn" id="b_url_clear">清除URL字体</button>
            </div>
            <div class="wbv4Mini" style="margin-top:8px;">提示：URL 字体可能会被跨域(CORS)拦截；同域或支持 CORS 的静态站/CDN 最稳。</div>
          </div>

          <div class="wbv4Mini" style="margin-top:10px;">预览：</div>
          <div id="b_font_preview" style="
            padding:10px 12px;border-radius:14px;
            border:1px solid var(--meow-line,rgba(0,0,0,.08));
            background:var(--meow-input,rgba(255,255,255,.68));
            color:var(--meow-text,rgba(46,38,30,.82));
            line-height:1.5;
          ">Mistisle'sEcho · 0123456789 · 天地玄黄 宇宙洪荒</div>
        </div>
      </div>

      <div class="wbv4Row"><div class="l">自定义CSS</div><div class="r">
        <textarea id="b_css" style="min-height:160px;"></textarea>
      </div></div>

      <div class="wbv4Row"><div class="l">自定义HTML</div><div class="r">
        <textarea id="b_html" style="min-height:120px;" placeholder="会插入在顶部搜索框下方"></textarea>
      </div></div>

      <div class="wbv4Tools" style="margin-top:12px;">
        <button class="wbv4Btn" id="b_save">保存并应用</button>
        <button class="wbv4Btn" id="b_close">关闭</button>
      </div>
    `;

    const $ = (s)=>bd2.querySelector(s);
    $('#b_css').value = b.css || '';
    $('#b_html').value = b.html || '';
    $('#b_font_mode').value = b.fontMode || 'default';
    $('#b_font_url').value = b.fontUrl || '';

    function cssUrl(u){ return String(u||'').trim().replace(/'/g, "\\'"); }
    function guessFmt(u){
      const s = String(u||'').split('?')[0].split('#')[0].toLowerCase();
      if (s.endsWith('.woff2')) return 'woff2';
      if (s.endsWith('.woff'))  return 'woff';
      if (s.endsWith('.ttf'))   return 'truetype';
      if (s.endsWith('.otf'))   return 'opentype';
      return '';
    }

    function ensurePreviewFace(){
      let st = bd2.querySelector('#b_font_face_preview');
      if (!st){
        st = _doc.createElement('style');
        st.id = 'b_font_face_preview';
        bd2.appendChild(st);
      }

      const mode = $('#b_font_mode').value;
      let css = '';

      if (mode === 'custom_file' && String(b.fontData||'').startsWith('data:')){
        css = `@font-face{font-family:"MEOW_USER_FONT";src:url("${b.fontData}");font-display:swap;}`;
      } else if (mode === 'custom_url' && String(b.fontUrl||'').trim()){
        const u = cssUrl(b.fontUrl);
        const fmt = guessFmt(b.fontUrl);
        const fmtPart = fmt ? ` format("${fmt}")` : '';
        css = `@font-face{font-family:"MEOW_USER_FONT";src:url('${u}')${fmtPart};font-display:swap;}`;
      }
      st.textContent = css;
    }

    function renderState(){
      const mode = $('#b_font_mode').value;

      const fileState = $('#b_file_state');
      if (fileState){
        fileState.textContent = (b.fontData && String(b.fontData).startsWith('data:'))
          ? `文件字体：已导入（${b.fontName || '未命名'}）`
          : '文件字体：未导入';
      }

      const urlState = $('#b_url_state');
      if (urlState){
        urlState.textContent = (b.fontUrl && String(b.fontUrl).trim())
          ? `URL字体：已填写（${String(b.fontUrl).trim().slice(0,60)}${String(b.fontUrl).trim().length>60?'…':''}）`
          : 'URL字体：未填写';
      }

      // 只显示对应面板
      $('#b_file_box').style.display = (mode === 'custom_file') ? '' : 'none';
      $('#b_url_box').style.display  = (mode === 'custom_url')  ? '' : 'none';
    }

    function applyPreview(){
      const mode = $('#b_font_mode').value;
      const pv = $('#b_font_preview');
      if (!pv) return;

      if (mode === 'serif') pv.style.fontFamily = 'ui-serif, Georgia, "Times New Roman", Times, serif';
      else if (mode === 'sans') pv.style.fontFamily = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "PingFang SC","Hiragino Sans GB","Microsoft YaHei", sans-serif';
      else if (mode === 'mono') pv.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
      else if ((mode === 'custom_file' && b.fontData) || (mode === 'custom_url' && b.fontUrl)){
        ensurePreviewFace();
        pv.style.fontFamily = '"MEOW_USER_FONT", ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
      } else {
        pv.style.fontFamily = '';
      }
    }

    async function readFileAsDataURL(file){
      return await new Promise((resolve, reject)=>{
        const fr = new FileReader();
        fr.onload = ()=> resolve(String(fr.result || ''));
        fr.onerror = ()=> reject(fr.error || new Error('read failed'));
        fr.readAsDataURL(file);
      });
    }

    // 初始化
    renderState();
    applyPreview();

    $('#b_font_mode').addEventListener('change', ()=>{
      b.fontMode = $('#b_font_mode').value;
      renderState();
      applyPreview();
    }, {passive:true});

    // iOS 兼容：用按钮触发 file input
    $('#b_font_pick')?.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      $('#b_font_file')?.click();
    }, {passive:false});

    $('#b_font_file')?.addEventListener('change', async ()=>{
      try{
        const file = $('#b_font_file').files?.[0];
        if (!file) return;

        if (file.size > 1.6 * 1024 * 1024){
          _toast('字体文件太大（>1.6MB），建议转成 woff2 再导入');
          $('#b_font_file').value = '';
          return;
        }

        const dataUrl = await readFileAsDataURL(file);
        if (!String(dataUrl).startsWith('data:')){
          _toast('读取失败：不是 dataURL');
          return;
        }

        b.fontName = String(file.name || '').replace(/\.[^.]+$/,'') || '自定义字体';
        b.fontData = dataUrl;
        b.fontMode = 'custom_file';
        $('#b_font_mode').value = 'custom_file';

        renderState();
        applyPreview();
        _toast('已导入（记得点“保存并应用”）');
      }catch(e){
        _toast('字体导入失败');
      }
    }, {passive:false});

    $('#b_font_clear')?.addEventListener('click', ()=>{
      b.fontName = '';
      b.fontData = '';
      try{ $('#b_font_file').value = ''; }catch(_){}
      renderState();
      applyPreview();
      _toast('已清除（记得点“保存并应用”）');
    }, {passive:false});

    // URL 直链
    $('#b_url_use')?.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      b.fontUrl = String($('#b_font_url')?.value || '').trim();
      b.fontMode = 'custom_url';
      $('#b_font_mode').value = 'custom_url';
      renderState();
      applyPreview();
      _toast('已使用URL（预览不变通常是 CORS/URL 不可访问；保存后也会按同样方式加载）');
    }, {passive:false});

    $('#b_url_clear')?.addEventListener('click', ()=>{
      b.fontUrl = '';
      $('#b_font_url').value = '';
      renderState();
      applyPreview();
      _toast('已清除URL（记得点“保存并应用”）');
    }, {passive:false});

    // 保存
    $('#b_save').addEventListener('click', ()=>{
      _lsSet(LS_BEAUTY, {
        css: $('#b_css').value,
        html: $('#b_html').value,
        fontMode: String($('#b_font_mode').value || 'default'),
        fontName: b.fontName || '',
        fontData: b.fontData || '',
        fontUrl:  String($('#b_font_url')?.value || b.fontUrl || '').trim()
      });
      applyBeauty(root);
      _toast('已应用');
    }, {passive:false});

    $('#b_close').addEventListener('click', ()=>{
      _doc.getElementById(ID_B)?.remove?.();
    }, {passive:false});
  }
// ===== Markdown → 美化 HTML 转换器 =====
  function meowMd2Html(raw){
    const lines = String(raw||'').replace(/\r/g,'').split('\n');
    let html = '';
    let i = 0;

    while (i < lines.length){
      const line = lines[i];
      const trimmed = line.trim();

      // 空行
      if (!trimmed){ html += '<div style="height:8px;"></div>'; i++; continue; }

      // ===== 分批标题 =====
      if (/^={3,}\s*.+\s*={3,}$/.test(trimmed)){
        html += `<div style="margin:16px 0 8px;padding:10px 14px;border-radius:12px;background:linear-gradient(135deg,rgba(var(--meow-cr,198),var(--meow-cg,186),var(--meow-cb,164),.12),rgba(255,255,255,.3));border-left:3px solid var(--meow-accent,rgba(198,186,164,.85));font-weight:800;font-size:14px;color:var(--meow-text,rgba(46,38,30,.85));">${trimmed.replace(/^=+\s*/, '').replace(/\s*=+$/, '')}</div>`;
        i++; continue;
      }

      // ===== 【xxx】分区标题 =====
      const secMatch = trimmed.match(/^(?:【\s*([^】]{1,50})\s*】|\[\s*([^\]]{1,50})\s*\])$/);
      if (secMatch){
        const title = secMatch[1] || secMatch[2];
        html += `<div style="margin:14px 0 6px;padding:8px 12px;border-radius:10px;background:rgba(var(--meow-cr,198),var(--meow-cg,186),var(--meow-cb,164),.15);font-weight:900;font-size:13px;color:var(--meow-text,rgba(46,38,30,.88));border-left:3px solid var(--meow-accent,rgba(198,186,164,.85));">📌 ${title}</div>`;
        i++; continue;
      }

      // ===== Markdown 表格 =====
      if (trimmed.includes('|') && i+1 < lines.length && /\|[\s:]*-{2,}/.test(lines[i+1]||'')){
        // 解析表头
        const headers = trimmed.replace(/^\|/,'').replace(/\|$/,'').split('|').map(s=>s.trim());
        i += 2; // 跳过表头 + 分隔线
        const rows = [];
        while (i < lines.length && lines[i].trim().includes('|')){
          const cells = lines[i].trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(s=>s.trim());
          rows.push(cells);
          i++;
        }
        // 渲染表格
        html += `<div style="overflow-x:auto;margin:6px 0 10px;border-radius:12px;border:1px solid var(--meow-line,rgba(0,0,0,.08));background:var(--meow-card,rgba(255,255,255,.72));">`;
        html += `<table style="width:100%;border-collapse:collapse;font-size:inherit;line-height:1.5;">`;
        html += `<thead><tr>${headers.map(h=>`<th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--meow-accent-soft,rgba(198,186,164,.35));font-weight:800;color:var(--meow-text);white-space:nowrap;font-size:0.92em;">${h}</th>`).join('')}</tr></thead>`;
        html += `<tbody>`;
        rows.forEach((row,ri)=>{
          const bg = ri%2===0 ? 'transparent' : 'rgba(0,0,0,.02)';
          html += `<tr style="background:${bg};">${row.map(cell=>`<td style="padding:7px 10px;border-bottom:1px solid var(--meow-line,rgba(0,0,0,.05));color:var(--meow-text);word-break:break-word;max-width:40vw;">${cell}</td>`).join('')}</tr>`;
        });
        html += `</tbody></table></div>`;
        continue;
      }

      // ===== 普通文本行 =====
      html += `<div style="line-height:1.7;color:var(--meow-text,rgba(46,38,30,.80));padding:1px 0;">${trimmed}</div>`;
      i++;
    }
    return html;
  }

  // ===== 视图模式渲染：大总结/小总结/自定义 =====
  function renderTextView(mode){
    const $top = root.querySelector('.wbv4Top');
    const $bot = root.querySelector('.wbv4Bottom');
    if ($top) $top.style.display = 'none';
    if ($bot) $bot.style.display = 'none';

    const uid = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : '';
    const chatSt = (typeof meowLoadChatState === 'function') ? meowLoadChatState(uid) : {};
    const LS_TV_CUSTOM = 'meow_wb_textview_custom_v1';

    let initText = '';
    let hintText = '';

    if (mode === 'big'){
      initText = chatSt?.out || '';
      hintText = '大总结（只读，来自总结模块输出）';
    } else if (mode === 'small'){
      initText = chatSt?.outSmall || chatSt?.out || '';
      hintText = '小总结（只读，来自总结模块输出）';
    } else {
      try { initText = _lsGet(LS_TV_CUSTOM, ''); } catch(e){}
      hintText = '自定义（可编辑，本地自动保存）';
    }

    $hint.textContent = hintText;

    if (mode === 'custom'){
      // 自定义：可编辑 textarea
      $list.innerHTML = `
        <div style="padding:4px 0;">
          <textarea id="wbv4_tv_area" style="
            width:100%;min-height:50vh;resize:vertical;
            border-radius:14px;border:1px solid var(--meow-input-line,rgba(0,0,0,.08));
            background:var(--meow-input,rgba(255,255,255,.68));
            color:var(--meow-text,rgba(46,38,30,.82));
            padding:14px;line-height:1.65;outline:none;
            box-shadow:inset 0 1px 0 rgba(255,255,255,.65);
          " placeholder="自由编辑区：内容会自动保存到本地。">${String(initText||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          <div style="font-size:11px;color:var(--meow-sub);margin-top:6px;">内容自动保存。</div>
        </div>
      `;
      const ta = $list.querySelector('#wbv4_tv_area');
      if (ta) ta.addEventListener('input', ()=>{ try{_lsSet(LS_TV_CUSTOM,ta.value);}catch(e){} }, {passive:true});
    } else {
      // 大/小总结：美化渲染
      if (!initText.trim()){
        $list.innerHTML = `<div style="padding:30px 20px;text-align:center;color:var(--meow-sub);font-size:13px;">当前聊天暂无${mode==='big'?'大':'小'}总结。<br>请在总结模块执行后，这里会自动显示。</div>`;
        return;
      }

      const rendered = meowMd2Html(initText);
      $list.innerHTML = `
        <div style="padding:8px 2px;">
          ${rendered}
          <div style="display:flex;gap:8px;margin-top:14px;padding-top:10px;border-top:1px solid var(--meow-line,rgba(0,0,0,.06));">
            <button id="wbv4_tv_copy" style="flex:1;height:38px;border-radius:999px;border:1px solid rgba(120,110,95,.16);background:rgba(255,255,255,.62);color:rgba(80,68,52,.84);font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">📋 复制原文</button>
          </div>
        </div>
      `;

      const copyBtn = $list.querySelector('#wbv4_tv_copy');
      if (copyBtn){
        copyBtn.addEventListener('click', async ()=>{
          try{ await navigator.clipboard.writeText(initText); _toast('已复制'); }catch(e){ _toast('复制失败'); }
        }, {passive:false});
      }
    }
  }

  function renderAll(){
    const db = loadDB();
    db.q = String($q.value ?? db.q ?? '');
    saveDB(db);

    // ===== 视图模式分流 =====
    if (__wbViewMode !== 'table'){
      renderTextView(__wbViewMode);
      applyBeauty(root);
      return;
    }

    // 表格可视化：恢复正常布局
    const $top = root.querySelector('.wbv4Top');
    const $bot = root.querySelector('.wbv4Bottom');
    if ($top) $top.style.display = '';
    if ($bot) $bot.style.display = '';

    renderTabs(db);
    renderList(db);
    applyBeauty(root);
  }
// ===== 注入检查器（不动UI）=====
window.meowCheckTableInject = function(){
  try {
    const LS_KEY = (typeof LS_WB !== 'undefined') ? LS_WB : 'meow_worldbook_local_v1';
    let db = null;
    try { db = JSON.parse(localStorage.getItem(LS_KEY)); } catch(e){}
    if (!db || db.v !== 4) { toast?.('世界书数据为空或版本不对'); return null; }
    const tabs   = Array.isArray(db.tabs) ? db.tabs : [];
    const show   = db.show || {};
    const frames = db.frames || {};
    const total  = tabs.length;
    const on     = tabs.filter(t => show[String(t.id)] !== false).length;
    const names  = tabs.filter(t => show[String(t.id)] !== false).map(t => t.name || t.id);
    const snap = { totalTabs: total, enabledTabs: on, enabledNames: names };
    void(0)&&console.log('[MEOW][InjectCheck]', snap);
    toast?.(`注入检查：板块=${total} 启用=${on} → ${names.join(', ')}`);
    return snap;
  } catch(e) {
    console.warn('[MEOW][InjectCheck] failed', e);
    toast?.('注入检查失败');
    return null;
  }
};
async function _loadSTEntryForTab(tid, el, db) {
  if (!el) return;
  const tabName = (db.tabs||[]).find(t=>t.id===tid)?.name || tid;
  el.innerHTML = '<div style="color:var(--meow-sub);">加载中...</div>';
  try {
    if (typeof MEOW_WB_API === 'undefined' || typeof MEOW_WB_API.listEntries !== 'function') {
      el.innerHTML = '<div style="color:var(--meow-sub);">TavernHelper 不可用（本地模式无法读取酒馆条目）</div>';
      return;
    }
    const { all } = await MEOW_WB_API.listEntries();
    const entry = all.find(e => e && e.comment === tabName) || null;
    if (!entry) {
      el.innerHTML = `<div style="color:var(--meow-sub);">未在酒馆世界书中找到名为"${esc(tabName)}"的条目</div>`;
      return;
    }
    const posNames = {0:'角色定义之前', 1:'角色定义之后', 2:'示例消息之前', 3:'示例消息之后', 4:'@D 深度'};
    const posVal = posNames[entry.position] || entry.position || '角色定义之前';
    el.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${entry.enabled!==false?'#4ade80':'#f87171'};border:1px solid rgba(0,0,0,.1);"></span>
        <span style="font-size:12px;">${entry.enabled!==false?'启用':'禁用'}</span>
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${entry.vectorized?'#60a5fa':'#d4d4d4'};border:1px solid rgba(0,0,0,.1);margin-left:8px;"></span>
        <span style="font-size:12px;">${entry.vectorized?'向量化':'未向量化'}</span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">
        <div style="flex:1;min-width:100px;">
          <div style="font-size:10px;color:var(--meow-sub);margin-bottom:2px;">位置：</div>
          <div style="font-size:12px;font-weight:600;">${posVal}</div>
        </div>
        <div style="min-width:60px;">
          <div style="font-size:10px;color:var(--meow-sub);margin-bottom:2px;">深度：</div>
          <div style="font-size:12px;font-weight:600;">${entry.depth ?? 4}</div>
        </div>
        <div style="min-width:60px;">
          <div style="font-size:10px;color:var(--meow-sub);margin-bottom:2px;">顺序：</div>
          <div style="font-size:12px;font-weight:600;">${entry.order ?? 100}</div>
        </div>
        <div style="min-width:60px;">
          <div style="font-size:10px;color:var(--meow-sub);margin-bottom:2px;">触发%：</div>
          <div style="font-size:12px;font-weight:600;">${entry.probability ?? 100}</div>
        </div>
      </div>
      <div style="margin-top:6px;">
        <div style="font-size:10px;color:var(--meow-sub);margin-bottom:2px;">主要关键字：</div>
        <div style="font-size:12px;">${(entry.keys||[]).join(', ') || '（无）'}</div>
      </div>
      <div style="margin-top:4px;">
        <div style="font-size:10px;color:var(--meow-sub);margin-bottom:2px;">可选过滤器：</div>
        <div style="font-size:12px;">${(entry.secondary_keys||[]).join(', ') || '（空）'}</div>
      </div>
    `;
  } catch(e) {
    el.innerHTML = `<div style="color:var(--meow-sub);">加载失败: ${e?.message||e}</div>`;
  }
}
// ===== 注入预览（看 tgBuildInjectionText 是否真的把条目拼进提示词）=====
window.meowPreviewTableInjectionText = function(){
  try{
    if (typeof tgBuildInjectionText !== 'function'){
      toast?.('tgBuildInjectionText 不存在（没有表格注入拼接函数）');
      return '';
    }
    const txt = String(tgBuildInjectionText() || '');
    void(0)&&console.log('[MEOW][InjectionText]', txt);
    toast?.(`注入预览：长度=${txt.length}`);
    return txt;
  }catch(e){
    console.warn('[MEOW][InjectionText] failed', e);
    toast?.('注入预览失败：看控制台');
    return '';
  }

};
  // ---------- 事件绑定 ----------
  const db0 = loadDB();
  $q.value = db0.q || '';
  $q.addEventListener('input', ()=>{
    const db = loadDB();
    db.q = $q.value;
    saveDB(db);
    renderAll();
  }, {passive:true});

// ===== 全局外观系统（影响所有模块）=====
const LS_THEME = 'meow_wb_theme_v1';
const WEIGHT_NAMES = {100:'极细',200:'细',300:'偏细',400:'正常',500:'中等',600:'半粗',700:'粗',800:'特粗',900:'极粗'};
const BRIGHT_NAMES = (v)=> v < -30 ? '深色' : v < -10 ? '偏暗' : v > 30 ? '明亮' : v > 10 ? '偏亮' : '中性';
const COLOR_PRESETS = ['#c6baa4','#a8b8c8','#c4a8b8','#a8c4a8','#c8c0a0','#b0a8c4','#c0b0a0','#889098','#d4c4b4','#a0b0b8'];

// ✅ 新增：panelTint / panelAlpha（“面板色调/面板不透明度”真正影响所有弹窗）
function loadTheme(){
  const def = {
    color:'#c6baa4',      // 主色调（强调色）
    alpha:72,             // 卡片透明度
    font:13,
    radius:16,
    family:'',
    weight:400,
    bright:0,             // 整体明暗
    textTint:'#2e261e',   // ✅新增：字体色调（hex）
    textBright:0,         // 字体颜色明度（-50~50）
    panelTint:'#ffffff',  // 面板色调（背景色调）
    panelAlpha:96,        // 面板不透明度
    hdBright:0,           // 顶栏明度
    innerBright:0,        // 内容区明度（影响所有弹窗背景）
  };
  const t = _lsGet(LS_THEME, def) || def;
  // 兼容旧存档
  if (!t.panelTint) t.panelTint = def.panelTint;
  if (typeof t.panelAlpha !== 'number') t.panelAlpha = def.panelAlpha;
  if (typeof t.textTint !== 'string' || !t.textTint) t.textTint = def.textTint;
  if (typeof t.textBright !== 'number') t.textBright = def.textBright;
  return t;
}

function _clamp255(n){ n = Math.round(Number(n)||0); return Math.max(0, Math.min(255, n)); }
function _clamp01(x){ x = Number(x)||0; return Math.max(0, Math.min(1, x)); }
function _hexToRgb(hex, fallback){
  const h = String(hex||'').replace('#','').trim();
  if (h.length !== 6) return fallback || {r:255,g:255,b:255};
  return { r: parseInt(h.slice(0,2),16)||0, g: parseInt(h.slice(2,4),16)||0, b: parseInt(h.slice(4,6),16)||0 };
}
// bright：-50~50；<0 向黑混合，>0 向白混合
function _applyBright(rgb, bright){
  const k = (Number(bright)||0) / 50; // -1~1
  let r = rgb.r, g = rgb.g, b = rgb.b;
  if (k >= 0){
    r = r + (255 - r) * k;
    g = g + (255 - g) * k;
    b = b + (255 - b) * k;
  } else {
    const kk = 1 + k; // 0~1
    r = r * kk; g = g * kk; b = b * kk;
  }
  return { r:_clamp255(r), g:_clamp255(g), b:_clamp255(b) };
}

// mix：k=1 更偏向 a；k=0 更偏向 b
function _mixRgb(a, b, k){
  k = _clamp01(k);
  return {
    r: _clamp255(a.r * k + b.r * (1-k)),
    g: _clamp255(a.g * k + b.g * (1-k)),
    b: _clamp255(a.b * k + b.b * (1-k)),
  };
}
function _lum(rgb){
  return (0.2126*rgb.r + 0.7152*rgb.g + 0.0722*rgb.b);
}

// ===== 核心：applyTheme 写入全局 CSS 变量（影响所有 .meowModal / #meow-pencil-menu 等）=====
function applyTheme(t){
  // ---------- 1) 强调色（主色调） ----------
  const c = t.color || '#c6baa4';
  const hex = c.replace('#','');
  const cr = parseInt(hex.slice(0,2),16)||198;
  const cg = parseInt(hex.slice(2,4),16)||186;
  const cb = parseInt(hex.slice(4,6),16)||164;

  // ---------- 2) 面板色调（背景）+ 明暗 ----------
  const bright = t.bright || 0;

  const tint0 = _hexToRgb(t.panelTint || '#ffffff', {r:255,g:255,b:255});
  const tint  = _applyBright(tint0, bright);
  const pr = tint.r, pg = tint.g, pb = tint.b;

  // 面板不透明度：真正控制所有弹窗/菜单背景透明度
  const panelA = _clamp01((Number(t.panelAlpha ?? 96)) / 100);
  // 卡片透明度：在面板基础上再叠一层（让“卡片”和“面板”能分开调）
  const cardA  = _clamp01((Number(t.alpha ?? 72)) / 100);
  const aMenu  = _clamp01(panelA * 0.78);
  const aModal = panelA;
  const aCard  = _clamp01(panelA * cardA);

    // ---------- 3) 文本色：根据面板色调自动切换深/浅 ----------
  const lum = (0.2126*pr + 0.7152*pg + 0.0722*pb); // 0~255
  const isDark = lum < 120;

  // 明亮模式沿用你原来的“明暗滑杆 → 字色变化”逻辑；暗色模式改成浅字，避免看不见
  const textD = Math.max(0, Math.min(255, 46 - Math.round(bright * 0.6)));
  const subD  = Math.max(0, Math.min(255, 46 - Math.round(bright * 0.4)));

  // ✅文本色：支持“字体色调 + 字体明度”，并保证暗背景可读
  const tBright = Number(t.textBright ?? 0); // -50~50

  const baseTextRgb = isDark
    ? {r:246,g:242,b:236}
    : {r:textD, g:Math.max(0,textD-8), b:Math.max(0,textD-16)};
  const baseSubRgb = isDark
    ? {r:246,g:242,b:236}
    : {r:subD, g:Math.max(0,subD-8), b:Math.max(0,subD-16)};

  // 字体色调（可选：不合法就忽略）
  const tintHex = String(t.textTint || '').trim();
  const tintRgb = (tintHex.replace('#','').length === 6) ? _hexToRgb(tintHex, baseTextRgb) : null;

  let textBase = baseTextRgb;
  let subBase  = baseSubRgb;

  if (tintRgb){
    // 70% 走色调，30% 保留自动对比
    textBase = _mixRgb(tintRgb, baseTextRgb, 0.70);
    subBase  = _mixRgb(tintRgb, baseSubRgb, 0.55);
  }

  // 暗底强制“抬亮一点”，避免用户选了深色导致看不见
  if (isDark){
    if (_lum(textBase) < 170) textBase = _applyBright(textBase, 25);
    if (_lum(subBase)  < 160) subBase  = _applyBright(subBase, 20);
  }

  const tx = _applyBright(textBase, tBright);
  const sx = _applyBright(subBase,  tBright);

  const TEXT  = `rgba(${tx.r},${tx.g},${tx.b},${isDark ? 0.88 : 0.82})`;
  const SUB   = `rgba(${sx.r},${sx.g},${sx.b},.62)`;
  const LINE  = isDark ? `rgba(255,255,255,.14)` : `rgba(${textD},${textD},${textD},.12)`;
  const LINE2 = isDark ? `rgba(255,255,255,.08)` : `rgba(${textD},${textD},${textD},.08)`;
  const INP_L = isDark ? `rgba(255,255,255,.18)` : `rgba(${textD},${textD},${textD},.14)`;

  // 输入框背景：暗色模式给一点“暗玻璃”，亮色模式沿用面板色
  const INP_BG = isDark
    ? `rgba(0,0,0,${_clamp01(0.26 + (1-panelA)*0.10)})`
    : `rgba(${pr},${pg},${pb},${_clamp01(aModal * 0.82)})`;

  // ---------- 4) 写到 :root（全局生效） ----------
  const hdBr = Number(t.hdBright || 0);
  const inBr = Number(t.innerBright || 0);
  const hdTint = _applyBright({r:pr,g:pg,b:pb}, hdBr);
  const inTint = _applyBright({r:pr,g:pg,b:pb}, inBr);
  const HD_BG = `rgba(${hdTint.r},${hdTint.g},${hdTint.b},${_clamp01(aModal * 0.90)})`;
  const IN_BG = `rgba(${inTint.r},${inTint.g},${inTint.b},${_clamp01(aModal * 0.35)})`;

  const rootEl = (_doc || document).documentElement;
  rootEl.style.setProperty('--meow-bg',          `rgba(${pr},${pg},${pb},${aMenu})`);
  rootEl.style.setProperty('--meow-bg-strong',   `rgba(${pr},${pg},${pb},${aModal})`);
  rootEl.style.setProperty('--meow-card',        `rgba(${pr},${pg},${pb},${aCard})`);
  rootEl.style.setProperty('--meow-hd-bg',       HD_BG);
  rootEl.style.setProperty('--meow-inner-bg',    IN_BG);

  rootEl.style.setProperty('--meow-text',        TEXT);
  rootEl.style.setProperty('--meow-sub',         SUB);

  rootEl.style.setProperty('--meow-accent',      `rgba(${cr},${cg},${cb},.85)`);
  rootEl.style.setProperty('--meow-accent-soft', `rgba(${cr},${cg},${cb},.35)`);

  rootEl.style.setProperty('--meow-input',       INP_BG);
  rootEl.style.setProperty('--meow-line',        LINE);
  rootEl.style.setProperty('--meow-line-2',      LINE2);
  rootEl.style.setProperty('--meow-input-line',  INP_L);

  // ✅ 让“外观自定义”小面板也跟随同一套（避免它自己一个颜色）
  try{
    const p = _doc.getElementById('wbv4_theme_panel');
    if (p) p.style.background = `rgba(${pr},${pg},${pb},${aModal})`;
  }catch(e){}

  // ---------- 5) 全局字体注入（你原逻辑，保留不动） ----------
  let gst = _doc.getElementById('meow_global_theme_inject');
  if (!gst){
    gst = _doc.createElement('style');
    gst.id = 'meow_global_theme_inject';
    (_doc.head || _doc.documentElement).appendChild(gst);
  }
  const ff = t.family ? `font-family:${t.family} !important;` : '';
  const fw = `font-weight:${t.weight||400} !important;`;
  const fs = `font-size:${t.font||13}px !important;`;
  gst.textContent = `
    /* ===== 全局字体 ===== */
    .meowModal, .meowModal .bd, .meowModal .sec,
    .meowModal textarea, .meowModal input, .meowModal select,
    .meowModal .hint, .meowModal label, .meowModal .btn,
    .meowModal p, .meowModal span, .meowModal div,
    .meowModal h2, .meowModal h3, .meowModal h4,
    #meow-pencil-menu .fanBtn .t,
    #wbv4_root, #wbv4_root *,
    #wbv4_theme_panel, #wbv4_theme_panel * {
      ${ff} ${fs} ${fw}
    }

    /* ===== 弹窗主体背景 ===== */
    .meowModal {
      background: rgba(${pr},${pg},${pb},${aModal}) !important;
      color: ${TEXT} !important;
    }
    .meowModal .bd {
      background: transparent !important;
      color: ${TEXT} !important;
    }

    /* ===== 区块/卡片背景 ===== */
    .meowModal .sec {
      background: rgba(${pr},${pg},${pb},${aCard}) !important;
      border-color: ${LINE} !important;
      color: ${TEXT} !important;
    }

    /* ===== 顶栏 + 区块标题栏（同一组明度） ===== */
    .meowModal .hd,
    .meowModal .sec h3,
    .meowModal details > summary,
    #wbv4_root .wbv4TitleRow {
      background: var(--meow-hd-bg, rgba(${hdTint.r},${hdTint.g},${hdTint.b},.90)) !important;
    }
    .meowModal .hd .title,
    .meowModal .hd span,
    .meowModal .hd .close,
    .meowModal .hd * {
      color: ${TEXT} !important;
    }

    /* ===== 全量文字颜色 ===== */
    .meowModal label,
    .meowModal .hint,
    .meowModal p,
    .meowModal span,
    .meowModal div,
    .meowModal h2, .meowModal h3, .meowModal h4,
    .meowModal .btn,
    .meowModal .sec > label,
    .meowModal .sec > div,
    .meowModal .sec > span,
    .meowModal summary,
    .meowModal legend,
    .meowModal dt, .meowModal dd,
    #wbv4_root, #wbv4_root *,
    #wbv4_theme_panel, #wbv4_theme_panel label,
    #wbv4_theme_panel div,
    #wbv4_theme_panel span {
      color: ${TEXT} !important;
    }
    .meowModal .hint,
    .meowModal .sub,
    #wbv4_root .wbv4Card .wbv4Kv .k,
    #wbv4_root .wbv4Card .wbv4CardSub {
      color: ${SUB} !important;
    }

    /* ===== 输入框统一 ===== */
    .meowModal input[type="text"],
    .meowModal input[type="number"],
    .meowModal input[type="search"],
    .meowModal textarea,
    .meowModal select,
    #wbv4_root .wbv4Search input {
      background: ${INP_BG} !important;
      color: ${TEXT} !important;
      border-color: ${INP_L} !important;
    }
    .meowModal input::placeholder,
    .meowModal textarea::placeholder {
      color: ${SUB} !important;
    }

    /* ===== 按钮 ===== */
    .meowModal .btn {
      background: rgba(${pr},${pg},${pb},${_clamp01(aCard*0.8)}) !important;
      border-color: ${LINE} !important;
      color: ${TEXT} !important;
    }
    .meowModal .btn:hover {
      background: rgba(${cr},${cg},${cb},.18) !important;
    }
    .meowModal .btn.primary {
      background: rgba(${cr},${cg},${cb},.22) !important;
      border-color: rgba(${cr},${cg},${cb},.55) !important;
      color: ${TEXT} !important;
    }
    .meowModal .btn.primary:hover {
      background: rgba(${cr},${cg},${cb},.40) !important;
    }

    /* ===== meow-tab-btn (后置/随聊 tab) ===== */
    .meowModal .meow-tab-btn {
      color: ${TEXT} !important;
      border-color: ${LINE} !important;
    }
    .meowModal .meow-tab-btn.meow-tab-active,
    .meowModal [data-tab].meow-tab-active {
      background: rgba(${cr},${cg},${cb},.75) !important;
      color: ${TEXT} !important;
    }

    /* ===== range slider ===== */
    input[type="range"] {
      cursor: pointer !important;
      touch-action: pan-x;
    }
    input[type="range"]::-webkit-slider-runnable-track {
      background: ${LINE} !important;
      border-radius: 4px;
      height: 4px;
    }
    input[type="range"]::-webkit-slider-thumb {
      cursor: pointer !important;
      background: rgba(${cr},${cg},${cb},.85) !important;
      border: 2px solid rgba(255,255,255,.5) !important;
      border-radius: 50%;
    }
    input[type="range"]::-moz-range-track {
      background: ${LINE} !important;
      border-radius: 4px;
      height: 4px;
    }
    input[type="range"]::-moz-range-thumb {
      cursor: pointer !important;
      background: rgba(${cr},${cg},${cb},.85) !important;
      border: 2px solid rgba(255,255,255,.5) !important;
      border-radius: 50%;
    }

    /* ===== toggle switch ===== */
    .meowModal input[type="checkbox"] {
      accent-color: rgba(${cr},${cg},${cb},.85) !important;
    }

    /* ===== 分割线/边框 ===== */
    .meowModal hr {
      border-color: ${LINE} !important;
    }
    .meowModal .sec,
    .meowModal .card,
    .meowModal details {
      border-color: ${LINE} !important;
    }

    /* ===== WBV4 专用 ===== */
    #wbv4_root .wbv4Card { border-radius:${t.radius||16}px !important; }
    #wbv4_root .wbv4Tab { border-radius:${t.radius||16}px !important; }
    #wbv4_root .wbv4Tab.on {
      background: rgba(${cr},${cg},${cb},.78) !important;
      border-color: rgba(${cr},${cg},${cb},.95) !important;
    }

    /* ===== 内容区明度 ===== */
    #wbv4_root .wbv4Body,
    #wbv4_root .wbv4Search,
    #wbv4_root .wbv4Mini {
      background: var(--meow-inner-bg, rgba(${inTint.r},${inTint.g},${inTint.b},.35)) !important;
      border-radius: 10px;
    }

    /* ===== 外观面板本身跟随主题 ===== */
    #wbv4_theme_panel {
      background: rgba(${pr},${pg},${pb},${aModal}) !important;
      border-color: ${LINE} !important;
    }
    #wbv4_theme_panel input[type="color"] {
      border: 1px solid ${LINE} !important;
    }
    #wbv4_theme_panel select {
      background: ${INP_BG} !important;
      color: ${TEXT} !important;
      border-color: ${INP_L} !important;
    }

    /* ===== 滚动条跟随主题 ===== */
    .meowModal::-webkit-scrollbar,
    .meowModal .bd::-webkit-scrollbar {
      width: 4px;
      background: transparent;
    }
    .meowModal::-webkit-scrollbar-thumb,
    .meowModal .bd::-webkit-scrollbar-thumb {
      background: rgba(${cr},${cg},${cb},.25);
      border-radius: 4px;
    }

    /* ===== 子弹窗卡片行（基础设置等） ===== */
    .wbv4BaseRow {
      background: var(--meow-card, rgba(255,255,255,.72)) !important;
      border-color: var(--meow-line, rgba(0,0,0,.04)) !important;
    }
    .wbv4BaseRow div[style*="font-weight:900"] {
      color: var(--meow-text) !important;
    }
    .wbv4BaseRow div[style*="font-size:11px"] {
      color: var(--meow-sub) !important;
    }

    /* 开关跟随主题色 */
    .wbv4BaseToggle:checked ~ .wbv4ToggleTrack {
      background: rgba(${cr},${cg},${cb},.72) !important;
    }
    .wbv4BaseToggle:not(:checked) ~ .wbv4ToggleTrack {
      background: rgba(${pr},${pg},${pb},.22) !important;
    }
    .wbv4ToggleThumb {
      background: var(--meow-card, #fff) !important;
    }
    .wbv4BaseToggle:checked ~ .wbv4ToggleThumb {
      left: 25px !important;
    }
    .wbv4BaseToggle:not(:checked) ~ .wbv4ToggleThumb {
      left: 3px !important;
    }

    /* 子弹窗内 label/删除按钮/输入 */
    .wbv4BaseDelBtn {
      background: var(--meow-card) !important;
      color: var(--meow-sub) !important;
      border-color: var(--meow-line) !important;
    }

    /* 酒馆链接展开区 */
    .wbv4TavernLink {
      background: rgba(${pr},${pg},${pb},.08) !important;
    }
    .wbv4TvStatus {
      background: var(--meow-card) !important;
      color: var(--meow-sub) !important;
    }
    .wbv4TavernLink input[type="text"] {
      background: var(--meow-input) !important;
      color: var(--meow-text) !important;
      border-color: var(--meow-input-line) !important;
    }
    .wbv4TavernLink label {
      background: var(--meow-card) !important;
    }
    .wbv4TavernLink label span {
      color: var(--meow-text) !important;
    }

    /* 保存到酒馆按钮 */
    .wbv4TvSave {
      background: rgba(${cr},${cg},${cb},.18) !important;
      border-color: rgba(${cr},${cg},${cb},.45) !important;
      color: var(--meow-text) !important;
    }

    /* wbv4Btn 跟随主题 */
    .meowModal .wbv4Btn,
    .meowModal .wbv4Tools .wbv4Btn {
      background: var(--meow-card) !important;
      color: var(--meow-text) !important;
      border-color: var(--meow-line) !important;
    }
    .meowModal .wbv4Btn:hover {
      background: var(--meow-accent-soft) !important;
    }

    /* 编辑/框架/基础设置/美化 弹窗中所有文字 */
    #meow_wbv4_edit,
    #meow_wbv4_frame,
    #meow_wbv4_base,
    #meow_wbv4_beauty,
    #meow-tg-preview {
      color: var(--meow-text) !important;
    }
    #meow_wbv4_edit .bd,
    #meow_wbv4_frame .bd,
    #meow_wbv4_base .bd,
    #meow_wbv4_beauty .bd,
    #meow-tg-preview .bd {
      color: var(--meow-text) !important;
    }

    /* 框架规则字段行 */
    .meowModal .wbv4FRow {
      background: var(--meow-card) !important;
      border-color: var(--meow-line) !important;
    }
    .meowModal .wbv4FRow input,
    .meowModal .wbv4FRow textarea {
      background: var(--meow-input) !important;
      color: var(--meow-text) !important;
      border-color: var(--meow-input-line) !important;
    }
  `

  // 世界书内局部也刷新（如果 root 存在）
  if (typeof root !== 'undefined' && root){
    root.querySelectorAll('.wbv4Card').forEach(el=>{
      el.style.borderRadius = (t.radius||16)+'px';
    });
  }
}

const theme0 = loadTheme();
applyTheme(theme0);

// ---- 面板开关 ----
const themeBtn = _doc.querySelector('#wbv4_theme_btn');
const themePanel = _doc.querySelector('#wbv4_theme_panel');
if (themeBtn && themePanel){
  themeBtn.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    themePanel.style.display = themePanel.style.display === 'block' ? 'none' : 'block';
  }, {passive:false});
  _doc.addEventListener('click', (e)=>{
    if (themePanel.style.display==='block' && !themePanel.contains(e.target) && e.target!==themeBtn){
      themePanel.style.display='none';
    }
  }, {passive:true});
}

// ---- 色轮预设 ----
const presetWrap = _doc.querySelector('#wbv4_color_presets');
if (presetWrap){
  presetWrap.innerHTML = COLOR_PRESETS.map(c=>`<button data-pc="${c}" style="width:24px;height:24px;border-radius:50%;border:2px solid rgba(0,0,0,.08);background:${c};cursor:pointer;flex:0 0 auto;"></button>`).join('');
  presetWrap.querySelectorAll('[data-pc]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const t=loadTheme(); t.color=btn.dataset.pc; _lsSet(LS_THEME,t); applyTheme(t);
      const ci=_doc.querySelector('#wbv4_theme_color'); if(ci) ci.value=t.color;
    }, {passive:false});
  });
}

// ---- 字体色调预设（新增） ----
const textPresetWrap = _doc.querySelector('#wbv4_text_presets');
if (textPresetWrap){
  textPresetWrap.innerHTML = COLOR_PRESETS.map(c=>`<button data-tc="${c}" style="width:24px;height:24px;border-radius:50%;border:2px solid rgba(0,0,0,.08);background:${c};cursor:pointer;flex:0 0 auto;"></button>`).join('');
  textPresetWrap.querySelectorAll('[data-tc]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const t=loadTheme(); t.textTint=btn.dataset.tc; _lsSet(LS_THEME,t); applyTheme(t);
      const ci=_doc.querySelector('#wbv4_text_tint'); if(ci) ci.value=t.textTint;
    }, {passive:false});
  });
}

// ---- 明暗 ----
const brightSlider = _doc.querySelector('#wbv4_theme_bright');
const brightVal = _doc.querySelector('#wbv4_bright_val');
if (brightSlider){
  brightSlider.value = theme0.bright||0;
  if(brightVal) brightVal.textContent = BRIGHT_NAMES(theme0.bright||0);
  brightSlider.addEventListener('input', ()=>{
    const t=loadTheme(); t.bright=parseInt(brightSlider.value,10);
    if(brightVal) brightVal.textContent=BRIGHT_NAMES(t.bright);
    _lsSet(LS_THEME,t); applyTheme(t);
  });
}

// ---- 主色调（强调色）----
const accentInput = _doc.querySelector('#wbv4_theme_color');
if (accentInput){
  accentInput.value = theme0.color || '#c6baa4';
  accentInput.addEventListener('input', (e)=>{
    const t=loadTheme(); t.color=e.target.value; _lsSet(LS_THEME,t); applyTheme(t);
  }, {passive:true});
}

// ---- 字体色调（新增）----
const textTintInput = _doc.querySelector('#wbv4_text_tint');
if (textTintInput){
  textTintInput.value = theme0.textTint || '#2e261e';
  const onTextTint = (e)=>{
    const t=loadTheme(); t.textTint = e.target.value;
    _lsSet(LS_THEME,t); applyTheme(t);
  };
  textTintInput.addEventListener('input', onTextTint, {passive:true});
  textTintInput.addEventListener('change', onTextTint, {passive:true});
}

// ✅ 新增：面板色调（全局） + 面板不透明度（全局）
const panelTintInput = _doc.querySelector('#wbv4_panel_tint');
if (panelTintInput){
  panelTintInput.value = theme0.panelTint || '#ffffff';
  panelTintInput.addEventListener('input', (e)=>{
    const t=loadTheme(); t.panelTint=e.target.value; _lsSet(LS_THEME,t); applyTheme(t);
  }, {passive:true});
  panelTintInput.addEventListener('change', (e)=>{
    const t=loadTheme(); t.panelTint=e.target.value; _lsSet(LS_THEME,t); applyTheme(t);
  }, {passive:true});
}
const panelAlphaSlider = _doc.querySelector('#wbv4_panel_alpha');
const panelAlphaVal = _doc.querySelector('#wbv4_panel_alpha_val');
if (panelAlphaSlider){
  panelAlphaSlider.value = (theme0.panelAlpha ?? 96);
  if(panelAlphaVal) panelAlphaVal.textContent = String(panelAlphaSlider.value);
  panelAlphaSlider.addEventListener('input', ()=>{
    const t=loadTheme(); t.panelAlpha=parseInt(panelAlphaSlider.value,10);
    if(panelAlphaVal) panelAlphaVal.textContent = String(t.panelAlpha);
    _lsSet(LS_THEME,t); applyTheme(t);
  }, {passive:true});
  panelAlphaSlider.addEventListener('change', ()=>{
    const t=loadTheme(); t.panelAlpha=parseInt(panelAlphaSlider.value,10);
    if(panelAlphaVal) panelAlphaVal.textContent = String(t.panelAlpha);
    _lsSet(LS_THEME,t); applyTheme(t);
  }, {passive:true});
}

// ---- 卡片透明度 ----
const alphaSlider = _doc.querySelector('#wbv4_theme_alpha');
const alphaVal = _doc.querySelector('#wbv4_alpha_val');
if(alphaSlider){
  alphaSlider.value = (theme0.alpha ?? 72);
  if(alphaVal) alphaVal.textContent = String(alphaSlider.value);

  // ✅修复：再次打开弹窗时，视觉效果回跳但数值不变
  // 原因：WBV4 小面板先 apply() 再回填 slider 值；这里强制触发一次 input 同步样式
  try{ alphaSlider.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){}

  alphaSlider.addEventListener('input',()=>{
    const t=loadTheme(); t.alpha=parseInt(alphaSlider.value,10);
    if(alphaVal) alphaVal.textContent=String(t.alpha);
    _lsSet(LS_THEME,t); applyTheme(t);
  }, {passive:true});
}

// ---- 字体颜色明度（新增） ----
const textBrightSlider = _doc.querySelector('#wbv4_text_bright');

// ---- 顶栏明度（新增） ----
const hdBrightSlider = _doc.querySelector('#wbv4_hd_bright');
const hdBrightVal = _doc.querySelector('#wbv4_hd_bright_val');
if(hdBrightSlider){
  const v0 = (typeof theme0.hdBright === 'number') ? theme0.hdBright : 0;
  hdBrightSlider.value = String(v0);
  if(hdBrightVal) hdBrightVal.textContent = BRIGHT_NAMES(v0);
  hdBrightSlider.addEventListener('input',()=>{
    const v = parseInt(hdBrightSlider.value,10) || 0;
    if(hdBrightVal) hdBrightVal.textContent = BRIGHT_NAMES(v);
    const t=loadTheme(); t.hdBright = v;
    _lsSet(LS_THEME,t); applyTheme(t);
  }, {passive:true});
}

// ---- 内容区明度（新增） ----
const innerBrightSlider = _doc.querySelector('#wbv4_inner_bright');
const innerBrightVal = _doc.querySelector('#wbv4_inner_bright_val');
if(innerBrightSlider){
  const v0 = (typeof theme0.innerBright === 'number') ? theme0.innerBright : 0;
  innerBrightSlider.value = String(v0);
  if(innerBrightVal) innerBrightVal.textContent = BRIGHT_NAMES(v0);
  innerBrightSlider.addEventListener('input',()=>{
    const v = parseInt(innerBrightSlider.value,10) || 0;
    if(innerBrightVal) innerBrightVal.textContent = BRIGHT_NAMES(v);
    const t=loadTheme(); t.innerBright = v;
    _lsSet(LS_THEME,t); applyTheme(t);
  }, {passive:true});
}

// 字体颜色明度（原有）
const textBrightVal = _doc.querySelector('#wbv4_text_bright_val');
if(textBrightSlider){
  const v0 = (typeof theme0.textBright === 'number') ? theme0.textBright : 0;
  textBrightSlider.value = String(v0);
  if(textBrightVal) textBrightVal.textContent = BRIGHT_NAMES(v0);

  textBrightSlider.addEventListener('input',()=>{
    const v = parseInt(textBrightSlider.value,10) || 0;
    const t=loadTheme(); t.textBright = v;
    if(textBrightVal) textBrightVal.textContent = BRIGHT_NAMES(v);
    _lsSet(LS_THEME,t); applyTheme(t);
  }, {passive:true});
}

// ---- 字号 ----
const fontSlider = _doc.querySelector('#wbv4_theme_font');
const fontVal = _doc.querySelector('#wbv4_font_val');
if(fontSlider){
  fontSlider.value=theme0.font||13; if(fontVal) fontVal.textContent=fontSlider.value;
  fontSlider.addEventListener('input',()=>{
    const t=loadTheme(); t.font=parseInt(fontSlider.value,10);
    if(fontVal) fontVal.textContent=t.font; _lsSet(LS_THEME,t); applyTheme(t);
  });
}

// ---- 字体 ----
const familySel = _doc.querySelector('#wbv4_theme_family');
if(familySel){
  familySel.value=theme0.family||'';
  familySel.addEventListener('change',()=>{
    const t=loadTheme(); t.family=familySel.value; _lsSet(LS_THEME,t); applyTheme(t);
  });
}

// ---- 字重 ----
const weightSlider = _doc.querySelector('#wbv4_theme_weight');
const weightVal = _doc.querySelector('#wbv4_weight_val');
if(weightSlider){
  weightSlider.value=theme0.weight||400; if(weightVal) weightVal.textContent=WEIGHT_NAMES[theme0.weight||400]||'正常';
  weightSlider.addEventListener('input',()=>{
    const t=loadTheme(); t.weight=parseInt(weightSlider.value,10);
    if(weightVal) weightVal.textContent=WEIGHT_NAMES[t.weight]||t.weight;
    _lsSet(LS_THEME,t); applyTheme(t);
  });
}

// ---- 圆角 ----
const radiusSlider = _doc.querySelector('#wbv4_theme_radius');
const radiusVal = _doc.querySelector('#wbv4_radius_val');
if(radiusSlider){
  radiusSlider.value=theme0.radius||16; if(radiusVal) radiusVal.textContent=radiusSlider.value;
  radiusSlider.addEventListener('input',()=>{
    const t=loadTheme(); t.radius=parseInt(radiusSlider.value,10);
    if(radiusVal) radiusVal.textContent=t.radius; _lsSet(LS_THEME,t); applyTheme(t);
  });
}

// ---- 重置 ----
_doc.querySelector('#wbv4_theme_reset')?.addEventListener('click',()=>{
  const def={
    color:'#c6baa4',
    alpha:72,
    font:13,
    radius:16,
    family:'',
    weight:400,
    bright:0,
    textTint:'#2e261e',
    textBright:0,          // 字体颜色明度
    panelTint:'#ffffff',
    panelAlpha:96,
    hdBright:0,
    innerBright:0,
  };
  _lsSet(LS_THEME,def);

  if (accentInput) accentInput.value = def.color;

  if(brightSlider){brightSlider.value=0; if(brightVal) brightVal.textContent='中性';}
  if (textTintInput) textTintInput.value = def.textTint;
  if(textBrightSlider){textBrightSlider.value=0; if(textBrightVal) textBrightVal.textContent='中性';}
  if(hdBrightSlider){hdBrightSlider.value=0; if(hdBrightVal) hdBrightVal.textContent='中性';}
  if(innerBrightSlider){innerBrightSlider.value=0; if(innerBrightVal) innerBrightVal.textContent='中性';}

  if (panelTintInput) panelTintInput.value = def.panelTint;
  if (panelAlphaSlider){
    panelAlphaSlider.value = def.panelAlpha;
    if(panelAlphaVal) panelAlphaVal.textContent = String(def.panelAlpha);
  }

  if(alphaSlider){
    alphaSlider.value=def.alpha;
    if(alphaVal) alphaVal.textContent=String(def.alpha);
    // 同步 WBV4 卡片背景（修复回跳）
    try{ alphaSlider.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){}
  }
  if(fontSlider){fontSlider.value=def.font; if(fontVal) fontVal.textContent=def.font;}
  if(familySel) familySel.value='';
  if(weightSlider){weightSlider.value=400; if(weightVal) weightVal.textContent='正常';}
  if(radiusSlider){radiusSlider.value=def.radius; if(radiusVal) radiusVal.textContent=def.radius;}

  applyTheme(def);
  _toast('已重置默认外观');
});

// ---- 视图切换 ----
const viewSel = _doc.querySelector('#wbv4_view_mode');
if(viewSel){
  viewSel.addEventListener('change',()=>{
    __wbViewMode = viewSel.value||'table';
    renderAll();
  },{passive:false});
}

// renderAll 自动应用主题
const _origRenderAll = renderAll;
renderAll = function(){
  _origRenderAll();
  try{ applyTheme(loadTheme()); }catch(e){}
};
  bd.querySelector('#wbv4_base')?.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openBaseSetting(); }, {passive:false});
  bd.querySelector('#wbv4_rule')?.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); try{ openChatFloatingPanel(); }catch(err){ toast('预览浮窗功能即将上线'); } }, {passive:false});
  bd.querySelector('#wbv4_beauty')?.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openBeauty(); }, {passive:false});

  // 初次渲染
  renderAll();

  // 对外：给“总结模块”回写后刷新用
  _W.MEOW_WB_REFRESH = ()=>{ try{ renderAll(); }catch(e){} };
  // 监听数据写入事件，实时刷新
  function onWbUpdated(){ try{ renderAll(); }catch(e){} }
  window.addEventListener('meow_wb_updated', onWbUpdated);
  try{ window.top?.addEventListener('meow_wb_updated', onWbUpdated); }catch(e){}

  // 对外：给浮窗预览读取世界书表格数据
  _W.__meowWBGetTabData = function(tabId){
    try{
      const db2 = loadDB();
      if(!db2 || !db2.cards) return null;
      const cards = db2.cards.filter(c => String(c.tab)===String(tabId));
      if(!cards.length) return null;
      const tabInfo = (db2.tabs||[]).find(t=>t.id===tabId);
      var allHeaders = null, allRows = [];
      for(const c of cards){
        const src = String(c.text||'').trim();
        if(!src) continue;
        const lines = src.split('\n').map(l=>l.trim()).filter(Boolean);
        for(let i=0;i<lines.length-1;i++){
          const a=lines[i], b=lines[i+1];
          if(!a.includes('|')||!b.includes('|')) continue;
          if(!/-{2,}/.test(b.replace(/\s/g,''))) continue;
          const headers = a.replace(/^\|/,'').replace(/\|$/,'').split('|').map(s=>s.trim()).filter(Boolean);
          if(!headers.length) continue;
          if(!allHeaders) allHeaders = headers;
          for(let j=i+2;j<lines.length;j++){
            if(!lines[j].includes('|')) break;
            allRows.push(lines[j].replace(/^\|/,'').replace(/\|$/,'').split('|').map(s=>s.trim()));
          }
          break;
        }
      }
      if(!allHeaders || !allRows.length) return null;
      return { cols:allHeaders, rows:allRows, name:(tabInfo?tabInfo.name:tabId) };
    }catch(e){ return null; }
  };

  // 对外：浮窗切tab时同步世界书
  _W.__meowWBSwitchTab = function(tabId){
    try{
      const db2 = loadDB();
      if(db2 && db2.tabs && db2.tabs.some(t=>t.id===tabId)){
        db2.active = tabId;
        saveDB(db2);
        renderAll();
      }
    }catch(e){}
  };
}
// ===================== 世界书模块（可视化表格 WB_V4_FINAL · REWRITE）结束 =====================


// ===================== 日记金句（选中一句一键收藏） =====================
  function getSelectionText(){
    try {
      const sel = W.getSelection?.() || window.getSelection?.();
      const s = sel ? String(sel.toString() || '') : '';
      return s.trim();
    } catch(e){ return ''; }
  }

  function openDiaryModal(){
    const bd = modalShell(ID_DIARY, '日记金句', '🗃️');
    const diary = lsGet(LS_DIARY, { quotes: [] });
    const picked = getSelectionText();

    const list = (diary.quotes || []).slice(0, 80).map((it, idx) => {
      const d = new Date(it.t || Date.now());
      const ts = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      const txt = (it.text || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `
        <div class="sec" style="margin-bottom:10px;">
          <div class="hint" style="margin-bottom:8px;">#${idx+1} ｜ ${ts}</div>
          <div style="white-space:pre-wrap; color: var(--meow-text); font-size:14px; line-height:1.6;">${txt}</div>
          <div class="row" style="margin-top:10px;">
            <button class="btn" data-copy="${idx}">复制</button>
            <button class="btn danger" data-del="${idx}">删除</button>
          </div>
        </div>
      `;
    }).join('');

    bd.innerHTML = `
      <div class="sec">
        <h3>✨ 收藏一句</h3>
        <div class="hint">你可以先用系统自带选中复制选一段，再打开这里一键收藏。</div>
        <label>当前选中</label>
        <textarea id="diary_in" placeholder="先选中文字，再打开这里会自动带入。">${picked || ''}</textarea>
        <div class="row" style="margin-top:10px;">
          <button class="btn primary" id="diary_save">一键收藏</button>
          <button class="btn danger" id="diary_clear">清空全部</button>
        </div>
      </div>
      <div class="sec">
        <h3>📌 已收藏</h3>
        ${list || `<div class="hint">还没有收藏。</div>`}
      </div>
    `;

    bd.querySelector('#diary_save').onclick = () => {
      const t = (bd.querySelector('#diary_in').value || '').trim();
      if (!t) { toast('先选一句再来'); return; }
      const d = lsGet(LS_DIARY, { quotes: [] });
      d.quotes.unshift({ t: Date.now(), text: t });
      d.quotes = d.quotes.slice(0, 300);
      lsSet(LS_DIARY, d);
      toast('已收藏');
      openDiaryModal();
    };

    bd.querySelector('#diary_clear').onclick = () => {
      lsSet(LS_DIARY, { quotes: [] });
      toast('已清空');
      openDiaryModal();
    };

    bd.querySelectorAll('[data-copy]').forEach(btn => {
      btn.onclick = async () => {
        const i = parseInt(btn.getAttribute('data-copy'), 10);
        const d = lsGet(LS_DIARY, { quotes: [] });
        const t = d.quotes?.[i]?.text || '';
        try { await navigator.clipboard.writeText(t); toast('已复制'); } catch(e){ toast('复制失败'); }
      };
    });

    bd.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.getAttribute('data-del'), 10);
        const d = lsGet(LS_DIARY, { quotes: [] });
        d.quotes.splice(i,1);
        lsSet(LS_DIARY, d);
        toast('已删除');
        openDiaryModal();
      };
    });
  }

  // ===================== 交互：长按定位 / 单击菜单 / 定位后单击编辑 =====================
  let pickedMes = null;
  let pickedRatio = 0.5;
  let pickedSnippet = '';
  let pickMode = false;

  function setArmed(on){
    try {
      const b = doc.getElementById(ID_BTN);
      if (!b) return;
      if (on) b.classList.add('armed');
      else b.classList.remove('armed');
    } catch(e){}
  }

  function enterPickMode(){
    if (pickMode) return;
    pickMode = true;
    pickedMes = null;
    pickedSnippet = '';
    pickedRatio = 0.5;
    setArmed(false);
    toast('点一下想编辑的那条消息（尽量点在目标句子附近）');

    const handler = (ev) => {
      try {
        const p = ev.touches ? ev.touches[0] : ev;

        const hit = mesFromPoint(p.clientX, p.clientY);
        if (!hit || !hit.mes) {
          toast('没点到消息，再点一次');
          return;
        }

        const mes = hit.mes;
        const r = mes.getBoundingClientRect();
        let ratio = (p.clientY - r.top) / Math.max(1, r.height);
        ratio = Math.max(0.05, Math.min(0.95, ratio));

        // 抓一个“附近片段”当锚点（越准越不飘）
        const showText = (mes.querySelector('.mes_text')?.innerText || mes.innerText || '').trim();
        if (showText) {
          const pick = Math.floor(showText.length * ratio);
          pickedSnippet = showText.slice(Math.max(0, pick - 20), Math.min(showText.length, pick + 20));
        } else {
          pickedSnippet = '';
        }

        pickedMes = mes;
        pickedRatio = ratio;
        pickMode = false;

        setArmed(true);
        toast('已锁定：再点✏️进入精准编辑');

        // 收尾：移除监听（捕获阶段）
        doc.removeEventListener('touchstart', handler, true);
        doc.removeEventListener('mousedown', handler, true);

        ev.preventDefault();
        ev.stopPropagation();
      } catch(e){
        pickMode = false;
        doc.removeEventListener('touchstart', handler, true);
        doc.removeEventListener('mousedown', handler, true);
      }
    };

    // 捕获阶段：尽量顶掉折叠控件的吞点击
    doc.addEventListener('touchstart', handler, true);
    doc.addEventListener('mousedown', handler, true);
  }

  // ===================== 悬浮按钮：拖动/单击/长按 =====================
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

// ===================== ✅ 轮询已移除 =====================
// 聊天切换检测现在完全由 meowBindChatAutoLoad（MutationObserver + hashchange）驱动
// 不再有 setInterval 轮询，手机端不会卡死



  // ✅ 启动时先拉一次远端同步（不动 UI，只更新数据层）
  setTimeout(()=>{
    try{
      const p = window.MEOW_SYNC && window.MEOW_SYNC.bootPull ? window.MEOW_SYNC.bootPull({ force:true }) : null;
      if (p && typeof p.then === 'function'){
        p.then((res)=>{
          if (res && res.ok && res.changed){
            try{ window.MEOW_WB_REFRESH?.(); }catch(e){}
            try{
              const uid = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : '';
              if (typeof window.__MEOW_SUM_CHAT_SWITCH__ === 'function') window.__MEOW_SUM_CHAT_SWITCH__(uid);
            }catch(e){}
          }
        }).catch(()=>{});
      }
    }catch(e){}
  }, 80);
  // 初次挂载 + 兜底重试（有些页面加载慢）
  let ok = mount();
  if (!ok){
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (mount() || tries > 10) clearInterval(t);
    }, 500);
  }
})();
