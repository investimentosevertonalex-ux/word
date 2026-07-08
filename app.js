// ================= Word (PWA) — cliente OpenRouter =================
const $ = (id) => document.getElementById(id);
const doc = $('doc');
const scroller = document.querySelector('.canvas');
const input = $('input');
const fileInput = $('file-input');
const attachmentsEl = $('attachments');
const wordCount = $('word-count');
const overlay = $('overlay');
const setKey = $('set-key');
const setModel = $('set-model');
const setSystem = $('set-system');
const setTemp = $('set-temp');
const setTempVal = $('set-temp-val');
const setEffort = $('set-effort');
const modelsDatalist = $('models-datalist');
const refreshStatus = $('refresh-status');

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CFG_KEY = 'wordapp.config';

let config = { apiKey: '', model: '~anthropic/claude-sonnet-latest', systemPrompt: '', temperature: 0.7, effort: '' };
let messages = [];
let attachments = [];
let attachSeq = 0;
const stream = { el: null, raw: '', active: false, controller: null };

// ---------- Config (localStorage) ----------
function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (_e) { return {}; }
}
function persist() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(config)); } catch (_e) {}
}

// ---------- Markdown ----------
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function renderInline(t) {
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t;
}
function md(src) {
  const codeBlocks = [];
  src = src.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _l, code) => {
    const i = codeBlocks.length;
    codeBlocks.push('<pre><code>' + escapeHtml(code.replace(/\n$/, '')) + '</code></pre>');
    return '\nCB' + i + '\n';
  });
  const lines = src.split('\n'); const out = []; let listType = null; let para = [];
  const closeList = () => { if (listType) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); listType = null; } };
  const flushPara = () => { if (para.length) { out.push('<p>' + renderInline(escapeHtml(para.join('\n')).replace(/\n/g, '<br>')) + '</p>'); para = []; } };
  for (const line of lines) {
    const t = line.replace(/\s+$/, ''); const tr = t.trim();
    const cb = tr.match(/^CB(\d+)$/);
    if (cb) { flushPara(); closeList(); out.push(codeBlocks[Number(cb[1])]); continue; }
    if (tr === '') { flushPara(); closeList(); continue; }
    let m;
    if ((m = tr.match(/^(#{1,6})\s+(.*)$/))) { flushPara(); closeList(); const lv = Math.min(m[1].length, 3); out.push('<h' + lv + '>' + renderInline(escapeHtml(m[2])) + '</h' + lv + '>'); }
    else if ((m = tr.match(/^[-*+]\s+(.*)$/))) { flushPara(); if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; } out.push('<li>' + renderInline(escapeHtml(m[1])) + '</li>'); }
    else if ((m = tr.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; } out.push('<li>' + renderInline(escapeHtml(m[1])) + '</li>'); }
    else if ((m = tr.match(/^>\s?(.*)$/))) { flushPara(); closeList(); out.push('<blockquote>' + renderInline(escapeHtml(m[1])) + '</blockquote>'); }
    else para.push(t);
  }
  flushPara(); closeList();
  return out.join('\n');
}

// ---------- Mensagens ----------
function scrollDown() { scroller.scrollTop = scroller.scrollHeight; }
function addMessage(role) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;
  const body = document.createElement('div');
  body.className = 'msg-body';
  wrap.appendChild(body);
  doc.appendChild(wrap);
  scrollDown();
  return body;
}
function msgText(m) {
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) return m.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ');
  return '';
}
function updateWordCount() {
  const text = messages.map(msgText).join(' ') + ' ' + (stream.raw || '');
  const n = (text.trim().match(/\S+/g) || []).length;
  wordCount.textContent = n + (n === 1 ? ' palavra' : ' palavras');
}
function setSending(active) {
  stream.active = active;
}

