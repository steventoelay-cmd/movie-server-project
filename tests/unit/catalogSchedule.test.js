'use strict';

const { resolveScheduledSections } = require('../../src/config/catalog.config');
const { SECTIONS } = require('../../src/domain/constants/sections');

describe('resolveScheduledSections', () => {
  test('includes core catalog sections', () => {
    const sections = resolveScheduledSections();
    expect(sections).toEqual(
      expect.arrayContaining([
        SECTIONS.HOME,
        SECTIONS.MODEL,
        SECTIONS.CHANNEL,
        SECTIONS.TAG,
      ]),
    );
  });
});
