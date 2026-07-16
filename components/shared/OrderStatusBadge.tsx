import React from 'react';
import { Badge } from '@/components/ui/Badge';

interface OrderStatusBadgeProps {
  status: string;
}

const STATUS_MAP: Record<string, { label: string; variant: 'gray' | 'blue' | 'amber' | 'green' }> = {
  PENDING: { label: 'Pending', variant: 'gray' },
  PROCESSING: { label: 'Processing', variant: 'blue' },
  SHIPPED: { label: 'Shipped', variant: 'amber' },
  COMPLETED: { label: 'Completed', variant: 'green' },
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: 'gray' };
  return (
    <Badge variant={cfg.variant}>{cfg.label}</Badge>
  );
}
