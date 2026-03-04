// 书苑觅·世界书模块
(function waitForMEOW(){
  if (typeof MEOW === 'undefined' || !MEOW.mods || typeof lsGet === 'undefined' || typeof toast === 'undefined') {
    return setTimeout(waitForMEOW, 50);
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
    s.src = "https://raw.githubusercontent.com/z1551170381-ux/shuyuanmi/main/phone.js";
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

  try{ MEOW.mods.register('worldbook', { title:'世界书', open: ()=>{ try{ openWorldbookModal(); }catch(e){ try{ toast('世界书未就绪'); }catch(_){} } } }); }catch(e){}
})();
