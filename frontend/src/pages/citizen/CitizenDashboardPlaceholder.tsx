import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { FileText, Search, UserCheck } from 'lucide-react';

export const CitizenDashboardPlaceholder: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Citizen Portal</h1>
              <Badge variant="success">Citizen Role</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Service-first legal assistance, transparent matching & private document vault
            </p>
          </div>
          <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
            Logged in as <span className="font-semibold text-slate-200">{user?.email}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl w-fit mb-2">
                <Search className="w-5 h-5" />
              </div>
              <CardTitle>Describe Legal Need</CardTitle>
              <CardDescription>Service-first matching with qualified providers</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Describe your issue, location, and preferred provider type. Matching runs on backend multi-attribute scoring rules.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl w-fit mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <CardTitle>Private Document Vault</CardTitle>
              <CardDescription>Secure file storage & explicit access sharing</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload confidential deeds and contracts. Explicitly grant or revoke access to providers on demand.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="p-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl w-fit mb-2">
                <UserCheck className="w-5 h-5" />
              </div>
              <CardTitle>Service Requests</CardTitle>
              <CardDescription>Track active inquiries & provider responses</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Monitor status progression from Open to Matched, In Progress, and Completed.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
