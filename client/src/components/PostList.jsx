import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import Blog from "./Blog";
import { getPosts, deletePost, toImg, postService, categoryService } from "../services/api";

export default function PostList() {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [err, setErr] = useState("");
  const [categories, setCategories] = useState([]);
  const [popular, setPopular] = useState([]);

  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const q = params.get("q");
        const category = params.get("category");
        const tag = params.get("tag");
        let data;
        if (q && q.trim()) {
          data = await postService.searchPosts(q.trim());
        } else if (category) {
          data = await postService.getAllPosts(1, 10, category);
        } else if (tag) {
          data = await postService.getByTag(tag, 1, 10);
        } else {
          data = await getPosts();
        }
        setPosts(data);
        setStatus("ready");
      } catch (e) {
        setErr(e.message);
        setStatus("error");
      }
    };

    fetchData();

    const onChanged = () => fetchData();
    window.addEventListener("posts:changed", onChanged);
    return () => window.removeEventListener("posts:changed", onChanged);
  }, [location.search]);

  // Sidebar data: categories + popular
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

  const handleDelete = async (id) => {
    const ok = window.confirm("Delete this post?");
    if (!ok) return;
    try {
      await deletePost(id);
      // update UI without reloading
      setPosts((prev) => prev.filter((p) => p._id !== id));
    } catch (e) {
      alert(e.message || "Failed to delete");
    }
  };

  if (status === "loading") return <p className="p-6">Loading posts…</p>;
  if (status === "error")   return <p className="p-6 text-red-600">{err}</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6">
      {/* Main list */}
      <div className="md:col-span-2">
        {posts.length === 0 ? (
          <p>No posts yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
            {posts.map((post) => (
              <div key={post._id} className="h-full flex flex-col">
                <div className="flex-1">
                  <Blog
                    img={toImg(post.featuredImage)}
                    title={post.title}
                    description={post.excerpt}
                    content={post.content}
                    createdAt={post.createdAt}
                    views={post.viewCount ?? 0}
                    commentsCount={(post.comments || []).length}
                    videoUrl={post.videoUrl}
                    to={`/posts/${post._id}`}
                    onDelete={() => handleDelete(post._id)}
                    buttonText={<>Read More</>}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
