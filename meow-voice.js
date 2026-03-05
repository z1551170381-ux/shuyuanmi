// ===================== 喵喵语音朗读模块 meow-voice.js =====================
// 功能：AI 回复自动朗读 · 朗读速度/音色 · 角色专属音色 · 朗读内容筛选
// 依赖：meow-core.js（MEOW.core / MEOW.mods / MEOW.bus）

(() => {
  if (window.MEOW_VOICE_V1) return;
  window.MEOW_VOICE_V1 = true;

  // ─── 等待 MEOW.core 就绪 ───────────────────────────────────────────────
  function waitMeow(cb, tries = 0) {
    if (window.MEOW && window.MEOW.core && window.MEOW.mods) return cb();
    if (tries > 60) return;
    setTimeout(() => waitMeow(cb, tries + 1), 200);
  }

  waitMeow(initVoiceModule);

  function initVoiceModule() {
    const MEOW = window.MEOW;
    const { lsGet, lsSet, modalShell, closeModal, doc, W, toast } = MEOW.core;

    // ─── LocalStorage Keys ────────────────────────────────────────────────
    const LS_ENABLED    = 'meow_voice_enabled_v1';
    const LS_RATE       = 'meow_voice_rate_v1';
    const LS_PITCH      = 'meow_voice_pitch_v1';
    const LS_VOLUME     = 'meow_voice_volume_v1';
    const LS_MODE       = 'meow_voice_mode_v1';
    const LS_DEF_VOICE  = 'meow_voice_default_v1';
    const LS_CHAR_MAP   = 'meow_voice_char_map_v1';
    const LS_SKIP_STAR  = 'meow_voice_skip_star_v1';
    const LS_SKIP_BRACKET = 'meow_voice_skip_bracket_v1';
    const LS_SKIP_PATTERN = 'meow_voice_skip_pattern_v1';
    const LS_READ_USER  = 'meow_voice_read_user_v1';

    const ID_MODAL = 'meow-voice-modal';

    // ─── 设置读取 ─────────────────────────────────────────────────────────
    function cfg() {
      return {
        enabled:       lsGet(LS_ENABLED,    true),
        rate:          lsGet(LS_RATE,       1.0),
        pitch:         lsGet(LS_PITCH,      1.0),
        volume:        lsGet(LS_VOLUME,     1.0),
        mode:          lsGet(LS_MODE,       'all'),    // all / dialogue / narration / custom
        defVoice:      lsGet(LS_DEF_VOICE,  ''),
        charMap:       lsGet(LS_CHAR_MAP,   {}),
        skipStar:      lsGet(LS_SKIP_STAR,  true),    // 跳过 *动作*
        skipBracket:   lsGet(LS_SKIP_BRACKET, false), // 跳过 【系统提示】
        skipPattern:   lsGet(LS_SKIP_PATTERN, ''),    // 自定义正则
        readUser:      lsGet(LS_READ_USER,  false),   // 是否也朗读用户发言
      };
    }

    // ─── 语音合成引擎 ─────────────────────────────────────────────────────
    const synth = window.speechSynthesis;
    let currentUtter = null;
    let isReading = false;

    /** 获取所有可用语音列表（兼容延迟加载） */
    function getVoices() {
      return new Promise(resolve => {
        let voices = synth.getVoices();
        if (voices.length) return resolve(voices);
        const t = setInterval(() => {
          voices = synth.getVoices();
          if (voices.length) { clearInterval(t); resolve(voices); }
        }, 100);
        setTimeout(() => { clearInterval(t); resolve(synth.getVoices()); }, 3000);
      });
    }

    /** 文本预处理：根据设置裁剪/清洗 */
    function processText(raw, mode, skipStar, skipBracket, skipPattern) {
      let text = String(raw || '').trim();

      // 去掉 markdown 粗体/斜体符号
      text = text.replace(/\*\*/g, '').replace(/#+\s/g, '');

      // 跳过 *动作描述*（斜体星号）
      if (skipStar) {
        text = text.replace(/\*[^*\n]{0,120}\*/g, '');
      }

      // 跳过 【系统括号内容】
      if (skipBracket) {
        text = text.replace(/[【\[][^\]】\n]{0,80}[】\]]/g, '');
      }

      // 自定义跳过正则
      if (skipPattern && skipPattern.trim()) {
        try {
          const rx = new RegExp(skipPattern, 'g');
          text = text.replace(rx, '');
        } catch(e) {}
      }

      // 朗读模式过滤
      if (mode === 'dialogue') {
        // 只读引号内（"…" 『…』 「…」 "…"）
        const matches = [];
        const rxs = [/"([^"]{1,200})"/g, /『([^』]{1,200})』/g, /「([^」]{1,200})」/g, /"([^"]{1,200})"/g];
        for (const rx of rxs) {
          let m;
          while ((m = rx.exec(text)) !== null) matches.push(m[1]);
        }
        text = matches.join('。') || text;
      } else if (mode === 'narration') {
        // 只读旁白（删除引号内内容）
        text = text.replace(/"[^"]{0,200}"/g, '')
                   .replace(/『[^』]{0,200}』/g, '')
                   .replace(/「[^」]{0,200}」/g, '')
                   .replace(/"[^"]{0,200}"/g, '');
      }

      // 合并多余空白和换行
      text = text.replace(/\n{2,}/g, '。').replace(/\s+/g, ' ').trim();

      return text;
    }

    /** 停止当前朗读 */
    function stopReading() {
      try { synth.cancel(); } catch(e) {}
      isReading = false;
      currentUtter = null;
      updatePlayBtn(false);
    }

    /** 朗读指定文本（指定角色名查角色音色） */
    async function speakText(text, charName) {
      if (!synth) { toast('🔇 当前环境不支持语音合成'); return; }

      stopReading();

      const c = cfg();
      const cleaned = processText(text, c.mode, c.skipStar, c.skipBracket, c.skipPattern);
      if (!cleaned) return;

      const voices = await getVoices();

      // 找角色专属音色 > 默认音色 > 系统默认
      let targetVoiceURI = (charName && c.charMap[charName]) ? c.charMap[charName] : c.defVoice;
      const targetVoice = voices.find(v => v.voiceURI === targetVoiceURI) || null;

      const utter = new SpeechSynthesisUtterance(cleaned);
      utter.rate   = Math.max(0.1, Math.min(10, Number(c.rate)  || 1.0));
      utter.pitch  = Math.max(0,   Math.min(2,  Number(c.pitch) || 1.0));
      utter.volume = Math.max(0,   Math.min(1,  Number(c.volume)|| 1.0));
      if (targetVoice) utter.voice = targetVoice;

      utter.onstart = () => { isReading = true; updatePlayBtn(true); };
      utter.onend   = () => { isReading = false; currentUtter = null; updatePlayBtn(false); };
      utter.onerror = () => { isReading = false; currentUtter = null; updatePlayBtn(false); };

      currentUtter = utter;
      synth.speak(utter);
    }

    // ─── 更新悬浮按钮上的播放状态指示 ─────────────────────────────────────
    function updatePlayBtn(playing) {
      try {
        const btn = doc.getElementById('meow-voice-fan-btn');
        if (!btn) return;
        const icon = btn.querySelector('.i');
        if (!icon) return;
        icon.innerHTML = playing ? ICON_STOP : ICON_VOICE;
        btn.style.background = playing
          ? 'rgba(220,100,80,.18)'
          : '';
      } catch(e) {}
    }

    // ─── SVG 图标 ─────────────────────────────────────────────────────────
    const ICON_VOICE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>`;

    const ICON_STOP = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="2"/>
    </svg>`;

    const ICON_VOICE_SETTINGS = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/>
    </svg>`;

    // ─── 注入扇形菜单按钮（MutationObserver 拦截菜单创建） ────────────────
    function injectFanBtn(menu) {
      try {
        // 读取已有 STEPS / from / span / gap / R（通过 CSS 变量）
        const style = menu.style;
        const cx    = parseFloat(style.getPropertyValue('--cx')) || 0;
        const cy    = parseFloat(style.getPropertyValue('--cy')) || 0;
        const from  = parseFloat(style.getPropertyValue('--from')) || 210;
        const span  = parseFloat(style.getPropertyValue('--span')) || 120;
        const gap   = parseFloat(style.getPropertyValue('--gap'))  || 14;

        // 原有 4 个按钮，把新按钮放在第 5 个位置（idx=4，STEPS=5）
        const STEPS  = 5;
        const R      = 98;
        const idx    = 4;
        const t      = (idx + 0.5) / STEPS;
        const ang    = (from + gap + t * span) * Math.PI / 180;
        const x      = Math.cos(ang) * R;
        const y      = Math.sin(ang) * R;

        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.id   = 'meow-voice-fan-btn';
        btn.className = 'fanBtn';
        btn.style.setProperty('--x', x);
        btn.style.setProperty('--y', y);
        btn.innerHTML = `<div class="i">${ICON_VOICE}</div><div class="t">语音</div>`;

        btn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          // 若正在朗读则停止，否则打开设置
          if (isReading) {
            stopReading();
            try { MEOW.core.closeOverlays(); } catch(er) {}
          } else {
            try { MEOW.core.closeOverlays(); } catch(er) {}
            openVoiceModal();
          }
        }, { passive: false });

        menu.appendChild(btn);
      } catch(e) {}
    }

    // 监听菜单挂载
    const menuObserver = new MutationObserver(muts => {
      for (const mut of muts) {
        for (const node of mut.addedNodes) {
          if (node && node.id === 'meow-pencil-menu') injectFanBtn(node);
        }
      }
    });
    menuObserver.observe(doc.documentElement, { childList: true });

    // ─── 监听新消息自动朗读 ───────────────────────────────────────────────
    // 记录最后一条已读消息的标识，避免重复朗读
    let lastReadId = '';

    function tryAutoRead(mesBlock) {
      try {
        if (!cfg().enabled) return;
        const mid = mesBlock.getAttribute('mesid') || mesBlock.dataset.mesid || '';
        if (mid && mid === lastReadId) return;

        // 判断是否是 AI 消息（非 user）
        const isUser = mesBlock.getAttribute('is_user') === 'true'
                    || mesBlock.classList.contains('user_mes');
        if (isUser && !cfg().readUser) return;

        // 获取角色名
        const charName = (mesBlock.querySelector('.name_text') || mesBlock.querySelector('.ch_name'))?.textContent?.trim() || '';

        // 获取消息文本
        const textEl = mesBlock.querySelector('.mes_text');
        const rawText = textEl ? textEl.innerText || textEl.textContent : '';
        if (!rawText.trim()) return;

        lastReadId = mid;
        speakText(rawText, charName);
      } catch(e) {}
    }

    // MutationObserver 监听聊天容器内新增消息
    function bindChatObserver() {
      const chatRoot = doc.querySelector('.simplebar-content-wrapper')
                    || doc.querySelector('#chat')
                    || doc.body;
      if (!chatRoot) { setTimeout(bindChatObserver, 1000); return; }

      const chatObserver = new MutationObserver(muts => {
        for (const mut of muts) {
          for (const node of mut.addedNodes) {
            if (!node || node.nodeType !== 1) continue;
            // 直接是 mes_block
            if (node.classList && (node.classList.contains('mes') || node.hasAttribute('mesid'))) {
              // 等待渲染稳定后读
              setTimeout(() => tryAutoRead(node), 400);
            }
          }
        }
      });
      chatObserver.observe(chatRoot, { childList: true, subtree: true });
    }

    // 延迟绑定（等页面就绪）
    setTimeout(bindChatObserver, 1200);

    // ─── 语音设置弹窗 ─────────────────────────────────────────────────────
    async function openVoiceModal() {
      const voices = await getVoices();
      const c = cfg();

      const bd = modalShell(ID_MODAL, '语音朗读设置', ICON_VOICE_SETTINGS);
      if (!bd) return;

      // 获取当前对话角色列表
      const charNames = getActiveCharNames();

      // 构建语音选项 HTML
      function voiceOptions(selected) {
        const zh   = voices.filter(v => /zh|cmn|cantonese/i.test(v.lang));
        const other = voices.filter(v => !/zh|cmn|cantonese/i.test(v.lang));
        let html = `<option value="">系统默认</option>`;
        if (zh.length) {
          html += `<optgroup label="── 中文语音 ──">`;
          for (const v of zh)  html += `<option value="${v.voiceURI}" ${v.voiceURI === selected ? 'selected' : ''}>${v.name} (${v.lang})</option>`;
          html += `</optgroup>`;
        }
        if (other.length) {
          html += `<optgroup label="── 其他语音 ──">`;
          for (const v of other) html += `<option value="${v.voiceURI}" ${v.voiceURI === selected ? 'selected' : ''}>${v.name} (${v.lang})</option>`;
          html += `</optgroup>`;
        }
        return html;
      }

      // 角色音色分配行
      function charVoiceRows() {
        if (!charNames.length) return '<p style="color:var(--meow-text-soft,rgba(46,38,30,.45));font-size:12px;margin:6px 0">暂无已知角色，对话开始后会自动检测</p>';
        return charNames.map(name => {
          const assigned = c.charMap[name] || '';
          return `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:600;min-width:80px;color:var(--meow-text)">${name}</span>
            <select data-char="${name}" class="meow-voice-char-sel" style="flex:1;min-width:160px">
              ${voiceOptions(assigned)}
            </select>
          </div>`;
        }).join('');
      }

      bd.innerHTML = `
      <style>
        #${ID_MODAL} .v-sec{
          background:var(--meow-card,rgba(255,255,255,.38));
          border:1px solid var(--meow-line,rgba(28,24,18,.08));
          border-radius:14px; padding:12px 14px; margin-bottom:10px;
        }
        #${ID_MODAL} .v-sec h3{
          font-size:13px; font-weight:700; color:var(--meow-text);
          margin:0 0 10px; display:flex; align-items:center; gap:6px;
        }
        #${ID_MODAL} .v-row{
          display:flex; align-items:center; gap:10px;
          margin-bottom:10px; flex-wrap:wrap;
        }
        #${ID_MODAL} .v-label{
          font-size:12px; color:var(--meow-text); min-width:64px;
        }
        #${ID_MODAL} .v-val{
          font-size:12px; color:var(--meow-text-soft,rgba(46,38,30,.5));
          min-width:32px; text-align:right;
        }
        #${ID_MODAL} input[type=range]{
          flex:1; min-width:100px; accent-color:var(--meow-accent,#8b7355);
        }
        #${ID_MODAL} select{
          background:var(--meow-bg-strong,rgba(255,255,255,.72));
          border:1px solid var(--meow-line,rgba(28,24,18,.12));
          border-radius:10px; padding:7px 10px;
          font-size:13px; color:var(--meow-text); outline:none; width:100%;
        }
        #${ID_MODAL} .v-toggle{
          display:flex; align-items:center; justify-content:space-between;
          padding:6px 0; cursor:pointer;
        }
        #${ID_MODAL} .toggle-wrap{
          position:relative; width:42px; height:24px; flex-shrink:0;
        }
        #${ID_MODAL} .toggle-wrap input{ opacity:0; width:0; height:0; position:absolute; }
        #${ID_MODAL} .toggle-slider{
          position:absolute; inset:0; border-radius:12px;
          background:rgba(28,24,18,.15); transition:background .2s;
          cursor:pointer;
        }
        #${ID_MODAL} .toggle-slider::before{
          content:''; position:absolute;
          height:18px; width:18px; left:3px; top:3px;
          border-radius:50%; background:#fff;
          box-shadow:0 1px 3px rgba(0,0,0,.2);
          transition:transform .2s;
        }
        #${ID_MODAL} .toggle-wrap input:checked + .toggle-slider{
          background:var(--meow-accent,#8b7355);
        }
        #${ID_MODAL} .toggle-wrap input:checked + .toggle-slider::before{
          transform:translateX(18px);
        }
        #${ID_MODAL} .mode-grid{
          display:grid; grid-template-columns:1fr 1fr;
          gap:6px; margin-top:6px;
        }
        #${ID_MODAL} .mode-card{
          border:1px solid var(--meow-line,rgba(28,24,18,.1));
          border-radius:10px; padding:9px 10px;
          cursor:pointer; font-size:12px; text-align:center;
          background:var(--meow-bg-strong,rgba(255,255,255,.5));
          color:var(--meow-text); transition:all .15s; user-select:none;
        }
        #${ID_MODAL} .mode-card.active{
          border-color:var(--meow-accent,#8b7355) !important;
          background:rgba(139,115,85,.12) !important;
          font-weight:700;
        }
        #${ID_MODAL} .test-bar{
          display:flex; gap:8px; margin-top:6px;
        }
        #${ID_MODAL} .test-bar input{
          flex:1; background:var(--meow-bg-strong,rgba(255,255,255,.72));
          border:1px solid var(--meow-line,rgba(28,24,18,.12));
          border-radius:10px; padding:8px 10px; font-size:13px;
          color:var(--meow-text); outline:none;
        }
        #${ID_MODAL} .v-btn{
          padding:8px 14px; border-radius:10px; font-size:13px;
          border:1px solid var(--meow-line,rgba(28,24,18,.1));
          background:var(--meow-card,rgba(255,255,255,.5));
          color:var(--meow-text); cursor:pointer; white-space:nowrap;
          transition:all .15s; font-weight:600;
        }
        #${ID_MODAL} .v-btn.primary{
          background:var(--meow-accent,#8b7355);
          color:#fff; border-color:transparent;
        }
        #${ID_MODAL} .v-btn:active{ opacity:.75; }
        #${ID_MODAL} .hint{
          font-size:11px; color:var(--meow-text-soft,rgba(46,38,30,.45));
          margin-top:4px; line-height:1.5;
        }
      </style>

      <!-- 1. 总开关 -->
      <div class="v-sec">
        <h3>⚡ 自动朗读</h3>
        <label class="v-toggle">
          <span style="font-size:13px;color:var(--meow-text)">收到 AI 回复后自动朗读</span>
          <div class="toggle-wrap">
            <input type="checkbox" id="vAutoRead" ${c.enabled ? 'checked' : ''}>
            <div class="toggle-slider"></div>
          </div>
        </label>
        <label class="v-toggle" style="margin-top:4px">
          <span style="font-size:13px;color:var(--meow-text)">同时朗读用户发言</span>
          <div class="toggle-wrap">
            <input type="checkbox" id="vReadUser" ${c.readUser ? 'checked' : ''}>
            <div class="toggle-slider"></div>
          </div>
        </label>
      </div>

      <!-- 2. 朗读内容 -->
      <div class="v-sec">
        <h3>📖 朗读范围</h3>
        <div class="mode-grid" id="vModeGrid">
          <div class="mode-card ${c.mode==='all'?'active':''}" data-mode="all">
            📄 全部文本<br><span style="font-size:10px;opacity:.6">完整朗读</span>
          </div>
          <div class="mode-card ${c.mode==='dialogue'?'active':''}" data-mode="dialogue">
            💬 仅对话<br><span style="font-size:10px;opacity:.6">引号内内容</span>
          </div>
          <div class="mode-card ${c.mode==='narration'?'active':''}" data-mode="narration">
            📝 仅旁白<br><span style="font-size:10px;opacity:.6">引号外内容</span>
          </div>
          <div class="mode-card ${c.mode==='custom'?'active':''}" data-mode="custom">
            ✂️ 自定义<br><span style="font-size:10px;opacity:.6">正则过滤</span>
          </div>
        </div>

        <div id="vCustomWrap" style="margin-top:8px;${c.mode!=='custom'?'display:none':''}">
          <label style="font-size:12px;color:var(--meow-text)">跳过匹配正则的内容：</label>
          <input type="text" id="vSkipPattern" placeholder="如：\\([^)]*\\) 跳过括号内容"
            value="${c.skipPattern||''}"
            style="background:var(--meow-bg-strong,rgba(255,255,255,.72));border:1px solid var(--meow-line,rgba(28,24,18,.12));border-radius:10px;padding:8px 10px;font-size:13px;color:var(--meow-text);outline:none;width:100%;box-sizing:border-box;margin-top:4px">
        </div>

        <div style="margin-top:10px">
          <label class="v-toggle">
            <span style="font-size:12px;color:var(--meow-text)">跳过 *斜体动作描述*</span>
            <div class="toggle-wrap">
              <input type="checkbox" id="vSkipStar" ${c.skipStar?'checked':''}>
              <div class="toggle-slider"></div>
            </div>
          </label>
          <label class="v-toggle" style="margin-top:4px">
            <span style="font-size:12px;color:var(--meow-text)">跳过 【系统提示/注释】</span>
            <div class="toggle-wrap">
              <input type="checkbox" id="vSkipBracket" ${c.skipBracket?'checked':''}>
              <div class="toggle-slider"></div>
            </div>
          </label>
        </div>
      </div>

      <!-- 3. 朗读速度/音调 -->
      <div class="v-sec">
        <h3>🎚️ 语音参数</h3>
        <div class="v-row">
          <span class="v-label">朗读速度</span>
          <input type="range" id="vRate" min="0.5" max="2.0" step="0.1" value="${c.rate}">
          <span class="v-val" id="vRateVal">${Number(c.rate).toFixed(1)}x</span>
        </div>
        <div class="v-row">
          <span class="v-label">音调</span>
          <input type="range" id="vPitch" min="0.5" max="2.0" step="0.1" value="${c.pitch}">
          <span class="v-val" id="vPitchVal">${Number(c.pitch).toFixed(1)}</span>
        </div>
        <div class="v-row">
          <span class="v-label">音量</span>
          <input type="range" id="vVolume" min="0" max="1.0" step="0.05" value="${c.volume}">
          <span class="v-val" id="vVolumeVal">${Math.round(c.volume*100)}%</span>
        </div>

        <!-- 默认音色 -->
        <label style="font-size:12px;color:var(--meow-text);display:block;margin-bottom:4px;margin-top:4px">默认音色</label>
        <select id="vDefVoice">${voiceOptions(c.defVoice)}</select>

        <!-- 试听 -->
        <div class="test-bar" style="margin-top:10px">
          <input type="text" id="vTestText" placeholder="输入试听文本…" value="你好，这是语音朗读测试。">
          <button class="v-btn primary" id="vTestBtn">▶ 试听</button>
          <button class="v-btn" id="vStopBtn">■ 停止</button>
        </div>
      </div>

      <!-- 4. 角色专属音色 -->
      <div class="v-sec">
        <h3>🎭 角色专属音色</h3>
        <div class="hint" style="margin-bottom:8px">为不同角色分配不同音色，朗读时自动切换</div>
        <div id="vCharList">${charVoiceRows()}</div>
        <button class="v-btn" id="vRefreshChars" style="margin-top:6px;font-size:12px">↻ 刷新角色列表</button>
      </div>

      <!-- 底部保存 -->
      <div style="display:flex;gap:8px;padding-top:4px;padding-bottom:8px">
        <button class="v-btn primary" id="vSaveBtn" style="flex:1">保存设置</button>
        <button class="v-btn" id="vCloseBtn">关闭</button>
      </div>
      `;

      // ── 绑定交互事件 ────────────────────────────────────────────────────

      // 滑块实时显示
      bd.querySelector('#vRate').addEventListener('input', e => {
        bd.querySelector('#vRateVal').textContent = Number(e.target.value).toFixed(1) + 'x';
      });
      bd.querySelector('#vPitch').addEventListener('input', e => {
        bd.querySelector('#vPitchVal').textContent = Number(e.target.value).toFixed(1);
      });
      bd.querySelector('#vVolume').addEventListener('input', e => {
        bd.querySelector('#vVolumeVal').textContent = Math.round(e.target.value * 100) + '%';
      });

      // 朗读模式卡片
      bd.querySelector('#vModeGrid').addEventListener('click', e => {
        const card = e.target.closest('.mode-card');
        if (!card) return;
        bd.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const mode = card.dataset.mode;
        bd.querySelector('#vCustomWrap').style.display = mode === 'custom' ? '' : 'none';
      });

      // 试听
      bd.querySelector('#vTestBtn').addEventListener('click', () => {
        const text = bd.querySelector('#vTestText').value || '你好，这是语音朗读测试。';
        const voiceURI = bd.querySelector('#vDefVoice').value;
        const rate  = parseFloat(bd.querySelector('#vRate').value);
        const pitch = parseFloat(bd.querySelector('#vPitch').value);
        const vol   = parseFloat(bd.querySelector('#vVolume').value);
        testSpeak(text, voiceURI, rate, pitch, vol);
      });
      bd.querySelector('#vStopBtn').addEventListener('click', stopReading);

      // 刷新角色列表
      bd.querySelector('#vRefreshChars').addEventListener('click', () => {
        const names = getActiveCharNames();
        const savedMap = lsGet(LS_CHAR_MAP, {});
        bd.querySelector('#vCharList').innerHTML = names.length
          ? names.map(name => {
              const assigned = savedMap[name] || '';
              return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
                <span style="font-size:13px;font-weight:600;min-width:80px;color:var(--meow-text)">${name}</span>
                <select data-char="${name}" class="meow-voice-char-sel" style="flex:1;min-width:160px">${voiceOptions(assigned)}</select>
              </div>`;
            }).join('')
          : '<p style="color:var(--meow-text-soft,rgba(46,38,30,.45));font-size:12px;margin:6px 0">暂无已知角色</p>';
      });

      // 保存
      bd.querySelector('#vSaveBtn').addEventListener('click', () => {
        const activeMode = bd.querySelector('.mode-card.active')?.dataset.mode || 'all';
        const newMap = { ...lsGet(LS_CHAR_MAP, {}) };
        bd.querySelectorAll('.meow-voice-char-sel').forEach(sel => {
          const ch = sel.dataset.char;
          if (ch) newMap[ch] = sel.value;
        });

        lsSet(LS_ENABLED,      bd.querySelector('#vAutoRead').checked);
        lsSet(LS_READ_USER,    bd.querySelector('#vReadUser').checked);
        lsSet(LS_RATE,         parseFloat(bd.querySelector('#vRate').value));
        lsSet(LS_PITCH,        parseFloat(bd.querySelector('#vPitch').value));
        lsSet(LS_VOLUME,       parseFloat(bd.querySelector('#vVolume').value));
        lsSet(LS_MODE,         activeMode);
        lsSet(LS_DEF_VOICE,    bd.querySelector('#vDefVoice').value);
        lsSet(LS_SKIP_STAR,    bd.querySelector('#vSkipStar').checked);
        lsSet(LS_SKIP_BRACKET, bd.querySelector('#vSkipBracket').checked);
        lsSet(LS_SKIP_PATTERN, bd.querySelector('#vSkipPattern')?.value || '');
        lsSet(LS_CHAR_MAP,     newMap);

        try { toast('✅ 语音设置已保存'); } catch(e) {}
        closeModal(ID_MODAL);
      });

      bd.querySelector('#vCloseBtn').addEventListener('click', () => closeModal(ID_MODAL));
    }

    // ─── 试听（不影响 lastReadId） ─────────────────────────────────────────
    async function testSpeak(text, voiceURI, rate, pitch, volume) {
      if (!synth) return;
      stopReading();
      const voices = await getVoices();
      const v = voices.find(v => v.voiceURI === voiceURI) || null;
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate   = rate;
      utter.pitch  = pitch;
      utter.volume = volume;
      if (v) utter.voice = v;
      utter.onstart = () => { isReading = true; updatePlayBtn(true); };
      utter.onend   = () => { isReading = false; currentUtter = null; updatePlayBtn(false); };
      utter.onerror = () => { isReading = false; currentUtter = null; updatePlayBtn(false); };
      currentUtter = utter;
      synth.speak(utter);
    }

    // ─── 获取当前对话中的角色名 ───────────────────────────────────────────
    function getActiveCharNames() {
      const names = new Set();
      try {
        // 从 ST context 获取
        const ctx = typeof MEOW.core.meowGetSTCtx === 'function' ? MEOW.core.meowGetSTCtx() : null;
        if (ctx && Array.isArray(ctx.chat)) {
          for (const msg of ctx.chat) {
            if (msg && !msg.is_user && msg.name) names.add(String(msg.name).trim());
          }
        }
      } catch(e) {}

      // 兜底：从 DOM 取
      if (!names.size) {
        try {
          doc.querySelectorAll('.mes_block:not([is_user="true"]) .name_text, .mes_block:not([is_user="true"]) .ch_name').forEach(el => {
            const n = el.textContent.trim();
            if (n) names.add(n);
          });
        } catch(e) {}
      }

      return Array.from(names).filter(Boolean);
    }

    // ─── 注册到 MEOW.mods ─────────────────────────────────────────────────
    MEOW.mods.register('voice', {
      title: '语音朗读',
      open: openVoiceModal,
      stop: stopReading,
      speak: speakText,
    });

    // ─── 暴露给 window（可选调试） ────────────────────────────────────────
    window.meowVoice = { open: openVoiceModal, stop: stopReading, speak: speakText };

    try { toast('🎙️ 语音模块已加载'); } catch(e) {}

    console.log('[喵喵套件] ✓ 语音朗读模块已就绪');
  }
})();
