(() => {
  const root = document.querySelector('[data-notes-app]');
  if (!root) return;

  const API = {
    me: '../api/auth_me.php',
    list: '../api/notes_list.php',
    upload: '../api/notes_upload.php',
    file: (id, mode) => `../api/notes_file.php?id=${encodeURIComponent(id)}&mode=${encodeURIComponent(mode)}`,
    del: '../api/notes_delete.php',
    approve: '../api/notes_approve.php',
  };

  const els = {
    authStatus: root.querySelector('[data-notes-auth-status]'),
    category: root.querySelector('[data-note-category]'),
    title: root.querySelector('[data-note-title]'),
    file: root.querySelector('[data-note-file]'),
    pickBtn: root.querySelector('[data-note-pick]'),
    selected: root.querySelector('[data-note-selected]'),
    selectedName: root.querySelector('[data-note-selected-name]'),
    selectedMeta: root.querySelector('[data-note-selected-meta]'),
    uploadBtn: root.querySelector('[data-note-upload-btn]'),
    progressWrap: root.querySelector('[data-note-progress]'),
    progressBar: root.querySelector('[data-note-progress-bar]'),
    progressText: root.querySelector('[data-note-progress-text]'),
    uploadMsg: root.querySelector('[data-note-upload-msg]'),
    search: root.querySelector('[data-notes-search]'),
    filter: root.querySelector('[data-notes-filter]'),
    list: root.querySelector('[data-notes-list]'),
    count: root.querySelector('[data-notes-count]'),
    refresh: root.querySelector('[data-notes-refresh]'),
    reader: root.querySelector('[data-note-reader]'),
    readerTitle: root.querySelector('[data-reader-title]'),
    readerMeta: root.querySelector('[data-reader-meta]'),
    readerBody: root.querySelector('[data-reader-body]'),
    readerClose: root.querySelector('[data-reader-close]'),
    readerDownload: root.querySelector('[data-reader-download]'),
    readerPrev: root.querySelector('[data-reader-prev]'),
    readerNext: root.querySelector('[data-reader-next]'),
    readerZoomOut: root.querySelector('[data-reader-zoom-out]'),
    readerZoomIn: root.querySelector('[data-reader-zoom-in]'),
    readerZoomLabel: root.querySelector('[data-reader-zoom-label]'),
  };

  const allowedExt = ['pdf','doc','docx','ppt','pptx','txt','jpg','png'];
  const maxBytes = 10 * 1024 * 1024;
  let currentUser = null;
  let notes = [];
  let filtered = [];
  let selectedFile = null;
  let uploading = false;
  let activeReaderIndex = -1;
  let pdfZoom = 1;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtBytes = (n) => {
    const b = Number(n) || 0;
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(2) + ' MB';
  };
  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(String(d).replace(' ', 'T'));
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const extOf = (name) => {
    const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  };
  const setMsg = (text, type) => {
    if (!els.uploadMsg) return;
    els.uploadMsg.textContent = text || '';
    els.uploadMsg.className = 'notes-msg' + (type ? ' ' + type : '');
    els.uploadMsg.style.display = text ? 'block' : 'none';
  };
  const setProgress = (pct, text) => {
    if (els.progressWrap) els.progressWrap.style.display = 'block';
    if (els.progressBar) els.progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (els.progressText) els.progressText.textContent = text || '';
  };
  const hideProgress = () => {
    if (els.progressWrap) els.progressWrap.style.display = 'none';
    if (els.progressBar) els.progressBar.style.width = '0%';
    if (els.progressText) els.progressText.textContent = '';
  };

  async function fetchMe() {
    try {
      const res = await fetch(API.me, { credentials: 'same-origin' });
      const data = await res.json();
      currentUser = data && data.authenticated ? data.user : null;
    } catch { currentUser = null; }
    renderAuth();
    return currentUser;
  }

  function renderAuth() {
    const loggedIn = !!currentUser;
    if (els.authStatus) {
      els.authStatus.textContent = loggedIn
        ? `Signed in as ${currentUser.name || currentUser.email}. You can upload and read notes.`
        : 'Log in or sign up to upload, view, and download notes.';
    }
    root.querySelectorAll('[data-notes-auth-required]').forEach(el => {
      el.style.opacity = loggedIn ? '1' : '0.65';
    });
    if (els.uploadBtn) els.uploadBtn.disabled = !loggedIn || !selectedFile || uploading;
  }

  function clearSelectedFile() {
    selectedFile = null;
    if (els.file) els.file.value = '';
    if (els.selected) els.selected.style.display = 'none';
    if (els.selectedName) els.selectedName.textContent = '';
    if (els.selectedMeta) els.selectedMeta.textContent = '';
    if (els.uploadBtn) { els.uploadBtn.style.display = 'none'; els.uploadBtn.disabled = true; }
  }

  function onFilePicked(file) {
    setMsg('', '');
    hideProgress();
    if (!file) { clearSelectedFile(); return; }
    const ext = extOf(file.name);
    if (!allowedExt.includes(ext)) {
      clearSelectedFile();
      setMsg('Invalid file type. Allowed: PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, PNG.', 'error');
      return;
    }
    if (file.size <= 0 || file.size > maxBytes) {
      clearSelectedFile();
      setMsg('File size must be between 1 byte and 10 MB.', 'error');
      return;
    }
    selectedFile = file;
    if (els.selected) els.selected.style.display = 'block';
    if (els.selectedName) els.selectedName.textContent = file.name;
    if (els.selectedMeta) els.selectedMeta.textContent = `${ext.toUpperCase()} • ${fmtBytes(file.size)}`;
    if (els.uploadBtn) {
      els.uploadBtn.style.display = 'inline-flex';
      els.uploadBtn.disabled = !currentUser || uploading;
    }
  }

  async function uploadNote() {
    if (uploading) return;
    if (!currentUser) {
      setMsg('Please log in to upload notes.', 'error');
      if (window.openAuthModal) window.openAuthModal('login');
      return;
    }
    if (!selectedFile) { setMsg('Please select a file first.', 'error'); return; }
    const category = (els.category?.value || '').trim();
    if (!category) { setMsg('Please select a course category.', 'error'); return; }
    const ext = extOf(selectedFile.name);
    if (!allowedExt.includes(ext) || selectedFile.size > maxBytes) { onFilePicked(selectedFile); return; }

    uploading = true;
    if (els.uploadBtn) els.uploadBtn.disabled = true;
    setMsg('', '');
    setProgress(0, 'Preparing upload...');

    const fd = new FormData();
    fd.append('note_file', selectedFile);
    fd.append('course_category', category);
    fd.append('title', (els.title?.value || '').trim());

    try {
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', API.upload, true);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct, `Uploading... ${pct}%`);
          }
        };
        xhr.onload = () => {
          try { resolve({ status: xhr.status, body: JSON.parse(xhr.responseText) }); }
          catch { reject(new Error('Invalid server response.')); }
        };
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(fd);
      });

      if (!data.body.ok) {
        setMsg(data.body.error || 'Upload failed.', 'error');
        setProgress(100, 'Upload failed.');
        return;
      }
      setProgress(100, 'Upload complete.');
      setMsg(data.body.message || 'Notes uploaded successfully.', 'success');
      clearSelectedFile();
      if (els.title) els.title.value = '';
      await loadNotes();
    } catch (err) {
      setMsg(err.message || 'Upload failed.', 'error');
    } finally {
      uploading = false;
      if (els.uploadBtn) els.uploadBtn.disabled = !currentUser || !selectedFile;
      setTimeout(hideProgress, 1200);
    }
  }

  function applyFilters() {
    const q = (els.search?.value || '').trim().toLowerCase();
    const cat = els.filter?.value || 'all';
    filtered = notes.filter(n => {
      const okCat = cat === 'all' || n.course_category === cat;
      const hay = `${n.title} ${n.original_file_name} ${n.course_category} ${n.uploader_name} ${n.file_type}`.toLowerCase();
      const okQ = !q || hay.includes(q);
      return okCat && okQ;
    });
    renderList();
  }

  function statusBadge(n) {
    if (n.approval_status === 'approved') return '<span class="note-badge approved">Approved</span>';
    if (n.approval_status === 'pending') return '<span class="note-badge pending">Pending approval</span>';
    return '<span class="note-badge rejected">Rejected</span>';
  }

  function renderList() {
    if (!els.list) return;
    if (els.count) els.count.textContent = `${filtered.length} note${filtered.length === 1 ? '' : 's'}`;
    if (!filtered.length) {
      els.list.innerHTML = '<div class="notes-empty">No notes found. Upload a file or adjust your search/filter.</div>';
      return;
    }
    const isAdmin = !!(currentUser && Number(currentUser.is_admin) === 1);
    els.list.innerHTML = filtered.map((n, idx) => `
      <article class="note-item" data-note-id="${n.id}">
        <div class="note-item-main">
          <div class="note-item-head">
            <h4 class="note-item-title">${esc(n.title)}</h4>
            ${statusBadge(n)}
          </div>
          <div class="note-item-meta">
            <span class="note-meta-chip">${esc(n.course_category)}</span>
            <span class="note-meta-chip">${esc(String(n.file_type).toUpperCase())}</span>
            <span class="note-meta-chip">${esc(n.file_size_label || fmtBytes(n.file_size))}</span>
            <span class="note-meta-chip">Uploaded ${esc(fmtDate(n.upload_date))}</span>
            <span class="note-meta-chip">By ${esc(n.uploader_name || 'Unknown')}</span>
          </div>
        </div>
        <div class="note-item-actions">
          <button type="button" class="btn btn-primary small" data-note-view="${idx}">View Notes</button>
          <a class="btn btn-secondary-dark small" href="${esc(n.download_url)}" data-note-download="${idx}">Download</a>
          ${isAdmin && n.approval_status !== 'approved' ? `<button type="button" class="btn btn-primary small" data-note-approve="${n.id}" data-status="approved">Approve</button>` : ''}
          ${isAdmin && n.approval_status !== 'rejected' ? `<button type="button" class="btn btn-secondary-dark small" data-note-approve="${n.id}" data-status="rejected">Reject</button>` : ''}
          ${isAdmin ? `<button type="button" class="btn btn-danger-outline small" data-note-delete="${n.id}">Delete</button>` : ''}
        </div>
      </article>`).join('');

    els.list.querySelectorAll('[data-note-view]').forEach(btn => {
      btn.addEventListener('click', () => openReader(Number(btn.getAttribute('data-note-view'))));
    });
    els.list.querySelectorAll('[data-note-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteNote(Number(btn.getAttribute('data-note-delete'))));
    });
    els.list.querySelectorAll('[data-note-approve]').forEach(btn => {
      btn.addEventListener('click', () => approveNote(Number(btn.getAttribute('data-note-approve')), btn.getAttribute('data-status')));
    });
  }

  async function loadNotes() {
    if (!els.list) return;
    els.list.innerHTML = '<div class="notes-empty">Loading notes...</div>';
    try {
      const res = await fetch(API.list, { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 401) {
          notes = []; filtered = [];
          els.list.innerHTML = '<div class="notes-empty">Please log in to view course notes.</div>';
          if (els.count) els.count.textContent = '0 notes';
          return;
        }
        throw new Error(data.error || 'Failed to load notes.');
      }
      notes = Array.isArray(data.notes) ? data.notes : [];
      if (data.is_admin && currentUser) currentUser.is_admin = 1;
      applyFilters();
    } catch (err) {
      els.list.innerHTML = `<div class="notes-empty error">${esc(err.message || 'Failed to load notes.')}</div>`;
    }
  }

  async function deleteNote(id) {
    if (!id || !currentUser || Number(currentUser.is_admin) !== 1) return;
    if (!confirm('Delete this note? This cannot be undone.')) return;
    const res = await fetch(API.del, { method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) { alert(data.error || 'Delete failed.'); return; }
    if (activeReaderIndex >= 0 && filtered[activeReaderIndex] && filtered[activeReaderIndex].id === id) closeReader();
    await loadNotes();
  }

  async function approveNote(id, status) {
    if (!id || !currentUser || Number(currentUser.is_admin) !== 1) return;
    const res = await fetch(API.approve, { method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id, status}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) { alert(data.error || 'Update failed.'); return; }
    await loadNotes();
  }

  function updateReaderNav() {
    if (els.readerPrev) els.readerPrev.disabled = activeReaderIndex <= 0;
    if (els.readerNext) els.readerNext.disabled = activeReaderIndex < 0 || activeReaderIndex >= filtered.length - 1;
  }

  function renderReaderBody(note) {
    if (!els.readerBody) return;
    const url = note.view_url;
    const ext = String(note.file_type || '').toLowerCase();
    pdfZoom = 1;
    if (els.readerZoomLabel) els.readerZoomLabel.textContent = '100%';
    const showZoom = ext === 'pdf';
    [els.readerZoomIn, els.readerZoomOut, els.readerZoomLabel].forEach(el => { if (el) el.style.display = showZoom ? '' : 'none'; });

    if (ext === 'pdf') {
      els.readerBody.innerHTML = `<div class="reader-pdf-wrap" style="overflow:auto;"><iframe data-reader-pdf src="${esc(url)}#toolbar=1" title="${esc(note.title)}" style="width:100%;height:70vh;border:0;transform-origin:top left;"></iframe></div>`;
      applyPdfZoom();
      return;
    }
    if (ext === 'jpg' || ext === 'png') {
      els.readerBody.innerHTML = `<div class="reader-image-wrap"><img src="${esc(url)}" alt="${esc(note.title)}" class="reader-image"></div>`;
      return;
    }
    if (ext === 'txt') {
      els.readerBody.innerHTML = '<div class="reader-text">Loading text...</div>';
      fetch(url, { credentials: 'same-origin' }).then(r => r.text()).then(t => {
        els.readerBody.innerHTML = `<pre class="reader-text">${esc(t)}</pre>`;
      }).catch(() => { els.readerBody.innerHTML = '<div class="reader-text">Could not load text preview. Use Download.</div>'; });
      return;
    }
    if (ext === 'doc' || ext === 'docx' || ext === 'ppt' || ext === 'pptx') {
      const absolute = new URL(url, window.location.href).href;
      const office = 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(absolute);
      const isLocalhost = /localhost|127\.0\.0\.1/i.test(window.location.hostname);
      if (isLocalhost) {
        els.readerBody.innerHTML = `<div class="reader-doc-fallback"><p>Online Office preview is not available for local XAMPP files. You can download the file or open it in your local Office app.</p><p><a class="btn btn-primary small" href="${esc(note.download_url)}">Download ${esc(ext.toUpperCase())}</a></p></div>`;
      } else {
        els.readerBody.innerHTML = `<div class="reader-doc-wrap"><iframe src="${esc(office)}" title="${esc(note.title)}" class="reader-doc-frame"></iframe><p class="reader-doc-note">If preview does not load, use the Download button.</p></div>`;
      }
      return;
    }
    els.readerBody.innerHTML = `<div class="reader-doc-fallback"><p>Preview is not available for this file type.</p><p><a class="btn btn-primary small" href="${esc(note.download_url)}">Download</a></p></div>`;
  }

  function applyPdfZoom() {
    const frame = els.readerBody?.querySelector('[data-reader-pdf]');
    if (!frame) return;
    frame.style.transform = `scale(${pdfZoom})`;
    frame.style.width = (100 / pdfZoom) + '%';
    frame.style.height = (70 * pdfZoom) + 'vh';
    if (els.readerZoomLabel) els.readerZoomLabel.textContent = Math.round(pdfZoom * 100) + '%';
  }

  function openReader(index) {
    if (index < 0 || index >= filtered.length) return;
    activeReaderIndex = index;
    const note = filtered[index];
    if (els.readerTitle) els.readerTitle.textContent = note.title;
    if (els.readerMeta) els.readerMeta.textContent = `${note.course_category} • ${String(note.file_type).toUpperCase()} • ${note.file_size_label || fmtBytes(note.file_size)} • Uploaded ${fmtDate(note.upload_date)} by ${note.uploader_name || 'Unknown'}`;
    if (els.readerDownload) els.readerDownload.href = note.download_url;
    renderReaderBody(note);
    updateReaderNav();
    if (els.reader) {
      els.reader.style.display = 'block';
      els.reader.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function closeReader() {
    activeReaderIndex = -1;
    if (els.reader) els.reader.style.display = 'none';
    if (els.readerBody) els.readerBody.innerHTML = '';
  }

  // Events
  if (els.pickBtn && els.file) els.pickBtn.addEventListener('click', () => { if (!currentUser) { if (window.openAuthModal) window.openAuthModal('login'); setMsg('Please log in to upload notes.', 'error'); return; } els.file.click(); });
  if (els.file) els.file.addEventListener('change', () => onFilePicked(els.file.files && els.file.files[0]));
  if (els.uploadBtn) els.uploadBtn.addEventListener('click', uploadNote);
  if (els.search) els.search.addEventListener('input', applyFilters);
  if (els.filter) els.filter.addEventListener('change', applyFilters);
  if (els.refresh) els.refresh.addEventListener('click', loadNotes);
  if (els.readerClose) els.readerClose.addEventListener('click', closeReader);
  if (els.readerPrev) els.readerPrev.addEventListener('click', () => openReader(activeReaderIndex - 1));
  if (els.readerNext) els.readerNext.addEventListener('click', () => openReader(activeReaderIndex + 1));
  if (els.readerZoomIn) els.readerZoomIn.addEventListener('click', () => { pdfZoom = Math.min(2, pdfZoom + 0.1); applyPdfZoom(); });
  if (els.readerZoomOut) els.readerZoomOut.addEventListener('click', () => { pdfZoom = Math.max(0.5, pdfZoom - 0.1); applyPdfZoom(); });

  // Init
  (async () => {
    await fetchMe();
    await loadNotes();
  })();
})();
