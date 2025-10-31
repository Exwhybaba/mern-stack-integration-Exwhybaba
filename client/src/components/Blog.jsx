import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";

export default function Blog({ img, title, description, content = "", buttonText = "Read More", to, createdAt, views, commentsCount, videoUrl, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [broken, setBroken] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const showImage = img && !broken;

  const toEmbedUrl = (url) => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
        let id = '';
        if (host === 'youtu.be') id = u.pathname.split('/').filter(Boolean)[0] || '';
        else if (u.pathname.startsWith('/watch')) id = u.searchParams.get('v') || '';
        else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] || '';
        if (id) {
          const listId = u.searchParams.get('list');
          return `https://www.youtube.com/embed/${id}?controls=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1${listId ? `&list=${encodeURIComponent(listId)}` : ''}`;
        }
      }
      if (host === 'drive.google.com') {
        const parts = u.pathname.split('/');
        const idx = parts.findIndex((p) => p === 'd');
        if (idx >= 0 && parts[idx + 1]) return `https://drive.google.com/file/d/${parts[idx + 1]}/preview`;
        const idParam = u.searchParams.get('id');
        if (idParam) return `https://drive.google.com/file/d/${idParam}/preview`;
      }
    } catch (_) {}
    return null;
  };

  const truncate = (text = "", limit = 180) => {
    if (text.length <= limit) return text;
    const slice = text.slice(0, limit);
    const lastSpace = slice.lastIndexOf(" ");
    return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + "…";
  };

  const embedUrl = toEmbedUrl(videoUrl);
  const hasVideo = Boolean(embedUrl);

  return (
    <div className="h-full">
      <Card className="h-full w-full max-w-md flex flex-col shadow-md hover:shadow-lg transition overflow-hidden">
        <div className="aspect-video w-full bg-muted/40 overflow-hidden rounded-t-md relative">
          {showPlayer && hasVideo ? (
            <iframe
              src={embedUrl}
              title={title || 'Video'}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : showImage ? (
            <img
              src={img}
              alt={title || "Blog cover image"}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setBroken(true)}
            />
          ) : hasVideo ? (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-sm text-muted-foreground">Video available</span>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-sm text-muted-foreground">No media</span>
            </div>
          )}

          {/* Play overlay when there is a video and player is hidden */}
          {!showPlayer && hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowPlayer(true)}
                className="rounded-full bg-black/60 hover:bg-black/70 text-white w-14 h-14 flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-white/60"
                aria-label="Play video"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z"></path>
                </svg>
              </button>
            </div>
          )}
        </div>

        <CardHeader className="pt-4">
          <CardTitle>{title || "Untitled post"}</CardTitle>
          {(createdAt || views != null || commentsCount != null) && (
            <div className="text-xs text-muted-foreground mt-1">
              {createdAt && (
                <span>{new Date(createdAt).toLocaleDateString()}</span>
              )}
              {views != null && (
                <span>{createdAt ? " • " : ""}{views} views</span>
              )}
              {commentsCount != null && (
                <span>{(createdAt != null || views != null) ? " • " : ""}{commentsCount} comments</span>
              )}
            </div>
          )}
          <CardDescription>
            {description || <span className="italic text-muted-foreground">No description provided</span>}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1">
          <p>{expanded ? content : truncate(content, 180)}</p>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 py-4">
          <Button type="button" className="bg-blue-500 text-white h-8 px-3" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
            {expanded ? "Show Less" : "Preview"}
          </Button>

          <div className="ml-auto flex items-center gap-2">
            {to && (
              <Button asChild variant="ghost" className="h-8 px-3 text-blue-600 hover:underline">
                <Link to={to} aria-label={`Open ${title || "post"}`}>
                  Open
                </Link>
              </Button>
            )}
            {onDelete && (
              <Button type="button" onClick={onDelete} variant="ghost" className="h-8 px-3 text-red-600 hover:underline">
                Delete
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
