'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { ShieldCheck, Lock, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // First-login password change state
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setIsLocked(false);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.detail && data.detail.includes('locked')) {
          setIsLocked(true);
        }
        setErrorMessage(data.detail || 'Invalid email or password.');
        setIsLoading(false);
        return;
      }

      if (data.mustChangePassword) {
        setMustChangePassword(true);
        setIsLoading(false);
        return;
      }

      // Successful login
      router.push('/');
      router.refresh();
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordChangeError(data.detail || 'Password does not meet strength requirements.');
        setIsLoading(false);
        return;
      }

      // Password changed successfully; enter application
      router.push('/');
      router.refresh();
    } catch {
      setPasswordChangeError('Failed to change password. Please try again.');
      setIsLoading(false);
    }
  };

  // Demo account quick-fill helper
  const fillDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('School@2026!');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-school-surface-subtle flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-4">
        {/* Header Institution Capsule */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-school-primary text-white font-bold text-xl shadow-md mb-2">
            ABC
          </div>
          <h1 className="text-xl font-bold text-school-text">ABC English Medium School</h1>
          <p className="text-xs text-school-text-muted">Admission & Fee Management Portal</p>
        </div>

        {mustChangePassword ? (
          <Card className="border-amber-200">
            <CardHeader className="bg-amber-50 border-amber-200">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-700" />
                <CardTitle className="text-amber-900">First-Login Password Change</CardTitle>
              </div>
              <CardDescription>
                Your account was configured with a temporary password (A-21). You must set a new secure password before proceeding.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordChange}>
              <CardContent className="space-y-4 pt-5">
                {passwordChangeError && (
                  <Alert variant="danger" title="Error">
                    {passwordChangeError}
                  </Alert>
                )}

                <Input
                  label="New Password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  hint="Min 8 characters, with uppercase, lowercase, number, and special character."
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </CardContent>
              <CardFooter>
                <div className="w-full flex justify-end">
                  <Button type="submit" variant="primary" isLoading={isLoading}>
                    Set New Password & Enter
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Staff Authentication</CardTitle>
                <Badge variant="info">Secure Staff Portal</Badge>
              </div>
              <CardDescription>
                Enter your authorized school credentials to access the administrative portal.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4 pt-5">
                {errorMessage && (
                  <Alert variant={isLocked ? 'danger' : 'warning'} title={isLocked ? 'Account Locked' : 'Authentication Error'}>
                    {errorMessage}
                  </Alert>
                )}

                <Input
                  label="Staff Email Address"
                  type="email"
                  required
                  placeholder="name@school-demo.example"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <Input
                  label="Password"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <div className="bg-school-surface-subtle p-3 rounded-md border border-school-border text-xs text-school-text-muted space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-school-primary">
                    <ShieldCheck className="w-4 h-4" />
                    Security Controls (US-01):
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    <li>5 consecutive failed attempts trigger 15-minute account lockout</li>
                    <li>Automatic 30-minute session inactivity timeout</li>
                  </ul>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                  <Lock className="w-4 h-4 mr-1.5" />
                  Sign In to Staff Portal
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* Quick Demo Accounts Helper */}
        <div className="border border-school-border bg-school-surface rounded-md p-4 text-xs space-y-2">
          <div className="font-semibold text-school-text flex items-center justify-between">
            <span>Synthetic Demo Accounts</span>
            <span className="text-[10px] text-gray-400 font-mono">Password: School@2026!</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => fillDemoAccount('principal@school-demo.example')}
              className="text-left p-2 rounded border border-school-border hover:bg-school-surface-subtle transition-colors text-[11px]"
            >
              <div className="font-semibold text-school-primary">Principal</div>
              <div className="text-gray-500 truncate">principal@school-demo.example</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('accounts@school-demo.example')}
              className="text-left p-2 rounded border border-school-border hover:bg-school-surface-subtle transition-colors text-[11px]"
            >
              <div className="font-semibold text-school-primary">Accounts Officer</div>
              <div className="text-gray-500 truncate">accounts@school-demo.example</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('admissions@school-demo.example')}
              className="text-left p-2 rounded border border-school-border hover:bg-school-surface-subtle transition-colors text-[11px]"
            >
              <div className="font-semibold text-school-primary">Admission Officer</div>
              <div className="text-gray-500 truncate">admissions@school-demo.example</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('system.admin@school-demo.example')}
              className="text-left p-2 rounded border border-school-border hover:bg-school-surface-subtle transition-colors text-[11px]"
            >
              <div className="font-semibold text-school-primary">System Administrator</div>
              <div className="text-gray-500 truncate">system.admin@school-demo.example</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
