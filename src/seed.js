import { createRepo } from './db.js';
import { products as seedProducts } from './seed-data/products.js';
import { initialCoupons, initialBanners } from './seed-data/couponsAndBanners.js';
import { blogPosts as seedBlogPosts } from './seed-data/blogPosts.js';

export function seedDatabase() {
  const productsRepo = createRepo('products', ['slug']);
  const couponsRepo = createRepo('coupons', ['code']);
  const bannersRepo = createRepo('banners');
  const blogRepo = createRepo('blog_posts', ['slug']);

  if (productsRepo.count() === 0) {
    for (const p of seedProducts) productsRepo.insert(p);
    console.log(`Seeded ${seedProducts.length} products`);
  }
  if (couponsRepo.count() === 0) {
    for (const c of initialCoupons) couponsRepo.insert(c);
    console.log(`Seeded ${initialCoupons.length} coupons`);
  }
  if (bannersRepo.count() === 0) {
    for (const b of initialBanners) bannersRepo.insert(b);
    console.log(`Seeded ${initialBanners.length} banners`);
  }
  if (blogRepo.count() === 0) {
    for (const post of seedBlogPosts) blogRepo.insert(post);
    console.log(`Seeded ${seedBlogPosts.length} blog posts`);
  }
}
