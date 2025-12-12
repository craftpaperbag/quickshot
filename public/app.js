(() => {
  const defaultHeaders = [
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Authorization', value: '' },
  ];

  const elements = {
    requestName: document.getElementById('requestName'),
    method: document.getElementById('method'),
    url: document.getElementById('url'),
    headers: document.getElementById('headers'),
    addHeader: document.getElementById('addHeader'),
    jsonBody: document.getElementById('jsonBody'),
    yamlBody: document.getElementById('yamlBody'),
    formatJson: document.getElementById('formatJson'),
    convertYaml: document.getElementById('convertYaml'),
    send: document.getElementById('send'),
    reset: document.getElementById('reset'),
    statusLine: document.getElementById('statusLine'),
    timing: document.getElementById('timing'),
    responseBody: document.getElementById('responseBody'),
    responseHeaders: document.getElementById('responseHeaders'),
    errorDetails: document.getElementById('errorDetails'),
    downloadResponse: document.getElementById('downloadResponse'),
    copyResponse: document.getElementById('copyResponse'),
    saveSession: document.getElementById('saveSession'),
    loadSession: document.getElementById('loadSession'),
    exportSession: document.getElementById('exportSession'),
    importSession: document.getElementById('importSession'),
    autoSaveStatus: document.getElementById('autoSaveStatus'),
  };

  const tabs = Array.from(document.querySelectorAll('.tab'));
  const jsonTab = document.getElementById('jsonTab');
  const yamlTab = document.getElementById('yamlTab');

  let lastResponseText = '';
  let lastResponseFilename = '';

  function parseValue(raw) {
    const trimmed = raw.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { return JSON.parse(trimmed); } catch (_) { /* ignore */ }
    }
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  function yamlToJson(text) {
    const lines = text.split(/\r?\n/);
    const root = {};
    const stack = [{ indent: -1, container: root, parent: null, keyInParent: null }];

    const setValue = (parent, key, value) => {
      if (Array.isArray(parent)) {
        parent.push(value);
      } else if (parent && typeof parent === 'object') {
        parent[key] = value;
      }
    };

    for (let rawLine of lines) {
      if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
      const indent = rawLine.match(/^(\s*)/)[1].length;
      const content = rawLine.trim();

      while (stack.length && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      const ctx = stack[stack.length - 1];
      const parent = ctx.container;

      const convertPendingObjectToArray = (context) => {
        if (Array.isArray(context.container)) return;
        if (context.container && typeof context.container === 'object' && Object.keys(context.container).length === 0) {
          const arr = [];
          if (context.parent) {
            context.parent[context.keyInParent] = arr;
          }
          context.container = arr;
        }
      };

      if (content.startsWith('- ')) {
        convertPendingObjectToArray(ctx);
        if (!Array.isArray(ctx.container)) throw new Error('配列の配置に誤りがあります');
        const valuePart = content.slice(2).trim();
        if (!valuePart) {
          const obj = {};
          ctx.container.push(obj);
          stack.push({ indent, container: obj, parent: ctx.container, keyInParent: ctx.container.length - 1 });
          continue;
        }
        const kvMatch = valuePart.match(/([^:]+):\s*(.*)/);
        if (kvMatch) {
          const obj = {};
          const [, k, v] = kvMatch;
          obj[k.trim()] = v ? parseValue(v) : '';
          ctx.container.push(obj);
          stack.push({ indent, container: obj, parent: ctx.container, keyInParent: ctx.container.length - 1 });
        } else {
          ctx.container.push(parseValue(valuePart));
        }
        continue;
      }

      const kv = content.match(/([^:]+):\s*(.*)?/);
      if (kv) {
        const [, key, value] = kv;
        if (value === undefined || value === '') {
          const obj = {};
          setValue(parent, key.trim(), obj);
          stack.push({ indent, container: obj, parent, keyInParent: key.trim() });
        } else {
          setValue(parent, key.trim(), parseValue(value));
        }
      }
    }

    return root;
  }

  function showStatus(text, type = 'info') {
    elements.statusLine.textContent = text;
    elements.statusLine.className = `badge ${type}`;
  }

  function pretty(json) {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch (_) {
      return json;
    }
  }

  function buildHeaderRow(key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'header-row';
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = 'Header 名';
    keyInput.value = key;
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.placeholder = '値';
    valueInput.value = value;
    const remove = document.createElement('button');
    remove.className = 'ghost';
    remove.textContent = '削除';
    remove.addEventListener('click', () => row.remove());

    [keyInput, valueInput].forEach((el) => el.addEventListener('change', autoSave));

    row.append(keyInput, valueInput, remove);
    return row;
  }

  function renderHeaders(headers = defaultHeaders) {
    elements.headers.innerHTML = '';
    headers.forEach(({ key, value }) => elements.headers.appendChild(buildHeaderRow(key, value)));
  }

  function collectHeaders() {
    const rows = elements.headers.querySelectorAll('.header-row');
    const headers = {};
    rows.forEach((row) => {
      const [keyInput, valueInput] = row.querySelectorAll('input');
      if (keyInput.value.trim()) headers[keyInput.value.trim()] = valueInput.value;
    });
    return headers;
  }

  function download(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function saveSession(manual = false) {
    const session = {
      requestName: elements.requestName.value,
      method: elements.method.value,
      url: elements.url.value,
      headers: Array.from(elements.headers.querySelectorAll('.header-row')).map((row) => {
        const [k, v] = row.querySelectorAll('input');
        return { key: k.value, value: v.value };
      }),
      jsonBody: elements.jsonBody.value,
      yamlBody: elements.yamlBody.value,
      timestamp: Date.now(),
    };
    localStorage.setItem('quickshot-session', JSON.stringify(session));
    elements.autoSaveStatus.textContent = manual ? '保存済み' : '自動保存しました';
    elements.autoSaveStatus.classList.add('saved');
  }

  function loadSession(showMessage = true) {
    const raw = localStorage.getItem('quickshot-session');
    if (!raw) return;
    const session = JSON.parse(raw);
    elements.requestName.value = session.requestName || '';
    elements.method.value = session.method || 'GET';
    elements.url.value = session.url || '';
    renderHeaders(session.headers && session.headers.length ? session.headers : defaultHeaders);
    elements.jsonBody.value = session.jsonBody || '';
    elements.yamlBody.value = session.yamlBody || '';
    if (showMessage) {
      elements.autoSaveStatus.textContent = '復元しました';
    }
  }

  function autoSave() {
    saveSession(false);
  }

  async function sendRequest() {
    const method = elements.method.value;
    const url = elements.url.value;
    const headers = collectHeaders();
    let body;
    if (elements.jsonBody.value.trim()) {
      try {
        body = JSON.stringify(JSON.parse(elements.jsonBody.value));
      } catch (err) {
        showStatus('JSONの整形に失敗しました', 'error');
        elements.errorDetails.textContent = err.message;
        return;
      }
    }

    elements.responseBody.textContent = '送信中...';
    elements.responseHeaders.textContent = '';
    elements.errorDetails.textContent = '';
    showStatus('送信中', 'info');
    const start = performance.now();

    try {
      const response = await fetch(url, { method, headers, body: method === 'GET' || method === 'DELETE' ? undefined : body });
      const elapsed = Math.round(performance.now() - start);
      elements.timing.textContent = `${elapsed} ms`; 
      const text = await response.text();
      lastResponseText = text;
      lastResponseFilename = `${(elements.requestName.value || 'response').replace(/\s+/g, '-')}.json`;

      let prettyBody = text;
      try {
        prettyBody = JSON.stringify(JSON.parse(text), null, 2);
      } catch (_) {
        // keep raw
      }
      elements.responseBody.textContent = prettyBody || '(空のレスポンス)';
      elements.responseHeaders.textContent = Array.from(response.headers.entries())
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      elements.statusLine.textContent = `${response.status} ${response.statusText || ''}`;
      elements.statusLine.className = `badge ${response.ok ? 'success' : 'error'}`;
      elements.copyResponse.disabled = false;
      elements.downloadResponse.disabled = false;
    } catch (err) {
      elements.timing.textContent = '-';
      elements.statusLine.textContent = '送信に失敗しました';
      elements.statusLine.className = 'badge error';
      elements.responseBody.textContent = '';
      elements.errorDetails.textContent = err.stack || err.message;
      lastResponseText = '';
      elements.copyResponse.disabled = true;
      elements.downloadResponse.disabled = true;
    }
  }

  function resetForm() {
    elements.requestName.value = '';
    elements.method.value = 'GET';
    elements.url.value = '';
    elements.jsonBody.value = '';
    elements.yamlBody.value = '';
    renderHeaders(defaultHeaders);
    elements.responseBody.textContent = 'ここに結果が表示されます。';
    elements.responseHeaders.textContent = '';
    elements.errorDetails.textContent = '';
    elements.statusLine.textContent = '未送信';
    elements.statusLine.className = 'badge muted';
    elements.copyResponse.disabled = true;
    elements.downloadResponse.disabled = true;
    elements.timing.textContent = '-';
  }

  function exportSession() {
    const raw = localStorage.getItem('quickshot-session');
    if (!raw) return;
    download('quickshot-session.json', raw);
  }

  function importSession(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      localStorage.setItem('quickshot-session', e.target.result);
      loadSession();
    };
    reader.readAsText(file);
  }

  function copyResponse() {
    if (!lastResponseText) return;
    navigator.clipboard.writeText(lastResponseText);
    showStatus('レスポンスをコピーしました', 'info');
  }

  function downloadResponse() {
    if (!lastResponseText) return;
    download(lastResponseFilename || 'response.json', lastResponseText);
  }

  function handleTabSwitch(tab) {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    if (tab.dataset.tab === 'json') {
      jsonTab.classList.remove('hidden');
      yamlTab.classList.add('hidden');
    } else {
      yamlTab.classList.remove('hidden');
      jsonTab.classList.add('hidden');
    }
  }

  function formatJson() {
    if (!elements.jsonBody.value.trim()) return;
    elements.jsonBody.value = pretty(elements.jsonBody.value);
    autoSave();
  }

  function convertYaml() {
    if (!elements.yamlBody.value.trim()) return;
    try {
      const obj = yamlToJson(elements.yamlBody.value);
      elements.jsonBody.value = JSON.stringify(obj, null, 2);
      handleTabSwitch(tabs.find((t) => t.dataset.tab === 'json'));
      showStatus('YAMLをJSONに変換しました', 'info');
      autoSave();
    } catch (err) {
      elements.errorDetails.textContent = err.message;
      showStatus('YAMLの読み取りでエラー', 'error');
    }
  }

  elements.addHeader.addEventListener('click', () => elements.headers.appendChild(buildHeaderRow()));
  elements.formatJson.addEventListener('click', formatJson);
  elements.convertYaml.addEventListener('click', convertYaml);
  elements.send.addEventListener('click', sendRequest);
  elements.reset.addEventListener('click', resetForm);
  elements.saveSession.addEventListener('click', () => saveSession(true));
  elements.loadSession.addEventListener('click', () => loadSession(true));
  elements.exportSession.addEventListener('click', exportSession);
  elements.importSession.addEventListener('change', importSession);
  elements.copyResponse.addEventListener('click', copyResponse);
  elements.downloadResponse.addEventListener('click', downloadResponse);
  tabs.forEach((tab) => tab.addEventListener('click', () => handleTabSwitch(tab)));

  [elements.requestName, elements.method, elements.url, elements.jsonBody, elements.yamlBody].forEach((el) => {
    el.addEventListener('change', autoSave);
  });

  renderHeaders();
  loadSession(false);
})();
