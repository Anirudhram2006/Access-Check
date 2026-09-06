/**
 * Demo data for GitHub Integration Simulation mode.
 * Contains realistic repos, file trees, and source code with accessibility issues.
 * Used when GitHub OAuth is not configured on the server.
 */

export const DEMO_USERNAME = 'access-check-demo';

export const DEMO_REPOS = [
  {
    id: 1001,
    name: 'ecommerce-storefront',
    full_name: `${DEMO_USERNAME}/ecommerce-storefront`,
    owner: DEMO_USERNAME,
    private: false,
    description: 'React-based e-commerce frontend with product listings, cart, and checkout flow.',
  },
  {
    id: 1002,
    name: 'blog-platform',
    full_name: `${DEMO_USERNAME}/blog-platform`,
    owner: DEMO_USERNAME,
    private: false,
    description: 'Simple blog platform with article pages, author profiles, and comment system.',
  },
  {
    id: 1003,
    name: 'dashboard-admin',
    full_name: `${DEMO_USERNAME}/dashboard-admin`,
    owner: DEMO_USERNAME,
    private: true,
    description: 'Internal admin dashboard with data tables, charts, and form inputs.',
  },
];

/**
 * File tree for each demo repo.
 * Each entry has: path, type ('file'|'dir'), size, and optionally content.
 */
export const DEMO_FILE_TREES = {
  'ecommerce-storefront': [
    { path: 'src', type: 'dir' },
    { path: 'src/components', type: 'dir' },
    { path: 'src/components/Header.jsx', type: 'file', size: 2840 },
    { path: 'src/components/ProductCard.jsx', type: 'file', size: 1920 },
    { path: 'src/components/Footer.jsx', type: 'file', size: 1650 },
    { path: 'src/pages', type: 'dir' },
    { path: 'src/pages/Home.jsx', type: 'file', size: 3200 },
    { path: 'src/pages/Cart.jsx', type: 'file', size: 4100 },
    { path: 'public', type: 'dir' },
    { path: 'public/index.html', type: 'file', size: 1400 },
    { path: 'README.md', type: 'file', size: 800 },
  ],
  'blog-platform': [
    { path: 'src', type: 'dir' },
    { path: 'src/components', type: 'dir' },
    { path: 'src/components/ArticleHeader.jsx', type: 'file', size: 2100 },
    { path: 'src/components/CommentSection.jsx', type: 'file', size: 3500 },
    { path: 'src/components/Sidebar.jsx', type: 'file', size: 2800 },
    { path: 'src/pages', type: 'dir' },
    { path: 'src/pages/Article.jsx', type: 'file', size: 4200 },
    { path: 'src/pages/AuthorProfile.jsx', type: 'file', size: 2900 },
    { path: 'styles.css', type: 'file', size: 1800 },
  ],
  'dashboard-admin': [
    { path: 'src', type: 'dir' },
    { path: 'src/components', type: 'dir' },
    { path: 'src/components/DataTable.jsx', type: 'file', size: 3800 },
    { path: 'src/components/ChartPanel.jsx', type: 'file', size: 2600 },
    { path: 'src/components/Sidebar.jsx', type: 'file', size: 2400 },
    { path: 'src/components/FilterBar.jsx', type: 'file', size: 3100 },
    { path: 'src/pages', type: 'dir' },
    { path: 'src/pages/Overview.jsx', type: 'file', size: 2900 },
    { path: 'src/pages/Users.jsx', type: 'file', size: 3600 },
    { path: 'index.html', type: 'file', size: 1200 },
  ],
};

/**
 * Source code content for demo files.
 * Each file has realistic accessibility issues that the source analyzer will detect.
 */
