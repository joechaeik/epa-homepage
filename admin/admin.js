// ════════════════════════════════════════════════════════════
//  EPA Lab Admin Panel  |  admin/admin.js
//  GitHub API 기반 콘텐츠 관리 시스템
// ════════════════════════════════════════════════════════════

// ── 설정 ───────────────────────────────────────────────────
// ⚠️  비밀번호를 반드시 변경하세요! 이 파일은 공개 GitHub 리포에 저장됩니다.
//    실제 보안은 GitHub PAT가 담당하며, 비밀번호는 UI 보호용입니다.
const CONFIG = {
  owner:   'joechaeik',
  repo:    'epa-homepage',
  branch:  'main',
  password: 'epalab2025',          // ← 여기서 비밀번호 변경!
  galleryDir:      'images/gallery',
  publicationsDir: 'images/publications',
  membersDir:      'images/members',
  newsDir:         'images/news',
  cvDir:           'files/cv',
};

// ── 상태 ───────────────────────────────────────────────────
let state = { section: 'publications' };

// ════════════════════════════════════════════════════════════
//  GitHub API
// ════════════════════════════════════════════════════════════
function getPAT() { return sessionStorage.getItem('epa_pat') || ''; }
function setPAT(t) { sessionStorage.setItem('epa_pat', t); }

async function ghFetch(path, options = {}) {
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      'Authorization': `token ${getPAT()}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `GitHub API ${res.status}`);
  return json;
}

// 파일 읽기 → { content: string, sha: string }
async function ghRead(path) {
  const file = await ghFetch(path + `?ref=${CONFIG.branch}`);
  const content = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
  return { content, sha: file.sha };
}

// 파일 쓰기 (sha 있으면 업데이트, 없으면 생성)
async function ghWrite(path, content, sha, message) {
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: CONFIG.branch,
  };
  if (sha) body.sha = sha;
  return ghFetch(path, { method: 'PUT', body: JSON.stringify(body) });
}

// 이미지 파일 업로드 → 업로드된 raw URL 반환
const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB

async function ghUploadImage(repoPath, file) {
  if (file.size > MAX_IMG_BYTES) {
    throw new Error(`파일 크기 초과: ${(file.size/1024/1024).toFixed(1)} MB (최대 5 MB)`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        let sha;
        try { sha = (await ghFetch(repoPath + `?ref=${CONFIG.branch}`)).sha; } catch (_) {}
        const body = { message: `Upload: ${repoPath}`, content: base64, branch: CONFIG.branch };
        if (sha) body.sha = sha;
        const res = await ghFetch(repoPath, { method: 'PUT', body: JSON.stringify(body) });
        resolve(res.content.download_url);
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 데이터 파일 파싱 헬퍼 ──────────────────────────────────
// JS 파일을 실행해서 변수값을 추출
function parseVar(jsContent, varName) {
  try {
    const fn = new Function(jsContent + `\n; return typeof ${varName} !== 'undefined' ? ${varName} : null;`);
    return fn();
  } catch (e) {
    console.error(`parseVar(${varName}) failed:`, e);
    return null;
  }
}

// JS 배열/객체를 var 선언 형태 문자열로 직렬화
function toJSFile(varName, data) {
  return `var ${varName} = ${JSON.stringify(data, null, 2)};\n`;
}

// news.js는 NEWS + MEDIA 두 변수를 포함
function toNewsFile(news, media) {
  return `var NEWS = ${JSON.stringify(news, null, 2)};\n\nvar MEDIA = ${JSON.stringify(media, null, 2)};\n`;
}

// ────────────────────────────────────────────────────────────
// 각 데이터 파일 읽기/쓰기 래퍼
// ────────────────────────────────────────────────────────────
async function readFile(filename, varName, fallback = []) {
  try {
    const { content, sha } = await ghRead(`data/${filename}`);
    return { data: parseVar(content, varName) ?? fallback, sha };
  } catch (e) {
    if (e.message.includes('Not Found') || e.message.includes('404')) return { data: fallback, sha: null };
    throw e;
  }
}

async function saveFile(filename, varName, data, message) {
  let sha = null;
  try { sha = (await ghRead(`data/${filename}`)).sha; } catch (_) {}
  await ghWrite(`data/${filename}`, toJSFile(varName, data), sha, message);
}

async function readNewsFile() {
  try {
    const { content, sha } = await ghRead('data/news.js');
    return {
      news:  parseVar(content, 'NEWS')  ?? [],
      media: parseVar(content, 'MEDIA') ?? [],
      sha,
    };
  } catch (_) { return { news: [], media: [], sha: null }; }
}

async function saveNewsFile(news, media, message) {
  let sha = null;
  try { sha = (await ghRead('data/news.js')).sha; } catch (_) {}
  await ghWrite('data/news.js', toNewsFile(news, media), sha, message);
}

// ════════════════════════════════════════════════════════════
//  UI 헬퍼
// ════════════════════════════════════════════════════════════
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 4000);
}

function setLoading(btn, on) {
  if (on) { btn._orig = btn.textContent; btn.textContent = '저장 중…'; btn.disabled = true; }
  else { btn.textContent = btn._orig ?? '저장'; btn.disabled = false; }
}

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

// ════════════════════════════════════════════════════════════
//  로그인
// ════════════════════════════════════════════════════════════
function renderLogin() {
  $('#app').innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">🌿 <span>EPA</span> Lab Admin</div>
        <p class="login-sub">KENTECH · Eco-friendly Photoenergy Application Laboratory</p>
        <form id="login-form">
          <div class="form-group">
            <label>비밀번호</label>
            <input type="password" id="inp-pw" placeholder="Admin password" autocomplete="current-password" />
          </div>
          <div class="form-group">
            <label>GitHub Personal Access Token
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=EPA+Lab+Admin"
                 target="_blank" class="help-link">↗ 발급하기 (repo 권한 필요)</a>
            </label>
            <input type="password" id="inp-pat" placeholder="ghp_xxxxxxxxxxxx" />
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top:.5rem">로그인</button>
          <p id="login-err" class="error-msg"></p>
        </form>
      </div>
    </div>`;

  $('#login-form').onsubmit = (e) => {
    e.preventDefault();
    const pw  = $('#inp-pw').value;
    const pat = $('#inp-pat').value.trim();
    if (pw !== CONFIG.password) { $('#login-err').textContent = '비밀번호가 틀렸습니다.'; return; }
    if (!pat) { $('#login-err').textContent = 'GitHub PAT를 입력하세요.'; return; }
    setPAT(pat);
    renderDashboard();
  };
}

