import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'react-hot-toast';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Clock, 
  FlaskConical, 
  Package, 
  MessageSquare, 
  Megaphone, 
  User, 
  LogOut,
  Settings,
  UserPlus,
  MapPin
} from 'lucide-react';

const staffLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const adminLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bookings', icon: Calendar, label: 'Bookings' },
  { to: '/staff', icon: Users, label: 'Staff' },
  { to: '/attendance', icon: Clock, label: 'Attendance' },
  { to: '/treatments', icon: FlaskConical, label: 'Treatments' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const developerLinks = [
  ...adminLinks,
  { to: '/users', icon: UserPlus, label: 'Users' },
  { to: '/outlets', icon: MapPin, label: 'Outlets' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  const getLinks = () => {
    if (!user) return staffLinks;
    switch (user.role) {
      case 'DEVELOPER':
        return developerLinks;
      case 'ADMIN':
        return adminLinks;
      default:
        return staffLinks;
    }
  };

  const links = getLinks();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-600">Dayang Spa</h1>
          <p className="text-sm text-gray-500 mt-1">Management System</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  <link.icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-3">
            <p className="font-medium text-sm">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.outletName}</p>
            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded">
              {user?.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}