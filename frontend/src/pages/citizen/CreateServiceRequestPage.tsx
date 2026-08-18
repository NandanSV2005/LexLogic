import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Scale,
  MapPin,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Briefcase,
  FileCheck,
  Users,
  Award,
  Stamp,
  HelpCircle,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/common/ErrorState';
import { AINeedNavigatorModal } from '../../components/navigator/AINeedNavigatorModal';
import { requestsApi } from '../../api';
import { ProviderType, RequestUrgency } from '../../types';

interface ServiceCategoryOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultProviderType: ProviderType;
}

const SERVICE_CATEGORIES: ServiceCategoryOption[] = [
  {
    id: 'Property Dispute',
    label: 'Property Dispute',
    description: 'Title deeds, land ownership, tenant issues & real estate conflicts',
    icon: <Building2 className="w-5 h-5 text-[#7C9A82]" />,
    defaultProviderType: ProviderType.ADVOCATE,
  },
  {
    id: 'Commercial Dispute',
    label: 'Commercial Dispute',
    description: 'Business contracts, vendor agreements & corporate litigation',
    icon: <Briefcase className="w-5 h-5 text-[#9A8FB5]" />,
    defaultProviderType: ProviderType.ADVOCATE,
  },
  {
    id: 'Document Preparation',
    label: 'Document Preparation',
    description: 'Drafting agreements, affidavits, wills, deeds & formal legal notices',
    icon: <FileCheck className="w-5 h-5 text-[#7C9A82]" />,
    defaultProviderType: ProviderType.DOCUMENT_WRITER,
  },
  {
    id: 'Mediation',
    label: 'Mediation',
    description: 'Out-of-court amicable settlement for family, civil or business issues',
    icon: <Users className="w-5 h-5 text-[#9A8FB5]" />,
    defaultProviderType: ProviderType.MEDIATOR,
  },
  {
    id: 'Arbitration',
    label: 'Arbitration',
    description: 'Formal binding dispute resolution for commercial contracts',
    icon: <Award className="w-5 h-5 text-[#D6A89A]" />,
    defaultProviderType: ProviderType.ARBITRATOR,
  },
  {
    id: 'Notary Service',
    label: 'Notary Service',
    description: 'Official document attestation, swearing affidavits & verification',
    icon: <Stamp className="w-5 h-5 text-[#7C9A82]" />,
    defaultProviderType: ProviderType.NOTARY,
  },
  {
    id: 'Other Legal Issue',
    label: 'Other',
    description: 'General legal advice or unlisted legal assistance requirements',
    icon: <HelpCircle className="w-5 h-5 text-[#617066]" />,
    defaultProviderType: ProviderType.ADVOCATE,
  },
];