// ════════════════════════════════════════════════════════════
//  대시보드 레이아웃
// ════════════════════════════════════════════════════════════
const TABS = [
  { id: 'publications', label: '📄 Publications' },
  { id: 'news',         label: '📰 News' },
  { id: 'gallery',      label: '🖼️ Gallery' },
  { id: 'members',      label: '👥 Members' },
  { id: 'research',     label: '🔬 Research' },
];

function renderDashboard() {
  $('#app').innerHTML = `
    <div class="admin-layout">
      <header class="admin-header">
        <div class="header-brand">🌿 EPA Admin</div>
        <nav class="header-nav">
          ${TABS.map(t => `
            <button class="nav-tab${state.section === t.id ? ' active' : ''}"
                    data-tab="${t.id}">${t.label}</button>`).join('')}
        </nav>
        <button class="logout-btn" id="logout-btn">로그아웃</button>
      </header>
      <main class="admin-main">
        <div id="sec"></div>
      </main>
      <div id="toast" class="toast"></div>
      <div id="modal-overlay" class="modal-overlay hidden"></div>
    </div>`;

  $$('.nav-tab').forEach(btn => btn.onclick = () => {
    state.section = btn.dataset.tab;
    $$('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === state.section));
    loadSection();
  });

  $('#logout-btn').onclick = () => { sessionStorage.removeItem('epa_pat'); renderLogin(); };
  loadSection();
}

function loadSection() {
  const fns = { publications: secPublications, news: secNews, gallery: secGallery, members: secMembers, research: secResearch };
  fns[state.section]();
}

// ════════════════════════════════════════════════════════════
//  모달
// ════════════════════════════════════════════════════════════
function openModal(title, bodyHTML, onSubmit) {
  const overlay = $('#modal-overlay');
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" id="mc">✕</button>
      </div>
      <div class="modal-body">
        <form id="mf" novalidate>
          ${bodyHTML}
          <div class="form-actions">
            <button type="button" class="btn btn-outline" id="mc2">취소</button>
            <button type="submit" class="btn btn-primary" id="ms">저장</button>
          </div>
        </form>
      </div>
    </div>`;
  overlay.classList.remove('hidden');
  $('#mc').onclick = $('#mc2').onclick = closeModal;
  $('#mf').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#ms');
    setLoading(btn, true);
    try   { await onSubmit($('#mf')); closeModal(); }
    catch (err) { showToast('오류: ' + err.message, 'error'); setLoading(btn, false); }
  };
}

function closeModal() {
  const o = $('#modal-overlay');
  o.classList.add('hidden');
  o.innerHTML = '';
}

// ── 공통 삭제 ──────────────────────────────────────────────
async function deleteItem(filename, varName, arr, idx, label, reload) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  const updated = arr.filter((_, i) => i !== idx);
  try {
    await saveFile(filename, varName, updated, `Delete ${label} #${idx}`);
    showToast('삭제됐습니다.');
    reload();
  } catch (e) { showToast('오류: ' + e.message, 'error'); }
}

