import { RenderedReceiptSnapshotDTO } from './types';

/**
 * Escapes special characters for PDF text syntax.
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ''); // Keep standard printable ASCII
}

/**
 * Generates an official, standard PDF-1.4 document for a fee receipt.
 * Contains:
 * - School Header & Affiliation
 * - Watermark stamp when duplicate copy
 * - Student demographics, Admission No, Standard, Section
 * - Receipt Number, Date, Academic Year, Category
 * - Itemized allocation lines
 * - Exact total in INR figures and Indian words
 * - Official signature lines for:
 *   1. Payer (Physical Ink signature space)
 *   2. Cashier / Accounts Officer
 *   3. Manager / Principal
 */
export function generateReceiptPdf(
  snapshot: RenderedReceiptSnapshotDTO,
  options?: { isDuplicate?: boolean; duplicateCount?: number }
): Buffer {
  const isDuplicate = !!options?.isDuplicate;
  const duplicateCount = options?.duplicateCount || 1;

  // Stream content commands
  const commands: string[] = [];

  // Page dimensions: A4 portrait (595.28 x 841.89 points)
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  // Background border box
  commands.push('0.5 w');
  commands.push('0 0 0 RG'); // Black stroke
  commands.push(`20 20 ${pageWidth - 40} ${pageHeight - 40} re S`);
  commands.push(`22 22 ${pageWidth - 44} ${pageHeight - 44} re S`);

  // Duplicate watermark/banner if duplicate
  if (isDuplicate) {
    commands.push('0.85 0.85 0.85 rg'); // Light gray
    commands.push(`25 785 ${pageWidth - 50} 24 re f`);
    commands.push('BT');
    commands.push('/F2 12 Tf');
    commands.push('0.6 0 0 rg'); // Dark red text
    commands.push(`180 792 Td (${escapePdfText(`*** DUPLICATE COPY (Reprint #${duplicateCount}) ***`)}) Tj`);
    commands.push('ET');
  }

  // School Header
  commands.push('BT');
  commands.push('0 0 0 rg'); // Black text
  commands.push('/F2 18 Tf');
  commands.push(`140 750 Td (${escapePdfText(snapshot.schoolName.toUpperCase())}) Tj`);
  commands.push('/F1 9 Tf');
  commands.push(`-30 -15 Td (${escapePdfText('Affiliated to Karnataka State Secondary Education Examination Board')}) Tj`);
  commands.push(`35 -13 Td (${escapePdfText('123 Education Road, Bengaluru - 560001 | Phone: 080-23456789')}) Tj`);
  commands.push('ET');

  // Title Box
  const receiptTitle =
    snapshot.receiptType === 'final_consolidated'
      ? 'CONSOLIDATED FINAL FEES RECEIPT'
      : `FEE PAYMENT RECEIPT (${snapshot.receiptType.replace('_', ' ').toUpperCase()})`;

  commands.push('0.92 0.94 0.98 rg'); // Soft blue fill
  commands.push(`40 685 ${pageWidth - 80} 22 re f`);
  commands.push('0.2 0.3 0.6 RG');
  commands.push(`40 685 ${pageWidth - 80} 22 re S`);

  commands.push('BT');
  commands.push('0.1 0.2 0.5 rg');
  commands.push('/F2 11 Tf');
  commands.push(`175 692 Td (${escapePdfText(receiptTitle)}) Tj`);
  commands.push('ET');

  // Metadata Panel (Left: Receipt Info, Right: Student Info)
  commands.push('0.98 0.98 0.98 rg');
  commands.push(`40 580 ${pageWidth - 80} 95 re f`);
  commands.push('0.7 0.7 0.7 RG');
  commands.push(`40 580 ${pageWidth - 80} 95 re S`);

  commands.push('BT');
  commands.push('0 0 0 rg');
  commands.push('/F2 9 Tf');
  commands.push('50 655 Td (Receipt Number:) Tj');
  commands.push('/F1 9 Tf');
  commands.push(`75 0 Td (${escapePdfText(snapshot.receiptNumber)}) Tj`);

  commands.push('/F2 9 Tf');
  commands.push('-75 -15 Td (Payment Date:) Tj');
  commands.push('/F1 9 Tf');
  commands.push(`75 0 Td (${escapePdfText(snapshot.paymentDate)}) Tj`);

  commands.push('/F2 9 Tf');
  commands.push('-75 -15 Td (Academic Year:) Tj');
  commands.push('/F1 9 Tf');
  commands.push(`75 0 Td (${escapePdfText(snapshot.academicYear)}) Tj`);

  commands.push('/F2 9 Tf');
  commands.push('-75 -15 Td (Payment Method:) Tj');
  commands.push('/F1 9 Tf');
  commands.push(`75 0 Td (${escapePdfText(snapshot.paymentMethod.toUpperCase())}) Tj`);

  // Student Details (Right column)
  commands.push('/F2 9 Tf');
  commands.push('180 45 Td (Student Name:) Tj');
  commands.push('/F1 9 Tf');
  commands.push(`80 0 Td (${escapePdfText(snapshot.studentName)}) Tj`);

  commands.push('/F2 9 Tf');
  commands.push('-80 -15 Td (Admission No:) Tj');
  commands.push('/F1 9 Tf');
  commands.push(`80 0 Td (${escapePdfText(snapshot.admissionNumber)}) Tj`);

  commands.push('/F2 9 Tf');
  commands.push('-80 -15 Td (Standard / Section:) Tj');
  commands.push('/F1 9 Tf');
  commands.push(`80 0 Td (${escapePdfText(`${snapshot.standard} - Section ${snapshot.section}`)}) Tj`);

  commands.push('/F2 9 Tf');
  commands.push('-80 -15 Td (Payer Name:) Tj');
  commands.push('/F1 9 Tf');
  commands.push(`80 0 Td (${escapePdfText(snapshot.payerName)}) Tj`);
  commands.push('ET');

  // Itemized Allocations Table
  const tableTop = 550;
  commands.push('0.85 0.88 0.92 rg');
  commands.push(`40 ${tableTop} ${pageWidth - 80} 18 re f`);
  commands.push('0 0 0 RG');
  commands.push(`40 ${tableTop} ${pageWidth - 80} 18 re S`);

  commands.push('BT');
  commands.push('0 0 0 rg');
  commands.push('/F2 9 Tf');
  commands.push(`50 ${tableTop + 5} Td (Sl.) Tj`);
  commands.push('40 0 Td (Fee Description / Head) Tj');
  commands.push('330 0 Td (Amount in INR) Tj');
  commands.push('ET');

  let currentY = tableTop - 20;
  snapshot.itemizedAllocations.forEach((item, idx) => {
    commands.push('0.8 0.8 0.8 RG');
    commands.push(`40 ${currentY - 4} ${pageWidth - 80} 0.5 re S`);

    commands.push('BT');
    commands.push('0 0 0 rg');
    commands.push('/F1 9 Tf');
    commands.push(`50 ${currentY} Td (${idx + 1}) Tj`);
    commands.push(`40 0 Td (${escapePdfText(item.feeHeadName)}) Tj`);
    commands.push(`330 0 Td (INR ${escapePdfText(item.amountInr)}) Tj`);
    commands.push('ET');
    currentY -= 20;
  });

  // Total Box
  commands.push('0.92 0.94 0.98 rg');
  commands.push(`40 ${currentY - 10} ${pageWidth - 80} 24 re f`);
  commands.push('0 0 0 RG');
  commands.push(`40 ${currentY - 10} ${pageWidth - 80} 24 re S`);

  commands.push('BT');
  commands.push('0 0 0 rg');
  commands.push('/F2 10 Tf');
  commands.push(`50 ${currentY - 3} Td (TOTAL PAID AMOUNT:) Tj`);
  commands.push(`370 0 Td (INR ${escapePdfText(snapshot.totalAmountInr)}) Tj`);
  commands.push('ET');

  // Amount in words
  currentY -= 35;
  commands.push('BT');
  commands.push('0 0 0 rg');
  commands.push('/F2 9 Tf');
  commands.push(`40 ${currentY} Td (Amount in Words:) Tj`);
  commands.push('/F1 9 Tf');
  commands.push(`85 0 Td (${escapePdfText(snapshot.totalAmountInWords)}) Tj`);
  commands.push('ET');

  // Signature Block (Payer, Cashier, Principal/Manager)
  const signY = 90;

  // Payer Signature line
  commands.push('0 0 0 RG');
  commands.push(`50 ${signY + 25} 120 0.5 re S`);
  commands.push('BT');
  commands.push('/F2 8 Tf');
  commands.push(`65 ${signY + 12} Td (${escapePdfText(snapshot.signatories.payerSignatureLine)}) Tj`);
  commands.push('/F1 7 Tf');
  commands.push('-10 -10 Td ((Physical Ink Signature)) Tj');
  commands.push('ET');

  // Cashier Signature line
  commands.push(`230 ${signY + 25} 120 0.5 re S`);
  commands.push('BT');
  commands.push('/F2 8 Tf');
  commands.push(`245 ${signY + 12} Td (${escapePdfText(snapshot.signatories.cashierSignatureLine)}) Tj`);
  commands.push('/F1 7 Tf');
  commands.push('0 -10 Td ((Cashier / Accounts Officer)) Tj');
  commands.push('ET');

  // Manager Signature line
  commands.push(`410 ${signY + 25} 120 0.5 re S`);
  commands.push('BT');
  commands.push('/F2 8 Tf');
  commands.push(`425 ${signY + 12} Td (${escapePdfText(snapshot.signatories.managerSignatureLine)}) Tj`);
  commands.push('/F1 7 Tf');
  commands.push('-5 -10 Td ((Principal / Manager Authority)) Tj');
  commands.push('ET');

  // Footer note
  commands.push('BT');
  commands.push('0.4 0.4 0.4 rg');
  commands.push('/F1 7 Tf');
  commands.push(`140 35 Td (This is a system-generated official fee receipt of ABC English Medium School.) Tj`);
  commands.push('ET');

  const streamContent = commands.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  // PDF-1.4 Assembly
  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj`
  );
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');
  objects.push(`6 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`);

  let offset = 9; // "%PDF-1.4\n"
  const xrefEntries: string[] = ['0000000000 65535 f \n'];

  const bodyParts: string[] = ['%PDF-1.4\n'];
  for (const obj of objects) {
    const paddedOffset = String(offset).padStart(10, '0');
    xrefEntries.push(`${paddedOffset} 00000 n \n`);
    bodyParts.push(obj + '\n');
    offset += Buffer.byteLength(obj + '\n', 'utf-8');
  }

  const xrefOffset = offset;
  const xrefHeader = `xref\n0 ${objects.length + 1}\n`;
  const xrefBody = xrefEntries.join('');
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const fullPdf = bodyParts.join('') + xrefHeader + xrefBody + trailer;
  return Buffer.from(fullPdf, 'utf-8');
}
