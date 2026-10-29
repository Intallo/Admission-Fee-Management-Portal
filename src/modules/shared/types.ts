/**
 * School Admission & Fee Management Portal
 * Module: Shared Domain Kernel & Primitive Contracts
 */

/** Exact INR currency string format (e.g. "15000.00") */
export type DecimalInrString = string & { readonly __brand: unique symbol };

export function toDecimalInrString(val: string | number): DecimalInrString {
  const num = typeof val === 'number' ? val.toFixed(2) : parseFloat(val).toFixed(2);
  if (isNaN(parseFloat(num))) {
    throw new Error(`Invalid monetary amount: ${val}`);
  }
  return num as DecimalInrString;
}

/** Standard ISO 8601 Timestamp String */
export type IsoTimestampString = string;

/** Standard UUID String */
export type UUID = string;

/** Standard Identifier Types */
export type ApplicationNumber = string; // format: {seq}/{academic_year} e.g. "161/2026-27"
export type AdmissionNumber = string;   // format: ADM-YYYY-NNNN e.g. "ADM-2026-0001"
export type ReceiptNumber = string;     // format: RCT-YYYY-NNNNNN e.g. "RCT-2026-000001"
export type CertificateNumber = string; // format: TC-YYYY-NNNN e.g. "TC-2026-0001"

/** RFC 7807 Standard API Error Response */
export interface ApiErrorResponse {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance: string;
  correlationId: string;
  timestamp: IsoTimestampString;
  invalidParams?: Array<{
    name: string;
    reason: string;
  }>;
}

/** Standard Pagination Envelope */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
