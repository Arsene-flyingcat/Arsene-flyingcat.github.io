/**
 * comments.js — Anonymous comment system using Firebase Firestore.
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

export async function initComments() {
  const list = document.getElementById('comments-list');
  const form = document.getElementById('comment-form');
  if (!list || !form) return;

  const pagePath = window.location.pathname;

  // Restore saved name
  const savedName = localStorage.getItem('comment_name');
  const nameInput = document.getElementById('comment-name');
  if (savedName && nameInput) nameInput.value = savedName;

  // Load Firebase and existing comments
  try {
    await initFirebase();
    const comments = await loadComments(pagePath);
    renderComments(comments, list);
  } catch (e) {
    console.warn('Comments: init failed', e);
  }

  // Handle form submit
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
      const newComment = await postComment(pagePath, name, content);
      if (newComment) {
        appendComment(newComment, list);
        contentInput.value = '';
        localStorage.setItem('comment_name', name);
      }
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
    const emptyEl = list.querySelector('.comments-empty');
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
      .orderBy('created_at', 'asc')
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.warn('Failed to load comments:', e);
    return [];
  }
}

async function postComment(pagePath, authorName, content) {
  if (!db) return null;
  const data = {
    page_path: pagePath,
    author_name: authorName,
    content: content,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  const ref = await db.collection('comments').add(data);
  // Return with a client-side timestamp for immediate rendering
  return { id: ref.id, author_name: authorName, content: content, created_at: new Date().toISOString() };
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
  comments.forEach(c => appendComment(c, container));
}

function appendComment(comment, container) {
  const empty = container.querySelector('.comments-empty');
  if (empty) empty.remove();

  const el = document.createElement('div');
  el.className = 'comment-item';

  const initial = (comment.author_name || '?')[0].toUpperCase();
  const color = AVATAR_COLORS[comment.author_name.length % AVATAR_COLORS.length];

  const ts = comment.created_at;
  const time = ts && ts.toDate ? ts.toDate() : new Date(ts);
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