// ════════════════════════════════════════════════════════════
//  ① PUBLICATIONS
// ════════════════════════════════════════════════════════════
async function secPublications() {
  const el = $('#sec');
  el.innerHTML = '<div class="loading">불러오는 중…</div>';
  const { data: items } = await readFile('publications.js', 'PUBLICATIONS');
  let pubs = [...items];
  let dragSrcIdx = null;

  function renderList() {
    const list = $('#pub-list');
    if (!list) return;
    list.innerHTML = pubs.map((p, i) => `
      <div class="item-row" draggable="true" data-idx="${i}">
        <div class="drag-handle" title="드래그로 순서 변경">⠿</div>
        <div class="item-main">
          <div class="item-badge">
            <span class="badge">${p.year}</span>
            <span>${esc(p.journal)}</span>
          </div>
          <div class="item-title">${p.title}</div>
          <div class="item-sub">${esc(p.authors ?? '')}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-sm btn-outline" data-edit="${i}">수정</button>
          <button class="btn btn-sm btn-danger"  data-del="${i}">삭제</button>
        </div>
      </div>`).join('');

    $$('.item-row', list).forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrcIdx = +item.dataset.idx;
        setTimeout(() => item.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        $$('.item-row', list).forEach(i => i.classList.remove('dragging', 'drag-over'));
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        $$('.item-row', list).forEach(i => i.classList.remove('drag-over'));
        if (+item.dataset.idx !== dragSrcIdx) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => {
        e.preventDefault();
        const destIdx = +item.dataset.idx;
        if (dragSrcIdx === null || dragSrcIdx === destIdx) return;
        const [moved] = pubs.splice(dragSrcIdx, 1);
        pubs.splice(destIdx, 0, moved);
        const saveBtn = $('#save-order-pub');
        if (saveBtn) { saveBtn.style.display = ''; saveBtn.className = 'btn btn-primary'; }
        renderList();
      });
    });

    $$('[data-edit]', list).forEach(b => b.onclick = () => pubForm(pubs, pubs[+b.dataset.edit], +b.dataset.edit));
    $$('[data-del]',  list).forEach(b => b.onclick = () =>
      deleteItem('publications.js', 'PUBLICATIONS', pubs, +b.dataset.del, 'pub', secPublications));
  }

  el.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Publications</h2>
        <p class="section-sub">총 ${pubs.length}편 · 드래그(⠿)로 순서 변경 가능 · 저장 시 GitHub Pages 자동 배포 (~2분 소요)</p>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center">
        <button class="btn btn-outline" id="save-order-pub" style="display:none">순서 저장</button>
        <button class="btn btn-primary" id="add-pub">+ 논문 추가</button>
      </div>
    </div>
    <div class="item-list" id="pub-list"></div>`;

  renderList();

  $('#add-pub').onclick = () => pubForm(pubs, null, -1);
  $('#save-order-pub').onclick = async () => {
    const btn = $('#save-order-pub');
    btn.textContent = '저장 중…';
    btn.disabled = true;
    try {
      await saveFile('publications.js', 'PUBLICATIONS', pubs, 'Reorder publications');
      showToast('순서가 저장됐습니다!');
      btn.style.display = 'none';
    } catch (e) {
      showToast('오류: ' + e.message, 'error');
    } finally {
      btn.textContent = '순서 저장';
      btn.disabled = false;
    }
  };
}

function pubForm(pubs, item, idx) {
  const isNew = !item;
  item = item || {};
  openModal(isNew ? '논문 추가' : '논문 수정', `
    <div class="form-row">
      <div class="form-group" style="flex:0 0 110px">
        <label>연도 *</label>
        <input type="number" name="year" value="${item.year || new Date().getFullYear()}"
               min="1990" max="2100" required />
      </div>
      <div class="form-group">
        <label>저널 약어 *</label>
        <input type="text" name="journal" value="${esc(item.journal)}" required placeholder="ACS Catalysis" />
      </div>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;justify-content:space-between;gap:.5rem">
        논문 제목 *
        <span style="display:flex;gap:4px;flex-shrink:0">
          <button type="button" id="btn-sup" class="btn btn-sm btn-outline"
                  style="padding:2px 9px;font-size:.72rem;line-height:1.5"
                  title="위 첨자 (superscript)">위첨자</button>
          <button type="button" id="btn-sub" class="btn btn-sm btn-outline"
                  style="padding:2px 9px;font-size:.72rem;line-height:1.5"
                  title="아래 첨자 (subscript)">아래 첨자</button>
        </span>
      </label>
      <textarea id="pub-title-input" name="title" rows="2" required>${esc(item.title)}</textarea>
    </div>
    <div class="form-group">
      <label>저자 *</label>
      <input type="text" name="authors" value="${esc(item.authors)}" required placeholder="Kim B, Lee M, Choi W*" />
    </div>
    <div class="form-group">
      <label>저널 상세 (권호, 페이지, 연도)</label>
      <input type="text" name="journal_info" value="${esc(item.journal_info)}" placeholder="15, 1234–1245, 2025" />
    </div>
    <div class="form-group">
      <label>DOI URL</label>
      <input type="url" name="doi" value="${esc(item.doi)}" placeholder="https://doi.org/10.xxxx/…" />
    </div>
    <div class="form-group">
      <label>Graphical Abstract URL <span class="label-hint">(외부 URL 입력 또는 아래에서 업로드)</span></label>
      <input type="text" id="pub-img-url" name="image" value="${esc(item.image)}" placeholder="https://…" />
    </div>
    <div class="form-group">
      <label>파일 직접 업로드 <span class="label-hint">(GitHub images/publications/ 에 저장)</span></label>
      <input type="file" id="pub-img-file" accept="image/*" />
      <div id="pub-up-status" class="upload-status"></div>
    </div>`,
  async (form) => {
    const fileInput = $('#pub-img-file');
    const statusEl  = $('#pub-up-status');
    let image = $('#pub-img-url').value.trim();

    if (fileInput.files[0] && !image) {
      statusEl.textContent = '업로드 중…';
      const f    = fileInput.files[0];
      const name = `${Date.now()}_${f.name.replace(/\s+/g, '_')}`;
      image = await ghUploadImage(`${CONFIG.publicationsDir}/${name}`, f);
    }

    const entry = {
      year:         +form.year.value,
      title:        form.title.value.trim(),
      journal:      form.journal.value.trim(),
      journal_info: form.journal_info.value.trim(),
      authors:      form.authors.value.trim(),
      doi:          form.doi.value.trim(),
      image,
    };
    const updated = [...pubs];
    if (isNew) updated.unshift(entry); else updated[idx] = entry;
    await saveFile('publications.js', 'PUBLICATIONS', updated,
      `${isNew ? 'Add' : 'Update'} pub: ${entry.title.slice(0, 60)}`);
    showToast('저장됐습니다! 약 2분 후 반영됩니다.');
    secPublications();
  });

  setTimeout(() => {
    // Sup / Sub 버튼: 선택 영역을 태그로 감싸기
    function wrapTag(tag) {
      const ta = $('#pub-title-input');
      if (!ta) return;
      const s = ta.selectionStart, e = ta.selectionEnd;
      const sel = ta.value.substring(s, e);
      const repl = `<${tag}>${sel}</${tag}>`;
      ta.value = ta.value.substring(0, s) + repl + ta.value.substring(e);
      ta.selectionStart = s;
      ta.selectionEnd = s + repl.length;
      ta.focus();
    }
    const btnSup = $('#btn-sup'), btnSub = $('#btn-sub');
    if (btnSup) btnSup.onclick = () => wrapTag('sup');
    if (btnSub) btnSub.onclick = () => wrapTag('sub');

    const fi = $('#pub-img-file');
    if (fi) fi.onchange = () => {
      if (fi.files[0]) {
        $('#pub-img-url').value = '';
        const f = fi.files[0];
        $('#pub-up-status').textContent = f.size > MAX_IMG_BYTES
          ? `⚠️ 파일이 너무 큽니다: ${(f.size/1024/1024).toFixed(1)} MB (최대 5 MB)`
          : `선택: ${f.name} (${(f.size/1024).toFixed(0)} KB)`;
      }
    };
  }, 50);
}

// ════════════════════════════════════════════════════════════
//  ② NEWS
// ════════════════════════════════════════════════════════════
const NEWS_CATS = ['Award', 'Honor', 'Research', 'General', 'Media'];

async function secNews() {
  const el = $('#sec');
  el.innerHTML = '<div class="loading">불러오는 중…</div>';
  const { news, media } = await readNewsFile();
  let newsItems = [...news];
  let mediaItems = [...media];
  let dragSrcNews = null;
  let dragSrcMedia = null;

  function renderNewsList() {
    const list = $('#news-list');
    if (!list) return;
    list.innerHTML = newsItems.map((n, i) => `
      <div class="item-row" draggable="true" data-idx="${i}">
        <div class="drag-handle" title="드래그로 순서 변경">⠿</div>
        <div class="item-main">
          <div class="item-badge">
            ${n.date}
            <span class="badge ${n.category === 'Award' ? 'badge-award' : n.category === 'Honor' ? 'badge-honor' : ''}">${n.category}</span>
            ${n.body ? '<span class="badge" style="background:#1e3a5f;color:#7dd3fc">📝 게시글</span>' : ''}
            ${n.pinned ? '<span class="badge badge-pin">📌 고정</span>' : ''}
          </div>
          <div class="item-title">${esc(n.title)}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-sm btn-outline" data-edit="${i}">수정</button>
          <button class="btn btn-sm btn-danger"  data-del="${i}">삭제</button>
        </div>
      </div>`).join('');

    $$('.item-row', list).forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrcNews = +item.dataset.idx;
        setTimeout(() => item.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        $$('.item-row', list).forEach(i => i.classList.remove('dragging', 'drag-over'));
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        $$('.item-row', list).forEach(i => i.classList.remove('drag-over'));
        if (+item.dataset.idx !== dragSrcNews) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => {
        e.preventDefault();
        const destIdx = +item.dataset.idx;
        if (dragSrcNews === null || dragSrcNews === destIdx) return;
        const [moved] = newsItems.splice(dragSrcNews, 1);
        newsItems.splice(destIdx, 0, moved);
        const saveBtn = $('#save-order-news');
        if (saveBtn) { saveBtn.style.display = ''; saveBtn.className = 'btn btn-primary'; }
        renderNewsList();
      });
    });

    $$('[data-edit]', list).forEach(b => b.onclick = () => newsForm(newsItems, mediaItems, newsItems[+b.dataset.edit], +b.dataset.edit));
    $$('[data-del]',  list).forEach(b => b.onclick = () => deleteNewsItem(newsItems, mediaItems, +b.dataset.del));
  }

  function renderMediaList() {
    const list = $('#media-list');
    if (!list) return;
    list.innerHTML = mediaItems.map((m, i) => `
      <div class="item-row" draggable="true" data-idx="${i}">
        <div class="drag-handle" title="드래그로 순서 변경">⠿</div>
        <div class="item-main">
          <div class="item-badge">YouTube · ${m.date || ''}</div>
          <div class="item-title">${esc(m.title)}</div>
          <div class="item-sub">ID: ${esc(m.youtube_id)}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-sm btn-outline" data-medit="${i}">수정</button>
          <button class="btn btn-sm btn-danger"  data-mdel="${i}">삭제</button>
        </div>
      </div>`).join('');

    $$('.item-row', list).forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrcMedia = +item.dataset.idx;
        setTimeout(() => item.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        $$('.item-row', list).forEach(i => i.classList.remove('dragging', 'drag-over'));
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        $$('.item-row', list).forEach(i => i.classList.remove('drag-over'));
        if (+item.dataset.idx !== dragSrcMedia) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => {
        e.preventDefault();
        const destIdx = +item.dataset.idx;
        if (dragSrcMedia === null || dragSrcMedia === destIdx) return;
        const [moved] = mediaItems.splice(dragSrcMedia, 1);
        mediaItems.splice(destIdx, 0, moved);
        const saveBtn = $('#save-order-media');
        if (saveBtn) { saveBtn.style.display = ''; saveBtn.className = 'btn btn-sm btn-primary'; }
        renderMediaList();
      });
    });

    $$('[data-medit]', list).forEach(b => b.onclick = () => mediaForm(newsItems, mediaItems, mediaItems[+b.dataset.medit], +b.dataset.medit));
    $$('[data-mdel]',  list).forEach(b => b.onclick = () => deleteMediaItem(newsItems, mediaItems, +b.dataset.mdel));
  }

  el.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">News</h2>
        <p class="section-sub">뉴스 ${newsItems.length}건 · 미디어 ${mediaItems.length}건 · 드래그(⠿)로 순서 변경 가능</p>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center">
        <button class="btn btn-outline" id="save-order-news" style="display:none">순서 저장</button>
        <button class="btn btn-primary" id="add-news">+ 뉴스 추가</button>
      </div>
    </div>
    <div class="item-list" id="news-list"></div>

    <div class="news-sub-title">
      📹 미디어 (YouTube)
      <div style="display:flex;gap:.5rem;align-items:center">
        <button class="btn btn-sm btn-outline" id="save-order-media" style="display:none">순서 저장</button>
        <button class="btn btn-sm btn-primary" id="add-media">+ 미디어 추가</button>
      </div>
    </div>
    <div class="item-list" id="media-list"></div>`;

  renderNewsList();
  renderMediaList();

  $('#add-news').onclick = () => newsForm(newsItems, mediaItems, null, -1);
  $('#save-order-news').onclick = async () => {
    const btn = $('#save-order-news');
    btn.textContent = '저장 중…';
    btn.disabled = true;
    try {
      await saveNewsFile(newsItems, mediaItems, 'Reorder news');
      showToast('순서가 저장됐습니다!');
      btn.style.display = 'none';
    } catch (e) {
      showToast('오류: ' + e.message, 'error');
    } finally {
      btn.textContent = '순서 저장';
      btn.disabled = false;
    }
  };

  $('#add-media').onclick = () => mediaForm(newsItems, mediaItems, null, -1);
  $('#save-order-media').onclick = async () => {
    const btn = $('#save-order-media');
    btn.textContent = '저장 중…';
    btn.disabled = true;
    try {
      await saveNewsFile(newsItems, mediaItems, 'Reorder media');
      showToast('순서가 저장됐습니다!');
      btn.style.display = 'none';
    } catch (e) {
      showToast('오류: ' + e.message, 'error');
    } finally {
      btn.textContent = '순서 저장';
      btn.disabled = false;
    }
  };
}

