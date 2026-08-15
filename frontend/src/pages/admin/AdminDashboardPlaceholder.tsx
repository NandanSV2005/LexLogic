import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ShieldCheck, FileSearch } from 'lucide-react';

export const AdminDashboardPlaceholder: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Platform Administration</h1>
              <Badge variant="error">Admin Role</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Provider verification management & security audit trail inspection
            </p>
          </div>
          <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
            Logged in as <span className="font-semibold text-slate-200">{user?.email}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl w-fit mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <CardTitle>Provider Verification Management</CardTitle>
              <CardDescription>Review & update verification status</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Approve or reject submitted provider profiles (`PENDING`, `SUBMITTED`, `VERIFIED`, `REJECTED`).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="p-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl w-fit mb-2">
                <FileSearch className="w-5 h-5" />
              </div>
              <CardTitle>Security Audit Logs</CardTitle>
              <CardDescription>Sanitized event trail</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Inspect system audit logs for logins, profile updates, verifications, document grants/revocations, and denied access attempts.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
