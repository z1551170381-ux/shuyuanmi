// =====================================================================
//  meow-voice.js · 喵喵语音朗读  独立版 v1.2
//  ✅ 输入框按钮：点击展开模式选项（全部/仅对话/仅旁白/自定义）
//  ✅ 播放视口内最可见的消息（不只是最后一条）
//  ✅ 修复：cancel() 后延迟 speak() 避免浏览器噪音 bug
//  ✅ 有 meow-core 时通过 MEOW.addMenuItem 注入转盘菜单
// =====================================================================

(() => {
  if (window.MEOW_VOICE_V1) return;
  window.MEOW_VOICE_V1 = true;

  // ════════════════════════════════════════════════════════════════════
  //  § 1  环境 & 工具
  // ════════════════════════════════════════════════════════════════════

  function pickHost() {
    for (const w of [window, window.top, window.parent]) {
      try { if (w?.document?.documentElement) return { W: w, doc: w.document }; } catch(e) {}
    }
    return { W: window, doc: document };
  }
  let { W, doc } = pickHost();

  function lsGet(key, fallback) {
    try { const v = W.localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
    catch(e) { return fallback; }
  }
  function lsSet(key, val) {
    try { W.localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }

  function toast(msg) {
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
        position:'fixed', left:'50%', top:'18%',
        transform:'translate3d(-50%,0,0)',
        background:'rgba(29,29,29,.56)', color:'#fff',
        padding:'9px 16px', borderRadius:'12px',
        fontSize:'14px', fontWeight:'600',
        zIndex:'2147483650', pointerEvents:'none',
        border:'1px solid rgba(255,255,255,.18)',
        boxShadow:'0 10px 28px rgba(0,0,0,.35)',
        maxWidth:'78vw', textAlign:'center',
      });
      (doc.documentElement || doc.body).appendChild(t);
      setTimeout(() => t.remove(), 1800);
    } catch(e) {}
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 2  配置
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
    API_ENABLED:  'meow_voice_api_enabled_v1',
    API_PROVIDER: 'meow_voice_api_provider_v1',
    API_URL:      'meow_voice_api_url_v1',
    API_KEY:      'meow_voice_api_key_v1',
    API_MODEL:    'meow_voice_api_model_v1',
    API_VOICE:    'meow_voice_api_voice_v1',
    VOLC_APP_ID:  'meow_voice_volc_app_id_v1',
    VOLC_ACCESS_KEY: 'meow_voice_volc_access_key_v1',
    VOLC_RESOURCE_ID: 'meow_voice_volc_resource_id_v1',
    BGM_PROXY:        'meow_voice_bgm_proxy_v1',
    DRAMA_MODE:   'meow_voice_drama_mode_v1',
    DRAMA_MAP:    'meow_voice_drama_map_v1',
    USER_NAME:    'meow_voice_user_name_v1',
    AUTO_MODE:    'meow_voice_auto_mode_v1',
    DRAMA_RATE:   'meow_voice_drama_rate_v1',
    BGM_ENABLED:  'meow_voice_bgm_enabled_v1',
    BGM_TITLE:    'meow_voice_bgm_title_v1',
    BGM_URL:      'meow_voice_bgm_url_v1',
    BGM_VOLUME:   'meow_voice_bgm_volume_v1',
    BGM_LOOP:     'meow_voice_bgm_loop_v1',
    BGM_LIBRARY:  'meow_voice_bgm_library_v1',
    BGM_GROUP:    'meow_voice_bgm_group_v1',
    BGM_TRACK:    'meow_voice_bgm_track_v1',
    BGM_DOCK_COLLAPSED: 'meow_voice_bgm_dock_collapsed_v1',
    BGM_DOCK_POS: 'meow_voice_bgm_dock_pos_v1',
  };

  const ID = {
    MODAL:    'meow-voice-modal',
    MASK:     'meow-voice-mask',
    SOLO_BTN: 'meow-voice-solo-btn',
    PLAY_BTN: 'meow-voice-play-btn',
    MODE_POP: 'meow-voice-mode-pop',
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
      apiEnabled:   lsGet(LS.API_ENABLED,  false),
      apiProvider:  lsGet(LS.API_PROVIDER,  'openai_compatible'),
      apiUrl:       lsGet(LS.API_URL,       ''),
      apiKey:       lsGet(LS.API_KEY,       ''),
      apiModel:     lsGet(LS.API_MODEL,     'tts-1'),
      apiVoice:     lsGet(LS.API_VOICE,     ''),
      volcAppId:    lsGet(LS.VOLC_APP_ID,   ''),
      volcAccessKey: lsGet(LS.VOLC_ACCESS_KEY, ''),
      volcResourceId: lsGet(LS.VOLC_RESOURCE_ID, 'seed-tts-2.0'),
      bgmProxy:       lsGet(LS.BGM_PROXY, ''),
      dramaMode:    lsGet(LS.DRAMA_MODE,    false),
      dramaMap:     lsGet(LS.DRAMA_MAP,     {}),
      userName:     lsGet(LS.USER_NAME,     '我'),
      autoMode:     lsGet(LS.AUTO_MODE,     'manual'),
      dramaRate:    lsGet(LS.DRAMA_RATE,    1.0),
      bgmEnabled:   lsGet(LS.BGM_ENABLED,   false),
      bgmTitle:     lsGet(LS.BGM_TITLE,     '背景音乐'),
      bgmUrl:       lsGet(LS.BGM_URL,       ''),
      bgmVolume:    lsGet(LS.BGM_VOLUME,    0.18),
      bgmLoop:      lsGet(LS.BGM_LOOP,      true),
      bgmLibrary:   _bgmLibCache ? JSON.parse(JSON.stringify(_bgmLibCache)) : lsGet(LS.BGM_LIBRARY, []),
      bgmProxy:     lsGet(LS.BGM_PROXY,     ''),
      bgmGroup:     lsGet(LS.BGM_GROUP,     ''),
      bgmTrack:     lsGet(LS.BGM_TRACK,     ''),
      bgmDockCollapsed: lsGet(LS.BGM_DOCK_COLLAPSED, true),
    };
  }

  const MODE_LABELS = {
    all:       '📄 全部文本',
    dialogue:  '💬 仅对话',
    narration: '📝 仅旁白',
    custom:    '✂️ 自定义',
  };

  // ════════════════════════════════════════════════════════════════════
  //  § 3  语音引擎
  // ════════════════════════════════════════════════════════════════════

  const synth = window.speechSynthesis;
  let isReading     = false;
  let _apiPlayGen   = 0;   // stopReading 时自增，speakViaApi 检测后退出
  let _pendingSpeak = null; // 用于延迟speak，防止cancel噪音
  let _bgmAudio     = null;
  let _bgmState     = {
    visible: false,
    active: false,
    title: '',
    sourceUrl: '',
    parsedKind: '',
    embedSrc: '',
    groupId: '',
    trackId: '',
    closed: false,
  };

  // ── 歌词状态 ─────────────────────────────────────────────────
  let _bgmLyricLines = [];   // [{ms:number, text:string}]  当前曲 LRC 解析结果
  let _bgmLyricIdx   = -1;   // 当前高亮行索引
  let _bgmIframeTimer = null; // iframe 模式歌词自动滚动定时器

  /** 解析 LRC 文本 → [{ms, text}] */
  function _parseLrc(lrcText) {
    if (!lrcText) return [];
    const lines = [];
    // 匹配 [mm:ss.xx] 或 [mm:ss.xxx] 时间戳
    const re = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\]([^\n]*)/g;
    let m;
    while ((m = re.exec(lrcText)) !== null) {
      const ms = (+m[1]) * 60000 + (+m[2]) * 1000 + Number((m[3] + '000').slice(0, 3));
      const text = m[4].trim();
      // 跳过空行和纯元信息行（作词/作曲/编曲等）
      if (text && !/^(作词|作曲|编曲|填词|出品|制作|混音|监制|出版)/.test(text)) {
        lines.push({ ms, text });
      }
    }
    return lines.sort((a, b) => a.ms - b.ms);
  }

  /** 获取音乐代理地址（去掉末尾斜杠） */
  function _bgmProxyBase() {
    return String(lsGet(LS.BGM_PROXY, '') || '').trim().replace(/\/$/, '');
  }

  /** 通过代理拉取歌词 LRC */
  async function _fetchNeteaseLyric(songId, titleHint) {
    const proxy = _bgmProxyBase();
    const kw = titleHint || songId || '';
    if (!kw && !songId) return '';

    if (proxy) {
      // 走用户配置的 Cloudflare Worker 代理
      try {
        const q = encodeURIComponent(kw || songId);
        const res = await fetch(`${proxy}/lyric?q=${q}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return '';
        const data = await res.json();
        // /lyric 返回单条或数组
        const hit = Array.isArray(data) ? (data.find(d => d.syncedLyrics) || data[0]) : data;
        const lrc = hit?.syncedLyrics || '';
        if (lrc && songId) _lrcSet(songId, lrc);
        return lrc;
      } catch(e) { return ''; }
    }

    // 无代理：直接试 lrclib（lrclib 本身支持跨域）
    if (!kw) return '';
    try {
      const res = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(kw)}&limit=5`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return '';
      const arr = await res.json();
      if (!Array.isArray(arr)) return '';
      const hit = arr.find(d => d.syncedLyrics) || arr[0];
      const lrc = hit?.syncedLyrics || '';
      if (lrc && songId) _lrcSet(songId, lrc);
      return lrc;
    } catch(e) { return ''; }
  }

  /** 从 URL/track 提取网易云歌曲 ID */
  function _extractNeteaseId(url) {
    const m = String(url || '').match(/[?&/]id=(\d+)/i) || String(url || '').match(/\/(\d{6,})/);
    return m ? m[1] : '';
  }

  /** 加载当前曲目的歌词到内存 */
  async function _loadBgmLyric(track) {
    _bgmLyricLines = [];
    _bgmLyricIdx   = -1;
    if (!track) return;
    const songId = _extractNeteaseId(track.url);
    // 先查本地缓存（用网易云ID 或 trackId 都能命中）
    const cacheKeys = [songId, track.id, track.trackId].filter(Boolean);
    for (const key of cacheKeys) {
      const cached = _lrcGet(key);
      if (cached) { _bgmLyricLines = _parseLrc(cached); return; }
    }
    if (!songId && !cacheKeys.length) {
    }
    // 无缓存：拉取（多节点网易 API + lrclib 兜底）
    const title = String(track.title || '').trim();
    const lrc = await _fetchNeteaseLyric(songId, title);
    if (lrc) {
      _bgmLyricLines = _parseLrc(lrc);
      // 存入缓存，用 trackId 方便下次命中
      const saveKey = songId || (track.id || track.trackId || '');
      if (saveKey) _lrcSet(saveKey, lrc);
    }
  }

  /** 根据当前播放时间更新歌词高亮行，返回是否有变化 */
  function _bgmLyricTickMs(currentMs) {
    if (!_bgmLyricLines.length) return false;
    let idx = 0;
    for (let i = 0; i < _bgmLyricLines.length; i++) {
      if (_bgmLyricLines[i].ms <= currentMs) idx = i; else break;
    }
    if (idx === _bgmLyricIdx) return false;
    _bgmLyricIdx = idx;
    return true;
  }

  /** 渲染歌词到 dock 的 .mv-bgm-lyric 元素 */
  function _renderLyricInDock(root) {
    const wrap = root?.querySelector('.mv-bgm-lyric');
    if (!wrap) return;
    if (!_bgmLyricLines.length) { wrap.innerHTML = ''; return; }

    const isAudio = _bgmState.parsedKind === 'audio';
    const cur = _bgmLyricIdx;

    if (isAudio && cur >= 0) {
      // 时间同步模式：显示前后各3行，高亮当前行
      const start = Math.max(0, cur - 3);
      const end   = Math.min(_bgmLyricLines.length - 1, cur + 3);
      let html = '';
      for (let i = start; i <= end; i++) {
        const isCur = i === cur;
        html += `<div class="mv-bgm-lrc-line${isCur?' mv-bgm-lrc-cur':''}" style="text-align:center;padding:1px 8px;box-sizing:border-box;transition:all .3s ease;font-size:${isCur?'13px':'11px'};font-weight:${isCur?'700':'400'};color:${isCur?'rgba(44,57,63,.9)':'rgba(44,57,63,.32)'};line-height:${isCur?'1.6':'1.4'}">${esc(_bgmLyricLines[i].text)}</div>`;
      }
      wrap.innerHTML = html;
    } else {
      // 静态模式（iframe）：显示前后各3行窗口，和音频模式同样体验
      const displayCur = Math.max(0, cur);
      const start = Math.max(0, displayCur - 3);
      const end   = Math.min(_bgmLyricLines.length - 1, displayCur + 3);
      let html = '';
      for (let i = start; i <= end; i++) {
        const isCur = i === displayCur;
        html += `<div class="mv-bgm-lrc-line${isCur?' mv-bgm-lrc-cur':''}" style="text-align:center;padding:1px 8px;box-sizing:border-box;transition:all .3s ease;font-size:${isCur?'13px':'11px'};font-weight:${isCur?'700':'400'};color:${isCur?'rgba(44,57,63,.9)':'rgba(44,57,63,.32)'};line-height:${isCur?'1.6':'1.4'}">${esc(_bgmLyricLines[i].text)}</div>`;
      }
      wrap.style.overflowY = 'hidden';
      wrap.innerHTML = html;
    }
    // 让当前行在视口中
    const curEl = wrap.querySelector('.mv-bgm-lrc-cur');
    if (curEl) {
      try { curEl.scrollIntoView({ block: 'nearest', behavior: isAudio ? 'smooth' : 'auto' }); } catch(e) {}
    }
  }

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

  /**
   * extractCleanText: 从 mes_text DOM 元素里提取适合 TTS 的纯文字
   * - 克隆节点，移除 ST 美化产生的装饰/元数据子元素
   * - 对 【】 等特殊格式做 DOM 级别清理
   */
  function extractCleanText(el) {
    const NARR_BLOCK_OPEN  = '⟪MV_NARR_BLOCK⟫';
    const NARR_BLOCK_CLOSE = '⟪/MV_NARR_BLOCK⟫';
    try {
      const root = el.cloneNode(true);

      function replaceAsNarration(node, inline) {
        const txt = (node?.textContent || '').replace(/\u00A0/g, ' ').trim();
        if (!txt) return;
        const ph = doc.createTextNode(inline
          ? ` ${NARR_BLOCK_OPEN} ${txt} ${NARR_BLOCK_CLOSE} `
          : `\n${NARR_BLOCK_OPEN}\n${txt}\n${NARR_BLOCK_CLOSE}\n`);
        try { node.replaceWith(ph); } catch(e) {}
      }

      // 先把代码块 / 引用块保护起来，后续广播剧模式会强制按旁白处理。
      root.querySelectorAll('pre, blockquote').forEach(node => replaceAsNarration(node, false));
      root.querySelectorAll('code').forEach(node => {
        try { if (node.closest('pre')) return; } catch(e) {}
        replaceAsNarration(node, true);
      });

      // 保护明显是“格式化展示”的 HTML 区块：带 style 的容器、表格、列表、详情块等。
      // 只处理最外层命中的节点，避免嵌套块重复展开。
      const fmtSel = [
        'div[style]', 'section[style]', 'article[style]', 'aside[style]',
        'p[style]', 'span[style]',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'details', 'summary'
      ].join(',');
      Array.from(root.querySelectorAll(fmtSel)).forEach(node => {
        try {
          if (node.closest('pre, blockquote, code')) return;
          const parent = node.parentElement;
          if (parent && parent !== root && parent.closest(fmtSel)) return;
          replaceAsNarration(node, false);
        } catch(e) {}
      });

      // textContent 直接读原生 DOM 文字，不依赖渲染树，永远可靠。
      // ST 的美化正则生成的 <div style=".../* 注释 */..."> 里的
      // CSS 注释文字也会被 textContent 包含进来，所以要做清洗。
      let text = root.textContent || '';

      // 1. 去掉 CSS 注释内容（/* ... */），防止 style 属性内联注释泄漏
      text = text.replace(/\/\*[\s\S]*?\*\//g, '');

      // 2. 去掉 CSS 属性片段（color: #xxx; / display: flex; 等）
      //    特征：含冒号且前后是 ASCII 字母/数字/# 的行
      text = text.replace(/[a-z-]+\s*:\s*[^;\n]{0,80};/gi, '');

      // 3. 去 【...】 整块
      text = text.replace(/\u3010[^\u3011\n]{0,100}\u3011/g, '');
      text = text.replace(/[\u3010\u3011\[\]]/g, ' ');

      // 4. 去控制字符 / 零宽字符（保护标记本身保留）
      text = text.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, ' ');

      // 5. 去 HTML 实体残留
      text = text.replace(/&[a-z#0-9]+;/gi, ' ');

      // 6. 去多余空白（保留保护块）
      text = text.replace(/[ \t]{2,}/g, ' ')
                 .replace(/\n{3,}/g, '\n\n')
                 .trim();

      return text;
    } catch(e) {
      return (el.textContent || '').replace(/\u3010[^\u3011]*\u3011/g, '').trim();
    }
  }
  function processText(raw, c) {
    let text = String(raw || '').trim();

    // 广播剧模式：把原始 HTML / 选择器 / 状态块先包成旁白保护块，后面统一按旁白读。
    if (c.mode === 'drama') {
      text = text.replace(/\[(?:Selector|selector)\]([\s\S]*?)\[\/(?:Selector|selector)\]/g, (m, inner) => {
        const t = String(inner || '').trim();
        return t ? `
⟪MV_NARR_BLOCK⟫
${t}
⟪/MV_NARR_BLOCK⟫
` : ' ';
      });
      text = text.replace(/\[(?:状态|state)\s*:[^\]]*\]/gi, (m) => {
        const t = String(m || '').replace(/^\[/, '').replace(/\]$/, '').trim();
        return t ? `
⟪MV_NARR_BLOCK⟫
${t}
⟪/MV_NARR_BLOCK⟫
` : ' ';
      });
      text = text.replace(/<(?:div|section|article|aside|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|dl|dt|dd|details|summary|blockquote|pre|code)[^>]*>[\s\S]*?<\/(?:div|section|article|aside|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|dl|dt|dd|details|summary|blockquote|pre|code)>/gi, (m) => {
        const t = String(m || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/\s{2,}/g, ' ')
          .trim();
        return t ? `
⟪MV_NARR_BLOCK⟫
${t}
⟪/MV_NARR_BLOCK⟫
` : ' ';
      });
    }
    // ── TTS前清理：去掉 Markdown + 让TTS引擎友好读 ──
    // 去 Markdown
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '');
    // 【X】格式：去括号保内容（TTS引擎遇到全角括号会停顿或截断）
    text = text.replace(/[【【]/g, '').replace(/[】】]/g, '');
    // 同理去掉 [] 方括号本身（保内容）
    text = text.replace(/\[([^\]]{0,120})\]/g, '$1');
    if (c.skipStar)    text = text.replace(/\*[^*\n]{0,120}\*/g, '');
    // skipBracket：用户选择时额外去掉小括号内容（旁注）
    if (c.skipBracket) text = text.replace(/（[^）\n]{0,80}）/g, '').replace(/\([^)\n]{0,80}\)/g, '');
    if (c.skipPattern?.trim()) {
      try { text = text.replace(new RegExp(c.skipPattern, 'g'), ''); } catch(e) {}
    }
    if (c.mode === 'dialogue') {
      const hits = [];
      // 中文常见引号全覆盖，上限 800 字
      const dialogueRx = [
        /\u201c([\s\S]{1,800}?)\u201d/g,
        /\u300c([\s\S]{1,800}?)\u300d/g,
        /\u300e([\s\S]{1,800}?)\u300f/g,
        /"([\s\S]{1,800}?)"/g,
      ];
      for (const rx of dialogueRx) {
        rx.lastIndex = 0;
        let m;
        while ((m = rx.exec(text)) !== null) {
          const hit = m[1].trim();
          if (hit) hits.push(hit);
        }
      }
      text = hits.join('，') || text;
    } else if (c.mode === 'narration') {
      text = text.replace(/"[^"]{0,200}"/g,'').replace(/『[^』]{0,200}』/g,'')
                 .replace(/「[^」]{0,200}」/g,'').replace(/"[^"]{0,200}"/g,'');
    }
    return text.replace(/\n{2,}/g, '。').replace(/\s+/g, ' ').trim();
  }

  // ── 外接 TTS API（OpenAI 兼容接口）──
  // 单次请求 TTS API，返回 Promise
  function _clampNum(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function _safeAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _directAudioLike(url) {
    const u = String(url || '').trim();
    return /(?:\.mp3|\.m4a|\.aac|\.ogg|\.wav|\.flac)(?:[?#].*)?$/i.test(u)
      || /[?&](?:format|mime|type)=(?:audio|mp3|m4a|ogg|wav|aac)/i.test(u)
      || /^blob:/i.test(u)
      || /^data:audio\//i.test(u)
      // QQ音乐（已移除，vkey 过期太快）
      // 酷我 CDN
      || /music-api\.gdstudio\.xyz/i.test(u)
      || /er-sycdn\.kuwo\.cn/i.test(u)
      || /sycdn\.kuwo\.cn/i.test(u);
  }


  function _uid(prefix) {
    return String(prefix || 'id_') + Math.random().toString(36).slice(2, 10);
  }

  // ── LRC 单独存储，避免撑爆 library JSON（5MB 限制）─────────
  const LS_LRC_PREFIX = 'meow_voice_lrc_v1_';
  function _lrcKey(songId) { return LS_LRC_PREFIX + String(songId || ''); }
  function _lrcGet(songId) {
    if (!songId) return '';
    try { return W.localStorage.getItem(_lrcKey(songId)) || ''; } catch(e) { return ''; }
  }
  function _lrcSet(songId, lrc) {
    if (!songId || !lrc) return;
    try { W.localStorage.setItem(_lrcKey(songId), lrc); } catch(e) {}
  }

  function _ensureBgmLibrary(raw) {
    let lib = Array.isArray(raw) ? raw : [];
    lib = lib.map(g => ({
      id: String(g?.id || _uid('g_')),
      name: String(g?.name || '未命名分组').trim() || '未命名分组',
      tracks: Array.isArray(g?.tracks) ? g.tracks.map(t => ({
        id: String(t?.id || _uid('t_')),
        title: String(t?.title || '未命名曲目').trim() || '未命名曲目',
        url: String(t?.url || '').trim(),
        // lrc 字段不保存进 library（单独存在 LS_LRC_PREFIX+songId 里）
      })).filter(t => t.url) : [],
    }));
    if (!lib.length) lib = [{ id: 'g_default', name: '常用', tracks: [] }];
    return lib;
  }

  // 内存缓存：避免 save→get 的读写时序问题
  let _bgmLibCache = null;

  function _getBgmLibrary() {
    if (!_bgmLibCache) {
      _bgmLibCache = _ensureBgmLibrary(lsGet(LS.BGM_LIBRARY, []));
    }
    // 始终返回深拷贝，防止外部代码意外修改 cache 内部对象
    return JSON.parse(JSON.stringify(_bgmLibCache));
  }

  function _saveBgmLibrary(lib) {
    const ensured = _ensureBgmLibrary(lib); // lrc 字段在这里被剥离
    _bgmLibCache = ensured;                 // 立即更新内存缓存
    const json = JSON.stringify(ensured);
    // localStorage 5MB 配额保护：写入失败时清理旧歌词缓存再重试
    const _tryWrite = () => {
      try {
        W.localStorage.setItem(LS.BGM_LIBRARY, json);
        return true;
      } catch(e) { return false; }
    };
    if (!_tryWrite()) {
      // 清理所有歌词缓存腾出空间
      const toDelete = [];
      for (let i = 0; i < W.localStorage.length; i++) {
        const k = W.localStorage.key(i);
        if (k && k.startsWith('meow_voice_lrc_')) toDelete.push(k);
      }
      toDelete.forEach(k => { try { W.localStorage.removeItem(k); } catch(e) {} });
      if (!_tryWrite()) {
        // 实在写不进去就用 sessionStorage 临时保住本次会话
        try { W.sessionStorage.setItem(LS.BGM_LIBRARY, json); } catch(e) {}
        toast('⚠️ 曲库已满，请删除一些旧歌曲（localStorage 超出 5MB 限制）');
      }
    }
    // 验证写入成功
    const check = W.localStorage.getItem(LS.BGM_LIBRARY);
    if (check && check.length !== json.length) {
      // 数据不完整，再试一次
      try { W.localStorage.setItem(LS.BGM_LIBRARY, json); } catch(e) {}
    }
  }

  function _findBgmGroup(lib, groupId) {
    const arr = Array.isArray(lib) ? lib : _ensureBgmLibrary(lib);
    return arr.find(g => g && g.id === groupId) || arr[0] || null;
  }

  function _findBgmTrack(lib, groupId, trackId) {
    const group = _findBgmGroup(lib, groupId);
    if (!group || !Array.isArray(group.tracks)) return null;
    // 注意：不加 fallback，找不到就返回 null，避免覆盖逻辑错乱
    return group.tracks.find(t => t && t.id === trackId) || null;
  }

  function _resolveBgmSelection(cArg, override) {
    const c = cArg || cfg();
    const o = override || {};
    if (o.sourceUrl) {
      return {
        title: String(o.title || c.bgmTitle || '背景音乐').trim() || '背景音乐',
        url: String(o.sourceUrl || '').trim(),
        groupId: String(o.groupId || ''),
        trackId: String(o.trackId || ''),
      };
    }
    const lib = _ensureBgmLibrary(c.bgmLibrary || lsGet(LS.BGM_LIBRARY, []));
    const groupId = String(c.bgmGroup || lsGet(LS.BGM_GROUP, '') || (lib[0]?.id || ''));
    const trackId = String(c.bgmTrack || lsGet(LS.BGM_TRACK, ''));
    const track = _findBgmTrack(lib, groupId, trackId);
    if (track && track.url) {
      return { title: track.title || c.bgmTitle || '背景音乐', url: track.url, groupId: groupId || (lib[0]?.id || ''), trackId: track.id || '' };
    }
    if (String(c.bgmUrl || '').trim()) {
      return { title: String(c.bgmTitle || '背景音乐').trim() || '背景音乐', url: String(c.bgmUrl || '').trim(), groupId: '', trackId: '' };
    }
    return null;
  }

  function _setBgmSelection(groupId, trackId, title, url) {
    if (groupId != null) lsSet(LS.BGM_GROUP, groupId || '');
    if (trackId != null) lsSet(LS.BGM_TRACK, trackId || '');
    if (title != null) lsSet(LS.BGM_TITLE, String(title || '').trim() || '背景音乐');
    if (url != null) lsSet(LS.BGM_URL, String(url || '').trim());
  }

  function _bgmTrackList(group) {
    return Array.isArray(group?.tracks) ? group.tracks : [];
  }

  function _bgmTracksForDisplay(lib, groupId) {
    const group = _findBgmGroup(lib, groupId);
    return _bgmTrackList(group).slice();
  }

  function _parseDramaBgmSource(raw) {
    const txt = String(raw || '').trim();
    if (!txt) return { kind: 'none', raw: txt };

    // 支持直接粘贴 iframe HTML
    const iframeMatch = txt.match(/<iframe[^>]+src=(["'])(.*?)\1/i);
    let val = iframeMatch ? iframeMatch[2] : txt;
    val = val.replace(/&amp;/g, '&').trim();

    // 网易云常规歌曲页 /#/song?id=xxx
    const songIdMatch = val.match(/music\.163\.com\/(?:#\/)?song\?id=(\d+)/i)
      || val.match(/music\.163\.com\/.*?[?&]id=(\d+)/i)
      || val.match(/\/song\?id=(\d+)/i);
    if (songIdMatch) {
      const songId = songIdMatch[1];
      return {
        kind: 'netease_iframe',
        songId,
        iframeSrc: 'https://music.163.com/outchain/player?type=2&id=' + songId + '&auto=1&height=66',
        raw: txt,
      };
    }

    // 网易云 outchain
    const outchainMatch = val.match(/music\.163\.com\/outchain\/player\?[^"' ]+/i);
    if (outchainMatch) {
      let iframeSrc = outchainMatch[0];
      iframeSrc = iframeSrc.replace(/^\/\//, 'https://');
      if (!/^https?:\/\//i.test(iframeSrc)) iframeSrc = 'https://' + iframeSrc.replace(/^\/+/, '');
      if (!/[?&]auto=/.test(iframeSrc)) iframeSrc += (iframeSrc.includes('?') ? '&' : '?') + 'auto=1';
      if (!/[?&]height=/.test(iframeSrc)) iframeSrc += '&height=66';
      const idm = iframeSrc.match(/[?&]id=(\d+)/i);
      return {
        kind: 'netease_iframe',
        songId: idm ? idm[1] : '',
        iframeSrc,
        raw: txt,
      };
    }

    if (_directAudioLike(val)) {
      return { kind: 'audio', audioUrl: val, raw: txt };
    }

    // 普通网页地址不是可直接播放音频，先按网页类处理
    if (/^https?:\/\//i.test(val)) {
      return { kind: 'page', pageUrl: val, raw: txt };
    }
    return { kind: 'unknown', raw: txt };
  }

  function _bgmKindLabel(kind) {
    if (kind === 'netease_iframe') return '网易云播放器';
    if (kind === 'audio') return '直链音频';
    if (kind === 'page') return '网页链接';
    return '背景音乐';
  }

  function _buildBgmCaption(cArg, group, track, tracks) {
    const c = cArg || cfg();
    const explicit = String(track?.lyric || track?.lyrics || track?.lrc || '').trim();
    if (explicit) return explicit;
    const titleRaw = String(track?.title || _bgmState.title || c.bgmTitle || '').trim();
    if (!titleRaw) return '';
    return '';
  }


  function _bgmDockViewport() {
    const vv = W.visualViewport;
    const w = Math.round((vv && vv.width) || W.innerWidth || doc.documentElement.clientWidth || 0);
    const h = Math.round((vv && vv.height) || W.innerHeight || doc.documentElement.clientHeight || 0);
    return { w: Math.max(220, w), h: Math.max(220, h) };
  }

  function _bgmDockPeek(root) {
    if (!root) return 16;
    // 收起时进一步藏进去，只保留接近半张唱片可见
    if (root.classList.contains('mini')) return 12;
    if (root.classList.contains('compact')) return 14;
    return 16;
  }

  function _bgmDockDefaultPos(root) {
    const vp = _bgmDockViewport();
    const w = Math.round(root.offsetWidth || parseFloat(getComputedStyle(root).width) || 288);
    const h = Math.round(root.offsetHeight || 120);
    const peek = _bgmDockPeek(root);
    const collapsed = root.classList.contains('collapsed');
    const side = 'right';
    // 默认只吸附右边；收起时只露出一半左右的唱片
    const x = collapsed ? Math.round(vp.w - peek) : Math.max(8, vp.w - w - 8);
    const y = Math.max(72, Math.min(vp.h - h - 12, vp.h - (root.classList.contains('mini') ? 166 : 208)));
    return { x, y, side, peek };
  }

  function _applyBgmDockPos(root, pos, persist) {
    if (!root) return;
    const vp = _bgmDockViewport();
    const w = Math.round(root.offsetWidth || parseFloat(getComputedStyle(root).width) || 288);
    const h = Math.round(root.offsetHeight || 120);
    const collapsed = root.classList.contains('collapsed');
    const peek = _bgmDockPeek(root);
    let p = pos && typeof pos === 'object' ? Object.assign({}, pos) : (lsGet(LS.BGM_DOCK_POS, null) || null);
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') p = _bgmDockDefaultPos(root);
    let side = (p.side === 'left') ? 'left' : 'right';
    let x = Number(p.x || 0), y = Number(p.y || 0);
    const minY = 46;
    const maxY = Math.max(minY, vp.h - Math.min(h, vp.h - 8) - 6);
    y = Math.max(minY, Math.min(maxY, y));
    if (collapsed) {
      // 不再吸附左侧，避免拖到左边飞出去；统一吸附右侧
      side = 'right';
      x = Math.round(vp.w - peek);
    } else {
      const minX = 4;
      const maxX = Math.max(minX, vp.w - w - 4);
      x = Math.max(minX, Math.min(maxX, x));
    }
    root.classList.toggle('edge-left', side === 'left');
    root.classList.toggle('edge-right', side !== 'left');
    root.style.transform = 'none';
    root.style.left = x + 'px';
    root.style.top = y + 'px';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    if (persist) lsSet(LS.BGM_DOCK_POS, { x, y, side, peek });
  }

  function _resetBgmDockPos(forceOpen) {
    const root = _getBgmDock();
    if (!root) return;
    _bgmState.closed = false;
    root.style.display = '';
    if (forceOpen === true) lsSet(LS.BGM_DOCK_COLLAPSED, false);
    else lsSet(LS.BGM_DOCK_COLLAPSED, true);
    _renderBgmDock();
    const pos = _bgmDockDefaultPos(root);
    _applyBgmDockPos(root, pos, true);
  }

  function _getBgmDock() {
    let root = doc.getElementById('meow-voice-bgm-dock');
    if (root) return root;
    root = doc.createElement('div');
    root.id = 'meow-voice-bgm-dock';
    root.className = 'edge-right';
    root.innerHTML = `
      <div class="mv-bgm-shell">
        <button type="button" class="mv-bgm-close" title="隐藏唱片机" aria-label="隐藏唱片机">×</button>
        <div class="mv-bgm-disc-wrap" title="展开 / 收起唱片机">
          <button type="button" class="mv-bgm-disc-hit" aria-label="展开 / 收起唱片机"></button>
          <div class="mv-bgm-disc">
            <div class="mv-bgm-disc-shine"></div>
            <div class="mv-bgm-disc-ring"></div>
            <div class="mv-bgm-disc-core"></div>
          </div>
          <button type="button" class="mv-bgm-tonearm" title="展开 / 收起唱片机" aria-label="展开 / 收起唱片机">
            <span class="mv-bgm-arm-knob"></span>
            <span class="mv-bgm-arm-bar"></span>
            <span class="mv-bgm-arm-head"></span>
          </button>
        </div>
        <div class="mv-bgm-panel">
          <div class="mv-bgm-head">
            <div class="mv-bgm-meta">
              <div class="mv-bgm-name">背景音乐</div>
              <div class="mv-bgm-sub">未播放</div>
            </div>
            <button type="button" class="mv-bgm-open-settings" title="回语音主弹窗" aria-label="回语音主弹窗">♫</button>
          </div>
          <div class="mv-bgm-progress"><input type="range" class="mv-bgm-seek" min="0" max="1000" step="1" value="0"></div>
          <div class="mv-bgm-controls">
            <button type="button" class="mv-bgm-prev" title="上一首">⏮</button>
            <button type="button" class="mv-bgm-play" title="播放/暂停">▶</button>
            <button type="button" class="mv-bgm-next" title="下一首">⏭</button>
          </div>
          <div class="mv-bgm-groups"></div>
          <div class="mv-bgm-pick-row">
            <select class="mv-bgm-track-select" aria-label="选择歌曲"></select>
          </div>
          <div class="mv-bgm-lyric"></div>
          <div class="mv-bgm-track-count" style="margin-top:6px;font-size:10px;color:rgba(57,72,80,.46)"></div>
          <div class="mv-bgm-list"></div>
          <div class="mv-bgm-embed"></div>
        </div>
      </div>
    `;
    Object.assign(root.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      right: 'auto',
      bottom: 'auto',
      width: '288px',
      maxWidth: 'calc(100vw - 4px)',
      zIndex: '2147483646',
      display: 'none',
      background: 'transparent',
      pointerEvents: 'auto',
      transition: 'transform .28s ease, left .18s ease, top .18s ease',
      touchAction: 'none',
    });
    const style = doc.createElement('style');
    style.id = 'meow-voice-bgm-dock-style';
    style.textContent = `
      #meow-voice-bgm-dock{font-family:inherit;color:#26353a;overflow:visible;--mv-bgm-peek:56px}
      #meow-voice-bgm-dock .mv-bgm-shell{position:relative;min-height:114px;padding-left:42px}
      #meow-voice-bgm-dock .mv-bgm-close{position:absolute;right:10px;top:2px;width:28px;height:28px;border:0;border-radius:999px;background:rgba(255,255,255,.82);box-shadow:0 8px 18px rgba(40,40,40,.10);cursor:pointer;color:#516068;font-size:14px;z-index:8}
      #meow-voice-bgm-dock .mv-bgm-disc-wrap{position:absolute;left:-24px;top:12px;width:102px;height:102px;display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:6}
      #meow-voice-bgm-dock .mv-bgm-disc-hit{position:absolute;inset:0;border:0;background:transparent;cursor:pointer;z-index:6}
            #meow-voice-bgm-dock .mv-bgm-disc{position:relative;width:88px;height:88px;border-radius:50%;box-shadow:0 12px 26px rgba(0,0,0,.12), inset 0 0 0 1px rgba(255,255,255,.30);overflow:hidden;background:
        radial-gradient(circle at 68% 30%, rgba(255,255,255,.26) 0 7%, rgba(255,255,255,0) 18%),
        radial-gradient(circle at 50% 50%, rgba(246,246,242,.86) 0 18%, rgba(226,226,220,.94) 18% 21%, rgba(240,240,234,.54) 21% 56%, rgba(223,223,216,.38) 56% 77%, rgba(248,248,244,.70) 77% 100%);
        overflow:hidden}
      #meow-voice-bgm-dock .mv-bgm-disc::before{content:'';position:absolute;inset:10px;border-radius:50%;border:1px solid rgba(255,255,255,.22);opacity:.8}
      #meow-voice-bgm-dock .mv-bgm-disc::after{content:'';position:absolute;inset:24px;border-radius:50%;border:1px solid rgba(255,255,255,.18);opacity:.7}
      #meow-voice-bgm-dock .mv-bgm-disc-shine{position:absolute;inset:0;border-radius:50%;background:linear-gradient(120deg, rgba(255,255,255,.36), rgba(255,255,255,0) 42%, rgba(0,0,0,.03) 68%, rgba(255,255,255,.12));mix-blend-mode:screen;opacity:.78}
      #meow-voice-bgm-dock .mv-bgm-disc-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;background:rgba(247,247,244,.94);box-shadow:inset 0 0 0 1px rgba(70,82,90,.10)}
      #meow-voice-bgm-dock .mv-bgm-disc-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:9px;height:9px;border-radius:50%;background:#efefeb;box-shadow:0 0 0 4px rgba(197,204,206,.42)}
      #meow-voice-bgm-dock.playing .mv-bgm-disc{animation:mvBgmSpin 7.5s linear infinite}
      @keyframes mvBgmSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      #meow-voice-bgm-dock .mv-bgm-tonearm{position:absolute;right:0;top:-2px;width:56px;height:56px;border:0;background:transparent;cursor:pointer;z-index:9;transform-origin:84% 16%;transition:transform .32s ease;will-change:transform}
      #meow-voice-bgm-dock .mv-bgm-arm-knob{position:absolute;right:7px;top:3px;width:11px;height:11px;border-radius:50%;background:linear-gradient(180deg,#faf9f7,#dfddd7);box-shadow:0 2px 4px rgba(0,0,0,.18)}
      #meow-voice-bgm-dock .mv-bgm-arm-bar{position:absolute;right:11px;top:11px;width:30px;height:4px;border-radius:999px;background:linear-gradient(180deg,#f6f4ef,#cfcac2);transform:rotate(44deg);transform-origin:100% 50%;box-shadow:0 1px 2px rgba(0,0,0,.14)}
      #meow-voice-bgm-dock .mv-bgm-arm-head{position:absolute;left:10px;top:34px;width:16px;height:7px;border-radius:999px;background:linear-gradient(180deg,#f7f6f2,#d6d0c8);transform:rotate(44deg);box-shadow:0 1px 2px rgba(0,0,0,.16)}
      #meow-voice-bgm-dock.playing:not(.collapsed) .mv-bgm-tonearm{transform:rotate(-30deg)}
      #meow-voice-bgm-dock.playing.collapsed .mv-bgm-tonearm{transform:rotate(-30deg)}
      #meow-voice-bgm-dock.collapsed:not(.playing) .mv-bgm-tonearm{transform:rotate(12deg)}
      #meow-voice-bgm-dock:not(.playing):not(.collapsed) .mv-bgm-tonearm{transform:rotate(-6deg)}
      #meow-voice-bgm-dock .mv-bgm-panel{position:relative;min-height:110px;padding:10px 10px 9px 46px;border-radius:20px;background:linear-gradient(180deg, rgba(255,255,255,.82), rgba(244,244,240,.64));border:1px solid rgba(214,214,206,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 16px 34px rgba(0,0,0,.10);overflow:visible;transition:opacity .15s ease,transform .15s ease}
      #meow-voice-bgm-dock .mv-bgm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding-right:32px}
      #meow-voice-bgm-dock .mv-bgm-open-settings{position:absolute;right:8px;top:34px;width:26px;height:26px;border:0;border-radius:999px;background:rgba(255,255,255,.78);box-shadow:0 6px 14px rgba(0,0,0,.08);cursor:pointer;color:#56656d;font-size:13px;flex:none;z-index:7}
      #meow-voice-bgm-dock .mv-bgm-name{font-size:14px;line-height:1.15;font-weight:700;color:#2c393f;max-width:126px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #meow-voice-bgm-dock .mv-bgm-sub{font-size:10px;color:rgba(44,57,63,.55);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
      #meow-voice-bgm-dock .mv-bgm-progress{margin-top:7px}
      #meow-voice-bgm-dock .mv-bgm-progress input{width:100%}
      #meow-voice-bgm-dock .mv-bgm-controls{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px}
      #meow-voice-bgm-dock .mv-bgm-controls button{width:30px;height:30px;font-size:13px;line-height:1;border:0;border-radius:999px;background:rgba(255,255,255,.76);box-shadow:0 5px 14px rgba(16,50,55,.08);cursor:pointer;color:#3e4f56}
      #meow-voice-bgm-dock .mv-bgm-play{width:38px;height:38px;font-size:17px;background:#3a474d;color:#fff}
      #meow-voice-bgm-dock .mv-bgm-groups{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
      #meow-voice-bgm-dock .mv-bgm-group-chip{border:0;border-radius:999px;padding:4px 9px;background:rgba(72,82,86,.08);color:#44535a;cursor:pointer;font-size:10px}
      #meow-voice-bgm-dock .mv-bgm-group-chip.active{background:#434f55;color:#fff}
      #meow-voice-bgm-dock .mv-bgm-pick-row{margin-top:7px}
      #meow-voice-bgm-dock .mv-bgm-track-select{width:100%;border:1px solid rgba(120,125,128,.18);border-radius:10px;padding:6px 9px;background:rgba(255,255,255,.74);font-size:11px;color:#334249;box-sizing:border-box}
      #meow-voice-bgm-dock .mv-bgm-lyric{margin-top:8px;min-height:80px;max-height:130px;overflow:hidden;padding:6px 2px;border-radius:14px;background:rgba(255,255,255,.36);border:1px solid rgba(225,225,219,.78);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0}
      #meow-voice-bgm-dock .mv-bgm-lyric:empty::before{content:'歌词';font-size:11px;color:rgba(44,57,63,.28);font-style:italic}
      #meow-voice-bgm-dock .mv-bgm-lrc-line{width:100%;padding:1px 8px;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #meow-voice-bgm-dock .mv-bgm-lrc-cur{white-space:normal;word-break:break-all}
      #meow-voice-bgm-dock .mv-bgm-list{display:none !important}
      #meow-voice-bgm-dock .mv-bgm-item{display:none !important}
      #meow-voice-bgm-dock .mv-bgm-item.active{display:none !important}
      #meow-voice-bgm-dock .mv-bgm-item-title{display:none !important}
      #meow-voice-bgm-dock .mv-bgm-item-meta{display:none !important}
      #meow-voice-bgm-dock .mv-bgm-item-play{display:none !important}
      #meow-voice-bgm-dock .mv-bgm-embed{margin-top:8px}
      #meow-voice-bgm-dock .mv-bgm-embed iframe{display:block;width:100%;height:104px;border:0;border-radius:14px;background:rgba(255,255,255,.84)}
      #meow-voice-bgm-dock .mv-bgm-embed.empty{display:none}
      #meow-voice-bgm-dock.edge-right.collapsed{transform:none}
      #meow-voice-bgm-dock.edge-left.collapsed{transform:none}
      #meow-voice-bgm-dock.collapsed .mv-bgm-panel{opacity:0;pointer-events:none;transform:translateY(-4px)}
      #meow-voice-bgm-dock.collapsed .mv-bgm-close{display:none}
      #meow-voice-bgm-dock.collapsed .mv-bgm-shell{min-height:112px}
      #meow-voice-bgm-dock.collapsed .mv-bgm-open-settings{right:58px;top:8px}
      #meow-voice-bgm-dock.compact{width:244px !important;--mv-bgm-peek:50px}
      #meow-voice-bgm-dock.compact .mv-bgm-shell{min-height:94px;padding-left:30px}
      #meow-voice-bgm-dock.compact .mv-bgm-disc-wrap{left:-24px;top:10px;width:84px;height:84px}
      #meow-voice-bgm-dock.compact .mv-bgm-disc{width:72px;height:72px}
      #meow-voice-bgm-dock.compact .mv-bgm-tonearm{top:-2px;right:-1px;width:46px;height:46px}
      #meow-voice-bgm-dock.compact .mv-bgm-arm-knob{right:5px;top:3px;width:9px;height:9px}
      #meow-voice-bgm-dock.compact .mv-bgm-arm-bar{right:8px;top:10px;width:26px;height:4px}
      #meow-voice-bgm-dock.compact .mv-bgm-arm-head{left:8px;top:28px;width:13px;height:6px}
      #meow-voice-bgm-dock.compact .mv-bgm-panel{padding:10px 9px 9px 34px;border-radius:18px}
      #meow-voice-bgm-dock.compact .mv-bgm-name{max-width:104px;font-size:13px}
      #meow-voice-bgm-dock.compact .mv-bgm-sub{max-width:118px}
      #meow-voice-bgm-dock.compact .mv-bgm-controls button{width:28px;height:28px}
      #meow-voice-bgm-dock.compact .mv-bgm-play{width:32px;height:32px}
      
      #meow-voice-bgm-dock.mini{width:174px !important;max-width:calc(100vw - 2px) !important;--mv-bgm-peek:44px}
      #meow-voice-bgm-dock.mini .mv-bgm-shell{padding-left:18px;min-height:74px}
      #meow-voice-bgm-dock.mini .mv-bgm-disc-wrap{left:-22px;top:7px;width:70px;height:70px}
      #meow-voice-bgm-dock.mini .mv-bgm-disc{width:58px;height:58px}
      #meow-voice-bgm-dock.mini .mv-bgm-tonearm{top:-3px;right:-2px;width:40px;height:40px}
      #meow-voice-bgm-dock.mini .mv-bgm-arm-knob{right:5px;top:3px;width:8px;height:8px}
      #meow-voice-bgm-dock.mini .mv-bgm-arm-bar{right:8px;top:9px;width:21px;height:3px}
      #meow-voice-bgm-dock.mini .mv-bgm-arm-head{left:7px;top:24px;width:11px;height:5px}
      #meow-voice-bgm-dock.mini .mv-bgm-panel{padding:8px 7px 7px 24px;border-radius:14px}
      #meow-voice-bgm-dock.mini .mv-bgm-name{font-size:11px;max-width:80px}
      #meow-voice-bgm-dock.mini .mv-bgm-sub{font-size:9px;max-width:92px}
      #meow-voice-bgm-dock.mini .mv-bgm-open-settings{right:6px;top:25px;width:22px;height:22px;font-size:10px}
      #meow-voice-bgm-dock.mini .mv-bgm-close{right:6px;top:2px;width:22px;height:22px;font-size:12px}
      #meow-voice-bgm-dock.mini .mv-bgm-controls{gap:6px;margin-top:7px}
      #meow-voice-bgm-dock.mini .mv-bgm-controls button{width:24px;height:24px}
      #meow-voice-bgm-dock.mini .mv-bgm-play{width:28px;height:28px}
      #meow-voice-bgm-dock.mini .mv-bgm-group-chip{padding:2px 6px;font-size:9px}
      #meow-voice-bgm-dock.mini .mv-bgm-track-select{padding:4px 7px;font-size:9px}
      #meow-voice-bgm-dock.mini .mv-bgm-lyric{min-height:54px;max-height:80px;padding:4px 0}
      #meow-voice-bgm-dock.mini .mv-bgm-list{max-height:74px}
      
      @media (max-width: 640px){
        #meow-voice-bgm-dock{width:234px !important;max-width:calc(100vw - 4px) !important;--mv-bgm-peek:50px}
        #meow-voice-bgm-dock .mv-bgm-shell{padding-left:28px;min-height:88px}
        #meow-voice-bgm-dock .mv-bgm-disc-wrap{left:-22px;top:8px;width:76px;height:76px}
        #meow-voice-bgm-dock .mv-bgm-disc{width:68px;height:68px}
        #meow-voice-bgm-dock .mv-bgm-panel{padding:9px 8px 8px 32px;border-radius:16px}
        #meow-voice-bgm-dock .mv-bgm-name{font-size:12px;max-width:98px}
        #meow-voice-bgm-dock .mv-bgm-sub{font-size:9px;max-width:106px}
        #meow-voice-bgm-dock .mv-bgm-open-settings{right:7px;top:28px;width:22px;height:22px}
        #meow-voice-bgm-dock .mv-bgm-close{right:7px;top:3px;width:22px;height:22px}
        #meow-voice-bgm-dock .mv-bgm-group-chip{padding:4px 8px;font-size:10px}
        #meow-voice-bgm-dock .mv-bgm-lyric{min-height:34px;padding:7px 8px}
        
      }
      #meow-voice-bgm-dock input[type="range"]{accent-color:#727f86}
    `;
    if (!doc.getElementById(style.id)) (doc.head || doc.documentElement).appendChild(style);
    root.addEventListener('click', async (e) => {
      const c = cfg();
      const lib = _getBgmLibrary();
      const rootNow = _getBgmDock();

      if (e.target.closest('.mv-bgm-open-settings')) {
        openModal();
        return;
      }
      if (e.target.closest('.mv-bgm-disc-hit')) {
        if (rootNow.dataset.dragging === '1') return;
        if (rootNow.dataset.justTap === '1' && e.detail > 0) return;
        const next = !rootNow.classList.contains('collapsed');
        lsSet(LS.BGM_DOCK_COLLAPSED, next);
        _renderBgmDock();
        _applyBgmDockPos(rootNow, lsGet(LS.BGM_DOCK_POS, null), true);
        return;
      }
      if (e.target.closest('.mv-bgm-tonearm')) {
        if (rootNow.dataset.dragging === '1') return;
        if (rootNow.dataset.justTap === '1' && e.detail > 0) return;
        const sel = _resolveBgmSelection(cfg());
        if (!sel) { toast('请先在设置里添加歌曲'); return; }
        if ((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe')) {
          try { await _setDramaBgmActive(false, cfg(), { keepDock: true, sourceUrl: sel.url, title: sel.title, groupId: sel.groupId, trackId: sel.trackId }); } catch(err) {}
        } else {
          _bgmState.closed = false;
          await _setDramaBgmActive(true, cfg(), { preview: true, sourceUrl: sel.url, title: sel.title, groupId: sel.groupId, trackId: sel.trackId, restart: false });
        }
        return;
      }

      const btn = e.target.closest('button, .mv-bgm-item');
      if (!btn) return;
      if (btn.classList.contains('mv-bgm-close')) {
        _bgmState.closed = true;
        rootNow.style.display = 'none';
        try { await _setDramaBgmActive(false, c, { keepDock: true }); } catch(err) {}
        return;
      }
      if (btn.classList.contains('mv-bgm-group-chip')) {
        const gid = btn.dataset.groupId || '';
        lsSet(LS.BGM_GROUP, gid);
        const group = _findBgmGroup(lib, gid);
        const first = group && group.tracks[0] ? group.tracks[0] : null;
        lsSet(LS.BGM_TRACK, first ? first.id : '');
        _renderBgmDock();
        return;
      }
      if (btn.classList.contains('mv-bgm-prev') || btn.classList.contains('mv-bgm-next') || btn.classList.contains('mv-bgm-item') || btn.classList.contains('mv-bgm-item-play')) {
        let gid = lsGet(LS.BGM_GROUP, '') || (lib[0]?.id || '');
        let group = _findBgmGroup(lib, gid);
        let tracks = _bgmTrackList(group);
        if (!tracks.length) {
          const sel = _resolveBgmSelection(c);
          if (!sel) { toast('还没有可播放的音乐'); return; }
          await _setDramaBgmActive(true, c, { preview: true, sourceUrl: sel.url, title: sel.title, restart: true });
          return;
        }
        let idx = Math.max(0, tracks.findIndex(t => t.id === lsGet(LS.BGM_TRACK, '')));
        if (btn.classList.contains('mv-bgm-prev')) idx = (idx - 1 + tracks.length) % tracks.length;
        else if (btn.classList.contains('mv-bgm-next')) idx = (idx + 1) % tracks.length;
        else {
          const item = btn.closest('.mv-bgm-item');
          const wanted = item?.dataset.trackId || btn.dataset.trackId || '';
          const foundIdx = tracks.findIndex(t => t.id === wanted);
          if (foundIdx >= 0) idx = foundIdx;
        }
        const track = tracks[idx];
        if (!track) return;
        _setBgmSelection(gid, track.id, track.title, track.url);
        _bgmState.closed = false;
        await _setDramaBgmActive(true, cfg(), { preview: true, sourceUrl: track.url, title: track.title, groupId: gid, trackId: track.id, restart: true });
        return;
      }
      if (btn.classList.contains('mv-bgm-play')) {
        const sel = _resolveBgmSelection(cfg());
        if (!sel) { toast('请先在设置里填写音乐链接或加入歌单'); return; }
        if ((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe')) {
          try { await _setDramaBgmActive(false, cfg(), { keepDock: true, sourceUrl: sel.url, title: sel.title, groupId: sel.groupId, trackId: sel.trackId }); } catch(err) {}
          return;
        }
        _bgmState.closed = false;
        await _setDramaBgmActive(true, cfg(), { preview: true, sourceUrl: sel.url, title: sel.title, groupId: sel.groupId, trackId: sel.trackId, restart: !!sel.trackId || true });
        return;
      }
    });
    root.addEventListener('change', async (e) => {
      const sel = e.target.closest('.mv-bgm-track-select');
      if (!sel) return;
      const gid = lsGet(LS.BGM_GROUP, '') || (_getBgmLibrary()[0]?.id || '');
      const lib = _getBgmLibrary();
      const track = _findBgmTrack(lib, gid, sel.value || '');
      if (!track) return;
      _setBgmSelection(gid, track.id, track.title, track.url);
      const shouldPlay = !!((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe'));
      if (shouldPlay) {
        try { await _setDramaBgmActive(true, cfg(), { preview: true, sourceUrl: track.url, title: track.title, groupId: gid, trackId: track.id, restart: true }); }
        catch(err) { toast('切歌失败：' + ((err && err.message) || err || '未知错误')); }
      } else {
        _renderBgmDock();
      }
    });
    root.addEventListener('input', (e) => {
      const seek = e.target.closest('.mv-bgm-seek');
      if (!seek || !_bgmAudio || !Number.isFinite(_bgmAudio.duration) || _bgmAudio.duration <= 0) return;
      try {
        _bgmAudio.currentTime = (_bgmAudio.duration * Number(seek.value || 0)) / 1000;
      } catch(err) {}
    });

    const dragTarget = root.querySelector('.mv-bgm-disc-wrap');
    let dragging = false, moved = false, sx = 0, sy = 0, bx = 0, by = 0;
    let dragStartTarget = null, dragWasTouch = false;
    const onDragStart = (e) => {
      const p = e.touches ? e.touches[0] : e;
      dragWasTouch = !!e.touches;
      dragStartTarget = e.target || null;
      dragging = true; moved = false; root.dataset.dragging = '0';
      sx = p.clientX; sy = p.clientY;
      bx = parseFloat(root.style.left) || 0;
      by = parseFloat(root.style.top) || 0;
      root.style.transition = 'none';
      if (dragWasTouch && e.cancelable) e.preventDefault();
      e.stopPropagation();
    };
    const onDragMove = (e) => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { moved = true; root.dataset.dragging = '1'; }
      const vp = _bgmDockViewport();
      const w = Math.round(root.offsetWidth || parseFloat(getComputedStyle(root).width) || 320);
      const h = Math.round(root.offsetHeight || 120);
      const nx = Math.max(4, Math.min(vp.w - w - 4, bx + dx));
      const ny = Math.max(54, Math.min(vp.h - h - 6, by + dy));
      root.style.left = nx + 'px';
      root.style.top = ny + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      if (dragWasTouch && e.cancelable) e.preventDefault();
    };
    const onDragEnd = (e) => {
      if (!dragging) return;
      dragging = false;
      root.style.transition = 'transform .28s ease, left .18s ease, top .18s ease';
      const currentX = parseFloat(root.style.left) || 0;
      const currentY = parseFloat(root.style.top) || 0;
      // 只吸附右边，不再吸附左边，防止左拖后飞出屏幕
      const side = 'right';
      _applyBgmDockPos(root, { x: currentX, y: currentY, side }, true);
      if (!moved && dragStartTarget) {
        root.dataset.dragging = '0';
        root.dataset.justTap = '1';
        const tonearm = dragStartTarget.closest && dragStartTarget.closest('.mv-bgm-tonearm');
        const discHit = dragStartTarget.closest && dragStartTarget.closest('.mv-bgm-disc-hit');
        if (tonearm) {
          try { tonearm.click(); } catch(err) {}
        } else if (discHit || (dragStartTarget.closest && dragStartTarget.closest('.mv-bgm-disc-wrap'))) {
          const hit = root.querySelector('.mv-bgm-disc-hit');
          try { if (hit) hit.click(); } catch(err) {}
        }
        setTimeout(() => { delete root.dataset.justTap; }, 120);
      }
      setTimeout(() => { delete root.dataset.dragging; dragStartTarget = null; }, 40);
    };
    if (dragTarget) {
      dragTarget.addEventListener('mousedown', onDragStart);
      dragTarget.addEventListener('touchstart', onDragStart, { passive: false });
      W.addEventListener('mousemove', onDragMove, { passive: false });
      W.addEventListener('touchmove', onDragMove, { passive: false });
      W.addEventListener('mouseup', onDragEnd);
      W.addEventListener('touchend', onDragEnd);
      W.addEventListener('touchcancel', onDragEnd);
    }

    const relayoutDock = () => {
      const node = doc.getElementById('meow-voice-bgm-dock');
      if (!node || node.style.display === 'none') return;
      _applyBgmDockPos(node, lsGet(LS.BGM_DOCK_POS, null), false);
      const rect = node.getBoundingClientRect();
      const vp = _bgmDockViewport();
      if (rect.right < 12 || rect.left > vp.w - 12 || rect.bottom < 12 || rect.top > vp.h - 12) {
        _applyBgmDockPos(node, _bgmDockDefaultPos(node), true);
      }
    };
    W.addEventListener('resize', relayoutDock);
    if (W.visualViewport) W.visualViewport.addEventListener('resize', relayoutDock);

    (doc.documentElement || doc.body).appendChild(root);
    return root;
  }

  function _renderBgmDock(cArg) {
    const c = cArg || cfg();
    const root = _getBgmDock();
    if (_bgmState.closed) return;
    const selection = _resolveBgmSelection(c, _bgmState.sourceUrl ? { sourceUrl: _bgmState.sourceUrl, title: _bgmState.title, groupId: _bgmState.groupId, trackId: _bgmState.trackId } : null) || _resolveBgmSelection(c);
    const title = String(_bgmState.title || selection?.title || c.bgmTitle || '背景音乐').trim() || '背景音乐';
    const sub = _bgmState.active
      ? (_bgmState.parsedKind === 'netease_iframe' ? '网易云嵌入播放器' : '播放中')
      : (selection ? '待播放 · ' + ((_bgmState.parsedKind === 'netease_iframe') ? '网易云' : '本地/直链') : '未配置音源');
    root.style.display = selection ? '' : 'none';
    root.classList.toggle('collapsed', !!lsGet(LS.BGM_DOCK_COLLAPSED, true));
    root.classList.toggle('playing', !!_bgmState.active);
    const dockVW = (W.innerWidth || doc.documentElement.clientWidth || 0);
    root.classList.toggle('compact', (dockVW <= 760));
    root.classList.toggle('mini', (dockVW <= 460));
    _applyBgmDockPos(root, lsGet(LS.BGM_DOCK_POS, null), false);
    const rectNow = root.getBoundingClientRect();
    const vpNow = _bgmDockViewport();
    if (rectNow.right < 12 || rectNow.left > vpNow.w - 12 || rectNow.bottom < 12 || rectNow.top > vpNow.h - 12) {
      _applyBgmDockPos(root, _bgmDockDefaultPos(root), true);
    }
    root.querySelector('.mv-bgm-name').textContent = title;
    root.querySelector('.mv-bgm-sub').textContent = sub;
    const playBtn = root.querySelector('.mv-bgm-play');
    if (playBtn) playBtn.textContent = (_bgmState.active || (_bgmAudio && !_bgmAudio.paused)) ? '⏸' : '▶';

    const seek = root.querySelector('.mv-bgm-seek');
    if (seek) {
      if (_bgmAudio && Number.isFinite(_bgmAudio.duration) && _bgmAudio.duration > 0) {
        seek.disabled = false;
        seek.value = String(Math.max(0, Math.min(1000, Math.round((_bgmAudio.currentTime / _bgmAudio.duration) * 1000))));
      } else {
        seek.disabled = true;
        seek.value = '0';
      }
    }

    const lib = _getBgmLibrary();
    const activeGroupId = lsGet(LS.BGM_GROUP, '') || (selection?.groupId || lib[0]?.id || '');
    const groupsWrap = root.querySelector('.mv-bgm-groups');
    if (groupsWrap) {
      groupsWrap.innerHTML = lib.map(g => `<button type="button" class="mv-bgm-group-chip ${g.id===activeGroupId?'active':''}" data-group-id="${_safeAttr(g.id)}">${_safeAttr(g.name)}</button>`).join('');
    }
    const group = _findBgmGroup(lib, activeGroupId);
    const activeTrackId = lsGet(LS.BGM_TRACK, '') || selection?.trackId || '';
    const tracks = _bgmTracksForDisplay(lib, activeGroupId);
    const currentTrack = tracks.find(t => t.id === activeTrackId) || tracks[0] || (selection ? { id: selection.trackId || '', title: selection.title || title, url: selection.url || '' } : null);

    const trackSel = root.querySelector('.mv-bgm-track-select');
    if (trackSel) {
      trackSel.innerHTML = tracks.length
        ? tracks.map(t => `<option value="${_safeAttr(t.id)}" ${t.id===activeTrackId?'selected':''}>${_safeAttr(t.title)}</option>`).join('')
        : '<option value="">点击选择歌曲</option>';
      trackSel.disabled = !tracks.length;
      if (!trackSel.value && tracks[0]) trackSel.value = tracks[0].id;
    }

    const lyricWrap = root.querySelector('.mv-bgm-lyric');
    if (lyricWrap) {
      if (_bgmLyricLines.length) {
        _renderLyricInDock(root);
      } else {
        lyricWrap.innerHTML = '';
      }
    }

    const countWrap = root.querySelector('.mv-bgm-track-count');
    if (countWrap) countWrap.textContent = tracks.length ? `当前分组共 ${tracks.length} 首` : '当前分组暂无歌曲';

    const listWrap = root.querySelector('.mv-bgm-list');
    if (listWrap) listWrap.innerHTML = '';
    const embed = root.querySelector('.mv-bgm-embed');
    if (embed) {
      if (_bgmState.active && _bgmState.parsedKind === 'netease_iframe' && _bgmState.embedSrc) {
        embed.classList.remove('empty');
        // 只有 src 真正变化时才重建 iframe，避免折叠/展开时重载
        const existing = embed.querySelector('iframe');
        const newSrc = _safeAttr(_bgmState.embedSrc);
        if (!existing || existing.getAttribute('src') !== newSrc) {
          embed.innerHTML = `<iframe allow="autoplay *; encrypted-media *" src="${newSrc}"></iframe>`;
        }
      } else {
        embed.classList.add('empty');
        embed.innerHTML = '';
      }
    }
  }

  function _syncBgmDockFromAudio() {
    const root = doc.getElementById('meow-voice-bgm-dock');
    if (!root || _bgmState.closed) return;
    const seek = root.querySelector('.mv-bgm-seek');
    if (seek && _bgmAudio && Number.isFinite(_bgmAudio.duration) && _bgmAudio.duration > 0) {
      seek.disabled = false;
      seek.value = String(Math.max(0, Math.min(1000, Math.round((_bgmAudio.currentTime / _bgmAudio.duration) * 1000))));
    }
    const playBtn = root.querySelector('.mv-bgm-play');
    if (playBtn) playBtn.textContent = (_bgmState.active || (_bgmAudio && !_bgmAudio.paused)) ? '⏸' : '▶';
    root.classList.toggle('playing', !!((_bgmAudio && !_bgmAudio.paused) || _bgmState.active));
    const sub = root.querySelector('.mv-bgm-sub');
    if (sub && _bgmAudio) {
      sub.textContent = _bgmAudio.paused ? '已暂停' : '播放中';
    }
    // 歌词同步
    if (_bgmAudio && _bgmLyricLines.length) {
      const ms = Math.round(_bgmAudio.currentTime * 1000);
      if (_bgmLyricTickMs(ms)) _renderLyricInDock(root);
    }
  }

  function _clearDramaBgmDock(hide) {
    const root = doc.getElementById('meow-voice-bgm-dock');
    _bgmState.active = false;
    _bgmState.parsedKind = '';
    if (_bgmIframeTimer) { clearTimeout(_bgmIframeTimer); clearInterval(_bgmIframeTimer); _bgmIframeTimer = null; }
    _bgmState.embedSrc = '';
    if (!root) return;
    const embed = root.querySelector('.mv-bgm-embed');
    if (embed) { embed.classList.add('empty'); embed.innerHTML = ''; }
    root.classList.remove('playing');
    if (hide) {
      root.style.display = 'none';
      _bgmState.closed = true;
    } else {
      _renderBgmDock();
    }
  }

  async function _setDramaBgmActive(active, cArg, opts) {
    const c = cArg || cfg();
    const o = Object.assign({ preview: false, keepDock: false, sourceUrl: '', title: '', groupId: '', trackId: '', restart: false }, opts || {});
    const selection = _resolveBgmSelection(c, { sourceUrl: o.sourceUrl, title: o.title, groupId: o.groupId, trackId: o.trackId });
    const sourceUrl = selection?.url || c.bgmUrl || '';
    const sourceTitle = selection?.title || c.bgmTitle || '背景音乐';
    const parsed = _parseDramaBgmSource(sourceUrl);

    if (!active || !sourceUrl || (!c.bgmEnabled && !o.preview)) {
      if (_bgmAudio) {
        try { _bgmAudio.pause(); } catch(e) {}
        try { _bgmAudio.src = ''; } catch(e) {}
      }
      if (W._meowBgmAudio) {
        try { W._meowBgmAudio.pause(); } catch(e) {}
      }
      _bgmAudio = null;
      W._meowBgmAudio = null;
      _bgmState.active = false;
      _bgmState.title = sourceTitle;
      _bgmState.sourceUrl = sourceUrl;
      _bgmState.groupId = selection?.groupId || '';
      _bgmState.trackId = selection?.trackId || '';
      _bgmState.parsedKind = parsed.kind || '';
      _bgmState.embedSrc = '';
      if (!o.keepDock && !sourceUrl) _clearDramaBgmDock(true);
      else _clearDramaBgmDock(false);
      return;
    }

    _bgmState.closed = false;
    _bgmState.visible = true;
    _bgmState.title = sourceTitle;
    _bgmState.sourceUrl = sourceUrl;
    _bgmState.groupId = selection?.groupId || '';
    _bgmState.trackId = selection?.trackId || '';
    _bgmState.parsedKind = parsed.kind || '';

    if (selection?.groupId || selection?.trackId) _setBgmSelection(selection?.groupId || '', selection?.trackId || '', sourceTitle, sourceUrl);

    if (parsed.kind === 'audio') {
      _bgmState.embedSrc = '';
      const root = _getBgmDock();
      root.style.display = '';
      const same = _bgmAudio && _bgmAudio.dataset && _bgmAudio.dataset.src === parsed.audioUrl;
      // 切到不同曲目时先停掉旧音频，否则两首同时播
      if (!same && _bgmAudio) {
        try { _bgmAudio.pause(); } catch(e) {}
        try { _bgmAudio.src = ''; } catch(e) {}
        _bgmAudio = null;
        W._meowBgmAudio = null;
      }
      const a = same ? _bgmAudio : new Audio(parsed.audioUrl);
      a.preload = 'auto';
      a.loop = c.bgmLoop !== false;
      a.volume = _clampNum(c.bgmVolume, 0, 1, 0.18);
      a.dataset.src = parsed.audioUrl;
      if (!same) {
        a.addEventListener('timeupdate', _syncBgmDockFromAudio);
        a.addEventListener('play', () => { _bgmState.active = true; _syncBgmDockFromAudio(); _renderBgmDock(); });
        a.addEventListener('pause', () => { _bgmState.active = false; _syncBgmDockFromAudio(); _renderBgmDock(); });
        a.addEventListener('ended', () => { _bgmState.active = false; _syncBgmDockFromAudio(); _renderBgmDock(); });
      }
      _bgmAudio = a;
      W._meowBgmAudio = a;
      // 加载歌词（切歌时重置）
      if (!same) {
        _bgmLyricLines = []; _bgmLyricIdx = -1;
        const gid = selection?.groupId || '';
        const tid = selection?.trackId || '';
        // 先尝试从 track 对象里读缓存 lrc，没有就异步拉
        const lib = _getBgmLibrary();
        const trk = tid ? _findBgmTrack(lib, gid, tid) : null;
        _loadBgmLyric(trk || { url: parsed.audioUrl }).then(() => {
          _bgmLyricIdx = -1;
          _renderLyricInDock(root);
        });
      }
      try {
        if (same && (o.preview || o.restart || a.ended || (Number.isFinite(a.duration) && a.currentTime >= Math.max(0, a.duration - 0.05)))) {
          try { a.currentTime = 0; } catch(e) {}
        }
        if (!same || a.paused || o.preview || o.restart) await a.play();
        _bgmState.active = true;
        _renderBgmDock();
      } catch(err) {
        throw new Error('浏览器阻止了音频自动播放，或该链接不可直接播放');
      }
      return;
    }

    if (parsed.kind === 'netease_iframe') {
      if (_bgmAudio) {
        try { _bgmAudio.pause(); } catch(e) {}
        try { _bgmAudio.src = ''; } catch(e) {}
      }
      _bgmAudio = null;
      W._meowBgmAudio = null;
      // 重置歌词
      _bgmLyricLines = []; _bgmLyricIdx = -1;
      if (_bgmIframeTimer) { clearTimeout(_bgmIframeTimer); clearInterval(_bgmIframeTimer); _bgmIframeTimer = null; }
      const root = _getBgmDock();
      let iframeSrc = parsed.iframeSrc;
      if (o.preview || o.restart) iframeSrc += (iframeSrc.includes('?') ? '&' : '?') + 'mvts=' + Date.now();
      _bgmState.embedSrc = iframeSrc;
      _bgmState.active = true;
      root.style.display = '';
      // 异步拉取歌词供静态展示
      const gid2 = selection?.groupId || '';
      const tid2 = selection?.trackId || '';
      const lib2 = _getBgmLibrary();
      const trk2 = tid2 ? _findBgmTrack(lib2, gid2, tid2) : null;
      const sid2 = parsed.songId || _extractNeteaseId(sourceUrl);
      if (sid2) {
        _loadBgmLyric(trk2 || { url: sourceUrl }).then(() => {
          _bgmLyricIdx = 0;
          _renderLyricInDock(doc.getElementById('meow-voice-bgm-dock'));
          // iframe 模式：用挂钟时间近似同步歌词（从 iframe 加载时刻起）
          if (_bgmIframeTimer) { clearTimeout(_bgmIframeTimer); _bgmIframeTimer = null; }
          // 挂钟同步：elapsed = 从 iframe 加载起经过的毫秒数
          // 歌词行的 ms 也是从歌曲开头起的偏移，直接比较即可
          // iframe 加载 + 网易云缓冲约需 2 秒，歌词计时延迟启动补偿
          const IFRAME_LOAD_DELAY_MS = 3000;
          const _iframeStartWall = Date.now();
          const schedIframeLyric = () => {
            if (!_bgmLyricLines.length) return;
            const elapsedMs = Math.max(0, Date.now() - _iframeStartWall - IFRAME_LOAD_DELAY_MS);
            // 找当前应显示的行（最后一个 ms <= elapsedMs 的行）
            let idx = 0;
            for (let i = 0; i < _bgmLyricLines.length; i++) {
              if (_bgmLyricLines[i].ms <= elapsedMs) idx = i;
              else break;
            }
            if (idx !== _bgmLyricIdx) {
              _bgmLyricIdx = idx;
              _renderLyricInDock(doc.getElementById('meow-voice-bgm-dock'));
            }
            // 精确等到下一行的触发时刻
            const nextIdx = idx + 1;
            if (nextIdx < _bgmLyricLines.length) {
              const waitMs = Math.max(50, _bgmLyricLines[nextIdx].ms - elapsedMs);
              _bgmIframeTimer = setTimeout(schedIframeLyric, waitMs);
            }
          };
          schedIframeLyric();
        });
      }
      _renderBgmDock();
      return;
    }

    if (parsed.kind === 'page') {
      throw new Error('这不是直接音频流。普通歌曲页不能直接当 BGM，用网易云歌曲页请改成 outchain 播放器或直接粘贴歌曲页让系统转换。');
    }

    throw new Error('未识别的音乐链接格式');
  }

  function _getApiProvider(cArg) {
    const p = String((cArg || cfg()).apiProvider || 'openai_compatible').trim();
    return p || 'openai_compatible';
  }

  function _describeApiProvider(cArg) {
    const c = cArg || cfg();
    return _getApiProvider(c) === 'volcengine_v3'
      ? '火山语音 V3'
      : 'OpenAI 兼容';
  }

  function _volcNormalizeEndpoint(rawUrl) {
    const u = String(rawUrl || '').trim();
    if (!u) return 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
    return u;
  }

  function _b64ToUint8(base64) {
    const bin = atob(String(base64 || '').replace(/\s+/g, ''));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function _concatUint8Arrays(chunks) {
    let total = 0;
    chunks.forEach(c => { total += c.length; });
    const out = new Uint8Array(total);
    let offset = 0;
    chunks.forEach(c => {
      out.set(c, offset);
      offset += c.length;
    });
    return out;
  }

  function _parseJsonLine(line) {
    const txt = String(line || '').trim();
    if (!txt) return null;
    if (txt.startsWith('event:')) return null;
    let payload = txt;
    if (payload.startsWith('data:')) payload = payload.slice(5).trim();
    if (!payload || payload === '[DONE]') return null;
    if (payload[0] !== '{') return null;
    try { return JSON.parse(payload); } catch(_) { return null; }
  }

  async function _readVolcStreamToBlob(resp) {
    if (!resp.body) {
      const t = await resp.text();
      throw new Error('火山返回为空：' + String(t || '').slice(0, 200));
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    const audioChunks = [];
    let sawAudio = false;
    let lastErr = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const obj = _parseJsonLine(line);
        if (!obj) continue;
        if (obj.code && obj.code !== 0 && obj.code !== 20000000) {
          lastErr = obj.message || ('火山返回错误 code=' + obj.code);
          continue;
        }
        if (typeof obj.data === 'string' && obj.data) {
          try {
            audioChunks.push(_b64ToUint8(obj.data));
            sawAudio = true;
          } catch(err) {
            lastErr = '音频分片解码失败';
          }
        }
      }
    }

    const tail = decoder.decode();
    if (tail) buffer += tail;
    if (buffer.trim()) {
      const obj = _parseJsonLine(buffer.trim());
      if (obj) {
        if (obj.code && obj.code !== 0 && obj.code !== 20000000) {
          lastErr = obj.message || ('火山返回错误 code=' + obj.code);
        } else if (typeof obj.data === 'string' && obj.data) {
          audioChunks.push(_b64ToUint8(obj.data));
          sawAudio = true;
        }
      }
    }

    if (!sawAudio || !audioChunks.length) {
      throw new Error(lastErr || '火山未返回音频分片');
    }
    const bytes = _concatUint8Arrays(audioChunks);
    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  async function _apiOnceOpenAICompatible(text, voiceId, cArg) {
    const c   = cArg || cfg();
    const url = (c.apiUrl || '').trim();
    if (!url) throw new Error('未填写 API 地址');
    const body = { model: c.apiModel || 'tts-1', input: text };
    const useVoice = (voiceId ?? c.apiVoice ?? '').toString().trim();
    if (useVoice) body.voice = useVoice;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (c.apiKey || ''),
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      let msg = ''; 
      try { msg = await resp.text(); } catch(_) {}
      throw new Error('API ' + resp.status + (msg ? ': ' + msg.slice(0, 200) : ''));
    }
    return resp.blob();
  }

  async function _apiOnceVolcengineV3(text, voiceId, cArg) {
    const c = cArg || cfg();
    const appId      = String(c.volcAppId      || '').trim();
    const accessKey  = String(c.volcAccessKey  || '').trim();
    const resourceId = String(c.volcResourceId || '').trim();
    const speaker    = String(voiceId ?? c.apiVoice ?? '').trim();

    if (!appId)      throw new Error('请填写火山 App ID');
    if (!accessKey)  throw new Error('请填写火山 Access Key（Access Token）');
    if (!resourceId) throw new Error('请填写火山 Resource ID');
    if (!speaker)    throw new Error('请填写火山音色 ID');

    // 通过 ST 本地后端代理转发，绕过浏览器 CORS 限制
    const proxyUrl = '/api/plugins/meow-voice/volc-tts';

    const resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId, accessKey, resourceId, speaker,
        text: String(text || ''),
        audioParams: { format: 'mp3', sample_rate: 24000 },
      }),
    });

    if (!resp.ok) {
      let msg = '';
      try { const j = await resp.json(); msg = j?.error || j?.detail || ''; } catch(_) {
        try { msg = await resp.text(); } catch(_) {}
      }
      throw new Error('火山 V3 ' + resp.status + (msg ? ': ' + String(msg).slice(0, 240) : ''));
    }
    return _readVolcStreamToBlob(resp);
  }


  async function _playApiJobSequence(jobs, opts) {
    const o = Object.assign({ cfg: cfg(), playbackRate: 1, withBgm: false }, opts || {});
    const c = o.cfg || cfg();
    const runGen = ++_apiPlayGen;
    isReading = true;
    updateAllBtns(true);

    if (o.withBgm) {
      try { await _setDramaBgmActive(true, c); }
      catch(err) { toast('BGM 未启用：' + ((err && err.message) || err || '未知错误')); }
    }

    let nextBlobPromise = null;
    try {
      if (!jobs || !jobs.length) return;
      nextBlobPromise = _apiOnce(jobs[0].text, jobs[0].voiceId, c);

      for (let i = 0; i < jobs.length; i++) {
        if (runGen !== _apiPlayGen) break;
        const job = jobs[i];
        const blob = await nextBlobPromise;
        nextBlobPromise = (i + 1 < jobs.length)
          ? _apiOnce(jobs[i + 1].text, jobs[i + 1].voiceId, c)
          : null;

        await new Promise((resolve, reject) => {
          if (runGen !== _apiPlayGen) { resolve(); return; }
          let ended = false;
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          W._meowAudio = audio;
          audio.preload = 'auto';
          audio.playbackRate = _clampNum(o.playbackRate, 0.5, 2, 1);

          const done = (err) => {
            if (ended) return;
            ended = true;
            try { audio.pause(); } catch(e) {}
            try { audio.src = ''; } catch(e) {}
            try { URL.revokeObjectURL(url); } catch(e) {}
            if (W._meowAudio === audio) W._meowAudio = null;
            err ? reject(err) : resolve();
          };

          audio.onended = () => done();
          audio.onerror = () => done(new Error('音频播放失败'));
          try {
            const p = audio.play();
            if (p && typeof p.catch === 'function') p.catch(err => done(err));
          } catch(err) {
            done(err);
          }
        });
      }
    } finally {
      if (runGen === _apiPlayGen) {
        isReading = false;
        updateAllBtns(false);
      }
      if (o.withBgm) {
        try { await _setDramaBgmActive(false, c); } catch(e) {}
      }
    }
  }

  async function _apiOnce(text, voiceId, cArg) {
    const c = Object.assign({}, cfg(), cArg || {});
    const provider = _getApiProvider(c);
    if (provider === 'volcengine_v3') {
      return _apiOnceVolcengineV3(text, voiceId, c);
    }
    return _apiOnceOpenAICompatible(text, voiceId, c);
  }

  // 把长文本按句子切成 ≤400字的块，逐块朗读
  function _splitChunks(text, maxLen) {
    maxLen = maxLen || 400;
    const sentences = text.split(/(?<=[。！？…\n.!?])\s*/);
    const chunks = [];
    let cur = '';
    for (const s of sentences) {
      if (!s.trim()) continue;
      if (cur.length + s.length > maxLen && cur) { chunks.push(cur.trim()); cur = s; }
      else cur += s;
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks.length ? chunks : [text.slice(0, maxLen)];
  }

  // ── 广播剧模式：把文本切成 [{type, speaker, text}] 段落 ──
  function _parseDramaSegments(rawText, charNames, userName, dramaMap) {
    const NARR_BLOCK_OPEN  = '⟪MV_NARR_BLOCK⟫';
    const NARR_BLOCK_CLOSE = '⟪/MV_NARR_BLOCK⟫';
    // 构建 keyword → charName 映射
    const kwMap = {};
    for (const name of charNames) {
      kwMap[name] = name;
      const entry = dramaMap ? dramaMap[name] : null;
      const aliases = typeof entry === 'object' ? (entry?.aliases || '') : '';
      aliases.split(/[,，、\s]+/).forEach(kw => { const k = kw.trim(); if (k) kwMap[k] = name; });
    }
    const kwList = Object.keys(kwMap).sort((a, b) => b.length - a.length);

    // 说话归因动词（允许中间有至多4个修饰字，如"低低地说/轻声道"）
    // ※ "笑" 不在此列表，单独处理复合形式（笑着说/笑道），避免"开玩笑"误判
    const VERBS = '说|道|答|嗯|哼|叹|叫|开口|喊|吼|嘟囔|嘀咕|喃喃|低语|呢喃|问|应|嚷|吩咐|催|劝|提醒|咕哝|咕噜|低声|小声|轻声';
    const LAUGH_SPEAK_RX = /笑[着了]?(?:说|道|答|问|叫|嚷)/;
    function makeKwRx(kw) {
      const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // kw [修饰]{0,4} 动词  或  动词 [修饰]{0,2} kw
      return new RegExp(esc + '[^，。！？\n]{0,4}(?:' + VERBS + ')|(?:' + VERBS + ')[^，。！？\n]{0,2}' + esc);
    }
    // 宾语动词：这些字后紧跟的代词是宾语，不是主语
    const OBJ_CHARS = new Set('逗看让推拉帮揽拍摸牵握扯碰望盯瞥瞧爱恨怕惹撞跟随陪'.split(''));

    // 在 text 中找 说话归因，返回 charName 或 '我' 或 null
    function findSpeechVerb(text) {
      for (const kw of kwList) {
        if (makeKwRx(kw).test(text)) return kwMap[kw];
      }
      // "笑" 复合形式匹配（角色名 + 笑着说）
      for (const kw of kwList) {
        const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(esc + '[^，。！？\n]{0,4}' + LAUGH_SPEAK_RX.source).test(text)) return kwMap[kw];
      }
      if (new RegExp('[我][^，。！？\n]{0,4}(?:' + VERBS + ')|(?:' + VERBS + ')[^，。！？\n]{0,2}[我]').test(text)) {
        // 排除 "我们" 误判：匹配到的 "我" 后紧跟 "们" 时不算说话归因
        const rx我 = new RegExp('[我]([^，。！？\n]{0,4})(?:' + VERBS + ')');
        const m我 = text.match(rx我);
        if (m我) {
          const idx我 = text.indexOf(m我[0]);
          if (idx我 >= 0 && text[idx我 + 1] === '们') return null;
        }
        return userName || '我';
      }
      return null;
    }

    // 代词 "他/她" + 说话动词 → 代指角色
    const PRONOUN_SPEAK_RX = new RegExp('[他她][^，。！？\n]{0,4}(?:' + VERBS + '|' + LAUGH_SPEAK_RX.source + ')|(?:' + VERBS + ')[^，。！？\n]{0,2}[他她]');
    function findPronounSpeech(text) {
      return PRONOUN_SPEAK_RX.test(text);
    }
    // 解析代词角色 → 返回第一个注册的角色名
    function resolvePronounChar() {
      return charNames.length > 0 ? charNames[0] : null;
    }

    // 判断 text 中的 kw 是否是宾语（前一个字是宾语动词）
    function isObject(text, kw) {
      const i = text.indexOf(kw);
      if (i < 0) return false;
      const prevChar = i > 0 ? text[i - 1] : '';
      return OBJ_CHARS.has(prevChar);
    }

    // 🐱 调试日志（排查完毕后可改为 false）
    const _DRAMA_DEBUG = false;

    function detectSpeaker(rawText, qStart, qEnd, dialogueStr, prevSpeaker, interNar) {
      const b8  = rawText.slice(Math.max(0, qStart - 8),  qStart);
      const a8  = rawText.slice(qEnd, Math.min(rawText.length, qEnd + 8));
      const b30 = rawText.slice(Math.max(0, qStart - 30), qStart);
      const a30 = rawText.slice(qEnd, Math.min(rawText.length, qEnd + 30));
      const b60 = rawText.slice(Math.max(0, qStart - 60), qStart);
      const a60 = rawText.slice(qEnd, Math.min(rawText.length, qEnd + 60));

      // 强玩家发言线索：优先级高于“他/她”代词兜底
      const USER_STRONG_RX = /(?:我[^，。！？\n]{0,12}(?:说|问|叫|唤|喊|开口|出声|低声问|轻声问|笑着问|笑着说|半开玩笑地(?:说|问)?|打趣地(?:说|问)?|试探地(?:说|问)?|调侃道)|我叫他的名字|我半开玩笑地[^，。！？\n]{0,8}(?:晃|问|说)|我笑着[^，。！？\n]{0,8}(?:问|说)|我朝[^，。！？\n]{0,8}(?:说|问)|我对[^，。！？\n]{0,8}(?:说|问))/;

      // 玩家主动提问/主动搭话的弱一点线索
      const USER_ACTIVE_RX = /(?:我[^，。！？\n]{0,12}(?:半开玩笑地|笑着|试探地|故意|忍不住|低声|轻声)[^，。！？\n]{0,8}(?:问|说|晃)|我叫他的名字|我问|我说|我朝[^，。！？\n]{0,8}(?:问|说)|我对[^，。！？\n]{0,8}(?:问|说))/;

      // 强角色发言线索：只认“明确开口/应声/打破沉默”这类，不再因为“他递过来”就直接一刀判角色
      const CHAR_STRONG_PRONOUN_RX = /(?:[他她][^，。！？\n]{0,12}(?:说|道|问|答|应|应了?一声|开口|出声|低声|轻声|小声|咕哝|嘀咕|喃喃|打破沉默|接着说|继续道|补了?一句)|[他她]像是鼓起[^，。！？\n]{0,10}勇气[^，。！？\n]{0,8}(?:开口|说道|说|道|打破沉默)?|[他她][^，。！？\n]{0,8}笑[着了]?(?:说|道|问))/;

      // “短句 + 后接角色动作”专用：只给很短的台词用，比如“给。”
      const CHAR_AFTER_ACTION_RX = /^[\s\n—-]*[他她][^，。！？\n]{0,12}(?:递|塞|拿|伸|俯|弯|靠|凑|偏|抬|低|望|看|盯|笑|应|点|摇|走|停|让|把)/;

      // “短句 + 后接玩家动作”专用：比如“阿文。”后面跟“我叫他的名字”
      const USER_AFTER_ACTION_RX = /^[\s\n—-]*我[^，。！？\n]{0,12}(?:叫|问|说|唤|朝|对|看|望|晃|接|伸|抬|低|笑|走|停|跟)/;

      // 贴着引号结束位置的超近距离规则：优先修“阿文。” / “给。”这类短句
      const USER_DIRECT_AFTER_RX = /^[\s\n—-]*我(?:叫他的名字|叫|唤|喊|问|说|开口|出声|低声问|轻声问|笑着问|笑着说|半开玩笑地(?:说|问)?|试探地(?:说|问)?|打趣地(?:说|问)?|调侃道|朝|对)/;
      const CHAR_DIRECT_AFTER_RX = /^[\s\n—-]*[他她][^，。！？\n]{0,12}(?:应了?一声|小声|低声|轻声|咕哝|嘀咕|喃喃|开口|出声|打破沉默|接着说|继续道|补了?一句|像是鼓起[^，。！？\n]{0,10}勇气|递|塞|拿|伸|俯|弯|靠|凑|偏|抬|低|望|看|盯|笑|停|走|把)/;

      // “引号后面是我在反应”——通常表示前一句是角色说的
      const REACT_VERBS = /^[\n\s]*[我][^，。！？\n]{0,3}(?:看|想|站|走|停|愣|怔|转|抬|低|伸|退|回|望|盯|跟|跑|坐|起|笑|皱|叹|吸|呼|点|摇|握|抓|攥)/;

      function logHit(rule, who) {
        if (_DRAMA_DEBUG) console.log('[DRAMA] "' + (dialogueStr || '').slice(0, 15) + '" → ' + who + ' (' + rule + ')');
        return who;
      }

      function lastSentence(text) {
        if (!text) return '';
        const m = text.match(/([^。！？\n]+)[。！？\n]?\s*$/);
        return (m ? m[1] : text).trim();
      }

      function hasNameInDialogue() {
        if (!dialogueStr) return false;
        return kwList.some(kw => kw && dialogueStr.includes(kw));
      }

      // 只要命中“角色名 + 发言动词”，并且不是“我”，就当成角色强线索
      function explicitCharByName(text) {
        const hit = findSpeechVerb(text);
        return hit && hit !== (userName || '我') ? hit : null;
      }

      // ── P0：先吃掉最常见、最容易误判的贴边短句 ──
      if (USER_DIRECT_AFTER_RX.test(a30)) {
        return logHit('P0-紧跟玩家动作', userName || '我');
      }
      if ((dialogueStr && dialogueStr.replace(/\s/g, '').length <= 8) &&
          !/[？?]/.test(dialogueStr || '') &&
          CHAR_DIRECT_AFTER_RX.test(a30) &&
          !USER_DIRECT_AFTER_RX.test(a30)) {
        const rc = resolvePronounChar();
        if (rc) return logHit('P0-紧跟角色动作', rc);
      }

      // ── P1：最近 8 字内的明确归因（最可信）──
      const p1 = findSpeechVerb(b8) || findSpeechVerb(a8);
      if (p1) return logHit('P1', p1);

      // ── P1.1：近处出现“我说/我问/我叫/我叫他的名字/我半开玩笑地...” → 玩家 ──
      if (USER_STRONG_RX.test(b30) || USER_STRONG_RX.test(a30)) {
        return logHit('P1.1-玩家强线索', userName || '我');
      }

      // ── P1.2：近处出现“角色名 + 发言动词” → 角色 ──
      const p1Char = explicitCharByName(b30) || explicitCharByName(a30);
      if (p1Char) return logHit('P1.2-角色名强线索', p1Char);

      // ── P1.3：近处出现“他/她 + 明确发言线索” → 角色
      // 不再因为“他递过来/他看我/他停下脚步”这种纯动作句就直接判角色
      if (CHAR_STRONG_PRONOUN_RX.test(b30) || CHAR_STRONG_PRONOUN_RX.test(a30)) {
        const rc = resolvePronounChar();
        if (rc) return logHit('P1.3-代词强线索', rc);
      }

      // ── P2：两段引号之间的旁白，只看最后一句，避免被远处叙事拖偏 ──
      if (interNar) {
        const nar = lastSentence(interNar);

        if (USER_STRONG_RX.test(nar)) {
          return logHit('P2-旁白玩家', userName || '我');
        }

        const p2 = explicitCharByName(nar) || findSpeechVerb(nar);
        if (p2) return logHit('P2-旁白归因', p2);

        if (CHAR_STRONG_PRONOUN_RX.test(nar) || findPronounSpeech(nar)) {
          const rc = resolvePronounChar();
          if (rc) return logHit('P2-旁白代词', rc);
        }
      }

      // ── P3：短句后面紧跟“我叫他的名字 / 我问 / 我晃了晃...” → 玩家
      // 专门修“阿文。”这种称呼句
      if ((dialogueStr && dialogueStr.replace(/\s/g, '').length <= 6) && USER_STRONG_RX.test(a30)) {
        return logHit('P3-短句后接玩家动作', userName || '我');
      }

      // ── P3.5：问句 / 点名句 + 附近有明显“我在主动搭话” → 玩家
      // 专门修“你不出C的时候...”这类我对他说的话
      if ((/[？?]/.test(dialogueStr || '') || hasNameInDialogue()) &&
          USER_ACTIVE_RX.test(b60 + ' ' + (interNar || '') + ' ' + a60)) {
        return logHit('P3.5-玩家主动提问', userName || '我');
      }

      // ── P4：极短台词 + 后面立刻是“他递过来/他伸手/他看我” → 角色
      // 只给短句用，避免把长问题句误吸到角色上
      if ((dialogueStr && dialogueStr.replace(/\s/g, '').length <= 6) &&
          !/[？?]/.test(dialogueStr || '') &&
          CHAR_AFTER_ACTION_RX.test(a30) &&
          !USER_AFTER_ACTION_RX.test(a30) &&
          !USER_STRONG_RX.test(b30)) {
        const rc = resolvePronounChar();
        if (rc) return logHit('P4-短句后接角色动作', rc);
      }

      // ── P5：before30 里有明确“角色名 + 动词” ──
      const p3 = findSpeechVerb(b30);
      if (p3) return logHit('P5', p3);

      // ── P5.5：近处有“他/她 + 说话动词”才允许代词归因 ──
      if (findPronounSpeech(b8) || findPronounSpeech(a8) || findPronounSpeech(b30) || findPronounSpeech(a30)) {
        const rc = resolvePronounChar();
        if (rc) return logHit('P5.5-代词说话', rc);
      }

      // ── P6：after8 以“我 + 反应动作”开头，通常表示这句是角色说的 ──
      if (REACT_VERBS.test(a8)) {
        // 若台词里直接提到角色名，则更可能是我在对他说
        if (hasNameInDialogue()) return logHit('P6-A', userName || '我');

        // 往前 120 字找更早的主语，维持你原来的兜底逻辑
        const b120 = rawText.slice(Math.max(0, qStart - 120), qStart);
        let first我 = b120.search(/[我]/);
        let firstChar = Infinity, firstCharName = null;
        for (const kw of kwList) {
          let i = 0;
          while (i < b120.length) {
            const idx = b120.indexOf(kw, i);
            if (idx < 0) break;
            if (!isObject(b120.slice(0, idx + kw.length), kw)) {
              if (idx < firstChar) { firstChar = idx; firstCharName = kw; }
              break;
            }
            i = idx + 1;
          }
        }
        if (firstChar < (first我 < 0 ? Infinity : first我)) {
          return logHit('P6-B-char', kwMap[firstCharName]);
        }
        return logHit('P6-B-我', userName || '我');
      }

      // ── P7：before30 有“我”且不是宾语，且没有角色主语 → 玩家 ──
      if (b30.includes('我') && !isObject(b30, '我')) {
        const 我idx = b30.indexOf('我');
        const is我们 = 我idx >= 0 && b30[我idx + 1] === '们';
        if (!is我们) {
          const charInB30 = kwList.some(kw => b30.includes(kw) && !isObject(b30, kw));
          if (!charInB30) return logHit('P7', userName || '我');
        }
      }

      // ── P8：台词自己以“我”开头，且周围没有明确角色归因 → 玩家 ──
      if (dialogueStr && /^[我]/.test(dialogueStr.trim())) {
        const wide = b30 + a30;
        const charVerb = findSpeechVerb(wide);
        if (!charVerb || charVerb === (userName || '我')) {
          return logHit('P8', userName || '我');
        }
      }

      // ── P9：最后才继承上一句，避免一旦判错就串错一整段 ──
      if (prevSpeaker !== undefined) return logHit('P9', prevSpeaker);

      return logHit('无规则命中', null);
    }

    const segments  = [];
    const rx        = /(\u201c[\s\S]*?\u201d|\u300c[\s\S]*?\u300d|\u300e[\s\S]*?\u300f|"[^"]*?")/g;
    const blockRx   = /⟪MV_NARR_BLOCK⟫([\s\S]*?)⟪\/MV_NARR_BLOCK⟫/g;
    let prevQEnd    = 0;
    let prevSpeaker;

    function pushNarration(text) {
      const t = String(text || '').trim();
      if (t) segments.push({ type: 'narration', speaker: null, text: t });
    }

    function parseNormalPiece(piece, baseIdx) {
      if (!piece) return;
      rx.lastIndex = 0;
      let lastIdx = 0;
      let m;
      while ((m = rx.exec(piece)) !== null) {
        const narBefore = piece.slice(lastIdx, m.index).trim();
        if (narBefore) pushNarration(narBefore);

        const globalStart = baseIdx + m.index;
        const globalEnd   = globalStart + m[0].length;
        const interNar    = prevQEnd > 0 ? rawText.slice(prevQEnd, globalStart).trim() : null;
        const dialogueStr = m[0].slice(1, -1).trim();
        const speaker     = detectSpeaker(rawText, globalStart, globalEnd, dialogueStr, prevSpeaker, interNar);
        if (dialogueStr) segments.push({ type: 'dialogue', speaker, text: dialogueStr });

        prevSpeaker = speaker;
        prevQEnd    = globalEnd;
        lastIdx     = m.index + m[0].length;
      }
      const narAfter = piece.slice(lastIdx).trim();
      if (narAfter) pushNarration(narAfter);
    }

    let cursor = 0;
    let bm;
    while ((bm = blockRx.exec(rawText)) !== null) {
      const normal = rawText.slice(cursor, bm.index);
      if (normal) parseNormalPiece(normal, cursor);

      const blockText = (bm[1] || '').trim();
      if (blockText) pushNarration(blockText);

      cursor      = bm.index + bm[0].length;
      prevQEnd    = 0;
      prevSpeaker = undefined;
    }

    const tail = rawText.slice(cursor);
    if (tail) parseNormalPiece(tail, cursor);
    return segments;
  }

  function _dramEntryVoice(entry) { return typeof entry === 'string' ? entry : (entry?.voice || ''); }

  function getDramaCharNames(c) {
    const names = new Set();
    try { getActiveCharNames().forEach(n => { const k = String(n || '').trim(); if (k) names.add(k); }); } catch(e) {}
    try {
      Object.keys(c?.dramaMap || {}).forEach(k => {
        if (k !== '__narration__' && k !== '__user__') {
          const n = String(k || '').trim();
          if (n) names.add(n);
        }
      });
    } catch(e) {}
    return [...names].filter(Boolean);
  }

  function _dramaVoiceFor(seg, c) {
    const dm = c.dramaMap || {};
    if (seg.type === 'narration') return _dramEntryVoice(dm['__narration__']) || c.apiVoice || '';
    if (seg.speaker === (c.userName || '我')) return _dramEntryVoice(dm['__user__']) || c.apiVoice || '';
    if (seg.speaker && dm[seg.speaker]) return _dramEntryVoice(dm[seg.speaker]) || c.apiVoice || '';
    // 归因失败的引号句，宁可走旁白，也不要误落到角色默认音色。
    return _dramEntryVoice(dm['__narration__']) || c.apiVoice || '';
  }

  // 广播剧模式朗读（API）
  async function speakDramaApi(rawText, charNames, dramaMap) {
    const c    = cfg();
    const segs = _parseDramaSegments(rawText, charNames, c.userName, dramaMap || c.dramaMap);
    const jobs = [];
    for (const seg of segs) {
      const voiceId = _dramaVoiceFor(seg, c);
      const chunks  = _splitChunks(seg.text, 400);
      for (const chunk of chunks) {
        jobs.push({ text: chunk, voiceId });
      }
    }
    if (!jobs.length) return;
    await _playApiJobSequence(jobs, {
      cfg: c,
      playbackRate: c.dramaRate || 1,
      withBgm: true,
    });
  }

  async function speakViaApi(text) {
    const c = cfg();
    const jobs = _splitChunks(text).map(chunk => ({ text: chunk, voiceId: c.apiVoice || '' }));
    if (!jobs.length) return;
    await _playApiJobSequence(jobs, {
      cfg: c,
      playbackRate: 1,
      withBgm: false,
    });
  }


  function stopReading() {
    if (_pendingSpeak) { clearTimeout(_pendingSpeak); _pendingSpeak = null; }
    try { synth?.cancel(); } catch(e) {}
    // 中断 API 分段播放
    _apiPlayGen++;   // 让进行中的 speakViaApi 循环检测到版本变化后退出
    if (W._meowAudio) { try { W._meowAudio.pause(); W._meowAudio = null; } catch(e) {} }
    if (W._meowBgmAudio) { try { W._meowBgmAudio.pause(); } catch(e) {} }
    _bgmState.active = false;
    _renderBgmDock();
    isReading = false;
    updateAllBtns(false);
  }

  async function speakText(rawText, charName) {
    if (_pendingSpeak) { clearTimeout(_pendingSpeak); _pendingSpeak = null; }
    try { synth?.cancel(); } catch(e) {}
    try { if (W._meowAudio) { W._meowAudio.pause(); W._meowAudio = null; } } catch(e) {}
    isReading = false;

    const c     = cfg();
    const text  = processText(rawText, c);
    if (!text || text.length < 2) { updateAllBtns(false); return; }

    // 广播剧模式（API）
    if (c.apiEnabled && c.apiUrl && c.dramaMode) {
      const charNames = getDramaCharNames(c);
      try { await speakDramaApi(text, charNames, c.dramaMap); }
      catch(err) { isReading = false; updateAllBtns(false); toast('🔇 广播剧朗读失败：' + (err.message||err)); }
      return;
    }
    // 外接 API 普通模式
    if (c.apiEnabled && c.apiUrl) {
      try { await _playApiJobSequence(_splitChunks(text).map(chunk => ({ text: chunk, voiceId: c.apiVoice || '' })), {
        cfg: c,
        playbackRate: 1,
        withBgm: false,
      }); }
      catch(err) { isReading = false; updateAllBtns(false); toast('🔇 API 朗读失败：' + (err.message||err)); }
      return;
    }

    if (!synth) { toast('🔇 当前环境不支持语音合成，请配置外接 API'); return; }

    const voices   = await getVoices();
    const voiceURI = (charName && c.charMap[charName]) ? c.charMap[charName] : c.defVoice;
    const voice    = voices.find(v => v.voiceURI === voiceURI) || null;

    // ── 外接 API 模式 ──
    if (c.apiEnabled && c.apiUrl && c.apiKey) {
      _speakViaAPI(text, c).catch(() => {
        // API 失败自动回退到本地 TTS
        _speakLocal(text, c, voices, voice);
      });
      return;
    }

    _speakLocal(text, c, voices, voice);
  }

  function _speakLocal(text, c, voices, voice) {
    if (_pendingSpeak) { clearTimeout(_pendingSpeak); _pendingSpeak = null; }
    try { synth.cancel(); } catch(e) {}
    _pendingSpeak = setTimeout(() => {
      _pendingSpeak = null;
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate   = Math.max(0.1, Math.min(10,  +c.rate   || 1.0));
      utter.pitch  = Math.max(0,   Math.min(2,   +c.pitch  || 1.0));
      utter.volume = Math.max(0,   Math.min(1,   +c.volume || 1.0));
      if (voice) utter.voice = voice;
      utter.onstart = () => { isReading = true;  updateAllBtns(true);  };
      utter.onend   = () => { isReading = false; updateAllBtns(false); };
      utter.onerror = (e) => {
        // 忽略 interrupted 错误（cancel 产生的）
        if (e.error === 'interrupted') return;
        isReading = false; updateAllBtns(false);
      };
      try { synth.speak(utter); } catch(err) { updateAllBtns(false); }
    }, 80);
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 4  找视口内最可见的 AI 消息
  // ════════════════════════════════════════════════════════════════════

  function getViewportMessage() {
    // 找所有 AI 消息
    const msgs = Array.from(doc.querySelectorAll(
      '.mes[is_user="false"], .mes_block[is_user="false"], [is_user="false"].mes'
    ));
    if (!msgs.length) return null;

    const vh = doc.documentElement.clientHeight;
    let bestEl = null, bestVis = -1;

    for (const el of msgs) {
      const r = el.getBoundingClientRect();
      // 计算在视口内的可见高度比例
      const top    = Math.max(0, r.top);
      const bottom = Math.min(vh, r.bottom);
      const vis    = Math.max(0, bottom - top);
      if (vis > bestVis) { bestVis = vis; bestEl = el; }
    }
    return bestEl;
  }

  /** 朗读视口内最可见的 AI 消息，用指定 mode 覆盖配置 */
  function speakViewportMessage(overrideMode) {
    const el = getViewportMessage();
    if (!el) { toast('没有找到可朗读的消息'); return; }
    const charName = (el.querySelector('.name_text') || el.querySelector('.ch_name'))?.textContent?.trim() || '';
    const textEl   = el.querySelector('.mes_text');
    const rawText  = textEl ? extractCleanText(textEl) : '';
    if (!rawText.trim()) { toast('消息内容为空'); return; }

    // 临时覆盖 mode（不写 localStorage）
    if (overrideMode) {
      const c     = cfg();
      const saved = c.mode;
      c.mode = overrideMode;
      // 直接用临时 cfg 处理
      _speakWithCfg(rawText, charName, c);
    } else {
      speakText(rawText, charName);
    }
  }

  /** 外接 OpenAI 兼容 TTS API 朗读 */

async function _speakWithCfg(rawText, charName, c) {
    if (_pendingSpeak) { clearTimeout(_pendingSpeak); _pendingSpeak = null; }
    try { synth?.cancel(); } catch(e) {}
    try { if (W._meowAudio) { W._meowAudio.pause(); W._meowAudio = null; } } catch(e) {}
    isReading = false;

    const text = processText(rawText, c);
    if (!text || text.length < 2) { updateAllBtns(false); return; }

    // 广播剧模式（API）
    if (c.apiEnabled && c.apiUrl && c.dramaMode) {
      const charNames = getDramaCharNames(c);
      try { await speakDramaApi(text, charNames, c.dramaMap); }
      catch(err) { isReading = false; updateAllBtns(false); toast('🔇 广播剧朗读失败：' + (err.message||err)); }
      return;
    }
    // 外接 API 普通模式
    if (c.apiEnabled && c.apiUrl) {
      try { await speakViaApi(text); }
      catch(err) { isReading = false; updateAllBtns(false); toast('🔇 API 朗读失败：' + (err.message||err)); }
      return;
    }

    const voices   = await getVoices();
    const voiceURI = (charName && c.charMap[charName]) ? c.charMap[charName] : c.defVoice;
    const voice    = voices.find(v => v.voiceURI === voiceURI) || null;

    _pendingSpeak = setTimeout(() => {
      _pendingSpeak = null;
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate   = Math.max(0.1, Math.min(10,  +c.rate   || 1.0));
      utter.pitch  = Math.max(0,   Math.min(2,   +c.pitch  || 1.0));
      utter.volume = Math.max(0,   Math.min(1,   +c.volume || 1.0));
      if (voice) utter.voice = voice;
      utter.onstart = () => { isReading = true;  updateAllBtns(true);  };
      utter.onend   = () => { isReading = false; updateAllBtns(false); };
      utter.onerror = (e) => { if (e.error === 'interrupted') return; isReading = false; updateAllBtns(false); };
      try { synth.speak(utter); } catch(err) { updateAllBtns(false); }
    }, 80);
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 5  SVG 图标
  // ════════════════════════════════════════════════════════════════════

  const ICON_VOICE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const ICON_STOP  = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  const ICON_VOICE_BIG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

  // ════════════════════════════════════════════════════════════════════
  //  § 6  更新所有按钮状态
  // ════════════════════════════════════════════════════════════════════

  function updateAllBtns(playing) {
    try {
      const b = doc.getElementById(ID.SOLO_BTN);
      if (b) {
        b.querySelector('.mv-ico').innerHTML = playing ? ICON_STOP : ICON_VOICE;
        b.style.background = playing ? 'rgba(220,100,80,.22)' : 'rgba(255,255,255,.18)';
      }
    } catch(e) {}
    try {
      const pb = doc.getElementById(ID.PLAY_BTN);
      if (pb) {
        pb.querySelector('.mv-pbico').innerHTML = playing ? ICON_STOP : ICON_VOICE;
        pb.style.color = playing ? 'rgba(200,80,60,.85)' : 'rgba(46,38,30,.48)';
        pb.title = playing ? '停止朗读' : '朗读当前消息';
      }
    } catch(e) {}
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 7  自动朗读：监听新消息
  //
  //  关键设计：
  //  ① WeakSet 记录已处理节点，彻底防止同一节点重复触发
  //  ② 防抖（debounce）：聊天加载时会批量添加很多历史消息，
  //     只取最后一条处理，避免互相 cancel() 产生噪音
  // ════════════════════════════════════════════════════════════════════

  const _readNodes   = new WeakSet(); // 已处理过的 DOM 节点
  let   _autoTimer   = null;          // 防抖 timer
  let   _pendingNode = null;          // 等待朗读的节点

  function _doAutoRead(node) {
    try {
      if (!node || _readNodes.has(node)) return;
      _readNodes.add(node);

      if (!cfg().enabled) return;

      const isUser = node.getAttribute('is_user') === 'true' || node.classList.contains('user_mes');
      if (isUser && !cfg().readUser) return;

      const charName = (node.querySelector('.name_text') || node.querySelector('.ch_name'))?.textContent?.trim() || '';
      const textEl   = node.querySelector('.mes_text');
      const rawText  = textEl ? extractCleanText(textEl) : '';
      if (!rawText.trim()) return;

      speakText(rawText, charName);
    } catch(e) {}
  }

  function _scheduleAutoRead(node) {
    // 防抖：连续触发时只保留最新节点，800ms 内静止后再朗读
    _pendingNode = node;
    clearTimeout(_autoTimer);
    _autoTimer = setTimeout(() => {
      const n = _pendingNode;
      _pendingNode = null;
      _doAutoRead(n);
    }, 800);
  }

  function bindChatObserver() {
    const root = doc.querySelector('.simplebar-content-wrapper') || doc.querySelector('#chat') || doc.body;
    if (!root) { setTimeout(bindChatObserver, 1000); return; }
    // 冷启动标志：页面加载后 2.5s 内新增的节点都是历史消息，忽略
    let _warm = false;
    setTimeout(() => { _warm = true; }, 2500);
    new MutationObserver(muts => {
      if (!_warm) return;  // 页面初始加载期间静默
      for (const mut of muts) {
        for (const node of mut.addedNodes) {
          if (node?.nodeType !== 1) continue;
          if (node.classList?.contains('mes') || node.hasAttribute?.('mesid')) {
            _scheduleAutoRead(node);
          }
        }
      }
    }).observe(root, { childList: true, subtree: true });
  }

  setTimeout(bindChatObserver, 1200);

  // ════════════════════════════════════════════════════════════════════
  //  § 8  模式选项气泡（播放按钮点击展开）
  // ════════════════════════════════════════════════════════════════════

  function showModePop(anchor) {
    // 关闭已存在的
    closeModePop();

    const pop = doc.createElement('div');
    pop.id = ID.MODE_POP;

    const c = cfg();
    const modes = ['all','dialogue','narration','custom'];

    // 样式
    Object.assign(pop.style, {
      position: 'fixed',
      zIndex: '2147483500',
      background: 'rgba(245,242,237,.92)',
      border: '1px solid rgba(28,24,18,.10)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,.14)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      padding: '6px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: '140px',
    });

    modes.forEach(mode => {
      const row = doc.createElement('button');
      row.type = 'button';
      const isCurrent = c.mode === mode;
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 10px', borderRadius: '8px', border: 'none',
        background: isCurrent ? 'rgba(198,186,164,.35)' : 'transparent',
        color: 'rgba(46,38,30,.82)', fontSize: '13px', fontWeight: isCurrent ? '700' : '500',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'background .12s',
      });
      row.textContent = MODE_LABELS[mode];
      if (isCurrent) {
        const dot = doc.createElement('span');
        dot.textContent = '✓';
        Object.assign(dot.style, { marginLeft:'auto', color:'rgba(139,115,85,.8)', fontSize:'12px' });
        row.appendChild(dot);
      }
      row.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        closeModePop();
        if (mode === 'custom') {
          // 自定义模式直接打开设置弹窗
          openModal();
        } else {
          lsSet(LS.MODE, mode);
          speakViewportMessage(mode);
        }
      });
      row.addEventListener('mouseover', () => { if (!isCurrent) row.style.background = 'rgba(198,186,164,.18)'; });
      row.addEventListener('mouseout',  () => { if (!isCurrent) row.style.background = 'transparent'; });
      pop.appendChild(row);
    });

    // 位置：在 anchor 上方
    doc.body.appendChild(pop);
    const ar = anchor.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    let left = ar.left + ar.width / 2 - pr.width / 2;
    let top  = ar.top - pr.height - 8;
    // 防止超出视口
    left = Math.max(8, Math.min(doc.documentElement.clientWidth - pr.width - 8, left));
    if (top < 8) top = ar.bottom + 8;
    pop.style.left = left + 'px';
    pop.style.top  = top  + 'px';

    // 点外面关闭
    setTimeout(() => {
      doc.addEventListener('click', closeModePop, { once: true, capture: true });
    }, 50);
  }

  function closeModePop() {
    doc.getElementById(ID.MODE_POP)?.remove();
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 9  手动播放按钮（输入框左侧）
  // ════════════════════════════════════════════════════════════════════

  function injectPlayBtn() {
    if (doc.getElementById(ID.PLAY_BTN)) return;

    const candidates = [
      '#send_but_sheld', '#rightSendForm', '#leftSendForm',
      '#sendFormWrapper', '#form_sheld', '.mes_send',
    ];
    let container = null;
    for (const sel of candidates) {
      const el = doc.querySelector(sel);
      if (el) { container = el; break; }
    }
    if (!container) {
      const sendBtn = doc.querySelector('#send_but') || doc.querySelector('[id*="send_but"]');
      if (sendBtn) container = sendBtn.parentElement;
    }
    if (!container) { setTimeout(injectPlayBtn, 2000); return; }

    const wrap = doc.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;flex-shrink:0;position:relative;margin-right:20px;margin-left:6px;';

    const btn = doc.createElement('button');
    btn.id        = ID.PLAY_BTN;
    btn.type      = 'button';
    btn.title     = '朗读当前消息';
    btn.innerHTML = `<span class="mv-pbico">${ICON_VOICE}</span>`;
    Object.assign(btn.style, {
      width: '32px', height: '32px',
      borderRadius: '8px', border: 'none',
      background: 'transparent',
      color: 'rgba(46,38,30,.48)',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'color .15s, background .15s',
      padding: '0', margin: '0 2px',
      flexShrink: '0',
    });

    // 单击：若正在播放则停止，否则直接朗读当前模式
    // 长按（或右键）展开模式选择
    let pressTimer = null;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (isReading) { stopReading(); return; }
      speakViewportMessage();
    });

    // 长按展开选项（移动端友好）
    btn.addEventListener('touchstart', e => {
      pressTimer = setTimeout(() => {
        pressTimer = null;
        showModePop(btn);
      }, 500);
    }, { passive: true });
    btn.addEventListener('touchend', () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });

    // 右键展开选项（桌面端）
    btn.addEventListener('contextmenu', e => {
      e.preventDefault();
      showModePop(btn);
    });

    btn.addEventListener('mouseover', () => { if (!isReading) btn.style.color = 'rgba(46,38,30,.75)'; });
    btn.addEventListener('mouseout',  () => { if (!isReading) btn.style.color = 'rgba(46,38,30,.48)'; });

    // 下拉箭头（展开模式选项）
    const arrow = doc.createElement('button');
    arrow.type = 'button';
    arrow.title = '朗读模式选择';
    arrow.innerHTML = `<svg viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l4 4 4-4"/></svg>`;
    Object.assign(arrow.style, {
      width: '12px', height: '28px',
      border: 'none',
      borderLeft: '1px solid rgba(46,38,30,.12)',
      background: 'transparent',
      color: 'rgba(46,38,30,.32)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 0 0 2px', margin: '0',
      flexShrink: '0',
    });
    arrow.addEventListener('click', e => {
      e.stopPropagation();
      showModePop(btn);
    });

    wrap.appendChild(btn);
    wrap.appendChild(arrow);
    container.insertBefore(wrap, container.firstChild);
  }

  function keepPlayBtn() {
    if (!doc.getElementById(ID.PLAY_BTN)) injectPlayBtn();
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 10  私有 CSS
  // ════════════════════════════════════════════════════════════════════

  function injectCSS() {
    const sid = 'meow-voice-style-v1';
    if (doc.getElementById(sid)) return;
    const s = doc.createElement('style');
    s.id = sid;
    s.textContent = `
#${ID.SOLO_BTN}{
  position:fixed; width:40px; height:40px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.20);
  box-shadow:0 10px 26px rgba(0,0,0,.25); z-index:2147483399;
  user-select:none; touch-action:none; -webkit-tap-highlight-color:transparent;
  cursor:pointer; color:rgba(46,38,30,.78); transition:background .15s;
}
#${ID.SOLO_BTN} .mv-ico{ display:flex; align-items:center; justify-content:center; }
#${ID.MASK}{
  position:fixed; inset:0; z-index:2147483300; background:rgba(0,0,0,.07);
}
#${ID.MODAL}{
  position:fixed;
  inset:max(10px,env(safe-area-inset-top,0px)) 10px
        max(10px,env(safe-area-inset-bottom,0px)) 10px;
  height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 20px);
  overflow:auto; -webkit-overflow-scrolling:touch;
  background:var(--meow-bg-strong,rgba(245,242,237,.92));
  border:1px solid var(--meow-line,rgba(28,24,18,.12));
  border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.14);
  z-index:2147483400;
  backdrop-filter:blur(18px) saturate(1.1); -webkit-backdrop-filter:blur(18px) saturate(1.1);
  color:var(--meow-text,rgba(46,38,30,.82));
}
#${ID.MODAL} .mv-hd{
  position:sticky; top:0; z-index:2;
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 14px 12px;
  background:var(--meow-bg-strong,rgba(245,242,237,.94));
  border-bottom:1px solid var(--meow-line,rgba(28,24,18,.1));
}
#${ID.MODAL} .mv-title{
  font-size:16px; font-weight:900; color:var(--meow-text,rgba(46,38,30,.82));
  display:flex; align-items:center; gap:8px;
}
#${ID.MODAL} .mv-close{
  width:34px; height:34px; border-radius:10px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  background:var(--meow-card,rgba(255,255,255,.58));
  border:1px solid var(--meow-line,rgba(28,24,18,.12));
  color:var(--meow-text,rgba(46,38,30,.6)); font-size:16px; font-weight:600;
}
#${ID.MODAL} .mv-body{ padding:12px; }
#${ID.MODAL} .mv-sec{
  background:var(--meow-card,rgba(255,255,255,.42));
  border:1px solid var(--meow-line,rgba(28,24,18,.08));
  border-radius:14px; padding:12px 14px; margin-bottom:10px;
}
#${ID.MODAL} .mv-sec h3{
  font-size:13px; font-weight:700; color:var(--meow-text,rgba(46,38,30,.82));
  margin:0 0 10px; display:flex; align-items:center; gap:6px;
}
#${ID.MODAL} .mv-row{ display:flex; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap; }
#${ID.MODAL} .mv-lbl{ font-size:12px; color:var(--meow-text,rgba(46,38,30,.82)); min-width:60px; }
#${ID.MODAL} .mv-val{ font-size:12px; color:rgba(46,38,30,.45); min-width:34px; text-align:right; }
#${ID.MODAL} input[type=range]{ flex:1; min-width:80px; accent-color:var(--meow-accent,#8b7355); }
#${ID.MODAL} select, #${ID.MODAL} input[type=text]{
  background:var(--meow-bg-strong,rgba(255,255,255,.72));
  border:1px solid var(--meow-line,rgba(28,24,18,.12));
  border-radius:10px; padding:8px 10px; font-size:13px;
  color:var(--meow-text,rgba(46,38,30,.82)); outline:none; width:100%; box-sizing:border-box;
}
#${ID.MODAL} .mv-toggle{ display:flex; align-items:center; justify-content:space-between; padding:6px 0; cursor:pointer; }
#${ID.MODAL} .mv-toggle > span{ font-size:13px; color:var(--meow-text,rgba(46,38,30,.82)); }
#${ID.MODAL} .mv-sw{ position:relative; width:42px; height:24px; flex-shrink:0; }
#${ID.MODAL} .mv-sw input{ opacity:0; width:0; height:0; position:absolute; }
#${ID.MODAL} .mv-slider{
  position:absolute; inset:0; border-radius:12px;
  background:rgba(28,24,18,.15); cursor:pointer; transition:background .2s;
}
#${ID.MODAL} .mv-slider::before{
  content:''; position:absolute; width:18px; height:18px; left:3px; top:3px;
  border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2); transition:transform .2s;
}
#${ID.MODAL} .mv-sw input:checked + .mv-slider{ background:var(--meow-accent,#8b7355); }
#${ID.MODAL} .mv-sw input:checked + .mv-slider::before{ transform:translateX(18px); }
#${ID.MODAL} .mv-mode-grid{ display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:6px; }
#${ID.MODAL} .mv-mode-card{
  border:1px solid var(--meow-line,rgba(28,24,18,.1)); border-radius:10px; padding:9px 10px;
  cursor:pointer; font-size:12px; text-align:center;
  background:var(--meow-bg-strong,rgba(255,255,255,.5));
  color:var(--meow-text,rgba(46,38,30,.82)); transition:all .15s; user-select:none; line-height:1.5;
}
#${ID.MODAL} .mv-mode-card.active{
  border-color:var(--meow-accent,#8b7355) !important;
  background:rgba(139,115,85,.12) !important; font-weight:700;
}
#${ID.MODAL} .mv-btn{
  padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600;
  border:1px solid var(--meow-line,rgba(28,24,18,.1));
  background:var(--meow-card,rgba(255,255,255,.5));
  color:var(--meow-text,rgba(46,38,30,.82)); cursor:pointer; white-space:nowrap; transition:opacity .15s;
}
#${ID.MODAL} .mv-btn.primary{ background:var(--meow-accent,#8b7355); color:#fff; border-color:transparent; }
#${ID.MODAL} .mv-btn:active{ opacity:.72; }
#${ID.MODAL} .mv-hint{ font-size:11px; color:rgba(46,38,30,.45); margin-top:4px; line-height:1.5; }
#${ID.MODAL} .mv-test-bar{ display:flex; gap:8px; margin-top:8px; }
#${ID.MODAL} .mv-test-bar input{ flex:1; }
#${ID.MODAL} .mv-footer{ display:flex; gap:8px; padding:4px 0 8px; }
`;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 11  设置弹窗
  // ════════════════════════════════════════════════════════════════════

  function _ensureBgmEditorState(box) {
    if (!box) return { groupId: '', trackId: '' };
    const lib = _getBgmLibrary();
    const fallbackGroupId = String(lsGet(LS.BGM_GROUP, '') || (lib[0]?.id || ''));
    const state = box.__mvBgmState || { groupId: fallbackGroupId, trackId: String(lsGet(LS.BGM_TRACK, '') || '') };
    let groupId = String(state.groupId || fallbackGroupId || (lib[0]?.id || ''));
    let group = _findBgmGroup(lib, groupId);
    if (!group && lib[0]) {
      groupId = lib[0].id;
      group = lib[0];
    }
    let trackId = String(state.trackId || '');
    const tracks = _bgmTrackList(group);
    if (trackId && !tracks.some(t => String(t?.id || '') === trackId)) trackId = '';
    box.__mvBgmState = { groupId, trackId };
    return box.__mvBgmState;
  }

  function _setBgmEditorSelection(box, groupId, trackId, syncFields) {
    if (!box) return null;
    const q = id => box.querySelector('#' + id);
    const lib = _getBgmLibrary();
    const state = _ensureBgmEditorState(box);
    state.groupId = String(groupId || state.groupId || (lib[0]?.id || ''));
    let group = _findBgmGroup(lib, state.groupId);
    if (!group && lib[0]) {
      state.groupId = lib[0].id;
      group = lib[0];
    }
    const tracks = _bgmTrackList(group);
    state.trackId = String(trackId || '');
    if (state.trackId && !tracks.some(t => String(t?.id || '') === state.trackId)) state.trackId = '';
    box.__mvBgmState = state;
    if (syncFields) {
      const track = state.trackId ? _findBgmTrack(lib, state.groupId, state.trackId) : null;
      if (track) {
        if (q('mvBgmTitle')) q('mvBgmTitle').value = track.title || '';
        if (q('mvBgmUrl')) q('mvBgmUrl').value = track.url || '';
      }
    }
    return state;
  }

  function _renderBgmLibraryEditor(box) {
    if (!box) return;
    const q = id => box.querySelector('#' + id);
    // 始终从缓存读最新数据
    const lib = _getBgmLibrary();
    const state = _ensureBgmEditorState(box);
    const activeGid = String(state.groupId || (lib[0]?.id || ''));
    const activeTid = String(state.trackId || '');

    // 填充「添加到分组」下拉
    const addSel = q('mvBgmAddToGroup');
    if (addSel) {
      const prev = addSel.value || activeGid;
      addSel.innerHTML = lib.map(g =>
        `<option value="${escAttr(g.id)}"${g.id===prev?' selected':''}>${esc(g.name)}（${_bgmTrackList(g).length} 首）</option>`
      ).join('');
      if (!addSel.value && lib[0]) addSel.value = lib[0].id;
    }

    // 渲染所有分组 + 曲目，每曲带 [选用] [▶] [✕]
    const listEl = q('mvBgmLibraryList');
    if (!listEl) return;
    if (!lib.length) {
      listEl.innerHTML = '<div class="mv-hint" style="font-size:11px;padding:4px">暂无分组，先新建一个分组吧。</div>';
      return;
    }
    const renamingGid = box.__mvBgmRename?.gid || '';
    const renamingTid = box.__mvBgmRename?.tid || '';
    let html = '';
    for (const g of lib) {
      const tracks = _bgmTrackList(g);
      html += `<div style="margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:rgba(46,38,30,.55);padding:2px 2px 5px">${esc(g.name)} <span style="font-weight:400">${tracks.length} 首</span></div>`;
      if (!tracks.length) {
        html += `<div style="font-size:11px;color:rgba(46,38,30,.38);padding:4px 4px">暂无歌曲，在上方填入链接点「加入」</div>`;
      } else {
        for (const t of tracks) {
          const active  = g.id === activeGid && t.id === activeTid;
          const renaming = g.id === renamingGid && t.id === renamingTid;
          if (renaming) {
            html += `<div data-gid="${escAttr(g.id)}" data-tid="${escAttr(t.id)}"
              style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:9px;margin-bottom:4px;
              background:rgba(139,115,85,.10);border:1px solid rgba(139,115,85,.28)">
              <input type="text" class="mv-bgm-rename-input" data-gid="${escAttr(g.id)}" data-tid="${escAttr(t.id)}"
                value="${escAttr(t.title)}"
                style="flex:1;font-size:12px;font-weight:600;padding:4px 8px;border-radius:7px;
                border:1px solid rgba(139,115,85,.35);background:rgba(255,255,255,.9);outline:none;min-width:0">
              <button type="button" class="mv-btn mv-bgm-rename-ok" data-gid="${escAttr(g.id)}" data-tid="${escAttr(t.id)}"
                style="font-size:11px;padding:3px 10px;background:rgba(60,80,70,.85);color:#fff;border-color:transparent">✓</button>
              <button type="button" class="mv-btn mv-bgm-rename-cancel"
                style="font-size:11px;padding:3px 8px">✕</button>
            </div>`;
          } else {
            html += `<div data-gid="${escAttr(g.id)}" data-tid="${escAttr(t.id)}"
              style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:9px;margin-bottom:4px;
              background:${active?'rgba(17,65,74,.10)':'rgba(255,255,255,.6)'};
              border:1px solid ${active?'rgba(17,65,74,.15)':'rgba(28,24,18,.06)'}">
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title) || '<span style="opacity:.45;font-weight:400">（无标题）</span>'}</div>
                <div style="font-size:10px;color:rgba(90,70,50,.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.url)}</div>
              </div>
              <div style="display:flex;gap:4px;flex:none">
                <button type="button" class="mv-btn mv-bgm-use" data-gid="${escAttr(g.id)}" data-tid="${escAttr(t.id)}"
                  style="font-size:11px;padding:3px 8px;${active?'font-weight:700':''}">选用</button>
                <button type="button" class="mv-btn mv-bgm-play" data-gid="${escAttr(g.id)}" data-tid="${escAttr(t.id)}"
                  style="font-size:11px;padding:3px 8px">▶</button>
                <button type="button" class="mv-btn mv-bgm-rename" data-gid="${escAttr(g.id)}" data-tid="${escAttr(t.id)}"
                  style="font-size:11px;padding:3px 8px" title="改名">✎</button>
                <button type="button" class="mv-btn mv-bgm-del" data-gid="${escAttr(g.id)}" data-tid="${escAttr(t.id)}"
                  style="font-size:11px;padding:3px 8px;color:rgba(160,55,55,.8)">✕</button>
              </div>
            </div>`;
          }
        }
      }
      html += '</div>';
    }
    listEl.innerHTML = html;
    // 改名模式时聚焦输入框
    if (renamingTid) {
      const inp = listEl.querySelector('.mv-bgm-rename-input');
      if (inp) { try { inp.focus(); inp.select(); } catch(_) {} }
    }
  }

  function openModal() {
    injectCSS();
    doc.getElementById(ID.MODAL)?.remove();
    closeModePop();
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

    function voiceOpts(sel) {
      const zh    = voices.filter(v => /zh|cmn|cantonese/i.test(v.lang));
      const other = voices.filter(v => !/zh|cmn|cantonese/i.test(v.lang));
      let h = `<option value="">系统默认</option>`;
      if (zh.length)    h += `<optgroup label="── 中文 ──">${zh.map(v    => `<option value="${escAttr(v.voiceURI)}" ${v.voiceURI===sel?'selected':''}>${esc(v.name)} (${v.lang})</option>`).join('')}</optgroup>`;
      if (other.length) h += `<optgroup label="── 其他 ──">${other.map(v => `<option value="${escAttr(v.voiceURI)}" ${v.voiceURI===sel?'selected':''}>${esc(v.name)} (${v.lang})</option>`).join('')}</optgroup>`;
      return h;
    }
    // dramaMap[name] 结构：{ voice: string, aliases: string } 或旧版 string
    function _dmVoice(entry) { return typeof entry === 'string' ? entry : (entry?.voice || ''); }
    function _dmAliases(entry) { return typeof entry === 'string' ? '' : (entry?.aliases || ''); }

    function dramaCharRows(dramaMap, names) {
      if (!names.length) return '<p class="mv-hint" style="margin:4px 0">暂无 AI 角色，开始对话后会自动检测</p>';
      return names.map(name => {
        const entry = dramaMap[name] || {};
        return `
        <div style="background:rgba(240,236,228,.35);border-radius:8px;padding:8px 10px;margin-bottom:8px">
          <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:var(--meow-text,rgba(46,38,30,.85))">${esc(name)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div>
              <label style="font-size:11px;opacity:.6;display:block;margin-bottom:2px">音色 ID</label>
              <input type="text" data-drama-char="${escAttr(name)}" data-drama-field="voice" class="mv-drama-char-voice"
                placeholder="留空用默认"
                value="${esc(_dmVoice(entry))}">
            </div>
            <div>
              <label style="font-size:11px;opacity:.6;display:block;margin-bottom:2px">触发关键词 <span style="opacity:.55">（逗号分隔，如：他,秦彻,阿文）</span></label>
              <input type="text" data-drama-char="${escAttr(name)}" data-drama-field="aliases" class="mv-drama-char-aliases"
                placeholder="例：他,秦彻,阿文"
                value="${esc(_dmAliases(entry))}">
            </div>
          </div>
        </div>`;
      }).join('');
    }

    function charRows(names, map) {
      if (!names.length) return '<p class="mv-hint" style="margin:6px 0">暂无角色，对话开始后会自动检测</p>';
      return names.map(name => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;min-width:80px;color:var(--meow-text,rgba(46,38,30,.82))">${esc(name)}</span>
          <select data-char="${escAttr(name)}" class="mv-char-sel" style="flex:1;min-width:160px">${voiceOpts(map[name]||'')}</select>
        </div>`).join('');
    }

    const box = doc.createElement('div');
    box.id = ID.MODAL;
    box.innerHTML = `
      <div class="mv-hd">
        <div class="mv-title">${ICON_VOICE_BIG}<span>语音朗读</span></div>
        <div class="mv-close">✕</div>
      </div>
      <div class="mv-body">
        <div class="mv-sec">
          <h3>⚡ 自动朗读</h3>
          <label class="mv-toggle"><span>收到 AI 回复后自动朗读</span>
            <div class="mv-sw"><input type="checkbox" id="mvAutoRead" ${c.enabled?'checked':''}><div class="mv-slider"></div></div>
          </label>
          <label class="mv-toggle" style="margin-top:4px"><span>同时朗读用户发言</span>
            <div class="mv-sw"><input type="checkbox" id="mvReadUser" ${c.readUser?'checked':''}><div class="mv-slider"></div></div>
          </label>
        </div>
        <div class="mv-sec">
          <h3>📖 朗读范围</h3>
          <div class="mv-mode-grid" id="mvModeGrid">
            <div class="mv-mode-card ${c.mode==='all'?'active':''}" data-mode="all">📄 全部文本<br><span style="font-size:10px;opacity:.6">完整朗读</span></div>
            <div class="mv-mode-card ${c.mode==='dialogue'?'active':''}" data-mode="dialogue">💬 仅对话<br><span style="font-size:10px;opacity:.6">引号内内容</span></div>
            <div class="mv-mode-card ${c.mode==='narration'?'active':''}" data-mode="narration">📝 仅旁白<br><span style="font-size:10px;opacity:.6">引号外内容</span></div>
            <div class="mv-mode-card ${c.mode==='custom'?'active':''}" data-mode="custom">✂️ 自定义<br><span style="font-size:10px;opacity:.6">正则过滤</span></div>
          </div>
          <div id="mvCustomWrap" style="margin-top:8px;${c.mode!=='custom'?'display:none':''}">
            <label style="font-size:12px;color:var(--meow-text,rgba(46,38,30,.82));display:block;margin-bottom:4px">跳过匹配正则的内容：</label>
            <input type="text" id="mvSkipPattern" placeholder="例：\\([^)]*\\)" value="${esc(c.skipPattern||'')}">
          </div>
          <div style="margin-top:10px">
            <label class="mv-toggle"><span style="font-size:12px">跳过 *斜体动作描述*</span>
              <div class="mv-sw"><input type="checkbox" id="mvSkipStar" ${c.skipStar?'checked':''}><div class="mv-slider"></div></div>
            </label>
            <label class="mv-toggle" style="margin-top:4px"><span style="font-size:12px">跳过 【系统提示/注释】</span>
              <div class="mv-sw"><input type="checkbox" id="mvSkipBracket" ${c.skipBracket?'checked':''}><div class="mv-slider"></div></div>
            </label>
          </div>
        </div>
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
            <span class="mv-val" id="mvVolumeVal">${Math.round(c.volume*100)}%</span>
          </div>
          <label style="font-size:12px;color:var(--meow-text,rgba(46,38,30,.82));display:block;margin-bottom:4px">默认音色</label>
          <select id="mvDefVoice">${voiceOpts(c.defVoice)}</select>
          <div class="mv-test-bar">
            <input type="text" id="mvTestTxt" placeholder="输入试听文本…" value="你好，这是语音朗读测试。">
            <button class="mv-btn primary" id="mvTestBtn">▶ 试听</button>
            <button class="mv-btn" id="mvStopBtn">■ 停</button>
          </div>
        </div>
        <div class="mv-sec">
          <h3>🎭 角色专属音色</h3>
          <p class="mv-hint" style="margin-bottom:8px">为不同角色分配专属音色，朗读时自动切换</p>
          <div id="mvCharList">${charRows(charNames, c.charMap)}</div>
          <button class="mv-btn" id="mvRefreshChars" style="margin-top:6px;font-size:12px">↻ 刷新角色列表</button>
        </div>
        <div class="mv-sec" id="mvApiSec">
          <h3>🔌 外接语音 API</h3>
          <p class="mv-hint" style="margin-bottom:8px">保留 OpenAI 兼容接口，同时新增火山语音 V3。播放器、广播剧和 BGM 不用改，只切换外接适配器。</p>
          <label class="mv-toggle" style="margin-bottom:8px">
            <span>启用外接 API</span>
            <div class="mv-sw"><input type="checkbox" id="mvApiEnabled" ${c.apiEnabled?'checked':''}><div class="mv-slider"></div></div>
          </label>
          <div id="mvApiFields" style="${!c.apiEnabled?'display:none':''}">
            <div style="margin-bottom:8px">
              <label style="font-size:12px;display:block;margin-bottom:4px">提供商</label>
              <select id="mvApiProvider">
                <option value="openai_compatible" ${c.apiProvider==='openai_compatible'?'selected':''}>OpenAI 兼容</option>
                <option value="volcengine_v3" ${c.apiProvider==='volcengine_v3'?'selected':''}>火山语音 V3</option>
              </select>
            </div>
            <div style="margin-bottom:8px${c.apiProvider==='volcengine_v3'?';display:none':''}">
              <label style="font-size:12px;display:block;margin-bottom:4px">API 地址（完整 endpoint）</label>
              <input type="text" id="mvApiUrl" placeholder="https://api.volink.org/v1/audio/speech" value="${esc(c.apiUrl)}">
            </div>
            <div id="mvOpenAIFields" style="${c.apiProvider==='volcengine_v3'?'display:none':''}">
              <div style="margin-bottom:8px">
                <label style="font-size:12px;display:block;margin-bottom:4px">API Key</label>
                <div style="display:flex;gap:6px">
                  <input type="password" id="mvApiKey" placeholder="sk-..." value="${esc(c.apiKey)}" style="flex:1">
                  <button type="button" class="mv-btn" id="mvApiKeyToggle" style="padding:6px 10px;font-size:11px">显示</button>
                </div>
              </div>
            </div>
            <div id="mvVolcFields" style="${c.apiProvider==='volcengine_v3'?'':'display:none'}">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
                <div>
                  <label style="font-size:12px;display:block;margin-bottom:4px">App ID</label>
                  <input type="text" id="mvVolcAppId" placeholder="控制台里的 App ID" value="${esc(c.volcAppId)}">
                </div>
                <div>
                  <label style="font-size:12px;display:block;margin-bottom:4px">Access Key</label>
                  <div style="display:flex;gap:6px">
                    <input type="password" id="mvVolcAccessKey" placeholder="控制台里的 Access Token" value="${esc(c.volcAccessKey)}" style="flex:1">
                    <button type="button" class="mv-btn" id="mvVolcAccessToggle" style="padding:6px 10px;font-size:11px">显示</button>
                  </div>
                </div>
              </div>
              <div style="margin-bottom:8px">
                <label style="font-size:12px;display:block;margin-bottom:4px">Resource ID</label>
                <input type="text" id="mvVolcResourceId" placeholder="seed-tts-2.0" value="${esc(c.volcResourceId || 'seed-tts-2.0')}">
                <div class="mv-hint" style="margin-top:4px">常用值：seed-tts-2.0 / seed-tts-1.0。要和音色所属模型对应。</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div>
                <label style="font-size:12px;display:block;margin-bottom:4px">模型 / 备注</label>
                <input type="text" id="mvApiModel" placeholder="${c.apiProvider==='volcengine_v3'?'火山分支不强依赖此项，可留 tts-1':'tts-1'}" value="${esc(c.apiModel)}">
              </div>
              <div>
                <label style="font-size:12px;display:block;margin-bottom:4px">
                  音色 ID
                  <button type="button" id="mvApiFetchVoices" style="margin-left:6px;font-size:10px;padding:2px 7px;border-radius:5px;border:1px solid rgba(28,24,18,.15);background:transparent;cursor:pointer">获取列表</button>
                </label>
                <input type="text" id="mvApiVoice" placeholder="${c.apiProvider==='volcengine_v3'?'如：zh_female_cancan_moon_bigtts':'alloy（留空用默认）'}" value="${esc(c.apiVoice)}">
                <select id="mvApiVoiceSel" style="display:none;width:100%;margin-top:4px"><option value="">— 选择音色 —</option></select>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <input type="text" id="mvApiTestTxt" placeholder="测试文本…" value="你好，这是朗读测试。" style="flex:1;min-width:100px">
              <button type="button" class="mv-btn primary" id="mvApiTest" style="font-size:12px">▶ 测试</button>
            </div>
            <p id="mvApiHint" style="margin-top:6px;font-size:11px;color:rgba(120,100,70,.8);min-height:16px"></p>
          </div>
        </div>
        <div class="mv-sec" id="mvDramaSec">
          <h3>🎙 广播剧模式</h3>
          <p class="mv-hint" style="margin-bottom:8px">启用后根据说话者自动切换音色；需配合外接 API 使用</p>
          <label class="mv-toggle" style="margin-bottom:10px">
            <span>启用广播剧模式</span>
            <div class="mv-sw"><input type="checkbox" id="mvDramaEnabled" ${c.dramaMode?'checked':''}><div class="mv-slider"></div></div>
          </label>
          <div id="mvDramaFields" style="${!c.dramaMode?'display:none':''}">
            <div style="margin-bottom:10px">
              <label style="font-size:12px;display:block;margin-bottom:4px">玩家角色称呼（判断"我"的发言）</label>
              <input type="text" id="mvUserName" placeholder="我" value="${esc(c.userName||'我')}" style="max-width:200px">
            </div>
            <div style="margin-bottom:6px">
              <label style="font-size:12px;font-weight:600">旁白音色</label>
              <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
                <input type="text" id="mvNarratorVoice" placeholder="留空用默认" value="${esc((c.dramaMap||{}).__narration__||'')}" style="flex:1">
              </div>
            </div>
            <div style="margin-bottom:6px">
              <label style="font-size:12px;font-weight:600">玩家音色</label>
              <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
                <input type="text" id="mvUserVoice" placeholder="留空用默认" value="${esc((c.dramaMap||{}).__user__||'')}" style="flex:1">
              </div>
            </div>
            <div style="margin:10px 0 12px">
              <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">广播剧整体语速</label>
              <div style="display:flex;gap:10px;align-items:center">
                <input type="range" id="mvDramaRate" min="0.7" max="1.5" step="0.05" value="${Number(c.dramaRate||1).toFixed(2)}" style="flex:1">
                <span class="mv-val" id="mvDramaRateVal">${Number(c.dramaRate||1).toFixed(2)}x</span>
              </div>
              <div class="mv-hint" style="margin-top:4px;font-size:11px">仅作用于广播剧 API 播放阶段</div>
            </div>
            <div id="mvDramaCharList" style="margin-top:8px">
              ${dramaCharRows(c.dramaMap||{}, getActiveCharNames())}
            </div>
            <button type="button" class="mv-btn" id="mvDramaRefresh" style="margin-top:6px;font-size:12px">↺ 刷新角色列表</button>
            <div style="margin:14px 0 0;padding:12px;border:1px solid rgba(28,24,18,.08);border-radius:14px;background:rgba(255,255,255,.38)">
              <div style="font-size:12px;font-weight:700;margin-bottom:8px">背景音乐</div>
              <label class="mv-toggle" style="margin-bottom:8px">
                <span>启用背景音乐</span>
                <div class="mv-sw"><input type="checkbox" id="mvBgmEnabled" ${c.bgmEnabled?'checked':''}><div class="mv-slider"></div></div>
              </label>
              <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
                <span style="font-size:12px;min-width:28px">音量</span>
                <input type="range" id="mvBgmVolume" min="0" max="1" step="0.01" value="${_clampNum(c.bgmVolume,0,1,0.18)}" style="flex:1">
                <span class="mv-val" id="mvBgmVolumeVal">${Math.round(_clampNum(c.bgmVolume,0,1,0.18)*100)}%</span>
              </div>
              <label class="mv-toggle" style="margin-bottom:10px">
                <span>循环播放</span>
                <div class="mv-sw"><input type="checkbox" id="mvBgmLoop" ${c.bgmLoop!==false?'checked':''}><div class="mv-slider"></div></div>
              </label>
              <div style="margin-bottom:10px">
                <label style="font-size:11px;font-weight:600;color:rgba(46,38,30,.55);display:block;margin-bottom:4px">🌐 音乐代理地址（解决搜索/歌词 CORS）</label>
                <input type="text" id="mvBgmProxy" placeholder="留空则直连 lrclib（仅歌词）；填入 Worker 地址后可搜歌+获取直链" value="${esc(c.bgmProxy||'')}" style="font-size:11px">
                <div class="mv-hint" style="margin-top:3px">部署教程：见下方「如何部署代理」</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">
                <input type="text" id="mvBgmNewGroup" placeholder="新分组名（如：暧昧 / 夜路）" style="flex:1">
                <button type="button" class="mv-btn" id="mvBgmAddGroup" style="font-size:12px;white-space:nowrap">＋ 新建分组</button>
              </div>
              <div style="background:rgba(139,115,85,.07);border:1px solid rgba(139,115,85,.18);border-radius:12px;padding:10px;margin-bottom:10px">
                <div style="font-size:11px;font-weight:600;color:rgba(46,38,30,.55);margin-bottom:7px">添加歌曲</div>
                <select id="mvBgmAddToGroup" style="margin-bottom:6px"></select>

                <!-- 搜歌区 -->
                <div style="display:flex;gap:6px;margin-bottom:6px">
                  <input type="text" id="mvBgmSearch" placeholder="搜索歌名 / 歌手…" style="flex:1">
                  <button type="button" class="mv-btn" id="mvBgmSearchBtn" style="font-size:12px;white-space:nowrap">🔍 搜索</button>
                </div>
                <div id="mvBgmSearchResults" style="display:none;max-height:180px;overflow-y:auto;border:1px solid rgba(139,115,85,.22);border-radius:9px;background:rgba(255,255,255,.82);margin-bottom:6px"></div>

                <!-- 手动填链接区 -->
                <div style="font-size:10px;color:rgba(46,38,30,.38);margin-bottom:5px;text-align:center">— 或手动填入链接 —</div>
                <input type="text" id="mvBgmNewTitle" placeholder="曲名（留空自动提取）" style="margin-bottom:6px">
                <div style="display:flex;gap:6px">
                  <input type="text" id="mvBgmUrl" placeholder="mp3 直链 / 网易云歌曲页 / outchain iframe" style="flex:1">
                  <button type="button" class="mv-btn primary" id="mvBgmAddTrack" style="font-size:12px;white-space:nowrap">＋ 加入</button>
                </div>
              </div>
              <div id="mvBgmLibraryList" style="max-height:260px;overflow-y:auto;border:1px solid rgba(28,24,18,.06);border-radius:12px;background:rgba(255,255,255,.42);padding:8px;margin-bottom:8px"></div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="mv-btn" id="mvBgmTest" style="font-size:12px">▶ 试听</button>
                <button type="button" class="mv-btn" id="mvBgmStop" style="font-size:12px">■ 停止</button>
                <button type="button" class="mv-btn" id="mvBgmResetDock" style="font-size:12px">↺ 复位唱片机</button>
              </div>
              <div class="mv-hint" style="margin-top:6px;font-size:11px">歌单同步到右侧贴边唱片机。mp3 直链可完整控制进度；网易云以嵌入播放器方式播放。</div>
              <details style="margin-top:8px;font-size:11px;color:rgba(46,38,30,.6)">
                <summary style="cursor:pointer;font-weight:600;color:rgba(46,38,30,.5)">📖 如何部署代理（5 分钟，永久免费）</summary>
                <div style="margin-top:6px;line-height:1.7;background:rgba(0,0,0,.03);border-radius:8px;padding:8px">
                  1. 注册 <b>cloudflare.com</b>（免费）<br>
                  2. 进「Workers &amp; Pages」→「Create」→「Worker」<br>
                  3. 把插件目录下 <b>cloudflare-worker.js</b> 的内容粘贴进编辑器<br>
                  4. 点「Deploy」，复制页面上的 <b>https://xxx.workers.dev</b> 地址<br>
                  5. 粘贴到上方「音乐代理地址」→ 保存设置<br>
                  <span style="color:rgba(100,140,80,.9)">✅ 之后搜歌、歌词全部自动走代理，云酒馆也能用</span>
                </div>
              </details>
              <input type="hidden" id="mvBgmTitle" value="${esc(c.bgmTitle||'背景音乐')}">
            </div>
          </div>
        </div>
        <div class="mv-footer">
          <button class="mv-btn primary" id="mvSave" style="flex:1">保存设置</button>
          <button class="mv-btn" id="mvCloseBtn">关闭</button>
        </div>
      </div>`;

    (doc.documentElement || doc.body).appendChild(box);

    const q = id => box.querySelector('#' + id);
    const _apiUi = {
      setProvider(provider) {
        const isVolc = provider === 'volcengine_v3';
        const openaiFields = q('mvOpenAIFields');
        const volcFields = q('mvVolcFields');
        const apiUrlWrap = q('mvApiUrl')?.closest('div');
        const apiVoice = q('mvApiVoice');
        const apiHint = q('mvApiHint');
        if (openaiFields) openaiFields.style.display = isVolc ? 'none' : '';
        if (volcFields) volcFields.style.display = isVolc ? '' : 'none';
        // 火山走本地代理，不需要手填 API 地址
        if (apiUrlWrap) apiUrlWrap.style.display = isVolc ? 'none' : '';
        if (apiVoice) {
          apiVoice.placeholder = isVolc
            ? '如：zh_female_cancan_moon_bigtts'
            : 'alloy（留空用默认）';
        }
        if (apiHint) {
          apiHint.textContent = isVolc
            ? '✅ 火山 V3 通过本地代理转发，无需填写 API 地址。需要：App ID + Access Key + Resource ID + 音色 ID。'
            : 'OpenAI 兼容：endpoint + API Key + model + voice。';
        }
        const voiceSel = q('mvApiVoiceSel');
        if (voiceSel && isVolc) {
          voiceSel.style.display = 'none';
          voiceSel.innerHTML = '<option value="">— 选择音色 —</option>';
        }
      },
      readFormCfg() {
        return {
          apiEnabled: true,
          apiProvider: q('mvApiProvider')?.value || 'openai_compatible',
          apiUrl: q('mvApiUrl')?.value.trim() || '',
          apiKey: q('mvApiKey')?.value.trim() || '',
          apiModel: q('mvApiModel')?.value.trim() || 'tts-1',
          apiVoice: q('mvApiVoice')?.value.trim() || '',
          volcAppId: q('mvVolcAppId')?.value.trim() || '',
          volcAccessKey: q('mvVolcAccessKey')?.value.trim() || '',
          volcResourceId: q('mvVolcResourceId')?.value.trim() || 'seed-tts-2.0',
        };
      }
    };
    box.querySelector('.mv-close').addEventListener('click', closeModal);
    q('mvCloseBtn').addEventListener('click', closeModal);
    _apiUi.setProvider(c.apiProvider || 'openai_compatible');
    q('mvRate').addEventListener('input', e => {
      q('mvRateVal').textContent = (+e.target.value).toFixed(1)+'x';
      lsSet(LS.RATE, +e.target.value);
    });
    q('mvPitch').addEventListener('input', e => {
      q('mvPitchVal').textContent = (+e.target.value).toFixed(1);
      lsSet(LS.PITCH, +e.target.value);
    });
    q('mvVolume').addEventListener('input', e => {
      q('mvVolumeVal').textContent = Math.round(+e.target.value*100)+'%';
      lsSet(LS.VOLUME, +e.target.value);
    });
    q('mvModeGrid').addEventListener('click', e => {
      const card = e.target.closest('.mv-mode-card');
      if (!card) return;
      box.querySelectorAll('.mv-mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      q('mvCustomWrap').style.display = card.dataset.mode === 'custom' ? '' : 'none';
    });
    q('mvTestBtn').addEventListener('click', () => testSpeak(
      q('mvTestTxt').value || '你好，这是语音朗读测试。',
      q('mvDefVoice').value, +q('mvRate').value, +q('mvPitch').value, +q('mvVolume').value
    ));
    q('mvStopBtn').addEventListener('click', stopReading);
    q('mvRefreshChars').addEventListener('click', () => {
      q('mvCharList').innerHTML = charRows(getActiveCharNames(), lsGet(LS.CHAR_MAP, {}));
    });
    q('mvDramaRate')?.addEventListener('input', e => {
      q('mvDramaRateVal').textContent = Number(e.target.value).toFixed(2) + 'x';
    });
    q('mvBgmVolume')?.addEventListener('input', e => {
      const v = _clampNum(e.target.value, 0, 1, 0.18);
      q('mvBgmVolumeVal').textContent = Math.round(v * 100) + '%';
      if (W._meowBgmAudio) {
        try { W._meowBgmAudio.volume = v; } catch(e) {}
      }
    });

    _renderBgmLibraryEditor(box);

    // ── 搜歌系统（多节点网易云 API，自动切换）─────────────────
    // ── 搜歌 + 歌词（走代理 or lrclib 直连）────────────────────
    async function _musicSearch(keywords) {
      const proxy = _bgmProxyBase();
      if (proxy) {
        // 走 Cloudflare Worker 代理
        try {
          const res = await fetch(`${proxy}/search?q=${encodeURIComponent(keywords)}&limit=15`,
            { signal: AbortSignal.timeout(12000) });
          if (!res.ok) throw new Error('proxy ' + res.status);
          const arr = await res.json();
          if (!Array.isArray(arr)) throw new Error('格式异常');
          return arr.map(s => ({
            id:       String(s.id || ''),
            url_id:   String(s.url_id   || s.id || ''),
            lyric_id: String(s.lyric_id || s.id || ''),
            name:     s.name   || '未知',
            artist:   s.artist || '',
            album:    s.album  || '',
            source:   s.source || 'netease',
            gd_src:   s.gd_src || 'netease',
            lrc:      '',
            url:      '',  // 点加入时才通过 /song 接口拿直链
          }));
        } catch(e) {
          toast('代理搜索失败，尝试直连…');
        }
      }
      // 无代理或代理失败：直接用 lrclib（仅有歌词，无直链）
      const res = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(keywords)}&limit=20`,
        { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('lrclib 搜索失败 ' + res.status);
      const arr = await res.json();
      if (!Array.isArray(arr)) throw new Error('格式异常');
      return arr.map(s => ({
        id:     String(s.id || ''),
        name:   s.trackName  || '未知',
        artist: s.artistName || '',
        album:  s.albumName  || '',
        lrc:    s.syncedLyrics || '',
        url:    '',  // lrclib 没有直链
      }));
    }

    async function _musicGetLyric(songId, name, artist) {
      const proxy = _bgmProxyBase();
      const kw = (name + (artist ? ' ' + artist : '')).trim();
      if (proxy) {
        try {
          const p = new URLSearchParams();
          if (songId) p.set('id', songId);
          if (kw) p.set('q', kw);
          const res = await fetch(`${proxy}/lyric?${p}`, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) throw new Error(res.status);
          const data = await res.json();
          return data?.lrc || '';
        } catch(e) {}
      }
      // 直连 lrclib
      try {
        const res = await fetch(
          `https://lrclib.net/api/search?q=${encodeURIComponent(kw)}&limit=5`,
          { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return '';
        const arr = await res.json();
        if (!Array.isArray(arr)) return '';
        const hit = arr.find(d => d.syncedLyrics) || arr[0];
        return hit?.syncedLyrics || '';
      } catch(e) { return ''; }
    }

    function _renderSearchResults(songs) {
      const el = q('mvBgmSearchResults');
      if (!el) return;
      if (!songs.length) {
        el.style.display = '';
        el.innerHTML = '<div style="padding:10px;text-align:center;font-size:11px;color:rgba(46,38,30,.4)">没有找到相关歌曲</div>';
        return;
      }
      el.style.display = '';
      const sourceBadge = {
        netease: '<span style="font-size:9px;background:rgba(200,50,50,.15);color:rgba(180,30,30,.9);border-radius:3px;padding:1px 5px;margin-left:4px;font-weight:600">网易云</span>',
        qq:      '<span style="font-size:9px;background:rgba(30,120,255,.15);color:rgba(20,100,220,.9);border-radius:3px;padding:1px 5px;margin-left:4px;font-weight:600">QQ</span>',
        tencent: '<span style="font-size:9px;background:rgba(30,120,255,.15);color:rgba(20,100,220,.9);border-radius:3px;padding:1px 5px;margin-left:4px;font-weight:600">QQ</span>',
        kugou:   '<span style="font-size:9px;background:rgba(30,180,100,.15);color:rgba(20,150,70,.9);border-radius:3px;padding:1px 5px;margin-left:4px;font-weight:600">酷狗</span>',
        kuwo:    '<span style="font-size:9px;background:rgba(255,140,0,.15);color:rgba(200,100,0,.9);border-radius:3px;padding:1px 5px;margin-left:4px;font-weight:600">酷我</span>',
        lrclib:  '<span style="font-size:9px;background:rgba(80,150,80,.12);color:rgba(80,150,80,.8);border-radius:3px;padding:1px 5px;margin-left:4px">lrclib</span>',
      };
      el.innerHTML = songs.map((s, i) => {
        const badge = sourceBadge[s.source] || '';
        const hasLrc = !!s.lrc;
        const hasUrl = !!(s.url || s.url_id);  // url_id = 已确认有直链来源
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;
          border-bottom:1px solid rgba(28,24,18,.05);"
          onmouseover="this.style.background='rgba(139,115,85,.10)'"
          onmouseout="this.style.background=''">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${esc(s.name)}${badge}${hasLrc?'<span style="font-size:9px;color:rgba(80,130,80,.9);margin-left:3px">🎵</span>':''}
              ${!hasUrl?'<span style="font-size:9px;color:rgba(160,100,50,.7);margin-left:3px">需手动填链接</span>':''}
            </div>
            <div style="font-size:10px;color:rgba(46,38,30,.45);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.artist)}${s.album?' · '+esc(s.album):''}</div>
          </div>
          <button type="button" class="mv-btn mv-bgm-search-add" data-idx="${i}"
            style="font-size:11px;padding:3px 10px;white-space:nowrap;flex:none">＋ 加入</button>
        </div>`;
      }).join('');
      el._songs = songs;
    }

    const _doSearch = async () => {
      const kw = q('mvBgmSearch')?.value.trim() || '';
      if (!kw) { toast('请输入歌名或歌手'); return; }
      const btn = q('mvBgmSearchBtn');
      if (btn) { btn.textContent = '搜索中…'; btn.disabled = true; }
      try {
        const songs = await _musicSearch(kw);
        if (!songs.length) {
          toast('没有找到「' + kw + '」，换个关键词试试');
        } else {
          _renderSearchResults(songs);
        }
      } catch(e) {
        toast('搜索出错：' + (e?.message || e));
      } finally {
        if (btn) { btn.textContent = '🔍 搜索'; btn.disabled = false; }
      }
    };

    q('mvBgmSearchBtn')?.addEventListener('click', _doSearch);
    q('mvBgmSearch')?.addEventListener('keydown', e => { if (e.key === 'Enter') _doSearch(); });

    q('mvBgmSearchResults')?.addEventListener('click', async (e) => {
      const addBtn = e.target.closest('.mv-bgm-search-add');
      if (!addBtn) return;
      const idx = Number(addBtn.dataset.idx || 0);
      const songs = q('mvBgmSearchResults')?._songs || [];
      const song = songs[idx];
      if (!song) return;

      addBtn.textContent = '加入中…';
      addBtn.disabled = true;
      try {
        const title = song.name + (song.artist ? ' - ' + song.artist : '');
        const gid = q('mvBgmAddToGroup')?.value || '';
        const lib = _getBgmLibrary();
        const group = lib.find(g => g.id === gid) || lib[0];
        if (!group) { toast('请先新建一个分组'); return; }
        if (!Array.isArray(group.tracks)) group.tracks = [];

        const proxy2 = _bgmProxyBase();
        if (proxy2 && song.url_id) {
          // 通过 /song 接口获取直链+歌词
          addBtn.textContent = '获取中…';
          const p = new URLSearchParams({
            src:      song.gd_src   || 'netease',
            url_id:   song.url_id,
            lyric_id: song.lyric_id || song.url_id,
            name:     song.name   || '',
            artist:   song.artist || '',
          });
          const songRes = await fetch(`${proxy2}/song?${p}`, { signal: AbortSignal.timeout(12000) });
          const songData = songRes.ok ? await songRes.json() : {};
          const realUrl = songData.url || '';
          const lrc     = songData.lrc || '';

          if (!realUrl) { toast('获取直链失败，请手动填入链接'); return; }
          if (group.tracks.some(t => t.url === realUrl)) { toast('该歌曲已在此分组中'); return; }
          const tid = _uid('t_');
          group.tracks.push({ id: tid, title, url: realUrl });
          _saveBgmLibrary(lib);
          box.__mvBgmState = { groupId: group.id, trackId: tid };
          if (lrc) { _lrcSet(tid, lrc); if (song.id) _lrcSet(song.id, lrc); }

          _renderBgmLibraryEditor(box);
          q('mvBgmSearchResults').style.display = 'none';
          q('mvBgmSearch').value = '';
          toast('✅ 已加入「' + song.name + '」' + (lrc ? ' 🎵 含歌词' : ' （暂无歌词）'));
        } else if (song.url) {
          // 有直链直接加入（lrclib 模式不会走这里，预留）
          if (group.tracks.some(t => t.url === song.url)) { toast('该歌曲已在此分组中'); return; }
          const tid = _uid('t_');
          group.tracks.push({ id: tid, title, url: song.url });
          _saveBgmLibrary(lib);
          box.__mvBgmState = { groupId: group.id, trackId: tid };
          if (song.lrc) _lrcSet(tid, song.lrc);
          _renderBgmLibraryEditor(box);
          q('mvBgmSearchResults').style.display = 'none';
          q('mvBgmSearch').value = '';
          toast('✅ 已加入「' + song.name + '」');
        } else {
          // 无直链（lrclib 直连模式）→ 预填标题
          if (song.lrc) _lrcSet('title_' + song.name.slice(0,30), song.lrc);
          if (q('mvBgmNewTitle')) q('mvBgmNewTitle').value = title;
          if (q('mvBgmUrl')) q('mvBgmUrl').value = '';
          q('mvBgmSearchResults').style.display = 'none';
          q('mvBgmSearch').value = '';
          toast(`已填入「${song.name}」请在下方粘贴链接后点加入`);
          q('mvBgmUrl')?.focus();
        }
      } catch(err) {
        toast('加入失败：' + (err?.message || err));
      } finally {
        addBtn.textContent = '＋ 加入';
        addBtn.disabled = false;
      }
    });

    // ── 新建分组 ──────────────────────────────────────────────
    q('mvBgmAddGroup')?.addEventListener('click', () => {
      const name = q('mvBgmNewGroup')?.value.trim() || '';
      if (!name) { toast('先写分组名'); return; }
      const lib = _getBgmLibrary();
      if (lib.find(g => g.name === name)) { toast('该分组已存在'); return; }
      const gid = _uid('g_');
      lib.push({ id: gid, name, tracks: [] });
      _saveBgmLibrary(lib);
      box.__mvBgmState = Object.assign(box.__mvBgmState || {}, { groupId: gid, trackId: '' });
      q('mvBgmNewGroup').value = '';
      _renderBgmLibraryEditor(box);
      toast('✅ 已新建分组「' + name + '」');
    });

    // ── 加入歌单（核心修复：直接操作内存缓存，不做二次 get）──
    q('mvBgmAddTrack')?.addEventListener('click', () => {
      const url = q('mvBgmUrl')?.value.trim() || '';
      if (!url) { toast('请先填写音乐链接'); return; }
      // 自动提取曲名
      let title = q('mvBgmNewTitle')?.value.trim() || '';
      if (!title) {
        try {
          const seg = url.split('?')[0].split('/').pop() || '';
          const decoded = decodeURIComponent(seg).replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[-_]/g,' ').trim();
          if (decoded && decoded.length <= 50) title = decoded;
        } catch(e) {}
        if (!title) title = '未命名曲目';
      }
      // 目标分组
      const gid = q('mvBgmAddToGroup')?.value || '';
      // 直接用内存缓存，不从 localStorage 重读
      const lib = _getBgmLibrary();
      const group = lib.find(g => g.id === gid) || lib[0];
      if (!group) { toast('请先新建一个分组'); return; }
      if (!Array.isArray(group.tracks)) group.tracks = [];
      // 同组内按 url 去重
      if (group.tracks.some(t => t.url === url)) { toast('该链接已在此分组中'); return; }
      const tid = _uid('t_');
      group.tracks.push({ id: tid, title, url });
      _saveBgmLibrary(lib);  // 同时更新内存缓存 + localStorage
      // 标记新加的为活跃项
      box.__mvBgmState = { groupId: group.id, trackId: tid };
      // 清空 URL 输入，曲名留着方便连续添加
      if (q('mvBgmUrl')) q('mvBgmUrl').value = '';
      // 直接传 lib 给渲染，不重读 localStorage
      _renderBgmLibraryEditor(box);
      toast('✅ 已加入「' + title + '」');
      // 异步拉取网易云歌词（静默后台，有 ID 才尝试）
      const _autoLrcId = _extractNeteaseId(url);
      if (_autoLrcId) {
        _fetchNeteaseLyric(_autoLrcId).then(lrc => {
          if (lrc) toast('🎵 歌词已自动获取');
        }).catch(() => {});
      }
    });

    // ── 歌单列表操作（选用 / 播放 / 改名 / 删除）─────────────
    q('mvBgmLibraryList')?.addEventListener('click', async (e) => {
      const useBtn    = e.target.closest('.mv-bgm-use');
      const playBtn   = e.target.closest('.mv-bgm-play');
      const renBtn    = e.target.closest('.mv-bgm-rename');
      const renOkBtn  = e.target.closest('.mv-bgm-rename-ok');
      const renCanBtn = e.target.closest('.mv-bgm-rename-cancel');
      const delBtn    = e.target.closest('.mv-bgm-del');
      const btn = useBtn || playBtn || renBtn || renOkBtn || renCanBtn || delBtn;
      if (!btn) return;

      // ── 改名取消
      if (renCanBtn) {
        box.__mvBgmRename = null;
        _renderBgmLibraryEditor(box);
        return;
      }

      const gid = btn.dataset.gid || '';
      const tid = btn.dataset.tid || '';

      // ── 进入改名模式
      if (renBtn) {
        box.__mvBgmRename = { gid, tid };
        _renderBgmLibraryEditor(box);
        return;
      }

      // ── 确认改名
      if (renOkBtn) {
        const inp = q('mvBgmLibraryList')?.querySelector('.mv-bgm-rename-input');
        const newTitle = (inp?.value || '').trim() || '未命名曲目';
        const lib = _getBgmLibrary();
        const group = _findBgmGroup(lib, gid);
        if (group) {
          const track = group.tracks.find(t => t.id === tid);
          if (track) track.title = newTitle;
          _saveBgmLibrary(lib);
        }
        box.__mvBgmRename = null;
        _renderBgmLibraryEditor(box);
        toast('已改名为「' + newTitle + '」');
        return;
      }

      if (!gid || !tid) return;
      const lib = _getBgmLibrary();
      const group = _findBgmGroup(lib, gid);
      const track = group ? group.tracks.find(t => t.id === tid) : null;

      // ── 删除
      if (delBtn) {
        if (!group) return;
        group.tracks = group.tracks.filter(t => t.id !== tid);
        _saveBgmLibrary(lib);
        const s = box.__mvBgmState || {};
        if (s.trackId === tid) box.__mvBgmState = { groupId: gid, trackId: group.tracks[0]?.id || '' };
        _renderBgmLibraryEditor(box);
        toast('已删除');
        return;
      }
      if (!track) return;

      // ── 选用 / 播放
      box.__mvBgmState = { groupId: gid, trackId: tid };
      if (q('mvBgmTitle')) q('mvBgmTitle').value = track.title || '';
      _renderBgmLibraryEditor(box);
      if (playBtn) {
        try {
          _setBgmSelection(gid, tid, track.title, track.url);
          await _setDramaBgmActive(true,
            Object.assign({}, cfg(), { bgmEnabled: true, bgmTitle: track.title, bgmUrl: track.url }),
            { preview: true, sourceUrl: track.url, title: track.title, groupId: gid, trackId: tid, restart: true });
        } catch(err) {
          toast('BGM 播放失败：' + ((err && err.message) || err || '未知错误'));
        }
      }
    });

    // ── 试听 / 停止 / 复位 ──────────────────────────────────
    q('mvBgmTest')?.addEventListener('click', async () => {
      // 优先试听「添加」输入框中的链接，否则播当前选中曲
      let url = q('mvBgmUrl')?.value.trim() || '';
      let title = q('mvBgmNewTitle')?.value.trim() || '';
      if (!url) {
        const s = box.__mvBgmState || {};
        const lib = _getBgmLibrary();
        const t = s.trackId ? ((_findBgmGroup(lib, s.groupId)?.tracks||[]).find(x=>x.id===s.trackId)) : null;
        url = t?.url || ''; title = t?.title || '背景音乐';
      }
      if (!url) { toast('请先填写音乐链接，或在歌单选一首'); return; }
      if (!title) title = '背景音乐';
      const s = box.__mvBgmState || {};
      try {
        const tmpCfg = Object.assign({}, cfg(), {
          bgmEnabled: true, bgmTitle: title, bgmUrl: url,
          bgmVolume: _clampNum(q('mvBgmVolume')?.value, 0, 1, 0.18),
          bgmLoop: !!q('mvBgmLoop')?.checked,
          bgmGroup: s.groupId || '', bgmTrack: s.trackId || '', bgmLibrary: _getBgmLibrary(),
        });
        const parsed = _parseDramaBgmSource(url);
        await _setDramaBgmActive(true, tmpCfg,
          { preview: true, sourceUrl: url, title, groupId: s.groupId || '', trackId: s.trackId || '', restart: true });
        toast(parsed.kind === 'netease_iframe' ? '▶ 已打开贴边唱片机' : '▶ 背景音乐已开始');
      } catch(err) {
        toast('试听失败：' + ((err && err.message) || err || '未知错误'));
      }
    });
    q('mvBgmStop')?.addEventListener('click', async () => {
      try { await _setDramaBgmActive(false, Object.assign({}, cfg(), { bgmEnabled: false })); } catch(e) {}
    });
    q('mvBgmResetDock')?.addEventListener('click', async () => {
      try {
        const current = cfg();
        const s = box.__mvBgmState || {};
        const lib = _getBgmLibrary();
        const t = s.trackId ? ((_findBgmGroup(lib, s.groupId)?.tracks||[]).find(x=>x.id===s.trackId)) : null;
        const title = t?.title || current.bgmTitle || '背景音乐';
        const url   = t?.url   || current.bgmUrl   || '';
        if (s.groupId || url) _setBgmSelection(s.groupId||'', s.trackId||'', title, url);
        _bgmState.closed = false;
        _resetBgmDockPos(false);
        const root = _getBgmDock();
        if (root) {
          root.style.display = '';
          root.classList.add('collapsed');
          root.classList.remove('dragging');
          _applyBgmDockPos(root, _bgmDockDefaultPos(root), true);
        }
        _renderBgmDock(Object.assign({}, current, { bgmTitle: title, bgmUrl: url }));
        toast('已复位唱片机');
      } catch(err) {
        toast('复位失败：' + ((err && err.message) || err || '未知错误'));
      }
    });

    // 保存设置
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
      lsSet(LS.API_ENABLED,  q('mvApiEnabled')?.checked || false);
      lsSet(LS.API_PROVIDER, q('mvApiProvider')?.value || 'openai_compatible');
      lsSet(LS.API_URL,      q('mvApiUrl')?.value.trim()   || '');
      lsSet(LS.API_KEY,      q('mvApiKey')?.value.trim()   || '');
      lsSet(LS.API_MODEL,    q('mvApiModel')?.value.trim() || 'tts-1');
      lsSet(LS.API_VOICE,    q('mvApiVoice')?.value.trim() || '');
      lsSet(LS.VOLC_APP_ID, q('mvVolcAppId')?.value.trim() || '');
      lsSet(LS.VOLC_ACCESS_KEY, q('mvVolcAccessKey')?.value.trim() || '');
      lsSet(LS.VOLC_RESOURCE_ID, q('mvVolcResourceId')?.value.trim() || 'seed-tts-2.0');
      // 广播剧设置
      const dramaEnabled = q('mvDramaEnabled')?.checked || false;
      lsSet(LS.DRAMA_MODE, dramaEnabled);
      lsSet(LS.USER_NAME,  q('mvUserName')?.value.trim() || '我');
      lsSet(LS.DRAMA_RATE, _clampNum(q('mvDramaRate')?.value, 0.7, 1.5, 1.0));
      lsSet(LS.BGM_ENABLED, !!q('mvBgmEnabled')?.checked);
      lsSet(LS.BGM_VOLUME, _clampNum(q('mvBgmVolume')?.value, 0, 1, 0.18));
      lsSet(LS.BGM_LOOP, !!q('mvBgmLoop')?.checked);
      lsSet(LS.BGM_PROXY, q('mvBgmProxy')?.value.trim() || '');
      const s = box.__mvBgmState || {};
      const saveLib = _getBgmLibrary();
      const saveTrack = s.trackId ? ((_findBgmGroup(saveLib, s.groupId)?.tracks||[]).find(x=>x.id===s.trackId)) : null;
      lsSet(LS.BGM_GROUP,   s.groupId   || '');
      lsSet(LS.BGM_TRACK,   s.trackId   || '');
      lsSet(LS.BGM_TITLE,   saveTrack?.title || q('mvBgmTitle')?.value.trim() || '背景音乐');
      lsSet(LS.BGM_URL,     saveTrack?.url   || '');
      _saveBgmLibrary(saveLib);  // 同步缓存 + 写 localStorage + 验证
      const newDramaMap = { ...lsGet(LS.DRAMA_MAP, {}) };
      newDramaMap['__narration__'] = q('mvNarratorVoice')?.value.trim() || '';
      newDramaMap['__user__']      = q('mvUserVoice')?.value.trim() || '';
      // 合并 voice + aliases 为对象
      const _dramaTmp = {};
      box.querySelectorAll('.mv-drama-char-voice').forEach(inp => {
        const char = inp.dataset.dramaChar;
        if (!char) return;
        if (!_dramaTmp[char]) _dramaTmp[char] = {};
        _dramaTmp[char].voice = inp.value.trim();
      });
      box.querySelectorAll('.mv-drama-char-aliases').forEach(inp => {
        const char = inp.dataset.dramaChar;
        if (!char) return;
        if (!_dramaTmp[char]) _dramaTmp[char] = {};
        _dramaTmp[char].aliases = inp.value.trim();
      });
      Object.assign(newDramaMap, _dramaTmp);
      lsSet(LS.DRAMA_MAP, newDramaMap);
      _bgmState.closed = false;
      _renderBgmDock(cfg());
      toast('✅ 语音设置已保存');
      closeModal();
    });

    // API 开关联动
    q('mvApiEnabled')?.addEventListener('change', e => {
      const f = q('mvApiFields');
      if (f) f.style.display = e.target.checked ? '' : 'none';
    });
    q('mvApiProvider')?.addEventListener('change', e => {
      _apiUi.setProvider(e.target.value || 'openai_compatible');
    });
    // 广播剧开关联动
    q('mvDramaEnabled')?.addEventListener('change', e => {
      const f = q('mvDramaFields');
      if (f) f.style.display = e.target.checked ? '' : 'none';
    });
    q('mvDramaRefresh')?.addEventListener('click', () => {
      const dl = q('mvDramaCharList');
      if (dl) dl.innerHTML = dramaCharRows(lsGet(LS.DRAMA_MAP, {}), getActiveCharNames());
    });
    // 密钥显示/隐藏
    q('mvApiKeyToggle')?.addEventListener('click', () => {
      const inp = q('mvApiKey');
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    q('mvVolcAccessToggle')?.addEventListener('click', () => {
      const inp = q('mvVolcAccessKey');
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    // 获取音色列表
    q('mvApiFetchVoices')?.addEventListener('click', async () => {
      const hint = q('mvApiHint');
      const provider = q('mvApiProvider')?.value || 'openai_compatible';
      if (provider === 'volcengine_v3') {
        if (hint) hint.textContent = '火山 V3 这版先手填音色 ID。控制台可直接复制音色 ID，避免错误猜接口。';
        toast('火山 V3 先手填音色 ID');
        return;
      }

      const rawUrl = q('mvApiUrl')?.value.trim() || '';
      const apiKey = q('mvApiKey')?.value.trim() || '';
      if (!rawUrl) { toast('请先填写 API 地址'); return; }
      const base = rawUrl.replace(/\/(audio\/speech|tts)\/?$/, '').replace(/\/$/, '');
      const voicesCandidates = [
        base + '/voices',
        base + '/audio/voices',
        rawUrl.replace(/\/tts$/, '/voices'),
        rawUrl.replace(/\/audio\/speech$/, '/voices'),
      ];
      if (hint) hint.textContent = '⏳ 获取中…';
      let data = null, triedUrls = [];
      for (const voicesUrl of voicesCandidates) {
        try {
          triedUrls.push(voicesUrl);
          const resp = await fetch(voicesUrl, {
            headers: apiKey ? { 'Authorization': 'Bearer ' + apiKey } : {},
          });
          if (!resp.ok) continue;
          data = await resp.json();
          break;
        } catch(_) {
          continue;
        }
      }
      try {
        if (!data) throw new Error('所有路径均失败，请手动填写音色 ID\n尝试过：' + triedUrls.join('\n'));
        const list = Array.isArray(data) ? data : (data.voices || data.data || []);
        if (!list.length) throw new Error('返回列表为空');
        const sel = q('mvApiVoiceSel');
        if (sel) {
          sel.innerHTML = '<option value="">— 选择音色 —</option>' + list.map(v => {
            const id   = typeof v === 'string' ? v : (v.voice_id || v.id || v.name || '');
            const name = typeof v === 'string' ? v : (v.name || v.voice_id || v.id || id);
            return '<option value="' + id + '">' + name + '</option>';
          }).join('');
          sel.style.display = '';
          sel.onchange = () => { const inp = q('mvApiVoice'); if (inp && sel.value) inp.value = sel.value; };
        }
        if (hint) hint.textContent = '✅ 共 ' + list.length + ' 个音色，点击选择';
      } catch(err) {
        if (hint) hint.textContent = '❌ ' + (err.message || err) + '（请手动填写音色 ID）';
      }
    });

    // 测试 API
    q('mvApiTest')?.addEventListener('click', async () => {
      const testTxt = q('mvApiTestTxt')?.value.trim() || '你好，这是朗读测试。';
      const hint    = q('mvApiHint');
      const formCfg = _apiUi.readFormCfg();
      const provider = _getApiProvider(formCfg);
      if (!formCfg.apiUrl) { toast('请填写 API 地址'); return; }
      if (provider === 'volcengine_v3' && !String(formCfg.volcResourceId || '').trim()) {
        toast('请填写 Resource ID');
        if (hint) hint.textContent = '❌ 缺少 Resource ID';
        return;
      }
      if (hint) hint.textContent = provider === 'volcengine_v3'
        ? '⏳ 火山 V3 请求中…'
        : '⏳ 请求中…';
      try {
        const blob = await _apiOnce(testTxt, formCfg.apiVoice || '', formCfg);
        const audio = new Audio(URL.createObjectURL(blob));
        if (hint) {
          hint.textContent = provider === 'volcengine_v3'
            ? '▶ 火山 V3 播放中…'
            : '▶ 播放中…';
          audio.onended = () => { hint.textContent = '✅ 测试完成'; };
        }
        const p = audio.play();
        if (p && typeof p.catch === 'function') await p;
      } catch(err) {
        const msg = err.message || String(err);
        if (hint) hint.textContent = '❌ ' + msg;
        toast('API 失败：' + msg.slice(0, 80));
      }
    });
  }

  function closeModal() {
    doc.getElementById(ID.MODAL)?.remove();
    if (!doc.querySelector('.meowModal')) doc.getElementById(ID.MASK)?.remove();
  }

  async function testSpeak(text, voiceURI, rate, pitch, volume) {
    if (!synth) return;
    if (_pendingSpeak) { clearTimeout(_pendingSpeak); _pendingSpeak = null; }
    try { synth.cancel(); } catch(e) {}
    isReading = false;
    const voices = await getVoices();
    const voice  = voices.find(v => v.voiceURI === voiceURI) || null;
    _pendingSpeak = setTimeout(() => {
      _pendingSpeak = null;
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = rate; utter.pitch = pitch; utter.volume = volume;
      if (voice) utter.voice = voice;
      utter.onstart = () => { isReading = true;  updateAllBtns(true);  };
      utter.onend   = () => { isReading = false; updateAllBtns(false); };
      utter.onerror = (e) => { if (e.error === 'interrupted') return; isReading = false; updateAllBtns(false); };
      try { synth.speak(utter); } catch(err) { updateAllBtns(false); }
    }, 80);
  }

  function getActiveCharNames() {
    const names = new Set();
    try {
      const ctx = window.SillyTavern?.getContext?.();
      if (ctx?.chat) for (const msg of ctx.chat) if (!msg.is_user && msg.name) names.add(String(msg.name).trim());
    } catch(e) {}
    if (!names.size) {
      try {
        doc.querySelectorAll('[is_user="false"] .name_text, [is_user="false"] .ch_name').forEach(el => {
          const n = el.textContent.trim(); if (n) names.add(n);
        });
      } catch(e) {}
    }
    return [...names].filter(Boolean);
  }

  function esc(s)     { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function escAttr(s) { return String(s||'').replace(/"/g,'&quot;'); }

  // ════════════════════════════════════════════════════════════════════
  //  § 12  独立悬浮按钮
  // ════════════════════════════════════════════════════════════════════

  function mountSoloBtn() {
    injectCSS();
    if (doc.getElementById(ID.SOLO_BTN)) return;
    const b = doc.createElement('div');
    b.id = ID.SOLO_BTN;
    b.innerHTML = `<div class="mv-ico">${ICON_VOICE}</div>`;
    const saved = lsGet(LS.POS, null);
    b.style.left = `${saved?.x ?? 12}px`;
    b.style.top  = `${saved?.y ?? Math.round(doc.documentElement.clientHeight * 0.65)}px`;

    let dragging=false, moved=false, sx=0, sy=0, bx=0, by=0;
    const onDown = e => { const p=e.touches?e.touches[0]:e; dragging=true; moved=false; sx=p.clientX; sy=p.clientY; bx=parseFloat(b.style.left)||0; by=parseFloat(b.style.top)||0; e.preventDefault(); e.stopPropagation(); };
    const onMove = e => { if (!dragging) return; const p=e.touches?e.touches[0]:e; const dx=p.clientX-sx, dy=p.clientY-sy; if (Math.abs(dx)>5||Math.abs(dy)>5) moved=true; b.style.left=`${Math.max(4,Math.min(doc.documentElement.clientWidth-44,bx+dx))}px`; b.style.top=`${Math.max(4,Math.min(doc.documentElement.clientHeight-44,by+dy))}px`; e.preventDefault(); };
    const onUp   = e => { if (!dragging) return; dragging=false; lsSet(LS.POS,{x:parseFloat(b.style.left),y:parseFloat(b.style.top)}); if (!moved) { if (isReading) stopReading(); else openModal(); } e.preventDefault(); };

    b.addEventListener('touchstart',onDown,{passive:false});
    b.addEventListener('touchmove', onMove,{passive:false});
    b.addEventListener('touchend',  onUp,  {passive:false});
    b.addEventListener('mousedown', onDown,{passive:false});
    doc.addEventListener('mousemove',onMove);
    doc.addEventListener('mouseup',  onUp);
    (doc.documentElement||doc.body).appendChild(b);
  }

  // ════════════════════════════════════════════════════════════════════
  //  § 13  启动
  // ════════════════════════════════════════════════════════════════════

  function registerMenuItem() {
    if (window.MEOW?.addMenuItem) {
      window.MEOW.addMenuItem('voice', '语音', ICON_VOICE_BIG, () => {
        if (isReading) stopReading();
        else openModal();
      });
      return true;
    }
    return false;
  }

  function start() {
    const hasMeowCore = !!(window.MEOW?.core && window.MEOW?.mods);

    if (hasMeowCore) {
      if (!registerMenuItem()) {
        let tries = 0;
        const t = setInterval(() => { if (registerMenuItem() || tries++ > 20) clearInterval(t); }, 200);
      }
    } else {
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mountSoloBtn);
      else mountSoloBtn();
    }

    // 手动播放按钮
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => setTimeout(injectPlayBtn, 1200));
    else setTimeout(injectPlayBtn, 1200);
    setInterval(keepPlayBtn, 30000);
    setTimeout(() => {
      try {
        const sel = _resolveBgmSelection(cfg());
        if (sel) {
          _bgmState.closed = false;
          _bgmState.title = sel.title;
          _bgmState.sourceUrl = sel.url;
          _bgmState.groupId = sel.groupId || '';
          _bgmState.trackId = sel.trackId || '';
          _renderBgmDock(cfg());
        }
      } catch(e) {}
    }, 1200);

    window.meowVoice = { open: openModal, stop: stopReading, speak: speakText };
    toast('🎙️ 语音模块已加载');
    console.log('[meow-voice] ✓ 就绪  (meow-core: ' + (hasMeowCore ? '✓ 转盘融合' : '✗ 独立模式') + ')');
  }

  setTimeout(start, 350);

})();
