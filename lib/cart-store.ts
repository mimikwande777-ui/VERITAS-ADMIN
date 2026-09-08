'use client';

import { useState, useEffect } from 'react';

import { FREE_SHIPPING_THRESHOLD_ZAR, STANDARD_SHIPPING_FEE_ZAR, calculateShippingFeeZAR } from './shipping';

export interface CartItem {
  id: string; // composite key: `${productId}-${size}-${color}`
  productId: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  color: string;
  size: string;
  image: string;
  sku?: string;
  maxStock?: number;
}

const CART_STORAGE_KEY = 'veritas_cart_v1';
const CART_EVENT = 'veritas_cart_updated';

// Helper to read from local storage safely
export function getStoredCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading cart from localStorage:', err);
    return [];
  }
}

// Helper to write to local storage and broadcast update
export function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CART_EVENT));
  } catch (err) {
    console.error('Error saving cart to localStorage:', err);
  }
}

// Add item to cart
export function addToCart(item: Omit<CartItem, 'id'> & { id?: string }): { success: boolean; message: string } {
  const current = getStoredCart();
  const itemId = item.id || `${item.productId}-${item.size}-${item.color}`;
  const existingIndex = current.findIndex(i => i.id === itemId);

  const maxAllowed = item.maxStock !== undefined ? item.maxStock : 99;

  if (existingIndex > -1) {
    const currentQty = current[existingIndex].quantity;
    const newQty = currentQty + item.quantity;

    if (newQty > maxAllowed) {
      current[existingIndex].quantity = maxAllowed;
      saveCart(current);
      return { 
        success: true, 
        message: `Updated to maximum available stock (${maxAllowed})` 
      };
    }

    current[existingIndex].quantity = newQty;
    saveCart(current);
    return { success: true, message: `Updated quantity in bag` };
  } else {
    const initialQty = Math.min(item.quantity, maxAllowed);
    current.push({
      ...item,
      id: itemId,
      quantity: initialQty
    });
    saveCart(current);
    return { success: true, message: `Added to bag` };
  }
}

// Update quantity
export function updateCartItemQuantity(id: string, quantity: number): void {
  const current = getStoredCart();
  if (quantity <= 0) {
    removeFromCart(id);
    return;
  }

  const updated = current.map(item => {
    if (item.id === id) {
      const max = item.maxStock !== undefined ? item.maxStock : 99;
      return { ...item, quantity: Math.min(quantity, max) };
    }
    return item;
  });

  saveCart(updated);
}

// Remove single item
export function removeFromCart(id: string): void {
  const current = getStoredCart();
  const filtered = current.filter(i => i.id !== id);
  saveCart(filtered);
}

// Clear entire cart
export function clearCart(): void {
  saveCart([]);
}

// React Hook for reactive cart state
export function useCartStore() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setItems(getStoredCart());
      setIsLoaded(true);
    });

    const handleUpdate = () => {
      setItems(getStoredCart());
    };

    window.addEventListener(CART_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(CART_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  // Free nationwide courier shipping on all orders
  const freeShippingThreshold = FREE_SHIPPING_THRESHOLD_ZAR;
  const shipping = calculateShippingFeeZAR(subtotal, items.length);
  const total = subtotal + shipping;
  const amountNeededForFreeShipping = 0;

  return {
    items,
    isLoaded,
    itemCount,
    subtotal,
    shipping,
    total,
    freeShippingThreshold,
    amountNeededForFreeShipping,
    addItem: addToCart,
    updateQuantity: updateCartItemQuantity,
    removeItem: removeFromCart,
    clearCart
  };
}
