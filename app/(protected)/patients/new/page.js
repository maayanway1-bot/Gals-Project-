"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function NewPatientForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    full_name: searchParams.get("name") || "",
    phone: "",
    email: searchParams.get("email") || "",
    date_of_birth: "",
    chief_complaint: "",
  });

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

    const { data, error } = await supabase
      .from("patients")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      setSubmitting(false);
      setErrors({ form: error.message });
      return;
    }

    router.push(`/patients/${data.id}`);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-white">New Patient</h2>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
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
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
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
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
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
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white focus:border-primary focus:outline-none"
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
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none resize-none"
            placeholder="Primary reason for visit..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Patient"}
        </button>
      </form>
    </div>
  );
}

export default function NewPatientPage() {
  return (
    <Suspense fallback={<div className="p-4 text-slate-500">Loading...</div>}>
      <NewPatientForm />
    </Suspense>
  );
}
