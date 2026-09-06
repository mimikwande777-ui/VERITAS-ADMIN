import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DEFAULT_CURRENCY = "ZAR";
export const DEFAULT_CURRENCY_SYMBOL = "R";
export const DEFAULT_LOCALE = "en-ZA";
export const STORE_CURRENCY = {
  code: "ZAR",
  name: "South African Rand",
  symbol: "R",
  locale: "en-ZA",
};

/**
 * Deterministic ZAR currency and number formatting.
 * Produces identical output during Server-Side Rendering (SSR) and client hydration.
 * Output format: R2,450.00 (South African Rand standard)
 */
export function formatZAR(amount: number | string | undefined | null): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  const isNegative = num < 0;
  const absoluteValue = Math.abs(num);
  const parts = absoluteValue.toFixed(2).split('.');
  const integerWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNegative ? '-' : ''}R${integerWithCommas}.${parts[1]}`;
}

export const formatCurrencyZAR = formatZAR;
export const formatCurrency = formatZAR;

/**
 * Formats shipping fee in ZAR, returning 'FREE' if 0 or free
 */
export function formatShippingZAR(amount: number | string | undefined | null): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  if (num === 0) return 'FREE';
  return formatZAR(num);
}

/**
 * Deterministic price number formatter (without symbol, e.g. "2,450.00")
 */
export function formatPrice(amount: number | string | undefined | null): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  const isNegative = num < 0;
  const absoluteValue = Math.abs(num);
  const parts = absoluteValue.toFixed(2).split('.');
  const integerWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNegative ? '-' : ''}${integerWithCommas}.${parts[1]}`;
}

/**
 * Deterministic integer formatter (without symbol or decimals, e.g. "2,450")
 */
export function formatNumber(amount: number | string | undefined | null): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  const isNegative = num < 0;
  const absoluteValue = Math.round(Math.abs(num));
  const integerWithCommas = String(absoluteValue).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNegative ? '-' : ''}${integerWithCommas}`;
}

/**
 * Compresses a image File or data URL using HTML Canvas to reduce base64 string size for localStorage safety.
 */
export function compressImageFile(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Empty result from FileReader'));
        return;
      }
      compressImageDataUrl(dataUrl, maxWidth, maxHeight, quality)
        .then(resolve)
        .catch(() => resolve(dataUrl));
    };
    reader.readAsDataURL(file);
  });
}

export function compressImageDataUrl(
  dataUrl: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}

