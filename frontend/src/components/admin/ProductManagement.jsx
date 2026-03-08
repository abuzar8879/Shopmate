import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Edit, Trash2, Package, X, Star, Pencil } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const emptyProduct = {
  name: '',
  description: '',
  price: 0,
  category: '',
  brand: '',
  stock: 0,
  images: [],
  tags: [],
  variants: [],
  specifications: {}
};

const parseNumberInput = (value) => {
  if (value === '') {
    return 0;
  }
  return Number(value);
};

const createLocalId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createVariantOption = (name = '', values = []) => ({
  id: createLocalId(),
  name,
  valuesText: values.join(', ')
});

const toSkuSegment = (value) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'NA';
};

const buildAttributeSignature = (attributes, optionNames) =>
  optionNames.map((name) => `${name}:${attributes?.[name] || ''}`).join('||');

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
    setForm(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'stock' ? parseNumberInput(value) : value
    }));
  };

  // Form companion state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingImageUrls, setExistingImageUrls] = useState([]);
  const [newImagePreviewUrls, setNewImagePreviewUrls] = useState([]);
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [variantOptions, setVariantOptions] = useState([createVariantOption()]);
  const [variantRows, setVariantRows] = useState([]);
  const [bulkVariantPrice, setBulkVariantPrice] = useState('');
  const [bulkVariantStock, setBulkVariantStock] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [specificationsJson, setSpecificationsJson] = useState('{}');

  const knownCategories = useMemo(
    () => [...new Set(products.map((p) => (p.category || '').trim()).filter(Boolean))],
    [products]
  );
  const knownBrands = useMemo(
    () => [...new Set(products.map((p) => (p.brand || '').trim()).filter(Boolean))],
    [products]
  );
  const sanitizedOptionNames = useMemo(() => {
    const unique = [];
    variantOptions.forEach((option) => {
      const optionName = option.name.trim();
      if (!optionName) {
        return;
      }
      if (!unique.includes(optionName)) {
        unique.push(optionName);
      }
    });
    return unique;
  }, [variantOptions]);
  const variantStockTotal = useMemo(
    () =>
      variantRows
        .filter((row) => row.enabled !== false)
        .reduce((sum, row) => sum + Math.max(0, Number(row?.stock || 0)), 0),
    [variantRows]
  );
  const hasVariants = variantsEnabled;

  useEffect(() => {
    return () => {
      newImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newImagePreviewUrls]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    newImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles(files);
    setNewImagePreviewUrls(files.map((file) => URL.createObjectURL(file)));
  };

  const resetVariantBuilder = () => {
    setVariantsEnabled(false);
    setVariantOptions([createVariantOption()]);
    setVariantRows([]);
    setBulkVariantPrice('');
    setBulkVariantStock('');
  };

  const sanitizeVariantOptions = (options) => {
    const result = [];
    const seen = new Set();
    options.forEach((option) => {
      const optionName = option.name.trim();
      if (!optionName || seen.has(optionName)) {
        return;
      }
      const values = [...new Set(
        option.valuesText
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      )];
      if (values.length === 0) {
        return;
      }
      seen.add(optionName);
      result.push({ name: optionName, values });
    });
    return result;
  };

  const buildVariantCombinations = (options) => {
    if (!options.length) {
      return [];
    }
    let combinations = [{}];
    options.forEach((option) => {
      const next = [];
      combinations.forEach((combo) => {
        option.values.forEach((value) => {
          next.push({ ...combo, [option.name]: value });
        });
      });
      combinations = next;
    });
    return combinations;
  };

  const generateVariantsFromOptions = () => {
    const normalizedOptions = sanitizeVariantOptions(variantOptions);
    if (normalizedOptions.length === 0) {
      toast.error('Add at least one option with values (example: Color = Black, Blue)');
      return;
    }

    const combinations = buildVariantCombinations(normalizedOptions);
    if (combinations.length === 0) {
      toast.error('Unable to build variant combinations');
      return;
    }
    if (combinations.length > 120) {
      toast.error('Too many combinations. Keep variant combinations under 120.');
      return;
    }

    const optionNames = normalizedOptions.map((option) => option.name);
    const existingBySignature = new Map(
      variantRows.map((row) => [buildAttributeSignature(row.attributes, optionNames), row])
    );
    const namePrefix = toSkuSegment(form.name || 'SKU').slice(0, 24);

    const nextRows = combinations.map((attributes, index) => {
      const signature = buildAttributeSignature(attributes, optionNames);
      const existingRow = existingBySignature.get(signature);
      if (existingRow) {
        return {
          ...existingRow,
          attributes: optionNames.reduce((acc, optionName) => {
            acc[optionName] = existingRow.attributes?.[optionName] ?? attributes[optionName] ?? '';
            return acc;
          }, {})
        };
      }

      const attrPart = optionNames
        .map((name) => toSkuSegment(attributes[name]))
        .join('-')
        .slice(0, 40);
      return {
        id: createLocalId(),
        sku: `${namePrefix}-${attrPart || index + 1}`,
        attributes,
        price: '',
        stock: 0,
        image: '',
        enabled: true
      };
    });

    setVariantRows(nextRows);
    setVariantsEnabled(true);
    toast.success(`Generated ${nextRows.length} variants`);
  };

  const handleVariantOptionFieldChange = (optionId, field, value) => {
    setVariantOptions((prev) =>
      prev.map((option) => (option.id === optionId ? { ...option, [field]: value } : option))
    );
  };

  const addVariantOption = () => {
    setVariantOptions((prev) => [...prev, createVariantOption()]);
  };

  const removeVariantOption = (optionId) => {
    setVariantOptions((prev) => {
      const next = prev.filter((option) => option.id !== optionId);
      return next.length > 0 ? next : [createVariantOption()];
    });
  };

  const addCustomVariantRow = () => {
    const attributes = sanitizedOptionNames.reduce((acc, optionName) => {
      acc[optionName] = '';
      return acc;
    }, {});
    setVariantRows((prev) => [
      ...prev,
      {
        id: createLocalId(),
        sku: `${toSkuSegment(form.name || 'SKU')}-${prev.length + 1}`,
        attributes,
        price: '',
        stock: 0,
        image: '',
        enabled: true
      }
    ]);
    setVariantsEnabled(true);
  };

  const updateVariantRow = (rowId, updates) => {
    setVariantRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)));
  };

  const updateVariantAttribute = (rowId, optionName, value) => {
    setVariantRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              attributes: {
                ...(row.attributes || {}),
                [optionName]: value
              }
            }
          : row
      )
    );
  };

  const duplicateVariantRow = (rowId) => {
    setVariantRows((prev) => {
      const source = prev.find((row) => row.id === rowId);
      if (!source) {
        return prev;
      }
      const duplicateSuffix = toSkuSegment(source.sku || 'DUP');
      const duplicatedRow = {
        ...source,
        id: createLocalId(),
        sku: `${duplicateSuffix}-COPY`
      };
      return [...prev, duplicatedRow];
    });
  };

  const removeVariantRow = (rowId) => {
    setVariantRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleVariantImageUpload = async (rowId, file) => {
    if (!file) {
      return;
    }
    try {
      const formData = new FormData();
      formData.append('files', file);
      const uploadResponse = await axios.post(`${API}/api/admin/upload-images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploadedImageUrl = uploadResponse?.data?.urls?.[0];
      if (!uploadedImageUrl) {
        toast.error('Image upload failed');
        return;
      }
      updateVariantRow(rowId, { image: uploadedImageUrl });
      toast.success('Variant image updated');
    } catch (error) {
      toast.error('Failed to upload variant image');
    }
  };

  const applyBulkVariantValues = () => {
    if (variantRows.length === 0) {
      toast.error('Add variant rows first');
      return;
    }

    const hasPrice = bulkVariantPrice !== '';
    const hasStock = bulkVariantStock !== '';

    if (!hasPrice && !hasStock) {
      toast.error('Set bulk price or stock before applying');
      return;
    }

    if (hasStock && Number.isNaN(Number(bulkVariantStock))) {
      toast.error('Bulk stock must be a number');
      return;
    }
    if (hasPrice && Number.isNaN(Number(bulkVariantPrice))) {
      toast.error('Bulk price must be a number');
      return;
    }

    setVariantRows((prev) =>
      prev.map((row) => ({
        ...row,
        price: hasPrice ? String(Math.max(0, Number(bulkVariantPrice))) : row.price,
        stock: hasStock ? Math.max(0, Number(bulkVariantStock)) : row.stock
      }))
    );
    toast.success('Bulk values applied');
  };

  const handleAddProduct = () => {
    newImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setForm(emptyProduct);
    setSelectedFiles([]);
    setExistingImageUrls([]);
    setNewImagePreviewUrls([]);
    resetVariantBuilder();
    setTagsInput('');
    setSpecificationsJson('{}');
    setIsEditing(true);
    setEditingProduct(null);
  };

  const handleEditProduct = (product) => {
    const normalizedProduct = {
      name: product.name || '',
      description: product.description || '',
      price: Number(product.price || 0),
      category: product.category || '',
      brand: product.brand || '',
      stock: Number(product.stock || 0),
      images: Array.isArray(product.images) ? product.images : [],
      tags: Array.isArray(product.tags) ? product.tags : [],
      variants: Array.isArray(product.variants) ? product.variants : [],
      specifications: product.specifications && typeof product.specifications === 'object' ? product.specifications : {}
    };
    setForm(normalizedProduct);
    setSelectedFiles([]);
    setExistingImageUrls(normalizedProduct.images);
    setNewImagePreviewUrls([]);
    setTagsInput(normalizedProduct.tags.join(', '));
    setSpecificationsJson(JSON.stringify(normalizedProduct.specifications, null, 2));
    if (normalizedProduct.variants.length > 0) {
      const optionNames = [...new Set(
        normalizedProduct.variants.flatMap((variant) => Object.keys(variant.attributes || {}))
      )];
      const optionRows = optionNames.length > 0
        ? optionNames.map((optionName) => {
            const values = [...new Set(
              normalizedProduct.variants
                .map((variant) => (variant.attributes || {})[optionName])
                .filter(Boolean)
            )];
            return createVariantOption(optionName, values);
          })
        : [createVariantOption()];
      const variantRowsFromProduct = normalizedProduct.variants.map((variant) => ({
        id: createLocalId(),
        sku: variant.sku || '',
        attributes: variant.attributes || {},
        price: variant.price === null || variant.price === undefined ? '' : String(variant.price),
        stock: Math.max(0, Number(variant.stock || 0)),
        image: variant.image || '',
        enabled: true
      }));
      setVariantsEnabled(true);
      setVariantOptions(optionRows);
      setVariantRows(variantRowsFromProduct);
    } else {
      resetVariantBuilder();
    }
    setIsEditing(true);
    setEditingProduct(product);
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
    const trimmedName = form.name.trim();
    const trimmedDescription = form.description.trim();
    const trimmedCategory = form.category.trim();
    const trimmedBrand = (form.brand || '').trim();

    if (!trimmedName || !trimmedDescription || !trimmedCategory) {
      toast.error('Name, description, and category are required');
      return;
    }

    let parsedVariants = [];
    if (variantsEnabled) {
      const normalizedOptions = sanitizeVariantOptions(variantOptions);
      if (normalizedOptions.length === 0) {
        toast.error('Add at least one variant option with values');
        return;
      }

      const enabledRows = variantRows.filter((row) => row.enabled !== false);
      if (enabledRows.length === 0) {
        toast.error('Add at least one enabled variant row');
        return;
      }

      const skuSet = new Set();
      for (const [index, row] of enabledRows.entries()) {
        const sku = String(row.sku || '').trim();
        if (!sku) {
          toast.error(`Variant row ${index + 1}: SKU is required`);
          return;
        }
        if (skuSet.has(sku.toLowerCase())) {
          toast.error(`Duplicate SKU found: ${sku}`);
          return;
        }
        skuSet.add(sku.toLowerCase());

        const attributes = {};
        for (const option of normalizedOptions) {
          const value = String(row.attributes?.[option.name] || '').trim();
          if (!value) {
            toast.error(`Variant ${sku}: ${option.name} is required`);
            return;
          }
          attributes[option.name] = value;
        }

        const stock = Number(row.stock);
        if (Number.isNaN(stock) || stock < 0) {
          toast.error(`Variant ${sku}: stock must be a valid non-negative number`);
          return;
        }

        let price = null;
        if (row.price !== '' && row.price !== null && row.price !== undefined) {
          const numericPrice = Number(row.price);
          if (Number.isNaN(numericPrice) || numericPrice < 0) {
            toast.error(`Variant ${sku}: price must be a valid non-negative number`);
            return;
          }
          price = numericPrice;
        }

        parsedVariants.push({
          sku,
          attributes,
          price,
          image: row.image ? String(row.image).trim() : null,
          stock: Math.max(0, Number(stock))
        });
      }
    }

    let parsedSpecifications = {};
    try {
      parsedSpecifications = JSON.parse(specificationsJson || '{}');
      if (typeof parsedSpecifications !== 'object' || Array.isArray(parsedSpecifications) || parsedSpecifications === null) {
        toast.error('Specifications JSON must be an object');
        return;
      }
    } catch {
      toast.error('Specifications JSON is invalid');
      return;
    }

    const parsedTags = [...new Set(
      tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )];

    try {
      let imageUrls = [...existingImageUrls];

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((file) => formData.append('files', file));

        const uploadResponse = await axios.post(`${API}/api/admin/upload-images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        imageUrls = [...imageUrls, ...(uploadResponse.data.urls || [])];
      }

      const productData = {
        ...form,
        name: trimmedName,
        description: trimmedDescription,
        category: trimmedCategory,
        brand: trimmedBrand || null,
        price: Number(form.price || 0),
        stock: variantsEnabled
          ? parsedVariants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0)
          : Math.max(0, Number(form.stock || 0)),
        images: imageUrls,
        tags: parsedTags,
        variants: parsedVariants,
        specifications: Object.keys(parsedSpecifications).length ? parsedSpecifications : null
      };

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
      setExistingImageUrls([]);
      setNewImagePreviewUrls([]);
      resetVariantBuilder();
      setTagsInput('');
      setSpecificationsJson('{}');
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to save product';
      toast.error(errorMessage);
    }
  };

  const handleCancel = () => {
    newImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setIsEditing(false);
    setForm(emptyProduct);
    setSelectedFiles([]);
    setExistingImageUrls([]);
    setNewImagePreviewUrls([]);
    resetVariantBuilder();
    setTagsInput('');
    setSpecificationsJson('{}');
    setEditingProduct(null);
  };

  const handleRemoveExistingImage = (index) => {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveNewImage = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviewUrls((prev) => {
      if (prev[index]) {
        URL.revokeObjectURL(prev[index]);
      }
      return prev.filter((_, i) => i !== index);
    });
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
          <Dialog
            open={isEditing}
            onOpenChange={(open) => {
              if (!open) {
                handleCancel();
                return;
              }
              setIsEditing(true);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={handleAddProduct} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Product Name (Max 200 characters)</Label>
                    <Input
                      id="name"
                      name="name"
                      value={form.name}
                      onChange={handleInputChange}
                      maxLength="200"
                      placeholder="Enter product name..."
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">{form.name.length}/200 characters</p>
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
                      value={hasVariants ? variantStockTotal : form.stock}
                      onChange={handleInputChange}
                      placeholder="0"
                      disabled={hasVariants}
                      required
                    />
                    {hasVariants && (
                      <p className="text-xs text-gray-500 mt-1">
                        Auto-calculated from variants stock.
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      name="category"
                      value={form.category}
                      onChange={handleInputChange}
                      list="category-options"
                      placeholder="e.g., Electronics, Clothing, Books..."
                      required
                    />
                    <datalist id="category-options">
                      {knownCategories.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      name="brand"
                      value={form.brand}
                      onChange={handleInputChange}
                      list="brand-options"
                      placeholder="e.g., Apple, Samsung, Nike"
                    />
                    <datalist id="brand-options">
                      {knownBrands.map((brand) => (
                        <option key={brand} value={brand} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input
                      id="tags"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="gaming, wireless, premium"
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
                    {existingImageUrls.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">Current Images:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {existingImageUrls.map((url, index) => (
                            <div key={`${url}-${index}`} className="relative group">
                              <img
                                src={url}
                                alt={`Current ${index + 1}`}
                                className="w-full h-24 object-cover rounded-lg border"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveExistingImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {newImagePreviewUrls.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">New Uploads:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {newImagePreviewUrls.map((url, index) => (
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
                                onClick={() => handleRemoveNewImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2 rounded-xl border border-gray-200 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label htmlFor="variants-enabled">Variants</Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Use variants for options like size, color, storage, etc.
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          id="variants-enabled"
                          type="checkbox"
                          checked={variantsEnabled}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setVariantsEnabled(checked);
                            if (!checked) {
                              setVariantRows([]);
                              setVariantOptions([createVariantOption()]);
                              setBulkVariantPrice('');
                              setBulkVariantStock('');
                            }
                          }}
                        />
                        Enable
                      </label>
                    </div>

                    {variantsEnabled ? (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-800">Option Groups</p>
                            <Button type="button" variant="outline" size="sm" onClick={addVariantOption}>
                              <Plus className="h-4 w-4 mr-1" />
                              Add Option
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {variantOptions.map((option, optionIndex) => (
                              <div key={option.id} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-end">
                                <div>
                                  <Label className="text-xs text-gray-500">Option Name</Label>
                                  <Input
                                    value={option.name}
                                    onChange={(e) => handleVariantOptionFieldChange(option.id, 'name', e.target.value)}
                                    placeholder={optionIndex === 0 ? 'Color' : 'Size'}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">Values (comma separated)</Label>
                                  <Input
                                    value={option.valuesText}
                                    onChange={(e) => handleVariantOptionFieldChange(option.id, 'valuesText', e.target.value)}
                                    placeholder={optionIndex === 0 ? 'Black, Blue, Red' : 'S, M, L'}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-10"
                                  onClick={() => removeVariantOption(option.id)}
                                  disabled={variantOptions.length === 1}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={generateVariantsFromOptions}>
                            Generate Variants
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={addCustomVariantRow}>
                            Add Custom Row
                          </Button>
                        </div>

                        {variantRows.length > 0 && (
                          <div className="space-y-3">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                              <p className="text-xs font-medium text-gray-600 mb-2">Bulk Update</p>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={bulkVariantPrice}
                                  onChange={(e) => setBulkVariantPrice(e.target.value)}
                                  placeholder="Set all price overrides"
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={bulkVariantStock}
                                  onChange={(e) => setBulkVariantStock(e.target.value)}
                                  placeholder="Set all stock"
                                />
                                <Button type="button" variant="outline" onClick={applyBulkVariantValues}>
                                  Apply to All
                                </Button>
                              </div>
                            </div>

                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr className="text-left text-gray-600">
                                    <th className="px-3 py-2 font-medium">Attributes</th>
                                    <th className="px-3 py-2 font-medium">Image</th>
                                    <th className="px-3 py-2 font-medium">SKU</th>
                                    <th className="px-3 py-2 font-medium">Price Override</th>
                                    <th className="px-3 py-2 font-medium">Stock</th>
                                    <th className="px-3 py-2 font-medium">Active</th>
                                    <th className="px-3 py-2 font-medium">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {variantRows.map((row) => (
                                    <tr key={row.id} className="border-t border-gray-100">
                                      <td className="px-3 py-2">
                                        {sanitizedOptionNames.length > 0 ? (
                                          <div className="grid grid-cols-1 gap-1 min-w-[220px]">
                                            {sanitizedOptionNames.map((optionName) => (
                                              <Input
                                                key={`${row.id}-${optionName}`}
                                                value={row.attributes?.[optionName] || ''}
                                                onChange={(e) => updateVariantAttribute(row.id, optionName, e.target.value)}
                                                placeholder={optionName}
                                              />
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-gray-500">Define option groups first</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 min-w-[140px]">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-500">
                                            {row.image ? 'Image set' : 'No image'}
                                          </span>
                                          <label className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  handleVariantImageUpload(row.id, file);
                                                }
                                                e.target.value = '';
                                              }}
                                            />
                                            <Pencil className="h-4 w-4 text-gray-700" />
                                            <span>{row.image ? 'Change' : 'Upload'}</span>
                                          </label>
                                          {row.image ? (
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="h-8 px-2 text-xs"
                                              onClick={() => updateVariantRow(row.id, { image: '' })}
                                            >
                                              Remove
                                            </Button>
                                          ) : null}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 min-w-[180px]">
                                        <Input
                                          value={row.sku}
                                          onChange={(e) => updateVariantRow(row.id, { sku: e.target.value })}
                                          placeholder="SKU"
                                        />
                                      </td>
                                      <td className="px-3 py-2 min-w-[150px]">
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={row.price}
                                          onChange={(e) => updateVariantRow(row.id, { price: e.target.value })}
                                          placeholder="Blank = base price"
                                        />
                                      </td>
                                      <td className="px-3 py-2 min-w-[120px]">
                                        <Input
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={row.stock}
                                          onChange={(e) => updateVariantRow(row.id, { stock: Math.max(0, parseNumberInput(e.target.value)) })}
                                          placeholder="0"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="checkbox"
                                          checked={row.enabled !== false}
                                          onChange={(e) => updateVariantRow(row.id, { enabled: e.target.checked })}
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex gap-1">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => duplicateVariantRow(row.id)}
                                          >
                                            Duplicate
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => removeVariantRow(row.id)}
                                          >
                                            Delete
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="text-xs text-gray-500">
                              Top-level stock is auto-calculated from active variant rows.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Keep this off for single-SKU products. Turn it on for products with multiple options.
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="specifications">Specifications JSON (optional)</Label>
                    <Textarea
                      id="specifications"
                      value={specificationsJson}
                      onChange={(e) => setSpecificationsJson(e.target.value)}
                      rows={4}
                      placeholder='{"material":"Leather","warranty":"6 months"}'
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
                    <p className="text-sm text-gray-500 font-medium">
                      Brand: {product.brand || 'N/A'}
                    </p>
                    {Array.isArray(product.variants) && product.variants.length > 0 && (
                      <p className="text-sm text-gray-500 font-medium">
                        Variants: {product.variants.length}
                      </p>
                    )}
                    {Array.isArray(product.tags) && product.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {product.tags.slice(0, 4).map((tag) => (
                          <span
                            key={`${product.id}-${tag}`}
                            className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

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
