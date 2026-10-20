export type DocumentType = 'invoice' | 'bill' | 'expense';
export type PostingLine = { account: string; debit: number; credit: number };

export function buildDocumentPosting(type: DocumentType, net: number, tax = 0) {
  if (!Number.isFinite(net) || !Number.isFinite(tax) || net <= 0 || tax < 0) throw new Error('Amounts must be positive');
  const gross = net + tax;
  const debitAccount = type === 'invoice' ? 'Accounts Receivable' : type === 'bill' ? 'Operating Expenses' : 'Operating Expenses';
  const creditAccount = type === 'invoice' ? 'Sales Income' : type === 'bill' ? 'Accounts Payable' : 'Cash';
  const lines: PostingLine[] = [
    { account: debitAccount, debit: gross, credit: 0 },
    { account: creditAccount, debit: 0, credit: net }
  ];
  if (tax) lines.push({ account: type === 'invoice' ? 'VAT Payable' : 'VAT Receivable', debit: type === 'invoice' ? 0 : tax, credit: type === 'invoice' ? tax : 0 });
  return { lines, debits: gross, credits: gross };
}

export function agingBucket(days: number) { return days <= 0 ? 'Current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+'; }
export function totals(items: Array<{ amount: number }>) { return { total: items.reduce((sum, item) => sum + item.amount, 0), count: items.length }; }
