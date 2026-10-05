const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(80),
    allowNull: true,
    unique: true,
  },
  description: DataTypes.TEXT,
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(8),
    allowNull: false,
    defaultValue: 'EUR',
  },
  category: {
    type: DataTypes.ENUM('gear', 'tickets', 'merchandise'),
    allowNull: false,
  },
  imageUrl: DataTypes.TEXT,
  images: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  condition: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'new',
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'out_of_stock', 'paused', 'archived'),
    allowNull: false,
    defaultValue: 'active',
  },
  acceptsJoncoin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  /** Set when stock hits 0; cleared on restock. Listing removed after 48h if still empty. */
  outOfStockAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = Product;