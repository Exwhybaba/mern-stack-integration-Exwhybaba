const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Category = require('../models/Category');

// READ — Get all posts (supports pagination and optional category)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '0', 10), 0); // 0 = no limit
    const category = req.query.category;
    const tag = req.query.tag;

    const filter = {};
    let legacyRegex = null;
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cat = await Category.findOne({ name: new RegExp(`^${esc(category)}$`, 'i') }).select('_id');
        if (!cat) {
          // No matching category doc; try legacy string-only docs
          legacyRegex = new RegExp(`^${esc(category)}$`, 'i');
        } else {
          filter.category = cat._id;
          legacyRegex = new RegExp(`^${esc(category)}$`, 'i');
        }
      }
    }
    if (tag) filter.tags = { $in: [tag] };

    // Fetch normalized posts first (ObjectId category or no category filter)
    const normalized = await Post.find(filter)
      .populate('author', 'name')
      .sort('-createdAt')
      .lean()
      .exec();

    let combined = normalized;
    // If category param was provided as name, also include legacy string-category docs via raw query
    if (legacyRegex) {
      const legacyQuery = { $and: [ { category: { $type: 'string' } }, { category: legacyRegex } ] };
      if (tag) legacyQuery.tags = { $in: [tag] };
      const legacy = await Post.collection
        .find(legacyQuery)
        .sort({ createdAt: -1 })
        .toArray();
      const seen = new Set(combined.map((d) => String(d._id)));
      for (const doc of legacy) {
        const key = String(doc._id);
        if (!seen.has(key)) {
          combined.push(doc);
        }
      }
    }

    // Apply pagination in-memory for combined list
    combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = combined.length;
    const start = limit > 0 ? (page - 1) * limit : 0;
    const end = limit > 0 ? start + limit : total;
    const pageItems = combined.slice(start, end);

    res.json(pageItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// READ — Get a single post by ID or slug
router.get('/:idOrSlug', async (req, res) => {
  const { idOrSlug } = req.params;
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrSlug);
    const post = await (isObjectId
      ? Post.findById(idOrSlug)
      : Post.findOne({ slug: idOrSlug })
    )
      .populate('author', 'name');

    // Safely populate category only if value is a valid ObjectId
    if (post && post.category && mongoose.Types.ObjectId.isValid(post.category)) {
      await post.populate('category', 'name');
    }

    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Bump view count asynchronously without validation
    try {
      await Post.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } }).exec();
    } catch (_) {}

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CREATE — Create a new post
router.post('/', async (req, res) => {
  const { title, slug, content, excerpt, author, category, tags, isPublished, featuredImage, videoUrl } = req.body;

  try {
    // Normalize category (accept id or name)
    let categoryId = undefined;
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryId = category;
      } else {
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let cat = await Category.findOne({ name: new RegExp(`^${esc(category)}$`, 'i') }).select('_id');
        if (!cat) {
          // Auto-create category if it doesn't exist
          const created = await Category.create({ name: String(category) });
          cat = { _id: created._id };
        }
        categoryId = cat._id;
      }
    }

    const post = new Post({
      title,
      slug, // will be recalculated from title by pre-save if title is modified
      content,
      excerpt,
      author,
      category: categoryId,
      tags,
      isPublished,
      ...(featuredImage ? { featuredImage } : {}),
      ...(videoUrl ? { videoUrl } : {}),
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
    const update = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(update, 'category')) {
      const val = update.category;
      if (!val) {
        update.category = undefined;
      } else if (mongoose.Types.ObjectId.isValid(val)) {
        update.category = val;
      } else {
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let cat = await Category.findOne({ name: new RegExp(`^${esc(val)}$`, 'i') }).select('_id');
        if (!cat) {
          const created = await Category.create({ name: String(val) });
          cat = { _id: created._id };
        }
        update.category = cat._id;
      }
    }

    const post = await Post.findByIdAndUpdate(req.params.id, update, { new: true });
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

// SEARCH — Find posts by query across title and content
router.get(['/search', '/search/query'], async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const posts = await Post.find({ $or: [{ title: regex }, { content: regex }] })
      .populate('author', 'name')
      // Do not populate category to avoid cast errors on legacy documents
      .sort('-createdAt');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POPULAR — Top posts by view count
router.get('/popular/top', async (req, res) => {
  try {
    const limit = Math.max(parseInt(req.query.limit || '5', 10), 1);
    const posts = await Post.find({})
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(limit)
      .select('title featuredImage viewCount createdAt slug')
      .exec();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// COMMENTS — Add a comment to a post
router.post('/:postId/comments', async (req, res) => {
  const { postId } = req.params;
  const { user, content } = req.body || {};
  try {
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }
    const result = await Post.updateOne(
      { _id: postId },
      { $push: { comments: { user: user || undefined, content, createdAt: new Date() } } }
    ).exec();
    if (result.matchedCount === 0 && result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.status(201).json({ message: 'Comment added' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
