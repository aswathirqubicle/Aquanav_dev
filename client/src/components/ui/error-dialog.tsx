
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Copy, X } from 'lucide-react';
import { ErrorDialogData } from '@/lib/error-logger';

interface ErrorDialogProps {
  error: ErrorDialogData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ErrorDialog({ error, open, onOpenChange }: ErrorDialogProps) {
  const copyToClipboard = () => {
    if (error) {
      const errorText = `Error: ${error.title}\nMessage: ${error.message}\nTime: ${error.timestamp.toLocaleString()}\n${error.details ? `\nDetails:\n${error.details}` : ''}`;
      navigator.clipboard.writeText(errorText);
    }
  };

  if (!error) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            {error.title}
          </DialogTitle>
          <DialogDescription>
            An error occurred while processing your request. Details are provided below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2 text-slate-900 dark:text-slate-100">
                Error Message
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 break-words">
                {error.message}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2 text-slate-900 dark:text-slate-100">
                Timestamp
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {error.timestamp.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {error.details && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium mb-2 text-slate-900 dark:text-slate-100">
                  Technical Details
                </h4>
                <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                  {error.details}
                </pre>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={copyToClipboard}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy Error Details
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
