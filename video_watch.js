(async function () {
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const id = parseInt(params.get('id') || '0', 10);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDur = (sec) => { sec = Math.max(0, parseInt(sec||0,10)); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s2=sec%60; return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(s2).padStart(2,'0')}` : `${m}:${String(s2).padStart(2,'0')}`; };
  const fmtDate = (iso) => { try { return new Date(String(iso).replace(' ','T')).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); } catch { return iso; } };
  const fmtViews = (n) => { n=Number(n||0); if(n>=1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'')+'M views'; if(n>=1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'K views'; return n+' view'+(n===1?'':'s'); };

  async function api(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({ ok: false, error: 'Invalid server response' }));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Request failed');
    return data;
  }

  try {
    const me = await api('api/auth_me.php');
    if (!me.authenticated) { location.href = 'index.html?login=1'; return; }
    $('#vlUserLabel').textContent = me.user.name || me.user.email;
  } catch { location.href = 'index.html?login=1'; return; }

  if (!id) { $('#videoTitle').textContent = 'Video not found'; return; }
  try {
    const data = await api('api/video_watch.php?id=' + encodeURIComponent(id));
    const v = data.video;
    document.title = 'LEARNHUB | ' + v.title;
    $('#videoTitle').textContent = v.title;
    $('#videoMeta').innerHTML = `<span>${esc(v.teacher_name)}</span><span>${esc(fmtViews(v.view_count))}</span><span>${esc(fmtDate(v.created_at))}</span><span>${esc(v.category_name)} / ${esc(v.course_name)}</span>`;
    $('#videoDesc').textContent = v.description || 'No description provided.';

    const player = $('#player');
    if (v.video_type === 'upload' && v.video_url) {
      player.innerHTML = `<video class="watch-player" controls preload="metadata" poster="${esc(v.thumbnail_url || '')}"><source src="${esc(v.video_url)}">Your browser does not support HTML5 video.</video>`;
    } else if (v.embed_url && /^https?:\/\//i.test(v.embed_url)) {
      player.innerHTML = `<iframe class="watch-player" src="${esc(v.embed_url)}" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    } else {
      player.innerHTML = `<div class="watch-player" style="display:grid;place-items:center;color:#aaa;padding:24px;">This video cannot be played.</div>`;
    }

    const rel = $('#relatedList');
    const related = data.related || [];
    rel.innerHTML = related.length ? related.map(r => `
      <a class="related-item" href="video_watch.html?id=${r.id}">
        <div class="related-thumb">
          ${r.thumbnail_url ? `<img src="${esc(r.thumbnail_url)}" alt="${esc(r.title)} thumbnail" loading="lazy">` : `<div style="width:100%;height:100%;display:grid;place-items:center;color:#777"><i class="fa-solid fa-play-circle"></i></div>`}
          <span class="vl-duration">${esc(fmtDur(r.duration_seconds))}</span>
        </div>
        <div class="related-info">
          <h4>${esc(r.title)}</h4>
          <p>${esc(r.teacher_name)}</p>
          <p>${esc(fmtViews(r.view_count))} • ${esc(fmtDate(r.created_at))}</p>
        </div>
      </a>`).join('') : '<div class="vl-empty">No related videos yet.</div>';
  } catch (e) {
    $('#videoTitle').textContent = 'Unable to load video';
    $('#videoDesc').textContent = e.message || 'Video not found.';
  }
})();
