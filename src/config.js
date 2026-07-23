// Server-authoritative business constants (must match src/config/siteConfig.ts on the frontend -
// kept here too because the SERVER, not the browser, is the source of truth for pricing).
export const FREE_SHIPPING_THRESHOLD = 999;
export const STANDARD_SHIPPING_FEE = 59;
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const PORT = Number(process.env.PORT) || 4000;
// Comma-separated list of allowed origins (e.g. "https://soapveda.netlify.app,https://www.soapveda.com"),
// or "*" to allow any origin (fine for local/demo use, restrict this in production).
export const CORS_ORIGINS = (process.env.CORS_ORIGIN || '*').split(',').map((origin) => origin.trim());