// ---------- Anexos ----------
function readFile(file) {
  return new Promise((resolve) => {
    const name = file.name || 'arquivo';
    const isImage = (file.type || '').startsWith('image/');
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(name);
    const isText = (file.type || '').startsWith('text/') || /\.(txt|md|markdown|csv|json|js|ts|jsx|tsx|py|html|css|xml|yml|yaml|sql|log|c|cpp|java|sh)$/i.test(name);
    const r = new FileReader();
    if (isImage || isPdf) { r.onload = () => resolve({ id: ++attachSeq, kind: isImage ? 'image' : 'pdf', name, dataUrl: r.result }); r.onerror = () => resolve(null); r.readAsDataURL(file); }
    else if (isText) { r.onload = () => resolve({ id: ++attachSeq, kind: 'text', name, text: String(r.result).slice(0, 200000) }); r.onerror = () => resolve(null); r.readAsText(file); }
    else resolve({ id: ++attachSeq, kind: 'unsupported', name });
  });
}
async function addFiles(list) {
  for (const f of Array.from(list || [])) {
    const a = await readFile(f);
    if (!a) continue;
    if (a.kind === 'unsupported') { alert('Tipo nao suportado: ' + a.name); continue; }
    attachments.push(a);
  }
  renderAttachments();
}
function renderAttachments() {
  attachmentsEl.innerHTML = '';
  for (const a of attachments) {
    const chip = document.createElement('span'); chip.className = 'chip';
    if (a.kind === 'image') { const im = document.createElement('img'); im.src = a.dataUrl; chip.appendChild(im); }
    else { const ic = document.createElement('i'); ic.className = 'cico fa-solid ' + (a.kind === 'pdf' ? 'fa-file-pdf' : 'fa-file-lines'); chip.appendChild(ic); }
    const nm = document.createElement('span'); nm.className = 'cname'; nm.textContent = a.name; chip.appendChild(nm);
    const rm = document.createElement('button'); rm.className = 'rm'; rm.innerHTML = '&times;';
    rm.addEventListener('click', () => { attachments = attachments.filter((x) => x.id !== a.id); renderAttachments(); });
    chip.appendChild(rm); attachmentsEl.appendChild(chip);
  }
}

// ---------- Envio (streaming direto do navegador) ----------
async function sendMessage() {
  if (stream.active) { if (stream.controller) stream.controller.abort(); return; }
  const text = input.value.trim();
  if (!text && attachments.length === 0) return;
  if (!config.apiKey) { openSettings(); refreshStatus.textContent = 'Cole sua chave da API para comecar.'; return; }

  const atts = attachments.slice();
  const userBody = addMessage('user');
  if (text) { const tx = document.createElement('div'); tx.textContent = text; userBody.appendChild(tx); }
  if (atts.length) {
    const box = document.createElement('div'); box.className = 'msg-attach';
    for (const a of atts) {
      if (a.kind === 'image') { const im = document.createElement('img'); im.src = a.dataUrl; box.appendChild(im); }
      else { const c = document.createElement('span'); c.className = 'fchip'; const ic = document.createElement('i'); ic.className = 'fa-solid ' + (a.kind === 'pdf' ? 'fa-file-pdf' : 'fa-file-lines'); c.appendChild(ic); c.append(' ' + a.name); box.appendChild(c); }
    }
    userBody.appendChild(box);
  }

  let content;
  if (atts.length === 0) content = text;
  else {
    const parts = [{ type: 'text', text: text || 'Segue o anexo.' }];
    for (const a of atts) {
      if (a.kind === 'image') parts.push({ type: 'image_url', image_url: { url: a.dataUrl } });
      else if (a.kind === 'pdf') parts.push({ type: 'file', file: { filename: a.name, file_data: a.dataUrl } });
      else if (a.kind === 'text') parts.push({ type: 'text', text: 'Arquivo anexado "' + a.name + '":\n\n' + a.text });
    }
    content = parts;
  }
  messages.push({ role: 'user', content });

  input.value = ''; attachments = []; renderAttachments(); autosize(); updateWordCount();

  stream.el = addMessage('assistant');
  stream.el.classList.add('cursor-blink');
  stream.raw = '';
  setSending(true);

  const payloadMessages = [];
  if (config.systemPrompt && config.systemPrompt.trim()) payloadMessages.push({ role: 'system', content: config.systemPrompt.trim() });
  for (const m of messages) payloadMessages.push(m);

  const body = { model: config.model || '~anthropic/claude-sonnet-latest', messages: payloadMessages, stream: true };
  if (typeof config.temperature === 'number' && !Number.isNaN(config.temperature)) body.temperature = config.temperature;
  if (config.effort) body.reasoning = { effort: config.effort };

  stream.controller = new AbortController();
  try {
    const res = await fetch(OPENROUTER, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + config.apiKey, 'Content-Type': 'application/json', 'X-Title': 'Word' },
      body: JSON.stringify(body),
      signal: stream.controller.signal
    });
    if (!res.ok) {
      let d = ''; try { d = await res.text(); } catch (_e) {}
      throw new Error('Erro ' + res.status + ': ' + (d || res.statusText));
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') { finishStream(); return; }
        try { const j = JSON.parse(data); const delta = j.choices && j.choices[0] && j.choices[0].delta; if (delta && delta.content) { stream.raw += delta.content; stream.el.innerHTML = md(stream.raw); scrollDown(); updateWordCount(); } } catch (_e) {}
      }
    }
    finishStream();
  } catch (err) {
    if (err && err.name === 'AbortError') { finishStream(); return; }
    if (stream.el) { const w = stream.el.closest('.msg'); w.classList.remove('assistant'); w.classList.add('error'); stream.el.classList.remove('cursor-blink'); stream.el.textContent = String(err.message || err); }
    stream.raw = ''; stream.el = null; setSending(false);
  }
}
function finishStream() {
  if (!stream.el) { setSending(false); return; }
  stream.el.classList.remove('cursor-blink');
  if (stream.raw.trim()) { stream.el.innerHTML = md(stream.raw); messages.push({ role: 'assistant', content: stream.raw }); }
  else stream.el.innerHTML = '<p><em>(sem resposta)</em></p>';
  stream.raw = ''; stream.el = null; setSending(false); updateWordCount();
}

