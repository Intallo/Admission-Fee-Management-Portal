'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Alert } from '../../../components/ui/Alert';
import {
  Receipt,
  Search,
  Printer,
  Copy,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { ReceiptDTO, StatementOfAccountDTO, ConsolidatedReceiptDTO } from '../../../modules/receipts/types';

export default function ReceiptsPage() {
  const [activeTab, setActiveTab] = useState<'lookup' | 'statement' | 'final'>('lookup');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Tab 1: Receipt Lookup & Reprint State ---
  const [receiptSearchId, setReceiptSearchId] = useState('');
  const [isSearchingReceipt, setIsSearchingReceipt] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptDTO | null>(null);
  const [isReprinting, setIsReprinting] = useState(false);

  // --- Tab 2: Statement of Account State ---
  const [statementRecordId, setStatementRecordId] = useState('');
  const [isSearchingStatement, setIsSearchingStatement] = useState(false);
  const [activeStatement, setActiveStatement] = useState<StatementOfAccountDTO | null>(null);

  // --- Tab 3: Final Fees Receipt State ---
  const [finalRecordId, setFinalRecordId] = useState('');
  const [isCheckingFinal, setIsCheckingFinal] = useState(false);
  const [finalCheckDues, setFinalCheckDues] = useState<{
    studentName: string;
    admissionNumber: string;
    netBalanceDueInr: string;
    totalPaidInr: string;
  } | null>(null);
  const [isIssuingFinal, setIsIssuingFinal] = useState(false);
  const [issuedFinalReceipt, setIssuedFinalReceipt] = useState<ConsolidatedReceiptDTO | null>(null);

  // Lookup Receipt
  const handleSearchReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptSearchId.trim()) return;

    setIsSearchingReceipt(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/v1/receipts/${encodeURIComponent(receiptSearchId.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setActiveReceipt(data);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Receipt not found.');
        setActiveReceipt(null);
      }
    } catch {
      setErrorMessage('Failed to lookup receipt.');
      setActiveReceipt(null);
    } finally {
      setIsSearchingReceipt(false);
    }
  };

  // Reprint Receipt Duplicate
  const handleReprintReceipt = async () => {
    if (!activeReceipt) return;

    setIsReprinting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/v1/receipts/${activeReceipt.id}/reprint`, {
        method: 'POST',
      });
      if (res.ok) {
        const result = await res.json();
        setSuccessMessage(
          `Duplicate reprint recorded! Reprint count is now #${result.reprintCount}. Watermark applied.`
        );
        setActiveReceipt({
          ...activeReceipt,
          reprintCount: result.reprintCount,
          lastReprintedAt: result.reprintedAt,
        });
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Reprint logging failed.');
      }
    } catch {
      setErrorMessage('Failed to trigger duplicate reprint.');
    } finally {
      setIsReprinting(false);
    }
  };

  // Lookup Statement of Account
  const handleSearchStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementRecordId.trim()) return;

    setIsSearchingStatement(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/v1/receipts/statement/${encodeURIComponent(statementRecordId.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setActiveStatement(data);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Statement of account not found.');
        setActiveStatement(null);
      }
    } catch {
      setErrorMessage('Failed to generate statement of account.');
      setActiveStatement(null);
    } finally {
      setIsSearchingStatement(false);
    }
  };

  // Check dues before Final Receipt
  const handleCheckDuesForFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalRecordId.trim()) return;

    setIsCheckingFinal(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIssuedFinalReceipt(null);
    try {
      const res = await fetch(`/api/v1/students/${encodeURIComponent(finalRecordId.trim())}/dues`);
      if (res.ok) {
        const dues = await res.json();
        setFinalCheckDues({
          studentName: dues.studentName,
          admissionNumber: dues.admissionNumber,
          netBalanceDueInr: dues.netBalanceDueInr,
          totalPaidInr: dues.totalPaidInr,
        });
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Student dues record not found.');
        setFinalCheckDues(null);
      }
    } catch {
      setErrorMessage('Failed to check student dues.');
      setFinalCheckDues(null);
    } finally {
      setIsCheckingFinal(false);
    }
  };

  // Issue Final Fees Receipt
  const handleIssueFinalReceipt = async () => {
    if (!finalRecordId.trim()) return;

    setIsIssuingFinal(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/v1/receipts/final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentAcademicRecordId: finalRecordId.trim(),
        }),
      });

      if (res.ok) {
        const finalReceipt = await res.json();
        setIssuedFinalReceipt(finalReceipt);
        setSuccessMessage(`Final Fees Receipt issued: ${finalReceipt.receiptNumber}! Net dues verified at ₹0.00.`);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Failed to issue Final Fees Receipt.');
      }
    } catch {
      setErrorMessage('Error issuing Final Fees Receipt.');
    } finally {
      setIsIssuingFinal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-700" />
            Receipts & Financial Statements
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monotonic receipt series (RCT-YYYY-NNNNNN), PDF generation, unnumbered statements, and zero-dues final receipts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">Monotonic: RCT-YYYY-NNNNNN</Badge>
          <Badge variant="success">3 Signatory Mandate</Badge>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <Alert variant="danger" title="Operation Notice">
          {errorMessage}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" title="Success">
          {successMessage}
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab('lookup')}
          className={`py-2 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'lookup'
              ? 'border-blue-700 text-blue-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search className="w-4 h-4" />
          Receipt Lookup & Reprint
        </button>
        <button
          onClick={() => setActiveTab('statement')}
          className={`py-2 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'statement'
              ? 'border-blue-700 text-blue-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Statement of Account (Unnumbered)
        </button>
        <button
          onClick={() => setActiveTab('final')}
          className={`py-2 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'final'
              ? 'border-emerald-700 text-emerald-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Final Fees Receipt (Zero Dues)
        </button>
      </div>

      {/* TAB 1: RECEIPT LOOKUP & REPRINT */}
      {activeTab === 'lookup' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Lookup Payment Receipt</CardTitle>
              <CardDescription>
                Search by Receipt Number (e.g. RCT-2026-000001) or Receipt UUID to view the immutable snapshot, download PDF, or record a duplicate reprint.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchReceipt} className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Enter Receipt Number (RCT-YYYY-NNNNNN) or Receipt UUID..."
                    value={receiptSearchId}
                    onChange={(e) => setReceiptSearchId(e.target.value)}
                  />
                </div>
                <Button type="submit" isLoading={isSearchingReceipt}>
                  Lookup Receipt
                </Button>
              </form>
            </CardContent>
          </Card>

          {activeReceipt && (
            <Card className="border-blue-200">
              <CardHeader className="pb-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl font-bold font-mono text-blue-950">
                      {activeReceipt.receiptNumber}
                    </CardTitle>
                    {activeReceipt.reprintCount === 0 ? (
                      <Badge variant="success">Original Copy</Badge>
                    ) : (
                      <Badge variant="warning">Duplicate Copy (#{activeReceipt.reprintCount})</Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    Issued on {activeReceipt.renderedSnapshot.paymentDate} • Academic Year:{' '}
                    {activeReceipt.renderedSnapshot.academicYear}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <a href={`/api/v1/receipts/${activeReceipt.id}/pdf`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="primary">
                      <Printer className="w-4 h-4 mr-1.5" />
                      Print / Download PDF
                    </Button>
                  </a>
                  <Button size="sm" variant="secondary" onClick={handleReprintReceipt} isLoading={isReprinting}>
                    <Copy className="w-4 h-4 mr-1.5" />
                    Record Reprint
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Snapshot Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded text-xs border">
                  <div>
                    <span className="text-gray-500 block">Student:</span>
                    <span className="font-semibold text-gray-900">{activeReceipt.renderedSnapshot.studentName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Admission No:</span>
                    <span className="font-mono font-medium text-gray-900">
                      {activeReceipt.renderedSnapshot.admissionNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Standard & Section:</span>
                    <span className="font-medium text-gray-900">
                      {activeReceipt.renderedSnapshot.standard} - {activeReceipt.renderedSnapshot.section}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Payment Method:</span>
                    <span className="font-medium text-gray-900">{activeReceipt.renderedSnapshot.paymentMethod}</span>
                  </div>
                </div>

                {/* Line Items */}
                <div className="border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b text-gray-600">
                      <tr>
                        <th className="py-2.5 px-4 text-left">Fee Head Description</th>
                        <th className="py-2.5 px-4 text-right">Amount Allocated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activeReceipt.renderedSnapshot.itemizedAllocations.map((alloc, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-4 font-medium text-gray-800">{alloc.feeHeadName}</td>
                          <td className="py-2 px-4 text-right font-medium text-gray-900">₹{alloc.amountInr}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50/70 font-bold text-sm">
                        <td className="py-2.5 px-4 text-gray-900">Total Amount Paid</td>
                        <td className="py-2.5 px-4 text-right text-blue-900">
                          ₹{activeReceipt.renderedSnapshot.totalAmountInr}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border">
                  <strong>Amount in Words:</strong> {activeReceipt.renderedSnapshot.totalAmountInWords}
                </div>

                {/* Signatories Block */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t text-center text-xs text-gray-500">
                  <div className="p-3 border rounded bg-white">
                    <div className="h-8 border-b border-dashed border-gray-300 mb-2"></div>
                    <span className="font-medium text-gray-700">Payer&apos;s Signature</span>
                    <span className="block text-[10px] text-gray-400">Physical Signature Space</span>
                  </div>
                  <div className="p-3 border rounded bg-white">
                    <div className="h-8 border-b border-dashed border-gray-300 mb-2"></div>
                    <span className="font-medium text-gray-700">Cashier / Accounts Officer</span>
                    <span className="block text-[10px] text-gray-400">Cash Counter Signatory</span>
                  </div>
                  <div className="p-3 border rounded bg-white">
                    <div className="h-8 border-b border-dashed border-gray-300 mb-2"></div>
                    <span className="font-medium text-gray-700">Principal / Manager</span>
                    <span className="block text-[10px] text-gray-400">Executive Signatory</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: STATEMENT OF ACCOUNT */}
      {activeTab === 'statement' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Generate Statement of Account</CardTitle>
              <CardDescription>
                Unnumbered financial ledger statement available anytime for student review (US-28, SBR-08).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearchStatement} className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Enter Student Academic Record ID..."
                    value={statementRecordId}
                    onChange={(e) => setStatementRecordId(e.target.value)}
                  />
                </div>
                <Button type="submit" isLoading={isSearchingStatement}>
                  Generate Statement
                </Button>
              </form>
            </CardContent>
          </Card>

          {activeStatement && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="default" className="mb-2">
                      UNNUMBERED STATEMENT OF ACCOUNT
                    </Badge>
                    <CardTitle className="text-lg font-bold text-gray-900">{activeStatement.studentName}</CardTitle>
                    <CardDescription>
                      Admission No: {activeStatement.admissionNumber} • Standard: {activeStatement.standard} • Academic Year:{' '}
                      {activeStatement.academicYear}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">Generated At</span>
                    <span className="text-xs font-mono text-gray-600">
                      {new Date(activeStatement.generatedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-6">
                {/* Financial Summary KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-50 rounded border">
                    <span className="text-xs text-gray-500 block">Total Assessed</span>
                    <span className="text-lg font-bold text-gray-900">₹{activeStatement.totalAssessedInr}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
                    <span className="text-xs text-emerald-700 block">Concessions</span>
                    <span className="text-lg font-bold text-emerald-900">₹{activeStatement.totalConcessionsInr}</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    <span className="text-xs text-blue-700 block">Total Paid</span>
                    <span className="text-lg font-bold text-blue-900">₹{activeStatement.totalPaidInr}</span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded border border-amber-200">
                    <span className="text-xs text-amber-700 block">Net Outstanding</span>
                    <span className="text-lg font-bold text-amber-900">₹{activeStatement.netOutstandingDuesInr}</span>
                  </div>
                </div>

                {/* Assessments Breakdown */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Assessment Lines & Balances
                  </h4>
                  <div className="border rounded overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b text-gray-600">
                        <tr>
                          <th className="py-2 px-3 text-left">Fee Head</th>
                          <th className="py-2 px-3 text-left">Category</th>
                          <th className="py-2 px-3 text-right">Assessed</th>
                          <th className="py-2 px-3 text-right">Concessions</th>
                          <th className="py-2 px-3 text-right">Collected</th>
                          <th className="py-2 px-3 text-right">Remaining Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {activeStatement.assessments.map((line, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-medium text-gray-900">{line.headName}</td>
                            <td className="py-2 px-3 capitalize text-gray-600">{line.category.replace('_', ' ')}</td>
                            <td className="py-2 px-3 text-right">₹{line.assessedInr}</td>
                            <td className="py-2 px-3 text-right text-emerald-600">-₹{line.concessionInr}</td>
                            <td className="py-2 px-3 text-right text-blue-600">₹{line.paidInr}</td>
                            <td className="py-2 px-3 text-right font-semibold text-amber-700">₹{line.balanceInr}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment History */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Payment Receipts History
                  </h4>
                  {activeStatement.paymentHistory.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No payment receipts issued yet.</p>
                  ) : (
                    <div className="border rounded overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b text-gray-600">
                          <tr>
                            <th className="py-2 px-3 text-left">Receipt Number</th>
                            <th className="py-2 px-3 text-left">Date</th>
                            <th className="py-2 px-3 text-left">Method</th>
                            <th className="py-2 px-3 text-right">Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {activeStatement.paymentHistory.map((p, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-mono font-medium text-blue-700">{p.receiptNumber}</td>
                              <td className="py-2 px-3 text-gray-600">{p.date}</td>
                              <td className="py-2 px-3 text-gray-600">{p.method}</td>
                              <td className="py-2 px-3 text-right font-semibold text-gray-900">₹{p.amountInr}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: FINAL FEES RECEIPT (ZERO DUES MANDATE) */}
      {activeTab === 'final' && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold">
                Issue Final Fees Receipt (Zero Dues Mandate - BR-25)
              </CardTitle>
              <CardDescription>
                A Final Fees Receipt may only be issued when all head dues are ₹0.00. It draws the next sequential number from the shared RCT series and itemizes all prior receipts.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <form onSubmit={handleCheckDuesForFinal} className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label="Student Academic Record UUID"
                    placeholder="Enter student academic record ID..."
                    value={finalRecordId}
                    onChange={(e) => setFinalRecordId(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" isLoading={isCheckingFinal}>
                  Check Net Balance
                </Button>
              </form>

              {finalCheckDues && (
                <div className="border rounded-md p-4 bg-gray-50 space-y-3 text-xs">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-semibold text-gray-800">{finalCheckDues.studentName}</span>
                    <span className="font-mono text-gray-500">Adm: {finalCheckDues.admissionNumber}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Total Fees Paid:</span>
                    <span className="font-semibold text-gray-900">₹{finalCheckDues.totalPaidInr}</span>
                  </div>
                  <div className="flex justify-between py-1 font-bold text-sm">
                    <span className="text-gray-800">Net Remaining Dues:</span>
                    <span
                      className={
                        parseFloat(finalCheckDues.netBalanceDueInr) === 0 ? 'text-green-700' : 'text-rose-700'
                      }
                    >
                      ₹{finalCheckDues.netBalanceDueInr}
                    </span>
                  </div>

                  {parseFloat(finalCheckDues.netBalanceDueInr) === 0 ? (
                    <div className="pt-2">
                      <div className="p-2.5 bg-green-50 border border-green-200 rounded text-green-800 mb-3">
                        ✓ All fee heads cleared (₹0.00 net balance). Eligible for Final Fees Receipt.
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        className="w-full"
                        onClick={handleIssueFinalReceipt}
                        isLoading={isIssuingFinal}
                      >
                        <ShieldCheck className="w-4 h-4 mr-1.5" />
                        Issue Final Fees Receipt (Consolidated)
                      </Button>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800">
                      Cannot issue Final Fees Receipt: Outstanding balance of ₹{finalCheckDues.netBalanceDueInr}{' '}
                      remains. Please clear all dues first under Offline Payment Collection.
                    </div>
                  )}
                </div>
              )}

              {issuedFinalReceipt && (
                <Card className="border-green-300 bg-green-50/40">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-green-700 font-semibold uppercase tracking-wider">
                          Final Fees Receipt Issued
                        </div>
                        <div className="text-xl font-bold font-mono text-green-950">
                          {issuedFinalReceipt.receiptNumber}
                        </div>
                        <div className="text-xs text-green-800">
                          Total Paid: ₹{issuedFinalReceipt.totalAmountInr} ({issuedFinalReceipt.totalAmountInWords})
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-green-200">
                      <span className="text-[11px] font-semibold text-green-900 block mb-1">
                        Consolidated Prior Receipts:
                      </span>
                      <ul className="text-xs text-green-800 space-y-0.5 list-disc pl-4">
                        {issuedFinalReceipt.itemizedPriorReceipts.map((r, i) => (
                          <li key={i}>
                            <span className="font-mono">{r.receiptNumber}</span>: ₹{r.amountInr}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2">
                      <a href={`/api/v1/receipts/${issuedFinalReceipt.id}/pdf`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="primary">
                          <Printer className="w-4 h-4 mr-1.5" />
                          View / Print Consolidated PDF
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
