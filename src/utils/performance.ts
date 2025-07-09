// Performance utilities for optimization

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Memoization helper for expensive calculations
export const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map();
  
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

// Chunk array processing for better performance
export const processInChunks = async <T, R>(
  items: T[],
  processor: (item: T) => R,
  chunkSize: number = 100
): Promise<R[]> => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = chunk.map(processor);
    results.push(...chunkResults);
    
    // Allow other tasks to run
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return results;
};

// Virtual scrolling helper
export const getVisibleItems = <T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  overscan: number = 5
) => {
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );
  
  const start = Math.max(0, visibleStart - overscan);
  const end = Math.min(items.length - 1, visibleEnd + overscan);
  
  return {
    items: items.slice(start, end + 1),
    startIndex: start,
    endIndex: end,
    totalHeight: items.length * itemHeight,
    offsetY: start * itemHeight
  };
};