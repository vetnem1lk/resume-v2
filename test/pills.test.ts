// The one decision the enhancement makes: which section is "current".
import { expect, test } from 'vitest';
import { mostVisible } from '../src/dom/pills.ts';

test('picks the section with the largest visible ratio', () => {
  expect(mostVisible(new Map([['top', 0.1], ['profile', 0.7], ['projects', 0.2]]))).toBe('profile');
});
test('null when nothing is visible', () => {
  expect(mostVisible(new Map([['top', 0], ['profile', 0]]))).toBeNull();
  expect(mostVisible(new Map())).toBeNull();
});
test('ties keep the earlier section', () => {
  expect(mostVisible(new Map([['top', 0.5], ['profile', 0.5]]))).toBe('top');
});
