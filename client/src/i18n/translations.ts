export type Lang = 'en' | 'id';

export interface Vars {
  [key: string]: string | number;
}

/**
 * Translation dictionaries. `en` keys are the canonical source; `id` holds the
 * Indonesian (bahasa Indonesia) translations. Unknown keys fall back to English.
 */
const en: Record<string, string> = {
  // App / chrome
  'app.name': 'Dayang Spa',
  'app.tagline': 'Management System',

  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.attendance': 'Attendance',
  'nav.chat': 'Chat',
  'nav.announcements': 'Announcements',
  'nav.profile': 'Profile',
  'nav.bookings': 'Bookings',
  'nav.staff': 'Staff',
  'nav.treatments': 'Treatments',
  'nav.treatment-input': 'Treatment Input',
  'nav.inventory': 'Inventory',
  'nav.commissions': 'Commissions',
  'nav.reports': 'Reports',
  'nav.settlement': 'Settlement',
  'nav.users': 'Users',
  'nav.outlets': 'Outlets',
  'nav.settings': 'Settings',

  // Layout
  'logout': 'Logout',
  'logout.success': 'Logged out successfully',
  'aria.openMenu': 'Open menu',
  'aria.closeMenu': 'Close menu',
  'lang.label': 'Language',

  // Login
  'login.title': 'Dayang Spa Management',
  'login.subtitle': 'Sign in to your account',
  'login.staffId': 'Staff ID / Username',
  'login.password': 'Password',
  'login.signIn': 'Sign in',
  'login.signingIn': 'Signing in...',
  'login.success': 'Login successful!',
  'login.failed': 'Login failed',

  // Notifications
  'notif.title': 'Notifications',
  'notif.markAllRead': 'Mark all as read',
  'notif.empty': 'No notifications',
  'notif.blocked': '🔕 Notifications are blocked',
  'notif.blockedDesc':
    'Allow notifications for Dayang Spa in your browser settings to receive treatment assignments and booking alerts.',
  'notif.turnOn': 'Turn on alerts?',
  'notif.turnOnDesc': "Get a browser notification when you're assigned a new treatment.",
  'notif.enable': 'Enable notifications',
  'notif.inappActive': '📭 In-app notifications active',
  'notif.inappDesc':
    "Push requires server VAPID config; you'll still get a browser alert while this tab is open.",
  'notif.types.newBooking': 'New Booking',
  'notif.types.treatmentAssigned': 'Treatment Assigned',
  'notif.types.announcement': 'Announcement',
  'notif.types.system': 'System',

  // Dashboard
  'dash.adminTitle': 'Admin Dashboard',
  'dash.adminSubtitle': 'Overview of your outlet',
  'dash.staffTitle': 'My Dashboard',
  'dash.todayBookings': "Today's Bookings",
  'dash.todayCommission': "Today's Commission",
  'dash.activeStaff': 'Active Staff',
  'dash.todayRevenue': "Today's Revenue",
  'dash.treatmentsCompleted': 'Treatments Completed',
  'dash.myAvailability': 'My Availability',
  'dash.currentStatus': 'Current status:',
  'dash.todaySchedule': "Today's Schedule",
  'dash.noBookingsToday': 'No bookings scheduled for today',
  'dash.upcomingTreatment': 'Upcoming Treatment',
  'dash.noUpcoming': 'No upcoming treatments',
  'dash.noUpcomingBookings': 'No upcoming bookings',
  'dash.recentActivity': 'Recent Activity',
  'dash.noRecentActivity': 'No recent activity',
  'dash.announcements': 'Announcements',
  'dash.chat': 'Chat',
  'dash.profile': 'Profile',
  'dash.attendance': 'Attendance',
  'dash.opened': 'Open',
  'dash.customer': 'Customer: {name}',
  'dash.room': 'Room: {room}',
  'dash.treatment': 'Treatment',
  'dash.minutesRemaining': '{n} minutes remaining',
  'dash.loading': 'Loading...',
  'dash.statusUpdated': 'Status updated',
  'dash.treatmentsToday': 'Treatments Today',
  'dash.hi': 'Hi, {name}',
  'dash.staffOnline': 'Staff Online',
  'dash.pending': 'Pending',
  'dash.available': 'Available',
  'dash.inCharge': 'In-Charge',
  'dash.busy': 'Busy',
  'dash.offAir': 'Off-Air',
  'dash.confirmed': 'Confirmed',
  'dash.inTreatment': 'In-Treatment',
  'dash.pendingPayment': 'Pending Payment',
  'dash.completed': 'Completed',
  'dash.staffAvailability': 'Staff Availability',
  'dash.noStaffData': 'No staff data available',
  'dash.youAreCurrently': 'You are currently',
  'dash.nextBookings': 'Next Bookings',
  'dash.all': 'All',
  'dash.break': 'Break',

  // Common
  'common.loading': 'Loading...',
  'common.cancel': 'Cancel',
  'common.saving': 'Saving...',
  'common.title': 'Title',
  'common.content': 'Content',

  // Announcements
  'ann.title': 'Announcements',
  'ann.new': 'New Announcement',
  'ann.empty': 'No announcements yet',
  'ann.created': 'Announcement created successfully',
  'ann.createFailed': 'Failed to create announcement',
  'ann.markedRead': 'Marked as read',
  'ann.markReadFailed': 'Failed to mark as read',
  'ann.badgeNew': 'New',
  'ann.by': 'By {name}',
  'ann.post': 'Post Announcement',

  // System settings
  'settings.title': 'System Settings',
  'settings.general': 'General Settings',
  'settings.outletName': 'Outlet Name',
  'settings.outletAddress': 'Outlet Address',
  'settings.outletPhone': 'Outlet Phone',
  'settings.operatingHours': 'Operating Hours',
  'settings.currency': 'Currency',
  'settings.timezone': 'Timezone',
  'settings.saved': 'Settings saved successfully',
  'settings.save': 'Save Settings',

  // Profile
  'profile.title': 'My Profile',
  'profile.info': 'Profile Information',
  'profile.name': 'Name',
  'profile.email': 'Email',
  'profile.phone': 'Phone',
  'profile.role': 'Role',
  'profile.outlet': 'Outlet',
  'profile.notSet': 'Not set',
  'profile.notAssigned': 'Not assigned',
  'profile.changePassword': 'Change Password',
  'profile.currentPassword': 'Current Password',
  'profile.newPassword': 'New Password',
  'profile.confirmNewPassword': 'Confirm New Password',
  'profile.pwMismatch': 'New passwords do not match',
  'profile.pwTooShort': 'Password must be at least 6 characters',
  'profile.pwChanged': 'Password changed successfully',
  'profile.pwFailed': 'Failed to change password',
  'profile.loadingProfile': 'Loading profile...',
  'profile.loadFailed': 'Failed to load profile',
  'profile.retry': 'Retry',

  // Outlets
  'outlets.title': 'Outlets',
  'outlets.add': 'Add Outlet',
  'outlets.addNew': 'Add New Outlet',
  'outlets.searchPlaceholder': 'Search outlets...',
  'outlets.empty': 'No outlets found',
  'outlets.active': 'Active',
  'outlets.inactive': 'Inactive',
  'outlets.created': 'Outlet created successfully',
  'outlets.createFailed': 'Failed to create outlet',
  'common.address': 'Address',
  'common.phone': 'Phone',
};

