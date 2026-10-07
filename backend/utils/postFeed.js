const { Op, fn, col } = require('sequelize');
const Post = require('../models/Post');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Sponsor = require('../models/Sponsor');
require('../models/PostSponsor');
const { toAbsoluteUploadsUrl } = require('./url');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const POST_LIST_ATTRIBUTES = [
  'id',
  'userId',
  'content',
  'imageUrl',
  'videoUrl',
  'location',
  'locationLat',
  'locationLng',
  'mentions',
  'createdAt',
  'updatedAt',
];

const POST_INCLUDES = [
  {
    model: User,
    as: 'author',
    attributes: ['id', 'firstName', 'lastName', 'email', 'verified'],
    include: [{ model: Profile, attributes: ['country', 'profilePhoto'] }],
  },
  { model: Sponsor, through: { attributes: [] } },
];

function parsePageLimit(query = {}) {
  const parsedPage = parseInt(query.page, 10);
  const parsedLimit = parseInt(query.limit, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  let limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { page, limit };
}

function setPostListHeaders(res, { page, limit, hasMore }) {
  res.set('X-Page', String(page));
  res.set('X-Limit', String(limit));
  res.set('X-Has-More', hasMore ? '1' : '0');
}

function normalizeSponsorImage(sponsorObj, req) {
  if (!sponsorObj.image) return sponsorObj;
  const img = String(sponsorObj.image);
  if (
    img.startsWith('/tmp/') ||
    img.includes('/var/folders/') ||
    (img.startsWith('/') && !img.startsWith('/uploads/') && !/^https?:\/\//i.test(img))
  ) {
    sponsorObj.image = null;
  } else {
    sponsorObj.image = toAbsoluteUploadsUrl(req, sponsorObj.image);
  }
  return sponsorObj;
}

function sponsorPlain(sponsor, req) {
  const sponsorObj = sponsor && sponsor.toJSON ? sponsor.toJSON() : { ...sponsor };
  return normalizeSponsorImage(sponsorObj, req);
}

function countMap(rows) {
  const map = new Map();
  for (const row of rows || []) {
    map.set(String(row.postId), Number(row.count) || 0);
  }
  return map;
}

/**
 * One page of posts, then constant bulk lookups.
 * The id query is separate so a sponsor join cannot shrink the page.
 */
async function loadPostPage({ where, page, limit }) {
  const offset = (page - 1) * limit;
  const idRows = await Post.findAll({
    where,
    attributes: ['id'],
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limit + 1,
    offset,
    raw: true,
  });
  const hasMore = idRows.length > limit;
  const ids = idRows.slice(0, limit).map((row) => row.id);
  if (!ids.length) return { posts: [], hasMore: false, queries: 1 };

  const posts = await Post.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: POST_LIST_ATTRIBUTES,
    include: POST_INCLUDES,
  });
  const rank = new Map(ids.map((id, index) => [String(id), index]));
  posts.sort((a, b) => (rank.get(String(a.id)) ?? 0) - (rank.get(String(b.id)) ?? 0));
  return { posts, hasMore, queries: 2 };
}

async function hydratePosts(posts, { userId, req, includeAuthorSponsors, Like, Comment, SponsorModel, queryLog }) {
  const likeModel = Like || require('../models/Like');
  const commentModel = Comment || require('../models/Comment');
  const sponsorModel = SponsorModel || Sponsor;
  const list = Array.isArray(posts) ? posts : [];
  if (!list.length) return { posts: [], queries: 0 };

  const postIds = list.map((post) => post.id);
  const note = (name) => {
    if (queryLog) queryLog.push(name);
  };

  note('likes');
  note('comments');
  const likeCountPromise = likeModel.findAll({
    attributes: ['postId', [fn('COUNT', col('id')), 'count']],
    where: { postId: { [Op.in]: postIds } },
    group: ['postId'],
    raw: true,
  });
  const commentCountPromise = commentModel.findAll({
    attributes: ['postId', [fn('COUNT', col('id')), 'count']],
    where: { postId: { [Op.in]: postIds } },
    group: ['postId'],
    raw: true,
  });

  let likedPromise = Promise.resolve([]);
  if (userId) {
    note('userLikes');
    likedPromise = likeModel.findAll({
      attributes: ['postId'],
      where: { userId, postId: { [Op.in]: postIds } },
      raw: true,
    });
  }

  const authorIds = [...new Set(list.map((post) => post.userId).filter((id) => id != null))];
  let authorSponsorPromise = Promise.resolve([]);
  if (includeAuthorSponsors && authorIds.length) {
    note('authorSponsors');
    authorSponsorPromise = sponsorModel.findAll({
      where: { userId: { [Op.in]: authorIds } },
    });
  }

  const [likeRows, commentRows, likedRows, authorSponsors] = await Promise.all([
    likeCountPromise,
    commentCountPromise,
    likedPromise,
    authorSponsorPromise,
  ]);

  const likesByPostId = countMap(likeRows);
  const commentsByPostId = countMap(commentRows);
  const likedPostIds = new Set((likedRows || []).map((row) => String(row.postId)));
  const sponsorsByUserId = new Map();
  for (const sponsor of authorSponsors || []) {
    const key = String(sponsor.userId);
    const bucket = sponsorsByUserId.get(key);
    if (bucket) bucket.push(sponsor);
    else sponsorsByUserId.set(key, [sponsor]);
  }

  const hydrated = list.map((post) => {
    const postObj = post.toJSON ? post.toJSON() : { ...post };
    if (postObj.imageUrl) postObj.imageUrl = toAbsoluteUploadsUrl(req, postObj.imageUrl);
    if (postObj.videoUrl) postObj.videoUrl = toAbsoluteUploadsUrl(req, postObj.videoUrl);
    if (postObj.author && postObj.author.Profile && postObj.author.Profile.profilePhoto) {
      postObj.author.profilePhoto = toAbsoluteUploadsUrl(req, postObj.author.Profile.profilePhoto);
    } else {
      postObj.author = postObj.author || {};
      postObj.author.profilePhoto = null;
    }

    const postSponsors = Array.isArray(post.Sponsors) ? post.Sponsors : (postObj.Sponsors || []);
    const authorList = includeAuthorSponsors ? (sponsorsByUserId.get(String(post.userId)) || []) : [];
    const seen = new Set();
    const sponsors = [];
    for (const sponsor of [...postSponsors, ...authorList]) {
      const plain = sponsorPlain(sponsor, req);
      const key = plain.id != null ? String(plain.id) : null;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      sponsors.push(plain);
    }

    return {
      ...postObj,
      likes: likesByPostId.get(String(post.id)) || 0,
      comments: commentsByPostId.get(String(post.id)) || 0,
      isLiked: likedPostIds.has(String(post.id)),
      sponsors,
    };
  });

  return { posts: hydrated, queries: queryLog ? queryLog.length : 0 };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  POST_LIST_ATTRIBUTES,
  parsePageLimit,
  setPostListHeaders,
  loadPostPage,
  hydratePosts,
};
