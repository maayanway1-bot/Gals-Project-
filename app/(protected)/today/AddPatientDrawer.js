"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddPatientDrawer({ open, onClose, defaultData }) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState({
        full_name: defaultData?.name || "",
        phone: "",
        email: defaultData?.email || "",
        date_of_birth: "",
        chief_complaint: "",
    });

    // Re-sync form state when defaultData changes (i.e. drawer opens for someone else)
    useEffect(() => {
        if (open) {
            setForm({
                full_name: defaultData?.name || "",
                phone: "",
                email: defaultData?.email || "",
                date_of_birth: "",
                chief_complaint: "",
            });
            setErrors({});
            setSubmitting(false);
        }
    }, [open, defaultData]);

    const update = (field) => (e) => {
        setForm((f) => ({ ...f, [field]: e.target.value }));
        setErrors((e) => ({ ...e, [field]: undefined }));
    };

    const validate = () => {
        const errs = {};
        if (!form.full_name.trim()) errs.full_name = "Name is required";
        if (!form.phone.trim()) errs.phone = "Phone is required";
        if (!form.email.trim()) errs.email = "Email is required";
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        setSubmitting(true);
        const supabase = createClient();
        const payload = {
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            date_of_birth: form.date_of_birth || null,
            chief_complaint: form.chief_complaint.trim() || null,
        };

        const { data: patient, error } = await supabase
            .from("patients")
            .insert(payload)
            .select("id")
            .single();

        if (error) {
            setSubmitting(false);
            setErrors({ form: error.message });
            return;
        }

        onClose();
        router.push(`/patients/${patient.id}/sessions/new`);
    };

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 shadow-xl transition-transform transform translate-x-0 overflow-y-auto">
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
                        <h2 className="text-lg font-semibold text-white">Add New Patient</h2>
                        <button
                            onClick={onClose}
                            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 space-y-4 p-4">
                        {errors.form && (
                            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                                {errors.form}
                            </div>
                        )}

                        {/* Full Name */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-300">
                                Full Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.full_name}
                                onChange={update("full_name")}
                                dir="auto"
                                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:bg-slate-900 focus:outline-none"
                                placeholder="Patient name"
                            />
                            {errors.full_name && (
                                <p className="mt-1 text-sm text-red-400">{errors.full_name}</p>
                            )}
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-300">
                                Phone <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={update("phone")}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:bg-slate-900 focus:outline-none"
                                placeholder="050-000-0000"
                            />
                            {errors.phone && (
                                <p className="mt-1 text-sm text-red-400">{errors.phone}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-300">
                                Email <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={update("email")}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:bg-slate-900 focus:outline-none"
                                placeholder="patient@email.com"
                            />
                            {errors.email && (
                                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                            )}
                        </div>

                        {/* Date of Birth */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-300">
                                Date of Birth
                            </label>
                            <input
                                type="date"
                                value={form.date_of_birth}
                                onChange={update("date_of_birth")}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-white focus:border-primary focus:bg-slate-900 focus:outline-none"
                            />
                        </div>

                        {/* Chief Complaint */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-300">
                                Chief Complaint
                            </label>
                            <textarea
                                value={form.chief_complaint}
                                onChange={update("chief_complaint")}
                                dir="auto"
                                rows={3}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:bg-slate-900 focus:outline-none resize-none"
                                placeholder="Primary reason for visit..."
                            />
                        </div>

                        {/* Spacer */}
                        <div className="h-6"></div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
                        >
                            {submitting ? "Saving..." : "Save Patient & Create Note"}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