export const CreateServiceRequestPage: React.FC = () => {
  const navigate = useNavigate();

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<string>('Property Dispute');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<string>('New Delhi');
  const [preferredProviderType, setPreferredProviderType] = useState<ProviderType>(ProviderType.ADVOCATE);
  const [urgency, setUrgency] = useState<RequestUrgency>(RequestUrgency.NORMAL);
  const [legalAidInterest, setLegalAidInterest] = useState<boolean>(false);
  const [isCustomProviderType, setIsCustomProviderType] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AI Legal Need Navigator Modal State
  const [isNavigatorOpen, setIsNavigatorOpen] = useState<boolean>(false);

  const handleCategorySelect = (category: ServiceCategoryOption) => {
    setSelectedCategory(category.label);
    if (!isCustomProviderType) {
      setPreferredProviderType(category.defaultProviderType);
    }
  };

  const handleApplyNavigator = (cat: string, pType: ProviderType, desc?: string) => {
    setSelectedCategory(cat);
    setPreferredProviderType(pType);
    setIsCustomProviderType(true);
    if (desc) setDescription(desc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!description.trim()) {
      setErrorMessage('Please describe your legal issue so matching engine can analyze your request.');
      return;
    }

    if (!location.trim()) {
      setErrorMessage('Please enter your city or district location.');
      return;
    }

    setIsLoading(true);

    try {
      const newRequest = await requestsApi.createRequest({
        service_category: selectedCategory,
        description: description.trim(),
        location: location.trim(),
        preferred_provider_type: preferredProviderType,
        urgency,
        legal_aid_interest: legalAidInterest,
      });

      // Navigate to backend matching results page
      navigate(`/citizen/matches/${newRequest.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create service request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8F0E6] text-[#29352D] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#7C9A82] uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Service-First Matching Flow</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#29352D] tracking-tight">
              Describe Your Legal Need
            </h1>
            <p className="text-xs sm:text-sm text-[#617066] mt-1">
              Tell us what issue you are facing. LexLogic will analyze your requirement and match you with verified, available providers without promotional ranking bias.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNavigatorOpen(true)}
            leftIcon={<Sparkles className="w-4 h-4 text-[#7C9A82]" />}
            className="shrink-0"
          >
            AI Legal Need Navigator
          </Button>
        </div>

        {errorMessage && (
          <ErrorState
            title="Service Request Submission Error"
            message={errorMessage}
            className="mb-6"
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION 1: What do you need help with? */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#C8D7C7]">
              <div className="p-2 bg-[#DDE8DC] text-[#7C9A82] border border-[#C8D7C7] rounded-lg">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#29352D]">
                  Section 1 — What do you need help with?
                </h2>
                <p className="text-xs text-[#617066]">
                  Select the closest service category for your legal need.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SERVICE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.label;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'bg-[#DDE8DC] border-[#7C9A82] shadow-sm ring-1 ring-[#7C9A82]'
                        : 'bg-[#FAFCF9] border-[#C8D7C7] hover:border-[#7C9A82]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {cat.icon}
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[#7C9A82]" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#29352D] block">
                        {cat.label}
                      </span>
                      <span className="text-[11px] text-[#617066] leading-tight block mt-0.5">
                        {cat.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* SECTION 2: Problem Description */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#C8D7C7]">
              <div className="p-2 bg-[#DDE8DC] text-[#7C9A82] border border-[#C8D7C7] rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#29352D]">
                  Section 2 — Describe your specific situation
                </h2>
                <p className="text-xs text-[#617066]">
                  Provide factual context so LexLogic matching engine can calculate practice relevance.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#29352D] uppercase tracking-wide">
                  Detailed Description <span className="text-[#5C1D1D]">*</span>
                </label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your legal issue in detail (e.g. Boundary dispute with neighbor regarding wall encroachment on plot #42, or drafting a commercial tenancy contract...)"
                  className="w-full px-3.5 py-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl text-[#29352D] placeholder-[#8C9B90] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9A82]/30 leading-relaxed"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Input
                  label="Location (City / District)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. New Delhi, Mumbai, Bangalore"
                  leftIcon={<MapPin className="w-4 h-4 text-[#7C9A82]" />}
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#29352D] uppercase tracking-wide">
                    Urgency Level
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as RequestUrgency)}
                    className="w-full px-3.5 py-2.5 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl text-[#29352D] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9A82]/30"
                  >
                    <option value={RequestUrgency.NORMAL}>Normal (Standard resolution time)</option>
                    <option value={RequestUrgency.HIGH}>High (Urgent court / document deadline)</option>
                    <option value={RequestUrgency.URGENT}>Immediate (Emergency legal assistance)</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* SECTION 3: Provider Type & Options */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#C8D7C7]">
              <div className="p-2 bg-[#DDE8DC] text-[#7C9A82] border border-[#C8D7C7] rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#29352D]">
                  Section 3 — Provider Routing & Legal Aid
                </h2>
                <p className="text-xs text-[#617066]">
                  Configure your preferred provider category and legal-aid interest routing.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#29352D] uppercase tracking-wide">
                  Preferred Provider Profession
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
                  {[
                    { type: ProviderType.ADVOCATE, label: 'Advocate' },
                    { type: ProviderType.MEDIATOR, label: 'Mediator' },
                    { type: ProviderType.ARBITRATOR, label: 'Arbitrator' },
                    { type: ProviderType.NOTARY, label: 'Notary' },
                    { type: ProviderType.DOCUMENT_WRITER, label: 'Doc Writer' },
                  ].map((item) => {
                    const isSel = preferredProviderType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => {
                          setPreferredProviderType(item.type);
                          setIsCustomProviderType(true);
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                          isSel
                            ? 'bg-[#DDE8DC] border-[#7C9A82] text-[#29352D] shadow-sm ring-1 ring-[#7C9A82]'
                            : 'bg-[#FAFCF9] border-[#C8D7C7] text-[#617066] hover:border-[#7C9A82]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legal Aid Checkbox */}
              <div className="p-4 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl flex items-start gap-3">
                <input
                  type="checkbox"
                  id="legal_aid_check"
                  checked={legalAidInterest}
                  onChange={(e) => setLegalAidInterest(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-[#7C9A82] border-[#C8D7C7] focus:ring-[#7C9A82]"
                />
                <label htmlFor="legal_aid_check" className="text-xs cursor-pointer space-y-0.5">
                  <span className="font-bold text-[#29352D] block">
                    Flag for Potential Pro-Bono / Legal-Aid Interest Routing
                  </span>
                  <span className="text-[#617066] block leading-relaxed">
                    Check this option if you are seeking pro-bono legal assistance or state legal aid routing under eligible criteria.
                  </span>
                </label>
              </div>
            </div>
          </Card>

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4">
            <Link to="/citizen/dashboard">
              <Button variant="outline" size="md">
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              Find Matched Providers Now
            </Button>
          </div>
        </form>
      </main>

      {/* AI LEGAL NEED NAVIGATOR MODAL */}
      {isNavigatorOpen && (
        <AINeedNavigatorModal
          onClose={() => setIsNavigatorOpen(false)}
          onApplyClassification={handleApplyNavigator}
        />
      )}
    </div>
  );
};
