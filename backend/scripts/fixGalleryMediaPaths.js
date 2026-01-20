const { Gallery } = require('../models');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

async function fixGalleryMediaPaths() {
  await sequelize.authenticate();

  // Update imageUrl for all old folders
  await Gallery.update(
    {
      imageUrl: sequelize.literal(
        `CASE WHEN "imageUrl" LIKE '%/posts-images/%' THEN '/uploads/' || SUBSTRING("imageUrl" FROM '[^/]+$')
              WHEN "imageUrl" LIKE '%/posts-videos/%' THEN '/uploads/' || SUBSTRING("imageUrl" FROM '[^/]+$')
              WHEN "imageUrl" LIKE '%/gallery/%' THEN '/uploads/' || SUBSTRING("imageUrl" FROM '[^/]+$')
              WHEN "imageUrl" LIKE '%/profiles/%' THEN '/uploads/' || SUBSTRING("imageUrl" FROM '[^/]+$')
              WHEN "imageUrl" LIKE '%/covers/%' THEN '/uploads/' || SUBSTRING("imageUrl" FROM '[^/]+$')
              ELSE "imageUrl" END`
      )
    },
    { where: { imageUrl: { [Op.or]: [
      { [Op.like]: '%/posts-images/%' },
      { [Op.like]: '%/posts-videos/%' },
      { [Op.like]: '%/gallery/%' },
      { [Op.like]: '%/profiles/%' },
      { [Op.like]: '%/covers/%' }
    ] } } }
  );

  // Update videoUrl for all old folders
  await Gallery.update(
    {
      videoUrl: sequelize.literal(
        `CASE WHEN "videoUrl" LIKE '%/posts-images/%' THEN '/uploads/' || SUBSTRING("videoUrl" FROM '[^/]+$')
              WHEN "videoUrl" LIKE '%/posts-videos/%' THEN '/uploads/' || SUBSTRING("videoUrl" FROM '[^/]+$')
              WHEN "videoUrl" LIKE '%/gallery/%' THEN '/uploads/' || SUBSTRING("videoUrl" FROM '[^/]+$')
              WHEN "videoUrl" LIKE '%/profiles/%' THEN '/uploads/' || SUBSTRING("videoUrl" FROM '[^/]+$')
              WHEN "videoUrl" LIKE '%/covers/%' THEN '/uploads/' || SUBSTRING("videoUrl" FROM '[^/]+$')
              ELSE "videoUrl" END`
      )
    },
    { where: { videoUrl: { [Op.or]: [
      { [Op.like]: '%/posts-images/%' },
      { [Op.like]: '%/posts-videos/%' },
      { [Op.like]: '%/gallery/%' },
      { [Op.like]: '%/profiles/%' },
      { [Op.like]: '%/covers/%' }
    ] } } }
  );

  console.log('✅ Path-et e Gallery u rregulluan per te gjitha rastet!');
  process.exit();
}

fixGalleryMediaPaths().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
