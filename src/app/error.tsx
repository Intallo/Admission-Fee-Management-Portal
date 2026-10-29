'use client';

import React, { useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log safe error summary
    console.error('[Application Error Boundary Caught]:', error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-school-surface-subtle flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-red-200">
        <CardHeader className="bg-red-50 border-red-200">
          <CardTitle className="text-school-danger">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <p className="text-xs text-school-text-muted leading-relaxed">
            An unexpected error occurred while rendering the page. Internal details have been recorded safely in server logs.
          </p>
          {error.digest && (
            <div className="bg-gray-100 p-2 rounded text-[11px] font-mono text-gray-600">
              Reference Digest: {error.digest}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => (window.location.href = '/')}>
              Return to Dashboard
            </Button>
            <Button variant="primary" onClick={() => reset()}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
