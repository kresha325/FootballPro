import { describe, expect, it } from 'vitest';
import { outboundChatStatus, replyUnavailable, safeLinkParts } from '../messagePresentation';

describe('outboundChatStatus', () => {
  it('does not mark a message read just because the conversation exists', () => {
    const status = outboundChatStatus(
      { id: 1, senderId: 4, createdAt: '2026-10-04T10:00:00.000Z' },
      [{ userId: 8, lastReadAt: null }],
      4
    );
    expect(status).toBe('sent');
  });

  it('marks delivered and read from persisted timestamps', () => {
    const message = {
      id: 2,
      senderId: 4,
      createdAt: '2026-10-04T10:00:00.000Z',
      deliveredAt: '2026-10-04T10:00:02.000Z',
    };
    expect(outboundChatStatus(message, [], 4)).toBe('delivered');
    expect(outboundChatStatus(message, [{ userId: 8, lastReadAt: '2026-10-04T10:01:00.000Z' }], 4)).toBe('read');
  });
});

describe('reply and links', () => {
  it('treats a deleted original as unavailable', () => {
    expect(replyUnavailable({ deleted: true, content: 'secret' })).toBe(true);
  });

  it('only linkifies http(s) urls', () => {
    const parts = safeLinkParts('Shiko https://xtalenti.com dhe javascript:alert(1)');
    expect(parts.filter((part) => part.href).map((part) => part.href)).toEqual(['https://xtalenti.com']);
  });
});
