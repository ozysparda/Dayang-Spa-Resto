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
};

const id: Record<string, string> = {
  // App / chrome
  'app.name': 'Dayang Spa',
  'app.tagline': 'Sistema de Gestión',

  // Navigation
  'nav.dashboard': 'Panel',
  'nav.attendance': 'Asistencia',
  'nav.chat': 'Chat',
  'nav.announcements': 'Anuncios',
  'nav.profile': 'Perfil',
  'nav.bookings': 'Reservas',
  'nav.staff': 'Personal',
  'nav.treatments': 'Tratamientos',
  'nav.treatment-input': 'Ingreso de Tratamiento',
  'nav.inventory': 'Inventario',
  'nav.commissions': 'Comisiones',
  'nav.reports': 'Reportes',
  'nav.settlement': 'Liquidación',
  'nav.users': 'Usuarios',
  'nav.outlets': 'Sucursales',
  'nav.settings': 'Configuración',

  // Layout
  'logout': 'Cerrar sesión',
  'logout.success': 'Sesión cerrada correctamente',
  'aria.openMenu': 'Abrir menú',
  'aria.closeMenu': 'Cerrar menú',
  'lang.label': 'Idioma',

  // Login
  'login.title': 'Gestión Dayang Spa',
  'login.subtitle': 'Inicie sesión en su cuenta',
  'login.staffId': 'ID personal / Usuario',
  'login.password': 'Contraseña',
  'login.signIn': 'Iniciar sesión',
  'login.signingIn': 'Iniciando sesión...',
  'login.success': '¡Inicio de sesión exitoso!',
  'login.failed': 'Inicio de sesión fallido',

  // Notifications
  'notif.title': 'Notificaciones',
  'notif.markAllRead': 'Marcar todas como leídas',
  'notif.empty': 'Sin notificaciones',
  'notif.blocked': '🔕 Las notificaciones están bloqueadas',
  'notif.blockedDesc':
    'Permita las notificaciones de Dayang Spa en la configuración de su navegador para recibir asignaciones de tratamientos y alertas de reservas.',
  'notif.turnOn': '¿Activar alertas?',
  'notif.turnOnDesc': 'Reciba una notificación del navegador cuando le asignen un nuevo tratamiento.',
  'notif.enable': 'Activar notificaciones',
  'notif.inappActive': '📭 Notificaciones en la aplicación activas',
  'notif.inappDesc':
    'El push requiere la configuración VAPID del servidor; aun así recibirá una alerta del navegador mientras esta pestaña esté abierta.',
  'notif.types.newBooking': 'Nueva Reserva',
  'notif.types.treatmentAssigned': 'Tratamiento Asignado',
  'notif.types.announcement': 'Anuncio',
  'notif.types.system': 'Sistema',

  // Dashboard
  'dash.adminTitle': 'Panel de Administración',
  'dash.adminSubtitle': 'Resumen de su sucursal',
  'dash.staffTitle': 'Mi Panel',
  'dash.todayBookings': 'Reservas de Hoy',
  'dash.todayCommission': 'Comisión de Hoy',
  'dash.activeStaff': 'Personal Activo',
  'dash.todayRevenue': 'Ingresos de Hoy',
  'dash.treatmentsCompleted': 'Tratamientos Completados',
  'dash.myAvailability': 'Mi Disponibilidad',
  'dash.currentStatus': 'Estado actual:',
  'dash.todaySchedule': 'Agenda de Hoy',
  'dash.noBookingsToday': 'No hay reservas programadas para hoy',
  'dash.upcomingTreatment': 'Próximo Tratamiento',
  'dash.noUpcoming': 'No hay tratamientos próximos',
  'dash.noUpcomingBookings': 'No hay próximas reservas',
  'dash.recentActivity': 'Actividad Reciente',
  'dash.noRecentActivity': 'Sin actividad reciente',
  'dash.announcements': 'Anuncios',
  'dash.chat': 'Chat',
  'dash.profile': 'Perfil',
  'dash.attendance': 'Asistencia',
  'dash.opened': 'Abrir',
  'dash.customer': 'Cliente: {name}',
  'dash.room': 'Habitación: {room}',
  'dash.treatment': 'Tratamiento',
  'dash.minutesRemaining': '{n} minutos restantes',
  'dash.loading': 'Cargando...',
  'dash.statusUpdated': 'Estado actualizado',
  'dash.treatmentsToday': 'Tratamientos de Hoy',
  'dash.hi': 'Hola, {name}',
  'dash.staffOnline': 'Personal en Línea',
  'dash.pending': 'Pendiente',
  'dash.available': 'Disponible',
  'dash.inCharge': 'A Cargo',
  'dash.busy': 'Ocupado',
  'dash.offAir': 'Fuera de Línea',
  'dash.confirmed': 'Confirmado',
  'dash.inTreatment': 'En Tratamiento',
  'dash.pendingPayment': 'Pago Pendiente',
  'dash.completed': 'Completado',
  'dash.staffAvailability': 'Disponibilidad del Personal',
  'dash.noStaffData': 'Sin datos del personal',
  'dash.youAreCurrently': 'Usted se encuentra',
  'dash.nextBookings': 'Próximas Reservas',
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