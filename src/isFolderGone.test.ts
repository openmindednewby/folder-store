import { describe, expect, it } from 'vitest';

import { isFolderGone } from './errors';

describe('isFolderGone', () => {
  it.each(['NotFoundError', 'NotAllowedError', 'NotReadableError'])('with a %s, returns true', (name) => {
    const error = new DOMException('gone', name);

    const gone = isFolderGone(error);

    expect(gone).toBe(true);
  });

  it('with any other error, returns false', () => {
    const error = new Error('disk full');

    const gone = isFolderGone(error);

    expect(gone).toBe(false);
  });

  it('with a plain object carrying a gone name, returns false', () => {
    const error = { name: 'NotFoundError' };

    const gone = isFolderGone(error);

    expect(gone).toBe(false);
  });
});
