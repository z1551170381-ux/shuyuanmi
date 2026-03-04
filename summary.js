// 书苑觅·总结模块
(function waitForMEOW(){
  if (typeof MEOW==='undefined'||!MEOW.mods||typeof window.__meow__==='undefined') {
    return setTimeout(waitForMEOW, 50);
  }
  // 从 index.js 注入的共享函数
  const lsGet=window.__meow__.lsGet, lsSet=window.__meow__.lsSet, toast=window.__meow__.toast;
  const modalShell=window.__meow__.modalShell, removeEl=window.__meow__.removeEl;
  const closeModal=window.__meow__.closeModal, closeOverlays=window.__meow__.closeOverlays;
  const meowGetSTCtx=window.__meow__.meowGetSTCtx, meowGetChatUID=window.__meow__.meowGetChatUID;
  const LS_WB=window.__meow__.LS_WB, LS_DIARY=window.__meow__.LS_DIARY;
  const LS_API=window.__meow__.LS_API, LS_PROMP=window.__meow__.LS_PROMP;
  const MEOW_WB_API=window.__meow__.MEOW_WB_API;
  const doc=window.__meow__.doc||document;
  const esc=window.__meow__.esc;
 function openSummaryModal(){
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
  // opts: { title, fields: [{label, key, value, type:'input'|'textarea'}], onConfirm(values), onDelete?() }
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

  // ★ 插入到模态窗口内部（避免 backdrop-filter 创建的 stacking context 遮挡）
  var modalHost = doc.getElementById('meow-summary-modal') || doc.getElementById('meow-diary-modal') || doc.body;
  modalHost.appendChild(overlay);

  // Focus first input
  setTimeout(function(){ var first = popup.querySelector('input,textarea'); if (first) first.focus(); }, 50);

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
    html += '<th' + tip + ' style="padding:6px 8px;border:1px solid var(--meow-line,rgba(28,24,18,.08));background:var(--meow-accent-soft,rgba(198,186,164,.15));font-weight:700;min-width:80px;font-size:11px;user-select:none;color:var(--meow-text,rgba(46,38,30,.7));">' + esc(data.cols[ci]) + '</th>';
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
        var el = e.target.closest ? e.target.closest('[data-ct-delrow],[data-ct-addcol],[data-ct-preview-row]') : e.target;
        if (!el) return;
        var data = (window.__meowReadCurrentData || meowTableMetaRead || function(){return null})();
        if (!data) return;

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

    toast(`已校正到当前聊天${st?.out ? '（有总结）' : '（暂无总结）'}`);
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
    toast(`已切换到该聊天${st?.out ? '（有总结）' : '（暂无总结）'}`);
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

  try{ MEOW.mods.register('summary',{title:'总结',open:()=>{try{openSummaryModal();}catch(e){try{toast('总结未就绪');}catch(_){}}}}); }catch(e){}
})();
