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

  try{ MEOW.mods.register('diary',{title:'日记',open:()=>{try{openDiaryModal();}catch(e){try{toast('日记未就绪');}catch(_){}}}}); }catch(e){}
})();
