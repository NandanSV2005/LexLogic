import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/layout/Navbar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Award, Activity, Briefcase } from 'lucide-react';

export const ProviderDashboardPlaceholder: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Provider Workspace</h1>
              <Badge variant="indigo">Provider Role</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Onboarding, profile completion, incentive points, and matching inquiries
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
                <Briefcase className="w-5 h-5" />
              </div>
              <CardTitle>Profile Completion</CardTitle>
              <CardDescription>Base fields & provider-type specific generic fields</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Complete practice areas, registration details, and experience to achieve 100% completion and earn incentive points.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl w-fit mb-2">
                <Activity className="w-5 h-5" />
              </div>
              <CardTitle>Reliability & Verification</CardTitle>
              <CardDescription>Deterministic score based on response time</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Maintain high response speed to keep reliability score near 100. Admin verification adds matching weight.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl w-fit mb-2">
                <Award className="w-5 h-5" />
              </div>
              <CardTitle>Points & Incentive System</CardTitle>
              <CardDescription>Reward points ledger</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Points are awarded for profile completion, fast responses, and verified status. Points have 0 impact on match ranking.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