const id: Record<string, string> = {
  // App / chrome
  'app.name': 'Dayang Spa',
  'app.tagline': 'Sistem Manajemen',

  // Navigation
  'nav.dashboard': 'Dasbor',
  'nav.attendance': 'Kehadiran',
  'nav.chat': 'Pesan',
  'nav.announcements': 'Pengumuman',
  'nav.profile': 'Profil',
  'nav.bookings': 'Reservasi',
  'nav.staff': 'Karyawan',
  'nav.treatments': 'Perawatan',
  'nav.treatment-input': 'Input Perawatan',
  'nav.inventory': 'Inventaris',
  'nav.commissions': 'Komisi',
  'nav.reports': 'Laporan',
  'nav.settlement': 'Pelunasan',
  'nav.users': 'Pengguna',
  'nav.outlets': 'Cabang',
  'nav.settings': 'Pengaturan',

  // Layout
  'logout': 'Keluar',
  'logout.success': 'Berhasil keluar',
  'aria.openMenu': 'Buka menu',
  'aria.closeMenu': 'Tutup menu',
  'lang.label': 'Bahasa',

  // Login
  'login.title': 'Manajemen Dayang Spa',
  'login.subtitle': 'Masuk ke akun Anda',
  'login.staffId': 'ID Karyawan / Nama Pengguna',
  'login.password': 'Kata Sandi',
  'login.signIn': 'Masuk',
  'login.signingIn': 'Sedang masuk...',
  'login.success': 'Login berhasil!',
  'login.failed': 'Login gagal',

  // Notifications
  'notif.title': 'Notifikasi',
  'notif.markAllRead': 'Tandai semua sudah dibaca',
  'notif.empty': 'Tidak ada notifikasi',
  'notif.blocked': '🔕 Notifikasi diblokir',
  'notif.blockedDesc':
    'Izinkan notifikasi untuk Dayang Spa di pengaturan browser Anda agar menerima penugasan perawatan dan peringatan reservasi.',
  'notif.turnOn': 'Aktifkan peringatan?',
  'notif.turnOnDesc': 'Dapatkan notifikasi browser saat Anda ditugaskan perawatan baru.',
  'notif.enable': 'Aktifkan notifikasi',
  'notif.inappActive': '📭 Notifikasi dalam aplikasi aktif',
  'notif.inappDesc':
    'Push memerlukan konfigurasi VAPID server; Anda tetap menerima peringatan browser selama tab ini terbuka.',
  'notif.types.newBooking': 'Reservasi Baru',
  'notif.types.treatmentAssigned': 'Perawatan Ditugaskan',
  'notif.types.announcement': 'Pengumuman',
  'notif.types.system': 'Sistem',

  // Dashboard
  'dash.adminTitle': 'Dasbor Admin',
  'dash.adminSubtitle': 'Ringkasan outlet Anda',
  'dash.staffTitle': 'Dasbor Saya',
  'dash.todayBookings': 'Reservasi Hari Ini',
  'dash.todayCommission': 'Komisi Hari Ini',
  'dash.activeStaff': 'Karyawan Aktif',
  'dash.todayRevenue': 'Pendapatan Hari Ini',
  'dash.treatmentsCompleted': 'Perawatan Selesai',
  'dash.myAvailability': 'Ketersediaan Saya',
  'dash.currentStatus': 'Status saat ini:',
  'dash.todaySchedule': 'Jadwal Hari Ini',
  'dash.noBookingsToday': 'Tidak ada reservasi yang dijadwalkan hari ini',
  'dash.upcomingTreatment': 'Perawatan Berikutnya',
  'dash.noUpcoming': 'Tidak ada perawatan mendatang',
  'dash.noUpcomingBookings': 'Tidak ada reservasi mendatang',
  'dash.recentActivity': 'Aktivitas Terbaru',
  'dash.noRecentActivity': 'Belum ada aktivitas terbaru',
  'dash.announcements': 'Pengumuman',
  'dash.chat': 'Pesan',
  'dash.profile': 'Profil',
  'dash.attendance': 'Kehadiran',
  'dash.opened': 'Buka',
  'dash.customer': 'Pelanggan: {name}',
  'dash.room': 'Ruangan: {room}',
  'dash.treatment': 'Perawatan',
  'dash.minutesRemaining': '{n} menit tersisa',
  'dash.loading': 'Memuat...',
  'dash.statusUpdated': 'Status diperbarui',
  'dash.treatmentsToday': 'Perawatan Hari Ini',
  'dash.hi': 'Hai, {name}',
  'dash.staffOnline': 'Karyawan Online',
  'dash.pending': 'Menunggu',
  'dash.available': 'Tersedia',
  'dash.inCharge': 'Sedang Bertugas',
  'dash.busy': 'Sibuk',
  'dash.offAir': 'Off Air',
  'dash.confirmed': 'Dikonfirmasi',
  'dash.inTreatment': 'Sedang Perawatan',
  'dash.pendingPayment': 'Menunggu Pembayaran',
  'dash.completed': 'Selesai',
  'dash.staffAvailability': 'Ketersediaan Karyawan',
  'dash.noStaffData': 'Belum ada data karyawan',
  'dash.youAreCurrently': 'Anda saat ini',
  'dash.nextBookings': 'Reservasi Berikutnya',
  'dash.all': 'Semua',
  'dash.break': 'Istirahat',

  // Common
  'common.loading': 'Memuat...',
  'common.cancel': 'Batal',
  'common.saving': 'Menyimpan...',
  'common.title': 'Judul',
  'common.content': 'Isi',

  // Announcements
  'ann.title': 'Pengumuman',
  'ann.new': 'Pengumuman Baru',
  'ann.empty': 'Belum ada pengumuman',
  'ann.created': 'Pengumuman berhasil dibuat',
  'ann.createFailed': 'Gagal membuat pengumuman',
  'ann.markedRead': 'Ditandai sudah dibaca',
  'ann.markReadFailed': 'Gagal menandai sudah dibaca',
  'ann.badgeNew': 'Baru',
  'ann.by': 'Oleh {name}',
  'ann.post': 'Kirim Pengumuman',

  // System settings
  'settings.title': 'Pengaturan Sistem',
  'settings.general': 'Pengaturan Umum',
  'settings.outletName': 'Nama Outlet',
  'settings.outletAddress': 'Alamat Outlet',
  'settings.outletPhone': 'Telepon Outlet',
  'settings.operatingHours': 'Jam Operasional',
  'settings.currency': 'Mata Uang',
  'settings.timezone': 'Zona Waktu',
  'settings.saved': 'Pengaturan berhasil disimpan',
  'settings.save': 'Simpan Pengaturan',

  // Profile
  'profile.title': 'Profil Saya',
  'profile.info': 'Informasi Profil',
  'profile.name': 'Nama',
  'profile.email': 'Email',
  'profile.phone': 'Telepon',
  'profile.role': 'Peran',
  'profile.outlet': 'Outlet',
  'profile.notSet': 'Belum diisi',
  'profile.notAssigned': 'Belum ditugaskan',
  'profile.changePassword': 'Ubah Kata Sandi',
  'profile.currentPassword': 'Kata Sandi Saat Ini',
  'profile.newPassword': 'Kata Sandi Baru',
  'profile.confirmNewPassword': 'Konfirmasi Kata Sandi Baru',
  'profile.pwMismatch': 'Kata sandi baru tidak cocok',
  'profile.pwTooShort': 'Kata sandi minimal 6 karakter',
  'profile.pwChanged': 'Kata sandi berhasil diubah',
  'profile.pwFailed': 'Gagal mengubah kata sandi',
  'profile.loadingProfile': 'Memuat profil...',
  'profile.loadFailed': 'Gagal memuat profil',
  'profile.retry': 'Coba Lagi',

  // Outlets
  'outlets.title': 'Cabang',
  'outlets.add': 'Tambah Outlet',
  'outlets.addNew': 'Tambah Outlet Baru',
  'outlets.searchPlaceholder': 'Cari outlet...',
  'outlets.empty': 'Tidak ada outlet ditemukan',
  'outlets.active': 'Aktif',
  'outlets.inactive': 'Nonaktif',
  'outlets.created': 'Outlet berhasil dibuat',
  'outlets.createFailed': 'Gagal membuat outlet',
  'common.address': 'Alamat',
  'common.phone': 'Telepon',
};

const dicts: Record<Lang, Record<string, string>> = { en, id };

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const dict = dicts[lang] || dicts.en;
  let str: string = dict[key] ?? dicts.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}