export const DEMO_FILE_CONTENT = {
  // ─── ecommerce-storefront ────────────────────────────────────────────
  'ecommerce-storefront/src/components/Header.jsx': `import React from 'react';

export default function Header({ cartCount }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a href="/">
          <img src="/logo.svg" />
        </a>
        <nav>
          <ul>
            <li><a href="/products">Products</a></li>
            <li><a href="/deals">Deals</a></li>
            <li><a href="/about">About Us</a></li>
          </ul>
        </nav>
        <div className="header-actions">
          <button onClick={() => alert('Search coming soon')}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
          <a href="/cart" className="cart-link">
            <img src="/cart-icon.svg" />
            <span className="cart-count">{cartCount}</span>
          </a>
          <div className="user-menu">
            <img src="/avatar-placeholder.png" />
          </div>
        </div>
      </div>
    </header>
  );
}`,

  'ecommerce-storefront/src/components/ProductCard.jsx': `import React from 'react';

export default function ProductCard({ product }) {
  return (
    <div className="product-card">
      <div className="product-image-wrap">
        <img src={product.image} />
        {product.onSale && (
          <div className="sale-badge">Sale</div>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-title">{product.name}</h3>
        <div className="product-price">
          {product.originalPrice && (
            <span className="original-price">
              \${product.originalPrice}
            </span>
          )}
          <span className="current-price">
            \${product.price}
          </span>
        </div>
        <div className="product-rating">
          {[1,2,3,4,5].map(star => (
            <span key={star} className={star <= product.rating ? 'star filled' : 'star'}>
              ★
            </span>
          ))}
          <span className="review-count">({product.reviewCount} reviews)</span>
        </div>
        <button
          className="add-to-cart-btn"
          onClick={() => addToCart(product.id)}
        >
          Add to Cart
        </button>
        <button
          className="wishlist-btn"
          onClick={() => toggleWishlist(product.id)}
        >
          ♡
        </button>
      </div>
    </div>
  );
}`,

  'ecommerce-storefront/src/components/Footer.jsx': `import React from 'react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-col">
          <h4>Shop</h4>
          <ul>
            <li><a href="/products">All Products</a></li>
            <li><a href="/deals">Deals</a></li>
            <li><a href="/new-arrivals">New Arrivals</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Help</h4>
          <ul>
            <li><a href="/faq">FAQ</a></li>
            <li><a href="/shipping">Shipping</a></li>
            <li><a href="/returns">Returns</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Connect</h4>
          <div className="social-links">
            <a href="https://twitter.com/example">
              <img src="/icons/twitter.svg" />
            </a>
            <a href="https://facebook.com/example">
              <img src="/icons/facebook.svg" />
            </a>
            <a href="https://instagram.com/example">
              <img src="/icons/instagram.svg" />
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="newsletter-form">
          <input type="email" placeholder="Enter your email" />
          <button type="button">Subscribe</button>
        </div>
        <p>© 2026 Example Store. All rights reserved.</p>
      </div>
    </footer>
  );
}`,

  'ecommerce-storefront/src/pages/Home.jsx': `import React from 'react';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';

export default function Home({ products }) {
  return (
    <div className="home-page">
      <Header cartCount={0} />
      <main>
        <section className="hero-banner">
          <div className="hero-content">
            <h1>Summer Collection</h1>
            <p>Discover our latest arrivals for the season.</p>
            <a href="/products">Shop Now</a>
          </div>
          <img src="/hero-banner.jpg" />
        </section>

        <section className="featured-products">
          <h2>Featured Products</h2>
          <div className="product-grid">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        <section className="categories">
          <h2>Shop by Category</h2>
          <div className="category-grid">
            <a href="/category/clothing">
              <img src="/category-clothing.jpg" />
              <div>Clothing</div>
            </a>
            <a href="/category/electronics">
              <img src="/category-electronics.jpg" />
              <div>Electronics</div>
            </a>
            <a href="/category/home">
              <img src="/category-home.jpg" />
              <div>Home & Garden</div>
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}`,

  'ecommerce-storefront/src/pages/Cart.jsx': `import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Cart({ items, onUpdateQty, onRemove }) {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="cart-page">
      <Header cartCount={items.length} />
      <main>
        <h1>Shopping Cart</h1>
        {items.length === 0 ? (
          <div className="empty-cart">
            <img src="/empty-cart.svg" />
            <p>Your cart is empty</p>
            <a href="/products">Continue Shopping</a>
          </div>
        ) : (
          <div className="cart-content">
            <div className="cart-items">
              {items.map(item => (
                <div key={item.id} className="cart-item">
                  <img src={item.image} />
                  <div className="cart-item-details">
                    <h3>{item.name}</h3>
                    <p className="item-price">\${item.price}</p>
                    <div className="qty-controls">
                      <button onClick={() => onUpdateQty(item.id, item.qty - 1)}>−</button>
                      <span>{item.qty}</span>
                      <button onClick={() => onUpdateQty(item.id, item.qty + 1)}>+</button>
                    </div>
                    <button className="remove-btn" onClick={() => onRemove(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              <h2>Order Summary</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>\${total.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>\${total.toFixed(2)}</span>
              </div>
              <button className="checkout-btn">Proceed to Checkout</button>
              <input type="text" placeholder="Discount code" />
              <button className="apply-code-btn">Apply</button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}`,

  'ecommerce-storefront/public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Example Store</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; }
    .skip-link { position: absolute; top: -40px; left: 0; background: #000; color: #fff; padding: 8px; z-index: 100; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="/bundle.js"></script>
</body>
</html>`,

  // ─── blog-platform ───────────────────────────────────────────────────
  'blog-platform/src/components/ArticleHeader.jsx': `import React from 'react';

export default function ArticleHeader({ article }) {
  return (
    <div className="article-header">
      <div className="article-meta">
        <img src={article.author.avatar} />
        <div>
          <span className="author-name">{article.author.name}</span>
          <span className="article-date">{article.date}</span>
        </div>
      </div>
      <h1 className="article-title">{article.title}</h1>
      <div className="article-tags">
        {article.tags.map(tag => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>
      <img src={article.coverImage} className="article-cover" />
    </div>
  );
}`,

  'blog-platform/src/components/CommentSection.jsx': `import React, { useState } from 'react';

export default function CommentSection({ comments, onAddComment }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim()) {
      onAddComment(text);
      setText('');
    }
  };

  return (
    <div className="comment-section">
      <h2>Comments ({comments.length})</h2>
      <div className="comment-form">
        <img src="/default-avatar.png" />
        <div className="form-body">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
          />
          <button onClick={handleSubmit}>Post Comment</button>
        </div>
      </div>
      <div className="comments-list">
        {comments.map(comment => (
          <div key={comment.id} className="comment">
            <img src={comment.author.avatar} />
            <div className="comment-body">
              <div className="comment-meta">
                <strong>{comment.author.name}</strong>
                <span>{comment.date}</span>
              </div>
              <p>{comment.text}</p>
              <div className="comment-actions">
                <button onClick={() => likeComment(comment.id)}>👍 {comment.likes}</button>
                <button onClick={() => replyTo(comment.id)}>Reply</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`,

  'blog-platform/src/components/Sidebar.jsx': `import React from 'react';

export default function Sidebar({ categories, recentPosts }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3>Categories</h3>
        <ul>
          {categories.map(cat => (
            <li key={cat.id}>
              <a href={cat.url}>{cat.name}</a>
              <span className="cat-count">({cat.postCount})</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="sidebar-section">
        <h3>Recent Posts</h3>
        {recentPosts.map(post => (
          <div key={post.id} className="recent-post">
            <img src={post.thumbnail} />
            <div>
              <a href={post.url}>{post.title}</a>
              <span className="post-date">{post.date}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="sidebar-section">
        <h3>Newsletter</h3>
        <p>Subscribe to get the latest posts.</p>
        <input type="email" placeholder="Your email" />
        <button>Subscribe</button>
      </div>
      <div className="sidebar-section">
        <h3>Follow Us</h3>
        <div className="social-icons">
          <a href="/twitter"><img src="/icons/twitter.svg" /></a>
          <a href="/facebook"><img src="/icons/facebook.svg" /></a>
          <a href="/youtube"><img src="/icons/youtube.svg" /></a>
        </div>
      </div>
    </aside>
  );
}`,

  'blog-platform/src/pages/Article.jsx': `import React from 'react';
import ArticleHeader from '../components/ArticleHeader';
import CommentSection from '../components/CommentSection';
import Sidebar from '../components/Sidebar';

export default function Article({ article, comments, onAddComment }) {
  return (
    <div className="article-page">
      <nav className="main-nav">
        <a href="/" className="logo">BlogPlatform</a>
        <div className="nav-links">
          <a href="/articles">Articles</a>
          <a href="/categories">Categories</a>
          <a href="/about">About</a>
        </div>
        <button className="mobile-menu-btn">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      </nav>
      <main className="article-layout">
        <article className="article-content">
          <ArticleHeader article={article} />
          <div className="article-body" dangerouslySetInnerHTML={{ __html: article.htmlContent }} />
          <div className="article-footer">
            <div className="share-buttons">
              <button>Share on Twitter</button>
              <button>Share on Facebook</button>
              <button>Copy Link</button>
            </div>
          </div>
          <CommentSection comments={comments} onAddComment={onAddComment} />
        </article>
        <Sidebar categories={article.categories} recentPosts={article.recentPosts} />
      </main>
    </div>
  );
}`,

  'blog-platform/src/pages/AuthorProfile.jsx': `import React from 'react';

export default function AuthorProfile({ author, articles }) {
  return (
    <div className="author-page">
      <nav className="main-nav">
        <a href="/" className="logo">BlogPlatform</a>
      </nav>
      <main>
        <div className="author-header">
          <img src={author.avatar} />
          <div className="author-info">
            <h1>{author.name}</h1>
            <p className="author-bio">{author.bio}</p>
            <div className="author-stats">
              <span>{author.articleCount} articles</span>
              <span>{author.followerCount} followers</span>
            </div>
          </div>
        </div>
        <h2>Articles by {author.name}</h2>
        <div className="articles-grid">
          {articles.map(article => (
            <a key={article.id} href={article.url} className="article-preview">
              <img src={article.coverImage} />
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}`,

  'blog-platform/styles.css': `/* Blog platform main styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  margin: 0;
  color: #333;
  background: #fafafa;
}

.article-cover {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  border-radius: 8px;
}

.comment-form textarea {
  width: 100%;
  min-height: 100px;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 12px;
  font-size: 14px;
  resize: vertical;
}

.sidebar {
  width: 280px;
  padding: 20px;
}

.sidebar input[type="email"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 8px;
}

.sidebar button {
  width: 100%;
  padding: 10px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}`,

  // ─── dashboard-admin ─────────────────────────────────────────────────
  'dashboard-admin/src/components/DataTable.jsx': `import React, { useState } from 'react';

export default function DataTable({ data, columns }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} onClick={() => handleSort(col.key)}>
                {col.label}
                {sortCol === col.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.id || idx}>
              {columns.map(col => (
                <td key={col.key}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-pagination">
        <button>← Previous</button>
        <span>Page 1 of 10</span>
        <button>Next →</button>
      </div>
    </div>
  );
}`,

  'dashboard-admin/src/components/ChartPanel.jsx': `import React from 'react';

export default function ChartPanel({ title, data }) {
  return (
    <div className="chart-panel">
      <h3>{title}</h3>
      <div className="chart-container">
        <svg viewBox="0 0 400 200" className="chart-svg">
          <polyline
            points={data.map((d, i) => \`\${i * 40 + 20},\${200 - d.value * 2}\`).join(' ')}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
          />
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={i * 40 + 20} cy={200 - d.value * 2} r="4" fill="#6366f1" />
              <text x={i * 40 + 20} y={195} textAnchor="middle" fontSize="10" fill="#999">
                {d.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}`,

  'dashboard-admin/src/components/Sidebar.jsx': `import React from 'react';

export default function Sidebar({ currentPage }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'orders', label: 'Orders', icon: '📦' },
    { id: 'products', label: 'Products', icon: '🏷️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="admin-sidebar">
      <div className="sidebar-header">
        <img src="/admin-logo.svg" />
        <span>Admin Panel</span>
      </div>
      <ul className="sidebar-nav">
        {navItems.map(item => (
          <li key={item.id} className={currentPage === item.id ? 'active' : ''}>
            <a href={\`/\${item.id}\`}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <div className="admin-user">
          <img src="/admin-avatar.png" />
          <div>
            <div className="admin-name">Admin User</div>
            <div className="admin-role">Super Admin</div>
          </div>
        </div>
      </div>
    </nav>
  );
}`,

  'dashboard-admin/src/components/FilterBar.jsx': `import React, { useState } from 'react';

export default function FilterBar({ onFilter }) {
  const [dateRange, setDateRange] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="filter-group">
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>
      <div className="filter-group">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <button className="filter-apply-btn" onClick={() => onFilter({ dateRange, status, search })}>
        Apply Filters
      </button>
      <button className="filter-reset-btn" onClick={() => { setDateRange('all'); setStatus('all'); setSearch(''); }}>
        Reset
      </button>
    </div>
  );
}`,

  'dashboard-admin/src/pages/Overview.jsx': `import React from 'react';
import ChartPanel from '../components/ChartPanel';

export default function Overview() {
  const salesData = [
    { label: 'Jan', value: 40 },
    { label: 'Feb', value: 55 },
    { label: 'Mar', value: 45 },
    { label: 'Apr', value: 70 },
    { label: 'May', value: 60 },
    { label: 'Jun', value: 80 },
  ];

  return (
    <div className="overview-page">
      <h1>Dashboard Overview</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-value">$12,345</div>
          <div className="stat-label">Total Revenue</div>
          <div className="stat-change positive">+12%</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-value">234</div>
          <div className="stat-label">Total Orders</div>
          <div className="stat-change positive">+8%</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-value">1,234</div>
          <div className="stat-label">Active Users</div>
          <div className="stat-change negative">-3%</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">4.8</div>
          <div className="stat-label">Avg. Rating</div>
          <div className="stat-change positive">+0.2</div>
        </div>
      </div>
      <div className="charts-grid">
        <ChartPanel title="Sales Trend" data={salesData} />
      </div>
    </div>
  );
}`,

  'dashboard-admin/src/pages/Users.jsx': `import React from 'react';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';

export default function Users() {
  const users = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', status: 'Active', lastLogin: '2 hours ago' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'Editor', status: 'Active', lastLogin: '1 day ago' },
    { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'Viewer', status: 'Inactive', lastLogin: '2 weeks ago' },
    { id: 4, name: 'David Brown', email: 'david@example.com', role: 'Editor', status: 'Pending', lastLogin: 'Never' },
  ];

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status', render: (v) => <span className={\`status-badge \${v.toLowerCase()}\`}>{v}</span> },
    { key: 'lastLogin', label: 'Last Login' },
    { key: 'id', label: 'Actions', render: (_, row) => (
      <div className="action-btns">
        <button onClick={() => editUser(row.id)}>Edit</button>
        <button onClick={() => deleteUser(row.id)}>Delete</button>
      </div>
    )},
  ];

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>User Management</h1>
        <button className="add-user-btn">+ Add User</button>
      </div>
      <FilterBar onFilter={(f) => console.log('Filter:', f)} />
      <DataTable data={users} columns={columns} />
    </div>
  );
}`,

  'dashboard-admin/index.html': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Admin Dashboard</title>
</head>
<body>
  <div id="root"></div>
  <script src="/bundle.js"></script>
</body>
</html>`,
};

/**
 * Helper: given a repo name and a file path, return the directory contents
 * (entries) that would appear in that directory, and the tree entry if the
 * path points to a file.
 */
export function getDemoDirEntries(repoName, dirPath) {
  const tree = DEMO_FILE_TREES[repoName];
  if (!tree) return [];
  const prefix = dirPath ? dirPath + '/' : '';
  const seen = new Set();
  const entries = [];
  for (const item of tree) {
    if (!item.path.startsWith(prefix)) continue;
    const rest = item.path.slice(prefix.length);
    if (!rest) continue;
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      // Direct child file
      if (!seen.has(rest)) {
        seen.add(rest);
        entries.push({ name: rest, path: item.path, type: item.type, size: item.size || 0 });
      }
    } else {
      // Direct child directory
      const dirName = rest.slice(0, slashIdx);
      if (!seen.has(dirName)) {
        seen.add(dirName);
        entries.push({ name: dirName, path: prefix + dirName, type: 'dir', size: 0 });
      }
    }
  }
  return entries;
}

/**
 * Helper: get the content of a demo file, or null if not found.
 */
export function getDemoFileContent(repoName, filePath) {
  const key = `${repoName}/${filePath}`;
  return DEMO_FILE_CONTENT[key] || null;
}
