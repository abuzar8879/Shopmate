import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package, Eye, Activity } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL?.replace(/\/$/, "");
const API = BACKEND_URL;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function AnalyticsDashboard() {
  const [salesData, setSalesData] = useState(null);
  const [productPerformance, setProductPerformance] = useState(null);
  const [cartAbandonment, setCartAbandonment] = useState(null);
  const [customerInsights, setCustomerInsights] = useState(null);
  const [returnsOverview, setReturnsOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [salesResponse, performanceResponse, cartResponse, customerResponse, returnsResponse] = await Promise.all([
        axios.get(`${API}/api/admin/analytics/sales-overview?days=${timeRange}`),
        axios.get(`${API}/api/admin/analytics/product-performance`),
        axios.get(`${API}/api/admin/analytics/cart-abandonment`),
        axios.get(`${API}/api/admin/analytics/customer-insights`),
        axios.get(`${API}/api/admin/analytics/returns-overview`)
      ]);

      setSalesData(salesResponse.data);
      setProductPerformance(performanceResponse.data);
      setCartAbandonment(cartResponse.data);
      setCustomerInsights(customerResponse.data);
      setReturnsOverview(returnsResponse.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Transform daily sales data for chart
  const getDailySalesChartData = () => {
    if (!salesData?.daily_sales) return [];
    return Object.entries(salesData.daily_sales)
      .map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: amount
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Get top products for bar chart
  const getTopProductsChartData = () => {
    if (!salesData?.top_products) return [];
    return salesData.top_products.slice(0, 8).map(p => ({
      name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
      revenue: p.revenue
    }));
  };

  // Get product performance data
  const getPerformanceChartData = () => {
    if (!productPerformance?.products) return [];
    return productPerformance.products.slice(0, 10).map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      views: p.view_count,
      sales: p.sales_count,
      conversion: p.conversion_rate
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Analytics Dashboard</h1>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Time Range:</span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">₹{salesData?.total_revenue.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{salesData?.total_orders}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <ShoppingCart className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                  <p className="text-2xl font-bold text-gray-900">₹{salesData?.average_order_value.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Activity className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Cart Abandonment</p>
                  <p className="text-2xl font-bold text-gray-900">{cartAbandonment?.abandonment_rate.toFixed(1)}%</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <TrendingDown className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-teal-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Repeat Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{customerInsights?.repeat_customer_rate?.toFixed(1)}%</p>
                </div>
                <div className="p-3 bg-teal-100 rounded-full">
                  <Users className="h-6 w-6 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="sales" className="space-y-6">
          <div className="overflow-x-auto">
          <TabsList className="grid w-[700px] md:w-full grid-cols-5">
            <TabsTrigger value="sales">Sales Overview</TabsTrigger>
            <TabsTrigger value="products">Top Products</TabsTrigger>
            <TabsTrigger value="performance">Product Performance</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="sales" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Sales Trend</CardTitle>
                <CardDescription>Revenue over the selected time period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={getDailySalesChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cart Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Active Carts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{cartAbandonment?.total_active_carts}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Abandoned Carts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-600">{cartAbandonment?.abandoned_carts}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">{cartAbandonment?.conversion_rate.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Products by Revenue</CardTitle>
                <CardDescription>Best performing products in the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={getTopProductsChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Products List */}
            <Card>
              <CardHeader>
                <CardTitle>Top Products Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {salesData?.top_products.slice(0, 5).map((product, index) => (
                    <div key={product.product_id} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded" />
                        ) : (
                          <Package className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{index + 1}. {product.name}</p>
                        <p className="text-sm text-gray-600">Revenue: ₹{product.revenue.toLocaleString()}</p>
                      </div>
                      <Badge variant="secondary">#{index + 1}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Performance Metrics</CardTitle>
                <CardDescription>Views, Sales, and Conversion Rates</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={getPerformanceChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="views" fill="#3b82f6" name="Views" />
                    <Bar yAxisId="left" dataKey="sales" fill="#10b981" name="Sales" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Product</th>
                        <th className="text-right py-3 px-4">Views</th>
                        <th className="text-right py-3 px-4">Sales</th>
                        <th className="text-right py-3 px-4">Conversion</th>
                        <th className="text-right py-3 px-4">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPerformance?.products.slice(0, 10).map((product) => (
                        <tr key={product.product_id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">{product.name}</td>
                          <td className="text-right py-3 px-4">{product.view_count}</td>
                          <td className="text-right py-3 px-4">{product.sales_count}</td>
                          <td className="text-right py-3 px-4">
                            <Badge variant={product.conversion_rate > 5 ? "default" : "secondary"}>
                              {product.conversion_rate}%
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-4">
                            <Badge variant={product.current_stock < 10 ? "destructive" : "secondary"}>
                              {product.current_stock}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Cohorts</CardTitle>
                <CardDescription>Monthly new customers and repeat behavior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(customerInsights?.monthly_cohorts || {}).map(([month, stats]) => (
                    <div key={month} className="border rounded p-3 flex items-center justify-between">
                      <span className="font-medium">{month}</span>
                      <span className="text-sm text-gray-600">New: {stats.new_customers} | Orders: {stats.orders} | Revenue: ₹{Number(stats.revenue || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="returns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Returns Overview</CardTitle>
                <CardDescription>Overall return rate: {returnsOverview?.overall_return_rate}%</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(returnsOverview?.by_category || []).map((row) => (
                    <div key={row.category} className="border rounded p-3 flex items-center justify-between">
                      <span className="font-medium">{row.category}</span>
                      <span className="text-sm text-gray-600">Returned {row.returned_qty}/{row.ordered_qty} ({row.return_rate}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
