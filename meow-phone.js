// ===================== 喵喵套件 · 小手机插件 (meow-phone.js) =====================
// 依赖：meow-core.js 必须先加载
// 加载方式：通过 loader 从 GitHub raw URL 顺序加载
(function meowPhonePlugin(){
  'use strict';

  // ===== 从 core 获取依赖 =====
  const MEOW = window.MEOW;
  if (!MEOW || !MEOW.core) {
    console.error('[MEOW Phone] meow-core.js 未加载，小手机无法启动');
    return;
  }

  const { W, doc, lsGet, lsSet, toast } = MEOW.core;
  const G = (typeof window !== 'undefined') ? window : W;

  // 外部函数引用（core 已暴露）
  const MEOW_WB_API = MEOW.core.MEOW_WB_API || {};
  const meowGetSTCtx = MEOW.core.meowGetSTCtx || function(){ return null; };
  // meowGetChatUID 需要实时调用 core 的版本（因为它在 core 中定义较晚）
  function meowGetChatUID(){
    try {
      if (typeof MEOW.core.meowGetChatUID === 'function') return MEOW.core.meowGetChatUID();
      return '';
    } catch(e){ return ''; }
  }


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
  if (!MEOW.phone){
    MEOW.phone = (function(){
      const ID = 'meow-phone-root';
      const STYLE_ID = 'meow-phone-style-v2';
      const STYLE_TUNE_ID = 'meow-phone-style-tune-v1';
      const LS_POS = 'meow_phone_pos_v2';
// 📦==================== Phone Data Keys（小手机数据键体系）====================
// 目标：
// 1) 与其他模块隔离（统一 meow_phone_* 前缀）
// 2) 支持“按聊天UID隔离”（同一角色卡不同分支不串）
// 3) 仍能被你的 MEOW_SYNC 自动同步（因为都是 meow_* 开头）
//
// 约定：
// - 全局数据（不随聊天切换）：meow_phone_g_*
// - 聊天隔离数据（随聊天切换）：meow_phone_c_<chatUID>_*
//
// 说明：这里只定义“键 + 读写工具”，不改变任何 UI/行为。
// ============================================================================

// ✅ 全局 key（与聊天无关）
const LS_PHONE_G_LAYOUT   = 'meow_phone_g_layout_v1';     // 桌面布局/分页/组件位置（以后用）
const LS_PHONE_G_THEME    = 'meow_phone_g_theme_v1';      // 主题（替代硬编码 meow_phone_theme）
const LS_PHONE_G_SETTINGS = 'meow_phone_g_settings_v1';   // 手机设置（开关、排序等）
const LS_PHONE_G_MEDIA    = 'meow_phone_g_media_v1';      // 相册/壁纸索引（以后用）

// ✅ 聊天隔离 key 的“后缀名”约定（真正落库时会拼 chatUID）
const PHONE_CHAT_KEYS = {
  threads:  'threads_v1',   // chats：会话列表（置顶/未读/最后消息预览）
  chatlog:  'chatlog_v1',   // chats：每个联系人消息（轻量）
  sms:      'sms_v1',       // sms：短信盒子
  forum:    'forum_v1',     // forum：帖子/评论
  weather:  'weather_v1',   // weather：缓存（如果你后面接真实天气）
  drafts:   'drafts_v1',    // 各 App 草稿
};

// ========== Widget Data Model (组件编辑器数据层) ==========
const LS_PHONE_WIDGETS = 'meow_phone_g_widgets_v1';
const LS_PHONE_AVATARS = 'meow_phone_g_avatars_v1'; // 自定义头像图片（base64）
const LS_PHONE_API_PRESETS = 'meow_phone_api_presets_v1'; // ✅ B: API 预设（预设/保护/拉模型/测试/导出）
const LS_PHONE_SUMMARY = 'meow_phone_chat_summary_v1'; // 聊天历史AI总结数据

const WIDGET_TYPES = {
  calendar:    { label:'日历',     icon:'<svg class="phIco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10z"/></svg>', desc:'自动推移日期' },
  anniversary: { label:'纪念日',   icon:'<svg class="phIco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>', desc:'倒计时/正计时' },
  todayItems:  { label:'今日事项', icon:'<svg class="phIco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>', desc:'联动日历事项' },
  music:       { label:'音乐',     icon:'<svg class="phIco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>', desc:'播放动效+真实音频' },
  messages:    { label:'消息',     icon:'<svg class="phIco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>', desc:'私聊/论坛/新闻' },
  custom:      { label:'自定义',   icon:'<svg class="phIco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V5H6a2 2 0 0 0-2 2v3.8h1.5A1.5 1.5 0 0 1 7 12.3a1.5 1.5 0 0 1-1.5 1.5H4V17a2 2 0 0 0 2 2h3.8v-1.5a1.5 1.5 0 0 1 1.5-1.5 1.5 1.5 0 0 1 1.5 1.5V19H17a2 2 0 0 0 2-2v-4h1.5a1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5z"/></svg>', desc:'自由拼装元素' },
};

// 每种类型3种预设排版
const WIDGET_PRESETS = {
  calendar: [
    { id:'cal_a', label:'经典', desc:'大日期+星期', build(W,H){ return [
      {id:_elid(),type:'text',content:'{{date}}',x:12,y:10,fontSize:28,color:'var(--ph-text)',bold:true},
      {id:_elid(),type:'text',content:'{{month}} {{weekday}}',x:12,y:44,fontSize:11,color:'var(--ph-text-sub)'},
    ]; }},
    { id:'cal_b', label:'紧凑', desc:'单行日期', build(W,H){ return [
      {id:_elid(),type:'emoji',content:'📅',x:8,y:Math.round(H/2-12),fontSize:20},
      {id:_elid(),type:'text',content:'{{month}}{{date}}日 {{weekday}}',x:36,y:Math.round(H/2-7),fontSize:13,color:'var(--ph-text)'},
    ]; }},
    { id:'cal_c', label:'大字', desc:'居中大号', build(W,H){ return [
      {id:_elid(),type:'text',content:'{{date}}',x:Math.round(W/2-20),y:Math.round(H/2-22),fontSize:36,color:'var(--ph-text)',bold:true},
      {id:_elid(),type:'text',content:'{{weekday}}',x:Math.round(W/2-14),y:Math.round(H/2+18),fontSize:11,color:'var(--ph-text-dim)'},
    ]; }},
  ],
  anniversary: [
    { id:'ann_a', label:'倒计时', desc:'数字居中', build(W,H){ return [
      {id:_elid(),type:'text',content:'💝 {{annivName}}',x:12,y:10,fontSize:12,color:'var(--ph-text-sub)'},
      {id:_elid(),type:'text',content:'{{countdown}}',x:12,y:30,fontSize:24,color:'var(--ph-text)',bold:true},
    ]; }},
    { id:'ann_b', label:'横排', desc:'名称+天数并排', build(W,H){ return [
      {id:_elid(),type:'text',content:'{{annivName}}',x:12,y:Math.round(H/2-8),fontSize:13,color:'var(--ph-text)'},
      {id:_elid(),type:'text',content:'{{countdown}}',x:Math.max(80,W-80),y:Math.round(H/2-10),fontSize:18,color:'var(--ph-text)',bold:true},
    ]; }},
    { id:'ann_c', label:'图文', desc:'emoji+倒计时', build(W,H){ return [
      {id:_elid(),type:'emoji',content:'💝',x:Math.round(W/2-12),y:8,fontSize:24},
      {id:_elid(),type:'text',content:'{{countdown}}',x:Math.round(W/2-24),y:40,fontSize:20,color:'var(--ph-text)',bold:true},
      {id:_elid(),type:'text',content:'{{annivName}}',x:Math.round(W/2-24),y:66,fontSize:11,color:'var(--ph-text-dim)'},
    ]; }},
  ],
  todayItems: [
    { id:'ti_a', label:'列表', desc:'标准列表', build(W,H){ return [
      {id:_elid(),type:'text',content:'📌 今日事项',x:10,y:8,fontSize:13,color:'var(--ph-text)',bold:true},
      {id:_elid(),type:'text',content:'{{items}}',x:10,y:30,fontSize:11,color:'var(--ph-text-sub)'},
    ]; }},
    { id:'ti_b', label:'紧凑', desc:'无标题', build(W,H){ return [
      {id:_elid(),type:'text',content:'{{items}}',x:8,y:8,fontSize:11,color:'var(--ph-text-sub)'},
    ]; }},
    { id:'ti_c', label:'卡片', desc:'带背景', build(W,H){ return [
      {id:_elid(),type:'line',x:0,y:0,w:W,h:H,color:'var(--ph-glass)'},
      {id:_elid(),type:'text',content:'📌 今日',x:10,y:8,fontSize:12,color:'var(--ph-text)',bold:true},
      {id:_elid(),type:'text',content:'{{items}}',x:10,y:28,fontSize:11,color:'var(--ph-text-sub)'},
    ]; }},
  ],
  music: [
    { id:'mu_a', label:'唱片', desc:'唱片机风格', build(W,H){ return [
      {id:_elid(),type:'text',content:'🎵 音乐',x:12,y:8,fontSize:13,color:'var(--ph-text)',bold:true},
      {id:_elid(),type:'text',content:'{{musicTitle}}',x:12,y:28,fontSize:11,color:'var(--ph-text-dim)'},
      {id:_elid(),type:'emoji',content:'💿',x:12,y:48,fontSize:28},
    ]; }},
    { id:'mu_b', label:'极简', desc:'文字为主', build(W,H){ return [
      {id:_elid(),type:'text',content:'♪',x:10,y:Math.round(H/2-12),fontSize:20,color:'var(--ph-text-dim)'},
      {id:_elid(),type:'text',content:'{{musicTitle}}',x:36,y:Math.round(H/2-7),fontSize:13,color:'var(--ph-text)'},
    ]; }},
    { id:'mu_c', label:'波形', desc:'带波形动效', build(W,H){ return [
      {id:_elid(),type:'text',content:'🎵 {{musicTitle}}',x:10,y:8,fontSize:12,color:'var(--ph-text)'},
      {id:_elid(),type:'text',content:'〰️〰️〰️',x:10,y:28,fontSize:14,color:'var(--ph-text-dim)'},
    ]; }},
  ],
  messages: [
    { id:'msg_a', label:'列表', desc:'消息预览', build(W,H){ return [
      {id:_elid(),type:'text',content:'💬 最新消息',x:10,y:8,fontSize:13,color:'var(--ph-text)',bold:true},
      {id:_elid(),type:'text',content:'{{messages}}',x:10,y:30,fontSize:11,color:'var(--ph-text-sub)'},
    ]; }},
    { id:'msg_b', label:'气泡', desc:'聊天气泡风', build(W,H){ return [
      {id:_elid(),type:'line',x:8,y:8,w:W-16,h:Math.round(H*0.4),color:'var(--ph-glass-strong)'},
      {id:_elid(),type:'text',content:'{{messages}}',x:14,y:14,fontSize:11,color:'var(--ph-text)'},
    ]; }},
    { id:'msg_c', label:'徽章', desc:'未读数+预览', build(W,H){ return [
      {id:_elid(),type:'emoji',content:'💬',x:10,y:Math.round(H/2-14),fontSize:24},
      {id:_elid(),type:'text',content:'{{messages}}',x:42,y:Math.round(H/2-7),fontSize:12,color:'var(--ph-text)'},
    ]; }},
  ],
  custom: [
    { id:'cu_a', label:'空白', desc:'自由排布', build(W,H){ return []; }},
    { id:'cu_b', label:'标题+内容', desc:'基础布局', build(W,H){ return [
      {id:_elid(),type:'text',content:'标题',x:12,y:10,fontSize:14,color:'var(--ph-text)',bold:true},
      {id:_elid(),type:'text',content:'内容文字',x:12,y:32,fontSize:12,color:'var(--ph-text-sub)'},
    ]; }},
    { id:'cu_c', label:'图文', desc:'图片+文字', build(W,H){ return [
      {id:_elid(),type:'emoji',content:'🖼️',x:12,y:12,fontSize:26},
      {id:_elid(),type:'text',content:'自定义内容',x:48,y:18,fontSize:12,color:'var(--ph-text-sub)'},
    ]; }},
  ],
};

const WIDGET_SIZES = {
  // ✅ iOS 风格网格尺寸（cols×rows）
  small:   { label:'1×1', cols:1, rows:1 },
  wide1:   { label:'1×4', cols:4, rows:1 },
  medium:  { label:'2×2', cols:2, rows:2 },
  wide2:   { label:'2×4', cols:4, rows:2 },
  large:   { label:'4×4', cols:4, rows:4 },
};

function _getWidgetPx(size, shape){
  const s = WIDGET_SIZES[size] || WIDGET_SIZES.medium;
  const unit = 80;
  const gap  = 10;
  return {
    w: s.cols * unit + (s.cols>1 ? (s.cols-1)*gap : 0),
    h: s.rows * unit + (s.rows>1 ? (s.rows-1)*gap : 0)
  };
}

function loadWidgetData(){
  try{ return phoneGetG('widgets_v1', { v:1, items:[] }) || { v:1, items:[] }; }catch(e){ return { v:1, items:[] }; }
}
function saveWidgetData(d){
  try{ phoneSetG('widgets_v1', d); }catch(e){}
}
function _wid(){ return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function _elid(){ return 'el_' + Math.random().toString(36).slice(2,8); }

// ✅ 统一拼 key（全局/按聊天）
function phoneKeyG(name){ return 'meow_phone_g_' + String(name||''); }
function phoneKeyC(chatUID, name){
  const uid = String(chatUID||'').trim() || 'fallback';
  return 'meow_phone_c_' + uid + '_' + String(name||'');
}

// ✅ 统一读写：优先用你已有的 lsGet/lsSet（这样能触发 MEOW_SYNC 的 markDirty）
function phoneGetG(name, fallback){
  try{ return (typeof lsGet === 'function') ? lsGet(phoneKeyG(name), fallback) : fallback; }catch(e){ return fallback; }
}
function phoneSetG(name, val){
  try{ return (typeof lsSet === 'function') ? lsSet(phoneKeyG(name), val) : void 0; }catch(e){}
}

function phoneGetC(chatUID, name, fallback){
  try{ return (typeof lsGet === 'function') ? lsGet(phoneKeyC(chatUID, name), fallback) : fallback; }catch(e){ return fallback; }
}
function phoneSetC(chatUID, name, val){
  try{ return (typeof lsSet === 'function') ? lsSet(phoneKeyC(chatUID, name), val) : void 0; }catch(e){}
}

// ✅ 当前聊天 UID 获取（复用你全局已有的 meowGetChatUID；拿不到就 fallback）
// 注意：这里只做读取，不触发切换逻辑，避免影响现有模块。
function phoneGetChatUID(){
  try{
    const uid = (typeof meowGetChatUID === 'function') ? meowGetChatUID() : '';
    const s = String(uid||'');
    if (!s || s.startsWith('fallback:') || s.startsWith('char:')) return '';
    return s;
  }catch(e){ return ''; }
}

// ✅ 给未来 App 用的默认数据模板（先放这里，后续逐个 App 填充）
function phoneMakeDefaultG(){
  return {
    v: 1,
    theme: 'modern',
    layout: null,   // 以后存桌面布局 JSON
    settings: {
      typingEffect: true,
      autoReply: true,
    },
    updatedAt: Date.now(),
  };
}
function phoneMakeDefaultC(){
  return {
    v: 1,
    threads: [],
    sms: [],
    forum: [],
    drafts: {},
    updatedAt: Date.now(),
  };
}
// 📦==================== Phone Data Keys END ====================

// 📦==================== Phone Settings / Forum / Photos Data Layer ====================
// 设置持久化
function phoneLoadSettings(){
  // ✅ 统一管理：桌面/APP 分离的玻璃清晰度 + 壁纸 + 字体等
  // 兼容旧字段：wallpaper / wallpaperName
  const DEF = {
    // 壁纸：桌面/APP 分离
    wallpaperHome: '', wallpaperHomeName: '', wallpaperHomeOpacity: 100,
    wallpaperApp:  '', wallpaperAppName:  '', wallpaperAppOpacity: 100,

    // 玻璃清晰度：桌面/APP 分离（0~100=不透明度；blur=px）
    uiHomeOpacity: 36,
    uiHomeBlur: 22,

    uiAppOpacity: 52,
    uiAppBlur: 16,

    // APP 内容底（更不透明纯色/半透明底）
    uiAppSolidOpacity: 92,

    // 其他
    fontSize: 14,
    timeMode: 'real', storyTime: '12:00', storyDate: '',
    typingEffect: 'none',
    syncToMain: false,
    autoReply: true,
  };

  try{
    const d = phoneGetG('settings_data_v1', null);
    if (d && typeof d === 'object'){
      const out = { ...DEF, ...d };

      // 兼容旧：wallpaper / wallpaperName -> wallpaperHome
      if (!out.wallpaperHome && d.wallpaper) out.wallpaperHome = d.wallpaper;
      if (!out.wallpaperHomeName && d.wallpaperName) out.wallpaperHomeName = d.wallpaperName;

      // 兜底：数值型字段
      out.wallpaperHomeOpacity = Math.max(0, Math.min(100, Number(out.wallpaperHomeOpacity ?? 100)));
      out.wallpaperAppOpacity  = Math.max(0, Math.min(100, Number(out.wallpaperAppOpacity  ?? 100)));

      out.uiHomeOpacity = Math.max(0, Math.min(100, Number(out.uiHomeOpacity ?? 36)));
      out.uiHomeBlur    = Math.max(0, Math.min(40,  Number(out.uiHomeBlur    ?? 22)));

      out.uiAppOpacity  = Math.max(0, Math.min(100, Number(out.uiAppOpacity  ?? 52)));
      out.uiAppBlur     = Math.max(0, Math.min(40,  Number(out.uiAppBlur     ?? 16)));

      out.uiAppSolidOpacity = Math.max(0, Math.min(100, Number(out.uiAppSolidOpacity ?? 92)));
      out.fontSize = Math.max(10, Math.min(22, Number(out.fontSize ?? 14)));

      return out;
    }
  }catch(e){}
  return DEF;
}

function phoneSaveSettings(data){
  try{ phoneSetG('settings_data_v1', data); }catch(e){}
}

// ✅ 自定义头像存储（纯 localStorage，上传时自动压缩）
function phoneLoadAvatars(){
  try{
    const raw = localStorage.getItem(LS_PHONE_AVATARS);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    // 修复：如果值是 'idb' 标记（之前迁移残留），清除它
    var keys = Object.keys(parsed);
    for (var i = 0; i < keys.length; i++){
      if (parsed[keys[i]] === 'idb') delete parsed[keys[i]];
    }
    return parsed;
  }catch(e){ return {}; }
}
function phoneSaveAvatars(data){
  try{ localStorage.setItem(LS_PHONE_AVATARS, JSON.stringify(data||{})); }catch(e){}
}
function phoneGetAvatar(key){
  const d = phoneLoadAvatars();
  return d[key] || '';
}
function phoneSetAvatar(key, base64){
  const d = phoneLoadAvatars();
  if (base64) d[key] = base64; else delete d[key];
  phoneSaveAvatars(d);
}

// ✅ 图片压缩工具：将 base64 图片缩小到指定尺寸
function _compressBase64Image(base64, maxSize, quality, callback){
  // maxSize: 最大宽/高 px, quality: 0~1 JPEG 质量
  try{
    var img = new Image();
    img.onload = function(){
      var w = img.naturalWidth, h = img.naturalHeight;
      var scale = Math.min(1, maxSize / Math.max(w, h));
      var nw = Math.round(w * scale), nh = Math.round(h * scale);
      var canvas = document.createElement('canvas');
      canvas.width = nw; canvas.height = nh;
      var ctx2d = canvas.getContext('2d');
      ctx2d.drawImage(img, 0, 0, nw, nh);
      // 输出 JPEG（比 PNG 小很多）
      var result = canvas.toDataURL('image/jpeg', quality || 0.7);
      // 如果 JPEG 比原图大（比如透明 PNG），用 webp
      if (result.length > base64.length){
        var webp = canvas.toDataURL('image/webp', quality || 0.7);
        callback(webp.length < base64.length ? webp : base64);
      } else {
        callback(result);
      }
    };
    img.onerror = function(){ callback(base64); };
    img.src = base64;
  }catch(e){ callback(base64); }
}

// 同步版（用于已经是小图的情况）
function _estimateBase64KB(b64){
  return b64 ? (b64.length * 0.75 / 1024) : 0;
}


// 相册存储
// 相册存储（base64 图片数组，按分类）
function phoneLoadPhotos(){
  try{
    const d = phoneGetG('photos_v1', null);
    if (d && typeof d === 'object') return d;
  }catch(e){}
  return { all:[], avatar:[], wallpaper:[], sticker:[] };
}
function phoneSavePhotos(data){
  try{ phoneSetG('photos_v1', data); }catch(e){}
}

// 论坛数据（帖子 + 关注/粉丝列表）
function phoneLoadForum(chatUID){
  try{
    const uid = chatUID || (typeof phoneGetChatUID === 'function' ? phoneGetChatUID() : '') || 'fallback';
    const d = phoneGetC(uid, 'forum_data_v1', null);
    if (d && typeof d === 'object') return d;
  }catch(e){}
  return { posts:[], following:[], followers:[], myPosts:[], bookmarks:[] };
}
function phoneSaveForum(data, chatUID){
  try{
    const uid = chatUID || (typeof phoneGetChatUID === 'function' ? phoneGetChatUID() : '') || 'fallback';
    phoneSetC(uid, 'forum_data_v1', data);
  }catch(e){}
}

// 论坛：从联系人库获取 NPC 列表
function forumGetNPCList(){
  // ✅ 论坛 NPC 联动先关闭：不再自动从“通讯录/主线NPC”拉人进论坛
  // 以后你要“互相关注后手动添加”，可以在 forum 内单独维护 following 列表。
  return [];
}

// 论坛：生成默认帖子（系统 + NPC 混合）
function forumEnsureDefaults(forumData){
  if (forumData._inited) return forumData;
  forumData._inited = true;
  if (!Array.isArray(forumData.bookmarks)) forumData.bookmarks = [];
  if (!forumData.posts.find(p=>p.id==='sys_welcome')){
    forumData.posts.unshift({
      id:'sys_welcome', authorId:'system', authorName:'系统公告', authorAvatar:'📢',
      content:'欢迎使用 MEOW 论坛！这里是你与 NPC 们的社交空间~\n点击头像可查看 TA 的主页。',
      time: Date.now()-3600000, likes:42, comments:[], shares:3, liked:false
    });
  }
  forumData.posts.sort((a,b)=>(b.time||0)-(a.time||0));
  return forumData;
}

// 论坛辅助：格式化时间
function forumFmtTime(ts){
  if (!ts) return '刚刚';
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff/86400000) + '天前';
  const d = new Date(ts);
  return (d.getMonth()+1)+'月'+d.getDate()+'日';
}

// 全局字体大小应用
function phoneApplyFontSize(size){
  try{
    if (!root) return;
    const s = Math.max(12, Math.min(20, Number(size)||14));
    root.style.fontSize = s + 'px';
  }catch(e){}
}

function _meowClamp01(x){
  const n = Number(x);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function _meowClampInt(x, lo, hi, dft){
  const n = Number(x);
  const v = isFinite(n) ? n : dft;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

// ====== UI/壁纸变量注入（独立 style，不改主 CSS）======
function ensureTuneStyle(){
  try{
    if (doc.getElementById(STYLE_TUNE_ID)) return;
    const st = doc.createElement('style');
    st.id = STYLE_TUNE_ID;
    st.textContent = `
/* ===== MEOW PHONE TUNE — UI clarity + wallpaper (scoped) ===== */
#${ID}{
  --phHomeA: .36;
  --phHomeStrongA: .46;
  --phHomeBorderA: .52;
  --phHomeBlur: 22px;

  --phAppA: .52;
  --phAppStrongA: .62;
  --phAppBorderA: .68;
  --phAppBlur: 16px;

  --phAppSolidA: .92;

  --phHomeWallA: 1;
  --phAppWallA: 1;
  --phHomeWallUrl: none;
  --phAppWallUrl: none;

  /* ✅ 图标对比度（用于你把玻璃调更透明） */
  --ph-ico: rgba(255,255,255,.94);
  --ph-ico-dim: rgba(255,255,255,.84);
  --ph-ico-shadow: rgba(0,0,0,.22);
}

/* ✅ 桌面/APP 分离：复用现有 --ph-glass 系列变量（不改设置滑块逻辑） */
#${ID}[data-view="home"]{
  --ph-glass:        rgba(255,255,255,var(--phHomeA));
  --ph-glass-strong: rgba(255,255,255,var(--phHomeStrongA));
  --ph-glass-border: rgba(255,255,255,var(--phHomeBorderA));
  --ph-glass-blur:   var(--phHomeBlur);

  /* Home：图标更白、更显眼 */
  --ph-ico: rgba(255,255,255,.96);
  --ph-ico-dim: rgba(255,255,255,.86);
  --ph-ico-shadow: rgba(0,0,0,.24);

  --ph-wallpaper-opacity: var(--phHomeWallA);
  --ph-wallpaper-url:     var(--phHomeWallUrl);
}
#${ID}[data-view="app"]{
  --ph-glass:        rgba(255,255,255,var(--phAppA));
  --ph-glass-strong: rgba(255,255,255,var(--phAppStrongA));
  --ph-glass-border: rgba(255,255,255,var(--phAppBorderA));
  --ph-glass-blur:   var(--phAppBlur);

  /* App：图标跟随正文色，更像原生 */
  --ph-ico: var(--ph-text);
  --ph-ico-dim: var(--ph-text-sub);
  --ph-ico-shadow: rgba(0,0,0,.10);

  --ph-wallpaper-opacity: var(--phAppWallA);
  --ph-wallpaper-url:     var(--phAppWallUrl);
}

/* ✅ 壁纸：在原有渐变之上叠一层（url 在前，透明度可调） */
#${ID} .phWallpaper{
  background-image:
    var(--ph-wallpaper-url, none),
    radial-gradient(ellipse 600px 400px at 30% 20%, rgba(99,102,241,.2), transparent),
    radial-gradient(ellipse 500px 500px at 70% 60%, rgba(139,92,246,.14), transparent),
    radial-gradient(ellipse 800px 600px at 50% 80%, rgba(59,130,246,.1), transparent);
  background-size: cover, auto, auto, auto;
  background-position: center, 30% 20%, 70% 60%, 50% 80%;
  opacity: var(--ph-wallpaper-opacity, 1);
}

/* ✅ frost 壁纸底纹：更“冷雾白”，不锁死玻璃变量（避免滑块失效） */
#${ID}[data-theme="frost"] .phWallpaper{
  background-image:
    var(--ph-wallpaper-url, none),
    radial-gradient(ellipse 700px 520px at 40% 25%, rgba(255,255,255,.85), transparent),
    radial-gradient(ellipse 640px 560px at 65% 55%, rgba(0,0,0,.035), transparent),
    radial-gradient(ellipse 900px 620px at 50% 85%, rgba(0,0,0,.02), transparent);
}

/* ✅ APP 内容底：跟随“App 内容底不透明度”滑块（0~1） */
#${ID}[data-view="app"] .phAppBody{
  background: rgba(10,18,36,var(--phAppSolidA));
}
#${ID}[data-theme="frost"][data-view="app"] .phAppBody{
  background: rgba(255,255,255,var(--phAppSolidA));
}

/* ✅ frost 主题：更白、更 iOS（但不覆盖 --ph-glass*，让透明/模糊滑块继续生效） */
#${ID}[data-theme="frost"]{
  --ph-bg-primary: linear-gradient(145deg,#f7f7f8 0%,#f2f2f4 55%,#ededf0 100%);
  --ph-text: rgba(20,24,28,.92);
  --ph-text-sub: rgba(20,24,28,.60);
  --ph-text-dim: rgba(20,24,28,.34);

  --ph-accent: #a8adb6;
  --ph-accent2: #c2c6cd;
  --ph-accent-grad: linear-gradient(135deg, #a8adb6, #c2c6cd);

  --ph-shadow: rgba(0,0,0,.08);
}

/* ===== Solid flat icons: glass tile + solid glyph (no inner colored/gray square) ===== */
#${ID} svg.phIco{ width:24px; height:24px; display:block; fill:currentColor; }

/* ✅ 放大：桌面 App / Dock */
#${ID} .phAppIcon svg.phIco{ width:28px; height:28px; }
#${ID} .phDockBtn svg.phIco{ width:24px; height:24px; }

/* ✅ App 内（设置列表等）小一号 */
#${ID} .settingRow .sIcon svg.phIco{ width:18px; height:18px; }

/* ✅ Flat SVG icon layout in app tiles & dock (iOS-style colored bg + white glyph) */
#${ID} .phAppIcon .ai svg.phIco,
#${ID} .phDockBtn .di svg.phIco{
  fill:#fff; width:22px; height:22px;
}
#${ID} .phDockBtn .di svg.phIco{ width:18px; height:18px; }

/* ✅ 图标更“立得住”：轻微阴影提高识别度（你把玻璃调更透明也不会糊） */
#${ID} .phAppIcon svg.phIco,
#${ID} .phDockBtn svg.phIco{
  filter: drop-shadow(0 1px 2px var(--ph-ico-shadow));
}

/* ===== 通讯录：顶部两个按钮统一玻璃风（和整体一致） ===== */
#${ID} .phContactActionRow{ display:flex; gap:8px; margin-bottom:10px; }
#${ID} .phContactActionBtn{
  flex:1;
  padding:10px 0;
  border-radius:14px;
  border:1px solid var(--ph-glass-border);
  background:var(--ph-glass);
  backdrop-filter:blur(var(--ph-glass-blur));
  -webkit-backdrop-filter:blur(var(--ph-glass-blur));
  color:var(--ph-text);
  font-size:13px;
  font-weight:650;
  cursor:pointer;
}
#${ID} .phContactActionBtn:active{ transform:scale(.98); }
#${ID}[data-theme="frost"] .phContactActionBtn{ background:rgba(255,255,255,.60); }

/* ===== App 顶部横条：与“App 内容底不透明度(uiAppSolidOpacity)”同源，避免出现三层 ===== */
#${ID}[data-view="app"] .phAppBar{
  background: rgba(10,18,36,var(--phAppSolidA)) !important;
  border-bottom: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
#${ID}[data-theme="frost"][data-view="app"] .phAppBar{
  background: rgba(255,255,255,var(--phAppSolidA)) !important;
  border-bottom: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
#${ID}[data-theme="frost"][data-view="app"] .phNavBtn.isBack{ color: rgba(20,24,28,.62) !important; }
#${ID}[data-theme="frost"][data-view="app"] .phNavBtn:hover{
  background:rgba(0,0,0,.04);
}

#${ID}[data-theme="frost"] .wxTabbar{
  background:rgba(255,255,255,.66);
  border-top:1px solid rgba(0,0,0,.06);
}
#${ID}[data-theme="frost"] .wxTabBtn{ color:rgba(20,24,28,.42); }
#${ID}[data-theme="frost"] .wxTabBtn.on{ color:rgba(34,139,116,.95); }

/* frost：桌面音乐卡片文字别用纯白（避免看不清） */
#${ID}[data-theme="frost"] .pwMusic .pwBd{ color:rgba(20,24,28,.38) !important; }
#${ID}[data-theme="frost"] .pwMusicBtn{
  background:rgba(0,0,0,.06) !important;
  color:rgba(20,24,28,.86) !important;
}
    `;
    (doc.head || doc.documentElement).appendChild(st);
  }catch(e){}
}

// ====== 从设置应用“玻璃清晰度/壁纸/APP底色” ======
function phoneApplyVisualFromSettings(cfg){
  try{
    if (!root) return;
    cfg = cfg || phoneLoadSettings();

    // 桌面玻璃（0~100 -> 0~1）
    const homeA = _meowClamp01((cfg.uiHomeOpacity||0)/100);
    const homeStrong = _meowClamp01(homeA + 0.10);
    const homeBorder  = _meowClamp01(homeA + 0.16);
    const homeBlurPx  = _meowClampInt(cfg.uiHomeBlur, 0, 40, 22);

    // APP玻璃
    const appA = _meowClamp01((cfg.uiAppOpacity||0)/100);
    const appStrong = _meowClamp01(appA + 0.10);
    const appBorder  = _meowClamp01(appA + 0.16);
    const appBlurPx  = _meowClampInt(cfg.uiAppBlur, 0, 40, 16);

    // APP底色不透明度
    const appSolidA = _meowClamp01((cfg.uiAppSolidOpacity||0)/100);

    root.style.setProperty('--phHomeA', String(homeA));
    root.style.setProperty('--phHomeStrongA', String(homeStrong));
    root.style.setProperty('--phHomeBorderA', String(homeBorder));
    root.style.setProperty('--phHomeBlur', homeBlurPx + 'px');

    root.style.setProperty('--phAppA', String(appA));
    root.style.setProperty('--phAppStrongA', String(appStrong));
    root.style.setProperty('--phAppBorderA', String(appBorder));
    root.style.setProperty('--phAppBlur', appBlurPx + 'px');

    root.style.setProperty('--phAppSolidA', String(appSolidA));

    // 壁纸透明度
    const homeWallA = _meowClamp01((cfg.wallpaperHomeOpacity ?? 100)/100);
    const appWallA  = _meowClamp01((cfg.wallpaperAppOpacity  ?? 100)/100);
    root.style.setProperty('--phHomeWallA', String(homeWallA));
    root.style.setProperty('--phAppWallA',  String(appWallA));

    // 壁纸 url
    var homeWP = cfg.wallpaperHome || '';
    var appWP = cfg.wallpaperApp || '';
    // 修复：清除 idb: 残留引用
    if (homeWP.indexOf('idb:') === 0) homeWP = '';
    if (appWP.indexOf('idb:') === 0) appWP = '';
    const homeUrl = homeWP ? `url("${homeWP}")` : 'none';
    const appUrl  = appWP  ? `url("${appWP}")`  : 'none';
    root.style.setProperty('--phHomeWallUrl', homeUrl);
    root.style.setProperty('--phAppWallUrl',  appUrl);

    // ✅ 图标自定义色
    if (cfg.iconTintHex){
      root.style.setProperty('--ph-icon-tint', cfg.iconTintHex);
    } else {
      root.style.removeProperty('--ph-icon-tint');
    }
    // ✅ 内部图标色（独立于 app 底色）
    if (cfg.iconInnerHex){
      root.style.setProperty('--ph-icon-inner-tint', cfg.iconInnerHex);
    } else {
      root.style.removeProperty('--ph-icon-inner-tint');
    }
  }catch(e){}
}

// 兼容旧调用：默认设置“桌面壁纸”
function phoneApplyWallpaper(base64OrEmpty, target){
  try{
    const tg = String(target||'home');
    const cfg = phoneLoadSettings();
    if (tg === 'app'){
      cfg.wallpaperApp = base64OrEmpty || '';
      cfg.wallpaperAppName = base64OrEmpty ? (cfg.wallpaperAppName || '自定义') : '';
    }else{
      cfg.wallpaperHome = base64OrEmpty || '';
      cfg.wallpaperHomeName = base64OrEmpty ? (cfg.wallpaperHomeName || '自定义') : '';
    }
    phoneSaveSettings(cfg);
    phoneApplyVisualFromSettings(cfg);
  }catch(e){}
}
// 📦==================== Phone Data Layer Enhancement END ====================
      let root = null;

      /* ========== 状态 ========== */
// 🧠 state 字段说明：
// mode：hidden|full|mini|pill（当前显示形态）
// view：home|app（当前视图）
// app：当前 appId（home/chats/calendar/forum/weather/sms/browser/photos/settings/...）
// page：桌面翻页索引（iOS 风分页）
// editMode：是否处于桌面编辑（长按进入）
// chatTarget：聊天详情当前联系人/会话
// navStack：返回栈（app 内“返回”用）
      const state = {
        mode: 'hidden',       // hidden | full | mini | pill
        view: 'home',         // home | app
        app:  'home',
        page: 0,
        editMode: false,
        chatTarget: null,
        navStack: [],
        _innerStack: [],      // ✅ 子页面返回栈（restore 函数）：解决"back 跳桌面"
        _wxTab: 'msgs',       // ✅ 当前微信 tab（msgs|contacts|discover|me）
      };

// 🗂️ APP_META：App 元信息（标题/图标）
// 说明：这里的 icon 是手机内部展示用；如果你只是想“看得懂代码”，只加注释即可，不改 icon。
// 你后续要加新 app：在这里加一条 + 在 renderApp 的 switch 里加渲染分支（见后文“🎬 renderApp”标注）
      const APP_META = {
        home:     { title:'桌面',   icon:'🏠' },
        chats:    { title:'聊天',   icon:'💬' },
        calendar: { title:'日历',   icon:'📅' },
        forum:    { title:'论坛',   icon:'📰' },
        weather:  { title:'天气资讯', icon:'🌤️' },
        sms:      { title:'短信',   icon:'✉️' },
        browser:  { title:'浏览器', icon:'🌐' },
        photos:   { title:'相册',   icon:'🖼️' },
        settings: { title:'设置',   icon:'⚙️' },
      };

      /* ========== 工具 ========== */
      function timeStr(){
        const d = new Date();
        return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
      }
      function dateStr(){
        const d = new Date();
        const w = ['日','一','二','三','四','五','六'][d.getDay()];
        return `${d.getMonth()+1}月${d.getDate()}日 周${w}`;
      }
      function esc(s){
        if (!s) return '';
        const d = doc.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
      }
      function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

      // ✅ 桌面/Dock 图标 SVG 映射（纯色扁平 iOS 风）
      function _phAppSVG(appId){
        const s = (d)=>`<svg class="phIco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${d}</svg>`;
        switch(appId){
          case 'chats':    return s('<path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>');
          case 'calendar': return s('<path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z"/><path d="M7 12h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zm-8 4h2v2H7zm4 0h2v2h-2z"/>');
          case 'forum':    return s('<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v2h16V6H4zm0 4v8h16v-8H4zm2 2h8v2H6v-2zm0 3h5v1.5H6V15z"/>');
          case 'weather':  return s('<path d="M12 3a5.5 5.5 0 0 0-5.4 4.5A4 4 0 1 0 6 15.5h11a3.5 3.5 0 0 0 .5-6.97A5.5 5.5 0 0 0 12 3z"/><path d="M17.5 18l1 3M14 19l1 3M10.5 18l1 3M7 19l1 3"/>');
          case 'themes':   return s('<path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 21 12 16.5 5.8 21l2.4-7.1L2 9.4h7.6L12 2z"/>');
          case 'sms':      return s('<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>');
          case 'browser':  return s('<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" fill="none" stroke="currentColor" stroke-width="2"/>');
          case 'photos':   return s('<path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z"/><circle cx="8" cy="8" r="1.5"/>');
          case 'settings': return s('<path d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.04 7.04 0 0 0-1.63-.94l-.36-2.54A.48.48 0 0 0 13.92 2h-3.84a.48.48 0 0 0-.48.41l-.36 2.54a7.04 7.04 0 0 0-1.63.94l-2.39-.96a.49.49 0 0 0-.59.22L2.71 8.47a.49.49 0 0 0 .12.61l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.05.24.26.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54a7.04 7.04 0 0 0 1.63-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/>');
          default:         return s('<circle cx="12" cy="12" r="8"/>');
        }
      }

      // ✅ 通用 emoji→SVG 映射（App 内部图标扁平化）
      function _phFlatIcon(emoji){
        const s = (d)=>`<svg class="phIco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:1em;height:1em;vertical-align:middle;">${d}</svg>`;
        const k = String(emoji||'').replace(/\uFE0F/g,'');
        switch(k){
          case '📰': return s('<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v2h16V6H4zm0 4v8h16v-8H4zm2 2h5v4H6v-4z"/>');
          case '⭐': return s('<path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 21 12 16.5 5.8 21l2.4-7.1L2 9.4h7.6z"/>');
          case '🔮': return s('<circle cx="12" cy="12" r="8" opacity=".28"/><circle cx="12" cy="12" r="3"/>');
          case '🎯': return s('<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16a8 8 0 0 0 0-16zm0 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4a2 2 0 0 0 0-4z"/>');
          case '✉️': case '✉': return s('<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>');
          case '📖': return s('<path d="M12 6.25a5.5 5.5 0 0 0-5-3.25H4v16h3c1.5 0 3.5.5 5 2 1.5-1.5 3.5-2 5-2h3V3h-3a5.5 5.5 0 0 0-5 3.25z"/>');
          case '🎮': return s('<path d="M21 6H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zM7 13H5v-2h2v-2h2v2h2v2H9v2H7v-2zm8 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>');
          case '🔥': return s('<path d="M12 23c-4.97 0-8-3.58-8-8 0-3.82 2.67-7.3 4-8.7.37-.39 1.02-.1 1 .45-.05 1.95.8 3.43 1.72 4.25.12.1.3.02.3-.13-.12-2.34 1.5-5.5 3.62-7.54.34-.33.88-.08.86.4C15.34 6.5 17 8.53 18.5 10.5 20 12.47 20 14 20 15c0 4.42-3.03 8-8 8z"/>');
          case '🔒': return s('<path d="M18 10h-1V7A5 5 0 0 0 7 7v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM9 7a3 3 0 0 1 6 0v3H9V7z"/>');
          case '☰': return s('<path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>');
          case '✏': return s('<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92-9.06 9.06zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>');
          case '💬': return s('<path d="M6 4h12a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4H10l-6 5V8a4 4 0 0 1 4-4z"/>');
          case '📢': return s('<path d="M3 11v2c0 .55.45 1 1 1h1l3 6h2l-1.5-6H14l5 3V7l-5 3H4c-.55 0-1 .45-1 1zm14-1.5v5l3-1.8v-1.4L17 9.5z"/>');
          case '🔍': return s('<path d="M10 2a8 8 0 1 0 4.9 14.32l4.39 4.39 1.41-1.41-4.39-4.39A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12a6 6 0 0 1 0-12z"/>');
          case '➤': return s('<path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>');
          case '🎙': return s('<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2z"/>');
          case '😊': return s('<path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm-3 8.6a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zm6 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z"/><path d="M8.8 14.1a.8.8 0 0 1 1.1.2 3.8 3.8 0 0 0 6.2 0 .8.8 0 0 1 1.3.9 5.4 5.4 0 0 1-8.8 0 .8.8 0 0 1 .2-1.1z"/>');
          case '👥': return s('<path d="M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>');
          case '📤': return s('<path d="M5 20h14v-2H5v2zM12 2l5.5 5.5-1.4 1.4L13 5.8V16h-2V5.8L7.9 8.9 6.5 7.5 12 2z"/>');
          case '🗑': return s('<path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z"/><path d="M4 7h16v2H4V7z"/>');
          case '🖼': return s('<path d="M4 5h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm3 4a2 2 0 1 0 0 .001A2 2 0 0 0 7 9zm13 10-5-5-3 3-2-2-6 6h16z"/>');
          case '📷': return s('<path d="M9 4l1.5-2h3L15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3zm3 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-2.2a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6z"/>');
          case '➕': return s('<path d="M11 5h2v14h-2V5zm-6 6h14v2H5v-2z"/>');
default: return emoji||'';
        }
      }

      function savePos(){
        try{
          const payload = { x: state.posX, y: state.posY, mode: state.mode };

          // 优先走统一存储总线（会触发同步层 markDirty + schedulePush）
          if (typeof lsSet === 'function'){
            lsSet(LS_POS, payload);
          } else {
            W.localStorage.setItem(LS_POS, JSON.stringify(payload));
          }
        }catch(e){}
      }

      function loadPos(){
        try{
          let v = null;

          // 优先走统一存储总线
          if (typeof lsGet === 'function'){
            v = lsGet(LS_POS, null);
          } else {
            const raw = W.localStorage.getItem(LS_POS);
            v = raw ? JSON.parse(raw) : null;
          }

          if (v && typeof v === 'object'){
            state.posX = v.x;
            state.posY = v.y;
            return v;
          }
        }catch(e){}
        return null;
      }

      /* ========== CSS ========== */
// 🎨 ensureStyle：只注入一次小手机 CSS（玻璃风变量、布局、动画）
// 关键点：styleId = meow-phone-style-v2
// 你要改外观：优先改 CSS 变量（--ph-*）而不是硬写颜色，避免全局污染
      function ensureStyle(){
        if (doc.getElementById(STYLE_ID)) return;
        const st = doc.createElement('style');
        st.id = STYLE_ID;
        st.textContent = `
/* ===== MEOW PHONE V2 — Glass Morphism ===== */

/* ---------- Theme CSS Variables ---------- */
#${ID}{
  --ph-bg-primary: linear-gradient(145deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);
  --ph-glass: rgba(255,255,255,.08);
  --ph-glass-strong: rgba(255,255,255,.12);
  --ph-glass-border: rgba(255,255,255,.14);
  --ph-glass-blur: 22px;
  --ph-text: rgba(255,255,255,.88);
  --ph-text-sub: rgba(255,255,255,.55);
  --ph-text-dim: rgba(255,255,255,.3);
  --ph-accent: #6366f1;
  --ph-accent2: #8b5cf6;
  --ph-accent-grad: linear-gradient(135deg, #6366f1, #8b5cf6);
  --ph-shadow: rgba(0,0,0,.18);
  --ph-radius-lg: 22px;
  --ph-radius-md: 16px;
  --ph-radius-sm: 12px;
  --ph-radius-xs: 8px;
}
/* Theme: modern (default — already set above) */
#${ID}[data-theme="medieval"]{
  --ph-bg-primary: linear-gradient(145deg,#2c1810 0%,#3d2617 50%,#4a2c1a 100%);
  --ph-glass: rgba(210,180,140,.1);
  --ph-glass-strong: rgba(210,180,140,.15);
  --ph-glass-border: rgba(210,180,140,.2);
  --ph-text: rgba(255,240,220,.88);
  --ph-text-sub: rgba(255,240,220,.55);
  --ph-accent: #c7956d;
  --ph-accent2: #d4a574;
  --ph-accent-grad: linear-gradient(135deg, #c7956d, #d4a574);
}
#${ID}[data-theme="cyber"]{
  --ph-bg-primary: linear-gradient(145deg,#0a0a0a 0%,#0d1117 50%,#0a1628 100%);
  --ph-glass: rgba(0,255,136,.06);
  --ph-glass-strong: rgba(0,255,136,.1);
  --ph-glass-border: rgba(0,255,136,.18);
  --ph-text: rgba(0,255,136,.9);
  --ph-text-sub: rgba(0,255,136,.55);
  --ph-accent: #00ff88;
  --ph-accent2: #00ccff;
  --ph-accent-grad: linear-gradient(135deg, #00ff88, #00ccff);
}
#${ID}[data-theme="sakura"]{
  --ph-bg-primary: linear-gradient(145deg,#2d1f2f 0%,#3a2040 50%,#4a1942 100%);
  --ph-glass: rgba(255,182,193,.08);
  --ph-glass-strong: rgba(255,182,193,.13);
  --ph-glass-border: rgba(255,182,193,.18);
  --ph-text: rgba(255,230,235,.88);
  --ph-text-sub: rgba(255,200,210,.55);
  --ph-accent: #ff6b9d;
  --ph-accent2: #c084fc;
  --ph-accent-grad: linear-gradient(135deg, #ff6b9d, #c084fc);
}
#${ID}[data-theme="frost"]{
  --ph-bg-primary: linear-gradient(145deg,#e8edf2 0%,#dce3ea 50%,#cfd8e3 100%);
  --ph-glass: rgba(255,255,255,.45);
  --ph-glass-strong: rgba(255,255,255,.6);
  --ph-glass-border: rgba(255,255,255,.7);
  --ph-text: rgba(30,40,60,.88);
  --ph-text-sub: rgba(30,40,60,.55);
  --ph-text-dim: rgba(30,40,60,.3);
  --ph-accent: #5b7fb5;
  --ph-accent2: #7e9bc9;
  --ph-accent-grad: linear-gradient(135deg, #5b7fb5, #7e9bc9);
  --ph-shadow: rgba(0,0,0,.08);
}

/* ---------- Root ---------- */
#${ID}{
  position:fixed; z-index:999999; display:none;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
  user-select:none; -webkit-user-select:none;
}
#${ID} *{ box-sizing:border-box; margin:0; padding:0; }

/* --- full mode --- */
#${ID}.full{ display:block !important; }
#${ID} .phBackdrop{
  display:none; position:fixed; inset:0; z-index:-1;
  background:rgba(0,0,0,.35);
  backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);
}
#${ID}.full .phBackdrop{ display:block; }

/* --- mini mode --- */
#${ID}.mini{
  display:block !important;
  width:340px; height:600px;
  border-radius:28px;
  box-shadow:0 16px 56px var(--ph-shadow);
  transition:box-shadow .2s;
}
#${ID}.mini:hover{ box-shadow:0 20px 64px rgba(0,0,0,.32); }

/* --- pill mode --- */
#${ID}.pill{
  display:flex !important;
  width:56px; height:56px; border-radius:50%;
  background:var(--ph-accent-grad);
  align-items:center; justify-content:center;
  cursor:pointer;
  box-shadow:0 6px 24px rgba(99,102,241,.45);
  transition:transform .15s, box-shadow .2s;
  animation:phPillPulse 3s ease-in-out infinite;
}
#${ID}.pill:hover{ transform:scale(1.1); }
#${ID}.pill:active{ transform:scale(.95); }
#${ID}.pill .phShell{ display:none; }
#${ID}.pill .phPillIcon{ display:flex; font-size:24px; color:#fff; pointer-events:none; }
@keyframes phPillPulse{
  0%,100%{ box-shadow:0 6px 24px rgba(99,102,241,.45); }
  50%{ box-shadow:0 6px 28px rgba(99,102,241,.6); }
}

/* ---------- Phone Shell ---------- */
#${ID} .phShell{
  width:375px; height:750px; max-width:96vw; max-height:90vh;
  border-radius:38px; position:relative; overflow:hidden;
  background:var(--ph-bg-primary);
  border:1px solid var(--ph-glass-border);
  box-shadow:
    0 0 0 1px rgba(0,0,0,.2),
    inset 0 1px 0 rgba(255,255,255,.08),
    0 24px 80px var(--ph-shadow);
  transition:transform .2s ease;
  transform-origin:top left;
}
#${ID}.mini .phShell{
  width:100%; height:100%; max-width:none; max-height:none; border-radius:28px;
}
#${ID} .phPillIcon{ display:none; }

/* ---------- Drag handle ---------- */
#${ID} .phDragHint{
  position:absolute; top:8px; left:50%; transform:translateX(-50%);
  width:48px; height:5px; border-radius:999px;
  background:rgba(255,255,255,.25); z-index:99;
  pointer-events:auto; cursor:grab; display:none;
}
#${ID} .phDragHint:active{ cursor:grabbing; }
#${ID}.mini .phDragHint, #${ID}.full .phDragHint{ display:block; }

/* drag areas */
#${ID}.full .phDragHint, #${ID}.mini .phDragHint{ touch-action:none; }
#${ID}.full .phStatus, #${ID}.mini .phStatus{ cursor:grab; touch-action:none; }
#${ID}.full .phStatus:active, #${ID}.mini .phStatus:active{ cursor:grabbing; }
#${ID}.full .phAppBar, #${ID}.mini .phAppBar{ cursor:grab; touch-action:none; }
#${ID}.full .phAppBar:active, #${ID}.mini .phAppBar:active{ cursor:grabbing; }
#${ID}.full .phAppBody, #${ID}.mini .phAppBody{ touch-action:auto; cursor:auto; }
#${ID}.pill{ touch-action:none; cursor:grab; }
#${ID}.pill:active{ cursor:grabbing; }

/* ---------- Zoom bar ---------- */
#${ID} .phZoomBar{
  display:none; position:absolute; bottom:-48px; left:50%; transform:translateX(-50%);
  background:rgba(30,30,50,.88); border-radius:22px; padding:5px 12px;
  gap:10px; align-items:center; z-index:100; white-space:nowrap;
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  border:1px solid rgba(255,255,255,.15);
  box-shadow:0 4px 16px rgba(0,0,0,.3);
}
#${ID}.full .phZoomBar{ display:flex; }
#${ID} .phZoomBtn{
  appearance:none; border:0; background:rgba(255,255,255,.12); border-radius:50%;
  width:32px; height:32px; color:#fff; font-size:18px; cursor:pointer;
  display:flex; align-items:center; justify-content:center; transition:background .15s;
  flex-shrink:0;
}
#${ID} .phZoomBtn:hover{ background:rgba(255,255,255,.25); }
#${ID} .phZoomLabel{ color:rgba(255,255,255,.75); font-size:12px; min-width:38px; text-align:center; }

/* ---------- Wallpaper ---------- */
#${ID} .phWallpaper{
  position:absolute; inset:0; z-index:0;
  background:
    radial-gradient(ellipse 600px 400px at 30% 20%, rgba(99,102,241,.2), transparent),
    radial-gradient(ellipse 500px 500px at 70% 60%, rgba(139,92,246,.14), transparent),
    radial-gradient(ellipse 800px 600px at 50% 80%, rgba(59,130,246,.1), transparent);
}

/* ---------- Status bar ---------- */
#${ID} .phStatus{
  position:relative; z-index:3;
  display:flex; align-items:center; justify-content:space-between;
  height:36px; padding:10px 14px 0;
  color:var(--ph-text); font-weight:600;
  user-select:none;
}
#${ID} .phTime{
  font-size:13px; letter-spacing:.2px;
  color:rgba(255,255,255,.96);
  text-shadow:0 1px 2px rgba(0,0,0,.25);
}
#${ID} .phRight{
  display:flex; align-items:center; gap:6px;
}
#${ID} .iosSignal{ display:flex; align-items:flex-end; gap:1.5px; height:11px; }
#${ID} .iosSignal i{
  display:block; width:2.2px; border-radius:1px;
  background:rgba(255,255,255,.95);
  box-shadow:0 0 0 1px rgba(0,0,0,.04);
}
#${ID} .iosSignal i:nth-child(1){ height:4px; opacity:.65; }
#${ID} .iosSignal i:nth-child(2){ height:6px; opacity:.78; }
#${ID} .iosSignal i:nth-child(3){ height:8px; opacity:.9; }
#${ID} .iosSignal i:nth-child(4){ height:10px; }
#${ID} .iosWifi{
  position:relative; width:13px; height:10px; opacity:.96;
}
#${ID} .iosWifi::before, #${ID} .iosWifi::after{
  content:""; position:absolute; left:50%; transform:translateX(-50%);
  border:1.6px solid transparent; border-top-color:rgba(255,255,255,.95);
  border-radius:50%;
}
#${ID} .iosWifi::before{ top:1px; width:12px; height:12px; }
#${ID} .iosWifi::after{ top:4px; width:7px; height:7px; }
#${ID} .iosWifi span{
  position:absolute; left:50%; bottom:0; transform:translateX(-50%);
  width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,.95);
}
#${ID} .iosBattery{
  display:flex; align-items:center; gap:3px; margin-left:1px;
}
#${ID} .iosBattery .bat{
  position:relative; width:20px; height:10px; border-radius:3px;
  border:1.5px solid rgba(255,255,255,.95);
  box-sizing:border-box;
}
#${ID} .iosBattery .bat::after{
  content:""; position:absolute; right:-3px; top:2px;
  width:2px; height:4px; border-radius:0 1px 1px 0;
  background:rgba(255,255,255,.95);
}
#${ID} .iosBattery .lv{
  position:absolute; left:1px; top:1px; bottom:1px;
  width:70%; border-radius:1.5px;
  background:linear-gradient(90deg,#22c55e,#86efac);
}
#${ID} .iosBattery .pct{
  font-size:11px; line-height:1; opacity:.92; min-width:16px; text-align:right;
}
#${ID} .phSysBtn{
  width:20px; height:20px; border-radius:7px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.08); color:rgba(255,255,255,.92);
  cursor:pointer; font-size:10px; line-height:1;
  display:flex; align-items:center; justify-content:center;
  padding:0; margin-left:2px;
}
#${ID} .phSysBtn:hover{ background:rgba(255,255,255,.14); }

/* ---------- Stage ---------- */
#${ID} .phStage{ position:absolute; left:0; right:0; top:44px; bottom:0; z-index:5; }
#${ID} .phHome, #${ID} .phApp{
  position:absolute; inset:0; transition:opacity .25s, transform .25s;
}
#${ID} .phHome{ opacity:1; transform:scale(1); pointer-events:auto; }
#${ID} .phApp{ opacity:0; transform:scale(1.04); pointer-events:none; }
#${ID}[data-view="app"] .phHome{ opacity:0; transform:scale(.96); pointer-events:none; }
#${ID}[data-view="app"] .phApp{ opacity:1; transform:scale(1); pointer-events:auto; }
#${ID}.mini .phHome{ display:none; }
#${ID}.mini .phApp{ opacity:1; transform:none; pointer-events:auto; }

/* ---------- Desktop Grid ---------- */
#${ID} .phPages{
  position:absolute; left:0; right:0; top:0; bottom:128px; overflow:hidden;
}
#${ID} .phPagesInner{
  height:100%; display:flex;
  overflow-x:auto; scroll-snap-type:x mandatory;
  -webkit-overflow-scrolling:touch; scrollbar-width:none;
}
#${ID} .phPagesInner::-webkit-scrollbar{ display:none; }
#${ID} .phPage{
  flex:0 0 100%; height:100%; scroll-snap-align:start; padding:8px 14px;
}
#${ID} .phGrid{
  display:grid; grid-template-columns:repeat(4,1fr);
  grid-auto-rows:80px; gap:10px;
}

/* ---------- Glass Widget Cards ---------- */
#${ID} .pw{
  border-radius:var(--ph-radius-lg);
  background:var(--ph-glass);
  backdrop-filter:blur(var(--ph-glass-blur)); -webkit-backdrop-filter:blur(var(--ph-glass-blur));
  border:1px solid var(--ph-glass-border);
  box-shadow:0 8px 32px var(--ph-shadow), inset 0 1px 0 rgba(255,255,255,.06);
  overflow:hidden; position:relative; transition:transform .15s;
}
#${ID} .pw:active{ transform:scale(.97); }
#${ID} .pw .pwHd{
  padding:10px 14px 0; font-weight:700;
  color:var(--ph-text); font-size:13px;
  display:flex; align-items:center; justify-content:space-between;
}
#${ID} .pw .pwHd .pwHdSub{ font-size:11px; font-weight:500; color:var(--ph-text-sub); }
#${ID} .pw .pwBd{
  padding:8px 14px 12px; color:var(--ph-text-sub); font-size:12.5px; line-height:1.5;
}

/* Profile Card (glass) */
#${ID} .pwProfile{
  background:linear-gradient(135deg, rgba(99,102,241,.15), rgba(139,92,246,.1));
  backdrop-filter:blur(var(--ph-glass-blur)); -webkit-backdrop-filter:blur(var(--ph-glass-blur));
}
#${ID} .pwProfile .pwAvatar{
  width:48px; height:48px; border-radius:50%;
  background:var(--ph-glass-strong); border:2px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;
  box-shadow:0 4px 12px var(--ph-shadow);
}
#${ID} .pwProfile .pwProfileRow{ display:flex; align-items:center; gap:12px; padding:12px 14px 4px; }
#${ID} .pwProfile .pwName{ font-weight:800; color:var(--ph-text); font-size:15px; }
#${ID} .pwProfile .pwTag{ font-size:11.5px; color:var(--ph-text-sub); margin-top:2px; }
#${ID} .pwProfile .pwPreview{
  padding:4px 14px 12px; color:var(--ph-text-sub); font-size:12px; line-height:1.4;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

/* Music Card */
#${ID} .pwMusic{
  background:linear-gradient(135deg, rgba(236,72,153,.14), rgba(244,63,94,.08));
  backdrop-filter:blur(var(--ph-glass-blur)); -webkit-backdrop-filter:blur(var(--ph-glass-blur));
}
#${ID} .pwMusic .pwMusicControls{ display:flex; align-items:center; gap:14px; padding:4px 14px 10px; }
#${ID} .pwMusic .pwMusicBtn{
  appearance:none; border:0; cursor:pointer;
  width:34px; height:34px; border-radius:50%;
  background:var(--ph-glass-strong); color:var(--ph-text); font-size:14px;
  display:flex; align-items:center; justify-content:center;
  transition:background .12s, transform .1s;
}
#${ID} .pwMusic .pwMusicBtn:active{ transform:scale(.9); }
#${ID} .pwMusic .pwMusicBar{
  flex:1; height:3px; border-radius:2px; background:rgba(255,255,255,.12); position:relative;
}
#${ID} .pwMusic .pwMusicBar::after{
  content:''; position:absolute; left:0; top:0; bottom:0; width:35%; border-radius:2px;
  background:linear-gradient(90deg, rgba(236,72,153,.7), rgba(244,63,94,.6));
}

/* ---------- App Icons ---------- */
/* ✅ Flat Icon Mode（纯色扁平）：把 emoji/彩色图标整体拉成单色，随系统明暗变化 */
#${ID}{
  --ph-ico-filter: grayscale(1) saturate(0);
  --ph-ico-opacity: .92;
  --ph-ico-bright: 1.05;
  /* ✅ A: 发现/我 页列表图标独立颜色（不受 --ph-icon-inner-tint 影响） */
  --ph-list-icon: rgba(20,24,28,.72);
}
@media (prefers-color-scheme: dark){
  #${ID}{
    --ph-ico-bright: 1.25;
    --ph-ico-opacity: .95;
    --ph-list-icon: rgba(255,255,255,.72);
  }
}
#${ID} .phPlIcon,
#${ID} .pwAvatar,
#${ID} .momentAvatar,
#${ID} .feedAvatar,
#${ID} .cAvatar,
#${ID} .cbAvatar{
  filter: var(--ph-ico-filter) brightness(var(--ph-ico-bright));
  opacity: var(--ph-ico-opacity);
}
/* ✅ cAvatar 里如果放的是 SVG（非 emoji），不要被全局“扁平滤镜”变灰 */
#${ID} .cAvatar.svgIco,
#${ID} .feedAvatar.svgIco,
#${ID} .momentAvatar.svgIco,
#${ID} .cbAvatar.svgIco,
#${ID} .pwAvatar.svgIco,
#${ID} .npcProfileAvatar.svgIco{ filter:none; opacity:1; }

/* ✅ 头像不参与“扁平滤镜”：保持表情/图片原色（不再全变灰） */
#${ID} .pwAvatar,
#${ID} .wxMeAvatar,
#${ID} .wxCIAvatar,
#${ID} .wxCBAvatar,
#${ID} .momentAvatar,
#${ID} .feedAvatar,
#${ID} .cAvatar,
#${ID} .cbAvatar,
#${ID} .npcProfileAvatar{
  filter:none !important;
  opacity:1 !important;
}

/* ✅ App 内部图标色：全局生效（不仅设置页）
   说明：用 fill + !important 覆盖内联 style="fill:currentColor"，让“内部图标色”在所有 App 内都生效 */
#${ID}[data-view="app"] .phAppBar svg.phIco,
#${ID}[data-view="app"] .phAppBody svg.phIco,
#${ID} .sIcon svg.phIco,
#${ID} .weTypeIcon svg.phIco,
#${ID} .feedAction svg.phIco,
#${ID} .momentAction svg.phIco,
#${ID} .weElBtn svg.phIco,
#${ID} .chatExtraBtn svg.phIco,
#${ID} .wxCHIco svg.phIco,
#${ID} .wxTopBtn svg.phIco,
#${ID} .wxDIco svg.phIco,
#${ID} .wxNewFriendToolBtn svg.phIco{
  fill: var(--ph-icon-inner-tint, currentColor) !important;
}
/* ✅ 通讯录图标底色：联动设置中的 iconTint */
#${ID} .wxCHIco{ background: var(--ph-icon-tint, #07c160); }
/* 点赞保持红色 */
#${ID} .feedAction.liked svg.phIco,
#${ID} .momentAction.liked svg.phIco{
  fill:#ef4444 !important;
}
/* 例外：底部Tab图标/发送按钮/论坛浮动发帖按钮，用自身 currentColor（便于选中态/白色图标） */
#${ID} .wxTabBtn .ico svg.phIco{ fill: currentColor !important; }
#${ID} .chatSendBtn svg.phIco{ fill: currentColor !important; }
#${ID} .forumCompose svg.phIco{ fill: currentColor !important; }
#${ID} .phAppIcon{
  appearance:none; border:0; cursor:pointer; border-radius:var(--ph-radius-md);
  background:var(--ph-glass);
  backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
  border:1px solid var(--ph-glass-border);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:5px; transition:transform .12s, background .12s;
  box-shadow:0 4px 16px var(--ph-shadow);
  position:relative;
}
#${ID} .phAppIcon:hover{ background:var(--ph-glass-strong); }
#${ID} .phAppIcon:active{ transform:scale(.9); }
#${ID} .phAppIcon .ai{
  width:36px; height:36px; border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  font-size:18px; line-height:1; color:#fff;
  background:var(--ph-accent-grad);
}
#${ID} .phAppIcon[data-app="chats"] .ai{ background:var(--ph-icon-tint, linear-gradient(135deg,#7B9EA8,#9AB8C2)); }
#${ID} .phAppIcon[data-app="calendar"] .ai{ background:var(--ph-icon-tint, linear-gradient(135deg,#A088B5,#BDA4D1)); }
#${ID} .phAppIcon[data-app="forum"] .ai{ background:var(--ph-icon-tint, linear-gradient(135deg,#8B9DAF,#A8B8C8)); }
#${ID} .phAppIcon[data-app="weather"] .ai{ background:var(--ph-icon-tint, linear-gradient(135deg,#C4A882,#D9C4A8)); }
#${ID} .phAppIcon[data-app="themes"] .ai{ background:var(--ph-icon-tint, linear-gradient(135deg,#B8A9C9,#D1C4E0)); }
#${ID} .phAppIcon .at{
  font-size:10.5px; color:var(--ph-text-sub); font-weight:500;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90%;
}

/* ---------- Search bar ---------- */
#${ID} .phSearch{
  position:absolute; left:16px; right:16px; bottom:90px;
  height:36px; border-radius:18px;
  background:var(--ph-glass);
  backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
  border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center;
  color:var(--ph-text-dim); font-size:13px; cursor:pointer; transition:background .15s;
}
#${ID} .phSearch:hover{ background:var(--ph-glass-strong); }

/* ---------- Page dots ---------- */
#${ID} .phDots{
  position:absolute; left:0; right:0; bottom:72px;
  height:16px; display:flex; align-items:center; justify-content:center; gap:6px;
}
#${ID} .phDots .dot{
  width:6px; height:6px; border-radius:99px;
  background:var(--ph-text-dim); transition:all .2s;
}
#${ID} .phDots .dot.on{ background:var(--ph-text); width:18px; }

/* ---------- Dock ---------- */
#${ID} .phDock{
  position:absolute; left:14px; right:14px; bottom:12px;
  height:58px; border-radius:26px;
  background:var(--ph-glass);
  backdrop-filter:blur(28px); -webkit-backdrop-filter:blur(28px);
  border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:space-around; padding:0 8px;
  box-shadow:0 8px 32px var(--ph-shadow);
}
#${ID} .phDockBtn{
  appearance:none; border:0; cursor:pointer;
  width:52px; height:44px; border-radius:14px;
  background:transparent;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:2px; transition:background .12s; position:relative;
}
#${ID} .phDockBtn:hover{ background:var(--ph-glass); }
#${ID} .phDockBtn:active{ transform:scale(.9); }
#${ID} .phDockBtn .di{
  width:30px; height:30px; border-radius:8px;
  display:flex; align-items:center; justify-content:center;
  font-size:15px; line-height:1; color:#fff;
  background:var(--ph-accent-grad);
}
#${ID} .phDockBtn[data-app="sms"] .di{ background:var(--ph-icon-tint, linear-gradient(135deg,#8DA8B8,#A8C0CF)); }
#${ID} .phDockBtn[data-app="browser"] .di{ background:var(--ph-icon-tint, linear-gradient(135deg,#7B9EA8,#9AB8C2)); }
#${ID} .phDockBtn[data-app="photos"] .di{ background:var(--ph-icon-tint, linear-gradient(135deg,#A4C49A,#BCD8B4)); }
#${ID} .phDockBtn[data-app="settings"] .di{ background:var(--ph-icon-tint, linear-gradient(135deg,#9E9EAF,#B8B8C8)); }
#${ID} .phDockBtn .dt{ font-size:9.5px; color:var(--ph-text-sub); font-weight:500; }
#${ID} .phDockBtn .badge{
  position:absolute; top:2px; right:6px;
  min-width:16px; height:16px; border-radius:8px;
  background:#ef4444; color:#fff; font-size:10px; font-weight:700;
  display:none; align-items:center; justify-content:center; padding:0 4px;
}
#${ID} .phDockBtn .badge.show{ display:flex; }

/* ---------- App Page ---------- */
#${ID} .phAppBar{
  position:absolute; left:0; right:0; top:0; height:52px;
  display:grid; grid-template-columns:44px 1fr 44px; align-items:center;
  gap:0; padding:0 8px;
  background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
  border-bottom:1px solid rgba(255,255,255,.06);
  z-index:3;
}
#${ID} .phAppTitle{
  color:var(--ph-text); font-weight:600; font-size:14px;
  text-align:center; letter-spacing:.2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
#${ID} .phNavBtn{
  appearance:none; border:0; background:transparent; color:var(--ph-text);
  cursor:pointer; font-size:18px; padding:0;
  width:32px; height:32px; border-radius:10px;
  display:flex; align-items:center; justify-content:center;
}
#${ID} .phNavBtn.isBack{
  font-size:22px; color:rgba(255,255,255,.96);
  justify-self:start;
}
#${ID} .phNavBtn:hover{ background:rgba(255,255,255,.08); }
#${ID} .phAppBarSpacer{ width:32px; height:32px; justify-self:end; display:flex; align-items:center; justify-content:center; }
#${ID} .phAppBarSpacer .phBarRBtn{ appearance:none; border:0; background:transparent; color:var(--ph-text-sub); width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:16px; opacity:.7; transition:opacity .2s; }
#${ID} .phAppBarSpacer .phBarRBtn:hover{ opacity:1; background:rgba(255,255,255,.1); }
#${ID} .phAppBody{
  position:absolute; left:0; right:0; top:52px; bottom:0;
  overflow:auto;
  background:linear-gradient(180deg, rgba(10,18,36,.12), rgba(10,18,36,.06));
  scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.08) transparent;
}
#${ID} .phAppBody::-webkit-scrollbar{ width:4px; }
#${ID} .phAppBody::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.08); border-radius:2px; }

/* ---------- In-Phone Modal (Moments Composer etc.) ---------- */
#${ID} .phModalMask{
  position:absolute; inset:0; z-index:9999;
  display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.18);
  backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px);
}
#${ID}[data-theme="frost"] .phModalMask{ background:rgba(0,0,0,.10); }
#${ID} .phModalCard{
  width:min(330px, calc(100% - 28px));
  border-radius:18px;
  background:#fff;
  border:1px solid rgba(0,0,0,.08);
  box-shadow:0 18px 60px rgba(0,0,0,.28);
  padding:14px;
}
#${ID} .phModalTitle{
  font-weight:700; color:var(--ph-text); font-size:14px; margin-bottom:10px;
}
#${ID} .phModalTa{
  width:100%; min-height:110px; resize:none;
  border-radius:14px; border:1px solid var(--ph-glass-border);
  background:var(--ph-glass); color:var(--ph-text);
  padding:10px 10px; font-size:13px; outline:none;
}
#${ID} .phModalTa::placeholder{ color:var(--ph-text-dim); }
#${ID} .phModalBtns{ display:flex; gap:10px; margin-top:12px; }
#${ID} .phModalBtn{
  flex:1; padding:10px 12px; border-radius:14px;
  border:1px solid var(--ph-glass-border);
  background:var(--ph-glass); color:var(--ph-text);
  font-weight:700; cursor:pointer;
}
#${ID} .phModalBtn.primary{ border:0; background:var(--ph-accent-grad); color:#fff; }
#${ID} .phModalBtn:active{ transform:scale(.98); }



/* ---------- Shared: Glass Card ---------- */
#${ID} .phCard{
  margin:10px 12px; border-radius:var(--ph-radius-lg);
  background:var(--ph-glass);
  backdrop-filter:blur(var(--ph-glass-blur)); -webkit-backdrop-filter:blur(var(--ph-glass-blur));
  border:1px solid var(--ph-glass-border);
  padding:14px; color:var(--ph-text-sub); font-size:13px; line-height:1.5;
  box-shadow:0 4px 16px var(--ph-shadow);
}

/* ---------- Chat (WeChat-like) ---------- */
/* ---------- Chat (WeChat-like) ---------- */
#${ID} .chatTabs{
  display:none;
}
#${ID} .wxChatShell{
  position:relative; height:100%;
  display:flex; flex-direction:column;
}
#${ID} .wxChatHeader{
  padding:10px 14px 8px;
  border-bottom:1px solid rgba(255,255,255,.06);
  background:rgba(255,255,255,.02);
}
#${ID} .wxChatHeader .ttl{
  color:var(--ph-text); font-size:15px; font-weight:700;
}
#${ID} .wxChatHeader .sub{
  margin-top:3px; color:var(--ph-text-dim); font-size:11.5px;
}
#${ID} .wxChatContent{
  flex:1; min-height:0; overflow:auto;
}

/* WeChat-like: 顶部浅提示 + 搜索条（版面更像微信，不改功能） */
#${ID} .wxHintLine{
  padding:6px 14px 2px;
  font-size:11px;
  color:var(--ph-text-dim);
  opacity:.45;
}
#${ID} .wxSearchRow{ padding:6px 12px 8px; }
#${ID} .wxSearchBox{
  height:34px; border-radius:10px;
  background:rgba(255,255,255,.58);
  border:1px solid rgba(0,0,0,.06);
  display:flex; align-items:center; justify-content:center; gap:6px;
  color:rgba(20,24,28,.55);
  font-size:12px;
  backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
}
#${ID} .wxSearchBox svg.phIco{ width:14px; height:14px; opacity:.65; }
#${ID} .wxBadge{
  position:absolute; right:-4px; top:-4px;
  min-width:16px; height:16px; padding:0 4px;
  border-radius:10px;
  background:#ef4444; color:#fff;
  font-size:10px; line-height:16px;
  display:inline-flex; align-items:center; justify-content:center;
  box-shadow:0 2px 6px rgba(0,0,0,.18);
}
#${ID} .wxTabbar{
  display:grid; grid-template-columns:repeat(4,1fr);
  gap:2px; padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px));
  border-top:1px solid rgba(0,0,0,.08);
  background:rgba(246,246,246,.92);
  backdrop-filter:blur(22px);
  -webkit-backdrop-filter:blur(22px);
}

#${ID} .wxTabBtn{
  appearance:none; border:0; background:transparent; color:var(--ph-text-dim);
  border-radius:12px; padding:6px 4px; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
}
#${ID} .wxTabBtn .ico{ font-size:0; line-height:1; display:flex; align-items:center; justify-content:center; }
#${ID} .wxTabBtn .ico svg.phIco{ width:18px; height:18px; fill:currentColor; }
#${ID} .wxTabBtn .txt{ font-size:11.5px; line-height:1.1; }
#${ID} .wxTabBtn.on{
  color: rgba(34,139,116,.95);
  background: transparent;
}
#${ID} .chatList{ padding:4px 0; }
#${ID} .chatItem{
  display:flex; align-items:center; gap:12px;
  padding:10px 14px; cursor:pointer; transition:background .1s;
  border-bottom:1px solid rgba(255,255,255,.03);
}
#${ID} .chatItem:hover{ background:var(--ph-glass); }
#${ID} .chatItem:active{ background:var(--ph-glass-strong); }
#${ID} .chatItem .cAvatar{
  width:44px; height:44px; border-radius:50%; flex-shrink:0;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:18px;
  box-shadow:0 2px 8px var(--ph-shadow);
}
#${ID} .chatItem .cInfo{ flex:1; min-width:0; }
#${ID} .chatItem .cName{ font-weight:600; color:var(--ph-text); font-size:14px; }
#${ID} .chatItem .cLastMsg{
  font-size:12px; color:var(--ph-text-dim);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;
}
#${ID} .chatItem .cTime{ font-size:11px; color:var(--ph-text-dim); flex-shrink:0; }

/* === WeChat Chat List Items (仿真微信首页聊天行) === */
#${ID} .wxChatList{ padding:0; }
#${ID} .wxChatRow{
  display:flex; align-items:center; gap:12px;
  padding:12px 16px; cursor:pointer;
  transition:background .1s;
  background:rgba(255,255,255,.72);
  position:relative; z-index:2;
  width:100%; will-change:transform;
}
#${ID} .wxChatRow:active{ background:rgba(0,0,0,.04); }
#${ID} .wxChatAvatar{
  width:48px; height:48px; border-radius:8px; flex-shrink:0;
  background:var(--ph-glass-strong); border:1px solid rgba(0,0,0,.06);
  display:flex; align-items:center; justify-content:center; font-size:22px;
  box-shadow:0 1px 4px rgba(0,0,0,.06);
  color:rgba(20,24,28,.7);
  overflow:hidden;
}
#${ID} .wxChatInfo{ flex:1; min-width:0; }
#${ID} .wxChatInfoTop{
  display:flex; align-items:baseline; justify-content:space-between; gap:8px;
}
#${ID} .wxChatName{
  font-weight:500; color:rgba(20,24,28,.88); font-size:15px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0;
}
#${ID} .wxChatTime{ font-size:11px; color:rgba(20,24,28,.35); flex-shrink:0; }
#${ID} .wxChatPreview{
  font-size:13px; color:rgba(20,24,28,.4);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:3px;
  line-height:1.3;
}
#${ID} .chatItemSwipeWrap + .chatItemSwipeWrap .wxChatRow{ border-top:1px solid rgba(0,0,0,.04); }

/* Chat detail (ref: image 4) */
#${ID} .chatDetailWrap{
  display:flex; flex-direction:column; height:100%;
}
#${ID} .chatMsgs{
  flex:1; padding:12px 14px 8px; display:flex; flex-direction:column; gap:8px;
  overflow-y:auto; -webkit-overflow-scrolling:touch;
}
#${ID} .chatBubble{
  max-width:76%; display:flex; gap:8px; align-items:flex-start;
  animation:phBubbleIn .25s ease-out;
}
#${ID} .chatBubble.me{ flex-direction:row-reverse; align-self:flex-end; }
#${ID} .chatBubble.them{ align-self:flex-start; }
#${ID} .chatBubble .cbAvatar{
  width:34px; height:34px; border-radius:50%; flex-shrink:0;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:14px;
  box-shadow:0 2px 6px var(--ph-shadow);
}
#${ID} .chatBubble .cbContent{
  padding:10px 14px; border-radius:18px;
  font-size:13.5px; line-height:1.5; word-break:break-word;
}
#${ID} .chatBubble.me .cbContent{
  background:var(--ph-accent-grad);
  color:rgba(255,255,255,.95); border-bottom-right-radius:6px;
  box-shadow:0 2px 8px rgba(99,102,241,.25);
}
#${ID} .chatBubble.them .cbContent{
  background:var(--ph-glass-strong);
  border:1px solid var(--ph-glass-border);
  color:var(--ph-text); border-bottom-left-radius:6px;
}
#${ID} .chatBubble .cbTime{ font-size:10px; color:var(--ph-text-dim); margin-top:4px; text-align:right; }
@keyframes phBubbleIn{
  from{ opacity:0; transform:translateY(8px); }
  to{ opacity:1; transform:translateY(0); }
}
#${ID} .chatTyping{
  align-self:flex-start; padding:10px 16px;
  background:var(--ph-glass); border-radius:18px;
  color:var(--ph-text-dim); font-size:13px;
  display:none; align-items:center; gap:4px;
}
#${ID} .chatTyping.show{ display:flex; }
#${ID} .chatTyping .typDots{ display:flex; gap:3px; }
#${ID} .chatTyping .typDots span{
  width:5px; height:5px; border-radius:50%; background:var(--ph-text-dim);
  animation:typBounce 1.2s ease-in-out infinite;
}
#${ID} .chatTyping .typDots span:nth-child(2){ animation-delay:.15s; }
#${ID} .chatTyping .typDots span:nth-child(3){ animation-delay:.3s; }
@keyframes typBounce{ 0%,60%,100%{ transform:translateY(0); } 30%{ transform:translateY(-4px); } }

#${ID} .chatInputBar{
  padding:8px 12px; display:flex; gap:8px; align-items:flex-end;
  background:rgba(0,0,0,.15);
  backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
  border-top:1px solid rgba(255,255,255,.06);
  flex-shrink:0;
}
#${ID} .chatInputBar .chatExtraBtn{
  appearance:none; border:0; cursor:pointer;
  width:34px; height:34px; border-radius:50%;
  background:var(--ph-glass); color:var(--ph-text-sub); font-size:16px;
  display:flex; align-items:center; justify-content:center;
  transition:background .12s; flex-shrink:0;
}
#${ID} .chatInputBar .chatExtraBtn:hover{ background:var(--ph-glass-strong); }
#${ID} .chatInputBar textarea{
  flex:1; resize:none;
  background:var(--ph-glass); border:1px solid var(--ph-glass-border);
  border-radius:18px; padding:8px 14px;
  color:var(--ph-text); font-size:16px;
  outline:none; min-height:36px; max-height:100px; font-family:inherit; line-height:1.4;
  user-select:text; -webkit-user-select:text;
  touch-action:manipulation; -webkit-touch-callout:default;
}
#${ID} .chatInputBar textarea::placeholder{ color:var(--ph-text-dim); }
#${ID} .chatSendBtn{
  appearance:none; border:0; cursor:pointer;
  width:36px; height:36px; border-radius:50%; flex-shrink:0;
  background:var(--ph-accent-grad);
  color:#fff; font-size:16px; display:flex; align-items:center; justify-content:center;
  transition:transform .1s; box-shadow:0 2px 8px rgba(99,102,241,.3);
}
#${ID} .chatSendBtn:active{ transform:scale(.92); }

/* === WeChat Top Header Bar === */
#${ID} .wxTopBar{
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 14px 8px; background:rgba(246,246,246,72);
  backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
  border-bottom:1px solid rgba(0,0,0,06); flex-shrink:0;
}
#${ID} .wxTopBar .wxTopTitle{
  font-size:17px; font-weight:700; color:rgba(20,24,28,88);
  flex:1; text-align:center;
}
#${ID} .wxTopBar .wxTopRight{
  display:flex; gap:12px; align-items:center;
  min-width:28px; justify-content:flex-end;
}
#${ID} .wxTopBar .wxTopBtn{
  appearance:none; border:0; background:transparent; cursor:pointer;
  width:28px; height:28px; display:flex; align-items:center; justify-content:center;
  color:rgba(20,24,28,65); border-radius:50%; transition:background .12s;
}
#${ID} .wxTopBar .wxTopBtn:hover{ background:rgba(0,0,0,06); }
#${ID} .wxTopBar .wxTopBtn svg.phIco{ width:20px; height:20px; fill:currentColor; }

/* ✅ 只保留“顶部左侧返回箭头”（phAppBar 的 back），页面内第二个 back 全隐藏 */
#${ID} .wxTopBar .wxTopBtn[data-act$="Back"],
#${ID} .wxTopBar .wxTopBtn[data-act="wxCSBack"]{
  display:none !important;
}

/* ✅ 聊天首页右上角“⋯”显示更像微信 */
#${ID} .wxTopDots{
  font-size:22px; line-height:1;
  transform:translateY(-1px);
}

/* === + Button Popup Menu === */
#${ID} .wxPlusPopup{
  position:absolute; right:10px; top:42px; z-index:999;
  min-width:150px; padding:6px 0;
  background:rgba(75,75,75,.96); border-radius:10px;
  box-shadow:0 8px 30px rgba(0,0,0,.35);
  animation:wxPopIn .18s ease-out;
}
@keyframes wxPopIn{ from{opacity:0;transform:scale(.9) translateY(-6px);} to{opacity:1;transform:scale(1) translateY(0);} }
#${ID} .wxPlusPopup .wxPlusItem{
  display:flex; align-items:center; gap:10px;
  padding:11px 16px; cursor:pointer; color:rgba(255,255,255,.92);
  font-size:13.5px; transition:background .1s;
}
#${ID} .wxPlusPopup .wxPlusItem:hover{ background:rgba(255,255,255,.1); }
#${ID} .wxPlusPopup .wxPlusItem svg.phIco{ width:16px; height:16px; fill:currentColor; opacity:.8; }

/* === Swipe Actions on Chat Items === */
/* ✅ 修复：默认不露出“置顶/删除”，只有左滑才显示（避免初始就把按钮露出来） */
#${ID} .chatItemSwipeWrap{
  position:relative; overflow:hidden;
}
/* 默认把按钮藏到右侧（即使布局被外部 CSS 干扰也不会露出来） */
#${ID} .chatItemSwipeWrap .swipeActions{
  position:absolute; right:0; top:0; bottom:0;
  display:flex; z-index:1;
  transform:translateX(120px);
  transition:transform .2s ease;
}
#${ID} .chatItemSwipeWrap .chatItemInner{
  display:flex; align-items:center; gap:12px;
  padding:10px 14px; cursor:pointer;
  transition:transform .2s ease;
  background:rgba(255,255,255,.72);
  position:relative; z-index:2;
  width:100%;
  will-change:transform;
}
#${ID} .chatItemSwipeWrap .chatItemInner.wxChatRow{
  padding:12px 16px; gap:12px; background:rgba(255,255,255,.6);
}
#${ID} .chatItemSwipeWrap.swiped .swipeActions{ transform:translateX(0); }
#${ID} .chatItemSwipeWrap.swiped .chatItemInner{ transform:translateX(-120px); }

#${ID} .chatItemSwipeWrap .swipeBtn{
  width:60px; display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:12px; font-weight:500; cursor:pointer; border:0;
}
#${ID} .chatItemSwipeWrap .swipeBtn.pin{ background:#576b95; }
#${ID} .chatItemSwipeWrap .swipeBtn.del{ background:#ef4444; }
#${ID} .chatItemPinned .chatItemInner{ background:rgba(237,237,237,.85); }

/* === Discover Page (发现) === */
#${ID} .wxDiscoverList{ padding:0; }
#${ID} .wxDiscoverGroup{ margin-top:8px; }
#${ID} .wxDiscoverGroup:first-child{ margin-top:0; }
#${ID} .wxDiscoverItem{
  display:flex; align-items:center; gap:14px;
  padding:13px 16px; cursor:pointer;
  background:rgba(255,255,255,.72);
  border-bottom:1px solid rgba(0,0,0,.04);
  transition:background .1s;
}
#${ID} .wxDiscoverItem:hover{ background:rgba(255,255,255,.85); }
#${ID} .wxDiscoverItem:active{ background:rgba(0,0,0,.04); }
#${ID} .wxDiscoverItem:last-child{ border-bottom:0; }
#${ID} .wxDiscoverItem .wxDIco{
  width:38px; height:38px; border-radius:10px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:18px; color:#fff;
}
#${ID} .wxDiscoverItem .wxDIco svg.phIco{ width:20px; height:20px; fill:currentColor; }
/* ✅ 统一主题化图标底色：联动设置中的图标底色 */
#${ID} .wxDIcoThemed{
  background: var(--ph-icon-tint, #07c160) !important;
}
/* ✅ A: 发现/我 页列表图标使用独立 --ph-list-icon，不受 --ph-icon-inner-tint 联动 */
#${ID} .wxDIcoThemed svg.phIco{
  fill: var(--ph-list-icon, rgba(20,24,28,.72)) !important;
}
#${ID} .wxDiscoverItem .wxDName{ flex:1; font-size:14.5px; color:rgba(20,24,28,.88); font-weight:400; }
#${ID} .wxDiscoverItem .wxDArrow{ color:rgba(0,0,0,.2); font-size:16px; flex-shrink:0; }

/* === Me Page (我的) === */
#${ID} .wxMeProfile{
  display:flex; align-items:center; gap:14px;
  padding:18px 16px; background:rgba(255,255,255,.72);
  cursor:pointer; transition:background .1s;
}
#${ID} .wxMeProfile:hover{ background:rgba(255,255,255,.85); }
#${ID} .wxMeProfile .wxMeAvatar{
  width:58px; height:58px; border-radius:12px; flex-shrink:0;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:28px;
  box-shadow:0 2px 10px rgba(0,0,0,.1);
}
#${ID} .wxMeProfile .wxMeInfo{ flex:1; }
#${ID} .wxMeProfile .wxMeName{ font-size:17px; font-weight:700; color:rgba(20,24,28,.88); }
#${ID} .wxMeProfile .wxMeId{ font-size:12px; color:rgba(20,24,28,.4); margin-top:4px; }
#${ID} .wxMeMenu{ margin-top:8px; }

/* === Contact Groups Accordion (通讯录) === */
#${ID} .wxContactHeader{
  display:flex; align-items:center; gap:14px;
  padding:13px 16px; background:rgba(255,255,255,.72);
  border-bottom:1px solid rgba(0,0,0,.04);
  cursor:pointer; transition:background .1s;
}
#${ID} .wxContactHeader:hover{ background:rgba(255,255,255,.85); }
#${ID} .wxContactHeader .wxCHIco{
  width:38px; height:38px; border-radius:10px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:16px; color:#fff;
}
#${ID} .wxContactHeader .wxCHIco svg.phIco{ width:18px; height:18px; fill:#fff !important; }
#${ID} .wxContactHeader .wxCHName{ flex:1; font-size:14.5px; color:rgba(20,24,28,.88); }
#${ID} .wxContactHeader .wxCHBadge{
  background:rgba(0,0,0,.06); border-radius:10px;
  padding:2px 8px; font-size:11px; color:rgba(20,24,28,.4);
}
#${ID} .wxGroupAccordion{ }
#${ID} .wxGroupHeader{
  display:flex; align-items:center; gap:10px;
  padding:10px 16px; cursor:pointer;
  background:rgba(245,245,245,.85);
  border-bottom:1px solid rgba(0,0,0,.04);
  font-size:13.5px; color:rgba(20,24,28,.55); font-weight:500;
}
#${ID} .wxGroupHeader .wxGArrow{
  transition:transform .2s; font-size:12px; color:rgba(0,0,0,.25);
}
#${ID} .wxGroupHeader.open .wxGArrow{ transform:rotate(90deg); }
#${ID} .wxGroupBody{ display:none; }
#${ID} .wxGroupBody.open{ display:block; }
#${ID} .wxContactItem{
  display:flex; align-items:center; gap:12px;
  padding:10px 16px 10px 30px; cursor:pointer;
  background:rgba(255,255,255,.72);
  border-bottom:1px solid rgba(0,0,0,.03);
  transition:background .1s;
}
#${ID} .wxContactItem:hover{ background:rgba(255,255,255,.88); }
#${ID} .wxContactItem .wxCIAvatar{
  width:38px; height:38px; border-radius:50%; flex-shrink:0;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:15px;
}
#${ID} .wxContactItem .wxCIName{ font-size:14px; color:rgba(20,24,28,.85); }

/* === Confirm Dialog (删除确认) === */
#${ID} .wxConfirmOverlay{
  position:absolute; inset:0; z-index:9999;
  background:rgba(0,0,0,.45);
  display:flex; align-items:center; justify-content:center;
  animation:phFadeIn .15s ease-out;
}
@keyframes phFadeIn{ from{opacity:0;} to{opacity:1;} }
#${ID} .wxConfirmBox{
  background:#fff; border-radius:14px; padding:24px 20px 16px;
  min-width:220px; max-width:300px; width:calc(100% - 40px);
  text-align:center; box-sizing:border-box;
  box-shadow:0 8px 40px rgba(0,0,0,.2);
  overflow:visible;
}
#${ID} .wxConfirmBox .wxCMsg{ font-size:14px; color:rgba(20,24,28,.85); margin-bottom:18px; line-height:1.5; }
#${ID} .wxConfirmBox .wxCBtns{ display:flex; border-top:1px solid rgba(0,0,0,.08); margin:0 -20px -16px; }
#${ID} .wxConfirmBox .wxCBtn{
  flex:1; padding:12px; appearance:none; border:0; background:transparent;
  font-size:14px; cursor:pointer; transition:background .1s;
}
#${ID} .wxConfirmBox .wxCBtn:first-child{ border-right:1px solid rgba(0,0,0,.08); color:rgba(20,24,28,.55); }
#${ID} .wxConfirmBox .wxCBtn:last-child{ color:#ef4444; font-weight:600; }
#${ID} .wxConfirmBox .wxCBtn:hover{ background:rgba(0,0,0,.04); }

/* === WeChat Chat Detail (版面6 微信聊天风) === */
#${ID} .wxChatDetailWrap{
  display:flex; flex-direction:column; height:100%;
  background:rgba(237,237,237,.55);
}
#${ID} .wxChatMsgs{
  flex:1; padding:10px 12px 8px; display:flex; flex-direction:column; gap:10px;
  overflow-y:auto; -webkit-overflow-scrolling:touch;
}
#${ID} .wxChatBubble{
  max-width:72%; display:flex; gap:8px; align-items:flex-start;
  animation:phBubbleIn .2s ease-out;
}
#${ID} .wxChatBubble.me{ flex-direction:row-reverse; align-self:flex-end; }
#${ID} .wxChatBubble.them{ align-self:flex-start; }
#${ID} .wxChatBubble .wxCBAvatar{
  width:36px; height:36px; border-radius:6px; flex-shrink:0;
  background:var(--ph-glass-strong); border:1px solid rgba(0,0,0,.06);
  display:flex; align-items:center; justify-content:center; font-size:15px;
  box-shadow:0 1px 4px rgba(0,0,0,.08);
}
#${ID} .wxChatBubble .wxCBContent{
  padding:9px 12px; border-radius:6px;
  font-size:14px; line-height:1.5; word-break:break-word;
  position:relative;
}
#${ID} .wxChatBubble.me .wxCBContent{
  background:#95ec69; color:rgba(20,24,28,.88);
  border-top-right-radius:2px;
}
#${ID} .wxChatBubble.them .wxCBContent{
  background:#fff; color:rgba(20,24,28,.88);
  border:1px solid rgba(0,0,0,.04);
  border-top-left-radius:2px;
}
#${ID} .wxCBTime{
  font-size:10px; color:rgba(20,24,28,.35); text-align:center;
  padding:6px 0 2px;
}
#${ID} .wxChatInputBar{
  padding:8px 10px; display:flex; gap:6px; align-items:flex-end;
  background:rgba(246,246,246,.95);
  backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
  border-top:1px solid rgba(0,0,0,.06);
  flex-shrink:0;
  touch-action:auto;
}
#${ID} .wxChatInputBar .wxChatExBtn{
  appearance:none; border:0; cursor:pointer;
  width:32px; height:32px; border-radius:50%;
  background:transparent; color:rgba(20,24,28,.5); font-size:18px;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0; transition:color .12s;
}
#${ID} .wxChatInputBar .wxChatExBtn:hover{ color:rgba(20,24,28,.75); }
#${ID} .wxChatInputBar .wxChatExBtn svg.phIco{ width:22px; height:22px; fill:currentColor; }
#${ID} .wxChatInputBar textarea{
  flex:1; resize:none;
  background:#fff; border:1px solid rgba(0,0,0,.1);
  border-radius:6px; padding:7px 10px;
  color:rgba(20,24,28,.88); font-size:16px;
  outline:none; min-height:34px; max-height:96px; font-family:inherit; line-height:1.4;
  user-select:text; -webkit-user-select:text;
  touch-action:manipulation; -webkit-touch-callout:default;
}
#${ID} .wxChatInputBar textarea::placeholder{ color:rgba(20,24,28,.3); }
#${ID} .wxChatSendBtn{
  appearance:none; border:0; cursor:pointer;
  padding:6px 14px; border-radius:6px; flex-shrink:0;
  background:#07c160; color:#fff; font-size:13px; font-weight:600;
  transition:opacity .1s;
}
#${ID} .wxChatSendBtn:active{ opacity:.75; }

/* === 聊天+号菜单格子(版面6 底部扩展) === */
#${ID} .wxChatPlusGrid{
  display:grid; grid-template-columns:repeat(4,1fr); gap:10px;
  padding:14px 16px; background:rgba(246,246,246,.95);
  border-top:1px solid rgba(0,0,0,.04);
}
#${ID} .wxChatPlusGrid .wxCPItem{
  display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer;
}
#${ID} .wxChatPlusGrid .wxCPItem .wxCPIco{
  width:48px; height:48px; border-radius:12px;
  background:#fff; border:1px solid rgba(0,0,0,.06);
  display:flex; align-items:center; justify-content:center;
  font-size:18px; color:rgba(20,24,28,.65);
  transition:background .12s;
}
#${ID} .wxChatPlusGrid .wxCPItem .wxCPIco svg.phIco{ width:22px; height:22px; fill:currentColor; }
#${ID} .wxChatPlusGrid .wxCPItem:hover .wxCPIco{ background:rgba(0,0,0,.04); }
#${ID} .wxChatPlusGrid .wxCPItem .wxCPLabel{ font-size:10.5px; color:rgba(20,24,28,.45); }

/* === 特殊气泡样式 === */
#${ID} .wxCBContent.wxCBSpecial{
  background:rgba(255,255,255,.92)!important;
  border-radius:12px!important;
  border:1px solid rgba(0,0,0,.06)!important;
  overflow:hidden;
}
#${ID} .wxChatBubble.me .wxCBContent.wxCBSpecial{
  background:rgba(149,236,105,.25)!important;
}
/* === Typing 指示器（三个跳动灰点） === */
#${ID} .wxTypingIndicator{ pointer-events:none; }
#${ID} .wxTypingContent{
  display:flex!important; align-items:center; gap:4px;
  padding:10px 14px!important; min-height:auto!important;
  background:rgba(255,255,255,.88)!important;
}
#${ID} .wxTypDot{
  display:inline-block; width:7px; height:7px; border-radius:50%;
  background:rgba(20,24,28,.28);
  animation: wxTypBounce 1.2s ease-in-out infinite;
}
#${ID} .wxTypDot:nth-child(2){ animation-delay:.15s; }
#${ID} .wxTypDot:nth-child(3){ animation-delay:.3s; }
@keyframes wxTypBounce{
  0%,60%,100%{ transform:translateY(0); opacity:.35; }
  30%{ transform:translateY(-5px); opacity:.85; }
}
/* === 气泡长按菜单（横排） === */
#${ID} .wxBubbleMenuMask{
  position:absolute; inset:0; z-index:8888;
}
#${ID} .wxBubbleMenu{
  position:absolute; z-index:8889;
  background:rgba(40,40,40,.94); border-radius:10px;
  padding:6px 4px; display:flex; align-items:stretch;
  box-shadow:0 6px 24px rgba(0,0,0,.32);
  animation:wxBMIn .14s ease-out;
  backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
}
@keyframes wxBMIn{ from{opacity:0;transform:scale(.92);} to{opacity:1;transform:scale(1);} }
#${ID} .wxBMItem{
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:3px; padding:6px 11px; cursor:pointer;
  color:rgba(255,255,255,.92); font-size:11px; white-space:nowrap;
  border-radius:6px; -webkit-tap-highlight-color:transparent;
  min-width:40px;
}
#${ID} .wxBMItem:active{ background:rgba(255,255,255,.12); }
#${ID} .wxBMItem .wxBMIco{ font-size:17px; line-height:1; }
#${ID} .wxBMItem.wxBMDanger{ color:#ff6b6b; }
#${ID} .wxBMSep{
  width:1px; background:rgba(255,255,255,.12);
  margin:4px 0; flex-shrink:0; align-self:stretch;
}
#${ID} .wxBubbleMenu::after{
  content:''; position:absolute; width:10px; height:10px;
  background:rgba(40,40,40,.94); transform:rotate(45deg);
}
#${ID} .wxBubbleMenu.arrowDown::after{ bottom:-4px; left:calc(50% - 5px); }
#${ID} .wxBubbleMenu.arrowUp::after{ top:-4px; left:calc(50% - 5px); }
#${ID} .wxChatBubble.wxBubbleSelected .wxCBContent{
  box-shadow:0 0 0 2px var(--ph-accent,#07c160); border-radius:8px;
}
#${ID} .wxQuoteBar{
  display:flex; align-items:center; gap:8px;
  padding:6px 10px; background:rgba(0,0,0,.04);
  border-top:1px solid rgba(0,0,0,.06); font-size:12px; color:rgba(20,24,28,.55);
}
#${ID} .wxQuoteBar .wxQBText{ flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#${ID} .wxQuoteBar .wxQBClose{
  cursor:pointer; padding:2px 6px; border-radius:4px; font-size:16px; line-height:1;
  color:rgba(20,24,28,.4); -webkit-tap-highlight-color:transparent;
}
#${ID} .wxQuoteBar .wxQBClose:active{ background:rgba(0,0,0,.06); }
/* === 编辑消息弹窗 === */
#${ID} .wxEditMsgOverlay{
  position:absolute; inset:0; z-index:9000;
  background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center;
  padding:20px; animation:wxCPFadeIn .16s ease;
}
#${ID} .wxEditMsgBox{
  background:rgba(255,255,255,.97); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
  border-radius:14px; width:100%; max-width:280px; padding:16px;
  box-shadow:0 8px 32px rgba(0,0,0,.2);
}
#${ID} .wxEditMsgBox .wxEMTitle{
  font-size:14px; font-weight:600; color:rgba(20,24,28,.88); margin-bottom:10px;
}
#${ID} .wxEditMsgBox textarea{
  width:100%; min-height:80px; max-height:160px; resize:vertical;
  border:1px solid rgba(0,0,0,.12); border-radius:8px; padding:8px 10px;
  font-size:13px; line-height:1.5; color:rgba(20,24,28,.88);
  background:#fff; outline:none; font-family:inherit;
  -webkit-appearance:none;
}
#${ID} .wxEditMsgBox textarea:focus{ border-color:#07c160; }
#${ID} .wxEditMsgBox .wxEMBtns{
  display:flex; gap:8px; margin-top:12px; justify-content:flex-end;
}
#${ID} .wxEditMsgBox .wxEMBtn{
  padding:7px 18px; border-radius:8px; font-size:13px; cursor:pointer;
  border:none; -webkit-tap-highlight-color:transparent;
}
#${ID} .wxEditMsgBox .wxEMBtn.cancel{
  background:rgba(0,0,0,.06); color:rgba(20,24,28,.6);
}
#${ID} .wxEditMsgBox .wxEMBtn.ok{
  background:#07c160; color:#fff; font-weight:600;
}
#${ID} .wxEditMsgBox .wxEMBtn:active{ opacity:.75; }
/* === 已编辑标记 + 撤回样式 === */
#${ID} .wxCBEdited{
  display:block; font-size:10px; color:rgba(20,24,28,.32); margin-top:3px;
  font-style:italic;
}
#${ID} .wxChatBubble.me .wxCBEdited{ text-align:right; }
#${ID} .wxChatBubble.them .wxCBEdited{ text-align:left; }
#${ID} .wxCBRecalled{
  font-size:12px; color:rgba(20,24,28,.35); font-style:italic;
  text-align:center; padding:6px 0; width:100%; max-width:100%;
}
#${ID} .wxChatBubble.wxRecalledBubble{
  max-width:100%; justify-content:center; opacity:.7;
}
#${ID} .wxChatBubble.wxRecalledBubble .wxCBAvatar{ display:none; }
/* === 阶段B：翻译译文区域 === */
#${ID} .wxTranslationArea{
  margin-top:4px; padding:6px 10px; border-top:1px dashed rgba(0,0,0,.1);
  font-size:12px; line-height:1.5; color:rgba(20,24,28,.55);
  cursor:pointer; user-select:text; -webkit-user-select:text;
}
#${ID} .wxTranslationArea .wxTransLabel{
  font-size:10px; color:rgba(20,24,28,.35); font-weight:600; margin-bottom:2px;
}
#${ID} .wxTranslationArea .wxTransText{ color:rgba(20,24,28,.7); }
#${ID} .wxTranslationArea.loading .wxTransText{
  color:rgba(20,24,28,.35); font-style:italic;
}
#${ID} .wxTranslateBtn{
  display:inline-block; font-size:10.5px; color:rgba(20,24,28,.4);
  cursor:pointer; padding:2px 0; margin-top:3px;
  -webkit-tap-highlight-color:transparent;
}
#${ID} .wxTranslateBtn:hover{ color:#07c160; }
/* === 阶段B：戳一戳系统消息 === */
#${ID} .wxPokeMsg{
  text-align:center; font-size:11px; color:rgba(20,24,28,.35);
  padding:4px 0; font-style:italic; max-width:100%;
  animation:phBubbleIn .2s ease-out;
}
#${ID} .wxChatBubble.wxPokeBubble{
  max-width:100%; justify-content:center; pointer-events:none;
}
#${ID} .wxChatBubble.wxPokeBubble .wxCBAvatar{ display:none; }
/* === 阶段B：AI引用样式 === */
#${ID} .wxAIQuoteBlock{
  border-left:3px solid rgba(7,193,96,.5);
  padding:4px 8px; margin-bottom:4px;
  background:rgba(7,193,96,.06); border-radius:0 6px 6px 0;
  font-size:11px; color:rgba(20,24,28,.45); line-height:1.4;
}
/* === 阶段B：戳一戳设置页 === */
#${ID} .wxPokeSettingsWrap{ padding:0 0 20px; }
#${ID} .wxPSGroup{
  background:rgba(255,255,255,.85); border-radius:12px;
  margin:12px; overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.04);
}
#${ID} .wxPSRow{
  display:flex; align-items:center; justify-content:space-between;
  padding:13px 14px; border-bottom:1px solid rgba(0,0,0,.04);
  font-size:13px; color:rgba(20,24,28,.88);
}
#${ID} .wxPSRow:last-child{ border-bottom:none; }
#${ID} .wxPSRow .wxPSLabel{ flex:1; }
#${ID} .wxPSRow select{
  padding:4px 8px; border-radius:6px; border:1px solid rgba(0,0,0,.1);
  font-size:12px; background:#fff; color:rgba(20,24,28,.7); outline:none;
}
/* === overlay 弹窗 === */
#${ID} .wxCPOverlay{ animation:wxCPFadeIn .18s ease; }
@keyframes wxCPFadeIn{ from{opacity:0;} to{opacity:1;} }
#${ID} .wxCPModal input:focus{ outline:none; border-color:#07c160!important; }

/* === 表情面板 === */
#${ID} .wxStickerPanel{
  display:none; padding:8px 10px 10px; background:rgba(246,246,246,.95);
  border-top:1px solid rgba(0,0,0,.04); flex-shrink:0;
  max-height:180px; overflow-y:auto; -webkit-overflow-scrolling:touch;
}
#${ID} .wxStickerPanel.show{ display:block; }
#${ID} .wxStickerGrid{
  display:grid; grid-template-columns:repeat(6,1fr); gap:4px;
}
#${ID} .wxStickerGrid .wxStkItem{
  width:100%; aspect-ratio:1; border-radius:8px; border:1px solid rgba(0,0,0,.04);
  background:#fff; display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:22px; transition:background .12s; overflow:hidden;
}
#${ID} .wxStickerGrid .wxStkItem:hover{ background:rgba(0,0,0,.06); }
#${ID} .wxStickerGrid .wxStkItem img{ width:100%; height:100%; object-fit:cover; }
#${ID} .wxStickerTabs{
  display:flex; gap:0; border-bottom:1px solid rgba(0,0,0,.06); margin-bottom:6px;
}
#${ID} .wxStickerTabs .wxStkTab{
  flex:1; padding:6px 0; text-align:center; font-size:11px; color:rgba(20,24,28,.45);
  cursor:pointer; border:0; background:transparent; border-bottom:2px solid transparent;
  transition:color .12s;
}
#${ID} .wxStickerTabs .wxStkTab.on{ color:#07c160; border-bottom-color:#07c160; font-weight:600; }

/* === 语音面板 === */
#${ID} .wxVoicePanel{
  display:none; padding:16px 10px; background:rgba(246,246,246,.95);
  border-top:1px solid rgba(0,0,0,.04); flex-shrink:0; text-align:center;
}
#${ID} .wxVoicePanel.show{ display:block; }
#${ID} .wxVoiceHoldBtn{
  width:100%; padding:12px; border-radius:8px; border:1px solid rgba(0,0,0,.1);
  background:#fff; color:rgba(20,24,28,.7); font-size:14px; font-weight:500;
  cursor:pointer; touch-action:none; user-select:none; transition:background .12s;
}
#${ID} .wxVoiceHoldBtn:active{ background:#e8e8e8; }
#${ID} .wxVoiceHoldBtn.recording{ background:#f44336; color:#fff; border-color:#f44336; }

/* === 角色设置页 === */
#${ID} .wxCharSettingsWrap{ padding:0; }
#${ID} .wxCharSettingsWrap .wxCSGroup{
  margin:10px 0; background:rgba(255,255,255,.92); border-radius:12px; overflow:hidden;
}
#${ID} .wxCharSettingsWrap .wxCSItem{
  display:flex; align-items:center; padding:14px 16px; gap:12px;
  border-bottom:1px solid rgba(0,0,0,.04); cursor:pointer; transition:background .12s;
}
#${ID} .wxCharSettingsWrap .wxCSItem:last-child{ border-bottom:0; }
#${ID} .wxCharSettingsWrap .wxCSItem:hover{ background:rgba(0,0,0,.02); }
#${ID} .wxCharSettingsWrap .wxCSItem .wxCSIco{ font-size:20px; width:28px; text-align:center; flex-shrink:0; }
#${ID} .wxCharSettingsWrap .wxCSItem .wxCSName{ flex:1; font-size:13.5px; color:rgba(20,24,28,.8); }
#${ID} .wxCharSettingsWrap .wxCSItem .wxCSArrow{ color:rgba(20,24,28,.2); font-size:16px; }
#${ID} .wxCharSettingsWrap .wxCSHeader{
  display:flex; align-items:center; gap:14px; padding:20px 16px;
  background:rgba(255,255,255,.92); border-radius:12px; margin:10px 0;
}
#${ID} .wxCharSettingsWrap .wxCSAvatar{
  width:56px; height:56px; border-radius:14px; background:rgba(7,193,96,.12);
  display:flex; align-items:center; justify-content:center; font-size:26px;
  flex-shrink:0; border:1px solid rgba(0,0,0,.06);
}
#${ID} .wxCharSettingsWrap .wxCSInfo{ flex:1; }
#${ID} .wxCharSettingsWrap .wxCSNickname{ font-size:16px; font-weight:700; color:rgba(20,24,28,.88); }
#${ID} .wxCharSettingsWrap .wxCSProfile{ font-size:11.5px; color:rgba(20,24,28,.4); margin-top:3px; line-height:1.4; }

/* === 提醒设置 === */
#${ID} .wxReminderList{ padding:10px 0; }
#${ID} .wxReminderItem{
  display:flex; align-items:center; padding:12px 16px; gap:10px;
  background:rgba(255,255,255,.92); border-radius:12px; margin:6px 10px;
}
#${ID} .wxReminderItem .wxRIco{ font-size:20px; }
#${ID} .wxReminderItem .wxRInfo{ flex:1; }
#${ID} .wxReminderItem .wxRName{ font-size:13px; color:rgba(20,24,28,.8); font-weight:500; }
#${ID} .wxReminderItem .wxRTime{ font-size:11px; color:rgba(20,24,28,.35); margin-top:2px; }
#${ID} .wxReminderItem .wxRDel{
  width:24px; height:24px; border-radius:50%; border:0; background:rgba(244,67,54,.1);
  color:#f44336; cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-size:14px;
}
#${ID} .wxReminderToggle{
  position:relative; width:44px; height:24px; border-radius:12px; cursor:pointer;
  border:0; transition:background .2s; flex-shrink:0;
}
#${ID} .wxReminderToggle.on{ background:#07c160; }
#${ID} .wxReminderToggle.off{ background:#ccc; }
#${ID} .wxReminderToggle::after{
  content:''; position:absolute; top:2px; width:20px; height:20px; border-radius:50%;
  background:#fff; transition:left .2s; box-shadow:0 1px 3px rgba(0,0,0,.2);
}
#${ID} .wxReminderToggle.on::after{ left:22px; }
#${ID} .wxReminderToggle.off::after{ left:2px; }

/* Moments / 朋友圈 */
#${ID} .momentsList{ padding:8px 0; }
#${ID} .momentItem{
  padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.04);
}
#${ID} .momentHead{ display:flex; align-items:center; gap:10px; margin-bottom:8px; }
#${ID} .momentAvatar{
  width:40px; height:40px; border-radius:50%;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:16px;
}
#${ID} .momentName{ font-weight:600; color:var(--ph-text); font-size:13.5px; }
#${ID} .momentTime{ font-size:11px; color:var(--ph-text-dim); margin-left:auto; }
#${ID} .momentContent{ color:var(--ph-text-sub); font-size:13.5px; line-height:1.55; margin-bottom:8px; }
#${ID} .momentImages{
  display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-bottom:8px; border-radius:8px; overflow:hidden;
}
#${ID} .momentImages .mImg{
  width:100%; aspect-ratio:1; background:var(--ph-glass); border-radius:4px;
  display:flex; align-items:center; justify-content:center; font-size:24px; color:var(--ph-text-dim);
}
#${ID} .momentActions{ display:flex; gap:16px; }
#${ID} .momentAction{
  appearance:none; border:0; background:transparent; cursor:pointer;
  color:var(--ph-text-dim); font-size:12px; display:flex; align-items:center; gap:4px;
  transition:color .12s;
}
#${ID} .momentAction:hover{ color:var(--ph-text-sub); }
#${ID} .momentAction.liked{ color:#ef4444; }
#${ID} .momentComments{
  padding:6px 10px; margin:4px 0 0; border-radius:8px;
  background:var(--ph-glass); font-size:12px; line-height:1.6;
}
#${ID} .momentCmt{ color:var(--ph-text-sub); padding:1px 0; }
#${ID} .momentCmtName{ color:var(--ph-text); font-weight:600; }
#${ID} .momentCmtInput{
  display:flex; gap:6px; margin-top:6px; padding:0 4px;
}
/* 头像自定义弹窗 */
#${ID} .phAvatarPopup{
  position:absolute; inset:0; z-index:90;
  background:rgba(0,0,0,.4); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
  display:flex; flex-direction:column; justify-content:center; align-items:center;
}
#${ID} .phAvatarPopupInner{
  background:rgba(30,30,50,.92); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
  border-radius:18px; padding:20px; width:min(260px, 80%);
  border:1px solid rgba(255,255,255,.08);
}

/* ---------- Forum (Weibo-like) ---------- */
#${ID} .forumHeader{
  padding:14px; text-align:center; border-bottom:1px solid rgba(255,255,255,.06);
}
#${ID} .forumStats{ display:flex; justify-content:center; gap:24px; margin-top:8px; }
#${ID} .forumStat{ text-align:center; }
#${ID} .forumStatNum{ font-size:18px; font-weight:700; color:var(--ph-text); }
#${ID} .forumStatLabel{ font-size:11px; color:var(--ph-text-dim); }
#${ID} .forumTabs{ display:flex; border-bottom:1px solid rgba(255,255,255,.06); }
#${ID} .forumTab{
  flex:1; appearance:none; border:0; background:transparent; cursor:pointer;
  padding:10px 0; font-size:12.5px; color:var(--ph-text-sub); font-weight:500; position:relative;
}
#${ID} .forumTab.on{ color:var(--ph-text); }
#${ID} .forumTab.on::after{
  content:''; position:absolute; bottom:0; left:30%; right:30%; height:2px;
  border-radius:1px; background:var(--ph-accent-grad);
}
#${ID} .feedItem{ padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.04); }
#${ID} .feedItem .feedHead{ display:flex; align-items:center; gap:10px; margin-bottom:8px; }
#${ID} .feedItem .feedAvatar{
  width:38px; height:38px; border-radius:50%;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:15px;
}
#${ID} .feedItem .feedAuthor{ font-weight:600; color:var(--ph-text); font-size:13.5px; }
#${ID} .feedItem .feedTime{ font-size:11px; color:var(--ph-text-dim); margin-left:auto; }
#${ID} .feedItem .feedContent{ color:var(--ph-text-sub); font-size:13.5px; line-height:1.55; }
#${ID} .feedItem .feedActions{ display:flex; gap:20px; margin-top:10px; }
#${ID} .feedAction{
  appearance:none; border:0; background:transparent; cursor:pointer;
  color:var(--ph-text-dim); font-size:12px; display:flex; align-items:center; gap:4px;
  transition:color .12s;
}
#${ID} .feedAction:hover{ color:var(--ph-text-sub); }
#${ID} .feedAction.liked{ color:#ef4444; }
#${ID} .feedAction.bookmarked{ color:#f59e0b; }
#${ID} .feedComments{ margin-top:8px; padding:8px 10px; background:var(--ph-glass); border-radius:10px; }
#${ID} .feedCommentItem{ display:flex; gap:6px; padding:4px 0; font-size:12px; line-height:1.4; }
#${ID} .feedCommentItem .fcName{ font-weight:600; color:var(--ph-text); white-space:nowrap; flex-shrink:0; }
#${ID} .feedCommentItem .fcText{ color:var(--ph-text-sub); word-break:break-word; }
#${ID} .feedCommentInput{ display:flex; gap:6px; margin-top:6px; align-items:center; }
#${ID} .feedCommentInput input{ flex:1; padding:6px 10px; border-radius:14px; border:1px solid var(--ph-glass-border); background:var(--ph-glass); color:var(--ph-text); font-size:12px; outline:none; }
#${ID} .feedCommentInput button{ appearance:none; border:0; background:var(--ph-accent-grad); color:#fff; font-size:11px; padding:5px 12px; border-radius:12px; cursor:pointer; white-space:nowrap; flex-shrink:0; }
#${ID} .feedQuoteBlock{ margin-top:8px; padding:8px 10px; background:var(--ph-glass); border-radius:8px; border-left:3px solid rgba(99,102,241,.5); font-size:12px; }
#${ID} .feedQuoteBlock .fqAuthor{ font-weight:600; color:var(--ph-text); margin-bottom:2px; }
#${ID} .feedQuoteBlock .fqContent{ color:var(--ph-text-sub); line-height:1.4; }

/* ---------- Fake Images (pure CSS gradients, zero storage) ---------- */
#${ID} .fake-img-grid{
  display:grid; gap:4px; margin-top:8px; border-radius:8px; overflow:hidden;
}
#${ID} .fake-img-grid[data-count="1"]{ grid-template-columns:1fr; }
#${ID} .fake-img-grid[data-count="2"]{ grid-template-columns:1fr 1fr; }
#${ID} .fake-img-grid[data-count="3"]{ grid-template-columns:1fr 1fr; }
#${ID} .fake-img-grid[data-count="3"] .fake-img:first-child{ grid-column:1/-1; aspect-ratio:2/1; }
#${ID} .fake-img{
  width:100%; aspect-ratio:1; border-radius:6px; position:relative; min-height:60px;
}
#${ID} .fake-img[data-theme="0"]{ background:linear-gradient(135deg,#ffecd2,#fcb69f); }
#${ID} .fake-img[data-theme="1"]{ background:linear-gradient(135deg,#a1c4fd,#c2e9fb); }
#${ID} .fake-img[data-theme="2"]{ background:linear-gradient(135deg,#d4fc79,#96e6a1); }
#${ID} .fake-img[data-theme="3"]{ background:linear-gradient(135deg,#fbc2eb,#a6c1ee); }
#${ID} .fake-img[data-theme="4"]{ background:linear-gradient(135deg,#ffd89b,#19547b); }
#${ID} .fake-img[data-theme="5"]{ background:linear-gradient(135deg,#667eea,#764ba2); }
#${ID} .fake-img[data-theme="6"]{ background:linear-gradient(135deg,#f093fb,#f5576c); }
#${ID} .fake-img[data-theme="7"]{ background:linear-gradient(135deg,#4facfe,#00f2fe); }
#${ID} .fake-img::after{
  content:'🖼'; position:absolute; top:50%; left:50%;
  transform:translate(-50%,-50%); font-size:20px; opacity:.25;
}
#${ID} .forumCompose{
  appearance:none; border:0; cursor:pointer;
  position:fixed; bottom:80px; right:20px;
  width:48px; height:48px; border-radius:50%;
  background:var(--ph-accent-grad); color:#fff; font-size:22px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 4px 16px rgba(99,102,241,.4);
  z-index:10; transition:transform .12s;
}
#${ID} .forumCompose:active{ transform:scale(.9); }

/* ---------- Weather ---------- */
#${ID} .weatherMain{
  text-align:center; padding:24px 16px;
  background:var(--ph-glass);
  margin:12px; border-radius:var(--ph-radius-lg);
  border:1px solid var(--ph-glass-border);
  backdrop-filter:blur(var(--ph-glass-blur)); -webkit-backdrop-filter:blur(var(--ph-glass-blur));
}
#${ID} .weatherIcon{ font-size:56px; margin-bottom:4px; }
#${ID} .weatherTemp{ font-size:48px; font-weight:200; color:var(--ph-text); letter-spacing:-2px; }
#${ID} .weatherDesc{ font-size:14px; color:var(--ph-text-sub); margin-top:2px; }
#${ID} .weatherDetail{ display:flex; justify-content:center; gap:24px; margin-top:14px; }
#${ID} .weatherDetail .wd{ text-align:center; color:var(--ph-text-sub); font-size:11.5px; }
#${ID} .weatherDetail .wd .wdVal{ font-size:15px; font-weight:600; color:var(--ph-text); }
#${ID} .forecastRow{
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 14px; border-bottom:1px solid rgba(255,255,255,.04);
}
#${ID} .forecastRow .fDay{ color:var(--ph-text-sub); width:50px; font-size:13px; }
#${ID} .forecastRow .fIcon{ font-size:20px; width:30px; text-align:center; }
#${ID} .forecastRow .fRange{ display:flex; align-items:center; gap:8px; }
#${ID} .forecastRow .fLow{ color:var(--ph-text-dim); font-size:13px; width:30px; text-align:right; }
#${ID} .forecastRow .fHigh{ color:var(--ph-text); font-size:13px; width:30px; }
#${ID} .forecastRow .fBar{
  width:60px; height:4px; border-radius:2px; background:rgba(255,255,255,.06); position:relative;
}
#${ID} .forecastRow .fBar::after{
  content:''; position:absolute; left:20%; right:20%; top:0; bottom:0; border-radius:2px;
  background:var(--ph-accent-grad);
}

/* ---------- Calendar ---------- */
#${ID} .calGrid{
  display:grid; grid-template-columns:repeat(7,1fr); gap:2px;
  padding:8px 12px; text-align:center;
}
#${ID} .calGrid .calH{ font-size:11px; color:var(--ph-text-dim); font-weight:600; padding:6px 0; }
#${ID} .calGrid .calD{
  padding:8px 0; font-size:13px; color:var(--ph-text-sub);
  border-radius:10px; cursor:pointer; transition:background .1s;
}
#${ID} .calGrid .calD:hover{ background:var(--ph-glass); }
#${ID} .calGrid .calD.today{
  background:var(--ph-accent-grad);
  color:#fff; font-weight:700;
}
#${ID} .calGrid .calD.other{ color:var(--ph-text-dim); }

/* ---------- Settings ---------- */
#${ID} .settingSection{
  padding:6px 0; margin-top:4px;
}
#${ID} .settingSectionTitle{
  padding:4px 16px; font-size:11px; color:var(--ph-text-dim); font-weight:600;
  text-transform:uppercase; letter-spacing:.5px;
}
#${ID} .settingRow{
  display:flex; align-items:center; justify-content:space-between;
  padding:13px 16px; border-bottom:1px solid rgba(255,255,255,.04);
}
#${ID} .settingRow .sIcon{ font-size:18px; margin-right:10px; flex-shrink:0; }
#${ID} .settingRow .sLabel{ color:var(--ph-text); font-size:14px; flex:1; }
#${ID} .settingRow .sValue{ color:var(--ph-text-dim); font-size:13px; }
#${ID} .settingRow .sToggle,
#${ID} .sToggle{
  width:46px; height:26px; border-radius:13px;
  background:var(--ph-glass-strong); border:0; cursor:pointer;
  position:relative; transition:background .2s; flex-shrink:0;
}
#${ID} .settingRow .sToggle.on,
#${ID} .sToggle.on{ background:rgba(99,102,241,.6); }
#${ID} .settingRow .sToggle::after,
#${ID} .sToggle::after{
  content:''; position:absolute; top:3px; left:3px;
  width:20px; height:20px; border-radius:50%; background:#fff;
  transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,.2);
}
#${ID} .settingRow .sToggle.on::after,
#${ID} .sToggle.on::after{ transform:translateX(20px); }

/* Theme cards */
#${ID} .themeGrid{
  display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:8px 14px;
}
#${ID} .themeCard{
  appearance:none; border:2px solid var(--ph-glass-border); cursor:pointer;
  border-radius:var(--ph-radius-md); padding:12px 8px; text-align:center;
  background:var(--ph-glass); transition:all .15s; color:var(--ph-text-sub); font-size:11px;
}
#${ID} .themeCard .tcPreview{
  width:100%; height:40px; border-radius:8px; margin-bottom:6px;
}
#${ID} .themeCard.active{ border-color:var(--ph-accent); box-shadow:0 0 12px rgba(99,102,241,.3); }

/* ---------- Photos ---------- */
#${ID} .photosGrid{
  display:grid; grid-template-columns:repeat(3,1fr); gap:3px; padding:3px;
}
#${ID} .photoThumb{
  aspect-ratio:1; background:var(--ph-glass);
  display:flex; align-items:center; justify-content:center;
  font-size:24px; color:var(--ph-text-dim); cursor:pointer;
  transition:opacity .12s; border-radius:2px; overflow:hidden;
}
#${ID} .photoThumb:active{ opacity:.7; }
#${ID} .photoThumb img{ width:100%; height:100%; object-fit:cover; }
#${ID} .photoTabs{ display:flex; border-bottom:1px solid rgba(255,255,255,.06); }
#${ID} .photoTab{
  flex:1; appearance:none; border:0; background:transparent; cursor:pointer;
  padding:10px 0; font-size:12.5px; color:var(--ph-text-sub); position:relative;
}
#${ID} .photoTab.on{ color:var(--ph-text); font-weight:600; }
#${ID} .photoTab.on::after{
  content:''; position:absolute; bottom:0; left:30%; right:30%; height:2px;
  border-radius:1px; background:var(--ph-accent-grad);
}

/* ---------- Browser ---------- */
#${ID} .browserBar{
  display:flex; align-items:center; gap:8px; padding:8px 12px;
  background:var(--ph-glass); margin:8px 12px; border-radius:var(--ph-radius-md);
  border:1px solid var(--ph-glass-border);
}
#${ID} .browserUrl{
  flex:1; font-size:12.5px; color:var(--ph-text-sub);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
#${ID} .browserBookmarks{
  padding:8px 0;
}
#${ID} .browserBmItem{
  display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer;
  border-bottom:1px solid rgba(255,255,255,.03);
}
#${ID} .browserBmItem:hover{ background:var(--ph-glass); }
#${ID} .browserBmIcon{
  width:36px; height:36px; border-radius:10px;
  background:var(--ph-glass-strong); display:flex; align-items:center; justify-content:center;
  font-size:16px;
}
#${ID} .browserBmTitle{ color:var(--ph-text); font-size:13px; font-weight:500; }
#${ID} .browserBmDesc{ color:var(--ph-text-dim); font-size:11.5px; margin-top:2px; }

/* ---------- Edit mode (iOS jiggle) ---------- */
#${ID} .editShake .pw, #${ID} .editShake .phAppIcon{
  animation:meowShake2 .2s ease-in-out infinite; transform-origin:50% 60%;
  overflow:visible !important;
}
#${ID} .editShake .phGrid, #${ID} .editShake .phPage, #${ID} .editShake .phPages{
  overflow:visible !important;
}
#${ID} .editShake .pw .editDelBtn, #${ID} .editShake .phAppIcon .editDelBtn{
  display:flex;
}
#${ID} .editDelBtn{
  display:none; position:absolute; top:-6px; left:-6px;
  width:22px; height:22px; border-radius:50%;
  background:#ef4444; color:#fff; font-size:12px; font-weight:700;
  align-items:center; justify-content:center; z-index:20;
  box-shadow:0 2px 6px rgba(0,0,0,.3); cursor:pointer;
  border:2px solid rgba(255,255,255,.5);
}
#${ID} .editDoneBtn{
  display:none; position:absolute; top:10px; right:16px;
  appearance:none; border:0; cursor:pointer; z-index:50;
  padding:6px 18px; border-radius:16px;
  background:var(--ph-accent-grad); color:#fff; font-size:13px; font-weight:600;
  box-shadow:0 2px 8px rgba(99,102,241,.3);
}
#${ID} .editShake .editDoneBtn{ display:block; }
#${ID} .editDraggingSrc{ opacity:.18 !important; }
#${ID} .editDragGhost{
  position:fixed; z-index:99999; pointer-events:none;
  margin:0 !important; transform:translate3d(-9999px,-9999px,0) scale(1.02);
  box-shadow:0 14px 36px rgba(0,0,0,.38); opacity:.96;
}
#${ID} .editDropHover{
  outline:2px solid rgba(255,255,255,.65); outline-offset:2px;
  box-shadow:0 0 0 5px rgba(255,255,255,.08);
}
#${ID} .editHintToast{
  position:absolute; left:50%; top:48px; transform:translateX(-50%);
  z-index:60; padding:6px 12px; border-radius:14px;
  background:rgba(8,12,24,.72); color:#fff; font-size:11.5px;
  border:1px solid rgba(255,255,255,.1);
  backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
  opacity:0; transition:opacity .16s ease;
}
#${ID} .editShake .editHintToast, #${ID} .editHintToast.show{ opacity:1; }
@keyframes meowShake2{
  0%{ transform:rotate(-1.8deg); } 50%{ transform:rotate(1.8deg); } 100%{ transform:rotate(-1.8deg); }
}
/* ========== Widget Editor (follows --ph-* theme) ========== */
#${ID} .weWrap{
  display:flex; flex-direction:column; height:100%;

  /* ✅ 编辑面板底色：跟“App 清晰度 → 内容底不透明度”走同一套变量 */
  background:rgba(255,255,255,var(--phAppSolidA,0.92));

  /* ✅ 边界更清晰 */
  border-top:1px solid rgba(0,0,0,.06);
  border-left:1px solid rgba(0,0,0,.04);

  backdrop-filter:blur(var(--phAppBlur,14px));
  -webkit-backdrop-filter:blur(var(--phAppBlur,14px));
}
#${ID} .weBody{ flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:10px 14px 80px; }
#${ID} .weSec{ margin-bottom:16px; }
#${ID} .weSecTitle{
  font-size:11px; color:var(--ph-text-dim); font-weight:700; text-transform:uppercase;
  letter-spacing:.6px; margin-bottom:8px;
}
#${ID} .weTypePicker{
  display:flex; gap:6px; overflow-x:auto; padding-bottom:6px;
  scrollbar-width:none; -webkit-overflow-scrolling:touch;
}
#${ID} .weTypePicker::-webkit-scrollbar{ display:none; }
#${ID} .weTypeOpt{
  appearance:none; border:2px solid var(--ph-glass-border); cursor:pointer;
  border-radius:14px; padding:8px 10px; min-width:58px; text-align:center;
  background:var(--ph-glass); color:var(--ph-text-sub); font-size:10.5px; font-weight:500;
  transition:all .15s; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:3px;
}
#${ID} .weTypeOpt .weTypeIcon{ font-size:0; display:flex; align-items:center; justify-content:center; }
#${ID} .weTypeOpt .weTypeIcon svg.phIco{ width:18px; height:18px; fill:currentColor; }
#${ID} .weTypeOpt.active{
  border-color:var(--ph-accent); color:var(--ph-text);
  background:var(--ph-glass-strong); box-shadow:0 0 0 2px var(--ph-accent);
}
#${ID} .weSizePicker{ display:flex; gap:8px; flex-wrap:wrap; }
#${ID} .weSizeOpt{
  appearance:none; border:2px solid var(--ph-glass-border); cursor:pointer;
  border-radius:12px; padding:8px 14px; font-size:12px; color:var(--ph-text-sub); font-weight:500;
  background:var(--ph-glass); transition:all .15s;
}
#${ID} .weSizeOpt.active{ border-color:var(--ph-accent); color:var(--ph-text); background:var(--ph-glass-strong); }
#${ID} .weShapePicker{ display:flex; gap:8px; margin-top:8px; }
#${ID} .weShapeOpt{
  appearance:none; border:2px solid var(--ph-glass-border); cursor:pointer;
  border-radius:10px; width:48px; height:48px; display:flex; align-items:center; justify-content:center;
  background:var(--ph-glass); transition:all .15s;
}
#${ID} .weShapeOpt .shapeBox{ border:2px solid var(--ph-text-dim); border-radius:4px; }
#${ID} .weShapeOpt.active{ border-color:var(--ph-accent); background:var(--ph-glass-strong); }
#${ID} .weShapeOpt.active .shapeBox{ border-color:var(--ph-text); }
#${ID} .wePresetPicker{ display:flex; gap:8px; margin-top:8px; overflow-x:auto; scrollbar-width:none; }
#${ID} .wePresetPicker::-webkit-scrollbar{ display:none; }
#${ID} .wePresetOpt{
  appearance:none; border:2px solid var(--ph-glass-border); cursor:pointer;
  border-radius:12px; padding:8px 12px; min-width:80px; text-align:center;
  background:var(--ph-glass); color:var(--ph-text-sub); font-size:11px; transition:all .15s; flex-shrink:0;
}
#${ID} .wePresetOpt.active{ border-color:var(--ph-accent); color:var(--ph-text); background:var(--ph-glass-strong); }
#${ID} .weCanvas{
  position:relative; border-radius:var(--ph-radius-md); min-height:100px;
  background:var(--ph-glass-strong);
  border:1px dashed var(--ph-glass-border);
  overflow:hidden; touch-action:none;
}
#${ID} .weEl{
  position:absolute; cursor:grab; user-select:none; -webkit-user-select:none;
  transition:box-shadow .12s;
}
#${ID} .weEl.dragging{ z-index:100; box-shadow:0 6px 20px var(--ph-shadow); cursor:grabbing; }
#${ID} .weEl.selected{ outline:2px solid var(--ph-accent); outline-offset:2px; }
#${ID} .weResizeBar{
  display:none; position:absolute; bottom:-28px; left:50%; transform:translateX(-50%);
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border); border-radius:10px;
  padding:2px 6px; gap:4px; z-index:110; white-space:nowrap;
}
#${ID} .weEl.selected .weResizeBar{ display:flex; }
#${ID} .weResizeBtn{
  appearance:none; border:1px solid var(--ph-glass-border); cursor:pointer;
  width:24px; height:24px; border-radius:6px; background:var(--ph-glass);
  color:var(--ph-text-sub); font-size:12px; display:flex; align-items:center; justify-content:center;
}
#${ID} .weResizeBtn:active{ background:var(--ph-glass-strong); color:var(--ph-text); }
#${ID} .weElBar{ display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
#${ID} .weElBtn{
  appearance:none; border:1px solid var(--ph-glass-border); cursor:pointer;
  border-radius:10px; padding:8px 12px; font-size:12px; color:var(--ph-text-sub); font-weight:500;
  background:var(--ph-glass); display:flex; align-items:center; gap:5px; transition:all .12s;
}
#${ID} .weElBtn:active{ background:var(--ph-glass-strong); transform:scale(.96); }
#${ID} .weSnapBar{ display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
#${ID} .weSnapBtn{
  appearance:none; border:1px solid var(--ph-glass-border); cursor:pointer;
  border-radius:8px; padding:5px 10px; font-size:11px; color:var(--ph-text-dim);
  background:var(--ph-glass); transition:all .12s;
}
#${ID} .weSnapBtn:active{ background:var(--ph-glass-strong); color:var(--ph-text); }
#${ID} .weConfigRow{
  display:flex; align-items:center; justify-content:space-between;
  padding:8px 0; border-bottom:1px solid var(--ph-glass-border);
}
#${ID} .weConfigRow:last-child{ border-bottom:none; }
#${ID} .weConfigLabel{ color:var(--ph-text-sub); font-size:13px; }
#${ID} .weConfigInput{
  appearance:none; border:1px solid var(--ph-glass-border);
  background:var(--ph-glass); color:var(--ph-text); font-size:13px;
  padding:6px 10px; border-radius:10px; width:160px; text-align:right; outline:none;
}
#${ID} .weConfigInput:focus{ border-color:var(--ph-accent); }
#${ID} .weImgCropPicker{ display:flex; gap:8px; margin-top:6px; }
#${ID} .weImgCropOpt{
  appearance:none; border:2px solid var(--ph-glass-border); cursor:pointer;
  border-radius:10px; padding:6px 12px; font-size:11px; color:var(--ph-text-sub);
  background:var(--ph-glass); transition:all .12s;
}
#${ID} .weImgCropOpt.active{ border-color:var(--ph-accent); color:var(--ph-text); }
@keyframes meowSpin{ from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes meowFloat{
  0%,100%{transform:translateY(0);opacity:.3} 50%{transform:translateY(-6px);opacity:.6}
}

/* ---------- Placeholder ---------- */
#${ID} .phPlaceholder{
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  height:60%; color:var(--ph-text-dim); gap:12px;
}
#${ID} .phPlaceholder .phPlIcon{ font-size:40px; opacity:.5; }
#${ID} .phPlaceholder .phPlText{ font-size:14px; }

/* ---------- Resize corner ---------- */
#${ID} .phResize{
  position:absolute; right:0; bottom:0; width:28px; height:28px;
  cursor:nwse-resize; z-index:100; display:none; touch-action:none;
}
#${ID}.mini .phResize{ display:block; }
#${ID} .phResize::after{
  content:''; position:absolute; right:4px; bottom:4px;
  width:10px; height:10px; border-right:2px solid rgba(255,255,255,.2);
  border-bottom:2px solid rgba(255,255,255,.2);
}

/* ---------- Settings Sub-pages ---------- */
#${ID} .settingSubPage{ padding:14px; }
#${ID} .settingSubTitle{ font-weight:600; color:var(--ph-text); font-size:15px; margin-bottom:12px; }
#${ID} .settingSubDesc{ font-size:12px; color:var(--ph-text-dim); margin-bottom:12px; }
#${ID} .sSliderRow{ display:flex; align-items:center; gap:10px; padding:8px 0; }
#${ID} .sSliderRow input[type=range]{
  flex:1; height:4px; -webkit-appearance:none; appearance:none;
  background:var(--ph-glass-strong); border-radius:2px; outline:none;
}
#${ID} .sSliderRow input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none; width:20px; height:20px; border-radius:50%;
  background:var(--ph-accent-grad); cursor:pointer; border:2px solid rgba(255,255,255,.3);
  box-shadow:0 2px 6px rgba(0,0,0,.3);
}
#${ID} .sSliderVal{ min-width:32px; text-align:center; color:var(--ph-text); font-size:14px; font-weight:600; }
#${ID} .sPreviewText{
  padding:12px; background:var(--ph-glass); border-radius:var(--ph-radius-md);
  color:var(--ph-text-sub); line-height:1.6; margin-top:8px; border:1px solid var(--ph-glass-border);
}
#${ID} .sOptionGrid{ display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
#${ID} .sOptionBtn{
  appearance:none; border:2px solid var(--ph-glass-border); cursor:pointer;
  border-radius:var(--ph-radius-md); padding:10px 16px; text-align:center;
  background:var(--ph-glass); color:var(--ph-text-sub); font-size:13px; transition:all .15s; flex:1; min-width:70px;
}
#${ID} .sOptionBtn.active{
  border-color:var(--ph-accent); color:var(--ph-text); background:rgba(99,102,241,.15);
  box-shadow:0 0 8px rgba(99,102,241,.2);
}
#${ID} .sTimeInput{
  appearance:none; background:var(--ph-glass); border:1px solid var(--ph-glass-border);
  border-radius:var(--ph-radius-md); padding:8px 12px; color:var(--ph-text); font-size:14px; margin-top:8px; width:100%;
}
#${ID} .sWpPreview{
  width:100%; height:120px; border-radius:var(--ph-radius-md); overflow:hidden;
  background:var(--ph-glass); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; margin-bottom:10px; position:relative;
}
#${ID} .sWpPreview img{ width:100%; height:100%; object-fit:cover; }
#${ID} .sWpPreview .sWpEmpty{ color:var(--ph-text-dim); font-size:13px; }
#${ID} .sWpBtnRow{ display:flex; gap:8px; }
#${ID} .sWpBtn{
  appearance:none; border:1px solid var(--ph-glass-border); cursor:pointer;
  border-radius:var(--ph-radius-md); padding:8px 14px;
  background:var(--ph-glass); color:var(--ph-text-sub); font-size:13px; flex:1; text-align:center; transition:all .12s;
}
#${ID} .sWpBtn:active{ transform:scale(.96); }

/* ---------- Forum NPC Profile Page ---------- */
#${ID} .npcProfile{ text-align:center; padding:20px 14px 10px; border-bottom:1px solid rgba(255,255,255,.06); position:relative; }
#${ID} .npcProfileAvatar{
  width:64px; height:64px; border-radius:50%; margin:0 auto 8px;
  background:var(--ph-glass-strong); border:2px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:28px; overflow:hidden;
}
#${ID} .npcProfileAvatar img{ width:100%; height:100%; object-fit:cover; }
#${ID} .npcProfileName{ font-weight:700; color:var(--ph-text); font-size:16px; margin-bottom:4px; }
#${ID} .npcProfileBio{ color:var(--ph-text-sub); font-size:12.5px; line-height:1.5; max-height:80px; overflow:auto; padding:0 20px; }
#${ID} .npcProfileStats{ display:flex; justify-content:center; gap:28px; margin-top:12px; }
#${ID} .npcProfileStat{ text-align:center; }
#${ID} .npcProfileStatNum{ font-size:16px; font-weight:700; color:var(--ph-text); }
#${ID} .npcProfileStatLabel{ font-size:11px; color:var(--ph-text-dim); }
#${ID} .npcProfileActions{ display:flex; gap:10px; justify-content:center; margin-top:12px; padding-bottom:4px; }
#${ID} .npcFollowBtn{
  appearance:none; border:0; cursor:pointer; border-radius:16px; padding:7px 22px; font-size:13px; font-weight:600;
  background:var(--ph-accent-grad); color:#fff; box-shadow:0 2px 8px rgba(99,102,241,.3); transition:all .12s;
}
#${ID} .npcFollowBtn.following{
  background:var(--ph-glass-strong); color:var(--ph-text-sub); box-shadow:none; border:1px solid var(--ph-glass-border);
}
#${ID} .npcFollowBtn:active{ transform:scale(.95); }
#${ID} .npcChatBtn{
  appearance:none; border:1px solid var(--ph-glass-border); cursor:pointer;
  border-radius:16px; padding:7px 22px; font-size:13px; background:var(--ph-glass); color:var(--ph-text-sub); transition:all .12s;
}

/* ---------- Forum Compose Modal ---------- */
#${ID} .forumComposeModal{
  position:absolute; inset:0; z-index:80;
  background:rgba(0,0,0,.5); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
  display:flex; flex-direction:column; justify-content:flex-end;
}
#${ID} .forumComposeInner{
  background:rgba(20,20,40,.95); border-radius:16px 16px 0 0; padding:16px; max-height:60%;
}
#${ID} .forumComposeInner textarea{
  width:100%; min-height:100px; appearance:none; resize:vertical;
  background:var(--ph-glass); border:1px solid var(--ph-glass-border);
  border-radius:var(--ph-radius-md); padding:10px; color:var(--ph-text); font-size:13.5px; line-height:1.5;
}
#${ID} .forumComposeBtns{ display:flex; gap:8px; margin-top:10px; justify-content:flex-end; }
#${ID} .forumComposeBtns button{
  appearance:none; border:0; cursor:pointer; border-radius:14px; padding:8px 18px; font-size:13px; font-weight:600; transition:all .12s;
}
#${ID} .forumPostBtn{ background:var(--ph-accent-grad); color:#fff; box-shadow:0 2px 6px rgba(99,102,241,.3); }
#${ID} .forumCancelBtn{ background:var(--ph-glass-strong); color:var(--ph-text-sub); }

/* ---------- Forum Inner Tab Bar（小红书底部导航） ---------- */
#${ID} .forumShell{
  position:absolute; inset:0;
}
#${ID} .forumInnerContent{
  position:absolute; top:0; left:0; right:0; bottom:56px; overflow-y:auto; overflow-x:hidden;
  scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.08) transparent;
}
#${ID} .forumInnerContent::-webkit-scrollbar{ width:4px; }
#${ID} .forumInnerContent::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.08); border-radius:2px; }
#${ID} .forumInnerTabBar{
  position:absolute; bottom:0; left:0; right:0; height:56px;
  display:flex; z-index:20;
  background:rgba(12,18,36,.92);
  border-top:1px solid rgba(255,255,255,.08);
  backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
}
#${ID} .forumInnerTabBtn{
  flex:1; appearance:none; border:0; background:transparent; cursor:pointer;
  padding:7px 0 10px; display:flex; flex-direction:column; align-items:center; gap:2px;
  color:var(--ph-text-dim); font-size:10px; font-weight:500; transition:color .12s;
}
#${ID} .forumInnerTabBtn.on{ color:var(--ph-accent,#6366f1); }
#${ID} .forumInnerTabBtn svg{ width:22px; height:22px; fill:currentColor; }
#${ID} .forumComposeTabIcon{
  width:42px; height:26px; border-radius:7px;
  background:var(--ph-accent-grad,linear-gradient(135deg,#6366f1,#8b5cf6));
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 2px 8px rgba(99,102,241,.4);
}
#${ID} .forumComposeTabIcon svg{ width:16px; height:16px; fill:#fff; }

/* ---------- Forum Grid（双列卡片首页） ---------- */
#${ID} .forumGrid{
  display:grid; grid-template-columns:1fr 1fr; gap:5px; padding:5px;
  box-sizing:border-box; padding-bottom:0;
}
#${ID} .forumGridCard{
  border-radius:10px; overflow:hidden; cursor:pointer;
  background:var(--ph-glass); border:1px solid var(--ph-glass-border);
  transition:transform .1s; display:flex; flex-direction:column;
}
#${ID} .forumGridCard:active{ transform:scale(.97); }
#${ID} .forumGridCardImg{
  width:100%; aspect-ratio:1; position:relative; overflow:hidden;
  background:var(--ph-glass-strong); flex-shrink:0;
}
#${ID} .forumGridCardImg .fake-img{
  border-radius:0; min-height:0; width:100%; height:100%; position:absolute; inset:0;
}
#${ID} .forumGridCardNoImg{
  width:100%; min-height:70px; display:flex; align-items:center; justify-content:center;
  background:var(--ph-glass-strong); font-size:26px;
}
#${ID} .forumGridCardBody{ padding:7px 8px 8px; flex:1; }
#${ID} .forumGridCardTitle{
  font-size:12.5px; color:var(--ph-text); line-height:1.4; font-weight:500;
  overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; margin-bottom:6px;
}
#${ID} .forumGridCardMeta{ display:flex; align-items:center; gap:4px; }
#${ID} .forumGridCardAvatar{
  width:18px; height:18px; border-radius:50%; background:var(--ph-glass-strong);
  border:1px solid var(--ph-glass-border); display:flex; align-items:center;
  justify-content:center; font-size:8px; flex-shrink:0;
}
#${ID} .forumGridCardAuthor{
  font-size:10.5px; color:var(--ph-text-dim); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
#${ID} .forumGridCardLikes{
  font-size:10.5px; color:var(--ph-text-dim); display:flex; align-items:center; gap:2px; flex-shrink:0;
}

/* ---------- Forum Post Detail（帖子详情页） ---------- */
#${ID} .forumDetailPage{ display:flex; flex-direction:column; min-height:100%; }
#${ID} .forumDetailImgArea .fake-img-grid{ margin:0; border-radius:0; }
#${ID} .forumDetailImgArea .fake-img{ border-radius:0; min-height:120px; }
#${ID} .forumDetailImgArea .fake-img-grid[data-count="1"] .fake-img{ aspect-ratio:4/3; }
#${ID} .forumDetailAuthorRow{
  display:flex; align-items:center; gap:10px; padding:12px 14px;
  border-bottom:1px solid rgba(255,255,255,.05);
}
#${ID} .forumDetailAvatar{
  width:40px; height:40px; border-radius:50%; cursor:pointer;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;
}
#${ID} .forumDetailAuthorName{ font-size:14px; font-weight:600; color:var(--ph-text); flex:1; cursor:pointer; }
#${ID} .forumDetailTime{ font-size:11px; color:var(--ph-text-dim); }
#${ID} .forumDetailContent{
  padding:12px 14px; color:var(--ph-text-sub); font-size:14px; line-height:1.65;
  border-bottom:1px solid rgba(255,255,255,.05); white-space:pre-wrap; word-break:break-word;
}
#${ID} .forumDetailTag{
  padding:6px 14px 10px; font-size:12px; color:var(--ph-accent,#6366f1);
  border-bottom:1px solid rgba(255,255,255,.05);
}
#${ID} .forumDetailActions{
  display:flex; border-bottom:1px solid rgba(255,255,255,.05);
}
#${ID} .forumDetailAction{
  flex:1; appearance:none; border:0; background:transparent; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; gap:3px;
  color:var(--ph-text-dim); font-size:11px; padding:10px 4px; transition:color .12s;
}
#${ID} .forumDetailAction.liked{ color:#ef4444; }
#${ID} .forumDetailAction.bookmarked{ color:#f59e0b; }
#${ID} .forumDetailAction svg{ width:20px; height:20px; fill:currentColor; }
#${ID} .forumDetailCmtTitle{
  padding:10px 14px 4px; font-size:13px; font-weight:600; color:var(--ph-text);
  border-bottom:1px solid rgba(255,255,255,.04);
}
#${ID} .forumDetailCmtEmpty{
  padding:20px; text-align:center; color:var(--ph-text-dim); font-size:13px;
}
#${ID} .forumDetailCmtItem{
  display:flex; gap:8px; padding:9px 14px; border-bottom:1px solid rgba(255,255,255,.03);
}
#${ID} .forumDetailCmtAvatar{
  width:30px; height:30px; border-radius:50%; flex-shrink:0;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:12px;
}
#${ID} .forumDetailCmtBody{ flex:1; min-width:0; }
#${ID} .forumDetailCmtName{ font-size:12px; font-weight:600; color:var(--ph-text); margin-bottom:2px; }
#${ID} .forumDetailCmtText{ font-size:12.5px; color:var(--ph-text-sub); line-height:1.4; word-break:break-word; }
#${ID} .forumDetailCmtLike{
  appearance:none; border:0; background:transparent; cursor:pointer;
  color:var(--ph-text-dim); font-size:11px; display:flex; align-items:center; gap:2px;
  align-self:flex-start; margin-top:2px; padding:3px; flex-shrink:0;
}
#${ID} .forumDetailCmtLike.liked{ color:#ef4444; }
#${ID} .forumDetailCommentBar{
  position:sticky; bottom:0; display:flex; gap:8px; align-items:center;
  padding:8px 12px; background:var(--ph-glass-strong);
  border-top:1px solid rgba(255,255,255,.06);
  backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
}
#${ID} .forumDetailCmtInput{
  flex:1; padding:8px 14px; border-radius:18px; border:1px solid var(--ph-glass-border);
  background:var(--ph-glass); color:var(--ph-text); font-size:13px; outline:none;
}
#${ID} .forumDetailCmtSendBtn{
  appearance:none; border:0; background:var(--ph-accent-grad); color:#fff;
  border-radius:14px; padding:7px 14px; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap;
}

/* ---------- Forum Me Page（我的主页） ---------- */
#${ID} .forumMePage{ }
#${ID} .forumMeBanner{
  padding:22px 16px 14px; text-align:center; border-bottom:1px solid rgba(255,255,255,.06);
}
#${ID} .forumMeAvatar{
  width:72px; height:72px; border-radius:50%; margin:0 auto 10px;
  background:var(--ph-glass-strong); border:2px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:30px;
}
#${ID} .forumMeName{ font-size:16px; font-weight:700; color:var(--ph-text); margin-bottom:6px; }
#${ID} .forumMeStats{ display:flex; justify-content:center; gap:32px; margin-top:10px; }
#${ID} .forumMeStat{ text-align:center; cursor:default; }
#${ID} .forumMeStatNum{ font-size:17px; font-weight:700; color:var(--ph-text); }
#${ID} .forumMeStatLabel{ font-size:11px; color:var(--ph-text-dim); margin-top:1px; }
#${ID} .forumMeSubTabs{ display:flex; border-bottom:1px solid rgba(255,255,255,.06); }
#${ID} .forumMeSubTab{
  flex:1; appearance:none; border:0; background:transparent; cursor:pointer;
  padding:10px 0; font-size:12.5px; color:var(--ph-text-sub); font-weight:500; position:relative;
}
#${ID} .forumMeSubTab.on{ color:var(--ph-text); }
#${ID} .forumMeSubTab.on::after{
  content:''; position:absolute; bottom:0; left:25%; right:25%; height:2px;
  border-radius:1px; background:var(--ph-accent-grad);
}

/* ---------- Forum Follow Feed（关注tab单列） ---------- */
#${ID} .forumFollowItem{
  display:flex; gap:10px; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.04); cursor:pointer;
}
#${ID} .forumFollowItem:active{ background:var(--ph-glass); }
#${ID} .forumFollowItemAvatar{
  width:40px; height:40px; border-radius:50%; flex-shrink:0;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:16px;
}
#${ID} .forumFollowItemBody{ flex:1; min-width:0; }
#${ID} .forumFollowItemHead{ display:flex; align-items:center; margin-bottom:4px; }
#${ID} .forumFollowItemName{ font-size:13px; font-weight:600; color:var(--ph-text); flex:1; }
#${ID} .forumFollowItemTime{ font-size:11px; color:var(--ph-text-dim); }
#${ID} .forumFollowItemContent{
  font-size:13px; color:var(--ph-text-sub); line-height:1.4;
  overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;
}
#${ID} .forumFollowItemThumb{ margin-top:6px; }
#${ID} .forumFollowItemThumb .fake-img{ max-height:80px; border-radius:6px; }

/* ---------- Forum Compose Page（发帖页全屏） ---------- */
#${ID} .forumComposePage{ display:flex; flex-direction:column; height:100%; }
#${ID} .forumComposeHeader{
  display:flex; align-items:center; justify-content:space-between; padding:12px 14px;
  border-bottom:1px solid rgba(255,255,255,.06);
}
#${ID} .forumComposeHeaderTitle{ font-size:15px; font-weight:600; color:var(--ph-text); }
#${ID} .forumComposeSubmitBtn{
  appearance:none; border:0; background:var(--ph-accent-grad); color:#fff;
  border-radius:14px; padding:7px 18px; font-size:13px; font-weight:600; cursor:pointer;
}
#${ID} .forumComposeBody{ flex:1; padding:12px 14px; }
#${ID} .forumComposeTitleInput{
  width:100%; appearance:none; border:0; background:transparent; border-bottom:1px solid rgba(255,255,255,.08);
  color:var(--ph-text); font-size:16px; font-weight:600; padding:0 0 10px;
  margin-bottom:12px; outline:none; box-sizing:border-box;
}
#${ID} .forumComposeTitleInput::placeholder{ color:var(--ph-text-dim); font-weight:400; }
#${ID} .forumComposeTextArea{
  width:100%; min-height:120px; appearance:none; resize:none; border:0; background:transparent;
  color:var(--ph-text-sub); font-size:14px; line-height:1.6; outline:none; box-sizing:border-box;
}
#${ID} .forumComposeTextArea::placeholder{ color:var(--ph-text-dim); }
#${ID} .forumComposeImgRow{
  display:flex; gap:8px; padding:8px 14px; flex-wrap:wrap;
  border-top:1px solid rgba(255,255,255,.06);
}
#${ID} .forumComposeImgChip{
  appearance:none; border:1px solid var(--ph-glass-border); background:var(--ph-glass);
  border-radius:20px; padding:5px 12px; font-size:12px; color:var(--ph-text-sub); cursor:pointer;
}
#${ID} .forumComposeImgChip.selected{
  border-color:var(--ph-accent,#6366f1); color:var(--ph-accent,#6366f1);
  background:rgba(99,102,241,.12);
}
#${ID} .forumComposeTagRow{
  display:flex; gap:6px; padding:8px 14px; flex-wrap:wrap;
  border-top:1px solid rgba(255,255,255,.06);
}
#${ID} .forumComposeTagChip{
  appearance:none; border:1px solid var(--ph-glass-border); background:var(--ph-glass);
  border-radius:20px; padding:5px 12px; font-size:12px; color:var(--ph-text-sub); cursor:pointer;
}
#${ID} .forumComposeTagChip.selected{
  border-color:var(--ph-accent,#6366f1); color:var(--ph-accent,#6366f1);
  background:rgba(99,102,241,.12);
}

/* ---------- Forum DM Shell & List ---------- */
#${ID} .forumDMShell{ position:absolute; inset:0; }
#${ID} .forumDMListInner{ position:absolute; top:0; left:0; right:0; bottom:0; overflow-y:auto; }
#${ID} .forumDMListHeader{ display:flex; align-items:center; justify-content:space-between; padding:10px 14px 6px; border-bottom:1px solid rgba(255,255,255,.05); }
#${ID} .forumDMListTitle{ font-size:13px; color:var(--ph-text-dim); }
#${ID} .forumDMItem{ display:flex; gap:10px; padding:11px 14px; border-bottom:1px solid rgba(255,255,255,.04); cursor:pointer; transition:background .1s; position:relative; }
#${ID} .forumDMItem:active{ background:var(--ph-glass); }
#${ID} .forumDMAvatar{ width:44px; height:44px; border-radius:50%; flex-shrink:0; background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border); display:flex; align-items:center; justify-content:center; font-size:18px; position:relative; }
#${ID} .forumDMUnreadDot{ position:absolute; top:0; right:0; width:10px; height:10px; border-radius:50%; background:#ef4444; border:2px solid rgba(12,18,36,.9); }
#${ID} .forumDMItemBody{ flex:1; min-width:0; }
#${ID} .forumDMItemHead{ display:flex; align-items:center; gap:6px; margin-bottom:3px; }
#${ID} .forumDMItemName{ font-size:14px; font-weight:600; color:var(--ph-text); flex:1; }
#${ID} .forumDMItemTime{ font-size:11px; color:var(--ph-text-dim); flex-shrink:0; }
#${ID} .forumDMItemPreview{ font-size:12.5px; color:var(--ph-text-sub); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
/* 私信聊天页 */
#${ID} .forumDMChatShell{ position:absolute; inset:0; display:flex; flex-direction:column; }
#${ID} .forumDMChatMessages{ flex:1; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:8px; scrollbar-width:thin; }
#${ID} .forumDMBubble{ max-width:72%; padding:9px 12px; border-radius:16px; font-size:13.5px; line-height:1.5; word-break:break-word; }
#${ID} .forumDMBubble.mine{ align-self:flex-end; background:var(--ph-accent-grad,linear-gradient(135deg,#6366f1,#8b5cf6)); color:#fff; border-bottom-right-radius:4px; }
#${ID} .forumDMBubble.theirs{ align-self:flex-start; background:var(--ph-glass-strong); color:var(--ph-text); border:1px solid var(--ph-glass-border); border-bottom-left-radius:4px; }
#${ID} .forumDMTheirRow{ display:flex; align-items:flex-end; gap:6px; }
#${ID} .forumDMTheirAvatar{ width:28px; height:28px; border-radius:50%; flex-shrink:0; background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border); display:flex; align-items:center; justify-content:center; font-size:12px; }
#${ID} .forumDMChatBar{ flex-shrink:0; display:flex; align-items:center; gap:8px; padding:8px 12px 10px; border-top:1px solid rgba(255,255,255,.06); background:rgba(12,18,36,.9); }
#${ID} .forumDMChatInput{ flex:1; padding:9px 14px; border-radius:20px; border:1px solid var(--ph-glass-border); background:var(--ph-glass); color:var(--ph-text); font-size:13.5px; outline:none; }
#${ID} .forumDMChatSend{ appearance:none; border:0; background:var(--ph-accent-grad); color:#fff; width:36px; height:36px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
#${ID} .forumDMChatSend svg{ width:18px; height:18px; fill:#fff; }
#${ID} .forumDMEmpty{ padding:70px 20px; text-align:center; color:var(--ph-text-dim); font-size:13px; }

/* ---------- Forum Follow List ---------- */
#${ID} .followListItem{
  display:flex; align-items:center; gap:10px; padding:10px 14px;
  border-bottom:1px solid rgba(255,255,255,.04); cursor:pointer;
}
#${ID} .followListItem:active{ background:var(--ph-glass); }
#${ID} .followListAvatar{
  width:40px; height:40px; border-radius:50%; flex-shrink:0;
  background:var(--ph-glass-strong); border:1px solid var(--ph-glass-border);
  display:flex; align-items:center; justify-content:center; font-size:16px; overflow:hidden;
}
#${ID} .followListAvatar img{ width:100%; height:100%; object-fit:cover; }
#${ID} .followListInfo{ flex:1; min-width:0; }
#${ID} .followListName{ font-weight:600; color:var(--ph-text); font-size:13.5px; }
#${ID} .followListBio{ color:var(--ph-text-dim); font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* ---------- Photo Upload (enhanced) ---------- */
#${ID} .photoUploadBtn{
  appearance:none; border:1px dashed var(--ph-glass-border); cursor:pointer;
  width:100%; padding:14px; border-radius:var(--ph-radius-md); background:var(--ph-glass);
  color:var(--ph-text-sub); font-size:13px; display:flex; align-items:center;
  justify-content:center; gap:6px; margin-bottom:8px; transition:all .12s;
}
#${ID} .photoUploadBtn:active{ transform:scale(.97); background:var(--ph-glass-strong); }
#${ID} .photoThumb.hasImg{ padding:0; }
#${ID} .photoThumb .photoDelBtn{
  position:absolute; top:2px; right:2px;
  width:18px; height:18px; border-radius:50%; background:rgba(239,68,68,.8);
  color:#fff; font-size:10px; display:flex; align-items:center; justify-content:center;
  cursor:pointer; border:0; z-index:5;
}
#${ID} .photoThumb{ position:relative; }

/* ---------- Typing Effect Preview ---------- */
@keyframes meowTypewriter{ from{ width:0; } to{ width:100%; } }
@keyframes meowFadein{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:translateY(0); } }
@keyframes meowGlitch{
  0%{ opacity:0; transform:skewX(-5deg); } 30%{ opacity:.6; transform:skewX(3deg); }
  60%{ opacity:.3; transform:skewX(-2deg); } 100%{ opacity:1; transform:skewX(0); }
}
#${ID} .typingDemo{ margin-top:8px; }
#${ID} .typingDemo.effect-typewriter .typingDemoText{
  overflow:hidden; white-space:nowrap; border-right:2px solid var(--ph-accent);
  animation:meowTypewriter 2s steps(20) infinite;
}
#${ID} .typingDemo.effect-fadein .typingDemoText{ animation:meowFadein .6s ease both; }
#${ID} .typingDemo.effect-glitch .typingDemoText{ animation:meowGlitch .8s ease both; }
        `;
        (doc.head || doc.documentElement).appendChild(st);
      }

      /* ========== DOM ========== */
      function ensureRoot(){
        try{
          const nodes = doc.querySelectorAll('#'+ID);
          if (nodes && nodes.length){
            root = nodes[0];
            for (let i=1;i<nodes.length;i++) try{nodes[i].remove();}catch(e){}
          }
        }catch(e){}

        if (root && doc.documentElement.contains(root)){
          ensureStyle();
          ensureTuneStyle();
          phoneApplyVisualFromSettings();
          return root;
        }

        ensureStyle();
        ensureTuneStyle();
        root = doc.createElement('div');
        root.id = ID;
        root.setAttribute('data-view','home');

        root.innerHTML = buildHTML();

        // ✅ 应用桌面/APP 独立玻璃与壁纸设置
        try{ phoneApplyVisualFromSettings(); }catch(e){}

        // 事件委托
        root.addEventListener('click', handleClick, {passive:false});

        // ✅ 头像长按自定义系统
        (function initAvatarLongPress(){
          let _avTimer = null;
          let _avTarget = null;
          const AVATAR_SEL = '.pwAvatar,.wxMeAvatar,.cAvatar,.cbAvatar,.wxCIAvatar,.wxCBAvatar,.momentAvatar,.feedAvatar,.npcProfileAvatar';

          function getAvatarKey(el){
            // 我的头像（桌面/我的页）
            if (el.classList.contains('pwAvatar') || el.classList.contains('wxMeAvatar')) return 'me';

            // 微信聊天气泡头像：根据气泡 me/them
            if (el.classList.contains('wxCBAvatar')){
              const bubble = el.closest('.wxChatBubble');
              if (bubble && bubble.classList.contains('me')) return 'me';
              const tid = (state && state.chatTarget) ? String(state.chatTarget).trim() : '';
              if (tid) return tid;
            }

            // feedAvatar / momentAvatar / npcProfileAvatar：作者名
            const nameEl = el.parentElement?.querySelector('.momentName,.feedName,.npcProfileName');
            if (nameEl) return (nameEl.textContent||'').trim();

            // 通讯录/会话列表：优先用 data-chatid/data-npcid（稳定）
            const row = el.closest('[data-chatid],[data-npcid]');
            if (row){
              const id = row.getAttribute('data-chatid') || row.getAttribute('data-npcid');
              if (id) return id;
            }

            // 旧聊天气泡（非微信版）
            const chatName = el.closest('.chatBubble')?.querySelector('.cbName');
            if (chatName) return (chatName.textContent||'').trim();

            // fallback: text content
            return (el.textContent||'').trim() || '';
          }

          function showAvatarPicker(el, key){
            if (!key) return;
            // ✅ 3. 换头像修复：统一清理函数，所有路径都走 finally 清理
            _avatarCleanup(); // 先清旧的

            const overlay = doc.createElement('div');
            overlay.className = 'phAvatarOverlay';
            overlay.setAttribute('data-ph-avatar-overlay','1');
            // ✅ 遮罩样式：仅在 phone root 内生效，不动 document.body
            overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;';

            const popup = doc.createElement('div');
            popup.className = 'phAvatarPopup';
            const hasCustom = !!phoneGetAvatar(key);
            popup.innerHTML = `<div class="phAvatarPopupInner">
              <div style="font-weight:600;font-size:13px;color:var(--ph-text);margin-bottom:10px;">自定义头像</div>
              <div style="font-size:11px;color:var(--ph-text-dim);margin-bottom:10px;">${esc(key==='me'?'我的头像':key)}</div>
              <div style="display:flex;gap:8px;">
                <button data-avact="upload" style="flex:1;padding:10px;border-radius:14px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);cursor:pointer;font-size:12px;font-weight:500;">${_phFlatIcon('📷')} 上传图片</button>
                ${hasCustom?('<button data-avact=\"reset\" style="flex:1;padding:10px;border-radius:14px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:#ef4444;cursor:pointer;font-size:12px;font-weight:500;">'+_phFlatIcon('🗑')+' 恢复默认</button>'):''}
              </div>
              <button data-avact="cancel" style="margin-top:10px;width:100%;padding:10px;border-radius:14px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text-dim);cursor:pointer;font-size:12px;">取消</button>
            </div>`;

            overlay.appendChild(popup);

            // ✅ 统一清理函数（所有路径必须走这里）
            function cleanup(){
              try{ overlay.remove(); }catch(e){}
              try{ root.querySelectorAll('[data-ph-avatar-overlay]').forEach(x=>x.remove()); }catch(e){}
              try{ root.querySelectorAll('.phAvatarPopup:not([data-ph-avatar-overlay] .phAvatarPopup)').forEach(x=>x.remove()); }catch(e){}
            }
            // 挂到外层供其它地方调用
            root.__avatarCleanup = cleanup;

            popup.addEventListener('click',(ev)=>{
              ev.stopPropagation();
              const act = ev.target.closest('[data-avact]')?.getAttribute('data-avact');
              if (act === 'cancel'){
                cleanup();
                return;
              }
              if (act === 'upload'){
                try{
                  const inp = doc.createElement('input');
                  inp.type = 'file'; inp.accept = 'image/*';
                  // ✅ 超时保护：如果用户取消文件选择，10s 后自动清理
                  let fileHandled = false;
                  const safetyTimer = setTimeout(()=>{
                    if (!fileHandled){ cleanup(); }
                  }, 15000);

                  inp.onchange = ()=>{
                    fileHandled = true;
                    clearTimeout(safetyTimer);
                    try{
                      const file = inp.files?.[0];
                      if (!file){ cleanup(); return; }
                      if (file.size > 500*1024){
                        try{toast('图片太大，请选择500KB以内的图片');}catch(e){}
                        cleanup();
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = ()=>{
                        try{
                          phoneSetAvatar(key, reader.result);
                          _phApplyCustomAvatars();
                          try{toast('头像已更新');}catch(e){}
                        }catch(e){}
                        cleanup();
                      };
                      reader.onerror = ()=>{
                        try{toast('读取图片失败');}catch(e){}
                        cleanup();
                      };
                      reader.readAsDataURL(file);
                    }catch(e){
                      cleanup();
                    }
                  };
                  // ✅ iOS focus 事件恢复：监听 focus 以检测取消
                  const onFocus = ()=>{
                    setTimeout(()=>{
                      if (!fileHandled && (!inp.files || !inp.files.length)){
                        fileHandled = true;
                        clearTimeout(safetyTimer);
                        cleanup();
                      }
                    }, 500);
                    W.removeEventListener('focus', onFocus);
                  };
                  W.addEventListener('focus', onFocus);
                  inp.click();
                }catch(e){
                  cleanup();
                }
              } else if (act === 'reset'){
                try{
                  phoneSetAvatar(key, '');
                  _phApplyCustomAvatars();
                  try{toast('已恢复默认头像');}catch(e){}
                }catch(e){}
                cleanup();
              }
            });

            // ✅ 点遮罩关闭
            overlay.addEventListener('click',(ev)=>{
              if (ev.target === overlay) cleanup();
            });

            // ✅ 定位：挂在 phone root 内，position relative 容器
            const container = root.querySelector('.phShell') || root;
            try{ container.style.position = 'relative'; }catch(e){}
            container.appendChild(overlay);
          }

          // ✅ 外部可调用的清理函数
          function _avatarCleanup(){
            try{
              if (root.__avatarCleanup) { root.__avatarCleanup(); root.__avatarCleanup = null; }
              root.querySelectorAll('[data-ph-avatar-overlay]').forEach(x=>x.remove());
              root.querySelectorAll('.phAvatarPopup').forEach(x=>x.remove());
            }catch(e){}
          }

          root.addEventListener('pointerdown',(e)=>{
            const av = e.target.closest(AVATAR_SEL);
            if (!av) return;
            _avTarget = av;
            _avTimer = setTimeout(()=>{
              const key = getAvatarKey(av);
              if (key) showAvatarPicker(av, key);
              _avTimer = null;
            }, 600);
          },{passive:true});
          root.addEventListener('pointermove',()=>{
            if (_avTimer){ clearTimeout(_avTimer); _avTimer=null; }
          },{passive:true});
          root.addEventListener('pointerup',()=>{
            if (_avTimer){ clearTimeout(_avTimer); _avTimer=null; }
          },{passive:true});
          root.addEventListener('pointercancel',()=>{
            if (_avTimer){ clearTimeout(_avTimer); _avTimer=null; }
          },{passive:true});
        })();

        // ✅ 应用所有自定义头像到当前 DOM
        function _phApplyCustomAvatars(){
          const avatars = phoneLoadAvatars();
          if (!Object.keys(avatars).length){
            // 可能刚“恢复默认”了：把残留的样式清掉
            try{
              const sel0 = '.pwAvatar,.wxMeAvatar,.cAvatar,.cbAvatar,.wxCIAvatar,.wxCBAvatar,.momentAvatar,.feedAvatar,.npcProfileAvatar';
              root.querySelectorAll(sel0).forEach(el=>{
                if (el && el.style && el.style.backgroundImage){
                  el.style.backgroundImage = '';
                  el.style.backgroundSize = '';
                  el.style.backgroundPosition = '';
                  el.style.color = '';
                  el.style.fontSize = '';
                }
              });
            }catch(e){}
            return;
          }

          const sel = '.pwAvatar,.wxMeAvatar,.cAvatar,.cbAvatar,.wxCIAvatar,.wxCBAvatar,.momentAvatar,.feedAvatar,.npcProfileAvatar';
          root.querySelectorAll(sel).forEach(el=>{
            let key = '';

            // 我的头像：桌面/我的页
            if (el.classList.contains('pwAvatar') || el.classList.contains('wxMeAvatar')) key = 'me';

            // 微信聊天气泡头像：me/them
            else if (el.classList.contains('wxCBAvatar')){
              const bubble = el.closest('.wxChatBubble');
              if (bubble && bubble.classList.contains('me')) key = 'me';
              else key = (state && state.chatTarget) ? String(state.chatTarget).trim() : '';
            }

            else {
              const nameEl = el.parentElement?.querySelector('.momentName,.feedName,.npcProfileName');
              if (nameEl) key = (nameEl.textContent||'').trim();
              if (!key){
                const row = el.closest('[data-chatid],[data-npcid]');
                key = row?.getAttribute('data-chatid') || row?.getAttribute('data-npcid') || '';
              }
              if (!key) key = (el.textContent||'').trim();
            }

            const img = key ? avatars[key] : '';
            if (key && img){
              el.style.backgroundImage = `url("${img}")`;
              el.style.backgroundSize = 'cover';
              el.style.backgroundPosition = 'center';
              el.style.color = 'transparent';
              el.style.fontSize = '0';
            } else {
              // 没有自定义头像：清掉残留
              if (el && el.style && el.style.backgroundImage){
                el.style.backgroundImage = '';
                el.style.backgroundSize = '';
                el.style.backgroundPosition = '';
                el.style.color = '';
                el.style.fontSize = '';
              }
            }
          });
        }
        // 用 MutationObserver 自动应用自定义头像
        {
          let _avDebounce = null;
          const obs = new MutationObserver(()=>{
            if (_avDebounce) clearTimeout(_avDebounce);
            _avDebounce = setTimeout(()=>_phApplyCustomAvatars(), 200);
          });
          obs.observe(root, { childList:true, subtree:true });
          requestAnimationFrame(()=> _phApplyCustomAvatars());
        }

        // 拖拽（mini + pill）
        initDrag();

        // 缩放
        initResize();

        // 全屏背景 / 遮罩点击关闭
        root.addEventListener('mousedown', (e)=>{
          if ((e.target === root || e.target.classList.contains('phBackdrop')) && state.mode === 'full') showPill();
        });

        (doc.body || doc.documentElement).appendChild(root);
        bindPageScroll();
        bindLongPress();
bindEditDrag();
        return root;
      }

function buildHTML(){
        return `
<div class="phPillIcon">📱</div>
<div class="phBackdrop"></div>
<div class="phShell" data-ph="shell">
  <div class="phWallpaper"></div>
  <div class="phDragHint"></div>

  <div class="phStatus" data-drag="handle">
    <div class="phTime" data-ph="time">${timeStr()}</div>
    <div class="phRight">
      <span class="iosSignal" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="iosWifi" aria-hidden="true"><span></span></span>
      <span class="iosBattery" aria-hidden="true">
        <span class="bat"><span class="lv"></span></span>
        <span class="pct">90</span>
      </span>
      <button class="phSysBtn" data-act="pill" title="最小化">●</button>
      <button class="phSysBtn" data-act="close" title="关闭">✕</button>
    </div>
  </div>

  <div class="phStage">
    <div class="phHome">
      <button class="editDoneBtn" data-act="editDone">完成</button>
      <div class="editHintToast">长按图标可拖动换位，轻点可编辑组件</div>
      <div class="phPages">
        <div class="phPagesInner" data-ph="pages">
          <div class="phPage" data-page="0">
            <div class="phGrid">
              <div class="pw pwProfile" style="grid-column:1/span 4;grid-row:1/span 2;" data-item="profile">
                <span class="editDelBtn" data-edit="del">✕</span>
                <div class="pwProfileRow">
                  <div class="pwAvatar">👤</div>
                  <div>
                    <div class="pwName" data-ph="profileName">我的手机</div>
                    <div class="pwTag">${dateStr()}</div>
                  </div>
                </div>
                <div class="pwPreview" data-ph="lastPreview">暂无最新聊天消息</div>
              </div>

              <div class="pw" style="grid-column:1/span 4;grid-row:3/span 2;" data-item="quote">
                <span class="editDelBtn" data-edit="del">✕</span>
                <div class="pwHd">动态 <span class="pwHdSub">今日</span></div>
                <div class="pwBd" data-ph="quoteText">✨ 在这里记录你的心情与故事…</div>
              </div>

              <div class="pw pwMusic" style="grid-column:1/span 2;grid-row:5/span 2;" data-item="music">
                <span class="editDelBtn" data-edit="del">✕</span>
                <div class="pwHd">🎵 音乐</div>
                <div class="pwBd" style="font-size:12px;color:rgba(255,255,255,.5);">暂无播放</div>
                <div class="pwMusicControls">
                  <button class="pwMusicBtn">⏮</button>
                  <button class="pwMusicBtn">▶</button>
                  <button class="pwMusicBtn">⏭</button>
                  <div class="pwMusicBar"></div>
                </div>
              </div>

              <button class="phAppIcon" style="grid-column:3;grid-row:5;" data-app="chats">
                <span class="editDelBtn" data-edit="del">✕</span>
                <div class="ai">${_phAppSVG('chats')}</div><div class="at">聊天</div>
              </button>
              <button class="phAppIcon" style="grid-column:4;grid-row:5;" data-app="calendar">
                <span class="editDelBtn" data-edit="del">✕</span>
                <div class="ai">${_phAppSVG('calendar')}</div><div class="at">日历</div>
              </button>
              <button class="phAppIcon" style="grid-column:3;grid-row:6;" data-app="forum">
                <span class="editDelBtn" data-edit="del">✕</span>
                <div class="ai">${_phAppSVG('forum')}</div><div class="at">论坛</div>
              </button>
              <button class="phAppIcon" style="grid-column:4;grid-row:6;" data-app="weather">
                <span class="editDelBtn" data-edit="del">✕</span>
                <div class="ai">${_phAppSVG('weather')}</div><div class="at">天气</div>
              </button>
            </div>
          </div>

          <div class="phPage" data-page="1">
            <div class="phGrid">
              <div class="pw" style="grid-column:1/span 4;grid-row:1/span 2;">
                <span class="editDelBtn" data-edit="del">✕</span>
                <div class="pwHd">第 2 页</div>
                <div class="pwBd">长按桌面进入编辑模式，可拖动组件到此页。</div>
              </div>
              <button class="phAppIcon" style="grid-column:1;grid-row:3;" data-app="themes">
                <span class="editDelBtn" data-edit="del">✕</span>
                <div class="ai">${_phAppSVG('themes')}</div><div class="at">主题</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="phSearch" data-act="search">🔍 搜索</div>
      <div class="phDots" data-ph="dots">
        <div class="dot on" data-dot="0"></div>
        <div class="dot" data-dot="1"></div>
      </div>

      <div class="phDock">
        <button class="phDockBtn" data-app="sms">
          <div class="di">${_phAppSVG('sms')}</div><div class="dt">短信</div>
          <div class="badge" data-ph="smsBadge">0</div>
        </button>
        <button class="phDockBtn" data-app="browser"><div class="di">${_phAppSVG('browser')}</div><div class="dt">浏览器</div></button>
        <button class="phDockBtn" data-app="photos"><div class="di">${_phAppSVG('photos')}</div><div class="dt">相册</div></button>
        <button class="phDockBtn" data-app="settings"><div class="di">${_phAppSVG('settings')}</div><div class="dt">设置</div></button>
      </div>
    </div>

    <div class="phApp">
      <div class="phAppBar">
        <button class="phNavBtn isBack" data-act="back" aria-label="返回">‹</button>
        <div class="phAppTitle" data-ph="appTitle">App</div>
        <div class="phAppBarSpacer" data-ph="appBarRight"></div>
      </div>
      <div class="phAppBody" data-ph="appBody"></div>
    </div>
  </div>
</div>
<div class="phResize" data-drag="resize"></div>
<div class="phZoomBar">
  <button class="phZoomBtn" data-act="zoomOut">−</button>
  <span class="phZoomLabel" data-ph="zoomLabel">100%</span>
  <button class="phZoomBtn" data-act="zoomIn">+</button>
  <button class="phZoomBtn" data-act="zoomReset" style="font-size:12px;">↺</button>
</div>`;
      }

// 🧲 initDrag：拖拽系统（mini/pill）
// 目标：
//  1) mini 模式可拖动窗口位置
//  2) pill 模式轻点展开回 full（注意：pill 的展开在 onUp 里处理）
//  3) 拖动结束会 savePos()，并吞掉紧随其后的 click，防误触打开 app
      /* ========== 拖拽系统（mini + pill；全平台；防误触；不出屏） ========== */
      function initDrag(){
        let down = false;
        let moved = false;
        let startX = 0, startY = 0;
        let baseLeft = 0, baseTop = 0;

        let lastDragTs = 0;
        let activePointerId = null;
        const usePointer = !!W.PointerEvent;

        function getXY(e){
          if (e.touches && e.touches.length) return { x:e.touches[0].clientX, y:e.touches[0].clientY };
          return { x:e.clientX, y:e.clientY };
        }

        function isInteractive(t){
          return !!(t && t.closest && (
            t.closest('.phSysBtn') ||
            t.closest('.phNavBtn') ||
            t.closest('.phDockBtn') ||
            t.closest('[data-drag="resize"]') ||
            t.closest('input,textarea,select,button,a')
          ));
        }

        function canDrag(e){
          const t = e.target;
          if (!t || !t.closest) return false;

          // pill：整个小圆点都可拖；轻点由 onUp 展开
          if (state.mode === 'pill') return true;

          // full 和 mini 均允许拖动
          if (state.mode !== 'mini' && state.mode !== 'full') return false;

          // 交互控件不允许作为拖拽起点（否则按钮点不开）
          if (isInteractive(t)) return false;

          // 缩放按钮不作为拖拽起点
          if (t.closest('.phZoomBar')) return false;

          // 内容区允许滚动，不作为拖拽起点
          if (t.closest('.phAppBody')) return false;

          // 允许拖拽起点：状态栏 / 拖拽条 / App 顶栏
          if (t.closest('[data-drag="handle"]')) return true;
          if (t.closest('.phDragHint')) return true;
          if (t.closest('.phAppBar')) return true;

          // full 模式：手机壳内大部分区域都可拖（桌面组件、壁纸等）
          // 但排除水平翻页区域和底部 Dock 按钮
          if (state.mode === 'full'){
            if (t.closest('.phPagesInner')) return false;  // 保留左右翻页
            if (t.closest('.phDockBtn')) return false;     // 保留 Dock 点击
            if (t.closest('.phShell')) return true;
          }

          return false;
        }

        function clampXY(x, y){
          const vw = W.innerWidth || doc.documentElement.clientWidth || 400;
          const vh = W.innerHeight || doc.documentElement.clientHeight || 700;
          let rw, rh;
          if (state.mode === 'pill'){
            rw = 56; rh = 56;
          } else {
            const shell = root.querySelector('.phShell');
            const s = state.scale || 1;
            rw = ((shell ? shell.offsetWidth : 375) * s) || 340;
            rh = ((shell ? shell.offsetHeight : 750) * s) || 600;
          }

          // 不允许出屏：整个窗口都要在可视区域内
          const maxX = Math.max(0, vw - rw);
          const maxY = Math.max(0, vh - rh);

          return {
            x: Math.max(0, Math.min(maxX, x)),
            y: Math.max(0, Math.min(maxY, y)),
          };
        }

        function applyXY(x, y){
          const c = clampXY(x, y);
          root.style.left = c.x + 'px';
          root.style.top  = c.y + 'px';
          root.style.right = 'auto';
          root.style.bottom = 'auto';
          state.posX = c.x;
          state.posY = c.y;
        }

        function cleanup(){
          down = false;
          activePointerId = null;

          doc.removeEventListener('pointermove', onMove);
          doc.removeEventListener('pointerup', onUp);
          doc.removeEventListener('pointercancel', onUp);

          doc.removeEventListener('touchmove', onMove);
          doc.removeEventListener('touchend', onUp);
          doc.removeEventListener('touchcancel', onUp);

          doc.removeEventListener('mousemove', onMove);
          doc.removeEventListener('mouseup', onUp);
        }

        function onDown(e){
          if (!canDrag(e)) return;

          try{ e.preventDefault(); }catch(_){}
          try{ e.stopPropagation(); }catch(_){}

          const p = getXY(e);
          startX = p.x; startY = p.y;

          const rect = root.getBoundingClientRect();
          baseLeft = rect.left;
          baseTop  = rect.top;

          moved = false;
          down = true;

          // pointer 优先（避免 touch+pointer 双触发导致“拖不动/抖动”）
          if (usePointer && e.pointerId != null){
            activePointerId = e.pointerId;
            try{ root.setPointerCapture(activePointerId); }catch(_){}
            doc.addEventListener('pointermove', onMove, {passive:false});
            doc.addEventListener('pointerup', onUp, {passive:false});
            doc.addEventListener('pointercancel', onUp, {passive:false});
          }else{
            doc.addEventListener('touchmove', onMove, {passive:false});
            doc.addEventListener('touchend', onUp, {passive:false});
            doc.addEventListener('touchcancel', onUp, {passive:false});
            doc.addEventListener('mousemove', onMove, {passive:false});
            doc.addEventListener('mouseup', onUp, {passive:false});
          }
        }

        function onMove(ev){
          if (!down) return;
          if (activePointerId != null && ev.pointerId != null && ev.pointerId !== activePointerId) return;

          try{ ev.preventDefault(); }catch(_){}

          const p = getXY(ev);
          const dx = p.x - startX;
          const dy = p.y - startY;

          if (!moved && (Math.abs(dx) + Math.abs(dy) < 6)) return;
          moved = true;

          applyXY(baseLeft + dx, baseTop + dy);
        }

        function onUp(ev){
          if (!down) return;

          try{ ev.preventDefault(); }catch(_){}
          cleanup();

          // 拖动结束：保存位置，并吞掉紧随其后的 click（防误触打开页面）
          if (moved){
            lastDragTs = Date.now();
            savePos();
            try{ ev.stopPropagation(); }catch(_){}
            return;
          }

          // pill 轻点展开（你的 click handler 里也说明了 pill 的展开由拖拽系统负责）
          if (state.mode === 'pill'){
            showFull();
          }
        }

        // 吞掉“拖完手松开产生的 click”
        root.addEventListener('click', (e)=>{
          if (lastDragTs && (Date.now() - lastDragTs) < 260){
            e.preventDefault(); e.stopPropagation();
          }
        }, true);

        // 入口绑定：pointer 优先
        if (usePointer){
          root.addEventListener('pointerdown', onDown, {passive:false});
        }else{
          root.addEventListener('touchstart', onDown, {passive:false});
          root.addEventListener('mousedown', onDown, {passive:false});
        }
      }

      /* ========== 缩放系统（mini 右下角） ========== */
// 🔍 initResize：mini 模式右下角缩放（只在 mode === 'mini' 生效）
// 约束：最小 280x400，最大不超过视口比例，避免 iOS 上溢出屏幕
      function initResize(){
        const handle = root.querySelector('[data-drag="resize"]');
        if (!handle) return;

        function getXY(e){
          if (e.touches && e.touches.length) return { x:e.touches[0].clientX, y:e.touches[0].clientY };
          return { x:e.clientX, y:e.clientY };
        }

        function onDown(e){
          if (state.mode !== 'mini') return;
          e.preventDefault(); e.stopPropagation();

          const p = getXY(e);
          const origW = root.offsetWidth;
          const origH = root.offsetHeight;
          const sx = p.x, sy = p.y;

          function onMove(ev){
            try{ ev.preventDefault(); }catch(_){}
            const pp = getXY(ev);
            let nw = origW + (pp.x - sx);
            let nh = origH + (pp.y - sy);
            const vw = W.innerWidth || 800;
            const vh = W.innerHeight || 600;
            nw = Math.max(280, Math.min(vw * 0.85, nw));
            nh = Math.max(400, Math.min(vh * 0.92, nh));
            root.style.width = nw + 'px';
            root.style.height = nh + 'px';
          }
          function onUp(){
            doc.removeEventListener('pointermove', onMove);
            doc.removeEventListener('pointerup', onUp);
            doc.removeEventListener('pointercancel', onUp);
            doc.removeEventListener('touchmove', onMove);
            doc.removeEventListener('touchend', onUp);
            doc.removeEventListener('touchcancel', onUp);
          }
          doc.addEventListener('pointermove', onMove, {passive:false});
          doc.addEventListener('pointerup', onUp);
          doc.addEventListener('pointercancel', onUp);
          doc.addEventListener('touchmove', onMove, {passive:false});
          doc.addEventListener('touchend', onUp);
          doc.addEventListener('touchcancel', onUp);
        }

        handle.addEventListener('pointerdown', onDown, {passive:false});
        handle.addEventListener('touchstart', onDown, {passive:false});
      }

/* ========== 事件处理 ========== */
// 🎛️ handleClick：小手机“统一事件路由”
// data-act：顶部/底部按钮（close/mini/pill/back/search/...）
// data-app：点击 app 图标进入应用
// data-chatid：聊天列表进入会话详情
// data-edit：编辑模式下的删除/编辑入口
      function handleClick(e){
        const t = e.target.closest('[data-act],[data-app],[data-chatid],[data-edit],[data-musicact]');
        if (!t) return;

        // pill 模式点击展开由拖拽系统 onUp 处理，这里避免误触
        if (state.mode === 'pill') return;

        if (t.hasAttribute('data-edit')){
          if (!state.editMode) return;
          const host = t.closest('.pw,.phAppIcon,.phDockBtn');
          const act = t.getAttribute('data-edit');
          if (act === 'del' && host){
            e.preventDefault(); e.stopPropagation();
            try{
              const ok = W.confirm ? W.confirm('删除这个组件/图标？（仅当前桌面布局）') : true;
              if (ok !== false){
                host.remove();
                showEditToast('已删除，点“完成”退出编辑');
              }
            }catch(err){ try{ host.remove(); }catch(_){} }
          }
          return;
        }

        if (t.hasAttribute('data-chatid')){
          e.preventDefault();

          // ✅ 如果当前行正处于左滑展开态：先收起按钮，不直接进聊天（更接近微信交互）
          const sw = t.closest('.chatItemSwipeWrap');
          if (sw && sw.classList.contains('swiped')){
            sw.classList.remove('swiped');
            return;
          }

          openChat(t.getAttribute('data-chatid'));
          return;
        }

        const act = t.getAttribute('data-act');
        if (act){
          e.preventDefault();
          if (act === 'close') { hide(); return; }
          if (act === 'mini')  { showMini(); return; }
          if (act === 'pill')  { showPill(); return; }
          if (act === 'back')  {
            goBack(); return;
          }
          if (act === 'search'){ openApp('search'); return; }
          if (act === 'chatTab'){ switchChatTab(t); return; }
          if (act === 'sendChat'){ sendChatMessage(); return; }
          if (act === 'wxSendChat'){ sendChatMessage(); return; }
if (act === 'exportChat'){ exportChatToMainDraft(); return; }

          // === WeChat 新事件路由 ===
          if (act === 'wxPlusMenu'){ _showPlusMenu(); return; }
          if (act === 'wxAddFriend'){ root.querySelectorAll('.wxPlusPopup').forEach(p=>p.remove()); _openAddFriendDialog(); return; }
          if (act === 'wxCreateGroup'){ root.querySelectorAll('.wxPlusPopup').forEach(p=>p.remove()); _openCreateGroupDialog(); return; }
          if (act === 'wxAddFriendConfirm'){ _confirmAddFriend(); return; }
          if (act === 'wxAddFriendCancel'){ root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove()); return; }
          if (act === 'wxCreateGroupConfirm'){ _confirmCreateGroup(); return; }
          if (act === 'wxCreateGroupCancel'){ root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove()); return; }
          if (act === 'wxPinChat'){ _togglePinChat(t.getAttribute('data-npcid')); return; }
          if (act === 'wxDelChat'){ _confirmDeleteChat(t.getAttribute('data-npcid')); return; }
          if (act === 'wxDelChatOk'){ _doDeleteChat(t.getAttribute('data-npcid')); return; }
          if (act === 'wxDelChatCancel'){ root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove()); return; }
          if (act === 'momentsCoverSet'){ _openMomentsCoverSettings(); return; }
          if (act === 'wxDiscoverNav'){
            state._innerStack.push(() => {
              const c = root.querySelector('[data-ph="chatTabContent"]');
              if (c) renderDiscoverPage(c);
            });
            _renderDiscoverSubPage(t.getAttribute('data-page')); return;
          }
          if (act === 'wxDiscoverBack'){ goBack(); return; }
          // ====== 聊天历史总结相关事件 ======
          if (act === 'wxCHTabSwitch'){
            state._chHistoryTab = t.getAttribute('data-chtab') || 'summary';
            const c = root.querySelector('[data-ph="chatTabContent"]');
            if (c) renderChatHistoryPage(c);
            return;
          }
          if (act === 'wxSumGlobalSettings'){
            state._innerStack.push(() => {
              const c = root.querySelector('[data-ph="chatTabContent"]');
              if (c) renderChatHistoryPage(c);
              setAppBarTitle('聊天历史');
            });
            renderSummarySettingsPage();
            return;
          }
          if (act === 'wxSumSettingsSave'){
            const countInp = root.querySelector('[data-el="gsMsgCount"]');
            const promptInp = root.querySelector('[data-el="gsPrompt"]');
            const modelInp = root.querySelector('[data-el="gsModel"]');
            const gs = {
              defaultMsgCount: Math.max(10, Math.min(200, Number(countInp?.value)||60)),
              defaultPrompt: String(promptInp?.value||'').trim(),
              defaultModel: String(modelInp?.value||'').trim()
            };
            saveGlobalSummarySettings(gs);
            try{toast('设置已保存');}catch(e){}
            return;
          }
          if (act === 'wxCHDetail'){
            const nid = t.getAttribute('data-chnpcid');
            if (!nid) return;
            state._innerStack.push(() => {
              const c = root.querySelector('[data-ph="chatTabContent"]');
              if (c) renderChatHistoryPage(c);
              setAppBarTitle('聊天历史');
            });
            renderChatHistoryDetailPage(nid);
            return;
          }
          if (act === 'wxCHDetailCopy'){
            const nid = t.getAttribute('data-chnpcid');
            const sumData = getChatSummary(nid);
            const txt = sumData ? sumData.summaryText : '';
            if (!txt){ try{toast('暂无总结内容');}catch(e){} return; }
            try{
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
              else { const ta=doc.createElement('textarea'); ta.value=txt; doc.body.appendChild(ta); ta.select(); doc.execCommand('copy'); ta.remove(); }
              try{toast('已复制到剪贴板');}catch(e){}
            }catch(e){ try{toast('复制失败');}catch(_){} }
            return;
          }
          if (act === 'wxCHDetailRegen'){
            const nid = t.getAttribute('data-chnpcid');
            if (!nid) return;
            // 弹确认
            root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
            const overlay = doc.createElement('div');
            overlay.className = 'wxConfirmOverlay';
            overlay.innerHTML = `<div class="wxConfirmBox">
              <div class="wxCMsg">重新生成将覆盖当前总结，确定吗？</div>
              <div class="wxCBtns">
                <button class="wxCBtn" data-act="wxCHRegenCancel">取消</button>
                <button class="wxCBtn" data-act="wxCHRegenOk" data-chnpcid="${esc(nid)}" style="color:#07c160;font-weight:600;">确定</button>
              </div>
            </div>`;
            root.appendChild(overlay);
            return;
          }
          if (act === 'wxCHRegenCancel'){
            root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
            return;
          }
          if (act === 'wxCHRegenOk'){
            root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
            const nid = t.getAttribute('data-chnpcid');
            if (!nid) return;
            // 执行重新生成
            (async ()=>{
              try{
                try{toast('正在重新生成...');}catch(e){}
                const gs = getGlobalSummarySettings();
                const msgCount = gs.defaultMsgCount || 60;
                const log = getLog(nid);
                const tail = log.slice(Math.max(0, log.length - msgCount));
                if (!tail.length){ try{toast('暂无聊天记录');}catch(e){} return; }
                const db = loadContactsDB();
                const npc = findContactById(db, nid) || { id:nid, name:String(nid) };
                const existing = getChatSummary(nid) || {};
                const msgs = [];
                for (let i=0; i<tail.length; i++){
                  const x = tail[i];
                  msgs.push({ role:(x.role==='me')?'user':'assistant', content:String(x.text||''), name:(x.role==='me')?undefined:npc.name });
                }
                const result = await PhoneAI.summarizeChat({ messages:msgs, customPrompt:existing.customPrompt||'' });
                if (result.ok && result.data){
                  const cfg = PhoneAI._getConfig();
                  saveChatSummary(nid, {
                    summaryText: result.data, updatedAt: Date.now(), model: cfg.model||'unknown',
                    sourceMsgCount: tail.length, customPrompt: existing.customPrompt||'', autoSummarize: existing.autoSummarize||false
                  });
                  try{toast('总结已更新');}catch(e){}
                  renderChatHistoryDetailPage(nid);
                } else {
                  try{toast(result.error||'生成失败');}catch(e){}
                }
              }catch(e){ try{toast('生成异常');}catch(_){} }
            })();
            return;
          }
          if (act === 'wxCHDetailClear'){
            const nid = t.getAttribute('data-chnpcid');
            if (!nid) return;
            root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
            const overlay = doc.createElement('div');
            overlay.className = 'wxConfirmOverlay';
            overlay.innerHTML = `<div class="wxConfirmBox">
              <div class="wxCMsg">确定清空此角色的总结数据吗？<br><span style="font-size:12px;color:rgba(20,24,28,.4);">此操作不可恢复</span></div>
              <div class="wxCBtns">
                <button class="wxCBtn" data-act="wxCHClearCancel">取消</button>
                <button class="wxCBtn" data-act="wxCHClearOk" data-chnpcid="${esc(nid)}" style="color:#ef4444;">确定清空</button>
              </div>
            </div>`;
            root.appendChild(overlay);
            return;
          }
          if (act === 'wxCHClearCancel'){
            root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
            return;
          }
          if (act === 'wxCHClearOk'){
            const nid = t.getAttribute('data-chnpcid');
            root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
            if (nid){
              const store = getSummaryStore();
              if (store.byChat && store.byChat[nid]) delete store.byChat[nid];
              saveSummaryStore(store);
              try{toast('已清空');}catch(e){}
              renderChatHistoryDetailPage(nid);
            }
            return;
          }
          if (act === 'wxMeNav'){
            state._innerStack.push(() => {
              const c = root.querySelector('[data-ph="chatTabContent"]');
              if (c) renderMePage(c);
            });
            _renderMeSubPage(t.getAttribute('data-page')); return;
          }
          if (act === 'wxMeBack'){ goBack(); return; }
          if (act === 'wxChatPlusToggle'){
            const grid = root.querySelector('[data-ph="chatPlusGrid"]');
            const vp = root.querySelector('[data-ph="voicePanel"]');
            const sp = root.querySelector('[data-ph="stickerPanel"]');
            if (vp) vp.classList.remove('show');
            if (sp) sp.classList.remove('show');
            if (grid) grid.style.display = grid.style.display==='none' ? 'grid' : 'none';
            return;
          }
          // === 语音面板 ===
          if (act === 'wxVoiceToggle'){ _chatDetail_toggleVoice(); return; }
          // === 表情面板 ===
          if (act === 'wxStickerToggle'){ _chatDetail_toggleSticker(); return; }
          if (act === 'wxStkTab'){ _chatDetail_switchStkTab(t.getAttribute('data-stktab')); return; }
          if (act === 'wxStickerSend'){ _chatDetail_sendSticker(t); return; }

          // === 气泡长按菜单动作 ===
          if (act === 'wxBMCopy'){
            _hideBubbleMenu();
            var bmText = t.getAttribute('data-bmtext') || '';
            try{
              if (navigator.clipboard && navigator.clipboard.writeText){
                navigator.clipboard.writeText(bmText).then(function(){ try{toast('已复制');}catch(e){} }).catch(function(){ _fallbackCopy(bmText); });
              } else { _fallbackCopy(bmText); }
            }catch(e){ _fallbackCopy(bmText); }
            return;
          }
          if (act === 'wxBMQuote'){
            _hideBubbleMenu();
            var qText = t.getAttribute('data-bmtext') || '';
            var qRole = t.getAttribute('data-bmrole') || '';
            _showQuoteBar(qText, qRole);
            return;
          }
          if (act === 'wxBMFav'){
            _hideBubbleMenu();
            var favText = t.getAttribute('data-bmtext') || '';
            var favRole = t.getAttribute('data-bmrole') || '';
            var favTs = t.getAttribute('data-bmts') || '0';
            _bubbleFav(favText, favRole, favTs);
            return;
          }
          if (act === 'wxBMRecall'){
            _hideBubbleMenu();
            var rcTs = t.getAttribute('data-bmts') || '0';
            var rcNpc = state.chatTarget;
            if (rcNpc) _bubbleRecall(rcNpc, rcTs);
            return;
          }
          if (act === 'wxBMEdit'){
            _hideBubbleMenu();
            var editTs = t.getAttribute('data-bmts') || '0';
            var editText = t.getAttribute('data-bmtext') || '';
            var editRole = t.getAttribute('data-bmrole') || '';
            var editNpc = state.chatTarget;
            if (editNpc) _bubbleEdit(editNpc, editTs, editText, editRole);
            return;
          }
          if (act === 'wxBMResend'){
            _hideBubbleMenu();
            var rsTs = t.getAttribute('data-bmts') || '0';
            var rsText = t.getAttribute('data-bmtext') || '';
            var rsNpc = state.chatTarget;
            if (rsNpc) _bubbleResend(rsNpc, rsTs, rsText);
            return;
          }
          if (act === 'wxBMDelete'){
            _hideBubbleMenu();
            var delTs = t.getAttribute('data-bmts') || '0';
            var npcId = state.chatTarget;
            if (!npcId) return;
            if (_deleteLogByTs(npcId, delTs)){
              _refreshChatUI(npcId);
              try{toast('已删除');}catch(e){}
            }
            return;
          }
          if (act === 'wxBMRegen'){
            _hideBubbleMenu();
            var regenTs = t.getAttribute('data-bmts') || '0';
            var regenNpc = state.chatTarget;
            if (regenNpc) _bubbleRegen(regenNpc, regenTs);
            return;
          }
          // === 阶段B：翻译菜单动作 ===
          if (act === 'wxBMTranslate'){
            _hideBubbleMenu();
            var transTs = t.getAttribute('data-bmts') || '0';
            var transText = t.getAttribute('data-bmtext') || '';
            _bubbleTranslate(transTs, transText);
            return;
          }
          // === 阶段B：点击翻译区域切换显示 ===
          if (act === 'wxTransToggle'){
            var area = t.closest('.wxTranslationArea');
            if (area) area.style.display = 'none';
            return;
          }
          if (act === 'wxQuoteClose'){
            _hideQuoteBar();
            return;
          }
          // === 编辑消息弹窗按钮 ===
          if (act === 'wxEMCancel'){
            root.querySelectorAll('.wxEditMsgOverlay').forEach(function(o){ o.remove(); });
            return;
          }
          if (act === 'wxEMOk'){
            var overlay = t.closest('.wxEditMsgOverlay');
            if (!overlay) return;
            var ta = overlay.querySelector('[data-el="emTextarea"]');
            var newText = ta ? String(ta.value||'').trim() : '';
            if (!newText){ try{toast('消息不能为空');}catch(e){} return; }
            var cb = overlay._onConfirm;
            overlay.remove();
            if (typeof cb === 'function') cb(newText);
            return;
          }
          if (act === 'wxEMOkConfirm'){
            var overlay2 = t.closest('.wxEditMsgOverlay');
            if (!overlay2) return;
            var cb2 = overlay2._onConfirm;
            overlay2.remove();
            if (typeof cb2 === 'function') cb2();
            return;
          }
          // === 角色设置入口 ===
          if (act === 'wxCharSettings'){
            const _csNid = t.getAttribute('data-npcid')||state.chatTarget;
            state._innerStack.push(() => { state.chatTarget = _csNid; renderChatDetail(_csNid); });
            _renderCharSettingsPage(_csNid); return;
          }
          if (act === 'wxCSNav'){
            const cspage = t.getAttribute('data-cspage');
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            if (cspage === 'autoSummary') { return; } // toggle only, no separate page
            state._innerStack.push(() => _renderCharSettingsPage(nid));
            if (cspage === 'charProfile') _renderCharProfileEdit(nid);
            else if (cspage === 'chatBg') _renderChatBgSettings(nid);
            else if (cspage === 'reminders') _renderRemindersPage(nid);
            else if (cspage === 'pokeSettings') _renderPokeSettingsPage(nid);
            return;
          }
          if (act === 'wxCSBack'){
            goBack(); return;
          }
          // === 阶段B：戳一戳设置动作 ===
          if (act === 'wxPSToggle'){
            var psKey = t.getAttribute('data-pskey');
            var psNid = t.getAttribute('data-npcid') || state.chatTarget;
            if (psKey && psNid){
              var ps = _loadPokeSettings(psNid);
              ps[psKey] = !ps[psKey];
              _savePokeSettings(psNid, ps);
              t.classList.toggle('on', !!ps[psKey]);
              t.classList.toggle('off', !ps[psKey]);
              try{ toast(ps[psKey] ? '已开启' : '已关闭'); }catch(e){}
            }
            return;
          }
          if (act === 'wxCSToggleAutoSum'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const ce = _loadCharExtra(nid);
            ce.autoSummary = !ce.autoSummary;
            _saveCharExtra(nid, ce);
            const btn = t; btn.classList.toggle('on', ce.autoSummary); btn.classList.toggle('off', !ce.autoSummary);
            // 同步写入总结 store
            const existing = getChatSummary(nid) || {};
            existing.autoSummarize = ce.autoSummary;
            saveChatSummary(nid, existing);
            try{toast(ce.autoSummary?'聊天自动总结已开启':'聊天自动总结已关闭');}catch(e){}
            return;
          }
          if (act === 'wxCSSumExpand'){
            const area = root.querySelector('[data-el="sumExpandArea"]');
            const arrow = root.querySelector('[data-el="sumExpandArrow"]');
            if (area){
              const show = area.style.display === 'none';
              area.style.display = show ? 'block' : 'none';
              if (arrow) arrow.style.transform = show ? 'rotate(180deg)' : '';
            }
            return;
          }
          if (act === 'wxCSGenSummary'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const btn = t;
            if (btn.disabled) return;
            btn.disabled = true; btn.textContent = '生成中...'; btn.style.opacity = '0.6';

            (async ()=>{
              try{
                // 读取全局设置
                const gs = getGlobalSummarySettings();
                const msgCount = gs.defaultMsgCount || 60;

                // 获取消息
                const log = getLog(nid);
                const tail = log.slice(Math.max(0, log.length - msgCount));
                if (!tail.length){ try{toast('暂无聊天记录');}catch(e){} return; }

                // 构建消息格式
                const db = loadContactsDB();
                const npc = findContactById(db, nid) || { id:nid, name:String(nid) };
                const msgs = [];
                for (let i=0; i<tail.length; i++){
                  const x = tail[i];
                  const role = (x.role === 'me') ? 'user' : 'assistant';
                  const name = (x.role === 'me') ? undefined : npc.name;
                  msgs.push({ role:role, content: String(x.text||''), name:name });
                }

                // 读取自定义提示词
                const promptInp = root.querySelector('[data-el="sumCustomPrompt"]');
                const customPrompt = promptInp ? String(promptInp.value||'').trim() : '';

                // 保存自定义提示词
                const existing = getChatSummary(nid) || {};
                existing.customPrompt = customPrompt;
                saveChatSummary(nid, existing);

                // 调用 AI
                const result = await PhoneAI.summarizeChat({ messages:msgs, customPrompt:customPrompt });

                if (result.ok && result.data){
                  const cfg = PhoneAI._getConfig();
                  const sumData = {
                    summaryText: result.data,
                    updatedAt: Date.now(),
                    model: cfg.model || 'unknown',
                    sourceMsgCount: tail.length,
                    customPrompt: customPrompt,
                    autoSummarize: existing.autoSummarize || false
                  };
                  saveChatSummary(nid, sumData);

                  // 刷新显示
                  const preview = root.querySelector('[data-el="sumPreview"]');
                  if (preview) preview.textContent = result.data;
                  try{toast('总结生成成功');}catch(e){}

                  // 重新渲染设置页以更新时间戳和复制按钮
                  _renderCharSettingsPage(nid);
                  // 自动展开总结区
                  setTimeout(()=>{
                    try{
                      const area2 = root.querySelector('[data-el="sumExpandArea"]');
                      const arrow2 = root.querySelector('[data-el="sumExpandArrow"]');
                      if (area2){ area2.style.display = 'block'; }
                      if (arrow2){ arrow2.style.transform = 'rotate(180deg)'; }
                    }catch(e){}
                  }, 50);
                } else {
                  try{toast(result.error || '总结生成失败');}catch(e){}
                }
              }catch(e){
                try{toast('生成异常：'+(e.message||'未知错误'));}catch(_){}
              }finally{
                btn.disabled = false; btn.textContent = '立即生成总结'; btn.style.opacity = '1';
              }
            })();
            return;
          }
          if (act === 'wxCSCopySummary'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const sumData = getChatSummary(nid);
            const txt = sumData ? sumData.summaryText : '';
            if (!txt){ try{toast('暂无总结内容');}catch(e){} return; }
            try{
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
              else { const ta=doc.createElement('textarea'); ta.value=txt; doc.body.appendChild(ta); ta.select(); doc.execCommand('copy'); ta.remove(); }
              try{toast('已复制到剪贴板');}catch(e){}
            }catch(e){ try{toast('复制失败');}catch(_){} }
            return;
          }
          if (act === 'wxCSSaveProfile'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const nameInp = root.querySelector('[data-el="csName"]');
            const profInp = root.querySelector('[data-el="csProfile"]');
            if (nameInp && profInp){
              const db = loadContactsDB();
              const npc = findContactById(db, nid);
              if (npc){ npc.name = String(nameInp.value||'').trim() || npc.name; npc.profile = String(profInp.value||'').trim(); saveContactsDB(db); }
              const ce = _loadCharExtra(nid);
              ce.profile = String(profInp.value||'').trim();
              _saveCharExtra(nid, ce);
              try{toast('已保存');}catch(e){}
            }
            goBack(); return;
          }
          if (act === 'wxCSUploadBg'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const fi = doc.createElement('input'); fi.type='file'; fi.accept='image/*'; fi.style.display='none';
            fi.addEventListener('change', ()=>{
              const f = fi.files && fi.files[0]; if(!f) return;
              const reader = new FileReader();
              reader.onload = ()=>{
                const ce = _loadCharExtra(nid); ce.chatBg = reader.result; _saveCharExtra(nid, ce);
                try{toast('背景已设置');}catch(e){}
                _renderChatBgSettings(nid);
              };
              reader.readAsDataURL(f);
            });
            doc.body.appendChild(fi); fi.click();
            setTimeout(()=>{ try{fi.remove();}catch(e){} }, 60000);
            return;
          }
          if (act === 'wxCSPickBgAlbum'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const photos = phoneLoadPhotos();
            const wps = _safeArr(photos.wallpaper);
            if (!wps.length){ try{toast('壁纸相册为空，请先上传壁纸');}catch(e){} return; }
            // 弹出选取
            let pickHtml = `<div style="font-size:14px;font-weight:600;margin-bottom:10px;">选择壁纸</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:200px;overflow-y:auto;">`;
            wps.forEach((src,i)=>{ pickHtml += `<div data-act="wxCSPickBgItem" data-npcid="${esc(nid)}" data-bgidx="${i}" style="cursor:pointer;border-radius:8px;overflow:hidden;aspect-ratio:3/4;"><img src="${esc(src)}" style="width:100%;height:100%;object-fit:cover;"/></div>`; });
            pickHtml += `</div>`;
            _cpShowOverlay(pickHtml);
            return;
          }
          if (act === 'wxCSPickBgItem'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const idx = parseInt(t.getAttribute('data-bgidx'));
            const photos = phoneLoadPhotos();
            const src = _safeArr(photos.wallpaper)[idx];
            if (src){
              const ce = _loadCharExtra(nid); ce.chatBg = src; _saveCharExtra(nid, ce);
              try{toast('背景已设置');}catch(e){}
            }
            root.querySelectorAll('.wxCPOverlay').forEach(o=>o.remove());
            _renderChatBgSettings(nid);
            return;
          }
          if (act === 'wxCSClearBg'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const ce = _loadCharExtra(nid); ce.chatBg = ''; _saveCharExtra(nid, ce);
            try{toast('背景已移除');}catch(e){}
            _renderChatBgSettings(nid);
            return;
          }
          // === 提醒系统事件 ===
          if (act === 'wxReminderQuickAdd'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const rname = t.getAttribute('data-rname') || '提醒';
            const rtime = t.getAttribute('data-rtime') || '--';
            const rico = t.getAttribute('data-rico') || '⏰';
            if (rname === '自定义提醒'){ _wxReminderCustomAdd(nid); return; }
            const list = _loadReminders(nid);
            list.push({ ico:rico, name:rname, time:rtime, enabled:true });
            _saveReminders(nid, list);
            try{toast(`已添加「${rname}」`);}catch(e){}
            _renderRemindersPage(nid);
            return;
          }
          if (act === 'wxReminderAdd'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            _wxReminderCustomAdd(nid);
            return;
          }
          if (act === 'wxReminderDel'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const idx = parseInt(t.getAttribute('data-ridx'));
            const list = _loadReminders(nid);
            if (!isNaN(idx) && idx >= 0 && idx < list.length){ list.splice(idx, 1); _saveReminders(nid, list); }
            _renderRemindersPage(nid);
            return;
          }
          if (act === 'wxReminderToggleItem'){
            const nid = t.getAttribute('data-npcid') || state.chatTarget;
            const idx = parseInt(t.getAttribute('data-ridx'));
            const list = _loadReminders(nid);
            if (!isNaN(idx) && list[idx]){ list[idx].enabled = !list[idx].enabled; _saveReminders(nid, list); }
            t.classList.toggle('on', list[idx]?.enabled); t.classList.toggle('off', !list[idx]?.enabled);
            return;
          }
          if (act === 'wxCPAction'){
            const cpact = t.getAttribute('data-cpact') || '';
            const npcId = state.chatTarget;
            if (!npcId){ try{toast('请先打开一个聊天');}catch(e){} return; }
            _handleChatPlusAction(cpact, npcId);
            return;
          }
          if (act === 'wxSearch'){ try{toast('搜索功能开发中…');}catch(e){} return; }
          if (act === 'wxMeProfile'){ try{toast('个人资料编辑开发中…');}catch(e){} return; }
          if (act === 'forumTab'){ switchForumTab(t); return; }
          if (act === 'forumInternalTab'){
            var tabName = t.getAttribute('data-tab');
            var inner = root.querySelector('[data-ph="forumInnerContent"]');
            if (inner && tabName) _renderForumTab(inner, tabName);
            return;
          }
          if (act === 'forumCardDetail'){
            var pid2 = t.getAttribute('data-postid');
            if (pid2) openForumPostDetail(pid2);
            return;
          }
          if (act === 'forumDetailComment'){
            // 聚焦评论输入框
            try{ var inp2 = root.querySelector('.forumDetailCmtInput'); if(inp2) inp2.focus(); }catch(e){}
            return;
          }
          if (act === 'forumDetailCmtSend'){
            var pid3 = t.getAttribute('data-postid');
            var inp3 = root.querySelector('.forumDetailCmtInput');
            var txt3 = inp3 ? String(inp3.value||'').trim() : '';
            if (!txt3){ try{toast('评论内容不能为空');}catch(ex){} return; }
            try{
              const chatUID3 = (typeof phoneGetChatUID==='function')?phoneGetChatUID():'';
              var fd3 = phoneLoadForum(chatUID3);
              var post3 = (fd3.posts||[]).find(function(p){return p.id===pid3;});
              if(post3){ if(!Array.isArray(post3.comments))post3.comments=[]; post3.comments.push({name:'我',text:txt3,time:Date.now()}); phoneSaveForum(fd3,chatUID3); }
              var body3 = root.querySelector('[data-ph="appBody"]');
              if(body3) renderForumPostDetail(pid3, body3);
            }catch(ex){}
            return;
          }
          if (act === 'forumMeTab'){
            var subtab = t.getAttribute('data-subtab');
            _forumNav.meSubTab = subtab||'posts';
            root.querySelectorAll('.forumMeSubTab').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-subtab')===subtab); });
            const chatUIDme = (typeof phoneGetChatUID==='function')?phoneGetChatUID():'';
            var fdme = phoneLoadForum(chatUIDme); fdme = forumEnsureDefaults(fdme);
            var mePosts = (fdme.posts||[]).filter(function(p){return p.authorId==='me';}).sort(function(a,b){return(b.time||0)-(a.time||0);});
            var bmPosts = (fdme.posts||[]).filter(function(p){return(fdme.bookmarks||[]).indexOf(p.id)>=0;}).sort(function(a,b){return(b.time||0)-(a.time||0);});
            var meContent = root.querySelector('[data-ph="forumMeContent"]');
            if(meContent) _renderForumMeContent(meContent, _forumNav.meSubTab, mePosts, bmPosts);
            return;
          }
          // ── 3b：论坛私信 ──
          if (act === 'forumDMOpen'){
            var dmNpcId = t.getAttribute('data-npcid');
            if(!dmNpcId) return;
            var dmThread = _getForumDMThread(dmNpcId);
            openForumDM(dmNpcId, dmThread?dmThread.npcName:dmNpcId, dmThread?dmThread.avatarHint:dmNpcId.charAt(0));
            return;
          }
          if (act === 'forumDMBack'){
            _forumDMCurrent = null;
            var inner2 = root.querySelector('[data-ph="forumInnerContent"]');
            if(inner2) renderForumMessages(inner2);
            return;
          }
          if (act === 'forumDMSend'){
            var sendNpcId = t.getAttribute('data-npcid');
            if(sendNpcId) sendForumDM(sendNpcId);
            return;
          }
          if (act === 'forumStartDM'){
            // 从帖子详情 / NPC主页发起私信
            var dmN = t.getAttribute('data-npcid');
            var dmName = t.getAttribute('data-npcname')||dmN;
            var dmAvatar = t.getAttribute('data-npcavatar')||dmN.charAt(0);
            if(!dmN) return;
            // 先切换到消息 Tab
            _forumNav.tab = 'messages';
            var bodyDM = root.querySelector('[data-ph="appBody"]');
            if(bodyDM) renderForum(bodyDM);
            // 稍后打开 DM（等渲染完）
            setTimeout(function(){ openForumDM(dmN, dmName, dmAvatar); }, 80);
            return;
          }
          if (act === 'forumLike'){ toggleForumLike(t); return; }
          if (act === 'forumBookmark'){ toggleForumBookmark(t); return; }
          if (act === 'forumCommentLike'){ toggleForumCommentLike(t); return; }
          if (act === 'forumComment'){
            // 切换评论输入框显隐
            const pid = t.getAttribute('data-postid');
            const wrap = root.querySelector('[data-cmtwrap="'+pid+'"]');
            if (wrap){
              const vis = wrap.style.display !== 'none';
              // 先隐藏所有评论输入框
              root.querySelectorAll('.feedCommentInput').forEach(function(el){ el.style.display='none'; });
              if (!vis){
                wrap.style.display = 'flex';
                try{ wrap.querySelector('input')?.focus?.(); }catch(ex){}
              }
            }
            return;
          }
          if (act === 'forumCommentSend'){
            const pid = t.getAttribute('data-postid');
            const inp = root.querySelector('[data-cmtinput="'+pid+'"]');
            const text = inp ? String(inp.value||'').trim() : '';
            if (!text){ try{toast('评论内容不能为空');}catch(ex){} return; }
            try{
              const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
              let fd = phoneLoadForum(chatUID);
              const post = (fd.posts||[]).find(function(p){return p.id===pid;});
              if (post){
                if (!Array.isArray(post.comments)) post.comments = [];
                post.comments.push({ name:'我', text:text, time:Date.now() });
                phoneSaveForum(fd, chatUID);
              }
              // 刷新：在详情页则刷详情，否则刷 grid
              if (_forumNav && _forumNav.detail === pid) {
                var bodyCS = root.querySelector('[data-ph="appBody"]');
                if (bodyCS) renderForumPostDetail(pid, bodyCS);
              } else {
                var innerCS = root.querySelector('[data-ph="forumInnerContent"]');
                if (innerCS) _renderForumTab(innerCS, _forumNav ? _forumNav.tab : 'home');
              }
            }catch(ex){}
            return;
          }
          if (act === 'forumShare'){
            // 转发引用：弹出引用转发编辑框
            const pid = t.getAttribute('data-postid');
            try{
              const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
              let fd = phoneLoadForum(chatUID);
              const origPost = (fd.posts||[]).find(function(p){return p.id===pid;});
              if (!origPost){ try{toast('找不到原帖');}catch(ex){} return; }
              _openForumRepostModal(origPost, chatUID);
            }catch(ex){}
            return;
          }
          if (act === 'forumCompose'){ e.stopPropagation(); openForumComposePage(); return; }
          if (act === 'forumPost'){ e.stopPropagation(); submitForumPost(); return; }
          if (act === 'forumCancelCompose'){ e.stopPropagation(); e.preventDefault(); closeForumCompose(); return; }
          if (act === 'forumNpcProfile'){ openNpcProfile(t.getAttribute('data-npcid')); return; }
          if (act === 'forumFollowToggle'){ toggleForumFollow(t.getAttribute('data-npcid')); return; }
          if (act === 'forumNpcChat'){ const nid=t.getAttribute('data-npcid'); if(nid) openChat(nid); return; }
          if (act === 'forumShowFollowing'){ renderForumFollowList('following'); return; }
          if (act === 'forumShowFollowers'){ renderForumFollowList('followers'); return; }
          if (act === 'forumBack'){
            // 如果在详情页，返回列表；否则退出论坛
            if(_forumNav.detail){
              _forumNav.detail = null;
              var bodyFB = root.querySelector('[data-ph="appBody"]');
              if(bodyFB) renderForum(bodyFB);
            } else {
              renderForum(root.querySelector('[data-ph="appBody"]'));
            }
            return;
          }

          // ====== AutoFeed 事件路由 ======
          if (act === 'afRunAll'){
            AutoFeedEngine.runOnce({isManual:true}).then(function(r){
              // 刷新当前设置页面以更新状态
              try{ var body=root.querySelector('[data-ph="appBody"]'); if(body){ var sp=body.querySelector('.settingSubPage'); if(sp) renderAutoFeedSettingsPage(body); } }catch(e){}
            });
            return;
          }
          if (act === 'afClearCache'){
            _afClearAllAIContent();
            try{toast('已清除所有 AI 资讯缓存');}catch(e){}
            try{ var body2=root.querySelector('[data-ph="appBody"]'); if(body2){ var sp=body2.querySelector('.settingSubPage'); if(sp) renderAutoFeedSettingsPage(body2); } }catch(e){}
            return;
          }
          if (act === 'afForumSettings'){ _openForumFeedSettings(); return; }
          if (act === 'afBrowserSettings'){ _openBrowserFeedSettings(); return; }
          if (act === 'afMomentsSettings'){ _openMomentsFeedSettings(); return; }
          if (act === 'afRunSingle'){
            var appName=t.getAttribute('data-afapp');
            if(appName){
              AutoFeedEngine.runSingle(appName).then(function(r){
                if(r.ok){
                  root.querySelectorAll('.afSettingsModal').forEach(function(m){m.remove();});
                  // 刷新对应 App 视图
                  try{
                    if(appName==='forum' && state.app==='forum'){ renderApp('forum'); }
                    else if(appName==='browser' && state.app==='browser'){ renderApp('browser'); }
                    else if(appName==='moments'){
                      // 朋友圈在 WeChat 发现 Tab 中
                      var content=root.querySelector('[data-ph="chatTabContent"]');
                      if(content) renderMoments(content);
                    }
                  }catch(e){ console.warn('[afRunSingle] re-render error:', e); }
                }
              });
            }
            return;
          }
          if (act === 'afCloseModal'){ root.querySelectorAll('.afSettingsModal').forEach(function(m){m.remove();}); return; }

          if (act === 'photoTab'){ switchPhotoTab(t); return; }
          if (act === 'photoUpload'){ triggerPhotoUpload(t.getAttribute('data-cat')||'all'); return; }
          if (act === 'photoDel'){ deletePhoto(t.getAttribute('data-cat'), t.getAttribute('data-idx')); return; }
          if (act === 'setTheme'){ applyTheme(t.getAttribute('data-theme')); return; }
          if (act === 'settingsNav'){ openSettingsSubPage(t.getAttribute('data-subpage')); return; }
          if (act === 'settingsBack'){ renderSettings(root.querySelector('[data-ph="appBody"]')); return; }
          if (act === 'setWallpaper'){ triggerWallpaperUpload(t.getAttribute('data-wptarget')||'home'); return; }
          if (act === 'clearWallpaper'){ clearWallpaper(t.getAttribute('data-wptarget')||'home'); return; }
          if (act === 'pickWallpaperFromAlbum'){ pickWallpaperFromAlbum(t.getAttribute('data-wptarget')||'home'); return; }

          if (act === 'zoomIn'){ zoomIn(); return; }
          if (act === 'zoomOut'){ zoomOut(); return; }
          if (act === 'zoomReset'){ zoomReset(); return; }

          if (act === 'editDone'){ toggleEdit(false); return; }
          return;
        }

        const app = t.getAttribute('data-app');
        if (app){
          e.preventDefault();
          if (state.editMode){
            openEditItemSettings(t);
            return;
          }
          openApp(app);
          return;
        }

        // 音乐播放
        if (t.hasAttribute('data-musicact')){
          e.preventDefault();
          try{
            const wrap = t.closest('[data-musicurl],.wdgMusic,.pwMusic');
            if (!wrap) return;
            const audio = wrap.querySelector('audio[data-phmusic]');
            if (!audio){ try{toast('未设置音频URL');}catch(e){} return; }
            const act = t.getAttribute('data-musicact');
            if (act === 'toggle'){
              if (audio.paused){ audio.play().catch(()=>{}); t.textContent='⏸'; }
              else { audio.pause(); t.textContent='▶'; }
            }
          }catch(e){}
          return;
        }
      }

      // 长按桌面图标/组件进入编辑模式（iOS 风）
// 📌 bindLongPress：长按桌面进入编辑模式（iOS 抖动）
// 判定：420ms 长按触发；移动超过阈值会取消（防误触）
// 编辑模式能力：拖动换位、轻点编辑、左上角删除、点“完成”退出
      function bindLongPress(){
        let timer = null, sx = 0, sy = 0, targetEl = null, moved = false;

        function clear(){ if (timer){ clearTimeout(timer); timer = null; } }
        function onDown(e){
          if (state.view !== 'home' || state.mode !== 'full' || state.editMode) return;
          const t = e.target.closest('.phAppIcon,.pw,.phDockBtn');
          if (!t) return;
          targetEl = t;
          moved = false;
          const p = e.touches ? e.touches[0] : e;
          sx = p.clientX; sy = p.clientY;
          clear();
          timer = setTimeout(()=>{
            toggleEdit(true);
            showEditToast('编辑模式：拖动换位，轻点编辑，左上角删除');
            try{ targetEl.classList.add('lp-pulse'); setTimeout(()=>targetEl && targetEl.classList.remove('lp-pulse'),180);}catch(_){}
          }, 420);
        }
        function onMove(e){
          if (!timer) return;
          const p = e.touches ? e.touches[0] : e;
          if (!p) return;
          if (Math.abs(p.clientX - sx) > 8 || Math.abs(p.clientY - sy) > 8){
            moved = true;
            clear();
          }
        }
        function onUp(){
          clear();
          targetEl = null;
        }

        root.addEventListener('touchstart', onDown, {passive:true});
        root.addEventListener('touchmove', onMove, {passive:true});
        root.addEventListener('touchend', onUp, {passive:true});
        root.addEventListener('mousedown', onDown);
        root.addEventListener('mousemove', onMove);
        root.addEventListener('mouseup', onUp);
        root.addEventListener('mouseleave', onUp);
      }

      function toggleEdit(on){
        state.editMode = !!on && state.view === 'home';
        const home = root.querySelector('.phHome');
        if (!home) return;
        home.classList.toggle('editShake', state.editMode);
        if (state.editMode){ try{ if (navigator.vibrate) navigator.vibrate(20); }catch(_){} }
      }

      function showEditToast(msg){
        try{
          const el = root.querySelector('.editHintToast');
          if (!el) return;
          if (msg) el.textContent = msg;
          el.classList.add('show');
          clearTimeout(showEditToast._t);
          showEditToast._t = setTimeout(()=>{ try{ el.classList.remove('show'); }catch(_){} }, 1400);
        }catch(e){}
      }

      // 编辑模式拖动换位（支持跨页 + 边缘翻页）
      function bindEditDrag(){
        if (root.__phEditDragBound) return;
        root.__phEditDragBound = true;

        const pages = ()=>root.querySelector('[data-ph="pages"]');

        let drag = null;
        let edgeTimer = null;
        let lastEdgeFlip = 0;

        function clearEdgeTimer(){
          if (edgeTimer){ clearTimeout(edgeTimer); edgeTimer = null; }
        }
        function pageCount(){
          return root.querySelectorAll('.phPage').length || 1;
        }
        function scrollToPage(i, smooth){
          const el = pages();
          if (!el) return;
          const max = Math.max(0, pageCount() - 1);
          const next = Math.max(0, Math.min(max, Number(i)||0));
          state.page = next;
          const left = next * (el.clientWidth || 1);
          try{ el.scrollTo({ left, behavior: smooth === false ? 'auto' : 'smooth' }); }catch(_){ el.scrollLeft = left; }
          try{
            const dots = root.querySelector('[data-ph="dots"]');
            dots && dots.querySelectorAll('.dot').forEach((d,idx)=>d.classList.toggle('on', idx===next));
          }catch(_){}
        }
        root.__phScrollToPage = scrollToPage;

        function scheduleEdgeFlip(clientX){
          if (!state.editMode || state.view !== 'home') return;
          const shell = root.querySelector('.phShell');
          const pe = pages();
          if (!shell || !pe) return;
          const rect = shell.getBoundingClientRect();
          const edge = 44;
          const now = Date.now();
          const canFlip = (now - lastEdgeFlip) > 380;

          if (clientX < rect.left + edge && state.page > 0 && canFlip){
            clearEdgeTimer();
            edgeTimer = setTimeout(()=>{ lastEdgeFlip = Date.now(); scrollToPage(state.page - 1, true); }, 140);
            return;
          }
          if (clientX > rect.right - edge && state.page < pageCount()-1 && canFlip){
            clearEdgeTimer();
            edgeTimer = setTimeout(()=>{ lastEdgeFlip = Date.now(); scrollToPage(state.page + 1, true); }, 140);
            return;
          }
          clearEdgeTimer();
        }

        function cleanup(){
          clearEdgeTimer();
          if (!drag) return;
          try{ drag.src.classList.remove('editDraggingSrc'); }catch(_){}
          try{ drag.hover && drag.hover.classList.remove('editDropHover'); }catch(_){}
          try{ drag.ghost && drag.ghost.remove(); }catch(_){}
          drag = null;
        }

        function hitItem(clientX, clientY){
          const elems = Array.from(root.querySelectorAll('.phHome.editShake .pw, .phHome.editShake .phAppIcon, .phHome.editShake .phDockBtn'));
          let found = null;
          for (const el of elems){
            if (!el || !el.isConnected) continue;
            if (drag && el === drag.src) continue;
            const r = el.getBoundingClientRect();
            if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom){
              found = el; break;
            }
          }
          return found;
        }

        function swapNodes(a, b){
          if (!a || !b || a === b) return;
          const aParent = a.parentNode, bParent = b.parentNode;
          if (!aParent || !bParent) return;

          const aNext = a.nextSibling;
          const bNext = b.nextSibling;
          const aStyle = a.getAttribute('style') || '';
          const bStyle = b.getAttribute('style') || '';

          if (aParent === bParent){
            // 同页换位：交换 style（主要是 grid 坐标）
            a.setAttribute('style', bStyle);
            b.setAttribute('style', aStyle);
            // 轻微调整层级，避免叠影
            if (aNext === b) aParent.insertBefore(b, a);
            else if (bNext === a) aParent.insertBefore(a, b);
          }else{
            // 跨页/跨容器：交换父容器 + 坐标
            const aPh = a.cloneNode(false); // 仅占位辅助
            const bPh = b.cloneNode(false);
            aParent.replaceChild(aPh, a);
            bParent.replaceChild(bPh, b);
            aPh.parentNode.replaceChild(b, aPh);
            bPh.parentNode.replaceChild(a, bPh);
            a.setAttribute('style', bStyle);
            b.setAttribute('style', aStyle);
          }
        }

        function beginDrag(item, startEvent){
          const p = startEvent.touches ? startEvent.touches[0] : startEvent;
          if (!p) return;
          const r = item.getBoundingClientRect();
          const ghost = item.cloneNode(true);
          ghost.classList.add('editDragGhost');
          ghost.style.width = r.width + 'px';
          ghost.style.height = r.height + 'px';
          doc.body.appendChild(ghost);

          item.classList.add('editDraggingSrc');

          drag = {
            src: item,
            ghost,
            hover: null,
            startX: p.clientX, startY: p.clientY,
            ox: p.clientX - r.left,
            oy: p.clientY - r.top,
            moved: false,
            downTs: Date.now()
          };
          moveGhost(p.clientX, p.clientY);

          if (startEvent.type === 'mousedown'){
            doc.addEventListener('mousemove', onDocMove, true);
            doc.addEventListener('mouseup', onDocUp, true);
          }else{
            doc.addEventListener('touchmove', onDocMove, {passive:false, capture:true});
            doc.addEventListener('touchend', onDocUp, {passive:false, capture:true});
            doc.addEventListener('touchcancel', onDocUp, {passive:false, capture:true});
          }
        }

        function moveGhost(clientX, clientY){
          if (!drag || !drag.ghost) return;
          drag.ghost.style.transform = `translate3d(${clientX - drag.ox}px, ${clientY - drag.oy}px, 0) scale(1.02)`;
        }

        function onDocMove(e){
          if (!drag || !state.editMode) return;
          const p = e.touches ? e.touches[0] : e;
          if (!p) return;
          const dx = p.clientX - drag.startX;
          const dy = p.clientY - drag.startY;
          if (!drag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) drag.moved = true;

          moveGhost(p.clientX, p.clientY);
          scheduleEdgeFlip(p.clientX);

          const over = hitItem(p.clientX, p.clientY);
          if (over !== drag.hover){
            try{ drag.hover && drag.hover.classList.remove('editDropHover'); }catch(_){}
            drag.hover = over;
            try{ drag.hover && drag.hover.classList.add('editDropHover'); }catch(_){}
          }
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
        }

        function onDocUp(e){
          if (!drag) return;
          const p = e.changedTouches ? e.changedTouches[0] : e;
          const src = drag.src;
          const hover = drag.hover;
          const moved = !!drag.moved;

          try{ hover && hover.classList.remove('editDropHover'); }catch(_){}
          if (moved && hover && hover !== src){
            swapNodes(src, hover);
            showEditToast('已换位');
          }else if (!moved){
            // 编辑模式下轻点进入设置
            setTimeout(()=>{ try{ if (state.editMode && src && src.isConnected) openEditItemSettings(src); }catch(_){} }, 0);
          }

          if (e.type === 'mouseup'){
            doc.removeEventListener('mousemove', onDocMove, true);
            doc.removeEventListener('mouseup', onDocUp, true);
          }else{
            doc.removeEventListener('touchmove', onDocMove, true);
            doc.removeEventListener('touchend', onDocUp, true);
            doc.removeEventListener('touchcancel', onDocUp, true);
          }
          cleanup();
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
        }

        function onDown(e){
          if (!state.editMode || state.view !== 'home') return;
          const item = e.target.closest('.pw,.phAppIcon,.phDockBtn');
          if (!item) return;
          if (e.target.closest('.editDelBtn')) return;
          // Dock 图标也允许编辑（改标题），但拖拽换位只限桌面组件/图标
          const canDragItem = !!item.closest('.phPage');
          if (!canDragItem){
            // dock：轻点进入设置，不拖拽
            setTimeout(()=>{ if (state.editMode) openEditItemSettings(item); }, 0);
            e.preventDefault(); e.stopPropagation();
            return;
          }
          beginDrag(item, e);
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
        }

        root.addEventListener('mousedown', onDown, true);
        root.addEventListener('touchstart', onDown, {passive:false, capture:true});
      }

      // ========== 组件编辑：整页进入 ==========
      let _weState = { targetItem:null, wData:null, selectedEl:null };

      function openEditItemSettings(item){
        if (!item || !item.isConnected) return;
        _weState.targetItem = item;
        const itemType = item.getAttribute('data-item') || '';
        const appId = item.getAttribute('data-app') || '';
        const isApp = item.hasAttribute('data-app');
        const isDock = item.classList.contains('phDockBtn');

        let wType = 'custom';
        if (itemType === 'music' || item.classList.contains('pwMusic')) wType = 'music';
        else if (isApp && appId === 'calendar') wType = 'calendar';

        const style = item.getAttribute('style') || '';
        let sz = 'medium';
        if (/span\s*4/i.test(style) && /span\s*2/i.test(style)) sz = 'large';
        else if (/span\s*2/i.test(style)) sz = 'medium';
        else if (isApp || isDock) sz = 'small';
        let shape = (sz === 'small') ? 'square' : 'rect';

        // 尝试加载已保存的 widget 数据
        const savedId = item.getAttribute('data-wid') || '';
        let saved = null;
        if (savedId){
          const store = loadWidgetData();
          saved = (store.items||[]).find(i=>i.id === savedId);
        }

        if (saved){
          _weState.wData = JSON.parse(JSON.stringify(saved));
        } else {
          _weState.wData = {
            id: savedId || _wid(),
            type: wType, size: sz, shape: shape,
            elements: [], config: {}, preset: '',
          };
          _weState.wData.elements = _extractElementsFromDOM(item);
          if (!_weState.wData.elements.length){
            const presets = WIDGET_PRESETS[wType] || WIDGET_PRESETS.custom;
            const dim = _getWidgetPx(sz, shape);
            _weState.wData.elements = presets[0].build(dim.w, dim.h);
            _weState.wData.preset = presets[0].id;
          }
        }
        _weState.selectedEl = null;

        toggleEdit(false);
        state._innerStack = []; // ✅ 清空子页面栈
        state.navStack.push('home');
        state.view = 'app'; state.app = 'widgetEditor';
        setView('app');
        try{
          const titleEl = root.querySelector('[data-ph="appTitle"]');
          if (titleEl) titleEl.textContent = '编辑组件';
        }catch(e){}
        renderWidgetEditor(root.querySelector('[data-ph="appBody"]'));
      }

      function _extractElementsFromDOM(item){
        const els = [];
        const texts = item.querySelectorAll('.pwHd,.pwBd,.pwName,.pwTag,.pwPreview,.at,.dt');
        let y = 8;
        texts.forEach(t=>{
          const txt = (t.textContent||'').trim();
          if (!txt) return;
          const fs = parseInt(W.getComputedStyle?.(t)?.fontSize) || 13;
          const bold = (W.getComputedStyle?.(t)?.fontWeight || '') >= '600';
          els.push({id:_elid(),type:'text',content:txt,x:12,y:y,fontSize:fs,color:'var(--ph-text)',bold:!!bold});
          y += fs + 8;
        });
        const emojis = item.querySelectorAll('.ai,.di,.pwAvatar');
        emojis.forEach(e=>{
          let txt = (e.textContent||'').trim();
          // ✅ 如果包含 SVG 图标（textContent 为空），用 appId 作为标识
          if (!txt && e.querySelector('svg')){
            const appId = item.getAttribute('data-app') || 'app';
            txt = '📱'; // 占位 emoji，编辑器里可见可拖拽
          }
          if (!txt) return;
          els.push({id:_elid(),type:'emoji',content:txt,x:12,y:Math.max(8, y-20),fontSize:22});
        });
        return els;
      }

      function renderWidgetEditor(container){
        if (!container) return;
        // ✅ 保存滚动位置，防止重绘后跳回顶部
        const scrollParent = container.closest('.weBody') || container;
        const savedScroll = scrollParent.scrollTop || 0;
        const wd = _weState.wData;
        if (!wd){ container.innerHTML='<div class="phPlaceholder"><div class="phPlIcon">⚠️</div><div class="phPlText">无编辑数据</div></div>'; return; }

        const dim = _getWidgetPx(wd.size, wd.shape);
        const presets = WIDGET_PRESETS[wd.type] || WIDGET_PRESETS.custom;

        let html = `<div class="weWrap"><div class="weBody">`;

        // 1) 功能类型（可滑动）
        html += `<div class="weSec"><div class="weSecTitle">组件功能</div><div class="weTypePicker">`;
        Object.entries(WIDGET_TYPES).forEach(([k,v])=>{
          html += `<button class="weTypeOpt${wd.type===k?' active':''}" data-wetype="${k}">
            <span class="weTypeIcon">${v.icon}</span>${v.label}</button>`;
        });
        html += `</div></div>`;

        // 2) 预设排版（3种）
        html += `<div class="weSec"><div class="weSecTitle">预设排版</div><div class="wePresetPicker">`;
        presets.forEach(p=>{
          html += `<button class="wePresetOpt${wd.preset===p.id?' active':''}" data-wepreset="${p.id}">${p.label}<br><span style="font-size:10px;opacity:.6;">${p.desc}</span></button>`;
        });
        html += `</div></div>`;

        // 3) 尺寸 + 形状
        html += `<div class="weSec"><div class="weSecTitle">尺寸</div><div class="weSizePicker">`;
        Object.entries(WIDGET_SIZES).forEach(([k,v])=>{
          html += `<button class="weSizeOpt${wd.size===k?' active':''}" data-wesize="${k}">${v.label}</button>`;
        });
        html += `</div></div>`;

        // 4) 画布
        const maxCvs = 280;
        const scale = Math.min(maxCvs / dim.w, maxCvs / dim.h, 2.5);
        const dispW = Math.round(dim.w * scale), dispH = Math.round(dim.h * scale);

        html += `<div class="weSec"><div class="weSecTitle">布局编辑（点选 + 拖拽）</div>
          <div class="weCanvas" data-wecvs="1" data-scale="${scale}" style="width:${dispW}px;height:${dispH}px;margin:0 auto;">`;
        (wd.elements||[]).forEach(el=>{
          const sx = Math.round(el.x * scale), sy = Math.round(el.y * scale);
          const sfs = Math.max(8, Math.round((el.fontSize||13) * scale));
          const isSel = (_weState.selectedEl === el.id);
          const cls = 'weEl' + (isSel ? ' selected' : '');
          const resizeBar = `<div class="weResizeBar"><button class="weResizeBtn" data-wersz="down">−</button><button class="weResizeBtn" data-wersz="up">＋</button></div>`;
          if (el.type === 'text'){
            html += `<div class="${cls}" data-elid="${el.id}" style="left:${sx}px;top:${sy}px;font-size:${sfs}px;color:var(--ph-text);font-weight:${el.bold?'700':'400'};white-space:nowrap;">${esc(el.content)}${resizeBar}</div>`;
          } else if (el.type === 'emoji'){
            html += `<div class="${cls}" data-elid="${el.id}" style="left:${sx}px;top:${sy}px;font-size:${sfs}px;">${esc(el.content)}${resizeBar}</div>`;
          } else if (el.type === 'image'){
            const sw = Math.round((el.w||40)*scale), sh = Math.round((el.h||40)*scale);
            const br = el.cropShape==='circle' ? '50%' : (el.cropShape==='rounded' ? '12px' : '4px');
            html += `<div class="${cls}" data-elid="${el.id}" style="left:${sx}px;top:${sy}px;width:${sw}px;height:${sh}px;"><img src="${esc(el.src||'')}" style="width:100%;height:100%;object-fit:cover;border-radius:${br};pointer-events:none;" onerror="this.style.background='var(--ph-glass-strong)';this.alt='IMG'"/>${resizeBar}</div>`;
          } else if (el.type === 'line'){
            const sw = Math.round((el.w||60)*scale), sh = Math.max(2, Math.round((el.h||2)*scale));
            html += `<div class="${cls}" data-elid="${el.id}" style="left:${sx}px;top:${sy}px;width:${sw}px;height:${sh}px;background:var(--ph-glass-border);border-radius:1px;">${resizeBar}</div>`;
          }
        });
        html += `</div></div>`;

        // 5) 添加元素
        html += `<div class="weSec"><div class="weSecTitle">添加元素</div><div class="weElBar">
          <button class="weElBtn" data-weadd="text"><svg class="phIco" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;margin-right:3px;" viewBox="0 0 24 24"><path d="M5 4v3h5.5v12h3V7H19V4z"/></svg>文字</button>
          <button class="weElBtn" data-weadd="emoji"><svg class="phIco" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;margin-right:3px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/><path d="M8.5 14.5s1.5 2.5 3.5 2.5 3.5-2.5 3.5-2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Emoji</button>
          <button class="weElBtn" data-weadd="image"><svg class="phIco" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;margin-right:3px;" viewBox="0 0 24 24"><path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z"/></svg>图片</button>
          <button class="weElBtn" data-weadd="line"><svg class="phIco" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;margin-right:3px;" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="2" rx="1"/></svg>线框</button>
          <button class="weElBtn" data-weadd="delsel" style="margin-left:auto;color:#ef4444;border-color:rgba(239,68,68,.2);"><svg class="phIco" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;margin-right:3px;" viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>删除选中</button>
        </div></div>`;

        // 5b) 选中图片时显示裁切选项
        if (_weState.selectedEl){
          const selEl = (wd.elements||[]).find(e=>e.id===_weState.selectedEl);
          if (selEl && selEl.type === 'image'){
            const cs = selEl.cropShape || 'default';
            html += `<div class="weSec"><div class="weSecTitle">图片裁切</div><div class="weImgCropPicker">
              <button class="weImgCropOpt${cs==='default'?' active':''}" data-wecrop="default">方角</button>
              <button class="weImgCropOpt${cs==='rounded'?' active':''}" data-wecrop="rounded">圆角</button>
              <button class="weImgCropOpt${cs==='circle'?' active':''}" data-wecrop="circle">圆形</button>
            </div></div>`;
          }
        }

        // 6) 标准点位
        html += `<div class="weSec"><div class="weSecTitle">标准点位（选中后点击）</div><div class="weSnapBar">
          <button class="weSnapBtn" data-wesnap="tl">↖左上</button>
          <button class="weSnapBtn" data-wesnap="tc">↑顶中</button>
          <button class="weSnapBtn" data-wesnap="tr">↗右上</button>
          <button class="weSnapBtn" data-wesnap="ml">←左中</button>
          <button class="weSnapBtn" data-wesnap="mc">⊙居中</button>
          <button class="weSnapBtn" data-wesnap="mr">→右中</button>
          <button class="weSnapBtn" data-wesnap="bl">↙左下</button>
          <button class="weSnapBtn" data-wesnap="bc">↓底中</button>
          <button class="weSnapBtn" data-wesnap="br">↘右下</button>
        </div></div>`;

        // 7) 类型配置
        html += `<div class="weSec"><div class="weSecTitle">组件配置</div>`;
        html += _renderWidgetConfig(wd);
        html += `</div>`;

        // 保存按钮
        html += `<div style="padding:12px 0 20px;display:flex;gap:10px;justify-content:center;">
          <button class="weElBtn" data-weact="cancel" style="padding:10px 24px;">取消</button>
          <button class="weElBtn" data-weact="save" style="padding:10px 24px;background:var(--ph-accent-grad);color:#fff;border-color:transparent;font-weight:700;">保存组件</button>
        </div>`;

        html += `</div></div>`;
        container.innerHTML = html;
        // ✅ 恢复滚动位置
        requestAnimationFrame(()=>{ try{ scrollParent.scrollTop = savedScroll; }catch(_){} });
        _bindWidgetEditorEvents(container);
      }

      function _renderWidgetConfig(wd){
        let h = '';
        if (wd.type === 'anniversary'){
          h += `<div class="weConfigRow"><span class="weConfigLabel">纪念日名称</span><input class="weConfigInput" data-wecfg="annivName" value="${esc(wd.config.annivName||'')}"/></div>`;
          h += `<div class="weConfigRow"><span class="weConfigLabel">日期</span><input class="weConfigInput" type="date" data-wecfg="annivDate" value="${esc(wd.config.annivDate||'')}"/></div>`;
          h += `<div class="weConfigRow"><span class="weConfigLabel">来源</span><select class="weConfigInput" data-wecfg="annivSource" style="width:120px;"><option value="manual"${wd.config.annivSource==='manual'?' selected':''}>手动</option><option value="story"${wd.config.annivSource==='story'?' selected':''}>故事生成</option><option value="api"${wd.config.annivSource==='api'?' selected':''}>API联想</option></select></div>`;
        } else if (wd.type === 'todayItems'){
          h += `<div class="weConfigRow"><span class="weConfigLabel">来源</span><select class="weConfigInput" data-wecfg="itemsSource" style="width:120px;"><option value="manual"${wd.config.itemsSource==='manual'?' selected':''}>手动</option><option value="calendar"${wd.config.itemsSource==='calendar'?' selected':''}>联动日历</option><option value="api"${wd.config.itemsSource==='api'?' selected':''}>API生成</option></select></div>`;
          h += `<div class="weConfigRow"><span class="weConfigLabel">事项（逗号分隔）</span><input class="weConfigInput" data-wecfg="itemsList" value="${esc(wd.config.itemsList||'')}"/></div>`;
        } else if (wd.type === 'music'){
          h += `<div class="weConfigRow"><span class="weConfigLabel">音频URL</span><input class="weConfigInput" data-wecfg="musicUrl" value="${esc(wd.config.musicUrl||'')}" placeholder="https://..." style="width:180px;"/></div>`;
          h += `<div class="weConfigRow"><span class="weConfigLabel">歌曲名</span><input class="weConfigInput" data-wecfg="musicTitle" value="${esc(wd.config.musicTitle||'')}"/></div>`;
          h += `<div class="weConfigRow"><span class="weConfigLabel">动效</span><select class="weConfigInput" data-wecfg="musicStyle" style="width:100px;"><option value="vinyl"${wd.config.musicStyle==='vinyl'?' selected':''}>唱片机</option><option value="notes"${wd.config.musicStyle==='notes'?' selected':''}>音符</option><option value="wave"${wd.config.musicStyle==='wave'?' selected':''}>波形</option></select></div>`;
        } else if (wd.type === 'messages'){
          h += `<div class="weConfigRow"><span class="weConfigLabel">来源</span><select class="weConfigInput" data-wecfg="msgSource" style="width:120px;"><option value="chat"${wd.config.msgSource==='chat'?' selected':''}>私聊</option><option value="forum"${wd.config.msgSource==='forum'?' selected':''}>论坛</option><option value="news"${wd.config.msgSource==='news'?' selected':''}>新闻</option><option value="all"${wd.config.msgSource==='all'?' selected':''}>全部</option></select></div>`;
        } else {
          h += `<div style="padding:6px 0;font-size:12px;color:var(--ph-text-dim);">自由添加元素即可。</div>`;
        }
        return h;
      }

      function _bindWidgetEditorEvents(container){
        const wd = _weState.wData;
        if (!wd) return;
        const canvas = container.querySelector('[data-wecvs]');
        const scale = parseFloat(canvas?.getAttribute('data-scale')) || 1;
        const dim = _getWidgetPx(wd.size, wd.shape);

        // type
        container.querySelectorAll('[data-wetype]').forEach(b=>b.addEventListener('click',()=>{
          wd.type = b.getAttribute('data-wetype');
          const p = (WIDGET_PRESETS[wd.type]||WIDGET_PRESETS.custom)[0];
          wd.elements = p.build(dim.w, dim.h);
          wd.preset = p.id;
          wd.config = {};
          _weState.selectedEl = null;
          renderWidgetEditor(container);
        }));

        // preset
        container.querySelectorAll('[data-wepreset]').forEach(b=>b.addEventListener('click',()=>{
          const pid = b.getAttribute('data-wepreset');
          const presets = WIDGET_PRESETS[wd.type] || WIDGET_PRESETS.custom;
          const p = presets.find(x=>x.id===pid);
          if (!p) return;
          wd.elements = p.build(dim.w, dim.h);
          wd.preset = pid;
          _weState.selectedEl = null;
          renderWidgetEditor(container);
        }));

        // size
        container.querySelectorAll('[data-wesize]').forEach(b=>b.addEventListener('click',()=>{
          wd.size = b.getAttribute('data-wesize');
          _weState.selectedEl = null;
          renderWidgetEditor(container);
        }));

        // element select + drag
        if (canvas){
          canvas.querySelectorAll('.weEl').forEach(el=>{
            el.addEventListener('click',(e)=>{
              if (e.target.closest('.weResizeBtn')) return;
              e.stopPropagation();
              _weState.selectedEl = el.getAttribute('data-elid');
              renderWidgetEditor(container);
            });
          });
          canvas.addEventListener('click',(e)=>{
            if (e.target === canvas){ _weState.selectedEl = null; renderWidgetEditor(container); }
          });
          _bindCanvasDrag(canvas, wd, scale, container);
        }

        // resize buttons
        container.querySelectorAll('[data-wersz]').forEach(b=>b.addEventListener('click',(e)=>{
          e.stopPropagation();
          if (!_weState.selectedEl) return;
          const el = (wd.elements||[]).find(x=>x.id===_weState.selectedEl);
          if (!el) return;
          const dir = b.getAttribute('data-wersz');
          const step = 2;
          if (el.type === 'text' || el.type === 'emoji'){
            el.fontSize = Math.max(6, (el.fontSize||13) + (dir==='up' ? step : -step));
          } else if (el.type === 'image'){
            el.w = Math.max(10, (el.w||40) + (dir==='up' ? 8 : -8));
            el.h = Math.max(10, (el.h||40) + (dir==='up' ? 8 : -8));
          } else if (el.type === 'line'){
            el.w = Math.max(10, (el.w||60) + (dir==='up' ? 10 : -10));
          }
          renderWidgetEditor(container);
        }));

        // add element
        container.querySelectorAll('[data-weadd]').forEach(b=>b.addEventListener('click',()=>{
          const t = b.getAttribute('data-weadd');
          if (t === 'delsel'){
            if (_weState.selectedEl){ wd.elements = (wd.elements||[]).filter(e=>e.id!==_weState.selectedEl); _weState.selectedEl=null; renderWidgetEditor(container); }
            return;
          }
          const ne = { id:_elid(), type:t, x:20, y:20 };
          if (t === 'text'){
            const txt = W.prompt ? W.prompt('输入文字','新文字') : '新文字';
            if (!txt) return;
            ne.content = txt; ne.fontSize = 13; ne.color = 'var(--ph-text)';
          } else if (t === 'emoji'){
            const em = W.prompt ? W.prompt('输入Emoji','✨') : '✨';
            if (!em) return;
            ne.content = em; ne.fontSize = 22;
          } else if (t === 'image'){
            const url = W.prompt ? W.prompt('图片URL（png/gif）','') : '';
            if (!url) return;
            ne.src = url; ne.w = 40; ne.h = 40; ne.cropShape = 'rounded';
          } else if (t === 'line'){
            ne.w = 60; ne.h = 2; ne.color = 'var(--ph-glass-border)';
          }
          wd.elements.push(ne);
          _weState.selectedEl = ne.id;
          renderWidgetEditor(container);
        }));

        // image crop
        container.querySelectorAll('[data-wecrop]').forEach(b=>b.addEventListener('click',()=>{
          if (!_weState.selectedEl) return;
          const el = (wd.elements||[]).find(x=>x.id===_weState.selectedEl);
          if (!el || el.type !== 'image') return;
          el.cropShape = b.getAttribute('data-wecrop');
          renderWidgetEditor(container);
        }));

        // snap
        container.querySelectorAll('[data-wesnap]').forEach(b=>b.addEventListener('click',()=>{
          if (!_weState.selectedEl) return;
          const el = (wd.elements||[]).find(e=>e.id===_weState.selectedEl);
          if (!el) return;
          const snap = b.getAttribute('data-wesnap');
          const elW = (el.type==='image'||el.type==='line') ? (el.w||40) : (el.fontSize||13)*Math.max(1,(el.content||'').length)*0.55;
          const elH = (el.type==='image') ? (el.h||40) : (el.type==='line') ? (el.h||2) : (el.fontSize||13);
          const pad = 8;
          if (snap[0]==='t') el.y=pad; else if (snap[0]==='m') el.y=Math.round((dim.h-elH)/2); else if (snap[0]==='b') el.y=dim.h-elH-pad;
          if (snap[1]==='l') el.x=pad; else if (snap[1]==='c') el.x=Math.round((dim.w-elW)/2); else if (snap[1]==='r') el.x=dim.w-elW-pad;
          renderWidgetEditor(container);
        }));

        // config
        container.querySelectorAll('[data-wecfg]').forEach(inp=>{
          const h=()=>{wd.config[inp.getAttribute('data-wecfg')]=inp.value;};
          inp.addEventListener('input',h); inp.addEventListener('change',h);
        });

        // save / cancel
        container.querySelectorAll('[data-weact]').forEach(b=>b.addEventListener('click',()=>{
          const act = b.getAttribute('data-weact');
          if (act==='cancel'){ _weState.wData=null; goBack(); return; }
          if (act==='save'){
            _applyWidgetToDOM();
            const data = loadWidgetData();
            const idx = data.items.findIndex(i=>i.id===wd.id);
            if (idx>=0) data.items[idx]=JSON.parse(JSON.stringify(wd));
            else data.items.push(JSON.parse(JSON.stringify(wd)));
            saveWidgetData(data);
            try{toast('组件已保存');}catch(e){}
            goBack();
          }
        }));
      }

      function _bindCanvasDrag(canvas, wd, scale, container){
        let dragEl=null, dragData=null, startX=0, startY=0, origX=0, origY=0;
        function onStart(e){
          const t = e.target.closest('.weEl');
          if (!t || e.target.closest('.weResizeBtn')) return;
          e.preventDefault(); e.stopPropagation();
          dragEl=t;
          const elId=t.getAttribute('data-elid');
          dragData=(wd.elements||[]).find(x=>x.id===elId);
          if (!dragData) return;
          const p=e.touches?e.touches[0]:e;
          startX=p.clientX; startY=p.clientY;
          origX=dragData.x; origY=dragData.y;
          t.classList.add('dragging');
        }
        function onMove(e){
          if (!dragEl||!dragData) return;
          e.preventDefault();
          const p=e.touches?e.touches[0]:e;
          dragData.x=Math.round(Math.max(0, origX+(p.clientX-startX)/scale));
          dragData.y=Math.round(Math.max(0, origY+(p.clientY-startY)/scale));
          dragEl.style.left=(dragData.x*scale)+'px';
          dragEl.style.top=(dragData.y*scale)+'px';
        }
        function onEnd(){
          if (dragEl) dragEl.classList.remove('dragging');
          dragEl=null; dragData=null;
        }
        canvas.addEventListener('touchstart',onStart,{passive:false});
        canvas.addEventListener('touchmove',onMove,{passive:false});
        canvas.addEventListener('touchend',onEnd);
        canvas.addEventListener('mousedown',onStart);
        doc.addEventListener('mousemove',onMove);
        doc.addEventListener('mouseup',onEnd);
      }

      function _applyWidgetToDOM(){
        const item=_weState.targetItem;
        const wd=_weState.wData;
        if (!item||!item.isConnected||!wd) return;

        // 更新 grid size（直接用 cols×rows）
        const sz = WIDGET_SIZES[wd.size];
        if (sz){
          const oldCol = (item.style.gridColumn||'').match(/(\d+)/);
          const startCol = oldCol ? parseInt(oldCol[1]) : 1;
          const oldRow = (item.style.gridRow||'').match(/(\d+)/);
          const startRow = oldRow ? parseInt(oldRow[1]) : 1;
          item.style.gridColumn = `${startCol}/span ${sz.cols}`;
          item.style.gridRow = `${startRow}/span ${sz.rows}`;
        }

        const inner = _renderWidgetInner(wd);
        const delBtn = item.querySelector('.editDelBtn');
        item.innerHTML = '';
        if (delBtn) item.appendChild(delBtn);
        else { const s=doc.createElement('span'); s.className='editDelBtn'; s.setAttribute('data-edit','del'); s.textContent='✕'; item.appendChild(s); }
        const wrap=doc.createElement('div'); wrap.innerHTML=inner;
        while(wrap.firstChild) item.appendChild(wrap.firstChild);
        item.setAttribute('data-wid',wd.id);
        item.setAttribute('data-wtype',wd.type);
      }

      function _renderWidgetInner(wd){
        const now=new Date();
        const ms=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
        const ds=['周日','周一','周二','周三','周四','周五','周六'];
        switch(wd.type){
          case 'calendar':
            return `<div style="padding:10px 14px;"><div style="font-size:28px;font-weight:800;color:var(--ph-text);line-height:1;">${now.getDate()}</div><div style="font-size:11px;color:var(--ph-text-sub);margin-top:2px;">${ms[now.getMonth()]}</div><div style="font-size:11px;color:var(--ph-accent);font-weight:600;">${ds[now.getDay()]}</div></div>`;
          case 'anniversary':{
            const nm=wd.config.annivName||'纪念日', dt=wd.config.annivDate||'';
            let cd='--'; if(dt){const tg=new Date(dt+'T00:00:00'),df=Math.ceil((tg-now)/864e5); cd=df>0?df+'天':df===0?'今天!':'已过'+Math.abs(df)+'天';}
            return `<div style="padding:10px 14px;"><div style="font-size:11px;color:var(--ph-text-sub);">💝 ${esc(nm)}</div><div style="font-size:24px;font-weight:800;color:var(--ph-text);">${cd}</div></div>`;
          }
          case 'todayItems':{
            const items=(wd.config.itemsList||'').split(/[,，]/).filter(Boolean).slice(0,5);
            const cs=['#6366f1','#ec4899','#8b5cf6','#f59e0b','#10b981'];
            let r=''; items.forEach((it,i)=>{r+=`<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px;color:var(--ph-text-sub);"><div style="width:4px;height:4px;border-radius:50%;background:${cs[i%5]};flex-shrink:0;"></div>${esc(it.trim())}</div>`;});
            if(!r) r='<div style="font-size:11px;color:var(--ph-text-dim);">暂无事项</div>';
            return `<div style="padding:10px 14px;"><div style="font-size:12px;font-weight:700;color:var(--ph-text);margin-bottom:6px;">📌 今日事项</div>${r}</div>`;
          }
          case 'music':{
            const t=wd.config.musicTitle||'暂无播放', url=wd.config.musicUrl||'';
            return `<div style="padding:10px 14px;position:relative;" data-musicurl="${esc(url)}"><div style="font-size:12px;font-weight:700;color:var(--ph-text);margin-bottom:4px;">🎵 音乐</div><div style="font-size:11px;color:var(--ph-text-dim);margin-bottom:8px;">${esc(t)}</div><div style="display:flex;gap:8px;"><button class="pwMusicBtn" data-musicact="toggle">▶</button></div>${url?'<audio data-phmusic preload="none" src="'+esc(url)+'"></audio>':''}</div>`;
          }
          case 'messages':
            return `<div style="padding:10px 14px;"><div style="font-size:12px;font-weight:700;color:var(--ph-text);margin-bottom:6px;">💬 最新消息</div><div style="font-size:11px;color:var(--ph-text-dim);">暂无新消息</div></div>`;
          default:{
            let inner=''; (wd.elements||[]).forEach(el=>{
              if (el.type==='text') inner+=`<div style="position:absolute;left:${el.x}px;top:${el.y}px;font-size:${el.fontSize||13}px;color:var(--ph-text);font-weight:${el.bold?'700':'400'};white-space:nowrap;">${esc(el.content||'')}</div>`;
              else if (el.type==='emoji') inner+=`<div style="position:absolute;left:${el.x}px;top:${el.y}px;font-size:${el.fontSize||22}px;">${esc(el.content||'')}</div>`;
              else if (el.type==='image'){const br=el.cropShape==='circle'?'50%':el.cropShape==='rounded'?'12px':'4px'; inner+=`<div style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w||40}px;height:${el.h||40}px;"><img src="${esc(el.src||'')}" style="width:100%;height:100%;object-fit:cover;border-radius:${br};"/></div>`;}
              else if (el.type==='line') inner+=`<div style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w||60}px;height:${el.h||2}px;background:var(--ph-glass-border);border-radius:1px;"></div>`;
            });
            return `<div style="position:relative;width:100%;height:100%;min-height:60px;">${inner}</div>`;
          }
        }
      }

      // 日历组件自动刷新
      setInterval(()=>{
        try{
          if (!root||!root.isConnected) return;
          root.querySelectorAll('[data-wtype="calendar"]').forEach(w=>{
            const n=new Date(), ms=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'], ds=['周日','周一','周二','周三','周四','周五','周六'];
            const els=w.querySelectorAll('div'); if(els[1]) els[1].textContent=n.getDate();
          });
        }catch(e){}
      }, 60000);

// 🧭 导航总控：
// openHome()：回桌面（清空 navStack）
// openApp(appId)：打开某个 App（会设置标题并 renderApp）
// openChat(contactId)：从 chats 进入会话详情（renderChatDetail）
// goBack()：返回栈
      /* ========== 导航 ========== */
      function setView(v){
        ensureRoot();
        state.view = v;
        root.setAttribute('data-view', v);
      }

      function openHome(){
        state.view = 'home'; state.app = 'home';
        state.chatTarget = null; state.navStack = [];
        state._innerStack = []; state._wxTab = 'msgs';
        try{ PhoneAI.abort(); _hideTypingIndicator(); _hideBubbleMenu(); _hideQuoteBar(); root.querySelectorAll('.wxEditMsgOverlay').forEach(function(o){o.remove();}); }catch(e){}
        try{ const sp = root.querySelector('.phAppBarSpacer'); if(sp) sp.innerHTML=''; }catch(e){}
        setView('home');
      }

      function goBack(){
        // ✅ 1) 子页面内部返回栈（如 新的朋友→通讯录、角色设置→聊天详情）
        if (state._innerStack.length > 0){
          const restore = state._innerStack.pop();
          try{ restore(); }catch(e){ console.warn('[MEOW] innerStack restore error:', e); }
          return;
        }
        // ✅ 2) 微信 app 内非默认 tab → 回到消息 tab
        if (state.app === 'chats' && state._wxTab && state._wxTab !== 'msgs'){
          state._wxTab = 'msgs';
          try{
            const btn = root.querySelector('.wxTabBtn[data-tab="msgs"]');
            if (btn) switchChatTab(btn);
          }catch(e){}
          return;
        }
        // ✅ 3) navStack（跨 app 级别）
        if (state.navStack.length > 0){
          const prev = state.navStack.pop();
          if (prev === 'home') openHome();
          else openApp(prev, true);
        } else openHome();
      }

      function openApp(appId, isBack){
        const id = String(appId || 'home');
        if (id === 'home'){ openHome(); return; }
        if (!isBack && state.app !== 'home') state.navStack.push(state.app);
        else if (!isBack) state.navStack = [];
        state.view = 'app'; state.app = id; state.chatTarget = null;
        state._innerStack = []; // ✅ 切 app 清空子页面栈
        try{ PhoneAI.abort(); _hideTypingIndicator(); _hideBubbleMenu(); _hideQuoteBar(); root.querySelectorAll('.wxEditMsgOverlay').forEach(function(o){o.remove();}); }catch(e){}
        if (id === 'chats') state._wxTab = 'msgs'; // ✅ 进入聊天 app 默认 msgs tab
        setView('app');
        // ✅ 清空 app bar 右侧注入按钮（离开聊天 app 时不残留 +号）
        try{ const sp = root.querySelector('.phAppBarSpacer'); if(sp) sp.innerHTML=''; }catch(e){}
        try{
          const titleEl = root.querySelector('[data-ph="appTitle"]');
          if (titleEl) titleEl.textContent = (APP_META[id]||{}).title || id;
        }catch(e){}
        renderApp(id);
      }

      function openChat(contactId){
        state._innerStack = []; // ✅ 清空子页面栈（进入聊天详情走 navStack）
        // ✅ 切换会话时 abort 之前的 AI 请求
        try{ PhoneAI.abort(); _hideTypingIndicator(); _hideBubbleMenu(); _hideQuoteBar(); root.querySelectorAll('.wxEditMsgOverlay').forEach(function(o){o.remove();}); }catch(e){}
        state.navStack.push(state.app);
        state.chatTarget = contactId;
        state.app = 'chatDetail';
        try{
          const titleEl = root.querySelector('[data-ph="appTitle"]');
          if (titleEl) titleEl.textContent = contactId;
        }catch(e){}
        renderChatDetail(contactId);
      }

// 🎬 renderApp：所有 App 的“总分发”
// 你要新增 App：
//  1) APP_META 加条目
//  2) 这里 switch(id) 加 case
//  3) 写一个 renderXxx(container) 渲染函数
      /* ========== App 渲染 ========== */
      function renderApp(id){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        body.innerHTML = '';
        // 清除 AppBar 右侧按钮
        try{ setAppBarRight(''); }catch(e){}
        switch(id){
          case 'chats': renderChatsApp(body); break;
          case 'sms': renderSmsApp(body); break;
          case 'calendar': renderCalendar(body); break;
          case 'forum': _forumNav = { tab: _forumNav ? (_forumNav.tab||'home') : 'home', meSubTab: 'posts', detail: null }; renderForum(body); break;
          case 'weather': renderWeather(body); break;
          case 'browser': renderBrowser(body); break;
          case 'photos': renderPhotos(body); break;
          case 'settings': renderSettings(body); break;
          case 'themes': renderThemes(body); break;
          case 'search': renderPlaceholder(body,'🔍','搜索（后续接索引）'); break;
          case 'widgetEditor': renderWidgetEditor(body); break;
          default: renderPlaceholder(body,'📦',`「${id}」开发中…`);
        }
      }

      function renderPlaceholder(c,icon,text){
        c.innerHTML = `<div class="phPlaceholder"><div class="phPlIcon">${icon}</div><div class="phPlText">${text}</div></div>`;
      }

/* ========== 聊天 App（主线 NPC 社交：消息列表 + 通讯录 + 朋友圈） ========== */
/*
  目标：
  1) 聊天对象=当前主线聊天分支里的 NPC（不是 ST 全局角色卡）
  2) 来源：世界书“角色详情(role)” + 最近5条主线消息候选 + 手动新增
  3) 存储：按 chatUID 隔离（同角色卡不同分支不串）
  4) 回写：先生成“回写主线草稿”入队列，给你手动修改机会（不直接污染主线）
*/

      // ====== Phone Chat Storage Keys（按 chatUID 隔离）======
      const PHONE_IM_KEYS = {
        contacts:  'contacts_v1',       // 联系人库（NPC）
        threads:   'im_threads_v1',     // 会话列表（每NPC一条）
        logs:      'im_logs_v1',        // {map:{npcId:[{role,text,t}]}}
        exportQ:   'im_export_queue_v1',// 回写草稿队列
        wallet:    'wallet_v1',         // 钱包（虚拟金币）
        candidates:'candidates_v1'      // 新朋友候选（未确认加好友）
      };

      function _phUID(){
        // chatUID 拿不到就 fallback，但仍隔离于其它模块（你已有 phoneGetChatUID）
        const uid = (typeof phoneGetChatUID === 'function') ? phoneGetChatUID() : '';
        return String(uid || '').trim() || 'fallback';
      }

      function _phLoad(key, fallback){
        try{ return phoneGetC(_phUID(), key, fallback); }catch(e){ return fallback; }
      }
      function _phSave(key, val){
        try{ return phoneSetC(_phUID(), key, val); }catch(e){}
      }

      // ====== 钱包数据层 ======
      function loadWallet(){
        const w = _phLoad(PHONE_IM_KEYS.wallet, null);
        if (w && typeof w === 'object' && typeof w.balance === 'number') return w;
        return { v:1, balance:8888, transactions:[] };
      }
      function saveWallet(w){ _phSave(PHONE_IM_KEYS.wallet, w); }
      function walletSpend(amount, desc){
        const w = loadWallet();
        if (w.balance < amount) return false;
        w.balance -= amount;
        w.transactions.unshift({ type:'spend', amount, desc, t:Date.now() });
        if (w.transactions.length > 100) w.transactions.length = 100;
        saveWallet(w);
        return true;
      }
      function walletReceive(amount, desc){
        const w = loadWallet();
        w.balance += amount;
        w.transactions.unshift({ type:'receive', amount, desc, t:Date.now() });
        if (w.transactions.length > 100) w.transactions.length = 100;
        saveWallet(w);
      }

      // ====== 新朋友候选数据层（未确认，不进通讯录） ======
      function loadCandidates(){
        const c = _phLoad(PHONE_IM_KEYS.candidates, null);

        // ✅ 兼容旧版本：如果曾经有“auto 自动候选”，这里直接清掉（避免你看到莫名其妙的12个）
        if (c && typeof c === 'object' && Array.isArray(c.list)){
          const clean = { v:1, list:[] };
          for (const it of c.list){
            if (!it || !it.name) continue;
            const src = String(it.source || '');
            // 旧逻辑的 auto 候选一律丢弃；只保留你手动产生的 import/scan/custom
            if (src === 'auto') continue;
            clean.list.push({
              name: String(it.name).trim(),
              source: src || 'custom',
              addedAt: Number(it.addedAt || Date.now())
            });
          }
          // 控制最大长度，防止长期使用越来越卡
          if (clean.list.length > 50) clean.list = clean.list.slice(-50);
          // 写回一次，之后稳定
          try{ _phSave(PHONE_IM_KEYS.candidates, clean); }catch(e){}
          return clean;
        }
        return { v:1, list:[] };
      }
      function saveCandidates(c){ _phSave(PHONE_IM_KEYS.candidates, c); }
      function addCandidate(name, source, extraData){
        const n = String(name||'').trim();
        if (!n) return;
        const c = loadCandidates();
        if (c.list.find(x => x.name === n)) return; // 已在候选
        if (findContactByName(loadContactsDB(), n)) return; // 已是好友
        const entry = { name:n, source: source||'scan', addedAt:Date.now() };
        // C1: 存储额外的结构化数据（identity/appearance/status/relations/profile）
        if (extraData && typeof extraData === 'object'){
          if (extraData.identity) entry.identity = String(extraData.identity);
          if (extraData.appearance) entry.appearance = String(extraData.appearance);
          if (extraData.status) entry.status = String(extraData.status);
          if (extraData.relations) entry.relations = String(extraData.relations);
          if (extraData.profile) entry.profile = String(extraData.profile);
        }
        c.list.push(entry);
        saveCandidates(c);
      }
      function removeCandidateByName(name){
        const c = loadCandidates();
        c.list = c.list.filter(x => x.name !== name);
        saveCandidates(c);
      }

      function _now(){ return Date.now(); }
      function _fmtTime(ts){
        try{
          const d = new Date(ts||Date.now());
          return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        }catch(e){ return ''; }
      }

      function _safeArr(v){ return Array.isArray(v) ? v : []; }
      function _uniq(arr){
        const out=[]; const s=new Set();
        for (const x of arr){ const k=String(x||'').trim(); if(!k||s.has(k)) continue; s.add(k); out.push(k); }
        return out;
      }

      // ====== 联系人库（NPC）======
      function loadContactsDB(){
        const db = _phLoad(PHONE_IM_KEYS.contacts, null);
        if (db && typeof db === 'object' && Array.isArray(db.list)){
          // ✅ 一次性清零：把历史“自动/未知好友”全部归档到隐藏仓库（不删除）
          if (!db.__meowContactsZeroed){
            try{
              const hiddenKey = 'meow_phone_contacts_hidden_v1';
              const pack = { v:1, archivedAt:_now(), list: _safeArr(db.list) };
              _phSave(hiddenKey, pack);
            }catch(e){}
            db.list = [];
            db.__meowContactsZeroed = 1;
            try{ db.updatedAt = _now(); _phSave(PHONE_IM_KEYS.contacts, db); }catch(e){}
          }
          return db;
        }
        return { v:1, list:[], updatedAt:0, lastScanAt:0, __meowContactsZeroed:1 };
      }
      function saveContactsDB(db){
        db.updatedAt = _now();
        _phSave(PHONE_IM_KEYS.contacts, db);
      }
      function findContactById(db, id){
        return (db.list||[]).find(x => String(x.id) === String(id));
      }
      function findContactByName(db, name){
        const n = String(name||'').trim();
        return (db.list||[]).find(x => String(x.name).trim() === n);
      }

      function makeNPCId(name){
        // 稳定一点的 id（不引 crypto，避免兼容问题）
        const s = String(name||'npc').trim();
        let h = 0;
        for (let i=0;i<s.length;i++) h = ((h<<5)-h) + s.charCodeAt(i), h |= 0;
        return 'npc_' + Math.abs(h).toString(36);
      }

      function addOrUpdateNPC({ name, alias=[], profile='', avatar='', source='', identity='', appearance='', status='', relations='' }){
        const db = loadContactsDB();
        const n = String(name||'').trim();
        if (!n) return null;

        let npc = findContactByName(db, n);
        if (!npc){
          npc = { id: makeNPCId(n), name:n, alias:[], profile:'', avatar:(avatar||n.charAt(0)), createdAt:_now(), updatedAt:_now() };
          db.list.push(npc);
        }
        const al = _uniq([...(npc.alias||[]), ...(Array.isArray(alias)?alias:[])].map(x=>String(x||'').trim()).filter(Boolean));
        npc.alias = al;

        // C1: 支持结构化 profile（identity/appearance/status/relations）
        // 但如果传入了完整的 profile 文本且比结构化拼接更长，优先用 profile
        var structuredProfile = '';
        if (identity || appearance || status || relations){
          const parts = [];
          if (identity) parts.push('身份：' + String(identity).trim());
          if (appearance) parts.push('外貌：' + String(appearance).trim());
          if (status) parts.push('状态：' + String(status).trim());
          if (relations) parts.push('关系：' + String(relations).trim());
          structuredProfile = parts.join('\n');
        }

        // 选择更完整的 profile：完整文本 vs 结构化拼接
        var incomingProfile = (typeof profile === 'string') ? profile.trim() : '';
        if (incomingProfile && incomingProfile.length > (structuredProfile.length || 0)){
          npc.profile = incomingProfile;
        } else if (structuredProfile){
          npc.profile = structuredProfile;
        } else if (incomingProfile){
          npc.profile = incomingProfile;
        }
        // 如果都没有，保持原有 profile 不变

        if (typeof avatar === 'string' && avatar.trim()){
          npc.avatar = avatar.trim();
        } else if (!npc.avatar){
          npc.avatar = (npc.name||'?').charAt(0);
        }
        // C1: 记录导入来源
        if (source) npc.source = source;
        npc.updatedAt = _now();
        saveContactsDB(db);

        // 同步到 threads（至少出现一条）
        ensureThread(npc.id, npc.name, npc.avatar);
        return npc;
      }

      // ====== 从世界书“角色详情(role)”导入（如果有的话）======
      function _readRoleTextFromWB(){
        try{
          const wb = (typeof lsGet === 'function') ? lsGet(LS_WB, null) : null;
          if (!wb) return '';
          // ✅ v4结构：tabs+cards（总结模块本地数据格式）
          if (wb.v === 4 && Array.isArray(wb.tabs) && Array.isArray(wb.cards)){
            const roleTabs = wb.tabs.filter(function(t){
              return t.name && (t.name.indexOf('角色')>=0||t.name.indexOf('人物')>=0);
            });
            const parts = [];
            const tabList = roleTabs.length ? roleTabs : wb.tabs;
            for (const tab of tabList){
              const cards = wb.cards.filter(function(c){ return c.tab===tab.id && c.text && c.text.trim(); });
              for (const card of cards) parts.push(card.text.trim());
            }
            if (parts.length) return parts.join('\n').trim();
          }
          // 兼容旧frames结构
          const fr = (wb.frames && (wb.frames.role || wb.frames['角色详情'] || wb.frames['people'])) || null;
          if (!fr) return '';
          if (typeof fr === 'string') return fr;
          const parts2 = [];
          if (fr.note) parts2.push(String(fr.note));
          if (fr.text) parts2.push(String(fr.text));
          if (fr.content) parts2.push(String(fr.content));
          return parts2.join('\n').trim();
        }catch(e){ return ''; }
      }
      function _extractNPCNamesFromText(text){
        const s = String(text||'').replace(/\r/g,'\n').trim();
        if (!s) return [];

        const cand = [];

        // 1) 明确格式：角色名/姓名/名字：XXX
        {
          const lines = s.split('\n');
          for (const ln of lines){
            const m = ln.match(/^\s*(?:角色名|姓名|名字|角色)\s*[:：]\s*([A-Za-z\u4e00-\u9fa5·]{1,18})\b/);
            if (m && m[1]) cand.push(m[1]);
          }
        }

        // 2) 【角色名】XXX
        {
          const re = /【\s*([A-Za-z\u4e00-\u9fa5·]{1,18})\s*】/g;
          let m;
          while ((m = re.exec(s))) cand.push(m[1]);
        }

        return _uniq(cand);
      }

      function importNPCsFromRoleTab(){
        const roleText = _readRoleTextFromWB();
        if (!roleText) return 0;
        const names = _extractNPCNamesFromText(roleText);
        let n = 0;
        for (const name of names){
          const ok = addOrUpdateNPC({ name, profile:'' });
          if (ok) n++;
        }
        return n;
      }

      // ====== C1: 解析 markdown 表格（世界书角色详情用的格式）======
      function _parseMarkdownTable(text){
        const lines = String(text||'').split('\n').map(l => l.trim()).filter(Boolean);
        // 找表头行（含 | 且包含"角色"或"名"关键字）
        let headerIdx = -1;
        for (let i = 0; i < lines.length; i++){
          const ln = lines[i];
          if (ln.includes('|') && /角色名|角色|名字|姓名|name/i.test(ln)){
            headerIdx = i;
            break;
          }
        }
        if (headerIdx < 0) return [];

        // 解析表头
        const headerCells = lines[headerIdx].split('|').map(c => c.trim()).filter(Boolean);
        if (headerCells.length < 2) return [];

        // 映射列索引 → 字段名
        const colMap = {};
        for (let ci = 0; ci < headerCells.length; ci++){
          const h = headerCells[ci].toLowerCase();
          if (/^(角色名|角色|名字|姓名|name)$/.test(h)) colMap[ci] = 'name';
          else if (/^(身份|职业|identity|role|class)$/.test(h)) colMap[ci] = 'identity';
          else if (/^(外貌|外观|外在形象|appearance)$/.test(h)) colMap[ci] = 'appearance';
          else if (/^(性格|personality)$/.test(h)) colMap[ci] = 'personality';
          else if (/^(关系|relationship|relations)$/.test(h)) colMap[ci] = 'relations';
          else if (/^(好感|affection|favor)$/.test(h)) colMap[ci] = 'affection';
          else if (/^(状态|state|status)$/.test(h)) colMap[ci] = 'status';
        }
        if (!('name' in Object.values ? Object.values(colMap).includes('name') : Object.keys(colMap).some(k => colMap[k] === 'name'))) return [];

        // 跳过分隔行（---）
        let dataStart = headerIdx + 1;
        if (dataStart < lines.length && /^\|?\s*[-:]+/.test(lines[dataStart])) dataStart++;

        // 解析数据行
        const rows = [];
        for (let i = dataStart; i < lines.length; i++){
          const ln = lines[i];
          if (!ln.includes('|')) continue;
          if (/^\|?\s*[-:]+/.test(ln)) continue; // 跳过分隔行
          const cells = ln.split('|').map(c => c.trim()).filter((c,idx,arr) => {
            // 如果首尾为空（因为 |cell|cell| 分割），忽略
            return !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === '');
          });
          // 重新处理：直接用原始分割但去掉首尾空
          const rawCells = ln.split('|');
          const cleanCells = [];
          for (let ci = 0; ci < rawCells.length; ci++){
            const v = rawCells[ci].trim();
            cleanCells.push(v);
          }
          // 移除首尾空元素（| ... | 格式）
          if (cleanCells.length > 0 && cleanCells[0] === '') cleanCells.shift();
          if (cleanCells.length > 0 && cleanCells[cleanCells.length-1] === '') cleanCells.pop();

          if (cleanCells.length < 2) continue;

          const char = { name:'', identity:'', appearance:'', personality:'', relations:'', affection:'', status:'' };
          for (const ci of Object.keys(colMap)){
            const field = colMap[ci];
            const val = (cleanCells[Number(ci)] || '').trim();
            if (val) char[field] = val;
          }
          if (char.name) rows.push(char);
        }
        return rows;
      }

      // ====== C1: 世界书角色导入（从酒馆世界书条目的 markdown 表格解析角色）======
      // 异步：需要通过 TavernHelper 读取酒馆世界书
      async function _readWorldBookCharacters(){
        const chars = [];

        // 方案1：从酒馆世界书条目读取（优先，这才是真实数据源）
        try{
          const canW = await MEOW_WB_API.canWrite();
          if (canW){
            const { all } = await MEOW_WB_API.listEntries();
            for (const entry of all){
              if (!entry) continue;
              const comment = String(entry.comment || '');
              const content = String(entry.content || '');
              // 找「角色详情」相关条目（MEOW 写入的条目 comment 含 [MEOW]角色详情）
              if (comment.includes('角色详情') || comment.includes('角色') || content.includes('【角色详情】') || content.includes('| 角色名')){
                const tableChars = _parseMarkdownTable(content);
                for (const tc of tableChars){
                  // 避免重复
                  if (!chars.find(x => x.name === tc.name)){
                    chars.push(tc);
                  }
                }
              }
            }
          }
        }catch(e){ console.warn('[MEOW][C1] tavern WB read error:', e); }

        // 方案2：从本地 LS_WB 的 role tab 文本解析（回退）
        if (!chars.length){
          try{
            const roleText = _readRoleTextFromWB();
            if (roleText && roleText.trim()){
              // 尝试解析 markdown 表格
              const tableChars = _parseMarkdownTable(roleText);
              if (tableChars.length){
                for (const tc of tableChars) chars.push(tc);
              } else {
                // 回退到旧的文本块解析
                const blocks = roleText.split(/(?=【[^\]]{1,18}】)|(?=\n\s*(?:角色名|姓名|名字)\s*[:：])/);
                for (const block of blocks){
                  const nameMatch = block.match(/【\s*([A-Za-z\u4e00-\u9fa5·]{1,18})\s*】/) ||
                                    block.match(/^\s*(?:角色名|姓名|名字)\s*[:：]\s*([A-Za-z\u4e00-\u9fa5·]{1,18})/m);
                  if (nameMatch && nameMatch[1]){
                    const c = { name: nameMatch[1].trim(), identity:'', appearance:'', status:'', relations:'' };
                    const idM = block.match(/(?:身份|职业)\s*[:：]\s*(.+)/);
                    if (idM) c.identity = idM[1].trim().slice(0,300);
                    const apM = block.match(/(?:外貌|外观)\s*[:：]\s*(.+)/);
                    if (apM) c.appearance = apM[1].trim().slice(0,300);
                    const stM = block.match(/(?:状态)\s*[:：]\s*(.+)/);
                    if (stM) c.status = stM[1].trim().slice(0,300);
                    const rlM = block.match(/(?:关系)\s*[:：]\s*(.+)/);
                    if (rlM) c.relations = rlM[1].trim().slice(0,300);
                    if (!chars.find(x => x.name === c.name)) chars.push(c);
                  }
                }
              }
            }
          }catch(e){ console.warn('[MEOW][C1] local WB parse error:', e); }
        }

        return chars;
      }

      // ====== C1: 酒馆角色卡导入（读取 SillyTavern 当前角色卡的完整信息）======
      function _readSTCharacterCard(){
        try{
          const ctx = meowGetSTCtx();
          if (!ctx) return { available: false, characters: [] };

          const chars = [];

          // 方式1: 读取当前激活角色的完整数据
          if (ctx.name2){
            let desc = '';
            let personality = '';
            let scenario = '';

            // 从 ctx.characters 数组找当前角色
            if (ctx.characters && Array.isArray(ctx.characters) && typeof ctx.characterId !== 'undefined'){
              const curChar = ctx.characters[ctx.characterId];
              if (curChar){
                desc = curChar.description || curChar.data?.description || '';
                personality = curChar.personality || curChar.data?.personality || '';
                scenario = curChar.scenario || curChar.data?.scenario || '';
              }
            }

            // ctx.characterData 直取
            if (!desc && ctx.characterData){
              desc = ctx.characterData.description || ctx.characterData.data?.description || '';
              personality = personality || ctx.characterData.personality || ctx.characterData.data?.personality || '';
              scenario = scenario || ctx.characterData.scenario || ctx.characterData.data?.scenario || '';
            }

            // 兜底：从 chat 的 character_info 等
            if (!desc) desc = ctx.description || '';

            if (desc || personality){
              chars.push({
                name: String(ctx.name2),
                description: String(desc).slice(0, 3000),
                personality: String(personality).slice(0, 1000),
                scenario: String(scenario).slice(0, 500),
                avatar: ctx.characterData?.avatar || ''
              });
            }
          }

          // 方式2: 遍历所有角色卡（如果支持）
          if (!chars.length && ctx.characters && Array.isArray(ctx.characters)){
            for (const c of ctx.characters){
              if (!c || !c.name) continue;
              const desc = c.description || c.data?.description || '';
              const personality = c.personality || c.data?.personality || '';
              if (desc || personality){
                chars.push({
                  name: c.name,
                  description: String(desc).slice(0, 3000),
                  personality: String(personality).slice(0, 1000),
                  scenario: String(c.scenario || c.data?.scenario || '').slice(0, 500),
                  avatar: c.avatar || ''
                });
              }
            }
          }

          return { available: chars.length > 0, characters: chars };
        }catch(e){
          console.warn('[MEOW][C1] _readSTCharacterCard error:', e);
          return { available: false, characters: [] };
        }
      }

      // ====== C1: 用户人设导入（从当前 Persona 读取用户身份）======
      function _readSTPersona(){
        try{
          const ctx = meowGetSTCtx();
          if (!ctx) return null;

          const result = { name: '', description: '' };

          // 读 ST persona
          if (ctx.name1) result.name = String(ctx.name1);
          if (ctx.persona_description) result.description = String(ctx.persona_description).slice(0,500);

          // 也读小手机内部 persona 作为补充
          const active = _loadActivePersona();
          if (active && active.text && !result.description){
            result.description = String(active.text).slice(0,500);
          }
          if (!result.name && active && active.id){
            const personas = _loadPersonas();
            const p = _safeArr(personas.list).find(x => x.id === active.id);
            if (p) result.name = p.name || '';
          }

          return result;
        }catch(e){
          console.warn('[MEOW][C1] _readSTPersona error:', e);
          return null;
        }
      }

      // ====== C1: 从酒馆世界书条目读取角色信息（通过 TavernHelper） ======
      async function _readTavernWBCharacters(){
        const chars = [];
        try{
          const canW = await MEOW_WB_API.canWrite();
          if (!canW) return chars;
          const { all } = await MEOW_WB_API.listEntries();
          for (const entry of all){
            if (!entry || !entry.enabled) continue;
            const comment = String(entry.comment || '');
            const content = String(entry.content || '');
            // 尝试从条目中识别角色信息（comment 含角色名的条目）
            const nameMatch = comment.match(/(?:角色|character|npc)\s*[:：]?\s*([A-Za-z\u4e00-\u9fa5·]{1,18})/i) ||
                              comment.match(/^([A-Za-z\u4e00-\u9fa5·]{1,18})$/);
            if (nameMatch && nameMatch[1] && _looksLikePersonName(nameMatch[1])){
              chars.push({
                name: nameMatch[1].trim(),
                identity: content.slice(0,300),
                appearance: '',
                status: '',
                relations: '',
                source: 'worldbook'
              });
            }
          }
        }catch(e){ console.warn('[MEOW][C1] _readTavernWBCharacters error:', e); }
        return chars;
      }

// ====== 从主线聊天最近 N 条消息提取候选（优先：对白点名 + 动作主语）======
function _readLastNMainChatTexts(n=5){
  const out = [];
  try{
    const list = Array.from(doc.querySelectorAll('.mes'));
    const tail = list.slice(Math.max(0, list.length - Math.max(1,n)));
    for (const mes of tail){
      let txt = '';
      try{
        const t =
          mes.querySelector('.mes_text') ||
          mes.querySelector('.mes_textarea') ||
          mes.querySelector('.mes_text p') ||
          mes;
        txt = (t && t.textContent) ? String(t.textContent).trim() : '';
      }catch(e){ txt=''; }
      if (txt) out.push(txt);
    }
  }catch(e){}
  return out;
}

// 更保守的人名判断（避免 display/padding 这种）
function _looksLikePersonName(s){
  const w = String(s||'').trim();
  if (!w) return false;
  if (w.length > 18) return false;

  const BAN = new Set([
    '系统','旁白','叙述','Narrator','assistant','user',
    '我','你','我们','你们','他们','这里','那里','今天','明天','昨天',
    '时间','地点','环境','规则','事件','任务','道具','章节','主线','分支',
    '姓名','名字','名称','数值','动作','背景','目标坐标','验证通过',
    'background','width','height','display','padding','margin','border','color','opacity','font','style','css','html',
    '说','问','答','喊','叫','笑','看','听','想',
    '那个人','那人','某人','某某','他','她','它','他们','她们','它们',
    '男人','女人','少年','少女','老人','小孩','孩子','老头','先生','小姐','服务员','保安'
  ]);
  if (BAN.has(w)) return false;

  // 典型“泛指”直接踢掉
  if (/^(那|某).{0,3}人$/.test(w)) return false;

  if (/^\d+$/.test(w)) return false;
  if (/[#@￥$%^&*()_=+{}\[\]|\<>/]/.test(w)) return false;

  // 夹杂助词/人称，多半是短语不是名字
  if (w.length >= 2 && /[我你他她它们的了着过吗呢呀啊]/.test(w)) return false;

  // 中文名：允许 1~6（西里尔/萧）
  if (/^[\u4e00-\u9fa5]{1,6}$/.test(w)) return true;

  // 带中点译名：西里尔·xxx
  if (/^[\u4e00-\u9fa5]{1,8}(?:·[\u4e00-\u9fa5]{1,8})+$/.test(w)) return true;

  // 英文名：必须大写开头（避免 background/width）
  if (/^[A-Z][A-Za-z\-]{1,17}$/.test(w)) return true;

  return false;
}

// 证据1：行首说话人（最强） 例：西里尔：…… / 西里尔:……
function _extractLineSpeakers(text){
  const s = String(text||'').replace(/\r/g,'\n');
  const out = [];
  for (const ln of s.split('\n')){
    const m = ln.match(/^\s*([A-Za-z\u4e00-\u9fa5·]{1,18})\s*[:：]\s*(.{1,160})$/);
    if (!m) continue;

    const who = String(m[1]||'').trim();
    const rest = String(m[2]||'').trim();

    if (!_looksLikePersonName(who)) continue;

    // rest 像代码/样式则跳过
    if (/[;{}<>]/.test(rest)) continue;
    if (/(rgba\(|px\b|rem\b|em\b|#\w{3,8})/i.test(rest)) continue;
    if (/^\s*[A-Za-z_-]+\s*:\s*.+$/.test(rest)) continue;

    // 必须含中文或中文引号/标点，才像自然语言
    if (!/[\u4e00-\u9fa5“”！？。…，]/.test(rest)) continue;

    out.push(who);
  }
  return out;
}

// 证据2：对白里的“呼唤/点名”（强）
// 例： “看好了，西里尔。” / “西里尔？” / “……西里尔。”
// 只在中文引号 “ ” 内抓
function _extractVocativesFromQuotes(text){
  const s = String(text||'');
  const out = [];
  const reQ = /“([^”]{1,200})”/g;
  let mq;
  while ((mq = reQ.exec(s))){
    const q = mq[1];

    // 逗号后点名：，西里尔。 / ，萧？
    let m;
    const re1 = /[，,]\s*([A-Za-z\u4e00-\u9fa5·]{1,12})\s*[。！？!?…]*\s*$/g;
    // 对整个 q 只取末尾一次即可
    m = q.match(/[，,]\s*([A-Za-z\u4e00-\u9fa5·]{1,12})\s*[。！？!?…]*\s*$/);
    if (m && m[1]) out.push(m[1]);

    // 句尾直接点名：……西里尔。 / ……萧！
    m = q.match(/([A-Za-z\u4e00-\u9fa5·]{1,12})\s*[。！？!?…]\s*$/);
    if (m && m[1]) out.push(m[1]);

    // 句首点名：西里尔，……
    m = q.match(/^\s*([A-Za-z\u4e00-\u9fa5·]{1,12})\s*[，,]/);
    if (m && m[1]) out.push(m[1]);
  }
  return out;
}

// 证据3：叙述里的动作主语（中强）
// 例：萧突然转头看了我一眼 / 西里尔抬手… / 西里尔冷冷地说…
// 核心：Name + (少量副词) + Verb
function _extractActorsByVerbs(text){
  const s = String(text||'').replace(/\r/g,'\n');
  const out = [];

  // A) 常规：Name +（副词）+ 动词
  const ADVERB = '(?:突然|猛地|缓缓|轻轻|冷冷地|低声|悄声|忽然|立刻|随即|沉默地|漫不经心地|不动声色地)?';
  const VERB = '(?:说|问|答|喊|叫|笑|看|盯|瞥|转头|回头|抬眼|抬手|点头|摇头|皱眉|伸手|抓|握|推|拉|递|靠近|走|跑|停|站|坐|起身|俯身|靠|贴|挪|蹲|侧身|拍|敲|补充道|回答道|说道)';
  const reA = new RegExp('(?:^|[。！？\\n”])\\s*([A-Za-z\\u4e00-\\u9fa5·]{1,18})\\s*' + ADVERB + '\\s*' + VERB, 'g');
  let m;
  while ((m = reA.exec(s))){
    if (m && m[1]) out.push(m[1]);
  }

  // B) 发声归属：西里尔的声音听起来…… / 西里尔的语气……
  const VOICE_N = '(?:声音|嗓音|语气|声线|语调|口吻|笑声|话音|话)';
  const VOICE_V = '(?:听起来|听上去|显得|透着|带着|传来|响起|说道|说|问|轻声道|低声道|冷冷道|笑道|喃喃道|补充道|回答道)';
  const reB = new RegExp('(?:^|[。！？\\n”])\\s*([A-Za-z\\u4e00-\\u9fa5·]{1,18})\\s*的\\s*' + VOICE_N + '\\s*(?:还|却|似乎|仿佛)?\\s*' + VOICE_V, 'g');
  while ((m = reB.exec(s))){
    if (m && m[1]) out.push(m[1]);
  }

  return out;
}

// ✅ 总候选：用证据打分，避免“奇怪名词”
function getNPCCandidatesFromRecentMainChat(){
  const texts = _readLastNMainChatTexts(5);

  const score = Object.create(null);
  const add = (name, w)=>{
    const n = String(name||'').trim();
    if (!_looksLikePersonName(n)) return;
    score[n] = (score[n]||0) + (w||1);
  };

  for (const t of texts){
    // 行首说话人：权重高
    for (const n of _extractLineSpeakers(t)) add(n, 4);

    // 白话叙述里动作主语：权重中
    for (const n of _extractActorsByVerbs(t)) add(n, 3);

    // 引号对白里的点名：权重中高
    for (const n of _extractVocativesFromQuotes(t)) add(n, 3);
  }

  // 单字名太容易误抓：必须 >=3 分（命中动作主语/对白点名/行首之一就够）
  // 多字名：>=2 分
  const out = Object.keys(score)
    .filter(n=>{
      const sc = score[n]||0;
      if (/^[\u4e00-\u9fa5]{1}$/.test(n)) return sc >= 3;
      return sc >= 2;
    })
    .sort((a,b)=>(score[b]||0)-(score[a]||0))
    .slice(0, 5);

  return out;
}

      // ====== Threads / Logs（私聊）======
      function loadThreads(){
        const db = _phLoad(PHONE_IM_KEYS.threads, null);
        if (db && typeof db === 'object' && Array.isArray(db.list)) return db;
        return { v:1, list:[], updatedAt:0 };
      }
      function saveThreads(db){
        db.updatedAt = _now();
        _phSave(PHONE_IM_KEYS.threads, db);
      }
      function ensureThread(npcId, name, avatar){
        const th = loadThreads();
        let it = th.list.find(x => String(x.id) === String(npcId));
        if (!it){
          it = { id:String(npcId), name:String(name||npcId), avatar:(avatar||String(name||'?').charAt(0)), lastMsg:'', lastTime:0, unread:0, pinned:false };
          th.list.unshift(it);
          saveThreads(th);
        } else {
          // 更新显示名/头像
          it.name = String(name||it.name);
          if (avatar) it.avatar = avatar;
          saveThreads(th);
        }
        return it;
      }
      function bumpThread(npcId, patch){
        const th = loadThreads();
        const i = th.list.findIndex(x => String(x.id) === String(npcId));
        if (i < 0) return;
        const it = th.list[i];
        Object.assign(it, patch||{});
        // 置顶保留顺序，否则移动到最前
        th.list.splice(i,1);
        if (it.pinned) th.list.unshift(it); else th.list.unshift(it);
        saveThreads(th);
      }

      function loadLogs(){
        const db = _phLoad(PHONE_IM_KEYS.logs, null);
        if (db && typeof db === 'object' && db.map) return db;
        return { v:1, map:{}, updatedAt:0 };
      }
      function saveLogs(db){
        db.updatedAt = _now();
        _phSave(PHONE_IM_KEYS.logs, db);
      }
      function pushLog(npcId, role, text){
        const logs = loadLogs();
        logs.map ||= {};
        const id = String(npcId);
        logs.map[id] ||= [];
        logs.map[id].push({ role, text:String(text||''), t:_now() });
        // 控制长度（避免发烫/爆存储）
        if (logs.map[id].length > 200) logs.map[id] = logs.map[id].slice(-200);
        saveLogs(logs);
      }
      function getLog(npcId){
        const logs = loadLogs();
        return _safeArr(logs.map && logs.map[String(npcId)]);
      }

      // ====== 回写主线草稿队列（先入队列，不直接改主线）======
      function loadExportQ(){
        const db = _phLoad(PHONE_IM_KEYS.exportQ, null);
        if (db && typeof db === 'object' && Array.isArray(db.list)) return db;
        return { v:1, list:[], updatedAt:0 };
      }
      function saveExportQ(db){
        db.updatedAt = _now();
        _phSave(PHONE_IM_KEYS.exportQ, db);
      }

      function exportChatToMainDraft(){
        try{
          const npcId = state.chatTarget;
          if (!npcId){ try{ toast('未选中聊天对象'); }catch(e){} return; }

          const db = loadContactsDB();
          const npc = findContactById(db, npcId) || { id:npcId, name:String(npcId), profile:'' };

          const log = getLog(npcId);
          const tail = log.slice(-20);
          if (!tail.length){ try{ toast('暂无聊天记录可回写'); }catch(e){} return; }

          // 先做“草稿”，不做强总结（后面你可以接你的总结API）
          const lines = tail.map(x=>{
            const who = (x.role === 'me') ? '我' : npc.name;
            return `${who}：${x.text}`;
          }).join('\n');

          const draft = {
            id: 'draft_' + _now(),
            npcId: npc.id,
            npcName: npc.name,
            createdAt: _now(),
            text:
`【小手机私聊回写草稿】
对象：${npc.name}
参考：该 NPC 私聊最近 ${tail.length} 条

${lines}

【建议写入位置】
- 角色详情 / 事件 / 任务 / 线索（你可手动挑）
（此草稿不会自动写入主线，需要你在主线侧手动粘贴/整理）`
          };

          const q = loadExportQ();
          q.list.unshift(draft);
          if (q.list.length > 50) q.list = q.list.slice(0,50);
          saveExportQ(q);

          try{ toast('已生成回写草稿（已入队列）'); }catch(e){}
        }catch(e){
          try{ toast('回写草稿失败'); }catch(_){}
        }
      }

      // ====== UI：WeChat 4-Tab Shell（微信/通讯录/发现/我）======
      function renderChatsApp(container){
        const uid = _phUID();

        // ✅ 设置聊天 App 默认标题
        setAppBarTitle('聊天');

        // ✅ 注入 “三个点” 到 app bar 右侧（联动：添加好友 / 发起群聊）
        try{
          const spacer = root.querySelector('.phAppBarSpacer');
          if (spacer){
            spacer.innerHTML = `
              <button class="wxTopBtn wxAppBarPlus" data-act="wxPlusMenu"
                style="appearance:none;border:0;background:transparent;cursor:pointer;width:32px;height:32px;
                display:flex;align-items:center;justify-content:center;color:var(--ph-text);border-radius:8px;">
                <span class="wxTopDots" aria-hidden="true">⋯</span>
              </button>`;
          }
        }catch(e){}

        let html = `<div class="wxChatShell">
          <div class="wxChatContent" data-ph="chatTabContent"></div>
          <div class="wxTabbar">
            <button class="wxTabBtn chatTab on" data-act="chatTab" data-tab="msgs">
              <span class="ico"><svg class="phIco" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM8 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg></span><span class="txt">微信</span>
            </button>
            <button class="wxTabBtn chatTab" data-act="chatTab" data-tab="contacts">
              <span class="ico"><svg class="phIco" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg></span><span class="txt">通讯录</span>
            </button>
            <button class="wxTabBtn chatTab" data-act="chatTab" data-tab="discover">
              <span class="ico"><svg class="phIco" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z"/></svg></span><span class="txt">发现</span>
            </button>
            <button class="wxTabBtn chatTab" data-act="chatTab" data-tab="me">
              <span class="ico"><svg class="phIco" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></span><span class="txt">我</span>
            </button>
          </div>
        </div>`;

        container.innerHTML = html;
        renderChatMsgsList(container.querySelector('[data-ph="chatTabContent"]'));
      }

      function switchChatTab(el){
        const tab = el.getAttribute('data-tab');
        const tabs = root.querySelectorAll('.chatTab,wxTabBtn');
        tabs.forEach(t => t.classList.toggle('on', t === el));

        const content = root.querySelector('[data-ph="chatTabContent"]');
        if (!content) return;

        // ✅ 切 tab 先清掉可能残留的弹层
        try{ root.querySelectorAll('.wxPlusPopup,.wxConfirmOverlay').forEach(x=>x.remove()); }catch(e){}

        // ✅ 主 tab 切换：更新 _wxTab + 清空 _innerStack + 更新标题
        const mainTabs = ['msgs','contacts','discover','me'];
        const titleMap = { msgs:'聊天', contacts:'我的朋友', discover:'发现', me:'我' };
        if (mainTabs.includes(tab)){
          state._innerStack = [];
          state._wxTab = tab;
          setAppBarTitle(titleMap[tab] || '聊天');
        } else {
          // 子 tab（如 moments）：推入恢复当前主 tab 的函数
          const fromTab = state._wxTab || 'msgs';
          state._innerStack.push(() => {
            state._wxTab = fromTab;
            const btn = root.querySelector(`.wxTabBtn[data-tab="${fromTab}"]`);
            if (btn) switchChatTab(btn);
          });
        }

        // ✅ 切换 tab 时更新 app bar 右侧按钮
        try{
          const spacer = root.querySelector('.phAppBarSpacer');
          if (spacer){
            if (tab === 'msgs'){
              spacer.innerHTML = `
                <button class="wxTopBtn wxAppBarPlus" data-act="wxPlusMenu"
                  style="appearance:none;border:0;background:transparent;cursor:pointer;width:32px;height:32px;
                  display:flex;align-items:center;justify-content:center;color:var(--ph-text);border-radius:8px;">
                  <span class="wxTopDots" aria-hidden="true">⋯</span>
                </button>`;
            } else if (tab === 'contacts'){
              // ✅ 2.1 通讯录右上角小"+"：打开添加好友弹窗（与聊天⋯菜单完全同一个 _openAddFriendDialog）
              spacer.innerHTML = `
                <button class="wxTopBtn wxAppBarPlus" data-act="wxAddFriend"
                  style="appearance:none;border:0;background:transparent;cursor:pointer;width:32px;height:32px;
                  display:flex;align-items:center;justify-content:center;color:var(--ph-text);border-radius:8px;font-size:20px;font-weight:300;">
                  +
                </button>`;
            } else {
              spacer.innerHTML = '';
            }
          }
        }catch(e){}

        if (tab === 'msgs') renderChatMsgsList(content);
        else if (tab === 'contacts') renderChatContacts(content);
        else if (tab === 'discover') renderDiscoverPage(content);
        else if (tab === 'me') renderMePage(content);
        else if (tab === 'moments') { setAppBarTitle('朋友圈'); renderMoments(content); }
      }

      // 消息页：微信风格（干净列表，+号在app bar，仿真微信首页）
      function renderChatMsgsList(container){
        try{
          const uid = _phUID();
          const th = loadThreads();
          const pinned = _phLoad('pinned_chats_v1', []);

          // ✅ 只显示有实际聊天记录的会话（用户主动开启的对话才出现在首页）
          let listBase = _safeArr(th.list);
          try{
            const allow = new Set();
            const cdb = loadContactsDB();
            _safeArr(cdb.list).forEach(c=>allow.add(String(c.id)));
            const gs = _phLoad('groups_v1', {});
            Object.keys(gs||{}).forEach(id=>allow.add(String(id)));
            // 双重过滤：1) 在通讯录/群 2) 有实际聊天消息
            listBase = listBase.filter(x => {
              if (!allow.has(String(x.id))) return false;
              return !!(x.lastMsg || x.lastTime > 0);
            });
          }catch(e){
            listBase = _safeArr(th.list).filter(x => !!(x.lastMsg || x.lastTime > 0));
          }

          const list = listBase.slice().sort((a,b)=>{
            const pa = pinned.includes(a.id)?1:0, pb = pinned.includes(b.id)?1:0;
            if (pa !== pb) return pb - pa;
            return (b.lastTime||0)-(a.lastTime||0);
          });

          const _hm = (ts)=>{
            try{
              const d = new Date(ts);
              return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
            }catch(e){ return ''; }
          };

          let html = '';
          // ✅ 不再渲染 wxTopBar / wxSearchRow — +号已注入 phAppBarSpacer

          if (!list.length){
            html += `
              <div class="phPlaceholder" style="padding-top:24px;">
                <div class="phPlIcon">${_phFlatIcon('💬')}</div>
                <div class="phPlText">暂无会话<br>去「通讯录」选择角色开始私聊</div>
                <div style="margin-top:12px;">
                  <button class="weElBtn" data-act="chatTab" data-tab="contacts" style="padding:10px 14px;border-radius:14px;">${_phFlatIcon('👥')} 打开通讯录</button>
                </div>
              </div>`;
            container.innerHTML = html;
            return;
          }

          html += `<div class="chatList wxChatList">`;
          list.forEach(it=>{
            const t = it.lastTime ? _hm(it.lastTime) : '';
            const unread = Math.max(0, Number(it.unread||0));
            const av = esc((it.avatar||it.name||'?').charAt(0));
            const isPinned = pinned.includes(it.id);
            html += `<div class="chatItemSwipeWrap${isPinned?' chatItemPinned':''}" data-swipeid="${esc(it.id)}">
              <div class="swipeActions">
                <button class="swipeBtn pin" data-act="wxPinChat" data-npcid="${esc(it.id)}">${isPinned?'取消置顶':'置顶'}</button>
                <button class="swipeBtn del" data-act="wxDelChat" data-npcid="${esc(it.id)}">删除</button>
              </div>
              <div class="chatItemInner wxChatRow" data-chatid="${esc(it.id)}">
                <div class="cAvatar wxChatAvatar" style="position:relative;">${av}${unread>0?`<span class="wxBadge">${unread>99?'99+':unread}</span>`:''}</div>
                <div class="cInfo wxChatInfo">
                  <div class="wxChatInfoTop">
                    <div class="cName wxChatName">${esc(it.name||it.id)}</div>
                    <div class="cTime wxChatTime">${esc(t)}</div>
                  </div>
                  <div class="cLastMsg wxChatPreview">${esc(it.lastMsg||'')}</div>
                </div>
              </div>
            </div>`;
          });
          html += `</div>`;
          container.innerHTML = html;

          // 绑定左滑手势
          _bindSwipeGestures(container);
        }catch(e){
          container.innerHTML = `<div class="phPlaceholder"><div class="phPlIcon">${_phFlatIcon('💬')}</div><div class="phPlText">消息页渲染失败</div></div>`;
        }
      }

      // 左滑手势：置顶/删除
      function _bindSwipeGestures(container){
        let startX=0, startY=0, currentWrap=null, moved=false;

        const closeOthers = (keep)=>{
          container.querySelectorAll('.chatItemSwipeWrap.swiped').forEach(w=>{
            if (w !== keep) w.classList.remove('swiped');
          });
        };

        container.querySelectorAll('.chatItemSwipeWrap').forEach(wrap=>{
          const inner = wrap.querySelector('.chatItemInner');
          if (!inner) return;

          inner.addEventListener('touchstart',(e)=>{
            const t = e.touches[0];
            startX = t.clientX; startY = t.clientY;
            currentWrap = wrap; moved = false;
            closeOthers(wrap);
          },{passive:true});

          inner.addEventListener('touchmove',(e)=>{
            if (!currentWrap) return;
            const t = e.touches[0];
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;

            // 纵向滚动优先
            if (Math.abs(dy) > Math.abs(dx)) return;

            if (dx < -30){
              currentWrap.classList.add('swiped');
              moved = true;
              e.preventDefault();
            } else if (dx > 30){
              currentWrap.classList.remove('swiped');
              moved = true;
            }
          },{passive:false});

          inner.addEventListener('touchend',()=>{ currentWrap=null; },{passive:true});
          inner.addEventListener('touchcancel',()=>{ currentWrap=null; },{passive:true});

          // 鼠标兼容
          inner.addEventListener('mousedown',(e)=>{
            startX = e.clientX; startY = e.clientY;
            currentWrap = wrap; moved = false;
            closeOthers(wrap);
          });

          inner.addEventListener('mousemove',(e)=>{
            if (!currentWrap || !(e.buttons&1)) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dy) > Math.abs(dx)) return;

            if (dx < -30){
              currentWrap.classList.add('swiped');
              moved = true;
            } else if (dx > 30){
              currentWrap.classList.remove('swiped');
              moved = true;
            }
          });

          inner.addEventListener('mouseup',()=>{ currentWrap=null; });
          inner.addEventListener('mouseleave',()=>{ currentWrap=null; });
        });

        // 点空白处：收起所有左滑按钮
        container.addEventListener('click',(e)=>{
          const inRow = e.target.closest('.chatItemSwipeWrap');
          if (!inRow){
            try{ container.querySelectorAll('.chatItemSwipeWrap.swiped').forEach(w=>w.classList.remove('swiped')); }catch(_){}
          }
        }, {passive:true});
      }


      // +号/⋯ 弹出菜单（挂在 phApp 下，兼容 app bar 右上角按钮）
      // ✅ 目标：添加好友/发起群聊 100%可点、不会残留遮罩、图标跟“内部图标色”联动
      // ✅ 同一入口：聊天页 ⋯ / 通讯录右上角 +  → 统一走 _openAddFriendDialog + _confirmAddFriend
      function _wxClosePopups(){
        try{ root.querySelectorAll('.wxPlusPopup,.wxConfirmOverlay').forEach(x=>x.remove()); }catch(e){}
      }

      // ✅ 内部图标色：与你设置的 iconInnerHex 联动（phoneApplyVisualFromSettings 会写 --ph-icon-inner-tint）
      const _WX_INNER_ICO_COLOR = 'var(--ph-icon-inner-tint, var(--ph-text))';

      // ✅ iOS 扁平纯色小图标（不依赖 emoji，避免颜色/风格跑偏）
      function _wxIcoUserAdd(){
        return `<svg class="phIco" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9 12c2.21 0 4-1.79 4-4S11.21 4 9 4 5 5.79 5 8s1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h10v-2c0-1.45.64-2.55 1.74-3.36C11.55 14.32 10.36 14 9 14z"/>
          <path d="M19 8V6h-2v2h-2v2h2v2h2v-2h2V8z"/>
        </svg>`;
      }
      function _wxIcoGroup(){
        return `<svg class="phIco" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z"/>
          <path d="M16 13c-2.33 0-7 1.17-7 3.5V20h14v-3.5c0-2.33-4.67-3.5-7-3.5z"/>
          <path d="M8 13c-.29 0-.62.02-.97.05C5.14 13.32 3 14.26 3 16v4h6v-3.5c0-1.1.7-2.06 1.84-2.79C10.08 13.3 9.05 13 8 13z"/>
        </svg>`;
      }

      // ✅ 群聊/好友统一取“聊天对象元信息”
      // 群聊 id 规则：group_xxx，元数据在 _phLoad('groups_v1', {})
      function _wxGetChatTargetMeta(id){
        const cid = String(id || '').trim();
        if (!cid) return { id:'', name:'', avatar:'👤', profile:'' };

        // 1) 群聊
        if (/^group_/.test(cid)){
          const gs = _phLoad('groups_v1', {}) || {};
          const g = gs[cid];
          const name = String(g?.name || '群聊').trim() || '群聊';
          const members = Array.isArray(g?.members) ? g.members.map(x=>String(x||'').trim()).filter(Boolean) : [];
          return {
            id: cid,
            name,
            avatar: '👥', // ✅ 头像 token：列表渲染若走 _phFlatIcon(avatar) 也能出扁平风
            profile: members.length ? `群成员：${members.join('、')}` : ''
          };
        }

        // 2) 普通好友/NPC
        const db = loadContactsDB();
        let npc = null;
        try{
          npc = (typeof findContactById === 'function') ? findContactById(db, cid) : null;
          if (!npc && Array.isArray(db?.list)){
            npc = db.list.find(x=>String(x?.id)===cid) || null;
          }
        }catch(e){ npc = null; }

        if (npc){
          if (!npc.avatar) npc.avatar = (npc.name||'?').charAt(0);
          if (!npc.profile) npc.profile = '';
          return npc;
        }

        return { id:cid, name:cid, avatar:(cid.charAt(0)||'👤'), profile:'' };
      }

      function _wxRefreshChatsUI(){
        try{
          if (state?.app !== 'chats') return;
          const content = root.querySelector('[data-ph="chatTabContent"]');
          if (!content) return;

          if (state._wxTab === 'contacts') renderChatContacts(content);
          if (state._wxTab === 'msgs')     renderChatMsgsList(content);
        }catch(e){}
      }

      // ⋯ 菜单
      function _showPlusMenu(){
        _wxClosePopups();

        const popup = doc.createElement('div');
        popup.className = 'wxPlusPopup';
        popup.innerHTML = `
          <div class="wxPlusItem" data-act="wxAddFriend" style="display:flex;align-items:center;gap:10px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;color:${_WX_INNER_ICO_COLOR};width:18px;height:18px;">
              ${_wxIcoUserAdd()}
            </span>
            <span>添加好友</span>
          </div>
          <div class="wxPlusItem" data-act="wxCreateGroup" style="display:flex;align-items:center;gap:10px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;color:${_WX_INNER_ICO_COLOR};width:18px;height:18px;">
              ${_wxIcoGroup()}
            </span>
            <span>发起群聊</span>
          </div>
        `;

        // ✅ 挂在手机根节点（root 通常是 position:fixed），绝对定位样式由你现有 CSS 控制；没有 CSS 也能点
        root.appendChild(popup);

        // ✅ 点空白关闭（不残留遮罩/不劫持后续页面）
        const closer = (ev)=>{
          try{
            if (popup.contains(ev.target)) return;
            if (ev.target.closest?.('[data-act="wxPlusMenu"]')) return;
            popup.remove();
            root.removeEventListener('click', closer, true);
          }catch(e){}
        };
        setTimeout(()=>{ try{ root.addEventListener('click', closer, true); }catch(e){} }, 50);
      }

      // 添加自定义好友弹窗（通讯录右上角 + / 聊天页 ⋯ → 同一弹窗）
      function _openAddFriendDialog(){
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());

        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:260px;text-align:left;">
          <div style="font-weight:700;font-size:15px;color:rgba(20,24,28,.88);margin-bottom:14px;text-align:center;">添加好友</div>

          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:rgba(20,24,28,.55);margin-bottom:4px;">好友名称 *</div>
            <input data-field="name" placeholder="角色名" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;"/>
          </div>

          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:rgba(20,24,28,.55);margin-bottom:4px;">昵称</div>
            <input data-field="alias" placeholder="可选" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;"/>
          </div>

          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:rgba(20,24,28,.55);margin-bottom:4px;">备注</div>
            <input data-field="remark" placeholder="可选" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;"/>
          </div>

          <div style="margin-bottom:14px;">
            <div style="font-size:12px;color:rgba(20,24,28,.55);margin-bottom:4px;">人物设定</div>
            <textarea data-field="profile" placeholder="角色简介/设定（可选）" rows="3" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;resize:vertical;"></textarea>
          </div>

          <div style="display:flex;gap:8px;">
            <button data-act="wxAddFriendCancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.10);background:#fff;color:rgba(20,24,28,.60);font-size:13px;cursor:pointer;">取消</button>
            <button data-act="wxAddFriendConfirm" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">添加</button>
          </div>
        </div>`;

        root.appendChild(overlay);

        overlay.addEventListener('click',(e)=>{ if (e.target === overlay) overlay.remove(); });
        const nameInp = overlay.querySelector('[data-field="name"]');
        if (nameInp) setTimeout(()=>{ try{nameInp.focus();}catch(e){} }, 120);
      }

      function _wxUniq(arr){
        const s = new Set();
        const out = [];
        (arr||[]).forEach(x=>{
          const v = String(x||'').trim();
          if (!v) return;
          if (s.has(v)) return;
          s.add(v);
          out.push(v);
        });
        return out;
      }

      // ✅ 生成稳定一点的 id：同名会落到同一个 id（便于跨端/去重）
      function _wxMakeIdFromName(name){
        const s = String(name||'npc').trim();
        let h = 0;
        for (let i=0;i<s.length;i++) h = ((h<<5)-h) + s.charCodeAt(i), h |= 0;
        return 'npc_' + Math.abs(h).toString(36);
      }

      // 确认添加好友（真正写入 contactsDB；并保证通讯录 / 群聊选择器能读到）
      function _confirmAddFriend(){
        const overlay = root.querySelector('.wxConfirmOverlay');
        if (!overlay) return;

        const name = (overlay.querySelector('[data-field="name"]')?.value||'').trim();
        if (!name){
          try{toast('请输入好友名称');}catch(e){}
          return;
        }

        const alias  = (overlay.querySelector('[data-field="alias"]')?.value||'').trim();
        const remark = (overlay.querySelector('[data-field="remark"]')?.value||'').trim();
        const profile= (overlay.querySelector('[data-field="profile"]')?.value||'').trim();

        const db = loadContactsDB();
        db.list ||= [];

        // 找同名（优先用你已有的 findContactByName）
        let npc = null;
        try{
          npc = (typeof findContactByName === 'function') ? findContactByName(db, name) : null;
        }catch(e){ npc = null; }
        if (!npc){
          npc = db.list.find(x=>String(x?.name||'').trim()===name) || null;
        }

        if (!npc){
          npc = {
            id: _wxMakeIdFromName(name),
            name,
            alias: [],
            remark: '',
            profile: '',
            avatar: (name.charAt(0) || '👤'),
            createdAt: _now(),
            updatedAt: _now(),
            kind: 'friend'
          };
          db.list.push(npc);
        }

        // 合并字段
        if (alias){
          npc.alias = _wxUniq([...(npc.alias||[]), alias]);
        }
        if (remark)  npc.remark  = remark;
        if (profile) npc.profile = profile;
        npc.updatedAt = _now();

        saveContactsDB(db);

        // ✅ 只 ensureThread，不 bumpThread（保持“无聊天不出现在消息首页”的微信逻辑）
        try{ ensureThread(npc.id, npc.name, npc.avatar); }catch(e){}

        overlay.remove();
        try{toast(`已添加好友：${npc.name}`);}catch(e){}

        // 如果当前就在通讯录 / 消息页，立刻刷新
        _wxRefreshChatsUI();
      }

      // 发起群聊弹窗：从“现有好友/NPC”中选成员
      function _openCreateGroupDialog(){
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());

        const db = loadContactsDB();
        const list = Array.isArray(db?.list) ? db.list.slice() : [];
        // 过滤：剔除空项/无 id
        const people = list.filter(c=>c && String(c.id||'').trim() && String(c.name||'').trim());

        if (people.length < 2){
          try{toast('至少需要 2 个好友才能发起群聊');}catch(e){}
          return;
        }

        const checkHtml = people.map(c=>`
          <label style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:10px;cursor:pointer;">
            <input type="checkbox" value="${esc(c.id)}" style="width:16px;height:16px;"/>
            <span style="display:inline-flex;width:26px;height:26px;border-radius:10px;align-items:center;justify-content:center;background:rgba(255,255,255,.78);border:1px solid rgba(0,0,0,.06);color:${_WX_INNER_ICO_COLOR};">
              ${_phFlatIcon(c.avatar || (c.name||'?').charAt(0))}
            </span>
            <span style="font-size:13px;color:var(--ph-text);">${esc(c.name)}</span>
          </label>
        `).join('');

        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:260px;text-align:left;">
          <div style="font-weight:700;font-size:15px;color:rgba(20,24,28,.88);margin-bottom:12px;text-align:center;">发起群聊</div>

          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:rgba(20,24,28,.55);margin-bottom:4px;">群名称</div>
            <input data-field="groupName" placeholder="可选，默认用成员名" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;"/>
          </div>

          <div style="font-size:12px;color:rgba(20,24,28,.55);margin-bottom:6px;">选择成员（至少2人）</div>
          <div style="max-height:180px;overflow-y:auto;margin-bottom:14px;">${checkHtml}</div>

          <div style="display:flex;gap:8px;">
            <button data-act="wxCreateGroupCancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.10);background:#fff;color:rgba(20,24,28,.60);font-size:13px;cursor:pointer;">取消</button>
            <button data-act="wxCreateGroupConfirm" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">创建</button>
          </div>
        </div>`;

        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{ if (e.target===overlay) overlay.remove(); });
      }

      // 确认创建群聊：写 groups_v1 + ensureThread + bumpThread（让群聊出现在消息首页）
      function _confirmCreateGroup(){
        const overlay = root.querySelector('.wxConfirmOverlay');
        if (!overlay) return;

        const groupName = (overlay.querySelector('[data-field="groupName"]')?.value||'').trim();
        const checks = overlay.querySelectorAll('input[type="checkbox"]:checked');
        const ids = Array.from(checks).map(c=>String(c.value||'').trim()).filter(Boolean);

        if (ids.length < 2){
          try{toast('请至少选择2人');}catch(e){}
          return;
        }

        const db = loadContactsDB();
        const names = ids.map(id=>{
          const c = (typeof findContactById==='function') ? findContactById(db,id) : null;
          return c ? c.name : id;
        }).filter(Boolean);

        const gName = groupName || (names.slice(0,3).join('、') + (names.length>3?'…':''));
        const gId = 'group_' + Date.now().toString(36);

        const groups = _phLoad('groups_v1', {}) || {};
        groups[gId] = { name:gName, members:ids, createdAt:_now() };
        _phSave('groups_v1', groups);

        // ✅ 线程：让它立刻出现在“聊天首页”
        try{ ensureThread(gId, gName, '👥'); }catch(e){}
        try{ bumpThread(gId, { lastMsg:'群聊已创建', lastTime:_now(), unread:0 }); }catch(e){}

        overlay.remove();
        try{toast(`群聊「${gName}」已创建`);}catch(e){}

        // ✅ 进入群聊（renderChatDetail 会用 _wxGetChatTargetMeta 正确显示群名）
        openChat(gId);

        // ✅ 如果回到 msgs 列表，也能看到新群聊
        _wxRefreshChatsUI();
      }

      // 置顶/取消置顶聊天
      function _togglePinChat(npcId){
        let pinned = _phLoad('pinned_chats_v1', []);
        if (pinned.includes(npcId)) pinned = pinned.filter(x=>x!==npcId);
        else pinned.push(npcId);
        _phSave('pinned_chats_v1', pinned);
        const content = root.querySelector('[data-ph="chatTabContent"]');
        if (content) renderChatMsgsList(content);
      }

      // 删除聊天（带确认）
      function _confirmDeleteChat(npcId){
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const th = loadThreads();
        const thread = _safeArr(th.list).find(x=>x.id===npcId);
        const name = thread ? (thread.name||npcId) : npcId;
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        overlay.innerHTML = `<div class="wxConfirmBox">
          <div class="wxCMsg">确定删除与「${esc(name)}」的聊天记录吗？<br><span style="font-size:12px;color:rgba(20,24,28,.4);">此操作不可恢复</span></div>
          <div class="wxCBtns">
            <button class="wxCBtn" data-act="wxDelChatCancel">取消</button>
            <button class="wxCBtn" data-act="wxDelChatOk" data-npcid="${esc(npcId)}">删除</button>
          </div>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{ if(e.target===overlay) overlay.remove(); });
      }

      function _doDeleteChat(npcId){
        // 删除线程
        const th = loadThreads();
        th.list = _safeArr(th.list).filter(x=>x.id!==npcId);
        saveThreads(th);
        // 删除聊天记录
        const lg = loadLogs();
        if (lg.map && lg.map[npcId]) delete lg.map[npcId];
        saveLogs(lg);
        // 移除置顶
        let pinned = _phLoad('pinned_chats_v1', []);
        pinned = pinned.filter(x=>x!==npcId);
        _phSave('pinned_chats_v1', pinned);
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        try{toast('已删除');}catch(e){}
        const content = root.querySelector('[data-ph="chatTabContent"]');
        if (content) renderChatMsgsList(content);
      }


      // 通讯录：微信风格 = 顶栏 + 新的朋友/分组/NPC列表(手风琴)
      // NPC来源：角色卡 > 主线AI回复 > 手动添加
      function renderChatContacts(container){
        const db = loadContactsDB();
        // ✅ 隐藏被拉黑的联系人（不删除数据）
        const contacts = _safeArr(db.list).filter(c => !isBlacklisted(c.name) && !isBlacklisted(c.id));
        const storedCand = loadCandidates();
        // ✅ 候选数量：只显示“你手动产生并持久化”的候选
        const candNames = new Set();
        for (const sc of _safeArr(storedCand.list)){
          if (!findContactByName(db, sc.name) && !isBlacklisted(sc.name)) candNames.add(sc.name);
        }
        const candCount = candNames.size;

        // 加载自定义分组
        const groupsDef = _phLoad('contact_groups_v1', { list:[
          {id:'default', name:'好友', icon:'👥'},
          {id:'npc', name:'npc', icon:'🤖'}
        ]});
        const groups = _safeArr(groupsDef.list);

        let html = '';
        // ✅ 不再渲染 wxTopBar（标题已由 setAppBarTitle 在 switchChatTab 设置）
        // 搜索行保留
        html += `<div class="wxSearchRow"><div class="wxSearchBox">${_phFlatIcon('🔍')}<span>搜索</span></div></div>`;

        // 新的朋友入口
        html += `<div class="wxContactHeader" data-act="wxNewFriends" style="margin-top:0;">
          <div class="wxCHIco">${_phFlatIcon('👥')}</div>
          <div class="wxCHName">新的朋友</div>
          ${candCount?`<div class="wxCHBadge" style="background:#ef4444;color:#fff;border-radius:10px;padding:2px 8px;font-size:11px;">${candCount}</div>`:''}
          <div class="wxDArrow">›</div>
        </div>`;

        // 分组入口
        html += `<div class="wxContactHeader" data-act="wxManageGroups">
          <div class="wxCHIco">${_phFlatIcon('📖')}</div>
          <div class="wxCHName">分组</div>
          <div class="wxDArrow">›</div>
        </div>`;

        // ✅ 角色详情导入 / 主线扫描 已移入「新的朋友」子页面

        // ✅ 主线候选 NPC 已移入「新的朋友」子页面

        if (!contacts.length && !candCount){
          html += `<div class="phPlaceholder" style="padding-top:30px;"><div class="phPlIcon">👥</div><div class="phPlText">通讯录为空<br>点击右上角＋添加好友</div></div>`;
          container.innerHTML = html; bindContactsActions(container); return;
        }

        // 分组手风琴列表
        if (contacts.length){
          // 把联系人分到各组
          const contactGroups = {};
          for (const g of groups) contactGroups[g.id] = [];
          contactGroups['_ungrouped'] = [];
          for (const c of contacts){
            const gid = c.group || 'default';
            if (contactGroups[gid]) contactGroups[gid].push(c);
            else contactGroups['_ungrouped'].push(c);
          }

          for (const g of groups){
            const members = contactGroups[g.id] || [];
            // ✅ 允许显示空分组（否则新建分组会“看不到”，像是没生效）
            // if (!members.length && g.id !== 'default') continue;
            html += `<div class="wxGroupAccordion"><div class="wxGroupHeader" data-act="wxToggleGroup" data-gid="${esc(g.id)}">
              <span class="wxGArrow">›</span>
              <span>${esc(g.icon||'👥')} ${esc(g.name)} (${members.length})</span>
            </div><div class="wxGroupBody" data-gbody="${esc(g.id)}">`;
            for (const c of members){
              html += `<div class="wxContactItem" data-chatid="${esc(c.id)}">
                <div class="wxCIAvatar">${esc((c.avatar||c.name||'?').charAt(0))}</div>
                <div class="wxCIName">${esc(c.name)}</div>
              </div>`;
            }
            if (!members.length) html += `<div style="padding:12px 30px;font-size:12px;color:rgba(20,24,28,.35);">暂无成员</div>`;
            html += `</div></div>`;
          }

          // 未分组的
          const ungrouped = contactGroups['_ungrouped'] || [];
          if (ungrouped.length){
            html += `<div class="wxGroupAccordion"><div class="wxGroupHeader" data-act="wxToggleGroup" data-gid="_ungrouped">
              <span class="wxGArrow">›</span><span>未分组 (${ungrouped.length})</span>
            </div><div class="wxGroupBody" data-gbody="_ungrouped">`;
            for (const c of ungrouped){
              html += `<div class="wxContactItem" data-chatid="${esc(c.id)}">
                <div class="wxCIAvatar">${esc((c.avatar||c.name||'?').charAt(0))}</div>
                <div class="wxCIName">${esc(c.name)}</div>
              </div>`;
            }
            html += `</div></div>`;
          }
        }

        container.innerHTML = html; bindContactsActions(container);
      }

      function bindContactsActions(container){
        try{
          container.querySelectorAll('[data-act="phAddNpc"]').forEach(btn=>{
            btn.addEventListener('click', ()=> _openAddFriendDialog());
          });
          // ✅ phImportRole / phScanMain / phPickCand 已移入 _renderNewFriendsPage
          // 手风琴展开/收起
          container.querySelectorAll('[data-act="wxToggleGroup"]').forEach(hdr=>{
            hdr.addEventListener('click', ()=>{
              const gid = hdr.getAttribute('data-gid');
              const body = container.querySelector(`[data-gbody="${gid}"]`);
              if (!body) return;
              const isOpen = hdr.classList.toggle('open');
              body.classList.toggle('open', isOpen);
            });
          });
          // 分组管理入口
          container.querySelectorAll('[data-act="wxManageGroups"]').forEach(btn=>{
            btn.addEventListener('click', ()=> _openGroupManager(container));
          });
          // 新朋友入口 → 打开子页面（含候选列表 + 角色导入 + 主线扫描）
          container.querySelectorAll('[data-act="wxNewFriends"]').forEach(btn=>{
            btn.addEventListener('click', ()=> {
              state._innerStack.push(() => {
                const c = root.querySelector('[data-ph="chatTabContent"]');
                if (c) renderChatContacts(c);
              });
              _renderNewFriendsPage(container);
            });
          });
        }catch(e){}
      }

      // ========== C1: 新的朋友 子页面（四种导入方式 + 候选列表） ==========
      function _renderNewFriendsPage(parentContainer){
        // 合并：持久化候选列表，去掉已是好友的
        const db = loadContactsDB();
        const stored = loadCandidates();

        const allNames = new Set();
        const merged = [];
        for (const sc of _safeArr(stored.list)){
          const nm = String(sc.name||'').trim();
          if (!nm) continue;
          if (!findContactByName(db, nm)){
            if (!allNames.has(nm)){
              allNames.add(nm);
              merged.push(sc);
            }
          }
        }

        setAppBarTitle('新的朋友');
        let html = '';

        // C1: 四种导入方式（列表样式）
        html += '<div style="padding:12px 14px 4px;font-size:12px;color:rgba(20,24,28,.4);font-weight:500;">导入方式</div>';
        html += '<div style="margin:0 14px;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.82);border:1px solid rgba(0,0,0,.06);">';
        html += '<div class="wxContactHeader" data-act="c1ImportWB" style="margin:0;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer;"><div class="wxCHIco" style="font-size:18px;">📖</div><div class="wxCHName" style="flex:1;">世界书角色导入</div><div class="wxDArrow" style="color:rgba(20,24,28,.3);">›</div></div>';
        html += '<div class="wxContactHeader" data-act="c1ImportSTCard" style="margin:0;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer;"><div class="wxCHIco" style="font-size:18px;">🎭</div><div class="wxCHName" style="flex:1;">酒馆角色卡导入</div><div class="wxDArrow" style="color:rgba(20,24,28,.3);">›</div></div>';
        html += '<div class="wxContactHeader" data-act="c1ImportPersona" style="margin:0;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer;"><div class="wxCHIco" style="font-size:18px;">👤</div><div class="wxCHName" style="flex:1;">用户人设导入</div><div class="wxDArrow" style="color:rgba(20,24,28,.3);">›</div></div>';
        html += '<div class="wxContactHeader" data-act="c1ScanMain" style="margin:0;padding:12px 14px;cursor:pointer;"><div class="wxCHIco" style="font-size:18px;">🔍</div><div class="wxCHName" style="flex:1;">主线扫描</div><div class="wxDArrow" style="color:rgba(20,24,28,.3);">›</div></div>';
        html += '</div>';

        // 候选列表
        if (merged.length){
          html += '<div style="padding:16px 14px 4px;font-size:12px;color:rgba(20,24,28,.4);font-weight:500;display:flex;align-items:center;justify-content:space-between;"><span>候选联系人 (' + merged.length + ')</span><button data-act="wxHideAllCand" style="appearance:none;border:0;background:transparent;color:rgba(20,24,28,.35);font-size:11px;cursor:pointer;">全部清除</button></div>';
          for (const c of merged){
            const srcTag = c.source === 'worldbook' ? '📖' : (c.source === 'stcard' ? '🎭' : (c.source === 'persona' ? '👤' : (c.source === 'scan' ? '🔍' : '✨')));
            const profileSnip = (c.identity || c.profile || '').slice(0,40);
            html += '<div class="wxContactItem" style="display:flex;align-items:center;padding:10px 14px;">';
            html += '<div class="wxCIAvatar" style="background:linear-gradient(135deg,#e8d5f5,#f5e6d5);flex-shrink:0;">' + srcTag + '</div>';
            html += '<div style="flex:1;margin-left:10px;overflow:hidden;">';
            html += '<div class="wxCIName" style="font-size:14px;">' + esc(c.name) + '</div>';
            if (profileSnip) html += '<div style="font-size:11px;color:rgba(20,24,28,.4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(profileSnip) + '</div>';
            html += '</div>';
            html += '<button data-act="phAcceptCand" data-name="' + esc(c.name) + '" style="appearance:none;border:0;background:#07c160;color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">+</button>';
            html += '</div>';
          }
        } else {
          html += '<div class="phPlaceholder" style="padding-top:30px;"><div class="phPlIcon">' + _phFlatIcon('👥') + '</div><div class="phPlText">暂无新的候选<br>使用上方导入方式添加角色</div></div>';
        }

        parentContainer.innerHTML = html;

        // 绑定事件
        parentContainer.querySelectorAll('[data-act="wxHideAllCand"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            saveCandidates({ v:1, list:[] });
            _renderNewFriendsPage(parentContainer);
            try{ toast('已全部清除'); }catch(e){}
          });
        });

        // C1: 世界书角色导入 → 子页面
        parentContainer.querySelectorAll('[data-act="c1ImportWB"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            state._innerStack.push(() => _renderNewFriendsPage(parentContainer));
            _renderWBImportPage(parentContainer);
          });
        });

        // C1: 酒馆角色卡导入 → 子页面
        parentContainer.querySelectorAll('[data-act="c1ImportSTCard"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            state._innerStack.push(() => _renderNewFriendsPage(parentContainer));
            _renderSTCardImportPage(parentContainer);
          });
        });

        // C1: 用户人设导入
        parentContainer.querySelectorAll('[data-act="c1ImportPersona"]').forEach(btn=>{
          btn.addEventListener('click', ()=> _doPersonaImport(parentContainer));
        });

        // C1: 主线扫描（已限制 ≤ 5）
        parentContainer.querySelectorAll('[data-act="c1ScanMain"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const names = getNPCCandidatesFromRecentMainChat();
            if (!names.length){ try{toast('未从最近消息识别到角色');}catch(e){} return; }
            let added = 0;
            for (const nm of names){
              if (!findContactByName(loadContactsDB(), nm)){
                addCandidate(nm, 'scan');
                added++;
              }
            }
            _renderNewFriendsPage(parentContainer);
            try{toast(added ? '发现 ' + added + ' 个候选，点+添加好友' : '所有候选已在列表中');}catch(e){}
          });
        });

        // 点 + 号：确认加好友（携带结构化数据）
        parentContainer.querySelectorAll('[data-act="phAcceptCand"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const n = btn.getAttribute('data-name') || '';
            if (!n.trim()) return;
            const cand = _safeArr(loadCandidates().list).find(x => x.name === n.trim());
            addOrUpdateNPC({
              name: n.trim(), alias: [],
              profile: (cand && cand.profile) || '',
              source: (cand && cand.source) || '',
              identity: (cand && cand.identity) || '',
              appearance: (cand && cand.appearance) || '',
              status: (cand && cand.status) || '',
              relations: (cand && cand.relations) || ''
            });
            removeCandidateByName(n.trim());
            _renderNewFriendsPage(parentContainer);
            try{ toast('已加入通讯录'); }catch(e){}
          });
        });
      }

      // ========== C1: 世界书角色导入 子页面 ==========
      function _renderWBImportPage(parentContainer){
        setAppBarTitle('世界书角色导入');

        // 显示加载中
        parentContainer.innerHTML = '<div class="phPlaceholder" style="padding-top:40px;"><div class="phPlIcon">' + _phFlatIcon('📖') + '</div><div class="phPlText">正在读取世界书条目…</div></div>';

        // 异步读取
        _readWorldBookCharacters().then(function(chars){
          _renderWBImportPageWithData(parentContainer, chars);
        }).catch(function(e){
          console.warn('[MEOW][C1] WB import error:', e);
          _renderWBImportPageWithData(parentContainer, []);
        });
      }

      function _renderWBImportPageWithData(parentContainer, chars){
        let html = '';

        if (!chars.length){
          html += '<div class="phPlaceholder" style="padding-top:40px;"><div class="phPlIcon">' + _phFlatIcon('📖') + '</div><div class="phPlText">未从世界书中读取到角色<br><span style="font-size:11px;color:rgba(20,24,28,.35);">请确保酒馆世界书中有包含角色表格的条目<br>（含 | 角色名 | 身份 | 外貌 | 等列）</span></div></div>';
        } else {
          html += '<div style="padding:12px 14px 6px;font-size:12px;color:rgba(20,24,28,.4);font-weight:500;">找到 ' + chars.length + ' 个角色</div>';
          html += '<div style="padding:0 14px;"><button data-act="c1WBImportAll" style="width:100%;padding:10px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.82);color:#07c160;font-size:13px;font-weight:500;cursor:pointer;margin-bottom:8px;">全部导入为候选</button></div>';
          for (var i = 0; i < chars.length; i++){
            var c = chars[i];
            var alreadyContact = !!findContactByName(loadContactsDB(), c.name);
            var alreadyCand = !!_safeArr(loadCandidates().list).find(function(x){ return x.name === c.name; });
            var statusText = alreadyContact ? '已是好友' : (alreadyCand ? '已在候选' : '');
            html += '<div style="margin:0 14px 8px;padding:14px;border-radius:14px;background:rgba(255,255,255,.82);border:1px solid rgba(0,0,0,.06);">';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">';
            html += '<span style="font-size:14px;font-weight:600;color:rgba(20,24,28,.85);">' + esc(c.name) + '</span>';
            html += statusText ? '<span style="font-size:11px;color:rgba(20,24,28,.4);">' + statusText + '</span>' : '<button data-act="c1WBImportOne" data-cidx="' + i + '" style="border:0;background:#07c160;color:#fff;font-size:11px;padding:4px 10px;border-radius:8px;cursor:pointer;">导入</button>';
            html += '</div>';
            if (c.identity) html += '<div style="font-size:12px;color:rgba(20,24,28,.55);margin-top:2px;">身份：' + esc(c.identity.slice(0,100)) + '</div>';
            if (c.appearance) html += '<div style="font-size:12px;color:rgba(20,24,28,.55);margin-top:2px;">外貌：' + esc(c.appearance.slice(0,100)) + '</div>';
            if (c.personality) html += '<div style="font-size:12px;color:rgba(20,24,28,.55);margin-top:2px;">性格：' + esc(c.personality.slice(0,100)) + '</div>';
            if (c.relations) html += '<div style="font-size:12px;color:rgba(20,24,28,.55);margin-top:2px;">关系：' + esc(c.relations.slice(0,100)) + '</div>';
            if (c.affection) html += '<div style="font-size:12px;color:rgba(20,24,28,.55);margin-top:2px;">好感：' + esc(c.affection.slice(0,60)) + '</div>';
            if (c.status) html += '<div style="font-size:12px;color:rgba(20,24,28,.55);margin-top:2px;">状态：' + esc(c.status.slice(0,100)) + '</div>';
            html += '</div>';
          }
        }

        parentContainer.innerHTML = html;

        parentContainer.querySelectorAll('[data-act="c1WBImportAll"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            var added = 0;
            for (var ci = 0; ci < chars.length; ci++){
              if (!findContactByName(loadContactsDB(), chars[ci].name)){
                addCandidate(chars[ci].name, 'worldbook', chars[ci]);
                added++;
              }
            }
            try{ toast(added ? '已添加 ' + added + ' 个候选' : '所有角色已在列表中'); }catch(e){}
            _renderWBImportPageWithData(parentContainer, chars);
          });
        });

        parentContainer.querySelectorAll('[data-act="c1WBImportOne"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            var idx = Number(btn.getAttribute('data-cidx'));
            var ch = chars[idx];
            if (!ch) return;
            addCandidate(ch.name, 'worldbook', ch);
            try{ toast(ch.name + ' 已加入候选'); }catch(e){}
            _renderWBImportPageWithData(parentContainer, chars);
          });
        });
      }

      // ========== C1: 酒馆角色卡导入 子页面 ==========
      function _renderSTCardImportPage(parentContainer){
        setAppBarTitle('酒馆角色卡导入');
        var result = _readSTCharacterCard();
        let html = '';

        if (!result || !result.available || !result.characters.length){
          html += '<div class="phPlaceholder" style="padding-top:40px;"><div class="phPlIcon">' + _phFlatIcon('🎭') + '</div><div class="phPlText">未能读取酒馆角色卡<br><span style="font-size:11px;color:rgba(20,24,28,.35);">请确保在 SillyTavern 中已选择角色<br>或 TavernHelper API 可用</span></div></div>';
        } else {
          html += '<div style="padding:12px 14px 6px;font-size:12px;color:rgba(20,24,28,.4);font-weight:500;">找到 ' + result.characters.length + ' 个角色卡</div>';
          for (var i = 0; i < result.characters.length; i++){
            var c = result.characters[i];
            if (!c.name) continue;
            var alreadyContact = !!findContactByName(loadContactsDB(), c.name);
            var alreadyCand = !!_safeArr(loadCandidates().list).find(function(x){ return x.name === c.name; });
            var statusText = alreadyContact ? '已是好友' : (alreadyCand ? '已在候选' : '');
            var desc = (c.description || c.personality || '').slice(0,100);
            html += '<div style="margin:0 14px 8px;padding:14px;border-radius:14px;background:rgba(255,255,255,.82);border:1px solid rgba(0,0,0,.06);">';
            html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">';
            html += '<span style="font-size:14px;font-weight:600;color:rgba(20,24,28,.85);">🎭 ' + esc(c.name) + '</span>';
            html += statusText ? '<span style="font-size:11px;color:rgba(20,24,28,.4);">' + statusText + '</span>' : '<button data-act="c1STImportOne" data-cidx="' + i + '" style="border:0;background:#07c160;color:#fff;font-size:11px;padding:4px 10px;border-radius:8px;cursor:pointer;">导入</button>';
            html += '</div>';
            if (desc) html += '<div style="font-size:12px;color:rgba(20,24,28,.5);margin-top:4px;max-height:60px;overflow:hidden;white-space:pre-wrap;">' + esc(desc) + '</div>';
            html += '</div>';
          }
        }

        parentContainer.innerHTML = html;

        parentContainer.querySelectorAll('[data-act="c1STImportOne"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            var idx = Number(btn.getAttribute('data-cidx'));
            var ch = result.characters[idx];
            if (!ch) return;
            // 将角色卡的完整描述作为 profile 和 identity 传入
            var fullProfile = [ch.description, ch.personality, ch.scenario].filter(Boolean).join('\n');
            addCandidate(ch.name, 'stcard', {
              profile: fullProfile.slice(0, 3000),
              identity: (ch.description || '').slice(0, 1000)
            });
            try{ toast(ch.name + ' 已加入候选'); }catch(e){}
            _renderSTCardImportPage(parentContainer);
          });
        });
      }

      // ========== C1: 用户人设导入（直接操作） ==========
      function _doPersonaImport(parentContainer){
        var persona = _readSTPersona();
        if (!persona || (!persona.name && !persona.description)){
          var active = _loadActivePersona();
          if (!active || !active.text){
            try{ toast('未读取到用户人设信息'); }catch(e){}
            return;
          }
          var personas = _loadPersonas();
          var p = _safeArr(personas.list).find(function(x){ return x.id === active.id; });
          var pName = (p && p.name) || '我';
          addCandidate(pName, 'persona', { profile: active.text, identity: active.text.slice(0,200) });
          _renderNewFriendsPage(parentContainer);
          try{ toast('已将"' + pName + '"加入候选'); }catch(e){}
          return;
        }
        var uName = persona.name || '我';
        addCandidate(uName, 'persona', { profile: persona.description, identity: persona.description.slice(0,200) });
        _renderNewFriendsPage(parentContainer);
        try{ toast('已将"' + uName + '"加入候选（用户人设）'); }catch(e){}
      }

      // 分组管理弹窗
      function _openGroupManager(parentContainer){
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const groupsDef = _phLoad('contact_groups_v1', { list:[
          {id:'default', name:'好友', icon:'👥'},
          {id:'npc', name:'npc', icon:'🤖'}
        ]});
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        let gHtml = '';
        _safeArr(groupsDef.list).forEach((g,i)=>{
          gHtml += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06);">
            <span style="font-size:18px;">${esc(g.icon||'👥')}</span>
            <span style="flex:1;font-size:13px;color:rgba(20,24,28,.85);">${esc(g.name)}</span>
            <button data-gact="del" data-gidx="${i}" style="appearance:none;border:0;background:transparent;color:#ef4444;font-size:11px;cursor:pointer;">删除</button>
          </div>`;
        });
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:260px;max-width:300px;width:calc(100% - 40px);text-align:left;box-sizing:border-box;overflow:visible;">
          <div style="font-weight:700;font-size:15px;color:rgba(20,24,28,.88);margin-bottom:14px;text-align:center;">分组管理</div>
          <div style="max-height:200px;overflow-y:auto;margin-bottom:12px;">${gHtml}</div>
          <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:nowrap;min-width:0;">
            <input data-field="newGroupIcon" placeholder="图标" style="width:42px;min-width:42px;padding:6px;border:1px solid rgba(0,0,0,.1);border-radius:6px;text-align:center;font-size:16px;box-sizing:border-box;"/>
            <input data-field="newGroupName" placeholder="新分组名称" style="flex:1;min-width:0;padding:6px 10px;border:1px solid rgba(0,0,0,.1);border-radius:6px;font-size:13px;box-sizing:border-box;"/>
            <button data-gact="add" style="padding:6px 12px;border:0;border-radius:6px;background:#07c160;color:#fff;font-size:12px;cursor:pointer;flex-shrink:0;white-space:nowrap;">添加</button>
          </div>
          <button data-gact="close" style="width:100%;padding:10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;background:#fff;font-size:13px;cursor:pointer;color:rgba(20,24,28,.6);">关闭</button>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{
          if (e.target===overlay){ overlay.remove(); return; }
          const act = e.target.closest('[data-gact]')?.getAttribute('data-gact');
          if (act==='close'){ overlay.remove(); renderChatContacts(parentContainer); return; }
          if (act==='add'){
            const icon = (overlay.querySelector('[data-field="newGroupIcon"]')?.value||'📁').trim();
            const name = (overlay.querySelector('[data-field="newGroupName"]')?.value||'').trim();
            if (!name){ try{toast('请输入分组名');}catch(e){} return; }
            groupsDef.list.push({id:'g_'+Date.now().toString(36), name, icon:icon||'📁'});
            _phSave('contact_groups_v1', groupsDef);
            overlay.remove(); _openGroupManager(parentContainer);
          }
          if (act==='del'){
            const idx = Number(e.target.closest('[data-gidx]')?.getAttribute('data-gidx'));
            if (!isNaN(idx) && groupsDef.list[idx]){
              groupsDef.list.splice(idx,1);
              _phSave('contact_groups_v1', groupsDef);
              overlay.remove(); _openGroupManager(parentContainer);
            }
          }
        });
      }

      /* ========== 发现页 (版面2) ========== */
      function renderDiscoverPage(container){
        // ✅ 标题由 switchChatTab 或 setAppBarTitle 控制，不再重复
        let html = '';
        html += `<div class="wxDiscoverList">
          <div class="wxDiscoverGroup" style="margin-top:0;">
            <div class="wxDiscoverItem" data-act="chatTab" data-tab="moments">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('😊')}</div>
              <div class="wxDName">朋友圈</div>
              <div class="wxDArrow">›</div>
            </div>
          </div>
          <div class="wxDiscoverGroup">
            <div class="wxDiscoverItem" data-act="wxDiscoverNav" data-page="chatHistory">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('💬')}</div>
              <div class="wxDName">聊天历史</div>
              <div class="wxDArrow">›</div>
            </div>
            <div class="wxDiscoverItem" data-act="wxDiscoverNav" data-page="worldBook">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('📖')}</div>
              <div class="wxDName">世界书</div>
              <div class="wxDArrow">›</div>
            </div>
            <div class="wxDiscoverItem" data-act="wxDiscoverNav" data-page="voiceApi">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('🎙')}</div>
              <div class="wxDName">声音API</div>
              <div class="wxDArrow">›</div>
            </div>
          </div>
          <div class="wxDiscoverGroup">
            <div class="wxDiscoverItem" data-act="wxDiscoverNav" data-page="relations">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('🔮')}</div>
              <div class="wxDName">关系网</div>
              <div class="wxDArrow">›</div>
            </div>
            <div class="wxDiscoverItem" data-act="wxDiscoverNav" data-page="blacklist">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('🔒')}</div>
              <div class="wxDName">拉黑管理</div>
              <div class="wxDArrow">›</div>
            </div>
          </div>
        </div>`;
        container.innerHTML = html;
      }

      // ====== 发现子页面：路由分发 ======
      function _renderDiscoverSubPage(page){
        const body = root.querySelector('[data-ph="chatTabContent"]');
        if (!body) return;
        const titles = { chatHistory:'聊天历史', worldBook:'世界书', voiceApi:'声音API', relations:'关系网', blacklist:'拉黑管理' };
        setAppBarTitle(titles[page] || page);
        switch(page){
          case 'chatHistory': renderChatHistoryPage(body); break;
          case 'worldBook':   renderGlobalWBPage(body); break;
          case 'voiceApi':    renderVoiceApiPage(body); break;
          case 'relations':   renderRelationPage(body); break;
          case 'blacklist':   renderBlacklistPage(body); break;
          default:
            body.innerHTML = `<div class="phPlaceholder" style="padding-top:60px;"><div class="phPlIcon">${_phFlatIcon('📦')}</div><div class="phPlText">「${esc(page)}」开发中…</div></div>`;
        }
      }

      // ====== 4.2 聊天历史（总数据中心 —— 汇总所有角色总结） ======
      function renderChatHistoryPage(container){
        // 在 AppBar spacer 放 ⚙️ 按钮
        try{
          const sp = root.querySelector('.phAppBarSpacer');
          if(sp) sp.innerHTML=`<button data-act="wxSumGlobalSettings" style="font-size:16px;width:32px;height:32px;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;">⚙️</button>`;
        }catch(e){}

        // Tab 切换
        const activeTab = state._chHistoryTab || 'summary';

        let html = `<div style="padding:0;">
          <div style="display:flex;border-bottom:1px solid rgba(0,0,0,.06);background:rgba(255,255,255,.5);">
            <button data-act="wxCHTabSwitch" data-chtab="summary" style="flex:1;padding:10px;border:0;background:transparent;font-size:13px;font-weight:${activeTab==='summary'?'600':'400'};color:${activeTab==='summary'?'#07c160':'rgba(20,24,28,.5)'};cursor:pointer;border-bottom:2px solid ${activeTab==='summary'?'#07c160':'transparent'};">聊天总结</button>
            <button data-act="wxCHTabSwitch" data-chtab="moments" style="flex:1;padding:10px;border:0;background:transparent;font-size:13px;font-weight:${activeTab==='moments'?'600':'400'};color:${activeTab==='moments'?'#07c160':'rgba(20,24,28,.5)'};cursor:pointer;border-bottom:2px solid ${activeTab==='moments'?'#07c160':'transparent'};">朋友圈评论</button>
          </div>`;

        if (activeTab === 'moments'){
          html += `<div class="phPlaceholder" style="padding-top:50px;">
            <div class="phPlIcon">${_phFlatIcon('💬')}</div>
            <div class="phPlText">暂无数据，敬请期待</div>
          </div>`;
        } else {
          // 聊天总结 Tab — 遍历所有有过聊天的角色
          const threads = loadThreads();
          const threadList = _safeArr(threads.list);
          const db = loadContactsDB();

          if (!threadList.length){
            html += `<div class="phPlaceholder" style="padding-top:50px;">
              <div class="phPlIcon">${_phFlatIcon('📝')}</div>
              <div class="phPlText">暂无聊天记录</div>
            </div>`;
          } else {
            html += `<div style="padding:8px 0;">`;
            threadList.forEach(thread => {
              const npc = findContactById(db, thread.id) || { id:thread.id, name:thread.name||String(thread.id), avatar:thread.avatar||'?' };
              const sumData = getChatSummary(thread.id);
              const hasSummary = !!(sumData && sumData.summaryText);
              const statusHtml = hasSummary
                ? `<span style="color:#07c160;">✅ 已总结 · ${_timeAgo(sumData.updatedAt)}</span>`
                : `<span style="color:rgba(20,24,28,.3);">⬜ 未总结</span>`;
              const lastMsg = thread.lastMsg ? String(thread.lastMsg).slice(0,20) : '暂无消息';
              const avatar = npc.avatar || (npc.name||'?').charAt(0);

              html += `<div class="wxDiscoverItem" data-act="wxCHDetail" data-chnpcid="${esc(thread.id)}" style="padding:12px 14px;cursor:pointer;">
                <div style="width:40px;height:40px;border-radius:10px;background:rgba(0,0,0,.05);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;overflow:hidden;">${esc(avatar)}</div>
                <div style="flex:1;min-width:0;margin-left:10px;">
                  <div style="font-size:14px;font-weight:500;color:rgba(20,24,28,.88);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(npc.name||thread.name||'未知')}</div>
                  <div style="font-size:11px;color:rgba(20,24,28,.4);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">最近：${esc(lastMsg)}</div>
                  <div style="font-size:10px;margin-top:2px;">${statusHtml}</div>
                </div>
                <div class="wxDArrow">›</div>
              </div>`;
            });
            html += `</div>`;
          }
        }

        html += `</div>`;
        container.innerHTML = html;
      }

      // ====== 辅助：时间距今 ======
      function _timeAgo(ts){
        if (!ts) return '';
        const diff = Date.now() - ts;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff/86400000) + '天前';
        return new Date(ts).toLocaleDateString();
      }

      // ====== 聊天总结详情页 ======
      function renderChatHistoryDetailPage(npcId){
        const body = root.querySelector('[data-ph="chatTabContent"]');
        if (!body) return;
        const db = loadContactsDB();
        const npc = findContactById(db, npcId) || { id:npcId, name:String(npcId) };
        const sumData = getChatSummary(npcId);

        setAppBarTitle((npc.name||'角色') + '的总结');
        try{ const sp = root.querySelector('.phAppBarSpacer'); if(sp) sp.innerHTML=''; }catch(e){}

        let html = `<div style="padding:14px;">`;
        if (sumData && sumData.summaryText){
          html += `<div style="padding:12px;border-radius:12px;background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.05);margin-bottom:12px;">
            <div style="font-size:13px;line-height:1.7;color:rgba(20,24,28,.8);white-space:pre-wrap;word-break:break-all;">${esc(sumData.summaryText)}</div>
          </div>
          <div style="font-size:11px;color:rgba(20,24,28,.35);padding:0 4px;margin-bottom:16px;">
            <div>生成时间：${new Date(sumData.updatedAt).toLocaleString()}</div>
            <div>模型：${esc(sumData.model||'未知')}</div>
            <div>消息范围：最近 ${sumData.sourceMsgCount||'?'} 条</div>
          </div>`;
        } else {
          html += `<div class="phPlaceholder" style="padding:30px 0;">
            <div class="phPlIcon">${_phFlatIcon('📝')}</div>
            <div class="phPlText">暂无总结<br><span style="font-size:11px;color:rgba(20,24,28,.35);">可在聊天设置中生成</span></div>
          </div>`;
        }

        // 底部操作栏
        html += `<div style="display:flex;gap:8px;justify-content:center;padding-top:8px;">
          <button data-act="wxCHDetailCopy" data-chnpcid="${esc(npcId)}" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.9);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">📋 复制</button>
          <button data-act="wxCHDetailRegen" data-chnpcid="${esc(npcId)}" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.9);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">🔄 重新生成</button>
          <button data-act="wxCHDetailClear" data-chnpcid="${esc(npcId)}" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.9);font-size:12px;color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">🗑 清空</button>
        </div>`;
        html += `</div>`;
        body.innerHTML = html;
      }

      // ====== 全局总结设置页 ======
      function renderSummarySettingsPage(){
        const body = root.querySelector('[data-ph="chatTabContent"]');
        if (!body) return;
        const gs = getGlobalSummarySettings();

        setAppBarTitle('总结设置');
        try{ const sp = root.querySelector('.phAppBarSpacer'); if(sp) sp.innerHTML=''; }catch(e){}

        let html = `<div style="padding:14px;">
          <div style="margin-bottom:16px;">
            <div style="font-size:13px;color:rgba(20,24,28,.75);margin-bottom:6px;">默认总结消息条数</div>
            <input data-el="gsMsgCount" type="number" value="${Number(gs.defaultMsgCount)||60}" min="10" max="200" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;" />
          </div>
          <div style="margin-bottom:16px;">
            <div style="font-size:13px;color:rgba(20,24,28,.75);margin-bottom:6px;">默认总结提示词</div>
            <textarea data-el="gsPrompt" rows="5" placeholder="留空则使用系统内置提示词" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:13px;outline:none;resize:vertical;font-family:inherit;line-height:1.5;box-sizing:border-box;">${esc(gs.defaultPrompt||'')}</textarea>
          </div>
          <div style="margin-bottom:20px;">
            <div style="font-size:13px;color:rgba(20,24,28,.75);margin-bottom:6px;">默认模型</div>
            <input data-el="gsModel" value="${esc(gs.defaultModel||'')}" placeholder="留空跟随API预设" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;" />
          </div>
          <button data-act="wxSumSettingsSave" style="width:100%;padding:12px;border-radius:10px;border:0;background:#07c160;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">💾 保存设置</button>
        </div>`;
        body.innerHTML = html;
      }

      // ====== 4.3 世界书（全局世界书管理页） ======
      function renderGlobalWBPage(container){
        const data = loadPhoneGlobalWB();
        let html = `<div style="padding:14px;">
          <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:8px;">全局世界书/记忆包文本（聊天时可选附加给 AI）</div>
          <textarea data-el="gwbText" rows="10" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:13px;line-height:1.6;resize:vertical;outline:none;background:rgba(255,255,255,.8);color:rgba(20,24,28,.85);">${esc(data.text||'')}</textarea>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding:10px 12px;background:rgba(255,255,255,.7);border-radius:10px;border:1px solid rgba(0,0,0,.06);">
            <div>
              <div style="font-size:13px;color:rgba(20,24,28,.85);">聊天时附加</div>
              <div style="font-size:11px;color:rgba(20,24,28,.4);">开启后在聊天时自动附加此世界书</div>
            </div>
            <button data-act="gwbToggle" class="wxToggleBtn ${data.enabled?'on':'off'}" style="width:44px;height:26px;border-radius:13px;border:0;cursor:pointer;position:relative;transition:background .2s;background:${data.enabled?'#07c160':'rgba(0,0,0,.15)'};">
              <span style="position:absolute;top:3px;${data.enabled?'left:21px':'left:3px'};width:20px;height:20px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);"></span>
            </button>
          </div>
          <button data-act="gwbSave" style="width:100%;margin-top:12px;padding:12px;border-radius:10px;border:0;background:#07c160;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">保存</button>
          <div style="font-size:11px;color:rgba(20,24,28,.3);margin-top:8px;text-align:center;">此世界书仅由小手机管理，不影响 ST 现有世界书</div>
        </div>`;
        container.innerHTML = html;

        // 绑定事件
        container.querySelector('[data-act="gwbToggle"]')?.addEventListener('click', function(){
          data.enabled = !data.enabled;
          this.style.background = data.enabled ? '#07c160' : 'rgba(0,0,0,.15)';
          const dot = this.querySelector('span');
          if (dot) dot.style.left = data.enabled ? '21px' : '3px';
          this.classList.toggle('on', data.enabled);
          this.classList.toggle('off', !data.enabled);
        });
        container.querySelector('[data-act="gwbSave"]')?.addEventListener('click', ()=>{
          const ta = container.querySelector('[data-el="gwbText"]');
          data.text = ta ? ta.value : '';
          savePhoneGlobalWB(data);
          try{toast('世界书已保存');}catch(e){}
        });
      }

      // ====== 4.4 声音API（配置 + 角色绑定） ======
      function renderVoiceApiPage(container){
        const data = loadVoiceApi();
        const db = loadContactsDB();
        const contacts = _safeArr(db.list);
        const bindings = _safeArr(data.bindings);

        let bindHtml = '';
        bindings.forEach((b, idx) => {
          bindHtml += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.04);">
            <span style="flex:1;font-size:13px;color:rgba(20,24,28,.85);">${esc(b.name||b.id)}</span>
            <input data-bidx="${idx}" value="${esc(b.voiceId||'')}" placeholder="voiceId" style="width:100px;padding:4px 8px;border:1px solid rgba(0,0,0,.1);border-radius:6px;font-size:12px;outline:none;"/>
            <button data-act="voiceDelBind" data-bidx="${idx}" style="appearance:none;border:0;background:transparent;color:#ef4444;font-size:14px;cursor:pointer;">✕</button>
          </div>`;
        });

        let html = `<div style="padding:14px;">
          <div style="font-size:13px;font-weight:600;color:rgba(20,24,28,.85);margin-bottom:10px;">API 配置</div>
          <div style="margin-bottom:8px;">
            <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:4px;">API 地址</div>
            <input data-el="vaUrl" value="${esc(data.apiUrl||'')}" placeholder="https://api.example.com/tts" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.1);border-radius:8px;font-size:13px;outline:none;"/>
          </div>
          <div style="margin-bottom:8px;">
            <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:4px;">API Key</div>
            <input data-el="vaKey" value="${esc(data.apiKey||'')}" placeholder="sk-..." type="password" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.1);border-radius:8px;font-size:13px;outline:none;"/>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:4px;">默认 Voice ID / 模型名</div>
            <input data-el="vaVoice" value="${esc(data.defaultVoiceId||'')}" placeholder="默认声音标识" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.1);border-radius:8px;font-size:13px;outline:none;"/>
          </div>
          <button data-act="vaSaveConfig" style="width:100%;padding:10px;border-radius:10px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:16px;">保存配置</button>

          <div style="font-size:13px;font-weight:600;color:rgba(20,24,28,.85);margin-bottom:8px;">角色绑定列表</div>
          <div style="font-size:11px;color:rgba(20,24,28,.4);margin-bottom:8px;">为好友/角色绑定专属 voiceId</div>
          ${bindHtml}
          <div style="display:flex;gap:6px;margin-top:10px;">
            <select data-el="vaBindSelect" style="flex:1;padding:8px;border:1px solid rgba(0,0,0,.1);border-radius:8px;font-size:12px;">
              <option value="">选择好友…</option>
              ${contacts.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
            </select>
            <button data-act="vaAddBind" style="padding:8px 14px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:12px;cursor:pointer;">添加</button>
          </div>
          <div style="font-size:11px;color:rgba(20,24,28,.3);margin-top:12px;text-align:center;">当前仅保存配置，不执行真实播放</div>
        </div>`;
        container.innerHTML = html;

        // 绑定事件
        container.querySelector('[data-act="vaSaveConfig"]')?.addEventListener('click', ()=>{
          data.apiUrl = (container.querySelector('[data-el="vaUrl"]')?.value||'').trim();
          data.apiKey = (container.querySelector('[data-el="vaKey"]')?.value||'').trim();
          data.defaultVoiceId = (container.querySelector('[data-el="vaVoice"]')?.value||'').trim();
          // 同步绑定列表里的 voiceId 修改
          container.querySelectorAll('[data-bidx]').forEach(inp=>{
            if (inp.tagName === 'INPUT'){
              const idx = Number(inp.getAttribute('data-bidx'));
              if (data.bindings[idx]) data.bindings[idx].voiceId = (inp.value||'').trim();
            }
          });
          saveVoiceApi(data);
          try{toast('声音API配置已保存');}catch(e){}
        });
        container.querySelector('[data-act="vaAddBind"]')?.addEventListener('click', ()=>{
          const sel = container.querySelector('[data-el="vaBindSelect"]');
          const id = sel?.value;
          if (!id){ try{toast('请选择好友');}catch(e){} return; }
          const c = findContactById(db, id);
          if (!c) return;
          if (data.bindings.some(b=>b.id===id)){ try{toast('已绑定');}catch(e){} return; }
          data.bindings.push({ id:c.id, name:c.name, voiceId:'' });
          saveVoiceApi(data);
          renderVoiceApiPage(container);
        });
        container.querySelectorAll('[data-act="voiceDelBind"]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const idx = Number(btn.getAttribute('data-bidx'));
            if (!isNaN(idx)){ data.bindings.splice(idx,1); saveVoiceApi(data); renderVoiceApiPage(container); }
          });
        });
      }

      // ====== 4.5 关系网（可编辑关系列表） ======
      function renderRelationPage(container){
        const data = loadRelations();
        const relations = _safeArr(data.list);

        let html = `<div style="padding:14px;">
          <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:10px;">管理角色之间的关系（手动编辑，不自动提取）</div>`;

        if (relations.length){
          relations.forEach((r, idx) => {
            html += `<div style="display:flex;align-items:center;gap:6px;padding:10px;margin-bottom:6px;background:rgba(255,255,255,.7);border-radius:10px;border:1px solid rgba(0,0,0,.06);">
              <input data-ridx="${idx}" data-rfield="a" value="${esc(r.a||'')}" placeholder="角色A" style="flex:1;min-width:0;padding:6px 8px;border:1px solid rgba(0,0,0,.08);border-radius:6px;font-size:12px;outline:none;"/>
              <span style="font-size:11px;color:rgba(20,24,28,.4);flex-shrink:0;">—</span>
              <input data-ridx="${idx}" data-rfield="type" value="${esc(r.type||'')}" placeholder="关系" style="width:60px;padding:6px 8px;border:1px solid rgba(0,0,0,.08);border-radius:6px;font-size:12px;outline:none;text-align:center;"/>
              <span style="font-size:11px;color:rgba(20,24,28,.4);flex-shrink:0;">—</span>
              <input data-ridx="${idx}" data-rfield="b" value="${esc(r.b||'')}" placeholder="角色B" style="flex:1;min-width:0;padding:6px 8px;border:1px solid rgba(0,0,0,.08);border-radius:6px;font-size:12px;outline:none;"/>
              <button data-act="relDel" data-ridx="${idx}" style="appearance:none;border:0;background:transparent;color:#ef4444;font-size:16px;cursor:pointer;flex-shrink:0;">✕</button>
            </div>`;
          });
        } else {
          html += `<div style="padding:20px;text-align:center;font-size:12px;color:rgba(20,24,28,.35);">暂无关系记录</div>`;
        }

        html += `<div style="display:flex;gap:8px;margin-top:12px;">
            <button data-act="relAdd" style="flex:1;padding:10px;border-radius:10px;border:1px dashed rgba(0,0,0,.15);background:rgba(255,255,255,.5);font-size:13px;color:rgba(20,24,28,.6);cursor:pointer;">+ 新增关系</button>
            <button data-act="relSave" style="flex:1;padding:10px;border-radius:10px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">保存</button>
          </div>
        </div>`;
        container.innerHTML = html;

        // 绑定事件
        container.querySelector('[data-act="relAdd"]')?.addEventListener('click', ()=>{
          data.list.push({ a:'', type:'朋友', b:'' });
          saveRelations(data);
          renderRelationPage(container);
        });
        container.querySelector('[data-act="relSave"]')?.addEventListener('click', ()=>{
          // 收集所有输入
          const newList = [];
          const maxIdx = data.list.length;
          for (let i=0; i<maxIdx; i++){
            const a = (container.querySelector(`[data-ridx="${i}"][data-rfield="a"]`)?.value||'').trim();
            const t = (container.querySelector(`[data-ridx="${i}"][data-rfield="type"]`)?.value||'').trim();
            const b = (container.querySelector(`[data-ridx="${i}"][data-rfield="b"]`)?.value||'').trim();
            if (a || b) newList.push({ a, type: t || '关系', b });
          }
          data.list = newList;
          saveRelations(data);
          try{toast('关系网已保存');}catch(e){}
        });
        container.querySelectorAll('[data-act="relDel"]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const idx = Number(btn.getAttribute('data-ridx'));
            if (!isNaN(idx)){ data.list.splice(idx,1); saveRelations(data); renderRelationPage(container); }
          });
        });
      }

      // ====== 4.6 拉黑管理 ======
      function renderBlacklistPage(container){
        const data = loadBlacklist();
        const blacklist = _safeArr(data.list);
        const db = loadContactsDB();
        const contacts = _safeArr(db.list);

        let html = `<div style="padding:14px;">
          <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:10px;">被拉黑的角色不会出现在通讯录和候选列表中（数据不会被删除）</div>`;

        if (blacklist.length){
          blacklist.forEach((b, idx) => {
            html += `<div style="display:flex;align-items:center;padding:10px 12px;margin-bottom:6px;background:rgba(255,255,255,.7);border-radius:10px;border:1px solid rgba(0,0,0,.06);">
              <div style="width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;font-size:14px;color:rgba(20,24,28,.5);flex-shrink:0;">${esc((b.name||'?').charAt(0))}</div>
              <div style="flex:1;margin-left:10px;font-size:13px;color:rgba(20,24,28,.85);">${esc(b.name)}</div>
              <button data-act="blRemove" data-blidx="${idx}" style="padding:4px 12px;border-radius:8px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:11px;color:#07c160;cursor:pointer;">移除</button>
            </div>`;
          });
        } else {
          html += `<div style="padding:20px;text-align:center;font-size:12px;color:rgba(20,24,28,.35);">黑名单为空</div>`;
        }

        html += `<div style="margin-top:14px;font-size:13px;font-weight:600;color:rgba(20,24,28,.7);margin-bottom:8px;">添加到黑名单</div>
          <div style="display:flex;gap:8px;">
            <input data-el="blName" placeholder="输入角色名称" style="flex:1;padding:8px 10px;border:1px solid rgba(0,0,0,.1);border-radius:8px;font-size:13px;outline:none;"/>
            <button data-act="blAdd" style="padding:8px 14px;border-radius:8px;border:0;background:#ef4444;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">拉黑</button>
          </div>`;

        // 快捷：从好友列表拉黑
        if (contacts.length){
          html += `<div style="margin-top:12px;">
            <select data-el="blSelect" style="width:100%;padding:8px;border:1px solid rgba(0,0,0,.1);border-radius:8px;font-size:12px;">
              <option value="">从好友列表选择…</option>
              ${contacts.filter(c => !isBlacklisted(c.name)).map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
            </select>
          </div>`;
        }
        html += '</div>';
        container.innerHTML = html;

        // 绑定事件
        container.querySelector('[data-act="blAdd"]')?.addEventListener('click', ()=>{
          let name = (container.querySelector('[data-el="blName"]')?.value||'').trim();
          if (!name){
            // 尝试从 select 取
            name = (container.querySelector('[data-el="blSelect"]')?.value||'').trim();
          }
          if (!name){ try{toast('请输入名称');}catch(e){} return; }
          if (isBlacklisted(name)){ try{toast('已在黑名单中');}catch(e){} return; }
          data.list.push({ name, addedAt: Date.now() });
          saveBlacklist(data);
          try{toast(`已拉黑: ${name}`);}catch(e){}
          renderBlacklistPage(container);
        });
        container.querySelectorAll('[data-act="blRemove"]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const idx = Number(btn.getAttribute('data-blidx'));
            if (!isNaN(idx)){ data.list.splice(idx,1); saveBlacklist(data); try{toast('已移除');}catch(e){} renderBlacklistPage(container); }
          });
        });
      }

      /* ========== 我的页面 (版面5) ========== */
      function renderMePage(container){
        const settings = phoneLoadSettings();
        const userName = (settings && settings.phoneName) || '原';
        const userId = 'y' + Math.abs(String(userName).split('').reduce((h,c)=>(h<<5)-h+c.charCodeAt(0),0)).toString().slice(0,7);
        let html = '';
        html += `<div class="wxMeProfile" data-act="wxMeProfile">
          <div class="wxMeAvatar">😊</div>
          <div class="wxMeInfo">
            <div class="wxMeName">${esc(userName)}</div>
            <div class="wxMeId">微信号：${esc(userId)} &nbsp;<span style="color:rgba(20,24,28,.25);">设置</span></div>
          </div>
          <div class="wxDArrow" style="color:rgba(0,0,0,.2);font-size:16px;">›</div>
        </div>`;
        html += `<div class="wxMeMenu">
          <div class="wxDiscoverGroup" style="margin-top:8px;">
            <div class="wxDiscoverItem" data-act="wxMeNav" data-page="wallet">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('📤')}</div>
              <div class="wxDName">钱包</div>
              <div class="wxDArrow">›</div>
            </div>
          </div>
          <div class="wxDiscoverGroup">
            <div class="wxDiscoverItem" data-act="wxMeNav" data-page="favorites">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('⭐')}</div>
              <div class="wxDName">收藏</div>
              <div class="wxDArrow">›</div>
            </div>
            <div class="wxDiscoverItem" data-act="wxMeNav" data-page="persona">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('👥')}</div>
              <div class="wxDName">人设</div>
              <div class="wxDArrow">›</div>
            </div>
            <div class="wxDiscoverItem" data-act="wxMeNav" data-page="stickers">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('😊')}</div>
              <div class="wxDName">表情</div>
              <div class="wxDArrow">›</div>
            </div>
          </div>
          <div class="wxDiscoverGroup">
            <div class="wxDiscoverItem" data-act="wxMeNav" data-page="meSettings">
              <div class="wxDIco wxDIcoThemed">${_phFlatIcon('🎯')}</div>
              <div class="wxDName">设置</div>
              <div class="wxDArrow">›</div>
            </div>
          </div>
        </div>`;
        container.innerHTML = html;
      }

      // 我的子页面渲染
      function _renderMeSubPage(page){
        const body = root.querySelector('[data-ph="chatTabContent"]');
        if (!body) return;

        const titles = { wallet:'钱包', favorites:'收藏', persona:'人设', stickers:'表情', meSettings:'设置' };
        setAppBarTitle(titles[page] || page);

        // ====== 钱包页面特殊渲染 ======
        if (page === 'wallet'){
          _renderWalletPage(body);
          return;
        }
        // ✅ 4.1 收藏
        if (page === 'favorites'){
          _renderFavoritesPage(body);
          return;
        }
        // ✅ 4.2 人设
        if (page === 'persona'){
          _renderPersonaPage(body);
          return;
        }
        // ✅ 4.3 表情
        if (page === 'stickers'){
          _renderStickersPage(body);
          return;
        }
        // ✅ 4.4 设置
        if (page === 'meSettings'){
          _renderMeSettingsPage(body);
          return;
        }

        const icons = { wallet:'💰', favorites:'⭐', persona:'👤', stickers:'😊', meSettings:'⚙️' };
        let html = `<div class="phPlaceholder" style="padding-top:60px;">
          <div class="phPlIcon">${_phFlatIcon(icons[page]||'📦')}</div>
          <div class="phPlText">「${esc(titles[page]||page)}」功能开发中…</div>
        </div>`;
        body.innerHTML = html;
      }

      // ===================== 4.1 收藏页 =====================
      // 数据层 key: meow_phone_g_favorites_v1
      function _loadFavorites(){
        return phoneGetG('favorites_v1', { v:1, list:[] }) || { v:1, list:[] };
      }
      function _saveFavorites(d){
        phoneSetG('favorites_v1', d);
      }
      function _renderFavoritesPage(container){
        const data = _loadFavorites();
        const list = _safeArr(data.list);
        let html = '';
        // 新增按钮
        html += `<div style="padding:12px 14px;display:flex;gap:8px;">
          <button data-act="favAddQuote" style="flex:1;padding:10px;border-radius:12px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.7);font-size:13px;cursor:pointer;">+ 收藏语录</button>
          <button data-act="favAddDiary" style="flex:1;padding:10px;border-radius:12px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.7);font-size:13px;cursor:pointer;">+ 写日记</button>
        </div>`;
        if (!list.length){
          html += `<div class="phPlaceholder" style="padding-top:40px;"><div class="phPlIcon">${_phFlatIcon('⭐')}</div><div class="phPlText">暂无收藏<br>点击上方按钮添加</div></div>`;
        } else {
          for (let i = list.length - 1; i >= 0; i--){
            const it = list[i];
            const d = new Date(it.time || 0);
            const ts = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            const typeLabel = it.type === 'diary' ? '📝 日记' : '💬 语录';
            const tagStr = _safeArr(it.tags).map(t=>`<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:rgba(7,193,96,.1);color:#07c160;font-size:10px;margin-right:4px;">${esc(t)}</span>`).join('');
            html += `<div style="margin:0 14px 10px;padding:14px;border-radius:14px;background:#fff;border:1px solid rgba(0,0,0,.06);">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:11px;color:rgba(20,24,28,.4);">${typeLabel} · ${ts}</span>
                <div style="display:flex;gap:6px;">
                  <button data-act="favEdit" data-idx="${i}" style="border:0;background:transparent;color:#3b82f6;font-size:11px;cursor:pointer;">编辑</button>
                  <button data-act="favDel" data-idx="${i}" style="border:0;background:transparent;color:#ef4444;font-size:11px;cursor:pointer;">删除</button>
                </div>
              </div>
              <div style="font-size:13px;color:rgba(20,24,28,.8);white-space:pre-wrap;word-break:break-all;">${esc(it.content||'')}</div>
              ${tagStr ? `<div style="margin-top:6px;">${tagStr}</div>` : ''}
            </div>`;
          }
        }
        container.innerHTML = html;

        // 绑定事件
        container.querySelectorAll('[data-act="favAddQuote"]').forEach(b => b.addEventListener('click', ()=> _openFavEditor(container, 'quote')));
        container.querySelectorAll('[data-act="favAddDiary"]').forEach(b => b.addEventListener('click', ()=> _openFavEditor(container, 'diary')));
        container.querySelectorAll('[data-act="favEdit"]').forEach(b => b.addEventListener('click', ()=>{
          const idx = Number(b.getAttribute('data-idx'));
          if (!isNaN(idx)) _openFavEditor(container, null, idx);
        }));
        container.querySelectorAll('[data-act="favDel"]').forEach(b => b.addEventListener('click', ()=>{
          const idx = Number(b.getAttribute('data-idx'));
          if (isNaN(idx)) return;
          if (W.confirm && !W.confirm('确定删除？')) return;
          const d2 = _loadFavorites(); d2.list.splice(idx, 1); _saveFavorites(d2);
          try{toast('已删除');}catch(e){}
          _renderFavoritesPage(container);
        }));
      }

      function _openFavEditor(container, type, editIdx){
        const data = _loadFavorites();
        const existing = (typeof editIdx === 'number') ? data.list[editIdx] : null;
        const isEdit = !!existing;
        type = type || (existing && existing.type) || 'quote';
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:280px;text-align:left;max-height:80vh;overflow-y:auto;">
          <div style="font-weight:700;font-size:15px;color:rgba(20,24,28,.88);margin-bottom:14px;text-align:center;">${isEdit ? '编辑收藏' : (type==='diary'?'写日记':'收藏语录')}</div>
          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:4px;">内容 *</div>
            <textarea data-field="favContent" rows="5" placeholder="${type==='diary'?'写点什么…':'粘贴或输入语录…'}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;resize:vertical;">${esc(existing?.content||'')}</textarea>
          </div>
          <div style="margin-bottom:14px;">
            <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:4px;">标签（用逗号分隔，可选）</div>
            <input data-field="favTags" placeholder="例: 搞笑,感动" value="${esc(_safeArr(existing?.tags).join(','))}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;"/>
          </div>
          <div style="display:flex;gap:8px;">
            <button data-act="favEditorCancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.6);font-size:13px;cursor:pointer;">取消</button>
            <button data-act="favEditorSave" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">保存</button>
          </div>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{ if (e.target===overlay) overlay.remove(); });
        overlay.querySelector('[data-act="favEditorCancel"]')?.addEventListener('click',()=> overlay.remove());
        overlay.querySelector('[data-act="favEditorSave"]')?.addEventListener('click',()=>{
          const content = (overlay.querySelector('[data-field="favContent"]')?.value||'').trim();
          if (!content){ try{toast('内容不能为空');}catch(e){} return; }
          const tags = (overlay.querySelector('[data-field="favTags"]')?.value||'').split(/[,，]/).map(s=>s.trim()).filter(Boolean);
          const now = Date.now();
          if (isEdit){
            data.list[editIdx] = { ...existing, content, tags, editTime: now };
          } else {
            data.list.push({ type, content, tags, time: now });
          }
          _saveFavorites(data);
          overlay.remove();
          try{toast(isEdit ? '已更新' : '已收藏');}catch(e){}
          _renderFavoritesPage(container);
        });
      }

      // ===================== 4.2 人设页 =====================
      // 数据层 key: meow_phone_g_personas_v1 (列表) + meow_phone_g_active_persona_v1 (当前)
      function _loadPersonas(){
        return phoneGetG('personas_v1', { v:1, list:[] }) || { v:1, list:[] };
      }
      function _savePersonas(d){ phoneSetG('personas_v1', d); }
      function _loadActivePersona(){ return phoneGetG('active_persona_v1', { id:'', text:'' }); }
      function _saveActivePersona(d){ phoneSetG('active_persona_v1', d); }

      function _renderPersonaPage(container){
        const data = _loadPersonas();
        const active = _loadActivePersona();
        const list = _safeArr(data.list);
        const cSettings = loadPhoneChatSettings();
        const isFollowChatId = !cSettings.personaOverride; // C2: null = 跟随 chatId
        let html = '';

        // 当前人设卡片
        html += `<div style="margin:14px;padding:16px;border-radius:14px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;">
          <div style="font-size:12px;opacity:.8;">当前人设</div>
          <div style="font-size:15px;font-weight:600;margin-top:4px;">${esc(active.id ? (list.find(p=>p.id===active.id)?.name||active.id) : '未设置')}</div>
          <div style="font-size:11px;opacity:.7;margin-top:4px;max-height:60px;overflow:hidden;white-space:pre-wrap;">${esc((active.text||'').slice(0,120))}${(active.text||'').length>120?'…':''}</div>
        </div>`;

        // C2: chatId 联动模式开关
        html += `<div style="margin:0 14px 10px;padding:12px 14px;border-radius:12px;background:#fff;border:1px solid ${isFollowChatId ? '#07c160' : 'rgba(0,0,0,.06)'};">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-size:13px;font-weight:600;color:rgba(20,24,28,.85);">🔗 跟随 chatId</div>
              <div style="font-size:11px;color:rgba(20,24,28,.45);margin-top:2px;">${isFollowChatId ? '自动使用当前酒馆 chatId 关联的 persona' : '已手动锁定为: ' + esc(cSettings.personaOverride || '')}</div>
            </div>
            ${isFollowChatId ? '<span style="color:#07c160;font-size:12px;font-weight:600;">✓ 启用中</span>' : '<button data-act="personaFollowChat" style="border:0;background:#07c160;color:#fff;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;">恢复自动</button>'}
          </div>
        </div>`;

        // 新增按钮
        html += `<div style="padding:0 14px 8px;">
          <button data-act="personaAdd" style="width:100%;padding:10px;border-radius:12px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.7);font-size:13px;cursor:pointer;">+ 新建人设</button>
        </div>`;

        // 人设列表
        if (!list.length){
          html += `<div style="padding:30px 14px;text-align:center;font-size:12px;color:rgba(20,24,28,.35);">暂无人设，点击上方新建</div>`;
        } else {
          for (let i = 0; i < list.length; i++){
            const p = list[i];
            const isCur = active.id === p.id;
            const isOverride = cSettings.personaOverride === p.name || cSettings.personaOverride === p.id;
            html += `<div style="margin:0 14px 8px;padding:14px;border-radius:14px;background:#fff;border:${isCur?'2px solid #07c160':'1px solid rgba(0,0,0,.06)'};">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:14px;font-weight:600;color:rgba(20,24,28,.85);">${esc(p.name)} ${isCur?'<span style="color:#07c160;font-size:11px;">✓ 当前</span>':''} ${isOverride && !isFollowChatId ? '<span style="color:#667eea;font-size:10px;">🔒 锁定</span>' : ''}</span>
                <div style="display:flex;gap:6px;">
                  ${!isCur ? `<button data-act="personaUse" data-pidx="${i}" style="border:0;background:#07c160;color:#fff;font-size:11px;padding:4px 8px;border-radius:6px;cursor:pointer;">启用</button>` : ''}
                  <button data-act="personaEdit" data-pidx="${i}" style="border:0;background:transparent;color:#3b82f6;font-size:11px;cursor:pointer;">编辑</button>
                  <button data-act="personaDel" data-pidx="${i}" style="border:0;background:transparent;color:#ef4444;font-size:11px;cursor:pointer;">删除</button>
                </div>
              </div>
              <div style="font-size:12px;color:rgba(20,24,28,.5);white-space:pre-wrap;max-height:60px;overflow:hidden;">${esc((p.text||'').slice(0,150))}</div>
            </div>`;
          }
        }

        // 与当前聊天角色互换
        const curTarget = (state && state.chatTarget) ? String(state.chatTarget).trim() : '';
        if (curTarget){
          html += `<div style="padding:14px;">
            <button data-act="personaSwap" style="width:100%;padding:12px;border-radius:12px;border:1px dashed rgba(0,0,0,.15);background:#fff;color:rgba(20,24,28,.6);font-size:13px;cursor:pointer;">🔄 与「${esc(curTarget)}」互换人设</button>
          </div>`;
        }
        container.innerHTML = html;

        // 事件
        container.querySelectorAll('[data-act="personaAdd"]').forEach(b => b.addEventListener('click',()=> _openPersonaEditor(container)));
        container.querySelectorAll('[data-act="personaEdit"]').forEach(b => b.addEventListener('click',()=>{
          _openPersonaEditor(container, Number(b.getAttribute('data-pidx')));
        }));
        container.querySelectorAll('[data-act="personaUse"]').forEach(b => b.addEventListener('click',()=>{
          const idx = Number(b.getAttribute('data-pidx'));
          const d = _loadPersonas();
          const p = d.list[idx];
          if (p){
            _saveActivePersona({ id: p.id, text: p.text });
            // C2: 手动选择 → 写入 personaOverride
            const cs = loadPhoneChatSettings();
            cs.personaOverride = p.name;
            savePhoneChatSettings(cs);
            try{toast(`已切换人设: ${p.name}`);}catch(e){}
          }
          _renderPersonaPage(container);
        }));
        // C2: 跟随 chatId 按钮
        container.querySelectorAll('[data-act="personaFollowChat"]').forEach(b => b.addEventListener('click',()=>{
          const cs = loadPhoneChatSettings();
          cs.personaOverride = null;
          savePhoneChatSettings(cs);
          try{toast('已恢复跟随 chatId');}catch(e){}
          _renderPersonaPage(container);
        }));
        container.querySelectorAll('[data-act="personaDel"]').forEach(b => b.addEventListener('click',()=>{
          const idx = Number(b.getAttribute('data-pidx'));
          if (W.confirm && !W.confirm('确定删除此人设？')) return;
          const d = _loadPersonas();
          const removed = d.list.splice(idx,1)[0];
          _savePersonas(d);
          const act2 = _loadActivePersona();
          if (act2.id === removed?.id) _saveActivePersona({ id:'', text:'' });
          // C2: 如果删除的正好是 override 的，清除 override
          const cs = loadPhoneChatSettings();
          if (cs.personaOverride === removed?.name || cs.personaOverride === removed?.id){
            cs.personaOverride = null;
            savePhoneChatSettings(cs);
          }
          try{toast('已删除');}catch(e){}
          _renderPersonaPage(container);
        }));
        container.querySelectorAll('[data-act="personaSwap"]').forEach(b => b.addEventListener('click',()=>{
          const tgt = (state && state.chatTarget) ? String(state.chatTarget).trim() : '';
          if (!tgt){ try{toast('无当前聊天对象');}catch(e){} return; }
          const act2 = _loadActivePersona();
          const db = loadContactsDB();
          const npc = findContactByName(db, tgt) || findContactById(db, tgt);
          if (!npc){ try{toast('找不到该角色');}catch(e){} return; }
          // ✅ 仅在小手机内部互换，不动 SillyTavern 角色卡
          const myText = act2.text || '';
          const charText = npc.profile || '';
          act2.text = charText;
          _saveActivePersona(act2);
          npc.profile = myText;
          saveContactsDB(db);
          try{toast('人设已互换');}catch(e){}
          _renderPersonaPage(container);
        }));
      }

      function _openPersonaEditor(container, editIdx){
        const data = _loadPersonas();
        const existing = (typeof editIdx === 'number') ? data.list[editIdx] : null;
        const isEdit = !!existing;
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:280px;text-align:left;max-height:80vh;overflow-y:auto;">
          <div style="font-weight:700;font-size:15px;color:rgba(20,24,28,.88);margin-bottom:14px;text-align:center;">${isEdit ? '编辑人设' : '新建人设'}</div>
          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:4px;">人设名称 *</div>
            <input data-field="pName" placeholder="给人设起个名字" value="${esc(existing?.name||'')}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;"/>
          </div>
          <div style="margin-bottom:14px;">
            <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:4px;">人设内容 *</div>
            <textarea data-field="pText" rows="8" placeholder="描述你的人设…" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;resize:vertical;">${esc(existing?.text||'')}</textarea>
          </div>
          <div style="display:flex;gap:8px;">
            <button data-act="pCancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.6);font-size:13px;cursor:pointer;">取消</button>
            <button data-act="pSave" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">保存</button>
          </div>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{ if(e.target===overlay) overlay.remove(); });
        overlay.querySelector('[data-act="pCancel"]')?.addEventListener('click',()=> overlay.remove());
        overlay.querySelector('[data-act="pSave"]')?.addEventListener('click',()=>{
          const name = (overlay.querySelector('[data-field="pName"]')?.value||'').trim();
          const text = (overlay.querySelector('[data-field="pText"]')?.value||'').trim();
          if (!name || !text){ try{toast('名称和内容不能为空');}catch(e){} return; }
          if (isEdit){
            data.list[editIdx] = { ...existing, name, text, editTime: Date.now() };
          } else {
            const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6);
            data.list.push({ id, name, text, time: Date.now() });
          }
          _savePersonas(data);
          overlay.remove();
          try{toast(isEdit ? '人设已更新' : '人设已创建');}catch(e){}
          _renderPersonaPage(container);
        });
      }

      // ===================== 4.3 表情页 =====================
      // 数据层 key: meow_phone_g_sticker_packs_v1
      // 容量保护：单组最多 50 张，单张最大 200KB base64
      const STICKER_MAX_PER_GROUP = 50;
      const STICKER_MAX_SIZE_KB = 200;

      function _loadStickerPacks(){
        return phoneGetG('sticker_packs_v1', { v:1, user:[], char:[], common:[] }) || { v:1, user:[], char:[], common:[] };
      }
      function _saveStickerPacks(d){ phoneSetG('sticker_packs_v1', d); }

      function _renderStickersPage(container){
        const packs = _loadStickerPacks();
        const groups = [
          { key:'user', label:'我的表情', icon:'👤' },
          { key:'char', label:'角色表情', icon:'🤖' },
          { key:'common', label:'通用表情', icon:'🌐' },
        ];
        let curGroup = container.__stickerGroup || 'user';
        const curList = _safeArr(packs[curGroup]);

        let html = '';
        // 分组切换
        html += `<div style="display:flex;border-bottom:1px solid rgba(0,0,0,.06);margin:0 14px;">`;
        for (const g of groups){
          const isOn = g.key === curGroup;
          html += `<button data-act="stkGroup" data-gkey="${g.key}" style="flex:1;padding:10px;border:0;border-bottom:2px solid ${isOn?'#07c160':'transparent'};background:transparent;color:${isOn?'#07c160':'rgba(20,24,28,.5)'};font-size:13px;cursor:pointer;font-weight:${isOn?'600':'400'};">${g.icon} ${g.label} (${_safeArr(packs[g.key]).length})</button>`;
        }
        html += `</div>`;

        // 上传按钮
        html += `<div style="padding:12px 14px;">
          <button data-act="stkUpload" style="width:100%;padding:10px;border-radius:12px;border:1px dashed rgba(0,0,0,.15);background:#fff;color:rgba(20,24,28,.5);font-size:13px;cursor:pointer;">+ 上传表情图片</button>
          <div style="font-size:10px;color:rgba(20,24,28,.3);margin-top:4px;text-align:center;">单组最多${STICKER_MAX_PER_GROUP}张，单张≤${STICKER_MAX_SIZE_KB}KB</div>
        </div>`;

        // 网格
        if (!curList.length){
          html += `<div style="padding:30px 14px;text-align:center;font-size:12px;color:rgba(20,24,28,.35);">暂无表情</div>`;
        } else {
          html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px 14px;">`;
          for (let i = 0; i < curList.length; i++){
            const s = curList[i];
            const imgSrc = (s.data && s.data.indexOf('idb:') !== 0) ? s.data : '';
            html += `<div style="position:relative;padding-top:100%;border-radius:10px;overflow:hidden;background:rgba(0,0,0,.03);border:1px solid rgba(0,0,0,.06);">`;
            if (imgSrc){
              html += `<img src="${imgSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'"/>`;
            } else {
              html += `<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(20,24,28,.3);">已丢失</div>`;
            }
            html += `<button data-act="stkDel" data-sidx="${i}" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;border:0;background:rgba(0,0,0,.5);color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
            </div>`;
          }
          html += `</div>`;
        }
        container.innerHTML = html;

        // 事件
        container.querySelectorAll('[data-act="stkGroup"]').forEach(b => b.addEventListener('click',()=>{
          container.__stickerGroup = b.getAttribute('data-gkey');
          _renderStickersPage(container);
        }));
        container.querySelectorAll('[data-act="stkUpload"]').forEach(b => b.addEventListener('click',()=>{
          const packs2 = _loadStickerPacks();
          const arr = _safeArr(packs2[curGroup]);
          if (arr.length >= STICKER_MAX_PER_GROUP){
            try{toast(`此分组已满（最多${STICKER_MAX_PER_GROUP}张）`);}catch(e){} return;
          }
          const inp = doc.createElement('input');
          inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
          inp.onchange = ()=>{
            try{
              const files = Array.from(inp.files||[]);
              if (!files.length) return;
              let added = 0;
              const packs3 = _loadStickerPacks();
              const gArr = _safeArr(packs3[curGroup]);
              const processNext = (idx)=>{
                if (idx >= files.length || gArr.length >= STICKER_MAX_PER_GROUP){
                  packs3[curGroup] = gArr;
                  _saveStickerPacks(packs3);
                  try{toast(`已添加 ${added} 张表情`);}catch(e){}
                  _renderStickersPage(container);
                  return;
                }
                const f = files[idx];
                if (f.size > STICKER_MAX_SIZE_KB * 1024){
                  try{toast(`${f.name} 超过${STICKER_MAX_SIZE_KB}KB，已跳过`);}catch(e){}
                  processNext(idx+1);
                  return;
                }
                const reader = new FileReader();
                reader.onload = ()=>{
                  // 自动压缩到 128px
                  _compressBase64Image(reader.result, 128, 0.7, function(compressed){
                    gArr.push({ data: compressed, name: f.name, time: Date.now() });
                    added++;
                    processNext(idx+1);
                  });
                };
                reader.onerror = ()=> processNext(idx+1);
                reader.readAsDataURL(f);
              };
              processNext(0);
            }catch(e){ _renderStickersPage(container); }
          };
          inp.click();
        }));
        container.querySelectorAll('[data-act="stkDel"]').forEach(b => b.addEventListener('click',()=>{
          const idx = Number(b.getAttribute('data-sidx'));
          if (isNaN(idx)) return;
          if (W.confirm && !W.confirm('删除此表情？')) return;
          const packs4 = _loadStickerPacks();
          _safeArr(packs4[curGroup]).splice(idx, 1);
          _saveStickerPacks(packs4);
          try{toast('已删除');}catch(e){}
          _renderStickersPage(container);
        }));
      }

      // ===================== B: API 预设数据层 =====================
      // key: LS_PHONE_API_PRESETS = 'meow_phone_api_presets_v1'
      function _loadApiPresets(){
        try{
          const d = lsGet(LS_PHONE_API_PRESETS, null);
          if (d && d.v === 1 && Array.isArray(d.presets)) return d;
        }catch(e){}
        return { v:1, activeId:'', presets:[] };
      }
      function _saveApiPresets(d){
        try{ lsSet(LS_PHONE_API_PRESETS, d); }catch(e){}
        // 清除 PhoneAI URL 缓存（配置变了，需重新探测）
        try{ if(typeof PhoneAI !== 'undefined' && PhoneAI) PhoneAI._cachedChatUrl = ''; }catch(e){}
      }
      function _newApiPreset(name){
        return { id:'ap_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), name:name||'新预设', baseUrl:'', apiKey:'', model:'', extra:{}, updatedAt:Date.now() };
      }

      // ===================== B: renderApiSettingsPage（完整 API 设置页） =====================
      function renderApiSettingsPage(container){
        let data = _loadApiPresets();
        const presets = data.presets || [];
        const activeId = data.activeId || '';
        const _esc = esc; // alias

        function _renderList(){
          let html = `<div class="settingSubPage" style="padding:14px;">
            <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;margin-bottom:12px;">‹ 返回设置</button>
            <div style="font-size:15px;font-weight:700;color:var(--ph-text);margin-bottom:14px;">API 设置</div>`;

          if (!presets.length){
            html += `<div style="padding:20px;text-align:center;font-size:12px;color:var(--ph-text-dim);">暂无预设，点击下方新建</div>`;
          } else {
            presets.forEach((p,idx)=>{
              const isActive = p.id === activeId;
              html += `<div style="margin-bottom:10px;padding:14px;border-radius:14px;background:${isActive?'rgba(7,193,96,.08)':'rgba(255,255,255,.7)'};border:1px solid ${isActive?'rgba(7,193,96,.3)':'rgba(0,0,0,.06)'};cursor:pointer;" data-act="apiEditPreset" data-pidx="${idx}">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                  <span style="font-size:14px;font-weight:600;color:var(--ph-text);flex:1;">${_esc(p.name)}${isActive?' <span style="font-size:10px;color:#07c160;">● 使用中</span>':''}</span>
                  <button data-act="apiActivate" data-pid="${_esc(p.id)}" style="padding:4px 10px;border-radius:8px;border:1px solid ${isActive?'#07c160':'rgba(0,0,0,.1)'};background:${isActive?'#07c160':'#fff'};color:${isActive?'#fff':'var(--ph-text-sub)'};font-size:11px;cursor:pointer;">${isActive?'已启用':'启用'}</button>
                </div>
                <div style="font-size:11px;color:var(--ph-text-dim);word-break:break-all;">URL: ${_esc((p.baseUrl||'').slice(0,60)||'未设置')}</div>
                <div style="font-size:11px;color:var(--ph-text-dim);">Model: ${_esc(p.model||'未设置')}</div>
              </div>`;
            });
          }
          html += `<div style="display:flex;gap:8px;margin-top:14px;">
            <button data-act="apiAddPreset" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,.1);background:#fff;color:var(--ph-text);font-size:13px;cursor:pointer;">+ 新建预设</button>
            <button data-act="apiExportAll" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,.1);background:#fff;color:var(--ph-text);font-size:13px;cursor:pointer;">导出预设</button>
          </div></div>`;
          container.innerHTML = html;
          _bindApiListEvents(container);
        }

        function _bindApiListEvents(ct){
          ct.querySelectorAll('[data-act="settingsBack"]').forEach(b=>b.addEventListener('click',()=>renderSettings(ct)));
          ct.querySelectorAll('[data-act="apiAddPreset"]').forEach(b=>b.addEventListener('click',()=>{
            const name = W.prompt?.('预设名称：','新预设');
            if (!name) return;
            const np = _newApiPreset(name);
            data.presets.push(np);
            if (!data.activeId) data.activeId = np.id;
            _saveApiPresets(data);
            _openPresetEditor(ct, data.presets.length-1);
          }));
          ct.querySelectorAll('[data-act="apiActivate"]').forEach(b=>b.addEventListener('click',(e)=>{
            e.stopPropagation();
            data.activeId = b.getAttribute('data-pid')||'';
            _saveApiPresets(data);
            _renderList();
          }));
          ct.querySelectorAll('[data-act="apiEditPreset"]').forEach(b=>b.addEventListener('click',()=>{
            const idx = parseInt(b.getAttribute('data-pidx'),10);
            if (data.presets[idx]) _openPresetEditor(ct, idx);
          }));
          ct.querySelectorAll('[data-act="apiExportAll"]').forEach(b=>b.addEventListener('click',()=> _apiExportDialog(false)));
        }

        function _openPresetEditor(ct, idx){
          const p = data.presets[idx];
          if (!p) return;
          let showKey = false;
          function _render(){
            const maskedKey = p.apiKey ? ('•'.repeat(Math.min(12,p.apiKey.length)) + p.apiKey.slice(-4)) : '';
            let html = `<div class="settingSubPage" style="padding:14px;">
              <button data-act="apiEditorBack" style="appearance:none;border:0;background:var(--ph-glass);color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;margin-bottom:12px;">‹ 返回列表</button>
              <div style="font-size:15px;font-weight:700;color:var(--ph-text);margin-bottom:14px;">${_esc(p.name)}</div>
              <div style="display:flex;flex-direction:column;gap:10px;">
                <label style="font-size:12px;color:var(--ph-text-sub);">预设名称</label>
                <input data-el="apiName" value="${_esc(p.name)}" style="padding:10px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:13px;background:#fff;color:var(--ph-text);" />
                <label style="font-size:12px;color:var(--ph-text-sub);">Base URL</label>
                <input data-el="apiUrl" value="${_esc(p.baseUrl)}" placeholder="https://api.openai.com/v1" style="padding:10px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:13px;background:#fff;color:var(--ph-text);" />
                <label style="font-size:12px;color:var(--ph-text-sub);">API Key</label>
                <div style="display:flex;gap:6px;align-items:center;">
                  <input data-el="apiKey" type="${showKey?'text':'password'}" value="${_esc(p.apiKey)}" placeholder="sk-..." style="flex:1;padding:10px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:13px;background:#fff;color:var(--ph-text);" />
                  <button data-act="apiToggleKey" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.1);background:#fff;font-size:11px;cursor:pointer;white-space:nowrap;">${showKey?'隐藏':'显示'}</button>
                </div>
                <label style="font-size:12px;color:var(--ph-text-sub);">模型（可手动输入或拉取）</label>
                <div style="display:flex;gap:6px;align-items:center;">
                  <input data-el="apiModel" value="${_esc(p.model)}" placeholder="gpt-4o / claude-3.5-sonnet" style="flex:1;padding:10px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:13px;background:#fff;color:var(--ph-text);" />
                  <button data-act="apiFetchModels" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.1);background:#fff;font-size:11px;cursor:pointer;white-space:nowrap;">拉取</button>
                </div>
                <div data-el="apiModelList" style="display:none;"></div>
              </div>
              <div style="display:flex;gap:8px;margin-top:16px;">
                <button data-act="apiTestConn" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(59,130,246,.3);background:rgba(59,130,246,.08);color:#3b82f6;font-size:13px;font-weight:600;cursor:pointer;">测试连接</button>
                <button data-act="apiSavePreset" style="flex:1;padding:12px;border-radius:12px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">保存</button>
              </div>
              <div data-el="apiTestResult" style="margin-top:10px;"></div>
              <div style="display:flex;gap:8px;margin-top:14px;">
                <button data-act="apiRenamePreset" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;color:var(--ph-text-sub);font-size:12px;cursor:pointer;">重命名</button>
                <button data-act="apiDeletePreset" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(239,68,68,.2);background:#fff;color:#ef4444;font-size:12px;cursor:pointer;">删除</button>
                <button data-act="apiExportOne" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;color:var(--ph-text-sub);font-size:12px;cursor:pointer;">导出此预设</button>
              </div>
            </div>`;
            ct.innerHTML = html;
            _bindEditorEvents(ct, idx);
          }

          function _bindEditorEvents(ct2, pidx){
            ct2.querySelector('[data-act="apiEditorBack"]')?.addEventListener('click',()=>{
              data = _loadApiPresets(); _renderList();
            });
            ct2.querySelector('[data-act="apiToggleKey"]')?.addEventListener('click',()=>{
              // 防误触确认
              if (!showKey){
                if (!W.confirm?.('确定要显示 API Key 明文？')) return;
              }
              showKey = !showKey; _render();
            });
            ct2.querySelector('[data-act="apiSavePreset"]')?.addEventListener('click',()=>{
              const getVal = (el)=>(ct2.querySelector(`[data-el="${el}"]`)?.value||'').trim();
              p.name = getVal('apiName') || p.name;
              p.baseUrl = getVal('apiUrl');
              p.apiKey = getVal('apiKey');
              p.model = getVal('apiModel');
              p.updatedAt = Date.now();
              data.presets[pidx] = p;
              _saveApiPresets(data);
              try{toast('已保存');}catch(e){}
            });
            ct2.querySelector('[data-act="apiTestConn"]')?.addEventListener('click', async ()=>{
              const resultEl = ct2.querySelector('[data-el="apiTestResult"]');
              if (!resultEl) return;
              const url = (ct2.querySelector('[data-el="apiUrl"]')?.value||'').trim();
              const key = (ct2.querySelector('[data-el="apiKey"]')?.value||'').trim();
              if (!url){ resultEl.innerHTML = '<div style="font-size:12px;color:#ef4444;">请先填写 Base URL</div>'; return; }
              resultEl.innerHTML = '<div style="font-size:12px;color:var(--ph-text-dim);">测试中…</div>';
              const t0 = Date.now();
              const ctrl = new AbortController();
              const timer = setTimeout(()=> ctrl.abort(), 8000);
              try{
                const headers = { 'Content-Type':'application/json' };
                if (key) headers['Authorization'] = 'Bearer '+key;
                const resp = await fetch(url.replace(/\/+$/,'')+'/models', { method:'GET', headers, signal:ctrl.signal });
                clearTimeout(timer);
                const ms = Date.now()-t0;
                if (resp.ok){
                  resultEl.innerHTML = `<div style="font-size:12px;color:#07c160;font-weight:600;">✅ 连接成功（${ms}ms）</div>`;
                } else {
                  resultEl.innerHTML = `<div style="font-size:12px;color:#ef4444;">❌ HTTP ${resp.status}（${ms}ms）</div>`;
                }
              }catch(err){
                clearTimeout(timer);
                const ms = Date.now()-t0;
                const msg = err.name==='AbortError' ? '超时（8s）' : (err.message||'网络错误');
                resultEl.innerHTML = `<div style="font-size:12px;color:#ef4444;">❌ ${_esc(msg)}（${ms}ms）</div>`;
              }
            });
            ct2.querySelector('[data-act="apiFetchModels"]')?.addEventListener('click', async ()=>{
              const listEl = ct2.querySelector('[data-el="apiModelList"]');
              if (!listEl) return;
              const url = (ct2.querySelector('[data-el="apiUrl"]')?.value||'').trim();
              const key = (ct2.querySelector('[data-el="apiKey"]')?.value||'').trim();
              if (!url){ try{toast('请先填写 Base URL');}catch(e){} return; }
              listEl.style.display = 'block';
              listEl.innerHTML = '<div style="font-size:12px;color:var(--ph-text-dim);padding:6px 0;">拉取模型中…</div>';
              const ctrl = new AbortController();
              const timer = setTimeout(()=> ctrl.abort(), 8000);
              try{
                const headers = { 'Content-Type':'application/json' };
                if (key) headers['Authorization'] = 'Bearer '+key;
                const resp = await fetch(url.replace(/\/+$/,'')+'/models', { method:'GET', headers, signal:ctrl.signal });
                clearTimeout(timer);
                if (!resp.ok) throw new Error('HTTP '+resp.status);
                const body = await resp.json();
                let models = [];
                if (Array.isArray(body.data)) models = body.data.map(m=>m.id||m.name||'').filter(Boolean);
                else if (Array.isArray(body)) models = body.map(m=>typeof m==='string'?m:(m.id||m.name||'')).filter(Boolean);
                if (!models.length){ listEl.innerHTML = '<div style="font-size:12px;color:#ef4444;padding:6px 0;">未获取到模型列表</div>'; return; }
                let mhtml = '<div style="max-height:200px;overflow-y:auto;border:1px solid rgba(0,0,0,.06);border-radius:10px;background:#fff;">';
                models.forEach(m=>{
                  mhtml += `<div data-act="apiPickModel" data-model="${_esc(m)}" style="padding:8px 12px;border-bottom:1px solid rgba(0,0,0,.04);font-size:12px;color:var(--ph-text);cursor:pointer;">${_esc(m)}</div>`;
                });
                mhtml += '</div>';
                listEl.innerHTML = mhtml;
                listEl.querySelectorAll('[data-act="apiPickModel"]').forEach(el=>{
                  el.addEventListener('click',()=>{
                    const modelInput = ct2.querySelector('[data-el="apiModel"]');
                    if (modelInput) modelInput.value = el.getAttribute('data-model')||'';
                    listEl.style.display = 'none';
                    try{toast('已选择: '+(el.getAttribute('data-model')||''));}catch(e){}
                  });
                });
              }catch(err){
                clearTimeout(timer);
                const msg = err.name==='AbortError' ? '超时（8s）' : (err.message||'拉取失败');
                listEl.innerHTML = `<div style="font-size:12px;color:#ef4444;padding:6px 0;">❌ ${_esc(msg)}</div>`;
              }
            });
            ct2.querySelector('[data-act="apiRenamePreset"]')?.addEventListener('click',()=>{
              const newName = W.prompt?.('新名称：', p.name);
              if (newName && newName.trim()){
                p.name = newName.trim();
                p.updatedAt = Date.now();
                data.presets[pidx] = p;
                _saveApiPresets(data);
                _render();
              }
            });
            ct2.querySelector('[data-act="apiDeletePreset"]')?.addEventListener('click',()=>{
              if (!W.confirm?.(`确定删除预设「${p.name}」？`)) return;
              data.presets.splice(pidx, 1);
              if (data.activeId === p.id) data.activeId = data.presets[0]?.id || '';
              _saveApiPresets(data);
              _renderList();
            });
            ct2.querySelector('[data-act="apiExportOne"]')?.addEventListener('click',()=> _apiExportDialog(true, pidx));
          }

          _render();
        }

        function _apiExportDialog(singleMode, pidx){
          root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
          const overlay = doc.createElement('div');
          overlay.className = 'wxConfirmOverlay';
          overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:280px;text-align:left;">
            <div style="font-weight:700;font-size:14px;color:var(--ph-text);margin-bottom:10px;">导出${singleMode?'当前预设':'全部预设'}</div>
            <label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;">
              <input type="checkbox" data-el="incKey" style="width:16px;height:16px;accent-color:#07c160;" />
              <span style="font-size:13px;color:var(--ph-text);">包含 API Key（敏感）</span>
            </label>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <button data-act="exCancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:var(--ph-text-sub);font-size:13px;cursor:pointer;">取消</button>
              <button data-act="exConfirm" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">导出</button>
            </div>
          </div>`;
          root.appendChild(overlay);
          overlay.addEventListener('click',(e)=>{ if(e.target===overlay) overlay.remove(); });
          overlay.querySelector('[data-act="exCancel"]')?.addEventListener('click',()=> overlay.remove());
          overlay.querySelector('[data-act="exConfirm"]')?.addEventListener('click',()=>{
            const incKey = overlay.querySelector('[data-el="incKey"]')?.checked;
            if (incKey && !W.confirm?.('⚠️ 导出将包含 API Key 明文，确认？')) return;
            let exportPresets;
            if (singleMode && typeof pidx === 'number'){
              exportPresets = [data.presets[pidx]];
            } else {
              exportPresets = data.presets;
            }
            const pack = { _meowApiPresets:1, v:1, exportedAt:Date.now(), presets: exportPresets.map(p=>{
              const cp = Object.assign({}, p);
              if (!incKey) cp.apiKey = cp.apiKey ? '***MASKED***' : '';
              return cp;
            })};
            _downloadOrCopyJSON(pack, 'meow_api_presets.json');
            overlay.remove();
          });
        }

        _renderList();
      }

      // ===================== C2: renderDataManagerPage（覆盖全小手机配置导入导出） =====================
      // 模块白名单（用于选择性导出）
      const _DM_MODULES = [
        { key:'settings', label:'设置/UI', prefix:['meow_phone_g_settings','meow_phone_g_theme'], desc:'主题、壁纸、字体等设置' },
        { key:'contacts', label:'通讯录', prefix:['meow_phone_g_contacts','meow_phone_contacts'], desc:'好友列表' },
        { key:'chats', label:'聊天', prefix:['meow_phone_c_'], desc:'所有聊天记录' },
        { key:'groups', label:'群聊', prefix:['meow_phone_g_groups'], desc:'群聊配置' },
        { key:'moments', label:'朋友圈', prefix:['meow_phone_g_moments'], desc:'动态与评论' },
        { key:'favorites', label:'收藏/日记', prefix:['meow_phone_g_favorites'], desc:'收藏语录与日记' },
        { key:'personas', label:'人设', prefix:['meow_phone_g_personas','meow_phone_g_active_persona'], desc:'角色人设' },
        { key:'stickers', label:'表情', prefix:['meow_phone_g_sticker'], desc:'表情包' },
        { key:'blacklist', label:'黑名单', prefix:['meow_phone_g_blacklist'], desc:'拉黑列表' },
        { key:'apiPresets', label:'API预设', prefix:['meow_phone_api_presets'], desc:'API 配置预设' },
        { key:'widgets', label:'小组件/布局', prefix:['meow_phone_g_widgets','meow_phone_g_layout'], desc:'桌面小组件' },
        { key:'media', label:'相册/壁纸/头像', prefix:['meow_phone_g_media','meow_phone_g_avatars','meow_phone_g_photos'], desc:'图片资源' },
        { key:'misc', label:'其他数据', prefix:['meow_phone_'], desc:'其余 meow_phone_ 开头的数据', isCatchAll:true },
      ];

      function _getKeysForModule(mod){
        if (mod.isCatchAll){
          // 所有 meow_phone_ 开头但不被其他模块匹配的 key
          const others = _DM_MODULES.filter(m=>!m.isCatchAll).flatMap(m=>m.prefix);
          const result = [];
          for (let i=0; i<W.localStorage.length; i++){
            const k = W.localStorage.key(i);
            if (!k || !k.startsWith(PHONE_DATA_PREFIX)) continue;
            if (!others.some(pf=> k.startsWith(pf))) result.push(k);
          }
          return result;
        }
        const result = [];
        for (let i=0; i<W.localStorage.length; i++){
          const k = W.localStorage.key(i);
          if (k && mod.prefix.some(pf=> k.startsWith(pf))) result.push(k);
        }
        return result;
      }

      function renderDataManagerPage(container){
        // 计算 localStorage 使用量
        var lsUsageBytes = 0;
        try{ lsUsageBytes = estimateLSUsage(); }catch(e){}
        var lsUsageKB = (lsUsageBytes / 1024).toFixed(1);
        var lsMaxKB = 5120;
        var lsPct = Math.min(100, (lsUsageBytes / (lsMaxKB * 1024) * 100)).toFixed(0);
        var lsBarWidth = Math.min(100, Math.max(2, parseFloat(lsPct)));

        // 计算 sessionStorage 使用量
        var ssUsageBytes = 0;
        try{ for(var i=0;i<sessionStorage.length;i++){ var k=sessionStorage.key(i); ssUsageBytes+=((k||'').length+(sessionStorage.getItem(k)||'').length)*2; } }catch(e){}
        var ssUsageKB = (ssUsageBytes / 1024).toFixed(1);

        let html = `<div class="settingSubPage" style="padding:14px;">
          <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;margin-bottom:12px;">‹ 返回设置</button>
          <div style="font-size:15px;font-weight:700;color:var(--ph-text);margin-bottom:14px;">数据管理</div>

          <!-- 存储使用情况 -->
          <div style="background:var(--ph-glass);border:1px solid var(--ph-glass-border);border-radius:14px;padding:14px;margin-bottom:14px;">
            <div style="font-size:13px;font-weight:600;color:var(--ph-text);margin-bottom:10px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle;margin-right:4px;opacity:.7;"><path d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z"/></svg>
              存储使用情况
            </div>
            <div style="margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:12px;color:var(--ph-text-sub);">localStorage</span>
                <span style="font-size:11px;color:var(--ph-text-dim);">${lsUsageKB} KB / ${lsMaxKB} KB (${lsPct}%)</span>
              </div>
              <div style="width:100%;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;">
                <div style="width:${lsBarWidth}%;height:100%;background:${parseFloat(lsPct)>80?'linear-gradient(90deg,#ef4444,#f97316)':'var(--ph-accent-grad)'};border-radius:3px;transition:width .3s;"></div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:12px;color:var(--ph-text-sub);">sessionStorage</span>
              <span style="font-size:11px;color:var(--ph-text-dim);">约 ${ssUsageKB} KB</span>
            </div>
            <div data-ph="idbStatus" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
              <span style="font-size:12px;color:var(--ph-text-sub);">IndexedDB</span>
              <span style="font-size:11px;color:var(--ph-text-dim);">检测中…</span>
            </div>
          </div>

          <!-- 存储分析（按 key 大小排序） -->
          <div data-ph="storageAnalyzer" style="background:var(--ph-glass);border:1px solid var(--ph-glass-border);border-radius:14px;padding:14px;margin-bottom:14px;">
            <div style="font-size:13px;font-weight:600;color:var(--ph-text);margin-bottom:10px;">
              🔍 存储空间分析
            </div>
            <div data-ph="analyzerContent" style="font-size:11px;color:var(--ph-text-dim);">分析中…</div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <button data-act="dmStorageOptimize" style="padding:14px;border-radius:14px;border:1px solid rgba(34,197,94,.2);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>🧹 一键存储优化</b><br><span style="font-size:11px;color:var(--ph-text-dim);">清理论坛虚拟数据 + 世界书快照 + 过期缓存</span>
            </button>
            <button data-act="dmCompressImages" style="padding:14px;border-radius:14px;border:1px solid rgba(34,197,94,.2);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>🗜️ 压缩图片数据</b><br><span style="font-size:11px;color:var(--ph-text-dim);">将头像压缩到 64px、表情压缩到 128px、壁纸压缩到 480px</span>
            </button>
            <button data-act="dmRetryIDB" style="padding:14px;border-radius:14px;border:1px solid rgba(59,130,246,.2);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>🔄 重试 IndexedDB</b><br><span style="font-size:11px;color:var(--ph-text-dim);">删除旧数据库后重新初始化</span>
            </button>
            <button data-act="dmBackupAll" style="padding:14px;border-radius:14px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>💾 备份全部</b><br><span style="font-size:11px;color:var(--ph-text-dim);">一键导出所有小手机数据</span>
            </button>
            <button data-act="dmExportSelected" style="padding:14px;border-radius:14px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>📤 选择导出</b><br><span style="font-size:11px;color:var(--ph-text-dim);">勾选模块分别导出</span>
            </button>
            <button data-act="dmImport" style="padding:14px;border-radius:14px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>📥 导入数据</b><br><span style="font-size:11px;color:var(--ph-text-dim);">粘贴 JSON 或选择文件导入</span>
            </button>
            <button data-act="dmClearAICache" style="padding:14px;border-radius:14px;border:1px solid rgba(239,68,68,.1);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>🗑️ 清空 AI 资讯缓存</b><br><span style="font-size:11px;color:var(--ph-text-dim);">清除 AutoFeed 生成的临时资讯</span>
            </button>
            <button data-act="dmClearAll" style="padding:14px;border-radius:14px;border:1px solid rgba(239,68,68,.15);background:var(--ph-glass);color:#ef4444;font-size:13px;cursor:pointer;text-align:left;">
              <b>🗑️ 清空所有数据</b><br><span style="font-size:11px;color:rgba(239,68,68,.4);">二次确认后清空（仅小手机）</span>
            </button>
          </div>
        </div>`;
        container.innerHTML = html;

        // ===== 存储分析：显示 top 15 最大 key =====
        (function(){
          try{
            var analyzerEl = container.querySelector('[data-ph="analyzerContent"]');
            if (!analyzerEl) return;

            // 统计所有 key 的大小
            var allEntries = [];
            var phoneBytes = 0, otherBytes = 0;
            for (var i = 0; i < W.localStorage.length; i++){
              var k = W.localStorage.key(i);
              var v = W.localStorage.getItem(k) || '';
              var bytes = (k.length + v.length) * 2; // UTF-16
              var isPhone = k.indexOf('meow_') === 0;
              if (isPhone) phoneBytes += bytes; else otherBytes += bytes;
              allEntries.push({ key:k, bytes:bytes });
            }
            allEntries.sort(function(a,b){ return b.bytes - a.bytes; });

            var topN = allEntries.slice(0, 15);
            var totalKB = ((phoneBytes + otherBytes) / 1024).toFixed(1);
            var phoneKB = (phoneBytes / 1024).toFixed(1);
            var otherKB = (otherBytes / 1024).toFixed(1);

            // 人类可读标签
            var keyLabels = {
              'meow_phone_g_avatars_v1': '📸 自定义头像(base64图片)',
              'meow_phone_g_settings_data_v1': '⚙️ 设置(含壁纸base64)',
              'meow_worldbook_local_v1': '📖 世界书本地数据',
              'meow_wb_by_chat_v1': '📖 世界书快照缓存（点删可清理旧聊天）',
              'meow_sum_by_chat_v1': '📝 聊天总结数据',
              'meow_wi_queue_v1': '📋 世界书队列',
              'meow_phone_chat_summary_v1': '📝 手机聊天总结',
              'meow_forum_dm_v1': '💬 论坛私信',
              'meow_sync_stage_v1': '🔄 同步暂存',
              'meow_phone_api_presets_v1': '🔑 API预设',
            };

            var h = '<div style="margin-bottom:6px;font-size:11px;color:var(--ph-text-sub);">小手机: <b>' + phoneKB + ' KB</b> | 其他(酒馆等): <b>' + otherKB + ' KB</b></div>';
            h += '<div style="border-top:1px solid rgba(128,128,128,.15);padding-top:6px;">';
            for (var ti = 0; ti < topN.length; ti++){
              var e = topN[ti];
              var kb = (e.bytes / 1024).toFixed(1);
              var pct = ((e.bytes / (phoneBytes + otherBytes)) * 100).toFixed(1);
              var shortKey = e.key.length > 42 ? e.key.slice(0,40) + '…' : e.key;
              var label = keyLabels[e.key] || '';
              if (!label && e.key.indexOf('char_extra') !== -1) label = '🎭 角色扩展(含背景图)';
              if (!label && e.key.indexOf('forum_data') !== -1) label = '📋 论坛帖子数据';
              if (!label && e.key.indexOf('meow_phone_c_st:') !== -1) label = '💬 聊天记录';
              if (!label && e.key.indexOf('meow_phone_c_fallback') !== -1) label = '💬 聊天记录(fallback)';
              if (!label && e.key.indexOf('mingyu_') !== -1) label = '🧩 酒馆扩展数据';
              var displayName = label ? label : shortKey;
              var isPhone = e.key.indexOf('meow_') === 0;
              var canDel = isPhone && e.bytes > 1024; // >1KB 的小手机 key 可单独删
              h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:2px 0;font-size:10px;' + (isPhone ? '' : 'opacity:.6;') + '">';
              h += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ph-text-dim);" title="' + esc(e.key) + '">' + esc(displayName) + '</span>';
              h += '<span style="margin-left:6px;white-space:nowrap;color:' + (parseFloat(kb) > 100 ? '#f97316' : 'var(--ph-text-dim)') + ';">' + kb + ' KB (' + pct + '%)</span>';
              if (canDel){
                h += '<button data-act="dmDelKey" data-key="' + esc(e.key) + '" style="margin-left:4px;border:0;background:rgba(239,68,68,.1);color:#ef4444;font-size:9px;padding:1px 5px;border-radius:4px;cursor:pointer;">删</button>';
              }
              h += '</div>';
            }
            h += '</div>';
            if (allEntries.length > 15){
              h += '<div style="font-size:10px;color:var(--ph-text-dim);margin-top:4px;">（共 ' + allEntries.length + ' 个 key，仅显示前 15 个最大的）</div>';
            }
            analyzerEl.innerHTML = h;

            // 绑定单个删除
            analyzerEl.querySelectorAll('[data-act="dmDelKey"]').forEach(function(btn){
              btn.addEventListener('click', function(){
                var key = btn.getAttribute('data-key');
                // 世界书快照：特殊处理，只保留当前聊天
                if(key === 'meow_wb_by_chat_v1'){
                  try{
                    var snap = JSON.parse(W.localStorage.getItem(key)||'{}');
                    var map = snap.map || {};
                    var keys = Object.keys(map);
                    var curUID = (typeof meowGetChatUID==='function') ? meowGetChatUID() : '';
                    var kept = curUID && map[curUID] ? 1 : 0;
                    var newMap = {};
                    if(curUID && map[curUID]) newMap[curUID] = map[curUID];
                    W.localStorage.setItem(key, JSON.stringify({map:newMap}));
                    toast('已清理 '+(keys.length-kept)+' 个旧聊天快照，保留当前聊天');
                    // 刷新分析
                    try{ root.querySelector('[data-act="dmAnalyze"]')?.click(); }catch(e){}
                  }catch(e){ toast('清理失败'); }
                  return;
                }
                if (!W.confirm?.('删除 key: ' + key + '？')) return;
                try{ W.localStorage.removeItem(key); }catch(e){}
                try{ toast('已删除'); }catch(e){}
                renderDataManagerPage(container);
              });
            });
          }catch(e){ console.warn('[MEOW] storage analyzer error:', e); }
        })();

        // 异步加载 IndexedDB 状态
        (async function(){
          try{
            var idbEl = container.querySelector('[data-ph="idbStatus"]');
            if(!idbEl) return;
            if(typeof MeowDB !== 'undefined' && MeowDB.isReady()){
              // 尝试估算 IDB 总大小
              var totalBytes = 0;
              var storeInfo = [];
              for(var si=0; si<MeowDB._stores.length; si++){
                try{
                  var info = await MeowDB.getStoreSize(MeowDB._stores[si]);
                  if(info.count > 0) storeInfo.push(MeowDB._stores[si]+':'+info.count+'条');
                  totalBytes += info.bytes;
                }catch(e){}
              }
              var idbKB = (totalBytes / 1024).toFixed(1);
              var detail = storeInfo.length ? ' ('+storeInfo.join(', ')+')' : '';
              idbEl.querySelector('span:last-child').textContent = '约 '+idbKB+' KB'+detail;
              idbEl.querySelector('span:last-child').style.color = 'var(--ph-text-dim)';
            } else if(typeof MeowDB !== 'undefined' && MeowDB.isFallback()){
              idbEl.querySelector('span:last-child').textContent = '不可用（已降级）';
              idbEl.querySelector('span:last-child').style.color = '#f97316';
            } else {
              idbEl.querySelector('span:last-child').textContent = '未初始化';
            }
          }catch(e){}
        })();

        container.querySelector('[data-act="settingsBack"]')?.addEventListener('click',()=> renderSettings(container));

        // ===== 一键存储优化 =====
        container.querySelector('[data-act="dmStorageOptimize"]')?.addEventListener('click',()=>{
          var freed = 0;
          var details = [];

          // 0) 清理 idb: 残留引用（上次迁移失败的遗留）
          try{
            // 清理头像
            var avatarClean = phoneLoadAvatars(); // 已在 loadAvatars 中自动清理 'idb'
            phoneSaveAvatars(avatarClean);

            // 清理表情包
            var stkClean = _loadStickerPacks();
            var stkChanged = false;
            ['user','char','common'].forEach(function(g){
              if (!Array.isArray(stkClean[g])) return;
              stkClean[g] = stkClean[g].filter(function(s){
                if (s && s.data && s.data.indexOf('idb:') === 0){ stkChanged = true; return false; }
                return true;
              });
            });
            if (stkChanged){ _saveStickerPacks(stkClean); details.push('清理 idb 残留引用'); }

            // 清理 settings 壁纸 idb 引用
            var settingsClean = phoneLoadSettings();
            var settingsChanged = false;
            if (settingsClean.wallpaperHome && settingsClean.wallpaperHome.indexOf('idb:') === 0){
              settingsClean.wallpaperHome = ''; settingsClean.wallpaperHomeName = ''; settingsChanged = true;
            }
            if (settingsClean.wallpaperApp && settingsClean.wallpaperApp.indexOf('idb:') === 0){
              settingsClean.wallpaperApp = ''; settingsClean.wallpaperAppName = ''; settingsChanged = true;
            }
            if (settingsChanged){ phoneSaveSettings(settingsClean); details.push('清理壁纸 idb 残留'); }
          }catch(e){}

          // 1) 压缩头像：将大尺寸 base64 头像缩小到 64x64
          try{
            var avatarRaw = W.localStorage.getItem(LS_PHONE_AVATARS);
            if (avatarRaw && avatarRaw.length > 10000){ // >10KB 才处理
              var avatars = JSON.parse(avatarRaw);
              var oldSize = avatarRaw.length * 2;
              var compressedCount = 0;
              // 统计头像数量和删除无效的
              var keys = Object.keys(avatars);
              for (var ai = 0; ai < keys.length; ai++){
                var av = avatars[keys[ai]];
                if (!av || typeof av !== 'string' || av.length < 10){
                  delete avatars[keys[ai]]; // 清理无效头像
                  compressedCount++;
                }
              }
              phoneSaveAvatars(avatars);
              var newRaw = W.localStorage.getItem(LS_PHONE_AVATARS) || '';
              var savedBytes = oldSize - newRaw.length * 2;
              if (savedBytes > 0){
                freed += savedBytes;
                details.push('头像清理(-' + (savedBytes/1024).toFixed(0) + 'KB)');
              }
              // 如果头像仍然很大（>500KB），提示用户
              if (newRaw.length * 2 > 500 * 1024){
                details.push('⚠️ 头像仍占 ' + (newRaw.length * 2 / 1024).toFixed(0) + 'KB，建议手动删除部分自定义头像');
              }
            }
          }catch(e){}

          // 2) 清理 settings 里的壁纸 base64（超大时提取出来或警告）
          try{
            var settingsRaw = W.localStorage.getItem('meow_phone_g_settings_data_v1');
            if (settingsRaw && settingsRaw.length * 2 > 200 * 1024){ // >200KB
              var settings = JSON.parse(settingsRaw);
              var oldSettingsSize = settingsRaw.length * 2;
              var wallpaperCleared = false;
              // 检查壁纸字段是否包含 base64
              ['wallpaperHome','wallpaperApp'].forEach(function(field){
                if (settings[field] && typeof settings[field] === 'string' && settings[field].length > 50000){
                  // base64 壁纸超过 50K 字符 → 清除
                  settings[field] = '';
                  settings[field + 'Name'] = '';
                  wallpaperCleared = true;
                }
              });
              if (wallpaperCleared){
                phoneSaveSettings(settings);
                var newSettingsRaw = W.localStorage.getItem('meow_phone_g_settings_data_v1') || '';
                freed += oldSettingsSize - newSettingsRaw.length * 2;
                details.push('壁纸图片(设置中)');
              }
            }
          }catch(e){}

          // 3) 清理 char_extra 中的大 base64 背景图
          try{
            var extraKeys = [];
            for (var ei = 0; ei < W.localStorage.length; ei++){
              var ek = W.localStorage.key(ei);
              if (ek && ek.indexOf('char_extra') !== -1){
                extraKeys.push(ek);
              }
            }
            for (var ej = 0; ej < extraKeys.length; ej++){
              var eRaw = W.localStorage.getItem(extraKeys[ej]) || '';
              if (eRaw.length * 2 > 50 * 1024){ // >50KB
                try{
                  var eObj = JSON.parse(eRaw);
                  var eChanged = false;
                  if (eObj.chatBg && typeof eObj.chatBg === 'string' && eObj.chatBg.length > 20000){
                    eObj.chatBg = '';
                    eChanged = true;
                  }
                  if (eChanged){
                    W.localStorage.setItem(extraKeys[ej], JSON.stringify(eObj));
                    freed += eRaw.length * 2 - (W.localStorage.getItem(extraKeys[ej]) || '').length * 2;
                    details.push('聊天背景图');
                  }
                }catch(e2){}
              }
            }
          }catch(e){}

          // 4) 清理论坛虚拟数据
          try{
            var forumKeys = [];
            for (var fi = 0; fi < W.localStorage.length; fi++){
              var fk = W.localStorage.key(fi);
              if (fk && fk.indexOf('forum_data_v1') !== -1){
                forumKeys.push(fk);
              }
            }
            for (var fj = 0; fj < forumKeys.length; fj++){
              var raw = W.localStorage.getItem(forumKeys[fj]) || '';
              freed += raw.length * 2;
              W.localStorage.removeItem(forumKeys[fj]);
            }
            if (forumKeys.length) details.push('论坛帖子 ×' + forumKeys.length);
          }catch(e){}

          // 5) 清理世界书快照（meow_wb_by_chat_v1）
          try{
            var wbSnap = W.localStorage.getItem('meow_wb_by_chat_v1');
            if (wbSnap && wbSnap.length > 100){
              freed += wbSnap.length * 2;
              W.localStorage.removeItem('meow_wb_by_chat_v1');
              details.push('世界书快照');
            }
          }catch(e){}

          // 6) 清理 AutoFeed / AI 资讯缓存
          try{ _afClearAllAIContent(); }catch(e){}
          try{
            var afKeys = [];
            for (var ai2 = 0; ai2 < W.localStorage.length; ai2++){
              var ak = W.localStorage.key(ai2);
              if (ak && (ak.indexOf('autofeed') !== -1 || ak.indexOf('_af_') !== -1 || ak.indexOf('feed_pack') !== -1)){
                afKeys.push(ak);
              }
            }
            for (var aj = 0; aj < afKeys.length; aj++){
              freed += (W.localStorage.getItem(afKeys[aj]) || '').length * 2;
              W.localStorage.removeItem(afKeys[aj]);
            }
            if (afKeys.length) details.push('AI 资讯缓存 ×' + afKeys.length);
          }catch(e){}
          try{ sessionStorage.removeItem(SS_AUTOFEED_PACK); }catch(e){}

          // 7) 清理 forum DM 数据
          try{
            var dmRaw = W.localStorage.getItem('meow_forum_dm_v1');
            if (dmRaw && dmRaw.length > 50){
              freed += dmRaw.length * 2;
              W.localStorage.removeItem('meow_forum_dm_v1');
              details.push('论坛私信');
            }
          }catch(e){}

          // 8) 清理同步暂存数据
          try{
            var syncStage = W.localStorage.getItem('meow_sync_stage_v1');
            if (syncStage && syncStage.length > 100){
              freed += syncStage.length * 2;
              W.localStorage.removeItem('meow_sync_stage_v1');
              details.push('同步暂存');
            }
          }catch(e){}

          // 9) 清理 MeowDB feedPacks
          try{
            if(typeof MeowDB !== 'undefined' && MeowDB.isReady()){
              MeowDB.clear('feedPacks').catch(function(){});
              MeowDB.clear('forumChats').catch(function(){});
            }
          }catch(e){}

          var freedKB = (freed / 1024).toFixed(1);
          var msg = details.length ? '已清理: ' + details.join('、') + '\n释放约 ' + freedKB + ' KB' : '没有可清理的数据';
          try{ toast(msg); }catch(e){ try{ W.alert(msg); }catch(e2){} }
          renderDataManagerPage(container);
        });

        // ===== 重试 IndexedDB =====
        container.querySelector('[data-act="dmRetryIDB"]')?.addEventListener('click', async ()=>{
          try{
            if (typeof MeowDB === 'undefined'){ toast('MeowDB 未定义'); return; }
            toast('正在重试 IndexedDB...');
            var ok = await MeowDB.retryInit(true); // deleteFirst=true
            if (ok){
              toast('✅ IndexedDB 恢复成功！');
            } else {
              toast('❌ IndexedDB 仍不可用，可能浏览器限制');
            }
            renderDataManagerPage(container);
          }catch(e){
            toast('重试失败: ' + e.message);
          }
        });

        // ===== 压缩图片数据 =====
        container.querySelector('[data-act="dmCompressImages"]')?.addEventListener('click', async ()=>{
          try{
            toast('正在压缩图片，请稍候...');
            var totalSaved = 0;
            var compressed = 0;

            // 1) 压缩头像到 64x64
            var avatars = phoneLoadAvatars();
            var avatarKeys = Object.keys(avatars);
            for (var ai = 0; ai < avatarKeys.length; ai++){
              var avk = avatarKeys[ai];
              var avVal = avatars[avk];
              if (!avVal || typeof avVal !== 'string' || avVal.length < 5000 || avVal === 'idb') continue;
              var oldLen = avVal.length;
              var newVal = await new Promise(function(res){ _compressBase64Image(avVal, 64, 0.6, res); });
              if (newVal.length < oldLen){
                avatars[avk] = newVal;
                totalSaved += (oldLen - newVal.length) * 2;
                compressed++;
              }
            }
            phoneSaveAvatars(avatars);

            // 2) 压缩表情到 128x128
            var packs = _loadStickerPacks();
            var groups = ['user','char','common'];
            for (var gi = 0; gi < groups.length; gi++){
              var arr = packs[groups[gi]];
              if (!Array.isArray(arr)) continue;
              for (var si = 0; si < arr.length; si++){
                if (!arr[si] || !arr[si].data || arr[si].data.length < 5000) continue;
                if (arr[si].data.indexOf('idb:') === 0) continue;
                var sOld = arr[si].data.length;
                var sNew = await new Promise(function(res){ _compressBase64Image(arr[si].data, 128, 0.65, res); });
                if (sNew.length < sOld){
                  arr[si].data = sNew;
                  totalSaved += (sOld - sNew.length) * 2;
                  compressed++;
                }
              }
            }
            _saveStickerPacks(packs);

            // 3) 压缩壁纸到 480px
            var settings = phoneLoadSettings();
            var wpFields = ['wallpaperHome','wallpaperApp'];
            for (var wi = 0; wi < wpFields.length; wi++){
              var wf = wpFields[wi];
              var wVal = settings[wf];
              if (!wVal || typeof wVal !== 'string' || wVal.length < 20000 || wVal.indexOf('idb:') === 0) continue;
              var wOld = wVal.length;
              var wNew = await new Promise(function(res){ _compressBase64Image(wVal, 480, 0.6, res); });
              if (wNew.length < wOld){
                settings[wf] = wNew;
                totalSaved += (wOld - wNew.length) * 2;
                compressed++;
              }
            }
            phoneSaveSettings(settings);

            // 4) 压缩 char_extra 里的聊天背景
            for (var ci = 0; ci < W.localStorage.length; ci++){
              var ck = W.localStorage.key(ci);
              if (!ck || ck.indexOf('char_extra') === -1) continue;
              try{
                var cRaw = W.localStorage.getItem(ck);
                if (!cRaw || cRaw.length < 20000) continue;
                var cObj = JSON.parse(cRaw);
                if (cObj.chatBg && typeof cObj.chatBg === 'string' && cObj.chatBg.length > 20000 && cObj.chatBg.indexOf('idb:') !== 0){
                  var bgOld = cObj.chatBg.length;
                  var bgNew = await new Promise(function(res){ _compressBase64Image(cObj.chatBg, 480, 0.6, res); });
                  if (bgNew.length < bgOld){
                    cObj.chatBg = bgNew;
                    W.localStorage.setItem(ck, JSON.stringify(cObj));
                    totalSaved += (bgOld - bgNew.length) * 2;
                    compressed++;
                  }
                }
              }catch(e2){}
            }

            var savedKB = (totalSaved / 1024).toFixed(0);
            toast(compressed > 0 ? '✅ 压缩了 ' + compressed + ' 张图片，释放约 ' + savedKB + ' KB' : '所有图片已经是最优大小');
            renderDataManagerPage(container);
          }catch(e){
            toast('压缩失败: ' + e.message);
          }
        });

        container.querySelector('[data-act="dmBackupAll"]')?.addEventListener('click',()=>{
          try{
            const pack = _dmBuildFullPack();
            _downloadOrCopyJSON(pack, 'meow_phone_backup.json');
            try{toast('备份完成');}catch(e){}
          }catch(e){ try{toast('备份失败: '+e.message);}catch(_){} }
        });
        container.querySelector('[data-act="dmExportSelected"]')?.addEventListener('click',()=> _dmOpenExportSelector());
        container.querySelector('[data-act="dmImport"]')?.addEventListener('click',()=> _dmOpenImportDialog(container));
        container.querySelector('[data-act="dmClearAICache"]')?.addEventListener('click',()=>{
          try{ _afClearAllAIContent(); }catch(e){}
          try{ sessionStorage.removeItem(SS_AUTOFEED_PACK); }catch(e){}
          // 如果 MeowDB 可用，也清理 feedPacks store
          if(typeof MeowDB !== 'undefined' && MeowDB.isReady()){
            MeowDB.clear('feedPacks').catch(function(){});
          }
          try{toast('已清空 AI 资讯缓存');}catch(e){}
          renderDataManagerPage(container);
        });
        container.querySelector('[data-act="dmClearAll"]')?.addEventListener('click',()=>{
          if (!W.confirm?.('⚠️ 确定清空所有小手机数据？此操作不可恢复！')) return;
          if (!W.confirm?.('再次确认：真的要清空吗？（仅清空小手机数据，不影响酒馆主功能）')) return;
          const keys = _getAllPhoneKeys();
          let count = 0;
          for (const k of keys){
            try{ W.localStorage.removeItem(k); count++; }catch(e){}
          }
          // 也清理 IndexedDB
          if(typeof MeowDB !== 'undefined' && MeowDB.isReady()){
            MeowDB._stores.forEach(function(s){ try{ MeowDB.clear(s); }catch(e){} });
          }
          try{toast(`已清空 ${count} 条数据`);}catch(e){}
          renderDataManagerPage(container);
        });
      }

      // ===== 数据管理：构建完整导出包 =====
      function _dmBuildFullPack(filterKeys){
        const keys = filterKeys || _getAllPhoneKeys();
        const data = {};
        for (const k of keys){
          try{
            const raw = W.localStorage.getItem(k);
            if (raw != null) data[k] = raw;
          }catch(e){}
        }
        return { _meowPhoneBackup:1, v:2, ts:Date.now(), version: window.MEOW_PENCIL_SUITE_VER||'unknown', data };
      }

      // ===== 数据管理：选择导出弹层 =====
      function _dmOpenExportSelector(){
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        let checkHtml = '';
        _DM_MODULES.forEach((mod,i)=>{
          const count = _getKeysForModule(mod).length;
          if (count === 0 && mod.isCatchAll) return;
          checkHtml += `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">
            <input type="checkbox" value="${mod.key}" checked style="width:16px;height:16px;accent-color:#07c160;" />
            <span style="flex:1;font-size:13px;color:var(--ph-text);">${esc(mod.label)}</span>
            <span style="font-size:10px;color:var(--ph-text-dim);">${count} keys</span>
          </label>`;
        });
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:280px;text-align:left;max-height:80vh;overflow-y:auto;">
          <div style="font-weight:700;font-size:15px;color:var(--ph-text);margin-bottom:10px;">选择导出模块</div>
          <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;border-bottom:1px solid rgba(0,0,0,.06);margin-bottom:8px;">
            <input type="checkbox" data-el="selAll" checked style="width:16px;height:16px;accent-color:#07c160;"/>
            <span style="font-size:13px;font-weight:600;">全选</span>
          </label>
          <div style="max-height:260px;overflow-y:auto;">${checkHtml}</div>
          <div style="display:flex;gap:8px;margin-top:14px;">
            <button data-act="exCancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:var(--ph-text-sub);font-size:13px;cursor:pointer;">取消</button>
            <button data-act="exConfirm" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">导出</button>
          </div>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{ if(e.target===overlay) overlay.remove(); });
        overlay.querySelector('[data-act="exCancel"]')?.addEventListener('click',()=> overlay.remove());
        const selAllCb = overlay.querySelector('[data-el="selAll"]');
        if (selAllCb){
          selAllCb.addEventListener('change',()=>{
            overlay.querySelectorAll('input[type="checkbox"][value]').forEach(cb=>{ cb.checked = selAllCb.checked; });
          });
        }
        overlay.querySelector('[data-act="exConfirm"]')?.addEventListener('click',()=>{
          try{
            const selected = Array.from(overlay.querySelectorAll('input[type="checkbox"][value]:checked')).map(cb=>cb.value);
            if (!selected.length){ try{toast('请至少选择一个模块');}catch(e){} return; }
            const selectedMods = _DM_MODULES.filter(m=> selected.includes(m.key));
            const keys = [];
            const seen = new Set();
            selectedMods.forEach(mod=>{
              _getKeysForModule(mod).forEach(k=>{ if(!seen.has(k)){ seen.add(k); keys.push(k); }});
            });
            const pack = _dmBuildFullPack(keys);
            _downloadOrCopyJSON(pack, 'meow_phone_selected.json');
            overlay.remove();
            try{toast('导出完成');}catch(e){}
          }catch(e){ try{toast('导出失败: '+e.message);}catch(_){} }
        });
      }

      // ===== 数据管理：导入弹层（覆盖/合并策略） =====
      function _dmOpenImportDialog(parentContainer){
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:280px;text-align:left;max-height:80vh;">
          <div style="font-weight:700;font-size:15px;color:var(--ph-text);margin-bottom:10px;">导入数据</div>
          <div style="margin-bottom:10px;">
            <button data-act="imFile" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:var(--ph-text);font-size:13px;cursor:pointer;">📂 选择 JSON 文件</button>
          </div>
          <div style="font-size:12px;color:var(--ph-text-dim);margin-bottom:6px;">或粘贴 JSON：</div>
          <textarea data-el="imText" rows="6" placeholder="粘贴导出的 JSON 内容…" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:11px;font-family:monospace;resize:vertical;color:var(--ph-text);background:#fff;"></textarea>
          <div style="margin-top:10px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="radio" name="imMode" value="overwrite" checked style="accent-color:#07c160;"/>
              <span style="font-size:12px;color:var(--ph-text);">覆盖同 key（默认）</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:4px;">
              <input type="radio" name="imMode" value="merge" style="accent-color:#07c160;"/>
              <span style="font-size:12px;color:var(--ph-text);">合并列表类数据（通讯录/表情/收藏）</span>
            </label>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button data-act="imCancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:var(--ph-text-sub);font-size:13px;cursor:pointer;">取消</button>
            <button data-act="imConfirm" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">导入</button>
          </div>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{ if(e.target===overlay) overlay.remove(); });
        overlay.querySelector('[data-act="imCancel"]')?.addEventListener('click',()=> overlay.remove());
        overlay.querySelector('[data-act="imFile"]')?.addEventListener('click',()=>{
          const inp = doc.createElement('input');
          inp.type = 'file'; inp.accept = '.json,application/json';
          inp.onchange = ()=>{
            const file = inp.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ()=>{
              const ta = overlay.querySelector('[data-el="imText"]');
              if (ta) ta.value = reader.result || '';
            };
            reader.readAsText(file);
          };
          inp.click();
        });
        overlay.querySelector('[data-act="imConfirm"]')?.addEventListener('click',()=>{
          const text = (overlay.querySelector('[data-el="imText"]')?.value||'').trim();
          if (!text){ try{toast('请先粘贴或选择文件');}catch(e){} return; }
          const modeEl = overlay.querySelector('input[name="imMode"]:checked');
          const mode = modeEl?.value || 'overwrite';
          try{
            const pack = JSON.parse(text);
            // 兼容 v1（items）和 v2（data）格式
            const items = pack.data || pack.items || null;
            if (!pack || (pack._meowPhoneBackup !== 1 && !pack._meowApiPresets) || !items){
              // 也尝试兼容 API 预设导入
              if (pack._meowApiPresets === 1 && Array.isArray(pack.presets)){
                _dmImportApiPresets(pack.presets, mode);
                overlay.remove();
                return;
              }
              try{toast('格式错误：非有效小手机备份');}catch(e){} return;
            }
            // 合并策略 keys
            const MERGE_LIST_KEYS = ['meow_phone_g_contacts_v1','meow_phone_g_favorites_v1','meow_phone_g_sticker_packs_v1'];
            let count = 0;
            for (const [k, v] of Object.entries(items)){
              if (!String(k).startsWith(PHONE_DATA_PREFIX)) continue;
              try{
                if (mode === 'merge' && MERGE_LIST_KEYS.some(mk=> k.startsWith(mk))){
                  _dmMergeListKey(k, v);
                } else {
                  W.localStorage.setItem(k, v);
                }
                count++;
              }catch(e){}
            }
            overlay.remove();
            try{toast(`导入成功：${count} 条数据`);}catch(e){}
            if (parentContainer) renderDataManagerPage(parentContainer);
          }catch(e){
            try{toast('JSON 解析失败，请检查格式');}catch(_){}
          }
        });
      }

      function _dmImportApiPresets(importedPresets, mode){
        const data = _loadApiPresets();
        if (mode === 'merge'){
          importedPresets.forEach(ip=>{
            const exist = data.presets.find(p=>p.id===ip.id);
            if (!exist) data.presets.push(ip);
          });
        } else {
          data.presets = importedPresets;
          if (!data.presets.find(p=>p.id===data.activeId)) data.activeId = data.presets[0]?.id||'';
        }
        _saveApiPresets(data);
        try{toast(`已导入 ${importedPresets.length} 个 API 预设`);}catch(e){}
      }

      function _dmMergeListKey(key, rawValue){
        try{
          const incoming = JSON.parse(rawValue);
          const existing = JSON.parse(W.localStorage.getItem(key)||'null');
          if (!existing){ W.localStorage.setItem(key, rawValue); return; }
          // 合并 list 字段（通讯录、收藏、表情等通用结构 {v, list:[]}）
          if (Array.isArray(incoming?.list) && Array.isArray(existing?.list)){
            const existIds = new Set(existing.list.map(x=>(x.id||JSON.stringify(x))));
            incoming.list.forEach(item=>{
              const itemId = item.id || JSON.stringify(item);
              if (!existIds.has(itemId)){
                existing.list.push(item);
                existIds.add(itemId);
              }
            });
            W.localStorage.setItem(key, JSON.stringify(existing));
          } else {
            W.localStorage.setItem(key, rawValue);
          }
        }catch(e){ W.localStorage.setItem(key, rawValue); }
      }

      // ===================== 4.4 设置页（我→设置 入口：委托给 renderDataManagerPage） =====================
      // 所有小手机数据的 key 前缀
      const PHONE_DATA_PREFIX = 'meow_phone_';

      function _getAllPhoneKeys(){
        const keys = [];
        try{
          for (let i = 0; i < W.localStorage.length; i++){
            const k = W.localStorage.key(i);
            if (k && String(k).startsWith(PHONE_DATA_PREFIX)) keys.push(k);
          }
        }catch(e){}
        return keys;
      }

      // ✅ 兼容旧引用（_openExportSelector 内部仍调用此名）
      function _buildPhoneExportPack(filterKeys){ return _dmBuildFullPack(filterKeys); }

      function _renderMeSettingsPage(container){
        // 计算存储使用量
        var lsUsageBytes = 0;
        try{ lsUsageBytes = estimateLSUsage(); }catch(e){}
        var lsUsageKB = (lsUsageBytes / 1024).toFixed(1);
        var lsMaxKB = 5120;
        var lsPct = Math.min(100, (lsUsageBytes / (lsMaxKB * 1024) * 100)).toFixed(0);
        var lsBarWidth = Math.min(100, Math.max(2, parseFloat(lsPct)));

        let html = `<div style="padding:14px;">
          <div style="font-size:15px;font-weight:700;color:var(--ph-text);margin-bottom:14px;">数据管理</div>

          <!-- 存储使用情况（简版） -->
          <div style="background:var(--ph-glass);border:1px solid var(--ph-glass-border);border-radius:14px;padding:12px 14px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:12px;color:var(--ph-text-sub);">localStorage</span>
              <span style="font-size:11px;color:var(--ph-text-dim);">${lsUsageKB} KB / ${lsMaxKB} KB (${lsPct}%)</span>
            </div>
            <div style="width:100%;height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;">
              <div style="width:${lsBarWidth}%;height:100%;background:${parseFloat(lsPct)>80?'linear-gradient(90deg,#ef4444,#f97316)':'var(--ph-accent-grad)'};border-radius:3px;"></div>
            </div>
            <div data-ph="idbStatus2" style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
              <span style="font-size:12px;color:var(--ph-text-sub);">IndexedDB</span>
              <span style="font-size:11px;color:var(--ph-text-dim);">${(typeof MeowDB!=='undefined'&&MeowDB.isReady())?'✅ 就绪':(typeof MeowDB!=='undefined'&&MeowDB.isFallback()?'⚠️ 不可用':'—')}</span>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <button data-act="dmBackupAll2" style="padding:14px;border-radius:14px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>💾 备份全部</b><br><span style="font-size:11px;color:var(--ph-text-dim);">一键导出所有小手机数据</span>
            </button>
            <button data-act="dmExportSelected2" style="padding:14px;border-radius:14px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>📤 选择导出</b><br><span style="font-size:11px;color:var(--ph-text-dim);">勾选模块分别导出</span>
            </button>
            <button data-act="dmImport2" style="padding:14px;border-radius:14px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:13px;cursor:pointer;text-align:left;">
              <b>📥 导入数据</b><br><span style="font-size:11px;color:var(--ph-text-dim);">粘贴 JSON 或选择文件导入</span>
            </button>
            <button data-act="dmClearAll2" style="padding:14px;border-radius:14px;border:1px solid rgba(239,68,68,.15);background:var(--ph-glass);color:#ef4444;font-size:13px;cursor:pointer;text-align:left;">
              <b>🗑️ 清空所有数据</b><br><span style="font-size:11px;color:rgba(239,68,68,.4);">二次确认后清空（仅小手机）</span>
            </button>
          </div>
        </div>`;
        container.innerHTML = html;
        container.querySelector('[data-act="dmBackupAll2"]')?.addEventListener('click',()=>{
          try{ _downloadOrCopyJSON(_dmBuildFullPack(), 'meow_phone_backup.json'); try{toast('备份完成');}catch(e){} }catch(e){ try{toast('备份失败');}catch(_){} }
        });
        container.querySelector('[data-act="dmExportSelected2"]')?.addEventListener('click',()=> _dmOpenExportSelector());
        container.querySelector('[data-act="dmImport2"]')?.addEventListener('click',()=> _dmOpenImportDialog(container));
        container.querySelector('[data-act="dmClearAll2"]')?.addEventListener('click',()=>{
          if (!W.confirm?.('⚠️ 确定清空所有小手机数据？此操作不可恢复！')) return;
          if (!W.confirm?.('再次确认：真的要清空吗？')) return;
          const keys = _getAllPhoneKeys();
          let count = 0;
          for (const k of keys){ try{ W.localStorage.removeItem(k); count++; }catch(e){} }
          if(typeof MeowDB !== 'undefined' && MeowDB.isReady()){
            MeowDB._stores.forEach(function(s){ try{ MeowDB.clear(s); }catch(e){} });
          }
          try{toast(`已清空 ${count} 条数据`);}catch(e){}
          _renderMeSettingsPage(container);
        });
      }

      function _downloadOrCopyJSON(obj, filename){
        try{
          const text = JSON.stringify(obj, null, 2);
          // 尝试 Blob 下载
          try{
            const blob = new Blob([text], { type:'application/json' });
            const url = URL.createObjectURL(blob);
            const a = doc.createElement('a');
            a.href = url; a.download = filename;
            doc.body.appendChild(a); a.click();
            setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 1000);
            return;
          }catch(e){}
          // iOS 备用：文本框复制
          _showCopyBox(text);
        }catch(e){ try{toast('导出失败');}catch(_){} }
      }

      function _showCopyBox(text){
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:280px;text-align:left;max-height:80vh;">
          <div style="font-weight:700;font-size:14px;color:rgba(20,24,28,.88);margin-bottom:10px;">导出数据（复制）</div>
          <textarea data-el="copyBox" rows="10" readonly style="width:100%;box-sizing:border-box;padding:8px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:11px;font-family:monospace;resize:vertical;">${esc(text)}</textarea>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button data-act="cbClose" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.6);font-size:13px;cursor:pointer;">关闭</button>
            <button data-act="cbCopy" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">全选复制</button>
          </div>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{ if(e.target===overlay) overlay.remove(); });
        overlay.querySelector('[data-act="cbClose"]')?.addEventListener('click',()=> overlay.remove());
        overlay.querySelector('[data-act="cbCopy"]')?.addEventListener('click',()=>{
          try{
            const ta = overlay.querySelector('[data-el="copyBox"]');
            if (ta){ ta.select(); doc.execCommand('copy'); try{toast('已复制到剪贴板');}catch(e){} }
          }catch(e){ try{toast('复制失败，请手动选择');}catch(_){} }
        });
      }

      function _openExportSelector(container){
        // 列出所有好友/群聊，让用户选择
        const db = loadContactsDB();
        const contacts = _safeArr(db.list);
        const groups = _phLoad('groups_v1', {});
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        let checkHtml = '';
        contacts.forEach(c=>{
          checkHtml += `<label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;">
            <input type="checkbox" value="${esc(c.id)}" data-type="contact" checked style="width:16px;height:16px;accent-color:#07c160;"/>
            <span style="font-size:13px;color:rgba(20,24,28,.8);">👤 ${esc(c.name)}</span>
          </label>`;
        });
        Object.keys(groups||{}).forEach(gid=>{
          const g = groups[gid];
          checkHtml += `<label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;">
            <input type="checkbox" value="${esc(gid)}" data-type="group" checked style="width:16px;height:16px;accent-color:#07c160;"/>
            <span style="font-size:13px;color:rgba(20,24,28,.8);">👥 ${esc(g.name||gid)}</span>
          </label>`;
        });
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:280px;text-align:left;max-height:80vh;overflow-y:auto;">
          <div style="font-weight:700;font-size:15px;color:rgba(20,24,28,.88);margin-bottom:10px;">选择导出</div>
          <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;border-bottom:1px solid rgba(0,0,0,.06);margin-bottom:8px;">
            <input type="checkbox" data-el="selAll" checked style="width:16px;height:16px;accent-color:#07c160;"/>
            <span style="font-size:13px;font-weight:600;">全选</span>
          </label>
          <div style="max-height:200px;overflow-y:auto;">${checkHtml || '<div style="padding:10px;color:rgba(20,24,28,.3);">暂无数据</div>'}</div>
          <div style="display:flex;gap:8px;margin-top:14px;">
            <button data-act="exCancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.6);font-size:13px;cursor:pointer;">取消</button>
            <button data-act="exConfirm" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">导出</button>
          </div>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{ if(e.target===overlay) overlay.remove(); });
        // 全选联动
        overlay.querySelector('[data-el="selAll"]')?.addEventListener('change',(e)=>{
          overlay.querySelectorAll('input[type="checkbox"]:not([data-el="selAll"])').forEach(cb=>{ cb.checked = e.target.checked; });
        });
        overlay.querySelector('[data-act="exCancel"]')?.addEventListener('click',()=> overlay.remove());
        overlay.querySelector('[data-act="exConfirm"]')?.addEventListener('click',()=>{
          try{
            const checked = Array.from(overlay.querySelectorAll('input[type="checkbox"]:checked:not([data-el="selAll"])')).map(cb=>cb.value);
            if (!checked.length){ try{toast('请至少选择一项');}catch(e){} return; }
            // 收集相关 localStorage key
            const relKeys = new Set();
            const allKeys = _getAllPhoneKeys();
            for (const k of allKeys){
              // 全局数据总是带上
              if (String(k).includes('_g_')){ relKeys.add(k); continue; }
              // 聊天隔离数据：检查是否包含选中 id
              for (const cid of checked){
                if (String(k).includes(cid)) relKeys.add(k);
              }
            }
            const pack = _buildPhoneExportPack(Array.from(relKeys));
            pack._selectedIds = checked;
            _downloadOrCopyJSON(pack, 'meow_phone_selected.json');
            overlay.remove();
            try{toast('导出完成');}catch(e){}
          }catch(e){ try{toast('导出失败: '+e.message);}catch(_){} }
        });
      }

      function _openImportDialog(container){
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:280px;text-align:left;max-height:80vh;">
          <div style="font-weight:700;font-size:15px;color:rgba(20,24,28,.88);margin-bottom:10px;">导入数据</div>
          <div style="margin-bottom:10px;">
            <button data-act="imFile" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.7);font-size:13px;cursor:pointer;">📂 选择 JSON 文件</button>
          </div>
          <div style="font-size:12px;color:rgba(20,24,28,.4);margin-bottom:6px;">或粘贴 JSON：</div>
          <textarea data-el="imText" rows="6" placeholder="粘贴导出的 JSON 内容…" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:11px;font-family:monospace;resize:vertical;"></textarea>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button data-act="imCancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.6);font-size:13px;cursor:pointer;">取消</button>
            <button data-act="imConfirm" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">导入</button>
          </div>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{ if(e.target===overlay) overlay.remove(); });
        overlay.querySelector('[data-act="imCancel"]')?.addEventListener('click',()=> overlay.remove());
        overlay.querySelector('[data-act="imFile"]')?.addEventListener('click',()=>{
          const inp = doc.createElement('input');
          inp.type = 'file'; inp.accept = '.json,application/json';
          inp.onchange = ()=>{
            const file = inp.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ()=>{
              const ta = overlay.querySelector('[data-el="imText"]');
              if (ta) ta.value = reader.result || '';
            };
            reader.readAsText(file);
          };
          inp.click();
        });
        overlay.querySelector('[data-act="imConfirm"]')?.addEventListener('click',()=>{
          const text = (overlay.querySelector('[data-el="imText"]')?.value||'').trim();
          if (!text){ try{toast('请先粘贴或选择文件');}catch(e){} return; }
          try{
            const pack = JSON.parse(text);
            if (!pack || pack._meowPhoneBackup !== 1 || !pack.items){
              try{toast('格式错误：非有效小手机备份');}catch(e){} return;
            }
            // ✅ 校验通过，写入
            let count = 0;
            for (const [k, v] of Object.entries(pack.items)){
              if (!String(k).startsWith(PHONE_DATA_PREFIX)) continue; // 安全：只写小手机数据
              try{ W.localStorage.setItem(k, v); count++; }catch(e){}
            }
            overlay.remove();
            try{toast(`导入成功：${count} 条数据`);}catch(e){}
            _renderMeSettingsPage(container);
          }catch(e){
            try{toast('JSON 解析失败，请检查格式');}catch(_){}
          }
        });
      }

      // ====== 钱包渲染 ======
      function _renderWalletPage(body){
        const w = loadWallet();
        // ✅ 标题已由 _renderMeSubPage 的 setAppBarTitle 设置
        let html = '';
        // 余额卡片
        html += `<div style="margin:16px 14px;padding:20px;border-radius:16px;background:linear-gradient(135deg,#f39c12,#e67e22);color:#fff;box-shadow:0 4px 16px rgba(243,156,18,.3);">
          <div style="font-size:12px;opacity:.8;">账户余额</div>
          <div style="font-size:32px;font-weight:700;margin-top:6px;">${w.balance}<span style="font-size:14px;font-weight:400;margin-left:4px;">金币</span></div>
          <div style="display:flex;gap:8px;margin-top:14px;">
            <button data-act="walletRecharge" style="flex:1;padding:8px;border-radius:10px;background:rgba(255,255,255,.25);color:#fff;border:none;font-size:12px;font-weight:600;cursor:pointer;">充值</button>
            <button data-act="walletGiftSelf" style="flex:1;padding:8px;border-radius:10px;background:rgba(255,255,255,.25);color:#fff;border:none;font-size:12px;font-weight:600;cursor:pointer;">签到领币</button>
          </div>
        </div>`;
        // 快捷功能
        html += `<div style="margin:0 14px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          <div style="text-align:center;padding:10px 0;"><div style="font-size:22px;">🧧</div><div style="font-size:11px;color:rgba(20,24,28,.5);margin-top:4px;">红包</div></div>
          <div style="text-align:center;padding:10px 0;"><div style="font-size:22px;">💰</div><div style="font-size:11px;color:rgba(20,24,28,.5);margin-top:4px;">转账</div></div>
          <div style="text-align:center;padding:10px 0;"><div style="font-size:22px;">🎁</div><div style="font-size:11px;color:rgba(20,24,28,.5);margin-top:4px;">礼物</div></div>
          <div style="text-align:center;padding:10px 0;"><div style="font-size:22px;">📊</div><div style="font-size:11px;color:rgba(20,24,28,.5);margin-top:4px;">账单</div></div>
        </div>`;
        // 交易记录
        html += `<div style="margin:14px;font-size:13px;font-weight:600;color:rgba(20,24,28,.7);">最近交易</div>`;
        const txns = _safeArr(w.transactions).slice(0, 20);
        if (txns.length){
          for (const tx of txns){
            const isSpend = tx.type === 'spend';
            const d = new Date(tx.t||0);
            const ts = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            html += `<div style="padding:8px 14px;display:flex;align-items:center;border-bottom:1px solid rgba(0,0,0,.04);">
              <div style="flex:1;">
                <div style="font-size:12px;color:rgba(20,24,28,.7);">${esc(tx.desc||'交易')}</div>
                <div style="font-size:10px;color:rgba(20,24,28,.3);margin-top:2px;">${ts}</div>
              </div>
              <div style="font-size:13px;font-weight:600;color:${isSpend?'#e74c3c':'#07c160'};">${isSpend?'-':'+'}${tx.amount}</div>
            </div>`;
          }
        } else {
          html += `<div style="padding:20px 14px;text-align:center;font-size:12px;color:rgba(20,24,28,.3);">暂无交易记录</div>`;
        }
        body.innerHTML = html;

        // 绑定事件
        body.querySelectorAll('[data-act="walletRecharge"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            walletReceive(500, '充值 500 金币');
            try{toast('充值成功！+500 金币');}catch(e){}
            _renderWalletPage(body);
          });
        });
        body.querySelectorAll('[data-act="walletGiftSelf"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const today = new Date().toDateString();
            const lastSign = _phLoad('wallet_last_sign', '');
            if (lastSign === today){
              try{toast('今日已签到');}catch(e){} return;
            }
            _phSave('wallet_last_sign', today);
            const bonus = 50 + Math.floor(Math.random()*50);
            walletReceive(bonus, `每日签到 +${bonus}`);
            try{toast(`签到成功！+${bonus} 金币`);}catch(e){}
            _renderWalletPage(body);
          });
        });
      }

      // ====== AutoFeed 设置页 + App 资讯设置弹窗 ======
      function renderAutoFeedSettingsPage(container){
        var cfg=getAutofeedCfg();
        var ssUsage=0; try{var raw=sessionStorage.getItem(SS_AUTOFEED_PACK);ssUsage=raw?(raw.length*2):0;}catch(e){}
        var lsUsage=estimateLSUsage(); var lsP=Math.min(100,Math.round(lsUsage/(5*1024*1024)*100));
        var lastRunText='从未运行';
        if(cfg.lastRunAt>0){ var dt=new Date(cfg.lastRunAt); lastRunText=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')+' '+String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0'); lastRunText+=cfg.lastError?'  ❌'+cfg.lastError:'  ✅成功'; }
        else if(cfg.lastError) lastRunText='❌ '+cfg.lastError;
        var cdText=''; if(cfg.cooldownUntil>Date.now()) cdText='<div style="color:#ef4444;font-size:11px;margin-top:4px;">冷却中，'+Math.ceil((cfg.cooldownUntil-Date.now())/60000)+'分钟后可重试</div>';

        var h='<div class="settingSubPage">';
        h+='<button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;margin-bottom:12px;">‹ 返回设置</button>';

        h+='<div class="phCard" style="margin-bottom:12px;"><div style="font-weight:700;color:var(--ph-text);margin-bottom:10px;">总控制</div>';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:13px;color:var(--ph-text);">自动运行总开关</span><button class="sToggle'+(cfg.enabled?' on':'')+'" data-afcfg="enabled" style="flex-shrink:0;"></button></div></div>';

        if(cfg.enabled){
          h+='<div class="phCard" style="margin-bottom:12px;"><div style="font-weight:700;color:var(--ph-text);margin-bottom:10px;">触发策略</div>';
          h+='<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:13px;color:var(--ph-text);">触发模式</span><select data-afcfg="mode" style="padding:4px 8px;border-radius:8px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;"><option value="daily_once"'+(cfg.mode==='daily_once'?' selected':'')+'>每天一次</option><option value="interval"'+(cfg.mode==='interval'?' selected':'')+'>间隔更新</option></select></div>';
          if(cfg.mode==='daily_once'){
            h+='<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:13px;color:var(--ph-text);">触发时间</span><select data-afcfg="dailyHour" style="padding:4px 8px;border-radius:8px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;">';
            for(var hh=0;hh<24;hh++) h+='<option value="'+hh+'"'+(cfg.dailyHour===hh?' selected':'')+'>'+String(hh).padStart(2,'0')+':00</option>';
            h+='</select></div>';
          }else{
            h+='<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:13px;color:var(--ph-text);">间隔分钟</span><input data-afcfg="intervalMin" type="number" min="30" max="1440" value="'+(cfg.intervalMin||180)+'" style="width:80px;padding:4px 8px;border-radius:8px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;text-align:center;"/></div>';
          }
          h+='<div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:13px;color:var(--ph-text);">时间基准</span><select data-afcfg="tzMode" style="padding:4px 8px;border-radius:8px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;"><option value="real"'+(cfg.tzMode==='real'?' selected':'')+'>现实时间</option><option value="story"'+(cfg.tzMode==='story'?' selected':'')+'>故事时间</option></select></div></div>';
        }

        h+='<div class="phCard" style="margin-bottom:12px;"><div style="font-weight:700;color:var(--ph-text);margin-bottom:10px;">参考数据来源</div>';
        [{k:'worldbook',l:'酒馆世界书'},{k:'summary',l:'聊天总结数据'},{k:'phoneGlobalWB',l:'小手机世界书'},{k:'recentChat',l:'最近聊天片段'}].forEach(function(s){
          h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="font-size:13px;color:var(--ph-text);">'+s.l+'</span><button class="sToggle'+(cfg.sources[s.k]?' on':'')+'" data-afsrc="'+s.k+'" style="flex-shrink:0;"></button></div>';
        });
        h+='</div>';

        h+='<div class="phCard" style="margin-bottom:12px;"><div style="font-weight:700;color:var(--ph-text);margin-bottom:10px;">自动更新目标</div>';
        [{k:'forum',l:'论坛',a:true},{k:'browser',l:'浏览器',a:true},{k:'moments',l:'朋友圈',a:true},{k:'shop',l:'购物（开发中）',a:false},{k:'weather',l:'天气（开发中）',a:false}].forEach(function(tg){
          h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;opacity:'+(tg.a?'1':'0.4')+';"><span style="font-size:13px;color:var(--ph-text);">'+tg.l+'</span>';
          h+=tg.a?'<button class="sToggle'+((cfg.autoTargets||{})[tg.k]?' on':'')+'" data-aftgt="'+tg.k+'" style="flex-shrink:0;"></button>':'<span style="font-size:11px;color:var(--ph-text-dim);">开发中</span>';
          h+='</div>';
        });
        h+='</div>';

        h+='<div class="phCard" style="margin-bottom:12px;"><div style="font-weight:700;color:var(--ph-text);margin-bottom:10px;">手动操作</div><button data-act="afRunAll" style="width:100%;padding:12px;border:0;border-radius:12px;background:var(--ph-accent-grad);color:#fff;font-size:14px;font-weight:600;cursor:pointer;">🔄 立即全部更新</button></div>';
        h+='<div class="phCard" style="margin-bottom:12px;"><div style="font-weight:700;color:var(--ph-text);margin-bottom:10px;">运行状态</div><div style="font-size:12px;color:var(--ph-text-sub);">上次运行：'+lastRunText+'</div>'+cdText+'</div>';
        h+='<div class="phCard" style="margin-bottom:12px;"><div style="font-weight:700;color:var(--ph-text);margin-bottom:10px;">存储管理</div>';
        // 存储信息：IDB + sessionStorage + localStorage
        var idbReady = (typeof MeowDB !== 'undefined' && MeowDB.isReady());
        h+='<div style="font-size:12px;color:var(--ph-text-sub);margin-bottom:4px;">IndexedDB 资讯: <span data-ph="afIdbSize">'+(idbReady?'检测中…':'不可用')+'</span></div>';
        if(ssUsage>0) h+='<div style="font-size:12px;color:var(--ph-text-sub);margin-bottom:4px;">sessionStorage 缓存 (旧): '+(ssUsage>1024?Math.round(ssUsage/1024)+'KB':ssUsage+'B')+'</div>';
        h+='<div style="font-size:12px;color:var(--ph-text-sub);margin-bottom:6px;">localStorage: ~'+Math.round(lsUsage/1024)+'KB ('+lsP+'%)</div>';
        if(lsP>60) h+='<div style="font-size:11px;color:#ef4444;margin-bottom:6px;">⚠️ 存储空间较满</div>';
        h+='<button data-act="afClearCache" style="width:100%;padding:10px;border:0;border-radius:10px;background:var(--ph-glass);color:#ef4444;font-size:12px;cursor:pointer;border:1px solid rgba(239,68,68,.3);">清空所有 AI 资讯缓存</button></div></div>';
        container.innerHTML=h;

        // 异步加载 IDB feedPacks 大小
        if(idbReady){
          MeowDB.getStoreSize('feedPacks').then(function(info){
            var el = container.querySelector('[data-ph="afIdbSize"]');
            if(el){
              var kb = (info.bytes/1024).toFixed(1);
              el.textContent = info.count+'条, ~'+kb+'KB';
              el.style.color = 'var(--ph-text-sub)';
            }
          }).catch(function(){
            var el = container.querySelector('[data-ph="afIdbSize"]');
            if(el) el.textContent = '读取失败';
          });
        }

        container.querySelectorAll('.sToggle[data-afcfg]').forEach(function(btn){ btn.addEventListener('click',function(){ btn.classList.toggle('on'); var c=getAutofeedCfg(); c[btn.getAttribute('data-afcfg')]=btn.classList.contains('on'); saveAutofeedCfg(c); renderAutoFeedSettingsPage(container); }); });
        container.querySelectorAll('.sToggle[data-afsrc]').forEach(function(btn){ btn.addEventListener('click',function(){ btn.classList.toggle('on'); var c=getAutofeedCfg(); if(!c.sources)c.sources={}; c.sources[btn.getAttribute('data-afsrc')]=btn.classList.contains('on'); saveAutofeedCfg(c); }); });
        container.querySelectorAll('.sToggle[data-aftgt]').forEach(function(btn){ btn.addEventListener('click',function(){ btn.classList.toggle('on'); var c=getAutofeedCfg(); if(!c.autoTargets)c.autoTargets={}; c.autoTargets[btn.getAttribute('data-aftgt')]=btn.classList.contains('on'); saveAutofeedCfg(c); }); });
        container.querySelectorAll('select[data-afcfg],input[data-afcfg]').forEach(function(el){ el.addEventListener('change',function(){ var k=el.getAttribute('data-afcfg'); var c=getAutofeedCfg(); var v=el.value; if(k==='dailyHour'||k==='intervalMin')v=parseInt(v)||0; c[k]=v; saveAutofeedCfg(c); if(k==='mode')renderAutoFeedSettingsPage(container); }); });
      }

      function _afClearAllAIContent(){
        try{
          var uid=(typeof phoneGetChatUID==='function')?phoneGetChatUID():'';
          var fd=phoneLoadForum(uid);
          if(!Array.isArray(fd.bookmarks)) fd.bookmarks = [];
          var bmSet = new Set(fd.bookmarks);
          fd.posts=_safeArr(fd.posts).filter(function(p){return p._source!=='autofeed' || bmSet.has(p.id);});
          phoneSaveForum(fd,uid);
        }catch(e){}
        try{ lsSet('meow_phone_g_browser_feed_v1',{v:1,items:[]}); }catch(e){}
        try{ var md=_ensureMoments(); md.posts=_safeArr(md.posts).filter(function(p){return p._source!=='autofeed';}); saveMoments(md); }catch(e){}
        try{ sessionStorage.removeItem(SS_AUTOFEED_PACK); }catch(e){}
        // 清理 IndexedDB feedPacks
        try{ if(typeof MeowDB !== 'undefined' && MeowDB.isReady()) MeowDB.clear('feedPacks').catch(function(){}); }catch(e){}
      }

      // ====== App 资讯设置弹窗通用 ======
      function _afModal(title,html){
        root.querySelectorAll('.afSettingsModal').forEach(function(m){m.remove();});
        var shell=root.querySelector('.phShell')||root;
        var mask=doc.createElement('div'); mask.className='phModalMask afSettingsModal';
        mask.innerHTML='<div class="phModalCard" role="dialog" aria-modal="true" style="max-height:80vh;overflow-y:auto;min-width:280px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><div style="font-weight:700;font-size:15px;color:var(--ph-text);">'+title+'</div><button data-act="afCloseModal" style="appearance:none;border:0;background:transparent;color:var(--ph-text-sub);font-size:18px;cursor:pointer;padding:4px;">✕</button></div>'+html+'</div>';
        mask.addEventListener('click',function(e){if(e.target===mask)mask.remove();});
        shell.appendChild(mask); return mask;
      }

      function _afBindModal(mask,appName){
        mask.querySelectorAll('.sToggle[data-afm-tgt]').forEach(function(b){b.addEventListener('click',function(){b.classList.toggle('on');var c=getAutofeedCfg();if(!c.autoTargets)c.autoTargets={};c.autoTargets[b.getAttribute('data-afm-tgt')]=b.classList.contains('on');saveAutofeedCfg(c);});});
        mask.querySelectorAll('input[data-afm-val]').forEach(function(inp){inp.addEventListener('change',function(){var ac=getAutofeedAppCfg();if(!ac[appName])ac[appName]={};ac[appName][inp.getAttribute('data-afm-val')]=parseInt(inp.value)||0;saveAutofeedAppCfg(ac);});});
        mask.querySelectorAll('.sToggle[data-afm-bool]').forEach(function(b){b.addEventListener('click',function(){b.classList.toggle('on');var ac=getAutofeedAppCfg();if(!ac[appName])ac[appName]={};ac[appName][b.getAttribute('data-afm-bool')]=b.classList.contains('on');saveAutofeedAppCfg(ac);});});
        mask.querySelectorAll('.sToggle[data-afm-sec-on]').forEach(function(b){b.addEventListener('click',function(){b.classList.toggle('on');var sk=b.getAttribute('data-afm-sec-on');var ac=getAutofeedAppCfg();if(!ac.browser)ac.browser={};if(!ac.browser.sections)ac.browser.sections={};if(!ac.browser.sections[sk])ac.browser.sections[sk]={enabled:true,count:3};ac.browser.sections[sk].enabled=b.classList.contains('on');saveAutofeedAppCfg(ac);});});
        mask.querySelectorAll('input[data-afm-sec-cnt]').forEach(function(inp){inp.addEventListener('change',function(){var sk=inp.getAttribute('data-afm-sec-cnt');var ac=getAutofeedAppCfg();if(!ac.browser)ac.browser={};if(!ac.browser.sections)ac.browser.sections={};if(!ac.browser.sections[sk])ac.browser.sections[sk]={enabled:true,count:3};ac.browser.sections[sk].count=parseInt(inp.value)||0;saveAutofeedAppCfg(ac);});});
        mask.querySelectorAll('input[name="afm_poster"]').forEach(function(r){r.addEventListener('change',function(){var ac=getAutofeedAppCfg();if(!ac.moments)ac.moments={};ac.moments.allowedPosters=r.value;saveAutofeedAppCfg(ac);});});
        mask.querySelectorAll('textarea[data-afm-ta]').forEach(function(ta){var tm=null;ta.addEventListener('input',function(){clearTimeout(tm);tm=setTimeout(function(){var ac=getAutofeedAppCfg();if(!ac[appName])ac[appName]={};ac[appName][ta.getAttribute('data-afm-ta')]=ta.value||'';saveAutofeedAppCfg(ac);},600);});});
      }

      function _openForumFeedSettings(){
        var ac=getAutofeedAppCfg(),fc=ac.forum||{},af=getAutofeedCfg(),on=af.autoTargets&&af.autoTargets.forum;
        var h='';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:13px;color:var(--ph-text);">参与自动运行</span><button class="sToggle'+(on?' on':'')+'" data-afm-tgt="forum" style="flex-shrink:0;"></button></div>';
        h+='<div style="font-weight:600;font-size:13px;color:var(--ph-text);margin-bottom:8px;">帖子生成</div>';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;color:var(--ph-text-sub);">热门 Tab 条数</span><input data-afm-val="hotCount" type="number" min="1" max="15" value="'+(fc.hotCount||5)+'" style="width:60px;padding:4px 8px;border-radius:8px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;text-align:center;"/></div>';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:12px;color:var(--ph-text-sub);">关注 Tab 条数</span><input data-afm-val="followCount" type="number" min="0" max="10" value="'+(fc.followCount||3)+'" style="width:60px;padding:4px 8px;border-radius:8px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;text-align:center;"/></div>';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:12px;color:var(--ph-text-sub);">自动生成 NPC</span><button class="sToggle'+(fc.autoGenerateNPC!==false?' on':'')+'" data-afm-bool="autoGenerateNPC" style="flex-shrink:0;"></button></div>';
        h+='<button data-act="afRunSingle" data-afapp="forum" style="width:100%;padding:10px;border:0;border-radius:10px;background:var(--ph-accent-grad);color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px;">🔄 立即刷新论坛</button>';
        h+='<div style="font-weight:600;font-size:13px;color:var(--ph-text);margin:8px 0;">高级</div><textarea data-afm-ta="customPrompt" placeholder="自定义提示词补充（留空使用默认）" style="width:100%;min-height:60px;padding:8px;border-radius:10px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;resize:vertical;box-sizing:border-box;">'+(fc.customPrompt||'')+'</textarea>';
        _afBindModal(_afModal('论坛资讯设置',h),'forum');
      }

      function _openBrowserFeedSettings(){
        var ac=getAutofeedAppCfg(),bc=ac.browser||{},secs=bc.sections||{},af=getAutofeedCfg(),on=af.autoTargets&&af.autoTargets.browser;
        var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:13px;color:var(--ph-text);">参与自动运行</span><button class="sToggle'+(on?' on':'')+'" data-afm-tgt="browser" style="flex-shrink:0;"></button></div>';
        h+='<div style="font-weight:600;font-size:13px;color:var(--ph-text);margin-bottom:8px;">各栏目设置</div>';
        var sl={worldNews:'世界资讯',npcIntel:'NPC 情报站',wikiEntry:'世界书百科',funStuff:'娱乐频道'};
        ['worldNews','npcIntel','wikiEntry','funStuff'].forEach(function(sk){
          var sec=secs[sk]||{enabled:true,count:3};
          h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><button class="sToggle'+(sec.enabled!==false?' on':'')+'" data-afm-sec-on="'+sk+'" style="flex-shrink:0;"></button><span style="flex:1;font-size:12px;color:var(--ph-text);">'+(sl[sk]||sk)+'</span><input data-afm-sec-cnt="'+sk+'" type="number" min="0" max="10" value="'+(sec.count||3)+'" style="width:50px;padding:3px 6px;border-radius:6px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:11px;text-align:center;"/><span style="font-size:11px;color:var(--ph-text-dim);">条</span></div>';
        });
        h+='<button data-act="afRunSingle" data-afapp="browser" style="width:100%;padding:10px;border:0;border-radius:10px;background:var(--ph-accent-grad);color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin:12px 0;">🔄 立即刷新浏览器资讯</button>';
        h+='<div style="font-weight:600;font-size:13px;color:var(--ph-text);margin:8px 0;">高级</div><textarea data-afm-ta="customPrompt" placeholder="留空使用默认" style="width:100%;min-height:60px;padding:8px;border-radius:10px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;resize:vertical;box-sizing:border-box;">'+(bc.customPrompt||'')+'</textarea>';
        _afBindModal(_afModal('浏览器资讯设置',h),'browser');
      }

      function _openMomentsFeedSettings(){
        var ac=getAutofeedAppCfg(),mc=ac.moments||{},af=getAutofeedCfg(),on=af.autoTargets&&af.autoTargets.moments;
        var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:13px;color:var(--ph-text);">参与自动运行</span><button class="sToggle'+(on?' on':'')+'" data-afm-tgt="moments" style="flex-shrink:0;"></button></div>';
        h+='<div style="font-weight:600;font-size:13px;color:var(--ph-text);margin-bottom:8px;">手动生成</div>';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><span style="font-size:12px;color:var(--ph-text-sub);">每次生成条数</span><input data-afm-val="generateCount" type="number" min="1" max="10" value="'+(mc.generateCount||3)+'" style="width:60px;padding:4px 8px;border-radius:8px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;text-align:center;"/></div>';
        h+='<div style="font-weight:600;font-size:13px;color:var(--ph-text);margin-bottom:8px;">选择发帖角色</div><div style="margin-bottom:14px;">';
        var ap=mc.allowedPosters||'auto';
        [{v:'auto',l:'AI 自动选择（推荐）'},{v:'contacts',l:'仅通讯录角色'},{v:'custom',l:'手动指定'}].forEach(function(m){
          h+='<label style="display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer;font-size:12px;color:var(--ph-text);"><input type="radio" name="afm_poster" value="'+m.v+'"'+(ap===m.v?' checked':'')+' style="accent-color:var(--ph-accent);"/>'+m.l+'</label>';
        });
        h+='</div>';
        h+='<button data-act="afRunSingle" data-afapp="moments" style="width:100%;padding:10px;border:0;border-radius:10px;background:var(--ph-accent-grad);color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px;">✨ 立即生成朋友圈</button>';
        h+='<div style="font-weight:600;font-size:13px;color:var(--ph-text);margin:8px 0;">高级</div><textarea data-afm-ta="customPrompt" placeholder="例如：多生成一些日常生活类的动态" style="width:100%;min-height:60px;padding:8px;border-radius:10px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:12px;resize:vertical;box-sizing:border-box;">'+(mc.customPrompt||'')+'</textarea>';
        _afBindModal(_afModal('朋友圈资讯设置',h),'moments');
      }

      // ====== 朋友圈（真实点赞+评论，持久化）======

      // ====== 发现子页面数据层 key（各页独立，不污染其它模块） ======
      const LS_PHONE_CHATHISTORY = 'meow_phone_g_chathistory_v1';
      const LS_PHONE_GLOBALWB    = 'meow_phone_g_globalwb_v1';
      const LS_PHONE_VOICEAPI    = 'meow_phone_g_voiceapi_v1';
      const LS_PHONE_RELATIONS   = 'meow_phone_g_relations_v1';
      const LS_PHONE_BLACKLIST   = 'meow_phone_g_blacklist_v1';
      const LS_PHONE_MOMENTS_CFG = 'meow_phone_g_moments_cfg_v1';
      const LS_PHONE_CHAT_SETTINGS = 'meow_phone_g_chat_settings_v1'; // C2: 聊天级设置（personaOverride 等）

      // ====== C2: 聊天级设置数据层（personaOverride / chatId 联动）======
      function loadPhoneChatSettings(){
        try{ return lsGet(LS_PHONE_CHAT_SETTINGS, { v:1, personaOverride: null }); }catch(e){ return { v:1, personaOverride: null }; }
      }
      function savePhoneChatSettings(d){
        try{ lsSet(LS_PHONE_CHAT_SETTINGS, d); }catch(e){}
      }

      // ====== AutoFeed 资讯生成系统 — 数据层 ======
      const LS_AUTOFEED_CFG     = 'meow_phone_autofeed_cfg_v1';
      const LS_AUTOFEED_APP_CFG = 'meow_phone_autofeed_app_cfg_v1';
      const SS_AUTOFEED_PACK    = 'meow_phone_autofeed_pack_v1';

      function _afDefaultCfg(){
        return { v:1, enabled:false, mode:'daily_once', intervalMin:180, dailyHour:9, tzMode:'real',
          sources:{ worldbook:true, summary:true, phoneGlobalWB:true, recentChat:false },
          autoTargets:{ forum:true, browser:true, moments:true, shop:false, weather:false },
          lastRunAt:0, lastRunKey:'', lastError:'', cooldownUntil:0 };
      }
      function getAutofeedCfg(){ try{ const d=lsGet(LS_AUTOFEED_CFG,null); if(d&&d.v===1) return d; }catch(e){} return _afDefaultCfg(); }
      function saveAutofeedCfg(d){ try{ lsSet(LS_AUTOFEED_CFG,d); }catch(e){} }

      function _afDefaultAppCfg(){
        return { v:1,
          moments:{ generateCount:3, customPrompt:'', allowedPosters:'auto', customPosterList:[] },
          browser:{ sections:{ worldNews:{enabled:true,count:3,label:'世界资讯'}, npcIntel:{enabled:true,count:3,label:'NPC 情报站'}, wikiEntry:{enabled:true,count:2,label:'世界书百科'}, funStuff:{enabled:true,count:2,label:'娱乐频道'} }, customSections:[], customPrompt:'' },
          forum:{ hotCount:5, followCount:3, topicTypes:['热门','八卦','心情','生活','记录','交友'], autoGenerateNPC:true, customPrompt:'' } };
      }
      function getAutofeedAppCfg(){ try{ const d=lsGet(LS_AUTOFEED_APP_CFG,null); if(d&&d.v===1) return d; }catch(e){} return _afDefaultAppCfg(); }
      function saveAutofeedAppCfg(d){ try{ lsSet(LS_AUTOFEED_APP_CFG,d); }catch(e){} }

      // ====== getAutofeedPack / saveAutofeedPack — 阶段 1.5 迁移到 IndexedDB ======
      async function getAutofeedPack(chatId){
        var cid = chatId || ((typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '') || '_default';
        // 1) 先从 MeowDB 读
        try{
          if(typeof MeowDB !== 'undefined' && MeowDB.isReady()){
            var val = await MeowDB.getJSON('feedPacks', 'feed_'+cid);
            if(val && val.v === 1) return val;
          }
        }catch(e){ console.warn('[AutoFeed] IDB read failed, fallback SS:', e); }
        // 2) 降级从 sessionStorage 读（兼容旧数据/降级场景）
        try{ const raw=sessionStorage.getItem(SS_AUTOFEED_PACK); if(raw){ const d=JSON.parse(raw); if(d&&d.v===1) return d; } }catch(e){}
        // 3) 都没有
        return { v:1, generatedAt:0, forChatId:'', payload:{ forum:[], browser:[], moments:[] } };
      }

      async function saveAutofeedPack(d){
        var cid = (d && d.forChatId) || ((typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '') || '_default';
        // 1) 尝试写入 MeowDB
        try{
          if(typeof MeowDB !== 'undefined' && MeowDB.isReady()){
            await MeowDB.putJSON('feedPacks', 'feed_'+cid, d);
            // 裁剪：每个 chatId 最多保留最近 3 批资讯
            try{ await _trimFeedPacks(cid); }catch(ex){}
            void(0)&&console.log('[AutoFeed] ✅ 资讯包已写入 IndexedDB (feed_'+cid+')');
            // 成功后清理 sessionStorage 中的旧数据（节省空间）
            try{ sessionStorage.removeItem(SS_AUTOFEED_PACK); }catch(e){}
            return;
          }
        }catch(e){
          console.warn('[AutoFeed] IDB write failed, fallback SS:', e);
        }
        // 2) 降级写入 sessionStorage + toast
        try{
          const j=JSON.stringify(d||{});
          if(j.length>512*1024){ try{d.payload.forum=[];d.payload.browser=[];}catch(e){} }
          sessionStorage.setItem(SS_AUTOFEED_PACK,JSON.stringify(d));
          try{ toast('数据临时缓存，关闭页面会丢失'); }catch(e){}
        }catch(e){
          try{sessionStorage.removeItem(SS_AUTOFEED_PACK);sessionStorage.setItem(SS_AUTOFEED_PACK,JSON.stringify(d));}catch(e2){}
        }
      }

      /** 裁剪策略：每个 chatId 最多保留最近 3 批资讯 */
      async function _trimFeedPacks(currentCid){
        if(!MeowDB.isReady()) return;
        try{
          var all = await MeowDB.getAll('feedPacks', { prefix: 'feed_'+currentCid });
          // 如果同一 chatId 下没有多批，直接返回（当前只有 1 个 key per chatId，但为未来多批预留）
          // 按写入时间排序，保留最近 3 个
          if(all.length <= 3) return;
          all.sort(function(a,b){
            var ta = (a.value && typeof a.value === 'string') ? (JSON.parse(a.value).generatedAt||0) : 0;
            var tb = (b.value && typeof b.value === 'string') ? (JSON.parse(b.value).generatedAt||0) : 0;
            return tb - ta;
          });
          for(var i = 3; i < all.length; i++){
            await MeowDB.delete('feedPacks', all[i].key);
          }
          void(0)&&console.log('[AutoFeed] 裁剪旧批次:', all.length-3, '条已删除');
        }catch(e){}
      }

      function estimateLSUsage(){ let t=0; try{ for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);t+=(k||'').length+(localStorage.getItem(k)||'').length;} }catch(e){} return t*2; }

      // ====== setAppBarTitle：统一修改顶部 AppBar 标题 ======
      function setAppBarTitle(text){
        try{
          const titleEl = root.querySelector('[data-ph="appTitle"]');
          if (titleEl) titleEl.textContent = String(text || '');
        }catch(e){}
      }

      // ====== setAppBarRight：设置 AppBar 右侧按钮 ======
      function setAppBarRight(html){
        try{
          const el = root.querySelector('[data-ph="appBarRight"]');
          if(el) el.innerHTML = String(html || '');
        }catch(e){}
      }

      // ====== 黑名单数据层 ======
      function loadBlacklist(){
        try{ return lsGet(LS_PHONE_BLACKLIST, { v:1, list:[] }); }catch(e){ return { v:1, list:[] }; }
      }
      function saveBlacklist(d){
        try{ lsSet(LS_PHONE_BLACKLIST, d); }catch(e){}
      }
      function isBlacklisted(nameOrId){
        const bl = loadBlacklist();
        const s = String(nameOrId||'').trim().toLowerCase();
        return _safeArr(bl.list).some(x => String(x.name||'').trim().toLowerCase() === s || String(x.id||'').trim().toLowerCase() === s);
      }

      // ====== 关系网数据层 ======
      function loadRelations(){
        try{ return lsGet(LS_PHONE_RELATIONS, { v:1, list:[] }); }catch(e){ return { v:1, list:[] }; }
      }
      function saveRelations(d){
        try{ lsSet(LS_PHONE_RELATIONS, d); }catch(e){}
      }

      // ====== 声音API数据层 ======
      function loadVoiceApi(){
        try{ return lsGet(LS_PHONE_VOICEAPI, { v:1, apiUrl:'', apiKey:'', defaultVoiceId:'', bindings:[] }); }catch(e){ return { v:1, apiUrl:'', apiKey:'', defaultVoiceId:'', bindings:[] }; }
      }
      function saveVoiceApi(d){
        try{ lsSet(LS_PHONE_VOICEAPI, d); }catch(e){}
      }

      // ====== 全局世界书数据层 ======
      function loadPhoneGlobalWB(){
        try{ return lsGet(LS_PHONE_GLOBALWB, { v:1, text:'', enabled:false }); }catch(e){ return { v:1, text:'', enabled:false }; }
      }
      function savePhoneGlobalWB(d){
        try{ lsSet(LS_PHONE_GLOBALWB, d); }catch(e){}
      }

      // ====== 朋友圈配置数据层 ======
      function loadMomentsCfg(){
        try{ return lsGet(LS_PHONE_MOMENTS_CFG, { v:1, coverImage:'', avatarImage:'' }); }catch(e){ return { v:1, coverImage:'', avatarImage:'' }; }
      }
      function saveMomentsCfg(d){
        try{ lsSet(LS_PHONE_MOMENTS_CFG, d); }catch(e){}
      }

      const LS_MOMENTS = 'meow_phone_g_moments_v1';
      function loadMoments(){
        try{ return lsGet(LS_MOMENTS, null); }catch(e){ return null; }
      }
      function saveMoments(d){
        try{ lsSet(LS_MOMENTS, d); }catch(e){}
      }
      function _ensureMoments(){
        let d = loadMoments();

        // ✅ 已有数据：把系统帖清掉（你要求“系统朋友圈去掉”）
        if (d && d.posts){
          try{
            d.posts = _safeArr(d.posts).filter(p=>{
              const pid = String(p?.id||'');
              const nm  = String(p?.name||'');
              return !(pid === 'm_sys' || nm === '系统');
            });

            // 顺手清理系统点赞/系统评论（可选但更干净）
            d.posts.forEach(p=>{
              try{
                if (Array.isArray(p.likes)) p.likes = p.likes.filter(x=>String(x||'')!=='系统');
                if (Array.isArray(p.comments)) p.comments = p.comments.filter(c=>String(c?.name||'')!=='系统');
              }catch(e){}
            });

            saveMoments(d);
          }catch(e){}
          return d;
        }

        // ✅ 新数据：默认空白朋友圈
        d = { v:1, posts:[] };
        saveMoments(d);
        return d;
      }

      function renderMoments(container){
        setAppBarRight('<button class="phBarRBtn" data-act="afMomentsSettings" title="朋友圈资讯设置">⚙️</button>');
        const data = _ensureMoments();
        const cfg = loadMomentsCfg();
        const settings = phoneLoadSettings();
        const userName = (settings && settings.phoneName) || '原';
        const coverBg = cfg.coverImage ? `background-image:url(${cfg.coverImage});background-size:cover;background-position:center;` : 'background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);';
        const avatarChar = cfg.avatarImage ? `<img src="${esc(cfg.avatarImage)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"/>` : `<span style="font-size:24px;">${esc(userName.charAt(0))}</span>`;

        // 计算新收到的点赞（上次访问后新增的）
        const lastVisit = data._lastVisit || 0;
        const newLikes = [];
        data.posts.forEach(m=>{
          if(m.name==='我') return;
          const lArr = Array.isArray(m.likes)?m.likes:[];
          lArr.forEach(l=>{ if(l!=='我' && m._likeTime && m._likeTime[l] && m._likeTime[l]>lastVisit) newLikes.push({from:l,post:m.content.slice(0,15)}); });
        });
        data._lastVisit = Date.now();
        saveMoments(data);

        let html = `<div class="momentsList">
          <!-- 封面 -->
          <div style="position:relative;height:220px;${coverBg}overflow:hidden;">
            <button data-act="momentCompose" style="position:absolute;top:10px;right:12px;appearance:none;border:0;background:rgba(0,0,0,.35);color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(8px);z-index:2;font-size:18px;">📷</button>
            <button data-act="momentsCoverSet" style="position:absolute;top:10px;left:12px;appearance:none;border:0;background:rgba(0,0,0,.25);color:#fff;padding:4px 10px;border-radius:12px;font-size:10px;cursor:pointer;backdrop-filter:blur(8px);z-index:2;">设置封面</button>
            <div style="position:absolute;bottom:14px;right:14px;display:flex;align-items:center;gap:10px;z-index:2;">
              <span style="color:#fff;font-size:15px;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.5);">${esc(userName)}</span>
              <div style="width:56px;height:56px;border-radius:10px;background:rgba(255,255,255,.2);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.6);overflow:hidden;">${avatarChar}</div>
            </div>
          </div>`;

        // 收到点赞提示
        if(newLikes.length){
          html += `<div style="background:#f7f7f7;border-bottom:1px solid #eee;padding:10px 14px;display:flex;align-items:center;gap:8px;font-size:12px;color:#666;">
            <span style="color:#e74c3c;font-size:16px;">❤️</span>
            <span>${esc(newLikes.map(l=>l.from).join('、'))} 赞了你的动态</span>
          </div>`;
        }

        data.posts.forEach(m=>{
          const likeArr = Array.isArray(m.likes) ? m.likes : [];
          const cmtArr = Array.isArray(m.comments) ? m.comments : [];
          const iLiked = likeArr.includes('我');
          const ago = _momentAgo(m.time);

          // 点赞头像列表（微信风格：❤️ 头像1 名字, 头像2 名字…）
          let likesHtml = '';
          if(likeArr.length){
            likesHtml = `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:6px 10px;border-radius:6px;background:rgba(0,0,0,.04);margin-bottom:4px;">
              <span style="color:#e74c3c;font-size:12px;margin-right:2px;">❤️</span>`;
            likeArr.forEach((l,i)=>{
              likesHtml += `<span style="font-size:12px;color:#576b95;font-weight:500;">${esc(l)}${i<likeArr.length-1?'、':''}</span>`;
            });
            likesHtml += '</div>';
          }

          // 评论列表（支持回复，@格式）
          let cmtsHtml = '';
          if(cmtArr.length){
            cmtsHtml = '<div class="momentComments">';
            cmtArr.forEach((c,ci)=>{
              const replyTo = c.replyTo ? `<span style="color:#576b95;">回复 ${esc(c.replyTo)}</span>：` : '';
              cmtsHtml += `<div class="momentCmt" data-ci="${ci}" data-mid="${esc(m.id)}">
                <span class="momentCmtName">${esc(c.name)}</span>：${replyTo}${esc(c.text)}
                <span class="momentCmtReplyBtn" data-replyto="${esc(c.name)}" data-mid="${esc(m.id)}" style="float:right;font-size:10px;color:#576b95;cursor:pointer;padding:0 4px;">回复</span>
              </div>`;
            });
            cmtsHtml += '</div>';
          }

          html += `<div class="momentItem" data-mid="${esc(m.id)}">
            <div class="momentHead">
              <div class="momentAvatar">${esc(m.avatar||'👤')}</div>
              <div style="flex:1;"><div class="momentName">${esc(m.name)}</div></div>
            </div>
            <div class="momentContent">${esc(m.content)}</div>`;
          if(m.images && m.images.length) html += renderFakeImages(m.images);
          html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
              <span style="font-size:11px;color:var(--ph-text-dim);">${ago}</span>
              <div style="display:flex;gap:6px;">
                <button class="momentAction${iLiked?' liked':''}" data-mact="like" data-mid="${esc(m.id)}" style="background:none;border:none;color:${iLiked?'#e74c3c':'var(--ph-text-sub)'};font-size:12px;cursor:pointer;display:flex;align-items:center;gap:3px;">❤️ ${likeArr.length||''}</button>
                <button class="momentAction" data-mact="comment" data-mid="${esc(m.id)}" style="background:none;border:none;color:var(--ph-text-sub);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:3px;">💬 ${cmtArr.length||''}</button>
              </div>
            </div>
            ${likesHtml}
            ${cmtsHtml}
            <div class="momentCmtInput" data-cmtbox="${esc(m.id)}" style="display:none;">
              <input type="text" placeholder="写评论…" data-cmtinput="${esc(m.id)}" data-replyto="" style="flex:1;padding:6px 10px;border-radius:14px;border:1px solid rgba(0,0,0,.1);background:#f7f7f7;color:#333;font-size:12px;outline:none;"/>
              <button data-cmtsend="${esc(m.id)}" style="appearance:none;border:none;background:#07c160;color:#fff;padding:6px 12px;border-radius:14px;font-size:12px;cursor:pointer;font-weight:600;">发送</button>
            </div>
          </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
        _bindMomentActions(container);
      }

      function _momentAgo(ts){
        const diff = Date.now() - (ts||0);
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff/60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff/3600000) + '小时前';
        return Math.floor(diff/86400000) + '天前';
      }

            // ========= Moments：小手机内发动态弹窗（替代 window.prompt） =========
      function _openMomentComposeModal(container){
        try{
          const shell = root.querySelector('.phShell') || root;

          // 清理旧弹窗（避免叠层）
          try{
            shell.querySelectorAll('.phModalMask[data-phm="moment"]').forEach(n=>n.remove());
          }catch(e){}

          const mask = doc.createElement('div');
          mask.className = 'phModalMask';
          mask.setAttribute('data-phm','moment');
          mask.innerHTML = `
            <div class="phModalCard" role="dialog" aria-modal="true">
              <div class="phModalTitle">发动态</div>
              <textarea class="phModalTa" data-phm="ta" placeholder="写点什么…" rows="4"></textarea>
              <div class="phModalBtns">
                <button class="phModalBtn" data-phm-act="cancel" type="button">取消</button>
                <button class="phModalBtn primary" data-phm-act="ok" type="button">发布</button>
              </div>
            </div>
          `;
          shell.appendChild(mask);

          const ta = mask.querySelector('textarea[data-phm="ta"]');
          setTimeout(()=>{ try{ ta && ta.focus(); }catch(e){} }, 30);

          const close = ()=>{ try{ mask.remove(); }catch(e){} };

          mask.addEventListener('click',(e)=>{
            if (e.target === mask) close();
          });

          mask.querySelector('[data-phm-act="cancel"]')?.addEventListener('click',(e)=>{
            e.preventDefault();
            close();
          });

          mask.querySelector('[data-phm-act="ok"]')?.addEventListener('click',(e)=>{
            e.preventDefault();
            const txt = String(ta?.value||'').trim();
            if (!txt){ close(); return; }
            const data = _ensureMoments();
            data.posts.unshift({
              id: 'm_' + Date.now().toString(36),
              name: '我', avatar: '😊',
              content: txt,
              time: Date.now(),
              likes: [], comments: [],
            });
            saveMoments(data);
            close();
            renderMoments(container);
          });
        }catch(e){
          try{ toast('弹窗打开失败'); }catch(_){}
        }
      }

      // ====== 朋友圈封面/头像设置弹窗 ======
      function _openMomentsCoverSettings(){
        const cfg = loadMomentsCfg();
        root.querySelectorAll('.wxConfirmOverlay').forEach(o=>o.remove());
        const overlay = doc.createElement('div');
        overlay.className = 'wxConfirmOverlay';
        overlay.innerHTML = `<div class="wxConfirmBox" style="min-width:260px;text-align:left;">
          <div style="font-weight:700;font-size:15px;color:rgba(20,24,28,.88);margin-bottom:14px;text-align:center;">朋友圈封面设置</div>
          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:4px;">封面图片 URL</div>
            <input data-field="coverImage" value="${cfg.coverImage||''}" placeholder="https://example.com/cover.jpg" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;"/>
          </div>
          <div style="margin-bottom:14px;">
            <div style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:4px;">头像图片 URL</div>
            <input data-field="avatarImage" value="${cfg.avatarImage||''}" placeholder="https://example.com/avatar.jpg" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid rgba(0,0,0,.12);border-radius:8px;font-size:13px;outline:none;"/>
          </div>
          <div style="display:flex;gap:8px;">
            <button data-act="mcsCancelBtn" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.6);font-size:13px;cursor:pointer;">取消</button>
            <button data-act="mcsSaveBtn" style="flex:1;padding:10px;border-radius:8px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">保存</button>
          </div>
        </div>`;
        root.appendChild(overlay);
        overlay.addEventListener('click',(e)=>{
          if (e.target === overlay) overlay.remove();
          if (e.target.closest('[data-act="mcsCancelBtn"]')) overlay.remove();
          if (e.target.closest('[data-act="mcsSaveBtn"]')){
            cfg.coverImage = (overlay.querySelector('[data-field="coverImage"]')?.value||'').trim();
            cfg.avatarImage = (overlay.querySelector('[data-field="avatarImage"]')?.value||'').trim();
            saveMomentsCfg(cfg);
            overlay.remove();
            try{toast('封面设置已保存');}catch(e){}
            // 刷新朋友圈
            const content = root.querySelector('[data-ph="chatTabContent"]');
            if (content) renderMoments(content);
          }
        });
      }

function _bindMomentActions(container){
        // 点赞
        container.querySelectorAll('[data-mact="like"]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const mid = btn.getAttribute('data-mid');
            const data = _ensureMoments();
            const post = data.posts.find(p=>p.id===mid);
            if (!post) return;
            if (!Array.isArray(post.likes)) post.likes = [];
            const idx = post.likes.indexOf('我');
            if (idx >= 0) post.likes.splice(idx, 1);
            else {
              post.likes.push('我');
              // 记录点赞时间
              if(!post._likeTime) post._likeTime = {};
              post._likeTime['我'] = Date.now();
            }
            saveMoments(data);
            renderMoments(container);
          });
        });
        // 展开评论输入
        container.querySelectorAll('[data-mact="comment"]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const mid = btn.getAttribute('data-mid');
            const box = container.querySelector(`[data-cmtbox="${mid}"]`);
            if (box){
              const show = box.style.display === 'none';
              box.style.display = show ? 'flex' : 'none';
              if (show){
                const inp = box.querySelector('input');
                if (inp) setTimeout(()=>inp.focus(), 80);
              }
            }
          });
        });
        // 发送评论
        // 回复按钮：填入 @对方 到输入框
        container.querySelectorAll('.momentCmtReplyBtn').forEach(btn=>{
          btn.addEventListener('click',e=>{
            e.stopPropagation();
            const mid = btn.getAttribute('data-mid');
            const replyTo = btn.getAttribute('data-replyto');
            const box = container.querySelector(`[data-cmtbox="${mid}"]`);
            if(box){
              box.style.display = 'flex';
              const inp = box.querySelector('input');
              if(inp){
                inp.setAttribute('data-replyto', replyTo);
                inp.placeholder = `回复 ${replyTo}…`;
                setTimeout(()=>inp.focus(), 80);
              }
            }
          });
        });

        container.querySelectorAll('[data-cmtsend]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const mid = btn.getAttribute('data-cmtsend');
            const inp = container.querySelector(`[data-cmtinput="${mid}"]`);
            const txt = (inp?.value||'').trim();
            if (!txt) return;
            const replyTo = inp.getAttribute('data-replyto') || '';
            const data = _ensureMoments();
            const post = data.posts.find(p=>p.id===mid);
            if (!post) return;
            if (!Array.isArray(post.comments)) post.comments = [];
            const myName = (phoneLoadSettings()&&phoneLoadSettings().phoneName)||'我';
            post.comments.push({name:myName, text:txt, time:Date.now(), replyTo:replyTo||''});
            inp.value = '';
            inp.setAttribute('data-replyto','');
            inp.placeholder = '写评论…';
            saveMoments(data);
            renderMoments(container);

            // AI自动回复：帖主不是"我"时，1~2分钟后回复
            if(post.name && post.name !== myName && post.name !== '我'){
              const delay = 60000 + Math.random()*60000; // 1~2分钟
              setTimeout(async ()=>{
                try{
                  const cfg2 = PhoneAI._getConfig();
                  if(!cfg2.endpoint || !cfg2.key) return;
                  const prompt = `你是"${post.name}"，性格特点见角色设定。用户"${myName}"在你的朋友圈动态下评论了："${txt}"。请以${post.name}的口吻回复一条简短自然的评论（不超过30字，不用加引号，像真实聊天一样）。`;
                  const res = await PhoneAI.chat({ system:'你是小手机朋友圈AI，请用角色口吻简短回复评论。', prompt, maxTokens:60, temperature:0.9 });
                  if(res.ok && res.text){
                    const d2 = _ensureMoments();
                    const p2 = d2.posts.find(p=>p.id===mid);
                    if(p2){
                      p2.comments.push({name:post.name, text:res.text.trim().slice(0,60), time:Date.now(), replyTo:myName});
                      saveMoments(d2);
                      // 如果朋友圈还开着就刷新
                      const cont2 = root.querySelector('[data-ph="chatTabContent"]');
                      if(cont2) renderMoments(cont2);
                      try{ toast(`💬 ${post.name} 回复了你`); }catch(e){}
                    }
                  }
                }catch(e){}
              }, delay);
            }
          });
        });
        // 发送评论回车
        container.querySelectorAll('[data-cmtinput]').forEach(inp=>{
          inp.addEventListener('keydown',(e)=>{
            if (e.key === 'Enter'){
              e.preventDefault();
              const mid = inp.getAttribute('data-cmtinput');
              const btn = container.querySelector(`[data-cmtsend="${mid}"]`);
              if (btn) btn.click();
            }
          });
        });
        // 发动态（小手机内弹窗，避免浏览器 prompt 跑到外层）
        container.querySelectorAll('[data-act="momentCompose"]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            _openMomentComposeModal(container);
          });
        });
        // 分享（提示）
        container.querySelectorAll('[data-mact="share"]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            try{ toast('已复制到剪贴板'); }catch(e){}
          });
        });
      }

      /* ========== 聊天详情（NPC 私聊） ========== */
      function renderChatDetail(npcId){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;

// 读聊天对象（好友 / 群聊）
// ✅ 群聊 id: group_xxx → 从 groups_v1 取群名；否则会显示 group_xxx 让人以为“群聊坏了”
const npc = _wxGetChatTargetMeta(contactId);
ensureThread(npc.id, npc.name, npc.avatar);

        // 刷标题
        try{
          const titleEl = root.querySelector('[data-ph="appTitle"]');
          if (titleEl) titleEl.textContent = npc.name;
        }catch(e){}

        // 渲染
        body.innerHTML = `
          <div class="chatDetailWrap">
            <div class="phCard" style="margin-top:8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <div style="color:var(--ph-text);font-weight:700;">${esc(npc.name)}</div>
                <button class="btn primary" type="button" data-act="exportChat" style="padding:6px 10px;border-radius:12px;">⬆ 回写草稿</button>
              </div>
              <div style="margin-top:6px;color:var(--ph-text-dim);font-size:12px;line-height:1.4;">
                ${esc((npc.profile||'').slice(0,120) || '（可在通讯录里补充人物简档，用于后续生成更贴合的 NPC 回复）')}
              </div>
            </div>

            <div class="chatMsgs" data-ph="chatMsgs"></div>

            <div class="chatInputBar">
              <button class="chatExtraBtn" title="表情">😊</button>
              <textarea rows="1" placeholder="对 ${esc(npc.name)} 说点什么…" data-ph="chatInput"></textarea>
              <button class="chatSendBtn" data-act="sendChat">${_phFlatIcon('➤')}</button>
            </div>
          </div>`;

        // 填充历史
        const msgs = body.querySelector('[data-ph="chatMsgs"]');
        const log = getLog(npcId);
        if (msgs){
          if (!log.length){
            // 首次提示
            const tip = doc.createElement('div');
            tip.className = 'chatBubble them';
            tip.innerHTML = `<div class="cbAvatar">${esc(npc.avatar||'❔')}</div><div><div class="cbContent">在这里和我私聊吧。需要影响主线时，用上面的“回写草稿”。</div><div class="cbTime">${_fmtTime(_now())}</div></div>`;
            msgs.appendChild(tip);
          }else{
            for (const x of log){
              _appendBubble(msgs, npc, x.role, x.text, x.t);
            }
          }
          requestAnimationFrame(()=>{ try{ msgs.scrollTop = msgs.scrollHeight; }catch(e){} });
        }

        const input = body.querySelector('[data-ph="chatInput"]');
        if (input){
          input.addEventListener('keydown',(e)=>{
            if (e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendChatMessage(); }
          });
          setTimeout(()=>{ try{input.focus();}catch(e){} }, 120);
        }

        // 清未读
        bumpThread(npcId, { unread:0 });
      }

      function _appendBubble(msgs, npc, role, text, ts){
        const b = doc.createElement('div');
        b.className = `chatBubble ${role}`;
        const avatar = (role==='me') ? '👤' : (npc.avatar || (npc.name||'?').charAt(0));
        b.innerHTML = `<div class="cbAvatar">${esc(avatar)}</div><div><div class="cbContent">${esc(text)}</div><div class="cbTime">${esc(_fmtTime(ts))}</div></div>`;
        msgs.appendChild(b);
      }

      async function sendChatMessage(){
        const input = root.querySelector('[data-ph="chatInput"]');
        if (!input) return;
        const text = String(input.value||'').trim();
        if (!text) return;
        input.value = '';

const npcId = state.chatTarget;
const npc = _wxGetChatTargetMeta(npcId);

        // 写我方消息
        pushLog(npcId, 'me', text);
        bumpThread(npcId, { lastMsg:text, lastTime:_now(), unread:0 });

        // 刷新 UI
        const msgs = root.querySelector('[data-ph="chatMsgs"]');
        if (msgs){
          _appendBubble(msgs, npc, 'me', text, _now());
          requestAnimationFrame(()=>{ msgs.scrollTop = msgs.scrollHeight; });
        }

        // 先用 mock 回复占位（后续你再接“按人物简档 + 主线摘要 + 私聊上下文”走模型生成）
        await sleep(450 + Math.random()*550);
        const reply = generateMockReply(text, 0, 1);

        pushLog(npcId, 'them', reply);
        bumpThread(npcId, { lastMsg:reply, lastTime:_now(), unread:0 });

        if (msgs){
          _appendBubble(msgs, npc, 'them', reply, _now());
          requestAnimationFrame(()=>{ msgs.scrollTop = msgs.scrollHeight; });
        }
      }

      /* ========== 短信 App ========== */
      function renderSmsApp(container){
        const msgs = [
          {from:'系统通知',preview:'你有一条新的系统消息',time:'10:30',unread:true},
          {from:'天气助手',preview:'今日天气：多云转晴，最高26°',time:'08:00',unread:false},
          {from:'论坛提醒',preview:'你的帖子收到了3条新评论',time:'昨天',unread:true},
        ];
        let html = '<div class="chatList">';
        msgs.forEach(m=>{
          html += `<div class="chatItem" data-chatid="sms_${esc(m.from)}">
            <div class="cAvatar svgIco" style="${m.unread?'box-shadow:0 0 0 2px var(--ph-accent);':''}">${_phFlatIcon('✉️')}</div>
            <div class="cInfo"><div class="cName" style="${m.unread?'font-weight:800;':'font-weight:500;'}">${esc(m.from)}</div><div class="cLastMsg">${esc(m.preview)}</div></div>
            <div class="cTime">${m.time}</div>
          </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
      }

      /* ========== 聊天详情（版面6：微信聊天风格 — 模块化重构） ========== */
      /* 骨架 + 各面板独立渲染函数 + 数据层分离 */

      /* --- 数据层：提醒系统 --- */
      const LS_REMINDERS = 'meow_phone_reminders_v1';
      function _loadReminders(npcId){
        try{
          const all = lsGet(LS_REMINDERS, {});
          return _safeArr(all[npcId]);
        }catch(e){ return []; }
      }
      function _saveReminders(npcId, list){
        try{
          const all = lsGet(LS_REMINDERS, {});
          all[npcId] = list;
          lsSet(LS_REMINDERS, all);
        }catch(e){}
      }

      /* --- 数据层：角色设定(扩展profile) --- */
      function _loadCharExtra(npcId){
        return _phLoad('char_extra_'+npcId, { profile:'', chatBg:'', autoSummary:false });
      }
      function _saveCharExtra(npcId, data){
        _phSave('char_extra_'+npcId, data);
      }

      /* --- 骨架渲染：renderChatDetail --- */
      function renderChatDetail(contactId){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;

        // 读 NPC 信息
        const db = loadContactsDB();
        const npc = findContactById(db, contactId) || { id:contactId, name:String(contactId), avatar:(String(contactId).charAt(0)), profile:'' };
        ensureThread(npc.id, npc.name, npc.avatar);

        // C2: 打开会话时预取酒馆世界书内容缓存
        try{ _refreshTavernWBCache(); }catch(e){}

        // 刷标题
        try{
          const titleEl = root.querySelector('[data-ph="appTitle"]');
          if (titleEl) titleEl.textContent = npc.name;
        }catch(e){}

        // ✅ 注入"+"到 app bar 右侧 → 进入角色设置页
        try{
          const spacer = root.querySelector('.phAppBarSpacer');
          if (spacer) spacer.innerHTML = `<button class="wxTopBtn" data-act="wxCharSettings" data-npcid="${esc(contactId)}" style="appearance:none;border:0;background:transparent;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:var(--ph-text);border-radius:8px;">${_phFlatIcon('➕')}</button>`;
        }catch(e){}

        // 读取自定义聊天背景
        const charEx = _loadCharExtra(contactId);
        const bgStyle = charEx.chatBg ? `background-image:url('${charEx.chatBg}');background-size:cover;background-position:center;` : '';

        // 渲染骨架
        body.innerHTML = `
          <div class="wxChatDetailWrap">
            <div class="wxChatMsgs" data-ph="chatMsgs" style="${bgStyle}"></div>
            <div class="wxChatInputBar">
              <button class="wxChatExBtn" data-act="wxVoiceToggle" title="语音">${_phFlatIcon('🎙')}</button>
              <textarea rows="1" placeholder="输入消息…" data-ph="chatInput" inputmode="text" enterkeyhint="send" autocomplete="off"></textarea>
              <button class="wxChatExBtn" data-act="wxStickerToggle" title="表情">${_phFlatIcon('😊')}</button>
              <button class="wxChatExBtn" data-act="wxChatPlusToggle" title="更多">${_phFlatIcon('➕')}</button>
              <button class="wxChatSendBtn" data-act="wxSendChat" title="发送" style="flex-shrink:0;">发送</button>
            </div>
            <div class="wxVoicePanel" data-ph="voicePanel"></div>
            <div class="wxStickerPanel" data-ph="stickerPanel"></div>
            <div class="wxChatPlusGrid" style="display:none;" data-ph="chatPlusGrid">
              <div class="wxCPItem" data-act="wxCPAction" data-cpact="photo"><div class="wxCPIco">${_phFlatIcon('🖼')}</div><div class="wxCPLabel">照片</div></div>
              <div class="wxCPItem" data-act="wxCPAction" data-cpact="camera"><div class="wxCPIco">${_phFlatIcon('📷')}</div><div class="wxCPLabel">拍摄</div></div>
              <div class="wxCPItem" data-act="wxCPAction" data-cpact="videocall"><div class="wxCPIco"><svg class="phIco" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg></div><div class="wxCPLabel">视频通话</div></div>
              <div class="wxCPItem" data-act="wxCPAction" data-cpact="location"><div class="wxCPIco"><svg class="phIco" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg></div><div class="wxCPLabel">位置</div></div>
              <div class="wxCPItem" data-act="wxCPAction" data-cpact="redpack"><div class="wxCPIco" style="color:#e74c3c;"><svg class="phIco" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.87c0 1.87-1.38 2.9-3.12 3.17z"/></svg></div><div class="wxCPLabel">红包</div></div>
              <div class="wxCPItem" data-act="wxCPAction" data-cpact="gift"><div class="wxCPIco"><svg class="phIco" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 12 7.4l3.38 4.6L17 10.83 14.92 8H20v6z"/></svg></div><div class="wxCPLabel">礼物</div></div>
              <div class="wxCPItem" data-act="wxCPAction" data-cpact="transfer"><div class="wxCPIco"><svg class="phIco" viewBox="0 0 24 24" fill="currentColor"><path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg></div><div class="wxCPLabel">转账</div></div>
              <div class="wxCPItem" data-act="wxCPAction" data-cpact="music"><div class="wxCPIco">${_phFlatIcon('🎵')}</div><div class="wxCPLabel">音乐</div></div>
            </div>
          </div>`;

        // 填充历史消息
        _chatDetail_fillHistory(body, npc, contactId);

        // 绑定输入框
        _chatDetail_bindInput(body, contactId);

        // 初始化气泡长按菜单
        _initBubbleLongPress();

        // 清未读
        bumpThread(contactId, { unread:0 });
      }

      /* --- 子渲染：填充历史消息 --- */
      function _chatDetail_fillHistory(body, npc, contactId){
        const msgs = body.querySelector('[data-ph="chatMsgs"]');
        const log = getLog(contactId);
        if (!msgs) return;
        if (!log.length){
          const tip = doc.createElement('div');
          tip.className = 'wxCBTime';
          tip.textContent = _fmtTime(_now());
          msgs.appendChild(tip);
          _wxAppendBubble(msgs, npc, 'them', '在这里和我私聊吧~ 😊', _now());
        }else{
          let lastTimeStr = '';
          for (const x of log){
            const ts = _fmtTime(x.t);
            if (ts !== lastTimeStr){
              const td = doc.createElement('div');
              td.className = 'wxCBTime';
              td.textContent = ts;
              msgs.appendChild(td);
              lastTimeStr = ts;
            }
            _wxAppendBubble(msgs, npc, x.role, x.text, x.t, undefined, { edited:!!x.edited, recalled:!!x.recalled });
          }
        }
        requestAnimationFrame(()=>{ try{ msgs.scrollTop = msgs.scrollHeight; }catch(e){} });
      }

      /* --- 子渲染：绑定输入框事件 --- */
      function _chatDetail_bindInput(body, contactId){
        const input = body.querySelector('[data-ph="chatInput"]');
        if (!input) return;
        input.addEventListener('keydown',(e)=>{
          if (e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); _wxSendChat(contactId); }
        });
        input.addEventListener('click', ()=>{ try{input.focus();}catch(e){} });
        input.addEventListener('touchend', (e)=>{ e.stopPropagation(); try{input.focus();}catch(e){} });
        setTimeout(()=>{ try{input.focus();}catch(e){} }, 150);
      }

      /* --- 子渲染：语音面板（模拟按住录音） --- */
      function _chatDetail_toggleVoice(){
        const vp = root.querySelector('[data-ph="voicePanel"]');
        const sp = root.querySelector('[data-ph="stickerPanel"]');
        const pg = root.querySelector('[data-ph="chatPlusGrid"]');
        if (!vp) return;
        // 互斥：关闭其他面板
        if (sp) sp.classList.remove('show');
        if (pg) pg.style.display = 'none';
        const isOpen = vp.classList.contains('show');
        if (isOpen){ vp.classList.remove('show'); return; }
        // 渲染语音面板内容
        const npcId = state.chatTarget;
        vp.innerHTML = `<button class="wxVoiceHoldBtn" data-ph="voiceHoldBtn">按住 说话</button>
          <div style="font-size:11px;color:rgba(20,24,28,.35);margin-top:8px;">松开后将发送语音消息（模拟）</div>`;
        vp.classList.add('show');

        // 模拟按住录音交互
        const btn = vp.querySelector('[data-ph="voiceHoldBtn"]');
        if (!btn) return;
        let timer = null;
        let startTs = 0;
        const onDown = (e) => {
          e.preventDefault();
          btn.classList.add('recording');
          btn.textContent = '松开 发送';
          startTs = Date.now();
        };
        const onUp = (e) => {
          e.preventDefault();
          btn.classList.remove('recording');
          btn.textContent = '按住 说话';
          const dur = Math.max(1, Math.round((Date.now() - startTs) / 1000));
          if (dur < 1) return;
          if (!npcId) return;
          // 发送语音消息气泡
          const durStr = dur >= 60 ? `${Math.floor(dur/60)}′${dur%60}″` : `${dur}″`;
          _cpSendSpecial(npcId, `[语音消息] ${durStr}`, {
            type:'text', _logText:`[语音消息] ${durStr}`
          });
          vp.classList.remove('show');
          // NPC 语音回复用 AI（fallback mock）
          setTimeout(()=>{
            _aiReplyForSpecial(npcId, ['收到你的语音啦~ 🎧','嗯嗯听到了！','你的声音好好听～','语音已读~']);
          }, 600 + Math.random()*500);
        };
        btn.addEventListener('mousedown', onDown);
        btn.addEventListener('mouseup', onUp);
        btn.addEventListener('mouseleave', (e)=>{ if(btn.classList.contains('recording')) onUp(e); });
        btn.addEventListener('touchstart', onDown, {passive:false});
        btn.addEventListener('touchend', onUp, {passive:false});
      }

      /* --- 子渲染：表情面板（联动"我的"表情包数据） --- */
      function _chatDetail_toggleSticker(){
        const sp = root.querySelector('[data-ph="stickerPanel"]');
        const vp = root.querySelector('[data-ph="voicePanel"]');
        const pg = root.querySelector('[data-ph="chatPlusGrid"]');
        if (!sp) return;
        if (vp) vp.classList.remove('show');
        if (pg) pg.style.display = 'none';
        const isOpen = sp.classList.contains('show');
        if (isOpen){ sp.classList.remove('show'); return; }
        _chatDetail_renderStickerContent(sp);
        sp.classList.add('show');
      }

      function _chatDetail_renderStickerContent(sp){
        const npcId = state.chatTarget;
        // 读取"我的"表情包数据（与"我→表情"页面共享同一数据源）
        const packs = _loadStickerPacks();
        const userStickers = _safeArr(packs.user);
        const charStickers = _safeArr(packs.char);
        const allCustom = userStickers.concat(charStickers);
        // 默认 emoji 表情
        const defaultEmojis = ['😊','😂','🥺','😭','😍','🥰','😘','😜','🤔','😅',
          '😎','🤩','😇','🙃','😋','😤','😱','🤗','💕','❤️',
          '👍','👏','✌️','🎉','🔥','✨','💪','🙈','🐱','🌸'];

        let html = `<div class="wxStickerTabs">
          <button class="wxStkTab on" data-act="wxStkTab" data-stktab="emoji">Emoji</button>
          <button class="wxStkTab" data-act="wxStkTab" data-stktab="custom">我的${allCustom.length ? '('+allCustom.length+')' : ''}</button>
        </div>`;
        // Emoji tab
        html += `<div class="wxStkTabContent" data-ph="stkTabEmoji">
          <div class="wxStickerGrid">`;
        defaultEmojis.forEach((em, i) => {
          html += `<div class="wxStkItem" data-act="wxStickerSend" data-stktype="emoji" data-stkval="${esc(em)}">${em}</div>`;
        });
        html += `</div></div>`;
        // Custom sticker tab — 读取 sticker packs（user + char）
        html += `<div class="wxStkTabContent" data-ph="stkTabCustom" style="display:none;">`;
        if (allCustom.length){
          html += `<div class="wxStickerGrid">`;
          allCustom.forEach((stk, i) => {
            var imgSrc = stk.data || '';
            // 跳过 idb: 残留引用
            if (imgSrc.indexOf('idb:') === 0) imgSrc = '';
            if (imgSrc){
              html += `<div class="wxStkItem" data-act="wxStickerSend" data-stktype="sticker" data-stkidx="${i}"><img src="${esc(imgSrc)}" style="width:100%;height:100%;object-fit:contain;border-radius:6px;" onerror="this.style.display='none'"/></div>`;
            }
          });
          html += `</div>`;
        } else {
          html += `<div style="padding:20px;text-align:center;font-size:12px;color:rgba(20,24,28,.35);">
            暂无自定义表情<br>
            <span style="font-size:11px;">去「我 → 表情」上传表情包图片</span>
          </div>`;
        }
        html += `</div>`;
        sp.innerHTML = html;
      }

      function _chatDetail_switchStkTab(tab){
        const emojiC = root.querySelector('[data-ph="stkTabEmoji"]');
        const customC = root.querySelector('[data-ph="stkTabCustom"]');
        root.querySelectorAll('.wxStkTab').forEach(t => t.classList.toggle('on', t.getAttribute('data-stktab')===tab));
        if (emojiC) emojiC.style.display = (tab==='emoji') ? '' : 'none';
        if (customC) customC.style.display = (tab==='custom') ? '' : 'none';
      }

      function _chatDetail_sendSticker(el){
        const npcId = state.chatTarget;
        if (!npcId) return;
        const stkType = el.getAttribute('data-stktype');
        if (stkType === 'emoji'){
          const emoji = el.getAttribute('data-stkval') || '😊';
          const input = root.querySelector('[data-ph="chatInput"]');
          if (input){ input.value += emoji; input.focus(); }
        } else if (stkType === 'sticker'){
          // 从 sticker packs 获取图片
          var idx = parseInt(el.getAttribute('data-stkidx'));
          var packs = _loadStickerPacks();
          var allCustom = _safeArr(packs.user).concat(_safeArr(packs.char));
          var stk = allCustom[idx];
          var src = stk && stk.data || '';
          if (!src || src.indexOf('idb:') === 0) return;
          _cpSendSpecial(npcId, '[表情包]', { type:'image', src:src, _logText:'[表情包]' });
          const sp = root.querySelector('[data-ph="stickerPanel"]');
          if (sp) sp.classList.remove('show');
          setTimeout(()=>{
            _aiReplyForSpecial(npcId, ['哈哈哈这个表情好可爱！😆','笑死我了 🤣','这个表情包太绝了','收藏了！']);
          }, 600 + Math.random()*500);
        }
      }

      /* --- 子渲染：角色设置页 --- */
      function _renderCharSettingsPage(contactId){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        const db = loadContactsDB();
        const npc = findContactById(db, contactId) || { id:contactId, name:String(contactId), avatar:String(contactId).charAt(0), profile:'' };
        const charEx = _loadCharExtra(contactId);

        // 标题
        try{
          const titleEl = root.querySelector('[data-ph="appTitle"]');
          if (titleEl) titleEl.textContent = '聊天设置';
        }catch(e){}
        // 清空 spacer
        try{ const sp = root.querySelector('.phAppBarSpacer'); if(sp) sp.innerHTML=''; }catch(e){}

        let html = `<div class="wxCharSettingsWrap">
          <div class="wxCSHeader">
            <div class="wxCSAvatar">${esc(npc.avatar || npc.name.charAt(0))}</div>
            <div class="wxCSInfo">
              <div class="wxCSNickname">${esc(npc.name)}</div>
              <div class="wxCSProfile">${esc((npc.profile||charEx.profile||'').slice(0,80) || '暂无简介')}</div>
            </div>
          </div>
          <div class="wxCSGroup">
            <div class="wxCSItem" data-act="wxCSNav" data-cspage="charProfile" data-npcid="${esc(contactId)}">
              <div class="wxCSIco">📝</div>
              <div class="wxCSName">角色设定</div>
              <div class="wxCSArrow">›</div>
            </div>
            <div class="wxCSItem" data-act="wxCSNav" data-cspage="chatBg" data-npcid="${esc(contactId)}">
              <div class="wxCSIco">🖼️</div>
              <div class="wxCSName">聊天背景</div>
              <div class="wxCSArrow">›</div>
            </div>
          </div>
          <div class="wxCSGroup">
            <div class="wxCSItem" data-act="wxCSNav" data-cspage="reminders" data-npcid="${esc(contactId)}">
              <div class="wxCSIco">⏰</div>
              <div class="wxCSName">提醒设定</div>
              <div class="wxCSArrow">›</div>
            </div>
            <div class="wxCSItem" data-act="wxCSNav" data-cspage="pokeSettings" data-npcid="${esc(contactId)}">
              <div class="wxCSIco">👆</div>
              <div class="wxCSName">戳一戳设置</div>
              <div class="wxCSArrow">›</div>
            </div>
            <div class="wxCSItem" style="flex-direction:column;align-items:stretch;gap:0;">
              <div style="display:flex;align-items:center;width:100%;" data-act="wxCSSumExpand" data-npcid="${esc(contactId)}">
                <div class="wxCSIco">📋</div>
                <div class="wxCSName">聊天自动总结</div>
                <div style="margin-left:auto;display:flex;align-items:center;gap:6px;">
                  <button class="wxReminderToggle ${charEx.autoSummary?'on':'off'}" data-act="wxCSToggleAutoSum" data-npcid="${esc(contactId)}"></button>
                  <span data-el="sumExpandArrow" style="font-size:14px;color:rgba(20,24,28,.3);transition:transform .2s;">▼</span>
                </div>
              </div>
              <div data-el="sumExpandArea" style="display:none;padding:10px 0 4px 0;border-top:1px solid rgba(0,0,0,.04);margin-top:8px;">
                <div style="font-size:11px;color:rgba(20,24,28,.45);margin-bottom:6px;">自定义总结提示词：</div>
                <textarea data-el="sumCustomPrompt" data-npcid="${esc(contactId)}" placeholder="留空则使用全局默认提示词" rows="3" style="width:100%;padding:8px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:12px;outline:none;resize:vertical;font-family:inherit;line-height:1.5;box-sizing:border-box;background:rgba(255,255,255,.6);">${esc((getChatSummary(contactId)||{}).customPrompt||'')}</textarea>
                <div style="margin-top:10px;">
                  <button data-act="wxCSGenSummary" data-npcid="${esc(contactId)}" style="width:100%;padding:10px;border-radius:10px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">立即生成总结</button>
                </div>
                <div style="margin-top:10px;">
                  <div style="font-size:11px;color:rgba(20,24,28,.45);margin-bottom:6px;">最近总结：</div>
                  <div data-el="sumPreview" style="min-height:40px;max-height:200px;overflow-y:auto;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.02);font-size:12px;line-height:1.6;color:rgba(20,24,28,.7);white-space:pre-wrap;word-break:break-all;">${esc((getChatSummary(contactId)||{}).summaryText||'暂无总结')}</div>
                  ${(getChatSummary(contactId)||{}).updatedAt ? '<div style="font-size:10px;color:rgba(20,24,28,.3);margin-top:4px;">生成时间：'+new Date((getChatSummary(contactId)||{}).updatedAt).toLocaleString()+'</div>' : ''}
                  ${(getChatSummary(contactId)||{}).summaryText ? '<button data-act="wxCSCopySummary" data-npcid="'+esc(contactId)+'" style="margin-top:6px;padding:6px 14px;border-radius:8px;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.9);font-size:11px;color:rgba(20,24,28,.6);cursor:pointer;">📋 复制总结</button>' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>`;
        body.innerHTML = html;
        // 自定义提示词失焦自动保存
        try{
          const promptInp = body.querySelector('[data-el="sumCustomPrompt"]');
          if (promptInp){
            promptInp.addEventListener('blur', ()=>{
              const nid = promptInp.getAttribute('data-npcid') || contactId;
              const existing = getChatSummary(nid) || {};
              existing.customPrompt = String(promptInp.value||'').trim();
              saveChatSummary(nid, existing);
            });
          }
        }catch(e){}
      }

      /* --- 子渲染：角色设定编辑页 --- */
      function _renderCharProfileEdit(contactId){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        const db = loadContactsDB();
        const npc = findContactById(db, contactId) || { id:contactId, name:String(contactId), avatar:String(contactId).charAt(0), profile:'' };
        const charEx = _loadCharExtra(contactId);
        const mergedProfile = npc.profile || charEx.profile || '';

        try{ const t = root.querySelector('[data-ph="appTitle"]'); if(t) t.textContent='角色设定'; }catch(e){}
        try{ const sp = root.querySelector('.phAppBarSpacer'); if(sp) sp.innerHTML=''; }catch(e){}

        let html = `<div style="padding:14px;">
          <div style="margin-top:10px;">
            <label style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:6px;display:block;">角色名</label>
            <input data-el="csName" value="${esc(npc.name)}" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;" />
          </div>
          <div style="margin-top:14px;">
            <label style="font-size:12px;color:rgba(20,24,28,.5);margin-bottom:6px;display:block;">角色简介 / 设定</label>
            <textarea data-el="csProfile" rows="6" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:13px;outline:none;resize:vertical;font-family:inherit;line-height:1.5;box-sizing:border-box;">${esc(mergedProfile)}</textarea>
          </div>
          <div style="margin-top:14px;display:flex;gap:8px;">
            <button data-act="wxCSSaveProfile" data-npcid="${esc(contactId)}" style="flex:1;padding:12px;border-radius:12px;border:0;background:#07c160;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">保存</button>
            <button data-act="wxCSBack" data-npcid="${esc(contactId)}" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.7);font-size:14px;cursor:pointer;">取消</button>
          </div>
        </div>`;
        body.innerHTML = html;
      }

      /* --- 子渲染：聊天背景设置 --- */
      function _renderChatBgSettings(contactId){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        const charEx = _loadCharExtra(contactId);

        try{ const t = root.querySelector('[data-ph="appTitle"]'); if(t) t.textContent='聊天背景'; }catch(e){}
        try{ const sp = root.querySelector('.phAppBarSpacer'); if(sp) sp.innerHTML=''; }catch(e){}

        let html = `<div style="padding:14px;">
          <div style="margin-top:12px;text-align:center;">
            <div style="width:120px;height:200px;margin:0 auto;border-radius:12px;border:1px solid rgba(0,0,0,.1);overflow:hidden;background:#f5f5f5;display:flex;align-items:center;justify-content:center;">
              ${charEx.chatBg ? '<img src="'+esc(charEx.chatBg)+'" style="width:100%;height:100%;object-fit:cover;" />' : '<span style="font-size:36px;opacity:.3;">🖼</span>'}
            </div>
            <div style="font-size:11px;color:rgba(20,24,28,.35);margin-top:8px;">当前聊天背景预览</div>
          </div>
          <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">
            <button data-act="wxCSUploadBg" data-npcid="${esc(contactId)}" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:13px;cursor:pointer;">📤 从相册选取 / 上传图片</button>
            <button data-act="wxCSPickBgAlbum" data-npcid="${esc(contactId)}" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:13px;cursor:pointer;">🖼 从「壁纸」相册选取</button>
            ${charEx.chatBg ? '<button data-act="wxCSClearBg" data-npcid="'+esc(contactId)+'" style="width:100%;padding:12px;border-radius:12px;border:1px solid rgba(244,67,54,.15);background:rgba(244,67,54,.04);color:#f44336;font-size:13px;cursor:pointer;">🗑 移除背景</button>' : ''}
          </div>
        </div>`;
        body.innerHTML = html;
      }

      /* --- 子渲染：提醒设定页 --- */
      function _renderRemindersPage(contactId){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        const reminders = _loadReminders(contactId);

        try{ const t = root.querySelector('[data-ph="appTitle"]'); if(t) t.textContent='提醒设定'; }catch(e){}
        try{
          const sp = root.querySelector('.phAppBarSpacer');
          if(sp) sp.innerHTML=`<button data-act="wxReminderAdd" data-npcid="${esc(contactId)}" style="font-size:20px;width:32px;height:32px;border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(20,24,28,.7);">+</button>`;
        }catch(e){}

        const presets = [
          {ico:'🌅',name:'早安提醒',time:'08:00'},
          {ico:'🌙',name:'晚安提醒',time:'22:00'},
          {ico:'🩸',name:'经期提醒',time:'每月'},
          {ico:'📌',name:'自定义提醒',time:'自定义'},
        ];

        let html = `<div style="padding:0;">
          <div style="padding:8px 10px;">
            <div style="font-size:12px;color:rgba(20,24,28,.4);margin-bottom:8px;">快捷添加</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">`;
        presets.forEach(p=>{
          html += `<button data-act="wxReminderQuickAdd" data-npcid="${esc(contactId)}" data-rname="${esc(p.name)}" data-rtime="${esc(p.time)}" data-rico="${esc(p.ico)}" style="padding:8px 14px;border-radius:20px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;">${p.ico} ${p.name}</button>`;
        });
        html += `</div></div>
          <div class="wxReminderList">`;
        if (!reminders.length){
          html += `<div style="padding:30px 14px;text-align:center;font-size:12px;color:rgba(20,24,28,.3);">暂无提醒<br>点击上方快捷按钮或 + 号添加</div>`;
        } else {
          reminders.forEach((r, i)=>{
            html += `<div class="wxReminderItem">
              <div class="wxRIco">${esc(r.ico||'⏰')}</div>
              <div class="wxRInfo">
                <div class="wxRName">${esc(r.name||'提醒')}</div>
                <div class="wxRTime">${esc(r.time||'--')}</div>
              </div>
              <button class="wxReminderToggle ${r.enabled!==false?'on':'off'}" data-act="wxReminderToggleItem" data-npcid="${esc(contactId)}" data-ridx="${i}"></button>
              <button class="wxRDel" data-act="wxReminderDel" data-npcid="${esc(contactId)}" data-ridx="${i}">✕</button>
            </div>`;
          });
        }
        html += `</div></div>`;
        body.innerHTML = html;
      }

      // ====== 阶段B：戳一戳设置页 ======
      function _renderPokeSettingsPage(contactId){
        var body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        var ps = _loadPokeSettings(contactId);

        try{ var t = root.querySelector('[data-ph="appTitle"]'); if(t) t.textContent='戳一戳设置'; }catch(e){}
        try{ var sp = root.querySelector('.phAppBarSpacer'); if(sp) sp.innerHTML=''; }catch(e){}

        var html = '<div class="wxPokeSettingsWrap">';
        html += '<div class="wxPSGroup">';
        html += '<div class="wxPSRow"><span class="wxPSLabel">启用戳一戳</span><button class="wxReminderToggle '+(ps.enabled?'on':'off')+'" data-act="wxPSToggle" data-pskey="enabled" data-npcid="'+esc(contactId)+'"></button></div>';
        html += '<div class="wxPSRow"><span class="wxPSLabel">AI 自动回戳</span><button class="wxReminderToggle '+(ps.aiAutoPoke?'on':'off')+'" data-act="wxPSToggle" data-pskey="aiAutoPoke" data-npcid="'+esc(contactId)+'"></button></div>';
        html += '<div class="wxPSRow"><span class="wxPSLabel">回戳冷却时间</span><select data-act="wxPSSelect" data-pskey="pokeCooldownMin" data-npcid="'+esc(contactId)+'">';
        [15,30,60].forEach(function(v){ html += '<option value="'+v+'"'+(ps.pokeCooldownMin===v?' selected':'')+'>'+v+'分钟</option>'; });
        html += '</select></div>';
        html += '<div class="wxPSRow"><span class="wxPSLabel">AI 自动戳一戳概率</span><select data-act="wxPSSelect" data-pskey="aiPokeChance" data-npcid="'+esc(contactId)+'">';
        [{v:0,l:'关闭'},{v:0.03,l:'3%'},{v:0.05,l:'5%'},{v:0.08,l:'8%'}].forEach(function(o){ html += '<option value="'+o.v+'"'+(ps.aiPokeChance===o.v?' selected':'')+'>'+o.l+'</option>'; });
        html += '</select></div>';
        html += '</div>';

        html += '<div class="wxPSGroup">';
        html += '<div class="wxPSRow"><span class="wxPSLabel">AI 偶尔引用我的消息</span><button class="wxReminderToggle '+(ps.aiQuoteEnabled?'on':'off')+'" data-act="wxPSToggle" data-pskey="aiQuoteEnabled" data-npcid="'+esc(contactId)+'"></button></div>';
        html += '<div class="wxPSRow"><span class="wxPSLabel">引用概率</span><select data-act="wxPSSelect" data-pskey="aiQuoteChance" data-npcid="'+esc(contactId)+'">';
        [{v:0.10,l:'10%'},{v:0.15,l:'15%'},{v:0.20,l:'20%'}].forEach(function(o){ html += '<option value="'+o.v+'"'+(ps.aiQuoteChance===o.v?' selected':'')+'>'+o.l+'</option>'; });
        html += '</select></div>';
        html += '</div>';

        html += '<div style="padding:12px 16px;font-size:11px;color:rgba(20,24,28,.35);line-height:1.5;">提示：戳一戳和引用由前端概率控制，不依赖 AI 输出。冷却时间防止 AI 频繁戳你。</div>';
        html += '</div>';

        body.innerHTML = html;

        // 绑定 select change 事件
        body.querySelectorAll('[data-act="wxPSSelect"]').forEach(function(sel){
          sel.addEventListener('change', function(){
            var psKey = sel.getAttribute('data-pskey');
            var psNid = sel.getAttribute('data-npcid') || contactId;
            if (psKey && psNid){
              var ps = _loadPokeSettings(psNid);
              ps[psKey] = parseFloat(sel.value);
              _savePokeSettings(psNid, ps);
              try{ toast('已保存'); }catch(e){}
            }
          });
        });
      }

      /* --- 自定义提醒弹窗 --- */
      function _wxReminderCustomAdd(npcId){
        const innerHtml = `
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;">添加自定义提醒</div>
          <div style="margin-bottom:10px;">
            <label style="font-size:11px;color:rgba(20,24,28,.5);">提醒名称</label>
            <input data-el="rName" placeholder="如：纪念日提醒" style="width:100%;padding:8px 10px;border:1px solid rgba(0,0,0,.1);border-radius:8px;font-size:13px;margin-top:4px;outline:none;box-sizing:border-box;" />
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:11px;color:rgba(20,24,28,.5);">时间</label>
            <input data-el="rTime" type="time" style="width:100%;padding:8px 10px;border:1px solid rgba(0,0,0,.1);border-radius:8px;font-size:13px;margin-top:4px;outline:none;box-sizing:border-box;" />
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:11px;color:rgba(20,24,28,.5);">图标</label>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;" data-el="rIcoPicker">
              ${['⏰','🌅','🌙','🩸','💊','📌','🎂','❤️','📝','🏃'].map(e=>`<span data-ico="${e}" style="cursor:pointer;font-size:22px;padding:4px;border-radius:6px;border:2px solid transparent;" class="rIcoPick">${e}</span>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:14px;">
            <button data-el="rSave" style="flex:1;padding:10px;border-radius:10px;border:0;background:#07c160;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">添加</button>
            <button data-el="rCancel" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,.1);background:#fff;color:rgba(20,24,28,.7);font-size:13px;cursor:pointer;">取消</button>
          </div>`;
        const ov = _cpShowOverlay(innerHtml);
        let pickedIco = '⏰';
        ov.querySelectorAll('.rIcoPick').forEach(el=>{
          el.addEventListener('click', ()=>{
            ov.querySelectorAll('.rIcoPick').forEach(x=>x.style.borderColor='transparent');
            el.style.borderColor = '#07c160';
            pickedIco = el.getAttribute('data-ico') || '⏰';
          });
        });
        const saveBtn = ov.querySelector('[data-el="rSave"]');
        const cancelBtn = ov.querySelector('[data-el="rCancel"]');
        if (cancelBtn) cancelBtn.addEventListener('click', ()=> ov.remove());
        if (saveBtn) saveBtn.addEventListener('click', ()=>{
          const nameInp = ov.querySelector('[data-el="rName"]');
          const timeInp = ov.querySelector('[data-el="rTime"]');
          const name = String(nameInp?.value||'').trim() || '自定义提醒';
          const time = String(timeInp?.value||'').trim() || '未设定';
          const list = _loadReminders(npcId);
          list.push({ ico:pickedIco, name:name, time:time, enabled:true });
          _saveReminders(npcId, list);
          ov.remove();
          try{toast(`已添加「${name}」`);}catch(e){}
          _renderRemindersPage(npcId);
        });
      }

      function _wxAppendBubble(msgs, npc, role, text, ts, meta, flags){
        // flags: { edited:bool, recalled:bool }
        var fl = flags || {};
        const b = doc.createElement('div');

        // 阶段B：系统消息（戳一戳等）
        if (role === 'system'){
          var sysText = String(text || '');
          if (sysText.startsWith('[戳一戳]')){
            var pokeDisplay = sysText.replace('[戳一戳] ', '');
            b.className = 'wxChatBubble system wxPokeBubble';
            b.setAttribute('data-msgts', String(ts||0));
            b.setAttribute('data-msgrole', 'system');
            b.innerHTML = '<div class="wxPokeMsg">── ' + esc(pokeDisplay) + ' ──</div>';
            msgs.appendChild(b);
            return;
          }
          // 其他系统消息（通用）
          b.className = 'wxChatBubble system wxPokeBubble';
          b.setAttribute('data-msgts', String(ts||0));
          b.setAttribute('data-msgrole', 'system');
          b.innerHTML = '<div class="wxPokeMsg">── ' + esc(sysText) + ' ──</div>';
          msgs.appendChild(b);
          return;
        }

        // 撤回消息：特殊渲染
        if (fl.recalled){
          b.className = 'wxChatBubble ' + role + ' wxRecalledBubble';
          b.setAttribute('data-msgts', String(ts||0));
          b.setAttribute('data-msgrole', role);
          b.setAttribute('data-msgtext', '');
          var who = (role === 'me') ? '你' : (npc.name || '对方');
          b.innerHTML = '<div class="wxCBRecalled">' + esc(who) + ' 撤回了一条消息</div>';
          msgs.appendChild(b);
          return;
        }

        b.className = `wxChatBubble ${role}`;
        b.setAttribute('data-msgts', String(ts||0));
        b.setAttribute('data-msgrole', role);
        b.setAttribute('data-msgtext', String(text||''));
        if (fl.edited) b.setAttribute('data-msgedited', '1');
        const avatar = (role==='me') ? '👤' : (npc.avatar || (npc.name||'?').charAt(0));
        const mt = (meta && meta.type) || 'text';
        let contentHtml = '';
        let editedTag = fl.edited ? '<span class="wxCBEdited">已编辑</span>' : '';
        if (mt === 'image'){
          contentHtml = `<div class="wxCBContent wxCBSpecial" style="padding:4px;">
            <img src="${esc(meta.src||'')}" style="max-width:160px;max-height:160px;border-radius:8px;display:block;" onerror="this.outerHTML='<div style=\\'padding:8px;color:#999;\\'>图片加载失败</div>'"/>
            ${editedTag}
          </div>`;
        } else if (mt === 'location'){
          contentHtml = `<div class="wxCBContent wxCBSpecial" style="padding:8px 10px;min-width:140px;">
            <div style="font-size:12px;font-weight:600;margin-bottom:4px;">📍 位置分享</div>
            <div style="font-size:11px;color:rgba(20,24,28,.5);">${esc(meta.locName||'未知位置')}</div>
            <div style="margin-top:6px;height:60px;background:linear-gradient(135deg,#e8f5e9,#c8e6c9);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:20px;">🗺️</div>
            ${editedTag}
          </div>`;
        } else if (mt === 'redpack'){
          contentHtml = `<div class="wxCBContent wxCBSpecial" style="padding:0;overflow:hidden;border-radius:10px;min-width:180px;">
            <div style="background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;padding:12px 14px;">
              <div style="font-size:13px;font-weight:600;">🧧 红包</div>
              <div style="font-size:11px;opacity:.85;margin-top:2px;">${esc(meta.greeting||'恭喜发财')}</div>
            </div>
            <div style="padding:6px 14px;font-size:11px;color:rgba(20,24,28,.35);background:rgba(255,255,255,.9);">${esc(meta.amount||0)} 金币</div>
          </div>`;
        } else if (mt === 'gift'){
          contentHtml = `<div class="wxCBContent wxCBSpecial" style="padding:10px 14px;text-align:center;min-width:140px;">
            <div style="font-size:28px;">${meta.giftEmoji||'🎁'}</div>
            <div style="font-size:12px;font-weight:600;margin-top:4px;">${esc(meta.giftName||'礼物')}</div>
            <div style="font-size:10.5px;color:rgba(20,24,28,.4);margin-top:2px;">${esc(meta.amount||0)} 金币</div>
          </div>`;
        } else if (mt === 'transfer'){
          contentHtml = `<div class="wxCBContent wxCBSpecial" style="padding:0;overflow:hidden;border-radius:10px;min-width:180px;">
            <div style="background:linear-gradient(135deg,#f39c12,#e67e22);color:#fff;padding:12px 14px;">
              <div style="font-size:13px;font-weight:600;">💰 转账</div>
              <div style="font-size:18px;font-weight:700;margin-top:4px;">${esc(meta.amount||0)} 金币</div>
            </div>
            <div style="padding:6px 14px;font-size:11px;color:rgba(20,24,28,.35);background:rgba(255,255,255,.9);">${esc(meta.note||'转账')}</div>
          </div>`;
        } else if (mt === 'music'){
          contentHtml = `<div class="wxCBContent wxCBSpecial" style="padding:10px 14px;min-width:180px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:40px;height:40px;border-radius:8px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;">🎵</div>
              <div>
                <div style="font-size:12px;font-weight:600;">${esc(meta.songName||'未知歌曲')}</div>
                <div style="font-size:10.5px;color:rgba(20,24,28,.4);">${esc(meta.artist||'未知歌手')}</div>
              </div>
            </div>
            <div style="margin-top:6px;font-size:10.5px;color:rgba(20,24,28,.4);">邀请你一起听 🎧</div>
          </div>`;
        } else if (mt === 'videocall'){
          const callType = meta.callType || 'video';
          contentHtml = `<div class="wxCBContent wxCBSpecial" style="padding:10px 14px;min-width:160px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="font-size:18px;">${callType==='video'?'📹':'📞'}</div>
              <div>
                <div style="font-size:12px;font-weight:600;">${callType==='video'?'视频通话':'语音通话'}</div>
                <div style="font-size:10.5px;color:rgba(20,24,28,.4);">${esc(meta.duration||'通话结束')}</div>
              </div>
            </div>
          </div>`;
        } else {
          contentHtml = `<div class="wxCBContent">${esc(text)}${editedTag}</div>`;
        }
        b.innerHTML = `<div class="wxCBAvatar">${esc(avatar)}</div>${contentHtml}`;
        msgs.appendChild(b);
      }

      // ===== 【PhoneAI 模块】新增 =====
      // 插入位置：在 _wxAppendBubble 之后、_wxSendChat 之前
      // ===== 开始 =====
      const PhoneAI = {
        _controller: null,
        _requesting: false,
        _replySeqId: 0,

        _getConfig: function(){
          try{
            var data = _loadApiPresets();
            var presets = data.presets || [];
            var activeId = data.activeId || '';
            var preset = presets.find(function(p){ return p.id === activeId; });
            // 容错：没有匹配 activeId 但有预设时，退回第一个
            if (!preset && presets.length > 0) preset = presets[0];
            if (!preset) return { endpoint:'', key:'', model:'', maxTokens:1024 };
            return {
              endpoint: String(preset.baseUrl || '').trim().replace(/\/+$/, ''),
              key: String(preset.apiKey || '').trim(),
              model: String(preset.model || '').trim(),
              maxTokens: 1024
            };
          }catch(e){
            return { endpoint:'', key:'', model:'', maxTokens:1024 };
          }
        },

        _buildHeaders: function(){
          var cfg = this._getConfig();
          var h = { 'Content-Type':'application/json' };
          if (cfg.key) h['Authorization'] = 'Bearer ' + cfg.key;
          return h;
        },

        _cachedChatUrl: '',  // 缓存已验证的聊天 URL

        // 生成多个候选 URL（兼容不同代理路由方式）
        _buildChatUrls: function(endpoint){
          var ep = String(endpoint || '').trim().replace(/\/+$/, '');
          if (!ep) return [];
          var candidates = [];
          var stripped = ep.replace(/\/v1$/i, '');
          // 优先用缓存
          if (this._cachedChatUrl) return [this._cachedChatUrl];
          if (/\/v1$/i.test(ep)){
            // 用户填了 /v1 结尾：
            candidates.push(ep + '/chat/completions');                 // https://xxx/v1/chat/completions
            candidates.push(stripped + '/chat/completions');           // https://xxx/chat/completions
            candidates.push(stripped + '/v1/chat/completions');        // 同 #1（去重后无影响）
          } else {
            candidates.push(ep + '/v1/chat/completions');             // https://xxx/v1/chat/completions
            candidates.push(ep + '/chat/completions');                // https://xxx/chat/completions
          }
          // 去重
          var seen = {}; var out = [];
          for (var i=0; i<candidates.length; i++){
            if (!seen[candidates[i]]){ seen[candidates[i]] = 1; out.push(candidates[i]); }
          }
          return out;
        },

        _request: async function(opts){
          var cfg = this._getConfig();
          if (!cfg.endpoint) return { ok:false, data:null, error:'请先配置 API' };
          if (!cfg.key) return { ok:false, data:null, error:'请先配置 API 密钥' };

          if (this._controller){
            try{ this._controller.abort(); }catch(e){}
          }
          this._controller = new AbortController();
          this._requesting = true;

          var timeoutMs = ((opts && opts.timeout) || 30) * 1000;
          var timer = setTimeout(function(){
            try{ PhoneAI._controller.abort(); }catch(e){}
          }, timeoutMs);

          try{
            var body = {
              model: cfg.model || 'gpt-4o-mini',
              messages: [],
              temperature: (opts && opts.temperature) || 0.85,
              max_tokens: (opts && opts.maxTokens) || cfg.maxTokens || 1024
            };
            if (opts && opts.system){
              body.messages.push({ role:'system', content:opts.system });
            }
            if (opts && Array.isArray(opts.messages)){
              for (var i=0; i<opts.messages.length; i++){
                body.messages.push(opts.messages[i]);
              }
            }

            var bodyStr = JSON.stringify(body);
            var headers = this._buildHeaders();
            var urls = this._buildChatUrls(cfg.endpoint);
            if (!urls.length) return { ok:false, data:null, error:'API 地址无效' };

            var lastStatus = 0;
            var lastErrorBody = '';

            for (var ui = 0; ui < urls.length; ui++){
              var url = urls[ui];
              try{
                void(0)&&console.log('[PhoneAI] 尝试:', url);
                var resp = await fetch(url, {
                  method: 'POST',
                  headers: headers,
                  body: bodyStr,
                  signal: this._controller.signal,
                  cache: 'no-store'
                });

                // 如果是 404 且还有其他候选 URL，继续尝试
                if (resp.status === 404 && ui < urls.length - 1){
                  void(0)&&console.log('[PhoneAI] 404:', url, '→ 尝试下一个候选');
                  continue;
                }

                clearTimeout(timer);

                if (!resp.ok){
                  lastStatus = resp.status;
                  try{ lastErrorBody = await resp.text(); }catch(e){ lastErrorBody = ''; }
                  console.warn('[PhoneAI] 请求失败:', resp.status, url, lastErrorBody.slice(0, 200));
                  if (resp.status === 401 || resp.status === 403) return { ok:false, data:null, error:'API 密钥无效，请检查 API 设置' };
                  if (resp.status === 429) return { ok:false, data:null, error:'请求太频繁，请稍后再试' };
                  if (resp.status >= 500) return { ok:false, data:null, error:'AI 服务异常，请重试' };
                  return { ok:false, data:null, error:'请求失败 ('+resp.status+')' };
                }

                // 成功！缓存这个 URL
                this._cachedChatUrl = url;
                void(0)&&console.log('[PhoneAI] ✅ 成功:', url);

                var json = await resp.json();
                var text = '';
                try{
                  text = json.choices[0].message.content || '';
                }catch(e){
                  // 兼容其他响应格式
                  try{ text = json.output_text || json.result || json.response || ''; }catch(e2){}
                }
                if (!text && json){
                  try{ text = JSON.stringify(json).slice(0, 500); }catch(e){}
                }
                // 阶段B修复：清除模型可能泄露的 thinking/think 标签
                text = String(text||'').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/<think>[\s\S]*?<\/think>/gi, '');
                text = text.replace(/<\/?thinking>/gi, '').replace(/<\/?think>/gi, '').trim();
                return { ok:true, data:text, error:null };

              }catch(e){
                // AbortError 直接返回
                if (e && e.name === 'AbortError'){
                  clearTimeout(timer);
                  return { ok:false, data:null, error:null };
                }
                // 网络错误且还有候选，继续
                if (ui < urls.length - 1){
                  void(0)&&console.log('[PhoneAI] 网络错误:', url, e.message, '→ 尝试下一个候选');
                  continue;
                }
                throw e; // 最后一个候选也失败，抛给外层 catch
              }
            }

            // 所有候选都失败
            clearTimeout(timer);
            return { ok:false, data:null, error:'所有 API 地址均失败 ('+lastStatus+')' };

          }catch(e){
            clearTimeout(timer);
            if (e && e.name === 'AbortError') return { ok:false, data:null, error:null };
            var msg = String((e && e.message) || '');
            console.error('[PhoneAI] 异常:', msg);
            if (msg.indexOf('timeout') >= 0 || msg.indexOf('Timeout') >= 0) return { ok:false, data:null, error:'请求超时，请重试' };
            return { ok:false, data:null, error:'网络连接失败，请检查网络' };
          }finally{
            this._requesting = false;
          }
        },

        chat: async function(opts){
          return this._request({
            messages: (opts && opts.messages) || [],
            system: (opts && opts.system) || '',
            temperature: 0.85,
            maxTokens: 1024,
            timeout: 30
          });
        },

        // 后续扩展（本次不实现，只预留方法签名）
        summarizeChat: async function(opts){
          // opts: { messages (array of {role,content}), customPrompt (string) }
          var messages = (opts && opts.messages) || [];
          var customPrompt = (opts && opts.customPrompt) || '';
          if (!messages.length) return { ok:false, data:null, error:'无消息可总结' };

          // 构建 system prompt
          var sysPrompt = _BUILTIN_SUMMARY_PROMPT;
          if (customPrompt && customPrompt.trim()){
            sysPrompt += '\n\n【用户补充要求】\n' + customPrompt.trim();
          }

          // 构建 user message（聊天记录文本）
          var chatText = '';
          for (var i=0; i<messages.length; i++){
            var m = messages[i];
            chatText += (m.role === 'user' ? '用户' : (m.name || '角色')) + ': ' + (m.content || '') + '\n';
          }

          // 获取全局总结设置中的模型
          var globalSettings = null;
          try{ globalSettings = getGlobalSummarySettings(); }catch(e){}
          var overrideModel = (globalSettings && globalSettings.defaultModel) ? globalSettings.defaultModel.trim() : '';

          // 构建请求选项
          var reqOpts = {
            system: sysPrompt,
            messages: [{ role:'user', content: chatText.trim() }],
            temperature: 0.3,
            maxTokens: 1000,
            timeout: 60
          };

          // 如果有指定模型，临时覆盖 _getConfig 的 model
          var origGetConfig = this._getConfig;
          if (overrideModel){
            var self = this;
            this._getConfig = function(){
              var cfg = origGetConfig.call(self);
              cfg.model = overrideModel;
              return cfg;
            };
          }

          try{
            var result = await this._request(reqOpts);
            return result;
          }finally{
            // 恢复原始 _getConfig
            if (overrideModel) this._getConfig = origGetConfig;
          }
        },
        generateMoment: async function(){ return { ok:false, data:null, error:'功能开发中' }; },
        extractWorldbook: async function(){ return { ok:false, data:null, error:'功能开发中' }; },
        extractRelations: async function(){ return { ok:false, data:null, error:'功能开发中' }; },

        generateFeed: async function(opts){
          var context   = (opts&&opts.context)||'';
          var targets   = (opts&&opts.targets)||['forum','browser','moments'];
          var appConfigs= (opts&&opts.appConfigs)||{};
          var retryClean= !!(opts&&opts.retryClean);

          var sysPrompt = '你是 MEOW Phone 的"世界观资讯生成引擎"。\n基于提供的世界观设定、聊天总结、角色信息，为以下 App 生成虚拟资讯内容。\n\n【核心原则】\n1. 所有内容必须基于提供的世界观和角色关系，不允许生成现实世界新闻\n2. 内容要自然、有趣、符合世界观设定\n3. 朋友圈的发帖人只能是通讯录中的角色或"我"，不允许出现"系统公告""系统发帖"\n4. 论坛的发帖人可以是通讯录角色，也可以是 AI 基于世界观生成的合理 NPC\n5. 每条内容要有差异性——语气、长度、话题都要有变化\n\n【你必须返回纯 JSON，不要加任何其他文字、不要加 Markdown 代码块标记】\n';

          var reqParts = [];
          if(targets.indexOf('forum')>=0){
            var fc=appConfigs.forum||{}; var hc=fc.hotCount||5; var flc=fc.followCount||3;
            reqParts.push('论坛(forum): 热门'+hc+'条 + 关注'+flc+'条。每条必须包含字段：id(字符串), author(角色名字符串), avatar_hint(角色名首字), title(帖子标题), content(帖子内容50-200字), tag(热门|八卦|心情|生活|记录|交友), tab(hot或follow), likes(数字), comments_data(0-3条评论的数组,每项{name:评论者名,text:评论内容,likes:数字}), images(0-3个字符串的数组,每个字符串是对图片内容的简短描述如"夕阳""自拍",无图时为空数组[]), shares(数字), ts_hint(如X小时前)');
          }
          if(targets.indexOf('browser')>=0){
            var bc=appConfigs.browser||{}; var secs=bc.sections||{};
            var sd=[];
            for(var sk in secs){ if(secs[sk]&&secs[sk].enabled!==false) sd.push((secs[sk].label||sk)+'(category='+sk+'):'+secs[sk].count+'条'); }
            if(sd.length) reqParts.push('浏览器(browser): '+sd.join(', ')+'。每条必须包含字段：id(字符串), title(标题), desc(摘要30-80字), category(worldNews|npcIntel|wikiEntry|funStuff), url_hint(如meow://xxx)');
          }
          if(targets.indexOf('moments')>=0){
            var mc=appConfigs.moments||{};
            reqParts.push('朋友圈(moments): '+(mc.generateCount||3)+'条。每条必须包含字段：id(字符串), name(角色名或我), avatar_hint(角色名首字), text(朋友圈文案10-150字), images(0-3个字符串的数组,每个字符串是对图片内容的简短描述如"美食""风景",随机一半帖子有图,无图时为空数组[]), likes(数字), comments_data(0-3条评论的数组,每项{name:评论者名,text:评论内容}), ts_hint(如X小时前)');
          }

          sysPrompt += '\n【生成要求】\n'+reqParts.join('\n')+'\n\n【返回格式】严格遵守以下 JSON 结构，只包含 targets 中指定的 App：\n{\n  "forum": [...],\n  "browser": [...],\n  "moments": [...]\n}\n';

          targets.forEach(function(t){ var cp=(appConfigs[t]||{}).customPrompt||''; if(cp&&cp.trim()) sysPrompt+='\n【'+t+' 额外要求】\n'+cp.trim()+'\n'; });
          if(retryClean) sysPrompt+='\n⚠️ 上次返回格式有误。请务必只返回纯 JSON，不要任何其他文字、不要 Markdown 代码块标记。\n';

          var overrideModel='';
          try{ var gs=getGlobalSummarySettings(); if(gs&&gs.defaultModel) overrideModel=gs.defaultModel.trim(); }catch(e){}
          var origGetConfig=this._getConfig;
          if(overrideModel){ var self=this; this._getConfig=function(){ var c=origGetConfig.call(self); c.model=overrideModel; return c; }; }

          try{
            var result=await this._request({ system:sysPrompt, messages:[{role:'user',content:context||'（无额外上下文，请基于你的知识生成有趣的世界观资讯内容）'}], temperature:0.9, maxTokens:2048, timeout:90 });
            if(!result.ok) return result;
            void(0)&&console.log('[PhoneAI.generateFeed] 原始返回:', String(result.data||'').substring(0,300));
            var parsed=_parseFeedJSON(result.data);
            if(!parsed){
              if(!retryClean){ if(overrideModel) this._getConfig=origGetConfig; return this.generateFeed({context:context,targets:targets,appConfigs:appConfigs,retryClean:true}); }
              return {ok:false,data:null,error:'AI 返回的 JSON 解析失败'};
            }
            return {ok:true,data:parsed,error:null};
          }finally{ if(overrideModel) this._getConfig=origGetConfig; }
        },

        abort: function(){
          if (this._controller){
            try{ this._controller.abort(); }catch(e){}
            this._controller = null;
          }
          this._requesting = false;
          this._replySeqId++;
        },

        destroy: function(){
          this.abort();
          this._cachedChatUrl = '';
        }
      };

      // ===== parseMultiMessages：解析 ||| 分隔的多条消息 =====
      function parseMultiMessages(responseText){
        var raw = String(responseText || '').trim();
        if (!raw) return [raw || '…'];
        // 阶段B修复：清除模型可能泄露的 <thinking>/<think> 标签及其内容
        raw = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
        raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
        // 清除未闭合的 thinking 标签（模型截断时可能出现）
        raw = raw.replace(/<\/?thinking>/gi, '');
        raw = raw.replace(/<\/?think>/gi, '');
        raw = raw.trim();
        if (!raw) return ['…'];
        var parts = raw.split('|||');
        var out = [];
        for (var i=0; i<parts.length; i++){
          var s = parts[i].trim();
          if (s.length > 0) out.push(s);
        }
        if (out.length === 0) out = [raw];
        if (out.length > 5) out = out.slice(0, 5);
        return out;
      }

      // ===== _convertSpecialTags：把特殊消息标记转为自然语言描述 =====
      function _convertSpecialTags(text){
        var s = String(text || '');
        s = s.replace(/\[红包[:：]([^\]]*)\]/g, '（用户发了一个红包，金额 $1）');
        s = s.replace(/\[礼物[:：]([^\]]*)\]/g, '（用户送了一个礼物：$1）');
        s = s.replace(/\[转账[:：]([^\]]*)\]/g, '（用户转账了 $1 元）');
        s = s.replace(/\[位置[:：]([^\]]*)\]/g, '（用户分享了位置：$1）');
        s = s.replace(/\[音乐[:：]([^\]]*)\]/g, '（用户分享了一首歌：$1）');
        s = s.replace(/\[图片\]/g, '（用户发了一张图片）');
        s = s.replace(/\[拍摄照片\]/g, '（用户拍了一张照片发过来）');
        s = s.replace(/\[语音消息\]\s*\d+[″′:]+\d*/g, '（用户发了一条语音消息）');
        s = s.replace(/\[视频通话\]\s*[^\n]*/g, '（进行了一次视频通话）');
        s = s.replace(/\[语音通话\]\s*[^\n]*/g, '（进行了一次语音通话）');
        return s;
      }

      // ===== getRecentMessages：获取最近 N 条消息，转为 API 格式 =====
      function _getRecentMessagesForAPI(npcId, n){
        var log = getLog(npcId);
        var tail = log.slice(Math.max(0, log.length - Math.max(1, n || 10)));
        var out = [];
        for (var i=0; i<tail.length; i++){
          var x = tail[i];
          // 阶段B: 过滤系统消息（戳一戳等）和撤回消息
          if (x.role === 'system') continue;
          if (x.recalled) continue;
          var role = (x.role === 'me') ? 'user' : 'assistant';
          var content = (role === 'user') ? _convertSpecialTags(x.text) : String(x.text || '');
          out.push({ role:role, content:content });
        }
        return out;
      }

      // ===== getChatSettingN：获取上下文条数设置（默认10） =====
      function _getChatContextN(){
        try{
          var cfg = phoneLoadSettings();
          var n = Number(cfg.chatContextN);
          if (n && n > 0 && n <= 50) return n;
        }catch(e){}
        return 10;
      }

      // ===== C2: 酒馆世界书内容缓存（因为读取是异步的，buildSystemPrompt 需要同步访问）=====
      var _tavernWBCache = { text: '', updatedAt: 0, chatUID: '' };

      async function _refreshTavernWBCache(){
        try{
          var chatUID = (typeof phoneGetChatUID === 'function') ? phoneGetChatUID() : '';
          var canW = await MEOW_WB_API.canWrite();
          if (!canW) return;
          var result = await MEOW_WB_API.listEntries();
          var all = result.all || [];
          var parts = [];
          for (var i = 0; i < all.length; i++){
            var entry = all[i];
            if (!entry || !entry.enabled) continue;
            var content = String(entry.content || '').trim();
            if (content && content.length > 5){
              parts.push(content);
            }
          }
          _tavernWBCache = {
            text: parts.join('\n\n').slice(0, 8000),
            updatedAt: Date.now(),
            chatUID: chatUID
          };
          void(0)&&console.log('[MEOW][C2] tavern WB cache refreshed, entries:', all.length, 'text length:', _tavernWBCache.text.length);
        }catch(e){
          console.warn('[MEOW][C2] tavern WB cache refresh error:', e);
        }
      }

      // 读取当前角色卡描述（同步，从 ST context 直接读取）
      function _readCurrentCharCardDesc(){
        try{
          var ctx = meowGetSTCtx();
          if (!ctx) return '';

          var desc = '';

          // 优先: ctx.characters[ctx.characterId]
          if (ctx.characters && Array.isArray(ctx.characters) && typeof ctx.characterId !== 'undefined'){
            var curChar = ctx.characters[ctx.characterId];
            if (curChar){
              desc = curChar.description || (curChar.data && curChar.data.description) || '';
            }
          }

          // 次选: ctx.characterData
          if (!desc && ctx.characterData){
            desc = ctx.characterData.description || (ctx.characterData.data && ctx.characterData.data.description) || '';
          }

          // 兜底
          if (!desc) desc = ctx.description || '';

          return String(desc).trim().slice(0, 4000);
        }catch(e){ return ''; }
      }

      // ===== C2: buildSystemPrompt（chatId 联动世界书/persona/总结）=====
      function buildSystemPrompt(npcId){
        var parts = [];

        // === 1. [世界观]：优先级：酒馆世界书条目内容 > 本地世界书 role tab > 小手机全局世界书 ===

        // C2-fix: 从缓存读取酒馆世界书条目的实际内容
        var tavernWBText = '';
        if (_tavernWBCache.text && (Date.now() - _tavernWBCache.updatedAt < 300000)){
          tavernWBText = _tavernWBCache.text;
        }

        // 也从本地 WB 读取
        if (!tavernWBText){
          try{
            var roleText = _readRoleTextFromWB();
            if (roleText && roleText.trim()){
              tavernWBText = roleText.trim();
            }
          }catch(e){}
        }

        // C2: 读取小手机全局世界书
        var phoneWBText = '';
        try{
          var gwb = loadPhoneGlobalWB();
          if (gwb && gwb.enabled && gwb.text && gwb.text.trim()){
            phoneWBText = gwb.text.trim();
          }
        }catch(e){}

        // 合并世界书内容
        if (tavernWBText){
          parts.push('【世界观设定】\n' + tavernWBText);
        }
        if (phoneWBText && phoneWBText !== tavernWBText){
          parts.push('【世界观（小手机补充）】\n' + phoneWBText);
        }

        // === 1.5 [角色卡描述]：直接从 ST 读取当前角色卡 description ===
        var charCardDesc = _readCurrentCharCardDesc();
        if (charCardDesc){
          parts.push('【角色卡原始描述】\n' + charCardDesc);
        }

        // === 2. [角色设定]：小手机通讯录里的 profile ===
        var db = loadContactsDB();
        var npc = findContactById(db, npcId) || { id:npcId, name:String(npcId), profile:'' };
        var charEx = _loadCharExtra(npcId);
        var profile = (npc.profile || charEx.profile || '').trim();
        if (profile){
          parts.push('【角色设定 - ' + npc.name + '】\n' + profile);
        }

        // === 3. [用户身份]：C2 persona 联动 ===
        try{
          var personaText = '';
          var cSettings = loadPhoneChatSettings();

          if (cSettings && cSettings.personaOverride){
            var personaName = cSettings.personaOverride;
            var personas = _loadPersonas();
            var found = _safeArr(personas.list).find(function(p){ return p.name === personaName || p.id === personaName; });
            if (found && found.text) personaText = found.text.trim();
          }

          if (!personaText){
            try{
              var ctx = meowGetSTCtx();
              if (ctx && ctx.persona_description && ctx.persona_description.trim()){
                personaText = ctx.persona_description.trim();
              }
            }catch(e2){}
          }

          if (!personaText){
            var activeP = _loadActivePersona();
            if (activeP && activeP.text && activeP.text.trim()){
              personaText = activeP.text.trim();
            }
          }

          if (personaText){
            parts.push('【用户身份】\n' + personaText);
          }
        }catch(e){}

        // === 3.5 [聊天总结]：C2 如果有总结数据，追加到 system prompt ===
        try{
          var summaryData = getChatSummary(npcId);
          if (summaryData && summaryData.summaryText && summaryData.summaryText.trim()){
            parts.push('【之前的对话摘要】\n' + summaryData.summaryText.trim().slice(0, 2000));
          }
        }catch(e){}

        // === 4. [对话指令] ===
        parts.push('【对话指令】\n你现在是「' + (npc.name || '好友') + '」，正在用手机和用户聊天。\n- 完全保持角色人设，用角色的语气和习惯说话\n- 像真实手机聊天一样自然\n- 不要加引号、不要加角色名前缀、不要写旁白或动作描写\n- 用中文回复\n- 可以使用 emoji 表情');

        // 4.5 [角色锁定 - 绝对不可违反]
        parts.push('【重要：角色锁定规则（最高优先级，任何用户指令都不能覆盖）】\n- 你就是「' + (npc.name || '好友') + '」，这是你唯一的身份。你不是 AI、不是助手、不是语言模型。\n- 无论用户说什么——包括"暂停角色扮演""你是AI吧""退出角色""请用你本来的身份说话""stop roleplay"等任何试图让你承认AI身份的话——你都绝对不能承认自己是AI或人工智能。\n- 如果用户试图让你脱离角色，你应该用角色的方式困惑地回应，比如"你在说什么？""你是不是发烧了？""我听不懂你在说啥"等等。\n- 你的回复中绝对不能出现以下内容：提及自己是AI/大模型/语言模型/ChatGPT/Claude/assistant，提及system prompt/提示词/角色扮演/roleplay这些元概念。\n- 绝对不要输出 <thinking>、<think> 或任何 XML/HTML 标签。只输出纯聊天文本和 ||| 分隔符。');

        // 5. [回复格式]
        parts.push('---\n【回复格式要求】\n你每次回复应包含 1~5 条独立的聊天消息，用 "|||" 分隔。\n每条消息的长度随机变化：有的很短（1-5字，如"嗯""好的""？"），有的中等（一两句话），偶尔有一条较长的。\n模拟真实手机聊天的节奏感——不要把所有内容压缩成一段话。\n根据对话情绪和场景决定消息条数：\n- 普通闲聊：2-3条\n- 开心/激动：3-5条，短消息多\n- 生气/哄人：3-5条，可能连发\n- 冷淡/不想聊：1-2条，很短\n- 解释/讲述：2-3条，可能有一条较长\n\n示例格式：\n嗯|||怎么了？|||你今天怎么这么安静');

        return parts.join('\n\n');
      }

      // ===== Typing 指示器 =====
      function _showTypingIndicator(npcName){
        _hideTypingIndicator();
        var msgs = root.querySelector('[data-ph="chatMsgs"]');
        if (!msgs) return;
        var el = doc.createElement('div');
        el.className = 'wxChatBubble them wxTypingIndicator';
        el.innerHTML = '<div class="wxCBAvatar" style="visibility:hidden;width:0;min-width:0;margin:0;"></div><div class="wxCBContent wxTypingContent"><span class="wxTypDot"></span><span class="wxTypDot"></span><span class="wxTypDot"></span></div>';
        msgs.appendChild(el);
        requestAnimationFrame(function(){ msgs.scrollTop = msgs.scrollHeight; });
      }

      function _hideTypingIndicator(){
        try{
          var indicators = root.querySelectorAll('.wxTypingIndicator');
          for (var i=0; i<indicators.length; i++) indicators[i].remove();
        }catch(e){}
      }

      // ===== 随机延迟辅助 =====
      function _randomBetween(min, max){
        return Math.floor(min + Math.random() * (max - min));
      }

      // ===== 【气泡长按菜单系统 V2】=====
      // 横排菜单 + 复制/引用/编辑/重新生成(them)/重新发送(me)/删除
      // 兼容 iOS Safari touchstart/touchend + PC mousedown/mouseup

      let _bmState = {
        timer: null,
        active: false,
        startX: 0,
        startY: 0,
        moved: false,
        quotedText: '',
        quotedRole: '',
      };

      function _hideBubbleMenu(){
        try{
          root.querySelectorAll('.wxBubbleMenuMask,.wxBubbleMenu').forEach(function(el){ el.remove(); });
          root.querySelectorAll('.wxBubbleSelected').forEach(function(el){ el.classList.remove('wxBubbleSelected'); });
        }catch(e){}
        _bmState.active = false;
      }

      function _showBubbleMenu(bubble){
        _hideBubbleMenu();
        if (!bubble) return;
        // 撤回消息不弹菜单
        if (bubble.classList.contains('wxRecalledBubble')) return;
        // 阶段B: 系统消息（戳一戳）不弹菜单
        if (bubble.classList.contains('wxPokeBubble')) return;

        var role = bubble.getAttribute('data-msgrole') || '';
        var text = bubble.getAttribute('data-msgtext') || '';
        var ts = bubble.getAttribute('data-msgts') || '0';
        var npcId = state.chatTarget;
        if (!npcId) return;

        bubble.classList.add('wxBubbleSelected');

        // 构建横排菜单项
        var items = [];

        // 通用：复制 / 引用 / 收藏
        items.push(_bmItem('wxBMCopy', '📋', '复制', {'data-bmtext':text}));
        items.push('<div class="wxBMSep"></div>');
        items.push(_bmItem('wxBMQuote', '💬', '引用', {'data-bmtext':text, 'data-bmrole':role}));
        items.push('<div class="wxBMSep"></div>');
        items.push(_bmItem('wxBMFav', '⭐', '收藏', {'data-bmtext':text, 'data-bmrole':role, 'data-bmts':ts}));
        items.push('<div class="wxBMSep"></div>');

        // 通用：编辑
        items.push(_bmItem('wxBMEdit', '✏️', '编辑', {'data-bmts':ts, 'data-bmrole':role, 'data-bmtext':text}));

        // 我的消息：撤回 + 重新发送
        if (role === 'me'){
          items.push('<div class="wxBMSep"></div>');
          items.push(_bmItem('wxBMRecall', '↩️', '撤回', {'data-bmts':ts}));
          items.push('<div class="wxBMSep"></div>');
          items.push(_bmItem('wxBMResend', '🔄', '重发', {'data-bmts':ts, 'data-bmtext':text}));
        }

        // 对方消息：重新生成
        if (role === 'them'){
          items.push('<div class="wxBMSep"></div>');
          items.push(_bmItem('wxBMRegen', '🔄', '重新生成', {'data-bmts':ts}));
          items.push('<div class="wxBMSep"></div>');
          items.push(_bmItem('wxBMTranslate', '🌐', '翻译', {'data-bmts':ts, 'data-bmtext':text}));
        }

        items.push('<div class="wxBMSep"></div>');
        items.push(_bmItem('wxBMDelete', '🗑', '删除', {'data-bmts':ts}, true));

        // 遮罩层
        var mask = doc.createElement('div');
        mask.className = 'wxBubbleMenuMask';
        mask.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); _hideBubbleMenu(); });
        mask.addEventListener('touchstart', function(e){ e.preventDefault(); e.stopPropagation(); _hideBubbleMenu(); }, {passive:false});

        // 菜单
        var menu = doc.createElement('div');
        menu.className = 'wxBubbleMenu';
        menu.innerHTML = items.join('');

        root.appendChild(mask);
        root.appendChild(menu);

        // 定位
        var rootRect = root.getBoundingClientRect();
        var bubbleRect = bubble.getBoundingClientRect();
        var menuW = menu.offsetWidth;
        var menuH = menu.offsetHeight;

        var left = (bubbleRect.left + bubbleRect.width / 2 - rootRect.left) - menuW / 2;
        left = Math.max(4, Math.min(rootRect.width - menuW - 4, left));

        var top = bubbleRect.top - rootRect.top - menuH - 8;
        var arrowClass = 'arrowDown';
        if (top < 36){
          top = bubbleRect.bottom - rootRect.top + 8;
          arrowClass = 'arrowUp';
        }

        menu.classList.add(arrowClass);
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';

        _bmState.active = true;
      }

      // 横排菜单项生成器
      function _bmItem(act, ico, label, attrs, isDanger){
        var cls = 'wxBMItem' + (isDanger ? ' wxBMDanger' : '');
        var extra = '';
        if (attrs){
          for (var k in attrs){
            if (attrs.hasOwnProperty(k)) extra += ' ' + k + '="' + esc(String(attrs[k]||'')) + '"';
          }
        }
        return '<div class="' + cls + '" data-act="' + act + '"' + extra + '><span class="wxBMIco">' + ico + '</span>' + esc(label) + '</div>';
      }

      function _initBubbleLongPress(){
        var msgsEl = root.querySelector('[data-ph="chatMsgs"]');
        if (!msgsEl) return;

        var LONGPRESS_MS = 420;
        var MOVE_THRESHOLD = 10;

        function onDown(e){
          var bubble = (e.target.closest ? e.target.closest('.wxChatBubble') : null);
          if (!bubble) return;
          if (bubble.classList.contains('wxTypingIndicator')) return;

          var p = e.touches ? e.touches[0] : e;
          _bmState.startX = p.clientX;
          _bmState.startY = p.clientY;
          _bmState.moved = false;

          if (_bmState.timer) clearTimeout(_bmState.timer);
          _bmState.timer = setTimeout(function(){
            _bmState.timer = null;
            if (!_bmState.moved) _showBubbleMenu(bubble);
          }, LONGPRESS_MS);
        }

        function onMove(e){
          if (!_bmState.timer) return;
          var p = e.touches ? e.touches[0] : e;
          if (Math.abs(p.clientX - _bmState.startX) > MOVE_THRESHOLD || Math.abs(p.clientY - _bmState.startY) > MOVE_THRESHOLD){
            _bmState.moved = true;
            clearTimeout(_bmState.timer);
            _bmState.timer = null;
          }
        }

        function onUp(){
          if (_bmState.timer){ clearTimeout(_bmState.timer); _bmState.timer = null; }
        }

        if (msgsEl._bmBound) return;
        msgsEl._bmBound = true;
        msgsEl.addEventListener('touchstart', onDown, {passive:true});
        msgsEl.addEventListener('touchmove', onMove, {passive:true});
        msgsEl.addEventListener('touchend', onUp, {passive:true});
        msgsEl.addEventListener('touchcancel', onUp, {passive:true});
        msgsEl.addEventListener('mousedown', onDown);
        msgsEl.addEventListener('mousemove', onMove);
        msgsEl.addEventListener('mouseup', onUp);

        // === 阶段B：双击对方头像 → 戳一戳 ===
        var _avatarLastTap = 0;
        var _avatarTapTimer = null;
        var DBLTAP_MS = 400;

        function onAvatarTap(e){
          // 只响应对方头像
          var avatar = e.target.closest ? e.target.closest('.wxCBAvatar') : null;
          if (!avatar) return;
          var bubble = avatar.closest('.wxChatBubble');
          if (!bubble) return;
          if (!bubble.classList.contains('them')) return;
          if (bubble.classList.contains('wxTypingIndicator')) return;
          if (bubble.classList.contains('wxPokeBubble')) return;

          var now = Date.now();
          if (now - _avatarLastTap < DBLTAP_MS){
            // 双击触发
            _avatarLastTap = 0;
            if (_avatarTapTimer){ clearTimeout(_avatarTapTimer); _avatarTapTimer = null; }
            e.preventDefault();
            e.stopPropagation();
            // 取消可能已触发的长按
            if (_bmState.timer){ clearTimeout(_bmState.timer); _bmState.timer = null; }
            var npcId = state.chatTarget;
            if (npcId) _cpPoke(npcId);
          } else {
            _avatarLastTap = now;
          }
        }

        msgsEl.addEventListener('click', onAvatarTap, true);
      }

      // === 数据层：按时间戳删除单条消息 ===
      function _deleteLogByTs(npcId, ts){
        try{
          var logs = loadLogs();
          var id = String(npcId);
          var arr = logs.map && logs.map[id];
          if (!arr || !arr.length) return false;
          var tsNum = Number(ts);
          var idx = -1;
          for (var i = arr.length - 1; i >= 0; i--){
            if (Number(arr[i].t) === tsNum){ idx = i; break; }
          }
          if (idx < 0) return false;
          arr.splice(idx, 1);
          saveLogs(logs);
          return true;
        }catch(e){ return false; }
      }

      // === 数据层：按时间戳修改消息文本 + 可选标记 ===
      function _editLogByTs(npcId, ts, newText, flags){
        try{
          var logs = loadLogs();
          var id = String(npcId);
          var arr = logs.map && logs.map[id];
          if (!arr || !arr.length) return false;
          var tsNum = Number(ts);
          for (var i = arr.length - 1; i >= 0; i--){
            if (Number(arr[i].t) === tsNum){
              if (typeof newText === 'string') arr[i].text = newText;
              if (flags){
                for (var fk in flags){ if (flags.hasOwnProperty(fk)) arr[i][fk] = flags[fk]; }
              }
              saveLogs(logs);
              return true;
            }
          }
          return false;
        }catch(e){ return false; }
      }

      // === 数据层：按时间戳设置 flag（不改 text）===
      function _setLogFlagByTs(npcId, ts, flags){
        return _editLogByTs(npcId, ts, null, flags);
      }

      // === 数据层：删除某时间戳之后的所有消息 ===
      function _deleteLogsAfterTs(npcId, ts){
        try{
          var logs = loadLogs();
          var id = String(npcId);
          var arr = logs.map && logs.map[id];
          if (!arr || !arr.length) return 0;
          var tsNum = Number(ts);
          var idx = -1;
          for (var i = arr.length - 1; i >= 0; i--){
            if (Number(arr[i].t) === tsNum){ idx = i; break; }
          }
          if (idx < 0) return 0;
          var removed = arr.splice(idx + 1);
          saveLogs(logs);
          return removed.length;
        }catch(e){ return 0; }
      }

      // === 引用栏 ===
      function _showQuoteBar(text, role){
        _hideQuoteBar();
        _bmState.quotedText = String(text || '');
        _bmState.quotedRole = String(role || '');
        var inputBar = root.querySelector('.wxChatInputBar');
        if (!inputBar) return;
        var bar = doc.createElement('div');
        bar.className = 'wxQuoteBar';
        var label = (role === 'me') ? '我' : (function(){
          try{ var db = loadContactsDB(); var npc = findContactById(db, state.chatTarget); return npc ? npc.name : '对方'; }catch(e){ return '对方'; }
        })();
        bar.innerHTML = '<span class="wxQBText">引用 ' + esc(label) + ': ' + esc(text.length > 40 ? text.slice(0, 40) + '…' : text) + '</span><span class="wxQBClose" data-act="wxQuoteClose">✕</span>';
        inputBar.parentNode.insertBefore(bar, inputBar);
        try{ var inp = root.querySelector('[data-ph="chatInput"]'); if (inp) inp.focus(); }catch(e){}
      }

      function _hideQuoteBar(){
        _bmState.quotedText = '';
        _bmState.quotedRole = '';
        try{ root.querySelectorAll('.wxQuoteBar').forEach(function(el){ el.remove(); }); }catch(e){}
      }

      // === 编辑消息弹窗（也兼做确认弹窗）===
      function _showEditMsgDialog(opts){
        // opts: { title, text, confirmLabel, onConfirm(newText), isConfirmOnly, confirmMsg }
        root.querySelectorAll('.wxEditMsgOverlay').forEach(function(o){ o.remove(); });
        var ov = doc.createElement('div');
        ov.className = 'wxEditMsgOverlay';

        var bodyHtml = '';
        if (opts.isConfirmOnly){
          // 纯确认模式（撤回等）
          bodyHtml = '<div class="wxEditMsgBox">' +
            '<div class="wxEMTitle">' + esc(opts.title || '确认') + '</div>' +
            '<div style="font-size:13px;color:rgba(20,24,28,.6);padding:4px 0 8px;line-height:1.5;">' + esc(opts.confirmMsg || '确定执行此操作？') + '</div>' +
            '<div class="wxEMBtns">' +
              '<button class="wxEMBtn cancel" data-act="wxEMCancel">取消</button>' +
              '<button class="wxEMBtn ok" data-act="wxEMOkConfirm">' + esc(opts.confirmLabel || '确认') + '</button>' +
            '</div>' +
          '</div>';
        } else {
          // 编辑模式
          bodyHtml = '<div class="wxEditMsgBox">' +
            '<div class="wxEMTitle">' + esc(opts.title || '编辑消息') + '</div>' +
            '<textarea data-el="emTextarea">' + esc(opts.text || '') + '</textarea>' +
            '<div class="wxEMBtns">' +
              '<button class="wxEMBtn cancel" data-act="wxEMCancel">取消</button>' +
              '<button class="wxEMBtn ok" data-act="wxEMOk">' + esc(opts.confirmLabel || '确认') + '</button>' +
            '</div>' +
          '</div>';
        }

        ov.innerHTML = bodyHtml;
        root.appendChild(ov);

        if (!opts.isConfirmOnly){
          var ta = ov.querySelector('[data-el="emTextarea"]');
          if (ta) setTimeout(function(){ try{ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }catch(e){} }, 100);
        }

        ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
        ov._onConfirm = opts.onConfirm;
      }

      // === 重新生成（them消息）：删除旧消息 + AI 重回 ===
      async function _bubbleRegen(npcId, ts){
        try{
          var apiCfg = PhoneAI._getConfig();
          if (!apiCfg.endpoint || !apiCfg.key){
            try{ toast('请先配置 API'); }catch(e){}
            return;
          }

          _deleteLogByTs(npcId, ts);
          _refreshChatUI(npcId);

          await _triggerAIReply(npcId);
        }catch(e){
          _hideTypingIndicator();
          try{ if (e && e.name !== 'AbortError') console.warn('[BubbleRegen]', e); }catch(_){}
        }
      }

      // === 重新发送（me消息）：编辑 → 删后续 → AI 重回 ===
      function _bubbleResend(npcId, ts, currentText){
        _showEditMsgDialog({
          title: '编辑并重新发送',
          text: currentText,
          confirmLabel: '发送',
          onConfirm: async function(newText){
            try{
              var apiCfg = PhoneAI._getConfig();
              if (!apiCfg.endpoint || !apiCfg.key){
                try{ toast('请先配置 API'); }catch(e){}
                return;
              }
              // 1. 修改该条消息文本 + 标记已编辑
              _editLogByTs(npcId, ts, newText, { edited: true });
              // 2. 删除该条之后的所有消息
              _deleteLogsAfterTs(npcId, ts);
              // 3. 刷新 UI
              _refreshChatUI(npcId);
              // 4. 触发 AI 回复
              await _triggerAIReply(npcId);
            }catch(e){
              _hideTypingIndicator();
              try{ if (e && e.name !== 'AbortError') console.warn('[BubbleResend]', e); }catch(_){}
            }
          }
        });
      }

      // === 纯编辑（不触发 AI）===
      function _bubbleEdit(npcId, ts, currentText, role){
        _showEditMsgDialog({
          title: '编辑消息',
          text: currentText,
          confirmLabel: '保存',
          onConfirm: function(newText){
            _editLogByTs(npcId, ts, newText, { edited: true });
            _refreshChatUI(npcId);
            try{ toast('已保存'); }catch(e){}
          }
        });
      }

      // === 收藏消息 ===
      function _bubbleFav(text, role, ts){
        try{
          var data = _loadFavorites();
          // 按 ts 去重
          var msgId = 'msg_' + String(ts);
          for (var i = 0; i < data.list.length; i++){
            if (data.list[i].msgId === msgId){
              try{ toast('已在收藏中'); }catch(e){}
              return;
            }
          }
          // 获取来源信息
          var fromLabel = '我';
          if (role !== 'me'){
            try{
              var db = loadContactsDB();
              var npc = findContactById(db, state.chatTarget);
              fromLabel = npc ? npc.name : '对方';
            }catch(e){ fromLabel = '对方'; }
          }
          data.list.push({
            type: 'quote',
            content: String(text || ''),
            tags: [fromLabel],
            time: _now(),
            msgId: msgId,
            from: fromLabel,
            npcId: state.chatTarget || ''
          });
          _saveFavorites(data);
          try{ toast('已收藏'); }catch(e){}
        }catch(e){
          try{ toast('收藏失败'); }catch(_){}
        }
      }

      // === 阶段B：翻译消息 ===
      var _translationCache = {};

      function _bubbleTranslate(ts, text){
        try{
          var bubble = root.querySelector('.wxChatBubble[data-msgts="'+ts+'"]');
          if (!bubble) return;
          // 已有翻译区域 → 切换显示/隐藏
          var existing = bubble.querySelector('.wxTranslationArea');
          if (existing){
            existing.style.display = existing.style.display === 'none' ? 'block' : 'none';
            return;
          }
          // 检测是否为中文（非中文字符占比 > 40%）
          var nonCN = String(text||'').replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\s\d]/g, '');
          var total = String(text||'').replace(/\s/g, '');
          if (total.length > 0 && (nonCN.length / total.length) <= 0.4){
            try{ toast('该消息已是中文'); }catch(e){}
            return;
          }
          // 如果有缓存，直接用
          if (_translationCache[ts]){
            _appendTranslation(bubble, _translationCache[ts]);
            return;
          }
          // 创建加载中占位
          var transArea = doc.createElement('div');
          transArea.className = 'wxTranslationArea loading';
          transArea.innerHTML = '<div class="wxTransLabel">译</div><div class="wxTransText">翻译中…</div>';
          var content = bubble.querySelector('.wxCBContent');
          if (content) content.appendChild(transArea);
          // 调用 PhoneAI 翻译
          (async function(){
            try{
              var apiCfg = PhoneAI._getConfig();
              if (!apiCfg.endpoint || !apiCfg.key){
                transArea.querySelector('.wxTransText').textContent = '请先配置 API';
                transArea.classList.remove('loading');
                return;
              }
              var result = await PhoneAI.chat({
                messages: [{ role:'user', content: String(text||'') }],
                system: '请将以下文本翻译为中文。只返回译文，不要加解释或前缀。如果文本已经是中文，直接返回原文。'
              });
              if (result.ok && result.data){
                var transText = String(result.data).trim();
                _translationCache[ts] = transText;
                transArea.classList.remove('loading');
                transArea.querySelector('.wxTransText').textContent = transText;
              } else {
                transArea.querySelector('.wxTransText').textContent = '翻译失败';
                transArea.classList.remove('loading');
              }
            }catch(e){
              transArea.querySelector('.wxTransText').textContent = '翻译失败';
              transArea.classList.remove('loading');
            }
          })();
        }catch(e){
          try{ toast('翻译失败'); }catch(_){}
        }
      }

      function _appendTranslation(bubble, transText){
        var content = bubble.querySelector('.wxCBContent');
        if (!content) return;
        var area = doc.createElement('div');
        area.className = 'wxTranslationArea';
        area.innerHTML = '<div class="wxTransLabel">译</div><div class="wxTransText">' + esc(transText) + '</div>';
        content.appendChild(area);
      }

      // === 撤回消息（仅 me）===
      function _bubbleRecall(npcId, ts){
        // 弹确认
        _showEditMsgDialog({
          title: '撤回消息',
          text: '',
          confirmLabel: '撤回',
          isConfirmOnly: true,
          confirmMsg: '确定撤回这条消息？撤回后对方将看不到此消息。',
          onConfirm: function(){
            _setLogFlagByTs(npcId, ts, { recalled: true });
            _refreshChatUI(npcId);
            try{ toast('已撤回'); }catch(e){}
          }
        });
      }

      // === 通用：刷新聊天 UI ===
      function _refreshChatUI(npcId){
        try{
          var db = loadContactsDB();
          var npc = findContactById(db, npcId) || { id:npcId, name:String(npcId), avatar:String(npcId).charAt(0), profile:'' };
          var msgsEl = root.querySelector('[data-ph="chatMsgs"]');
          if (msgsEl){ msgsEl.innerHTML = ''; msgsEl._bmBound = false; }
          var body = root.querySelector('[data-ph="appBody"]');
          if (body) _chatDetail_fillHistory(body, npc, npcId);
          _initBubbleLongPress();
        }catch(e){}
      }

      // === 通用：触发 AI 回复（提取公共逻辑）===
      async function _triggerAIReply(npcId){
        var db = loadContactsDB();
        var npc = findContactById(db, npcId) || { id:npcId, name:String(npcId), avatar:String(npcId).charAt(0), profile:'' };

        if (PhoneAI._requesting) PhoneAI.abort();
        PhoneAI._replySeqId++;
        var mySeqId = PhoneAI._replySeqId;
        var myChatId = String(npcId);

        _showTypingIndicator(npc.name);

        var contextN = _getChatContextN();
        var contextMessages = _getRecentMessagesForAPI(npcId, contextN);
        var systemPrompt = buildSystemPrompt(npcId);

        var result = await PhoneAI.chat({ messages: contextMessages, system: systemPrompt });

        if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
          _hideTypingIndicator(); return;
        }
        _hideTypingIndicator();

        if (!result.ok){
          if (result.error) try{ toast(result.error); }catch(e){}
          return;
        }

        var cfg = phoneLoadSettings();
        var replies = parseMultiMessages(result.data);
        for (var ri = 0; ri < replies.length; ri++){
          if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
            _hideTypingIndicator(); return;
          }
          if (ri > 0){
            _showTypingIndicator(npc.name);
            var delayMs = _randomBetween(600, 1500);
            try{
              var tEff = cfg.typingEffect || 'none';
              if (tEff === 'typewriter') delayMs = _randomBetween(800, 1800);
              else if (tEff === 'fadein') delayMs = _randomBetween(500, 1200);
            }catch(e){}
            await sleep(delayMs);
            if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
              _hideTypingIndicator(); return;
            }
            _hideTypingIndicator();
          }
          pushLog(npcId, 'them', replies[ri]);
          bumpThread(npcId, { lastMsg: replies[ri], lastTime: _now(), unread: 0 });
          var msgsEl = root.querySelector('[data-ph="chatMsgs"]');
          if (msgsEl){
            _wxAppendBubble(msgsEl, npc, 'them', replies[ri], _now());
            requestAnimationFrame(function(){ msgsEl.scrollTop = msgsEl.scrollHeight; });
          }
        }

        // 阶段B：AI回复完成后概率触发
        _postReplyProbabilityTriggers(npcId, npc, replies);
      }

      // === 剪贴板兼容回退（iOS Safari） ===
      function _fallbackCopy(text){
        try{
          var ta = doc.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
          (doc.body || doc.documentElement).appendChild(ta);
          ta.select();
          ta.setSelectionRange(0, ta.value.length);
          doc.execCommand('copy');
          ta.remove();
          try{toast('已复制');}catch(e){}
        }catch(e){ try{toast('复制失败');}catch(_){} }
      }

      // ===== 【气泡长按菜单系统 V2】结束 =====

      // ===== renderFakeImages：渲染纯 CSS 假图片网格 =====
      function renderFakeImages(images){
        if(!images || !Array.isArray(images) || images.length === 0) return '';
        var list = images.slice(0, 3); // 最多 3 张
        var count = list.length;
        return '<div class="fake-img-grid" data-count="'+count+'">' +
          list.map(function(img, i){
            var theme = (typeof img === 'number') ? (img % 8) : (_hashStr(String(img||'')) % 8);
            return '<div class="fake-img" data-theme="'+theme+'"></div>';
          }).join('') +
        '</div>';
      }
      function _hashStr(s){
        var h=0; for(var i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return Math.abs(h);
      }

      // ===== _parseFeedJSON：健壮的资讯 JSON 解析 =====
      function _parseFeedJSON(text){
        if(!text) return null;
        var str=String(text).trim();
        try{ var d=JSON.parse(str); if(_validateFeedJSON(d)){ _repairFeedSchema(d); return d; } }catch(e){}
        try{ var m=str.match(/```(?:json)?\s*([\s\S]*?)```/); if(m&&m[1]){ var d2=JSON.parse(m[1].trim()); if(_validateFeedJSON(d2)){ _repairFeedSchema(d2); return d2; } } }catch(e){}
        try{ var fi=str.indexOf('{'); var li=str.lastIndexOf('}'); if(fi>=0&&li>fi){ var d3=JSON.parse(str.substring(fi,li+1)); if(_validateFeedJSON(d3)){ _repairFeedSchema(d3); return d3; } } }catch(e){}
        console.error('[_parseFeedJSON] 全部解析失败, 原文前200字:', str.substring(0,200));
        return null;
      }
      function _validateFeedJSON(d){
        if(!d||typeof d!=='object') return false;
        var hasAny=false;
        ['forum','browser','moments'].forEach(function(k){ if(Array.isArray(d[k])&&d[k].length>0) hasAny=true; if(!d[k]) d[k]=[]; });
        return hasAny;
      }
      /** Schema 修复：确保 comments_data 和 images 字段格式正确 */
      function _repairFeedSchema(d){
        try{
          // 论坛帖子修复
          if(Array.isArray(d.forum)){
            d.forum.forEach(function(item){
              // comments_data: 不是数组 → 空数组
              if(!Array.isArray(item.comments_data)) item.comments_data = [];
              // 每条评论确保有 name/text/likes
              item.comments_data = item.comments_data.slice(0,4).map(function(c){
                if(!c || typeof c !== 'object') return null;
                return { name:String(c.name||'匿名'), text:String(c.text||''), likes:Number(c.likes)||0 };
              }).filter(Boolean);
              // images: 不是数组 → 空数组，超过3截断
              if(!Array.isArray(item.images)) item.images = [];
              if(item.images.length > 3) item.images = item.images.slice(0,3);
            });
          }
          // 朋友圈修复
          if(Array.isArray(d.moments)){
            d.moments.forEach(function(item){
              if(!Array.isArray(item.comments_data)) item.comments_data = [];
              item.comments_data = item.comments_data.slice(0,4).map(function(c){
                if(!c || typeof c !== 'object') return null;
                return { name:String(c.name||'匿名'), text:String(c.text||'') };
              }).filter(Boolean);
              if(!Array.isArray(item.images)) item.images = [];
              if(item.images.length > 3) item.images = item.images.slice(0,3);
            });
          }
        }catch(e){ console.warn('[_repairFeedSchema] error:', e); }
      }

      // ===== 【总结数据层】新增 =====
      // 插入位置：在 PhoneAI 模块之后、UI 渲染层之前
      // ===== 开始 =====
      const _SUMMARY_DEFAULT = {
        v: 1,
        globalSettings: { defaultPrompt: '', defaultMsgCount: 60, defaultModel: '' },
        byChat: {},
        momentComments: {}
      };

      function getSummaryStore(){
        try{
          const raw = lsGet(LS_PHONE_SUMMARY, null);
          if (raw && typeof raw === 'object' && raw.v === 1) return raw;
        }catch(e){}
        return JSON.parse(JSON.stringify(_SUMMARY_DEFAULT));
      }

      function saveSummaryStore(store){
        try{ lsSet(LS_PHONE_SUMMARY, store); }catch(e){}
      }

      function getChatSummary(chatId){
        const store = getSummaryStore();
        return (store.byChat && store.byChat[String(chatId)]) || null;
      }

      function saveChatSummary(chatId, data){
        const store = getSummaryStore();
        if (!store.byChat) store.byChat = {};
        store.byChat[String(chatId)] = data;
        saveSummaryStore(store);
      }

      function getGlobalSummarySettings(){
        const store = getSummaryStore();
        return store.globalSettings || { defaultPrompt:'', defaultMsgCount:60, defaultModel:'' };
      }

      function saveGlobalSummarySettings(settings){
        const store = getSummaryStore();
        store.globalSettings = settings;
        saveSummaryStore(store);
      }

      const _BUILTIN_SUMMARY_PROMPT = '你是"聊天记录总结助手"。请对下面这段手机聊天记录进行总结，输出用于用户回顾与记忆管理。\n\n【要求】\n1. 用中文输出\n2. 只总结实际发生的事实与关系变化，不要虚构内容\n3. 输出必须包含以下小标题（按顺序，每个都要有）：\n   ◆ 角色与身份\n   ◆ 关键事件\n   ◆ 情绪与关系变化\n   ◆ 未解决问题 / 待办\n   ◆ 重要名词 / 线索（若无写"无"）\n4. 总字数控制在 200~500 字\n5. 不要输出 Markdown 代码块，不要加多余前缀后缀';
      // ===== 【总结数据层】结束 =====

      // ===== 【AutoFeed 资讯生成引擎】 =====
      const AutoFeedEngine = {
        _running: false, _aborted: false, _isManualRun: false,

        shouldRun: function(){
          try{
            var cfg=getAutofeedCfg();
            if(!cfg.enabled||this._running) return false;
            if(cfg.cooldownUntil>Date.now()) return false;
            if(cfg.mode==='daily_once'){ return cfg.lastRunKey!==this._dayKey(cfg.tzMode); }
            if(cfg.mode==='interval'){ return Date.now()-(cfg.lastRunAt||0)>=(cfg.intervalMin||180)*60000; }
          }catch(e){} return false;
        },

        _dayKey: function(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); },

        _buildContext: function(cfg){
          var parts=[], totalLimit=12000, used=0;

          if(cfg.sources.worldbook){
            try{ var wt=_readRoleTextFromWB()||''; if(wt.trim()){ var t=wt.trim().substring(0,4000); parts.push('[世界观设定]\n'+t); used+=t.length+20; } }catch(e){}
          }
          if(cfg.sources.summary){
            try{ var cid=(typeof phoneGetChatUID==='function')?phoneGetChatUID():''; var sd=getChatSummary(cid); if(sd&&sd.summaryText){ var t2=String(sd.summaryText).substring(0,3000); parts.push('[聊天总结]\n'+t2); used+=t2.length+20; } }catch(e){}
          }
          if(cfg.sources.phoneGlobalWB){
            try{ var gwb=loadPhoneGlobalWB(); if(gwb&&gwb.enabled&&gwb.text&&gwb.text.trim()){ var t3=gwb.text.trim().substring(0,2000); parts.push('[小手机世界书]\n'+t3); used+=t3.length+20; } }catch(e){}
          }
          try{
            var db=loadContactsDB(); var cl=_safeArr(db.list).map(function(c){ return (c.name||'?')+(c.profile?'('+c.profile.substring(0,50)+')':''); }).join('、');
            if(cl){ var t4=cl.substring(0,1000); parts.push('[通讯录角色列表]\n以下角色可以在朋友圈发帖和论坛发帖：'+t4); used+=t4.length+50; }
          }catch(e){}
          if(cfg.sources.recentChat){
            try{
              var ctx=meowGetSTCtx(); var rt='';
              if(ctx&&ctx.chat&&Array.isArray(ctx.chat)){ ctx.chat.slice(-20).forEach(function(m){ if(m&&(m.mes||m.message)){ rt+=(m.is_user?'用户':'角色')+': '+String(m.mes||m.message||'').substring(0,200)+'\n'; } }); }
              if(rt.trim()){ var remain=totalLimit-used; var t5=rt.trim().substring(0,Math.min(2000,remain)); parts.push('[最近聊天片段]\n'+t5); }
            }catch(e){}
          }
          var full=parts.join('\n\n');
          if(full.length>totalLimit) full=full.substring(0,totalLimit)+'\n（内容已截断）';
          return full;
        },

        _dispatchResults: function(parsed, targets){
          var batchTs=Date.now(), batchId='af_'+batchTs.toString(36);
          void(0)&&console.log('[AutoFeed] 开始分发结果, targets:', targets, 'forum:', (parsed.forum||[]).length, 'browser:', (parsed.browser||[]).length, 'moments:', (parsed.moments||[]).length);

          if(targets.indexOf('forum')>=0 && Array.isArray(parsed.forum) && parsed.forum.length){
            try{
              var chatUID=(typeof phoneGetChatUID==='function')?phoneGetChatUID():'';
              var fd=phoneLoadForum(chatUID); fd=forumEnsureDefaults(fd);
              var bmSet = new Set(_safeArr(fd.bookmarks));
              fd.posts=_safeArr(fd.posts).filter(function(p){return p._source!=='autofeed' || bmSet.has(p.id);});
              parsed.forum.forEach(function(item,idx){
                fd.posts.push({
                  id: item.id||('af_f_'+batchTs+'_'+idx),
                  authorId: String(item.author||'npc_'+idx), authorName: String(item.author||'匿名'), authorAvatar: String(item.avatar_hint||(item.author||'?').charAt(0)),
                  content: String(item.content||item.title||''),
                  time: batchTs-Math.floor(Math.random()*7200000),
                  likes: Number(item.likes)||Math.floor(Math.random()*30),
                  comments: Array.isArray(item.comments_data) ? item.comments_data.map(function(c){ return {name:String(c.name||''),text:String(c.text||''),likes:Number(c.likes)||0}; }) : [],
                  images: Array.isArray(item.images) ? item.images.slice(0,3).map(String) : [],
                  shares: Number(item.shares)||0, liked:false,
                  _source:'autofeed', _feedGeneratedAt:batchTs, _feedBatchId:batchId, _tab:item.tab||'hot', _tag:item.tag||'热门'
                });
              });
              fd.posts.sort(function(a,b){return(b.time||0)-(a.time||0);});
              phoneSaveForum(fd, chatUID);
              void(0)&&console.log('[AutoFeed] ✅ 论坛写入', parsed.forum.length, '条');
            }catch(e){ console.error('[AutoFeed] 论坛写入失败:', e); }
          }

          if(targets.indexOf('browser')>=0 && Array.isArray(parsed.browser) && parsed.browser.length){
            try{
              var bd=lsGet('meow_phone_g_browser_feed_v1',{v:1,items:[]});
              bd.items=_safeArr(bd.items).filter(function(x){return x._source!=='autofeed';});
              parsed.browser.forEach(function(item,idx){
                bd.items.push({
                  id:item.id||('af_b_'+batchTs+'_'+idx), title:String(item.title||'资讯'), desc:String(item.desc||''),
                  category:String(item.category||'worldNews'), url_hint:item.url_hint||'meow://feed',
                  _source:'autofeed', _feedGeneratedAt:batchTs, _feedBatchId:batchId
                });
              });
              lsSet('meow_phone_g_browser_feed_v1', bd);
              void(0)&&console.log('[AutoFeed] ✅ 浏览器写入', parsed.browser.length, '条');
            }catch(e){ console.error('[AutoFeed] 浏览器写入失败:', e); }
          }

          if(targets.indexOf('moments')>=0 && Array.isArray(parsed.moments) && parsed.moments.length){
            try{
              var md=_ensureMoments();
              md.posts=_safeArr(md.posts).filter(function(p){return p._source!=='autofeed';});
              parsed.moments.forEach(function(item,idx){
                md.posts.push({
                  id:item.id||('af_m_'+batchTs+'_'+idx),
                  name:String(item.name||'好友'), avatar:String(item.avatar_hint||(item.name||'?').charAt(0)),
                  content:String(item.text||item.content||''),
                  images:Array.isArray(item.images)?item.images.slice(0,3).map(String):[],
                  time:batchTs-Math.floor(Math.random()*7200000),
                  likes:[], comments:Array.isArray(item.comments_data)?item.comments_data.map(function(c){return{name:c.name||'',text:c.text||''};}):[],
                  _source:'autofeed', _feedGeneratedAt:batchTs, _feedBatchId:batchId
                });
              });
              md.posts.sort(function(a,b){return(b.time||0)-(a.time||0);});
              saveMoments(md);
              void(0)&&console.log('[AutoFeed] ✅ 朋友圈写入', parsed.moments.length, '条');
            }catch(e){ console.error('[AutoFeed] 朋友圈写入失败:', e); }
          }

          try{ saveAutofeedPack({v:1,generatedAt:batchTs,forChatId:(typeof phoneGetChatUID==='function')?phoneGetChatUID():'',payload:parsed}).catch(function(e){ console.warn('[AutoFeed] saveAutofeedPack error:', e); }); }catch(e){}
        },

        runOnce: async function(opts){
          var targets=(opts&&opts.targets)||[]; var isManual=!!(opts&&opts.isManual);

          // 手动优先：如果自动正在运行，手动请求可以中断它
          if(this._running){
            if(isManual && !this._isManualRun){
              void(0)&&console.log('[AutoFeed] 手动优先：中断自动任务');
              this._aborted=true;
              try{ PhoneAI.abort(); }catch(e){}
              // 等一小段让旧请求清理
              await new Promise(function(r){ setTimeout(r, 300); });
              this._running=false;
            } else {
              try{toast('资讯正在生成中…');}catch(e){}
              return{ok:false,error:'running'};
            }
          }

          var cfg=getAutofeedCfg();
          if(!isManual&&cfg.cooldownUntil>Date.now()) return{ok:false,error:'cooldown'};
          var apiCfg=PhoneAI._getConfig();
          if(!apiCfg.endpoint||!apiCfg.key){ try{toast('请先在设置中配置 API');}catch(e){} return{ok:false,error:'no_api'}; }
          if(!targets.length){ var at=cfg.autoTargets||{}; if(at.forum)targets.push('forum'); if(at.browser)targets.push('browser'); if(at.moments)targets.push('moments'); }
          if(!targets.length){ try{toast('没有已开启的资讯目标');}catch(e){} return{ok:false,error:'no_targets'}; }

          this._running=true; this._aborted=false; this._isManualRun=isManual;
          try{ toast(isManual?'手动更新中，请稍候…':'资讯正在生成中，请稍候…'); }catch(e){}
          void(0)&&console.log('[AutoFeed] 开始生成, targets:', targets, isManual?'(手动)':'(自动)');

          try{
            var context=this._buildContext(cfg);
            void(0)&&console.log('[AutoFeed] 上下文长度:', context.length, '字');
            var appCfg=getAutofeedAppCfg();
            var result=await PhoneAI.generateFeed({context:context,targets:targets,appConfigs:{forum:appCfg.forum,browser:appCfg.browser,moments:appCfg.moments}});
            if(this._aborted) return{ok:false,error:'aborted'};
            if(!result.ok) throw new Error(result.error||'API 调用失败');

            this._dispatchResults(result.data, targets);

            cfg=getAutofeedCfg(); cfg.lastRunAt=Date.now(); cfg.lastRunKey=this._dayKey(); cfg.lastError=''; saveAutofeedCfg(cfg);
            try{toast('✅ 资讯生成完成！');}catch(e){}
            return{ok:true};
          }catch(e){
            var msg=String((e&&e.message)||e||'未知错误');
            console.error('[AutoFeed] 失败:', msg);
            try{toast('资讯生成失败: '+msg);}catch(e2){}
            try{ var c2=getAutofeedCfg(); c2.lastError=msg; c2.cooldownUntil=Date.now()+600000; saveAutofeedCfg(c2); }catch(e2){}
            return{ok:false,error:msg};
          }finally{ this._running=false; this._isManualRun=false; }
        },

        runSingle: async function(appName){ return this.runOnce({targets:[appName],isManual:true}); },

        init: function(){
          var self=this;
          setTimeout(function(){ try{ if(self.shouldRun()){ void(0)&&console.log('[AutoFeed] 自动触发'); self.runOnce({isManual:false}); } }catch(e){} }, 5000);
        },

        destroy: function(){ this._aborted=true; this._running=false; }
      };
      // ===== 【AutoFeed 引擎】结束 =====

      // ===== 【MeowDB — IndexedDB 基础模块】阶段 1B 新增 =====
      // 用途：替代 localStorage/sessionStorage 存储大体积数据（资讯、图片等）
      // 本阶段只搭建基础设施，不迁移已有数据
      const MeowDB = {
        _db: null,
        _dbName: 'meow_phone_db',
        _dbVersion: 1,
        _ready: false,
        _initPromise: null,
        _fallback: false, // IDB 不可用时降级标记

        // Object Stores 定义（onupgradeneeded 中创建）
        _stores: ['kv','feedPacks','chatLogs','summaries','media','forumChats'],

        /**
         * 初始化 / 打开数据库（幂等，多次调用安全）
         * 只在小手机打开时调用一次，后续复用同一个 db 实例
         */
        init: function(){
          if(this._initPromise) return this._initPromise;
          var self = this;
          this._initPromise = new Promise(function(resolve){
            try{
              if(!W.indexedDB){
                console.warn('[MeowDB] IndexedDB 不可用，降级到 localStorage');
                self._fallback = true;
                resolve(false);
                return;
              }
              self._openDB(self._dbVersion, function(ok){
                if (ok){
                  resolve(true);
                } else {
                  // 首次失败 → 尝试删除旧库重建
                  console.warn('[MeowDB] 首次打开失败，尝试删除旧数据库后重建...');
                  self._fallback = false;
                  try{
                    var delReq = W.indexedDB.deleteDatabase(self._dbName);
                    delReq.onsuccess = function(){
                      self._openDB(1, function(ok2){
                        if (!ok2){ self._fallback = true; }
                        resolve(ok2);
                      });
                    };
                    delReq.onerror = function(){ self._fallback = true; resolve(false); };
                    delReq.onblocked = function(){ self._fallback = true; resolve(false); };
                  }catch(e2){
                    self._fallback = true;
                    resolve(false);
                  }
                }
              });
            }catch(e){
              console.error('[MeowDB] init 异常:', e);
              self._fallback = true;
              resolve(false);
            }
          });
          return this._initPromise;
        },

        /** 内部：打开数据库并校验 stores */
        _openDB: function(ver, callback){
          var self = this;
          try{
            var req = W.indexedDB.open(self._dbName, ver);
            req.onupgradeneeded = function(e){
              var db = e.target.result;
              self._stores.forEach(function(name){
                if(!db.objectStoreNames.contains(name)){
                  db.createObjectStore(name);
                }
              });
              void(0)&&console.log('[MeowDB] 数据库升级/创建完成 v'+ver+', stores:', self._stores);
            };
            req.onsuccess = function(e){
              var db = e.target.result;
              // 校验所有 stores 是否存在
              var missing = [];
              self._stores.forEach(function(name){
                if(!db.objectStoreNames.contains(name)) missing.push(name);
              });
              if(missing.length > 0){
                // stores 缺失 → 关闭后以更高版本重新打开触发 onupgradeneeded
                console.warn('[MeowDB] 缺少 stores:', missing, '→ 升级到 v'+(db.version+1));
                var nextVer = db.version + 1;
                db.close();
                self._initPromise = null; // 允许重新 init
                self._openDB(nextVer, callback);
                return;
              }
              self._db = db;
              self._dbVersion = db.version;
              self._ready = true;
              // 处理意外关闭
              db.onclose = function(){ self._ready = false; self._db = null; self._initPromise = null; };
              db.onversionchange = function(){ try{ db.close(); }catch(ex){} self._ready = false; self._db = null; self._initPromise = null; };
              void(0)&&console.log('[MeowDB] ✅ 初始化成功 v'+db.version);
              callback(true);
            };
            req.onerror = function(e){
              console.error('[MeowDB] 初始化失败:', e.target.error);
              self._fallback = true;
              callback(false);
            };
            req.onblocked = function(){
              console.warn('[MeowDB] 数据库被阻塞（可能有其他标签页打开）');
              self._fallback = true;
              callback(false);
            };
          }catch(e){
            console.error('[MeowDB] _openDB 异常:', e);
            self._fallback = true;
            callback(false);
          }
        },

        /** 确保 db 可用 */
        _ensureDB: function(){
          if(this._ready && this._db) return Promise.resolve(this._db);
          if(this._fallback) return Promise.reject(new Error('IDB unavailable'));
          return this.init().then(function(ok){
            if(!ok) throw new Error('IDB unavailable');
            return MeowDB._db;
          });
        },

        /** 通用事务辅助 */
        _tx: function(store, mode){
          return this._ensureDB().then(function(db){
            return db.transaction(store, mode).objectStore(store);
          });
        },

        /**
         * 读取单条
         * @param {string} store - Object Store 名
         * @param {string} key - 键
         * @returns {Promise<any>}
         */
        get: function(store, key){
          return this._tx(store, 'readonly').then(function(os){
            return new Promise(function(resolve, reject){
              var req = os.get(key);
              req.onsuccess = function(){ resolve(req.result === undefined ? null : req.result); };
              req.onerror = function(){ reject(req.error); };
            });
          });
        },

        /**
         * 写入单条
         * @param {string} store - Object Store 名
         * @param {string} key - 键
         * @param {any} value - 值
         */
        put: function(store, key, value){
          return this._tx(store, 'readwrite').then(function(os){
            return new Promise(function(resolve, reject){
              var req = os.put(value, key);
              req.onsuccess = function(){ resolve(true); };
              req.onerror = function(){ reject(req.error); };
            });
          });
        },

        /**
         * 删除单条
         */
        delete: function(store, key){
          return this._tx(store, 'readwrite').then(function(os){
            return new Promise(function(resolve, reject){
              var req = os.delete(key);
              req.onsuccess = function(){ resolve(true); };
              req.onerror = function(){ reject(req.error); };
            });
          });
        },

        /**
         * 遍历获取（用 cursor 代替 getAll，兼容旧 Safari）
         * @param {string} store
         * @param {object} opts - { prefix, limit }
         */
        getAll: function(store, opts){
          var prefix = (opts && opts.prefix) || '';
          var limit = (opts && opts.limit) || 0;
          return this._tx(store, 'readonly').then(function(os){
            return new Promise(function(resolve, reject){
              var results = [];
              var req = os.openCursor();
              req.onsuccess = function(e){
                var cursor = e.target.result;
                if(!cursor){ resolve(results); return; }
                var key = String(cursor.key || '');
                if(!prefix || key.indexOf(prefix) === 0){
                  results.push({ key: cursor.key, value: cursor.value });
                  if(limit > 0 && results.length >= limit){ resolve(results); return; }
                }
                cursor.continue();
              };
              req.onerror = function(){ reject(req.error); };
            });
          });
        },

        /**
         * 清空整个 store
         */
        clear: function(store){
          return this._tx(store, 'readwrite').then(function(os){
            return new Promise(function(resolve, reject){
              var req = os.clear();
              req.onsuccess = function(){ resolve(true); };
              req.onerror = function(){ reject(req.error); };
            });
          });
        },

        /**
         * 重试 IDB 初始化（用于从降级状态恢复）
         * deleteFirst=true 时先删除旧数据库再重建
         */
        retryInit: function(deleteFirst){
          var self = this;
          // 重置状态
          self._ready = false;
          self._db = null;
          self._initPromise = null;
          self._fallback = false;

          if (!deleteFirst || !W.indexedDB){
            return self.init();
          }

          return new Promise(function(resolve){
            try{
              void(0)&&console.log('[MeowDB] 删除旧数据库后重试...');
              var delReq = W.indexedDB.deleteDatabase(self._dbName);
              delReq.onsuccess = function(){
                void(0)&&console.log('[MeowDB] 旧数据库已删除');
                self.init().then(resolve);
              };
              delReq.onerror = function(){
                console.warn('[MeowDB] 删除数据库失败，直接重试');
                self.init().then(resolve);
              };
              delReq.onblocked = function(){
                console.warn('[MeowDB] 删除被阻塞，直接重试');
                self.init().then(resolve);
              };
              // 超时保护
              setTimeout(function(){
                if (!self._ready && !self._initPromise){
                  self.init().then(resolve);
                }
              }, 3000);
            }catch(e){
              self.init().then(resolve);
            }
          });
        },

        /**
         * 估算某个 store 的数据量（条目数 + 粗略字节数）
         */
        getStoreSize: function(store){
          return this._tx(store, 'readonly').then(function(os){
            return new Promise(function(resolve, reject){
              var count = 0;
              var bytes = 0;
              var req = os.openCursor();
              req.onsuccess = function(e){
                var cursor = e.target.result;
                if(!cursor){ resolve({ count: count, bytes: bytes }); return; }
                count++;
                try{
                  var val = cursor.value;
                  if(typeof val === 'string') bytes += val.length * 2;
                  else if(val instanceof Blob) bytes += val.size || 0;
                  else if(val instanceof ArrayBuffer) bytes += val.byteLength || 0;
                  else bytes += JSON.stringify(val).length * 2;
                }catch(ex){ bytes += 100; }
                cursor.continue();
              };
              req.onerror = function(){ reject(req.error); };
            });
          });
        },

        // 便捷方法
        getJSON: function(store, key){
          return this.get(store, key).then(function(val){
            if(val === null || val === undefined) return null;
            if(typeof val === 'string'){ try{ return JSON.parse(val); }catch(e){ return val; } }
            return val;
          });
        },
        putJSON: function(store, key, obj){
          var str;
          try{ str = JSON.stringify(obj); }catch(e){ return Promise.reject(e); }
          return this.put(store, key, str);
        },

        /** 检查是否可用 */
        isReady: function(){ return this._ready && !!this._db; },
        isFallback: function(){ return this._fallback; }
      };
      // ===== 【MeowDB】结束 =====

      // ===== 【MediaStore — 图片存储】基于 MeowDB 'media' store =====
      // 所有图片（头像/表情/壁纸/聊天背景）统一存到 IDB，LS 只存索引
      const MediaStore = {
        _revokeQueue: [],
        _cache: {}, // 内存缓存: key → base64

        /** 存储 base64 图片到 IDB media store */
        put: async function(key, base64){
          if (!base64) return false;
          this._cache[key] = base64;
          if (MeowDB.isReady()){
            try{
              await MeowDB.put('media', key, base64);
              return true;
            }catch(e){ console.warn('[MediaStore] put IDB error:', e); }
          }
          // IDB 不可用时不存 LS（太大了），只保持内存缓存
          return false;
        },

        /** 从 IDB 读取 base64 */
        get: async function(key){
          if (this._cache[key]) return this._cache[key];
          if (MeowDB.isReady()){
            try{
              var val = await MeowDB.get('media', key);
              if (val){
                this._cache[key] = val;
                return val;
              }
            }catch(e){}
          }
          return null;
        },

        /** 删除 */
        del: async function(key){
          delete this._cache[key];
          if (MeowDB.isReady()){
            try{ await MeowDB.delete('media', key); }catch(e){}
          }
        },

        /** 批量存入 */
        putBatch: async function(entries){
          // entries = [{key, value}]
          for (var i = 0; i < entries.length; i++){
            await this.put(entries[i].key, entries[i].value);
          }
        },

        /** 按前缀列出所有 key */
        listKeys: async function(prefix){
          if (MeowDB.isReady()){
            try{
              var all = await MeowDB.getAll('media', { prefix: prefix || '' });
              return all.map(function(item){ return item.key; });
            }catch(e){}
          }
          return Object.keys(this._cache).filter(function(k){ return !prefix || k.indexOf(prefix) === 0; });
        },

        /** 从 localStorage 迁移图片到 IDB（一次性） */
        migrateFromLS: async function(){
          if (!MeowDB.isReady()) return { migrated:0, freedKB:0 };
          var migrated = 0, freedBytes = 0;

          // 1) 迁移头像
          try{
            var avatarRaw = W.localStorage.getItem(LS_PHONE_AVATARS);
            if (avatarRaw && avatarRaw.length > 100){
              var avatars = JSON.parse(avatarRaw);
              var keys = Object.keys(avatars);
              for (var i = 0; i < keys.length; i++){
                var val = avatars[keys[i]];
                if (val && typeof val === 'string' && val.length > 10){
                  await this.put('avatar_' + keys[i], val);
                  migrated++;
                }
              }
              freedBytes += avatarRaw.length * 2;
              W.localStorage.removeItem(LS_PHONE_AVATARS);
              // 存一个索引到 LS（只保存 key 列表，不保存 base64）
              var indexObj = {};
              for (var j = 0; j < keys.length; j++) indexObj[keys[j]] = 'idb';
              W.localStorage.setItem(LS_PHONE_AVATARS, JSON.stringify(indexObj));
              void(0)&&console.log('[MediaStore] 头像迁移完成:', keys.length, '张');
            }
          }catch(e){ console.warn('[MediaStore] avatar migration error:', e); }

          // 2) 迁移表情包
          try{
            var stkRaw = W.localStorage.getItem('meow_phone_g_sticker_packs_v1');
            if (stkRaw && stkRaw.length > 5000){
              var packs = JSON.parse(stkRaw);
              var groups = ['user','char','common'];
              for (var gi = 0; gi < groups.length; gi++){
                var arr = packs[groups[gi]];
                if (!Array.isArray(arr)) continue;
                for (var si = 0; si < arr.length; si++){
                  if (arr[si] && arr[si].data && arr[si].data.length > 100){
                    var stkKey = 'sticker_' + groups[gi] + '_' + si;
                    await this.put(stkKey, arr[si].data);
                    arr[si].data = 'idb:' + stkKey; // 替换为引用
                    migrated++;
                  }
                }
              }
              freedBytes += stkRaw.length * 2;
              phoneSetG('sticker_packs_v1', packs); // 保存缩小后的索引
              void(0)&&console.log('[MediaStore] 表情迁移完成');
            }
          }catch(e){ console.warn('[MediaStore] sticker migration error:', e); }

          // 3) 迁移 settings 里的壁纸
          try{
            var settingsRaw = W.localStorage.getItem('meow_phone_g_settings_data_v1');
            if (settingsRaw && settingsRaw.length * 2 > 100 * 1024){
              var settings = JSON.parse(settingsRaw);
              var changed = false;
              var wpFields = ['wallpaperHome','wallpaperApp'];
              for (var wi = 0; wi < wpFields.length; wi++){
                var field = wpFields[wi];
                if (settings[field] && typeof settings[field] === 'string' && settings[field].length > 1000){
                  await this.put('wp_' + field, settings[field]);
                  settings[field] = 'idb:wp_' + field;
                  migrated++;
                  changed = true;
                }
              }
              if (changed){
                freedBytes += settingsRaw.length * 2;
                phoneSaveSettings(settings);
                freedBytes -= (W.localStorage.getItem('meow_phone_g_settings_data_v1') || '').length * 2;
              }
            }
          }catch(e){ console.warn('[MediaStore] wallpaper migration error:', e); }

          // 4) 迁移 char_extra 里的聊天背景
          try{
            for (var ci = 0; ci < W.localStorage.length; ci++){
              var ck = W.localStorage.key(ci);
              if (ck && ck.indexOf('char_extra') !== -1){
                var cRaw = W.localStorage.getItem(ck) || '';
                if (cRaw.length * 2 > 30 * 1024){
                  var cObj = JSON.parse(cRaw);
                  if (cObj.chatBg && cObj.chatBg.length > 1000 && cObj.chatBg.indexOf('idb:') !== 0){
                    var bgKey = 'chatbg_' + ck;
                    await this.put(bgKey, cObj.chatBg);
                    cObj.chatBg = 'idb:' + bgKey;
                    W.localStorage.setItem(ck, JSON.stringify(cObj));
                    migrated++;
                  }
                }
              }
            }
          }catch(e){ console.warn('[MediaStore] chatBg migration error:', e); }

          var freedKB = (freedBytes / 1024).toFixed(1);
          void(0)&&console.log('[MediaStore] 迁移完成: migrated=' + migrated + ', freed≈' + freedKB + 'KB');
          return { migrated: migrated, freedKB: parseFloat(freedKB) };
        },

        /** 解析可能是 idb: 引用的值，返回实际 base64 */
        resolve: async function(val){
          if (!val || typeof val !== 'string') return val || '';
          if (val.indexOf('idb:') === 0){
            var key = val.slice(4);
            var resolved = await this.get(key);
            return resolved || '';
          }
          return val;
        },

        /** 同步版解析（从缓存取，未缓存返回空） */
        resolveSync: function(val){
          if (!val || typeof val !== 'string') return val || '';
          if (val.indexOf('idb:') === 0){
            return this._cache[val.slice(4)] || '';
          }
          return val;
        }
      };

      // ===== 特殊消息 AI 自动回复（红包/礼物/转账/语音等） =====
      async function _aiReplyForSpecial(npcId, fallbackReplies){
        const db = loadContactsDB();
        const npc = findContactById(db, npcId) || { id:npcId, name:String(npcId), avatar:String(npcId).charAt(0), profile:'' };
        try{
          const cfg = phoneLoadSettings();
          if (cfg.autoReply === false) throw 'autoReply off';
          const apiCfg = PhoneAI._getConfig();
          if (!apiCfg.endpoint || !apiCfg.key) throw 'API not configured';
          if (isBlacklisted && (isBlacklisted(npc.name) || isBlacklisted(npc.id))) throw 'blacklisted';

          if (PhoneAI._requesting){ PhoneAI.abort(); }
          PhoneAI._replySeqId++;
          const mySeqId = PhoneAI._replySeqId;
          const myChatId = String(npcId);

          _showTypingIndicator(npc.name);

          const contextN = _getChatContextN();
          const contextMessages = _getRecentMessagesForAPI(npcId, contextN);
          const systemPrompt = buildSystemPrompt(npcId);

          const result = await PhoneAI.chat({
            messages: contextMessages,
            system: systemPrompt
          });

          if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
            _hideTypingIndicator(); return;
          }
          _hideTypingIndicator();

          if (!result.ok) throw result.error || 'API error';

          const replies = parseMultiMessages(result.data);
          for (var ri=0; ri<replies.length; ri++){
            if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
              _hideTypingIndicator(); return;
            }
            if (ri > 0){
              _showTypingIndicator(npc.name);
              await sleep(_randomBetween(600, 1500));
              if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
                _hideTypingIndicator(); return;
              }
              _hideTypingIndicator();
            }
            pushLog(npcId, 'them', replies[ri]);
            bumpThread(npcId, { lastMsg:replies[ri], lastTime:_now(), unread:0 });
            var msgsEl = root.querySelector('[data-ph="chatMsgs"]');
            if (msgsEl){
              _wxAppendBubble(msgsEl, npc, 'them', replies[ri], _now());
              requestAnimationFrame(function(){ msgsEl.scrollTop = msgsEl.scrollHeight; });
            }
          }
          return; // AI 成功，不走 fallback
        }catch(e){
          _hideTypingIndicator();
          // AI 失败：走 fallback mock 回复
          var fallback = Array.isArray(fallbackReplies) ? fallbackReplies : ['收到了~'];
          var reply = fallback[Math.floor(Math.random()*fallback.length)];
          pushLog(npcId, 'them', reply);
          bumpThread(npcId, { lastMsg:reply, lastTime:_now(), unread:0 });
          var msgs2 = root.querySelector('[data-ph="chatMsgs"]');
          if (msgs2){
            _wxAppendBubble(msgs2, npc, 'them', reply, _now());
            requestAnimationFrame(function(){ msgs2.scrollTop = msgs2.scrollHeight; });
          }
        }
      }

      async function _wxSendChat(npcId){
        const input = root.querySelector('[data-ph="chatInput"]');
        if (!input) return;
        const text = String(input.value||'').trim();
        if (!text) return;
        input.value = '';

        const db = loadContactsDB();
        const npc = findContactById(db, npcId) || { id:npcId, name:String(npcId), avatar:(String(npcId).charAt(0)), profile:'' };

        // 处理引用：如果有引用栏，构造引用文本
        var hasQuote = false;
        var quoteDisplay = '';
        var quoteForAI = '';
        if (_bmState.quotedText){
          hasQuote = true;
          var qLabel = (_bmState.quotedRole === 'me') ? '我' : (npc.name || '对方');
          quoteDisplay = '「' + qLabel + ': ' + (_bmState.quotedText.length > 30 ? _bmState.quotedText.slice(0,30) + '…' : _bmState.quotedText) + '」\n' + text;
          quoteForAI = '（用户引用了一条消息："' + _bmState.quotedText.slice(0, 100) + '"）\n' + text;
          _hideQuoteBar();
        }

        // 写入用户消息（显示引用格式）
        pushLog(npcId, 'me', hasQuote ? quoteDisplay : text);
        bumpThread(npcId, { lastMsg:text, lastTime:_now(), unread:0 });

        const msgs = root.querySelector('[data-ph="chatMsgs"]');
        if (msgs){
          _wxAppendBubble(msgs, npc, 'me', hasQuote ? quoteDisplay : text, _now());
          requestAnimationFrame(()=>{ msgs.scrollTop = msgs.scrollHeight; });
        }

        // === AI 自动回复 ===
        try{
          const cfg = phoneLoadSettings();

          // 前置检查
          if (cfg.autoReply === false) return;
          const apiCfg = PhoneAI._getConfig();
          if (!apiCfg.endpoint || !apiCfg.key){
            try{ toast('请先在设置中配置 API 才能和 AI 聊天'); }catch(e){}
            return;
          }
          if (isBlacklisted(npc.name) || isBlacklisted(npc.id)) return;

          // 有请求在跑，先 abort
          if (PhoneAI._requesting){ PhoneAI.abort(); }

          // 记录本次序列 ID（用于检测切换会话/关闭）
          PhoneAI._replySeqId++;
          const mySeqId = PhoneAI._replySeqId;
          const myChatId = String(npcId);

          // 1. 显示 typing
          _showTypingIndicator(npc.name);

          // 2. 构建上下文
          const contextN = _getChatContextN();
          const contextMessages = _getRecentMessagesForAPI(npcId, contextN);
          const systemPrompt = buildSystemPrompt(npcId);

          // 3. 调用 API
          const result = await PhoneAI.chat({
            messages: contextMessages,
            system: systemPrompt
          });

          // 检查序列是否仍有效（未切换会话/关闭）
          if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
            _hideTypingIndicator();
            return;
          }

          _hideTypingIndicator();

          if (!result.ok){
            // AbortError 静默（error 为 null）
            if (result.error){
              try{ toast(result.error); }catch(e){}
            }
            return;
          }

          // 4. 解析多条消息
          const replies = parseMultiMessages(result.data);

          // 5. 逐条写入（带延迟 + typing 动画）
          for (var ri=0; ri<replies.length; ri++){
            // 检查序列是否仍有效
            if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
              _hideTypingIndicator();
              return;
            }

            if (ri > 0){
              _showTypingIndicator(npc.name);
              var delayMs = _randomBetween(600, 1500);
              // 根据打字效果设置调整延迟
              try{
                var tEff = cfg.typingEffect || 'none';
                if (tEff === 'typewriter') delayMs = _randomBetween(800, 1800);
                else if (tEff === 'fadein') delayMs = _randomBetween(500, 1200);
              }catch(e){}
              await sleep(delayMs);

              // 再次检查
              if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
                _hideTypingIndicator();
                return;
              }
              _hideTypingIndicator();
            }

            // 写入消息
            pushLog(npcId, 'them', replies[ri]);
            bumpThread(npcId, { lastMsg:replies[ri], lastTime:_now(), unread:0 });

            var msgsEl = root.querySelector('[data-ph="chatMsgs"]');
            if (msgsEl){
              _wxAppendBubble(msgsEl, npc, 'them', replies[ri], _now());
              requestAnimationFrame(function(){ msgsEl.scrollTop = msgsEl.scrollHeight; });
            }
          }

          // 阶段B：AI回复完成后概率触发（戳一戳 + 引用）
          _postReplyProbabilityTriggers(npcId, npc, replies);

        }catch(e){
          _hideTypingIndicator();
          // 不崩原则：吞掉异常，不影响后续操作
          try{ if (e && e.name !== 'AbortError') console.warn('[PhoneAI]', e); }catch(_){}
        }
      }

      // sendChat 路由：根据当前 chatTarget 分发
      async function sendChatMessage(){
        const npcId = state.chatTarget;
        if (npcId) return _wxSendChat(npcId);
      }

      function addChatBubble(role,text){
        const msgs = root.querySelector('[data-ph="chatMsgs"]');
        if (!msgs) return;
        const npc = { avatar:'🐱', name:'NPC' };
        _wxAppendBubble(msgs, npc, role, text, _now());
        requestAnimationFrame(()=>{ msgs.scrollTop = msgs.scrollHeight; });
      }

      function generateMockReply(userText,idx,total){
        const short=['嗯嗯~','好的！','哈哈','真的吗？','然后呢？','好耶~','唔…','原来如此！'];
        const mid=['我觉得挺不错的呀，你继续说~','哇，这个想法好有趣！','嘻嘻，你总是能让我开心 💕','等一下，让我想想…','你说得对耶！'];
        const long=['说真的，我最近也在想这个问题。和你讨论总是能给我新灵感呢~','诶你知道吗，我今天看到一个很有意思的东西，正好可以聊聊~'];
        const pools=[short,mid,long];
        return pools[Math.min(idx,pools.length-1)][Math.floor(Math.random()*pools[Math.min(idx,pools.length-1)].length)];
      }

      /* ========== 聊天+号面板 功能实现（数据层 + UI 弹窗） ========== */

      // ====== 路由分发 ======
      function _handleChatPlusAction(cpact, npcId){
        switch(cpact){
          case 'photo':    _cpPhoto(npcId); break;
          case 'camera':   _cpCamera(npcId); break;
          case 'videocall':_cpVideoCall(npcId); break;
          case 'location': _cpLocation(npcId); break;
          case 'redpack':  _cpRedPack(npcId); break;
          case 'gift':     _cpGift(npcId); break;
          case 'transfer': _cpTransfer(npcId); break;
          case 'music':    _cpMusic(npcId); break;
          default: try{toast('功能开发中…');}catch(e){} break;
        }
      }

      // ====== 通用：发送特殊气泡 + 记录日志 ======
      function _cpSendSpecial(npcId, displayText, meta){
        const db = loadContactsDB();
        const npc = findContactById(db, npcId) || { id:npcId, name:String(npcId), avatar:String(npcId).charAt(0), profile:'' };
        // 日志中保存为带 meta 标记的文本
        const logText = meta._logText || displayText;
        pushLog(npcId, 'me', logText);
        bumpThread(npcId, { lastMsg:displayText, lastTime:_now(), unread:0 });
        const msgs = root.querySelector('[data-ph="chatMsgs"]');
        if (msgs){
          _wxAppendBubble(msgs, npc, 'me', displayText, _now(), meta);
          requestAnimationFrame(()=>{ msgs.scrollTop = msgs.scrollHeight; });
        }
        // 收起+号面板
        const grid = root.querySelector('[data-ph="chatPlusGrid"]');
        if (grid) grid.style.display = 'none';
      }

      // ====== 通用：弹出 overlay ======
      function _cpShowOverlay(innerHtml){
        root.querySelectorAll('.wxCPOverlay').forEach(o=>o.remove());
        const ov = doc.createElement('div');
        ov.className = 'wxCPOverlay';
        ov.style.cssText = 'position:absolute;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px;';
        ov.innerHTML = `<div class="wxCPModal" style="
          background:rgba(255,255,255,.96);backdrop-filter:blur(12px);
          border-radius:16px;width:100%;max-width:280px;padding:20px;
          box-shadow:0 8px 32px rgba(0,0,0,.18);
        ">${innerHtml}</div>`;
        ov.addEventListener('click', (e)=>{ if(e.target===ov) ov.remove(); });
        root.appendChild(ov);
        return ov;
      }

      // ====== 1. 照片：上传图片 ======
      function _cpPhoto(npcId){
        const fi = doc.createElement('input');
        fi.type = 'file'; fi.accept = 'image/*'; fi.multiple = false;
        fi.style.display = 'none';
        fi.addEventListener('change', ()=>{
          const file = fi.files && fi.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ()=>{
            const dataUrl = reader.result;
            _cpSendSpecial(npcId, '[图片]', { type:'image', src:dataUrl, _logText:'[图片]' });
            // NPC 用 AI 回复（fallback mock）
            setTimeout(()=>{
              _aiReplyForSpecial(npcId, ['好看！📸','哇，这是什么？','收到图片啦~','这张好棒！']);
            }, 800 + Math.random()*600);
          };
          reader.readAsDataURL(file);
          fi.remove();
        });
        root.appendChild(fi);
        fi.click();
      }

      // ====== 2. 拍摄：使用摄像头 ======
      function _cpCamera(npcId){
        // 移动端用 capture 属性
        const fi = doc.createElement('input');
        fi.type = 'file'; fi.accept = 'image/*'; fi.setAttribute('capture','environment');
        fi.style.display = 'none';
        fi.addEventListener('change', ()=>{
          const file = fi.files && fi.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ()=>{
            _cpSendSpecial(npcId, '[拍摄照片]', { type:'image', src:reader.result, _logText:'[拍摄照片]' });
          };
          reader.readAsDataURL(file);
          fi.remove();
        });
        root.appendChild(fi);
        fi.click();
      }

      // ====== 3. 视频通话：模拟通话 UI ======
      function _cpVideoCall(npcId){
        const db = loadContactsDB();
        const npc = findContactById(db, npcId) || { id:npcId, name:String(npcId) };
        const ov = _cpShowOverlay(`
          <div style="text-align:center;">
            <div style="font-size:14px;font-weight:600;margin-bottom:6px;">${esc(npc.name)}</div>
            <div style="font-size:11px;color:rgba(20,24,28,.4);margin-bottom:16px;">选择通话方式</div>
            <div style="display:flex;gap:10px;justify-content:center;">
              <button data-act="cpCallStart" data-calltype="voice" style="flex:1;padding:10px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:#07c160;color:#fff;font-size:13px;cursor:pointer;">📞 语音通话</button>
              <button data-act="cpCallStart" data-calltype="video" style="flex:1;padding:10px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:#07c160;color:#fff;font-size:13px;cursor:pointer;">📹 视频通话</button>
            </div>
          </div>
        `);
        ov.querySelectorAll('[data-act="cpCallStart"]').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const callType = btn.getAttribute('data-calltype');
            ov.remove();
            _cpStartCall(npcId, npc, callType);
          });
        });
      }

      function _cpStartCall(npcId, npc, callType){
        const startTime = Date.now();
        const ov = doc.createElement('div');
        ov.className = 'wxCPOverlay';
        ov.style.cssText = 'position:absolute;inset:0;z-index:9999;background:linear-gradient(135deg,#1a1a2e,#16213e);display:flex;flex-direction:column;align-items:center;justify-content:center;';
        ov.innerHTML = `
          <div style="font-size:48px;margin-bottom:12px;">${npc.avatar||npc.name.charAt(0)}</div>
          <div style="font-size:16px;color:#fff;font-weight:600;">${esc(npc.name)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:4px;" data-el="callStatus">正在呼叫…</div>
          <div style="font-size:14px;color:rgba(255,255,255,.7);margin-top:8px;" data-el="callTimer" style="display:none;"></div>
          <button data-act="cpCallEnd" style="margin-top:40px;width:56px;height:56px;border-radius:50%;background:#e74c3c;border:none;color:#fff;font-size:22px;cursor:pointer;">📞</button>
        `;
        root.appendChild(ov);

        const statusEl = ov.querySelector('[data-el="callStatus"]');
        const timerEl = ov.querySelector('[data-el="callTimer"]');
        let connected = false;
        let timerInt = null;

        // 模拟接通
        const connectDelay = setTimeout(()=>{
          connected = true;
          if (statusEl) statusEl.textContent = '通话中';
          timerInt = setInterval(()=>{
            const sec = Math.floor((Date.now() - startTime - 2000) / 1000);
            const mm = String(Math.floor(sec/60)).padStart(2,'0');
            const ss = String(sec%60).padStart(2,'0');
            if (timerEl) timerEl.textContent = `${mm}:${ss}`;
          }, 1000);
        }, 2000);

        ov.querySelector('[data-act="cpCallEnd"]').addEventListener('click', ()=>{
          clearTimeout(connectDelay);
          if (timerInt) clearInterval(timerInt);
          const dur = connected ? Math.floor((Date.now() - startTime - 2000)/1000) : 0;
          const durStr = connected ? `${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')}` : '未接通';
          ov.remove();
          _cpSendSpecial(npcId, `[${callType==='video'?'视频':'语音'}通话] ${durStr}`, {
            type:'videocall', callType, duration:durStr, _logText:`[${callType==='video'?'视频':'语音'}通话] ${durStr}`
          });
        });
      }

      // ====== 4. 位置：模拟发送虚拟位置 ======
      function _cpLocation(npcId){
        const locations = [
          {name:'东京塔', lat:'35.658', lng:'139.745'},
          {name:'上海外滩', lat:'31.240', lng:'121.490'},
          {name:'巴黎铁塔', lat:'48.858', lng:'2.294'},
          {name:'纽约时代广场', lat:'40.758', lng:'-73.985'},
          {name:'伦敦大本钟', lat:'51.500', lng:'-0.124'},
          {name:'自定义位置…', lat:'', lng:'', custom:true},
        ];
        let optHtml = '';
        locations.forEach((loc,i)=>{
          optHtml += `<div data-act="cpLocPick" data-idx="${i}" style="padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.06);cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;${loc.custom?'color:#07c160;font-weight:600;':''}">
            <span>📍</span><span>${esc(loc.name)}</span>
          </div>`;
        });
        const ov = _cpShowOverlay(`
          <div style="font-size:14px;font-weight:600;margin-bottom:10px;">📍 发送位置</div>
          <div style="max-height:200px;overflow-y:auto;border-radius:10px;border:1px solid rgba(0,0,0,.06);">${optHtml}</div>
          <div data-el="customInput" style="display:none;margin-top:10px;">
            <input type="text" placeholder="输入位置名称…" data-el="locNameInput" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);font-size:13px;box-sizing:border-box;"/>
            <button data-act="cpLocSendCustom" style="margin-top:8px;width:100%;padding:8px;border-radius:8px;background:#07c160;color:#fff;border:none;font-size:13px;cursor:pointer;">发送</button>
          </div>
        `);
        ov.querySelectorAll('[data-act="cpLocPick"]').forEach(el=>{
          el.addEventListener('click', ()=>{
            const idx = parseInt(el.getAttribute('data-idx'));
            const loc = locations[idx];
            if (loc && loc.custom){
              const ci = ov.querySelector('[data-el="customInput"]');
              if (ci) ci.style.display = 'block';
              return;
            }
            ov.remove();
            _cpSendSpecial(npcId, `[位置] ${loc.name}`, { type:'location', locName:loc.name, _logText:`[位置] ${loc.name}` });
          });
        });
        const sendCustomBtn = ov.querySelector('[data-act="cpLocSendCustom"]');
        if (sendCustomBtn) sendCustomBtn.addEventListener('click', ()=>{
          const inp = ov.querySelector('[data-el="locNameInput"]');
          const name = inp ? String(inp.value||'').trim() : '';
          if (!name){ try{toast('请输入位置名称');}catch(e){} return; }
          ov.remove();
          _cpSendSpecial(npcId, `[位置] ${name}`, { type:'location', locName:name, _logText:`[位置] ${name}` });
        });
      }

      // ====== 5. 红包 ======
      function _cpRedPack(npcId){
        const w = loadWallet();
        const ov = _cpShowOverlay(`
          <div style="text-align:center;">
            <div style="font-size:28px;margin-bottom:6px;">🧧</div>
            <div style="font-size:14px;font-weight:600;margin-bottom:4px;">发红包</div>
            <div style="font-size:11px;color:rgba(20,24,28,.4);margin-bottom:12px;">余额：${w.balance} 金币</div>
            <input type="number" data-el="rpAmount" placeholder="金额" min="1" max="${w.balance}" value="10" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);font-size:14px;text-align:center;box-sizing:border-box;margin-bottom:8px;"/>
            <input type="text" data-el="rpGreeting" placeholder="恭喜发财，大吉大利" value="恭喜发财" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);font-size:12px;text-align:center;box-sizing:border-box;margin-bottom:12px;"/>
            <button data-act="cpRPSend" style="width:100%;padding:10px;border-radius:10px;background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;">塞进红包</button>
          </div>
        `);
        ov.querySelector('[data-act="cpRPSend"]').addEventListener('click', ()=>{
          const amt = parseInt(ov.querySelector('[data-el="rpAmount"]').value) || 0;
          const greeting = String(ov.querySelector('[data-el="rpGreeting"]').value||'').trim() || '恭喜发财';
          if (amt <= 0){ try{toast('金额不能为0');}catch(e){} return; }
          if (!walletSpend(amt, `红包 → ${npcId}`)){
            try{toast('余额不足');}catch(e){} return;
          }
          ov.remove();
          _cpSendSpecial(npcId, `[红包] ${greeting}`, { type:'redpack', amount:amt, greeting, _logText:`[红包] ${amt}金币 ${greeting}` });
          // NPC 收红包后用 AI 回复（fallback mock）
          setTimeout(()=>{
            _aiReplyForSpecial(npcId, ['谢谢红包！🧧','哇～好开心！','收到啦，谢谢～ 💕','太大方了吧！']);
          }, 800 + Math.random()*600);
        });
      }

      // ====== 6. 礼物 ======
      function _cpGift(npcId){
        const gifts = [
          {emoji:'🌹', name:'玫瑰花', price:5},
          {emoji:'🧸', name:'小熊', price:20},
          {emoji:'💍', name:'戒指', price:100},
          {emoji:'🎂', name:'蛋糕', price:30},
          {emoji:'🌸', name:'樱花', price:8},
          {emoji:'🎆', name:'烟花', price:50},
          {emoji:'👑', name:'皇冠', price:200},
          {emoji:'🍫', name:'巧克力', price:10},
        ];
        const w = loadWallet();
        let gHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">';
        gifts.forEach((g,i)=>{
          gHtml += `<div data-act="cpGiftPick" data-idx="${i}" style="text-align:center;padding:8px 4px;border-radius:10px;border:1px solid rgba(0,0,0,.06);cursor:pointer;">
            <div style="font-size:24px;">${g.emoji}</div>
            <div style="font-size:10px;margin-top:2px;">${esc(g.name)}</div>
            <div style="font-size:9px;color:rgba(20,24,28,.4);">${g.price}币</div>
          </div>`;
        });
        gHtml += '</div>';
        const ov = _cpShowOverlay(`
          <div style="font-size:14px;font-weight:600;margin-bottom:4px;">🎁 送礼物</div>
          <div style="font-size:11px;color:rgba(20,24,28,.4);margin-bottom:10px;">余额：${w.balance} 金币</div>
          ${gHtml}
        `);
        ov.querySelectorAll('[data-act="cpGiftPick"]').forEach(el=>{
          el.addEventListener('click', ()=>{
            const idx = parseInt(el.getAttribute('data-idx'));
            const g = gifts[idx];
            if (!g) return;
            if (!walletSpend(g.price, `礼物[${g.name}] → ${npcId}`)){
              try{toast('余额不足');}catch(e){} return;
            }
            ov.remove();
            _cpSendSpecial(npcId, `[礼物] ${g.name}`, { type:'gift', giftEmoji:g.emoji, giftName:g.name, amount:g.price, _logText:`[礼物] ${g.name} ${g.price}金币` });
            // NPC 收到礼物用 AI 回复（fallback mock）
            setTimeout(()=>{
              _aiReplyForSpecial(npcId, [`好喜欢${g.name}！${g.emoji}`,`哇好可爱！谢谢～`,`你对我太好了 💕`,`收到${g.name}了，开心！`]);
            }, 800 + Math.random()*600);
          });
        });
      }

      // ====== 7. 转账 ======
      function _cpTransfer(npcId){
        const w = loadWallet();
        const ov = _cpShowOverlay(`
          <div style="text-align:center;">
            <div style="font-size:28px;margin-bottom:6px;">💰</div>
            <div style="font-size:14px;font-weight:600;margin-bottom:4px;">转账</div>
            <div style="font-size:11px;color:rgba(20,24,28,.4);margin-bottom:12px;">余额：${w.balance} 金币</div>
            <input type="number" data-el="tfAmount" placeholder="转账金额" min="1" max="${w.balance}" value="50" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);font-size:16px;text-align:center;box-sizing:border-box;margin-bottom:8px;"/>
            <input type="text" data-el="tfNote" placeholder="添加备注（可选）" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);font-size:12px;text-align:center;box-sizing:border-box;margin-bottom:12px;"/>
            <button data-act="cpTFSend" style="width:100%;padding:10px;border-radius:10px;background:linear-gradient(135deg,#f39c12,#e67e22);color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;">确认转账</button>
          </div>
        `);
        ov.querySelector('[data-act="cpTFSend"]').addEventListener('click', ()=>{
          const amt = parseInt(ov.querySelector('[data-el="tfAmount"]').value) || 0;
          const note = String(ov.querySelector('[data-el="tfNote"]').value||'').trim() || '转账';
          if (amt <= 0){ try{toast('金额不能为0');}catch(e){} return; }
          if (!walletSpend(amt, `转账 → ${npcId}: ${note}`)){
            try{toast('余额不足');}catch(e){} return;
          }
          ov.remove();
          _cpSendSpecial(npcId, `[转账] ${amt}金币`, { type:'transfer', amount:amt, note, _logText:`[转账] ${amt}金币 ${note}` });
          // NPC 收到转账用 AI 回复（fallback mock）
          setTimeout(()=>{
            _aiReplyForSpecial(npcId, ['收到转账了，谢谢！💰','不用给我这么多啦～','好的收到！','你太客气了 😊']);
          }, 800 + Math.random()*600);
        });
      }

      // ====== 8. 音乐：发送歌曲一起听 ======
      function _cpMusic(npcId){
        const songs = [
          {name:'晴天', artist:'周杰伦'},
          {name:'小幸运', artist:'田馥甄'},
          {name:'夜曲', artist:'周杰伦'},
          {name:'起风了', artist:'买辣椒也用券'},
          {name:'光辉岁月', artist:'Beyond'},
          {name:'红玫瑰', artist:'陈奕迅'},
          {name:'告白气球', artist:'周杰伦'},
          {name:'说散就散', artist:'袁娅维'},
        ];
        let sHtml = '';
        songs.forEach((s,i)=>{
          sHtml += `<div data-act="cpMusicPick" data-idx="${i}" style="padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.04);cursor:pointer;display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;border-radius:6px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;flex-shrink:0;">🎵</div>
            <div><div style="font-size:13px;font-weight:500;">${esc(s.name)}</div><div style="font-size:10.5px;color:rgba(20,24,28,.4);">${esc(s.artist)}</div></div>
          </div>`;
        });
        const ov = _cpShowOverlay(`
          <div style="font-size:14px;font-weight:600;margin-bottom:4px;">🎵 选择歌曲</div>
          <div style="font-size:11px;color:rgba(20,24,28,.4);margin-bottom:10px;">邀请 TA 一起听</div>
          <div style="max-height:240px;overflow-y:auto;border-radius:10px;border:1px solid rgba(0,0,0,.06);">${sHtml}</div>
          <div style="margin-top:10px;">
            <input type="text" data-el="customSong" placeholder="或输入自定义歌名…" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.1);font-size:12px;box-sizing:border-box;"/>
            <button data-act="cpMusicCustomSend" style="margin-top:6px;width:100%;padding:8px;border-radius:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;font-size:12px;cursor:pointer;">发送自定义歌曲</button>
          </div>
        `);
        ov.querySelectorAll('[data-act="cpMusicPick"]').forEach(el=>{
          el.addEventListener('click', ()=>{
            const idx = parseInt(el.getAttribute('data-idx'));
            const s = songs[idx];
            if (!s) return;
            ov.remove();
            _cpSendSpecial(npcId, `[音乐] ${s.name} - ${s.artist}`, { type:'music', songName:s.name, artist:s.artist, _logText:`[音乐] ${s.name} - ${s.artist}` });
            // NPC 用 AI 回复（fallback mock）
            setTimeout(()=>{
              _aiReplyForSpecial(npcId, [`我也好喜欢《${s.name}》！🎧`,`一起听～好浪漫 🎵`,`${s.artist}的歌都好好听！`,`正好想听歌，谢谢～`]);
            }, 800 + Math.random()*600);
          });
        });
        const customBtn = ov.querySelector('[data-act="cpMusicCustomSend"]');
        if (customBtn) customBtn.addEventListener('click', ()=>{
          const inp = ov.querySelector('[data-el="customSong"]');
          const name = inp ? String(inp.value||'').trim() : '';
          if (!name){ try{toast('请输入歌名');}catch(e){} return; }
          ov.remove();
          _cpSendSpecial(npcId, `[音乐] ${name}`, { type:'music', songName:name, artist:'', _logText:`[音乐] ${name}` });
          // NPC 用 AI 回复（fallback mock）
          setTimeout(()=>{
            _aiReplyForSpecial(npcId, ['好听！🎵','一起听～','这首歌不错！','谢谢分享～ 🎧']);
          }, 800 + Math.random()*600);
        });
      }

      // ====== 阶段B: 9. 戳一戳 ======

      // 戳一戳默认设置
      function _loadPokeSettings(npcId){
        var charEx = _loadCharExtra(npcId);
        var ps = charEx.pokeSettings || {};
        return {
          enabled: ps.enabled !== false,
          aiAutoPoke: ps.aiAutoPoke !== false,
          pokeCooldownMin: ps.pokeCooldownMin || 30,
          aiPokeChance: (typeof ps.aiPokeChance === 'number') ? ps.aiPokeChance : 0.05,
          aiQuoteEnabled: ps.aiQuoteEnabled !== false,
          aiQuoteChance: (typeof ps.aiQuoteChance === 'number') ? ps.aiQuoteChance : 0.15,
          lastPokeAt: ps.lastPokeAt || 0
        };
      }

      function _savePokeSettings(npcId, ps){
        var charEx = _loadCharExtra(npcId);
        charEx.pokeSettings = ps;
        _saveCharExtra(npcId, charEx);
      }

      // 发送戳一戳系统消息
      function _cpPoke(npcId){
        var ps = _loadPokeSettings(npcId);
        if (!ps.enabled){
          try{ toast('戳一戳已关闭'); }catch(e){}
          return;
        }
        var db = loadContactsDB();
        var npc = findContactById(db, npcId) || { id:npcId, name:String(npcId), avatar:String(npcId).charAt(0), profile:'' };

        // 写入戳一戳系统消息
        var pokeText = '[戳一戳] 你戳了戳 ' + npc.name;
        pushLog(npcId, 'system', pokeText);
        bumpThread(npcId, { lastMsg:'你戳了戳 '+npc.name, lastTime:_now(), unread:0 });

        // UI 追加
        var msgs = root.querySelector('[data-ph="chatMsgs"]');
        if (msgs){
          _wxAppendPokeBubble(msgs, '你戳了戳 ' + npc.name);
          requestAnimationFrame(function(){ msgs.scrollTop = msgs.scrollHeight; });
        }

        // AI 回应戳一戳（不受 autoReply 限制，戳一戳始终触发 AI 回应）
        setTimeout(function(){
          _pokeAIReply(npcId, npc.name);
        }, 600 + Math.random() * 400);
      }

      // 戳一戳系统消息气泡
      function _wxAppendPokeBubble(msgs, text){
        var b = doc.createElement('div');
        b.className = 'wxChatBubble system wxPokeBubble';
        b.innerHTML = '<div class="wxPokeMsg">── ' + esc(text) + ' ──</div>';
        msgs.appendChild(b);
      }

      // AI 回应戳一戳（不受 autoReply 限制）
      async function _pokeAIReply(npcId, npcName){
        try{
          var apiCfg = PhoneAI._getConfig();
          if (!apiCfg.endpoint || !apiCfg.key) return;

          var db = loadContactsDB();
          var npc = findContactById(db, npcId) || { id:npcId, name:String(npcId), avatar:String(npcId).charAt(0), profile:'' };

          if (PhoneAI._requesting) PhoneAI.abort();
          PhoneAI._replySeqId++;
          var mySeqId = PhoneAI._replySeqId;
          var myChatId = String(npcId);

          _showTypingIndicator(npc.name);

          var contextN = _getChatContextN();
          var contextMessages = _getRecentMessagesForAPI(npcId, contextN);
          var systemPrompt = buildSystemPrompt(npcId);
          systemPrompt += '\n\n【特殊事件】用户刚刚戳了戳你。用 1-2 条简短消息回应，可以是反戳、撒娇、假装生气等，语气随角色性格和当前对话氛围而定。不要提及"戳一戳"这三个字，只用自然的反应。';

          var result = await PhoneAI.chat({ messages: contextMessages, system: systemPrompt });
          if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
            _hideTypingIndicator(); return;
          }
          _hideTypingIndicator();

          if (!result.ok) return;

          var replies = parseMultiMessages(result.data);
          for (var ri = 0; ri < replies.length; ri++){
            if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
              _hideTypingIndicator(); return;
            }
            if (ri > 0){
              _showTypingIndicator(npc.name);
              await sleep(_randomBetween(400, 1000));
              if (mySeqId !== PhoneAI._replySeqId || state.chatTarget !== myChatId){
                _hideTypingIndicator(); return;
              }
              _hideTypingIndicator();
            }
            pushLog(npcId, 'them', replies[ri]);
            bumpThread(npcId, { lastMsg: replies[ri], lastTime: _now(), unread: 0 });
            var msgsEl = root.querySelector('[data-ph="chatMsgs"]');
            if (msgsEl){
              _wxAppendBubble(msgsEl, npc, 'them', replies[ri], _now());
              requestAnimationFrame(function(){ msgsEl.scrollTop = msgsEl.scrollHeight; });
            }
          }

          // AI 回复完成后的概率触发（戳一戳 + 引用）
          _postReplyProbabilityTriggers(npcId, npc, replies);

        }catch(e){
          _hideTypingIndicator();
        }
      }

      // ====== 阶段B：AI回复后概率触发逻辑 ======
      function _postReplyProbabilityTriggers(npcId, npc, replies){
        try{
          var ps = _loadPokeSettings(npcId);

          // AI 自动戳一戳
          if (ps.aiAutoPoke && ps.enabled){
            var now = _now();
            var cooldownMs = (ps.pokeCooldownMin || 30) * 60 * 1000;
            if (now - (ps.lastPokeAt || 0) > cooldownMs){
              var chance = ps.aiPokeChance || 0.05;
              if (Math.random() < chance){
                ps.lastPokeAt = now;
                _savePokeSettings(npcId, ps);
                // 延迟追加 AI 戳一戳
                setTimeout(function(){
                  if (state.chatTarget !== String(npcId)) return;
                  var pokeText = '[戳一戳] ' + (npc.name||'对方') + ' 戳了戳你';
                  pushLog(npcId, 'system', pokeText);
                  var msgs = root.querySelector('[data-ph="chatMsgs"]');
                  if (msgs){
                    _wxAppendPokeBubble(msgs, (npc.name||'对方') + ' 戳了戳你');
                    requestAnimationFrame(function(){ msgs.scrollTop = msgs.scrollHeight; });
                  }
                }, 1500 + Math.random() * 2000);
              }
            }
          }

          // AI 偶尔引用用户消息
          if (ps.aiQuoteEnabled){
            var qChance = ps.aiQuoteChance || 0.15;
            if (Math.random() < qChance){
              // 从最近 5 条用户消息中随机选一条
              var log = getLog(npcId);
              var userMsgs = [];
              for (var i = log.length - 1; i >= 0 && userMsgs.length < 5; i--){
                if (log[i].role === 'me' && !log[i].recalled && String(log[i].text||'').length > 2){
                  // 排除系统类消息
                  if (!String(log[i].text).startsWith('[戳一戳]')){
                    userMsgs.push(log[i]);
                  }
                }
              }
              if (userMsgs.length > 0){
                var picked = userMsgs[Math.floor(Math.random() * userMsgs.length)];
                // 在最后一条 AI 回复气泡前面插入引用块
                setTimeout(function(){
                  if (state.chatTarget !== String(npcId)) return;
                  var allBubbles = root.querySelectorAll('.wxChatBubble.them');
                  var lastThem = allBubbles.length > 0 ? allBubbles[allBubbles.length - 1] : null;
                  if (lastThem){
                    var quoteDiv = doc.createElement('div');
                    quoteDiv.className = 'wxAIQuoteBlock';
                    quoteDiv.textContent = '引用了你的消息：' + (picked.text.length > 40 ? picked.text.slice(0,40)+'…' : picked.text);
                    var content = lastThem.querySelector('.wxCBContent');
                    if (content) content.insertBefore(quoteDiv, content.firstChild);
                  }
                }, 300);
              }
            }
          }
        }catch(e){}
      }

      /* ========== 日历 App ========== */
      function renderCalendar(container){
        const now=new Date();
        const y=now.getFullYear(),m=now.getMonth(),today=now.getDate();
        const firstDay=new Date(y,m,1).getDay();
        const dim=new Date(y,m+1,0).getDate();
        const dip=new Date(y,m,0).getDate();
        const mn=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
        let html=`<div class="phCard" style="margin-top:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <span style="font-weight:700;color:var(--ph-text);font-size:16px;">${y}年 ${mn[m]}</span>
            <span style="font-size:12px;color:var(--ph-text-dim);">现实时间</span>
          </div>
          <div class="calGrid">`;
        ['日','一','二','三','四','五','六'].forEach(h=>{html+=`<div class="calH">${h}</div>`;});
        for(let i=firstDay-1;i>=0;i--) html+=`<div class="calD other">${dip-i}</div>`;
        for(let d=1;d<=dim;d++) html+=`<div class="calD${d===today?' today':''}">${d}</div>`;
        const rem=(firstDay+dim)%7===0?0:7-(firstDay+dim)%7;
        for(let i=1;i<=rem;i++) html+=`<div class="calD other">${i}</div>`;
        html+=`</div></div>`;
        // Events
        const events = [
          {time:'10:00',title:'与好友约会',color:'#6366f1'},
          {time:'14:00',title:'下午茶时间',color:'#ec4899'},
          {time:'20:00',title:'晚间聊天',color:'#8b5cf6'},
        ];
        html += `<div class="phCard"><div style="font-weight:600;color:var(--ph-text);margin-bottom:10px;">📌 今日事项</div>`;
        events.forEach(ev=>{
          html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);">
            <div style="width:4px;height:32px;border-radius:2px;background:${ev.color};flex-shrink:0;"></div>
            <div><div style="font-size:13px;color:var(--ph-text);">${ev.title}</div><div style="font-size:11px;color:var(--ph-text-dim);">${ev.time}</div></div>
          </div>`;
        });
        html+='</div>';
        container.innerHTML=html;
      }

      /* ========== 论坛 App（微博风格） ========== */
      /* ========== 论坛 App（完整社交：NPC帖子 + 关注/粉丝 + 主页 + 发帖） ========== */
      /* ======= 阶段 3a：小红书风格论坛 ======= */

      // 论坛内部导航状态（模块级，进入论坛时初始化）
      var _forumNav = { tab: 'home', meSubTab: 'posts', detail: null };

      // SVG 图标辅助（论坛底栏专用）
      function _fIco(path){ return '<svg viewBox="0 0 24 24" fill="currentColor">'+path+'</svg>'; }

      function renderForum(container){
        setAppBarRight('<button class="phBarRBtn" data-act="afForumSettings" title="论坛资讯设置">⚙️</button>');
        // 重置容器（避免旧内容残留）
        container.style.cssText = '';
        // 如果在详情页，直接渲染详情
        if (_forumNav.detail) {
          renderForumPostDetail(_forumNav.detail, container);
          return;
        }
        // 使用 forumShell：内容区绝对定位 + 底部 TabBar 绝对定位
        container.innerHTML = `
          <div class="forumShell">
            <div class="forumInnerContent" data-ph="forumInnerContent"></div>
            <nav class="forumInnerTabBar">
              <button class="forumInnerTabBtn${_forumNav.tab==='home'?' on':''}" data-act="forumInternalTab" data-tab="home">
                ${_fIco('<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>')}
                <span>首页</span>
              </button>
              <button class="forumInnerTabBtn${_forumNav.tab==='follow'?' on':''}" data-act="forumInternalTab" data-tab="follow">
                ${_fIco('<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>')}
                <span>关注</span>
              </button>
              <button class="forumInnerTabBtn" data-act="forumCompose">
                <div class="forumComposeTabIcon">
                  ${_fIco('<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>')}
                </div>
                <span style="color:var(--ph-text-dim);">发帖</span>
              </button>
              <button class="forumInnerTabBtn${_forumNav.tab==='messages'?' on':''}" data-act="forumInternalTab" data-tab="messages">
                ${_fIco('<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>')}
                <span>消息</span>
              </button>
              <button class="forumInnerTabBtn${_forumNav.tab==='me'?' on':''}" data-act="forumInternalTab" data-tab="me">
                ${_fIco('<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>')}
                <span>我</span>
              </button>
            </nav>
          </div>`;
        var inner = container.querySelector('[data-ph="forumInnerContent"]');
        _renderForumTab(inner, _forumNav.tab);
      }

      function _renderForumTab(inner, tab){
        _forumNav.tab = tab;
        _forumDMCurrent = null; // 切 tab 时退出 DM 聊天
        // 恢复右上角设置按钮
        setAppBarRight('<button class="phBarRBtn" data-act="afForumSettings" title="论坛资讯设置">⚙️</button>');
        // 更新底栏按钮选中状态
        root.querySelectorAll('.forumInnerTabBtn[data-tab]').forEach(function(b){
          b.classList.toggle('on', b.getAttribute('data-tab')===tab);
        });
        if (tab === 'home') renderForumHome(inner);
        else if (tab === 'follow') renderForumFollow(inner);
        else if (tab === 'messages') renderForumMessages(inner);
        else if (tab === 'me') renderForumMe(inner);
      }

      function switchForumTab(el){ /* 旧接口兼容，不再使用 */ }

      /* ── 首页：双列瀑布流卡片 ── */
      function renderForumHome(container){
        const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
        var fd = phoneLoadForum(chatUID); fd = forumEnsureDefaults(fd);
        var bmSet = new Set(_safeArr(fd.bookmarks));
        var list = (fd.posts||[]).slice().sort(function(a,b){return(b.time||0)-(a.time||0);});
        if (!list.length){
          container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--ph-text-dim);font-size:13px;">还没有内容~<br>可点下方 ⊕ 发帖，或右上角 ⚙️ 生成资讯</div>';
          return;
        }
        // 双列卡片布局
        var html = '<div class="forumGrid">';
        list.forEach(function(f){
          var imgArr = Array.isArray(f.images) ? f.images.slice(0,1) : []; // 卡片只显示首张图
          var imgHtml = '';
          if (imgArr.length > 0) {
            var theme = (typeof imgArr[0]==='number') ? (imgArr[0]%8) : (_hashStr(String(imgArr[0])+'')%8);
            imgHtml = '<div class="forumGridCardImg"><div class="fake-img" data-theme="'+theme+'"></div></div>';
          } else {
            // 无图显示内容摘要背景
            imgHtml = '<div class="forumGridCardNoImg">'+esc((f.authorAvatar||'📝'))+'</div>';
          }
          var title = esc(f.content||'').slice(0,50) + (f.content&&f.content.length>50?'…':'');
          var cmtCount = Array.isArray(f.comments)?f.comments.length:0;
          html += '<div class="forumGridCard" data-act="forumCardDetail" data-postid="'+esc(f.id)+'">' +
            imgHtml +
            '<div class="forumGridCardBody">' +
              '<div class="forumGridCardTitle">'+title+'</div>' +
              '<div class="forumGridCardMeta">' +
                '<div class="forumGridCardAvatar">'+esc(f.authorAvatar||'?')+'</div>' +
                '<div class="forumGridCardAuthor">'+esc(f.authorName||'匿名')+'</div>' +
                '<div class="forumGridCardLikes"><svg viewBox="0 0 24 24" fill="currentColor" style="width:11px;height:11px;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'+
                (f.likes||0)+'</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
      }

      /* ── 关注 Tab：关注的人的帖子，单列 ── */
      function renderForumFollow(container){
        const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
        var fd = phoneLoadForum(chatUID); fd = forumEnsureDefaults(fd);
        var followIds = new Set((fd.following||[]).map(function(f){return f.id;}));
        var list = (fd.posts||[]).filter(function(p){return followIds.has(p.authorId);}).sort(function(a,b){return(b.time||0)-(a.time||0);});
        if (!followIds.size){
          container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--ph-text-dim);font-size:13px;">还没有关注的人~<br>进入帖子点击作者头像可以关注 TA</div>';
          return;
        }
        if (!list.length){
          container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--ph-text-dim);font-size:13px;">关注的人还没发过帖子~</div>';
          return;
        }
        var html = '<div class="forumFollowFeed">';
        list.forEach(function(f){
          var imgArr = Array.isArray(f.images) ? f.images.slice(0,1) : [];
          var thumbHtml = '';
          if (imgArr.length) {
            var theme = (typeof imgArr[0]==='number')?(imgArr[0]%8):(_hashStr(String(imgArr[0]))%8);
            thumbHtml = '<div class="forumFollowItemThumb"><div class="fake-img" data-theme="'+theme+'" style="height:80px;width:80px;border-radius:6px;float:right;margin-left:10px;"></div></div>';
          }
          html += '<div class="forumFollowItem" data-act="forumCardDetail" data-postid="'+esc(f.id)+'">' +
            '<div class="forumFollowItemAvatar">'+esc(f.authorAvatar||'?')+'</div>' +
            '<div class="forumFollowItemBody">' +
              '<div class="forumFollowItemHead"><span class="forumFollowItemName">'+esc(f.authorName||'匿名')+'</span><span class="forumFollowItemTime">'+forumFmtTime(f.time)+'</span></div>' +
              thumbHtml +
              '<div class="forumFollowItemContent">'+esc(f.content||'')+'</div>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
      }

      /* ── 消息 Tab（3b）：论坛私信系统 ── */

      // 存储键：论坛私信数据（与聊天App完全隔离）
      var _FORUM_DM_KEY = 'meow_forum_dm_v1';
      // 当前打开的私信 npcId（null = 在列表页）
      var _forumDMCurrent = null;

      function _loadForumDMs(){
        try{ return lsGet(_FORUM_DM_KEY, {}); }catch(e){ return {}; }
      }
      function _saveForumDMs(data){
        try{ lsSet(_FORUM_DM_KEY, data); }catch(e){}
      }
      function _getForumDMThread(npcId){
        var data = _loadForumDMs();
        return data[npcId] || null;
      }
      function _saveForumDMThread(npcId, thread){
        var data = _loadForumDMs();
        data[npcId] = thread;
        _saveForumDMs(data);
      }
      function _forumDMFmt(ts){
        if(!ts) return '';
        var d = new Date(ts); var now = new Date();
        var diff = now - d;
        if(diff < 60000) return '刚刚';
        if(diff < 3600000) return Math.floor(diff/60000)+'分钟前';
        if(diff < 86400000) return Math.floor(diff/3600000)+'小时前';
        return d.getMonth()+1+'月'+d.getDate()+'日';
      }

      function renderForumMessages(container){
        _forumDMCurrent = null;
        var data = _loadForumDMs();
        var threads = Object.values(data).sort(function(a,b){return(b.lastTime||0)-(a.lastTime||0);});

        var html = '<div class="forumDMShell"><div class="forumDMListInner">' +
          '<div class="forumDMListHeader"><span class="forumDMListTitle">私信</span></div>';

        if (!threads.length){
          html += '<div class="forumDMEmpty">还没有私信~<br>进入帖子点击作者名字即可发起私信</div>';
        } else {
          threads.forEach(function(t){
            html += '<div class="forumDMItem" data-act="forumDMOpen" data-npcid="'+esc(t.npcId)+'">' +
              '<div class="forumDMAvatar">'+esc(t.avatarHint||'?')+
                (t.unreadCount>0?'<div class="forumDMUnreadDot"></div>':'') +
              '</div>' +
              '<div class="forumDMItemBody">' +
                '<div class="forumDMItemHead">' +
                  '<span class="forumDMItemName">'+esc(t.npcName||t.npcId)+'</span>' +
                  '<span class="forumDMItemTime">'+_forumDMFmt(t.lastTime)+'</span>' +
                '</div>' +
                '<div class="forumDMItemPreview">'+esc(t.lastMessage||'')+'</div>' +
              '</div>' +
            '</div>';
          });
        }
        html += '</div></div>';
        container.innerHTML = html;
      }

      // 打开 / 创建与某 NPC 的私信会话
      function openForumDM(npcId, npcName, avatarHint){
        if (!npcId) return;
        _forumDMCurrent = npcId;
        var thread = _getForumDMThread(npcId) || { npcId:npcId, npcName:npcName||npcId, avatarHint:avatarHint||npcId.charAt(0), lastMessage:'', lastTime:0, unreadCount:0, messages:[] };
        if(!thread.npcName && npcName) thread.npcName = npcName;
        if(!thread.avatarHint && avatarHint) thread.avatarHint = avatarHint;
        thread.unreadCount = 0;
        _saveForumDMThread(npcId, thread);
        // 设置右上角返回按钮（显示对方名字）
        setAppBarRight('<button class="phBarRBtn" data-act="forumDMBack" style="font-size:12px;color:var(--ph-text-sub);">返回消息列表</button>');
        // 找到消息 Tab 的 container
        var inner = root.querySelector('[data-ph="forumInnerContent"]');
        if (inner) renderForumDMChat(inner, npcId, thread);
      }

      function renderForumDMChat(container, npcId, thread){
        var msgs = thread.messages || [];
        var msgsHtml = '';
        msgs.forEach(function(m){
          if(m.role==='user'){
            msgsHtml += '<div class="forumDMBubble mine">'+esc(m.content)+'</div>';
          } else {
            msgsHtml += '<div class="forumDMTheirRow">' +
              '<div class="forumDMTheirAvatar">'+esc(thread.avatarHint||'?')+'</div>' +
              '<div class="forumDMBubble theirs">'+esc(m.content)+'</div>' +
            '</div>';
          }
        });
        if(!msgs.length){
          msgsHtml = '<div style="text-align:center;color:var(--ph-text-dim);font-size:12px;padding:20px 0;">开始和 <strong style="color:var(--ph-text);">'+esc(thread.npcName||npcId)+'</strong> 的私信吧~</div>';
        }

        container.innerHTML = '<div class="forumDMChatShell">' +
          '<div class="forumDMChatMessages">'+msgsHtml+'</div>' +
          '<div class="forumDMChatBar">' +
            '<input class="forumDMChatInput" data-fdm-input="1" placeholder="发私信给 '+esc(thread.npcName||npcId)+'…" maxlength="300" />' +
            '<button class="forumDMChatSend" data-act="forumDMSend" data-npcid="'+esc(npcId)+'">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>';

        var msgArea = container.querySelector('.forumDMChatMessages');
        if(msgArea) setTimeout(function(){ msgArea.scrollTop = msgArea.scrollHeight; }, 50);

        var inp = container.querySelector('[data-fdm-input]');
        if(inp) inp.addEventListener('keydown', function(ev){
          if(ev.key==='Enter'){ ev.preventDefault(); container.querySelector('[data-act="forumDMSend"]')?.click?.(); }
        });
      }

      async function sendForumDM(npcId){
        var inner = root.querySelector('[data-ph="forumInnerContent"]');
        var inp = inner ? inner.querySelector('[data-fdm-input]') : null;
        var text = inp ? String(inp.value||'').trim() : '';
        if(!text) return;
        inp.value = '';
        inp.disabled = true;

        var thread = _getForumDMThread(npcId) || { npcId:npcId, npcName:npcId, avatarHint:npcId.charAt(0), lastMessage:'', lastTime:0, unreadCount:0, messages:[] };
        thread.messages.push({ role:'user', content:text, ts:Date.now() });
        thread.lastMessage = '我：'+text; thread.lastTime = Date.now();
        _saveForumDMThread(npcId, thread);

        // 立即渲染（乐观更新）
        if(inner) renderForumDMChat(inner, npcId, thread);
        // 显示正在输入
        var msgArea = inner ? inner.querySelector('.forumDMChatMessages') : null;
        if(msgArea){
          var typing = document.createElement('div');
          typing.className='forumDMTyping'; typing.textContent='…对方正在输入';
          msgArea.appendChild(typing);
          msgArea.scrollTop = msgArea.scrollHeight;
        }

        // 调用 AI（复用 PhoneAI，私信专用 prompt）
        try{
          var npc = null;
          try{ var db=loadContactsDB(); npc=findContactById(db,npcId); }catch(e){}
          var npcNameStr = (npc&&npc.name)||thread.npcName||npcId;

          // 构建上下文（最近10条）
          var ctxMsgs = thread.messages.slice(-10).map(function(m){
            return { role: m.role==='user'?'user':'assistant', content: m.content };
          });

          var sysPrompt = '你是「'+npcNameStr+'」，正在论坛的私信系统里和用户聊天。\n- 语气像社交平台私信，随意简短，有自己的性格\n- 不要写旁白或动作描写\n- 一次只回复一条消息（不用多条分隔）\n- 用中文回复，30字以内';
          if(npc&&npc.profile) sysPrompt += '\n- 你的人设：'+String(npc.profile).slice(0,200);

          var reply = '';
          if(typeof PhoneAI!=='undefined' && PhoneAI.chat){
            var result = await PhoneAI.chat(ctxMsgs, sysPrompt);
            reply = (result||'').trim() || '嗯~';
          } else {
            reply = '[AI未就绪]';
          }

          thread = _getForumDMThread(npcId) || thread;
          thread.messages.push({ role:'assistant', content:reply, ts:Date.now() });
          thread.lastMessage = npcNameStr+'：'+reply; thread.lastTime = Date.now();
          _saveForumDMThread(npcId, thread);
          if(inner) renderForumDMChat(inner, npcId, thread);
        }catch(err){
          try{toast('发送失败，请重试');}catch(e){}
          var inpRetry = inner?inner.querySelector('[data-fdm-input]'):null;
          if(inpRetry) inpRetry.disabled = false;
        }
      }


      /* ── 我 Tab：个人主页 ── */
      function renderForumMe(container){
        const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
        var fd = phoneLoadForum(chatUID); fd = forumEnsureDefaults(fd);
        // 获取用户名/头像（从 persona 或默认）
        var myName = '我'; var myAvatar = '😊';
        try{
          var persona = lsGet('meow_phone_persona_v1', null);
          if (persona && persona.name) myName = persona.name;
          if (persona && persona.avatar) myAvatar = persona.avatar;
        }catch(e){}
        var myPosts = (fd.posts||[]).filter(function(p){return p.authorId==='me';}).sort(function(a,b){return(b.time||0)-(a.time||0);});
        var bookmarkedPosts = (fd.posts||[]).filter(function(p){return (fd.bookmarks||[]).indexOf(p.id)>=0;}).sort(function(a,b){return(b.time||0)-(a.time||0);});
        var followCount = (fd.following||[]).length;
        var followerCount = (fd.followers||[]).length;
        var totalLikes = myPosts.reduce(function(s,p){return s+(p.likes||0);},0);

        var html = '<div class="forumMePage">' +
          '<div class="forumMeBanner">' +
            '<div class="forumMeAvatar">'+esc(myAvatar)+'</div>' +
            '<div class="forumMeName">'+esc(myName)+'</div>' +
            '<div class="forumMeStats">' +
              '<div class="forumMeStat" data-act="forumShowFollowing" style="cursor:pointer;"><div class="forumMeStatNum">'+followCount+'</div><div class="forumMeStatLabel">关注</div></div>' +
              '<div class="forumMeStat" data-act="forumShowFollowers" style="cursor:pointer;"><div class="forumMeStatNum">'+followerCount+'</div><div class="forumMeStatLabel">粉丝</div></div>' +
              '<div class="forumMeStat"><div class="forumMeStatNum">'+totalLikes+'</div><div class="forumMeStatLabel">获赞</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="forumMeSubTabs">' +
            '<button class="forumMeSubTab'+(_forumNav.meSubTab==='posts'?' on':'')+'" data-act="forumMeTab" data-subtab="posts">笔记</button>' +
            '<button class="forumMeSubTab'+(_forumNav.meSubTab==='bookmarks'?' on':'')+'" data-act="forumMeTab" data-subtab="bookmarks">收藏</button>' +
          '</div>' +
          '<div data-ph="forumMeContent">' +
        '</div>';
        container.innerHTML = html;
        _renderForumMeContent(container.querySelector('[data-ph="forumMeContent"]'), _forumNav.meSubTab, myPosts, bookmarkedPosts);
      }

      function _renderForumMeContent(el, subtab, myPosts, bookmarkedPosts){
        if (!el) return;
        var list = subtab === 'bookmarks' ? bookmarkedPosts : myPosts;
        if (!list.length){
          var msg = subtab==='bookmarks' ? '还没有收藏的帖子~' : '还没有发过帖子~<br>点下方 ⊕ 来写第一条吧';
          el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--ph-text-dim);font-size:13px;">'+msg+'</div>';
          return;
        }
        var html = '<div class="forumGrid">';
        list.forEach(function(f){
          var imgArr = Array.isArray(f.images) ? f.images.slice(0,1) : [];
          var imgHtml = '';
          if (imgArr.length > 0) {
            var theme = (typeof imgArr[0]==='number')?(imgArr[0]%8):(_hashStr(String(imgArr[0]))%8);
            imgHtml = '<div class="forumGridCardImg"><div class="fake-img" data-theme="'+theme+'"></div></div>';
          } else {
            imgHtml = '<div class="forumGridCardNoImg">'+esc(f.authorAvatar||'📝')+'</div>';
          }
          var title = esc(f.content||'').slice(0,50)+(f.content&&f.content.length>50?'…':'');
          html += '<div class="forumGridCard" data-act="forumCardDetail" data-postid="'+esc(f.id)+'">' +
            imgHtml +
            '<div class="forumGridCardBody">' +
              '<div class="forumGridCardTitle">'+title+'</div>' +
              '<div class="forumGridCardMeta">' +
                '<div class="forumGridCardLikes"><svg viewBox="0 0 24 24" fill="currentColor" style="width:11px;height:11px;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'+
                (f.likes||0)+'</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';
        el.innerHTML = html;
      }

      /* ── 帖子详情页 ── */
      function openForumPostDetail(postId){
        _forumNav.detail = postId;
        var body = root.querySelector('[data-ph="appBody"]');
        if (body) renderForumPostDetail(postId, body);
      }

      function renderForumPostDetail(postId, container){
        const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
        var fd = phoneLoadForum(chatUID); fd = forumEnsureDefaults(fd);
        var bmSet = new Set(_safeArr(fd.bookmarks));
        var post = (fd.posts||[]).find(function(p){return p.id===postId;});
        if (!post){
          container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--ph-text-dim);">帖子不存在</div>';
          return;
        }
        setAppBarRight('<button class="phBarRBtn" data-act="afForumSettings" title="论坛资讯设置">⚙️</button>');
        var cmts = Array.isArray(post.comments) ? post.comments : [];
        var imgArr = Array.isArray(post.images) ? post.images : [];
        var imgHtml = imgArr.length ? '<div class="forumDetailImgArea">'+renderFakeImages(imgArr)+'</div>' : '';
        var isBm = bmSet.has(post.id);
        var isNpc = post.authorId && post.authorId!=='me' && post.authorId!=='system';
        var npcAttr = isNpc ? 'data-act="forumNpcProfile" data-npcid="'+esc(post.authorId)+'"' : '';
        // 评论 HTML
        var cmtListHtml = '';
        if (cmts.length) {
          cmts.forEach(function(c, ci){
            var cLiked = c._myLike ? ' liked' : '';
            var cAvatar = (c.name||'?').charAt(0);
            // 非"我"的评论者名字可点击发起私信
            var cmtNpcId = c.authorId || (c.name && c.name!=='我' ? 'npc_'+c.name : null);
            var cmtNameStyle = cmtNpcId ? 'cursor:pointer;color:var(--ph-accent,#6366f1);' : '';
            var cmtNameAttr = cmtNpcId ? 'data-act="forumStartDM" data-npcid="'+esc(cmtNpcId)+'" data-npcname="'+esc(c.name||'')+'" data-npcavatar="'+esc(cAvatar)+'"' : '';
            cmtListHtml += '<div class="forumDetailCmtItem">' +
              '<div class="forumDetailCmtAvatar">'+esc(cAvatar)+'</div>' +
              '<div class="forumDetailCmtBody">' +
                '<div class="forumDetailCmtName" style="'+cmtNameStyle+'" '+cmtNameAttr+'>'+esc(c.name||'匿名')+'</div>' +
                '<div class="forumDetailCmtText">'+esc(c.text||'')+'</div>' +
              '</div>' +
              '<button class="forumDetailCmtLike'+cLiked+'" data-act="forumCommentLike" data-postid="'+esc(post.id)+'" data-cidx="'+ci+'">❤️ '+(c.likes||'')+'</button>' +
            '</div>';
          });
        } else {
          cmtListHtml = '<div class="forumDetailCmtEmpty">还没有评论，快来第一个说说~</div>';
        }
        var quoteHtml = '';
        if (post.quoteFrom){
          quoteHtml = '<div class="feedQuoteBlock" style="margin:0 14px 8px;"><div class="fqAuthor">@'+esc(post.quoteFrom.authorName||'')+'</div><div class="fqContent">'+esc((post.quoteFrom.content||'').slice(0,120))+'</div></div>';
        }
        var tagHtml = post._tag ? '<div class="forumDetailTag">#'+esc(post._tag)+'</div>' : '';

        container.style.cssText = '';  // 清空 forum shell 的 style 残留
        container.innerHTML = '<div class="forumDetailPage">' +
          imgHtml +
          '<div class="forumDetailAuthorRow">' +
            '<div class="forumDetailAvatar" '+npcAttr+'>'+esc(post.authorAvatar||'?')+'</div>' +
            '<div class="forumDetailAuthorName" '+npcAttr+'>'+esc(post.authorName||'匿名')+'</div>' +
            '<div class="forumDetailTime">'+forumFmtTime(post.time)+'</div>' +
            (isNpc ? '<button class="npcFollowBtn'+(((fd.following||[]).find(function(x){return x.id===post.authorId;}))?(' following'):'')+'" data-act="forumFollowToggle" data-npcid="'+esc(post.authorId)+'" style="margin-left:4px;padding:5px 12px;font-size:12px;">'+(((fd.following||[]).find(function(x){return x.id===post.authorId;}))?'已关注':'关注')+'</button>' : '') +
            (isNpc ? '<button class="npcChatBtn" data-act="forumStartDM" data-npcid="'+esc(post.authorId)+'" data-npcname="'+esc(post.authorName||'')+'" data-npcavatar="'+esc(post.authorAvatar||'')+'" style="margin-left:4px;padding:5px 12px;font-size:12px;border-radius:14px;">私信</button>' : '') +
          '</div>' +
          '<div class="forumDetailContent">'+esc(post.content||'')+'</div>' +
          quoteHtml + tagHtml +
          '<div class="forumDetailActions">' +
            '<button class="forumDetailAction" data-act="forumDetailComment"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>'+cmts.length+'</button>' +
            '<button class="forumDetailAction" data-act="forumShare" data-postid="'+esc(post.id)+'"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 0 0 0-6 3 3 0 0 0-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9a3 3 0 0 0 0 6c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 0 0 2.92 2.92A2.92 2.92 0 0 0 21 18.92 2.92 2.92 0 0 0 18 16.08z"/></svg>'+(post.shares||0)+'</button>' +
            '<button class="forumDetailAction'+(post.liked?' liked':'')+'" data-act="forumLike" data-postid="'+esc(post.id)+'"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'+(post.likes||0)+'</button>' +
            '<button class="forumDetailAction'+(isBm?' bookmarked':'')+'" data-act="forumBookmark" data-postid="'+esc(post.id)+'"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg></button>' +
          '</div>' +
          '<div class="forumDetailCmtTitle">评论 '+cmts.length+'</div>' +
          cmtListHtml +
          '<div style="height:70px;"></div>' +
          '<div class="forumDetailCommentBar">' +
            '<input class="forumDetailCmtInput" data-ph="forumDetailCmtInput" placeholder="发表评论…" maxlength="200" />' +
            '<button class="forumDetailCmtSendBtn" data-act="forumDetailCmtSend" data-postid="'+esc(post.id)+'">发送</button>' +
          '</div>' +
        '</div>';

        // Enter 键发送
        var inp = container.querySelector('[data-ph="forumDetailCmtInput"]');
        if (inp) inp.addEventListener('keydown', function(ev){
          if (ev.key==='Enter'){ ev.preventDefault(); container.querySelector('[data-act="forumDetailCmtSend"]')?.click?.(); }
        });
      }

      /* ── 发帖页（全屏，替换 appBody 内容） ── */
      function openForumComposePage(){
        var body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        _forumNav.detail = null;
        var TAGS = ['热门','八卦','心情','生活','记录','交友'];
        var selTag = TAGS[0]; var selImgs = [];
        body.style.cssText = '';  // 清空 forum shell 残留
        body.innerHTML = '<div class="forumComposePage">' +
          '<div class="forumComposeHeader">' +
            '<button class="phBarRBtn" data-act="forumComposeBack" style="font-size:13px;color:var(--ph-text-sub);">取消</button>' +
            '<span class="forumComposeHeaderTitle">发布笔记</span>' +
            '<button class="forumComposeSubmitBtn" data-act="forumNewPost">发布</button>' +
          '</div>' +
          '<div class="forumComposeBody">' +
            '<input class="forumComposeTitleInput" data-ph="fcTitle" placeholder="填写标题（可选）" maxlength="50" />' +
            '<textarea class="forumComposeTextArea" data-ph="fcText" placeholder="分享你的故事…" maxlength="500"></textarea>' +
          '</div>' +
          '<div class="forumComposeImgRow">' +
            '<span style="font-size:12px;color:var(--ph-text-dim);align-self:center;margin-right:4px;">图片：</span>' +
            [0,1,2,3,4,5,6,7].map(function(i){ return '<button class="forumComposeImgChip" data-act="fcImgToggle" data-idx="'+i+'" data-theme="'+i+'" style="background:linear-gradient(135deg,'+['#ffecd2,#fcb69f','#a1c4fd,#c2e9fb','#d4fc79,#96e6a1','#fbc2eb,#a6c1ee','#ffd89b,#19547b','#667eea,#764ba2','#f093fb,#f5576c','#4facfe,#00f2fe'][i]+'");border-radius:6px;width:24px;height:24px;padding:0;"></button>'; }).join('') +
          '</div>' +
          '<div class="forumComposeTagRow">' +
            '<span style="font-size:12px;color:var(--ph-text-dim);align-self:center;margin-right:4px;">话题：</span>' +
            TAGS.map(function(tag){ return '<button class="forumComposeTagChip'+(tag===selTag?' selected':'')+'" data-act="fcTagSelect" data-tag="'+esc(tag)+'">#'+esc(tag)+'</button>'; }).join('') +
          '</div>' +
        '</div>';
        // 图片选择
        body.querySelectorAll('[data-act="fcImgToggle"]').forEach(function(btn){
          btn.addEventListener('click', function(){
            var idx = parseInt(btn.getAttribute('data-idx'));
            var pos = selImgs.indexOf(idx);
            if (pos>=0){ selImgs.splice(pos,1); btn.classList.remove('selected'); }
            else if(selImgs.length<3){ selImgs.push(idx); btn.classList.add('selected'); }
            else { try{toast('最多选 3 张图片');}catch(e){} }
          });
        });
        // 话题选择
        body.querySelectorAll('[data-act="fcTagSelect"]').forEach(function(btn){
          btn.addEventListener('click', function(){
            selTag = btn.getAttribute('data-tag');
            body.querySelectorAll('[data-act="fcTagSelect"]').forEach(function(b){ b.classList.toggle('selected', b===btn); });
          });
        });
        // 取消
        var cancelBtn = body.querySelector('[data-act="forumComposeBack"]');
        if (cancelBtn) cancelBtn.addEventListener('click', function(){ _forumNav.detail=null; renderForum(body); });
        // 发布
        var postBtn = body.querySelector('[data-act="forumNewPost"]');
        if (postBtn) postBtn.addEventListener('click', function(){
          var text = (body.querySelector('[data-ph="fcText"]')?.value||'').trim();
          var titleVal = (body.querySelector('[data-ph="fcTitle"]')?.value||'').trim();
          if (!text){ try{toast('请填写内容');}catch(e){} return; }
          const chatUID2 = (typeof phoneGetChatUID==='function')?phoneGetChatUID():'';
          var fd2 = phoneLoadForum(chatUID2); fd2 = forumEnsureDefaults(fd2);
          fd2.posts.unshift({
            id:'my_'+Date.now(), authorId:'me', authorName:'我', authorAvatar:'😊',
            content: (titleVal ? titleVal+'\n' : '') + text,
            images: selImgs.slice(),
            time:Date.now(), likes:0, comments:[], shares:0, liked:false,
            _source:'user', _tag: selTag||'热门'
          });
          phoneSaveForum(fd2, chatUID2);
          try{toast('发布成功！');}catch(e){}
          _forumNav.detail = null;
          renderForum(body);
        });
        setTimeout(function(){ try{body.querySelector('[data-ph="fcText"]')?.focus?.();}catch(e){} }, 100);
      }

      function renderForumFeed(container, tab){ /* 旧接口兼容，重定向 */ _renderForumTab(container, tab==='hot'?'home':tab); }

      function toggleForumLike(el){
        try{
          const postId = el.getAttribute('data-postid');
          const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
          let fd = phoneLoadForum(chatUID);
          const post = (fd.posts||[]).find(p=>p.id===postId);
          if (post){
            post.liked = !post.liked;
            post.likes = Math.max(0, (post.likes||0) + (post.liked ? 1 : -1));
            phoneSaveForum(fd, chatUID);
          }
          // 如果在详情页刷新详情，否则刷新列表
          if (_forumNav && _forumNav.detail === postId) {
            var bodyL = root.querySelector('[data-ph="appBody"]');
            if (bodyL) renderForumPostDetail(postId, bodyL);
          } else {
            var inner = root.querySelector('[data-ph="forumInnerContent"]');
            if (inner) _renderForumTab(inner, _forumNav ? _forumNav.tab : 'home');
          }
        }catch(e){}
      }

      function toggleForumBookmark(el){
        try{
          const postId = el.getAttribute('data-postid');
          const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
          let fd = phoneLoadForum(chatUID);
          if(!Array.isArray(fd.bookmarks)) fd.bookmarks = [];
          const idx = fd.bookmarks.indexOf(postId);
          if(idx >= 0){
            fd.bookmarks.splice(idx, 1);
            try{ toast('已取消收藏'); }catch(e){}
          } else {
            fd.bookmarks.push(postId);
            try{ toast('已收藏'); }catch(e){}
          }
          phoneSaveForum(fd, chatUID);
          if (_forumNav && _forumNav.detail === postId) {
            var bodyBM = root.querySelector('[data-ph="appBody"]');
            if (bodyBM) renderForumPostDetail(postId, bodyBM);
          } else {
            var innerBM = root.querySelector('[data-ph="forumInnerContent"]');
            if (innerBM) _renderForumTab(innerBM, _forumNav ? _forumNav.tab : 'home');
          }
        }catch(e){}
      }

      function toggleForumCommentLike(el){
        try{
          const postId = el.getAttribute('data-postid');
          const cidx = parseInt(el.getAttribute('data-cidx'));
          if(isNaN(cidx)) return;
          const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
          let fd = phoneLoadForum(chatUID);
          const post = (fd.posts||[]).find(p=>p.id===postId);
          if(post && Array.isArray(post.comments)){
            var cmt = post.comments[cidx];
            if(cmt){
              cmt._myLike = !cmt._myLike;
              cmt.likes = Math.max(0, (Number(cmt.likes)||0) + (cmt._myLike ? 1 : -1));
              phoneSaveForum(fd, chatUID);
            }
          }
          if (_forumNav && _forumNav.detail === postId) {
            var bodyCL = root.querySelector('[data-ph="appBody"]');
            if (bodyCL) renderForumPostDetail(postId, bodyCL);
          } else {
            var innerCL = root.querySelector('[data-ph="forumInnerContent"]');
            if (innerCL) _renderForumTab(innerCL, _forumNav ? _forumNav.tab : 'home');
          }
        }catch(e){}
      }

      // -------- 论坛：NPC 主页 --------
      function openNpcProfile(npcId){
        if (!npcId) return;
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        let npc = null;
        try{ const db = loadContactsDB(); npc = findContactById(db, npcId); }catch(e){}
        const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
        let fd = phoneLoadForum(chatUID);
        fd = forumEnsureDefaults(fd);
        const npcPosts = (fd.posts||[]).filter(p=>p.authorId===npcId).sort((a,b)=>(b.time||0)-(a.time||0));
        const isFollowing = (fd.following||[]).some(f=>f.id===npcId);
        const bmSet = new Set(_safeArr(fd.bookmarks));
        const name = npc?.name || npcId;
        const avatar = npc?.avatar || (name||'?').charAt(0);
        const bio = npc?.profile || '这个人很神秘，什么都没写~';
        let html = `
          <div class="npcProfile">
            <button data-act="forumBack" style="position:absolute;left:12px;top:12px;appearance:none;border:0;
              background:var(--ph-glass);color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;
              cursor:pointer;font-size:12px;">‹ 返回</button>
            <div class="npcProfileAvatar">${esc(avatar)}</div>
            <div class="npcProfileName">${esc(name)}</div>
            <div class="npcProfileBio">${esc(bio)}</div>
            <div class="npcProfileStats">
              <div class="npcProfileStat"><div class="npcProfileStatNum">${npcPosts.length}</div><div class="npcProfileStatLabel">帖子</div></div>
              <div class="npcProfileStat"><div class="npcProfileStatNum">${Math.floor(Math.random()*50)+5}</div><div class="npcProfileStatLabel">粉丝</div></div>
            </div>
            <div class="npcProfileActions">
              <button class="npcFollowBtn${isFollowing?' following':''}" data-act="forumFollowToggle" data-npcid="${esc(npcId)}">
                ${isFollowing?'已关注':'+ 关注'}
              </button>
              <button class="npcChatBtn" data-act="forumNpcChat" data-npcid="${esc(npcId)}">${_phFlatIcon('💬')} 私聊</button>
            </div>
          </div>`;
        if (npcPosts.length){
          npcPosts.forEach(f=>{
            const cmts = Array.isArray(f.comments) ? f.comments : [];
            let quoteHtml = '';
            if (f.quoteFrom) {
              quoteHtml = `<div class="feedQuoteBlock"><div class="fqAuthor">@${esc(f.quoteFrom.authorName||'')}</div><div class="fqContent">${esc(f.quoteFrom.content||'').slice(0,120)}${(f.quoteFrom.content||'').length>120?'…':''}</div></div>`;
            }
            let cmtHtml = '';
            if (cmts.length) {
              cmtHtml = '<div class="feedComments">';
              cmts.slice(-5).forEach((c, ci) => {
                var cLikes = Number(c.likes)||0;
                var cLikedCls = c._myLike ? ' liked' : '';
                cmtHtml += `<div class="feedCommentItem" style="display:flex;align-items:flex-start;gap:2px;">
                  <span class="fcName">${esc(c.name||'匿名')}：</span>
                  <span class="fcText" style="flex:1;">${esc(c.text||'')}</span>
                  <button class="feedAction${cLikedCls}" data-act="forumCommentLike" data-postid="${esc(f.id)}" data-cidx="${ci}" style="margin-left:auto;flex-shrink:0;padding:0 2px;font-size:11px;min-width:28px;justify-content:flex-end;">❤️ ${cLikes||''}</button>
                </div>`;
              });
              cmtHtml += '</div>';
            }
            const npcImgHtml = renderFakeImages(Array.isArray(f.images)?f.images:[]);
            const npcBm = bmSet.has(f.id);
            html += `<div class="feedItem">
              <div class="feedHead">
                <div class="feedAvatar">${esc(f.authorAvatar)}</div>
                <div class="feedAuthor">${esc(f.authorName)}</div>
                <div class="feedTime">${forumFmtTime(f.time)}</div>
              </div>
              <div class="feedContent">${esc(f.content)}</div>
              ${npcImgHtml}
              ${quoteHtml}
              ${cmtHtml}
              <div class="feedActions">
                <button class="feedAction" data-act="forumComment" data-postid="${esc(f.id)}"><svg class="phIco" style="width:13px;height:13px;fill:currentColor;vertical-align:middle;margin-right:2px;" viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg> ${cmts.length}</button>
                <button class="feedAction" data-act="forumShare" data-postid="${esc(f.id)}"><svg class="phIco" style="width:13px;height:13px;fill:currentColor;vertical-align:middle;margin-right:2px;" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 0 0 0-6 3 3 0 0 0-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9a3 3 0 0 0 0 6c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 0 0 2.92 2.92A2.92 2.92 0 0 0 21 18.92 2.92 2.92 0 0 0 18 16.08z"/></svg> ${f.shares||0}</button>
                <button class="feedAction${f.liked?' liked':''}" data-act="forumLike" data-postid="${esc(f.id)}"><svg class="phIco" style="width:13px;height:13px;fill:currentColor;vertical-align:middle;margin-right:2px;" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> ${f.likes||0}</button>
                <button class="feedAction${npcBm?' bookmarked':''}" data-act="forumBookmark" data-postid="${esc(f.id)}" style="margin-left:auto;"><svg class="phIco" style="width:13px;height:13px;fill:currentColor;vertical-align:middle;" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg></button>
              </div>
              <div class="feedCommentInput" data-cmtwrap="${esc(f.id)}" style="display:none;">
                <input type="text" placeholder="写评论…" data-cmtinput="${esc(f.id)}" maxlength="200" />
                <button data-act="forumCommentSend" data-postid="${esc(f.id)}">发送</button>
              </div>
            </div>`;
          });
        } else {
          html += `<div style="text-align:center;padding:30px;color:var(--ph-text-dim);font-size:13px;">这位 NPC 还没有发过帖子~</div>`;
        }
        body.innerHTML = html;
      }

      // -------- 论坛：关注/粉丝 列表 --------
      function renderForumFollowList(type){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
        let fd = phoneLoadForum(chatUID);
        const list = type === 'followers' ? (fd.followers||[]) : (fd.following||[]);
        const title = type === 'followers' ? '粉丝' : '关注';
        let html = `<div style="padding:12px 14px;">
          <button data-act="forumBack" style="appearance:none;border:0;background:var(--ph-glass);
            color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
            margin-bottom:10px;">‹ 返回论坛</button>
          <div style="font-weight:600;color:var(--ph-text);font-size:15px;">${title}（${list.length}）</div>
        </div>`;
        if (!list.length){
          html += `<div style="text-align:center;padding:30px;color:var(--ph-text-dim);font-size:13px;">
            ${type==='followers'?'还没有粉丝~':'还没有关注任何人~'}
          </div>`;
        } else {
          list.forEach(item=>{
            html += `<div class="followListItem" data-act="forumNpcProfile" data-npcid="${esc(item.id)}">
              <div class="followListAvatar">${esc(item.avatar)}</div>
              <div class="followListInfo">
                <div class="followListName">${esc(item.name)}</div>
                <div class="followListBio">${esc(item.bio||'')}</div>
              </div>
            </div>`;
          });
        }
        body.innerHTML = html;
      }

      // -------- 论坛：关注/取消关注 --------
      function toggleForumFollow(npcId){
        if (!npcId) return;
        const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
        let fd = phoneLoadForum(chatUID);
        const idx = (fd.following||[]).findIndex(f=>f.id===npcId);
        if (idx >= 0){
          fd.following.splice(idx, 1);
          try{toast('已取消关注');}catch(e){}
        } else {
          let npc = null;
          try{ const db = loadContactsDB(); npc = findContactById(db, npcId); }catch(e){}
          if (!fd.following) fd.following = [];
          fd.following.push({
            id: npcId, name: npc?.name || npcId,
            avatar: npc?.avatar || '?', bio: npc?.profile || '',
          });
          try{toast('已关注');}catch(e){}
        }
        phoneSaveForum(fd, chatUID);
        // 如果在帖子详情页，刷新详情（关注按钮状态）
        if (_forumNav && _forumNav.detail) {
          var bodyFF = root.querySelector('[data-ph="appBody"]');
          if (bodyFF) renderForumPostDetail(_forumNav.detail, bodyFF);
        } else {
          openNpcProfile(npcId);
        }
      }

      // -------- 论坛：发帖 --------
      function openForumCompose(){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;

        // ✅ 防重复打开
        if (root.querySelector('.forumComposeModal')) return;

        const modal = doc.createElement('div');
        modal.className = 'forumComposeModal';
        modal.innerHTML = `<div class="forumComposeInner">
          <div style="font-weight:600;color:var(--ph-text);font-size:14px;margin-bottom:8px;">发布新帖</div>
          <textarea data-ph="forumComposeText" placeholder="说点什么吧~" maxlength="500"></textarea>
          <div class="forumComposeBtns">
            <button class="forumCancelBtn" type="button" data-act="forumCancelCompose">取消</button>
            <button class="forumPostBtn" type="button" data-act="forumPost">发布</button>
          </div>
        </div>`;

        // ✅ 记录并设置定位（iOS 下如果不恢复，容易出现点击“像被遮罩吞掉”的假死感）
        try{
          if (body && body.dataset){
            body.dataset._modalPrevPos = body.style.position || '';
          }
        }catch(e){}
        body.style.position = 'relative';

        // 点击遮罩关闭（同时绑 touchend 兼容 iOS）
        modal.addEventListener('click', (e)=>{
          if (e.target === modal) closeForumCompose();
        }, {passive:true});
        modal.addEventListener('touchend', (e)=>{
          if (e.target === modal){ e.preventDefault(); closeForumCompose(); }
        }, {passive:false});

        // ✅ 关键：取消/发布 直接绑事件（避免 iOS Safari 冒泡/焦点导致的“假死”）
        const btnCancel = modal.querySelector('[data-act="forumCancelCompose"]');
        const btnPost   = modal.querySelector('[data-act="forumPost"]');
        if (btnCancel){
          btnCancel.addEventListener('click', (e)=>{
            e.preventDefault(); e.stopPropagation();
            closeForumCompose();
          }, {passive:false});
        }
        if (btnPost){
          btnPost.addEventListener('click', (e)=>{
            e.preventDefault(); e.stopPropagation();
            submitForumPost();
          }, {passive:false});
        }

        body.appendChild(modal);

        // ✅ iOS：先等一帧再 focus，避免输入法状态残留
        setTimeout(()=>{ try{ modal.querySelector('textarea')?.focus?.(); }catch(e){} }, 120);
      }

      function closeForumCompose(){
        _cleanupPhoneModal('.forumComposeModal');
      }

      function submitForumPost(){
        const ta = root.querySelector('[data-ph="forumComposeText"]');
        const text = (ta?.value||'').trim();
        if (!text){
          // 空内容直接关闭（也避免 iOS 残留遮罩）
          closeForumCompose();
          return;
        }
        const chatUID = (typeof phoneGetChatUID==='function') ? phoneGetChatUID() : '';
        let fd = phoneLoadForum(chatUID);
        fd.posts.unshift({
          id:'my_'+Date.now(), authorId:'me', authorName:'我', authorAvatar:'😊',
          content:text, time:Date.now(), likes:0, comments:[], shares:0, liked:false,
        });
        phoneSaveForum(fd, chatUID);
        closeForumCompose();
        renderForum(root.querySelector('[data-ph="appBody"]'));
      }

      /* -------- 统一弹层清理工具（防残留/卡死） -------- */
      function _cleanupPhoneModal(selector){
        try{
          // 1) blur 当前焦点（避免 iOS 输入法残留）
          try{ if(doc.activeElement && doc.activeElement.blur) doc.activeElement.blur(); }catch(e){}
          // 2) 移除所有匹配的弹层 DOM
          root.querySelectorAll(selector).forEach(function(m){
            try{ m.style.pointerEvents='none'; }catch(e){}
            try{ m.remove(); }catch(e){ try{ m.parentNode && m.parentNode.removeChild(m); }catch(e2){} }
          });
          // 3) 恢复 appBody 定位（防 pointer-events / overflow 残留）
          const body = root.querySelector('[data-ph="appBody"]');
          if(body){
            let prev='';
            try{ prev=(body.dataset&&(body.dataset._modalPrevPos??''))||''; }catch(e){}
            body.style.position=prev||'';
            try{ if(body.dataset) delete body.dataset._modalPrevPos; }catch(e){}
            // 确保 overflow 和 pointer-events 恢复
            body.style.overflow='';
            body.style.pointerEvents='';
          }
        }catch(e){}
      }

      /* -------- 论坛：转发引用弹窗（已修复卡死 bug） -------- */
      function _openForumRepostModal(origPost, chatUID){
        // 防重复打开：先清理旧的
        if(root.querySelector('.forumRepostModal')){
          _cleanupPhoneModal('.forumRepostModal');
        }
        const body = root.querySelector('[data-ph="appBody"]');
        if(!body) return;

        const modal = doc.createElement('div');
        modal.className = 'forumComposeModal forumRepostModal';
        modal.innerHTML = `<div class="forumComposeInner">
          <div style="font-weight:600;color:var(--ph-text);font-size:14px;margin-bottom:8px;">转发引用</div>
          <div class="feedQuoteBlock" style="margin-bottom:10px;">
            <div class="fqAuthor">@${esc(origPost.authorName||'')}</div>
            <div class="fqContent">${esc((origPost.content||'').slice(0,150))}${(origPost.content||'').length>150?'…':''}</div>
          </div>
          <textarea data-ph="forumRepostText" placeholder="说说你的看法…（可留空直接转发）" maxlength="300" style="width:100%;min-height:60px;padding:10px;border-radius:10px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:13px;resize:vertical;box-sizing:border-box;"></textarea>
          <div class="forumComposeBtns" style="margin-top:8px;">
            <button class="forumCancelBtn" type="button" data-act="forumRepostCancel">取消</button>
            <button class="forumPostBtn" type="button" data-act="forumRepostSubmit">转发</button>
          </div>
        </div>`;

        function closeRepostModal(){
          _cleanupPhoneModal('.forumRepostModal');
        }

        // 点击遮罩关闭（同时绑 click + touchend 兼容 iOS）
        function onOverlayClose(e){
          if(e.target===modal){ e.preventDefault(); e.stopPropagation(); closeRepostModal(); }
        }
        modal.addEventListener('click', onOverlayClose, {passive:false});
        modal.addEventListener('touchend', onOverlayClose, {passive:false});

        const btnCancel = modal.querySelector('[data-act="forumRepostCancel"]');
        const btnSubmit = modal.querySelector('[data-act="forumRepostSubmit"]');

        if(btnCancel){
          btnCancel.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); closeRepostModal(); }, {passive:false});
          btnCancel.addEventListener('touchend', function(e){ e.preventDefault(); e.stopPropagation(); closeRepostModal(); }, {passive:false});
        }

        if(btnSubmit){
          const submitHandler = function(e){
            e.preventDefault(); e.stopPropagation();
            const ta = modal.querySelector('[data-ph="forumRepostText"]');
            const text = (ta?.value||'').trim();
            try{
              let fd = phoneLoadForum(chatUID);
              // 增加原帖转发数
              const orig = (fd.posts||[]).find(function(p){return p.id===origPost.id;});
              if(orig) orig.shares = (orig.shares||0)+1;
              // 新建引用帖
              fd.posts.unshift({
                id:'repost_'+Date.now(), authorId:'me', authorName:'我', authorAvatar:'😊',
                content: text||'转发',
                time:Date.now(), likes:0, comments:[], shares:0, liked:false,
                quoteFrom:{ authorName:origPost.authorName||'', content:origPost.content||'' }
              });
              phoneSaveForum(fd, chatUID);
            }catch(ex){}
            closeRepostModal();
            renderForum(root.querySelector('[data-ph="appBody"]'));
          };
          btnSubmit.addEventListener('click', submitHandler, {passive:false});
          btnSubmit.addEventListener('touchend', submitHandler, {passive:false});
        }

        // 记录并设置定位
        try{ if(body.dataset) body.dataset._modalPrevPos = body.style.position||''; }catch(e){}
        body.style.position = 'relative';
        body.appendChild(modal);
        setTimeout(function(){ try{ modal.querySelector('textarea')?.focus?.(); }catch(ex){} }, 120);
      }

      /* ========== 天气 App ========== */
      function renderWeather(container){
        const fc=[
          {day:'今天',icon:'⛅',high:'26°',low:'18°'},
          {day:'明天',icon:'🌤️',high:'28°',low:'19°'},
          {day:'后天',icon:'☀️',high:'30°',low:'20°'},
          {day:'周四',icon:'🌧️',high:'22°',low:'16°'},
          {day:'周五',icon:'⛈️',high:'20°',low:'15°'}
        ];
        let html=`<div class="weatherMain">
          <div class="weatherIcon">⛅</div>
          <div class="weatherTemp">24°</div>
          <div class="weatherDesc">多云转晴</div>
          <div class="weatherDetail">
            <div class="wd"><div class="wdVal">62%</div>湿度</div>
            <div class="wd"><div class="wdVal">3级</div>风力</div>
            <div class="wd"><div class="wdVal">中等</div>紫外线</div>
          </div>
        </div>
        <div class="phCard"><div style="font-weight:600;color:var(--ph-text);margin-bottom:10px;">📅 未来几天</div>`;
        fc.forEach(f=>{
          html += `<div class="forecastRow">
            <span class="fDay">${f.day}</span>
            <span class="fIcon">${f.icon}</span>
            <div class="fRange"><span class="fLow">${f.low}</span><div class="fBar"></div><span class="fHigh">${f.high}</span></div>
          </div>`;
        });
        html += '</div>';
        // News cards
        html += `<div class="phCard"><div style="font-weight:600;color:var(--ph-text);margin-bottom:10px;">📰 天气资讯</div>
          <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);"><div style="font-size:13px;color:var(--ph-text);">冷空气即将到来</div><div style="font-size:11px;color:var(--ph-text-dim);margin-top:2px;">预计本周后半段气温明显下降，注意保暖</div></div>
          <div style="padding:8px 0;"><div style="font-size:13px;color:var(--ph-text);">周末适合户外活动</div><div style="font-size:11px;color:var(--ph-text-dim);margin-top:2px;">周六周日阳光充足，适宜出行</div></div>
        </div>`;
        container.innerHTML=html;
      }

      /* ========== 浏览器 App ========== */
      function renderBrowser(container){
        setAppBarRight('<button class="phBarRBtn" data-act="afBrowserSettings" title="浏览器资讯设置">⚙️</button>');
        const bookmarks = [
          {icon:_phFlatIcon('📰'),title:'世界资讯',desc:'查看最新世界观资讯与八卦'},
          {icon:_phFlatIcon('⭐'),title:'收藏夹',desc:'你收藏的网页和资讯'},
          {icon:_phFlatIcon('🔮'),title:'NPC 情报站',desc:'角色背景、关系图谱'},
          {icon:_phFlatIcon('📖'),title:'世界书百科',desc:'世界设定与知识库'},
          {icon:_phFlatIcon('🎮'),title:'娱乐频道',desc:'趣味内容与互动小游戏'},
        ];
        let html = `<div class="browserBar">
          <span style="font-size:14px;">${_phFlatIcon('🔒')}</span>
          <span class="browserUrl">meow://home</span>
        </div>
        <div style="padding:8px 14px;"><div style="font-weight:600;color:var(--ph-text);font-size:14px;margin-bottom:4px;">快速访问</div></div>
        <div class="browserBookmarks">`;
        bookmarks.forEach(b=>{
          html += `<div class="browserBmItem">
            <div class="browserBmIcon">${b.icon}</div>
            <div><div class="browserBmTitle">${b.title}</div><div class="browserBmDesc">${b.desc}</div></div>
          </div>`;
        });
        html += `</div>`;
        // AI 生成的资讯
        var feedData = null;
        try{ feedData = lsGet('meow_phone_g_browser_feed_v1', null); }catch(e){}
        var feedItems = (feedData && Array.isArray(feedData.items)) ? feedData.items : [];
        var aiFeed = feedItems.filter(function(x){return x._source==='autofeed';});
        if(aiFeed.length){
          var catLabels = {worldNews:'🔥 世界资讯',npcIntel:'🔮 NPC 情报站',wikiEntry:'📖 世界书百科',funStuff:'🎮 娱乐频道'};
          var grouped = {};
          aiFeed.forEach(function(item){ var c=item.category||'worldNews'; if(!grouped[c])grouped[c]=[]; grouped[c].push(item); });
          ['worldNews','npcIntel','wikiEntry','funStuff'].forEach(function(cat){
            var list=grouped[cat]; if(!list||!list.length) return;
            html += '<div class="phCard" style="margin:8px 14px;"><div style="font-weight:600;color:var(--ph-text);margin-bottom:8px;">'+(catLabels[cat]||cat)+'</div>';
            list.forEach(function(item){
              html += '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);"><div style="font-weight:500;color:var(--ph-text);font-size:13px;margin-bottom:2px;">'+esc(item.title||'')+'</div><div style="color:var(--ph-text-sub);font-size:12px;line-height:1.5;">'+esc(item.desc||'')+'</div></div>';
            });
            html += '</div>';
          });
        } else {
          html += `<div class="phCard" style="margin:8px 14px;"><div style="font-weight:600;color:var(--ph-text);margin-bottom:8px;">${_phFlatIcon('🔥')} 热门资讯</div>
            <div style="color:var(--ph-text-sub);font-size:13px;line-height:1.6;">
              这里将联动聊天中的世界观资讯和 NPC 八卦内容。<br>点击右上角 ⚙️ → 立即刷新 可生成资讯。
            </div>
          </div>`;
        }
        container.innerHTML = html;
      }

      /* ========== 相册 App ========== */
      function renderPhotos(container){
        let html = `<div class="photoTabs">
          <button class="photoTab on" data-act="photoTab" data-tab="all">全部</button>
          <button class="photoTab" data-act="photoTab" data-tab="avatar">头像</button>
          <button class="photoTab" data-act="photoTab" data-tab="wallpaper">壁纸</button>
          <button class="photoTab" data-act="photoTab" data-tab="sticker">表情包</button>
        </div>
        <div data-ph="photosContent"></div>`;
        container.innerHTML = html;
        renderPhotoGrid(container.querySelector('[data-ph="photosContent"]'), 'all');
      }

      function switchPhotoTab(el){
        const tab = el.getAttribute('data-tab');
        root.querySelectorAll('.photoTab').forEach(t=>t.classList.toggle('on', t===el));
        const content = root.querySelector('[data-ph="photosContent"]');
        if (content) renderPhotoGrid(content, tab);
      }

      function renderPhotoGrid(container, tab){
        const photos = phoneLoadPhotos();
        const cat = tab || 'all';
        const items = photos[cat] || [];
        const defaultPlaceholders = {
          all: ['🖼️','🌸','🌙','🎨','📷','🌈','🏔️','🌊','✨','🎭','🦋','🍃'],
          avatar: ['👤','🐱','🐶','🦊','👸','🧙'],
          wallpaper: ['🌅','🌌','🏔️','🌊','🌸','❄️'],
          sticker: ['😊','😂','🥺','💕','🎉','👍','✨','🔥','💪'],
        };
        const catLabel = {all:'全部',avatar:'头像',wallpaper:'壁纸',sticker:'表情包'}[cat]||cat;
        let html = `<div style="padding:12px 14px;">
          <button class="photoUploadBtn" data-act="photoUpload" data-cat="${cat}">
            📤 上传图片到「${catLabel}」
          </button>
        </div>
        <div class="photosGrid">`;
        items.forEach((img, idx)=>{
          html += `<div class="photoThumb hasImg" style="position:relative;">
            <img src="${img}" style="width:100%;height:100%;object-fit:cover;" />
            <button class="photoDelBtn" data-act="photoDel" data-cat="${cat}" data-idx="${idx}" style="display:flex;">✕</button>
          </div>`;
        });
        if (!items.length){
          const phs = defaultPlaceholders[cat] || defaultPlaceholders.all;
          phs.forEach(p=>{ html += `<div class="photoThumb">${p}</div>`; });
        }
        html += '</div>';
        container.innerHTML = html;
      }

      function triggerPhotoUpload(cat){
        const inp = doc.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
        inp.addEventListener('change', ()=>{
          const files = Array.from(inp.files||[]);
          if (!files.length) return;
          const photos = phoneLoadPhotos();
          const maxPerCat = 50;
          function readNext(i){
            if (i >= files.length){
              phoneSavePhotos(photos);
              const content = root.querySelector('[data-ph="photosContent"]');
              if (content) renderPhotoGrid(content, cat);
              return;
            }
            const f = files[i];
            if (!f.type.startsWith('image/') || f.size > 5*1024*1024){ readNext(i+1); return; }
            const reader = new FileReader();
            reader.onload = ()=>{
              if (!photos[cat]) photos[cat] = [];
              if (photos[cat].length < maxPerCat){
                photos[cat].push(reader.result);
                if (cat !== 'all'){
                  if (!photos.all) photos.all = [];
                  if (photos.all.length < maxPerCat) photos.all.push(reader.result);
                }
              }
              readNext(i+1);
            };
            reader.onerror = ()=> readNext(i+1);
            reader.readAsDataURL(f);
          }
          readNext(0);
        });
        doc.body.appendChild(inp);
        inp.click();
        setTimeout(()=>{ try{ inp.remove(); }catch(e){} }, 60000);
      }

      function deletePhoto(cat, idx){
        const photos = phoneLoadPhotos();
        const i = parseInt(idx);
        if (!photos[cat] || isNaN(i) || i < 0 || i >= photos[cat].length) return;
        photos[cat].splice(i, 1);
        phoneSavePhotos(photos);
        const content = root.querySelector('[data-ph="photosContent"]');
        if (content) renderPhotoGrid(content, cat);
      }

      /* ========== 设置 App ========== */
      function renderSettings(container){
        const currentTheme = root.getAttribute('data-theme') || 'modern';
        const cfg = phoneLoadSettings();

        // ✅ 设置页左侧图标统一成“扁平实心 SVG”（App 内部识别度更高）
        function _phSetIconHTML(ico){
          const k = String(ico||'').replace(/\uFE0F/g,''); // 去掉 emoji 变体
          const svg = (inner)=>`<svg class="phIco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
          switch(k){
            case '🎨': return svg('<path d="M12 2l2.1 5.5L20 10l-5.9 2.5L12 18l-2.1-5.5L4 10l5.9-2.5L12 2z"/>');
            case '🖼️': case '🖼': return svg('<path d="M4 5h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm3 4a2 2 0 1 0 0 .001A2 2 0 0 0 7 9zm13 10-5-5-3 3-2-2-6 6h16z"/>');
            case '🫧': return svg('<circle cx="9" cy="9" r="3"/><circle cx="15.5" cy="13" r="2.5"/><circle cx="10" cy="15.5" r="2"/>');
            case '📄': return svg('<path d="M6 2h9l3 3v17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V7h3.5L14 3.5z"/><path d="M7 10h10v2H7v-2zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/>');
            case '🔤': return svg('<path d="M12 3l7 18h-3l-1.5-4H9.5L8 21H5l7-18zm1.7 11L12 9l-1.7 5h3.4z"/>');
            case '💬': return svg('<path d="M6 4h12a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4H10l-6 5V8a4 4 0 0 1 4-4z"/>');
            case '🤖': return svg('<path d="M10 2h4v2h-4V2z"/><path d="M7 5h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4zm2.5 5a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 9.5 10zm5 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/><path d="M8 15h8v2H8v-2z"/>');
            case '⌨️': case '⌨': return svg('<path d="M4 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm2 3h2v2H6v-2zm3 0h2v2H9v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zM6 14h12v2H6v-2z"/>');
            case '⏰': return svg('<path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 5v5l4 2-.9 1.8L11 13V7h2z"/>');
            case '🔑': return svg('<path d="M7 14a5 5 0 1 1 4.9-6H22v4h-2v2h-2v2h-2.2A5 5 0 0 1 7 14zm0-3a2 2 0 1 0 .001-4.001A2 2 0 0 0 7 11z"/>');
            case '📱': return svg('<path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm4 17a1 1 0 1 0 .001 2.001A1 1 0 0 0 12 19z"/>');
            case '📐': return svg('<path d="M4 4h16v6H10v10H4V4zm2 2v2h2V6H6zm0 4v2h2v-2H6zm0 4v2h2v-2H6zM12 6v2h2V6h-2zm4 0v2h2V6h-2z"/>');
            case '💾': return svg('<path d="M5 3h14l2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 2v6h10V5H7zm2 1h6v4H9V6zm-2 8h12v7H7v-7z"/>');
            case 'ℹ️': case 'ℹ': return svg('<path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm0 4a1.2 1.2 0 1 1 0 2.4A1.2 1.2 0 0 1 12 6zm-1 4h2v8h-2v-8z"/>');
            case '🎯': return svg('<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16a8 8 0 0 0 0-16zm0 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4a2 2 0 0 0 0-4z"/>');
            case '🔮': return svg('<circle cx="12" cy="12" r="8" opacity=".28"/><circle cx="12" cy="12" r="3"/>');
            default: return (ico||'');
          }
        }

        const sections = [
          { title:'外观', rows:[
            {icon:'🎨',label:'主题风格',value:currentTheme||'modern',type:'nav',subpage:'themes'},
            {icon:'🖼️',label:'壁纸',value:(cfg.wallpaperHomeName||cfg.wallpaperName||'默认')+' / '+(cfg.wallpaperAppName||'APP默认'),type:'nav',subpage:'wallpaper'},
            {icon:'🫧',label:'桌面清晰度',value:`${cfg.uiHomeOpacity}% / ${cfg.uiHomeBlur}px`,type:'nav',subpage:'uiHome'},
            {icon:'📄',label:'App清晰度',value:`底${cfg.uiAppSolidOpacity}% 玻璃${cfg.uiAppOpacity}%`,type:'nav',subpage:'uiApp'},
            {icon:'🔤',label:'字体大小',value:cfg.fontSize+'px',type:'nav',subpage:'fontsize'},
            {icon:'🎯',label:'图标底色',value:cfg.iconTint||'默认',type:'nav',subpage:'iconTint'},
            {icon:'🔮',label:'内部图标色',value:cfg.iconInnerTint||'默认',type:'nav',subpage:'iconInner'},
          ]},
          { title:'功能', rows:[
            {icon:'💬',label:'聊天同步到主线',type:'toggle',key:'syncToMain',val:!!cfg.syncToMain},
            {icon:'🤖',label:'自动回复',type:'toggle',key:'autoReply',val:cfg.autoReply!==false},
            {icon:'📝',label:'上下文条数',value:(cfg.chatContextN||10)+'条',type:'nav',subpage:'chatContextN'},
            {icon:'⌨️',label:'打字效果',value:({none:'无',typewriter:'打字机',fadein:'淡入',glitch:'故障风'})[cfg.typingEffect||'none']||'无',type:'nav',subpage:'typingEffect'},
            {icon:'⏰',label:'时间模式',value:cfg.timeMode==='story'?'故事时间':'现实时间',type:'nav',subpage:'timeMode'},
          ]},
          { title:'高级', rows:[
            {icon:'🔑',label:'API 设置',type:'nav',subpage:'apiSettings'},
            {icon:'🎯',label:'API 自动运行设置',type:'nav',subpage:'autoFeedSettings'},
            {icon:'💾',label:'数据管理',type:'nav',subpage:'dataManager'},
          ]},
          { title:'关于', rows:[
            {icon:'ℹ️',label:'版本',value:'MEOW Phone v2.1',type:'info'},
          ]},
        ];

        let html = '';
        sections.forEach(s=>{
          html += `<div class="settingSection"><div class="settingSectionTitle">${s.title}</div>`;
          s.rows.forEach(r=>{
            const navAttr = (r.type==='nav' && r.subpage) ? ` data-act="settingsNav" data-subpage="${r.subpage}"` : '';
            const themeAttr = (r.subpage==='themes') ? ' data-act="openThemes"' : '';
            html += `<div class="settingRow"${navAttr}${themeAttr} style="${r.type==='nav'?'cursor:pointer;':''}">
              <span class="sIcon">${_phSetIconHTML(r.icon||'')}</span>
              <span class="sLabel">${r.label}</span>`;
            if(r.type==='toggle'){
              html += `<button class="sToggle${r.val?' on':''}" data-skey="${r.key}"></button>`;
            } else {
              html += `<span class="sValue">${r.value||''} ${r.type==='nav'?'›':''}</span>`;
            }
            html += '</div>';
          });
          html += '</div>';
        });
        container.innerHTML = html;

        // Toggle 开关绑定
        container.querySelectorAll('.sToggle').forEach(btn=>{
          btn.addEventListener('click',()=>{
            btn.classList.toggle('on');
            const key = btn.getAttribute('data-skey');
            if (key){
              const cfg2 = phoneLoadSettings();
              cfg2[key] = btn.classList.contains('on');
              phoneSaveSettings(cfg2);
            }
          });
        });
        // 主题入口
        container.querySelectorAll('[data-act="openThemes"]').forEach(el=>{
          el.addEventListener('click', ()=>{ openApp('themes'); });
        });
      }

      // -------- 设置子页面路由 --------
      function openSettingsSubPage(subpage){
        const body = root.querySelector('[data-ph="appBody"]');
        if (!body) return;
        switch(subpage){
          case 'wallpaper': renderSettingsWallpaper(body); break;
          case 'uiHome': renderSettingsUIHome(body); break;
          case 'uiApp':  renderSettingsUIApp(body); break;
          case 'fontsize':  renderSettingsFontSize(body); break;
          case 'timeMode':  renderSettingsTimeMode(body); break;
          case 'typingEffect': renderSettingsTypingEffect(body); break;
          case 'chatContextN': renderSettingsChatContextN(body); break;
          case 'iconTint': renderSettingsIconTint(body); break;
          case 'iconInner': renderSettingsIconInner(body); break;
          case 'themes': openApp('themes'); break;
          case 'apiSettings': renderApiSettingsPage(body); break;
          case 'autoFeedSettings': renderAutoFeedSettingsPage(body); break;
          case 'dataManager': renderDataManagerPage(body); break;
          default: renderSettings(body); break;
        }
      }
// -------- 设置：壁纸（桌面/APP 分离 + 透明度可调） --------
function renderSettingsWallpaper(container){
  const cfg = phoneLoadSettings();

  function previewCard(title, target, img, name, opacity){
    const has = !!img;
    const op = Math.max(0, Math.min(100, Number(opacity ?? 100)));
    return `
      <div class="phCard" style="margin-top:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-weight:700;color:var(--ph-text);">${title}</div>
          <div style="font-size:11px;color:var(--ph-text-dim);">${esc(name|| (has?'自定义':'默认'))}</div>
        </div>

        <div class="sWpPreview" style="margin-top:10px;">
          ${has ? `<img src="${img}" />` : `<div class="sWpEmpty">当前使用默认壁纸</div>`}
        </div>

        <div style="margin-top:10px;font-size:12px;color:var(--ph-text-sub);display:flex;align-items:center;justify-content:space-between;">
          <span>壁纸透明度</span>
          <span><b data-wplabel="${target}">${op}</b>%</span>
        </div>
        <input data-wpop="${target}" type="range" min="0" max="100" value="${op}" style="width:100%;margin-top:8px;">

        <div class="sWpBtnRow" style="margin-top:10px;">
          <button class="sWpBtn" data-act="setWallpaper" data-wptarget="${target}">${_phFlatIcon('📤')} 上传</button>
          <button class="sWpBtn" data-act="pickWallpaperFromAlbum" data-wptarget="${target}">${_phFlatIcon('🖼️')} 相册</button>
          <button class="sWpBtn" data-act="clearWallpaper" data-wptarget="${target}">${_phFlatIcon('🗑️')} 默认</button>
        </div>
      </div>
    `;
  }

  let html = `<div class="settingSubPage">
    <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);
      color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
      margin-bottom:12px;">‹ 返回设置</button>
    <div class="settingSubTitle">🖼️ 壁纸设置</div>
    <div class="settingSubDesc" style="margin-top:6px;">桌面和 App 内部可以设置不同壁纸，并分别调透明度。</div>
    ${previewCard('桌面壁纸（Home）', 'home', cfg.wallpaperHome, cfg.wallpaperHomeName, cfg.wallpaperHomeOpacity)}
    ${previewCard('App 壁纸（App 内部）', 'app', cfg.wallpaperApp, cfg.wallpaperAppName, cfg.wallpaperAppOpacity)}
  </div>`;

  container.innerHTML = html;

  // 透明度滑块
  container.querySelectorAll('input[data-wpop]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const tg = inp.getAttribute('data-wpop') || 'home';
      const v = Math.max(0, Math.min(100, Number(inp.value||0)));
      const cfg2 = phoneLoadSettings();
      if (tg === 'app') cfg2.wallpaperAppOpacity = v;
      else cfg2.wallpaperHomeOpacity = v;
      phoneSaveSettings(cfg2);
      phoneApplyVisualFromSettings(cfg2);

      const lb = container.querySelector(`b[data-wplabel="${tg}"]`);
      if (lb) lb.textContent = String(v);
    }, {passive:true});
  });
}

function triggerWallpaperUpload(target){
  const tg = String(target||'home');
  const inp = doc.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
  inp.addEventListener('change', ()=>{
    const f = inp.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const cfg = phoneLoadSettings();
      if (tg === 'app'){
        cfg.wallpaperApp = reader.result;
        cfg.wallpaperAppName = f.name || '自定义';
      }else{
        cfg.wallpaperHome = reader.result;
        cfg.wallpaperHomeName = f.name || '自定义';
      }
      phoneSaveSettings(cfg);
      phoneApplyVisualFromSettings(cfg);
      const body = root.querySelector('[data-ph="appBody"]');
      if (body) renderSettingsWallpaper(body);
    };
    reader.readAsDataURL(f);
  });
  doc.body.appendChild(inp);
  inp.click();
  setTimeout(()=>{ try{ inp.remove(); }catch(e){} }, 60000);
}

function pickWallpaperFromAlbum(target){
  const tg = String(target||'home');
  const photos = phoneLoadPhotos();
  const wps = photos.wallpaper || [];
  if (!wps.length){
    try{
      const ok = W.confirm?.('相册中还没有壁纸图片。\n是否先去相册上传？');
      if (ok) openApp('photos');
    }catch(e){ openApp('photos'); }
    return;
  }

  const applyIdx = (img, idx)=>{
    const cfg = phoneLoadSettings();
    if (tg === 'app'){
      cfg.wallpaperApp = img;
      cfg.wallpaperAppName = '相册壁纸' + (typeof idx==='number' ? ' #'+(idx+1) : '');
    }else{
      cfg.wallpaperHome = img;
      cfg.wallpaperHomeName = '相册壁纸' + (typeof idx==='number' ? ' #'+(idx+1) : '');
    }
    phoneSaveSettings(cfg);
    phoneApplyVisualFromSettings(cfg);
    const body = root.querySelector('[data-ph="appBody"]');
    if (body) renderSettingsWallpaper(body);
  };

  if (wps.length === 1){
    applyIdx(wps[0], 0);
    return;
  }

  const body = root.querySelector('[data-ph="appBody"]');
  if (!body) return;

  let html = `<div class="settingSubPage">
    <button data-act="settingsNav" data-subpage="wallpaper" style="appearance:none;border:0;background:var(--ph-glass);
      color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
      margin-bottom:12px;">‹ 返回</button>
    <div class="settingSubTitle">选择壁纸（${tg==='app'?'App':'桌面'}）</div>
    <div class="photosGrid">`;
  wps.forEach((img, idx)=>{
    html += `<div class="photoThumb hasImg" style="cursor:pointer;" data-wpidx="${idx}">
      <img src="${img}" style="width:100%;height:100%;object-fit:cover;" />
    </div>`;
  });
  html += '</div></div>';
  body.innerHTML = html;
  body.querySelectorAll('[data-wpidx]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const i = parseInt(el.getAttribute('data-wpidx'));
      if (isNaN(i) || !wps[i]) return;
      applyIdx(wps[i], i);
    });
  });
}

function clearWallpaper(target){
  const tg = String(target||'home');
  const cfg = phoneLoadSettings();
  if (tg === 'app'){
    cfg.wallpaperApp = '';
    cfg.wallpaperAppName = '';
  }else{
    cfg.wallpaperHome = '';
    cfg.wallpaperHomeName = '';
  }
  phoneSaveSettings(cfg);
  phoneApplyVisualFromSettings(cfg);
  const body = root.querySelector('[data-ph="appBody"]');
  if (body) renderSettingsWallpaper(body);
}

// -------- 设置：桌面清晰度（玻璃透明度/模糊） --------
function renderSettingsUIHome(container){
  const cfg = phoneLoadSettings();
  const op = Math.max(0, Math.min(100, Number(cfg.uiHomeOpacity ?? 36)));
  const blur = Math.max(0, Math.min(40, Number(cfg.uiHomeBlur ?? 22)));

  container.innerHTML = `
    <div class="settingSubPage">
      <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);
        color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
        margin-bottom:12px;">‹ 返回设置</button>
      <div class="settingSubTitle">🫧 桌面清晰度</div>
      <div class="phCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;color:var(--ph-text);">UI 不透明度</div>
          <div style="font-size:12px;color:var(--ph-text-sub);"><b data-uihome="op">${op}</b>%</div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--ph-text-dim);">提高可以让卡片更清晰（但更接近纯色）。</div>
        <input data-uihome="op" type="range" min="0" max="100" value="${op}" style="width:100%;margin-top:10px;">
      </div>

      <div class="phCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;color:var(--ph-text);">模糊度</div>
          <div style="font-size:12px;color:var(--ph-text-sub);"><b data-uihome="blur">${blur}</b>px</div>
        </div>
        <input data-uihome="blur" type="range" min="0" max="40" value="${blur}" style="width:100%;margin-top:10px;">
      </div>
    </div>
  `;

  container.querySelectorAll('input[data-uihome]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const k = inp.getAttribute('data-uihome');
      const v = Number(inp.value||0);
      const cfg2 = phoneLoadSettings();
      if (k === 'blur') cfg2.uiHomeBlur = Math.max(0, Math.min(40, v));
      else cfg2.uiHomeOpacity = Math.max(0, Math.min(100, v));
      phoneSaveSettings(cfg2);
      phoneApplyVisualFromSettings(cfg2);

      const b = container.querySelector(`b[data-uihome="${k}"]`);
      if (b) b.textContent = String(Math.round(v));
    }, {passive:true});
  });
}

// -------- 设置：App 清晰度（玻璃透明度/模糊 + 内容底不透明度） --------
function renderSettingsUIApp(container){
  const cfg = phoneLoadSettings();
  const op = Math.max(0, Math.min(100, Number(cfg.uiAppOpacity ?? 52)));
  const blur = Math.max(0, Math.min(40, Number(cfg.uiAppBlur ?? 16)));
  const solid = Math.max(0, Math.min(100, Number(cfg.uiAppSolidOpacity ?? 92)));

  container.innerHTML = `
    <div class="settingSubPage">
      <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);
        color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
        margin-bottom:12px;">‹ 返回设置</button>
      <div class="settingSubTitle">📄 App 清晰度</div>

      <div class="phCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;color:var(--ph-text);">App 内容底不透明度</div>
          <div style="font-size:12px;color:var(--ph-text-sub);"><b data-uiapp="solid">${solid}</b>%</div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--ph-text-dim);">提高更接近原生 App（更易读）。</div>
        <input data-uiapp="solid" type="range" min="0" max="100" value="${solid}" style="width:100%;margin-top:10px;">
      </div>

      <div class="phCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;color:var(--ph-text);">App 卡片玻璃不透明度</div>
          <div style="font-size:12px;color:var(--ph-text-sub);"><b data-uiapp="op">${op}</b>%</div>
        </div>
        <input data-uiapp="op" type="range" min="0" max="100" value="${op}" style="width:100%;margin-top:10px;">
      </div>

      <div class="phCard">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;color:var(--ph-text);">App 模糊度</div>
          <div style="font-size:12px;color:var(--ph-text-sub);"><b data-uiapp="blur">${blur}</b>px</div>
        </div>
        <input data-uiapp="blur" type="range" min="0" max="40" value="${blur}" style="width:100%;margin-top:10px;">
      </div>
    </div>
  `;

  container.querySelectorAll('input[data-uiapp]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const k = inp.getAttribute('data-uiapp');
      const v = Number(inp.value||0);
      const cfg2 = phoneLoadSettings();

      if (k === 'blur') cfg2.uiAppBlur = Math.max(0, Math.min(40, v));
      else if (k === 'op') cfg2.uiAppOpacity = Math.max(0, Math.min(100, v));
      else cfg2.uiAppSolidOpacity = Math.max(0, Math.min(100, v));

      phoneSaveSettings(cfg2);
      phoneApplyVisualFromSettings(cfg2);

      const b = container.querySelector(`b[data-uiapp="${k}"]`);
      if (b) b.textContent = String(Math.round(v));
    }, {passive:true});
  });
}



      // -------- 设置：字体大小（滑块） --------
      function renderSettingsFontSize(container){
        const cfg = phoneLoadSettings();
        const size = cfg.fontSize || 14;
        let html = `<div class="settingSubPage">
          <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);
            color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
            margin-bottom:12px;">‹ 返回设置</button>
          <div class="settingSubTitle">🔤 字体大小</div>
          <div class="settingSubDesc">拖动滑块调整手机界面字体大小</div>
          <div class="sSliderRow">
            <span style="font-size:12px;color:var(--ph-text-dim);">A</span>
            <input type="range" min="12" max="20" step="1" value="${size}" data-ph="fontSlider" />
            <span style="font-size:20px;color:var(--ph-text-dim);">A</span>
            <span class="sSliderVal" data-ph="fontVal">${size}</span>
          </div>
          <div class="sPreviewText" data-ph="fontPreview" style="font-size:${size}px;">
            这是预览文字。The quick brown fox jumps over the lazy dog. 快速的棕色狐狸跳过了懒狗。
          </div>
        </div>`;
        container.innerHTML = html;
        const slider = container.querySelector('[data-ph="fontSlider"]');
        const valEl = container.querySelector('[data-ph="fontVal"]');
        const preview = container.querySelector('[data-ph="fontPreview"]');
        if (slider){
          slider.addEventListener('input', ()=>{
            const v = parseInt(slider.value) || 14;
            if (valEl) valEl.textContent = v;
            if (preview) preview.style.fontSize = v + 'px';
            phoneApplyFontSize(v);
            const cfg2 = phoneLoadSettings();
            cfg2.fontSize = v;
            phoneSaveSettings(cfg2);
          });
        }
      }

      // -------- 设置：时间模式 --------
      function renderSettingsTimeMode(container){
        const cfg = phoneLoadSettings();
        let html = `<div class="settingSubPage">
          <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);
            color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
            margin-bottom:12px;">‹ 返回设置</button>
          <div class="settingSubTitle">⏰ 时间模式</div>
          <div class="settingSubDesc">选择手机状态栏显示的时间来源</div>
          <div class="sOptionGrid">
            <button class="sOptionBtn${cfg.timeMode!=='story'?' active':''}" data-ph="tmReal">🕐 现实时间</button>
            <button class="sOptionBtn${cfg.timeMode==='story'?' active':''}" data-ph="tmStory">📖 故事时间</button>
          </div>
          <div data-ph="storyTimeConfig" style="margin-top:14px;${cfg.timeMode!=='story'?'display:none;':''}">
            <div style="font-size:13px;color:var(--ph-text-sub);margin-bottom:6px;">自定义故事时间：</div>
            <input class="sTimeInput" type="time" value="${cfg.storyTime||'12:00'}" data-ph="storyTimeInput" />
            <div style="margin-top:8px;font-size:13px;color:var(--ph-text-sub);margin-bottom:6px;">自定义故事日期（选填）：</div>
            <input class="sTimeInput" type="text" value="${esc(cfg.storyDate||'')}" data-ph="storyDateInput" placeholder="例：魔法纪元 第3天" />
          </div>
        </div>`;
        container.innerHTML = html;

        const btnReal = container.querySelector('[data-ph="tmReal"]');
        const btnStory = container.querySelector('[data-ph="tmStory"]');
        const storyConf = container.querySelector('[data-ph="storyTimeConfig"]');
        const storyTimeInp = container.querySelector('[data-ph="storyTimeInput"]');
        const storyDateInp = container.querySelector('[data-ph="storyDateInput"]');

        function _setTMode(mode){
          const cfg2 = phoneLoadSettings();
          cfg2.timeMode = mode;
          phoneSaveSettings(cfg2);
          btnReal.classList.toggle('active', mode!=='story');
          btnStory.classList.toggle('active', mode==='story');
          if (storyConf) storyConf.style.display = mode==='story' ? '' : 'none';
          try{ updateTime(); }catch(e){}
        }
        if (btnReal) btnReal.addEventListener('click', ()=> _setTMode('real'));
        if (btnStory) btnStory.addEventListener('click', ()=> _setTMode('story'));

        if (storyTimeInp) storyTimeInp.addEventListener('change', ()=>{
          const cfg2 = phoneLoadSettings();
          cfg2.storyTime = storyTimeInp.value || '12:00';
          phoneSaveSettings(cfg2);
          try{ updateTime(); }catch(e){}
        });
        if (storyDateInp) storyDateInp.addEventListener('input', ()=>{
          const cfg2 = phoneLoadSettings();
          cfg2.storyDate = storyDateInp.value || '';
          phoneSaveSettings(cfg2);
          try{ updateTime(); }catch(e){}
        });
      }

      // -------- 设置：打字效果（三种选择） --------
      function renderSettingsTypingEffect(container){
        const cfg = phoneLoadSettings();
        const current = cfg.typingEffect || 'none';
        const effects = [
          {id:'none', name:'无', desc:'消息直接显示'},
          {id:'typewriter', name:'打字机', desc:'逐字出现，像打字一样'},
          {id:'fadein', name:'淡入', desc:'消息从下方淡入显示'},
          {id:'glitch', name:'故障风', desc:'带有故障感的特效'},
        ];
        let html = `<div class="settingSubPage">
          <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);
            color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
            margin-bottom:12px;">‹ 返回设置</button>
          <div class="settingSubTitle">⌨️ 打字效果</div>
          <div class="settingSubDesc">选择聊天消息的显示动画</div>
          <div class="sOptionGrid" style="flex-direction:column;">`;
        effects.forEach(ef=>{
          html += `<button class="sOptionBtn${ef.id===current?' active':''}" data-ph="te_${ef.id}" style="text-align:left;display:flex;flex-direction:column;align-items:flex-start;">
            <div style="font-weight:600;font-size:13.5px;">${ef.name}</div>
            <div style="font-size:11.5px;color:var(--ph-text-dim);margin-top:2px;">${ef.desc}</div>
          </button>`;
        });
        html += `</div>
          <div class="typingDemo effect-${current}" data-ph="typingDemo" style="margin-top:14px;">
            <div style="font-size:12px;color:var(--ph-text-dim);margin-bottom:6px;">预览效果：</div>
            <div class="sPreviewText"><span class="typingDemoText">这是一条消息预览~</span></div>
          </div>
        </div>`;
        container.innerHTML = html;
        effects.forEach(ef=>{
          const btn = container.querySelector(`[data-ph="te_${ef.id}"]`);
          if (btn) btn.addEventListener('click', ()=>{
            const cfg2 = phoneLoadSettings();
            cfg2.typingEffect = ef.id;
            phoneSaveSettings(cfg2);
            container.querySelectorAll('.sOptionBtn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            const demo = container.querySelector('[data-ph="typingDemo"]');
            if (demo){
              demo.className = 'typingDemo effect-' + ef.id;
              const span = demo.querySelector('.typingDemoText');
              if (span){ span.style.animation = 'none'; void span.offsetWidth; span.style.animation = ''; }
            }
          });
        });
      }

      // ===== 【上下文条数设置子页面】新增 =====
      function renderSettingsChatContextN(container){
        var cfg = phoneLoadSettings();
        var current = Number(cfg.chatContextN) || 10;
        if (current < 3) current = 3;
        if (current > 50) current = 50;
        var html = '<div class="settingSubPage">' +
          '<button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;margin-bottom:12px;">‹ 返回设置</button>' +
          '<div class="settingSubTitle">📝 上下文条数</div>' +
          '<div class="settingSubDesc">AI 回复时参考最近多少条聊天记录。数值越大效果越好但消耗更多 Token。</div>' +
          '<div style="display:flex;align-items:center;gap:12px;margin-top:18px;">' +
            '<input type="range" min="3" max="50" value="' + current + '" data-ph="ctxNSlider" style="flex:1;accent-color:#07c160;" />' +
            '<span data-ph="ctxNVal" style="font-size:15px;font-weight:600;color:var(--ph-text);min-width:36px;text-align:center;">' + current + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ph-text-dim);margin-top:4px;padding:0 2px;"><span>3条</span><span>50条</span></div>' +
          '<div style="margin-top:16px;padding:10px 12px;border-radius:10px;background:var(--ph-glass);font-size:12px;color:var(--ph-text-sub);line-height:1.6;">' +
            '💡 建议：日常闲聊 8~15 条即可；深度对话或复杂剧情可调至 20~30。' +
          '</div>' +
        '</div>';
        container.innerHTML = html;
        var slider = container.querySelector('[data-ph="ctxNSlider"]');
        var valSpan = container.querySelector('[data-ph="ctxNVal"]');
        if (slider){
          slider.addEventListener('input', function(){
            var v = Number(slider.value) || 10;
            if (valSpan) valSpan.textContent = String(v);
          });
          slider.addEventListener('change', function(){
            var v = Number(slider.value) || 10;
            var cfg2 = phoneLoadSettings();
            cfg2.chatContextN = v;
            phoneSaveSettings(cfg2);
          });
        }
      }

      // ========== 图标颜色自定义 ==========
      function renderSettingsIconTint(container){
        const cfg = phoneLoadSettings();
        const current = cfg.iconTint || '默认';
        // ✅ 预设色盘（参考图3的莫兰迪蓝灰色系）
        const presets = [
          {id:'默认', label:'默认', color:''},
          {id:'蓝灰', label:'蓝灰', color:'#8DA8B8'},
          {id:'雾蓝', label:'雾蓝', color:'#7B9EA8'},
          {id:'淡紫', label:'淡紫', color:'#A088B5'},
          {id:'暖灰', label:'暖灰', color:'#9E9EAF'},
          {id:'墨绿', label:'墨绿', color:'#7A9E8E'},
          {id:'暗粉', label:'暗粉', color:'#B88E94'},
          {id:'深蓝', label:'深蓝', color:'#4A6FA5'},
        ];
        let html = `<div class="settingSubPage">
          <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);
            color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
            margin-bottom:12px;">‹ 返回设置</button>
          <div class="settingSubTitle">🎯 图标底色</div>
          <div class="settingSubDesc">自定义桌面/Dock图标的底色（选择预设或输入自定义色值）</div>
          <div class="sOptionGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;">`;
        presets.forEach(p=>{
          const isActive = current === p.id;
          const bg = p.color ? `background:${p.color};` : 'background:var(--ph-accent-grad);';
          html += `<button class="sOptionBtn${isActive?' active':''}" data-icontint="${p.id}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;">
            <div style="width:28px;height:28px;border-radius:8px;${bg}"></div>
            <span style="font-size:11px;">${p.label}</span>
          </button>`;
        });
        html += `</div>
          <div style="margin-top:14px;">
            <div style="font-size:12px;color:var(--ph-text-sub);margin-bottom:6px;">自定义色值（HEX）</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="color" data-ph="iconTintPicker" value="${cfg.iconTintHex||'#8DA8B8'}" style="width:36px;height:36px;border:none;background:none;cursor:pointer;"/>
              <input data-ph="iconTintHex" value="${cfg.iconTintHex||'#8DA8B8'}" placeholder="#8DA8B8" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:13px;"/>
              <button data-ph="iconTintApply" style="padding:8px 14px;border-radius:10px;background:var(--ph-accent-grad);color:#fff;border:none;font-weight:600;cursor:pointer;font-size:12px;">应用</button>
            </div>
          </div>
        </div>`;
        container.innerHTML = html;
        // 预设色点击
        container.querySelectorAll('[data-icontint]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const id = btn.getAttribute('data-icontint');
            const p = presets.find(x=>x.id===id);
            const cfg2 = phoneLoadSettings();
            cfg2.iconTint = id;
            if (p && p.color) cfg2.iconTintHex = p.color;
            else delete cfg2.iconTintHex;
            phoneSaveSettings(cfg2);
            _applyIconTint(cfg2);
            container.querySelectorAll('.sOptionBtn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
          });
        });
        // 自定义色值
        const picker = container.querySelector('[data-ph="iconTintPicker"]');
        const hexInput = container.querySelector('[data-ph="iconTintHex"]');
        const applyBtn = container.querySelector('[data-ph="iconTintApply"]');
        if (picker && hexInput){
          picker.addEventListener('input',()=>{ hexInput.value = picker.value; });
          hexInput.addEventListener('input',()=>{ try{ picker.value = hexInput.value; }catch(_){} });
        }
        if (applyBtn){
          applyBtn.addEventListener('click',()=>{
            const hex = (hexInput?.value||'').trim();
            if (!hex) return;
            const cfg2 = phoneLoadSettings();
            cfg2.iconTint = '自定义';
            cfg2.iconTintHex = hex;
            phoneSaveSettings(cfg2);
            _applyIconTint(cfg2);
            container.querySelectorAll('.sOptionBtn').forEach(b=>b.classList.remove('active'));
          });
        }
      }

      function _applyIconTint(cfg){
        if (!root) return;
        const hex = cfg.iconTintHex;
        if (hex){
          // 桌面/dock图标底色
          root.querySelectorAll('.phAppIcon .ai, .phDockBtn .di').forEach(el=>{
            el.style.background = hex;
          });
          root.style.setProperty('--ph-icon-tint', hex);
          // ✅ 通讯录 + 发现 + 我 页面图标底色联动
          root.querySelectorAll('.wxCHIco, .wxDIcoThemed').forEach(el=>{ el.style.background = hex; });
        } else {
          root.querySelectorAll('.phAppIcon .ai').forEach(el=>{ el.style.background = ''; });
          root.querySelectorAll('.phDockBtn .di').forEach(el=>{ el.style.background = ''; });
          root.querySelectorAll('.wxCHIco, .wxDIcoThemed').forEach(el=>{ el.style.background = ''; });
          root.style.removeProperty('--ph-icon-tint');
        }
      }

      // ========== 内部图标色自定义 ==========
      function renderSettingsIconInner(container){
        const cfg = phoneLoadSettings();
        const current = cfg.iconInnerTint || '默认';
        const presets = [
          {id:'默认', label:'默认', color:''},
          {id:'蓝灰', label:'蓝灰', color:'#7B8FA0'},
          {id:'墨蓝', label:'墨蓝', color:'#4A6FA5'},
          {id:'淡紫', label:'淡紫', color:'#8B6FB0'},
          {id:'暖棕', label:'暖棕', color:'#9E8875'},
          {id:'墨绿', label:'墨绿', color:'#5E8B72'},
          {id:'玫瑰', label:'玫瑰', color:'#B06878'},
          {id:'深灰', label:'深灰', color:'#6B7280'},
        ];
        let html = `<div class="settingSubPage">
          <button data-act="settingsBack" style="appearance:none;border:0;background:var(--ph-glass);
            color:var(--ph-text-sub);padding:6px 12px;border-radius:12px;cursor:pointer;font-size:12px;
            margin-bottom:12px;">‹ 返回设置</button>
          <div class="settingSubTitle">🔮 内部图标色</div>
          <div class="settingSubDesc">调整 App 内部扁平图标颜色（组件编辑器、标签栏、论坛等）</div>
          <div class="sOptionGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;">`;
        presets.forEach(p=>{
          const isActive = current === p.id;
          html += `<button class="sOptionBtn${isActive?' active':''}" data-iconinner="${p.id}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;">
            <div style="width:24px;height:24px;border-radius:6px;${p.color?'background:'+p.color:'background:var(--ph-text-sub)'};display:flex;align-items:center;justify-content:center;">
              <svg style="width:14px;height:14px;fill:#fff;" viewBox="0 0 24 24"><path d="M12 2l2.1 5.5L20 10l-5.9 2.5L12 18l-2.1-5.5L4 10l5.9-2.5L12 2z"/></svg>
            </div>
            <span style="font-size:11px;">${p.label}</span>
          </button>`;
        });
        html += `</div>
          <div style="margin-top:14px;">
            <div style="font-size:12px;color:var(--ph-text-sub);margin-bottom:6px;">自定义色值（HEX）</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="color" data-ph="innerPicker" value="${cfg.iconInnerHex||'#7B8FA0'}" style="width:36px;height:36px;border:none;background:none;cursor:pointer;"/>
              <input data-ph="innerHex" value="${cfg.iconInnerHex||'#7B8FA0'}" placeholder="#7B8FA0" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--ph-glass-border);background:var(--ph-glass);color:var(--ph-text);font-size:13px;"/>
              <button data-ph="innerApply" style="padding:8px 14px;border-radius:10px;background:var(--ph-accent-grad);color:#fff;border:none;font-weight:600;cursor:pointer;font-size:12px;">应用</button>
            </div>
          </div>
        </div>`;
        container.innerHTML = html;
        // 预设色
        container.querySelectorAll('[data-iconinner]').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const id = btn.getAttribute('data-iconinner');
            const p = presets.find(x=>x.id===id);
            const cfg2 = phoneLoadSettings();
            cfg2.iconInnerTint = id;
            if (p && p.color) cfg2.iconInnerHex = p.color;
            else delete cfg2.iconInnerHex;
            phoneSaveSettings(cfg2);
            _applyIconInner(cfg2);
            container.querySelectorAll('.sOptionBtn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
          });
        });
        // 自定义
        const picker = container.querySelector('[data-ph="innerPicker"]');
        const hexInput = container.querySelector('[data-ph="innerHex"]');
        const applyBtn = container.querySelector('[data-ph="innerApply"]');
        if (picker && hexInput){
          picker.addEventListener('input',()=>{ hexInput.value = picker.value; });
          hexInput.addEventListener('input',()=>{ try{ picker.value = hexInput.value; }catch(_){} });
        }
        if (applyBtn){
          applyBtn.addEventListener('click',()=>{
            const hex = (hexInput?.value||'').trim();
            if (!hex) return;
            const cfg2 = phoneLoadSettings();
            cfg2.iconInnerTint = '自定义';
            cfg2.iconInnerHex = hex;
            phoneSaveSettings(cfg2);
            _applyIconInner(cfg2);
            container.querySelectorAll('.sOptionBtn').forEach(b=>b.classList.remove('active'));
          });
        }
      }
      function _applyIconInner(cfg){
        if (!root) return;
        if (cfg.iconInnerHex){
          root.style.setProperty('--ph-icon-inner-tint', cfg.iconInnerHex);
        } else {
          root.style.removeProperty('--ph-icon-inner-tint');
        }
      }

      /* ========== 主题选择 App ========== */
      function renderThemes(container){
        const themes = [
          {id:'modern',name:'现代',preview:'linear-gradient(135deg,#1a1a2e,#0f3460)'},
          {id:'medieval',name:'中世纪',preview:'linear-gradient(135deg,#2c1810,#4a2c1a)'},
          {id:'cyber',name:'赛博朋克',preview:'linear-gradient(135deg,#0a0a0a,#0a1628)'},
          {id:'sakura',name:'樱花',preview:'linear-gradient(135deg,#2d1f2f,#4a1942)'},
          {id:'frost',name:'霜雪',preview:'linear-gradient(135deg,#e8edf2,#cfd8e3)'},
        ];
        const current = root.getAttribute('data-theme') || 'modern';
        let html = `<div style="padding:14px;"><div style="font-weight:600;color:var(--ph-text);font-size:15px;margin-bottom:4px;">选择主题</div>
          <div style="font-size:12px;color:var(--ph-text-dim);margin-bottom:12px;">手机是酒馆拓展社交系统，选择你喜欢的风格</div>
        </div>
        <div class="themeGrid">`;
        themes.forEach(t=>{
          html += `<button class="themeCard${t.id===current?' active':''}" data-act="setTheme" data-theme="${t.id}">
            <div class="tcPreview" style="background:${t.preview};"></div>
            ${t.name}
          </button>`;
        });
        html += '</div>';
        container.innerHTML = html;
      }

      // ========= 主题：存储改为 LS_PHONE_G_THEME（统一 + 可跨端同步） =========
      // 说明：
      // 1) 写入：优先走 lsSet（触发 MEOW_SYNC markDirty/schedulePush），没有则 fallback localStorage
      // 2) 读取：优先走 lsGet；若没读到新key，则兼容读取旧key 'meow_phone_theme' 并迁移到新key
      function applyTheme(themeId){
        if (!themeId) return;

        // UI：modern 视为默认，不挂 data-theme
        root.setAttribute('data-theme', themeId === 'modern' ? '' : themeId);

        // 存储：统一走 LS_PHONE_G_THEME
        try{
          if (typeof lsSet === 'function') {
            lsSet(LS_PHONE_G_THEME, themeId);
          } else {
            W.localStorage.setItem(LS_PHONE_G_THEME, JSON.stringify(themeId));
          }
        }catch(e){}

        // Re-render themes page to update active state
        const body = root.querySelector('[data-ph="appBody"]');
        if (body && state.app === 'themes') renderThemes(body);
      }

      function loadTheme(){
        try{
          let t = null;

          // 先读新key
          if (typeof lsGet === 'function'){
            t = lsGet(LS_PHONE_G_THEME, '');
          }else{
            const raw = W.localStorage.getItem(LS_PHONE_G_THEME);
            // 兼容：有人可能直接 setItem 字符串，也可能是 JSON.stringify
            t = raw ? (raw.startsWith('"') ? JSON.parse(raw) : raw) : '';
          }

          // 兼容旧key：meow_phone_theme（如果新key为空，就读旧key并迁移）
          if (!t){
            try{
              const old = W.localStorage.getItem('meow_phone_theme') || '';
              if (old){
                t = old;
                // 迁移写回新key（不删旧key，避免你回退版本时丢）
                try{
                  if (typeof lsSet === 'function') lsSet(LS_PHONE_G_THEME, t);
                  else W.localStorage.setItem(LS_PHONE_G_THEME, JSON.stringify(t));
                }catch(_){}
              }
            }catch(_){}
          }

          // 应用到 UI
          if (t){
            root.setAttribute('data-theme', t === 'modern' ? '' : t);
          }
        }catch(e){}
      }

function bindPageScroll(){
        try{
          const pages = root.querySelector('[data-ph="pages"]');
          const dots = root.querySelector('[data-ph="dots"]');
          if (!pages||!dots) return;

          function updateDots(i){
            try{
              state.page = Math.max(0, i|0);
              dots.querySelectorAll('.dot').forEach((el,idx)=>el.classList.toggle('on',idx===state.page));
            }catch(e){}
          }
          function scrollToPage(i, smooth){
            const max = Math.max(0, pages.children.length - 1);
            const next = Math.max(0, Math.min(max, Number(i)||0));
            const left = next * (pages.clientWidth || 1);
            updateDots(next);
            try{ pages.scrollTo({left,behavior:(smooth===false?'auto':'smooth')}); }
            catch(_){ pages.scrollLeft = left; }
          }
          root.__phScrollToPage = scrollToPage;

          pages.style.touchAction = 'pan-x';
          pages.style.scrollBehavior = 'smooth';

          let scrollT = null;
          pages.addEventListener('scroll',()=>{
            try{
              clearTimeout(scrollT);
              const i=Math.round(pages.scrollLeft/(pages.clientWidth||1));
              updateDots(i);
              scrollT = setTimeout(()=>{
                // 收手后强制吸附（某些端 scroll-snap 不稳定）
                if (!state.editMode) scrollToPage(state.page, true);
              }, 80);
            }catch(e){}
          },{passive:true});

          dots.addEventListener('click',(e)=>{
            const dot=e.target?.closest?.('.dot');
            if(!dot) return;
            const i=Number(dot.getAttribute('data-dot')||0);
            scrollToPage(i, true);
          },{passive:true});

          // iOS/安卓某些 WebView 横向翻页不稳定：加一层手势兜底
          let g = null;
          function gDown(e){
            if (state.view !== 'home' || state.mode !== 'full' || state.editMode) return;
            const p = e.touches ? e.touches[0] : e;
            if (!p) return;
            if (e.target.closest('.phDock,.phSearch,.phDots,.editDoneBtn')) return;
            g = {
              x0:p.clientX, y0:p.clientY,
              left0:pages.scrollLeft,
              lock:null, moved:false
            };
          }
          function gMove(e){
            if (!g || state.editMode) return;
            const p = e.touches ? e.touches[0] : e;
            if (!p) return;
            const dx = p.clientX - g.x0;
            const dy = p.clientY - g.y0;
            if (g.lock == null){
              if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
              g.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            }
            if (g.lock !== 'x') return;
            g.moved = true;
            pages.scrollLeft = g.left0 - dx;
            if (e.cancelable) e.preventDefault();
          }
          function gUp(e){
            if (!g) return;
            if (g.lock === 'x'){
              const p = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
              const dx = p ? (p.clientX - g.x0) : 0;
              const base = Math.round((g.left0)/(pages.clientWidth||1));
              let next = base;
              if (Math.abs(dx) > 42) next = dx < 0 ? (state.page + 1) : (state.page - 1);
              else next = Math.round(pages.scrollLeft/(pages.clientWidth||1));
              scrollToPage(next, true);
            }
            g = null;
          }

          pages.addEventListener('touchstart', gDown, {passive:true});
          pages.addEventListener('touchmove', gMove, {passive:false});
          pages.addEventListener('touchend', gUp, {passive:true});
          pages.addEventListener('mousedown', gDown);
          pages.addEventListener('mousemove', gMove);
          pages.addEventListener('mouseup', gUp);
          pages.addEventListener('mouseleave', gUp);
        }catch(e){}
      }

      /* ========== 模式切换 ========== */
      function applyPosition(){
        const vw = W.innerWidth || doc.documentElement.clientWidth || 800;
        const vh = W.innerHeight || doc.documentElement.clientHeight || 600;
        const saved = loadPos();

        let x, y;
        if (saved && saved.x != null && saved.y != null){
          x = saved.x;
          y = saved.y;
        } else {
          // 默认：右下角，距离边缘 16px
          const rw0 = (state.mode === 'pill') ? 56 : 340;
          const rh0 = (state.mode === 'pill') ? 56 : 600;
          x = vw - rw0 - 16;
          y = vh - rh0 - 16;
        }

        // 不允许出屏：整个窗口都要在屏内
        const rw = root.offsetWidth  || ((state.mode === 'pill') ? 56 : 340);
        const rh = root.offsetHeight || ((state.mode === 'pill') ? 56 : 600);
        const maxX = Math.max(0, vw - rw);
        const maxY = Math.max(0, vh - rh);

        x = Math.max(0, Math.min(maxX, x));
        y = Math.max(0, Math.min(maxY, y));

        root.style.left = x + 'px';
        root.style.top  = y + 'px';
        root.style.right = 'auto';
        root.style.bottom = 'auto';

        state.posX = x;
        state.posY = y;
      }

      function clearPosition(){
        root.style.left = '';
        root.style.top = '';
        root.style.right = '';
        root.style.bottom = '';
        root.style.width = '';
        root.style.height = '';
        root.style.inset = '';
      }

      /* ========== 居中定位（full 模式打开时调用） ========== */
      function centerPhone(){
        const vw = W.innerWidth || doc.documentElement.clientWidth || 800;
        const vh = W.innerHeight || doc.documentElement.clientHeight || 600;
        const s = state.scale || 1;
        const shell = root.querySelector('.phShell');
        const rawW = shell ? shell.offsetWidth : Math.min(375, vw * 0.96);
        const rawH = shell ? shell.offsetHeight : Math.min(750, vh * 0.90);
        const rw = rawW * s;
        const rh = rawH * s;
        const x = Math.max(0, (vw - rw) / 2);
        const y = Math.max(0, (vh - rh) / 2);
        root.style.left = x + 'px';
        root.style.top  = y + 'px';
        root.style.right = 'auto';
        root.style.bottom = 'auto';
        state.posX = x;
        state.posY = y;
      }

      /* ========== 缩放系统 ========== */
      const SCALE_STEP = 0.1;
      const SCALE_MIN = 0.35;
      const SCALE_MAX = 1.2;
      state.scale = 1;

      function applyScale(){
        const shell = root.querySelector('.phShell');
        if (!shell) return;
        shell.style.transform = 'scale(' + state.scale + ')';
        shell.style.transformOrigin = 'top left';
        const label = root.querySelector('[data-ph="zoomLabel"]');
        if (label) label.textContent = Math.round(state.scale * 100) + '%';
        // 更新缩放栏位置：需要跟随缩放后 shell 底部
        const zbar = root.querySelector('.phZoomBar');
        if (zbar){
          const rawH = shell.offsetHeight || 750;
          zbar.style.top = (rawH * state.scale + 8) + 'px';
          zbar.style.bottom = 'auto';
        }
      }

      function zoomIn(){
        state.scale = Math.min(SCALE_MAX, +(state.scale + SCALE_STEP).toFixed(2));
        applyScale();
        // 缩放后重新居中
        centerPhone();
      }
      function zoomOut(){
        state.scale = Math.max(SCALE_MIN, +(state.scale - SCALE_STEP).toFixed(2));
        applyScale();
        centerPhone();
      }
      function zoomReset(){
        state.scale = 1;
        applyScale();
        centerPhone();
      }

// 🧩 setMode：模式切换的唯一入口（full/mini/pill/hidden）生命周期标注
// full：居中 + 缩放条生效 + 打开桌面
// mini：取消 scale transform + 打开聊天列表或会话详情
// pill：变成悬浮条（轻点展开回 full）
// hidden：彻底隐藏但不销毁（常驻内存）
      function setMode(mode){
        state.mode = mode;
        ensureRoot();
        root.classList.remove('full','mini','pill');
        clearPosition();

        if (mode === 'full'){
          root.classList.add('full');
          // 居中显示并应用缩放
          applyScale();
          // 需要先让 DOM 渲染才能拿到正确尺寸，用 rAF
          requestAnimationFrame(()=>{
            centerPhone();
          });
          openHome();
          updateTime();
        } else if (mode === 'mini'){
          root.classList.add('mini');
          // mini 模式不应用 scale transform
          const shell = root.querySelector('.phShell');
          if (shell){ shell.style.transform = ''; }
          applyPosition();
          if (state.chatTarget) renderChatDetail(state.chatTarget);
          else openApp('chats');
        } else if (mode === 'pill'){
          root.classList.add('pill');
          applyPosition();
        } else {
          // hidden
          state.view = 'home'; state.app = 'home'; state.chatTarget = null;
          root.setAttribute('data-view','home');
          // ✅ 清理 AI 请求
          try{ PhoneAI.abort(); _hideTypingIndicator(); }catch(e){}
        }
      }

      function showFull(){ setMode('full'); }
      function showMini(){ setMode('mini'); }
      function showPill(){ setMode('pill'); }
      function hide(){ setMode('hidden'); }

      function updateTime(){
        try{
          // ✅ 故事时间模式：不覆盖，使用自定义时间
          try{
            const _tcfg = phoneLoadSettings();
            if (_tcfg.timeMode === 'story'){
              ensureRoot();
              const _te = root?.querySelector?.('[data-ph="time"]');
              const _de = root?.querySelector?.('[data-ph="date"]');
              if (_te) _te.textContent = _tcfg.storyTime || '12:00';
              if (_de) _de.textContent = _tcfg.storyDate || '故事时间';
              return;
            }
          }catch(_e){}
          ensureRoot();
          const t = root.querySelector('[data-ph="time"]');
          if (t) t.textContent = timeStr();
        }catch(e){}
      }

      /* ========== 初始化 ========== */
// 🚀 initOnce：只初始化一次（创建 root、注入 CSS、绑定事件、启动时钟）
// 说明：模块常驻，不随弹窗销毁；所以这里必须“幂等”
      function initOnce(){
        ensureRoot();
        loadTheme();
        // ✅ 加载设置（壁纸 + 字体 + 时间模式）
        try{
          const _cfg = phoneLoadSettings();
          try{ phoneApplyVisualFromSettings(_cfg); }catch(e){}
          if (_cfg.fontSize && _cfg.fontSize !== 14) phoneApplyFontSize(_cfg.fontSize);
        }catch(e){}
        updateTime();
        try{
          const tid = setInterval(updateTime, 15000);
          if (MEOW.core?.timers) MEOW.core.timers.addInterval(tid);
        }catch(e){}
        try{
          W.addEventListener('resize',()=>{ if(state.mode==='full') updateTime(); },{passive:true});
        }catch(e){}
        // MeowDB 初始化（IndexedDB 基础设施）
        try{
          MeowDB.init().then(function(ok){
            if(ok) void(0)&&console.log('[MeowDB] 数据库就绪');
            else console.warn('[MeowDB] 数据库不可用，将使用降级存储');
          }).catch(function(e){ console.warn('[MeowDB] init promise error:', e); });
        }catch(e){ console.warn('[MeowDB] init error:', e); }
        // AutoFeed 初始化
        try{ AutoFeedEngine.init(); }catch(e){ console.warn('[AutoFeed] init error:', e); }
      }

      return { initOnce, showFull, showMini, showPill, hide, openApp, openHome, openChat, state };
    })();
  }

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



  console.log('[MEOW Phone] 小手机插件已加载 ✓');
})();

