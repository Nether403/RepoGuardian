/**
 * Centralized toast notification utilities
 * Provides consistent toast messages across the application
 */

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export const toastMessages = {
  // Success messages
  success: {
    saved: (itemName: string = 'Item'): ToastOptions => ({
      title: `${itemName} Saved`,
      description: `${itemName} has been saved successfully.`,
    }),
    created: (itemName: string = 'Item'): ToastOptions => ({
      title: `${itemName} Created`,
      description: `Your new ${itemName.toLowerCase()} has been created successfully.`,
    }),
    updated: (itemName: string = 'Item'): ToastOptions => ({
      title: `${itemName} Updated`,
      description: `${itemName} has been updated successfully.`,
    }),
    deleted: (itemName: string = 'Item'): ToastOptions => ({
      title: `${itemName} Deleted`,
      description: `${itemName} has been removed successfully.`,
    }),
    exported: (format: string = 'file'): ToastOptions => ({
      title: 'Export Successful',
      description: `Data exported as ${format.toUpperCase()}`,
    }),
    analyzed: (itemName: string = 'Repository'): ToastOptions => ({
      title: `${itemName} Analyzed`,
      description: `${itemName} has been analyzed successfully.`,
    }),
    found: (count: number, itemName: string = 'items'): ToastOptions => ({
      title: `${itemName} Found`,
      description: `Found ${count} ${itemName.toLowerCase()} based on your criteria.`,
    }),
  },

  // Error messages
  error: {
    generic: (action: string = 'perform this action'): ToastOptions => ({
      title: 'Error',
      description: `Failed to ${action}. Please try again.`,
      variant: 'destructive',
    }),
    unauthorized: (): ToastOptions => ({
      title: 'Unauthorized',
      description: 'You are logged out. Logging in again...',
      variant: 'destructive',
    }),
    authRequired: (): ToastOptions => ({
      title: 'Authentication Required',
      description: 'Please log in to continue.',
      variant: 'destructive',
    }),
    notFound: (itemName: string = 'Item'): ToastOptions => ({
      title: `${itemName} Not Found`,
      description: `The requested ${itemName.toLowerCase()} could not be found.`,
      variant: 'destructive',
    }),
    validation: (message: string): ToastOptions => ({
      title: 'Validation Error',
      description: message,
      variant: 'destructive',
    }),
    network: (): ToastOptions => ({
      title: 'Network Error',
      description: 'Please check your internet connection and try again.',
      variant: 'destructive',
    }),
  },

  // Info messages
  info: {
    loading: (action: string = 'Processing'): ToastOptions => ({
      title: action,
      description: 'Please wait...',
    }),
    missingInfo: (fields: string): ToastOptions => ({
      title: 'Missing Information',
      description: `Please provide ${fields}.`,
      variant: 'destructive',
    }),
  },
};

/**
 * Helper to create custom toast messages
 */
export function createToast(
  title: string,
  description?: string,
  variant?: 'default' | 'destructive'
): ToastOptions {
  return { title, description, variant };
}
