// =====================================================================
//  meow-voice.js · 喵喵语音朗读  独立版 v1.0
//  ✅ 零依赖：可单独加载，无需 meow-core.js
//  ✅ 兼容集成：检测到 meow-core 时自动注入扇形菜单第5个按钮
//  ✅ 独立入口：未检测到 meow-core 时显示独立可拖动悬浮按钮
// =====================================================================

(() => {
  if (window.MEOW_VOICE_V1) return;
  window.MEOW_VOICE_V1 = true;

  // ════════════════════════════════════════════════════════════════════
  //  § 1  环境 & 基础工具
  // ════════════════════════════════════════════════════════════════════

  function pickHost() {
    for (const w of [window, window.top, window.parent]) {
      try { if (w?.document?.documentElement) return { W: w, doc: w.document }; } catch(e) {}
    }
    return { W: window, doc: document };
  }
  let { W, doc } = pickHost();

  function lsGet(key, fallback) {
    try {
      const v = W.localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch(e) { return fallback; }
  }
  function lsSet(key, val) {
    try { W.localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }

  function toast(msg) {
    // 优先复用 meow-core 的 toast；否则自己画一个
    try {
      const fn = window.MEOW?.core?.toast;
      if (typeof fn === 'function') { fn(msg); return; }
    } catch(e) {}
    try {
      doc.querySelectorAll('.mv-toast').forEach(x => x.remove());
      const t = doc.createElement('div');
      t.className = 'mv-toast';
      t.textContent = msg;
      Object.assign(t.style, {
        position: 'fixed', left: '50%', top: '18%',
        transform: 'translate3d(-50%,0,0)',
        background: 'rgba(29,29,29,.56)', color: '#fff',
        padding: '9px 16px', borderRadius: '12px',
        fontSize: '14px', fontWeight: '600',
        zIndex: '2147483650', pointerEvents: 'none',
        border: '1px solid rgba(255,255,255,.18)',
        boxShadow: '0 10px 28px rgba(0,0,0,.35)',
        maxWidth: '78vw', textAlign: 'center',
      });
      (doc.documentElement || doc.body).appendChild(t);
      setTimeout(() => t.remove(), 1800);
    } catch(e) {}
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 2  配置 Keys & 读取
  // ════════════════════════════════════════════════════════════════════

  const LS = {
    ENABLED:      'meow_voice_enabled_v1',
    RATE:         'meow_voice_rate_v1',
    PITCH:        'meow_voice_pitch_v1',
    VOLUME:       'meow_voice_volume_v1',
    MODE:         'meow_voice_mode_v1',
    DEF_VOICE:    'meow_voice_default_v1',
    CHAR_MAP:     'meow_voice_char_map_v1',
    SKIP_STAR:    'meow_voice_skip_star_v1',
    SKIP_BRACKET: 'meow_voice_skip_bracket_v1',
    SKIP_PATTERN: 'meow_voice_skip_pattern_v1',
    READ_USER:    'meow_voice_read_user_v1',
    POS:          'meow_voice_btn_pos_v1',
  };

  const ID = {
    MODAL: 'meow-voice-modal',
    MASK:  'meow-voice-mask',
    BTN:   'meow-voice-solo-btn',
  };

  function cfg() {
    return {
      enabled:      lsGet(LS.ENABLED,      true),
      rate:         lsGet(LS.RATE,         1.0),
      pitch:        lsGet(LS.PITCH,        1.0),
      volume:       lsGet(LS.VOLUME,       1.0),
      mode:         lsGet(LS.MODE,         'all'),
      defVoice:     lsGet(LS.DEF_VOICE,    ''),
      charMap:      lsGet(LS.CHAR_MAP,     {}),
      skipStar:     lsGet(LS.SKIP_STAR,    true),
      skipBracket:  lsGet(LS.SKIP_BRACKET, false),
      skipPattern:  lsGet(LS.SKIP_PATTERN, ''),
      readUser:     lsGet(LS.READ_USER,    false),
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 3  语音引擎
  // ════════════════════════════════════════════════════════════════════

  const synth = window.speechSynthesis;
  let isReading = false;

  function getVoices() {
    return new Promise(resolve => {
      let v = synth?.getVoices() || [];
      if (v.length) return resolve(v);
      const t = setInterval(() => {
        v = synth.getVoices();
        if (v.length) { clearInterval(t); resolve(v); }
      }, 100);
      setTimeout(() => { clearInterval(t); resolve(synth?.getVoices() || []); }, 3000);
    });
  }

  function processText(raw, c) {
    let text = String(raw || '').trim();
    // 去 markdown 标记
    text = text.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '');
    // 过滤选项
    if (c.skipStar)    text = text.replace(/\*[^*\n]{0,120}\*/g, '');
    if (c.skipBracket) text = text.replace(/[【\[][^\]】\n]{0,80}[】\]]/g, '');
    if (c.skipPattern?.trim()) {
      try { text = text.replace(new RegExp(c.skipPattern, 'g'), ''); } catch(e) {}
    }
    // 朗读范围
    if (c.mode === 'dialogue') {
      const hits = [];
      for (const rx of [/"([^"]{1,200})"/g, /『([^』]{1,200})』/g, /「([^」]{1,200})」/g, /"([^"]{1,200})"/g]) {
        let m; while ((m = rx.exec(text)) !== null) hits.push(m[1]);
      }
      text = hits.join('。') || text;
    } else if (c.mode === 'narration') {
      text = text
        .replace(/"[^"]{0,200}"/g, '')
        .replace(/『[^』]{0,200}』/g, '')
        .replace(/「[^」]{0,200}」/g, '')
        .replace(/"[^"]{0,200}"/g, '');
    }
    return text.replace(/\n{2,}/g, '。').replace(/\s+/g, ' ').trim();
  }

  function stopReading() {
    try { synth.cancel(); } catch(e) {}
    isReading = false;
    updateBtnState(false);
  }

  async function speakText(rawText, charName) {
    if (!synth) { toast('🔇 当前环境不支持语音合成'); return; }
    stopReading();
    const c = cfg();
    const text = processText(rawText, c);
    if (!text) return;

    const voices = await getVoices();
    const voiceURI = (charName && c.charMap[charName]) ? c.charMap[charName] : c.defVoice;
    const voice = voices.find(v => v.voiceURI === voiceURI) || null;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate   = Math.max(0.1, Math.min(10,  +c.rate   || 1.0));
    utter.pitch  = Math.max(0,   Math.min(2,   +c.pitch  || 1.0));
    utter.volume = Math.max(0,   Math.min(1,   +c.volume || 1.0));
    if (voice) utter.voice = voice;

    utter.onstart = () => { isReading = true;  updateBtnState(true);  };
    utter.onend   = () => { isReading = false; updateBtnState(false); };
    utter.onerror = () => { isReading = false; updateBtnState(false); };
    synth.speak(utter);
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 4  SVG 图标
  // ════════════════════════════════════════════════════════════════════

  const ICON_VOICE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const ICON_STOP  = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;

  // ════════════════════════════════════════════════════════════════════
  //  § 5  按钮状态同步
  // ════════════════════════════════════════════════════════════════════

  function updateBtnState(playing) {
    // 独立悬浮按钮
    try {
      const b = doc.getElementById(ID.BTN);
      if (b) {
        b.querySelector('.mv-ico').innerHTML = playing ? ICON_STOP : ICON_VOICE;
        b.style.background = playing ? 'rgba(220,100,80,.22)' : 'rgba(255,255,255,.18)';
      }
    } catch(e) {}
    // 扇形菜单内注入的按钮
    try {
      const fb = doc.getElementById('meow-voice-fan-btn');
      if (fb) {
        fb.querySelector('.i').innerHTML = playing ? ICON_STOP : ICON_VOICE;
        fb.style.background = playing ? 'rgba(220,100,80,.18)' : '';
      }
    } catch(e) {}
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 6  自动朗读：监听聊天新消息
  // ════════════════════════════════════════════════════════════════════

  let lastReadId = '';

  function tryAutoRead(node) {
    try {
      if (!cfg().enabled) return;
      const mid = node.getAttribute('mesid') || node.dataset?.mesid || '';
      if (mid && mid === lastReadId) return;

      const isUser = node.getAttribute('is_user') === 'true' || node.classList.contains('user_mes');
      if (isUser && !cfg().readUser) return;

      const charName = (
        node.querySelector('.name_text') || node.querySelector('.ch_name')
      )?.textContent?.trim() || '';

      const textEl  = node.querySelector('.mes_text');
      const rawText = textEl ? (textEl.innerText || textEl.textContent || '') : '';
      if (!rawText.trim()) return;

      lastReadId = mid;
      speakText(rawText, charName);
    } catch(e) {}
  }

  function bindChatObserver() {
    const root = doc.querySelector('.simplebar-content-wrapper')
               || doc.querySelector('#chat')
               || doc.body;
    if (!root) { setTimeout(bindChatObserver, 1000); return; }

    new MutationObserver(muts => {
      for (const mut of muts) {
        for (const node of mut.addedNodes) {
          if (node?.nodeType !== 1) continue;
          if (node.classList?.contains('mes') || node.hasAttribute?.('mesid')) {
            setTimeout(() => tryAutoRead(node), 400);
          }
        }
      }
    }).observe(root, { childList: true, subtree: true });
  }

  setTimeout(bindChatObserver, 1200);

  // ════════════════════════════════════════════════════════════════════
  //  § 7  私有 CSS（注入一次）
  // ════════════════════════════════════════════════════════════════════

  function injectCSS() {
    const sid = 'meow-voice-style-v1';
    if (doc.getElementById(sid)) return;
    const s = doc.createElement('style');
    s.id = sid;
    s.textContent = `
/* ────────────────── 独立悬浮按钮 ────────────────── */
#${ID.BTN}{
  position:fixed; width:40px; height:40px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  background:rgba(255,255,255,.18);
  border:1px solid rgba(255,255,255,.20);
  box-shadow:0 10px 26px rgba(0,0,0,.25);
  z-index:2147483399;
  user-select:none; touch-action:none;
  -webkit-tap-highlight-color:transparent;
  cursor:pointer;
  color:rgba(46,38,30,.78);
  transition:background .15s;
}
#${ID.BTN} .mv-ico{ display:flex; align-items:center; justify-content:center; }

/* ────────────────── 遮罩 ────────────────── */
#${ID.MASK}{
  position:fixed; inset:0;
  z-index:2147483300;
  background:rgba(0,0,0,.07);
}

/* ────────────────── 弹窗框架 ────────────────── */
#${ID.MODAL}{
  position:fixed;
  inset: max(10px, env(safe-area-inset-top,0px)) 10px
         max(10px, env(safe-area-inset-bottom,0px)) 10px;
  height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 20px);
  overflow:auto; -webkit-overflow-scrolling:touch;
  background:var(--meow-bg-strong, rgba(245,242,237,.92));
  border:1px solid var(--meow-line, rgba(28,24,18,.12));
  border-radius:16px;
  box-shadow:0 20px 60px rgba(0,0,0,.14);
  z-index:2147483400;
  backdrop-filter:blur(18px) saturate(1.1);
  -webkit-backdrop-filter:blur(18px) saturate(1.1);
  color:var(--meow-text, rgba(46,38,30,.82));
}
#${ID.MODAL} .mv-hd{
  position:sticky; top:0; z-index:2;
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 14px 12px;
  background:var(--meow-bg-strong, rgba(245,242,237,.94));
  border-bottom:1px solid var(--meow-line, rgba(28,24,18,.1));
}
#${ID.MODAL} .mv-title{
  font-size:16px; font-weight:900;
  color:var(--meow-text, rgba(46,38,30,.82));
  display:flex; align-items:center; gap:8px;
}
#${ID.MODAL} .mv-close{
  width:34px; height:34px; border-radius:10px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  background:var(--meow-card, rgba(255,255,255,.58));
  border:1px solid var(--meow-line, rgba(28,24,18,.12));
  color:var(--meow-text, rgba(46,38,30,.6));
  font-size:16px; font-weight:600;
}
#${ID.MODAL} .mv-body{ padding:12px; }

/* ────────────────── 卡片段落 ────────────────── */
#${ID.MODAL} .mv-sec{
  background:var(--meow-card, rgba(255,255,255,.42));
  border:1px solid var(--meow-line, rgba(28,24,18,.08));
  border-radius:14px; padding:12px 14px; margin-bottom:10px;
}
#${ID.MODAL} .mv-sec h3{
  font-size:13px; font-weight:700;
  color:var(--meow-text, rgba(46,38,30,.82));
  margin:0 0 10px; display:flex; align-items:center; gap:6px;
}
#${ID.MODAL} .mv-row{
  display:flex; align-items:center; gap:10px;
  margin-bottom:10px; flex-wrap:wrap;
}
#${ID.MODAL} .mv-lbl{
  font-size:12px; color:var(--meow-text, rgba(46,38,30,.82)); min-width:60px;
}
#${ID.MODAL} .mv-val{
  font-size:12px; color:rgba(46,38,30,.45); min-width:34px; text-align:right;
}
#${ID.MODAL} input[type=range]{
  flex:1; min-width:80px; accent-color:var(--meow-accent, #8b7355);
}
#${ID.MODAL} select,
#${ID.MODAL} input[type=text]{
  background:var(--meow-bg-strong, rgba(255,255,255,.72));
  border:1px solid var(--meow-line, rgba(28,24,18,.12));
  border-radius:10px; padding:8px 10px;
  font-size:13px; color:var(--meow-text, rgba(46,38,30,.82));
  outline:none; width:100%; box-sizing:border-box;
}

/* ────────────────── Toggle 开关 ────────────────── */
#${ID.MODAL} .mv-toggle{
  display:flex; align-items:center; justify-content:space-between;
  padding:6px 0; cursor:pointer;
}
#${ID.MODAL} .mv-toggle > span{
  font-size:13px; color:var(--meow-text, rgba(46,38,30,.82));
}
#${ID.MODAL} .mv-sw{
  position:relative; width:42px; height:24px; flex-shrink:0;
}
#${ID.MODAL} .mv-sw input{ opacity:0; width:0; height:0; position:absolute; }
#${ID.MODAL} .mv-slider{
  position:absolute; inset:0; border-radius:12px;
  background:rgba(28,24,18,.15); cursor:pointer; transition:background .2s;
}
#${ID.MODAL} .mv-slider::before{
  content:''; position:absolute;
  width:18px; height:18px; left:3px; top:3px;
  border-radius:50%; background:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,.2); transition:transform .2s;
}
#${ID.MODAL} .mv-sw input:checked + .mv-slider{ background:var(--meow-accent, #8b7355); }
#${ID.MODAL} .mv-sw input:checked + .mv-slider::before{ transform:translateX(18px); }

/* ────────────────── 朗读模式卡片 ────────────────── */
#${ID.MODAL} .mv-mode-grid{
  display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:6px;
}
#${ID.MODAL} .mv-mode-card{
  border:1px solid var(--meow-line, rgba(28,24,18,.1));
  border-radius:10px; padding:9px 10px;
  cursor:pointer; font-size:12px; text-align:center;
  background:var(--meow-bg-strong, rgba(255,255,255,.5));
  color:var(--meow-text, rgba(46,38,30,.82));
  transition:all .15s; user-select:none; line-height:1.5;
}
#${ID.MODAL} .mv-mode-card.active{
  border-color:var(--meow-accent, #8b7355) !important;
  background:rgba(139,115,85,.12) !important;
  font-weight:700;
}

/* ────────────────── 按钮 ────────────────── */
#${ID.MODAL} .mv-btn{
  padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600;
  border:1px solid var(--meow-line, rgba(28,24,18,.1));
  background:var(--meow-card, rgba(255,255,255,.5));
  color:var(--meow-text, rgba(46,38,30,.82));
  cursor:pointer; white-space:nowrap; transition:opacity .15s;
}
#${ID.MODAL} .mv-btn.primary{
  background:var(--meow-accent, #8b7355);
  color:#fff; border-color:transparent;
}
#${ID.MODAL} .mv-btn:active{ opacity:.72; }
#${ID.MODAL} .mv-hint{
  font-size:11px; color:rgba(46,38,30,.45);
  margin-top:4px; line-height:1.5;
}
#${ID.MODAL} .mv-test-bar{ display:flex; gap:8px; margin-top:8px; }
#${ID.MODAL} .mv-test-bar input{ flex:1; }
#${ID.MODAL} .mv-footer{
  display:flex; gap:8px; padding:4px 0 8px;
}
`;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 8  设置弹窗
  // ════════════════════════════════════════════════════════════════════

  function openModal() {
    injectCSS();
    doc.getElementById(ID.MODAL)?.remove();

    // 遮罩：优先复用 meow-core 的，否则自建
    let mask = doc.getElementById('meow-pencil-mask') || doc.getElementById(ID.MASK);
    if (!mask) {
      mask = doc.createElement('div');
      mask.id = ID.MASK;
      mask.addEventListener('click', closeModal, { passive: true });
      (doc.documentElement || doc.body).appendChild(mask);
    }

    buildModal();
  }

  async function buildModal() {
    const voices    = await getVoices();
    const c         = cfg();
    const charNames = getActiveCharNames();

    // ── HTML 构建辅助 ────────────────────────────────────────────────
    function voiceOpts(selected) {
      const zh    = voices.filter(v => /zh|cmn|cantonese/i.test(v.lang));
      const other = voices.filter(v => !/zh|cmn|cantonese/i.test(v.lang));
      let h = `<option value="">系统默认</option>`;
      if (zh.length)    h += `<optgroup label="── 中文 ──">${zh.map(v    => voiceOpt(v, selected)).join('')}</optgroup>`;
      if (other.length) h += `<optgroup label="── 其他 ──">${other.map(v => voiceOpt(v, selected)).join('')}</optgroup>`;
      return h;
    }
    function voiceOpt(v, sel) {
      return `<option value="${escAttr(v.voiceURI)}" ${v.voiceURI === sel ? 'selected' : ''}>${esc(v.name)} (${v.lang})</option>`;
    }
    function charRows(names, map) {
      if (!names.length) return '<p class="mv-hint" style="margin:6px 0">暂无角色，对话开始后会自动检测</p>';
      return names.map(name => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;min-width:80px;color:var(--meow-text,rgba(46,38,30,.82))">${esc(name)}</span>
          <select data-char="${escAttr(name)}" class="mv-char-sel" style="flex:1;min-width:160px">${voiceOpts(map[name] || '')}</select>
        </div>`).join('');
    }

    // ── 弹窗 HTML ────────────────────────────────────────────────────
    const box = doc.createElement('div');
    box.id = ID.MODAL;
    box.innerHTML = `
      <div class="mv-hd">
        <div class="mv-title">${ICON_VOICE}<span>语音朗读</span></div>
        <div class="mv-close">✕</div>
      </div>
      <div class="mv-body">

        <!-- ① 总开关 -->
        <div class="mv-sec">
          <h3>⚡ 自动朗读</h3>
          <label class="mv-toggle">
            <span>收到 AI 回复后自动朗读</span>
            <div class="mv-sw"><input type="checkbox" id="mvAutoRead" ${c.enabled ? 'checked' : ''}><div class="mv-slider"></div></div>
          </label>
          <label class="mv-toggle" style="margin-top:4px">
            <span>同时朗读用户发言</span>
            <div class="mv-sw"><input type="checkbox" id="mvReadUser" ${c.readUser ? 'checked' : ''}><div class="mv-slider"></div></div>
          </label>
        </div>

        <!-- ② 朗读范围 -->
        <div class="mv-sec">
          <h3>📖 朗读范围</h3>
          <div class="mv-mode-grid" id="mvModeGrid">
            <div class="mv-mode-card ${c.mode==='all'?'active':''}"        data-mode="all">📄 全部文本<br><span style="font-size:10px;opacity:.6">完整朗读</span></div>
            <div class="mv-mode-card ${c.mode==='dialogue'?'active':''}"   data-mode="dialogue">💬 仅对话<br><span style="font-size:10px;opacity:.6">引号内内容</span></div>
            <div class="mv-mode-card ${c.mode==='narration'?'active':''}"  data-mode="narration">📝 仅旁白<br><span style="font-size:10px;opacity:.6">引号外内容</span></div>
            <div class="mv-mode-card ${c.mode==='custom'?'active':''}"     data-mode="custom">✂️ 自定义<br><span style="font-size:10px;opacity:.6">正则过滤</span></div>
          </div>
          <div id="mvCustomWrap" style="margin-top:8px;${c.mode !== 'custom' ? 'display:none' : ''}">
            <label style="font-size:12px;color:var(--meow-text,rgba(46,38,30,.82));display:block;margin-bottom:4px">跳过匹配正则的内容：</label>
            <input type="text" id="mvSkipPattern" placeholder="例：\\([^)]*\\) 跳过小括号内容" value="${esc(c.skipPattern || '')}">
          </div>
          <div style="margin-top:10px">
            <label class="mv-toggle">
              <span style="font-size:12px">跳过 *斜体动作描述*</span>
              <div class="mv-sw"><input type="checkbox" id="mvSkipStar" ${c.skipStar ? 'checked' : ''}><div class="mv-slider"></div></div>
            </label>
            <label class="mv-toggle" style="margin-top:4px">
              <span style="font-size:12px">跳过 【系统提示/注释】</span>
              <div class="mv-sw"><input type="checkbox" id="mvSkipBracket" ${c.skipBracket ? 'checked' : ''}><div class="mv-slider"></div></div>
            </label>
          </div>
        </div>

        <!-- ③ 参数 & 默认音色 -->
        <div class="mv-sec">
          <h3>🎚️ 语音参数</h3>
          <div class="mv-row">
            <span class="mv-lbl">朗读速度</span>
            <input type="range" id="mvRate" min="0.5" max="2.0" step="0.1" value="${c.rate}">
            <span class="mv-val" id="mvRateVal">${Number(c.rate).toFixed(1)}x</span>
          </div>
          <div class="mv-row">
            <span class="mv-lbl">音调</span>
            <input type="range" id="mvPitch" min="0.5" max="2.0" step="0.1" value="${c.pitch}">
            <span class="mv-val" id="mvPitchVal">${Number(c.pitch).toFixed(1)}</span>
          </div>
          <div class="mv-row" style="margin-bottom:12px">
            <span class="mv-lbl">音量</span>
            <input type="range" id="mvVolume" min="0" max="1.0" step="0.05" value="${c.volume}">
            <span class="mv-val" id="mvVolumeVal">${Math.round(c.volume * 100)}%</span>
          </div>
          <label style="font-size:12px;color:var(--meow-text,rgba(46,38,30,.82));display:block;margin-bottom:4px">默认音色</label>
          <select id="mvDefVoice">${voiceOpts(c.defVoice)}</select>
          <div class="mv-test-bar">
            <input type="text" id="mvTestTxt" placeholder="输入试听文本…" value="你好，这是语音朗读测试。">
            <button class="mv-btn primary" id="mvTestBtn">▶ 试听</button>
            <button class="mv-btn" id="mvStopBtn">■ 停</button>
          </div>
        </div>

        <!-- ④ 角色专属音色 -->
        <div class="mv-sec">
          <h3>🎭 角色专属音色</h3>
          <p class="mv-hint" style="margin-bottom:8px">为不同角色分配专属音色，朗读时自动切换</p>
          <div id="mvCharList">${charRows(charNames, c.charMap)}</div>
          <button class="mv-btn" id="mvRefreshChars" style="margin-top:6px;font-size:12px">↻ 刷新角色列表</button>
        </div>

        <!-- 底部 -->
        <div class="mv-footer">
          <button class="mv-btn primary" id="mvSave" style="flex:1">保存设置</button>
          <button class="mv-btn" id="mvCloseBtn">关闭</button>
        </div>
      </div>`;

    (doc.documentElement || doc.body).appendChild(box);

    // ── 事件绑定 ─────────────────────────────────────────────────────
    const q = id => box.querySelector('#' + id);

    box.querySelector('.mv-close').addEventListener('click', closeModal);
    q('mvCloseBtn').addEventListener('click', closeModal);

    q('mvRate').addEventListener('input',   e => q('mvRateVal').textContent   = (+e.target.value).toFixed(1) + 'x');
    q('mvPitch').addEventListener('input',  e => q('mvPitchVal').textContent  = (+e.target.value).toFixed(1));
    q('mvVolume').addEventListener('input', e => q('mvVolumeVal').textContent = Math.round(+e.target.value * 100) + '%');

    q('mvModeGrid').addEventListener('click', e => {
      const card = e.target.closest('.mv-mode-card');
      if (!card) return;
      box.querySelectorAll('.mv-mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      q('mvCustomWrap').style.display = card.dataset.mode === 'custom' ? '' : 'none';
    });

    q('mvTestBtn').addEventListener('click', () => {
      testSpeak(
        q('mvTestTxt').value || '你好，这是语音朗读测试。',
        q('mvDefVoice').value,
        +q('mvRate').value, +q('mvPitch').value, +q('mvVolume').value,
      );
    });
    q('mvStopBtn').addEventListener('click', stopReading);

    q('mvRefreshChars').addEventListener('click', async () => {
      const v2   = await getVoices();
      const map  = lsGet(LS.CHAR_MAP, {});
      const n2   = getActiveCharNames();
      q('mvCharList').innerHTML = charRows(n2, map);
    });

    q('mvSave').addEventListener('click', () => {
      const mode   = box.querySelector('.mv-mode-card.active')?.dataset.mode || 'all';
      const newMap = { ...lsGet(LS.CHAR_MAP, {}) };
      box.querySelectorAll('.mv-char-sel').forEach(sel => {
        if (sel.dataset.char) newMap[sel.dataset.char] = sel.value;
      });

      lsSet(LS.ENABLED,      q('mvAutoRead').checked);
      lsSet(LS.READ_USER,    q('mvReadUser').checked);
      lsSet(LS.RATE,         +q('mvRate').value);
      lsSet(LS.PITCH,        +q('mvPitch').value);
      lsSet(LS.VOLUME,       +q('mvVolume').value);
      lsSet(LS.MODE,         mode);
      lsSet(LS.DEF_VOICE,    q('mvDefVoice').value);
      lsSet(LS.SKIP_STAR,    q('mvSkipStar').checked);
      lsSet(LS.SKIP_BRACKET, q('mvSkipBracket').checked);
      lsSet(LS.SKIP_PATTERN, q('mvSkipPattern')?.value || '');
      lsSet(LS.CHAR_MAP,     newMap);

      toast('✅ 语音设置已保存');
      closeModal();
    });
  }

  function closeModal() {
    doc.getElementById(ID.MODAL)?.remove();
    // 只有自建的遮罩才删；meow-core 的遮罩让它自己管
    if (!doc.querySelector('.meowModal')) {
      doc.getElementById(ID.MASK)?.remove();
    }
  }

  async function testSpeak(text, voiceURI, rate, pitch, volume) {
    if (!synth) return;
    stopReading();
    const voices = await getVoices();
    const voice  = voices.find(v => v.voiceURI === voiceURI) || null;
    const utter  = new SpeechSynthesisUtterance(text);
    utter.rate = rate; utter.pitch = pitch; utter.volume = volume;
    if (voice) utter.voice = voice;
    utter.onstart = () => { isReading = true;  updateBtnState(true);  };
    utter.onend   = () => { isReading = false; updateBtnState(false); };
    utter.onerror = () => { isReading = false; updateBtnState(false); };
    synth.speak(utter);
  }

  function getActiveCharNames() {
    const names = new Set();
    try {
      const ctx = window.SillyTavern?.getContext?.();
      if (ctx?.chat) {
        for (const msg of ctx.chat)
          if (!msg.is_user && msg.name) names.add(String(msg.name).trim());
      }
    } catch(e) {}
    if (!names.size) {
      try {
        doc.querySelectorAll('[is_user="false"] .name_text, [is_user="false"] .ch_name').forEach(el => {
          const n = el.textContent.trim();
          if (n) names.add(n);
        });
      } catch(e) {}
    }
    return [...names].filter(Boolean);
  }

  function esc(s)     { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function escAttr(s) { return String(s||'').replace(/"/g,'&quot;'); }

  // ════════════════════════════════════════════════════════════════════
  //  § 9  注入扇形菜单（有 meow-core 时）
  //  ── 角度策略：在原4个按钮的最后一个之后，再延伸半个格宽 ──
  // ════════════════════════════════════════════════════════════════════

  function tryInjectFanMenu(menu) {
    try {
      const from = parseFloat(menu.style.getPropertyValue('--from')) || 210;
      const span = parseFloat(menu.style.getPropertyValue('--span')) || 120;
      const gap  = parseFloat(menu.style.getPropertyValue('--gap'))  || 14;

      // 原4个按钮（STEPS=4）末尾在 from+gap+span
      // 新按钮放在末尾再延伸 (span/4) * 0.5 处，让视觉上间距与原按钮相等
      const slotDeg = span / 4;
      const angDeg  = from + gap + span + slotDeg * 0.5;
      const R       = 98;
      const ang     = angDeg * Math.PI / 180;

      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.id   = 'meow-voice-fan-btn';
      btn.className = 'fanBtn';
      btn.style.setProperty('--x', Math.cos(ang) * R);
      btn.style.setProperty('--y', Math.sin(ang) * R);
      btn.innerHTML = `<div class="i">${ICON_VOICE}</div><div class="t">语音</div>`;

      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        try { window.MEOW?.core?.closeOverlays?.(); } catch(er) {}
        if (isReading) stopReading();
        else openModal();
      }, { passive: false });

      menu.appendChild(btn);
    } catch(e) {
      console.warn('[meow-voice] 注入扇形菜单失败', e);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 10  独立悬浮按钮（无 meow-core 时）
  // ════════════════════════════════════════════════════════════════════

  function mountSoloBtn() {
    injectCSS();
    if (doc.getElementById(ID.BTN)) return;

    const b   = doc.createElement('div');
    b.id      = ID.BTN;
    b.innerHTML = `<div class="mv-ico">${ICON_VOICE}</div>`;

    const saved = lsGet(LS.POS, null);
    const vh    = doc.documentElement.clientHeight;
    b.style.left = `${saved?.x ?? 12}px`;
    b.style.top  = `${saved?.y ?? Math.round(vh * 0.65)}px`;

    let dragging = false, moved = false;
    let sx = 0, sy = 0, bx = 0, by = 0;

    function onDown(e) {
      const p = e.touches ? e.touches[0] : e;
      dragging = true; moved = false;
      sx = p.clientX; sy = p.clientY;
      bx = parseFloat(b.style.left) || 0;
      by = parseFloat(b.style.top)  || 0;
      e.preventDefault(); e.stopPropagation();
    }
    function onMove(e) {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
      const vw2 = doc.documentElement.clientWidth;
      const vh2 = doc.documentElement.clientHeight;
      b.style.left = `${Math.max(4, Math.min(vw2 - 44, bx + dx))}px`;
      b.style.top  = `${Math.max(4, Math.min(vh2 - 44, by + dy))}px`;
      e.preventDefault();
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      lsSet(LS.POS, { x: parseFloat(b.style.left), y: parseFloat(b.style.top) });
      if (!moved) {
        if (isReading) stopReading();
        else openModal();
      }
      e.preventDefault();
    }

    b.addEventListener('touchstart', onDown, { passive: false });
    b.addEventListener('touchmove',  onMove, { passive: false });
    b.addEventListener('touchend',   onUp,   { passive: false });
    b.addEventListener('mousedown',  onDown, { passive: false });
    doc.addEventListener('mousemove', onMove, { passive: false });
    doc.addEventListener('mouseup',   onUp,   { passive: false });

    (doc.documentElement || doc.body).appendChild(b);
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 11  启动
  // ════════════════════════════════════════════════════════════════════

  function start() {
    const hasMeowCore = !!(window.MEOW?.core && window.MEOW?.mods);

    if (hasMeowCore) {
      // ── 模式A：融入 meow-core ──
      // MutationObserver 监听扇形菜单被挂到 documentElement
      new MutationObserver(muts => {
        for (const mut of muts) {
          for (const node of mut.addedNodes) {
            if (node?.id === 'meow-pencil-menu') tryInjectFanMenu(node);
          }
        }
      }).observe(doc.documentElement, { childList: true });

      // 注册到 mods 系统
      window.MEOW.mods.register('voice', {
        title: '语音朗读',
        open:  openModal,
        stop:  stopReading,
        speak: speakText,
      });

      console.log('[meow-voice] 已融合到 meow-core 扇形菜单');
    } else {
      // ── 模式B：独立运行 ──
      if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', mountSoloBtn);
      } else {
        mountSoloBtn();
      }

      console.log('[meow-voice] 独立模式运行（未检测到 meow-core）');
    }

    // 全局暴露（方便调试或其他模块调用）
    window.meowVoice = { open: openModal, stop: stopReading, speak: speakText };

    toast('🎙️ 语音模块已加载');
  }

  // 等待 300ms 让 meow-core 完成初始化后再判断
  setTimeout(start, 300);

})();
