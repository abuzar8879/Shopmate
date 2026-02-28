import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { User, LogOut, Package, ShoppingCart, Users, Ticket, RefreshCw, BarChart3, Menu, X, Tag } from 'lucide-react';
import { useAuth } from '../../App';

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  const menu = [
    { to: '/profile', label: 'Profile', icon: User },
    { to: '/admin/products', label: 'Manage Products', icon: Package },
    { to: '/admin/orders', label: 'View Orders', icon: ShoppingCart },
    { to: '/admin/users', label: 'Manage Users', icon: Users },
    { to: '/admin/support-tickets', label: 'Support Tickets', icon: Ticket },
    { to: '/admin/returns', label: 'Manage Returns', icon: RefreshCw },
    { to: '/admin/analytics', label: 'Analytics Dashboard', icon: BarChart3 },
    { to: '/admin/coupons', label: 'Manage Coupons', icon: Tag },
  ];

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen admin-shell">
      <aside className="fixed top-0 left-0 h-screen w-64 bg-white/90 backdrop-blur border-r border-slate-200 shadow-sm z-40 overflow-y-auto hidden md:block">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold ui-display">Admin Panel</span>
          </div>
          <nav className="space-y-1">
            {menu.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                    active ? 'ui-surface text-blue-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <Separator className="my-4" />
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-gray-700 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-5 w-5 mr-3" />
            <span className="font-medium">Logout</span>
          </Button>
        </div>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="fixed top-0 left-0 h-screen w-64 bg-white/95 backdrop-blur shadow-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold ui-display">Admin Panel</span>
                <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="space-y-1">
                {menu.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                        active ? 'ui-surface text-blue-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <Separator className="my-4" />
              <Button
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                variant="ghost"
                className="w-full justify-start text-gray-700 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-5 w-5 mr-3" />
                <span className="font-medium">Logout</span>
              </Button>
            </div>
          </aside>
        </div>
      )}
      <main className="md:ml-64 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4 md:hidden">
            <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)} className="flex items-center gap-2">
              <Menu className="h-5 w-5" />
              <span>Menu</span>
            </Button>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
