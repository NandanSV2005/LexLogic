import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserCheck,
  ShieldCheck,
  Save,
  ArrowLeft,
  Briefcase,
  MapPin,
  Phone,
  Clock,
  FileText,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { providersApi } from '../../api';
import { Provider } from '../../types';

export const ProviderProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [experienceYears, setExperienceYears] = useState<number>(0);
  const [bio, setBio] = useState<string>('');

  // Generic Dynamic Fields
  const [practiceArea, setPracticeArea] = useState<string>('');
  const [registrationDetails, setRegistrationDetails] = useState<string>('');

  const fetchProfile = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await providersApi.getMe();
      setProfile(data);

      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setLocation(data.location || '');
      setExperienceYears(data.experience_years || 0);
      setBio(data.bio || '');

      // Extract generic field values
      if (data.field_values) {
        const paField = data.field_values.find((f) => f.field_name === 'practice_area');
        if (paField) setPracticeArea(paField.value || '');

        const regField = data.field_values.find((f) => f.field_name === 'registration_details');
        if (regField) setRegistrationDetails(regField.value || '');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load provider profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Update base profile fields
      const updatedProfile = await providersApi.updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        location: location.trim(),
        experience_years: Number(experienceYears),
        bio: bio.trim(),
      });

      // 2. Update generic fields if present
      const genericFieldsList = [
        { field_name: 'practice_area', value: practiceArea.trim() },
        { field_name: 'registration_details', value: registrationDetails.trim() },
      ];
      const finalProfile = await providersApi.updateGenericFields({
        fields: genericFieldsList,
      });

      setProfile(finalProfile);
      setSuccessMessage(
        `Profile updated successfully! Profile completion is now ${finalProfile.profile_completion_percentage}%.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update provider profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8F0E6] text-[#29352D] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/provider/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-[#7C9A82] hover:text-[#6B8870] font-semibold mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Provider Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#29352D] tracking-tight">
              Edit Provider Profile
            </h1>
            <p className="text-xs sm:text-sm text-[#617066] mt-1">
              Maintain accurate practice details and earn points upon complete profile setup.
            </p>
          </div>

          {profile && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#617066]">Profile Completion:</span>
              <span className="text-sm font-bold text-[#7C9A82] bg-[#DDE8DC] border border-[#C8D7C7] px-3 py-1 rounded-xl">
                {profile.profile_completion_percentage}%
              </span>
            </div>
          )}
        </div>

        {/* INCENTIVE CALLOUT BANNER */}
        <div className="mb-6 p-4 bg-[#DDE8DC] border border-[#C8D7C7] rounded-2xl flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F0F4EC] text-[#7C9A82] rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#29352D]">Complete profile → earn points</span>
              <p className="text-xs text-[#617066] mt-0.5">
                Complete all profile attributes to reach 100% completion and earn +50 incentive points.
              </p>
            </div>
          </div>

          {profile?.is_profile_complete && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4724] bg-[#D4E5D4] border border-[#B2D4B2] px-3 py-1 rounded-xl shrink-0">
              <CheckCircle2 className="w-4 h-4" /> Profile 100% Complete
            </span>
          )}
        </div>

        {isLoading && (
          <div className="py-16">
            <LoadingState message="Loading your provider profile..." />
          </div>
        )}

        {errorMessage && !isLoading && (
          <ErrorState
            title="Profile Loading Error"
            message={errorMessage}
            onRetry={fetchProfile}
            className="mb-6"
          />
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-[#D4E5D4] border border-[#B2D4B2] text-[#1F4724] text-xs rounded-xl flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {!isLoading && profile && (
          <form onSubmit={handleSaveProfile} className="space-y-8">
            {/* BASE PROFILE FIELDS */}
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-[#C8D7C7]">
                <div className="p-2 bg-[#DDE8DC] text-[#7C9A82] border border-[#C8D7C7] rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#29352D]">Base Profile Details</h2>
                  <p className="text-xs text-[#617066]">Core personal and professional practice details.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="Full Name / Display Name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  leftIcon={<UserCheck className="w-4 h-4 text-[#7C9A82]" />}
                />

                <Input
                  label="Contact Phone Number"
                  type="text"
                  placeholder="+91-9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4 text-[#9A8FB5]" />}
                />

                <Input
                  label="Location / Primary City Jurisdiction"
                  type="text"
                  placeholder="e.g. New Delhi, Mumbai, Bengaluru"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  leftIcon={<MapPin className="w-4 h-4 text-[#7C9A82]" />}
                />

                <Input
                  label="Years of Experience"
                  type="number"
                  min={0}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  required
                  leftIcon={<Clock className="w-4 h-4 text-[#D6A89A]" />}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#29352D] uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#7C9A82]" /> Professional Biography / Summary
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Summarize your legal qualifications, court experience, or document drafting expertise..."
                  className="w-full px-3.5 py-3 bg-[#FAFCF9] border border-[#C8D7C7] rounded-xl text-[#29352D] placeholder-[#8C9B90] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7C9A82]/30 leading-relaxed"
                />
              </div>
            </Card>

            {/* DYNAMIC GENERIC FIELDS (BAR REGISTRATION / PRACTICE AREAS) */}
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-[#C8D7C7]">
                <div className="p-2 bg-[#DDE8DC] text-[#9A8FB5] border border-[#C8D7C7] rounded-lg">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#29352D]">
                    Registration & Practice Area Specifications
                  </h2>
                  <p className="text-xs text-[#617066]">
                    Provider-type specific attributes evaluated by LexLogic matching engine.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  label="Practice Area(s) / Legal Expertise"
                  type="text"
                  placeholder="e.g. Constitutional & Commercial Property Litigation, Real Estate"
                  value={practiceArea}
                  onChange={(e) => setPracticeArea(e.target.value)}
                  leftIcon={<Briefcase className="w-4 h-4 text-[#9A8FB5]" />}
                  helperText="List your primary areas of practice separated by commas."
                />

                <Input
                  label="Bar Council / License Registration Details"
                  type="text"
                  placeholder="e.g. Bar Council Reg No. D/9876/2009 or License ID"
                  value={registrationDetails}
                  onChange={(e) => setRegistrationDetails(e.target.value)}
                  leftIcon={<ShieldCheck className="w-4 h-4 text-[#7C9A82]" />}
                  helperText="Official license or bar council registration number used for admin verification."
                />
              </div>
            </Card>

            {/* SUBMIT BUTTON */}
            <div className="flex items-center justify-end gap-4 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="px-8"
                isLoading={isSaving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Profile Changes
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
