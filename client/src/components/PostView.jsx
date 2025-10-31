import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPost, deletePost, toImg, postService, categoryService } from "../services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import PostForm from "./PostForm";

export default function PostView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState("loading");
  const [err, setErr] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [categories, setCategories] = useState([]);
  const [popular, setPopular] = useState([]);
  const [editOpen, setEditOpen] = useState(false);

  const toEmbedUrl = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      // YouTube
      if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
        let id = '';
        if (host === 'youtu.be') {
          id = u.pathname.split('/').filter(Boolean)[0] || '';
        } else if (u.pathname.startsWith('/watch')) {
          id = u.searchParams.get('v') || '';
        } else if (u.pathname.startsWith('/embed/')) {
          id = u.pathname.split('/')[2] || '';
        }
        if (id) {
          const listId = u.searchParams.get('list');
          return `https://www.youtube.com/embed/${id}?controls=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1${listId ? `&list=${encodeURIComponent(listId)}` : ''}`;
        }
      }
      // Google Drive
      if (host === 'drive.google.com') {
        // /file/d/ID/view or .../preview
        const parts = u.pathname.split('/');
        const idx = parts.findIndex((p) => p === 'd');
        if (idx >= 0 && parts[idx + 1]) {
          const id = parts[idx + 1];
          return `https://drive.google.com/file/d/${id}/preview`;
        }
        const idParam = u.searchParams.get('id');
        if (idParam) return `https://drive.google.com/file/d/${idParam}/preview`;
      }
    } catch (_) {}
    return null;
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await getPost(id);
        setPost(data);
        setStatus("ready");
      } catch (e) {
        setErr(e.message);
        setStatus("error");
      }
    })();
  }, [id]);

  // Sidebar data: categories + popular posts
  useEffect(() => {
    (async () => {
      try {
        const [cats, pops] = await Promise.all([
          categoryService.getAllCategories().catch(() => []),
          postService.getPopular(5).catch(() => []),
        ]);
        setCategories(cats || []);
        setPopular(pops || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const onDelete = async () => {
    const ok = window.confirm("Delete this post?");
    if (!ok) return;
    try {
      await deletePost(id);
      navigate("/posts"); // go back to list after delete
    } catch (e) {
      alert(e.message || "Failed to delete");
    }
  };

  const onAddComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    try {
      setCommentSending(true);
      await postService.addComment(post._id, { content: text });
      // Optimistically append to local comments without refetching viewCount
      setPost((prev) => ({
        ...prev,
        comments: [...(prev?.comments || []), { content: text, createdAt: new Date().toISOString() }],
      }));
      setCommentText("");
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Failed to add comment");
    } finally {
      setCommentSending(false);
    }
  };

  if (status === "loading") return <p className="p-6">Loading…</p>;
  if (status === "error")   return <p className="p-6 text-red-600">{err}</p>;
  if (!post)                return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Main content */}
      <article className="prose max-w-none md:col-span-2">
        {post.videoUrl && toEmbedUrl(post.videoUrl) ? (
          <div className="aspect-video w-full mb-6 rounded-xl overflow-hidden">
            <iframe
              src={toEmbedUrl(post.videoUrl)}
              title={post.title}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : post.featuredImage ? (
          <img
            src={toImg(post.featuredImage)}
            alt={post.title}
            className="w-full max-h-96 object-cover rounded-xl mb-6"
          />
        ) : null}
        <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
        <div className="text-xs text-gray-500 mb-3">
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
          <span> • {post.viewCount ?? 0} views</span>
          <span> • {(post.comments || []).length} comments</span>
        </div>
        {post.excerpt && <p className="text-gray-600 mb-4">{post.excerpt}</p>}
        <div className="whitespace-pre-wrap">{post.content}</div>

        {/* Tags */}
        {Array.isArray(post.tags) && post.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                to={`/posts?tag=${encodeURIComponent(tag)}`}
                className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={() => navigate("/posts")}
            className="px-4 py-2 rounded border"
          >
            Back
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 rounded bg-amber-500 text-white"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 rounded bg-red-600 text-white"
          >
            Delete
          </button>
        </div>

        {/* Comments */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-3">Comments</h2>
          {(!post.comments || post.comments.length === 0) && (
            <p className="text-gray-500">No comments yet. Be the first to comment.</p>
          )}
          <ul className="space-y-4">
            {[...(post.comments || [])]
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((c, idx) => (
                <li key={`${c._id || idx}`} className="border rounded p-3">
                  <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
          </ul>

          <form onSubmit={onAddComment} className="mt-4 space-y-2">
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={commentSending}
                className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
              >
                {commentSending ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </form>
        </section>
      </article>

      {/* Sidebar */}
      <aside className="md:col-span-1 space-y-6">
        {/* Category card */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Categories</h3>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500">No categories.</p>
          ) : (
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat._id}>
                  <Link
                    to={`/posts?category=${cat._id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Popular posts */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Trending</h3>
          {popular.length === 0 ? (
            <p className="text-sm text-gray-500">No trending posts yet.</p>
          ) : (
            <ul className="space-y-3">
              {popular.map((p) => (
                <li key={p._id} className="flex items-center gap-3">
                  {p.featuredImage ? (
                    <img src={toImg(p.featuredImage)} alt="thumb" className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-100" />
                  )}
                  <div className="min-w-0">
                    <Link to={`/posts/${p._id}`} className="text-sm font-medium line-clamp-2 hover:underline">
                      {p.title}
                    </Link>
                    <p className="text-xs text-gray-500">{p.viewCount ?? 0} views</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          {post && (
            <PostForm
              mode="edit"
              postId={post._id}
              onSuccess={(updated) => {
                setPost(updated);
                setEditOpen(false);
                window.dispatchEvent(new Event("posts:changed"));
              }}
              onCancel={() => setEditOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
