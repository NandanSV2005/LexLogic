import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck,
  ShieldCheck,
  Briefcase,
  MapPin,
  Phone,
  Clock,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { providersApi } from '../../api';
import { Provider, ProviderType } from '../../types';

export const ProviderOnboardingPage: React.FC = () => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Form State
  const [providerType, setProviderType] = useState<ProviderType>(ProviderType.ADVOCATE);
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [experienceYears, setExperienceYears] = useState<number>(3);
  const [bio, setBio] = useState<string>('');

  // Required Field Values based on Profession
  const [field1, setField1] = useState<string>(''); // practice_area / specialization / registration_details / document_types
  const [field2, setField2] = useState<string>(''); // registration_details / service_type

  useEffect(() => {
    const checkExistingProfile = async () => {
      setIsLoading(true);
      try {
        const profile = await providersApi.getMe();
        if (profile) {
          setProviderType(profile.provider_type);
          setFullName(profile.full_name || '');
          setPhone(profile.phone || '');
          setLocation(profile.location || '');
          setExperienceYears(profile.experience_years || 3);
          setBio(profile.bio || '');

          if (profile.field_values) {
            const f1 = profile.field_values[0]?.value || '';
            const f2 = profile.field_values[1]?.value || '';
            setField1(f1);
            setField2(f2);
          }

          if (profile.is_profile_complete) {
            navigate('/provider/dashboard', { replace: true });
          }
        }
      } catch (err: any) {
        // Profile does not exist yet; user will create via form
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingProfile();
  }, [navigate]);

  // Labels for profession-specific required fields
  const getFieldLabels = (type: ProviderType) => {
    switch (type) {
      case ProviderType.ADVOCATE:
        return {
          f1Name: 'practice_area',
          f1Label: 'Practice Area(s)',
          f1Placeholder: 'e.g. Constitutional & Commercial Property Disputes',
          f2Name: 'registration_details',
          f2Label: 'Bar Council / Registration Details',
          f2Placeholder: 'e.g. Bar Council Reg No. D/9876/2009',
        };
      case ProviderType.ARBITRATOR:
        return {
          f1Name: 'specialization',
          f1Label: 'Arbitration Specialization',
          f1Placeholder: 'e.g. Commercial & Infrastructure Arbitration',
          f2Name: 'availability_schedule',
          f2Label: 'Availability / Panel Details',
          f2Placeholder: 'e.g. High Court Empaneled Arbitrator',
        };
      case ProviderType.MEDIATOR:
        return {
          f1Name: 'specialization',
          f1Label: 'Mediation Specialization',
          f1Placeholder: 'e.g. Corporate Shareholder & Family Business Mediation',
          f2Name: 'availability_schedule',
          f2Label: 'Availability Schedule',
          f2Placeholder: 'e.g. Weekday Afternoons & Saturdays',
        };
      case ProviderType.NOTARY:
        return {
          f1Name: 'registration_details',
          f1Label: 'Notary License / Registration Details',
          f1Placeholder: 'e.g. NOT/DEL/5544/2014',
          f2Name: 'service_type',
          f2Label: 'Notary Services Offered',
          f2Placeholder: 'e.g. Affidavit Attestation & Agreement Notarization',
        };
      case ProviderType.DOCUMENT_WRITER:
        return {
          f1Name: 'document_types',
          f1Label: 'Document Types Handled',
          f1Placeholder: 'e.g. Property Sale Deeds, Partnership Contracts, Wills & POA',
          f2Name: 'registration_details',
          f2Label: 'Registration / Drafting Certification',
          f2Placeholder: 'e.g. Reg Deed Drafter No. DL/3321',
        };
      default:
        return {
          f1Name: 'practice_area',
          f1Label: 'Practice Area(s)',
          f1Placeholder: 'e.g. General Legal Practice',
          f2Name: 'registration_details',
          f2Label: 'Registration Details',
          f2Placeholder: 'e.g. License Details',
        };
    }
  };

  const currentFieldLabels = getFieldLabels(providerType);

  // Compute local completion percentage
  const calculateLocalCompletion = () => {
    const checks = [
      Boolean(fullName.trim()),
      Boolean(phone.trim()),
      Boolean(location.trim()),
      Boolean(bio.trim()),
      experienceYears > 0,
      Boolean(field1.trim()),
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  };

  const completionPct = calculateLocalCompletion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 1. Try fetching profile to check if profile exists
      let profileExists = false;
      try {
        await providersApi.getMe();
        profileExists = true;
      } catch (err) {
        profileExists = false;
      }

      if (!profileExists) {
        // Create initial profile
        await providersApi.createProfile({
          provider_type: providerType,
          full_name: fullName.trim(),
          phone: phone.trim(),
          location: location.trim(),
          experience_years: Number(experienceYears),
          bio: bio.trim(),
        });
      } else {
        // Update profile
        await providersApi.updateProfile({
          full_name: fullName.trim(),
          phone: phone.trim(),
          location: location.trim(),
          experience_years: Number(experienceYears),
          bio: bio.trim(),
        });
      }

      // 2. Submit generic required fields
      const genericFields = [
        { field_name: currentFieldLabels.f1Name, value: field1.trim() },
      ];
      if (field2.trim()) {
        genericFields.push({ field_name: currentFieldLabels.f2Name, value: field2.trim() });
      }

      await providersApi.updateGenericFields({ fields: genericFields });

      setIsSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit provider onboarding profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-16">
          <LoadingState message="Checking provider onboarding status..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* HEADER */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Provider Professional Onboarding
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
            Complete Your Provider Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
            Before accessing citizen legal service requests, complete your professional profile.
          </p>
        </div>

        {/* PROGRESS BAR BANNER */}
        <Card className="mb-8 p-5 border-slate-800 bg-slate-900/90 shadow-xl">
          <div className="flex items-center justify-between gap-4 mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              Profile Completion Status
            </span>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-xl">
              {completionPct}% Complete
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </Card>

        {isSubmitted ? (
          <Card className="p-8 border-emerald-500/30 bg-slate-900/90 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-100">Profile Submitted Successfully!</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                Your professional profile has been updated and registered. You now have full access to citizen service opportunities.
              </p>
            </div>

            <div className="pt-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/provider/dashboard', { replace: true })}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="px-8"
              >
                Continue to Provider Dashboard
              </Button>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <ErrorState title="Submission Error" message={errorMessage} className="mb-4" />
            )}

            {/* PROFESSION SELECTION */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Select Profession</h2>
                  <p className="text-xs text-slate-400">Specify your primary professional legal designation.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { type: ProviderType.ADVOCATE, label: 'Advocate' },
                  { type: ProviderType.ARBITRATOR, label: 'Arbitrator' },
                  { type: ProviderType.MEDIATOR, label: 'Mediator' },
                  { type: ProviderType.NOTARY, label: 'Notary' },
                  { type: ProviderType.DOCUMENT_WRITER, label: 'Document Writer' },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setProviderType(item.type)}
                    className={`p-3.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      providerType === item.type
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* PROFESSIONAL DETAILS */}
            <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-xl space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Professional Information</h2>
                  <p className="text-xs text-slate-400">Fill required credentials and experience details.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name / Professional Title"
                  type="text"
                  placeholder="e.g. Advocate Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  leftIcon={<UserCheck className="w-4 h-4 text-indigo-400" />}
                />

                <Input
                  label="Phone Number"
                  type="text"
                  placeholder="+91-9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  leftIcon={<Phone className="w-4 h-4 text-sky-400" />}
                />

                <Input
                  label="Location / Primary Jurisdiction"
                  type="text"
                  placeholder="e.g. New Delhi, Mumbai, Bengaluru"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  leftIcon={<MapPin className="w-4 h-4 text-emerald-400" />}
                />

                <Input
                  label="Years of Experience"
                  type="number"
                  min={1}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  required
                  leftIcon={<Clock className="w-4 h-4 text-amber-400" />}
                />
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-800/80">
                <Input
                  label={currentFieldLabels.f1Label}
                  type="text"
                  placeholder={currentFieldLabels.f1Placeholder}
                  value={field1}
                  onChange={(e) => setField1(e.target.value)}
                  required
                  leftIcon={<ShieldCheck className="w-4 h-4 text-indigo-400" />}
                />

                <Input
                  label={currentFieldLabels.f2Label}
                  type="text"
                  placeholder={currentFieldLabels.f2Placeholder}
                  value={field2}
                  onChange={(e) => setField2(e.target.value)}
                  leftIcon={<Briefcase className="w-4 h-4 text-purple-400" />}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" /> Professional Bio & Practice Overview
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    required
                    placeholder="Summarize your court experience, legal specialization, or document drafting expertise..."
                    className="w-full px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 leading-relaxed"
                  />
                </div>
              </div>
            </Card>

            {/* SUBMIT BUTTON */}
            <div className="flex items-center justify-end gap-4 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full sm:w-auto px-8"
                isLoading={isSaving}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Complete & Submit Profile
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
