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
    API_URL:      'meow_voice_api_url_v1',
    API_KEY:      'meow_voice_api_key_v1',
    API_MODEL:    'meow_voice_api_model_v1',
    API_VOICE:    'meow_voice_api_voice_v1',
    DRAMA_MODE:   'meow_voice_drama_mode_v1',
    DRAMA_MAP:    'meow_voice_drama_map_v1',
    USER_NAME:    'meow_voice_user_name_v1',
    AUTO_MODE:    'meow_voice_auto_mode_v1',
    DRAMA_RATE:   'meow_voice_drama_rate_v1',
    BGM_ENABLED:  'meow_voice_bgm_enabled_v2',
    BGM_TITLE:    'meow_voice_bgm_title_v2',
    BGM_URL:      'meow_voice_bgm_url_v2',
    BGM_VOLUME:   'meow_voice_bgm_volume_v2',
    BGM_LOOP:     'meow_voice_bgm_loop_v2',
    BGM_LIBRARY:  'meow_voice_bgm_library_v2',
    BGM_GROUP:    'meow_voice_bgm_group_v2',
    BGM_TRACK:    'meow_voice_bgm_track_v2',
    BGM_DOCK_COLLAPSED: 'meow_voice_bgm_dock_collapsed_v2',
    BGM_DOCK_POS: 'meow_voice_bgm_dock_pos_v2',
    BGM_STORE:    'meow_voice_bgm_store_v3',
  };


  function _cloneJson(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch(e) { return v; }
  }

  function _defaultBgmStore() {
    return {
      followDrama: false,
      volume: 0.18,
      loop: true,
      dockCollapsed: true,
      dockPos: null,
      currentGroupId: 'g_default',
      currentTrackId: '',
      library: [{ id: 'g_default', name: '常用', tracks: [] }],
    };
  }

  function _normalizeBgmStore(raw) {
    const base = _defaultBgmStore();
    const out = Object.assign({}, base, (raw && typeof raw === 'object') ? raw : {});
    out.followDrama = !!out.followDrama;
    out.volume = _clampNum(out.volume, 0, 1, 0.18);
    out.loop = out.loop !== false;
    out.dockCollapsed = out.dockCollapsed !== false;
    out.dockPos = (out.dockPos && typeof out.dockPos === 'object') ? {
      x: Number(out.dockPos.x || 0),
      y: Number(out.dockPos.y || 0),
      side: out.dockPos.side === 'left' ? 'left' : 'right',
      peek: Number(out.dockPos.peek || 0),
    } : null;
    out.library = _ensureBgmLibrary(out.library);
    let gid = String(out.currentGroupId || out.library[0]?.id || 'g_default');
    let group = out.library.find(g => g && g.id === gid) || out.library[0] || null;
    if (!group && !out.library.length) {
      out.library = _ensureBgmLibrary([]);
      group = out.library[0] || null;
    }
    out.currentGroupId = String(group?.id || 'g_default');
    const tracks = Array.isArray(group?.tracks) ? group.tracks : [];
    let tid = String(out.currentTrackId || '');
    if (tid && !tracks.some(t => String(t?.id || '') === tid)) tid = '';
    out.currentTrackId = tid || String(tracks[0]?.id || '');
    return out;
  }

  function _migrateBgmStorageV3() {
    try {
      const cur = W.localStorage.getItem(LS.BGM_STORE);
      if (cur !== null) {
        lsSet(LS.BGM_STORE, _normalizeBgmStore(lsGet(LS.BGM_STORE, _defaultBgmStore())));
        return;
      }
      const legacyLib = lsGet(LS.BGM_LIBRARY, null);
      const legacyUrl = String(lsGet(LS.BGM_URL, '') || '').trim();
      const legacyTitle = String(lsGet(LS.BGM_TITLE, '背景音乐') || '背景音乐').trim() || '背景音乐';
      const base = _defaultBgmStore();
      base.followDrama = !!lsGet(LS.BGM_ENABLED, false);
      base.volume = _clampNum(lsGet(LS.BGM_VOLUME, 0.18), 0, 1, 0.18);
      base.loop = lsGet(LS.BGM_LOOP, true) !== false;
      base.dockCollapsed = lsGet(LS.BGM_DOCK_COLLAPSED, true) !== false;
      base.dockPos = lsGet(LS.BGM_DOCK_POS, null);
      base.library = _ensureBgmLibrary(legacyLib || []);
      if (legacyUrl) {
        let gid = String(lsGet(LS.BGM_GROUP, '') || base.library[0]?.id || 'g_default');
        let group = base.library.find(g => g && g.id === gid) || base.library[0] || null;
        if (!group) {
          group = { id: 'g_default', name: '常用', tracks: [] };
          base.library = [group];
          gid = group.id;
        }
        if (!Array.isArray(group.tracks)) group.tracks = [];
        let track = group.tracks.find(t => String(t?.url || '').trim() === legacyUrl) || null;
        if (!track) {
          track = { id: _uid('t_'), title: legacyTitle, url: legacyUrl };
          group.tracks.push(track);
        }
        base.currentGroupId = gid;
        base.currentTrackId = track.id;
      } else {
        base.currentGroupId = String(lsGet(LS.BGM_GROUP, '') || base.library[0]?.id || 'g_default');
        base.currentTrackId = String(lsGet(LS.BGM_TRACK, '') || '');
      }
      lsSet(LS.BGM_STORE, _normalizeBgmStore(base));
    } catch(e) {}
  }

  _migrateBgmStorageV3();

  function _loadBgmStore() {
    return _normalizeBgmStore(lsGet(LS.BGM_STORE, _defaultBgmStore()));
  }

  function _saveBgmStore(store) {
    const safe = _normalizeBgmStore(_cloneJson(store));
    lsSet(LS.BGM_STORE, safe);
    return safe;
  }

  function _updateBgmStore(mutator) {
    const draft = _cloneJson(_loadBgmStore());
    const maybe = (typeof mutator === 'function') ? mutator(draft) : draft;
    return _saveBgmStore(maybe || draft);
  }

  function _bgmSelectionFromStore(store) {
    const s = _normalizeBgmStore(store || _loadBgmStore());
    const group = s.library.find(g => g && g.id === s.currentGroupId) || s.library[0] || null;
    const tracks = Array.isArray(group?.tracks) ? group.tracks : [];
    const track = tracks.find(t => String(t?.id || '') === String(s.currentTrackId || '')) || tracks[0] || null;
    if (!track || !String(track.url || '').trim()) return null;
    return { title: track.title || '背景音乐', url: String(track.url || '').trim(), groupId: group?.id || '', trackId: track.id || '' };
  }

  function cfg() {
    const bgm = _loadBgmStore();
    const bgmSel = _bgmSelectionFromStore(bgm);
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
      apiUrl:       lsGet(LS.API_URL,       ''),
      apiKey:       lsGet(LS.API_KEY,       ''),
      apiModel:     lsGet(LS.API_MODEL,     'tts-1'),
      apiVoice:     lsGet(LS.API_VOICE,     ''),
      dramaMode:    lsGet(LS.DRAMA_MODE,    false),
      dramaMap:     lsGet(LS.DRAMA_MAP,     {}),
      userName:     lsGet(LS.USER_NAME,     '我'),
      autoMode:     lsGet(LS.AUTO_MODE,     'manual'),
      dramaRate:    lsGet(LS.DRAMA_RATE,    1.0),
      bgmEnabled:   !!bgm.followDrama,
      bgmTitle:     bgmSel?.title || '背景音乐',
      bgmUrl:       bgmSel?.url || '',
      bgmVolume:    bgm.volume,
      bgmLoop:      bgm.loop,
      bgmLibrary:   bgm.library,
      bgmGroup:     bgm.currentGroupId,
      bgmTrack:     bgm.currentTrackId,
      bgmDockCollapsed: bgm.dockCollapsed,
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
    groupId: '',
    trackId: '',
    closed: false,
    dramaOwned: false,
  };

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
      || /^data:audio\//i.test(u);
  }


  function _uid(prefix) {
    return String(prefix || 'id_') + Math.random().toString(36).slice(2, 10);
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
      })).filter(t => t.url) : [],
    }));
    if (!lib.length) lib = [{ id: 'g_default', name: '常用', tracks: [] }];
    return lib;
  }

  function _getBgmLibrary() {
    return _loadBgmStore().library;
  }

  function _saveBgmLibrary(lib) {
    return _updateBgmStore(store => {
      store.library = _ensureBgmLibrary(lib);
      const group = store.library.find(g => g && g.id === store.currentGroupId) || store.library[0] || null;
      store.currentGroupId = String(group?.id || 'g_default');
      const tracks = Array.isArray(group?.tracks) ? group.tracks : [];
      if (!tracks.some(t => String(t?.id || '') === String(store.currentTrackId || ''))) {
        store.currentTrackId = String(tracks[0]?.id || '');
      }
      return store;
    });
  }

  function _findBgmGroup(lib, groupId) {
    const arr = Array.isArray(lib) ? _ensureBgmLibrary(lib) : _ensureBgmLibrary(lib);
    return arr.find(g => g && g.id === groupId) || arr[0] || null;
  }

  function _findBgmTrack(lib, groupId, trackId) {
    const group = _findBgmGroup(lib, groupId);
    if (!group || !Array.isArray(group.tracks)) return null;
    return group.tracks.find(t => t && t.id === trackId) || group.tracks[0] || null;
  }

  function _resolveBgmSelection(cArg, override) {
    const o = override || {};
    if (o.sourceUrl) {
      return {
        title: String(o.title || '背景音乐').trim() || '背景音乐',
        url: String(o.sourceUrl || '').trim(),
        groupId: String(o.groupId || ''),
        trackId: String(o.trackId || ''),
      };
    }
    return _bgmSelectionFromStore(_loadBgmStore());
  }

  function _setBgmSelection(groupId, trackId, title, url) {
    _updateBgmStore(store => {
      if (groupId != null) store.currentGroupId = String(groupId || store.currentGroupId || '');
      const group = store.library.find(g => g && g.id === store.currentGroupId) || store.library[0] || null;
      const tracks = Array.isArray(group?.tracks) ? group.tracks : [];
      if (trackId != null) {
        const wanted = String(trackId || '');
        const found = tracks.find(t => String(t?.id || '') === wanted) || tracks[0] || null;
        store.currentTrackId = String(found?.id || '');
      } else if (!tracks.some(t => String(t?.id || '') === String(store.currentTrackId || ''))) {
        store.currentTrackId = String(tracks[0]?.id || '');
      }
      return store;
    });
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
    let p = pos && typeof pos === 'object' ? Object.assign({}, pos) : (_loadBgmStore().dockPos || null);
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
    if (persist) _updateBgmStore(store => { store.dockPos = { x, y, side, peek }; return store; });
  }

  function _resetBgmDockPos(forceOpen) {
    const root = _getBgmDock();
    if (!root) return;
    _bgmState.closed = false;
    root.style.display = '';
    _updateBgmStore(store => { store.dockCollapsed = !(forceOpen === true); return store; });
    _renderBgmDock();
    const pos = _bgmDockDefaultPos(root);
    _applyBgmDockPos(root, pos, true);
  }

  function _ensureBgmDockManager(root) {
    if (!root) return;
    const panel = root.querySelector('.mv-bgm-panel');
    if (!panel) return;
    if (!panel.querySelector('.mv-bgm-manager')) {
      const mgr = doc.createElement('div');
      mgr.className = 'mv-bgm-manager';
      mgr.innerHTML = `
        <div class="mv-bgm-manager-row">
          <input type="text" class="mv-bgm-add-title" placeholder="曲名">
          <button type="button" class="mv-bgm-add-group" title="新建分组">＋组</button>
        </div>
        <div class="mv-bgm-manager-row">
          <input type="text" class="mv-bgm-add-url" placeholder="mp3 直链 / 网易云歌曲页 / outchain iframe">
          <button type="button" class="mv-bgm-add-track" title="加入当前分组">＋加歌</button>
        </div>`;
      const list = panel.querySelector('.mv-bgm-list');
      if (list) panel.insertBefore(mgr, list); else panel.appendChild(mgr);
    }
    if (!doc.getElementById('meow-voice-bgm-dock-manager-style')) {
      const s = doc.createElement('style');
      s.id = 'meow-voice-bgm-dock-manager-style';
      s.textContent = `
        #meow-voice-bgm-dock .mv-bgm-manager{margin-top:8px;padding:8px;border-radius:12px;background:rgba(255,255,255,.38);border:1px solid rgba(225,225,219,.88)}
        #meow-voice-bgm-dock .mv-bgm-manager-row{display:flex;gap:6px;margin-top:6px}
        #meow-voice-bgm-dock .mv-bgm-manager-row:first-child{margin-top:0}
        #meow-voice-bgm-dock .mv-bgm-manager input{flex:1;min-width:0;border:1px solid rgba(120,125,128,.18);border-radius:10px;padding:6px 8px;background:rgba(255,255,255,.76);font-size:11px;color:#334249}
        #meow-voice-bgm-dock .mv-bgm-manager button{flex:none;border:0;border-radius:10px;padding:6px 9px;background:rgba(255,255,255,.78);box-shadow:0 5px 14px rgba(16,50,55,.08);cursor:pointer;color:#3e4f56;font-size:11px}
        #meow-voice-bgm-dock .mv-bgm-list{display:block !important;max-height:168px;overflow:auto;margin-top:8px;padding-right:2px}
        #meow-voice-bgm-dock .mv-bgm-item{display:flex !important;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border-radius:12px;background:rgba(255,255,255,.50);border:1px solid rgba(225,225,219,.88);margin-top:6px}
        #meow-voice-bgm-dock .mv-bgm-item:first-child{margin-top:0}
        #meow-voice-bgm-dock .mv-bgm-item.active{background:rgba(17,65,74,.10);border-color:rgba(17,65,74,.12)}
        #meow-voice-bgm-dock .mv-bgm-item-title{display:block !important;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#2c393f}
        #meow-voice-bgm-dock .mv-bgm-item-meta{display:block !important;font-size:9px;color:rgba(44,57,63,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #meow-voice-bgm-dock .mv-bgm-item-actions{display:flex;gap:5px;flex:none}
        #meow-voice-bgm-dock .mv-bgm-item-actions button{display:inline-flex !important;align-items:center;justify-content:center;border:0;border-radius:999px;padding:4px 7px;background:rgba(255,255,255,.78);box-shadow:0 5px 14px rgba(16,50,55,.08);cursor:pointer;color:#3e4f56;font-size:10px}
        #meow-voice-bgm-dock.mini .mv-bgm-manager{padding:6px}
        #meow-voice-bgm-dock.mini .mv-bgm-manager input{padding:4px 6px;font-size:9px}
        #meow-voice-bgm-dock.mini .mv-bgm-manager button{padding:4px 6px;font-size:9px}
        #meow-voice-bgm-dock.mini .mv-bgm-list{max-height:92px}
      `;
      (doc.head || doc.documentElement).appendChild(s);
    }
  }

  function _bgmHardStop(opts) {
    const o = Object.assign({ keepDock: true, hideDock: false }, opts || {});
    try {
      if (_bgmAudio) {
        try { _bgmAudio.pause(); } catch(e) {}
        try { _bgmAudio.src = ''; } catch(e) {}
        try { _bgmAudio.load && _bgmAudio.load(); } catch(e) {}
      }
    } catch(e) {}
    if (W._meowBgmAudio && W._meowBgmAudio !== _bgmAudio) {
      try { W._meowBgmAudio.pause(); } catch(e) {}
      try { W._meowBgmAudio.src = ''; } catch(e) {}
    }
    _bgmAudio = null;
    W._meowBgmAudio = null;
    _bgmState.active = false;
    _bgmState.parsedKind = '';
    _bgmState.embedSrc = '';
    _bgmState.dramaOwned = false;
    const root = doc.getElementById('meow-voice-bgm-dock');
    if (root) {
      const embed = root.querySelector('.mv-bgm-embed');
      if (embed) { embed.classList.add('empty'); embed.innerHTML = ''; }
      root.classList.remove('playing');
      if (o.hideDock) root.style.display = 'none';
    }
    if (!o.keepDock && root && !_bgmState.closed) _renderBgmDock();
  }

  async function _bgmPlaySelection(selection, opts) {
    const sel = selection || _resolveBgmSelection();
    if (!sel || !sel.url) throw new Error('还没有可播放的音乐');
    const o = Object.assign({ restart: true, keepDock: true }, opts || {});
    const parsed = _parseDramaBgmSource(sel.url);
    if (_bgmState.active && _bgmState.sourceUrl === sel.url && !o.restart) {
      _renderBgmDock();
      return;
    }
    _bgmHardStop({ keepDock: true });
    _bgmState.closed = false;
    _bgmState.visible = true;
    _bgmState.title = sel.title || '背景音乐';
    _bgmState.sourceUrl = sel.url || '';
    _bgmState.groupId = sel.groupId || '';
    _bgmState.trackId = sel.trackId || '';
    _bgmState.parsedKind = parsed.kind || '';
    _bgmState.dramaOwned = false;
    if (sel.groupId || sel.trackId) _setBgmSelection(sel.groupId || '', sel.trackId || '');
    const root = _getBgmDock();
    root.style.display = '';
    if (parsed.kind === 'audio') {
      const a = new Audio(parsed.audioUrl);
      a.preload = 'auto';
      a.loop = _loadBgmStore().loop !== false;
      a.volume = _clampNum(_loadBgmStore().volume, 0, 1, 0.18);
      a.dataset.src = parsed.audioUrl;
      a.addEventListener('timeupdate', _syncBgmDockFromAudio);
      a.addEventListener('play', () => { _bgmState.active = true; _syncBgmDockFromAudio(); _renderBgmDock(); });
      a.addEventListener('pause', () => { _bgmState.active = false; _syncBgmDockFromAudio(); _renderBgmDock(); });
      a.addEventListener('ended', () => { _bgmState.active = false; _syncBgmDockFromAudio(); _renderBgmDock(); });
      _bgmAudio = a;
      W._meowBgmAudio = a;
      try {
        await a.play();
        _bgmState.active = true;
      } catch(err) {
        _bgmHardStop({ keepDock: true });
        throw new Error('浏览器阻止了音频自动播放，或该链接不可直接播放');
      }
      _renderBgmDock();
      return;
    }
    if (parsed.kind === 'netease_iframe') {
      let iframeSrc = parsed.iframeSrc;
      if (o.restart) iframeSrc += (iframeSrc.includes('?') ? '&' : '?') + 'mvts=' + Date.now();
      _bgmState.embedSrc = iframeSrc;
      _bgmState.active = true;
      _renderBgmDock();
      return;
    }
    if (parsed.kind === 'page') {
      throw new Error('普通歌曲页不能直接当 BGM，用网易云歌曲页请改成 outchain 播放器或直接粘贴歌曲页让系统转换。');
    }
    throw new Error('未识别的音乐链接格式');
  }

  function _bgmPauseOrStopCurrent() {
    if (_bgmAudio && !_bgmAudio.paused) {
      try { _bgmAudio.pause(); } catch(e) {}
      _bgmState.active = false;
      _renderBgmDock();
      return;
    }
    if (_bgmState.active && _bgmState.parsedKind === 'netease_iframe') {
      _bgmHardStop({ keepDock: true });
      _renderBgmDock();
    }
  }

  function _bgmCurrentTracks() {
    const store = _loadBgmStore();
    const group = _findBgmGroup(store.library, store.currentGroupId);
    return { store, group, tracks: _bgmTrackList(group) };
  }

  async function _bgmPlayOffset(delta) {
    const { store, tracks } = _bgmCurrentTracks();
    if (!tracks.length) throw new Error('当前分组还没有歌曲');
    let idx = Math.max(0, tracks.findIndex(t => t.id === store.currentTrackId));
    if (idx < 0) idx = 0;
    idx = (idx + delta + tracks.length) % tracks.length;
    const track = tracks[idx];
    _setBgmSelection(store.currentGroupId, track.id);
    await _bgmPlaySelection({ title: track.title, url: track.url, groupId: store.currentGroupId, trackId: track.id }, { restart: true });
  }

  function _bgmEnsureDockVisible() {
    _bgmState.closed = false;
    const root = _getBgmDock();
    root.style.display = '';
    _renderBgmDock();
    return root;
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
      #meow-voice-bgm-dock .mv-bgm-panel{position:relative;min-height:110px;padding:10px 10px 9px 46px;border-radius:20px;background:linear-gradient(180deg, rgba(255,255,255,.82), rgba(244,244,240,.64));border:1px solid rgba(214,214,206,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 16px 34px rgba(0,0,0,.10);overflow:visible}
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
      #meow-voice-bgm-dock .mv-bgm-lyric{margin-top:8px;min-height:42px;padding:8px 9px;border-radius:14px;background:rgba(255,255,255,.42);border:1px solid rgba(225,225,219,.88);font-size:11px;line-height:1.65;color:rgba(51,66,73,.78);white-space:pre-line}#meow-voice-bgm-dock .mv-bgm-lyric:empty::before{content:'歌词';opacity:.32}
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
      #meow-voice-bgm-dock.collapsed .mv-bgm-panel{opacity:0;pointer-events:none}
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
      #meow-voice-bgm-dock.mini .mv-bgm-lyric{min-height:32px;padding:6px 7px;font-size:9px}
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
    _ensureBgmDockManager(root);
    root.addEventListener('click', async (e) => {
      const rootNow = _getBgmDock();
      _ensureBgmDockManager(rootNow);
      const store = _loadBgmStore();
      const lib = store.library;

      if (e.target.closest('.mv-bgm-open-settings')) {
        openModal();
        return;
      }
      if (e.target.closest('.mv-bgm-disc-hit')) {
        if (rootNow.dataset.dragging === '1') return;
        if (rootNow.dataset.justTap === '1' && e.detail > 0) return;
        const next = !rootNow.classList.contains('collapsed');
        _updateBgmStore(s => { s.dockCollapsed = next; return s; });
        _renderBgmDock();
        _applyBgmDockPos(rootNow, _loadBgmStore().dockPos, true);
        return;
      }
      if (e.target.closest('.mv-bgm-tonearm')) {
        if (rootNow.dataset.dragging === '1') return;
        if (rootNow.dataset.justTap === '1' && e.detail > 0) return;
        const sel = _resolveBgmSelection(cfg());
        if (!sel) { toast('请先在唱片机里加入歌曲'); return; }
        if ((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe')) _bgmPauseOrStopCurrent();
        else {
          try { await _bgmPlaySelection(sel, { restart: false }); } catch(err) { toast('播放失败：' + ((err && err.message) || err || '未知错误')); }
        }
        return;
      }

      const btn = e.target.closest('button, .mv-bgm-item');
      if (!btn) return;
      if (btn.classList.contains('mv-bgm-close')) {
        _bgmState.closed = true;
        rootNow.style.display = 'none';
        _bgmHardStop({ keepDock: true, hideDock: true });
        return;
      }
      if (btn.classList.contains('mv-bgm-group-chip')) {
        const gid = btn.dataset.groupId || '';
        _updateBgmStore(s => {
          s.currentGroupId = gid || s.currentGroupId;
          const group = _findBgmGroup(s.library, s.currentGroupId);
          const tracks = _bgmTrackList(group);
          if (!tracks.some(t => String(t?.id || '') === String(s.currentTrackId || ''))) s.currentTrackId = String(tracks[0]?.id || '');
          return s;
        });
        _renderBgmDock();
        return;
      }
      if (btn.classList.contains('mv-bgm-prev')) {
        try { await _bgmPlayOffset(-1); } catch(err) { toast(err.message || err); }
        return;
      }
      if (btn.classList.contains('mv-bgm-next')) {
        try { await _bgmPlayOffset(1); } catch(err) { toast(err.message || err); }
        return;
      }
      if (btn.classList.contains('mv-bgm-play')) {
        const sel = _resolveBgmSelection(cfg());
        if (!sel) { toast('请先在唱片机里加入歌曲'); return; }
        if ((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe')) _bgmPauseOrStopCurrent();
        else {
          try { await _bgmPlaySelection(sel, { restart: false }); } catch(err) { toast('播放失败：' + ((err && err.message) || err || '未知错误')); }
        }
        return;
      }
      if (btn.classList.contains('mv-bgm-add-group')) {
        const name = (W.prompt('新分组名', '') || '').trim();
        if (!name) return;
        _updateBgmStore(s => {
          if (!s.library.some(g => String(g?.name || '') === name)) s.library.push({ id: _uid('g_'), name, tracks: [] });
          return s;
        });
        _renderBgmDock();
        return;
      }
      if (btn.classList.contains('mv-bgm-add-track')) {
        const titleInp = rootNow.querySelector('.mv-bgm-add-title');
        const urlInp = rootNow.querySelector('.mv-bgm-add-url');
        const title = String(titleInp?.value || '').trim() || '未命名曲目';
        const url = String(urlInp?.value || '').trim();
        if (!url) { toast('先填音乐链接'); return; }
        _updateBgmStore(s => {
          let group = _findBgmGroup(s.library, s.currentGroupId);
          if (!group) { group = s.library[0] || { id: 'g_default', name: '常用', tracks: [] }; if (!s.library.length) s.library.push(group); s.currentGroupId = group.id; }
          if (!Array.isArray(group.tracks)) group.tracks = [];
          const track = { id: _uid('t_'), title, url };
          group.tracks.push(track);
          s.currentTrackId = track.id;
          return s;
        });
        if (titleInp) titleInp.value = '';
        if (urlInp) urlInp.value = '';
        _renderBgmDock();
        toast('已加入歌单');
        return;
      }
      if (btn.classList.contains('mv-bgm-item-use')) {
        const tid = btn.dataset.trackId || btn.closest('.mv-bgm-item')?.dataset.trackId || '';
        if (!tid) return;
        _setBgmSelection(store.currentGroupId, tid);
        _renderBgmDock();
        return;
      }
      if (btn.classList.contains('mv-bgm-item-play') || btn.classList.contains('mv-bgm-item')) {
        const tid = btn.dataset.trackId || btn.closest('.mv-bgm-item')?.dataset.trackId || '';
        if (!tid) return;
        const track = _findBgmTrack(lib, store.currentGroupId, tid);
        if (!track) return;
        _setBgmSelection(store.currentGroupId, track.id);
        try { await _bgmPlaySelection({ title: track.title, url: track.url, groupId: store.currentGroupId, trackId: track.id }, { restart: true }); }
        catch(err) { toast('播放失败：' + ((err && err.message) || err || '未知错误')); }
        return;
      }
      if (btn.classList.contains('mv-bgm-item-del')) {
        const tid = btn.dataset.trackId || btn.closest('.mv-bgm-item')?.dataset.trackId || '';
        if (!tid) return;
        let deletedCurrent = false;
        _updateBgmStore(s => {
          const group = _findBgmGroup(s.library, s.currentGroupId);
          if (!group) return s;
          deletedCurrent = String(s.currentTrackId || '') === tid;
          group.tracks = _bgmTrackList(group).filter(t => String(t?.id || '') !== tid);
          if (deletedCurrent) s.currentTrackId = String(group.tracks[0]?.id || '');
          return s;
        });
        if (deletedCurrent) {
          const nextSel = _resolveBgmSelection(cfg());
          if (nextSel && ((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe'))) {
            try { await _bgmPlaySelection(nextSel, { restart: true }); } catch(err) { _bgmHardStop({ keepDock: true }); }
          } else if (!nextSel) {
            _bgmHardStop({ keepDock: true });
          }
        }
        _renderBgmDock();
        return;
      }
    });
    root.addEventListener('change', async (e) => {
      const sel = e.target.closest('.mv-bgm-track-select');
      if (!sel) return;
      const store = _loadBgmStore();
      const track = _findBgmTrack(store.library, store.currentGroupId, sel.value || '');
      if (!track) return;
      _setBgmSelection(store.currentGroupId, track.id);
      const shouldPlay = !!((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe'));
      if (shouldPlay) {
        try { await _bgmPlaySelection({ title: track.title, url: track.url, groupId: store.currentGroupId, trackId: track.id }, { restart: true }); }
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
    const store = _loadBgmStore();
    const root = _getBgmDock();
    _ensureBgmDockManager(root);
    if (_bgmState.closed && !_bgmState.active) return;
    const selection = _resolveBgmSelection(c);
    const title = String(_bgmState.title || selection?.title || '背景音乐').trim() || '背景音乐';
    const sub = _bgmState.active
      ? (_bgmState.parsedKind === 'netease_iframe' ? '网易云嵌入播放器' : '播放中')
      : (selection ? '待播放' : '当前分组暂无歌曲');
    root.style.display = '';
    root.classList.toggle('collapsed', !!store.dockCollapsed);
    root.classList.toggle('playing', !!_bgmState.active || !!(_bgmAudio && !_bgmAudio.paused));
    const dockVW = (W.innerWidth || doc.documentElement.clientWidth || 0);
    root.classList.toggle('compact', (dockVW <= 760));
    root.classList.toggle('mini', (dockVW <= 460));
    _applyBgmDockPos(root, store.dockPos || null, false);
    const rectNow = root.getBoundingClientRect();
    const vpNow = _bgmDockViewport();
    if (rectNow.right < 12 || rectNow.left > vpNow.w - 12 || rectNow.bottom < 12 || rectNow.top > vpNow.h - 12) {
      _applyBgmDockPos(root, _bgmDockDefaultPos(root), true);
    }
    root.querySelector('.mv-bgm-name').textContent = title;
    root.querySelector('.mv-bgm-sub').textContent = sub;
    const playBtn = root.querySelector('.mv-bgm-play');
    if (playBtn) playBtn.textContent = ((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe')) ? '⏸' : '▶';

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

    const lib = store.library;
    const activeGroupId = store.currentGroupId || lib[0]?.id || '';
    const groupsWrap = root.querySelector('.mv-bgm-groups');
    if (groupsWrap) groupsWrap.innerHTML = lib.map(g => `<button type="button" class="mv-bgm-group-chip ${g.id===activeGroupId?'active':''}" data-group-id="${_safeAttr(g.id)}">${_safeAttr(g.name)}</button>`).join('');
    const group = _findBgmGroup(lib, activeGroupId);
    const tracks = _bgmTracksForDisplay(lib, activeGroupId);
    const activeTrackId = store.currentTrackId || selection?.trackId || '';
    const currentTrack = tracks.find(t => t.id === activeTrackId) || tracks[0] || null;

    const trackSel = root.querySelector('.mv-bgm-track-select');
    if (trackSel) {
      trackSel.innerHTML = tracks.length ? tracks.map(t => `<option value="${_safeAttr(t.id)}" ${t.id===activeTrackId?'selected':''}>${_safeAttr(t.title)}</option>`).join('') : '<option value="">当前分组暂无歌曲</option>';
      trackSel.disabled = !tracks.length;
      if (!trackSel.value && tracks[0]) trackSel.value = tracks[0].id;
    }

    const lyricWrap = root.querySelector('.mv-bgm-lyric');
    if (lyricWrap) lyricWrap.textContent = _buildBgmCaption(c, group, currentTrack, tracks) || (currentTrack ? `${currentTrack.title}
${currentTrack.url}` : '在唱片机里添加歌曲后，这里会显示当前曲目信息。');

    const countWrap = root.querySelector('.mv-bgm-track-count');
    if (countWrap) countWrap.textContent = `${group?.name || '当前分组'} · ${tracks.length} 首`;

    const titleInp = root.querySelector('.mv-bgm-add-title');
    const urlInp = root.querySelector('.mv-bgm-add-url');
    if (titleInp && titleInp.dataset.autofill !== 'lock' && currentTrack && !titleInp.value) titleInp.placeholder = `曲名（当前：${currentTrack.title || '未命名曲目'}）`;
    if (urlInp && urlInp.dataset.autofill !== 'lock' && !urlInp.value) urlInp.placeholder = 'mp3 直链 / 网易云歌曲页 / outchain iframe';

    const listWrap = root.querySelector('.mv-bgm-list');
    if (listWrap) {
      listWrap.innerHTML = tracks.length ? tracks.map(t => {
        const active = String(t.id || '') === String(activeTrackId || '');
        return `<div class="mv-bgm-item ${active?'active':''}" data-track-id="${_safeAttr(t.id)}">
          <div style="min-width:0;flex:1">
            <div class="mv-bgm-item-title">${_safeAttr(t.title || '未命名曲目')}</div>
            <div class="mv-bgm-item-meta">${_safeAttr(t.url || '')}</div>
          </div>
          <div class="mv-bgm-item-actions">
            <button type="button" class="mv-bgm-item-use" data-track-id="${_safeAttr(t.id)}">选用</button>
            <button type="button" class="mv-bgm-item-play" data-track-id="${_safeAttr(t.id)}">播放</button>
            <button type="button" class="mv-bgm-item-del" data-track-id="${_safeAttr(t.id)}">删除</button>
          </div>
        </div>`;
      }).join('') : '<div class="mv-hint" style="font-size:11px;padding:6px 2px">当前分组还没有歌曲。先选分组，再在上方输入曲名和链接后点“＋加歌”。</div>';
    }

    const embed = root.querySelector('.mv-bgm-embed');
    if (embed) {
      if (_bgmState.active && _bgmState.parsedKind === 'netease_iframe' && _bgmState.embedSrc) {
        embed.classList.remove('empty');
        embed.innerHTML = `<iframe allow="autoplay *; encrypted-media *" src="${_safeAttr(_bgmState.embedSrc)}"></iframe>`;
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
    if (playBtn) playBtn.textContent = (_bgmAudio && !_bgmAudio.paused) ? '⏸' : ((_bgmState.active && _bgmState.parsedKind === 'netease_iframe') ? '⏸' : '▶');
    root.classList.toggle('playing', !!((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe')));
    const sub = root.querySelector('.mv-bgm-sub');
    if (sub) sub.textContent = (_bgmAudio && !_bgmAudio.paused) ? '播放中' : ((_bgmState.active && _bgmState.parsedKind === 'netease_iframe') ? '网易云嵌入播放器' : '已暂停');
  }

  function _clearDramaBgmDock(hide) {
    _bgmHardStop({ keepDock: !hide, hideDock: !!hide });
    if (!hide) _renderBgmDock();
  }

  async function _setDramaBgmActive(active, cArg, opts) {
    const store = _loadBgmStore();
    const o = Object.assign({ preview: false, keepDock: false, sourceUrl: '', title: '', groupId: '', trackId: '', restart: false }, opts || {});
    const selection = _resolveBgmSelection(cArg || cfg(), { sourceUrl: o.sourceUrl, title: o.title, groupId: o.groupId, trackId: o.trackId });

    if (!active) {
      if (_bgmState.dramaOwned) {
        _bgmHardStop({ keepDock: !!o.keepDock, hideDock: false });
        if (!o.keepDock) _renderBgmDock();
      }
      return;
    }
    if (!o.preview && !store.followDrama) return;
    if (!selection || !selection.url) return;
    if ((_bgmAudio && !_bgmAudio.paused) || (_bgmState.active && _bgmState.parsedKind === 'netease_iframe')) {
      // 已经有手动 BGM 在播时，不再额外起一首“幽灵歌”
      return;
    }
    try {
      await _bgmPlaySelection(selection, { restart: !!o.restart });
      _bgmState.dramaOwned = !o.preview;
    } catch(err) {
      throw err;
    }
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
      let msg = ''; try { msg = await resp.text(); } catch(_) {}
      throw new Error('API ' + resp.status + (msg ? ': ' + msg.slice(0, 200) : ''));
    }
    return resp.blob();
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
      try { await speakViaApi(text); }
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
    const lib = _getBgmLibrary();
    const state = _ensureBgmEditorState(box);
    const currentGroupId = String(state.groupId || (lib[0]?.id || ''));
    const activeTrackId = String(state.trackId || lsGet(LS.BGM_TRACK, '') || '');

    const sel = q('mvBgmGroupSel');
    if (sel) {
      sel.innerHTML = lib.map(g => `<option value="${escAttr(g.id)}" ${g.id===currentGroupId?'selected':''}>${esc(g.name)}（${_bgmTrackList(g).length}）</option>`).join('');
      if (!sel.value && lib[0]) sel.value = lib[0].id;
    }

    const list = q('mvBgmLibraryList');
    if (list) {
      const html = lib.map(g => {
        const gid = String(g?.id || '');
        const tracks = _bgmTrackList(g);
        const rows = tracks.map(t => {
          const active = (gid === currentGroupId) && (String(t.id) === activeTrackId);
          return `
            <div class="mv-bgm-row ${active?'active':''}" data-group-id="${escAttr(gid)}" data-track-id="${escAttr(t.id)}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:12px;background:${active?'rgba(17,65,74,.10)':'rgba(255,255,255,.55)'};margin-bottom:8px;border:1px solid rgba(28,24,18,.05)">
              <div style="min-width:0;flex:1">
                <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title || '未命名曲目')}</div>
                <div style="font-size:10px;color:rgba(90,70,50,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.url || '')}</div>
              </div>
              <div style="display:flex;gap:6px;flex:none">
                <button type="button" class="mv-btn mv-bgm-lib-use" data-group-id="${escAttr(gid)}" data-track-id="${escAttr(t.id)}" style="font-size:11px;padding:5px 10px">选用</button>
                <button type="button" class="mv-btn mv-bgm-lib-play" data-group-id="${escAttr(gid)}" data-track-id="${escAttr(t.id)}" style="font-size:11px;padding:5px 10px">播放</button>
                <button type="button" class="mv-btn mv-bgm-lib-del" data-group-id="${escAttr(gid)}" data-track-id="${escAttr(t.id)}" style="font-size:11px;padding:5px 10px">删除</button>
              </div>
            </div>`;
        }).join('');
        return `
          <div style="margin-bottom:12px;padding:8px;border:1px solid rgba(28,24,18,.05);border-radius:12px;background:${gid===currentGroupId?'rgba(255,255,255,.58)':'rgba(255,255,255,.34)'}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
              <div style="font-size:12px;font-weight:700;color:rgba(46,38,30,.86)">${esc(g.name)}</div>
              <div style="font-size:10px;color:rgba(90,70,50,.56)">${tracks.length} 首</div>
            </div>
            ${rows || '<div class="mv-hint" style="font-size:11px">这个分组还没有歌曲。</div>'}
          </div>`;
      }).join('');
      list.innerHTML = html || '<div class="mv-hint" style="font-size:11px">还没有歌曲。先填曲名和链接，再点“加入歌单”。</div>';
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
          <p class="mv-hint" style="margin-bottom:8px">兼容 OpenAI TTS 接口（volink / OpenAI / Azure 等），填写后优先使用 API 朗读</p>
          <label class="mv-toggle" style="margin-bottom:8px">
            <span>启用外接 API</span>
            <div class="mv-sw"><input type="checkbox" id="mvApiEnabled" ${c.apiEnabled?'checked':''}><div class="mv-slider"></div></div>
          </label>
          <div id="mvApiFields" style="${!c.apiEnabled?'display:none':''}">
            <div style="margin-bottom:8px">
              <label style="font-size:12px;display:block;margin-bottom:4px">API 地址（完整 endpoint）</label>
              <input type="text" id="mvApiUrl" placeholder="https://api.volink.org/v1/audio/speech" value="${esc(c.apiUrl)}">
            </div>
            <div style="margin-bottom:8px">
              <label style="font-size:12px;display:block;margin-bottom:4px">API Key</label>
              <div style="display:flex;gap:6px">
                <input type="password" id="mvApiKey" placeholder="sk-..." value="${esc(c.apiKey)}" style="flex:1">
                <button type="button" class="mv-btn" id="mvApiKeyToggle" style="padding:6px 10px;font-size:11px">显示</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
              <div>
                <label style="font-size:12px;display:block;margin-bottom:4px">模型</label>
                <input type="text" id="mvApiModel" placeholder="tts-1" value="${esc(c.apiModel)}">
              </div>
              <div>
                <label style="font-size:12px;display:block;margin-bottom:4px">
                  音色 ID
                  <button type="button" id="mvApiFetchVoices" style="margin-left:6px;font-size:10px;padding:2px 7px;border-radius:5px;border:1px solid rgba(28,24,18,.15);background:transparent;cursor:pointer">获取列表</button>
                </label>
                <input type="text" id="mvApiVoice" placeholder="alloy（留空用默认）" value="${esc(c.apiVoice)}">
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
              <label class="mv-toggle" style="margin-bottom:10px">
                <span>跟随广播剧自动播放</span>
                <div class="mv-sw"><input type="checkbox" id="mvBgmEnabled" ${c.bgmEnabled?'checked':''}><div class="mv-slider"></div></div>
              </label>
              <div class="mv-hint" style="margin-bottom:8px;font-size:11px">歌单管理已移到右侧贴边唱片机。主弹窗这里只控制：广播剧开始时是否自动带出 BGM。</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                <button type="button" class="mv-btn" id="mvBgmOpenDock" style="font-size:12px">♫ 打开播放器</button>
                <button type="button" class="mv-btn" id="mvBgmStop" style="font-size:12px">■ 停止当前 BGM</button>
                <button type="button" class="mv-btn" id="mvBgmResetDock" style="font-size:12px">↺ 复位唱片机</button>
              </div>
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
    box.querySelector('.mv-close').addEventListener('click', closeModal);
    q('mvCloseBtn').addEventListener('click', closeModal);
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

    q('mvBgmOpenDock')?.addEventListener('click', () => {
      _bgmEnsureDockVisible();
      toast('唱片机已打开');
    });
    q('mvBgmStop')?.addEventListener('click', async () => {
      try { await _setDramaBgmActive(false, cfg(), { keepDock: true }); } catch(e) {}
    });
    q('mvBgmResetDock')?.addEventListener('click', async () => {
      try {
        _bgmState.closed = false;
        _resetBgmDockPos(false);
        const root = _getBgmDock();
        if (root) {
          root.style.display = '';
          root.classList.add('collapsed');
          root.classList.remove('dragging');
          _applyBgmDockPos(root, _bgmDockDefaultPos(root), true);
        }
        _renderBgmDock();
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
      lsSet(LS.API_URL,      q('mvApiUrl')?.value.trim()   || '');
      lsSet(LS.API_KEY,      q('mvApiKey')?.value.trim()   || '');
      lsSet(LS.API_MODEL,    q('mvApiModel')?.value.trim() || 'tts-1');
      lsSet(LS.API_VOICE,    q('mvApiVoice')?.value.trim() || '');
      // 广播剧设置
      const dramaEnabled = q('mvDramaEnabled')?.checked || false;
      lsSet(LS.DRAMA_MODE, dramaEnabled);
      lsSet(LS.USER_NAME,  q('mvUserName')?.value.trim() || '我');
      lsSet(LS.DRAMA_RATE, _clampNum(q('mvDramaRate')?.value, 0.7, 1.5, 1.0));
      _updateBgmStore(store => {
        store.followDrama = !!q('mvBgmEnabled')?.checked;
        return store;
      });
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
    // 获取音色列表
    q('mvApiFetchVoices')?.addEventListener('click', async () => {
      const rawUrl = q('mvApiUrl')?.value.trim() || '';
      const apiKey = q('mvApiKey')?.value.trim() || '';
      const hint   = q('mvApiHint');
      if (!rawUrl) { toast('请先填写 API 地址'); return; }
      // 尝试多种 /voices 端点路径
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
        } catch(_) { continue; }
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
      const apiUrl  = q('mvApiUrl')?.value.trim();
      const apiKey  = q('mvApiKey')?.value.trim() || '';
      const model   = q('mvApiModel')?.value.trim() || 'tts-1';
      const voice   = q('mvApiVoice')?.value.trim();
      const testTxt = q('mvApiTestTxt')?.value.trim() || '你好，这是朗读测试。';
      const hint    = q('mvApiHint');
      if (!apiUrl) { toast('请填写 API 地址'); return; }
      if (hint) hint.textContent = '⏳ 请求中…';
      try {
        const bodyObj = { model, input: testTxt };
        if (voice) bodyObj.voice = voice;
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify(bodyObj),
        });
        if (!resp.ok) {
          const t = await resp.text();
          throw new Error('HTTP ' + resp.status + ': ' + t.slice(0, 200));
        }
        const blob  = await resp.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        if (hint) {
          hint.textContent = '▶ 播放中…';
          audio.onended = () => { hint.textContent = '✅ 测试完成'; };
        }
        audio.play();
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
