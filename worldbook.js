// 书苑觅·世界书模块
(function waitForMEOW(){
  if (typeof MEOW==='undefined'||!MEOW.mods||typeof lsGet==='undefined'||typeof toast==='undefined'||typeof modalShell==='undefined') {
    return setTimeout(waitForMEOW, 50);
  }
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
  scrollbar-width:none;
  padding:2px 2px 0;
}
#wbv4_root .wbv4Tabs::-webkit-scrollbar{ display:none; }

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
    'appearance:auto;max-width:120px;';

  // 注意：把“可视化”做短，不要“表格可视化 ▾”这种长文案
  sel.innerHTML =
    '<option value="table">可视化</option>' +
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

    // ===== 构建 HTML =====
    let html = '';
    for (const c of items){
      const table = parseTextToTable(c.text);

      if (table && table.headers.length){
        // 表格视图
        html += `
  <div class="wbv4CardWrap" data-id="${esc(c.id)}">
    <div class="wbv4Card" data-open="${esc(c.id)}" style="padding:8px;overflow-x:auto;">
      <div class="wbv4TitleRow" style="margin-bottom:8px;">
        <div class="wbv4Title">${esc(c.title||'未命名')}</div>
        <div class="wbv4Key">${esc(c.key||'')}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.4;">
        <thead>
          <tr>${table.headers.map(h=>`<th style="text-align:left;padding:6px 8px;border-bottom:2px solid var(--meow-line,rgba(0,0,0,.12));font-weight:900;color:var(--meow-text,rgba(72,60,48,.90));white-space:nowrap;">${esc(h)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${table.rows.map(row=>`<tr>${row.map((cell,ci)=>`<td style="padding:5px 8px;border-bottom:1px solid var(--meow-line,rgba(0,0,0,.06));color:var(--meow-text);word-break:break-word;max-width:${Math.floor(100/table.headers.length)}vw;">${esc(cell)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
      } else {
        // 纯文本视图（无法解析为表格时）
        html += `
  <div class="wbv4CardWrap" data-id="${esc(c.id)}">
    <div class="wbv4Card" data-open="${esc(c.id)}">
      <div class="wbv4TitleRow">
        <div class="wbv4Title">${esc(c.title||'未命名')}</div>
        <div class="wbv4Key">${esc(c.key||'')}</div>
      </div>
      <div class="wbv4Text" style="white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.5;color:var(--meow-text);">${esc(c.text||'（空）')}</div>
    </div>
  </div>`;
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

  try{ MEOW.mods.register('worldbook',{title:'世界书',open:()=>{try{openWorldbookModal();}catch(e){try{toast('世界书未就绪');}catch(_){}}}}); }catch(e){}
})();
