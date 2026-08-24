import { useState, useEffect } from 'react';
import { User, Mail, Phone, Lock } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import { useLang } from '../stores/languageStore';
import toast from 'react-hot-toast';

interface UserProfile {
  id: string;
  staffId: string;
  username: string;
  name: string;
  role: string;
  outletId: string;
  outletName: string;
  email: string;
  phone: string;
}

export default function Profile() {
  const { data: profileData, loading, error, refetch } = useAsyncData<UserProfile>('/auth/me');
  const changePassword = useAsyncMutation();
  const { t } = useLang();
  const profile = profileData;

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Refetch profile when page loads
  useEffect(() => {
    refetch();
  }, [refetch]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('profile.pwMismatch'));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error(t('profile.pwTooShort'));
      return;
    }

    try {
      await changePassword('/auth/password', 'PATCH', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setShowPasswordModal(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast.success(t('profile.pwChanged'));
      // Refetch profile to update any cached data
      refetch();
    } catch (error: any) {
      const message = error.response?.data?.message || t('profile.pwFailed');
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">{t('profile.loadingProfile')}</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8">
        <div className="text-center text-red-600">
          <p className="mb-4">{t('profile.loadFailed')}</p>
          <p className="text-sm text-gray-500 mb-4">{error || t('profile.retry')}</p>
          <button onClick={refetch} className="btn-primary">
            {t('profile.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('profile.title')}</h1>

      <div className="max-w-2xl">
        {/* Profile Information */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">{t('profile.info')}</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">{t('profile.name')}</p>
                <p className="font-medium text-gray-900">{profile.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">{t('profile.email')}</p>
                <p className="font-medium text-gray-900">{profile.email || t('profile.notSet')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">{t('profile.phone')}</p>
                <p className="font-medium text-gray-900">{profile.phone || t('profile.notSet')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Username</p>
                <p className="font-medium text-gray-900">{profile.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">{t('profile.role')}</p>
                <p className="font-medium text-gray-900">{profile.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">{t('profile.outlet')}</p>
                <p className="font-medium text-gray-900">{profile.outletName || t('profile.notAssigned')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">{t('profile.changePassword')}</h2>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="btn-primary"
          >
            {t('profile.changePassword')}
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">{t('profile.changePassword')}</h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.currentPassword')}
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.newPassword')}
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('profile.confirmNewPassword')}
                </label>
                <input
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {t('profile.changePassword')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="btn-secondary flex-1"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}