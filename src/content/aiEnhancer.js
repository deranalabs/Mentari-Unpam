// aiEnhancer.js — Enhancement layer, tambah fitur DI ATAS existing
(function () {
  'use strict';

  function waitForAI() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.__mentariAI?.config) resolve(window.__mentariAI);
        else setTimeout(check, 100);
      };
      check();
    });
  }

  // === Floating AI Button ===
  function injectFloatingButton() {
    const btn = document.createElement('div');
    btn.id = 'mentari-ai-fab';
    btn.innerHTML = '🤖';
    btn.title = 'Mentari AI Assistant';
    btn.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 48px; height: 48px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: transform 0.2s;
    `;
    btn.onmouseenter = () => (btn.style.transform = 'scale(1.1)');
    btn.onmouseleave = () => (btn.style.transform = 'scale(1)');
    btn.onclick = () => toggleAIPanel();
    document.body.appendChild(btn);
  }

  // === AI Chat Panel ===
  function toggleAIPanel() {
    let panel = document.getElementById('mentari-ai-panel');
    if (panel) {
      panel.style.display =
        panel.style.display === 'none' ? 'flex' : 'none';
      return;
    }

    panel = document.createElement('div');
    panel.id = 'mentari-ai-panel';
    panel.style.cssText = `
      position: fixed; bottom: 80px; right: 24px; z-index: 99998;
      width: 380px; height: 500px; border-radius: 12px;
      background: #0d1117; border: 1px solid #30363d;
      display: flex; flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: system-ui, -apple-system, sans-serif;
    `;

    const ai = window.__mentariAI;
    const providerLabel = ai?.config
      ? `${ai.presets[ai.config.provider]?.icon || '⚙️'} ${ai.config.provider} / ${ai.config.model}`
      : 'Not configured';

    panel.innerHTML = `
      <div style="padding:12px 16px;border-bottom:1px solid #30363d;
        display:flex;justify-content:space-between;align-items:center">
        <span style="color:#e6edf3;font-weight:600;font-size:14px">
          🤖 Mentari AI
        </span>
        <div style="display:flex;align-items:center;gap:8px">
          <span id="mentari-ai-provider" style="color:#8b949e;font-size:11px">
            ${providerLabel}
          </span>
          <button id="mentari-ai-settings-btn" style="
            background:none;border:1px solid #30363d;color:#8b949e;
            border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px">
            ⚙️
          </button>
          <button id="mentari-ai-close" style="
            background:none;border:none;color:#8b949e;
            cursor:pointer;font-size:16px">
            ✕
          </button>
        </div>
      </div>
      <div id="mentari-ai-context-bar" style="
        padding:6px 16px;border-bottom:1px solid #21262d;
        background:#161b22;font-size:11px;color:#8b949e">
        📍 ${window.location.pathname}
      </div>
      <div id="mentari-ai-messages" style="
        flex:1;overflow-y:auto;padding:12px;color:#e6edf3;font-size:13px">
        <div style="color:#8b949e;text-align:center;margin-top:40px">
          Ketik pertanyaan atau klik 🤖 pada soal untuk solve
        </div>
      </div>
      <div style="padding:8px;border-top:1px solid #30363d;display:flex;gap:6px">
        <input id="mentari-ai-input" placeholder="Tanya apa saja..."
          style="flex:1;padding:8px 10px;border-radius:6px;
          border:1px solid #30363d;background:#161b22;color:#e6edf3;
          font-size:13px;outline:none" />
        <button id="mentari-ai-send" style="
          padding:8px 14px;border-radius:6px;border:none;
          background:#238636;color:white;cursor:pointer;
          font-weight:600;font-size:13px">
          ➤
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('mentari-ai-close').onclick = () => {
      panel.style.display = 'none';
    };

    document.getElementById('mentari-ai-settings-btn').onclick = () => {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    };

    const input = document.getElementById('mentari-ai-input');
    const sendBtn = document.getElementById('mentari-ai-send');

    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      appendMsg('user', text);
      appendMsg('assistant', '⏳ ...');

      try {
        const ai = window.__mentariAI;
        if (!ai?.config?.apiKey) {
          throw new Error(
            'Provider belum dikonfigurasi. Klik ⚙️ untuk setting.'
          );
        }
        const pageContext = getPageContextHint();
        const response = await ai.chat([
          {
            role: 'system',
            content:
              'Kamu asisten akademik MENTARI UNPAM. Jawab singkat dan jelas.' +
              (pageContext ? `\n\nKonteks halaman: ${pageContext}` : ''),
          },
          { role: 'user', content: text },
        ]);

        const msgs = document.getElementById('mentari-ai-messages');
        msgs.removeChild(msgs.lastChild);
        appendMsg('assistant', response);
      } catch (e) {
        const msgs = document.getElementById('mentari-ai-messages');
        msgs.removeChild(msgs.lastChild);
        appendMsg('error', e.message);
      }
    };

    sendBtn.onclick = sendMessage;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') sendMessage();
    };
    input.focus();
  }

  function appendMsg(role, text) {
    const msgs = document.getElementById('mentari-ai-messages');
    const div = document.createElement('div');
    div.style.cssText = `margin-bottom:8px;padding:8px 10px;
      border-radius:8px;line-height:1.5;word-wrap:break-word;`;

    if (role === 'user') {
      div.style.cssText += 'background:#161b22;text-align:right;';
      div.textContent = text;
    } else if (role === 'error') {
      div.style.cssText += 'background:#2d1215;color:#f85149;';
      div.textContent = '❌ ' + text;
    } else {
      div.style.cssText += 'background:#1c2333;';
      div.innerHTML = formatMarkdown(text);
    }

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // Simple markdown-like formatting
  function formatMarkdown(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:#21262d;padding:1px 4px;border-radius:3px">$1</code>')
      .replace(/\n/g, '<br>');
  }

  // === Page Context Detection ===
  function getPageContextHint() {
    const url = window.location.pathname;
    if (url.includes('/exam/')) return 'Halaman kuis/ujian';
    if (url.includes('/forum/')) return 'Forum diskusi';
    if (url.includes('/kuesioner/')) return 'Halaman kuesioner';
    if (url.includes('/login')) return 'Halaman login';
    return '';
  }

  // === INIT ===
  waitForAI().then(() => {
    injectFloatingButton();
    console.log(
      '[MentariAI] Enhancer loaded on',
      window.location.pathname
    );
  });
})();
