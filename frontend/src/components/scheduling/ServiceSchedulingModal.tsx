import React, { useEffect, useState } from 'react';
import { Calendar, X, Clock, CheckCircle2, RefreshCw, Plus } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { apiClient } from '../../api/client';
import { Appointment } from '../../types';

interface ServiceSchedulingModalProps {
  requestId: number;
  onClose: () => void;
}

export const ServiceSchedulingModal: React.FC<ServiceSchedulingModalProps> = ({
  requestId,
  onClose,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [slotDate, setSlotDate] = useState<string>('');
  const [slotTime, setSlotTime] = useState<string>('10:00');
  const [purpose, setPurpose] = useState<string>('Initial Representation Consultation');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchAppointments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<Appointment[]>(`/api/requests/${requestId}/appointments`);
      setAppointments(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load appointments for this service request.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [requestId]);

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotDate || !slotTime) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const fullIso = new Date(`${slotDate}T${slotTime}:00`).toISOString();

    try {
      await apiClient.post(`/api/requests/${requestId}/appointments`, {
        slot_datetime: fullIso,
        purpose: purpose.trim() || 'Service Consultation',
      });
      setSuccess('Appointment slot successfully scheduled!');
      setPurpose('Representation Progress Review');
      await fetchAppointments();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <Card className="max-w-lg w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2D3D32] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1C261F] text-[#8EA895] rounded-xl border border-[#2D3D32]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#E6EFE8]">Lightweight Case Scheduling</h2>
              <span className="text-xs text-[#A3B5A7]">Coordinate consultation slots for Request #{requestId}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#A3B5A7] hover:text-[#E6EFE8]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success && (
          <div className="p-3 bg-[#1B3B2B] border border-[#2D5E44] text-[#7ECB98] text-xs rounded-xl font-semibold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="text-[#7ECB98]">✕</button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-[#3D2020] border border-[#5E3232] text-[#E89D9D] text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        {/* SCHEDULE NEW SLOT FORM */}
        <form onSubmit={handleCreateAppointment} className="p-3.5 bg-[#1C261F] border border-[#2D3D32] rounded-xl space-y-3">
          <span className="text-xs font-bold text-[#E6EFE8] uppercase tracking-wider block">
            Schedule New Slot
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-[#A3B5A7] block mb-1">Date</label>
              <input
                type="date"
                required
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#141C16] border border-[#2D3D32] rounded-lg text-xs text-[#E6EFE8] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#A3B5A7] block mb-1">Time</label>
              <input
                type="time"
                required
                value={slotTime}
                onChange={(e) => setSlotTime(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#141C16] border border-[#2D3D32] rounded-lg text-xs text-[#E6EFE8] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#A3B5A7] block mb-1">Purpose / Agenda</label>
            <input
              type="text"
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Case Document Discussion"
              className="w-full px-3 py-1.5 bg-[#141C16] border border-[#2D3D32] rounded-lg text-xs text-[#E6EFE8] placeholder-[#74887A] focus:outline-none focus:ring-2 focus:ring-[#8EA895]/30"
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Book Slot
            </Button>
          </div>
        </form>

        {/* EXISTING APPOINTMENTS LIST */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#A3B5A7] uppercase tracking-wider block">
            Scheduled Appointments ({appointments.length})
          </span>

          {isLoading ? (
            <div className="py-6 text-center text-xs text-[#A3B5A7]">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#8EA895] mb-1" />
              Loading appointments...
            </div>
          ) : appointments.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#A3B5A7] bg-[#1C261F] border border-[#2D3D32] rounded-xl">
              No appointments scheduled yet for this request.
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="p-3 bg-[#1C261F] border border-[#2D3D32] rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-[#E6EFE8] block">{appt.purpose}</span>
                    <span className="text-[11px] text-[#A3B5A7] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#8EA895]" />
                      {new Date(appt.slot_datetime).toLocaleString()}
                    </span>
                  </div>
                  <Badge variant="info">{appt.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-[#2D3D32]">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Scheduling
          </Button>
        </div>
      </Card>
    </div>
  );
};
