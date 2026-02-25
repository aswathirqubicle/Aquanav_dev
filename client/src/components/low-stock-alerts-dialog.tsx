import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InventoryItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface LowStockAlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LowStockAlertsDialog({
  open,
  onOpenChange,
}: LowStockAlertsDialogProps) {
  const { data: inventoryResponse, isLoading } = useQuery<{
    data: InventoryItem[];
  }>({
    queryKey: ["/api/inventory", "lowStock"],
    queryFn: async () => {
      const response = await apiRequest("/api/inventory?lowStock=true&limit=100", {
        method: "GET",
      });
      return await response.json();
    },
    enabled: open,
  });

  const lowStockItems = inventoryResponse?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Low Stock Alerts</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : lowStockItems.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No items currently below minimum stock level.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-right">Min Level</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lowStockItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell className="text-right text-red-600 font-bold">
                    {item.currentStock}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.minStockLevel}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
