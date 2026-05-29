'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SITES = ['Noida', 'Detroj', 'Pune', 'Kheda', 'Kolkata', 'Bhubaneswar', 'Dhulagarh', 'Dankuni', 'Mumbai', 'Vavdi', 'Taloja'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, required, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300" />
    </div>
  );
}

export default function NewVendor() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: '', contact_person: '', contact_number: '', email: '',
    gst_number: '', pan: '', msme_number: '', address: '',
    bank_name: '', acc_holder: '', acc_number: '', branch: '', ifsc: '',
    providing_sites: [] as string[],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(field: string, value: any) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function toggleSite(s: string) {
    setForm(p => ({
      ...p,
      providing_sites: p.providing_sites.includes(s)
        ? p.providing_sites.filter(x => x !== s)
        : [...p.providing_sites, s],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) { setError('Company name is required'); return; }
    setSaving(true);
    setError('');
    const res = await fetch('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, created_by: 'Yatish Agarwal' }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); setSaving(false); return; }
    router.push(`/vendors/${encodeURIComponent(data.vendor_id)}`);
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 md:px-7 md:py-3.5 flex items-center justify-between sticky top-0 z-10">
        <Link href="/vendors" className="text-sm text-gray-400 hover:text-gray-600">← Vendors</Link>
        <div className="font-semibold text-gray-800">New Vendor</div>
        <div />
      </div>

      <form onSubmit={submit} className="px-4 py-4 md:px-7 md:py-6 space-y-4 max-w-4xl">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

        <Section title="Company Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" value={form.company_name} onChange={v => set('company_name', v)} required placeholder="As per GST Registration" />
            <Field label="Contact Person" value={form.contact_person} onChange={v => set('contact_person', v)} placeholder="Primary contact name" />
            <Field label="Phone Number" value={form.contact_number} onChange={v => set('contact_number', v)} placeholder="+91 XXXXX XXXXX" />
            <Field label="Email" value={form.email} onChange={v => set('email', v)} type="email" placeholder="vendor@example.com" />
            <Field label="GST Number" value={form.gst_number} onChange={v => set('gst_number', v)} placeholder="15-digit GSTIN" />
            <Field label="PAN" value={form.pan} onChange={v => set('pan', v)} placeholder="ABCDE1234F" />
            <Field label="MSME No. (if applicable)" value={form.msme_number} onChange={v => set('msme_number', v)} placeholder="UDYAM-XX-XX-XXXXXXX" />
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-indigo-300 resize-none"
              placeholder="Full registered address" />
          </div>
        </Section>

        <Section title="Bank Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Bank Name" value={form.bank_name} onChange={v => set('bank_name', v)} placeholder="State Bank of India" />
            <Field label="Account Holder Name" value={form.acc_holder} onChange={v => set('acc_holder', v)} />
            <Field label="Account Number" value={form.acc_number} onChange={v => set('acc_number', v)} />
            <Field label="Branch Name" value={form.branch} onChange={v => set('branch', v)} />
            <Field label="IFSC Code" value={form.ifsc} onChange={v => set('ifsc', v)} placeholder="SBIN0001234" />
          </div>
        </Section>

        <Section title="Sites Served">
          <div className="flex flex-wrap gap-2">
            {SITES.map(s => (
              <button type="button" key={s} onClick={() => toggleSite(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.providing_sites.includes(s) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                {s}
              </button>
            ))}
          </div>
          {form.providing_sites.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">Select all sites this vendor serves</p>
          )}
        </Section>

        <div className="flex justify-end gap-3 pb-6">
          <Link href="/vendors" className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</Link>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Vendor'}
          </button>
        </div>
      </form>
    </div>
  );
}
