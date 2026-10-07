const Product = require('../models/Product');
const { Op } = require('sequelize');
const { toAbsoluteUploadsUrl } = require('../utils/url');
const { fromCents, toCents } = require('../utils/money');
const { priceToJoncoinCents, getJoncoinPerEur } = require('../config/economy');
const { purchaseBlockReason, slugifyName, canManageProduct, PRODUCT_STATUSES } = require('../services/economy/rules');
const {
  OUT_OF_STOCK_TTL_HOURS,
  parseStock,
  nextStockFields,
  hoursLeftUntilExpiry,
  expiresAtFrom,
  purgeExpiredOutOfStockProducts,
} = require('../utils/productStock');

/** URL absolute për /uploads — mobile dhe klientë të tjerë që nuk bashkëngjisin host manualisht. */
function formatProductResponse(req, product) {
  if (!product) return null;
  const o = product.get ? product.get({ plain: true }) : { ...product };
  if (o.imageUrl) o.imageUrl = toAbsoluteUploadsUrl(req, o.imageUrl);
  if (o.Seller?.Profile?.profilePhoto) {
    o.Seller.Profile.profilePhoto = toAbsoluteUploadsUrl(req, o.Seller.Profile.profilePhoto);
  }
  const stockN = parseStock(o.stock, 0) ?? 0;
  o.stock = stockN;
  o.outOfStockHoursLeft =
    stockN <= 0 && o.outOfStockAt ? hoursLeftUntilExpiry(o) : null;
  o.outOfStockExpiresAt =
    stockN <= 0 && o.outOfStockAt ? expiresAtFrom(o.outOfStockAt)?.toISOString() || null : null;
  o.outOfStockTtlHours = OUT_OF_STOCK_TTL_HOURS;
  o.currency = o.currency || 'EUR';
  o.status = o.status || (stockN > 0 ? 'active' : 'out_of_stock');
  o.condition = o.condition || 'new';
  o.acceptsJoncoin = o.acceptsJoncoin !== false;
  const coinCents = priceToJoncoinCents(o.price);
  o.joncoinPrice = coinCents == null ? null : fromCents(coinCents);
  o.joncoinPerEur = getJoncoinPerEur();
  o.purchasable = !purchaseBlockReason({ ...o, stock: stockN }, 1);
  if (!Array.isArray(o.images) || o.images.length === 0) {
    o.images = o.imageUrl ? [o.imageUrl] : [];
  }
  return o;
}

function productIncludeSeller() {
  const { User, Profile } = require('../models');
  return [
    {
      model: User,
      as: 'Seller',
      attributes: ['id', 'firstName', 'lastName'],
      include: [{ model: Profile, attributes: ['profilePhoto'] }],
    },
  ];
}

/** Storefront: only products with available stock. OOS rows stay in DB (seller can edit/restock) until TTL purge. */
function activeListingWhere(query = {}) {
  const where = {
    stock: { [Op.gt]: 0 },
    status: 'active',
  };
  if (query.category && query.category !== 'all') where.category = String(query.category);
  if (query.q) where.name = { [Op.iLike]: `%${String(query.q).slice(0, 80)}%` };
  return where;
}

function productOrder(sort) {
  if (sort === 'price_asc') return [['price', 'ASC']];
  if (sort === 'price_desc') return [['price', 'DESC']];
  if (sort === 'name') return [['name', 'ASC']];
  return [['createdAt', 'DESC']];
}

