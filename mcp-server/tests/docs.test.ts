import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from '../docs';

describe('chunkText', () => {
  it('splits text into reasonable chunks with overlap', () => {
    const paragraphs = Array.from({ length: 6 }, (_, idx) => `Paragraph ${idx + 1} Lorem ipsum dolor sit amet, consectetur adipiscing elit.`);
    const input = paragraphs.join('\n\n');
    const result = chunkText(input, 80, 20);

    assert.ok(result.length > 1, 'expected multiple chunks');
    result.forEach((chunk) => {
      assert.ok(chunk.length <= 120, 'chunk should respect size upper bound (chunk + overlap)');
      assert.ok(chunk.trim().length > 0, 'chunk should not be empty');
    });

    for (let i = 1; i < result.length; i += 1) {
      const prev = result[i - 1];
      const current = result[i];
      assert.notEqual(prev, current, 'chunks should differ');
      const overlap = prev.slice(-40);
      assert.ok(current.includes(overlap.trim().slice(0, 10)), 'chunks should share overlap content');
    }
  });

  it('returns empty array when text is whitespace', () => {
    const result = chunkText('   \n\n   ', 100, 10);
    assert.deepEqual(result, []);
  });
});

