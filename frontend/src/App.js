import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Import UI components
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';

// Icons
import { ShoppingCart, User, Star, Package, Users, BarChart3, Ticket, Plus, Minus, CreditCard, LogOut, X, Search, Filter, ArrowRight, Mail, Phone, MapPin, HelpCircle, Trash2, Send, Heart, RefreshCw, Home, Tag, Settings } from 'lucide-react';

// Import Auth component
import Auth from './pages/Auth';



const BACKEND_URL = process.env.REACT_APP_BACKEND_URL?.replace(/\/$/, "");
const API = BACKEND_URL;





// Profile form validation schema (moved to ProfileInfo component)

// Import Admin Components
import ProductManagement from './components/admin/ProductManagement';
import UserManagement from './components/admin/UserManagement';
import OrderManagement from './components/admin/OrderManagement';
import SupportTicketManagement from './components/admin/SupportTicketManagement';
import AnalyticsDashboard from './components/admin/AnalyticsDashboard';
import CouponManagement from './components/admin/CouponManagement';
import AdminLayout from './components/admin/AdminLayout';

// Import CheckoutPage
import CheckoutPage from './components/CheckoutPage';

// Import OrderSuccessPage
import OrderSuccessPage from './components/OrderSuccessPage';

// Import ProductDetail
import ProductDetail from './pages/ProductDetail';

// Import Profile Components
import ProfileLayout from './components/ProfileLayout';
import ProfileInfo from './components/ProfileInfo';
import MyTicketsPage from './components/MyTicketsPage';
import SettingsPage from './components/SettingsPage';
import OrderHistoryPage from './components/OrderHistoryPage';

// Import Error Boundary
import ErrorBoundary from './components/ErrorBoundary';