async function deleteNewsItem(news, media, idx) {
  if (!confirm('삭제하시겠습니까?')) return;
  const updated = news.filter((_, i) => i !== idx);
  try {
    await saveNewsFile(updated, media, `Delete news #${idx}`);
    showToast('삭제됐습니다.');
    secNews();
  } catch (e) { showToast('오류: ' + e.message, 'error'); }
}

async function deleteMediaItem(news, media, idx) {
  if (!confirm('삭제하시겠습니까?')) return;
  const updated = media.filter((_, i) => i !== idx);
  try {
    await saveNewsFile(news, updated, `Delete media #${idx}`);
    showToast('삭제됐습니다.');
    secNews();
  } catch (e) { showToast('오류: ' + e.message, 'error'); }
}

function newsForm(news, media, item, idx) {
  const isNew = !item;
  item = item || {};
  openModal(isNew ? '뉴스 추가' : '뉴스 수정', `
    <div class="form-row">
      <div class="form-group">
        <label>날짜 *</label>
        <input type="date" name="date" value="${item.date || ''}" required />
      </div>
      <div class="form-group">
        <label>카테고리 *</label>
        <select name="category">
          ${NEWS_CATS.map(c => `<option${item.category === c ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>제목 *</label>
      <textarea name="title" rows="2" required>${esc(item.title)}</textarea>
    </div>
    <div class="form-group">
      <label>본문 내용
        <span class="label-hint">(입력 시 상세 페이지 생성 · 일반 텍스트 또는 HTML 가능)</span>
      </label>
      <textarea id="news-body" name="body" rows="10" placeholder="본문을 입력하세요.&#10;&#10;단락 구분은 빈 줄로, HTML 태그도 사용 가능합니다.">${esc(item.body || '')}</textarea>
    </div>
    <div class="form-group">
      <label>대표 이미지 URL <span class="label-hint">(URL 입력 또는 아래에서 업로드)</span></label>
      <input type="text" id="news-img-url" name="image" value="${esc(item.image || '')}" placeholder="https://…" />
    </div>
    <div class="form-group">
      <label>이미지 파일 업로드 <span class="label-hint">(GitHub images/news/ 에 저장)</span></label>
      <input type="file" id="news-img-file" accept="image/*" />
      <div id="news-up-status" class="upload-status"></div>
    </div>
    <div class="form-group">
      <label>원문 링크 URL
        <span class="label-hint">(본문 있으면 '원문 보기' 버튼 · 본문 없으면 클릭 시 이동)</span>
      </label>
      <input type="text" name="link" value="${esc(item.link && item.link !== '#' ? item.link : '')}" placeholder="https://…" />
    </div>
    <div class="form-group checkbox-group">
      <label>
        <input type="checkbox" name="pinned" ${item.pinned ? 'checked' : ''} />
        홈페이지 상단에 고정 (핀)
      </label>
    </div>`,
  async (form) => {
    const fileInput = $('#news-img-file');
    const statusEl  = $('#news-up-status');
    let image = $('#news-img-url').value.trim();

    if (fileInput.files[0] && !image) {
      statusEl.textContent = '업로드 중…';
      const f    = fileInput.files[0];
      const name = `${Date.now()}_${f.name.replace(/\s+/g, '_')}`;
      image = await ghUploadImage(`${CONFIG.newsDir}/${name}`, f);
    }

    const body = form.body.value.trim();
    const link = form.link.value.trim() || '#';

    const entry = {
      id:       item.id || Date.now(),
      date:     form.date.value,
      title:    form.title.value.trim(),
      category: form.category.value,
      pinned:   form.pinned.checked,
    };
    if (body)  entry.body  = body;
    if (image) entry.image = image;
    if (link !== '#') entry.link = link;
    else entry.link = '#';

    const updated = [...news];
    if (isNew) updated.unshift(entry); else updated[idx] = entry;
    await saveNewsFile(updated, media, `${isNew ? 'Add' : 'Update'} news: ${entry.title.slice(0, 60)}`);
    showToast('저장됐습니다!');
    secNews();
  });

  setTimeout(() => {
    const fi = $('#news-img-file');
    if (fi) fi.onchange = () => {
      if (fi.files[0]) {
        $('#news-img-url').value = '';
        const f = fi.files[0];
        $('#news-up-status').textContent = f.size > MAX_IMG_BYTES
          ? `⚠️ 파일이 너무 큽니다: ${(f.size/1024/1024).toFixed(1)} MB (최대 5 MB)`
          : `선택: ${f.name} (${(f.size/1024).toFixed(0)} KB)`;
      }
    };
  }, 50);
}

function mediaForm(news, media, item, idx) {
  const isNew = !item;
  item = item || {};
  openModal(isNew ? '미디어 추가' : '미디어 수정', `
    <div class="form-group">
      <label>YouTube 영상 ID *
        <span class="label-hint">(URL에서 v= 뒤 값, 예: dQw4w9WgXcQ)</span>
      </label>
      <input type="text" name="youtube_id" value="${esc(item.youtube_id)}" required placeholder="dQw4w9WgXcQ" />
    </div>
    <div class="form-group">
      <label>제목 *</label>
      <input type="text" name="title" value="${esc(item.title)}" required />
    </div>
    <div class="form-group">
      <label>설명</label>
      <textarea name="description" rows="2">${esc(item.description)}</textarea>
    </div>
    <div class="form-group">
      <label>날짜</label>
      <input type="date" name="date" value="${item.date || ''}" />
    </div>`,
  async (form) => {
    const entry = {
      youtube_id:  form.youtube_id.value.trim(),
      title:       form.title.value.trim(),
      description: form.description.value.trim(),
      date:        form.date.value,
    };
    const updated = [...media];
    if (isNew) updated.push(entry); else updated[idx] = entry;
    await saveNewsFile(news, updated, `${isNew ? 'Add' : 'Update'} media: ${entry.title}`);
    showToast('저장됐습니다!');
    secNews();
  });
}

// ════════════════════════════════════════════════════════════
//  ③ GALLERY
// ════════════════════════════════════════════════════════════
async function secGallery() {
  const el = $('#sec');
  el.innerHTML = '<div class="loading">불러오는 중…</div>';
  const { data: items } = await readFile('gallery.js', 'GALLERY');
  let galItems = [...items];
  let dragSrcIdx = null;

  function renderGrid() {
    const grid = $('#gal-grid');
    if (!grid) return;
    grid.innerHTML = galItems.map((g, i) => `
      <div class="gallery-admin-item" draggable="true" data-idx="${i}">
        <div class="drag-handle" title="드래그로 순서 변경">⠿</div>
        <div class="gallery-admin-thumb">
          <img src="${esc(g.src)}" alt="${esc(g.caption)}" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
          <div class="thumb-fallback" style="display:none">📷</div>
        </div>
        <div class="gallery-admin-info">
          <div class="item-title" style="font-size:.8rem;white-space:normal">${esc(g.caption)}</div>
          <div class="item-badge" style="margin-top:.2rem">${esc(g.category || '')} ${g.year || ''}</div>
        </div>
        <div class="item-actions" style="padding:.3rem .8rem .8rem">
          <button class="btn btn-sm btn-outline" data-edit="${i}">수정</button>
          <button class="btn btn-sm btn-danger"  data-del="${i}">삭제</button>
        </div>
      </div>`).join('');

    $$('.gallery-admin-item', grid).forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrcIdx = +item.dataset.idx;
        setTimeout(() => item.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        $$('.gallery-admin-item', grid).forEach(i => i.classList.remove('dragging', 'drag-over'));
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        $$('.gallery-admin-item', grid).forEach(i => i.classList.remove('drag-over'));
        if (+item.dataset.idx !== dragSrcIdx) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => {
        e.preventDefault();
        const destIdx = +item.dataset.idx;
        if (dragSrcIdx === null || dragSrcIdx === destIdx) return;
        const [moved] = galItems.splice(dragSrcIdx, 1);
        galItems.splice(destIdx, 0, moved);
        const saveBtn = $('#save-order');
        if (saveBtn) { saveBtn.style.display = ''; saveBtn.className = 'btn btn-primary'; }
        renderGrid();
      });
    });

    $$('[data-edit]', grid).forEach(b => b.onclick = () => galleryForm(galItems, galItems[+b.dataset.edit], +b.dataset.edit));
    $$('[data-del]',  grid).forEach(b => b.onclick = () =>
      deleteItem('gallery.js', 'GALLERY', galItems, +b.dataset.del, 'gallery', secGallery));
  }

  el.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Gallery</h2>
        <p class="section-sub">총 ${galItems.length}장 · 드래그(⠿)로 순서 변경 가능</p>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center">
        <button class="btn btn-outline" id="save-order" style="display:none">순서 저장</button>
        <button class="btn btn-primary" id="add-gal">+ 사진 추가</button>
      </div>
    </div>
    <div class="gallery-admin-grid" id="gal-grid"></div>`;

  renderGrid();

  $('#add-gal').onclick = () => galleryForm(galItems, null, -1);
  $('#save-order').onclick = async () => {
    const btn = $('#save-order');
    btn.textContent = '저장 중…';
    btn.disabled = true;
    try {
      await saveFile('gallery.js', 'GALLERY', galItems, 'Reorder gallery images');
      showToast('순서가 저장됐습니다!');
      btn.style.display = 'none';
    } catch (e) {
      showToast('오류: ' + e.message, 'error');
    } finally {
      btn.textContent = '순서 저장';
      btn.disabled = false;
    }
  };
}

function galleryForm(items, item, idx) {
  const isNew = !item;
  item = item || {};
  openModal(isNew ? '사진 추가' : '사진 수정', `
    <div class="form-group">
      <label>이미지 URL
        <span class="label-hint">(알드라이브 등 외부 서비스 공개 링크 입력, 또는 아래에서 업로드)</span>
      </label>
      <input type="text" id="gal-src" name="src" value="${esc(item.src)}" placeholder="https://…" />
    </div>
    <div class="form-group">
      <label>파일 직접 업로드 <span class="label-hint">(GitHub 리포지토리에 저장)</span></label>
      <input type="file" id="gal-file" accept="image/*" />
      <div id="up-status" class="upload-status"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>캡션 *</label>
        <input type="text" name="caption" value="${esc(item.caption)}" required placeholder="사진 설명" />
      </div>
      <div class="form-group" style="flex:0 0 130px">
        <label>연도</label>
        <input type="number" name="year" value="${item.year || new Date().getFullYear()}" min="2000" max="2100" />
      </div>
    </div>
    <div class="form-group">
      <label>카테고리</label>
      <input type="text" name="category" value="${esc(item.category)}"
             placeholder="예: Seminar, Group, Conference, Field" />
    </div>`,
  async (form) => {
    const fileInput = $('#gal-file');
    const statusEl = $('#up-status');
    let src = $('#gal-src').value.trim();

    if (fileInput.files[0] && !src) {
      statusEl.textContent = '업로드 중…';
      const f = fileInput.files[0];
      const name = `${Date.now()}_${f.name.replace(/\s+/g, '_')}`;
      src = await ghUploadImage(`${CONFIG.galleryDir}/${name}`, f);
    }
    if (!src) throw new Error('이미지 URL을 입력하거나 파일을 선택하세요.');

    const entry = {
      src,
      caption:  form.caption.value.trim(),
      category: form.category.value.trim(),
      year:     +form.year.value || new Date().getFullYear(),
    };
    const updated = [...items];
    if (isNew) updated.push(entry); else updated[idx] = entry;
    await saveFile('gallery.js', 'GALLERY', updated,
      `${isNew ? 'Add' : 'Update'} gallery: ${entry.caption}`);
    showToast('저장됐습니다!');
    secGallery();
  });

  // 파일 선택 시 URL 입력 비우기
  setTimeout(() => {
    const fi = $('#gal-file');
    if (fi) fi.onchange = () => {
      if (fi.files[0]) {
        $('#gal-src').value = '';
        const f = fi.files[0];
        $('#up-status').textContent = f.size > MAX_IMG_BYTES
          ? `⚠️ 파일이 너무 큽니다: ${(f.size/1024/1024).toFixed(1)} MB (최대 5 MB)`
          : `선택: ${f.name} (${(f.size/1024).toFixed(0)} KB)`;
      }
    };
  }, 50);
}

// ════════════════════════════════════════════════════════════
//  ④ MEMBERS
// ════════════════════════════════════════════════════════════
async function secMembers() {
  const el = $('#sec');
  el.innerHTML = '<div class="loading">불러오는 중…</div>';
  const { data: m } = await readFile('members.js', 'MEMBERS', { professor: [], students: [], alumni: [] });
  const members = { professor: [...(m.professor || [])], students: [...(m.students || [])], alumni: [...(m.alumni || [])] };

  const groupLabel = { professor: '교수', students: '재학생 / 연구원', alumni: '졸업생 · Alumni' };
  let dragSrc = { grp: null, idx: null };

  function renderGroup(grp) {
    const list = $(`#mem-list-${grp}`);
    if (!list) return;
    list.innerHTML = (members[grp] || []).map((p, i) => `
      <div class="item-row" draggable="true" data-grp="${grp}" data-idx="${i}">
        <div class="drag-handle" title="드래그로 순서 변경">⠿</div>
        <div class="item-main">
          <div class="item-title">${esc(p.name)}</div>
          <div class="item-sub">${esc(p.title || p.degree || '')} ${(p.affiliation || p.research || p.current) ? '· ' + esc(p.affiliation || p.research || p.current) : ''}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-sm btn-outline" data-edit="${grp}-${i}">수정</button>
          <button class="btn btn-sm btn-danger"  data-del="${grp}-${i}">삭제</button>
        </div>
      </div>`).join('') || '<div class="empty-state">멤버 없음</div>';

    $$('.item-row', list).forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrc = { grp, idx: +item.dataset.idx };
        setTimeout(() => item.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        $$('.item-row', list).forEach(i => i.classList.remove('dragging', 'drag-over'));
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        $$('.item-row', list).forEach(i => i.classList.remove('drag-over'));
        if (+item.dataset.idx !== dragSrc.idx || item.dataset.grp !== dragSrc.grp) item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => {
        e.preventDefault();
        if (dragSrc.grp !== grp) return;
        const destIdx = +item.dataset.idx;
        if (dragSrc.idx === null || dragSrc.idx === destIdx) return;
        const [moved] = members[grp].splice(dragSrc.idx, 1);
        members[grp].splice(destIdx, 0, moved);
        const saveBtn = $(`#save-order-${grp}`);
        if (saveBtn) { saveBtn.style.display = ''; saveBtn.className = 'btn btn-primary'; }
        renderGroup(grp);
      });
    });

    $$('[data-edit]', list).forEach(b => {
      const [g, i] = b.dataset.edit.split('-');
      b.onclick = () => memberForm(members, g, members[g][+i], +i);
    });
    $$('[data-del]', list).forEach(b => {
      const [g, i] = b.dataset.del.split('-');
      b.onclick = () => deleteMember(members, g, +i);
    });
  }

  el.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Members</h2>
        <p class="section-sub">교수 ${members.professor.length} · 재학생 ${members.students.length} · 졸업생 ${members.alumni.length} · 드래그(⠿)로 순서 변경 가능</p>
      </div>
    </div>
    ${['professor', 'students', 'alumni'].map(grp => `
      <div class="member-group">
        <div class="member-group-header">
          <span class="member-group-title">${groupLabel[grp]}</span>
          <div style="display:flex;gap:.5rem;align-items:center">
            <button class="btn btn-outline" id="save-order-${grp}" style="display:none">순서 저장</button>
            <button class="btn btn-sm btn-primary" data-add="${grp}">+ 추가</button>
          </div>
        </div>
        <div class="item-list" id="mem-list-${grp}"></div>
      </div>`).join('')}`;

  ['professor', 'students', 'alumni'].forEach(grp => renderGroup(grp));

  $$('[data-add]', el).forEach(b => b.onclick = () => memberForm(members, b.dataset.add, null, -1));
  ['professor', 'students', 'alumni'].forEach(grp => {
    $(`#save-order-${grp}`).onclick = async () => {
      const btn = $(`#save-order-${grp}`);
      btn.textContent = '저장 중…';
      btn.disabled = true;
      try {
        await saveFile('members.js', 'MEMBERS', members, `Reorder ${grp}`);
        showToast('순서가 저장됐습니다!');
        btn.style.display = 'none';
      } catch (e) {
        showToast('오류: ' + e.message, 'error');
      } finally {
        btn.textContent = '순서 저장';
        btn.disabled = false;
      }
    };
  });
}

