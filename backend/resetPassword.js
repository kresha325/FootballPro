require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  }
);

(async () => {
  try {
    const email = process.env.RESET_EMAIL;
    const newPassword = process.env.RESET_PASSWORD;
    if (!email || !newPassword) {
      throw new Error('Set RESET_EMAIL and RESET_PASSWORD in the environment before running this script');
    }
    const [results] = await sequelize.query(
      'SELECT id, email, "firstName", "lastName", role FROM "Users" WHERE LOWER(email) = LOWER(:email)',
      { replacements: { email } }
    );

    if (results.length > 0) {
      console.log('✅ User found:', results[0]);
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await sequelize.query(
        'UPDATE "Users" SET password = :password WHERE id = :id',
        { replacements: { password: hashedPassword, id: results[0].id } }
      );
      
      console.log('\n✅ Password updated successfully!');
      console.log('📧 Email:', results[0].email);
    } else {
      console.log('❌ No user found with that email');
    }
    
    await sequelize.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
