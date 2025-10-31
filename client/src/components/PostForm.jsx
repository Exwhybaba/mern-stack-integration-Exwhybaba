import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { createPost as apiCreatePost, updatePost as apiUpdatePost, getPost as apiGetPost, uploadImage, toImg } from "../services/api";

// Optional props:
// mode: "create" | "edit"
// postId: string (when editing inside a modal or page)
// onSuccess: callback(post)
// onCancel: callback()
function PostForm({ mode = "create", postId, onSuccess, onCancel }) {
  const isEdit = mode === "edit";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(""); // object URL for preview/persist (session)
  const [videoUrl, setVideoUrl] = useState("");
  const [mediaType, setMediaType] = useState("image"); // 'image' | 'video'
  const [imgError, setImgError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Category is chosen from a fixed list to match nav

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

  // Prefill when editing
  useEffect(() => {
    if (isEdit && postId) {
      (async () => {
        try {
          const p = await apiGetPost(postId);
          if (p) {
            setTitle(p.title || "");
            setDescription(p.excerpt || "");
            setCategory(p.category?.name || "");
            setContent(p.content || "");
            setTagsText(Array.isArray(p.tags) ? p.tags.join(", ") : "");
            setImageUrl(toImg(p.featuredImage) || "");
            setVideoUrl(p.videoUrl || "");
            setMediaType(p.videoUrl ? "video" : (p.featuredImage ? "image" : "image"));
          }
        } catch {
          /* ignore prefill errors */
        }
      })();
    }
  }, [isEdit, postId]);

  // No dynamic categories list or inline create per request

  // Clean up object URL if we created one
  useEffect(() => {
    return () => {
      if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const MAX_MB = 5;
  const handleFile = (file) => {
    setImgError("");
    setUploadProgress(0);
    setImageFile(null);

    if (!file) {
      if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
      setImageUrl("");
      return;
    }

    const tooBig = file.size > MAX_MB * 1024 * 1024;
    const notImage = !(file.type || "").startsWith("image/");
    if (notImage) {
      setImgError("Please select a valid image file.");
      return;
    }
    if (tooBig) {
      setImgError(`Image must be <= ${MAX_MB}MB.`);
      return;
    }

    setImageFile(file);
    if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setMediaType("image");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert("Title and content are required.");
      return;
    }
    if (mediaType === 'video' && !videoUrl.trim()) {
      alert("Please provide a valid video URL or switch to Image.");
      return;
    }

    try {
      // If a new file was selected, upload first
      let uploadedFilename = '';
      if (imageFile) {
        setUploading(true);
        try {
          const up = await uploadImage(imageFile, { onProgress: setUploadProgress });
          uploadedFilename = up?.filename || '';
        } finally {
          setUploading(false);
        }
      }

      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (isEdit && postId) {
        const updatePayload = {
          title,
          excerpt: description,
          content,
          ...(category ? { category } : {}),
          ...(tags.length ? { tags } : { tags: [] }),
        };
        if (mediaType === 'video') {
          updatePayload.videoUrl = videoUrl;
          updatePayload.featuredImage = '';
        } else if (mediaType === 'image') {
          updatePayload.videoUrl = '';
          if (uploadedFilename) {
            updatePayload.featuredImage = uploadedFilename;
          }
        }

        const updated = await apiUpdatePost(postId, updatePayload);
        window.dispatchEvent(new Event("posts:changed"));
        onSuccess?.(updated);
        return;
      }

      // Create on backend
      const slug = title
        .toLowerCase()
        .replace(/[^\w ]+/g, "")
        .replace(/ +/g, "-");

      const createPayload = {
        title,
        slug,
        excerpt: description,
        content,
        ...(category ? { category } : {}),
        ...(tags.length ? { tags } : {}),
      };
      if (mediaType === 'video' && videoUrl) {
        createPayload.videoUrl = videoUrl;
      } else if (mediaType === 'image' && uploadedFilename) {
        createPayload.featuredImage = uploadedFilename;
      }

      const created = await apiCreatePost(createPayload);

      // Clear and notify list to refetch
      setTitle(""); setDescription(""); setCategory(""); setContent(""); setTagsText(""); setVideoUrl(""); setImageFile(null); setImageUrl(""); setMediaType("image");
      window.dispatchEvent(new Event("posts:changed"));
      onSuccess?.(created);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Failed to save post");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter post title"
          className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short summary"
          className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Posts</option>
          <option value="Technology">Technology</option>
          <option value="Design">Design</option>
          <option value="Business">Business</option>
          <option value="Lifestyle">Lifestyle</option>
        </select>
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium mb-1">Content</label>
        <textarea
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your post here…"
          className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1">Tags</label>
        <input
          type="text"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="e.g. react, javascript, ui"
          className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">Comma-separated. Used for filtering and discovery.</p>
      </div>

      {/* Media selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Media</label>
        <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mediaType"
              value="image"
              checked={mediaType === 'image'}
              onChange={() => setMediaType('image')}
            />
            Image
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mediaType"
              value="video"
              checked={mediaType === 'video'}
              onChange={() => setMediaType('video')}
            />
            Video
          </label>
        </div>

        {mediaType === 'image' ? (
          <div>
            <label className="block text-sm font-medium mb-1">Featured Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB.</p>
            {imgError && <p className="text-sm text-red-600 mt-1">{imgError}</p>}
            {imageUrl && (
              <div className="mt-3">
                <img src={imageUrl} alt="preview" className="w-full h-40 object-cover rounded" />
              </div>
            )}
            {uploading && (
              <div className="mt-2">
                <div className="h-2 bg-gray-200 rounded">
                  <div className="h-2 bg-blue-500 rounded" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-gray-600 mt-1">Uploading {uploadProgress}%</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Video URL (YouTube or Google Drive)</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://drive.google.com/file/d/ID/view"
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Only one media type is saved. Switching to Video will replace any image on update.</p>
            {toEmbedUrl(videoUrl) && (
              <div className="aspect-video w-full mt-3 rounded overflow-hidden">
                <iframe
                  src={toEmbedUrl(videoUrl)}
                  title="Video preview"
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="border border-gray-300">
            Cancel
          </Button>
        )}
        <Button type="submit" className="bg-blue-500 text-white" disabled={uploading}>
          {isEdit ? "Update Post" : "Create Post"}
        </Button>
      </div>
    </form>
  );
}

export default PostForm;
