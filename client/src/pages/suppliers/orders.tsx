// Purchase orders functionality has been removed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SupplierOrders() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Supplier Orders</h1>
        <p className="text-muted-foreground">
          Purchase order functionality has been removed from the system.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notice</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The purchase order management system has been discontinued. Please use alternative procurement methods.</p>
        </CardContent>
      </Card>
    </div>
  );
}