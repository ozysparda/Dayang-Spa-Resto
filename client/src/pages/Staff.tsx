import { useState } from 'react';
import { Plus, Search, UserX } from 'lucide-react';
import { useAsyncData, useAsyncMutation } from '../hooks/useAsyncData';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  username: string;
  role: string;
  status: string;
  outletName: string;
  isActive: boolean;
  userId?: string;
}

export default function Staff() {
  const { user } = useAuthStore();
  const { data: staffData, loading, refetch } = useAsyncData<Staff[]>('/staff');
  const createStaff = useAsyncMutation();
  const updateStatus = useAsyncMutation();
  const deactivateStaff = useAsyncMutation();

  const staff = staffData || [];
  const currentUserId = user?.id;
  const isAdmin = ['ADMIN', 'DEVELOPER'].includes(user?.role || '');

  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    gender: 'Unspecified',
    role: 'STAFF',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      username: '',
      password: '',
      gender: 'Unspecified',
      role: 'STAFF',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStaff('/staff', 'POST', formData);
      setShowModal(false);
      refetch();
      resetForm();
      toast.success('Staff added successfully');
    } catch (error: any) {
      console.error('Failed to create staff:', error);
      toast.error('Failed to create staff');
    }
  };

  const handleStatusChange = async (staffMember: Staff, newStatus: string) => {
    try {
      // Phase 2: Staff can only change their own status, Admin can change any
      if (!isAdmin && staffMember.userId !== currentUserId) {
        toast.error('You can only change your own status');
        return;
      }

      // Use admin endpoint for admin, personal endpoint for staff
      const endpoint = isAdmin ? `/staff/${staffMember.id}/status` : '/staff/my-status';
      await updateStatus(endpoint, 'PATCH', { status: newStatus });
      refetch();
      toast.success('Status updated');
    } catch (error: any) {
      console.error('Failed to update status:', error);
      const message = error.response?.data?.message || 'Failed to update status';
      toast.error(message);
    }
  };

  const handleDeactivate = async (staffId: string) => {
    if (!confirm('Are you sure you want to deactivate this staff member?')) return;
    try {
      await deactivateStaff(`/staff/${staffId}`, 'DELETE');
      refetch();
      toast.success('Staff deactivated');
    } catch (error: any) {
      console.error('Failed to deactivate staff:', error);
      toast.error('Failed to deactivate staff');
    }
  };

    const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      username: '',
      password: '',
      gender: 'Unspecified',
      role: 'STAFF',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FREE':
        return 'bg-green-100 text-green-800';
      case 'IN_TREATMENT':
        return 'bg-blue-100 text-blue-800';
      case 'ON_BREAK':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_CHARGE':
        return 'bg-purple-100 text-purple-800';
      case 'OFF':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.username.toLowerCase().includes(searchTerm.toLowerCase())
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
        <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Staff
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Staff Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                              <th>Name</th>
                <th>Gender</th>
                <th>Username</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Outlet</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No staff found
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => (
                                    <tr key={member.id}>
                    <td className="font-medium">{member.name}</td>
                    <td>{member.gender || 'Unspecified'}</td>
                    <td>{member.username}</td>
                    <td>{member.email}</td>
                    <td>{member.phone}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                        {member.role}
                      </span>
                    </td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(member.status)}`}>
                        {member.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{member.outletName}</td>
                    <td>
                      <div className="flex gap-2">
                        {isAdmin ? (
                          <select
                            value={member.status}
                            onChange={(e) => handleStatusChange(member, e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="FREE">FREE</option>
                            <option value="IN_CHARGE">IN CHARGE</option>
                            <option value="IN_TREATMENT">IN TREATMENT</option>
                            <option value="ON_BREAK">ON BREAK</option>
                            <option value="OFF">OFF</option>
                          </select>
                        ) : member.userId === currentUserId ? (
                          <select
                            value={member.status}
                            onChange={(e) => handleStatusChange(member, e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="FREE">FREE</option>
                            <option value="IN_CHARGE">IN CHARGE</option>
                            <option value="IN_TREATMENT">IN TREATMENT</option>
                            <option value="ON_BREAK">ON BREAK</option>
                            <option value="OFF">OFF</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                        <button
                          onClick={() => handleDeactivate(member.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Deactivate"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Add New Staff</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                />
              </div>

                             <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Phone
                 </label>
                 <input
                   type="tel"
                   value={formData.phone}
                   onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                   className="input-field"
                 />
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Gender
                 </label>
                 <select
                   value={formData.gender}
                   onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                   className="input-field"
                 >
                   <option value="Male">Male</option>
                   <option value="Female">Female</option>
                   <option value="Other">Other</option>
                   <option value="Unspecified">Unspecified</option>
                 </select>
               </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
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
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                  <option value="CASHIER">Cashier</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Add Staff
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