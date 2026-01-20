const { Post } = require('../models');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

async function fixMediaPaths() {
  await sequelize.authenticate();

  // Update imageUrl for posts-images
  await Post.update(
    {
      imageUrl: sequelize.literal(
        `CASE WHEN "imageUrl" LIKE '%/posts-images/%' THEN '/uploads/' || SUBSTRING("imageUrl" FROM '[^/]+$') ELSE "imageUrl" END`
      )
    },
    { where: { imageUrl: { [Op.like]: '%/posts-images/%' } } }
  );

  // Update videoUrl for posts-videos
  await Post.update(
    {
      videoUrl: sequelize.literal(
        `CASE WHEN "videoUrl" LIKE '%/posts-videos/%' THEN '/uploads/' || SUBSTRING("videoUrl" FROM '[^/]+$') ELSE "videoUrl" END`
      )
    },
    { where: { videoUrl: { [Op.like]: '%/posts-videos/%' } } }
  );

  // Update imageUrl for gallery
  await Post.update(
    {
      imageUrl: sequelize.literal(
        `CASE WHEN "imageUrl" LIKE '%/gallery/%' THEN '/uploads/' || SUBSTRING("imageUrl" FROM '[^/]+$') ELSE "imageUrl" END`
      )
    },
    { where: { imageUrl: { [Op.like]: '%/gallery/%' } } }
  );

  // Update imageUrl for profiles
  await Post.update(
    {
      imageUrl: sequelize.literal(
        `CASE WHEN "imageUrl" LIKE '%/profiles/%' THEN '/uploads/' || SUBSTRING("imageUrl" FROM '[^/]+$') ELSE "imageUrl" END`
      )
    },
    { where: { imageUrl: { [Op.like]: '%/profiles/%' } } }
  );

  // Update imageUrl for covers
  await Post.update(
    {
      imageUrl: sequelize.literal(
        `CASE WHEN "imageUrl" LIKE '%/covers/%' THEN '/uploads/' || SUBSTRING("imageUrl" FROM '[^/]+$') ELSE "imageUrl" END`
      )
    },
    { where: { imageUrl: { [Op.like]: '%/covers/%' } } }
  );

  // Update videoUrl for gallery
  await Post.update(
    {
      videoUrl: sequelize.literal(
        `CASE WHEN "videoUrl" LIKE '%/gallery/%' THEN '/uploads/' || SUBSTRING("videoUrl" FROM '[^/]+$') ELSE "videoUrl" END`
      )
    },
    { where: { videoUrl: { [Op.like]: '%/gallery/%' } } }
  );

  // Update videoUrl for covers
  await Post.update(
    {
      videoUrl: sequelize.literal(
        `CASE WHEN "videoUrl" LIKE '%/covers/%' THEN '/uploads/' || SUBSTRING("videoUrl" FROM '[^/]+$') ELSE "videoUrl" END`
      )
    },
    { where: { videoUrl: { [Op.like]: '%/covers/%' } } }
  );

  // Update videoUrl for profiles
  await Post.update(
    {
      videoUrl: sequelize.literal(
        `CASE WHEN "videoUrl" LIKE '%/profiles/%' THEN '/uploads/' || SUBSTRING("videoUrl" FROM '[^/]+$') ELSE "videoUrl" END`
      )
    },
    { where: { videoUrl: { [Op.like]: '%/profiles/%' } } }
  );

  console.log('✅ Path-et e mediave u rregulluan per te gjitha rastet!');
  process.exit();
}

fixMediaPaths().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
