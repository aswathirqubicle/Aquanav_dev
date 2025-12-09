import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeftRight } from "lucide-react";
import { CurrencySelector } from "./CurrencySelector";
import { CurrencyConverter as Converter } from "@shared/currency";

export function CurrencyConverterWidget() {
  const [amount, setAmount] = useState<string>("1000");
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("AED");

  const convertedAmount = () => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) return 0;
      return Converter.convert(numAmount, fromCurrency, toCurrency);
    } catch {
      return 0;
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          Currency Converter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <CurrencySelector 
              value={fromCurrency} 
              onChange={setFromCurrency}
              variant="major"
            />
          </div>
          
          <div className="space-y-2">
            <Label>To</Label>
            <CurrencySelector 
              value={toCurrency} 
              onChange={setToCurrency}
              variant="major"
            />
          </div>
        </div>

        <div className="flex items-center justify-center">
          <button
            onClick={swapCurrencies}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title="Swap currencies"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">Converted Amount</div>
          <div className="text-2xl font-bold">
            {Converter.formatAmount(convertedAmount(), toCurrency)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            1 {fromCurrency} = {Converter.formatAmount(
              Converter.convert(1, fromCurrency, toCurrency), 
              toCurrency
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}