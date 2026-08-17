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

  const handleCategorySelect = (category: ServiceCategoryOption) => {
    setSelectedCategory(category.label);
    if (!isCustomProviderType) {
      setPreferredProviderType(category.defaultProviderType);
    }
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
        <div className="mb-8">
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
                  Select the category that best matches your situation or type in your own words.
                </p>
              </div>
            </div>

            {/* Service-First Category Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {SERVICE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.label;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[#DDE8DC] border-[#7C9A82] text-[#29352D] shadow-sm font-semibold'
                        : 'bg-[#FAFCF9] border-[#C8D7C7] text-[#617066] hover:border-[#7C9A82]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="p-1.5 bg-[#F0F4EC] border border-[#C8D7C7] rounded-lg">
                        {cat.icon}
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[#7C9A82]" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-[#29352D]">{cat.label}</span>
                    <span className="text-[11px] text-[#617066] mt-1 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Free-text Description Field */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#29352D] uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#7C9A82]" />
                <span>Describe your legal issue in detail</span>
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your legal issue in your own words..."
                className="w-full px-3.5 py-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl text-[#29352D] placeholder-[#8C9B90] focus:outline-none focus:ring-2 focus:ring-[#7C9A82]/30 focus:border-[#7C9A82] text-xs sm:text-sm leading-relaxed"
                required
              />
              <span className="text-[11px] text-[#617066]">
                You do not need to identify legal terminology or exact lawyer types. Just describe the problem you need solved.
              </span>
            </div>
          </Card>

          {/* SECTION 2: Location */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#C8D7C7]">
              <div className="p-2 bg-[#DDE8DC] text-[#7C9A82] border border-[#C8D7C7] rounded-lg">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#29352D]">
                  Section 2 — Location
                </h2>
                <p className="text-xs text-[#617066]">
                  Location helps the matching engine prioritize providers near your court jurisdiction or city.
                </p>
              </div>
            </div>

            <Input
              label="City / Location"
              type="text"
              placeholder="e.g. Mumbai, New Delhi, Bengaluru, Pune"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              leftIcon={<MapPin className="w-4 h-4 text-[#7C9A82]" />}
              helperText="Enter your city or district name for localized matching."
            />
          </Card>

          {/* SECTION 3: Optional Preferences */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#C8D7C7]">
              <div className="p-2 bg-[#DDE8DC] text-[#9A8FB5] border border-[#C8D7C7] rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#29352D]">
                  Section 3 — Optional Preferences
                </h2>
                <p className="text-xs text-[#617066]">
                  Specify optional constraints such as provider category or request urgency.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Preferred Provider Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#29352D] uppercase tracking-wide">
                  Preferred Provider Type (Optional)
                </label>
                <select
                  value={preferredProviderType}
                  onChange={(e) => {
                    setPreferredProviderType(e.target.value as ProviderType);
                    setIsCustomProviderType(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl text-[#29352D] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9A82]/30"
                >
                  <option value={ProviderType.ADVOCATE}>Advocate (High Court / District Court)</option>
                  <option value={ProviderType.MEDIATOR}>Mediator (Out-of-Court Settlement)</option>
                  <option value={ProviderType.ARBITRATOR}>Arbitrator (Binding Dispute Resolution)</option>
                  <option value={ProviderType.NOTARY}>Notary (Attestation & Sworn Oath)</option>
                  <option value={ProviderType.DOCUMENT_WRITER}>Document Writer (Deed Drafting)</option>
                </select>
                <span className="text-[11px] text-[#617066]">
                  System auto-recommends provider type based on your category choice.
                </span>
              </div>

              {/* Urgency */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#29352D] uppercase tracking-wide">
                  Urgency Level
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as RequestUrgency)}
                  className="w-full px-3.5 py-2.5 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl text-[#29352D] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9A82]/30"
                >
                  <option value={RequestUrgency.NORMAL}>Normal (Standard Response)</option>
                  <option value={RequestUrgency.HIGH}>High (Require attention within 24 hours)</option>
                  <option value={RequestUrgency.URGENT}>Urgent (Immediate assistance required)</option>
                </select>
              </div>
            </div>

            {/* Legal Aid Interest Flag */}
            <div className="mt-6 pt-4 border-t border-[#C8D7C7] flex items-start gap-3">
              <input
                type="checkbox"
                id="legalAidCheck"
                checked={legalAidInterest}
                onChange={(e) => setLegalAidInterest(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#7C9A82] bg-[#FAFCF9] border-[#C8D7C7] rounded focus:ring-[#7C9A82]"
              />
              <label htmlFor="legalAidCheck" className="text-xs text-[#29352D] cursor-pointer">
                <span className="font-bold text-[#29352D]">
                  I am interested in Legal Aid / Pro Bono support options
                </span>
                <p className="text-[#617066] mt-0.5 text-[11px]">
                  Check this box if you may qualify for free or subsidized legal services under legal aid guidelines.
                </p>
              </label>
            </div>
          </Card>

          {/* Submit Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <Link
              to="/citizen/dashboard"
              className="text-xs font-semibold text-[#617066] hover:text-[#29352D] transition-colors"
            >
              Cancel & Return to Dashboard
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full sm:w-auto px-8"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Find the Right Help
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-[#617066] text-center">
            <ShieldCheck className="w-4 h-4 text-[#7C9A82] shrink-0" />
            <span>
              All Advocate matching adheres strictly to Bar Council anti-promotional rules. Results display factual parameters only.
            </span>
          </div>
        </form>
      </main>
    </div>
  );
};
