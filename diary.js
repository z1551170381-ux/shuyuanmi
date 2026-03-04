// 书苑觅·日记模块
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

  try{ MEOW.mods.register('diary',{title:'日记',open:()=>{try{openDiaryModal();}catch(e){try{toast('日记未就绪');}catch(_){}}}}); }catch(e){}
})();
