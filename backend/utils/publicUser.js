const SENSITIVE_USER_FIELDS = [
  'password',
  'resetPasswordToken',
  'resetPasswordExpire',
  'parentVerificationToken',
  'pushTokenMobile',
  'pushTokenWeb',
  'tokenVersion',
  'adminRole',
];

const ASSIGNABLE_ROLES = [
  'athlete',
  'coach',
  'scout',
  'manager',
  'referee',
  'club',
  'federation',
  'liga',
  'media',
  'business',
  'admin',
];

function toPublicUser(user) {
  if (!user) return user;
  const plain = typeof user.get === 'function' ? user.get({ plain: true }) : { ...user };
  for (const field of SENSITIVE_USER_FIELDS) delete plain[field];
  return plain;
}

module.exports = {
  SENSITIVE_USER_FIELDS,
  ASSIGNABLE_ROLES,
  toPublicUser,
};