exports.getProducts = async (req, res) => {
  try {
    // Await purge so expired OOS rows are removed before we read the catalog.
    try {
      await purgeExpiredOutOfStockProducts();
    } catch (_) {
      /* best-effort */
    }

    const rawPage = parseInt(req.query.page, 10);
    const paginate = Number.isFinite(rawPage) && rawPage > 0;
    const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const query = {
      where: activeListingWhere(req.query),
      include: productIncludeSeller(),
      order: productOrder(req.query.sort),
    };
    if (paginate) {
      query.limit = limit;
      query.offset = (rawPage - 1) * limit;
      const result = await Product.findAndCountAll(query);
      return res.json({
        products: result.rows.map((p) => formatProductResponse(req, p)),
        page: rawPage,
        limit,
        total: result.count,
      });
    }
    const products = await Product.findAll(query);
    res.json((products || []).map((p) => formatProductResponse(req, p)));
  } catch (err) {
    console.error('getProducts:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const key = String(req.params.id || '');
    const product = /^\d+$/.test(key)
      ? await Product.findByPk(key, { include: productIncludeSeller() })
      : await Product.findOne({ where: { slug: key }, include: productIncludeSeller() });
    if (!product) return res.status(404).json({ msg: 'Product not found' });

    const stockN = parseStock(product.stock, 0) ?? 0;
    const isOwner = req.user?.id != null && Number(req.user.id) === Number(product.sellerId);
    const isAdmin = req.user?.role === 'admin';
    const status = product.status || 'active';
    if (!isOwner && !isAdmin && (status !== 'active' || stockN <= 0)) {
      return res.status(404).json({ msg: 'Product not found' });
    }

    res.json(formatProductResponse(req, product));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { sellerId: req.user.id },
      order: [['updatedAt', 'DESC']],
    });
    res.json(products.map((p) => formatProductResponse(req, p)));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createProduct = async (req, res) => {
  const cloudinary = require('../utils/cloudinary');
  const fs = require('fs');

  if (!req.user?.id) {
    return res.status(401).json({ msg: 'Not authenticated' });
  }

  const { name, description, price, category } = req.body;
  let imageUrl = req.body.imageUrl;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ msg: 'Emri i produktit është i detyrueshëm' });
  }
  const priceCents = toCents(price);
  if (priceCents == null || priceCents <= 0) {
    return res.status(400).json({ msg: 'Çmimi duhet të jetë më i madh se 0' });
  }
  const categoryName = String(category).trim();
  if (!['gear', 'tickets', 'merchandise'].includes(categoryName)) {
    return res.status(400).json({ msg: 'Kategoria është e pavlefshme' });
  }
  const condition = ['new', 'used', 'refurbished'].includes(String(req.body.condition || 'new'))
    ? String(req.body.condition || 'new')
    : null;
  if (!condition) return res.status(400).json({ msg: 'Gjendja e produktit është e pavlefshme' });
  let status = String(req.body.status || 'active');
  if (!PRODUCT_STATUSES.includes(status) || status === 'out_of_stock') status = 'active';

  const stockParsed = parseStock(req.body.stock, 0);
  if (stockParsed === null) {
    return res.status(400).json({ msg: 'Stoku duhet të jetë numër ≥ 0' });
  }

  if (req.file) {
    try {
      const cloudRes = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'image',
        folder: 'footballpro/products',
      });
      imageUrl = cloudRes.secure_url;
    } catch (uploadErr) {
      console.error('Product Cloudinary upload:', uploadErr);
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
      return res.status(500).json({ msg: 'Dështoi ngarkimi i fotos. Kontrollo Cloudinary (ENV).', error: uploadErr.message });
    }
    try {
      fs.unlinkSync(req.file.path);
    } catch (_e) {
      /* ignore */
    }
  }

  try {
    const stockFields = nextStockFields(null, null, stockParsed);
    const listingStatus = stockFields.stock > 0 ? status : 'out_of_stock';
    const product = await Product.create({
      name: String(name).trim(),
      description,
      price: fromCents(priceCents),
      currency: 'EUR',
      category: categoryName,
      imageUrl,
      images: imageUrl ? [imageUrl] : [],
      condition,
      status: listingStatus,
      acceptsJoncoin: req.body.acceptsJoncoin === false || req.body.acceptsJoncoin === 'false' ? false : true,
      stock: stockFields.stock,
      outOfStockAt: stockFields.outOfStockAt,
      sellerId: req.user.id,
    });
    if (!product.slug) {
      product.slug = slugifyName(product.name, product.id);
      await product.save();
    }
    res.status(201).json(formatProductResponse(req, product));
  } catch (err) {
    console.error('PRODUCT CREATE ERROR:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  const cloudinary = require('../utils/cloudinary');
  const fs = require('fs');

  if (!req.user?.id) {
    return res.status(401).json({ msg: 'Not authenticated' });
  }

  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    if (!canManageProduct(product, req.user)) {
      return res.status(403).json({ msg: 'Vetëm shitësi mund ta përditësojë këtë produkt' });
    }

    let { name, description, price, category, imageUrl, stock } = req.body;
    let nextImageUrl = product.imageUrl;

    if (req.file) {
      try {
        const cloudRes = await cloudinary.uploader.upload(req.file.path, {
          resource_type: 'image',
          folder: 'footballpro/products',
        });
        nextImageUrl = cloudRes.secure_url;
      } catch (uploadErr) {
        console.error('Product update Cloudinary:', uploadErr);
        try {
          fs.unlinkSync(req.file.path);
        } catch (_e) {
          /* ignore */
        }
        return res.status(500).json({ msg: 'Dështoi ngarkimi i fotos.', error: uploadErr.message });
      }
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {
        /* ignore */
      }
    } else if (imageUrl !== undefined && imageUrl !== null && String(imageUrl).trim() !== '') {
      let normalized = String(imageUrl).trim();
      if (normalized.startsWith('/uploads/products/')) {
        normalized = '/uploads/' + normalized.split('/').pop();
      }
      nextImageUrl = normalized;
    }

    let stockFields = {
      stock: product.stock,
      outOfStockAt: product.outOfStockAt,
    };
    if (stock !== undefined && stock !== null && String(stock).trim() !== '') {
      const stockParsed = parseStock(stock, null);
      if (stockParsed === null) {
        return res.status(400).json({ msg: 'Stoku duhet të jetë numër ≥ 0' });
      }
      stockFields = nextStockFields(product.stock, product.outOfStockAt, stockParsed);
    }

    let nextPrice = product.price;
    if (price !== undefined && String(price).trim() !== '') {
      const priceCents = toCents(price);
      if (priceCents == null || priceCents <= 0) return res.status(400).json({ msg: 'Çmimi duhet të jetë më i madh se 0' });
      nextPrice = fromCents(priceCents);
    }
    let nextCategory = product.category;
    if (category !== undefined && String(category).trim() !== '') {
      nextCategory = String(category).trim();
      if (!['gear', 'tickets', 'merchandise'].includes(nextCategory)) {
        return res.status(400).json({ msg: 'Kategoria është e pavlefshme' });
      }
    }
    const nextName = name !== undefined && String(name).trim() !== '' ? String(name).trim() : product.name;
    let nextStatus = product.status || 'active';
    if (req.body.status !== undefined) {
      const requested = String(req.body.status);
      if (!PRODUCT_STATUSES.includes(requested) || requested === 'out_of_stock') {
        return res.status(400).json({ msg: 'Statusi i produktit është i pavlefshëm' });
      }
      nextStatus = requested;
    }
    if (stockFields.stock <= 0) nextStatus = 'out_of_stock';
    else if (nextStatus === 'out_of_stock') nextStatus = 'active';

    await product.update({
      name: nextName,
      slug: product.slug || slugifyName(nextName, product.id),
      description: description !== undefined ? String(description) : product.description,
      price: nextPrice,
      category: nextCategory,
      stock: stockFields.stock,
      outOfStockAt: stockFields.outOfStockAt,
      imageUrl: nextImageUrl,
      images: nextImageUrl ? [nextImageUrl] : product.images,
      status: nextStatus,
      condition: ['new', 'used', 'refurbished'].includes(String(req.body.condition || ''))
        ? String(req.body.condition)
        : product.condition,
      acceptsJoncoin: req.body.acceptsJoncoin === undefined
        ? product.acceptsJoncoin
        : !(req.body.acceptsJoncoin === false || req.body.acceptsJoncoin === 'false'),
    });

    await product.reload({ include: productIncludeSeller() });
    res.json(formatProductResponse(req, product));
  } catch (err) {
    console.error('updateProduct:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.deleteProduct = async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ msg: 'Not authenticated' });
  }
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    if (!canManageProduct(product, req.user)) {
      return res.status(403).json({ msg: 'Vetëm shitësi mund ta arkivojë këtë produkt' });
    }
    await product.update({ status: 'archived' });
    res.json({ msg: 'Product archived', product: formatProductResponse(req, product) });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
