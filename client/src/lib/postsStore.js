// Simple localStorage store for posts
const KEY = "blog_posts";

export function loadPosts() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePosts(posts) {
  localStorage.setItem(KEY, JSON.stringify(posts));
  // let listeners (PostList) know data changed
  window.dispatchEvent(new Event("posts:changed"));
}

export function addPost(post) {
  const posts = loadPosts();
  posts.unshift(post); // newest first
  savePosts(posts);
  return post;
}

export function getPostById(id) {
  return loadPosts().find((p) => p.id === id);
}

export function updatePost(id, patch) {
  const posts = loadPosts().map((p) => (p.id === id ? { ...p, ...patch } : p));
  savePosts(posts);
}

export function deletePost(id) {
  const posts = loadPosts().filter((p) => p.id !== id);
  savePosts(posts);
}
