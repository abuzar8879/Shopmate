import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { RefreshCw, User, Mail, Phone, MapPin, Calendar, Trash2, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Fetch users function
  const fetchUsers = async (showToast = false) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/admin/users`);
      setUsers(response.data);
      setLastRefresh(new Date());
      if (showToast) {
        toast.success('User list refreshed successfully');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
      // Set empty array to prevent rendering errors
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh user data (can be called from other components)
  const refreshUserData = () => {
    fetchUsers(true);
  };

  // Make refreshUserData available globally for other components
  useEffect(() => {
    window.refreshUserData = refreshUserData;
    return () => {
      delete window.refreshUserData;
    };
  }, []);

  // Initial fetch only - runs once when component mounts
  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      await axios.delete(`${API}/api/admin/users/${userId}`);
      toast.success('User deleted successfully');
      fetchUsers(); // Refresh the list after deletion
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleRefresh = () => {
    fetchUsers(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-6">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <a href="/admin">
              <Button className="flex items-center space-x-2 bg-black text-white hover:bg-gray-800">
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
            </a>
            <h1 className="text-2xl sm:text-3xl font-bold">Manage Users</h1>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            {lastRefresh && (
              <span className="text-sm text-gray-500">
                Last updated: {formatDate(lastRefresh)}
              </span>
            )}
            <Button
              onClick={handleRefresh}
              disabled={loading}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
          </div>
        </div>

        {users.length === 0 && !loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No users found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map(user => (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{user.name}</CardTitle>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{user.email}</span>
                  </div>

                  {user.mobile_number && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{user.mobile_number}</span>
                    </div>
                  )}

                  {user.delivery_address && (
                    <div className="flex items-start space-x-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <div>
                        <div>{user.delivery_address.street || user.delivery_address.street_address || user.delivery_address.full_name}</div>
                        <div>
                          {user.delivery_address.city && `${user.delivery_address.city}, `}
                          {user.delivery_address.state && `${user.delivery_address.state} `}
                          {user.delivery_address.pincode || user.delivery_address.postal_code || user.delivery_address.postalCode}
                        </div>
                        <div>{user.delivery_address.country}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {formatDate(user.created_at)}</span>
                  </div>

                  <div className="pt-3 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                      className="w-full flex items-center space-x-2"
                      disabled={user.role === 'admin'}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{user.role === 'admin' ? 'Cannot Delete Admin' : 'Delete User'}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading users...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
