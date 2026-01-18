import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PaymentStatusBadgeProps {
  status: "pending" | "on_hold" | "fulfilled" | "cancelled";
  className?: string;
}

export function PaymentStatusBadge({
  status,
  className,
}: PaymentStatusBadgeProps) {
  const getVariant = () => {
    switch (status) {
      case "pending":
        return "outline";
      case "on_hold":
        return "secondary";
      case "fulfilled":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getText = () => {
    switch (status) {
      case "pending":
        return "Payment Pending";
      case "on_hold":
        return "Payment On Hold";
      case "fulfilled":
        return "Payment Fulfilled";
      case "cancelled":
        return "Cancelled";
      default:
        return "Unknown";
    }
  };

  return (
    <Badge variant={getVariant()} className={cn(className)}>
      {getText()}
    </Badge>
  );
}
