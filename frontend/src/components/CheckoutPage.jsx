import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth, useCart } from '../App'; // Assuming useAuth is exported from App.js or adjust import accordingly
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const API = process.env.REACT_APP_BACKEND_URL;

const CheckoutPage = () => {
  const { user, updateUser } = useAuth();
  const { cartItems, clearCart, getTotalPrice } = useCart();

  // Check if this is a buy now checkout
  const [buyNowItem, setBuyNowItem] = useState(null);
  const [isBuyNow, setIsBuyNow] = useState(false);
  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: ''
  });
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [loading, setLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponMeta, setCouponMeta] = useState(null);
  const [failedOrderPayload, setFailedOrderPayload] = useState(null);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offersOpen, setOffersOpen] = useState(false);

  useEffect(() => {
    // Check if this is a buy now checkout from URL state or localStorage
    const buyNowData = localStorage.getItem('buyNowItem');
    if (buyNowData) {
      try {
        const item = JSON.parse(buyNowData);
        setBuyNowItem(item);
        setIsBuyNow(true);
      } catch (error) {
        console.error('Error parsing buy now data:', error);
        localStorage.removeItem('buyNowItem');
      }
    }

    if (user) {
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const userData = response.data;
      setFullName(userData.name || '');
      setEmail(userData.email || '');
      setPhoneNumber(userData.mobile_number || '');
      setAddress({
        street: userData.delivery_address?.street || '',
        city: userData.delivery_address?.city || '',
        state: userData.delivery_address?.state || '',
        postal_code: userData.delivery_address?.postal_code || userData.delivery_address?.pincode || '',
        country: userData.delivery_address?.country || ''
      });
      setLoading(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch user data');
      setLoading(false);
    }
  };

  const getCheckoutTotal = () => (isBuyNow ? (buyNowItem?.total || 0) : getTotalPrice());

  const fetchAvailableCoupons = async () => {
    setLoadingOffers(true);
    try {
      const response = await axios.get(`${API}/api/coupons/available`);
      setAvailableCoupons(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setAvailableCoupons([]);
    } finally {
      setLoadingOffers(false);
    }
  };

  useEffect(() => {
    fetchAvailableCoupons();
  }, []);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleAddressChange = (field, value) => {
    setAddress(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAddress = async () => {
    try {
      // Prepare address data with postal_code instead of pincode to match backend schema
      const deliveryAddress = {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        postal_code: address.postal_code || '',
        country: address.country || '',
        full_name: fullName || '',
        phone_number: phoneNumber || ''
      };

      // Basic client-side validation for required fields
      if (
        !fullName ||
        !email ||
        !deliveryAddress.street ||
        !deliveryAddress.city ||
        !deliveryAddress.state ||
        !deliveryAddress.postal_code ||
        !deliveryAddress.country
      ) {
        toast.error('Please fill in all required fields.');
        return;
      }

      const updatedData = {
        name: fullName,
        email,
        mobile_number: phoneNumber,
        delivery_address: deliveryAddress
      };

      console.log('Submitting profile update payload:', updatedData);

      const response = await axios.put(`${API}/api/users/profile`, updatedData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      updateUser(response.data);
      toast.success('Address updated successfully');
      setIsEditing(false);
    } catch (error) {
      // Handle validation errors gracefully
      if (error.response?.status === 422 && error.response?.data) {
        // Extract error messages from validation error object
        const validationErrors = error.response.data;
        let messages = [];
        if (Array.isArray(validationErrors)) {
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
        toast.error(messages.join(', '));
      } else {
        toast.error(error.response?.data?.detail || 'Failed to update address');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p>Loading...</p>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    setIsPlacingOrder(true);
    try {
      let orderData;
      let apiEndpoint;

      if (isBuyNow && buyNowItem) {
        // Buy now order
        orderData = {
          products: [{
            product_id: buyNowItem.product.id,
            name: buyNowItem.product.name,
            variant_sku: buyNowItem.variant_sku || null,
            quantity: buyNowItem.quantity,
            price: buyNowItem.variant_price || buyNowItem.product.price,
            total: buyNowItem.total
          }],
          total_amount: buyNowItem.total
        };
        apiEndpoint = `${API}/api/orders/buy-now`;
      } else {
        // Regular cart order
        orderData = {
          products: cartItems.map(item => ({
            product_id: item.product.id,
            name: item.product.name,
            variant_sku: item.variant_sku || null,
            quantity: item.quantity,
            price: item.product.price,
            total: item.product.price * item.quantity
          })),
          total_amount: getTotalPrice()
        };
        apiEndpoint = `${API}/api/orders`;
      }

      if (couponMeta?.coupon_code) {
        orderData.coupon_code = couponMeta.coupon_code;
      }

      // Create order via API
      const response = await axios.post(apiEndpoint, orderData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Clear cart if it was a cart order
      if (!isBuyNow) {
        clearCart();
      } else {
        localStorage.removeItem('buyNowItem');
      }

      // Use the order_id from backend response (sequential format like "0001")
      const backendOrderId = response.data.order_id || response.data.id;
      setFailedOrderPayload(null);

      // Redirect to success page
      window.location.href = `/order-success/${backendOrderId}`;
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error(error.response?.data?.detail || 'Failed to place order');
      setFailedOrderPayload({
        coupon_code: couponMeta?.coupon_code || null
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleValidateCoupon = async (inputCode = null) => {
    const cartTotal = getCheckoutTotal();
    const codeToValidate = (inputCode || couponCode).trim().toUpperCase();
    if (!codeToValidate) {
      toast.error('Enter coupon code');
      return;
    }
    try {
      const response = await axios.get(`${API}/api/coupons/validate`, {
        params: { code: codeToValidate, cart_total: cartTotal }
      });
      setCouponCode(codeToValidate);
      setCouponMeta(response.data);
      toast.success('Coupon applied');
    } catch (error) {
      setCouponMeta(null);
      const detail = error.response?.data?.detail || 'Invalid coupon';
      const match = String(detail).match(/Minimum order amount for this coupon is\s*([0-9.]+)/i);
      if (match) {
        const requiredAmount = Number(match[1]);
        if (!Number.isNaN(requiredAmount) && cartTotal < requiredAmount) {
          toast.error(`Add Rs ${(requiredAmount - cartTotal).toFixed(2)} more to use this coupon`);
          return;
        }
      }
      toast.error(detail);
    }
  };

  const handleCopyCoupon = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}`);
    } catch (error) {
      toast.error('Failed to copy coupon code');
    }
  };

  const cartTotal = getCheckoutTotal();

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 ui-surface-strong rounded-2xl mt-4 sm:mt-10">
      <h1 className="ui-display text-xl sm:text-2xl font-bold mb-6">Checkout</h1>

      <div className="mb-6">
        <Label>Full Name</Label>
        <Input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          disabled={!isEditing}
          className="mb-2"
        />
      </div>

      <div className="mb-6">
        <Label>Email</Label>
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={!isEditing}
          className="mb-2"
        />
      </div>

      <div className="mb-6">
        <Label>Phone Number</Label>
        <Input
          value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)}
          disabled={!isEditing}
          className="mb-2"
        />
      </div>

      <h2 className="text-xl font-semibold mb-4">Delivery Address</h2>

      <div className="mb-4">
        <Label>Street</Label>
        <Input
          value={address.street}
          onChange={e => handleAddressChange('street', e.target.value)}
          disabled={!isEditing}
          className="mb-2"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label>City</Label>
          <Input
            value={address.city}
            onChange={e => handleAddressChange('city', e.target.value)}
            disabled={!isEditing}
            className="mb-2"
          />
        </div>
        <div>
          <Label>State</Label>
          <Input
            value={address.state}
            onChange={e => handleAddressChange('state', e.target.value)}
            disabled={!isEditing}
            className="mb-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Postal Code</Label>
          <Input
            value={address.postal_code}
            onChange={e => handleAddressChange('postal_code', e.target.value)}
            disabled={!isEditing}
            className="mb-2"
          />
        </div>
        <div>
          <Label>Country</Label>
          <Input
            value={address.country}
            onChange={e => handleAddressChange('country', e.target.value)}
            disabled={!isEditing}
            className="mb-2"
          />
        </div>
      </div>

      <div className="flex space-x-4 mb-6">
        {!isEditing ? (
          <>
            <Button onClick={handleEditToggle}>Edit Address</Button>
            <Button onClick={() => toast('Address confirmed')} variant="outline">Confirm Address</Button>
          </>
        ) : (
          <>
            <Button onClick={handleSaveAddress}>Save</Button>
            <Button onClick={handleEditToggle} variant="outline">Cancel</Button>
          </>
        )}
      </div>

      <div className="mb-6">
        <Label>Payment Method</Label>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COD">Cash on Delivery (COD)</SelectItem>
            <SelectItem value="MoreOptions" disabled>More Options Coming Soon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6">
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-between"
          onClick={() => setOffersOpen(prev => !prev)}
        >
          <span>Available Offers</span>
          <span>{offersOpen ? '▲' : '▼'}</span>
        </Button>
        {offersOpen && (
          <div className="mt-3">
            {loadingOffers ? (
              <p className="text-sm text-gray-500">Loading offers...</p>
            ) : availableCoupons.length === 0 ? (
              <p className="text-sm text-gray-500">No public offers right now.</p>
            ) : (
              <div className="space-y-3">
                {availableCoupons.map((coupon) => {
                  const isEligible = cartTotal >= Number(coupon.min_order_amount || 0);
                  const deficit = Math.max(0, Number(coupon.min_order_amount || 0) - cartTotal);
                  return (
                    <Card key={coupon.code} className="border border-gray-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{coupon.code}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 text-sm">
                        <p>
                          {coupon.discount_type === 'percentage'
                            ? `${coupon.value}% OFF`
                            : `Rs ${Number(coupon.value || 0).toFixed(2)} OFF`}
                          {' | '}
                          Min order Rs {Number(coupon.min_order_amount || 0).toFixed(2)}
                        </p>
                        {coupon.max_discount_amount != null && (
                          <p>Max discount Rs {Number(coupon.max_discount_amount).toFixed(2)}</p>
                        )}
                        {coupon.expires_at && (
                          <p>Expires: {new Date(coupon.expires_at).toLocaleString()}</p>
                        )}
                        {coupon.description && <p className="text-gray-600">{coupon.description}</p>}
                        {!isEligible && (
                          <p className="text-amber-600 mt-1">
                            Add Rs {deficit.toFixed(2)} more to use this coupon
                          </p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button type="button" variant="outline" onClick={() => handleCopyCoupon(coupon.code)}>
                            Copy Code
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleValidateCoupon(coupon.code)}
                            disabled={!isEligible}
                          >
                            Apply at Checkout
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-6">
        <Label>Coupon Code</Label>
        <div className="flex gap-2 mt-2">
          <Input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Enter coupon"
          />
          <Button type="button" variant="outline" onClick={() => handleValidateCoupon()}>Apply</Button>
        </div>
        {couponMeta && (
          <p className="text-sm text-green-600 mt-2">
            Applied {couponMeta.coupon_code}: Discount Rs {couponMeta.discount_amount} | Final Rs {couponMeta.final_total}
          </p>
        )}
      </div>

      <Button
        onClick={handlePlaceOrder}
        disabled={isPlacingOrder || (!isBuyNow && cartItems.length === 0)}
        className="w-full"
      >
        {isPlacingOrder ? 'Placing Order...' : `Place Order - Rs ${(
          couponMeta?.final_total ?? cartTotal
        )?.toFixed(2)}`}
      </Button>
      {failedOrderPayload && (
        <div className="mt-4">
          <Button variant="outline" className="w-full" onClick={handlePlaceOrder}>
            Retry Failed Order
          </Button>
        </div>
      )}
    </div>
  );
};


export default CheckoutPage;
   



