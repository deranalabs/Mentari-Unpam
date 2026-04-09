// quizEnhancer.js — AI solve button per soal, DI SAMPING existing quiz.js
(function () {
  'use strict';

  function waitForAI() {
    return new Promise((r) => {
      const c = () =>
        window.__mentariAI?.config
          ? r(window.__mentariAI)
          : setTimeout(c, 100);
      c();
    });
  }

  const STYLE = `
    .mentari-solve-btn {
      display: inline-block;
      margin: 6px 0;
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid #58a6ff;
      background: #1c2333;
      color: #58a6ff;
      cursor: pointer;
      font-size: 12px;
      font-family: system-ui, sans-serif;
      transition: all 0.2s;
    }
    .mentari-solve-btn:hover {
      background: #1f3a5f;
    }
    .mentari-solve-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .mentari-answer-box {
      margin-top: 6px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #0d2818;
      border: 1px solid #238636;
      color: #3fb950;
      font-size: 13px;
      line-height: 1.5;
      font-family: system-ui, sans-serif;
      word-wrap: break-word;
    }
    .mentari-answer-box.error {
      background: #2d1215;
      border-color: #f85149;
      color: #f85149;
    }
    .mentari-answer-box.loading {
      background: #1c2333;
      border-color: #58a6ff;
      color: #8b949e;
    }
  `;

  // Inject styles once
  function injectStyles() {
    if (document.getElementById('mentari-quiz-styles')) return;
    const style = document.createElement('style');
    style.id = 'mentari-quiz-styles';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  // Find question elements with multiple selector strategies
  function findQuestions() {
    const selectors = [
      '.question-item',
      '.quiz-question',
      '[class*="soal"]',
      '[class*="question"]',
      '.card-body:has(input[type="radio"])',
      'fieldset:has(input[type="radio"])',
    ];

    const questions = new Set();
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          // Skip if already has button or too small
          if (el.querySelector('.mentari-solve-btn')) return;
          if (el.innerText?.length < 10) return;
          questions.add(el);
        });
      } catch {}
    }
    return [...questions];
  }

  // Extract question text from container
  function extractQuestionText(container) {
    // Try multiple strategies
    const textSelectors = [
      '.question-text',
      '.soal-text',
      '.soal',
      'p:first-of-type',
      '.body',
      '.question-body',
      'label',
    ];

    for (const sel of textSelectors) {
      const el = container.querySelector(sel);
      if (el?.innerText?.trim().length > 10) {
        return el.innerText.trim();
      }
    }

    // Fallback: get all text, exclude radio labels
    const clone = container.cloneNode(true);
    clone
      .querySelectorAll(
        'input, button, .mentari-solve-btn, .mentari-answer-box'
      )
      .forEach((el) => el.remove());
    const text = clone.innerText?.trim();
    return text?.length > 10 ? text : null;
  }

  // Extract answer options if available
  function extractOptions(container) {
    const radios = container.querySelectorAll(
      'input[type="radio"]'
    );
    if (!radios.length) return null;

    const options = [];
    radios.forEach((radio) => {
      const label =
        radio.closest('label') ||
        container.querySelector(`label[for="${radio.id}"]`);
      const text = label?.innerText?.trim() || radio.value;
      if (text) {
        options.push({
          value: radio.value,
          label: text,
        });
      }
    });
    return options.length ? options : null;
  }

  // Solve a single question
  async function solveQuestion(btn, questionText, options) {
    const container = btn.closest(
      '[class*="question"], [class*="soal"], fieldset, .card-body'
    ) || btn.parentElement;

    // Remove existing answer box
    const existing = container.querySelector('.mentari-answer-box');
    if (existing) existing.remove();

    // Show loading
    const loadingBox = document.createElement('div');
    loadingBox.className = 'mentari-answer-box loading';
    loadingBox.textContent = '⏳ Memprojawab...';
    btn.after(loadingBox);

    btn.disabled = true;
    btn.innerHTML = '⏳';
    btn.style.borderColor = '#8b949e';

    try {
      const ai = window.__mentariAI;

      let prompt = questionText;
      if (options) {
        prompt +=
          '\n\nPilihan:\n' +
          options.map((o) => `- ${o.label}`).join('\n');
        prompt +=
          '\n\nJawab dengan huruf pilihan + alasan singkat 1-2 kalimat.';
      } else {
        prompt += '\n\nJawab singkat dan jelas.';
      }

      const answer = await ai.chat([
        {
          role: 'system',
          content:
            'Kamu asisten akademik. Jawab pertanyaan berikut. ' +
            'Jika pilihan ganda, sebutkan huruf jawaban diikuti alasan singkat. ' +
            'Jika essay, berikan jawaban ringkas.',
        },
        { role: 'user', content: prompt },
      ]);

      loadingBox.className = 'mentari-answer-box';
      loadingBox.innerHTML = formatAnswer(answer);

      btn.innerHTML = '✅';
      btn.style.borderColor = '#3fb950';
      btn.style.color = '#3fb950';
    } catch (e) {
      loadingBox.className = 'mentari-answer-box error';
      loadingBox.textContent = '❌ ' + e.message;

      btn.innerHTML = '❌';
      btn.style.borderColor = '#f85149';
      btn.disabled = false;
      btn.style.color = '#f85149';
    }
  }

  function formatAnswer(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // Add solve buttons to all questions
  function addSolveButtons() {
    const questions = findQuestions();

    questions.forEach((q) => {
      if (q.querySelector('.mentari-solve-btn')) return;

      const questionText = extractQuestionText(q);
      if (!questionText) return;

      const options = extractOptions(q);

      const btn = document.createElement('button');
      btn.className = 'mentari-solve-btn';
      btn.innerHTML = '🤖 Solve';
      btn.title = 'Gunakan AI untuk menjawab';

      btn.onclick = () => solveQuestion(btn, questionText, options);

      // Insert at top of container
      q.prepend(btn);
    });
  }

  // === Solve All Button ===
  function injectSolveAll() {
    if (document.getElementById('mentari-solve-all')) return;

    const container =
      document.querySelector('.quiz-actions, .exam-actions') ||
      document.querySelector('.card-header, .page-header');
    if (!container) return;

    const btn = document.createElement('button');
    btn.id = 'mentari-solve-all';
    btn.className = 'mentari-solve-btn';
    btn.innerHTML = '🤖 Solve All';
    btn.style.cssText += 'margin-left:8px;background:#1f3a5f;';
    btn.onclick = () => {
      document
        .querySelectorAll('.mentari-solve-btn:not(#mentari-solve-all)')
        .forEach((b, i) => {
          setTimeout(() => b.click(), i * 1500);
        });
    };
    container.appendChild(btn);
  }

  // === INIT ===
  waitForAI().then(() => {
    injectStyles();

    // Initial scan
    addSolveButtons();
    injectSolveAll();

    // Watch for dynamic content
    const observer = new MutationObserver(() => {
      addSolveButtons();
      injectSolveAll();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[MentariAI] Quiz enhancer loaded');
  });
})();
