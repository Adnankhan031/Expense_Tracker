'use client';

import type { Currency } from './currency';
import type { CatTotal } from './analytics';
import type { TxnView } from './types';
import { dayLabel, monthLabel, toMajor } from './format';

type Meta = {
  currency: Currency;
  label: string;
  from: string;
  to: string;
  expense: number;
  income: number;
  byCategory: CatTotal[];
};

const money = (minor: number, c: Currency) =>
  toMajor(minor).toFixed(c.digits === 0 ? 0 : 2);

const filename = (ext: string) => `spendly-${new Date().toISOString().slice(0, 10)}.${ext}`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------- CSV */

export function exportCsv(rows: TxnView[], c: Currency) {
  const head = ['Date', 'Type', 'Category', `Amount (${c.code})`, 'Method', 'Note', 'Source'];
  const body = rows.map((r) => [
    r.local_date,
    r.type,
    r.cat_name,
    money(r.amount_minor, c),
    r.method ?? '',
    r.note ?? '',
    r.source,
  ]);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [head, ...body].map((line) => line.map((v) => esc(String(v))).join(',')).join('\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename('csv'));
}

/* ------------------------------------------------------------------ Excel */

export async function exportXlsx(rows: TxnView[], meta: Meta) {
  const XLSX = await import('xlsx');
  const c = meta.currency;
  const wb = XLSX.utils.book_new();

  // Sheet 1 — summary
  const summary = [
    ['Spendly export'],
    ['Period', meta.label],
    ['From', meta.from],
    ['To', meta.to],
    ['Currency', c.code],
    [],
    ['Total spent', Number(money(meta.expense, c))],
    ['Total earned', Number(money(meta.income, c))],
    ['Net', Number(money(meta.income - meta.expense, c))],
    ['Entries', rows.length],
    [],
    ['Category', `Spent (${c.code})`, 'Entries', 'Share'],
    ...meta.byCategory.map((cat) => [
      cat.name,
      Number(money(cat.total, c)),
      cat.count,
      meta.expense ? Math.round((cat.total / meta.expense) * 100) / 100 : 0,
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // Sheet 2 — every transaction
  const ws2 = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      Date: r.local_date,
      Type: r.type,
      Category: r.cat_name,
      [`Amount (${c.code})`]: Number(money(r.amount_minor, c)),
      Method: r.method ?? '',
      Note: r.note ?? '',
      Source: r.source,
    }))
  );
  ws2['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 10 }];
  ws2['!autofilter'] = { ref: `A1:G${rows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, ws2, 'Transactions');

  // Sheet 3 — month by month
  const byMonth = new Map<string, { expense: number; income: number; count: number }>();
  for (const r of rows) {
    const ym = r.local_date.slice(0, 7);
    const cur = byMonth.get(ym) ?? { expense: 0, income: 0, count: 0 };
    if (r.type === 'expense') cur.expense += r.amount_minor;
    else cur.income += r.amount_minor;
    cur.count += 1;
    byMonth.set(ym, cur);
  }
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Month', `Spent (${c.code})`, `Earned (${c.code})`, `Net (${c.code})`, 'Entries'],
    ...[...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => [
        monthLabel(ym),
        Number(money(v.expense, c)),
        Number(money(v.income, c)),
        Number(money(v.income - v.expense, c)),
        v.count,
      ]),
  ]);
  ws3['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'By month');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  download(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename('xlsx')
  );
}

/* -------------------------------------------------------------------- PDF */

export async function exportPdf(rows: TxnView[], meta: Meta) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const c = meta.currency;
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;

  const gold: [number, number, number] = [186, 124, 15];
  const ink: [number, number, number] = [20, 22, 28];
  const dim: [number, number, number] = [110, 118, 130];

  // header
  doc.setFillColor(...ink);
  doc.rect(0, 0, pageW, 92, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Spendly', M, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(190, 195, 205);
  doc.text(`Expense report · ${meta.label}`, M, 62);
  doc.text(`${meta.from} to ${meta.to}`, M, 76);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, pageW - M, 76, { align: 'right' });

  // summary tiles
  let y = 120;
  const tiles: [string, string][] = [
    ['Total spent', `${c.symbol}${money(meta.expense, c)}`],
    ['Total earned', `${c.symbol}${money(meta.income, c)}`],
    ['Net', `${c.symbol}${money(meta.income - meta.expense, c)}`],
    ['Entries', String(rows.length)],
  ];
  const tileW = (pageW - M * 2 - 24) / 4;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tileW + 8);
    doc.setFillColor(246, 246, 243);
    doc.roundedRect(x, y, tileW, 54, 6, 6, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(...dim);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + 10, y + 18);
    doc.setFontSize(13);
    doc.setTextColor(...ink);
    doc.text(value, x + 10, y + 39);
  });
  y += 78;

  // category breakdown
  doc.setFontSize(11);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.text('Where it went', M, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Category', 'Entries', `Spent (${c.code})`, 'Share']],
    body: meta.byCategory.map((cat) => [
      cat.name,
      String(cat.count),
      money(cat.total, c),
      meta.expense ? `${Math.round((cat.total / meta.expense) * 100)}%` : '0%',
    ]),
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 6, textColor: ink },
    headStyles: { fillColor: [240, 240, 236], textColor: dim, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 248] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  // transactions
  const afterCats = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...ink);
  doc.text('All transactions', M, afterCats);

  autoTable(doc, {
    startY: afterCats + 8,
    margin: { left: M, right: M },
    head: [['Date', 'Category', 'Note', 'Method', `Amount (${c.code})`]],
    body: rows.map((r) => [
      dayLabel(r.local_date),
      r.cat_name,
      r.note ?? '',
      r.method ?? '',
      `${r.type === 'income' ? '+' : ''}${money(r.amount_minor, c)}`,
    ]),
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 5, textColor: ink, overflow: 'ellipsize' },
    headStyles: { fillColor: [240, 240, 236], textColor: dim, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 248] },
    columnStyles: { 4: { halign: 'right', fontStyle: 'bold' }, 2: { cellWidth: 140 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4 && String(data.cell.raw).startsWith('+')) {
        data.cell.styles.textColor = [11, 155, 120];
      }
    },
  });

  // footer page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...dim);
    doc.setFont('helvetica', 'normal');
    doc.text(`${i} / ${pages}`, pageW - M, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
    doc.setTextColor(...gold);
    doc.text('Spendly', M, doc.internal.pageSize.getHeight() - 20);
  }

  doc.save(filename('pdf'));
}