async function deleteMember(members, grp, idx) {
  if (!confirm('삭제하시겠습니까?')) return;
  const updated = JSON.parse(JSON.stringify(members));
  updated[grp].splice(idx, 1);
  try {
    await saveFile('members.js', 'MEMBERS', updated, `Remove member from ${grp}`);
    showToast('삭제됐습니다.');
    secMembers();
  } catch (e) { showToast('오류: ' + e.message, 'error'); }
}

function memberForm(members, grp, item, idx) {
  const isNew = !item;
  const isProfessor = grp === 'professor';
  const isAlumni    = grp === 'alumni';
  item = item || {};

  const grpLabel = { professor: '교수', students: '재학생', alumni: '졸업생' }[grp];

  openModal(`${isNew ? '추가' : '수정'} (${grpLabel})`, `
    <div class="form-row">
      <div class="form-group">
        <label>이름 *</label>
        <input type="text" name="name" value="${esc(item.name)}" required />
      </div>
      <div class="form-group">
        <label>${isAlumni ? '학위 *' : '직위 *'}</label>
        <input type="text" name="${isAlumni ? 'degree' : 'title'}"
               value="${esc(isAlumni ? item.degree : item.title)}" required
               placeholder="${isProfessor ? 'Professor' : isAlumni ? 'Ph.D. 2024' : 'Ph.D. Student'}" />
      </div>
    </div>
    ${isProfessor ? `
      <div class="form-group">
        <label>소속</label>
        <input type="text" name="affiliation" value="${esc(item.affiliation)}" />
      </div>
      <div class="form-group">
        <label>약력 (Bio)</label>
        <textarea name="bio" rows="4">${esc(item.bio)}</textarea>
      </div>
      <div class="form-group">
        <label>Google Scholar URL</label>
        <input type="url" name="scholar" value="${esc(item.links?.google_scholar)}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>이력서 (영문) URL <span class="label-hint">(URL 입력 또는 아래에서 업로드)</span></label>
          <input type="text" id="cv-en-url" name="cv_en" value="${esc(item.cv?.en)}" placeholder="files/cv/…" />
        </div>
        <div class="form-group">
          <label>이력서 (한글) URL <span class="label-hint">(URL 입력 또는 아래에서 업로드)</span></label>
          <input type="text" id="cv-ko-url" name="cv_ko" value="${esc(item.cv?.ko)}" placeholder="files/cv/…" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>이력서 (영문) 파일 업로드 <span class="label-hint">(PDF, 최대 5 MB)</span></label>
          <input type="file" id="cv-en-file" accept=".pdf,application/pdf" />
          <div id="cv-en-status" class="upload-status"></div>
        </div>
        <div class="form-group">
          <label>이력서 (한글) 파일 업로드 <span class="label-hint">(PDF, 최대 5 MB)</span></label>
          <input type="file" id="cv-ko-file" accept=".pdf,application/pdf" />
          <div id="cv-ko-status" class="upload-status"></div>
        </div>
      </div>` : isAlumni ? `
      <div class="form-group">
        <label>현재 소속 / 직위</label>
        <input type="text" name="current" value="${esc(item.current)}"
               placeholder="Professor, Seoul National University" />
      </div>` : `
      <div class="form-group">
        <label>연구 분야</label>
        <input type="text" name="research" value="${esc(item.research)}"
               placeholder="Photocatalysis for water treatment" />
      </div>`}
    <div class="form-row">
      <div class="form-group">
        <label>이메일</label>
        <input type="email" name="email" value="${esc(item.email)}" />
      </div>
      <div class="form-group">
        <label>프로필 사진 URL <span class="label-hint">(URL 입력 또는 아래에서 업로드)</span></label>
        <input type="text" id="mem-photo-url" name="photo" value="${esc(item.photo)}" placeholder="images/members/…" />
      </div>
    </div>
    <div class="form-group">
      <label>프로필 사진 파일 업로드 <span class="label-hint">(GitHub images/members/ 에 저장)</span></label>
      <input type="file" id="mem-photo-file" accept="image/*" />
      <div id="mem-up-status" class="upload-status"></div>
    </div>`,
  async (form) => {
    const fileInput = $('#mem-photo-file');
    const statusEl  = $('#mem-up-status');
    let photo = $('#mem-photo-url')?.value?.trim() || '';

    if (fileInput?.files[0] && !photo) {
      statusEl.textContent = '업로드 중…';
      const f    = fileInput.files[0];
      const name = `${Date.now()}_${f.name.replace(/\s+/g, '_')}`;
      photo = await ghUploadImage(`${CONFIG.membersDir}/${name}`, f);
    }

    let cvEn = '', cvKo = '';
    if (isProfessor) {
      cvEn = $('#cv-en-url')?.value?.trim() || '';
      cvKo = $('#cv-ko-url')?.value?.trim() || '';
      const cvEnFile = $('#cv-en-file');
      const cvKoFile = $('#cv-ko-file');
      if (cvEnFile?.files[0] && !cvEn) {
        statusEl.textContent = '영문 이력서 업로드 중…';
        const f = cvEnFile.files[0];
        const name = `cv_en_${Date.now()}_${f.name.replace(/\s+/g, '_')}`;
        cvEn = await ghUploadImage(`${CONFIG.cvDir}/${name}`, f);
      }
      if (cvKoFile?.files[0] && !cvKo) {
        statusEl.textContent = '한글 이력서 업로드 중…';
        const f = cvKoFile.files[0];
        const name = `cv_ko_${Date.now()}_${f.name.replace(/\s+/g, '_')}`;
        cvKo = await ghUploadImage(`${CONFIG.cvDir}/${name}`, f);
      }
    }

    const entry = { name: form.name.value.trim(), photo };
    if (isProfessor) {
      entry.title       = form.title.value.trim();
      entry.email       = form.email?.value?.trim() || '';
      entry.affiliation = form.affiliation?.value?.trim() || '';
      entry.bio         = form.bio?.value?.trim() || '';
      entry.links = { google_scholar: form.scholar?.value?.trim() || '', researchgate: '', website: '' };
      entry.cv = { en: cvEn, ko: cvKo };
    } else if (isAlumni) {
      entry.degree  = form.degree?.value?.trim() || '';
      entry.current = form.current?.value?.trim() || '';
    } else {
      entry.title    = form.title.value.trim();
      entry.email    = form.email?.value?.trim() || '';
      entry.research = form.research?.value?.trim() || '';
    }

    const updated = JSON.parse(JSON.stringify(members));
    if (!updated[grp]) updated[grp] = [];
    if (isNew) updated[grp].push(entry); else updated[grp][idx] = entry;
    await saveFile('members.js', 'MEMBERS', updated,
      `${isNew ? 'Add' : 'Update'} member: ${entry.name}`);
    showToast('저장됐습니다!');
    secMembers();
  });

  setTimeout(() => {
    const fi = $('#mem-photo-file');
    if (fi) fi.onchange = () => {
      if (fi.files[0]) {
        $('#mem-photo-url').value = '';
        const f = fi.files[0];
        $('#mem-up-status').textContent = f.size > MAX_IMG_BYTES
          ? `⚠️ 파일이 너무 큽니다: ${(f.size/1024/1024).toFixed(1)} MB (최대 5 MB)`
          : `선택: ${f.name} (${(f.size/1024).toFixed(0)} KB)`;
      }
    };
    const cvEnFi = $('#cv-en-file');
    if (cvEnFi) cvEnFi.onchange = () => {
      if (cvEnFi.files[0]) {
        $('#cv-en-url').value = '';
        const f = cvEnFi.files[0];
        $('#cv-en-status').textContent = f.size > MAX_IMG_BYTES
          ? `⚠️ 파일이 너무 큽니다: ${(f.size/1024/1024).toFixed(1)} MB (최대 5 MB)`
          : `선택: ${f.name} (${(f.size/1024).toFixed(0)} KB)`;
      }
    };
    const cvKoFi = $('#cv-ko-file');
    if (cvKoFi) cvKoFi.onchange = () => {
      if (cvKoFi.files[0]) {
        $('#cv-ko-url').value = '';
        const f = cvKoFi.files[0];
        $('#cv-ko-status').textContent = f.size > MAX_IMG_BYTES
          ? `⚠️ 파일이 너무 큽니다: ${(f.size/1024/1024).toFixed(1)} MB (최대 5 MB)`
          : `선택: ${f.name} (${(f.size/1024).toFixed(0)} KB)`;
      }
    };
  }, 50);
}

