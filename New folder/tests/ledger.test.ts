import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentPosting, agingBucket, totals } from '../src/shared/ledger';

test('posts an invoice as balanced receivable and income entries', () => {
  const posting = buildDocumentPosting('invoice', 12500, 2250);
  assert.equal(posting.debits, posting.credits);
  assert.deepEqual(posting.lines, [
    { account: 'Accounts Receivable', debit: 14750, credit: 0 },
    { account: 'Sales Income', debit: 0, credit: 12500 },
    { account: 'VAT Payable', debit: 0, credit: 2250 }
  ]);
});

test('posts a bill as balanced expense and payable entries', () => {
  const posting = buildDocumentPosting('bill', 1000, 180);
  assert.equal(posting.debits, 1180);
  assert.equal(posting.credits, 1180);
  assert.equal(posting.lines[0].account, 'Operating Expenses');
});

test('rejects invalid posting amounts', () => {
  assert.throws(() => buildDocumentPosting('invoice', -1, 0), /positive/);
});

test('calculates aging and report totals', () => {
  assert.equal(agingBucket(31), '31-60');
  assert.deepEqual(totals([{ amount: 100 }, { amount: 250 }]), { total: 350, count: 2 });
});
