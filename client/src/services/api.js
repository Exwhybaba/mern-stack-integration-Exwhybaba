// api.js - API service for making requests to the backend

import axios from 'axios';

// Create axios instance with base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle authentication errors
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Post API services
export const postService = {
  // Get all posts with optional pagination and filters
  getAllPosts: async (page = 1, limit = 10, category = null) => {
    let url = `/posts?page=${page}&limit=${limit}`;
    if (category) url += `&category=${category}`;
    const response = await api.get(url);
    return response.data;
  },

  // Get posts by tag
  getByTag: async (tag, page = 1, limit = 10) => {
    const response = await api.get(`/posts?page=${page}&limit=${limit}&tag=${encodeURIComponent(tag)}`);
    return response.data;
  },

  // Get a single post by ID or slug
  getPost: async (idOrSlug) => {
    const response = await api.get(`/posts/${idOrSlug}`);
    return response.data;
  },

  // Create a new post
  createPost: async (postData) => {
    const response = await api.post('/posts', postData);
    return response.data;
  },

  // Update an existing post
  updatePost: async (id, postData) => {
    const response = await api.put(`/posts/${id}`, postData);
    return response.data;
  },

  // Delete a post
  deletePost: async (id) => {
    const response = await api.delete(`/posts/${id}`);
    return response.data;
  },

  // Add a comment to a post
  addComment: async (postId, commentData) => {
    const response = await api.post(`/posts/${postId}/comments`, commentData);
    return response.data;
  },

  // Search posts
  searchPosts: async (query) => {
    const response = await api.get(`/posts/search?q=${query}`);
    return response.data;
  },

  // Popular posts by view count
  getPopular: async (limit = 5) => {
    const response = await api.get(`/posts/popular/top?limit=${limit}`);
    return response.data;
  },
};

// Category API services
export const categoryService = {
  // Get all categories
  getAllCategories: async () => {
    const response = await api.get('/categories');
    return response.data;
  },

  // Create a new category
  createCategory: async (categoryData) => {
    const response = await api.post('/categories', categoryData);
    return response.data;
  },
};

// Auth API services
export const authService = {
  // Register a new user
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  // Login user
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Logout user
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Get current user
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

export default api; 

// Lightweight helpers to match component imports
export const getPosts = async () => {
  return postService.getAllPosts();
};

export const getPost = async (idOrSlug) => {
  return postService.getPost(idOrSlug);
};

export const createPost = async (data) => {
  return postService.createPost(data);
};

export const updatePost = async (id, data) => {
  return postService.updatePost(id, data);
};

export const deletePost = async (id) => {
  return postService.deletePost(id);
};

// Upload image (multipart/form-data) => { filename }
export const uploadImage = async (file, { onProgress } = {}) => {
  const form = new FormData();
  form.append('image', file);
  const res = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!onProgress || !evt.total) return;
      const percent = Math.round((evt.loaded * 100) / evt.total);
      onProgress(percent);
    },
  });
  return res.data;
};

// Helper to map stored image name to full URL
export function toImg(name) {
  if (!name) return '';
  const n = String(name);
  if (/^(?:https?:)?\/\//i.test(n)) return n; // absolute URL
  if (/^(?:data:|blob:)/i.test(n)) return n;   // data/blob
  const origin = (API_BASE || '').replace(/\/api\/?$/, '') || window.location.origin;
  return `${origin}/uploads/${n}`;
}
