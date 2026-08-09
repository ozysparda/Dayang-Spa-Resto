import { useState } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import toast from 'react-hot-toast';

interface SystemSettings {
  id: string;
  outletName: string;
  outletAddress: string;
  outletPhone: string;
  operatingHours: string;
  currency: string;
  timezone: string;
}

export default function SystemSettings() {
  const { data: settingsData, loading, refetch } = useAsyncData<SystemSettings>('/settings');
  const updateSettings = useAsyncMutation();

  const settings = settingsData;
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    outletName: '',
    outletAddress: '',
    outletPhone: '',
    operatingHours: '',
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
  });

  // Update form when settings load
  if (settings && formData.outletName === '') {
    setFormData({
      outletName: settings.outletName || '',
      outletAddress: settings.outletAddress || '',
      outletPhone: settings.outletPhone || '',
      operatingHours: settings.operatingHours || '',
      currency: settings.currency || 'IDR',
      timezone: settings.timezone || 'Asia/Jakarta',
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings('/settings', 'PATCH', formData);
      toast.success('Settings saved successfully');
    } catch (error: any) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">System Settings</h1>

      <div className="max-w-2xl">
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <SettingsIcon className="w-6 h-6 text-gray-400" />
            <h2 className="text-xl font-semibold">General Settings</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outlet Name
              </label>
              <input
                type="text"
                value={formData.outletName}
                onChange={(e) => setFormData({ ...formData, outletName: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outlet Address
              </label>
              <textarea
                value={formData.outletAddress}
                onChange={(e) => setFormData({ ...formData, outletAddress: e.target.value })}
                className="input-field"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outlet Phone
              </label>
              <input
                type="tel"
                value={formData.outletPhone}
                onChange={(e) => setFormData({ ...formData, outletPhone: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Operating Hours
              </label>
              <input
                type="text"
                value={formData.operatingHours}
                onChange={(e) => setFormData({ ...formData, operatingHours: e.target.value })}
                className="input-field"
                placeholder="e.g., 09:00 - 22:00"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="input-field"
                >
                  <option value="IDR">IDR (Rp)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="input-field"
                >
                  <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                  <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                  <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}