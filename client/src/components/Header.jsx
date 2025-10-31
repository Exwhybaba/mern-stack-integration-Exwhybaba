import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import PostForm from "./PostForm";

function Header() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const term = q.trim();
    nav(term ? `/posts?q=${encodeURIComponent(term)}` : "/posts");
    setQ("");
  };

  return (
    <header className="border-b sticky top-0 bg-white z-10">
      <div className="max-w-6xl mx-auto flex items-center justify-between p-4 gap-4">
        <nav className="flex items-center gap-4 overflow-x-auto">
          <NavLink to="/posts">All Posts</NavLink>
          <NavLink to="/posts?category=Technology">Technology</NavLink>
          <NavLink to="/posts?category=Design">Design</NavLink>
          <NavLink to="/posts?category=Business">Business</NavLink>
          <NavLink to="/posts?category=Lifestyle">Lifestyle</NavLink>
        </nav>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search posts…"
            className="h-9 w-56 rounded-md border px-3 outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Search posts"
          />
          <Button type="submit" className="bg-blue-500 text-white">
            Search
          </Button>
          <Button type="button" className="bg-blue-500 text-white" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
            Write Post
          </Button>
        </form>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Post</DialogTitle>
          </DialogHeader>
          <PostForm mode="create" onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </header>
  );
}

export default Header;
