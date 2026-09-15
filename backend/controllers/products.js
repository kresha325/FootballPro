const Product = require('../models/Product');
const { Op } = require('sequelize');
const { toAbsoluteUploadsUrl } = require('../utils/url');
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

/** Hide listings that have been out of stock longer than TTL (cleanup may lag). */
function activeListingWhere() {
  const cutoff = new Date(Date.now() - OUT_OF_STOCK_TTL_HOURS * 60 * 60 * 1000);
  return {
    [Op.or]: [
      { stock: { [Op.gt]: 0 } },
      { outOfStockAt: null },
      { outOfStockAt: { [Op.gt]: cutoff } },
    ],
  };
}

exports.getProducts = async (req, res) => {
  try {
    // Best-effort purge so storefront stays clean even if interval missed a beat.
    purgeExpiredOutOfStockProducts().catch(() => {});

    const products = await Product.findAll({
      where: activeListingWhere(),
      include: productIncludeSeller(),
      order: [['createdAt', 'DESC']],
    });
    res.json((products || []).map((p) => formatProductResponse(req, p)));
  } catch (err) {
    console.error('getProducts:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: productIncludeSeller(),
    });
    if (!product) return res.status(404).json({ msg: 'Product not found' });

    const stockN = parseStock(product.stock, 0) ?? 0;
    const expired =
      stockN <= 0 &&
      product.outOfStockAt &&
      Date.now() - new Date(product.outOfStockAt).getTime() >
        OUT_OF_STOCK_TTL_HOURS * 60 * 60 * 1000;
    if (expired) {
      // Soft-hide until purge interval removes it.
      return res.status(404).json({ msg: 'Product not found' });
    }

    res.json(formatProductResponse(req, product));
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
  if (price === undefined || price === null || String(price).trim() === '') {
    return res.status(400).json({ msg: 'Çmimi është i detyrueshëm' });
  }
  if (!category || !String(category).trim()) {
    return res.status(400).json({ msg: 'Kategoria është e detyrueshme' });
  }

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
    const product = await Product.create({
      name: String(name).trim(),
      description,
      price,
      category: String(category).trim(),
      imageUrl,
      stock: stockFields.stock,
      outOfStockAt: stockFields.outOfStockAt,
      sellerId: req.user.id,
    });
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
    if (Number(product.sellerId) !== Number(req.user.id) && req.user.role !== 'admin') {
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

    await product.update({
      name: name !== undefined && String(name).trim() !== '' ? String(name).trim() : product.name,
      description: description !== undefined ? String(description) : product.description,
      price:
        price !== undefined && String(price).trim() !== ''
          ? String(price).trim()
          : product.price,
      category: category !== undefined && String(category).trim() !== '' ? String(category).trim() : product.category,
      stock: stockFields.stock,
      outOfStockAt: stockFields.outOfStockAt,
      imageUrl: nextImageUrl,
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
    if (Number(product.sellerId) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Vetëm shitësi mund ta fshijë këtë produkt' });
    }
    await product.destroy();
    res.json({ msg: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};
