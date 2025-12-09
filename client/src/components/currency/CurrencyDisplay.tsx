import { CurrencyConverter } from "@shared/currency";

interface CurrencyDisplayProps {
  amount: number | string;
  currency: string;
  className?: string;
  showCode?: boolean;
}

export function CurrencyDisplay({ 
  amount, 
  currency, 
  className = "",
  showCode = true 
}: CurrencyDisplayProps) {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numericAmount)) {
    return <span className={className}>-</span>;
  }

  const formatted = CurrencyConverter.formatAmount(numericAmount, currency);
  
  if (!showCode) {
    return <span className={className}>{formatted}</span>;
  }

  return (
    <span className={className}>
      {formatted} {currency !== 'AED' && <span className="text-muted-foreground">({currency})</span>}
    </span>
  );
}