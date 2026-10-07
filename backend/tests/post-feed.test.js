const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parsePageLimit, hydratePosts } = require('../utils/postFeed');

function post(id, userId, sponsors) {
  return {
    id,
    userId,
    content: `post ${id}`,
    imageUrl: 'https://cdn.example/post.jpg',
    videoUrl: null,
    Sponsors: sponsors,
    toJSON() {
      return {
        id: this.id,
        userId: this.userId,
        content: this.content,
        imageUrl: this.imageUrl,
        videoUrl: this.videoUrl,
        author: { id: userId, firstName: 'A', lastName: 'B', Profile: { profilePhoto: 'https://cdn.example/a.jpg' } },
        Sponsors: sponsors.map((sponsor) => ({ ...sponsor })),
      };
    },
  };
}

describe('parsePageLimit', () => {
  it('defaults to page 1 and limit 20', () => {
    assert.deepEqual(parsePageLimit({}), { page: 1, limit: 20 });
  });

  it('caps limit at 50 and ignores invalid page', () => {
    assert.deepEqual(parsePageLimit({ page: '0', limit: '500' }), { page: 1, limit: 50 });
    assert.deepEqual(parsePageLimit({ page: '2', limit: '10' }), { page: 2, limit: 10 });
  });
});

describe('hydratePosts', () => {
  it('uses a constant number of bulk queries for any page size', async () => {
    const queryLog = [];
    const likeCounts = [{ postId: 1, count: '4' }, { postId: 2, count: '1' }];
    const Like = {
      findAll: async (options) => {
        queryLog.push(options.group ? 'like-count' : 'user-likes');
        if (options.group) return likeCounts;
        return [{ postId: 2 }];
      },
    };
    const Comment = {
      findAll: async () => {
        queryLog.push('comment-count');
        return [{ postId: 1, count: '9' }];
      },
    };
    const SponsorModel = {
      findAll: async (options) => {
        queryLog.push(`sponsors:${options.where.userId[Object.getOwnPropertySymbols(options.where.userId)[0]] ? 'in' : 'eq'}`);
        return [
          { id: 7, userId: 10, name: 'Author sponsor', image: 'https://cdn.example/s.png', toJSON() { return { ...this, toJSON: undefined }; } },
          { id: 8, userId: 11, name: 'Other', image: null, toJSON() { return { id: 8, userId: 11, name: 'Other', image: null }; } },
        ];
      },
    };

    const posts = [
      post(1, 10, [{ id: 7, name: 'Author sponsor', image: 'https://cdn.example/s.png', toJSON() { return { id: 7, name: 'Author sponsor', image: 'https://cdn.example/s.png' }; } }]),
      post(2, 11, []),
      post(3, 10, []),
    ];
    const req = { headers: {}, protocol: 'https', get: () => 'api.example' };
    const result = await hydratePosts(posts, {
      userId: 99,
      req,
      includeAuthorSponsors: true,
      Like,
      Comment,
      SponsorModel,
      queryLog,
    });

    assert.equal(queryLog.filter((name) => name === 'like-count').length, 1);
    assert.equal(queryLog.filter((name) => name === 'user-likes').length, 1);
    assert.equal(queryLog.filter((name) => name === 'comment-count').length, 1);
    assert.equal(queryLog.filter((name) => name.startsWith('sponsors:')).length, 1);
    assert.equal(result.posts[0].likes, 4);
    assert.equal(result.posts[1].likes, 1);
    assert.equal(result.posts[2].likes, 0);
    assert.equal(result.posts[0].comments, 9);
    assert.equal(result.posts[0].isLiked, false);
    assert.equal(result.posts[1].isLiked, true);
    assert.equal(result.posts[0].sponsors.length, 1);
    assert.equal(result.posts[0].sponsors[0].id, 7);
    assert.equal(result.posts[2].sponsors[0].id, 7);
    assert.equal(result.posts[0].imageUrl, 'https://cdn.example/post.jpg');
    assert.equal(result.posts[0].author.profilePhoto, 'https://cdn.example/a.jpg');
  });

  it('skips the current-user like query when nobody is logged in', async () => {
    const queryLog = [];
    const Like = { findAll: async (options) => { queryLog.push(options.group ? 'like-count' : 'user-likes'); return []; } };
    const Comment = { findAll: async () => { queryLog.push('comment-count'); return []; } };
    const SponsorModel = { findAll: async () => { queryLog.push('sponsors'); return []; } };
    await hydratePosts([post(1, 10, [])], {
      userId: null,
      req: { headers: {}, protocol: 'https', get: () => 'api.example' },
      includeAuthorSponsors: false,
      Like,
      Comment,
      SponsorModel,
      queryLog,
    });
    assert.equal(queryLog.includes('userLikes'), false);
    assert.equal(queryLog.filter((name) => name === 'like-count').length, 1);
    assert.equal(queryLog.filter((name) => name === 'comment-count').length, 1);
    assert.equal(queryLog.filter((name) => name === 'sponsors').length, 0);
  });
});
