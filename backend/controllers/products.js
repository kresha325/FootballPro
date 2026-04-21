const Product = require('../models/Product');
const { toAbsoluteUploadsUrl } = require('../utils/url');

/** URL absolute për /uploads — mobile dhe klientë të tjerë që nuk bashkëngjisin host manualisht. */
function formatProductResponse(req, product) {
  if (!product) return null;
  const o = product.get ? product.get({ plain: true }) : { ...product };
  if (o.imageUrl) o.imageUrl = toAbsoluteUploadsUrl(req, o.imageUrl);
  if (o.Seller?.Profile?.profilePhoto) {
    o.Seller.Profile.profilePhoto = toAbsoluteUploadsUrl(req, o.Seller.Profile.profilePhoto);
  }
  return o;
}

exports.getProducts = async (req, res) => {
  const { User, Profile } = require('../models');
  try {
    const products = await Product.findAll({
      include: [
        {
          model: User,
          as: 'Seller',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto'] }],
        },
      ],
    });
    res.json((products || []).map((p) => formatProductResponse(req, p)));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getProduct = async (req, res) => {
  const { User, Profile } = require('../models');
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'Seller',
          attributes: ['id', 'firstName', 'lastName'],
          include: [{ model: Profile, attributes: ['profilePhoto'] }],
        },
      ],
    });
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    res.json(formatProductResponse(req, product));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createProduct = async (req, res) => {
  const cloudinary = require('../utils/cloudinary');
  const fs = require('fs');
  const { name, description, price, category, stock } = req.body;
  let imageUrl = req.body.imageUrl;

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
    const product = await Product.create({
      name,
      description,
      price,
      category,
      imageUrl,
      stock,
      sellerId: req.user ? req.user.id : req.body.sellerId,
    });
    res.json(formatProductResponse(req, product));
  } catch (err) {
    console.error('PRODUCT CREATE ERROR:', err);
    res.status(500).json({ msg: 'Server error', error: err.message, details: err });
  }
};

const productIncludeSeller = () => {
  const { User, Profile } = require('../models');
  return [
    {
      model: User,
      as: 'Seller',
      attributes: ['id', 'firstName', 'lastName'],
      include: [{ model: Profile, attributes: ['profilePhoto'] }],
    },
  ];
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
    if (Number(product.sellerId) !== Number(req.user.id)) {
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

    const stockNum =
      stock !== undefined && stock !== null && String(stock).trim() !== ''
        ? parseInt(String(stock), 10)
        : product.stock;
    const safeStock = Number.isFinite(stockNum) && stockNum >= 0 ? stockNum : product.stock;

    await product.update({
      name: name !== undefined && String(name).trim() !== '' ? String(name).trim() : product.name,
      description: description !== undefined ? String(description) : product.description,
      price:
        price !== undefined && String(price).trim() !== ''
          ? String(price).trim()
          : product.price,
      category: category !== undefined && String(category).trim() !== '' ? String(category).trim() : product.category,
      stock: safeStock,
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
    if (Number(product.sellerId) !== Number(req.user.id)) {
      return res.status(403).json({ msg: 'Vetëm shitësi mund ta fshijë këtë produkt' });
    }
    await product.destroy();
    res.json({ msg: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};