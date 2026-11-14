import assert from 'node:assert/strict';
import test from 'node:test';
import { graphifyLabelCoverageSentence } from '../../../docs/book/graphify-label-coverage.mjs';

test('book says no saved labels were available when the label file is missing', () => {
  assert.equal(
    graphifyLabelCoverageSentence([1, 2], null),
    'This build had no saved label store to compare against, so the community names below are shown exactly as graphify left them.',
  );
});

test('book reports how many communities still use their hub name', () => {
  assert.equal(
    graphifyLabelCoverageSentence([1, 2, 3], {
      1: 'Authentication',
      3: 'Profiles',
    }),
    "In this build, 1 of the 3 communities have no saved label and are listed under their hub's name.",
  );
});

test('book reports complete saved-label coverage', () => {
  assert.equal(
    graphifyLabelCoverageSentence([1, 2], {
      1: 'Authentication',
      2: 'Profiles',
    }),
    'In this build, all 2 communities carry a saved label.',
  );
});
