import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import PostList from "./components/PostList";
import PostView from "./components/PostView";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-6xl mx-auto p-4">
        <Routes>
          <Route path="/" element={<Navigate to="/posts" replace />} />
          <Route path="/posts" element={<PostList />} />
          <Route path="/posts/:id" element={<PostView />} />
        </Routes>
      </main>
    </div>
  );
}
