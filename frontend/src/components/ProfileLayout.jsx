import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { User, Settings, Ticket, LogOut, Package, Heart, RefreshCw, Menu, X } from 'lucide-react';
import { useAuth } from '../App';

const ProfileLayout = ({ children }) => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    {
      path: '/profile',
      label: 'My Profile',
      icon: User,
      exact: true
    },
    {
      path: '/profile/settings',
      label: 'Settings',
      icon: Settings
    },
    ...(user?.role !== 'admin' ? [
      {
        path: '/profile/tickets',
        label: 'My Tickets',
        icon: Ticket
      },
      {
        path: '/profile/orders',
        label: 'Order History',
        icon: Package
      }
      ,
      {
        path: '/profile/wishlist',
        label: 'Wishlist',
        icon: Heart
      }
      ,
      {
        path: '/profile/returns',
        label: 'Returns',
        icon: RefreshCw
      }
    ] : [])
  ];

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const showSidebar = user?.role !== 'admin';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Mobile menu button */}
      {showSidebar && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-30 bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-gray-900">Menu</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      )}

      {/* Mobile overlay */}
      {mobileMenuOpen && showSidebar && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside 
            className="fixed top-0 left-0 h-screen w-64 bg-white shadow-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold">Menu</span>
                <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="flex flex-col gap-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                        isActive(item.path, item.exact)
                          ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}

                <div className="pt-4 border-t">
                  <Button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    variant="ghost"
                    className="w-full justify-start text-gray-700 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="h-5 w-5 mr-3" />
                    <span className="font-medium">Logout</span>
                  </Button>
                </div>
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      {showSidebar && (
        <aside className="hidden md:block fixed top-0 left-0 h-screen w-64 bg-white border-r shadow-sm z-30 overflow-y-auto">
          <div className="p-4">
            <nav className="flex flex-col gap-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.path, item.exact)
                        ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-4 border-t">
                <Button
                  onClick={logout}
                  variant="ghost"
                  className="w-full justify-start text-gray-700 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  <span className="font-medium">Logout</span>
                </Button>
              </div>
            </nav>
          </div>
        </aside>
      )}
      
      {/* Main content area */}
      <div className={`px-4 sm:px-6 py-6 ${showSidebar ? 'md:ml-64' : ''} ${showSidebar ? 'mt-12 md:mt-0' : ''}`}>
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ProfileLayout;
