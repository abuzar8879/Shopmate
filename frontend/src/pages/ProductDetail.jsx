import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { useCart } from '../App';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import { ShoppingCart, Star, Plus, Minus, ArrowLeft, Package, Truck, Shield, RefreshCw } from 'lucide-react';
import { trackProductView } from '../utils/productTracking';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL?.replace(/\/$/, "");
const API = BACKEND_URL;

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [ratings, setRatings] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedVariantSku, setSelectedVariantSku] = useState('');

  useEffect(() => {
    fetchProduct();
    fetchRatings();
    fetchReviews();
    fetchRecommendations();
    // Track product view
    trackProductView(productId);
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const response = await axios.get(`${API}/api/products/${productId}`);
      setProduct(response.data);
    } catch (error) {
      toast.error('Failed to load product');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const fetchRatings = async () => {
    try {
      const response = await axios.get(`${API}/api/products/${productId}/ratings`);
      setRatings(response.data);
      calculateRatingStats(response.data);
    } catch (error) {
      console.error('Failed to load ratings:', error);
    }
  };

  const calculateRatingStats = (ratingsData) => {
    if (ratingsData.length === 0) {
      setAverageRating(0);
      setTotalRatings(0);
      return;
    }

    const total = ratingsData.reduce((sum, rating) => sum + rating.rating, 0);
    setAverageRating(total / ratingsData.length);
    setTotalRatings(ratingsData.length);

    // Check if current user has rated
    if (user) {
      const userRatingObj = ratingsData.find(r => r.userId === user.id);
      if (userRatingObj) {
        setUserRating(userRatingObj.rating);
      }
    }
  };

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1 && newQuantity <= getAvailableStock()) {
      setQuantity(newQuantity);
    }
  };

  const getSelectedVariant = () => {
    if (!product?.variants?.length || !selectedVariantSku) return null;
    return product.variants.find(v => v.sku === selectedVariantSku) || null;
  };

  const getEffectivePrice = () => {
    const variant = getSelectedVariant();
    return variant?.price ?? product?.price ?? 0;
  };

  const getAvailableStock = () => {
    const variant = getSelectedVariant();
    return variant ? (variant.stock || 0) : (product?.stock || 0);
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (getAvailableStock() === 0) {
      toast.error('Product is out of stock');
      return;
    }

    if (quantity > getAvailableStock()) {
      toast.error('Not enough stock available');
      return;
    }

    addToCart(product, quantity);
  };

  const handleBuyNow = () => {
    if (!user) {
      toast.error('Please login to buy now');
      navigate('/auth');
      return;
    }

    if (!product) return;

    if (getAvailableStock() === 0) {
      toast.error('Product is out of stock');
      return;
    }

    if (quantity > getAvailableStock()) {
      toast.error('Not enough stock available');
      return;
    }

    // Store buy now item in localStorage
    const buyNowItem = {
      product: product,
      variant_sku: selectedVariantSku || null,
      quantity: quantity,
      total: getEffectivePrice() * quantity
    };
    localStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));

    // Navigate to checkout
    navigate('/checkout');
  };
  const fetchReviews = async () => {
    try {
      const response = await axios.get(`${API}/api/products/${productId}/reviews`);
      setReviews(response.data);
    } catch (error) {
    }
  };

  const handleRatingSubmit = async () => {
    if (!user) {
      toast.error('Please login to rate products');
      navigate('/auth');
      return;
    }

    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmittingRating(true);
    try {
      await axios.post(`${API}/api/products/${productId}/ratings`, {
        rating: rating
      });
      toast.success('Rating submitted successfully!');
      setUserRating(rating);
      fetchRatings(); // Refresh ratings
    } catch (error) {
      toast.error(error.response?.data?.message || 'You have already rated this product and cannot change your rating.');
    } finally {
      setSubmittingRating(false);
    }
  };
  const handleReviewSubmit = async () => {
    if (!user) {
      toast.error('Please login to write reviews');
      navigate('/auth');
      return;
    }
    if (!reviewText.trim()) {
      toast.error('Please enter review text');
      return;
    }
    setSubmittingReview(true);
    try {
      await axios.post(`${API}/api/products/${productId}/reviews`, { text: reviewText.trim() });
      toast.success('Review submitted successfully!');
      setReviewText('');
      fetchReviews();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };
  const fetchRecommendations = async () => {
    try {
      const response = await axios.get(`${API}/api/products/${productId}/recommendations`);
      setRecommendations(response.data);
    } catch (error) {
    }
  };

  const renderStars = (rating, interactive = false, onStarClick = null) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
            onClick={interactive ? () => onStarClick && onStarClick(star) : undefined}
            disabled={!interactive}
          >
            <Star
              className={`h-5 w-5 ${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md text-center p-8">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
          <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/products')}>
            Browse Products
          </Button>
        </Card>
      </div>
    );
  }

  const selectedVariant = getSelectedVariant();
  const primaryImage = selectedVariant?.image || (product.images && product.images.length > 0 ? product.images[0] : null);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => navigate('/products')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {primaryImage ? (
                    <img
                      src={primaryImage}
                      alt={selectedVariant?.sku ? `${product.name} - ${selectedVariant.sku}` : product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-32 w-32 text-gray-400" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center space-x-4 mb-4">
                <Badge variant="secondary">{product.category}</Badge>
                <div className="flex items-center space-x-2">
                  {renderStars(Math.round(averageRating))}
                  <span className="text-sm text-gray-600">
                    ({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})
                  </span>
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-600 mb-4">₹{getEffectivePrice()}</p>
              <div className="flex items-center space-x-2 mb-4">
                <Package className="h-4 w-4 text-gray-500" />
                <span className={`text-sm ${getAvailableStock() > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {getAvailableStock() > 0 ? `${getAvailableStock()} in stock` : 'Out of stock'}
                </span>
              </div>
            </div>

            <Separator />

            {product.variants && product.variants.length > 0 && (
              <>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Choose Variant</h3>
                  <select
                    value={selectedVariantSku}
                    onChange={(e) => setSelectedVariantSku(e.target.value)}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">Default Product</option>
                    {product.variants.map((variant) => (
                      <option key={variant.sku} value={variant.sku}>
                        {Object.entries(variant.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(', ')} | SKU: {variant.sku} | Stock: {variant.stock}
                      </option>
                    ))}
                  </select>
                </div>
                <Separator />
              </>
            )}

            {/* Quantity Selector */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Quantity</h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center border rounded-lg">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    className="p-3 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-4 py-3 font-medium">{quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    className="p-3 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={quantity >= getAvailableStock()}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-sm text-gray-600">
                  Max: {getAvailableStock()}
                </span>
              </div>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="space-y-4">
              <div className="flex space-x-4">
                <Button
                  onClick={handleAddToCart}
                  disabled={getAvailableStock() === 0}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
                <Button
                  onClick={handleBuyNow}
                  disabled={getAvailableStock() === 0}
                  variant="outline"
                  className="flex-1"
                >
                  Buy Now
                </Button>
                <Button
                  onClick={async () => {
                    if (!user) {
                      toast.error('Please login to use wishlist');
                      navigate('/auth');
                      return;
                    }
                    try {
                      await axios.post(`${API}/api/wishlist/${product.id}`);
                      toast.success('Added to wishlist');
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Failed to add to wishlist');
                    }
                  }}
                  variant="ghost"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Wishlist
                </Button>
              </div>
            </div>

            <Separator />

            {/* Product Description */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Description</h3>
              <p className="text-gray-700 leading-relaxed">{product.description}</p>
            </div>

            {/* Rating Section */}
            {user && (
              <div className="space-y-4">
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-3">Rate this product</h3>
                  {userRating > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Your rating:</p>
                      {renderStars(userRating)}
                      <p className="text-sm text-green-600">Thank you for your rating!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">Select rating:</span>
                        {renderStars(rating, true, setRating)}
                      </div>
                      <Button
                        onClick={handleRatingSubmit}
                        disabled={rating === 0 || submittingRating}
                        size="sm"
                      >
                        {submittingRating ? 'Submitting...' : 'Submit Rating'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Overall Ratings Display */}
            {totalRatings > 0 && (
              <div className="space-y-4">
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-3">Customer Reviews</h3>
                  <div className="flex items-center space-x-2 mb-4">
                    {renderStars(Math.round(averageRating))}
                    <span className="text-sm text-gray-600">
                      {averageRating.toFixed(1)} out of 5 ({totalRatings} {totalRatings === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                  {user && (
                    <div className="space-y-3 mb-4">
                      <Textarea
                        placeholder="Share your experience..."
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                      />
                      <Button onClick={handleReviewSubmit} disabled={submittingReview || !reviewText.trim()} size="sm">
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </Button>
                    </div>
                  )}
                  {reviews.length > 0 && (
                    <div className="space-y-3">
                      {reviews.map((rev) => (
                        <Card key={rev.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {rev.verified_purchase && <Badge variant="secondary">Verified Purchase</Badge>}
                                {rev.is_hidden && <Badge variant="destructive">Hidden</Badge>}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (!user) {
                                    toast.error('Please login first');
                                    return;
                                  }
                                  try {
                                    await axios.post(`${API}/api/products/${productId}/reviews/${rev.id}/helpful`);
                                    fetchReviews();
                                  } catch {
                                    toast.error('Failed to vote helpful');
                                  }
                                }}
                              >
                                Helpful ({rev.helpful_count || 0})
                              </Button>
                            </div>
                            <p className="text-gray-800">{rev.text}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              <div className="text-center p-4 bg-white rounded-lg border">
                <Truck className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h4 className="font-semibold text-sm">Free Delivery</h4>
                <p className="text-xs text-gray-600">On orders over ₹500</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border">
                <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h4 className="font-semibold text-sm">Secure Payment</h4>
                <p className="text-xs text-gray-600">100% secure checkout</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border">
                <RefreshCw className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h4 className="font-semibold text-sm">Easy Returns</h4>
                <p className="text-xs text-gray-600">30-day return policy</p>
              </div>
            </div>
            <Separator className="my-6" />
            <div>
              <h3 className="text-lg font-semibold mb-3">You may also like</h3>
              {recommendations.length === 0 ? (
                <p className="text-sm text-gray-600">No recommendations available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendations.map((rec) => (
                    <Card key={rec.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="w-full h-32 bg-gray-100 rounded mb-3 overflow-hidden">
                          {rec.images && rec.images.length > 0 ? (
                            <img src={rec.images[0]} alt={rec.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <h4 className="font-semibold line-clamp-2">{rec.name}</h4>
                        <p className="text-sm text-gray-600">₹{rec.price}</p>
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/product/${rec.id}`)}>
                            View
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
      </div>
    </div>
  );
}

