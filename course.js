(() => {
  const slug = window.LEARNHUB_COURSE_SLUG || new URLSearchParams(location.search).get('course') || 'html';
  const app = document.getElementById('course-app');
  const lessonList = document.getElementById('lesson-list');
  const statusEl = document.getElementById('dashboard-status');
  const modal = document.getElementById('lesson-modal');
  const modalTitle = document.getElementById('lesson-modal-title');
  const modalKicker = document.getElementById('lesson-modal-kicker');
  const modalDesc = document.getElementById('lesson-modal-desc');
  const modalContent = document.getElementById('lesson-modal-content');
  let dashboard = null;
  let activeLesson = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const setStatus = (msg, type='info') => { statusEl.textContent = msg || ''; statusEl.dataset.type = type; statusEl.style.display = msg ? 'block' : 'none'; };
  const api = async (url, opts={}) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) }, credentials: 'same-origin', ...opts });
    const data = await res.json().catch(() => ({ ok: false, error: 'Invalid server response.' }));
    if (!res.ok || data.ok === false) throw Object.assign(new Error(data.error || 'Request failed.'), { data, status: res.status });
    return data;
  };

  function render() {
    if (!dashboard) return;
    const { course, lessons, progress, next_course: next, authenticated, user } = dashboard;
    document.title = `${course.name} Course - LEARNHUB`;
    document.body.style.setProperty('--course-accent', course.accent || '#0d8bf2');
    document.getElementById('course-badge').style.setProperty('--course-accent', course.accent || '#0d8bf2');
    document.querySelector('.course-badge-icon').textContent = course.icon || 'LH';
    document.getElementById('course-category').textContent = course.category || 'Course';
    document.getElementById('course-title').textContent = course.name;
    document.getElementById('course-description').textContent = course.short_description;
    document.getElementById('breadcrumb-course').textContent = course.name;
    document.getElementById('course-difficulty').textContent = `Difficulty: ${course.difficulty}`;
    document.getElementById('course-time').textContent = `Estimated time: ${course.estimated_time}`;
    document.getElementById('course-access').textContent = 'Access: Free for all students';
    document.getElementById('progress-percent').textContent = `${progress.completion_percent}%`;
    document.getElementById('progress-fill').style.width = `${progress.completion_percent}%`;
    document.querySelector('.progress-track').setAttribute('aria-valuenow', String(progress.completion_percent));
    document.getElementById('progress-caption').textContent = `${progress.completed_count} of ${progress.total_lessons} lessons completed`;
    document.getElementById('stat-completed').textContent = progress.completed_count;
    document.getElementById('stat-total').textContent = progress.total_lessons;
    document.getElementById('stat-percent').textContent = `${progress.completion_percent}%`;
    document.getElementById('stat-percent-detail').textContent = progress.course_completed ? 'Course completed' : 'In progress';
    document.getElementById('curriculum-title').textContent = `${course.name} Lessons`;
    document.getElementById('curriculum-note').textContent = 'All lessons are available. You can study in any order and track your progress.';

    const name = user?.name || 'Guest Student';
    const email = user?.email || 'Log in to save progress';
    document.getElementById('sidebar-user').innerHTML = `<span class="sidebar-user-name">${esc(name)}</span><span class="sidebar-user-email">${esc(email)}</span>`;
    document.getElementById('topbar-name').textContent = user?.name || 'Guest';
    document.getElementById('topbar-role').textContent = user ? 'Student' : 'Not signed in';
    document.getElementById('topbar-avatar').textContent = (user?.name || 'G').trim().charAt(0).toUpperCase();
    const authAction = document.getElementById('sidebar-auth-action');
    authAction.textContent = authenticated ? 'Logout' : 'Login / Sign Up';
    authAction.href = authenticated ? '#' : '../index.html';
    authAction.onclick = authenticated ? async (e) => { e.preventDefault(); try { await api('../api/auth_logout.php', { method: 'POST', body: '{}' }); } catch {} location.href = '../index.html'; } : null;

    lessonList.innerHTML = lessons.map(l => {
      const statusClass = l.status === 'completed' ? 'completed' : 'available';
      const icon = l.status === 'completed' ? 'âœ“' : 'ðŸ“˜';
      const statusLabel = l.status === 'completed' ? 'Completed' : 'Available';
      const btn = `<button type="button" class="btn btn-primary small" data-open-lesson="${l.id}">View Lesson</button>`;
      return `<article class="lesson-row ${statusClass}">
        <div class="lesson-main">
          <div class="lesson-status-icon ${statusClass}" aria-hidden="true">${icon}</div>
          <div class="lesson-info">
            <p class="lesson-kicker">Lesson ${l.number}</p>
            <h3><button type="button" class="lesson-title-btn" data-open-lesson="${l.id}">${esc(l.title)}</button></h3>
            <p>${esc(l.short_description)}</p>
          </div>
        </div>
        <div class="lesson-actions">
          <span class="status-pill ${statusClass}">${statusLabel}</span>
          ${btn}
        </div>
      </article>`;
    }).join('');

    lessonList.querySelectorAll('[data-open-lesson]').forEach(btn => btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-open-lesson'));
      const lesson = lessons.find(x => x.id === id);
      if (lesson) openLesson(lesson);
    }));

    renderNextCourse(next);
  }

  function renderNextCourse(next) {
    const section = document.getElementById('next-course-section');
    if (!next) { section.hidden = true; return; }
    section.hidden = false;
    document.getElementById('next-course-name').textContent = next.name;
    document.getElementById('next-course-description').textContent = next.short_description;
    document.getElementById('next-course-category').textContent = next.category;
    document.getElementById('next-course-difficulty').textContent = next.difficulty;
    document.getElementById('next-course-price').textContent = 'Free';
    document.getElementById('next-course-badge').textContent = next.icon || 'NEXT';
    document.getElementById('next-course-badge').style.background = next.accent || 'var(--course-accent)';
    const status = document.getElementById('next-course-status');
    const msg = document.getElementById('next-course-message');
    const payBtn = document.getElementById('next-course-pay-btn');
    const openBtn = document.getElementById('next-course-open-btn');
    openBtn.href = `course.php?course=${encodeURIComponent(next.slug)}`;
    status.textContent = 'Available';
    status.className = 'status-pill available';
    msg.textContent = 'This course is available. You can open it anytime.';
    if (payBtn) { payBtn.hidden = true; payBtn.onclick = null; }
    openBtn.hidden = false;
  }

  function openLesson(lesson) {
    activeLesson = lesson;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    modalKicker.textContent = `Lesson ${lesson.number}`;
    modalTitle.textContent = lesson.title;
    modalDesc.textContent = lesson.short_description;
    const quiz = lesson.quiz || {};
    const options = Array.isArray(quiz.options) ? quiz.options : [];
    const idx = dashboard.lessons.findIndex(l => l.id === lesson.id);
    const prev = idx > 0 ? dashboard.lessons[idx - 1] : null;
    const next = idx >= 0 && idx < dashboard.lessons.length - 1 ? dashboard.lessons[idx + 1] : null;
    modalContent.innerHTML = `
      <section class="lesson-block"><h3>Introduction</h3><p>${esc(lesson.introduction)}</p></section>
      <section class="lesson-block"><h3>Detailed Explanation</h3><p>${esc(lesson.explanation)}</p></section>
      <section class="lesson-block"><h3>Applications</h3><ul>${(lesson.applications||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></section>
      <section class="lesson-block"><h3>Examples</h3><ul>${(lesson.examples||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></section>
      <section class="lesson-block"><h3>Exercises</h3><ul>${(lesson.exercises||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></section>
      <section class="lesson-block quiz-block"><h3>Interactive Quiz</h3>
        <p class="quiz-question">${esc(quiz.question || '')}</p>
        <div class="quiz-options">${options.map((opt,i)=>`<label class="quiz-option"><input type="radio" name="quiz-${lesson.id}" value="${i}"> <span>${esc(opt)}</span></label>`).join('')}</div>
        <div class="lesson-actions-row">
          <button type="button" class="btn btn-secondary-dark small" id="submit-quiz-btn">Submit Quiz</button>
          <button type="button" class="btn btn-primary small" id="complete-lesson-btn">${lesson.status === 'completed' ? 'Completed' : 'Mark Lesson Complete'}</button>
          <button type="button" class="btn btn-secondary-dark small" id="download-notes-btn">Download Notes as PDF</button>
        </div>
        <p class="quiz-feedback" id="quiz-feedback" aria-live="polite"></p>
      </section>
      <div class="lesson-nav-row">
        <button type="button" class="btn btn-secondary-dark small" id="prev-lesson-btn" ${prev ? '' : 'disabled'}>Previous Lesson</button>
        <button type="button" class="btn btn-primary small" id="next-lesson-btn" ${next ? '' : 'disabled'}>Next Lesson</button>
      </div>`;
    document.getElementById('submit-quiz-btn').addEventListener('click', submitQuiz);
    const completeBtn = document.getElementById('complete-lesson-btn');
    if (lesson.status === 'completed') { completeBtn.disabled = true; }
    else { completeBtn.addEventListener('click', completeLesson); }
    document.getElementById('download-notes-btn').addEventListener('click', downloadNotes);
    const prevBtn = document.getElementById('prev-lesson-btn');
    const nextBtn = document.getElementById('next-lesson-btn');
    if (prev && prevBtn) prevBtn.addEventListener('click', () => openLesson(prev));
    if (next && nextBtn) nextBtn.addEventListener('click', () => openLesson(next));
  }

  function closeModal() { modal.hidden = true; document.body.classList.remove('modal-open'); activeLesson = null; }

  async function completeLesson() {
    if (!dashboard?.authenticated) { setStatus('Please log in to save your progress.', 'error'); location.href='../index.html'; return; }
    if (!activeLesson) return;
    try {
      await api('../api/lesson_complete.php', { method: 'POST', body: JSON.stringify({ lesson_id: activeLesson.id, course_slug: slug }) });
      setStatus('Lesson marked as complete.', 'success');
      closeModal();
      await loadDashboard();
    } catch (e) { setStatus(e.message, 'error'); }
  }

  async function submitQuiz() {
    if (!dashboard?.authenticated) { setStatus('Please log in to submit quizzes.', 'error'); return; }
    if (!activeLesson) return;
    const selected = modalContent.querySelector(`input[name="quiz-${activeLesson.id}"]:checked`);
    const feedback = document.getElementById('quiz-feedback');
    if (!selected) { feedback.textContent = 'Select an answer before submitting.'; feedback.className = 'quiz-feedback error'; return; }
    try {
      const data = await api('../api/quiz_submit.php', { method: 'POST', body: JSON.stringify({ lesson_id: activeLesson.id, course_slug: slug, selected_answer: Number(selected.value) }) });
      feedback.textContent = data.correct ? `Correct! ${data.explanation || ''}` : `Incorrect. ${data.explanation || ''}`;
      feedback.className = `quiz-feedback ${data.correct ? 'success' : 'error'}`;
    } catch (e) { feedback.textContent = e.message; feedback.className = 'quiz-feedback error'; }
  }

  function downloadNotes() {
    if (!activeLesson || !dashboard) return;
    const c = dashboard.course;
    const l = activeLesson;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.name)} - ${esc(l.title)}</title>
      <style>body{font-family:Arial,sans-serif;margin:40px;color:#18324d;line-height:1.6}h1,h2{color:#0d8bf2} .box{border:1px solid #d7e4f1;border-radius:10px;padding:16px;margin:12px 0}</style></head>
      <body><h1>${esc(c.name)} - Lesson ${l.number}: ${esc(l.title)}</h1><p>${esc(l.short_description)}</p>
      <div class="box"><h2>Introduction</h2><p>${esc(l.introduction)}</p></div>
      <div class="box"><h2>Detailed Explanation</h2><p>${esc(l.explanation)}</p></div>
      <div class="box"><h2>Applications</h2><ul>${(l.applications||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>
      <div class="box"><h2>Examples</h2><ul>${(l.examples||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>
      <div class="box"><h2>Exercises</h2><ul>${(l.exercises||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { setStatus('Allow popups to download notes as PDF.', 'error'); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 250);
  }

  async function startPayment(course, next) {
    if (!dashboard?.authenticated) { location.href = '../index.html'; return; }
    const payBtn = document.getElementById('next-course-pay-btn');
    payBtn.disabled = true; payBtn.textContent = 'Creating payment...';
    try {
      const created = await api('../api/payment_create.php', { method: 'POST', body: JSON.stringify({ current_course_slug: course.slug, next_course_slug: next.slug }) });
      if (created.already_unlocked) { await loadDashboard(); return; }
      const payment = created.payment;
      const confirmed = window.confirm(`Confirm server-verified payment of $${Number(payment.amount).toFixed(2)} ${payment.currency} for ${payment.course_name}?\n\nReference: ${payment.reference}\n\nThis simulates a verified gateway confirmation in XAMPP local development.`);
      if (!confirmed) { payBtn.disabled = false; payBtn.textContent = 'Pay Now to Unlock Next Course'; return; }
      payBtn.textContent = 'Verifying payment...';
      const result = await api('../api/payment_confirm.php', { method: 'POST', body: JSON.stringify({ reference: payment.reference, client_token: payment.client_token }) });
      if (result.status === 'confirmed') {
        setStatus(`Payment verified. ${payment.course_name} is now unlocked.`, 'success');
        await loadDashboard();
      }
    } catch (e) {
      setStatus(e.message, 'error');
      payBtn.disabled = false; payBtn.textContent = 'Pay Now to Unlock Next Course';
    }
  }

  async function loadDashboard() {
    try {
      setStatus('Loading course dashboard...');
      dashboard = await api(`../api/course_dashboard.php?course=${encodeURIComponent(slug)}`);
      setStatus('');
      render();
    } catch (e) {
      setStatus(e.message || 'Failed to load course dashboard. Make sure MySQL is running and database/learnhub.sql has been imported.', 'error');
      lessonList.innerHTML = `<div class="empty-state">Unable to load this course. ${esc(e.message || '')}</div>`;
    }
  }

  document.getElementById('lesson-modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target.matches('[data-close-modal]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => app.classList.toggle('sidebar-open'));
  document.getElementById('course-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('course-search-input').value.trim().toLowerCase();
    if (!q || !dashboard) return;
    const match = dashboard.lessons.find(l => l.title.toLowerCase().includes(q) || l.short_description.toLowerCase().includes(q));
    if (match) { openLesson(match); } else { setStatus('No lesson matched your search.', 'info'); }
  });
  document.querySelectorAll('[data-sidebar-scroll]').forEach(a => a.addEventListener('click', (e) => {
    const id = a.getAttribute('data-sidebar-scroll');
    const el = document.getElementById(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }));
  document.getElementById('notification-btn').addEventListener('click', () => {
    if (!dashboard) return;
    const p = dashboard.progress;
    setStatus(p.course_completed ? 'All lessons completed. You can unlock the next course.' : `You have completed ${p.completed_count} of ${p.total_lessons} lessons.`, 'info');
  });

  loadDashboard();
})();

