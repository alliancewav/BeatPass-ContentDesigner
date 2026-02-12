// ─── Ghost Content API Client ───
import CONFIG from '../config';

const { apiUrl, contentApiKey } = CONFIG.ghost;

export const fetchSettings = async () => {
  try {
    const url = `${apiUrl}/ghost/api/content/settings/?key=${contentApiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const s = data.settings;
    return {
      title: s.title || CONFIG.brand.name,
      description: s.description || '',
      logo: s.logo || CONFIG.brand.logoBlack,
      icon: s.icon || CONFIG.brand.favicon,
      accentColor: s.accent_color || CONFIG.brand.accentColor,
      coverImage: s.cover_image || null,
      url: s.url || apiUrl,
    };
  } catch {
    return null;
  }
};

export const fetchPostBySlug = async (slug) => {
  const url = `${apiUrl}/ghost/api/content/posts/slug/${slug}/?key=${contentApiKey}&include=tags,authors&formats=html`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ghost API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.posts || data.posts.length === 0) {
    throw new Error('Post not found');
  }
  return data.posts[0];
};

export const fetchPostByUrl = async (articleUrl) => {
  const slug = new URL(articleUrl).pathname.replace(/^\/|\/$/g, '');
  return fetchPostBySlug(slug);
};

export const parsePostToArticle = (post) => {
  return {
    title: post.title || 'Untitled',
    excerpt: post.excerpt || post.custom_excerpt || '',
    html: post.html || '',
    featureImage: post.feature_image || null,
    readingTime: post.reading_time || 5,
    primaryTag: post.primary_tag?.name || null,
    primaryAuthor: post.primary_author?.name || null,
    slug: post.slug || '',
    url: post.url || '',
    publishedAt: post.published_at || null,
    tags: (post.tags || []).map(t => t.slug || ''),
  };
};
