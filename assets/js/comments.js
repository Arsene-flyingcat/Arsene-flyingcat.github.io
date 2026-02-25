/**
 * comments.js — Anonymous comment system using Supabase.
 * No login required — just a name and message.
 */

const SUPABASE_URL = 'https://yzgbwpmkfwtdecouayit.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Z2J3cG1rZnd0ZGVjb3VheWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MDIxMzksImV4cCI6MjA1NjA3ODEzOX0.placeholder';

const AVATAR_COLORS = ['#A855F7', '#06B6D4', '#F472B6', '#FB923C', '#10B981'];

export function initComments() {
  const list = document.getElementById('comments-list');
  const form = document.getElementById('comment-form');
  if (!list || !form) return;

  const pagePath = window.location.pathname;

  // Restore saved name
  const savedName = localStorage.getItem('comment_name');
  const nameInput = document.getElementById('comment-name');
  if (savedName && nameInput) nameInput.value = savedName;

  // Load existing comments
  loadComments(pagePath).then(comments => renderComments(comments, list));

  // Handle form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const contentInput = document.getElementById('comment-content');
    const content = contentInput.value.trim();
    const honeypot = document.getElementById('comment-url');

    // Honeypot check — bots fill hidden fields
    if (!name || !content || (honeypot && honeypot.value)) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const result = await postComment(pagePath, name, content);
      if (result && result.length) {
        appendComment(result[0], list);
        contentInput.value = '';
        localStorage.setItem('comment_name', name);
      }
    } catch (err) {
      console.warn('Failed to post comment:', err);
    }

    btn.disabled = false;
    btn.textContent = getLang() === 'zh' ? '发表评论' : 'Post';
  });

  // Update placeholders for current language
  updateFormLang(form);
}

function getLang() {
  return document.documentElement.getAttribute('data-lang') || 'en';
}

function updateFormLang(form) {
  const lang = getLang();
  const nameInput = form.querySelector('#comment-name');
  const contentInput = form.querySelector('#comment-content');
  const btn = form.querySelector('button[type="submit"]');
  if (nameInput) nameInput.placeholder = lang === 'zh' ? '你的名字' : 'Your name';
  if (contentInput) contentInput.placeholder = lang === 'zh' ? '写下你的评论...' : 'Leave a comment...';
  if (btn) btn.textContent = lang === 'zh' ? '发表评论' : 'Post';
}

// ── Supabase REST API ────────────────────────────────────────────

async function loadComments(pagePath) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/comments?page_path=eq.${encodeURIComponent(pagePath)}&order=created_at.asc`;
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    console.warn('Failed to load comments:', e);
    return [];
  }
}

async function postComment(pagePath, authorName, content) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      page_path: pagePath,
      author_name: authorName,
      content: content
    })
  });
  return res.json();
}

// ── Rendering ────────────────────────────────────────────────────

function renderComments(comments, container) {
  container.innerHTML = '';
  if (!comments.length) {
    const msg = getLang() === 'zh' ? '还没有评论，来做第一个吧！' : 'No comments yet. Be the first!';
    container.innerHTML = `<p class="comments-empty">${msg}</p>`;
    return;
  }
  comments.forEach(c => appendComment(c, container));
}

function appendComment(comment, container) {
  const empty = container.querySelector('.comments-empty');
  if (empty) empty.remove();

  const el = document.createElement('div');
  el.className = 'comment-item';

  const initial = (comment.author_name || '?')[0].toUpperCase();
  const color = AVATAR_COLORS[comment.author_name.length % AVATAR_COLORS.length];

  const time = new Date(comment.created_at);
  const timeStr = time.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  }) + ' ' + time.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit'
  });

  el.innerHTML = `
    <div class="comment-avatar" style="background:${color}">${initial}</div>
    <div class="comment-body">
      <div class="comment-meta">
        <span class="comment-author">${escapeHtml(comment.author_name)}</span>
        <span class="comment-time">${timeStr}</span>
      </div>
      <div class="comment-text">${escapeHtml(comment.content)}</div>
    </div>
  `;
  container.appendChild(el);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
