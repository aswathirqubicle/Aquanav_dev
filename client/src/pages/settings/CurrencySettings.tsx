import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Globe, RefreshCw } from "lucide-react";
import { CurrencyConverterWidget } from "@/components/currency/CurrencyConverter";
import { CurrencyDisplay } from "@/components/currency/CurrencyDisplay";
import { 
  CURRENCIES, 
  DEFAULT_CURRENCY, 
  GCC_CURRENCIES, 
  MAJOR_CURRENCIES,
  ExchangeRateManager 
} from "@shared/currency";

export default function CurrencySettings() {
  const [updatingRates, setUpdatingRates] = useState(false);

  const handleUpdateRates = async () => {
    setUpdatingRates(true);
    // In a real application, this would call an API to update exchange rates
    // For now, we'll just simulate the update
    setTimeout(() => {
      setUpdatingRates(false);
    }, 2000);
  };

  const currencyList = Object.values(CURRENCIES);
  const gccCurrencies = currencyList.filter(c => GCC_CURRENCIES.includes(c.code));
  const majorCurrencies = currencyList.filter(c => MAJOR_CURRENCIES.includes(c.code));
  const otherCurrencies = currencyList.filter(c => 
    !GCC_CURRENCIES.includes(c.code) && !MAJOR_CURRENCIES.includes(c.code)
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Currency Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage multi-currency settings and exchange rates for the Aquanav ERP system
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <DollarSign className="h-4 w-4 mr-2" />
          Default: {DEFAULT_CURRENCY}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Currency Converter */}
        <div className="lg:col-span-1">
          <CurrencyConverterWidget />
        </div>

        {/* Exchange Rate Overview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Exchange Rates (to AED)
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleUpdateRates}
                disabled={updatingRates}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${updatingRates ? 'animate-spin' : ''}`} />
                Update Rates
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* GCC Currencies */}
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">GCC Currencies</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {gccCurrencies.map((currency) => (
                      <div key={currency.code} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{currency.symbol}</span>
                          <Badge variant="secondary">{currency.code}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          1 {currency.code} = {currency.rateToAED.toFixed(3)} AED
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Major Currencies */}
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">Major Currencies</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {majorCurrencies.filter(c => !GCC_CURRENCIES.includes(c.code)).map((currency) => (
                      <div key={currency.code} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{currency.symbol}</span>
                          <Badge variant="secondary">{currency.code}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          1 {currency.code} = {currency.rateToAED.toFixed(3)} AED
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comprehensive Currency Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            All Supported Currencies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Rate to AED</TableHead>
                <TableHead>Decimals</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Sample Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencyList.map((currency) => (
                <TableRow key={currency.code}>
                  <TableCell className="font-medium">{currency.name}</TableCell>
                  <TableCell>
                    <Badge variant={currency.code === DEFAULT_CURRENCY ? "default" : "outline"}>
                      {currency.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{currency.symbol}</TableCell>
                  <TableCell>{currency.rateToAED.toFixed(4)}</TableCell>
                  <TableCell>{currency.decimals}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {GCC_CURRENCIES.includes(currency.code) ? "GCC" :
                       MAJOR_CURRENCIES.includes(currency.code) ? "Major" : "Other"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay amount={1000} currency={currency.code} showCode={false} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Currency Usage Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Currency Usage Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Default Currency</h3>
              <p className="text-sm text-muted-foreground">
                AED (UAE Dirham) is the default currency for all transactions and reporting.
                All amounts are stored and calculated in AED equivalents.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">GCC Integration</h3>
              <p className="text-sm text-muted-foreground">
                Special support for Gulf Cooperation Council currencies with optimized
                exchange rates for regional business operations.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Multi-Currency Support</h3>
              <p className="text-sm text-muted-foreground">
                Customers and suppliers can operate in their preferred currency,
                with automatic conversion to AED for accounting and reporting.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}