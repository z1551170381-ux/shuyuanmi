// 喵喵套件 · SillyTavern 扩展入口
// 作用：按顺序加载 meow-core.js → meow-phone.js

(async function () {
  // 自动检测扩展所在文件夹路径
  const scriptUrl = import.meta.url || '';
  const basePath = scriptUrl.substring(0, scriptUrl.lastIndexOf('/'));

  function loadScript(filename) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = basePath + '/' + filename + '?t=' + Date.now();
      s.onload = () => {
        console.log('[喵喵套件] ✓ 已加载:', filename);
        resolve();
      };
      s.onerror = () => {
        console.error('[喵喵套件] ✗ 加载失败:', filename);
        reject(new Error(filename + ' 加载失败'));
      };
      document.head.appendChild(s);
    });
  }

  try {
    await loadScript('meow-core.js');
    await loadScript('meow-phone.js');
    console.log('[喵喵套件] 全部插件加载完成 ✓');
  } catch (e) {
    console.error('[喵喵套件] 加载出错:', e);
  }
})();
