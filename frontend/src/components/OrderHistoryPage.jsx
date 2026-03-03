// Function component: OrderHistoryPage
// Top-level imports in OrderHistoryPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Package, Clock, CheckCircle, XCircle, Truck, Eye } from 'lucide-react';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}`;

// Function component: OrderHistoryPage
const OrderHistoryPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Moved: dialog state must be before any conditional return
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnOrder, setReturnOrder] = useState(null);
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [userReturns, setUserReturns] = useState([]);
  const [returnAgg, setReturnAgg] = useState({});

  useEffect(() => {
    fetchOrderHistory();
  }, []);

  useEffect(() => {
    const fetchReturns = async () => {
      try {
        const res = await axios.get(`${API}/api/returns`);
        setUserReturns(res.data || []);
        const agg = {};
        (res.data || []).forEach((r) => {
          const key = `${r.order_id}:${r.product_id}`;
          const status = (r.status || '').toLowerCase();
          const qty = Number(r.quantity || 0);
          const prev = agg[key] || { refunded: 0, processed: 0, pending: 0 };
          if (status === 'refunded') prev.refunded += qty;
          if (status === 'refunded' || status === 'received') prev.processed += qty;
          if (status === 'requested' || status === 'approved') prev.pending += qty;
          agg[key] = prev;
        });
        setReturnAgg(agg);
      } catch {
        // ignore
      }
    };
    fetchReturns();
  }, []);

  const fetchOrderHistory = async () => {
    try {
      const response = await axios.get(`${API}/api/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching order history:', error);
      toast.error('Failed to load order history');
    } finally {
      setIsLoading(false);
    }
  };

  // Added: cancelOrder handler used by the "Cancel Order" button
  const cancelOrder = async (orderId) => {
    try {
      await axios.post(`${API}/api/orders/${orderId}/cancel`);
      toast.success('Order cancelled');
      fetchOrderHistory(); // refresh
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error(error.response?.data?.detail || 'Failed to cancel order');
    }
  };

  const keyFor = (orderId, productId) => `${orderId}:${productId}`;
  const getRemainingQty = (order, productId) => {
    const item = order.products?.find(p => p.product_id === productId);
    const total = Number(item?.quantity || 0);
    const agg = returnAgg[keyFor(order.id, productId)] || { processed: 0, pending: 0 };
    const used = Number(agg.processed || 0) + Number(agg.pending || 0);
    return Math.max(0, total - used);
  };
  const isItemRefunded = (orderId, productId, itemQty) => {
    const agg = returnAgg[keyFor(orderId, productId)] || { refunded: 0 };
    return Number(agg.refunded || 0) >= Number(itemQty || 0);
  };
  const hasReturnEligibleItems = (order) => {
    const statusOk = ['delivered', 'shipped'].includes(order.status?.toLowerCase());
    if (!statusOk) return false;
    return (order.products || []).some(it => getRemainingQty(order, it.product_id) > 0);
  };
  const allRefunded = (order) => {
    return (order.products || []).every(it => isItemRefunded(order.id, it.product_id, it.quantity));
  };

  const openReturnDialog = (order) => {
    setReturnOrder(order);
    const firstEligible = (order.products || []).find(it => getRemainingQty(order, it.product_id) > 0);
    setReturnItemId(firstEligible?.product_id || order.products?.[0]?.product_id || '');
    setReturnQty(1);
    setReturnReason('');
    setIsReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!returnOrder || !returnItemId || returnQty <= 0) {
      toast.error('Please select item and quantity');
      return;
    }
    const remaining = getRemainingQty(returnOrder, returnItemId);
    if (remaining <= 0) {
      toast.error('This item has already been refunded/returned');
      return;
    }
    if (returnQty > remaining) {
      toast.error(`Only ${remaining} unit(s) eligible for refund/return`);
      return;
    }
    try {
      await axios.post(`${API}/api/orders/${returnOrder.id}/returns`, {
        product_id: returnItemId,
        quantity: returnQty,
        reason: returnReason
      });
      toast.success('Return request submitted');
      setIsReturnOpen(false);
      // refresh returns agg to reflect latest state
      try {
        const res = await axios.get(`${API}/api/returns`);
        setUserReturns(res.data || []);
      } catch {}
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit return');
    }
  };

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'processing':
        return <Package className="h-4 w-4 text-blue-600" />;
      case 'shipped':
        return <Truck className="h-4 w-4 text-purple-600" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-8">Order History</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 sm:p-6">
                <div className="h-4 bg-gray-200 rounded w-1/3 sm:w-1/4 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3 sm:w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 sm:w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const openDetails = (order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setSelectedOrder(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 overflow-x-hidden">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-8">Order History</h1>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-600 mb-6">You haven't placed any orders yet. Start shopping to see your order history here.</p>
            <Button asChild>
              <a href="/products">Browse Products</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center flex-wrap gap-2">
                    <CardTitle className="text-base sm:text-lg">Order #{order.id.slice(-8)}</CardTitle>
                    <Badge className={getStatusColor(order.status)}>
                      <span className="flex items-center space-x-1">
                        {getStatusIcon(order.status)}
                        <span className="capitalize">{order.status}</span>
                      </span>
                    </Badge>
                    {allRefunded(order) && (
                      <Badge variant="secondary">Refunded</Badge>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(order.total_amount)}</p>
                    <p className="text-xs sm:text-sm text-gray-600">{formatDate(order.created_at)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Order Items */}
                  <div>
                    <h4 className="font-semibold mb-3">Items</h4>
                    <div className="space-y-2">
                      {order.products?.map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-start space-x-3 min-w-0">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                            </div>
                          <div className="min-w-0">
                            <p className="font-medium break-words">{item.name || 'Product'}</p>
                            {isItemRefunded(order.id, item.product_id, item.quantity) && (
                              <Badge variant="secondary" className="ml-2">Refunded</Badge>
                            )}
                            <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <p className="font-semibold">{formatCurrency(item.total)}</p>
                            <p className="text-sm text-gray-600">{formatCurrency(item.price)} each</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <h4 className="font-semibold mb-2">Shipping Address</h4>
                      {order.delivery_address ? (
                        <div className="text-sm text-gray-600">
                          <p>{order.delivery_address.street}</p>
                          <p>{order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.postal_code}</p>
                          <p>{order.delivery_address.country}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">No address provided</p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Payment Method</h4>
                      <p className="text-sm text-gray-600">COD</p>
                      {order.payment_status && (
                        <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'} className="mt-1">
                          {order.payment_status}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Order Actions */}
                  <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4 border-t border-gray-200">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => openDetails(order)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    {['delivered', 'shipped'].includes(order.status?.toLowerCase()) && hasReturnEligibleItems(order) && (
                      <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => openReturnDialog(order)}>
                        Return/Refund
                      </Button>
                    )}
                    {!['delivered', 'shipped'].includes(order.status?.toLowerCase()) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled
                        title="Return/Refund available after shipment/delivery"
                      >
                        Return/Refund
                      </Button>
                    )}
                    {['delivered', 'shipped'].includes(order.status?.toLowerCase()) && !hasReturnEligibleItems(order) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled
                        title={allRefunded(order) ? 'All items refunded' : 'No items eligible'}
                      >
                        {allRefunded(order) ? 'Refunded' : 'Return/Refund'}
                      </Button>
                    )}
                    {(order.status?.toLowerCase() === 'pending' || order.status?.toLowerCase() === 'confirmed') && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => cancelOrder(order.id)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel Order
                      </Button>
                    )}
                  </div>

                  {order.status_history && order.status_history.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="font-semibold mb-2">Order Timeline</h4>
                      <div className="space-y-2">
                        {order.status_history.slice().reverse().map((event, idx) => (
                          <div key={`${order.id}-evt-${idx}`} className="text-sm text-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-gray-50 rounded px-3 py-2">
                            <span className="capitalize">{event.status}</span>
                            <span className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              {selectedOrder ? `Order #${selectedOrder.id?.slice(-8)} • ${new Date(selectedOrder.created_at).toLocaleString()}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <Badge className="text-xs">{selectedOrder.status}</Badge>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xl font-bold text-gray-900">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(selectedOrder.total_amount)}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Items</h4>
                <div className="space-y-2">
                  {selectedOrder.products?.map((item, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium break-words">{item.name || 'Product'}</p>
                          <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="font-semibold">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.total ?? (item.price * item.quantity))}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.price)} each
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Shipping Address</h4>
                  {selectedOrder.delivery_address ? (
                    <div className="text-sm text-gray-600">
                      <p>{selectedOrder.delivery_address.street}</p>
                      <p>{selectedOrder.delivery_address.city}, {selectedOrder.delivery_address.state} {selectedOrder.delivery_address.postal_code}</p>
                      <p>{selectedOrder.delivery_address.country}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No address provided</p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Payment Method</h4>
                  <p className="text-sm text-gray-600">COD</p>
                  {selectedOrder.payment_status && (
                    <Badge variant={selectedOrder.payment_status === 'paid' ? 'default' : 'secondary'} className="mt-1">
                      {selectedOrder.payment_status}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                {['delivered', 'shipped'].includes(selectedOrder.status?.toLowerCase()) && hasReturnEligibleItems(selectedOrder) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      openReturnDialog(selectedOrder);
                    }}
                  >
                    Return/Refund
                  </Button>
                ) : ['delivered', 'shipped'].includes(selectedOrder.status?.toLowerCase()) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title={allRefunded(selectedOrder) ? 'All items refunded' : 'No items eligible'}
                  >
                    {allRefunded(selectedOrder) ? 'Refunded' : 'Return/Refund'}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled title="Return/Refund available after shipment/delivery">
                    Return/Refund
                  </Button>
                )}
              </div>

              {selectedOrder.status_history && selectedOrder.status_history.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="font-semibold mb-2">Timeline</h4>
                  <div className="space-y-2">
                    {selectedOrder.status_history.slice().reverse().map((event, idx) => (
                      <div key={`detail-evt-${idx}`} className="text-sm text-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-gray-50 rounded px-3 py-2">
                        <span className="capitalize">{event.status}</span>
                        <span className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Request Return/Refund</DialogTitle>
            <DialogDescription>
              {returnOrder ? `Order #${returnOrder.id?.slice(-8)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {returnOrder && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Item</label>
                <select
                  value={returnItemId}
                  onChange={(e) => setReturnItemId(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2"
                >
                  {returnOrder.products?.map((it, idx) => (
                    <option key={idx} value={it.product_id}>
                      {it.name} (Qty {it.quantity})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  type="number"
                  min={1}
                  max={getRemainingQty(returnOrder, returnItemId) || 1}
                  value={returnQty}
                  onChange={(e) => setReturnQty(parseInt(e.target.value || '1', 10))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Reason (optional)</label>
                <Textarea
                  placeholder="Share details"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsReturnOpen(false)}>Cancel</Button>
                <Button onClick={submitReturn}>Submit</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OrderHistoryPage;
