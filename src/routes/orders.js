import { Router } from 'express';
import { nanoid } from 'nanoid';
import { createRepo, transaction } from '../db.js';
import { authenticate, optionalAuth, requireAdmin } from '../middleware/auth.js';
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_FEE } from '../config.js';

const ordersRepo = createRepo('orders');
const productsRepo = createRepo('products', ['slug']);
const couponsRepo = createRepo('coupons', ['code']);
const router = Router();

function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SV${y}${m}-${rand}`;
}

// Guest checkout is allowed, so this endpoint is intentionally public - but ALL pricing is
// recomputed here from the database. A tampered subtotal/discount/total in the request body is
// simply ignored (never trust client-supplied prices).
router.post('/', optionalAuth, (req, res) => {
  const { items, address, couponCode, paymentMethod, customerEmail, customerPhone } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!address?.fullName || !address?.line1 || !address?.city || !address?.state || !address?.pincode) {
    return res.status(400).json({ error: 'A complete shipping address is required.' });
  }
  if (!['razorpay', 'upi', 'cod'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Invalid payment method.' });
  }

  try {
    const order = transaction(() => {
      const orderItems = [];
      let subtotal = 0;

      for (const requested of items) {
        const product = productsRepo.getById(requested.productId);
        const variant = product?.variants.find((v) => v.id === requested.variantId);
        if (!product || !variant) {
          throw Object.assign(new Error('One of the items in your cart is no longer available.'), { status: 400 });
        }
        const quantity = Math.max(1, Math.min(Number(requested.quantity) || 1, 50));
        if (variant.stock < quantity) {
          throw Object.assign(new Error(`"${product.name} (${variant.label})" only has ${variant.stock} left in stock.`), { status: 409 });
        }
        orderItems.push({
          productId: product.id,
          productName: product.name,
          variantLabel: variant.label,
          image: product.images[0],
          price: variant.price,
          quantity,
        });
        subtotal += variant.price * quantity;

        const updatedVariants = product.variants.map((v) => (v.id === variant.id ? { ...v, stock: v.stock - quantity } : v));
        productsRepo.update(product.id, { ...product, variants: updatedVariants });
      }

      let discount = 0;
      let appliedCouponCode;
      if (couponCode) {
        const coupon = couponsRepo.getBy('code', String(couponCode).trim().toUpperCase());
        if (
          coupon &&
          coupon.active &&
          new Date(coupon.expiryDate) >= new Date() &&
          coupon.usedCount < coupon.usageLimit &&
          subtotal >= coupon.minOrderValue
        ) {
          discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
          if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
          discount = Math.round(Math.min(discount, subtotal));
          appliedCouponCode = coupon.code;
          couponsRepo.update(coupon.id, { ...coupon, usedCount: coupon.usedCount + 1 });
        }
      }

      const shippingFee = subtotal - discount >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
      const total = Math.max(subtotal - discount, 0) + shippingFee;
      const now = new Date().toISOString();
      const status = 'Processing';

      const newOrder = {
        id: `order-${nanoid(24)}`,
        orderNumber: generateOrderNumber(),
        userId: req.user?.role === 'customer' ? req.user.sub : undefined,
        customerName: address.fullName,
        customerEmail: customerEmail ?? '',
        customerPhone: address.phone ?? customerPhone ?? '',
        items: orderItems,
        address,
        subtotal,
        discount,
        couponCode: appliedCouponCode,
        shippingFee,
        total,
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid',
        status,
        statusHistory: [{ status, date: now }],
        createdAt: now,
      };
      ordersRepo.insert(newOrder);
      return newOrder;
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Could not place order.' });
  }
});

router.get('/mine', authenticate, (req, res) => {
  res.json(ordersRepo.all().filter((o) => o.userId === req.user.sub));
});

router.get('/', authenticate, requireAdmin, (_req, res) => {
  res.json(ordersRepo.all());
});

// Public by design (relies on the long random order id as an access token) so guests can view
// their own order confirmation right after checkout without creating an account.
router.get('/:id', (req, res) => {
  const order = ordersRepo.getById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

router.patch('/:id/status', authenticate, requireAdmin, (req, res) => {
  const order = ordersRepo.getById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { status } = req.body ?? {};
  const updated = { ...order, status, statusHistory: [...order.statusHistory, { status, date: new Date().toISOString() }] };
  ordersRepo.update(order.id, updated);
  res.json(updated);
});

export default router;