// ---------- Configuracoes ----------
function openSettings() {
  setKey.value = config.apiKey || '';
  setModel.value = config.model || '';
  setSystem.value = config.systemPrompt || '';
  setTemp.value = config.temperature != null ? config.temperature : 0.7;
  setTempVal.textContent = setTemp.value;
  setEffort.value = config.effort || '';
  refreshStatus.textContent = '';
  overlay.classList.add('show');
}
function closeSettings() { overlay.classList.remove('show'); }
function saveSettings() {
  config.apiKey = setKey.value.trim();
  config.model = setModel.value.trim() || '~anthropic/claude-sonnet-latest';
  config.systemPrompt = setSystem.value;
  config.temperature = Number(setTemp.value);
  config.effort = setEffort.value;
  persist();
  closeSettings();
  loadModels();
}
async function loadModels() {
  try {
    const res = await fetch(MODELS_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const models = (data.data || []).map((m) => m.id).sort();
    modelsDatalist.innerHTML = '';
    for (const id of models) { const o = document.createElement('option'); o.value = id; modelsDatalist.appendChild(o); }
    refreshStatus.textContent = models.length + ' modelos carregados.';
  } catch (e) { refreshStatus.textContent = 'Nao foi possivel carregar a lista. Digite o slug manualmente.'; }
}

// ---------- Textarea ----------
function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; }

// ---------- Novo documento ----------
function newDoc() { messages = []; attachments = []; renderAttachments(); stream.raw = ''; stream.el = null; doc.innerHTML = ''; updateWordCount(); input.focus(); }

// ---------- Eventos ----------
const btnBold = $('btn-bold');
const composerEl = document.querySelector('.composer');
if (btnBold && composerEl) {
  btnBold.classList.add('active');
  btnBold.addEventListener('click', () => {
    const hidden = composerEl.classList.toggle('hidden');
    btnBold.classList.toggle('active', !hidden);
    if (!hidden) input.focus();
  });
}
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
input.addEventListener('input', autosize);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  else if (e.key === 'Escape' && stream.active && stream.controller) { e.preventDefault(); stream.controller.abort(); }
});
input.addEventListener('paste', (e) => {
  const items = (e.clipboardData && e.clipboardData.items) || [];
  const imgs = [];
  for (const it of items) { if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) imgs.push(f); } }
  if (imgs.length) { e.preventDefault(); addFiles(imgs); }
});
$('btn-settings').addEventListener('click', openSettings);
$('btn-close').addEventListener('click', closeSettings);
$('btn-cancel').addEventListener('click', closeSettings);
$('btn-save').addEventListener('click', saveSettings);
$('btn-refresh').addEventListener('click', () => { refreshStatus.textContent = 'Carregando...'; loadModels(); });
$('tab-arquivo').addEventListener('click', newDoc);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });
setTemp.addEventListener('input', () => { setTempVal.textContent = setTemp.value; });

// ---------- Init ----------
config = Object.assign(config, loadConfig());
updateWordCount();
loadModels();
if (!config.apiKey) setTimeout(openSettings, 400);

// ---------- Service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
