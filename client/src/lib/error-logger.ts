
import { apiRequest } from './utils';

export interface ErrorLogData {
  message: string;
  stack?: string;
  url?: string;
  severity?: 'error' | 'warning' | 'info';
  component?: string;
}

export interface ErrorDialogData {
  title: string;
  message: string;
  details?: string;
  timestamp: Date;
}

// Global error dialog handler
let errorDialogHandler: ((error: ErrorDialogData) => void) | null = null;

export const setErrorDialogHandler = (handler: (error: ErrorDialogData) => void) => {
  errorDialogHandler = handler;
};

export const showErrorDialog = (error: ErrorDialogData) => {
  if (errorDialogHandler) {
    errorDialogHandler(error);
  }
};

class ErrorLogger {
  private static instance: ErrorLogger;
  private queue: ErrorLogData[] = [];
  private isProcessing = false;

  public static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  constructor() {
    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message || 'Unknown error occurred',
        stack: event.error?.stack,
        url: event.filename || window.location.href,
        severity: 'error',
        component: 'Global Error Handler',
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      let message = 'Unhandled Promise Rejection';
      let stack = undefined;

      if (reason instanceof Error) {
        message = `Unhandled Promise Rejection: ${reason.message}`;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        message = `Unhandled Promise Rejection: ${reason}`;
      } else if (typeof reason === 'object' && reason !== null) {
        message = `Unhandled Promise Rejection: ${JSON.stringify(reason)}`;
      }

      this.logError({
        message,
        stack,
        url: window.location.href,
        severity: 'error',
        component: 'Promise Rejection Handler',
      });
    });

    // Override console.error to capture manual error logs
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Call original console.error first
      originalConsoleError.apply(console, args);
      
      // Log to our error system if it looks like an error
      if (args.length > 0) {
        const firstArg = args[0];
        if (typeof firstArg === 'string' && firstArg.toLowerCase().includes('error')) {
          this.logError({
            message: args.join(' '),
            severity: 'error',
            component: 'Console Error',
          });
        }
      }
    };
  }

  public logError(errorData: ErrorLogData) {
    // Add to queue
    this.queue.push({
      ...errorData,
      url: errorData.url || window.location.href,
    });

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  public logApiError(error: any, endpoint: string, component?: string) {
    let message = `API Error at ${endpoint}`;
    let stack = undefined;
    let shouldShowDialog = false;

    if (error instanceof Error) {
      message = `API Error at ${endpoint}: ${error.message}`;
      stack = error.stack;
      
      // Check if this is a JSON parse error (server returned HTML instead of JSON)
      if ((error.message.includes('Unexpected token') && error.message.includes('DOCTYPE')) || 
          (error.message.includes('Unexpected token') && error.message.includes('not valid JSON')) ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError')) {
        shouldShowDialog = true;
        showErrorDialog({
          title: 'Server Connection Error',
          message: `Unable to connect to the server or received an invalid response from ${endpoint}. This usually indicates a server-side error or connectivity issue.`,
          details: `Original error: ${error.message}\n\nEndpoint: ${endpoint}\nComponent: ${component || 'Unknown'}\nTimestamp: ${new Date().toISOString()}`,
          timestamp: new Date(),
        });
      }
    } else if (typeof error === 'string') {
      message = `API Error at ${endpoint}: ${error}`;
    } else if (typeof error === 'object' && error !== null) {
      message = `API Error at ${endpoint}: ${JSON.stringify(error)}`;
    }

    // Only log to error system if we're not showing a dialog
    if (!shouldShowDialog) {
      this.logError({
        message,
        stack,
        severity: 'error',
        component: component || 'API Error',
      });
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const errorData = this.queue.shift();
      if (errorData) {
        try {
          await apiRequest('POST', '/api/error-logs', errorData);
        } catch (error) {
          // If logging fails, we don't want to create an infinite loop
          console.error('Failed to log error to server:', error);
        }
      }
    }

    this.isProcessing = false;
  }
}

// Initialize the error logger
const errorLogger = ErrorLogger.getInstance();

// Export convenience functions
export const logError = (errorData: ErrorLogData) => {
  errorLogger.logError(errorData);
};

export const logApiError = (error: any, component: string, endpoint?: string) => {
  const errorLogger = ErrorLogger.getInstance();
  if (endpoint) {
    errorLogger.logApiError(error, endpoint, component);
  } else {
    errorLogger.logError({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      severity: 'error',
      component,
    });
  }
};

export const logWarning = (message: string, component?: string) => {
  logError({
    message,
    severity: 'warning',
    component,
  });
};

export const logInfo = (message: string, component?: string) => {
  logError({
    message,
    severity: 'info',
    component,
  });
};
