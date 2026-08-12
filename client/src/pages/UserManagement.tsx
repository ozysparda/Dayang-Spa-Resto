import { useState } from 'react';
import { Plus, Search, UserX, UserCheck, Pencil, KeyRound } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

interface User {
  id: string;
  staffId: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuthStore();
  const { data: usersData, loading, refetch } = useAsyncData<User[]>('/users');
  const createUser = useAsyncMutation();
  const updateUser = useAsyncMutation();

  const users = usersData || [];

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    staffId: '',
    username: '',
    password: '',
    role: 'STAFF',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Validate password length for add mode
    if (modalMode === 'add' && formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      setSaving(false);
      return;
    }

    try {
      if (modalMode === 'add') {
        await createUser('/users', 'POST', {
          staffId: formData.staffId.trim(),
          username: formData.username.trim(),
          password: formData.password,
          role: formData.role,
        });
        toast.success('User created successfully');
      } else {
        if (!editingUser) return;
        const payload: any = {
          staffId: formData.staffId.trim(),
          username: formData.username.trim(),
          role: formData.role,
        };
        // Only send password if the developer wants to reset it
        if (formData.password) {
          payload.password = formData.password;
        }
        await updateUser(`/users/${editingUser.id}`, 'PATCH', payload);
        toast.success('User updated successfully');
      }
      setShowModal(false);
      refetch();
      resetForm();
    } catch (error) {
      // Toast already shown by useAsyncMutation
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (id === currentUser?.id) {
      toast.error('You cannot deactivate your own account');
      return;
    }
    const user = users.find(u => u.id === id);
    if (!confirm(`Are you sure you want to deactivate ${user?.username || 'this user'}? They will no longer be able to log in.`)) return;
    try {
      await updateUser(`/users/${id}`, 'DELETE');
      refetch();
      toast.success('User deactivated successfully');
    } catch (error) {
      // Toast already shown by useAsyncMutation
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await updateUser(`/users/${id}`, 'PATCH', { isActive: true });
      refetch();
      toast.success('User activated successfully');
    } catch (error) {
      // Toast already shown by useAsyncMutation
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setEditingUser(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setModalMode('edit');
    setEditingUser(user);
    setFormData({
      staffId: user.staffId || '',
      username: user.username,
      password: '',
      role: user.role,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      staffId: '',
      username: '',
      password: '',
      role: 'STAFF',
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'DEVELOPER':
        return 'bg-red-100 text-red-800';
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'STAFF':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={openAddModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="font-mono text-sm">{user.staffId || '\u2014'}</td>
                    <td className="font-medium">
                      {user.username}
                      {user.id === currentUser?.id && (
                        <span className="ml-2 text-xs text-gray-400">(you)</span>
                      )}
                    </td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit / Reset password"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {user.isActive ? (
                          <button
                            onClick={() => handleDeactivate(user.id)}
                            className="text-red-600 hover:text-red-800 disabled:opacity-30"
                            title="Deactivate"
                            disabled={user.id === currentUser?.id}
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(user.id)}
                            className="text-green-600 hover:text-green-800"
                            title="Activate"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-1">
              {modalMode === 'add' ? 'Add New User' : 'Edit User'}
            </h2>
            {modalMode === 'add' ? (
              <p className="text-sm text-gray-500 mb-4">
                Create a login account for a user. They will sign in with the Staff ID.
              </p>
            ) : (
              <p className="text-sm text-gray-500 mb-4">
                Editing {editingUser?.username}. Leave password blank to keep the current one.
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Staff ID <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs text-gray-400">(login credential)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  placeholder="e.g. DAY001"
                  className="input-field font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {modalMode === 'add' ? (
                    <>Password <span className="text-red-500">*</span></>
                  ) : (
                    <span className="flex items-center gap-1">
                      <KeyRound className="w-4 h-4" /> Reset Password (optional)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  required={modalMode === 'add'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={modalMode === 'add' ? 'At least 6 characters' : 'Leave blank to keep current password'}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input-field"
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                  <option value="DEVELOPER">Developer</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : (modalMode === 'add' ? 'Add User' : 'Save Changes')}
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