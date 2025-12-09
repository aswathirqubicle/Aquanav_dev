
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Package, ArrowLeft, DollarSign, TrendingUp } from "lucide-react";

export default function SupplierProducts() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, user } = useAuth();
  const supplierId = parseInt(id || "0");

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user?.role !== "admin" && user?.role !== "project_manager" && user?.role !== "finance") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: supplier } = useQuery({
    queryKey: [`/api/suppliers/${supplierId}`],
    enabled: isAuthenticated && !!supplierId,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: [`/api/suppliers/${supplierId}/products`],
    enabled: isAuthenticated && !!supplierId,
  });

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "project_manager" && user?.role !== "finance")) {
    return null;
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const getCategoryBadge = (category: string) => {
    const categoryColors = {
      consumables: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      tools: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      equipment: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
      materials: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
    };

    return (
      <Badge className={categoryColors[category as keyof typeof categoryColors] || categoryColors.materials}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  const categories = products ? [...new Set(products.map((p: any) => p.category))] : [];
  const totalProducts = products?.length || 0;
  const averagePrice = products?.length ? products.reduce((sum: number, p: any) => sum + parseFloat(p.avgCost || "0"), 0) / products.length : 0;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6 md:mb-8">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-x-4 md:space-y-0">
          <Button variant="outline" onClick={() => setLocation("/suppliers")} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Suppliers
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Products - {supplier?.name || 'Loading...'}
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">View all products available from this supplier</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Products</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {totalProducts}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Average Price</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(averagePrice)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Categories</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {categories.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">In Stock</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {products?.filter((p: any) => p.currentStock > 0).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Loading products...</p>
        </div>
      ) : !products || products.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No products found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              No products have been associated with this supplier yet
            </p>
            <Button onClick={() => setLocation("/inventory")}>
              Manage Inventory
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6">
          {products.map((product: any) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0">
                  <div className="flex items-start space-x-3 md:space-x-4 flex-1">
                    <div className="h-10 w-10 md:h-12 md:w-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {getCategoryBadge(product.category)}
                        <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                          Unit: {product.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(product.avgCost || "0")}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Stock: {product.currentStock} {product.unit}
                    </p>
                    {product.currentStock <= product.minStockLevel && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 mt-1">
                        Low Stock
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 text-sm">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">Current Stock</p>
                      <p className="text-slate-600 dark:text-slate-400">{product.currentStock} {product.unit}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">Min Stock Level</p>
                      <p className="text-slate-600 dark:text-slate-400">{product.minStockLevel} {product.unit}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">Average Cost</p>
                      <p className="text-slate-600 dark:text-slate-400">{formatCurrency(product.avgCost || "0")}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">Category</p>
                      <p className="text-slate-600 dark:text-slate-400">{product.category}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2 sm:space-x-2 sm:gap-0">
                  <Button variant="outline" size="sm" onClick={() => setLocation(`/inventory`)} className="w-full sm:w-auto">
                    View in Inventory
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLocation("/purchase")} className="w-full sm:w-auto">
                    Create Purchase Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