// ════════════════════════════════════════════════════════════
//  ⑤ RESEARCH
// ════════════════════════════════════════════════════════════
async function secResearch() {
  const el = $('#sec');
  el.innerHTML = '<div class="loading">불러오는 중…</div>';
  const { data: items } = await readFile('research.js', 'RESEARCH');

  el.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Research Areas</h2>
        <p class="section-sub">총 ${items.length}개</p>
      </div>
      <button class="btn btn-primary" id="add-res">+ 연구분야 추가</button>
    </div>
    <div class="item-list">
      ${items.map((r, i) => `
        <div class="item-row">
          <div class="item-main">
            <div class="item-badge">${r.icon || '🔬'} · #${r.id}</div>
            <div class="item-title">${esc(r.title)}</div>
            <div class="item-sub">${(r.keywords || []).join(', ')}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-sm btn-outline" data-edit="${i}">수정</button>
            <button class="btn btn-sm btn-danger"  data-del="${i}">삭제</button>
          </div>
        </div>`).join('')}
    </div>`;

  $('#add-res').onclick = () => researchForm(items, null, -1);
  $$('[data-edit]', el).forEach(b => b.onclick = () => researchForm(items, items[+b.dataset.edit], +b.dataset.edit));
  $$('[data-del]',  el).forEach(b => b.onclick = () =>
    deleteItem('research.js', 'RESEARCH', items, +b.dataset.del, 'research', secResearch));
}

function researchForm(items, item, idx) {
  const isNew = !item;
  item = item || {};
  openModal(isNew ? '연구분야 추가' : '연구분야 수정', `
    <div class="form-row">
      <div class="form-group" style="flex:0 0 90px">
        <label>아이콘</label>
        <input type="text" name="icon" value="${esc(item.icon || '🔬')}"
               style="font-size:1.4rem;text-align:center;padding:.4rem" />
      </div>
      <div class="form-group">
        <label>제목 *</label>
        <input type="text" name="title" value="${esc(item.title)}" required />
      </div>
    </div>
    <div class="form-group">
      <label>한줄 요약 *</label>
      <textarea name="summary" rows="2" required>${esc(item.summary)}</textarea>
    </div>
    <div class="form-group">
      <label>상세 설명</label>
      <textarea name="description" rows="4">${esc(item.description)}</textarea>
    </div>
    <div class="form-group">
      <label>키워드 <span class="label-hint">(쉼표로 구분)</span></label>
      <input type="text" name="keywords" value="${esc((item.keywords || []).join(', '))}"
             placeholder="TiO₂, photocatalysis, H₂ production" />
    </div>`,
  async (form) => {
    const entry = {
      id:          item.id ?? (Math.max(0, ...items.map(r => r.id || 0)) + 1),
      icon:        form.icon.value.trim() || '🔬',
      title:       form.title.value.trim(),
      summary:     form.summary.value.trim(),
      description: form.description.value.trim(),
      keywords:    form.keywords.value.split(',').map(k => k.trim()).filter(Boolean),
    };
    const updated = [...items];
    if (isNew) updated.push(entry); else updated[idx] = entry;
    await saveFile('research.js', 'RESEARCH', updated,
      `${isNew ? 'Add' : 'Update'} research: ${entry.title}`);
    showToast('저장됐습니다!');
    secResearch();
  });
}

// ════════════════════════════════════════════════════════════
//  초기화
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (getPAT()) renderDashboard();
  else renderLogin();
});
