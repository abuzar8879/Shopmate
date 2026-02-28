import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Edit, Trash2, Percent } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL?.replace(/\/$/, '');

const emptyCoupon = {
  code: '',
  discount_type: 'percentage',
  value: '',
  min_order_amount: '0',
  max_discount_amount: '',
  usage_limit: '',
  expires_at: '',
  is_active: true,
  is_public: false,
  description: ''
};

export default function CouponManagement() {
  const [coupons, setCoupons] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [form, setForm] = useState(emptyCoupon);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/admin/coupons`);
      setCoupons(response.data || []);
    } catch (error) {
      toast.error('Failed to fetch coupons');
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyCoupon);
    setEditingCoupon(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code || '',
      discount_type: coupon.discount_type || 'percentage',
      value: String(coupon.value ?? ''),
      min_order_amount: String(coupon.min_order_amount ?? '0'),
      max_discount_amount: coupon.max_discount_amount != null ? String(coupon.max_discount_amount) : '',
      usage_limit: coupon.usage_limit != null ? String(coupon.usage_limit) : '',
      expires_at: coupon.expires_at ? new Date(coupon.expires_at).toISOString().slice(0, 16) : '',
      is_active: coupon.is_active ?? true,
      is_public: coupon.is_public ?? false,
      description: coupon.description || ''
    });
    setIsDialogOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      value: Number(form.value),
      min_order_amount: Number(form.min_order_amount || 0),
      is_active: !!form.is_active,
      is_public: !!form.is_public,
      description: form.description?.trim() || null,
      max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null
    };

    if (!payload.code || !payload.discount_type || !payload.value) {
      toast.error('Please fill required coupon fields');
      return;
    }

    try {
      if (editingCoupon) {
        const updatePayload = { ...payload };
        delete updatePayload.code;
        await axios.put(`${API}/api/admin/coupons/${editingCoupon.id}`, updatePayload);
        toast.success('Coupon updated');
      } else {
        await axios.post(`${API}/api/admin/coupons`, payload);
        toast.success('Coupon created');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save coupon');
    }
  };

  const handleDelete = async (couponId) => {
    if (!window.confirm('Delete this coupon?')) return;
    try {
      await axios.delete(`${API}/api/admin/coupons/${couponId}`);
      toast.success('Coupon deleted');
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete coupon');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <a href="/admin">
              <Button className="flex items-center space-x-2 bg-black text-white hover:bg-gray-800">
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
            </a>
            <h1 className="text-2xl sm:text-3xl font-bold">Manage Coupons</h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Coupon
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Code *</Label>
                    <Input id="code" name="code" value={form.code} onChange={handleInputChange} placeholder="SAVE20" disabled={!!editingCoupon} required />
                  </div>
                  <div>
                    <Label htmlFor="discount_type">Discount Type *</Label>
                    <select id="discount_type" name="discount_type" value={form.discount_type} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md">
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="value">Value *</Label>
                    <Input id="value" name="value" type="number" min="0" step="0.01" value={form.value} onChange={handleInputChange} required />
                  </div>
                  <div>
                    <Label htmlFor="min_order_amount">Min Order Amount</Label>
                    <Input id="min_order_amount" name="min_order_amount" type="number" min="0" step="0.01" value={form.min_order_amount} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor="max_discount_amount">Max Discount Amount</Label>
                    <Input id="max_discount_amount" name="max_discount_amount" type="number" min="0" step="0.01" value={form.max_discount_amount} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor="usage_limit">Usage Limit</Label>
                    <Input id="usage_limit" name="usage_limit" type="number" min="0" value={form.usage_limit} onChange={handleInputChange} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="expires_at">Expiry</Label>
                    <Input id="expires_at" name="expires_at" type="datetime-local" value={form.expires_at} onChange={handleInputChange} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" value={form.description} onChange={handleInputChange} placeholder="e.g. Flat 20% off on orders above Rs 999" />
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between border rounded-md p-3">
                    <Label htmlFor="is_active">Active</Label>
                    <Switch id="is_active" checked={!!form.is_active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))} />
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between border rounded-md p-3">
                    <Label htmlFor="is_public">Public (Visible to users)</Label>
                    <Switch id="is_public" checked={!!form.is_public} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_public: checked }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Cancel</Button>
                  <Button type="submit">{editingCoupon ? 'Update Coupon' : 'Create Coupon'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">Loading coupons...</CardContent>
          </Card>
        ) : coupons.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-12">
              <Percent className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No coupons yet</h3>
              <p className="text-gray-600 mb-4">Create your first coupon code for discounts.</p>
              <Button onClick={handleOpenCreate}>Create Coupon</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {coupons.map((coupon) => (
              <Card key={coupon.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex flex-wrap items-center justify-between gap-2">
                    <span>{coupon.code}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${coupon.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                      {coupon.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <p><strong>Type:</strong> {coupon.discount_type}</p>
                    <p><strong>Value:</strong> {coupon.value}</p>
                    <p><strong>Used:</strong> {coupon.used_count || 0}</p>
                    <p><strong>Limit:</strong> {coupon.usage_limit ?? 'Unlimited'}</p>
                    <p><strong>Min Order:</strong> {coupon.min_order_amount ?? 0}</p>
                    <p><strong>Max Discount:</strong> {coupon.max_discount_amount ?? 'N/A'}</p>
                    <p><strong>Visibility:</strong> {coupon.is_public ? 'Public' : 'Private'}</p>
                    <p className="sm:col-span-2"><strong>Expires:</strong> {coupon.expires_at ? new Date(coupon.expires_at).toLocaleString() : 'No expiry'}</p>
                    {coupon.description && <p className="sm:col-span-2"><strong>Description:</strong> {coupon.description}</p>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit(coupon)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(coupon.id)}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
