import { RefreshCw } from 'lucide-react';
import { AlertBanner, Button } from '../../components/ui';

export interface AdminErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function AdminErrorBanner({ message, onRetry }: AdminErrorBannerProps) {
  return (
    <AlertBanner
      tone="danger"
      action={
        onRetry ? (
          <Button
            variant="danger-outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={onRetry}
          >
            Reintentar
          </Button>
        ) : undefined
      }
    >
      <span className="font-semibold">{message}</span>
    </AlertBanner>
  );
}
