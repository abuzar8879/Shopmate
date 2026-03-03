import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { ShoppingCart, ArrowRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL?.replace(/\/$/, "");
const API = BACKEND_URL;

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const { login } = useAuth();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
  });
  const [loginData, setLoginData] = useState({ email: '', password: '' });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  function validateSignup(name, email, password) {
    if (!name || name.length < 3)
      return 'Name must be at least 3 characters';
    if (!email || !/\S+@\S+\.\S+/.test(email)) return 'Invalid email format';
    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPassword.test(password || ''))
      return 'Password must be 8+ chars and include uppercase, lowercase, number, and special character';
    return null;
  }

  async function handleSignup(e) {
    e.preventDefault();
    const { name, email, password } = signupData;

    const validationError = validateSignup(name, email, password);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/register`, { name, email, password, role: 'user' });
      toast.success('Account created successfully! You can now log in.');
      setActiveTab('login');
      setSignupData({ name: '', email: '', password: '', role: 'user' });
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.response?.data?.message || 'Signup failed';
      toast.error(errMsg);    
    } finally {
      setLoading(false);
    }
  }



  async function handleLogin(e) {
    e.preventDefault();
    const { email, password } = loginData;

    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // Error handled in auth context
    } finally {
      setLoading(false);
    }
  }



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-4 sm:py-8 px-4">
      <div className="max-w-6xl w-full bg-white shadow-2xl rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        {/* Left panel - hidden on mobile, visible on lg */}
        <div className="hidden lg:flex bg-gradient-to-br from-blue-600 to-purple-600 text-white p-12 flex-col justify-between relative overflow-hidden min-h-[600px]">
          <div className="relative z-10">
            <div className="flex items-center mb-6">
              <ShoppingCart className="h-8 w-8 mr-3" />
              <h1 className="text-4xl font-bold">ShopMate</h1>
            </div>
            <p className="text-blue-100 mb-8 text-lg">
              Your one-stop shop for amazing products
            </p>
            <ul className="space-y-3 text-sm text-blue-100">
              <li className="flex items-center">
                <ArrowRight className="h-4 w-4 mr-2" />
                Discover quality products at great prices
              </li>
              <li className="flex items-center">
                <ArrowRight className="h-4 w-4 mr-2" />
                Secure checkout and fast delivery
              </li>
              <li className="flex items-center">
                <ArrowRight className="h-4 w-4 mr-2" />
                24/7 customer support
              </li>
              <li className="flex items-center">
                <ArrowRight className="h-4 w-4 mr-2" />
                Easy returns and exchanges
              </li>
            </ul>
          </div>
          <div className="relative z-10">
            <p className="text-xs text-blue-200">
              Secure authentication.
            </p>
          </div>
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full"></div>
            <div className="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white rounded-full"></div>
          </div>
        </div>

        {/* Mobile-friendly brand header - visible only on mobile */}
        <div className="lg:hidden bg-gradient-to-br from-blue-600 to-purple-600 text-white p-6 flex flex-col">
          <div className="flex items-center justify-center mb-4">
            <ShoppingCart className="h-8 w-8 mr-3" />
            <h1 className="text-3xl font-bold">ShopMate</h1>
          </div>
          <p className="text-blue-100 text-center text-sm mb-4">
            Your one-stop shop for amazing products
          </p>
          <div className="bg-white/10 rounded-lg p-3">
            <ul className="space-y-2 text-xs text-blue-100">
              <li className="flex items-center">
                <ArrowRight className="h-3 w-3 mr-2" />
                Quality products at great prices
              </li>
              <li className="flex items-center">
                <ArrowRight className="h-3 w-3 mr-2" />
                Secure checkout & fast delivery
              </li>
              <li className="flex items-center">
                <ArrowRight className="h-3 w-3 mr-2" />
                24/7 customer support
              </li>
            </ul>
          </div>
        </div>

        {/* Right panel: forms */}
        <div className="p-5 sm:p-8 md:p-12">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 sm:mb-8">
              <TabsTrigger value="login" className="text-sm">Login</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm">Sign Up</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
                <p className="text-gray-600">Sign in to your ShopMate account</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="Enter your email"
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData({ ...loginData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  disabled={loading}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>

              

            </TabsContent>

            {/* Signup Tab */}
            <TabsContent value="signup" className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
                <p className="text-gray-600">Join ShopMate today</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your name"
                    value={signupData.name}
                    onChange={(e) =>
                      setSignupData({ ...signupData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signupData.email}
                    onChange={(e) =>
                      setSignupData({ ...signupData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={signupData.password}
                    onChange={(e) =>
                      setSignupData({ ...signupData, password: e.target.value })
                    }
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>




          </Tabs>
        </div>
      </div>
    </div>
  );
}
