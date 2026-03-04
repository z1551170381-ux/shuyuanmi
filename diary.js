// 书苑觅·日记模块
(function waitForMEOW(){
  if (typeof MEOW==='undefined'||!MEOW.mods||typeof lsGet==='undefined'||typeof toast==='undefined'||typeof modalShell==='undefined') {
    return setTimeout(waitForMEOW, 50);
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

// ✅ 全局聊天切换检测器（不依赖 MutationObserver，纯定时轮询）
(function meowGlobalChatPoller(){
  let lastUID = '';
  try{ lastUID = meowGetChatUID(); }catch(e){}

  // ✅ 专门追踪 SillyTavern 原生 chatId（分支检测更灵敏）
  let lastRawChatId = '';
  function getRawChatId(){
    try{
      const ctx = (window.SillyTavern?.getContext?.() ||
                   window.top?.SillyTavern?.getContext?.() ||
                   window.parent?.SillyTavern?.getContext?.());
      return String(ctx?.chatId || '') || '';
    }catch(e){ return ''; }
  }
  try{ lastRawChatId = getRawChatId(); }catch(e){}

  function doSwitch(now, old){
    void(0)&&console.log('[MEOW][Poller] 聊天切换检测到:', old.slice(0,30), '→', now.slice(0,30));

    // 1) 保存旧聊天世界书 + 加载新聊天世界书
    try{ meowSaveWBForChat(old); }catch(e){}

    // 2) 加载新聊天本地世界书
    let loaded = false;
    try{ loaded = meowLoadWBForChat(now); }catch(e){}
    if (!loaded){
      try{
        const fresh = meowMakeFreshWB(now) || meowMakeFreshWBForChat();
        if (fresh){ lsSet(LS_WB, fresh); meowSaveWBForChat(now); }
      }catch(e){}
    }

    // 3) 刷新世界书 UI
    try{ window.MEOW_WB_REFRESH?.(); }catch(e){}

    // 4) ✅ 切换酒馆世界书条目 enabled 状态
    (async ()=>{
      try{
        await meowToggleTavernEntries(now);
        void(0)&&console.log('[MEOW][Poller] meowToggleTavernEntries 完成:', now.slice(0,30));
      }catch(e){
        console.warn('[MEOW][Poller] toggle 失败:', e);
      }
    })();

    // 5) 更新总结弹窗（如果开着的话）
    window.__MEOW_SUM_ACTIVE_UID__ = now;
    if (typeof window.__MEOW_SUM_CHAT_SWITCH__ === 'function'){
      try{ window.__MEOW_SUM_CHAT_SWITCH__(now); }catch(e){}
    }
  }

  setInterval(()=>{
    try{
      // ✅ 双重检测：先看 SillyTavern 原生 chatId 是否变了（分支场景更灵敏）
      const rawNow = getRawChatId();
      if (rawNow && rawNow !== lastRawChatId){
        lastRawChatId = rawNow;
        // 原生 chatId 变了 → 强制重算 UID
        const now = meowGetChatUID();
        if (now && !now.startsWith('fallback:') && !now.startsWith('char:')){
          if (now !== lastUID){
            const old = lastUID;
            lastUID = now;
            doSwitch(now, old);
          }
          return;
        }
      }

      const now = meowGetChatUID();
      // 跳过临时/无效 UID
      if (!now || now.startsWith('fallback:') || now.startsWith('char:')) return;
      if (now === lastUID) return;

      const old = lastUID;
      lastUID = now;
      doSwitch(now, old);
    }catch(e){}
  }, 1500);  // ✅ 从 2500 降到 1500，分支检测更灵敏


})();



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

  try{ MEOW.mods.register('diary',{title:'日记',open:()=>{try{openDiaryModal();}catch(e){try{toast('日记未就绪');}catch(_){}}}}); }catch(e){}
})();
