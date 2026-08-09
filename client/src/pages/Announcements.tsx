import { useState, useEffect } from 'react';
import { Plus, Bell, Check } from 'lucide-react';
import api from '../services/api';

interface Announcement {
  id: string;
  title: string;
  content: string;
  creatorName: string;
  isRead: boolean;
  createdAt: string;
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetOutletId: '',
    targetRole: '',
  });

  useEffect(() => {
    fetchAnnouncements();
    checkUserRole();
  }, []);

  const checkUserRole = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setIsAdmin(['ADMIN', 'DEVELOPER'].includes(user.role));
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/announcements', formData);
      setShowModal(false);
      fetchAnnouncements();
      resetForm();
    } catch (error) {
      console.error('Failed to create announcement:', error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.post(`/announcements/${id}/read`);
      fetchAnnouncements();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      targetOutletId: '',
      targetRole: '',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Announcement
          </button>
        )}
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            No announcements yet
          </div>
        ) : (
          announcements.map((announcement) => (
            <div
              key={announcement.id}
              className={`card ${!announcement.isRead ? 'border-l-4 border-l-blue-600' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
                    {!announcement.isRead && (
                      <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1">New</span>
                    )}
                  </div>
                  <p className="text-gray-700 mb-3 whitespace-pre-wrap">{announcement.content}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>By {announcement.creatorName}</span>
                    <span>{formatDate(announcement.createdAt)}</span>
                  </div>
                </div>
                {!announcement.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(announcement.id)}
                    className="ml-4 text-blue-600 hover:text-blue-800"
                    title="Mark as read"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Announcement Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-4">New Announcement</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="input-field"
                  rows={6}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Post Announcement
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}