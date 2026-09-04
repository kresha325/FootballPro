const Product = require('../models/Product');

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
    res.json(products);
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
    res.json(product);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createProduct = async (req, res) => {
    console.log('CREATE PRODUCT BODY:', req.body);
    console.log('CREATE PRODUCT FILE:', req.file);
  const { name, description, price, category, stock } = req.body;
  let imageUrl = req.body.imageUrl;
  if (req.file) {
    // Store relative path for frontend usage (directly in uploads)
    imageUrl = '/uploads/' + req.file.filename;
  }
  try {
    const product = await Product.create({
      name,
      description,
      price,
      category,
      imageUrl,
      stock,
      sellerId: req.user.id
    });
    res.json(product);
  } catch (err) {
    console.error('PRODUCT CREATE ERROR:', err);
    res.status(500).json({ msg: 'Server error', error: err.message, details: err });
  }
};

exports.updateProduct = async (req, res) => {
  let { name, description, price, category, imageUrl, stock } = req.body;
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    if (product.sellerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    // Nëse imageUrl fillon me /uploads/products/, zëvendëso me /uploads/
    if (imageUrl && imageUrl.startsWith('/uploads/products/')) {
      imageUrl = '/uploads/' + imageUrl.split('/').pop();
    }
    await product.update({
      name,
      description,
      price,
      category,
      imageUrl,
      stock,
    });
    res.json(product);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    if (product.sellerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    await product.destroy();
    res.json({ msg: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};