/**
 * comments.js — Anonymous comment system with replies.
 * Uses a Cloudflare Worker proxy to Firestore (bypasses China GFW).
 */

const COMMENTS_API = 'https://blog-comments-proxy.arsene-lishuo.workers.dev/api/comments';

const AVATAR_COLORS = ['#A855F7', '#06B6D4', '#F472B6', '#FB923C', '#10B981'];

let _pagePath = '';
let _listEl = null;

export async function initComments() {
  _listEl = document.getElementById('comments-list');
  const form = document.getElementById('comment-form');
  if (!_listEl || !form) return;

  _pagePath = window.location.pathname;

  const nameInput = document.getElementById('comment-name');

  // Load existing comments
  try {
    await reloadComments();
  } catch (e) {
    console.warn('Comments: init failed', e);
  }

  // Handle top-level form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const contentInput = document.getElementById('comment-content');
    const content = contentInput.value.trim();
    const honeypot = document.getElementById('comment-url');

    if (!name || !content || (honeypot && honeypot.value)) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      await postComment(_pagePath, name, content, null);
      contentInput.value = '';
      await reloadComments();
    } catch (err) {
      console.warn('Failed to post comment:', err);
    }

    btn.disabled = false;
    btn.textContent = getLang() === 'zh' ? '发表评论' : 'Post';
  });

  updateFormLang(form);

  // Re-translate when language toggles
  document.addEventListener('langchange', () => {
    updateFormLang(form);
    // Update reply buttons and empty state
    document.querySelectorAll('.comment-reply-btn').forEach(b => {
      b.textContent = getLang() === 'zh' ? '回复' : 'Reply';
    });
    const emptyEl = _listEl.querySelector('.comments-empty');
    if (emptyEl) {
      emptyEl.textContent = getLang() === 'zh' ? '还没有评论，来做第一个吧！' : 'No comments yet. Be the first!';
    }
  });
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

// ── API ──────────────────────────────────────────────────────────

async function loadComments(pagePath) {
  try {
    const resp = await fetch(COMMENTS_API + '?page_path=' + encodeURIComponent(pagePath));
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.json();
  } catch (e) {
    console.warn('Failed to load comments:', e);
    return [];
  }
}

async function postComment(pagePath, authorName, content, parentId) {
  const body = { page_path: pagePath, author_name: authorName, content };
  if (parentId) body.parent_id = parentId;
  const resp = await fetch(COMMENTS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'HTTP ' + resp.status);
  }
}

async function reloadComments() {
  const comments = await loadComments(_pagePath);
  renderComments(comments, _listEl);
}

// ── Rendering ────────────────────────────────────────────────────

function renderComments(comments, container) {
  container.innerHTML = '';
  if (!comments.length) {
    const msg = getLang() === 'zh' ? '还没有评论，来做第一个吧！' : 'No comments yet. Be the first!';
    container.innerHTML = `<p class="comments-empty">${msg}</p>`;
    return;
  }

  // Separate top-level and replies
  const topLevel = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);
  const replyMap = {};
  replies.forEach(r => {
    if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
    replyMap[r.parent_id].push(r);
  });

  topLevel.forEach(c => {
    const el = buildCommentEl(c);
    container.appendChild(el);

    // Render replies indented
    if (replyMap[c.id]) {
      const repliesDiv = document.createElement('div');
      repliesDiv.className = 'comment-replies';
      replyMap[c.id].forEach(r => {
        repliesDiv.appendChild(buildCommentEl(r, true));
      });
      container.appendChild(repliesDiv);
    }
  });
}

function buildCommentEl(comment, isReply) {
  const el = document.createElement('div');
  el.className = 'comment-item' + (isReply ? ' comment-item--reply' : '');

  const initial = (comment.author_name || '?')[0].toUpperCase();
  const color = AVATAR_COLORS[comment.author_name.length % AVATAR_COLORS.length];

  const time = new Date(comment.created_at);
  const timeStr = time.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  }) + ' ' + time.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit'
  });

  const replyLabel = getLang() === 'zh' ? '回复' : 'Reply';

  el.innerHTML = `
    <div class="comment-avatar" style="background:${color}">${initial}</div>
    <div class="comment-body">
      <div class="comment-meta">
        <span class="comment-author">${escapeHtml(comment.author_name)}</span>
        <span class="comment-time">${timeStr}</span>
      </div>
      <div class="comment-text">${escapeHtml(comment.content)}</div>
      ${!isReply ? `<button class="comment-reply-btn" type="button">${replyLabel}</button>` : ''}
    </div>
  `;

  // Bind reply button
  if (!isReply) {
    const replyBtn = el.querySelector('.comment-reply-btn');
    replyBtn.addEventListener('click', () => toggleReplyForm(el, comment));
  }

  return el;
}

function toggleReplyForm(commentEl, parentComment) {
  // Close any other open reply forms
  document.querySelectorAll('.reply-form-inline').forEach(f => f.remove());

  const existing = commentEl.querySelector('.reply-form-inline');
  if (existing) { existing.remove(); return; }

  const lang = getLang();
  const savedName = '';

  const form = document.createElement('form');
  form.className = 'reply-form-inline';
  form.innerHTML = `
    <input type="text" class="reply-name" placeholder="${lang === 'zh' ? '你的名字' : 'Your name'}" value="${escapeHtml(savedName)}" required>
    <textarea class="reply-content" placeholder="${lang === 'zh' ? '写下你的回复...' : 'Write a reply...'}" rows="3" required></textarea>
    <div class="reply-form-actions">
      <button type="button" class="btn btn-ghost btn-sm reply-cancel">${lang === 'zh' ? '取消' : 'Cancel'}</button>
      <button type="submit" class="btn btn-primary btn-sm">${lang === 'zh' ? '回复' : 'Reply'}</button>
    </div>
  `;

  // Insert after the comment body
  commentEl.querySelector('.comment-body').appendChild(form);

  form.querySelector('.reply-cancel').addEventListener('click', () => form.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.querySelector('.reply-name').value.trim();
    const content = form.querySelector('.reply-content').value.trim();
    if (!name || !content) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      await postComment(_pagePath, name, content, parentComment.id);
      await reloadComments();
    } catch (err) {
      console.warn('Failed to post reply:', err);
      btn.disabled = false;
      btn.textContent = lang === 'zh' ? '回复' : 'Reply';
    }
  });

  form.querySelector('.reply-content').focus();
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
