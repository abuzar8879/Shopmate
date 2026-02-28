import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL?.replace(/\/$/, "");

// Get or create session ID for guest users
export const getSessionId = () => {
  let sessionId = localStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('session_id', sessionId);
  }
  return sessionId;
};

// Track product view
export const trackProductView = async (productId) => {
  try {
    const sessionId = getSessionId();
    await axios.post(
      `${API}/api/products/${productId}/view`,
      {},
      {
        headers: {
          'x-session-id': sessionId
        }
      }
    );
  } catch (error) {
    console.error('Error tracking product view:', error);
  }
};

// Get recently viewed products
export const getRecentlyViewed = async () => {
  try {
    const sessionId = getSessionId();
    const response = await axios.get(`${API}/api/products/recently-viewed`, {
      headers: {
        'x-session-id': sessionId
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting recently viewed:', error);
    return [];
  }
};

// Product comparison utilities
export const getComparedProducts = () => {
  try {
    const compared = localStorage.getItem('compared_products');
    return compared ? JSON.parse(compared) : [];
  } catch {
    return [];
  }
};

export const addToComparison = (product) => {
  const compared = getComparedProducts();
  if (compared.length >= 4) {
    return { success: false, message: 'You can only compare up to 4 products' };
  }
  if (compared.find(p => p.id === product.id)) {
    return { success: false, message: 'Product already in comparison' };
  }
  compared.push(product);
  localStorage.setItem('compared_products', JSON.stringify(compared));
  return { success: true, message: 'Added to comparison' };
};

export const removeFromComparison = (productId) => {
  const compared = getComparedProducts();
  const filtered = compared.filter(p => p.id !== productId);
  localStorage.setItem('compared_products', JSON.stringify(filtered));
  return { success: true };
};

export const clearComparison = () => {
  localStorage.removeItem('compared_products');
  return { success: true };
};
