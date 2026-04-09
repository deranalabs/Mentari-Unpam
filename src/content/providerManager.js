// providerManager.js — Universal AI Provider Layer
// Layer baru, tidak mengubah existing code sama sekali
(function () {
  'use strict';
  if (window.__mentariAI) return;

  const PRESETS = {
    openai: {
      name: 'OpenAI',
      icon: '🟢',
      baseUrl: 'https://api.openai.com/v1',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      models: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'o3-mini',
      ],
      chatPath: '/chat/completions',
      format: (msgs, model, o) => ({
        model,
        messages: msgs,
        max_tokens: o.maxTokens || 2048,
        temperature: o.temperature ?? 0.7,
      }),
      parse: (d) => d.choices[0].message.content,
    },

    anthropic: {
      name: 'Anthropic',
      icon: '🟣',
      baseUrl: 'https://api.anthropic.com/v1',
      authHeader: 'x-api-key',
      authPrefix: '',
      extraHeaders: { 'anthropic-version': '2023-06-01' },
      models: [
        'claude-sonnet-4-20250514',
        'claude-haiku-3.5',
        'claude-opus-4-20250514',
      ],
      chatPath: '/messages',
      format: (msgs, model, o) => {
        const sys = msgs.find((m) => m.role === 'system');
        return {
          model,
          messages: msgs.filter((m) => m.role !== 'system'),
          max_tokens: o.maxTokens || 2048,
          ...(sys ? { system: sys.content } : {}),
        };
      },
      parse: (d) => d.content[0].text,
    },

    google: {
      name: 'Gemini',
      icon: '🔵',
      baseUrl:
        'https://generativelanguage.googleapis.com/v1beta',
      authHeader: 'query',
      models: [
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
      ],
      chatPath: (m, k) =>
        `/models/${m}:generateContent?key=${k}`,
      format: (msgs) => ({
        contents: msgs
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
      }),
      parse: (d) =>
        d.candidates[0].content.parts[0].text,
    },

    openrouter: {
      name: 'OpenRouter',
      icon: '🔀',
      baseUrl: 'https://openrouter.ai/api/v1',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      models: [],
      chatPath: '/chat/completions',
      format: (msgs, model, o) => ({
        model,
        messages: msgs,
        max_tokens: o.maxTokens || 2048,
      }),
      parse: (d) => d.choices[0].message.content,
    },

    ollama: {
      name: 'Ollama',
      icon: '🦙',
      baseUrl: 'http://localhost:11434',
      authHeader: 'none',
      models: [],
      chatPath: '/api/chat',
      format: (msgs, model) => ({
        model,
        messages: msgs,
        stream: false,
      }),
      parse: (d) => d.message.content,
    },

    lmstudio: {
      name: 'LM Studio',
      icon: '🎨',
      baseUrl: 'http://localhost:1234/v1',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      models: ['local-model'],
      chatPath: '/chat/completions',
      format: (msgs, model, o) => ({
        model: model || 'local-model',
        messages: msgs,
        max_tokens: o.maxTokens || 2048,
      }),
      parse: (d) => d.choices[0].message.content,
    },

    custom: {
      name: 'Custom',
      icon: '⚙️',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      chatPath: '/chat/completions',
      format: (msgs, model, o) => ({
        model,
        messages: msgs,
        max_tokens: o.maxTokens || 2048,
        temperature: o.temperature ?? 0.7,
      }),
      parse: (d) =>
        d.choices?.[0]?.message?.content ||
        JSON.stringify(d),
    },
  };

  class MentariAI {
    constructor() {
      this.config = null;
      this.presets = PRESETS;
    }

    async init() {
      return new Promise((r) => {
        chrome.storage.sync.get(['mentariAIConfig'], r);
      }).then((data) => {
        this.config = data.mentariAIConfig || {};
        return this.config;
      });
    }

    async save(cfg) {
      this.config = { ...this.config, ...cfg };
      return new Promise((r) => {
        chrome.storage.sync.set(
          { mentariAIConfig: this.config },
          r
        );
      });
    }

    getPreset() {
      return (
        this.presets[this.config?.provider] ||
        this.presets.custom
      );
    }

    buildUrl(preset, cfg) {
      const base = cfg.baseUrl || preset.baseUrl;
      if (typeof preset.chatPath === 'function') {
        return base + preset.chatPath(cfg.model, cfg.apiKey);
      }
      return base + preset.chatPath;
    }

    buildHeaders(preset, cfg) {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (
        preset.authHeader !== 'query' &&
        preset.authHeader !== 'none'
      ) {
        headers[preset.authHeader] =
          `${preset.authPrefix || ''}${cfg.apiKey}`;
      }
      if (preset.extraHeaders) {
        Object.assign(headers, preset.extraHeaders);
      }
      return headers;
    }

    async chat(messages, opts = {}) {
      const cfg = { ...this.config, ...opts };
      const preset = this.getPreset();

      const url = this.buildUrl(preset, cfg);
      const headers = this.buildHeaders(preset, cfg);
      const body = preset.format(messages, cfg.model, {
        maxTokens: cfg.maxTokens,
        temperature: cfg.temperature,
      });

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `[${cfg.provider}] ${res.status}: ${errText}`
        );
      }

      const data = await res.json();
      return preset.parse(data);
    }

    async chatStream(messages, opts, onChunk) {
      // onChunk callback receives each text fragment as it arrives
      const cfg = { ...this.config, ...opts };
      const preset = this.getPreset();

      const url = this.buildUrl(preset, cfg);
      const headers = this.buildHeaders(preset, cfg);
      const body = preset.format(messages, cfg.model, {
        maxTokens: cfg.maxTokens,
        temperature: cfg.temperature,
      });
      body.stream = true;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (
            line.startsWith('data: ') &&
            line !== 'data: [DONE]'
          ) {
            try {
              const d = JSON.parse(line.slice(6));
              const chunk =
                d.choices?.[0]?.delta?.content || '';
              if (chunk) {
                fullText += chunk;
                if (typeof onChunk === 'function') {
                  onChunk(chunk, fullText);
                }
              }
            } catch {}
          }
        }
      }
      return fullText;
    }

    async fetchModels() {
      const preset = this.getPreset();
      if (preset.models?.length) return preset.models;

      const base =
        this.config.baseUrl || preset.baseUrl;

      if (this.config.provider === 'ollama') {
        const r = await fetch(`${base}/api/tags`);
        const d = await r.json();
        return d.models.map((m) => m.name);
      }
      if (this.config.provider === 'openrouter') {
        const r = await fetch(
          'https://openrouter.ai/api/v1/models'
        );
        const d = await r.json();
        return d.models.map((m) => m.id);
      }
      return [];
    }

    async testConnection() {
      try {
        const r = await this.chat([
          { role: 'user', content: 'Say "ok" in one word.' },
        ]);
        return { ok: true, response: r };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
  }

  const instance = new MentariAI();
  instance.init();

  window.__mentariAI = instance;
  console.log('[MentariAI] Provider manager loaded');
})();
