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
      if (data.generic_fields) {
        const pa = data.generic_fields.find((f: any) => f.field_name === 'practice_area' || f.field_name === 'practice_areas')?.value || '';
        const reg = data.generic_fields.find((f: any) => f.field_name === 'bar_registration' || f.field_name === 'registration_number')?.value || '';
        setPracticeArea(pa);
        setRegistrationDetails(reg);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load profile.');
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
      const updated = await providersApi.updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        location: location.trim(),
        experience_years: Number(experienceYears),
        bio: bio.trim(),
      });

      if (practiceArea.trim() || registrationDetails.trim()) {
        const fields = [];
        if (practiceArea.trim()) fields.push({ field_name: 'practice_area', value: practiceArea.trim() });
        if (registrationDetails.trim()) fields.push({ field_name: 'bar_registration', value: registrationDetails.trim() });
        await providersApi.updateGenericFields({ fields });
      }

      setProfile(updated);
      setSuccessMessage('Profile saved successfully! Points awarded for complete setup.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link
          to="/provider/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-[#8EA895] hover:text-[#A2BCA9] font-semibold mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Provider Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EFE8] tracking-tight">
              Edit Provider Profile
            </h1>
            <p className="text-xs sm:text-sm text-[#A3B5A7] mt-1">
              Maintain accurate practice details and earn points upon complete profile setup.
            </p>
          </div>

          {profile && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#A3B5A7]">Profile Completion:</span>
              <span className="text-sm font-bold text-[#8EA895] bg-[#1C261F] border border-[#2D3D32] px-3 py-1 rounded-xl">
                {profile.profile_completion_percentage}%
              </span>
            </div>
          )}
        </div>

        {/* INCENTIVE CALLOUT BANNER */}
        <div className="mb-6 p-4 bg-[#1C261F] border border-[#2D3D32] rounded-2xl flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#233027] text-[#8EA895] rounded-xl border border-[#2D3D32]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#E6EFE8]">Complete profile → earn points</span>
              <p className="text-xs text-[#A3B5A7] mt-0.5">
                Complete all profile attributes to reach 100% completion and earn +50 incentive points.
              </p>
            </div>
          </div>

          {profile?.is_profile_complete && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7ECB98] bg-[#1B3B2B] border border-[#2D5E44] px-3 py-1 rounded-xl shrink-0">
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
          <div className="mb-6 p-4 bg-[#1B3B2B] border border-[#2D5E44] text-[#7ECB98] text-xs rounded-xl flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {!isLoading && profile && (
          <form onSubmit={handleSaveProfile} className="space-y-8">
            {/* BASE PROFILE FIELDS */}
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-[#2D3D32]">
                <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#E6EFE8]">Base Profile Details</h2>
                  <p className="text-xs text-[#A3B5A7]">Core personal and professional practice details.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="Full Name / Display Name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  leftIcon={<UserCheck className="w-4 h-4 text-[#8EA895]" />}
                />

                <Input
                  label="Contact Phone Number"
                  type="text"
                  placeholder="+91-9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4 text-[#B3A7CF]" />}
                />

                <Input
                  label="Location / Primary City Jurisdiction"
                  type="text"
                  placeholder="e.g. New Delhi, Mumbai, Bengaluru"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                  leftIcon={<MapPin className="w-4 h-4 text-[#8EA895]" />}
                />

                <Input
                  label="Years of Experience"
                  type="number"
                  min={0}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  required
                  leftIcon={<Clock className="w-4 h-4 text-[#E89D9D]" />}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#A3B5A7] uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#8EA895]" /> Professional Biography / Summary
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Summarize your legal qualifications, court experience, or document drafting expertise..."
                  className="w-full px-3.5 py-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-[#E6EFE8] placeholder-[#74887A] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 leading-relaxed"
                />
              </div>
            </Card>

            {/* DYNAMIC GENERIC FIELDS (BAR REGISTRATION / PRACTICE AREAS) */}
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-[#2D3D32]">
                <div className="p-2 bg-[#1C261F] text-[#B3A7CF] border border-[#2D3D32] rounded-lg">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#E6EFE8]">
                    Registration & Practice Area Specifications
                  </h2>
                  <p className="text-xs text-[#A3B5A7]">
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
                  leftIcon={<Briefcase className="w-4 h-4 text-[#B3A7CF]" />}
                  helperText="List your primary areas of practice separated by commas."
                />

                <Input
                  label="Bar Council / License Registration Details"
                  type="text"
                  placeholder="e.g. Bar Council Reg No. D/9876/2009 or License ID"
                  value={registrationDetails}
                  onChange={(e) => setRegistrationDetails(e.target.value)}
                  leftIcon={<ShieldCheck className="w-4 h-4 text-[#8EA895]" />}
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
