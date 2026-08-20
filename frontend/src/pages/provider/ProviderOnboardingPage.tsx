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
  ArrowRight,
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
  Lock,
  AlertCircle,
  Building,
  FileCheck,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { providersApi } from '../../api';
import {
  ProviderType,
  CredentialType,
  AdvocateCaseReference,
  DetailedVerificationStatus,
  ProviderVerificationRecord,
} from '../../types';

export const ProviderOnboardingPage: React.FC = () => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // General Form State
  const [providerType, setProviderType] = useState<ProviderType>(ProviderType.ADVOCATE);
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [experienceYears, setExperienceYears] = useState<number>(3);
  const [bio, setBio] = useState<string>('');

  // Non-Advocate Generic Fields
  const [field1, setField1] = useState<string>('');
  const [field2, setField2] = useState<string>('');

  // Advocate Verification Wizard State (6 Steps)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [stateBarCouncil, setStateBarCouncil] = useState<string>('');
  const [enrollmentNumber, setEnrollmentNumber] = useState<string>('');
  const [enrollmentYear, setEnrollmentYear] = useState<number>(new Date().getFullYear() - 5);
  const [practiceAreas, setPracticeAreas] = useState<string>('');
  const [jurisdictionState, setJurisdictionState] = useState<string>('');

  // Step 3 Credential Evidence
  const [credentialType, setCredentialType] = useState<CredentialType>(CredentialType.BAR_ENROLLMENT_CERTIFICATE);
  const [credentialDocId, setCredentialDocId] = useState<number | undefined>(undefined);
  const [credentialFileName, setCredentialFileName] = useState<string | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);

  // Step 4 Case References
  const [caseReferences, setCaseReferences] = useState<AdvocateCaseReference[]>([]);
  const [newCaseNumber, setNewCaseNumber] = useState<string>('');
  const [newCourtName, setNewCourtName] = useState<string>('');
  const [newCaseType, setNewCaseType] = useState<string>('');
  const [newCaseYear, setNewCaseYear] = useState<number>(new Date().getFullYear() - 2);
  const [newAdvocateRole, setNewAdvocateRole] = useState<string>('Lead Counsel');

  // Verification Record State
  const [verificationRecord, setVerificationRecord] = useState<ProviderVerificationRecord | null>(null);

  useEffect(() => {
    const fetchExistingData = async () => {
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
        }

        // Fetch verification record if advocate
        try {
          const vRecord = await providersApi.getVerificationRecord();
          setVerificationRecord(vRecord);
          if (vRecord.advocate_profile) {
            setStateBarCouncil(vRecord.advocate_profile.state_bar_council || '');
            setEnrollmentNumber(vRecord.advocate_profile.enrollment_number || '');
            setEnrollmentYear(vRecord.advocate_profile.enrollment_year || new Date().getFullYear() - 5);
            setCredentialType(vRecord.advocate_profile.credential_type || CredentialType.BAR_ENROLLMENT_CERTIFICATE);
            setCredentialDocId(vRecord.advocate_profile.credential_document_id);
            setCaseReferences(vRecord.advocate_profile.case_references || []);
          }
          if (vRecord.overall_status === DetailedVerificationStatus.SUBMITTED) {
            setWizardStep(6);
          }
        } catch (vErr) {
          // Verification record does not exist yet
        }
      } catch (err) {
        // Profile does not exist yet (first-time onboarding)
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingData();
  }, []);

  const getFieldLabels = (type: ProviderType) => {
    switch (type) {
      case ProviderType.ARBITRATOR:
        return {
          f1Name: 'empanelment_details',
          f1Label: 'Empanelment / Arbitration Body Certification',
          f1Placeholder: 'e.g. Indian Council of Arbitration (ICA) Reg #4412',
          f2Name: 'specialization',
          f2Label: 'Arbitration Specialization Domain',
          f2Placeholder: 'e.g. Construction & Commercial Contract Tribunal',
        };
      case ProviderType.MEDIATOR:
        return {
          f1Name: 'mediation_accreditation',
          f1Label: 'Mediation Training Accreditation / Certification',
          f1Placeholder: 'e.g. High Court Certified Mediator (40-Hour Training)',
          f2Name: 'panel_membership',
          f2Label: 'Mediation Panel Membership',
          f2Placeholder: 'e.g. District Legal Services Authority Panel',
        };
      case ProviderType.NOTARY:
        return {
          f1Name: 'notary_license',
          f1Label: 'Government Notary Appointment License Number',
          f1Placeholder: 'e.g. Central Govt Notary Reg #8821/2015',
          f2Name: 'jurisdiction_area',
          f2Label: 'Authorized Notarial Jurisdiction',
          f2Placeholder: 'e.g. District Court Premises & Municipal Limits',
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
          f1Name: 'bar_registration',
          f1Label: 'Bar Council Registration Number',
          f1Placeholder: 'e.g. Bar Council Reg No. D/9876/2009',
          f2Name: 'practice_area',
          f2Label: 'Primary Practice Area(s)',
          f2Placeholder: 'e.g. Constitutional, Civil, Commercial Litigation',
        };
    }
  };

  const currentFieldLabels = getFieldLabels(providerType);

  // Compute completion percentage
  const calculateCompletion = () => {
    if (providerType === ProviderType.ADVOCATE) {
      const checks = [
        Boolean(fullName.trim()),
        Boolean(phone.trim()),
        Boolean(location.trim()),
        Boolean(bio.trim()),
        Boolean(stateBarCouncil.trim()),
        Boolean(enrollmentNumber.trim()),
        Boolean(credentialDocId),
      ];
      const filled = checks.filter(Boolean).length;
      return Math.round((filled / checks.length) * 100);
    }
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

  const completionPct = calculateCompletion();

  // Document Upload Handler
  const handleCredentialFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    setErrorMessage(null);
    try {
      const doc = await providersApi.uploadCredentialDocument(file);
      setCredentialDocId(doc.id);
      setCredentialFileName(doc.filename);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to upload credential document.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Add Case Reference Handler
  const handleAddCaseReference = () => {
    if (!newCaseNumber.trim() || !newCourtName.trim()) {
      setErrorMessage('Case Number and Court Name are required to add a case reference.');
      return;
    }
    const newRef: AdvocateCaseReference = {
      case_number: newCaseNumber.trim(),
      court_name: newCourtName.trim(),
      case_type: newCaseType.trim() || undefined,
      case_year: Number(newCaseYear) || undefined,
      advocate_role: newAdvocateRole.trim() || undefined,
    };
    setCaseReferences((prev) => [...prev, newRef]);
    setNewCaseNumber('');
    setNewCourtName('');
    setNewCaseType('');
    setErrorMessage(null);
  };

  const handleRemoveCaseReference = (index: number) => {
    setCaseReferences((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Advocate Verification Wizard
  const handleAdvocateSubmit = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      // 1. Ensure basic profile exists
      let profileExists = false;
      try {
        await providersApi.getMe();
        profileExists = true;
      } catch (err) {
        profileExists = false;
      }

      if (!profileExists) {
        await providersApi.createProfile({
          provider_type: ProviderType.ADVOCATE,
          full_name: fullName.trim(),
          phone: phone.trim(),
          location: location.trim(),
          experience_years: Number(experienceYears),
          bio: bio.trim(),
        });
      } else {
        await providersApi.updateProfile({
          provider_type: ProviderType.ADVOCATE,
          full_name: fullName.trim(),
          phone: phone.trim(),
          location: location.trim(),
          experience_years: Number(experienceYears),
          bio: bio.trim(),
        });
      }

      // 2. Submit advocate verification payload
      const vRecord = await providersApi.submitAdvocateVerification({
        full_legal_name: fullName.trim(),
        jurisdiction_city: location.trim(),
        jurisdiction_state: jurisdictionState.trim() || undefined,
        state_bar_council: stateBarCouncil.trim(),
        enrollment_number: enrollmentNumber.trim(),
        enrollment_year: Number(enrollmentYear),
        credential_type: credentialType,
        credential_document_id: credentialDocId,
        practice_areas: practiceAreas.trim() || undefined,
        case_references: caseReferences,
      });

      setVerificationRecord(vRecord);
      setWizardStep(6);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to submit advocate verification.');
    } finally {
      setIsSaving(false);
    }
  };

  // Non-Advocate Submission
  const handleNonAdvocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      let profileExists = false;
      try {
        await providersApi.getMe();
        profileExists = true;
      } catch (err) {
        profileExists = false;
      }

      if (!profileExists) {
        await providersApi.createProfile({
          provider_type: providerType,
          full_name: fullName.trim(),
          phone: phone.trim(),
          location: location.trim(),
          experience_years: Number(experienceYears),
          bio: bio.trim(),
        });
      } else {
        await providersApi.updateProfile({
          provider_type: providerType,
          full_name: fullName.trim(),
          phone: phone.trim(),
          location: location.trim(),
          experience_years: Number(experienceYears),
          bio: bio.trim(),
        });
      }

      const genericFields = [{ field_name: currentFieldLabels.f1Name, value: field1.trim() }];
      if (field2.trim()) {
        genericFields.push({ field_name: currentFieldLabels.f2Name, value: field2.trim() });
      }
      await providersApi.updateGenericFields({ fields: genericFields });

      navigate('/provider/dashboard', { replace: true });
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to submit provider onboarding profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141C16] flex flex-col text-[#E6EFE8]">
        <Navbar />
        <div className="flex-1 flex items-center justify-center py-16">
          <LoadingState message="Checking provider onboarding status..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141C16] text-[#E6EFE8] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* HEADER */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1C261F] border border-[#2D3D32] text-[#8EA895] text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Provider Professional Onboarding
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#E6EFE8] tracking-tight">
            {providerType === ProviderType.ADVOCATE ? 'Advocate Professional Registration & Verification' : 'Complete Your Provider Profile'}
          </h1>
          <p className="text-xs sm:text-sm text-[#A3B5A7] mt-1.5 leading-relaxed">
            {providerType === ProviderType.ADVOCATE
              ? 'Verify your State Bar Council credentials and legal practice details for platform matching.'
              : 'Before accessing citizen legal service requests, complete your professional profile.'}
          </p>
        </div>

        {/* PROGRESS BAR BANNER */}
        <Card className="mb-8 p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wide">
              Profile Completion Status
            </span>
            <span className="text-xs font-bold text-[#8EA895] bg-[#1C261F] border border-[#2D3D32] px-3 py-1 rounded-xl">
              {completionPct}% Complete
            </span>
          </div>

          <div className="w-full h-2.5 bg-[#1C261F] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8EA895] transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </Card>

        {/* PROFESSION SELECTION CARD */}
        <Card className="p-6 mb-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-[#2D3D32]">
            <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E6EFE8]">Select Profession</h2>
              <p className="text-xs text-[#A3B5A7]">Specify your primary professional legal designation.</p>
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
                onClick={() => {
                  setProviderType(item.type);
                  if (item.type === ProviderType.ADVOCATE && wizardStep === 6 && verificationRecord?.overall_status !== DetailedVerificationStatus.SUBMITTED) {
                    setWizardStep(1);
                  }
                }}
                className={`p-3.5 rounded-xl border text-xs font-bold text-center transition-all ${
                  providerType === item.type
                    ? 'bg-[#1C261F] border-[#8EA895] text-[#E6EFE8] shadow-sm'
                    : 'bg-[#1C261F]/40 border-[#2D3D32] text-[#A3B5A7] hover:border-[#8EA895]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Card>

        {errorMessage && (
          <ErrorState title="Registration Error" message={errorMessage} className="mb-6" />
        )}

        {/* ======================================================================== */}
        {/* ADVOCATE MULTI-STEP VERIFICATION WIZARD                                  */}
        {/* ======================================================================== */}
        {providerType === ProviderType.ADVOCATE ? (
          <div>
            {/* STEP WIZARD INDICATOR */}
            <div className="mb-6 grid grid-cols-5 gap-1.5 text-center">
              {[
                { step: 1, label: 'Identity' },
                { step: 2, label: 'Bar Details' },
                { step: 3, label: 'Credential' },
                { step: 4, label: 'Cases' },
                { step: 5, label: 'Summary' },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`py-2 px-1 rounded-lg border text-[11px] font-semibold transition-all ${
                    wizardStep === s.step
                      ? 'bg-[#1C261F] border-[#8EA895] text-[#8EA895]'
                      : wizardStep > s.step
                      ? 'bg-[#1C261F]/60 border-[#2D3D32] text-[#7ECB98]'
                      : 'bg-[#1C261F]/20 border-[#2D3D32]/50 text-[#74887A]'
                  }`}
                >
                  Step {s.step}: {s.label}
                </div>
              ))}
            </div>

            {/* STEP 1: IDENTITY & PROFILE */}
            {wizardStep === 1 && (
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-[#2D3D32]">
                  <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#E6EFE8]">Step 1 — Identity & Profile</h2>
                    <p className="text-xs text-[#A3B5A7]">Provide your professional contact and identity information.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Legal Name"
                    type="text"
                    placeholder="e.g. Adv. Rajesh Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    leftIcon={<UserCheck className="w-4 h-4 text-[#8EA895]" />}
                  />

                  <Input
                    label="Phone Number"
                    type="text"
                    placeholder="+91-9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    leftIcon={<Phone className="w-4 h-4 text-[#B3A7CF]" />}
                  />

                  <Input
                    label="Primary Jurisdiction / City"
                    type="text"
                    placeholder="e.g. New Delhi, Mumbai, High Court Premises"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                    leftIcon={<MapPin className="w-4 h-4 text-[#8EA895]" />}
                  />

                  <Input
                    label="Years of Active Legal Practice"
                    type="number"
                    min={1}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    required
                    leftIcon={<Clock className="w-4 h-4 text-[#E89D9D]" />}
                  />
                </div>

                <div className="flex flex-col gap-1.5 pt-2 border-t border-[#2D3D32]">
                  <label className="text-xs font-semibold text-[#A3B5A7] uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#8EA895]" /> Professional Bio & Litigation Background
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    required
                    placeholder="Describe your court practice, specialization domains, and litigation record..."
                    className="w-full px-3.5 py-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-[#E6EFE8] placeholder-[#74887A] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 leading-relaxed"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    disabled={!fullName.trim() || !phone.trim() || !location.trim()}
                    onClick={() => setWizardStep(2)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Next: Professional Information
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 2: PROFESSIONAL INFORMATION */}
            {wizardStep === 2 && (
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-[#2D3D32]">
                  <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#E6EFE8]">Step 2 — Professional Information</h2>
                    <p className="text-xs text-[#A3B5A7]">Provide your State Bar Council registration details.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="State Bar Council"
                    type="text"
                    placeholder="e.g. Bar Council of Delhi / Bar Council of Maharashtra"
                    value={stateBarCouncil}
                    onChange={(e) => setStateBarCouncil(e.target.value)}
                    required
                    leftIcon={<Building className="w-4 h-4 text-[#8EA895]" />}
                  />

                  <Input
                    label="Bar Council Enrollment Number"
                    type="text"
                    placeholder="e.g. D/1842/2015"
                    value={enrollmentNumber}
                    onChange={(e) => setEnrollmentNumber(e.target.value)}
                    required
                    leftIcon={<ShieldCheck className="w-4 h-4 text-[#B3A7CF]" />}
                  />

                  <Input
                    label="Enrollment Year"
                    type="number"
                    min={1960}
                    max={new Date().getFullYear()}
                    value={enrollmentYear}
                    onChange={(e) => setEnrollmentYear(Number(e.target.value))}
                    required
                    leftIcon={<Clock className="w-4 h-4 text-[#E89D9D]" />}
                  />

                  <Input
                    label="State Jurisdiction"
                    type="text"
                    placeholder="e.g. Delhi, Maharashtra, Karnataka"
                    value={jurisdictionState}
                    onChange={(e) => setJurisdictionState(e.target.value)}
                    leftIcon={<MapPin className="w-4 h-4 text-[#8EA895]" />}
                  />
                </div>

                <Input
                  label="Primary Practice Areas & Specializations"
                  type="text"
                  placeholder="e.g. Civil Litigation, Constitutional, Criminal Defense, Property Disputes"
                  value={practiceAreas}
                  onChange={(e) => setPracticeAreas(e.target.value)}
                  leftIcon={<Briefcase className="w-4 h-4 text-[#B3A7CF]" />}
                />

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWizardStep(1)}
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!stateBarCouncil.trim() || !enrollmentNumber.trim()}
                    onClick={() => setWizardStep(3)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Next: Upload Credential
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 3: PROFESSIONAL CREDENTIAL EVIDENCE */}
            {wizardStep === 3 && (
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-[#2D3D32]">
                  <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#E6EFE8]">Step 3 — Professional Credential Evidence</h2>
                    <p className="text-xs text-[#A3B5A7]">Upload official proof of enrollment (e.g. Bar Certificate or Bar ID).</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#A3B5A7] uppercase tracking-wide mb-2">
                      Credential Document Type
                    </label>
                    <select
                      value={credentialType}
                      onChange={(e) => setCredentialType(e.target.value as CredentialType)}
                      className="w-full px-3.5 py-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-[#E6EFE8] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30"
                    >
                      <option value={CredentialType.BAR_ENROLLMENT_CERTIFICATE}>Bar Enrollment Certificate</option>
                      <option value={CredentialType.BAR_ID_CARD}>Bar Association ID Card</option>
                      <option value={CredentialType.PROPOSITION_CERTIFICATE}>Proposition / Practice Certificate</option>
                      <option value={CredentialType.OTHER}>Other Official Credential Proof</option>
                    </select>
                  </div>

                  {/* DOCUMENT UPLOAD BOX */}
                  <div className="p-6 border-2 border-dashed border-[#2D3D32] bg-[#1C261F]/40 rounded-xl text-center space-y-3">
                    <div className="w-12 h-12 bg-[#1C261F] border border-[#2D3D32] rounded-full flex items-center justify-center mx-auto text-[#8EA895]">
                      <Upload className="w-6 h-6" />
                    </div>

                    {credentialDocId ? (
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B3B2B] border border-[#2D5E44] text-[#7ECB98] text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" /> Document Attached
                        </div>
                        <p className="text-xs text-[#A3B5A7]">{credentialFileName || `Document ID #${credentialDocId}`}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-[#E6EFE8]">
                          Upload Official Bar Credential File
                        </p>
                        <p className="text-[11px] text-[#74887A] mt-1">
                          Supported formats: PDF, JPG, PNG (Max 10MB). Document will be stored in your private vault.
                        </p>
                      </div>
                    )}

                    <div className="pt-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[#1C261F] hover:bg-[#26342A] border border-[#2D3D32] text-[#E6EFE8] rounded-xl text-xs font-semibold transition-all">
                        <Upload className="w-3.5 h-3.5 text-[#8EA895]" />
                        {isUploadingDoc ? 'Uploading File...' : credentialDocId ? 'Replace Document' : 'Choose File to Upload'}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleCredentialFileUpload}
                          disabled={isUploadingDoc}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* STATUS NOTIFICATION BANNER */}
                  <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-[#8EA895] shrink-0 mt-0.5" />
                    <div className="text-xs text-[#A3B5A7] leading-relaxed">
                      <strong className="text-[#E6EFE8]">Verification Notice:</strong> Uploading your credential moves your profile state to <span className="text-[#8EA895] font-semibold">SUBMITTED / UNDER REVIEW</span>. Verification is completed by an Admin review.
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWizardStep(2)}
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!credentialDocId}
                    onClick={() => setWizardStep(4)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Next: Add Practice Evidence
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 4: PRACTICE VERIFICATION (CASE REFERENCES) */}
            {wizardStep === 4 && (
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-[#2D3D32]">
                  <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#E6EFE8]">Step 4 — Add Practice Evidence (Optional)</h2>
                    <p className="text-xs text-[#A3B5A7]">Provide public case metadata references to verify litigation experience.</p>
                  </div>
                </div>

                {/* CONFIDENTIALITY DISCLAIMER */}
                <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl flex items-start gap-3">
                  <Lock className="w-4 h-4 text-[#8EA895] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#A3B5A7] leading-relaxed">
                    <strong className="text-[#E6EFE8]">Security & Privacy Rule:</strong> Previous case references help LexLogic verify your professional practice. <strong className="text-[#E89D9D]">Do not upload confidential client documents or un-redacted filings.</strong> Store metadata/citation references only.
                  </div>
                </div>

                {/* ADD CASE FORM */}
                <div className="p-4 bg-[#1C261F]/60 border border-[#2D3D32] rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-[#E6EFE8] uppercase tracking-wide">
                    Add New Case Reference
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Case Number / Citation"
                      type="text"
                      placeholder="e.g. W.P.(C) 4412/2021"
                      value={newCaseNumber}
                      onChange={(e) => setNewCaseNumber(e.target.value)}
                    />
                    <Input
                      label="Court / Forum"
                      type="text"
                      placeholder="e.g. High Court of Delhi"
                      value={newCourtName}
                      onChange={(e) => setNewCourtName(e.target.value)}
                    />
                    <Input
                      label="Case Type"
                      type="text"
                      placeholder="e.g. Commercial Appellate"
                      value={newCaseType}
                      onChange={(e) => setNewCaseType(e.target.value)}
                    />
                    <Input
                      label="Case Year"
                      type="number"
                      value={newCaseYear}
                      onChange={(e) => setNewCaseYear(Number(e.target.value))}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2">
                    <div className="flex-1 max-w-xs">
                      <label className="block text-xs font-semibold text-[#A3B5A7] uppercase tracking-wide mb-1">
                        Advocate Role
                      </label>
                      <select
                        value={newAdvocateRole}
                        onChange={(e) => setNewAdvocateRole(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1C261F] border border-[#2D3D32] rounded-lg text-[#E6EFE8] text-xs focus:outline-none"
                      >
                        <option value="Lead Counsel">Lead Counsel</option>
                        <option value="Co-Counsel">Co-Counsel</option>
                        <option value="Sole Advocate">Sole Advocate</option>
                        <option value="Argued Brief">Argued Brief</option>
                      </select>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddCaseReference}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add Reference
                    </Button>
                  </div>
                </div>

                {/* LIST OF ADDED CASE REFERENCES */}
                {caseReferences.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wide">
                      Added Case References ({caseReferences.length})
                    </h3>
                    {caseReferences.map((cRef, idx) => (
                      <div key={idx} className="p-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-[#E6EFE8]">{cRef.case_number} — {cRef.court_name}</p>
                          <p className="text-[11px] text-[#A3B5A7]">
                            {cRef.case_type || 'General'} ({cRef.case_year || 'N/A'}) • {cRef.advocate_role || 'Counsel'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCaseReference(idx)}
                          className="p-1.5 text-[#E89D9D] hover:bg-[#2D3D32] rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWizardStep(3)}
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setWizardStep(5)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Next: Review Summary
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 5: VERIFICATION SUMMARY */}
            {wizardStep === 5 && (
              <Card className="p-6 space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-[#2D3D32]">
                  <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#E6EFE8]">Step 5 — Verification Summary</h2>
                    <p className="text-xs text-[#A3B5A7]">Review your submission before sending for Admin review.</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  {/* IDENTITY SUMMARY */}
                  <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#E6EFE8] uppercase tracking-wide">1. Identity & Profile</span>
                      <span className="px-2 py-0.5 rounded bg-[#1B3B2B] text-[#7ECB98] font-bold text-[10px]">SUBMITTED</span>
                    </div>
                    <p className="text-[#A3B5A7]"><strong>Name:</strong> {fullName}</p>
                    <p className="text-[#A3B5A7]"><strong>Phone:</strong> {phone}</p>
                    <p className="text-[#A3B5A7]"><strong>Location:</strong> {location}</p>
                    <p className="text-[#A3B5A7]"><strong>Experience:</strong> {experienceYears} Years</p>
                  </div>

                  {/* CREDENTIAL SUMMARY */}
                  <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#E6EFE8] uppercase tracking-wide">2. Professional Credential</span>
                      <span className="px-2 py-0.5 rounded bg-[#1B3B2B] text-[#7ECB98] font-bold text-[10px]">SUBMITTED</span>
                    </div>
                    <p className="text-[#A3B5A7]"><strong>Bar Council:</strong> {stateBarCouncil}</p>
                    <p className="text-[#A3B5A7]"><strong>Enrollment Reg #:</strong> {enrollmentNumber} ({enrollmentYear})</p>
                    <p className="text-[#A3B5A7]"><strong>Credential Document ID:</strong> #{credentialDocId}</p>
                  </div>

                  {/* PRACTICE EVIDENCE SUMMARY */}
                  <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#E6EFE8] uppercase tracking-wide">3. Practice Evidence</span>
                      <span className="px-2 py-0.5 rounded bg-[#1C261F] border border-[#2D3D32] text-[#8EA895] font-bold text-[10px]">
                        {caseReferences.length > 0 ? 'SUBMITTED' : 'NOT PROVIDED (OPTIONAL)'}
                      </span>
                    </div>
                    <p className="text-[#A3B5A7]"><strong>Total Case References:</strong> {caseReferences.length}</p>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWizardStep(4)}
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    isLoading={isSaving}
                    onClick={handleAdvocateSubmit}
                    rightIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Submit Advocate Verification
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 6: SUBMISSION COMPLETE SCREEN */}
            {wizardStep === 6 && (
              <Card className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-[#1B3B2B] border border-[#2D5E44] text-[#7ECB98] rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <h2 className="text-xl font-extrabold text-[#E6EFE8]">Verification Submitted!</h2>
                  <p className="text-xs sm:text-sm text-[#A3B5A7] mt-2 max-w-md mx-auto leading-relaxed">
                    Your professional Bar credentials and practice details are currently being reviewed by platform administrators.
                  </p>
                </div>

                {/* STATUS BADGE BOX */}
                <div className="p-4 bg-[#1C261F] border border-[#2D3D32] rounded-xl max-w-md mx-auto text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#A3B5A7] font-semibold">Verification Record Status:</span>
                    <span className="px-2.5 py-1 rounded-full bg-[#1C261F] border border-[#8EA895] text-[#8EA895] text-xs font-extrabold uppercase">
                      SUBMITTED / UNDER REVIEW
                    </span>
                  </div>
                  <p className="text-[11px] text-[#74887A] leading-relaxed">
                    You can view your dashboard metrics and profile details while under review. Verified advocate status will unlock upon Admin approval.
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
            )}
          </div>
        ) : (
          /* ======================================================================== */
          /* NON-ADVOCATE PROVIDER ONBOARDING FORM                                    */
          /* ======================================================================== */
          <form onSubmit={handleNonAdvocateSubmit} className="space-y-6">
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-[#2D3D32]">
                <div className="p-2 bg-[#1C261F] text-[#8EA895] border border-[#2D3D32] rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#E6EFE8]">Professional Details</h2>
                  <p className="text-xs text-[#A3B5A7]">Fill required credentials and experience details.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name / Professional Title"
                  type="text"
                  placeholder="e.g. Mediator Kapoor"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  leftIcon={<UserCheck className="w-4 h-4 text-[#8EA895]" />}
                />

                <Input
                  label="Phone Number"
                  type="text"
                  placeholder="+91-9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  leftIcon={<Phone className="w-4 h-4 text-[#B3A7CF]" />}
                />

                <Input
                  label="Location / Primary Jurisdiction"
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
                  min={1}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  required
                  leftIcon={<Clock className="w-4 h-4 text-[#E89D9D]" />}
                />
              </div>

              <div className="space-y-4 pt-2 border-t border-[#2D3D32]">
                <Input
                  label={currentFieldLabels.f1Label}
                  type="text"
                  placeholder={currentFieldLabels.f1Placeholder}
                  value={field1}
                  onChange={(e) => setField1(e.target.value)}
                  required
                  leftIcon={<ShieldCheck className="w-4 h-4 text-[#8EA895]" />}
                />

                <Input
                  label={currentFieldLabels.f2Label}
                  type="text"
                  placeholder={currentFieldLabels.f2Placeholder}
                  value={field2}
                  onChange={(e) => setField2(e.target.value)}
                  leftIcon={<Briefcase className="w-4 h-4 text-[#B3A7CF]" />}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#A3B5A7] uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#8EA895]" /> Professional Bio & Practice Overview
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    required
                    placeholder="Summarize your experience, specializations, or document drafting expertise..."
                    className="w-full px-3.5 py-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl text-[#E6EFE8] placeholder-[#74887A] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30 leading-relaxed"
                  />
                </div>
              </div>
            </Card>

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
