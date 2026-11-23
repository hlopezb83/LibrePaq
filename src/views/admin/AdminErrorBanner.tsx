import { RefreshCw } from 'lucide-react';

export interface AdminErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function AdminErrorBanner({ message, onRetry }: AdminErrorBannerProps) {
  return (
    <div
      role="alert"
      className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex flex-wrap items-center justify-between gap-3"
    >
      <span className="font-semibold">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-red-300 text-red-800 font-bold hover:bg-red-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Reintentar
        </button>
      )}
    </div>
  );
}
