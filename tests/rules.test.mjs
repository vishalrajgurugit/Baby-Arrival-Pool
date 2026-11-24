import test from 'node:test';
import assert from 'node:assert/strict';
import {birthTime,csvCell,prediction,TIME_ZONE} from '../lib/rules.ts';
import {correct,collection} from '../lib/server.ts';

const example = {day:21,period:'AM',name:' Alex ',email:'alex@example.com',wishes:'hello',requestId:'00000000-0000-4000-8000-000000000001'};
test('accepts January AM/PM predictions and independent requests for the same slot', () => {
  assert.equal(prediction(example).name,'Alex');
  assert.equal(prediction({...example,requestId:'00000000-0000-4000-8000-000000000002'}).day,21);
  assert.equal(prediction({...example,day:31,period:'PM',wishes:undefined}).wishes,'');
});
test('rejects out-of-range, invalid, and oversized inputs', () => {
  for (const overrides of [{day:0},{day:32},{day:21.5},{day:'21'},{period:'noon'},{name:' '},{email:'a@b'},{wishes:'a'.repeat(1001)},{requestId:''}])
    assert.throws(() => prediction({...example,...overrides}));
});
test('compares Toronto wall time and puts noon in PM', () => {
  assert.equal(TIME_ZONE,'America/Toronto');
  assert.equal(birthTime('2027-01-21T11:59'),'2027-01-21T11:59');
  assert.throws(() => birthTime('2027-02-29T12:00'));
  assert.throws(() => birthTime('2027-01-21T24:00'));
  assert.equal(correct(example,'2027-01-21T00:00:00'),true);
  assert.equal(correct(example,'2027-01-21T11:59:00'),true);
  assert.equal(correct(example,'2027-01-21T12:00:00'),false);
  assert.equal(correct({...example,period:'PM'},'2027-01-21T12:00:00'),true);
  assert.equal(correct(example,'2027-02-21T00:00:00'),false);
  assert.equal(correct(example,null),false);
});
test('escapes spreadsheet formulas and quotes', () => {
  assert.equal(csvCell('=1+1'),'"\'=1+1"');
  assert.equal(csvCell('  @SUM(1)'),'"\'  @SUM(1)"');
  assert.equal(csvCell('Hello, "baby"'),'"Hello, ""baby"""');
});
test('gift collection requires both live mode and explicit activation', () => {
  const previous = {...process.env};
  try {
    process.env.APP_MODE = 'demo';
    process.env.GIFT_COLLECTION_ENABLED = 'true';
    assert.equal(collection(), false);
    process.env.APP_MODE = 'live';
    process.env.GIFT_COLLECTION_ENABLED = 'false';
    assert.equal(collection(), false);
    process.env.GIFT_COLLECTION_ENABLED = 'true';
    assert.equal(collection(), true);
  } finally {
    for (const key of ['APP_MODE','GIFT_COLLECTION_ENABLED']) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
