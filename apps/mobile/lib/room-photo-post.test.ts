import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, upload } = vi.hoisted(() => ({ get: vi.fn(), upload: vi.fn() }));
vi.mock('../lib/api', () => ({ api: { get, upload } }));

import { createRoomPost, getChallengeMemberPosts, getRoomDetails } from '../services/rooms';

describe('createRoomPost', () => {
  beforeEach(() => upload.mockReset());

  it('posts photo and optional caption as multipart to the room', async () => {
    upload.mockResolvedValue({ id: 'post-1' });

    await createRoomPost(
      'room-1',
      { uri: 'file:///proof.jpg', name: 'proof.jpg', type: 'image/jpeg' },
      '  revisão de biologia  ',
    );

    expect(upload).toHaveBeenCalledOnce();
    const [path, body] = upload.mock.calls[0] as [string, FormData];
    expect(path).toBe('/rooms/room-1/posts');
    expect(body.get('caption')).toBe('revisão de biologia');
    expect(body.has('photo')).toBe(true);
  });

  it('does not send an empty caption', async () => {
    upload.mockResolvedValue({ id: 'post-1' });
    await createRoomPost(
      'room-1',
      { uri: 'file:///proof.jpg', name: 'proof.jpg', type: 'image/jpeg' },
      '   ',
    );

    const body = upload.mock.calls[0][1] as FormData;
    expect(body.has('caption')).toBe(false);
  });
});

describe('getChallengeMemberPosts', () => {
  it('requests the paginated history for one member inside one challenge', async () => {
    get.mockResolvedValue({ items: [], total: 0, page: 2, limit: 20 });

    await getChallengeMemberPosts('challenge-1', 'user-1', 2, 20);

    expect(get).toHaveBeenCalledWith(
      '/challenges/challenge-1/members/user-1/posts?page=2&limit=20',
    );
  });
});

describe('getRoomDetails', () => {
  it('loads the authorized aggregate for one room', async () => {
    get.mockResolvedValue({ invite_code: 'YOXVNUED' });
    await getRoomDetails('room-1');
    expect(get).toHaveBeenCalledWith('/rooms/room-1/details');
  });
});
