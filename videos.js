(async function () {
  const $ = (s) => document.querySelector(s);
  const grid = $('#videosGrid');
  const empty = $('#videosEmpty');
  const count = $('#videosCount');
  const sectionTitle = $('#videosSectionTitle');
  const categoryFilter = $('#categoryFilter');
  const courseFilter = $('#courseFilter');
  const sortFilter = $('#sortFilter');
  const searchInput = $('#videoSearch');
  const searchBtn = $('#videoSearchBtn');
  const mineFilter = $('#mineFilter');
  const mineWrap = $('#mineFilterWrap');
  const teacherPanel = $('#teacherPanel');
  const openUploadBtn = $('#openUploadBtn');
  const uploadForm = $('#videoUploadForm');
  const uploadMsg = $('#uploadMsg');
  const uploadCategory = $('#uploadCategory');
  const uploadCourse = $('#uploadCourse');
  const myVideosGrid = $('#myVideosGrid');
  let csrf = '';
  let currentUser = null;
  let categories = [];
  let courses = [];
  let allVideos = [];

  const api = async (url, opts = {}) => {
    const method = String(opts.method || 'GET').toUpperCase();
    const headers = { ...(opts.headers || {}) };
    if (!(opts.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    if (csrf && !['GET','HEAD','OPTIONS'].includes(method)) headers['X-CSRF-Token'] = csrf;
    const res = await fetch(url, { credentials: 'same-origin', ...opts, headers });
    const data = await res.json().catch(() => ({ ok: false, error: 'Invalid server response' }));
    if (data && data.csrf_token) csrf = data.csrf_token;
    if (!res.ok || data.ok === false) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
    return data;
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDur = (sec) => { sec = Math.max(0, parseInt(sec||0,10)); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s2=sec%60; return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(s2).padStart(2,'0')}` : `${m}:${String(s2).padStart(2,'0')}`; };
  const fmtDate = (iso) => { try { return new Date(iso.replace(' ','T')).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); } catch { return iso; } };
  const fmtViews = (n) => { n=Number(n||0); if(n>=1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'')+'M views'; if(n>=1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'K views'; return n+' view'+(n===1?'':'s'); };
  const initials = (name) => String(name||'LH').trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||'').join('') || 'LH';

  async function ensureAuth() {
    try {
      const me = await api('api/auth_me.php');
      if (!me.authenticated) { window.location.href = 'index.html?login=1'; return false; }
      currentUser = me.user; csrf = me.csrf_token || csrf;
      $('#vlUserLabel').textContent = currentUser.name || currentUser.email;
      const canManage = (currentUser.role === 'admin' || (currentUser.role === 'teacher' && Number(currentUser.teacher_approved) === 1));
      teacherPanel.hidden = !canManage;
      openUploadBtn.hidden = !canManage;
      mineWrap.hidden = !canManage;
      if (canManage) $('#uploadCsrf').value = csrf;
      return true;
    } catch (e) {
      window.location.href = 'index.html?login=1';
      return false;
    }
  }

  function populateCategorySelects() {
    const catOpts = '<option value="all">All Categories</option>' + categories.map(c => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');
    categoryFilter.innerHTML = catOpts;
    uploadCategory.innerHTML = '<option value="">Select category</option>' + categories.map(c => `<option value="${c.id}" data-slug="${esc(c.slug)}">${esc(c.name)}</option>`).join('');
    populateCourseSelects();
  }
  function populateCourseSelects() {
    const catSlug = categoryFilter.value;
    const filtered = catSlug && catSlug !== 'all' ? courses.filter(c => c.category_slug === catSlug) : courses;
    courseFilter.innerHTML = '<option value="all">All Courses</option>' + filtered.map(c => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');
    const upCatId = parseInt(uploadCategory.value || '0', 10);
    const upFiltered = upCatId ? courses.filter(c => Number(c.category_id) === upCatId) : courses;
    uploadCourse.innerHTML = '<option value="">Select course/subcategory</option>' + upFiltered.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }

  function videoCard(v, manage=false) {
    const thumb = v.thumbnail_url ? `<img class="vl-thumb" src="${esc(v.thumbnail_url)}" alt="${esc(v.title)} thumbnail" loading="lazy">` : `<div class="vl-thumb" style="display:grid;place-items:center;color:#777;font-size:2rem;"><i class="fa-solid fa-play-circle"></i></div>`;
    const status = manage ? `<span class="vl-status ${v.publication_status==='published'?'published':''}">${esc(v.publication_status)}</span>` : '';
    const manageBtns = manage ? `<div class="vl-manage-row"><a class="vl-mini-btn" href="video_watch.html?id=${v.id}">View</a><button class="vl-mini-btn danger" data-delete-video="${v.id}">Delete</button></div>` : '';
    return `<article class="vl-card ${manage?'vl-card-manage':''}">
      <a class="vl-thumb-wrap" href="video_watch.html?id=${v.id}">
        ${thumb}
        <span class="vl-duration">${esc(fmtDur(v.duration_seconds))}</span>
      </a>
      <div class="vl-card-body">
        <div class="vl-channel" aria-hidden="true">${esc(initials(v.teacher_name))}</div>
        <div class="vl-meta">
          <h3 class="vl-title"><a href="video_watch.html?id=${v.id}">${esc(v.title)}</a>${status}</h3>
          <div class="vl-meta-line"><span>${esc(v.teacher_name)}</span></div>
          <div class="vl-meta-line"><span>${esc(fmtViews(v.view_count))}</span><span>${esc(fmtDate(v.created_at))}</span></div>
          <span class="vl-badge">${esc(v.category_name)} • ${esc(v.course_name)}</span>
          ${manageBtns}
        </div>
      </div>
    </article>`;
  }

  async function loadVideos() {
    const params = new URLSearchParams();
    if (categoryFilter.value && categoryFilter.value !== 'all') params.set('category', categoryFilter.value);
    if (courseFilter.value && courseFilter.value !== 'all') params.set('course', courseFilter.value);
    if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
    params.set('sort', sortFilter.value || 'latest');
    const data = await api('api/videos_list.php?' + params.toString());
    categories = data.categories || categories;
    courses = data.courses || courses;
    allVideos = data.videos || [];
    if (categoryFilter.options.length <= 1) populateCategorySelects();
    else populateCourseSelects();
    renderVideos();
    if (currentUser && (currentUser.role === 'admin' || (currentUser.role === 'teacher' && Number(currentUser.teacher_approved)===1))) loadMyVideos();
  }

  function renderVideos() {
    sectionTitle.textContent = sortFilter.value === 'popular' ? 'Popular Videos' : 'Latest Videos';
    count.textContent = `${allVideos.length} video${allVideos.length===1?'':'s'}`;
    grid.innerHTML = allVideos.map(v => videoCard(v, false)).join('');
    empty.hidden = allVideos.length !== 0;
  }

  async function loadMyVideos() {
    try {
      const params = new URLSearchParams({ mine: '1', sort: 'latest' });
      const data = await api('api/videos_list.php?' + params.toString());
      const vids = data.videos || [];
      myVideosGrid.innerHTML = vids.map(v => videoCard(v, true)).join('') || '<div class="vl-empty">You have not uploaded videos yet.</div>';
      myVideosGrid.querySelectorAll('[data-delete-video]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this video?')) return;
          try {
            await api('api/video_delete.php', { method: 'POST', body: JSON.stringify({ id: Number(btn.dataset.deleteVideo), csrf_token: csrf }) });
            await loadVideos();
          } catch (e) { alert(e.message || 'Delete failed'); }
        });
      });
    } catch (e) { /* ignore */ }
  }

  categoryFilter.addEventListener('change', () => { populateCourseSelects(); loadVideos().catch(console.error); });
  courseFilter.addEventListener('change', () => loadVideos().catch(console.error));
  sortFilter.addEventListener('change', () => loadVideos().catch(console.error));
  searchBtn.addEventListener('click', () => loadVideos().catch(console.error));
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadVideos().catch(console.error); } });
  let searchTimer; searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadVideos().catch(console.error), 300); });
  openUploadBtn.addEventListener('click', () => { teacherPanel.scrollIntoView({behavior:'smooth', block:'start'}); });
  uploadCategory.addEventListener('change', populateCourseSelects);

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadMsg.textContent = 'Uploading...'; uploadMsg.className = 'vl-upload-msg';
    const fd = new FormData(uploadForm);
    fd.set('csrf_token', csrf);
    const file = $('#videoFileInput').files[0];
    const extUrl = $('#externalUrlInput').value.trim();
    if (!file && !extUrl) { uploadMsg.textContent = 'Provide a video file or an authorized external URL.'; uploadMsg.className='vl-upload-msg error'; return; }
    if (file && extUrl) { uploadMsg.textContent = 'Use either a file or an external URL.'; uploadMsg.className='vl-upload-msg error'; return; }
    try {
      const data = await api('api/video_upload.php', { method: 'POST', body: fd });
      uploadMsg.textContent = data.message || 'Video saved.'; uploadMsg.className = 'vl-upload-msg success';
      uploadForm.reset(); $('#uploadCsrf').value = csrf; populateCourseSelects();
      await loadVideos();
    } catch (err) {
      uploadMsg.textContent = err.message || 'Upload failed.'; uploadMsg.className = 'vl-upload-msg error';
    }
  });

  if (await ensureAuth()) {
    await loadVideos();
  }
})();
