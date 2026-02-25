/**
 * comments.js — Anonymous comment system with replies, using Firebase Firestore.
 * No login required — just a name and message.
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB-DjO1mIz5HegiZwRvsBxfBlsVrRwteKo",
  authDomain: "my-personal-web-413c5.firebaseapp.com",
  projectId: "my-personal-web-413c5",
  storageBucket: "my-personal-web-413c5.firebasestorage.app",
  messagingSenderId: "292249724576",
  appId: "1:292249724576:web:96bbf7c3bd7694117e0bc5"
};

const AVATAR_COLORS = ['#A855F7', '#06B6D4', '#F472B6', '#FB923C', '#10B981'];

let db = null;
let _pagePath = '';
let _listEl = null;

export async function initComments() {
  _listEl = document.getElementById('comments-list');
  const form = document.getElementById('comment-form');
  if (!_listEl || !form) return;

  _pagePath = window.location.pathname;

  // Restore saved name
  const savedName = localStorage.getItem('comment_name');
  const nameInput = document.getElementById('comment-name');
  if (savedName && nameInput) nameInput.value = savedName;

  // Load Firebase and existing comments
  try {
    await initFirebase();
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
      localStorage.setItem('comment_name', name);
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

// ── Firebase ─────────────────────────────────────────────────────

async function initFirebase() {
  if (db) return;
  await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js');
  /* global firebase */
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  db = firebase.firestore();
}

async function loadComments(pagePath) {
  if (!db) return [];
  try {
    const snap = await db.collection('comments')
      .where('page_path', '==', pagePath)
      .get();
    const comments = snap.docs.map(doc => {
      const d = doc.data();
      return { id: doc.id, ...d, _ts: d.created_at ? d.created_at.toMillis() : 0 };
    });
    comments.sort((a, b) => a._ts - b._ts);
    return comments;
  } catch (e) {
    console.warn('Failed to load comments:', e);
    return [];
  }
}

async function postComment(pagePath, authorName, content, parentId) {
  if (!db) return null;
  const data = {
    page_path: pagePath,
    author_name: authorName,
    content: content,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (parentId) data.parent_id = parentId;
  await db.collection('comments').add(data);
}

async function reloadComments() {
  const comments = await loadComments(_pagePath);
  renderComments(comments, _listEl);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
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

  const ts = comment.created_at;
  const time = ts && ts.toDate ? ts.toDate() : new Date(ts);
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
  const savedName = localStorage.getItem('comment_name') || '';

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
      localStorage.setItem('comment_name', name);
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
