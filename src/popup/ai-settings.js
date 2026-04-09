// ai-settings.js — Hermes-like provider selector
(function () {
  'use strict';

  const PROVIDERS = [
    {
      key: 'openai',
      name: 'OpenAI',
      icon: '🟢',
      desc: 'GPT-4o, GPT-4.1, o3-mini — API key required',
      baseUrl: 'https://api.openai.com/v1',
      models: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'o3-mini',
      ],
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      chatPath: '/chat/completions',
    },
    {
      key: 'anthropic',
      name: 'Anthropic',
      icon: '🟣',
      desc: 'Claude models — API key or Claude Code',
      baseUrl: 'https://api.anthropic.com/v1',
      models: [
        'claude-sonnet-4-20250514',
        'claude-haiku-3.5',
        'claude-opus-4-20250514',
      ],
      authHeader: 'x-api-key',
      authPrefix: '',
      chatPath: '/messages',
    },
    {
      key: 'google',
      name: 'Google Gemini',
      icon: '🔵',
      desc: 'Gemini 2.0/2.5 Flash & Pro — free tier available',
      baseUrl:
        'https://generativelanguage.googleapis.com/v1beta',
      models: [
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
      ],
      authHeader: 'query',
      authPrefix: '',
      chatPath: '/models/{model}:generateContent?key={key}',
    },
    {
      key: 'openrouter',
      name: 'OpenRouter',
      icon: '🔀',
      desc: '100+ models, pay-per-use',
      baseUrl: 'https://openrouter.ai/api/v1',
      models: [],
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      chatPath: '/chat/completions',
    },
    {
      key: 'ollama',
      name: 'Ollama (Local)',
      icon: '🦙',
      desc: 'Local inference — no API key needed',
      baseUrl: 'http://localhost:11434',
      models: [],
      authHeader: 'none',
      authPrefix: '',
      chatPath: '/api/chat',
    },
    {
      key: 'lmstudio',
      name: 'LM Studio (Local)',
      icon: '🎨',
      desc: 'Local OpenAI-compatible server',
      baseUrl: 'http://localhost:1234/v1',
      models: ['local-model'],
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      chatPath: '/chat/completions',
    },
    {
      key: 'custom',
      name: 'Custom Provider',
      icon: '⚙️',
      desc: 'Any OpenAI-compatible endpoint',
      baseUrl: '',
      models: [],
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      chatPath: '/chat/completions',
    },
  ];

  let selectedKey = 'openai';

  // === Build provider list (Hermes style) ===
  const list = document.getElementById('providerList');

  PROVIDERS.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'provider-item';
    li.dataset.key = p.key;
    li.innerHTML = `
      <span class="icon">${p.icon}</span>
      <div class="info">
        <div class="name">${p.name}</div>
        <div class="desc">${p.desc}</div>
      </div>
      <span class="arrow">→</span>
    `;
    li.onclick = () => selectProvider(p.key);
    list.appendChild(li);
  });

  // === Select provider ===
  function selectProvider(key) {
    selectedKey = key;
    const provider = PROVIDERS.find((p) => p.key === key);

    // Update list active state
    list.querySelectorAll('.provider-item').forEach((li) => {
      li.classList.toggle('active', li.dataset.key === key);
    });

    // Update badge
    const badge = document.getElementById('activeBadge');
    badge.textContent = `${provider.icon} ${provider.name}`;

    // Show config panel
    const panel = document.getElementById('configPanel');
    panel.classList.add('visible');

    // Show/hide custom fields
    document.getElementById('customFields').style.display =
      key === 'custom' ? 'block' : 'none';

    // Populate models
    populateModels(provider.models);

    // Pre-fill base URL for custom
    if (key === 'custom') {
      document.getElementById('baseUrl').value =
        provider.baseUrl;
    }

    // Load saved values for this provider
    loadSavedForProvider(key);
  }

  function populateModels(models) {
    const select = document.getElementById('model');
    select.innerHTML = '';

    if (!models.length) {
      // Free-text mode
      select.innerHTML = `
        <option value="">-- ketik model name --</option>
        <option value="__custom__">✏️ Ketik manual...</option>
      `;
      return;
    }

    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      select.appendChild(opt);
    });
  }

  // Handle custom model input
  document.getElementById('model').onchange = function () {
    if (this.value === '__custom__') {
      const custom = prompt('Ketik nama model:');
      if (custom) {
        const opt = document.createElement('option');
        opt.value = custom;
        opt.textContent = custom;
        opt.selected = true;
        this.insertBefore(opt, this.firstChild);
      } else {
        this.selectedIndex = 0;
      }
    }
  };

  // === Fetch models dynamically ===
  document.getElementById('fetchModels').onclick =
    async () => {
      const btn = document.getElementById('fetchModels');
      const baseUrl =
        document.getElementById('baseUrl').value ||
        PROVIDERS.find((p) => p.key === selectedKey).baseUrl;
      const apiKey =
        document.getElementById('apiKey').value;

      btn.textContent = '⏳';
      btn.disabled = true;

      try {
        let models = [];

        if (selectedKey === 'ollama') {
          const r = await fetch(`${baseUrl}/api/tags`);
          const d = await r.json();
          models = d.models.map((m) => m.name);
        } else if (selectedKey === 'openrouter') {
          const r = await fetch(
            'https://openrouter.ai/api/v1/models'
          );
          const d = await r.json();
          models = d.models
            .map((m) => m.id)
            .slice(0, 50);
        } else if (
          selectedKey === 'custom' ||
          selectedKey === 'lmstudio'
        ) {
          try {
            const r = await fetch(`${baseUrl}/models`, {
              headers: apiKey
                ? {
                    Authorization: `Bearer ${apiKey}`,
                  }
                : {},
            });
            const d = await r.json();
            models = (
              d.data ||
              d.models ||
              []
            ).map((m) => m.id || m.name);
          } catch {
            setStatus(
              'err',
              'Tidak bisa fetch models. Ketik manual.'
            );
            return;
          }
        } else {
          models =
            PROVIDERS.find((p) => p.key === selectedKey)
              .models;
        }

        if (models.length) {
          populateModels(models);
          document.getElementById('model').value =
            models[0];
          setStatus(
            'ok',
            `✅ ${models.length} models loaded`
          );
        }
      } catch (e) {
        setStatus('err', `Error: ${e.message}`);
      } finally {
        btn.textContent = '↻';
        btn.disabled = false;
      }
    };

  // === Load saved config ===
  function loadSavedForProvider(key) {
    chrome.storage.sync.get(
      ['mentariAIConfig'],
      (result) => {
        const config = result.mentariAIConfig || {};
        if (config.provider !== key) return;

        if (config.apiKey)
          document.getElementById('apiKey').value =
            config.apiKey;
        if (config.maxTokens)
          document.getElementById('maxTokens').value =
            config.maxTokens;
        if (config.temperature !== undefined)
          document.getElementById('temperature').value =
            config.temperature;

        // Set model
        if (config.model) {
          const select =
            document.getElementById('model');
          const existing = [...select.options].find(
            (o) => o.value === config.model
          );
          if (existing) {
            select.value = config.model;
          } else {
            const opt = document.createElement('option');
            opt.value = config.model;
            opt.textContent = config.model;
            opt.selected = true;
            select.insertBefore(opt, select.firstChild);
          }
        }

        // Custom fields
        if (config.baseUrl)
          document.getElementById('baseUrl').value =
            config.baseUrl;
        if (config.authHeader)
          document.getElementById('authHeader').value =
            config.authHeader;
        if (config.authPrefix)
          document.getElementById('authPrefix').value =
            config.authPrefix;
        if (config.chatPath)
          document.getElementById('chatPath').value =
            config.chatPath;
      }
    );
  }

  // Load initial saved provider
  chrome.storage.sync.get(
    ['mentariAIConfig'],
    (result) => {
      const config = result.mentariAIConfig || {};
      selectProvider(config.provider || 'openai');
    }
  );

  // === Save ===
  document.getElementById('saveBtn').onclick = () => {
    const config = {
      provider: selectedKey,
      apiKey: document.getElementById('apiKey').value,
      model: document.getElementById('model').value,
      maxTokens: parseInt(
        document.getElementById('maxTokens').value
      ),
      temperature: parseFloat(
        document.getElementById('temperature').value
      ),
    };

    if (selectedKey === 'custom') {
      config.baseUrl =
        document.getElementById('baseUrl').value;
      config.authHeader =
        document.getElementById('authHeader').value;
      config.authPrefix =
        document.getElementById('authPrefix').value;
      config.chatPath =
        document.getElementById('chatPath').value;
    } else {
      config.baseUrl = PROVIDERS.find(
        (p) => p.key === selectedKey
      ).baseUrl;
    }

    chrome.storage.sync.set(
      { mentariAIConfig: config },
      () => {
        setStatus(
          'ok',
          '✅ Config saved! Reload MENTARI tab to apply.'
        );
      }
    );
  };

  // === Test connection ===
  document.getElementById('testBtn').onclick = async () => {
    setStatus('loading', '⏳ Testing connection...');

    const config = {
      provider: selectedKey,
      baseUrl:
        document.getElementById('baseUrl').value ||
        PROVIDERS.find((p) => p.key === selectedKey).baseUrl,
      apiKey: document.getElementById('apiKey').value,
      model: document.getElementById('model').value,
    };

    try {
      let url, headers, body;

      if (selectedKey === 'google') {
        url = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Say "ok"' }],
            },
          ],
        });
      } else if (selectedKey === 'anthropic') {
        url = `${config.baseUrl}/messages`;
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        };
        body = JSON.stringify({
          model: config.model,
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Say "ok"' },
          ],
        });
      } else if (selectedKey === 'ollama') {
        url = `${config.baseUrl}/api/chat`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({
          model: config.model,
          messages: [
            { role: 'user', content: 'Say "ok"' },
          ],
          stream: false,
        });
      } else {
        // OpenAI compatible
        url = `${config.baseUrl}/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        };
        body = JSON.stringify({
          model: config.model,
          messages: [
            { role: 'user', content: 'Say "ok"' },
          ],
          max_tokens: 10,
        });
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status}: ${errText}`);
      }

      const data = await res.json();
      let response;

      if (selectedKey === 'google') {
        response =
          data.candidates[0].content.parts[0].text;
      } else if (selectedKey === 'anthropic') {
        response = data.content[0].text;
      } else if (selectedKey === 'ollama') {
        response = data.message.content;
      } else {
        response = data.choices[0].message.content;
      }

      setStatus(
        'ok',
        `✅ Connected! Response: "${response}"`
      );
    } catch (e) {
      setStatus('err', `❌ ${e.message}`);
    }
  };

  // === Status helper ===
  function setStatus(type, message) {
    const bar = document.getElementById('statusBar');
    bar.className = `status-bar ${type}`;
    bar.textContent = message;

    if (type === 'ok') {
      setTimeout(() => {
        bar.className = 'status-bar';
      }, 4000);
    }
  }
})();
