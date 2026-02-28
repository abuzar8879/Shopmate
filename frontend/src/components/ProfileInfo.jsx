import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}`;

const profileFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  mobile_number: z.string().optional().refine((val) => {
    if (!val) return true; // Optional field
    const cleaned = val.replace(/[\s\-\(\)]/g, '');
    return /^\d{10,15}$/.test(cleaned);
  }, 'Mobile number must be 10-15 digits'),
  delivery_address: z.object({
    street: z.string().min(5, 'Street address must be at least 5 characters'),
    city: z.string().min(2, 'City must be at least 2 characters'),
    state: z.string().min(2, 'State must be at least 2 characters'),
    postal_code: z.string().min(3, 'Postal code must be at least 3 characters'),
    country: z.string().min(2, 'Country must be at least 2 characters')
  }).optional()
});

const ProfileInfo = () => {
  const { user, logout, updateUser, changePassword } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
      mobile_number: '',
      delivery_address: {
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: ''
      }
    }
  });

  useEffect(() => {
    if (user) {
      // Reset form with current user data
      form.reset({
        name: user.name || '',
        email: user.email || '',
        mobile_number: user.mobile_number || '',
        delivery_address: {
          street: user.delivery_address?.street || '',
          city: user.delivery_address?.city || '',
          state: user.delivery_address?.state || '',
          postal_code: user.delivery_address?.postal_code || user.delivery_address?.pincode || '',
          country: user.delivery_address?.country || ''
        }
      });
    }
  }, [user, form]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form to current user data
    form.reset({
      name: user.name || '',
      email: user.email || '',
      mobile_number: user.mobile_number || '',
      delivery_address: {
        street: user.delivery_address?.street || '',
        city: user.delivery_address?.city || '',
        state: user.delivery_address?.state || '',
        postal_code: user.delivery_address?.postal_code || user.delivery_address?.pincode || '',
        country: user.delivery_address?.country || ''
      }
    });
  };

  const onSubmit = async (data) => {
    try {
      // Log the payload before sending
      console.log('Profile update payload:', data);

      // Clean payload: remove undefined or null required fields
      const cleanedData = {
        name: data.name,
        email: data.email,
        mobile_number: data.mobile_number || '',
        delivery_address: data.delivery_address
          ? {
              full_name: data.name || '',
              phone_number: data.mobile_number || '',
              street: data.delivery_address.street || '',
              city: data.delivery_address.city || '',
              state: data.delivery_address.state || '',
              postal_code: data.delivery_address.postal_code || '',
              country: data.delivery_address.country || ''
            }
          : undefined
      };

      const response = await axios.put(`${API}/api/users/profile`, cleanedData);
      // Update user context with new data
      const updatedUser = response.data;
      updateUser(updatedUser);

      // Refresh admin user data if available
      if (window.refreshUserData) {
        window.refreshUserData();
      }

      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update error:', error);
      if (error.response?.status === 422 && error.response?.data) {
        const validationErrors = error.response.data;
        let messages = [];

        if (validationErrors.detail && Array.isArray(validationErrors.detail)) {
          messages = validationErrors.detail.map(err => {
            if (err.msg && err.loc) {
              return `${err.msg} at ${err.loc.join('.')}`;
            }
            return err.msg || JSON.stringify(err);
          });
        } else if (Array.isArray(validationErrors)) {
          messages = validationErrors.map(err => {
            if (err.msg && err.loc) {
              return `${err.msg} at ${err.loc.join('.')}`;
            }
            return err.msg || JSON.stringify(err);
          });
        } else if (typeof validationErrors === 'object') {
          messages = Object.values(validationErrors).map(err => {
            if (err.msg && err.loc) {
              return `${err.msg} at ${err.loc.join('.')}`;
            }
            return err.msg || JSON.stringify(err);
          });
        } else {
          messages = [JSON.stringify(validationErrors)];
        }
        // Log backend validation errors for debugging
        console.log('Backend validation errors:', validationErrors);
        toast.error(messages.join(', '));
      } else {
        toast.error(error.response?.data?.detail || 'Failed to update profile');
      }
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      // Error is handled in the changePassword function
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            <>
              <div>
                <Label>Name</Label>
                <p className="font-medium">{user.name}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p className="font-medium">{user.email}</p>
              </div>
              {user.mobile_number && (
                <div>
                  <Label>Mobile Number</Label>
                  <p className="font-medium">{user.mobile_number}</p>
                </div>
              )}
              {user.delivery_address && (
                <div>
                  <Label>Delivery Address</Label>
                  <p className="font-medium text-sm">
                    {user.delivery_address.street}<br />
                    {user.delivery_address.city}, {user.delivery_address.state} {user.delivery_address.postal_code}<br />
                    {user.delivery_address.country}
                  </p>
                </div>
              )}
              <div>
                <Label>Role</Label>
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role}
                </Badge>
              </div>
              <div>
                <Label>Member Since</Label>
                <p className="text-sm text-gray-600">
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col space-y-2">
                <Button onClick={handleEdit} className="w-full">
                  <User className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
                <Button onClick={logout} variant="outline" className="w-full">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  placeholder="Enter your full name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  placeholder="Enter your email address"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="mobile_number">Mobile Number</Label>
                <Input
                  id="mobile_number"
                  {...form.register('mobile_number')}
                  placeholder="Enter your mobile number (optional)"
                />
                {form.formState.errors.mobile_number && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.mobile_number.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Delivery Address</Label>
                <Input
                  placeholder="Street Address"
                  {...form.register('delivery_address.street')}
                />
                {form.formState.errors.delivery_address?.street && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.delivery_address.street.message}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Input
                      placeholder="City"
                      {...form.register('delivery_address.city')}
                    />
                    {form.formState.errors.delivery_address?.city && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.delivery_address.city.message}</p>
                    )}
                  </div>
                  <div>
                    <Input
                      placeholder="State"
                      {...form.register('delivery_address.state')}
                    />
                    {form.formState.errors.delivery_address?.state && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.delivery_address.state.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Input
                      placeholder="Postal Code"
                      {...form.register('delivery_address.postal_code')}
                    />
                    {form.formState.errors.delivery_address?.postal_code && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.delivery_address.postal_code.message}</p>
                    )}
                  </div>
                  <div>
                    <Input
                      placeholder="Country"
                      {...form.register('delivery_address.country')}
                    />
                    {form.formState.errors.delivery_address?.country && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.delivery_address.country.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel} className="w-full">
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileInfo;
