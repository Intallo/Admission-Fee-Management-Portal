import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function ForbiddenPage({
  searchParams,
}: {
  searchParams?: { reason?: string; action?: string };
}) {
  const reason = searchParams?.reason || 'You do not possess the required role authority for this action.';
  const action = searchParams?.action;

  return (
    <div className="min-h-screen bg-school-surface-subtle flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-red-200">
        <CardHeader className="bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full text-school-danger">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-school-danger">403 Forbidden</CardTitle>
              <CardDescription className="text-red-800">
                Access Denied by Centralized Role Policy
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <p className="text-xs text-school-text-muted leading-relaxed">
            {reason}
          </p>

          {action && (
            <div className="bg-gray-100 p-2.5 rounded font-mono text-[11px] text-gray-700">
              Restricted Action: <span className="font-bold text-school-primary">{action}</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-[11px] text-blue-900">
            <strong>Security Boundary Note:</strong> Per signed AUTHORIZATION_MATRIX.md, access permissions are strictly enforced on server route handlers and database boundaries.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Link href="/">
              <Button variant="primary">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
