// Function component: OrderManagement
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Function component: OrderManagement
const OrderManagement = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch orders');
      // Set empty array to prevent rendering errors
      setOrders([]);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await axios.put(`${API}/api/admin/orders/${orderId}?status=${newStatus}`);
      toast.success('Order status updated');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center flex-wrap gap-3 mb-6">
          <a href="/admin">
            <Button className="flex items-center space-x-2 bg-black text-white hover:bg-gray-800">
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          </a>
          <h1 className="text-2xl sm:text-3xl font-bold">Manage Orders</h1>
        </div>
        <div className="space-y-4">
          {orders.map(order => (
            <Card key={order.id || order._id}>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Order #{order.id ? order.id.slice(-8) : 'N/A'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>User ID:</strong> {order.user_id ? order.user_id.slice(-8) : 'N/A'}</p>
                    <p><strong>Total Amount:</strong> ${order.total_amount ? order.total_amount.toFixed(2) : '0.00'}</p>
                    <p><strong>Status:</strong> {order.status || 'N/A'}</p>
                    <p><strong>Payment Method:</strong> COD</p>
                    <p><strong>Created:</strong> {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</p>
                    {order.order_id && (
                      <p><strong>Order ID:</strong> {order.order_id}</p>
                    )}
                  </div>
                  <div>
                    <p><strong>Status:</strong></p>
                    <Select
                      value={order.status || 'pending'}
                      onValueChange={(value) => handleStatusChange(order.id, value)}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Display COD order items if available */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold">Products:</h4>
                    <ul className="list-disc list-inside">
                      {order.items.map((item, index) => (
                        <li key={index}>
                          {item.name} - Quantity: {item.quantity} - Price: ₹{item.price ? item.price.toFixed(2) : '0.00'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Display Stripe order products if available */}
                {order.products && order.products.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold">Products:</h4>
                    <ul className="list-disc list-inside">
                      {order.products.map((item, index) => (
                        <li key={index}>
                          {item.name || item.product_id.slice(-8)} - Quantity: {item.quantity} - Price: ₹{item.price ? item.price.toFixed(2) : '0.00'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Display delivery address for COD orders */}
                {order.delivery_address && (
                  <div className="mt-4">
                    <h4 className="font-semibold">Delivery Address:</h4>
                    <div className="text-sm text-gray-600">
                      <p>{order.delivery_address.full_name}</p>
                      <p>{order.delivery_address.street_address}</p>
                      <p>{order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.pincode}</p>
                      <p>{order.delivery_address.country}</p>
                    </div>
                  </div>
                )}

                {order.status_history && order.status_history.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold">Status Timeline:</h4>
                    <div className="space-y-2 mt-2">
                      {order.status_history.slice().reverse().map((event, idx) => (
                        <div key={`status-${idx}`} className="text-sm bg-gray-100 rounded px-3 py-2 flex items-center justify-between">
                          <span className="capitalize">{event.status}</span>
                          <span className="text-gray-500">{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
export default OrderManagement;
