import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Edit, Trash2, Package, X, Star } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const emptyProduct = {
  name: '',
  description: '',
  price: 0,
  category: '',
  stock: 0,
  images: [],
  tags: [],
  variants: []
};

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/api/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to fetch products');
      // Set empty array to prevent rendering errors
      setProducts([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'price' || name === 'stock' ? Number(value) : value }));
  };

  // New state for selected files and previews
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [variantsJson, setVariantsJson] = useState('[]');

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);

    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  const handleAddProduct = () => {
    setForm(emptyProduct);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setVariantsJson('[]');
    setIsEditing(true);
    setEditingProduct(null);
  };

  const handleEditProduct = (product) => {
    setForm(product);
    setSelectedFiles([]);
    setPreviewUrls(product.images || []);
    setVariantsJson(JSON.stringify(product.variants || [], null, 2));
    setIsEditing(true);
    setEditingProduct(product);
  };

  const handleRemoveImage = (index) => {
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await axios.delete(`${API}/api/products/${productId}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageUrls = form.images || [];

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach(file => formData.append('files', file));

        const uploadResponse = await axios.post(`${API}/api/admin/upload-images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        imageUrls = [...imageUrls, ...uploadResponse.data.urls];
      }

      const productData = { ...form, images: imageUrls };
      try {
        const parsedVariants = JSON.parse(variantsJson || '[]');
        productData.variants = Array.isArray(parsedVariants) ? parsedVariants : [];
      } catch {
        toast.error('Variants JSON is invalid');
        return;
      }

      if (editingProduct) {
        await axios.put(`${API}/api/products/${editingProduct.id}`, productData);
        toast.success('Product updated');
      } else {
        await axios.post(`${API}/api/products`, productData);
        toast.success('Product added');
      }
      setIsEditing(false);
      setForm(emptyProduct);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to save product';
      toast.error(errorMessage);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setForm(emptyProduct);
    setEditingProduct(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center space-x-4 mb-4 sm:mb-0">
            <a href="/admin">
              <Button variant="outline" size="sm" className="flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Admin</span>
              </Button>
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
              <p className="text-sm text-gray-600">Manage your product catalog</p>
            </div>
          </div>
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button onClick={handleAddProduct} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Product Name (Max 150 characters)</Label>
                    <Input
                      id="name"
                      name="name"
                      value={form.name}
                      onChange={handleInputChange}
                      maxLength="150"
                      placeholder="Enter product name..."
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">{form.name.length}/150 characters</p>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={form.description}
                      onChange={handleInputChange}
                      placeholder="Enter detailed product description..."
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Price (₹)</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      name="stock"
                      type="number"
                      min="0"
                      value={form.stock}
                      onChange={handleInputChange}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      name="category"
                      value={form.category}
                      onChange={handleInputChange}
                      placeholder="e.g., Electronics, Clothing, Books..."
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="images">Product Images</Label>
                    <Input
                      id="images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {previewUrls.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">Image Previews:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {previewUrls.map((url, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={url}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="variants">Variants JSON (SKU/attributes/price/stock)</Label>
                    <Textarea
                      id="variants"
                      value={variantsJson}
                      onChange={(e) => setVariantsJson(e.target.value)}
                      rows={6}
                      placeholder='[{"sku":"TSHIRT-BLACK-M","attributes":{"size":"M","color":"Black"},"price":799,"stock":20}]'
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Products Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Products ({products.length})
            </h2>
          </div>

          {products.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="text-center py-16">
                <Package className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No Products Yet</h3>
                <p className="text-gray-500 mb-6">Get started by adding your first product to the catalog.</p>
                <Button onClick={handleAddProduct} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Product
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map(product => (
                <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-gray-300">
                  <CardHeader className="pb-4">
                    <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 mb-4">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center text-gray-400 ${product.images && product.images.length > 0 ? 'hidden' : ''}`}>
                        <Package className="h-12 w-12" />
                      </div>
                    </div>
                    <CardTitle className="text-lg leading-tight truncate" title={product.name}>
                      {product.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]" title={product.description}>
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-green-600">₹{product.price.toFixed(2)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        product.stock > 10 ? 'bg-green-100 text-green-800' :
                        product.stock > 0 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Category: {product.category}</p>

                    {/* Rating Display */}
                    {product.average_rating !== undefined && product.average_rating > 0 && (
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium text-gray-700">
                            {product.average_rating.toFixed(1)}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          ({product.total_ratings || 0} reviews)
                        </span>
                      </div>
                    )}

                    <div className="flex space-x-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditProduct(product)}
                        className="flex-1 hover:bg-blue-50 hover:border-blue-200"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteProduct(product.id)}
                        className="flex-1 hover:bg-red-50"
                      >
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
    </div>
  );
};

export default ProductManagement;
