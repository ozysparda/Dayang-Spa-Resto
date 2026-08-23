import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useLang } from '../stores/languageStore';
import LanguageSwitcher from '../components/LanguageSwitcher';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function Login() {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const { t } = useLang();
  const navigate = useNavigate();
  const { ensurePermission, subscribe } = usePushNotifications();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { staffId, password });
      const { user, token } = response.data;
      login(user, token);
      toast.success(t('login.success'));

      const vapidResponse = await api.get('/push/vapid-public-key').catch(() => null);
      if (vapidResponse?.data?.publicKey) {
        await ensurePermission();
        subscribe(vapidResponse.data.publicKey);
      }

      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('login.title')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('login.subtitle')}
          </p>
          <div className="mt-2 flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>
        <form className="mt-8 space-y-6 card" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="staffId" className="label">
                {t('login.staffId')}
              </label>
              <input
                id="staffId"
                name="staffId"
                type="text"
                required
                className="input"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                {t('login.password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary"
          >
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}