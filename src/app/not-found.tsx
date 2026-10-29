import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-school-surface-subtle flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Page Not Found (404)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <p className="text-xs text-school-text-muted leading-relaxed">
            The requested page or route could not be found. Please check the URL or return to the main dashboard.
          </p>
          <div className="flex justify-end pt-2">
            <Link href="/">
              <Button variant="primary">Return to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
