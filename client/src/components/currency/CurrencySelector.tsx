import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currencySelectOptions, majorCurrencyOptions, gccCurrencyOptions } from "@shared/currency";

interface CurrencySelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  variant?: "all" | "major" | "gcc";
  disabled?: boolean;
}

export function CurrencySelector({ 
  value, 
  onChange, 
  placeholder = "Select currency", 
  className = "",
  variant = "all",
  disabled = false
}: CurrencySelectorProps) {
  
  const getOptions = () => {
    switch (variant) {
      case "major":
        return majorCurrencyOptions;
      case "gcc":
        return gccCurrencyOptions;
      default:
        return currencySelectOptions;
    }
  };

  const options = getOptions();

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {value && (
            <span className="flex items-center gap-2">
              <span className="font-mono text-sm">{options.find(opt => opt.value === value)?.symbol}</span>
              <span>{value}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm min-w-[2rem]">{option.symbol}</span>
              <span className="font-medium">{option.value}</span>
              <span className="text-sm text-muted-foreground">({option.label.split('(')[1]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}