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
      apiUrl:       lsGet(LS.API_URL,       ''),
      apiKey:       lsGet(LS.API_KEY,       ''),
      apiModel:     lsGet(LS.API_MODEL,     'tts-1'),
      apiVoice:     lsGet(LS.API_VOICE,     ''),
      dramaMode:    lsGet(LS.DRAMA_MODE,    false),
      dramaMap:     lsGet(LS.DRAMA_MAP,     {}),
      userName:     lsGet(LS.USER_NAME,     '我'),
      autoMode:     lsGet(LS.AUTO_MODE,     'manual'),
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
  let isReading    = false;
  let _apiPlayGen  = 0;   // stopReading 时自增，speakViaApi 检测后退出
  let _pendingSpeak = null; // 用于延迟speak，防止cancel噪音

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
    try {
      // textContent 直接读原生 DOM 文字，不依赖渲染树，永远可靠。
      // ST 的美化正则生成的 <div style=".../* 注释 */..."> 里的
      // CSS 注释文字也会被 textContent 包含进来，所以要做清洗。
      let text = el.textContent || '';

      // 1. 去掉 CSS 注释内容（/* ... */），防止 style 属性内联注释泄漏
      text = text.replace(/\/\*[\s\S]*?\*\//g, '');

      // 2. 去掉 CSS 属性片段（color: #xxx; / display: flex; 等）
      //    特征：含冒号且前后是 ASCII 字母/数字/# 的行
      text = text.replace(/[a-z-]+\s*:\s*[^;\n]{0,80};/gi, '');

      // 3. 去 【...】 整块
      text = text.replace(/\u3010[^\u3011\n]{0,100}\u3011/g, '');
      text = text.replace(/[\u3010\u3011\[\]]/g, ' ');

      // 4. 去控制字符 / 零宽字符
      text = text.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF]/g, ' ');

      // 5. 去 HTML 实体残留
      text = text.replace(/&[a-z#0-9]+;/gi, ' ');

      // 6. 去多余空白
      text = text.replace(/[ \t]{2,}/g, ' ')
                 .replace(/\n{2,}/g, '\n')
                 .trim();

      return text;
    } catch(e) {
      return (el.textContent || '').replace(/\u3010[^\u3011]*\u3011/g, '').trim();
    }
  }
  function processText(raw, c) {
    let text = String(raw || '').trim();
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
  async function _apiOnce(text) {
    const c   = cfg();
    const url = (c.apiUrl || '').trim();
    if (!url) throw new Error('未填写 API 地址');
    const body = { model: c.apiModel || 'tts-1', input: text };
    if (c.apiVoice) body.voice = c.apiVoice;
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
    const _DRAMA_DEBUG = true;

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
    const rx        = /(\u201c[\s\S]*?\u201d|"[^"]*?")/g;
    let lastIdx     = 0;
    let prevQEnd    = 0;
    let prevSpeaker;
    let m;
    while ((m = rx.exec(rawText)) !== null) {
      const narBefore = rawText.slice(lastIdx, m.index).trim();
      if (narBefore) segments.push({ type: 'narration', speaker: null, text: narBefore });

      // 两段引号之间的旁白（用于 P2 判断连续发言）
      const interNar = prevQEnd > 0 ? rawText.slice(prevQEnd, m.index).trim() : null;

      const dialogueStr = m[0].slice(1, -1).trim();
      const speaker = detectSpeaker(rawText, m.index, m.index + m[0].length,
                                    dialogueStr, prevSpeaker, interNar);
      if (dialogueStr) segments.push({ type: 'dialogue', speaker, text: dialogueStr });

      prevSpeaker = speaker;
      prevQEnd    = m.index + m[0].length;
      lastIdx     = m.index + m[0].length;
    }
    const narAfter = rawText.slice(lastIdx).trim();
    if (narAfter) segments.push({ type: 'narration', speaker: null, text: narAfter });
    return segments;
  }

  function _dramEntryVoice(entry) { return typeof entry === 'string' ? entry : (entry?.voice || ''); }

  function _dramaVoiceFor(seg, c) {
    const dm = c.dramaMap || {};
    if (seg.type === 'narration')  return _dramEntryVoice(dm['__narration__']) || c.apiVoice || '';
    if (seg.speaker === (c.userName || '我')) return _dramEntryVoice(dm['__user__']) || c.apiVoice || '';
    if (seg.speaker && dm[seg.speaker]) return _dramEntryVoice(dm[seg.speaker]) || c.apiVoice || '';
    return c.apiVoice || '';
  }

  // 广播剧模式朗读（API）
  async function speakDramaApi(rawText, charNames, dramaMap) {
    const c    = cfg();
    const segs = _parseDramaSegments(rawText, charNames, c.userName, dramaMap || c.dramaMap);
    const gen  = ++_apiPlayGen;
    isReading  = true; updateAllBtns(true);
    for (const seg of segs) {
      if (gen !== _apiPlayGen || !isReading) break;
      const chunks  = _splitChunks(seg.text, 400);
      const voiceId = _dramaVoiceFor(seg, c);
      for (const chunk of chunks) {
        if (gen !== _apiPlayGen || !isReading) break;
        try {
          const origVoice = c.apiVoice;
          // 临时覆盖 apiVoice 来调用 _apiOnce
          const tempCfg = Object.assign({}, c, { apiVoice: voiceId });
          const resp = await fetch((c.apiUrl || '').trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (c.apiKey || '') },
            body: JSON.stringify({ model: c.apiModel || 'tts-1', input: chunk, ...(voiceId ? { voice: voiceId } : {}) }),
          });
          if (!resp.ok) { let msg=''; try{msg=await resp.text();}catch(_){} throw new Error('API '+resp.status+(msg?': '+msg.slice(0,100):'')); }
          const blob   = await resp.blob();
          const objUrl = URL.createObjectURL(blob);
          await new Promise((resolve, reject) => {
            const audio  = new Audio(objUrl);
            W._meowAudio = audio;
            audio.onended  = () => { URL.revokeObjectURL(objUrl); resolve(); };
            audio.onerror  = (e) => { URL.revokeObjectURL(objUrl); reject(e); };
            audio.play().catch(reject);
          });
        } catch(err) {
          if (gen !== _apiPlayGen) break;
          isReading = false; updateAllBtns(false);
          throw err;
        }
      }
    }
    if (gen === _apiPlayGen) { isReading = false; updateAllBtns(false); }
  }

  async function speakViaApi(text) {
    const gen    = ++_apiPlayGen;              // 本次播放的 token
    const chunks = _splitChunks(text);
    isReading = true; updateAllBtns(true);
    for (const chunk of chunks) {
      if (gen !== _apiPlayGen || !isReading) break;  // 被 stopReading 打断
      try {
        const blob   = await _apiOnce(chunk);
        if (gen !== _apiPlayGen) { URL.revokeObjectURL(URL.createObjectURL(blob)); break; }
        const objUrl = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          const audio  = new Audio(objUrl);
          W._meowAudio = audio;
          audio.onended  = () => { URL.revokeObjectURL(objUrl); resolve(); };
          audio.onerror  = (e) => { URL.revokeObjectURL(objUrl); reject(e); };
          audio.play().catch(reject);
        });
      } catch(err) {
        if (gen !== _apiPlayGen) break;  // 被中断不报错
        isReading = false; updateAllBtns(false);
        throw err;
      }
    }
    if (gen === _apiPlayGen) { isReading = false; updateAllBtns(false); }
  }

  function stopReading() {
    if (_pendingSpeak) { clearTimeout(_pendingSpeak); _pendingSpeak = null; }
    try { synth?.cancel(); } catch(e) {}
    // 中断 API 分段播放
    _apiPlayGen++;   // 让进行中的 speakViaApi 循环检测到版本变化后退出
    if (W._meowAudio) { try { W._meowAudio.pause(); W._meowAudio = null; } catch(e) {} }
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
      const charNames = Object.keys(c.dramaMap || {}).filter(k => k !== '__narration__' && k !== '__user__');
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
      const charNames = Object.keys(c.dramaMap || {}).filter(k => k !== '__narration__' && k !== '__user__');
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
            <div id="mvDramaCharList" style="margin-top:8px">
              ${dramaCharRows(c.dramaMap||{}, getActiveCharNames())}
            </div>
            <button type="button" class="mv-btn" id="mvDramaRefresh" style="margin-top:6px;font-size:12px">↺ 刷新角色列表</button>
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

    window.meowVoice = { open: openModal, stop: stopReading, speak: speakText };
    toast('🎙️ 语音模块已加载');
    console.log('[meow-voice] ✓ 就绪  (meow-core: ' + (hasMeowCore ? '✓ 转盘融合' : '✗ 独立模式') + ')');
  }

  setTimeout(start, 350);

})();
