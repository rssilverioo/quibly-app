import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('../lib/api', () => ({ api: { upload } }));

import { createRoomPost } from '../services/rooms';

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
