const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Post = require('./Post');
const Sponsor = require('./Sponsor');

const PostSponsor = sequelize.define('PostSponsor', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  postId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Posts',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  sponsorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Sponsors',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'PostSponsors',
  timestamps: false,
});

Post.belongsToMany(Sponsor, { through: PostSponsor, foreignKey: 'postId', otherKey: 'sponsorId' });
Sponsor.belongsToMany(Post, { through: PostSponsor, foreignKey: 'sponsorId', otherKey: 'postId' });

module.exports = PostSponsor;
