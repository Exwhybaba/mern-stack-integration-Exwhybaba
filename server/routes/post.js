const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// READ — Get all posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'name')
      .populate('category', 'name')
      .sort('-createdAt');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// CREATE — Create a new post
router.post('/', async (req, res) => {
  const { title, slug, content, excerpt, author, category, tags, isPublished } = req.body;

  try {
    const post = new Post({
      title,
      slug,               // ← include it here
      content,
      excerpt,
      author,
      category,
      tags,
      isPublished
    });

    const savedPost = await post.save();
    res.status(201).json(savedPost);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Duplicate slug', keyValue: error.keyValue });
    }
    res.status(400).json({ message: error.message });
  }
});


// UPDATE — Update post by ID
router.put('/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!post) return res.status(404).json({ message: 'Post not found' });

    res.json(post);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE — Delete post by ID
router.delete('/:id', async (req, res) => {
  try {
    const deletedPost = await Post.findByIdAndDelete(req.params.id);

    if (!deletedPost) return res.status(404).json({ message: 'Post not found' });

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