// Import RecentlyViewed component
import RecentlyViewed from './components/RecentlyViewed';

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/api/auth/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/api/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;

      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
      setLoading(false); // Ensure loading is set to false
      toast.success('Login successful!');
      // Force immediate re-render
      setTimeout(() => {
        window.dispatchEvent(new Event('auth-change'));
      }, 0);
      return userData;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
      throw error;
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await axios.post(`${API}/api/auth/register`, { name, email, password, role: 'user' });
      toast.success('Account created successfully! You can now log in.');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Signup failed');
      throw error;
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      const response = await axios.post(`${API}/api/auth/verify-otp`, { email, otp });
      toast.success('Account verified successfully!');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'OTP verification failed');
      throw error;
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await axios.post(`${API}/api/auth/forgot-password/request`, { email });
      toast.success('Password reset OTP sent to your email!');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reset OTP');
      throw error;
    }
  };

  const verifyResetOtp = async (email, otp) => {
    try {
      const response = await axios.post(`${API}/api/auth/forgot-password/verify`, { email, otp });
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'OTP verification failed');
      throw error;
    }
  };

  const resetPassword = async (email, otp, newPassword) => {
    try {
      const response = await axios.post(`${API}/api/auth/forgot-password/reset`, { email, otp, newPassword });
      toast.success('Password reset successful!');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Password reset failed');
      throw error;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await axios.post(`${API}/api/auth/change-password`, { currentPassword, newPassword });
      toast.success('Password changed successfully!');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Password change failed');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    toast.success('Logged out successfully');
  };

  // Make updateUser available globally for components that need it
  useEffect(() => {
    window.updateUserContext = updateUser;
    return () => {
      delete window.updateUserContext;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser, verifyOtp, forgotPassword, verifyResetOtp, resetPassword, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export { useAuth, useCart };

// Cart Context
const CartContext = createContext();

const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    // Initialize cart from localStorage
    try {
      const savedCart = localStorage.getItem('shopmate_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      return [];
    }
  });

  // Save cart to localStorage whenever cartItems changes
  React.useEffect(() => {
    try {
      localStorage.setItem('shopmate_cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cartItems]);

  const { user } = useAuth();

  useEffect(() => {
    const loadCartFromBackend = async () => {
      try {
        const response = await axios.get(`${API}/api/cart`);
        const items = response.data.map(ci => ({ product: ci.product, quantity: ci.quantity }));
        // Keep local cart on refresh when backend cart is empty.
        setCartItems(prev => (items.length > 0 ? items : prev));
      } catch (e) {
      }
    };
    if (user) {
      loadCartFromBackend();
    }
  }, [user]);

  const addToCart = async (product, quantity = 1) => {
    if (user) {
      try {
        await axios.post(`${API}/api/cart/add`, { product_id: product.id, quantity });
        const response = await axios.get(`${API}/api/cart`);
        const items = response.data.map(ci => ({ product: ci.product, quantity: ci.quantity }));
        setCartItems(items);
        toast.success(`${product.name} added to cart!`);
        return;
      } catch (e) {
      }
    }
    setCartItems(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    toast.success(`${product.name} added to cart!`);
  };

  const removeFromCart = async (productId) => {
    if (user) {
      try {
        await axios.delete(`${API}/api/cart/${productId}`);
        const response = await axios.get(`${API}/api/cart`);
        const items = response.data.map(ci => ({ product: ci.product, quantity: ci.quantity }));
        setCartItems(items);
        return;
      } catch (e) {
      }
    }
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = async (productId, quantity) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }
    if (user) {
      try {
        await axios.put(`${API}/api/cart/${productId}`, { quantity });
        const response = await axios.get(`${API}/api/cart`);
        const items = response.data.map(ci => ({ product: ci.product, quantity: ci.quantity }));
        setCartItems(items);
        return;
      } catch (e) {
      }
    }
    setCartItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = async () => {
    if (user) {
      try {
        await axios.post(`${API}/api/cart/clear`);
        setCartItems([]);
        localStorage.removeItem('shopmate_cart');
        return;
      } catch (e) {
      }
    }
    setCartItems([]);
    localStorage.removeItem('shopmate_cart');
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getTotalItems
    }}>
      {children}
    </CartContext.Provider>
  );
};

const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// Navigation Component
const Navigation = () => {
  const { user, logout } = useAuth();
  const { getTotalItems } = useCart();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authState, setAuthState] = useState({ user: null, isAuthenticated: false });

  // Sync auth state with context
  useEffect(() => {
    setAuthState({ user, isAuthenticated: !!user });
  }, [user]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  if (user?.role === 'admin') {
    return null;
  }

  const userMenuItems = [
    { href: '/products', label: 'Products', icon: Package },
    { href: '/help', label: 'Help', icon: HelpCircle },
    { href: '/contact', label: 'Contact', icon: Mail },
    { href: '/profile/settings', label: 'Settings', icon: Settings },
    { href: '/profile/tickets', label: 'My Tickets', icon: Ticket },
    { href: '/profile/orders', label: 'Order History', icon: Package },
    { href: '/profile/wishlist', label: 'Wishlist', icon: Heart },
    { href: '/profile/returns', label: 'Returns', icon: RefreshCw }
  ];

  return (
    <nav className="glass-nav sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <a href="/" className="ui-display text-xl font-bold text-gray-900">
              ShopMate
            </a>
          </div>

          <div />

          <div className="flex items-center space-x-2 sm:space-x-4">
            {user?.role !== 'admin' && (
              <a href="/cart" className="relative p-2 text-gray-700 hover:text-gray-900 transition-colors ui-surface">
                <ShoppingCart className="h-6 w-6" />
                {getTotalItems() > 0 && (
                  <Badge className="absolute -top-1 -right-1 px-2 py-1 text-xs bg-red-500 text-white">
                    {getTotalItems()}
                  </Badge>
                )}
              </a>
            )}

            {authState.isAuthenticated && authState.user ? (
              <div className="hidden sm:flex items-center space-x-4">
                {authState.user.role === 'admin' && (
                  <a href="/admin" className="pill-link text-gray-700 hover:text-gray-900 transition-colors">
                    Admin
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="pill-link text-gray-700 hover:text-gray-900 transition-colors"
                  aria-label="Open profile menu"
                >
                  <User className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-2">
                <a href="/auth">
                  <Button variant="ghost" size="sm" className="pill-link">Login</Button>
                </a>
                <a href="/auth?tab=signup">
                  <Button size="sm" className="ui-surface">Sign Up</Button>
                </a>
              </div>
            )}

            {authState.isAuthenticated && (
              <button
                type="button"
                className="sm:hidden pill-link text-gray-700 hover:text-gray-900 transition-colors"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open profile menu"
              >
                <User className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
      {authState.isAuthenticated && sidebarOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setSidebarOpen(false)}>
          <aside
            className="absolute top-0 right-0 h-full w-80 max-w-[90vw] bg-white shadow-2xl p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="ui-display text-lg font-semibold text-gray-900">Menu</h3>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {userMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
            <div className="pt-4 mt-4 border-t">
              <a
                href="/profile"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <User className="h-4 w-4" />
                <span>Profile</span>
              </a>
              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => {
                  setSidebarOpen(false);
                  logout();
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </aside>
        </div>
      )}
    </nav>
  );
};

// Home Page
const HomePage = () => {
  const { user } = useAuth();
  const [featuredProducts, setFeaturedProducts] = useState([]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      fetchFeaturedProducts();
    }
  }, [user]);

  const fetchFeaturedProducts = async () => {
    try {
      const response = await axios.get(`${API}/api/products`);
      setFeaturedProducts(response.data.slice(0, 6));
    } catch (error) {
      console.error('Error fetching featured products:', error);
    }
  };

  // Admin users are redirected to admin dashboard by default
  if (user && user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen mesh-bg">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight">
            Welcome to
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 block">
              ShopMate
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Discover amazing products at unbeatable prices. Your one-stop shop for everything you need.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/products">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg">
                Shop Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <a href="/help">
              <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 py-4 text-lg">
                Learn More
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Featured Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProducts.map((product, index) => (
              <ProductCard key={`${product.id}-${index}`} product={product} />
            ))}
          </div>
          <div className="text-center mt-12">
            <a href="/products">
              <Button size="lg" variant="outline">View All Products</Button>
            </a>
          </div>
          
          {/* Recently Viewed Products */}
          <RecentlyViewed />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-sky-50 shadow-xl px-6 sm:px-10 py-10">
          <div className="text-center mb-10">
            <h2 className="ui-display text-3xl font-bold text-slate-900">Why Choose ShopMate?</h2>
            <p className="text-slate-600 mt-2">Built around trust, speed, and convenience for daily shopping.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-blue-100 bg-white/80 backdrop-blur p-6 text-center shadow-sm">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-900">Quality Products</h3>
              <p className="text-slate-600">Carefully curated selection of high-quality products from trusted brands.</p>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-white/80 backdrop-blur p-6 text-center shadow-sm">
              <div className="w-14 h-14 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-7 w-7 text-cyan-700" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-900">Secure Payments</h3>
              <p className="text-slate-600">Safe and secure payment processing with multiple payment options.</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white/80 backdrop-blur p-6 text-center shadow-sm">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="h-7 w-7 text-emerald-700" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-slate-900">24/7 Support</h3>
              <p className="text-slate-600">Round-the-clock customer support to help you with any questions.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 pb-10 pt-6">
        <div className="max-w-7xl mx-auto rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-sky-50 text-slate-800 shadow-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 sm:px-10 py-10">
            <div className="lg:col-span-5">
              <h3 className="ui-display text-3xl font-bold tracking-tight text-slate-900">ShopMate</h3>
              <p className="mt-3 text-slate-600 max-w-md">
                Smart shopping with trusted products, transparent pricing, and a faster checkout experience.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs text-blue-700">Secure Checkout</span>
                <span className="rounded-full border border-cyan-200 bg-cyan-100 px-3 py-1 text-xs text-cyan-700">Fast Delivery</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs text-emerald-700">Support 24x7</span>
              </div>
              <div className="mt-6">
                <a href="/products">
                  <Button className="bg-blue-600 text-white hover:bg-blue-700">Start Shopping</Button>
                </a>
              </div>
            </div>

            <div className="lg:col-span-3">
              <h4 className="ui-display text-sm uppercase tracking-widest text-slate-500">Explore</h4>
              <div className="mt-4 space-y-3 text-sm">
                <a href="/products" className="block text-slate-700 hover:text-blue-700">Products</a>
                <a href="/help" className="block text-slate-700 hover:text-blue-700">Help Center</a>
                <a href="/contact" className="block text-slate-700 hover:text-blue-700">Contact Us</a>
                <a href="/auth" className="block text-slate-700 hover:text-blue-700">My Account</a>
              </div>
            </div>

            <div className="lg:col-span-4">
              <h4 className="ui-display text-sm uppercase tracking-widest text-slate-500">Contact</h4>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p>support@shopmate.com</p>
                <p>+91 90000 00000</p>
                <p>Mon-Sat: 10:00 AM - 8:00 PM</p>
                <p>Mumbai, India</p>
              </div>
            </div>
          </div>

          <div className="border-t border-blue-100 bg-white/60 px-6 sm:px-10 py-4 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>(c) {new Date().getFullYear()} ShopMate. All rights reserved.</span>
            <span>Built for smooth shopping experiences.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Product Card Component
const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCardClick = (e) => {
    // Prevent navigation if clicking on buttons
    if (e.target.closest('button')) {
      return;
    }
    navigate(`/product/${product.id}`);
  };

  const handleBuyNow = (e) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please login to buy now');
      navigate('/auth');
      return;
    }

    if (product.stock === 0) {
      toast.error('Product is out of stock');
      return;
    }

    // Store buy now item in localStorage
    const buyNowItem = {
      product: product,
      quantity: 1,
      total: product.price
    };
    localStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));

    // Navigate to checkout
    navigate('/checkout');
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <Card
      className="group ui-surface-strong tilt-card transition-all duration-300 cursor-pointer h-[460px] flex flex-col overflow-hidden"
      onClick={handleCardClick}
    >
      <CardContent className="p-6 flex flex-col h-full">
        {/* Product Image - Fixed Height */}
        <div className="w-full h-48 bg-gray-100/80 rounded-lg mb-4 overflow-hidden flex-shrink-0 border border-slate-200/70">
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-16 w-16 text-gray-400" />
            </div>
          )}
        </div>

        {/* Product Content - Flex Grow */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Title - Max 2 lines */}
          <h3 className="font-semibold text-lg mb-3 text-gray-900 line-clamp-2 flex-shrink-0">
            {product.name}
          </h3>

          {/* Price */}
          <div className="mb-3 flex-shrink-0">
            <span className="ui-display text-2xl font-bold text-blue-600">₹{product.price}</span>
          </div>

          {/* Rating */}
          {product.average_rating !== undefined && (
            <div className="flex items-center space-x-2 mb-3 flex-shrink-0">
              {renderStars(Math.round(product.average_rating))}
              <span className="text-sm text-gray-600">
                ({product.total_ratings || 0})
              </span>
            </div>
          )}

          {/* Stock */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <span className="text-sm text-gray-500">Stock: {product.stock}</span>
            <Badge variant="secondary">{product.category}</Badge>
          </div>

          {/* Description - Truncated */}
          <p className="text-gray-600 text-sm line-clamp-2 flex-1">
            {product.description}
          </p>
        </div>

        {/* Footer - Buttons - Pinned at Bottom */}
        <div className="flex-shrink-0 mt-4">
          <div className="flex space-x-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                addToCart(product);
              }}
              disabled={product.stock === 0}
              variant="outline"
              className="flex-1"
            >
              Add to Cart
            </Button>
            <Button
              onClick={handleBuyNow}
              disabled={product.stock === 0}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
            >
              Buy Now
            </Button>
            <Button
              onClick={async (e) => {
                e.stopPropagation();
                if (!user) {
                  toast.error('Please login to use wishlist');
                  navigate('/auth');
                  return;
                }
                try {
                  await axios.post(`${API}/api/wishlist/${product.id}`);
                  toast.success('Added to wishlist');
                } catch (error) {
                  toast.error(error.response?.data?.detail || 'Failed to add to wishlist');
                }
              }}
              variant="ghost"
              className="px-3"
            >
              <Heart className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Products Page
const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [tagQuery, setTagQuery] = useState('');
  const [minStock, setMinStock] = useState('');
  const [onlyVariants, setOnlyVariants] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [searchTerm, selectedCategory, selectedBrand, minPrice, maxPrice, inStockOnly, minRating, sortBy, sortOrder, tagQuery, minStock, onlyVariants]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedBrand) params.append('brand', selectedBrand);
      if (minPrice) params.append('min_price', minPrice);
      if (maxPrice) params.append('max_price', maxPrice);
      if (inStockOnly) params.append('in_stock', 'true');
      if (minRating) params.append('min_rating', minRating);
      if (sortBy) params.append('sort_by', sortBy);
      if (sortOrder) params.append('sort_order', sortOrder);
      if (tagQuery) params.append('tags', tagQuery);
      if (minStock) params.append('min_stock', minStock);
      if (onlyVariants) params.append('has_variants', 'true');
      
      const response = await axios.get(`${API}/api/products?${params}`);
      setProducts(response.data);
      
      // Extract unique categories and brands
      const uniqueCategories = [...new Set(response.data.map(p => p.category))];
      const uniqueBrands = [...new Set(response.data.map(p => p.brand).filter(b => b))];
      setCategories(uniqueCategories);
      setBrands(uniqueBrands);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 text-gray-900">Our Products</h1>
        
        <div className="md:hidden mb-4">
          <Button variant="outline" className="w-full" onClick={() => setShowFilters(prev => !prev)}>
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>

        <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Brands</option>
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="Min Price"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full"
          />
          <Input
            type="number"
            placeholder="Max Price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full"
          />
          <Input
            placeholder="Tags (comma)"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            className="w-full"
          />
          <Input
            type="number"
            placeholder="Min Stock"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            className="w-full"
          />
          <select
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Any Rating</option>
            <option value="3">3+ stars</option>
            <option value="4">4+ stars</option>
            <option value="4.5">4.5+ stars</option>
          </select>
          <label className="inline-flex items-center space-x-2 px-2">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            <span className="text-sm text-gray-700">In Stock</span>
          </label>
          <label className="inline-flex items-center space-x-2 px-2">
            <input
              type="checkbox"
              checked={onlyVariants}
              onChange={(e) => setOnlyVariants(e.target.checked)}
            />
            <span className="text-sm text-gray-700">Variants Only</span>
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Sort By</option>
            <option value="popularity">Popularity</option>
            <option value="price">Price</option>
            <option value="rating">Rating</option>
            <option value="newest">Newest</option>
            <option value="name">Name</option>
            <option value="stock">Stock</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="h-[460px] animate-pulse">
                <CardContent className="p-6 space-y-4">
                  <div className="w-full h-48 bg-gray-200 rounded-lg"></div>
                  <div className="h-6 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-10 bg-gray-200 rounded w-full"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product, index) => (
              <ProductCard key={`${product.id}-${index}`} product={product} />
            ))}
          </div>
        )}

        {products.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No products found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Cart Page
const CartPage = () => {
  const { cartItems, updateQuantity, removeFromCart, getTotalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please login to checkout');
      return;
    }

    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    // Navigate to /checkout page instead of performing API call
    window.location.href = '/checkout';
  };

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <p className="text-gray-600 mb-8">Add some products to get started!</p>
          <a href="/products">
            <Button>Continue Shopping</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8">Shopping Cart</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map(item => (
              <Card key={item.product.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                    {item.product.images && item.product.images.length > 0 ? (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{item.product.name}</h3>
                    <p className="text-gray-600">${item.product.price}</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="px-3 py-1 border rounded">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="text-left sm:text-right">
                    <p className="font-semibold">₹{(item.product.price * item.quantity).toFixed(2)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          <div>
            <Card className="p-6 lg:sticky lg:top-24">
              <h3 className="text-xl font-semibold mb-4">Order Summary</h3>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>${getTotalPrice().toFixed(2)}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={handleCheckout}
                  disabled={isCheckingOut || !user}
                >
                  {isCheckingOut ? 'Processing...' : 'Proceed to Checkout'}
                </Button>
                {!user && (
                  <p className="text-sm text-gray-600 text-center">
                    Please <a href="/auth" className="text-blue-600 hover:underline">login</a> to checkout
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={clearCart}
                >
                  Clear Cart
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wishlist Page
const WishlistPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWishlist = async () => {
      try {
        const response = await axios.get(`${API}/api/wishlist`);
        setProducts(response.data);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      loadWishlist();
    }
  }, [user]);

  const handleRemove = async (productId) => {
    try {
      await axios.delete(`${API}/api/wishlist/${productId}`);
      setProducts(prev => prev.filter(p => p.id !== productId));
      toast.success('Removed from wishlist');
    } catch (e) {
      toast.error('Failed to remove');
    }
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">My Wishlist</h1>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="h-[280px] animate-pulse">
                <CardContent className="p-6 space-y-4">
                  <div className="w-full h-32 bg-gray-200 rounded"></div>
                  <div className="h-5 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-16">
              <Package className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No items in wishlist</h3>
              <p className="text-gray-500 mb-6">Browse products and add items to your wishlist.</p>
              <Button onClick={() => navigate('/products')}>Browse Products</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(p => (
              <Card key={p.id} className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded overflow-hidden">
                    {p.images && p.images.length > 0 ? (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-gray-600">₹{p.price}</p>
                    <div className="mt-2 flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/product/${p.id}`)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleRemove(p.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// My Returns Page
const MyReturnsPage = () => {
  const { user } = useAuth();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productMap, setProductMap] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/api/returns`);
        setReturns(res.data);
        const ids = Array.from(new Set(res.data.map(r => r.product_id).filter(Boolean)));
        const entries = await Promise.all(ids.map(async (id) => {
          try {
            const p = await axios.get(`${API}/api/products/${id}`);
            return [id, p.data];
          } catch {
            return [id, null];
          }
        }));
        const map = {};
        entries.forEach(([id, p]) => { map[id] = p; });
        setProductMap(map);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user]);

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">My Returns</h1>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : returns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-16">
              <RefreshCw className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No Returns</h3>
              <p className="text-gray-500">You have no return requests.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {returns.map((r) => {
              const p = productMap[r.product_id];
              return (
                <Card key={r.id} className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden">
                        {p?.images?.length ? (
                          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">Order #{r.order_id?.slice(-8)}</p>
                        <p className="text-sm text-gray-600">Product: {p?.name || r.product_id}</p>
                        <p className="text-sm text-gray-600">Qty: {r.quantity}</p>
                        {r.reason && <p className="text-sm text-gray-600">Reason: {r.reason}</p>}
                      </div>
                    </div>
                    <Badge className="capitalize w-fit">{r.status}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Admin Returns Page
const AdminReturnsPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/api/admin/returns`);
        setItems(res.data);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    if (user?.role === 'admin') load();
  }, [user]);

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/api/admin/returns/${id}`, { status });
      const res = await axios.get(`${API}/api/admin/returns`);
      setItems(res.data);
      toast.success('Return status updated');
    } catch (e) {
      toast.error('Failed to update');
    }
  };

  const restock = async (id) => {
    try {
      await axios.post(`${API}/api/admin/returns/${id}/restock`);
      const res = await axios.get(`${API}/api/admin/returns`);
      setItems(res.data);
      toast.success('Product restocked');
    } catch (e) {
      toast.error('Failed to restock');
    }
  };

  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Manage Returns</h1>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((r) => (
              <Card key={r.id} className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="font-semibold">Order #{r.order_id?.slice(-8)}</p>
                    <p className="text-sm text-gray-600">Product: {r.product_id}</p>
                    <p className="text-sm text-gray-600">Qty: {r.quantity}</p>
                    {r.reason && <p className="text-sm text-gray-600">Reason: {r.reason}</p>}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      className="px-3 py-2 border rounded"
                    >
                      <option value="requested">requested</option>
                      <option value="approved">approved</option>
                      <option value="rejected">rejected</option>
                      <option value="refunded">refunded</option>
                      <option value="received">received</option>
                    </select>
                    <Button variant="outline" onClick={() => restock(r.id)}>Restock</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
// Auth Pages
const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      window.location.href = '/';
    } catch (error) {
      // Error handled in auth context
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
          <p className="text-center mt-4 text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/register" className="text-blue-600 hover:underline">
              Sign up
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const RegisterPage = () => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await register(name, email, password);
      window.location.href = '/';
    } catch (error) {
      // Error handled in auth context
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Sign up for a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
          <p className="text-center mt-4 text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:underline">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// Checkout Success Page
const CheckoutSuccessPage = () => {
  const { clearCart } = useCart();
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const session_id = urlParams.get('session_id');
    
    if (session_id) {
      setSessionId(session_id);
      pollPaymentStatus(session_id);
    } else {
      setIsLoading(false);
    }
  }, []);

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 10;
    
    if (attempts >= maxAttempts) {
      setPaymentStatus('timeout');
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/payments/status/${sessionId}`);
      const status = response.data.payment_status;
      
      setPaymentStatus(status);
      
      if (status === 'paid') {
        clearCart();
        setIsLoading(false);
        toast.success('Payment successful! Thank you for your purchase.');
      } else if (status === 'expired') {
        setIsLoading(false);
      } else {
        // Continue polling
        setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      setPaymentStatus('error');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Processing Payment...</h2>
          <p className="text-gray-600">Please wait while we confirm your payment.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          {paymentStatus === 'paid' ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h2>
              <p className="text-gray-600 mb-6">Thank you for your purchase. Your order has been confirmed.</p>
            </>
          ) : paymentStatus === 'expired' ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">Payment Expired</h2>
              <p className="text-gray-600 mb-6">Your payment session has expired. Please try again.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-yellow-600 mb-2">Payment Processing</h2>
              <p className="text-gray-600 mb-6">We're still processing your payment. Please check back shortly.</p>
            </>
          )}
          
          <div className="space-y-3">
            <a href="/products">
              <Button className="w-full">Continue Shopping</Button>
            </a>
            {user && (
              <a href="/profile">
                <Button variant="outline" className="w-full">View Orders</Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Help Center Page
const HelpPage = () => {
  const [faqs, setFaqs] = useState([]);
  const [supportForm, setSupportForm] = useState({
    name: '',
    email: '',
    subject: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('faq');

  useEffect(() => {
    fetchFAQs();

    // Check URL parameters for tab
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'support') {
      setActiveTab('support');
    }
  }, []);

  const fetchFAQs = async () => {
    try {
      const response = await axios.get(`${API}/api/faqs`);
      setFaqs(response.data);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    }
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await axios.post(`${API}/api/support/tickets`, supportForm);
      toast.success('Support ticket submitted successfully!');
      setSupportForm({ name: '', email: '', subject: '', description: '' });
    } catch (error) {
      toast.error('Failed to submit support ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8">Help Center</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="support">Contact Support</TabsTrigger>
          </TabsList>
          
          <TabsContent value="faq" className="mt-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
              {faqs.length > 0 ? (
                faqs.map(faq => (
                  <Card key={faq.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{faq.question}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600">{faq.answer}</p>
                      <Badge variant="secondary" className="mt-2">{faq.category}</Badge>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No FAQs available at the moment.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="support" className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Contact Support</CardTitle>
                <CardDescription>
                  Need help? Send us a message and we'll get back to you as soon as possible.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSupportSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={supportForm.name}
                        onChange={(e) => setSupportForm({...supportForm, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={supportForm.email}
                        onChange={(e) => setSupportForm({...supportForm, email: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={supportForm.subject}
                      onChange={(e) => setSupportForm({...supportForm, subject: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows="4"
                      value={supportForm.description}
                      onChange={(e) => setSupportForm({...supportForm, description: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Contact Page
const ContactPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8">Contact Us</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Get in Touch</CardTitle>
              <CardDescription>
                We'd love to hear from you. Here's how you can reach us.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Email</h3>
                  <p className="text-gray-600">support@shopmate.com</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Phone className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Phone</h3>
                  <p className="text-gray-600">+91 8879635312</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Address</h3>
                  <p className="text-gray-600">
                    D Sector O Line,<br />
                    Near Alfalah Masjid,<br />
                    Maharashtra, 400088
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Business Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Monday - Friday</span>
                <span>9:00 AM - 6:00 PM</span>
              </div>
              <div className="flex justify-between">
                <span>Saturday</span>
                <span>10:00 AM - 4:00 PM</span>
              </div>
              <div className="flex justify-between">
                <span>Sunday</span>
                <span>Closed</span>
              </div>
              <Separator />
              <p className="text-sm text-gray-600">
                Our customer support team is available during business hours to assist you with any questions or concerns.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [counters, setCounters] = useState({
    total_products: 0,
    total_pending_orders: 0,
    total_users: 0,
    total_unresolved_tickets: 0
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchDashboardData();
      fetchCounters();

      // Set up real-time updates every 30 seconds
      const interval = setInterval(fetchCounters, 30000);

      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/dashboard`);
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchCounters = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/dashboard/counters`);
      setCounters(response.data);
    } catch (error) {
      console.error('Error fetching counters:', error);
    }
  };

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen admin-shell py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="ui-display text-3xl sm:text-4xl font-bold mb-8">Admin Dashboard</h1>

        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="ui-surface tilt-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Products</p>
                    <p className="text-2xl font-bold">{dashboardData.stats.total_products}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="ui-surface tilt-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <ShoppingCart className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold">{dashboardData.stats.total_orders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="ui-surface tilt-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold">{dashboardData.stats.total_users}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="ui-surface tilt-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Ticket className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Open Tickets</p>
                    <p className="text-2xl font-bold">{dashboardData.stats.open_tickets}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="text-center">
          <h2 className="ui-display text-2xl font-semibold mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <a href="/admin/products">
              <Button className="w-full h-20 flex flex-col items-center justify-center relative ui-surface">
                <Package className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Manage Products</span>
                <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {counters.total_products}
                </span>
              </Button>
            </a>
            <a href="/admin/orders">
              <Button className="w-full h-20 flex flex-col items-center justify-center relative ui-surface">
                <ShoppingCart className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">View Orders</span>
                <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  {counters.total_pending_orders}
                </span>
              </Button>
            </a>
            <a href="/admin/users">
              <Button className="w-full h-20 flex flex-col items-center justify-center relative ui-surface">
                <Users className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Manage Users</span>
                <span className="absolute top-2 right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                  {counters.total_users}
                </span>
              </Button>
            </a>
            <a href="/admin/support-tickets">
              <Button className="w-full h-20 flex flex-col items-center justify-center relative ui-surface">
                <Ticket className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Support Tickets</span>
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {counters.total_unresolved_tickets}
                </span>
              </Button>
            </a>
            <a href="/admin/returns">
              <Button className="w-full h-20 flex flex-col items-center justify-center ui-surface">
                <RefreshCw className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Manage Returns</span>
              </Button>
            </a>
            <a href="/admin/analytics">
              <Button className="w-full h-20 flex flex-col items-center justify-center bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white">
                <BarChart3 className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Analytics Dashboard</span>
              </Button>
            </a>
            <a href="/admin/coupons">
              <Button className="w-full h-20 flex flex-col items-center justify-center relative ui-surface">
                <Tag className="h-6 w-6 mb-2" />
                <span className="text-sm font-medium">Manage Coupons</span>
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// Profile Page Components
const ProfilePage = () => {
  const { user } = useAuth();
  return user?.role === 'admin' ? (
    <AdminLayout>
      <ProfileInfo />
    </AdminLayout>
  ) : (
    <ProfileLayout>
      <ProfileInfo />
    </ProfileLayout>
  );
};

const ProfileTicketsPage = () => {
  const { user } = useAuth();
  return user?.role === 'admin' ? (
    <AdminLayout>
      <MyTicketsPage />
    </AdminLayout>
  ) : (
    <ProfileLayout>
      <MyTicketsPage />
    </ProfileLayout>
  );
};

const ProfileSettingsPage = () => {
  const { user } = useAuth();
  return user?.role === 'admin' ? (
    <AdminLayout>
      <SettingsPage />
    </AdminLayout>
  ) : (
    <ProfileLayout>
      <SettingsPage />
    </ProfileLayout>
  );
};

const ProfileOrdersPage = () => {
  const { user } = useAuth();
  return user?.role === 'admin' ? (
    <AdminLayout>
      <OrderHistoryPage />
    </AdminLayout>
  ) : (
    <ProfileLayout>
      <OrderHistoryPage />
    </ProfileLayout>
  );
};

const ProfileReturnsPage = () => {
  const { user } = useAuth();
  return user?.role === 'admin' ? (
    <AdminLayout>
      <MyReturnsPage />
    </AdminLayout>
  ) : (
    <ProfileLayout>
      <MyReturnsPage />
    </ProfileLayout>
  );
};

const ProfileWishlistPage = () => {
  const { user } = useAuth();
  return user?.role === 'admin' ? (
    <AdminLayout>
      <WishlistPage />
    </AdminLayout>
  ) : (
    <ProfileLayout>
      <WishlistPage />
    </ProfileLayout>
  );
};

// Main App Component
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <Router>
            <div className="App">
              <Navigation />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product/:productId" element={<ProductDetail />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success/:orderId" element={
                <ProtectedRoute>
                  <OrderSuccessPage />
                </ProtectedRoute>
              } />
            <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
            <Route path="/profile/tickets" element={
                <ProtectedRoute>
                  <ProfileTicketsPage />
                </ProtectedRoute>
              } />
            <Route path="/profile/settings" element={
                <ProtectedRoute>
                  <ProfileSettingsPage />
                </ProtectedRoute>
              } />
            <Route path="/profile/orders" element={
                <ProtectedRoute>
                  <ProfileOrdersPage />
                </ProtectedRoute>
              } />
            <Route path="/profile/returns" element={
                <ProtectedRoute>
                  <ProfileReturnsPage />
                </ProtectedRoute>
              } />
            <Route path="/profile/wishlist" element={
                <ProtectedRoute>
                  <ProfileWishlistPage />
                </ProtectedRoute>
              } />
            <Route path="/admin" element={
                <ProtectedRoute adminOnly>
                  <AdminLayout>
                    <AnalyticsDashboard />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/products" element={
                <ProtectedRoute adminOnly>
                  <AdminLayout>
                    <ProductManagement />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/users" element={
                <ProtectedRoute adminOnly>
                  <AdminLayout>
                    <UserManagement />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/orders" element={
                <ProtectedRoute adminOnly>
                  <AdminLayout>
                    <OrderManagement />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/returns" element={
                <ProtectedRoute adminOnly>
                  <AdminLayout>
                    <AdminReturnsPage />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/support-tickets" element={
                <ProtectedRoute adminOnly>
                  <AdminLayout>
                    <SupportTicketManagement />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/analytics" element={
                <ProtectedRoute adminOnly>
                  <AdminLayout>
                    <AnalyticsDashboard />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/coupons" element={
                <ProtectedRoute adminOnly>
                  <AdminLayout>
                    <CouponManagement />
                  </AdminLayout>
                </ProtectedRoute>
              } />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </CartProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

