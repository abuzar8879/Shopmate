import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { toast } from 'sonner';
import {
  User,
  LogOut,
  Camera,
  MapPin,
  Phone,
  Mail,
  Package,
  RefreshCw,
  Heart,
  Ticket,
  Clock3,
  Sparkles,
  CreditCard,
  Globe,
  Bell,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

import { useAuth } from '../App';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}`;

const PAYMENT_OPTIONS = [
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'net_banking', label: 'Net Banking' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cash_on_delivery', label: 'Cash on Delivery' }
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' }
];

const NOTIFICATION_OPTIONS = [
  { value: 'all', label: 'All Notifications' },
  { value: 'important_only', label: 'Important Only' },
  { value: 'none', label: 'None' }
];

const DEFAULT_ADDRESS = {
  street: '',
  city: '',
  state: '',
  postal_code: '',
  country: ''
};

const normalizeAddress = (address) => ({
  street: address?.street || '',
  city: address?.city || '',
  state: address?.state || '',
  postal_code: address?.postal_code || address?.pincode || '',
  country: address?.country || ''
});

const isAddressComplete = (address) => {
  const a = normalizeAddress(address);
  return Boolean(
    a.street.trim() &&
      a.city.trim() &&
      a.state.trim() &&
      a.postal_code.trim() &&
      a.country.trim()
  );
};

const getInitials = (name, email) => {
  const base = (name || email || 'U').trim();
  const parts = base.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
};

const formatRelativeTime = (value) => {
  if (!value) return 'No activity yet';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No activity yet';
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
};

const computeProfileCompletion = (profile) => {
  const addr = normalizeAddress(profile?.delivery_address);
  const checks = [
    Boolean(profile?.name?.trim()),
    Boolean(profile?.email?.trim()),
    Boolean(profile?.mobile_number?.trim()),
    Boolean(
      addr.street.trim() &&
        addr.city.trim() &&
        addr.state.trim() &&
        addr.postal_code.trim() &&
        addr.country.trim()
    ),
    Boolean(profile?.avatar_url),
    Boolean(profile?.preferred_payment_method),
    Boolean(profile?.language),
    Boolean(profile?.notification_preference)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

const profileFormSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    mobile_number: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        const cleaned = val.replace(/[\s\-\(\)]/g, '');
        return /^\d{10,15}$/.test(cleaned);
      }, 'Use 10-15 digits for phone number'),
    avatar_url: z.string().optional(),
    preferred_payment_method: z.enum(['card', 'upi', 'net_banking', 'wallet', 'cash_on_delivery']),
    language: z.enum(['en', 'hi', 'bn', 'ta', 'te']),
    notification_preference: z.enum(['all', 'important_only', 'none']),
    delivery_address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postal_code: z.string().optional(),
        country: z.string().optional()
      })
      .optional()
  })
  .superRefine((data, ctx) => {
    const a = normalizeAddress(data.delivery_address);
    const hasAnyField = Object.values(a).some((v) => String(v || '').trim().length > 0);
    if (!hasAnyField) return;

    if (a.street.trim().length < 5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['delivery_address', 'street'], message: 'Street should be at least 5 characters' });
    }
    if (a.city.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['delivery_address', 'city'], message: 'City should be at least 2 characters' });
    }
    if (!/^[A-Za-z][A-Za-z\s.-]{1,49}$/.test(a.state.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['delivery_address', 'state'], message: 'State should contain letters only' });
    }
    if (!/^\d{3,10}$/.test(a.postal_code.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['delivery_address', 'postal_code'], message: 'Postal code should be 3-10 digits' });
    }
    if (!/^[A-Za-z][A-Za-z\s.-]{1,49}$/.test(a.country.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['delivery_address', 'country'], message: 'Country should contain letters only' });
    }
  });

const ProfileInfo = () => {
  const { user, logout, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({ totalOrders: 0, activeReturns: 0, wishlistCount: 0, openTickets: 0 });
  const [activity, setActivity] = useState({ lastOrder: null, lastTicket: null, lastLogin: null });

  const form = useForm({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
      mobile_number: '',
      avatar_url: '',
      preferred_payment_method: 'card',
      language: 'en',
      notification_preference: 'all',
      delivery_address: DEFAULT_ADDRESS
    }
  });

  const watchedValues = form.watch();
  const completionPercentage = useMemo(
    () => computeProfileCompletion(isEditing ? watchedValues : user),
    [isEditing, watchedValues, user]
  );

  const userAddress = normalizeAddress(user?.delivery_address);
  const hasPhone = Boolean(user?.mobile_number?.trim());
  const hasAddress = isAddressComplete(userAddress);
  const needsCompletion = !hasPhone || !hasAddress;

  const selectedPaymentLabel = PAYMENT_OPTIONS.find((o) => o.value === (user?.preferred_payment_method || 'card'))?.label;
  const selectedLanguageLabel = LANGUAGE_OPTIONS.find((o) => o.value === (user?.language || 'en'))?.label;
  const selectedNotificationLabel = NOTIFICATION_OPTIONS.find((o) => o.value === (user?.notification_preference || 'all'))?.label;

  useEffect(() => {
    if (!user) return;
    form.reset({
      name: user.name || '',
      email: user.email || '',
      mobile_number: user.mobile_number || '',
      avatar_url: user.avatar_url || '',
      preferred_payment_method: user.preferred_payment_method || 'card',
      language: user.language || 'en',
      notification_preference: user.notification_preference || 'all',
      delivery_address: normalizeAddress(user.delivery_address)
    });
    setAvatarPreview(user.avatar_url || '');
  }, [user, form]);

  useEffect(() => {
    if (!user) return;
    fetchProfileInsights();
  }, [user]);

  const fetchProfileInsights = async () => {
    setStatsLoading(true);
    try {
      const results = await Promise.allSettled([
        axios.get(`${API}/api/orders`),
        axios.get(`${API}/api/returns`),
        axios.get(`${API}/api/wishlist`),
        axios.get(`${API}/api/support/tickets/my`),
        axios.get(`${API}/api/users/login-history`)
      ]);

      const orders = results[0].status === 'fulfilled' && Array.isArray(results[0].value.data) ? results[0].value.data : [];
      const returns = results[1].status === 'fulfilled' && Array.isArray(results[1].value.data) ? results[1].value.data : [];
      const wishlist = results[2].status === 'fulfilled' && Array.isArray(results[2].value.data) ? results[2].value.data : [];
      const tickets = results[3].status === 'fulfilled' && Array.isArray(results[3].value.data) ? results[3].value.data : [];
      const loginHistory =
        results[4].status === 'fulfilled' && Array.isArray(results[4].value.data?.login_history)
          ? results[4].value.data.login_history
          : [];

      const activeReturns = returns.filter((r) => {
        const status = String(r?.status || '').toLowerCase();
        return ['requested', 'approved', 'pending', 'processing'].includes(status);
      }).length;

      const openTickets = tickets.filter((t) => {
        const status = String(t?.status || '').toLowerCase();
        return !['closed', 'resolved'].includes(status);
      }).length;

      const sortedOrders = [...orders].sort(
        (a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime()
      );

      const ticketWithLastUpdate = tickets
        .map((ticket) => {
          const messageTimes = (ticket?.messages || [])
            .map((m) => m?.timestamp || m?.created_at)
            .filter(Boolean)
            .map((d) => new Date(d).getTime());
          const fallbackTime = new Date(ticket?.created_at || 0).getTime();
          return {
            ...ticket,
            _last_update_ms: messageTimes.length ? Math.max(...messageTimes) : fallbackTime
          };
        })
        .sort((a, b) => b._last_update_ms - a._last_update_ms);

      setStats({
        totalOrders: orders.length,
        activeReturns,
        wishlistCount: wishlist.length,
        openTickets
      });
      setActivity({
        lastOrder: sortedOrders[0] || null,
        lastTicket: ticketWithLastUpdate[0] || null,
        lastLogin: loginHistory[0] || null
      });
    } catch (error) {
      toast.error('Failed to load profile insights');
    } finally {
      setStatsLoading(false);
    }
  };

  const startCompletingProfile = () => {
    setIsEditing(true);
    setTimeout(() => {
      const formNode = document.getElementById('profile-edit-form');
      if (formNode) formNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be 2MB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setAvatarPreview(result);
      form.setValue('avatar_url', result, { shouldDirty: true });
      if (!isEditing) setIsEditing(true);
      toast.success('Avatar selected');
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data) => {
    const previousUser = user ? { ...user } : null;
    const address = normalizeAddress(data.delivery_address);
    const hasAddressInput = Object.values(address).some((v) => String(v || '').trim().length > 0);
    const cleanedMobile = (data.mobile_number || '').replace(/[\s\-\(\)]/g, '');

    const payload = {
      name: data.name.trim(),
      email: (user?.email || data.email || '').trim(),
      mobile_number: cleanedMobile,
      avatar_url: data.avatar_url || '',
      preferred_payment_method: data.preferred_payment_method,
      language: data.language,
      notification_preference: data.notification_preference,
      delivery_address: hasAddressInput
        ? {
            full_name: data.name.trim(),
            phone_number: cleanedMobile || '',
            street: address.street.trim(),
            city: address.city.trim(),
            state: address.state.trim(),
            postal_code: address.postal_code.trim(),
            country: address.country.trim()
          }
        : undefined
    };

    setSaveStatus('saving');
    if (previousUser) {
      updateUser({
        ...previousUser,
        ...payload,
        delivery_address: payload.delivery_address || previousUser.delivery_address
      });
    }

    try {
      const response = await axios.put(`${API}/api/users/profile`, payload);
      updateUser(response.data);
      setAvatarPreview(response.data.avatar_url || '');
      setLastSavedAt(new Date());
      setSaveStatus('saved');
      setIsEditing(false);
      toast.success('Profile saved successfully');
      fetchProfileInsights();
    } catch (error) {
      if (previousUser) updateUser(previousUser);
      setSaveStatus('idle');
      toast.error(error.response?.data?.detail || 'Failed to save profile');
    }
  };

  const isSaving = form.formState.isSubmitting || saveStatus === 'saving';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card className="ui-surface-strong border-blue-100/70">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                  <AvatarImage src={avatarPreview || user?.avatar_url || ''} alt={user?.name || 'User avatar'} />
                  <AvatarFallback className="text-xl font-semibold bg-blue-100 text-blue-700">
                    {getInitials(user?.name, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700"
                  aria-label="Upload avatar"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{user?.name}</h1>
                <p className="text-slate-600">{user?.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'}>
                    {user?.role || 'user'}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full lg:max-w-sm space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span className="font-medium">Profile completion</span>
                <span className="font-semibold">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} />
              <p className="text-xs text-slate-500">
                {completionPercentage < 100
                  ? 'Complete missing profile details for faster checkout and better support.'
                  : 'Great. Your profile is complete.'}
              </p>
              <div className="flex gap-2">
                <Button onClick={startCompletingProfile} className="flex-1">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isEditing ? 'Continue Editing' : 'Edit Profile'}
                </Button>
                <a href="/profile/settings" className="flex-1">
                  <Button variant="outline" className="w-full">Manage Settings</Button>
                </a>
              </div>
              {lastSavedAt && (
                <p className="text-xs text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved at {lastSavedAt.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders', value: stats.totalOrders, icon: Package },
          { label: 'Active Returns', value: stats.activeReturns, icon: RefreshCw },
          { label: 'Wishlist Items', value: stats.wishlistCount, icon: Heart },
          { label: 'Open Tickets', value: stats.openTickets, icon: Ticket }
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="ui-surface">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{statsLoading ? '-' : stat.value}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {needsCompletion && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2 text-amber-900">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-semibold">Your profile is missing important details</p>
                <p className="text-sm">
                  {!hasPhone && !hasAddress && 'Add phone and delivery address to speed up checkout.'}
                  {!hasPhone && hasAddress && 'Add phone number for delivery updates.'}
                  {hasPhone && !hasAddress && 'Add default address for one-click checkout.'}
                </p>
              </div>
            </div>
            <Button onClick={startCompletingProfile}>Complete Profile</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Default Address Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasAddress ? (
              <div className="text-sm text-slate-700 leading-relaxed">
                <p>{userAddress.street}</p>
                <p>{userAddress.city}, {userAddress.state}</p>
                <p>{userAddress.postal_code}</p>
                <p>{userAddress.country}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                No default address saved yet.
              </div>
            )}
            <a href="/profile/settings">
              <Button variant="outline" className="w-full">Manage in Settings</Button>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Saved Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment</span>
              <span className="font-medium text-slate-900">{selectedPaymentLabel || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-2"><Globe className="h-4 w-4" /> Language</span>
              <span className="font-medium text-slate-900">{selectedLanguageLabel || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</span>
              <span className="font-medium text-slate-900">{selectedNotificationLabel || 'Not set'}</span>
            </div>
            <Button variant="outline" className="w-full" onClick={startCompletingProfile}>Edit Preferences</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Last order</p>
              <p className="text-xs text-slate-600">
                {activity.lastOrder
                  ? `Order #${activity.lastOrder.order_id || activity.lastOrder.id} - ${activity.lastOrder.status || 'pending'}`
                  : 'No orders yet'}
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {activity.lastOrder ? formatRelativeTime(activity.lastOrder.created_at) : 'N/A'}
            </span>
          </div>

          <div className="flex items-start justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Last ticket update</p>
              <p className="text-xs text-slate-600">
                {activity.lastTicket
                  ? `${activity.lastTicket.subject || 'Support ticket'} (${activity.lastTicket.status || 'open'})`
                  : 'No tickets yet'}
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {activity.lastTicket ? formatRelativeTime(activity.lastTicket._last_update_ms) : 'N/A'}
            </span>
          </div>

          <div className="flex items-start justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Last login</p>
              <p className="text-xs text-slate-600">
                {activity.lastLogin
                  ? `${activity.lastLogin.device || 'Unknown device'} (${activity.lastLogin.ip_address || 'N/A'})`
                  : 'No login history'}
              </p>
            </div>
            <span className="text-xs text-slate-500">
              {activity.lastLogin ? formatDateTime(activity.lastLogin.login_time) : 'N/A'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card id="profile-edit-form">
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
        </CardHeader>
        <CardContent>
          {!isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><User className="h-3.5 w-3.5" /> Name</p>
                  <p className="font-medium text-slate-900">{user?.name || 'Not set'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</p>
                  <p className="font-medium text-slate-900">{user?.email || 'Not set'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Phone</p>
                  <p className="font-medium text-slate-900">{user?.mobile_number || 'Not set'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Address Status</p>
                  <p className="font-medium text-slate-900">{hasAddress ? 'Complete' : 'Missing details'}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={startCompletingProfile} className="sm:w-auto">
                  <User className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
                <Button onClick={logout} variant="outline" className="sm:w-auto">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" {...form.register('name')} placeholder="Enter your full name" disabled={isSaving} />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    placeholder="Email cannot be edited"
                    readOnly
                    disabled={isSaving}
                    className="bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Email is locked for security. Update it via verified support flow.
                  </p>
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="mobile_number">Phone Number</Label>
                <Input
                  id="mobile_number"
                  {...form.register('mobile_number')}
                  placeholder="e.g. 9876543210"
                  disabled={isSaving}
                />
                <p className="text-xs text-slate-500 mt-1">Hint: 10-15 digits, numbers only.</p>
                {form.formState.errors.mobile_number && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.mobile_number.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Delivery Address</Label>
                <Input placeholder="Street address" {...form.register('delivery_address.street')} disabled={isSaving} />
                {form.formState.errors.delivery_address?.street && (
                  <p className="text-sm text-red-600">{form.formState.errors.delivery_address.street.message}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Input placeholder="City" {...form.register('delivery_address.city')} disabled={isSaving} />
                    {form.formState.errors.delivery_address?.city && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.delivery_address.city.message}</p>
                    )}
                  </div>
                  <div>
                    <Input placeholder="State" {...form.register('delivery_address.state')} disabled={isSaving} />
                    <p className="text-xs text-slate-500 mt-1">Hint: letters only, e.g. Maharashtra.</p>
                    {form.formState.errors.delivery_address?.state && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.delivery_address.state.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Input placeholder="Postal code" {...form.register('delivery_address.postal_code')} disabled={isSaving} />
                    <p className="text-xs text-slate-500 mt-1">Hint: 3-10 digits only.</p>
                    {form.formState.errors.delivery_address?.postal_code && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.delivery_address.postal_code.message}</p>
                    )}
                  </div>
                  <div>
                    <Input placeholder="Country" {...form.register('delivery_address.country')} disabled={isSaving} />
                    <p className="text-xs text-slate-500 mt-1">Hint: use full country name, letters only.</p>
                    {form.formState.errors.delivery_address?.country && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.delivery_address.country.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Preferred Payment</Label>
                  <Controller
                    control={form.control}
                    name="preferred_payment_method"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <Label>Language</Label>
                  <Controller
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <Label>Notifications</Label>
                  <Controller
                    control={form.control}
                    name="notification_preference"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isSaving}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select preference" />
                        </SelectTrigger>
                        <SelectContent>
                          {NOTIFICATION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => {
                    setIsEditing(false);
                    setSaveStatus('idle');
                    form.reset({
                      name: user?.name || '',
                      email: user?.email || '',
                      mobile_number: user?.mobile_number || '',
                      avatar_url: user?.avatar_url || '',
                      preferred_payment_method: user?.preferred_payment_method || 'card',
                      language: user?.language || 'en',
                      notification_preference: user?.notification_preference || 'all',
                      delivery_address: normalizeAddress(user?.delivery_address)
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>

              <div className="text-xs">
                {saveStatus === 'saving' && (
                  <span className="text-blue-700 flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    Saving your updates...
                  </span>
                )}
                {saveStatus === 'saved' && lastSavedAt && (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Saved at {lastSavedAt.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileInfo;
