import { formatDisplayDate } from "@/lib/utils";
import { useEffect, useRef, useState, startTransition } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Ship,
  Calendar,
  DollarSign,
  MapPin,
  Users,
  Camera,
  Activity,
  Edit,
  Pencil,
  Loader2,
  ArrowLeft,
  Plus,
  Upload,
  Package,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  ClipboardCheck,
  CheckSquare,
  Square,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Image,
  X,
} from "lucide-react";
import { Project, DailyActivity, Employee, insertDailyActivitySchema, ProjectPhotoGroup, ProjectPhoto } from "@shared/schema";
import { Autocomplete } from "@/components/ui/autocomplete";
import { z } from "zod";

const ITEMS_PER_PAGE = 5;


function RevenueDetailsDialog({
  payments,
  totalRevenue,
  formatCurrency
}: {
  payments: any[];
  totalRevenue: string;
  formatCurrency: (amount: string | number) => string;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(payments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPayments = payments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <Eye className="h-3 w-3 mr-1" />
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revenue Details - Payments</DialogTitle>
          <DialogDescription>
            All payments received for this project
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          <div className="flex justify-between font-medium text-sm border-b pb-2">
            <span>Total Payments: {payments.length}</span>
            <span className="text-green-600 dark:text-green-400">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
          <div className="space-y-2">
            {paginatedPayments.map((payment: any, index: number) => (
              <div key={payment.id || startIndex + index} className="text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded">
                <div className="flex justify-between">
                  <span className="font-medium">{payment.customerName}</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-xs mt-1 flex justify-between">
                  <span>{payment.paymentMethod || 'Payment'}</span>
                  <span>{formatDisplayDate(payment.paymentDate)}</span>
                </div>
                {payment.invoiceNumber && (
                  <div className="text-xs text-slate-400 mt-1">Invoice: {payment.invoiceNumber}</div>
                )}
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDetailsDialog({
  expenses,
  formatCurrency
}: {
  expenses: {
    purchaseItems: any[];
    reimbursements: any[];
    laborItems: any[];
    consumableItems: any[];
    assetRentalItems: any[];
    purchaseTotal: string;
    reimbursementTotal: string;
    laborTotal: string;
    consumablesTotal: string;
    assetRentalTotal: string;
  };
  formatCurrency: (amount: string | number) => string;
}) {
  const laborItems = expenses.laborItems || [];
  const consumableItems = expenses.consumableItems || [];
  const assetRentalItems = expenses.assetRentalItems || [];

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const categories = [
    { key: "labor", label: "Labor", items: laborItems, total: parseFloat(expenses.laborTotal || "0"), color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { key: "consumables", label: "Consumables", items: consumableItems, total: parseFloat(expenses.consumablesTotal || "0"), color: "bg-amber-400", textColor: "text-amber-600 dark:text-amber-400", badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    { key: "assets", label: "Asset Rental", items: assetRentalItems, total: parseFloat(expenses.assetRentalTotal || "0"), color: "bg-purple-500", textColor: "text-purple-600 dark:text-purple-400", badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    { key: "purchases", label: "Purchases", items: expenses.purchaseItems, total: parseFloat(expenses.purchaseTotal || "0"), color: "bg-rose-500", textColor: "text-rose-600 dark:text-rose-400", badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
    { key: "reimbursements", label: "Reimbursements", items: expenses.reimbursements, total: parseFloat(expenses.reimbursementTotal || "0"), color: "bg-orange-400", textColor: "text-orange-600 dark:text-orange-400", badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  ].filter(c => c.total > 0);

  const grandTotal = categories.reduce((sum, c) => sum + c.total, 0);
  const defaultTab = categories[0]?.key || "labor";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
          <Eye className="h-3 w-3 mr-1" />
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="text-base font-semibold">Cost Breakdown</DialogTitle>
          <DialogDescription className="sr-only">Breakdown of all project cost components</DialogDescription>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">Total Project Cost</span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(grandTotal.toFixed(2))}</span>
          </div>
          {/* Proportional stacked bar */}
          {grandTotal > 0 && (
            <div className="mt-3 flex h-2 rounded-full overflow-hidden gap-px">
              {categories.map(c => (
                <div
                  key={c.key}
                  className={`${c.color} transition-all`}
                  style={{ width: `${(c.total / grandTotal) * 100}%` }}
                  title={`${c.label}: ${((c.total / grandTotal) * 100).toFixed(1)}%`}
                />
              ))}
            </div>
          )}
          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {categories.map(c => (
              <div key={c.key} className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${c.color}`} />
                <span className="text-xs text-slate-500 dark:text-slate-400">{c.label}</span>
                <span className={`text-xs font-medium ${c.textColor}`}>{((c.total / grandTotal) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 min-h-0">
          <div className="px-5 pt-3 border-b border-slate-100 dark:border-slate-800">
            <TabsList className="h-auto bg-transparent p-0 gap-1 flex flex-wrap">
              {categories.map(c => (
                <TabsTrigger
                  key={c.key}
                  value={c.key}
                  className="h-8 text-xs px-3 rounded-md data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-none border-0"
                >
                  {c.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${c.badgeColor}`}>
                    {c.items.length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Labor Tab */}
            {categories.find(c => c.key === "labor") && (
              <TabsContent value="labor" className="m-0 p-5 space-y-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{laborItems.length} payroll record{laborItems.length !== 1 ? "s" : ""}</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(expenses.laborTotal)}</span>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                  {laborItems.map((item: any, index: number) => (
                    <div key={index} className={`flex items-center justify-between px-4 py-3 ${index < laborItems.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {MONTH_NAMES[(item.month ?? 1) - 1]} {item.year}
                          {item.workingDays != null && <span className="ml-2">{item.workingDays} working day{item.workingDays !== 1 ? "s" : ""}</span>}
                        </p>
                      </div>
                      <span className="ml-4 text-sm font-semibold text-slate-900 dark:text-slate-100 shrink-0">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {/* Consumables Tab */}
            {categories.find(c => c.key === "consumables") && (
              <TabsContent value="consumables" className="m-0 p-5 space-y-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{consumableItems.length} item{consumableItems.length !== 1 ? "s" : ""}</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(expenses.consumablesTotal)}</span>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                  {consumableItems.map((item: any, index: number) => (
                    <div key={index} className={`flex items-center justify-between px-4 py-3 ${index < consumableItems.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.quantity} × {formatCurrency(item.unitCost)}
                          {item.date && <span className="ml-2">{formatDisplayDate(item.date)}</span>}
                        </p>
                      </div>
                      <span className="ml-4 text-sm font-semibold text-slate-900 dark:text-slate-100 shrink-0">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {/* Asset Rental Tab */}
            {categories.find(c => c.key === "assets") && (
              <TabsContent value="assets" className="m-0 p-5 space-y-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{assetRentalItems.length} asset{assetRentalItems.length !== 1 ? "s" : ""}</span>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{formatCurrency(expenses.assetRentalTotal)}</span>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                  {assetRentalItems.map((item: any, index: number) => (
                    <div key={index} className={`flex items-center justify-between px-4 py-3 ${index < assetRentalItems.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatDisplayDate(item.startDate)} – {formatDisplayDate(item.endDate)}
                          <span className="ml-2">{formatCurrency(item.monthlyRate)}/mo</span>
                        </p>
                      </div>
                      <span className="ml-4 text-sm font-semibold text-slate-900 dark:text-slate-100 shrink-0">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {/* Purchases Tab */}
            {categories.find(c => c.key === "purchases") && (
              <TabsContent value="purchases" className="m-0 p-5 space-y-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{expenses.purchaseItems.length} line item{expenses.purchaseItems.length !== 1 ? "s" : ""}</span>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(expenses.purchaseTotal)}</span>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                  {expenses.purchaseItems.map((item: any, index: number) => (
                    <div key={index} className={`flex items-center justify-between px-4 py-3 ${index < expenses.purchaseItems.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.supplierName || "Unknown supplier"}
                          {item.invoiceNumber && <span className="ml-2 font-mono">#{item.invoiceNumber}</span>}
                          {item.date && <span className="ml-2">{formatDisplayDate(item.date)}</span>}
                        </p>
                      </div>
                      <span className="ml-4 text-sm font-semibold text-slate-900 dark:text-slate-100 shrink-0">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {/* Reimbursements Tab */}
            {categories.find(c => c.key === "reimbursements") && (
              <TabsContent value="reimbursements" className="m-0 p-5 space-y-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{expenses.reimbursements.length} reimbursement{expenses.reimbursements.length !== 1 ? "s" : ""}</span>
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatCurrency(expenses.reimbursementTotal)}</span>
                </div>
                <div className="rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                  {expenses.reimbursements.map((item: any, index: number) => (
                    <div key={index} className={`flex items-center justify-between px-4 py-3 ${index < expenses.reimbursements.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.employeeName || "Employee"}
                          {item.date && <span className="ml-2">{formatDisplayDate(item.date)}</span>}
                        </p>
                      </div>
                      <span className="ml-4 text-sm font-semibold text-slate-900 dark:text-slate-100 shrink-0">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Vessel Location Tracker Component
interface VesselLocationTrackerProps {
  imoNumber: string;
  vesselName: string;
}

interface VesselData {
  imo: string;
  name: string;
  lat: number;
  lon: number;
  course: number;
  speed: number;
  heading: number;
  timestamp: string;
  destination: string;
  eta: string;
  status: string;
}

function VesselLocationTracker({ imoNumber, vesselName }: VesselLocationTrackerProps) {
  const [vesselData, setVesselData] = useState<VesselData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchVesselLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      // Using VesselFinder API through our backend to avoid CORS issues
      const response = await fetch(`/api/vessel-location/${imoNumber}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch vessel location: ${response.statusText}`);
      }

      const data = await response.json();
      setVesselData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vessel location');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVesselLocation();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchVesselLocation, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [imoNumber]);

  const formatSpeed = (speed: number) => `${speed.toFixed(1)} knots`;
  const formatCourse = (course: number) => `${Math.round(course)}°`;
  const formatCoordinates = (lat: number, lon: number) =>
    `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;

  if (loading && !vesselData) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-500 dark:text-slate-400">Fetching vessel location...</p>
      </div>
    );
  }

  if (error && !vesselData) {
    return (
      <div className="text-center py-8">
        <MapPin className="h-12 w-12 text-red-300 mx-auto mb-4" />
        <p className="text-red-600 dark:text-red-400 mb-2">Failed to load vessel location</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
        <Button onClick={fetchVesselLocation} size="sm" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  if (!vesselData) {
    return (
      <div className="text-center py-8">
        <MapPin className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400">No vessel data available</p>
        <Button onClick={fetchVesselLocation} size="sm" variant="outline" className="mt-4">
          Fetch Location
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refresh Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {lastUpdated && (
            <span>Last updated: {lastUpdated.toLocaleString()}</span>
          )}
        </div>
        <Button
          onClick={fetchVesselLocation}
          disabled={loading}
          size="sm"
          variant="outline"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              Updating...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 mr-2" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {/* Vessel Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Position</span>
            </div>
            <p className="text-lg font-bold">{formatCoordinates(vesselData.lat, vesselData.lon)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Speed</span>
            </div>
            <p className="text-lg font-bold">{formatSpeed(vesselData.speed)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <ArrowLeft className="h-4 w-4 text-purple-500" style={{ transform: `rotate(${vesselData.course}deg)` }} />
              <span className="text-sm font-medium">Course</span>
            </div>
            <p className="text-lg font-bold">{formatCourse(vesselData.course)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Ship className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Status</span>
            </div>
            <p className="text-sm font-bold">{vesselData.status || 'Unknown'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Map Container */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            Live Map View
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-96 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${vesselData.lon - 0.1},${vesselData.lat - 0.1},${vesselData.lon + 0.1},${vesselData.lat + 0.1}&layer=mapnik&marker=${vesselData.lat},${vesselData.lon}`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              title={`${vesselName} Location`}
              className="rounded-lg"
            />
            <div className="absolute top-2 left-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-lg">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">{vesselName}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Vessel Information */}
      {(vesselData.destination || vesselData.eta) && (
        <Card>
          <CardHeader>
            <CardTitle>Voyage Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vesselData.destination && (
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Destination</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{vesselData.destination}</p>
                </div>
              )}
              {vesselData.eta && (
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">ETA</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{new Date(vesselData.eta).toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type CreateActivityData = z.infer<typeof insertDailyActivitySchema>;

type PhotoGroupWithPhotos = ProjectPhotoGroup & {
  photos: ProjectPhoto[];
  dailyActivity?: {
    id: number;
    date: string;
    location: string;
    completedTasks: string;
  };
};

export default function ProjectDetail() {
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const { isAuthenticated, user, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isBulkLocationDialogOpen, setIsBulkLocationDialogOpen] = useState(false);
  const [isPhotoGroupDialogOpen, setIsPhotoGroupDialogOpen] = useState(false);
  const [selectedPhotoGroup, setSelectedPhotoGroup] = useState<PhotoGroupWithPhotos | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  // Activity record ids of the day being edited, in the same order as
  // completedActivities. Empty when adding a new day.
  const [editingDayActivityIds, setEditingDayActivityIds] = useState<number[]>([]);
  // Set while the photo group dialog is editing an existing group rather than
  // creating one. Photos are not editable, so the file input is hidden then.
  const [editingPhotoGroupId, setEditingPhotoGroupId] = useState<number | null>(null);
  const [photoGroupData, setPhotoGroupData] = useState({
    title: "",
    date: new Date().toISOString().split('T')[0],
    description: "",
    dailyActivityId: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedImageForPreview, setSelectedImageForPreview] = useState<ProjectPhoto | null>(null);

  // Completion report dialog
  const [isCompletionReportOpen, setIsCompletionReportOpen] = useState(false);
  const [completionReportTitle, setCompletionReportTitle] = useState("");
  const [completionReportSections, setCompletionReportSections] = useState({
    totalDays: true,
    locationBreakdown: true,
    photoGallery: true,
    consumables: true,
  });
  const [selectedCompletionPhotoIds, setSelectedCompletionPhotoIds] = useState<number[]>([]);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [completionReportSubmitting, setCompletionReportSubmitting] = useState(false);
  const [isEditProjectDialogOpen, setIsEditProjectDialogOpen] = useState(false);
  const [isConsumablesDialogOpen, setIsConsumablesDialogOpen] = useState(false);
  const [isReviewConsumablesOpen, setIsReviewConsumablesOpen] = useState(false);
  const [selectedConsumableIds, setSelectedConsumableIds] = useState<number[]>([]);
  const [editingManualItem, setEditingManualItem] = useState<any>(null);
  const [editManualItemForm, setEditManualItemForm] = useState({
    itemName: "",
    quantity: "",
    itemUnit: "",
    unitCost: ""
  });
  const [consumablesData, setConsumablesData] = useState({
    date: new Date().toISOString().split('T')[0],
  });
  const [consumablesItems, setConsumablesItems] = useState<Array<{
    inventoryItemId?: number | null;
    itemName: string;
    quantity: number;
    unitCost?: string;
    itemUnit?: string;
    isManual?: boolean;
  }>>([]);
  const [newConsumableItem, setNewConsumableItem] = useState({
    inventoryItemId: 0,
    itemName: "",
    quantity: 1,
    unitCost: "",
    itemUnit: "",
    isManual: false,
  });
  const [consumableEntryType, setConsumableEntryType] = useState<"inventory" | "manual">("inventory");
  const [activityDateFilter, setActivityDateFilter] = useState({
    startDate: "",
    endDate: "",
  });
  const [isAssetAssignmentDialogOpen, setIsAssetAssignmentDialogOpen] = useState(false);
  const [assetAssignmentData, setAssetAssignmentData] = useState({
    instanceId: 0,
    startDate: "",
    endDate: "",
    monthlyRate: "",
    notes: "",
  });
  const [editProjectData, setEditProjectData] = useState({
    title: "",
    description: "",
    vesselName: "",
    vesselImage: "",
    vesselImoNumber: "",
    status: "",
    startDate: "",
    plannedEndDate: "",
    actualEndDate: "",
    ridgingCrewNos: "",
    modeOfContract: "",
    workingHours: "",
    ppe: "",
    additionalField1Title: "",
    additionalField1Description: "",
    additionalField2Title: "",
    additionalField2Description: "",
    additionalField3Title: "",
    additionalField3Description: "",
    additionalField4Title: "",
    additionalField4Description: "",
    additionalField5Title: "",
    additionalField5Description: "",
    additionalField6Title: "",
    additionalField6Description: "",
    surfaceTemperature: "",
    airTemperature: "",
    relativeHumidity: "",
    dewPointTemperature: "",
    dewPointSurfaceDiff: "",
    customerId: "",
  });
  const [isCustomContractMode, setIsCustomContractMode] = useState(false);
  const [customContractMode, setCustomContractMode] = useState("");
  const [vesselImageFile, setVesselImageFile] = useState<File | null>(null);
  const [newWorkRemainingRows, setNewWorkRemainingRows] = useState<Array<{ location: string; days: string }>>([
    { location: "", days: "" }
  ]);

  const { data: customers } = useQuery<any[]>({
    queryKey: ["/api/customers/all"],
    queryFn: async () => {
      const response = await fetch(`/api/customers/all`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const [activityData, setActivityData] = useState<{
    date: string;
    location: string;
    completedTasks: string;
    plannedTasks: string;
    hbmDailyRunningHours: string;
    remarks: string;
    photos: string[];
    isStoppage: boolean;
    stoppageReason: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    location: "",
    completedTasks: "",
    plannedTasks: "",
    hbmDailyRunningHours: "",
    remarks: "",
    photos: [],
    isStoppage: false,
    stoppageReason: "",
  });

  const [completedActivities, setCompletedActivities] = useState<Array<{
    location: string;
    tasks: string;
  }>>([]);

  const [newCompletedActivity, setNewCompletedActivity] = useState({
    location: "",
    tasks: "",
  });
  const [isCustomCompletedLocation, setIsCustomCompletedLocation] = useState(false);
  // Index of the completed activity being edited, or null when adding a new one.
  // Distinct from editingActivityId, which is the daily-activity RECORD being
  // edited — these are the rows inside it.
  const [editingCompletedActivityIndex, setEditingCompletedActivityIndex] =
    useState<number | null>(null);
  const completedActivityFormRef = useRef<HTMLDivElement>(null);
  const completedTasksRef = useRef<HTMLTextAreaElement>(null);

  const [isPlannedActivityDialogOpen, setIsPlannedActivityDialogOpen] = useState(false);
  const [plannedActivities, setPlannedActivities] = useState<Array<{
    location: string;
    tasks: string;
    date: string;
  }>>([]);

  const [newPlannedActivity, setNewPlannedActivity] = useState({
    location: "",
    tasks: "",
    date: new Date().toISOString().split('T')[0],
  });
  const [isCustomPlannedLocation, setIsCustomPlannedLocation] = useState(false);

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [newLocation, setNewLocation] = useState("");
  const [locationSearchTerm, setLocationSearchTerm] = useState("");
  const [bulkLocations, setBulkLocations] = useState("");
  const [employeeAssignments, setEmployeeAssignments] = useState<
    { employeeId: number; startDate: string; endDate: string }[]
  >([]);

  // Pagination state
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [plannedActivitiesPage, setPlannedActivitiesPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch project");
      return response.json();
    },
    enabled: isAuthenticated && !!id,
  });

  const { data: activitiesData } = useQuery<{ data: DailyActivity[]; total: number }>({
    queryKey: ["/api/projects", id, "activities", activitiesPage],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/activities?page=${activitiesPage}&limit=${itemsPerPage}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch activities");
      return response.json();
    },
    enabled: isAuthenticated && !!id,
  });

  const activities = activitiesData?.data || [];
  const activitiesTotalPages = activitiesData ? Math.ceil(activitiesData.total / itemsPerPage) : 0;

  const { data: allActivities } = useQuery<DailyActivity[]>({
    queryKey: ["/api/projects", id, "activities", "all"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/activities/all`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch all activities");
      return response.json();
    },
    enabled: isAuthenticated && !!id,
  });

  const { data: completionReportPhotoGroups } = useQuery<any[]>({
    queryKey: ["/api/projects", id, "completion-report", "photos"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/completion-report/photos`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch photo groups");
      return response.json();
    },
    enabled: isAuthenticated && !!id && isCompletionReportOpen,
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    enabled: isAuthenticated,
  });

  const { data: projectEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/projects", id, "employees"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/employees`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch project employees");
      return response.json();
    },
    enabled: isAuthenticated && !!id,
  });

  // Initialize selected employees with current project assignments
  useEffect(() => {
    if (projectEmployees && isTeamDialogOpen) {
      setSelectedEmployees(projectEmployees.map(emp => emp.id));
      setEmployeeAssignments(projectEmployees.map(emp => ({
        employeeId: emp.id,
        startDate: (emp as any).startDate ? (emp as any).startDate.split('T')[0] : "",
        endDate: (emp as any).endDate ? (emp as any).endDate.split('T')[0] : ""
      })));
    }
  }, [projectEmployees, isTeamDialogOpen]);

  // Initialize edit form data when project loads or dialog opens
  useEffect(() => {
    if (project && isEditProjectDialogOpen) {
      const standardContractModes = ["fixed_price", "time_and_materials", "cost_plus", "day_rate", "lump_sum", "monthly_contract"];
      const isCustom = project.modeOfContract && !standardContractModes.includes(project.modeOfContract);

      setEditProjectData({
        title: project.title || "",
        description: project.description || "",
        vesselName: project.vesselName || "",
        vesselImage: project.vesselImage || "",
        vesselImoNumber: project.vesselImoNumber || "",
        status: project.status || "",
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
        plannedEndDate: project.plannedEndDate ? new Date(project.plannedEndDate).toISOString().split('T')[0] : "",
        actualEndDate: project.actualEndDate ? new Date(project.actualEndDate).toISOString().split('T')[0] : "",
        ridgingCrewNos: project.ridgingCrewNos || "",
        modeOfContract: isCustom ? "custom" : project.modeOfContract || "",
        workingHours: project.workingHours || "",
        ppe: project.ppe || "",
        additionalField1Title: project.additionalField1Title || "",
        additionalField1Description: project.additionalField1Description || "",
        additionalField2Title: project.additionalField2Title || "",
        additionalField2Description: project.additionalField2Description || "",
        additionalField3Title: project.additionalField3Title || "",
        additionalField3Description: project.additionalField3Description || "",
        additionalField4Title: project.additionalField4Title || "",
        additionalField4Description: project.additionalField4Description || "",
        additionalField5Title: project.additionalField5Title || "",
        additionalField5Description: project.additionalField5Description || "",
        additionalField6Title: project.additionalField6Title || "",
        additionalField6Description: project.additionalField6Description || "",
        surfaceTemperature: project.surfaceTemperature || "",
        airTemperature: project.airTemperature || "",
        relativeHumidity: project.relativeHumidity || "",
        dewPointTemperature: project.dewPointTemperature || "",
        dewPointSurfaceDiff: project.dewPointSurfaceDiff || "",
        customerId: project.customerId?.toString() || "",
      });

      if (isCustom) {
        setIsCustomContractMode(true);
        setCustomContractMode(project.modeOfContract || "");
      } else {
        setIsCustomContractMode(false);
        setCustomContractMode("");
      }
    }
  }, [project, isEditProjectDialogOpen]);

  // Initialize activity date filter with project dates
  useEffect(() => {
    if (project) {
      setActivityDateFilter({
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
        endDate: project.actualEndDate
          ? new Date(project.actualEndDate).toISOString().split('T')[0]
          : project.plannedEndDate
            ? new Date(project.plannedEndDate).toISOString().split('T')[0]
            : "",
      });
    }
  }, [project]);

  // Initialize asset assignment dates with project dates
  useEffect(() => {
    if (project && isAssetAssignmentDialogOpen) {
      setAssetAssignmentData(prev => ({
        ...prev,
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
        endDate: project.plannedEndDate ? new Date(project.plannedEndDate).toISOString().split('T')[0] : "",
      }));
    }
  }, [project, isAssetAssignmentDialogOpen]);

  const { data: photoGroups } = useQuery<PhotoGroupWithPhotos[]>({
    queryKey: ["/api/projects", id, "photo-groups"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/photo-groups`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch photo groups");
      return response.json();
    },
    enabled: isAuthenticated && !!id,
  });

  const { data: inventoryResponse } = useQuery<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/inventory"],
    enabled: isAuthenticated,
  });

  const inventoryItems = inventoryResponse?.data;

  const { data: consumablesHistory } = useQuery<any[]>({
    queryKey: ["/api/projects", id, "consumables"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/consumables`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch consumables");
      return response.json();
    },
    enabled: isAuthenticated && !!id,
  });

  const { data: plannedActivitiesData } = useQuery<{ data: Array<{ location: string; tasks: string; date: string }>; total: number }>({
    queryKey: ["/api/projects", id, "planned-activities", plannedActivitiesPage],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/planned-activities?page=${plannedActivitiesPage}&limit=${itemsPerPage}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch planned activities");
      return response.json();
    },
    enabled: isAuthenticated && !!id,
  });

  const savedPlannedActivities = plannedActivitiesData?.data || [];
  const plannedActivitiesTotalPages = plannedActivitiesData ? Math.ceil(plannedActivitiesData.total / itemsPerPage) : 0;

  const { data: assets } = useQuery<any[]>({
    queryKey: ["asset-instances"],
    queryFn: async () => {
      const response = await fetch("/api/asset-inventory/instances", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch asset instances");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: projectAssets } = useQuery<any[]>({
    queryKey: ["/api/projects", id, "asset-instance-assignments"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/asset-instance-assignments`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch project asset instance assignments");
      return response.json();
    },
    enabled: isAuthenticated && !!id,
  });

  // Project revenue data (only for admin and finance users)
  const { data: projectRevenue } = useQuery<{
    projectId: number;
    totalRevenue: string;
    totalCost: string;
    profit: string;
    invoicePayments: any[];
  }>({
    queryKey: ["/api/projects", id, "revenue"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/revenue`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch project revenue");
      return response.json();
    },
    enabled: isAuthenticated && !!id && (user?.role === "admin" || user?.role === "finance"),
  });



  const createActivityMutation = useMutation({
    mutationFn: async (data: CreateActivityData) => {
      return await apiRequest(`/api/projects/${id}/activities`, {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "activities"] });
      toast({
        title: "Activity Added",
        description: "Daily activity has been logged successfully.",
      });
      setIsActivityDialogOpen(false);
      resetActivityForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add activity",
        variant: "destructive",
      });
    },
  });

  const savePlannedActivitiesMutation = useMutation({
    mutationFn: async (activities: Array<{ location: string; tasks: string; date: string }>) => {
      return await apiRequest(`/api/projects/${id}/planned-activities`, { method: "POST", body: activities, });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "planned-activities"] });
      toast({
        title: "Planned Activities Saved",
        description: "Planned activities have been saved successfully.",
      });
      setIsPlannedActivityDialogOpen(false);
      setPlannedActivities([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save planned activities",
        variant: "destructive",
      });
    },
  });

  // Opens the activity dialog for a whole day: every location of that day is
  // loaded into completedActivities, alongside the day-level fields.
  const openEditDayDialog = (dayActivities: DailyActivity[]) => {
    if (dayActivities.length === 0) return;
    const first = dayActivities[0];
    const activityDateStr = first.date ? new Date(first.date).toISOString().split('T')[0] : "";
    // Load the day-level remark: find the first non-empty remark among all
    // activities on the same date (not just this record's own remark)
    const dayRemark = allActivities
      ?.filter(a => a.date && new Date(a.date).toISOString().split('T')[0] === activityDateStr)
      ?.find(a => a.remarks)?.remarks || first.remarks || "";
    // HBM hours and the stoppage flag are day-level too: they are written to
    // every record of the day, so the first non-empty one represents the day.
    const dayHbm = dayActivities.find(a => a.hbmDailyRunningHours)?.hbmDailyRunningHours;
    const stoppageRecord = dayActivities.find(a => (a as any).isStoppage);
    setEditingActivityId(first.id);
    setEditingDayActivityIds(dayActivities.map(a => a.id));
    setActivityData({
      date: activityDateStr || new Date().toISOString().split('T')[0],
      location: first.location || "",
      completedTasks: first.completedTasks || "",
      plannedTasks: first.plannedTasks || "",
      hbmDailyRunningHours: dayHbm ? String(dayHbm) : "",
      remarks: dayRemark,
      photos: first.photos || [],
      isStoppage: !!stoppageRecord,
      stoppageReason: (stoppageRecord as any)?.stoppageReason || "",
    });
    setCompletedActivities(dayActivities.map(a => ({
      location: a.location || "",
      tasks: a.completedTasks || "",
    })));
    setIsActivityDialogOpen(true);
  };

  const resetActivityForm = () => {
    setActivityData({
      date: new Date().toISOString().split('T')[0],
      location: "",
      completedTasks: "",
      plannedTasks: "",
      hbmDailyRunningHours: "",
      remarks: "",
      photos: [],
      isStoppage: false,
      stoppageReason: "",
    });
    setCompletedActivities([]);
    setNewCompletedActivity({
      location: "",
      tasks: "",
    });
    setIsCustomCompletedLocation(true);
    setEditingCompletedActivityIndex(null);
    setEditingDayActivityIds([]);
  };

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityData.date || completedActivities.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in the required fields (date and at least one completed activity)",
        variant: "destructive",
      });
      return;
    }

    // Create proper date object from the date string with timezone handling
    const activityDate = new Date(activityData.date + 'T00:00:00.000Z');

    try {
      if (editingDayActivityIds.length > 0) {
        // Editing an existing day: reconcile the edited location list against
        // the day's existing records, pairing them by position. Records left
        // over at the end were removed by the user and are deleted.
        const removedIds = editingDayActivityIds.slice(completedActivities.length);

        // A record still referenced by a photo group cannot be deleted (foreign
        // key), so stop before making any change rather than fail halfway.
        const blockedIds = removedIds.filter(rid => activityIdsWithPhotos.has(rid));
        if (blockedIds.length > 0) {
          const blockedNames = blockedIds
            .map(rid => allActivities?.find(a => a.id === rid)?.location || "a location")
            .join(", ");
          toast({
            title: "Cannot remove location",
            description: `Photos are linked to ${blockedNames}. Delete the photo group first, then remove the location.`,
            variant: "destructive",
          });
          return;
        }

        const buildData = (activity: { location: string; tasks: string }, isFirst: boolean): CreateActivityData => ({
          projectId: parseInt(id!),
          date: activityDate,
          location: activity.location || "",
          completedTasks: activity.tasks,
          plannedTasks: activityData.plannedTasks || "",
          hbmDailyRunningHours: activityData.hbmDailyRunningHours || "",
          // Remarks are stored only on the first record (one remark per day)
          remarks: isFirst ? (activityData.remarks || "") : "",
          photos: [],
          isStoppage: activityData.isStoppage,
          stoppageReason: activityData.isStoppage ? activityData.stoppageReason : null,
        } as any);

        for (let i = 0; i < completedActivities.length; i++) {
          const submitData = buildData(completedActivities[i], i === 0);
          if (i < editingDayActivityIds.length) {
            await apiRequest(`/api/projects/${id}/activities/${editingDayActivityIds[i]}`, {
              method: "PUT",
              body: submitData,
            });
          } else {
            await apiRequest(`/api/projects/${id}/activities`, {
              method: "POST",
              body: submitData,
            });
          }
        }

        for (const removedId of removedIds) {
          await apiRequest(`/api/projects/${id}/activities/${removedId}`, {
            method: "DELETE",
          });
        }

        toast({
          title: "Activities Updated",
          description: "The day's activities have been updated successfully.",
        });
      } else {
        // Create a separate record for each completed activity
        // Remarks are stored only on the first record (one remark per day)
        for (let i = 0; i < completedActivities.length; i++) {
          const activity = completedActivities[i];
          const submitData: CreateActivityData = {
            projectId: parseInt(id!),
            date: activityDate,
            location: activity.location || "",
            completedTasks: activity.tasks,
            plannedTasks: activityData.plannedTasks || "",
            hbmDailyRunningHours: activityData.hbmDailyRunningHours || "",
            remarks: i === 0 ? (activityData.remarks || "") : "",
            photos: [],
            isStoppage: activityData.isStoppage,
            stoppageReason: activityData.isStoppage ? activityData.stoppageReason : null,
          } as any;

          await apiRequest(`/api/projects/${id}/activities`, {
            method: "POST",
            body: submitData,
          });
        }
        
        toast({
          title: "Activities Added",
          description: "Daily activities have been logged successfully.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "activities"] });
      setIsActivityDialogOpen(false);
      resetActivityForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingActivityId ? 'update' : 'add'} activities`,
        variant: "destructive",
      });
    }
  };

  const addCompletedActivity = () => {
    if (!newCompletedActivity.tasks.trim()) {
      toast({
        title: "Error",
        description: "Please enter completed tasks",
        variant: "destructive",
      });
      return;
    }

    setCompletedActivities(prev =>
      editingCompletedActivityIndex === null
        ? [...prev, { ...newCompletedActivity }]
        : prev.map((existing, i) =>
            i === editingCompletedActivityIndex
              ? { ...newCompletedActivity }
              : existing,
          ),
    );
    setNewCompletedActivity({
      location: "",
      tasks: "",
    });
    setIsCustomCompletedLocation(true);
    setEditingCompletedActivityIndex(null);
    setEditingActivityId(null);
  };

  // Load an added activity back into the form above the list. Saving then
  // replaces that row rather than appending a new one.
  const startEditCompletedActivity = (index: number) => {
    const activity = completedActivities[index];
    if (!activity) return;

    setNewCompletedActivity({
      location: activity.location || "",
      tasks: activity.tasks || "",
    });
    // A location that is not one of the project's own is a custom entry, so the
    // free-text field has to be shown or the value would be invisible and lost
    // on save.
    const isKnownLocation = !!activity.location &&
      Array.isArray(project?.locations) &&
      project.locations.includes(activity.location);
    setIsCustomCompletedLocation(!isKnownLocation);

    setEditingCompletedActivityIndex(index);
    completedActivityFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    window.setTimeout(() => completedTasksRef.current?.focus(), 0);
  };

  const cancelEditCompletedActivity = () => {
    setNewCompletedActivity({
      location: "",
      tasks: "",
    });
    setIsCustomCompletedLocation(true);
    setEditingCompletedActivityIndex(null);
  };

  const removeCompletedActivity = (index: number) => {
    setCompletedActivities(prev => prev.filter((_, i) => i !== index));
  };

  const addPlannedActivity = () => {
    if (!newPlannedActivity.tasks.trim() || !newPlannedActivity.date) {
      toast({
        title: "Error",
        description: "Please enter planned tasks and date",
        variant: "destructive",
      });
      return;
    }

    setPlannedActivities(prev => [...prev, { ...newPlannedActivity }]);
    setNewPlannedActivity({
      location: "",
      tasks: "",
      date: new Date().toISOString().split('T')[0],
    });
    setIsCustomCompletedLocation(true);
  };

  const removePlannedActivity = (index: number) => {
    setPlannedActivities(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = (e: React.FormEvent) => {
    e.preventDefault();
    // Photo upload functionality would be implemented here
    // For now, just show a placeholder message
    toast({
      title: "Photo Upload",
      description: "Photo upload functionality will be implemented soon.",
    });
    setIsPhotoDialogOpen(false);
  };

  const handleTeamAssignment = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedEmployees.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one employee to assign",
        variant: "destructive",
      });
      return;
    }

    // Build assignments array with dates, ensuring proper validation
    const assignments = selectedEmployees.map(employeeId => {
      const assignment = employeeAssignments.find(a => a.employeeId === employeeId);

      // Validate dates if provided
      let startDate = assignment?.startDate || "";
      let endDate = assignment?.endDate || "";

      // If end date is provided but no start date, use project start date or current date
      if (endDate && !startDate) {
        startDate = project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      }

      // Validate that end date is not before start date
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
          toast({
            title: "Error",
            description: "End date cannot be before start date",
            variant: "destructive",
          });
          return null;
        }
      }

      return {
        employeeId,
        startDate,
        endDate,
      };
    }).filter(Boolean); // Remove any null assignments from validation failures

    if (assignments.length !== selectedEmployees.length) {
      return; // Validation failed, error message already shown
    }

    console.log('Submitting team assignments:', assignments);
    assignTeamMutation.mutate(assignments);
  };

  const addLocationMutation = useMutation({
    mutationFn: async (location: string) => {
      if (!location.trim()) {
        throw new Error("Location name cannot be empty");
      }

      const currentLocations = project?.locations || [];
      if (currentLocations.includes(location.trim())) {
        throw new Error("This location already exists");
      }

      const updatedLocations = [...currentLocations, location.trim()];
      return await apiRequest(`/api/projects/${id}`, { method: "PUT", body: { locations: updatedLocations } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "Location Added",
        description: "Location has been added to the project successfully.",
      });
      setIsLocationDialogOpen(false);
      setNewLocation("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add location",
        variant: "destructive",
      });
    },
  });

  const addBulkLocationsMutation = useMutation({
    mutationFn: async (locations: string[]) => {
      const trimmedLocations = locations
        .map(loc => loc.trim())
        .filter(loc => loc.length > 0);

      if (trimmedLocations.length === 0) {
        throw new Error("No valid locations found");
      }

      const currentLocations = project?.locations || [];
      const duplicates = trimmedLocations.filter(loc => currentLocations.includes(loc));

      if (duplicates.length > 0) {
        throw new Error(`Some locations already exist: ${duplicates.join(", ")}`);
      }

      const updatedLocations = [...currentLocations, ...trimmedLocations];
      return await apiRequest(`/api/projects/${id}`, { method: "PUT", body: { locations: updatedLocations } });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      const validLocations = variables.filter(loc => loc.trim()).length;
      toast({
        title: "Locations Added",
        description: `${validLocations} new location${validLocations !== 1 ? 's' : ''} added successfully.`,
      });
      setIsBulkLocationDialogOpen(false);
      setBulkLocations("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add locations",
        variant: "destructive",
      });
    },
  });

  const removeLocationMutation = useMutation({
    mutationFn: async (locationToRemove: string) => {
      const currentLocations = project?.locations || [];
      if (!currentLocations.includes(locationToRemove)) {
        throw new Error("Location not found");
      }

      const updatedLocations = currentLocations.filter(loc => loc !== locationToRemove);
      return await apiRequest(`/api/projects/${id}`, { method: "PUT", body: { locations: updatedLocations } });
    },
    onSuccess: (_, locationToRemove) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "Location Removed",
        description: `Location "${locationToRemove}" has been removed.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove location",
        variant: "destructive",
      });
    },
  });

  const createPhotoGroupMutation = useMutation({
    mutationFn: async (data: { title: string; date: string; description?: string; dailyActivityId?: string; photos?: File[] }) => {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('date', data.date);
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.dailyActivityId) {
        formData.append('dailyActivityId', data.dailyActivityId);
      }
      if (data.photos) {
        for (const file of data.photos) {
          formData.append('photos', file);
        }
      }

      const response = await fetch(`/api/projects/${id}/photo-groups`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create photo group');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "photo-groups"] });
      toast({
        title: "Photo Group Created",
        description: "Photo group has been created successfully.",
      });
      setIsPhotoGroupDialogOpen(false);
      resetPhotoGroupForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create photo group",
        variant: "destructive",
      });
    },
  });

  const updatePhotoGroupMutation = useMutation({
    mutationFn: async (data: { groupId: number; title: string; date: string; description?: string; dailyActivityId?: string }) => {
      const { groupId, ...body } = data;
      return await apiRequest(`/api/projects/${id}/photo-groups/${groupId}`, {
        method: "PUT",
        body: {
          ...body,
          // An empty selection clears the link: linking is optional.
          dailyActivityId: body.dailyActivityId || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "photo-groups"] });
      toast({
        title: "Photo Group Updated",
        description: "Photo group has been updated successfully.",
      });
      setIsPhotoGroupDialogOpen(false);
      resetPhotoGroupForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update photo group",
        variant: "destructive",
      });
    },
  });

  const deletePhotoGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const response = await apiRequest(`/api/projects/${id}/photo-groups/${groupId}`, { method: "DELETE" });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "photo-groups"] });
      toast({
        title: "Photo Group Deleted",
        description: "Photo group has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete photo group",
        variant: "destructive",
      });
    },
  });

  const recalculateCostMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/projects/${id}/recalculate-cost`, { method: "POST" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "Cost Recalculated",
        description: "Project cost has been recalculated based on assigned employees.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to recalculate project cost",
        variant: "destructive",
      });
    },
  });

  const handleRecalculateCost = () => {
    startTransition(() => {
      recalculateCostMutation.mutate();
    });
  };

  const handleSavePlannedActivities = () => {
    if (plannedActivities.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one planned activity before saving",
        variant: "destructive",
      });
      return;
    }

    savePlannedActivitiesMutation.mutate(plannedActivities);
  };

  const editProjectMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        body: data,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to update project");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "Project Updated",
        description: "Project has been updated successfully.",
      });
      setIsEditProjectDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project",
        variant: "destructive",
      });
    },
  });

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.trim()) {
      toast({
        title: "Error",
        description: "Please enter a location name",
        variant: "destructive",
      });
      return;
    }

    addLocationMutation.mutate(newLocation.trim());
  };

  const handleBulkAddLocations = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkLocations.trim()) {
      toast({
        title: "Error",
        description: "Please enter locations",
        variant: "destructive",
      });
      return;
    }

    const locations = bulkLocations
      .split('\n')
      .map(loc => loc.trim())
      .filter(loc => loc.length > 0);

    if (locations.length === 0) {
      toast({
        title: "Error",
        description: "No valid locations found",
        variant: "destructive",
      });
      return;
    }

    addBulkLocationsMutation.mutate(locations);
  };

  const handleRemoveLocation = (location: string) => {
    if (confirm(`Are you sure you want to remove the location "${location}"?`)) {
      removeLocationMutation.mutate(location);
    }
  };

  const resetPhotoGroupForm = () => {
    setPhotoGroupData({
      title: "",
      date: new Date().toISOString().split('T')[0],
      description: "",
      dailyActivityId: "",
    });
    setSelectedFiles(null);
    setEditingPhotoGroupId(null);
  };

  // Loads an existing group into the same dialog used for creating one.
  const openEditPhotoGroupDialog = (group: PhotoGroupWithPhotos) => {
    setEditingPhotoGroupId(group.id);
    setPhotoGroupData({
      title: group.title || "",
      date: group.date ? new Date(group.date).toISOString().split('T')[0] : "",
      description: group.description || "",
      dailyActivityId: (group as any).dailyActivityId
        ? String((group as any).dailyActivityId)
        : "",
    });
    setSelectedFiles(null);
    setIsPhotoGroupDialogOpen(true);
  };

  const handlePhotoGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoGroupData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the photo group",
        variant: "destructive",
      });
      return;
    }

    // Editing never touches the photos, so the group keeps the ones it has.
    if (editingPhotoGroupId !== null) {
      updatePhotoGroupMutation.mutate({
        groupId: editingPhotoGroupId,
        ...photoGroupData,
      });
      return;
    }

    if (!selectedFiles || selectedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one photo for the group",
        variant: "destructive",
      });
      return;
    }

    const files = Array.from(selectedFiles);
    createPhotoGroupMutation.mutate({
      ...photoGroupData,
      dailyActivityId: photoGroupData.dailyActivityId || undefined,
      photos: files,
    });
  };

  const assignTeamMutation = useMutation({
    mutationFn: async (assignments: { employeeId: number; startDate: string; endDate: string }[]) => {
      console.log('Sending assignment request with data:', assignments);
      const response = await apiRequest(`/api/projects/${id}/employees`, {
        method: "POST",
        body: { assignments },
      });

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] }); // Refresh project data too
      toast({
        title: "Team Assigned",
        description: "Employees have been assigned to the project successfully.",
      });
      setIsTeamDialogOpen(false);
      setSelectedEmployees([]);
      setEmployeeAssignments([]);
    },
    onError: (error: Error) => {
      console.error('Team assignment error:', error);
      // apiRequest already throws formatted error "400: Message"
      const errorMessage = error.message.includes(':') 
        ? error.message.split(':').slice(1).join(':').trim() 
        : error.message;
        
      toast({
        title: "Team Assignment Failed",
        description: errorMessage || "Failed to assign team members",
        variant: "destructive",
      });
    },
  });

  const removeEmployeeMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const response = await apiRequest(`/api/projects/${id}/employees/${employeeId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "employees"] });
      toast({
        title: "Employee Removed",
        description: "Employee has been removed from the project.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove employee",
        variant: "destructive",
      });
    },
  });

  const recordConsumablesMutation = useMutation({
    mutationFn: async (data: { date: string; items: Array<{ inventoryItemId: number; quantity: number; }> }) => {
      const response = await apiRequest(`/api/projects/${id}/consumables`, { method: "POST", body: data });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "consumables"] });
      toast({
        title: "Consumables Recorded",
        description: "Consumables usage has been recorded successfully.",
      });
      setIsConsumablesDialogOpen(false);
      resetConsumablesForm();
    },
    onError: (error: Error) => {
      console.error("Failed to record consumables:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record consumables usage",
        variant: "destructive",
      });
    },
  });

  const updateConsumableItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: any }) => {
      const response = await apiRequest(`/api/projects/${id}/consumables/items/${itemId}`, {
        method: "PUT",
        body: data
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      setEditingManualItem(null);
      toast({
        title: "Item Updated",
        description: "The manual consumable item has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to update consumable item:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update item",
        variant: "destructive",
      });
    }
  });

  const createConsumablesGoodIssueMutation = useMutation({
    mutationFn: async (consumableIds: number[]) => {
      const response = await apiRequest(`/api/projects/${id}/consumables/goods-issue`, {
        method: "POST",
        body: { consumableIds },
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goods-issue"] });
      toast({
        title: "Goods Issue Created",
        description: `Goods Issue ${data.goodsIssueRef} has been created for ${data.updatedCount} consumable record(s).`,
      });
      setIsReviewConsumablesOpen(false);
      setSelectedConsumableIds([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create goods issue",
        variant: "destructive",
      });
    },
  });

  const assignAssetMutation = useMutation({
    mutationFn: async (data: { instanceId: number; startDate: string; endDate: string; notes?: string, monthlyRate: string; }) => {
      const response = await apiRequest(`/api/projects/${id}/asset-instance-assignments`, { method: "POST", body: data });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "asset-instance-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] }); // Refresh project cost
      queryClient.invalidateQueries({ queryKey: ["asset-instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "revenue"] });
      toast({
        title: "Asset Instance Assigned",
        description: "Asset instance has been assigned to the project successfully.",
      });
      setIsAssetAssignmentDialogOpen(false);
      resetAssetAssignmentForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign asset instance",
        variant: "destructive",
      });
    },
  });

  const removeAssetMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const response = await apiRequest(`/api/projects/${id}/asset-instance-assignments/${assignmentId}`, { method: "DELETE" });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "asset-instance-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] }); // Refresh project cost
      queryClient.invalidateQueries({ queryKey: ["asset-instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "revenue"] });
      toast({
        title: "Asset Instance Removed",
        description: "Asset instance has been removed from the project.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove asset instance",
        variant: "destructive",
      });
    },
  });

  const resetConsumablesForm = () => {
    setConsumablesData({
      date: new Date().toISOString().split('T')[0],
    });
    setConsumablesItems([]);
    setNewConsumableItem({
      inventoryItemId: 0,
      itemName: "",
      quantity: 1,
    });
  };

  const resetAssetAssignmentForm = () => {
    setAssetAssignmentData({
      instanceId: 0,
      startDate: project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
      endDate: project?.plannedEndDate ? new Date(project.plannedEndDate).toISOString().split('T')[0] : "",
      monthlyRate: "",
      notes: "",
    });
  };

  const handleAssetAssignmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!assetAssignmentData.instanceId || !assetAssignmentData.startDate || !assetAssignmentData.monthlyRate) {
      toast({
        title: "Error",
        description: "Please select an asset instance, start date and monthly rate",
        variant: "destructive",
      });
      return;
    }

    // Validate dates if end date is provided
    if (assetAssignmentData.endDate) {
      const startDate = new Date(assetAssignmentData.startDate);
      const endDate = new Date(assetAssignmentData.endDate);

      if (endDate <= startDate) {
        toast({
          title: "Error",
          description: "End date must be after start date",
          variant: "destructive",
        });
        return;
      }

      // Check if asset instance is already assigned during this period
      const isOverlapping = projectAssets?.some(assignment => {
        if (assignment.instanceId !== assetAssignmentData.instanceId) return false;

        if (!assignment.endDate) return true; // Ongoing assignment

        const existingStart = new Date(assignment.startDate);
        const existingEnd = new Date(assignment.endDate);

        return (startDate <= existingEnd && endDate >= existingStart);
      });

      if (isOverlapping) {
        toast({
          title: "Error",
          description: "Asset instance is already assigned to this project during the selected period",
          variant: "destructive",
        });
        return;
      }
    }

    // Submit the assignment (backend will handle monthly rate from instance)
    assignAssetMutation.mutate(assetAssignmentData);
  };

  const addConsumableItem = () => {
    try {
      if (consumableEntryType === "inventory") {
        if (!newConsumableItem.inventoryItemId || newConsumableItem.quantity <= 0) {
          toast({
            title: "Error",
            description: "Please select an item and enter a valid quantity",
            variant: "destructive",
          });
          return;
        }

        if (consumablesItems.some(item => !item.isManual && item.inventoryItemId === newConsumableItem.inventoryItemId)) {
          toast({
            title: "Error",
            description: "This item is already in the list",
            variant: "destructive",
          });
          return;
        }

        const selectedItem = inventoryItems?.find(item => item.id === newConsumableItem.inventoryItemId);
        if (selectedItem && newConsumableItem.quantity > selectedItem.currentStock) {
          toast({
            title: "Error",
            description: `Insufficient stock. Available: ${selectedItem.currentStock} ${selectedItem.unit}`,
            variant: "destructive",
          });
          return;
        }

        setConsumablesItems(prev => [...prev, {
          inventoryItemId: newConsumableItem.inventoryItemId,
          itemName: newConsumableItem.itemName,
          quantity: newConsumableItem.quantity,
          isManual: false,
        }]);
        setNewConsumableItem({
          inventoryItemId: 0,
          itemName: "",
          quantity: 1,
          unitCost: "",
          itemUnit: "",
          isManual: false,
        });
      } else {
        if (!newConsumableItem.itemName.trim() || newConsumableItem.quantity <= 0) {
          toast({
            title: "Error",
            description: "Please enter an item name and a valid quantity",
            variant: "destructive",
          });
          return;
        }

        setConsumablesItems(prev => [...prev, {
          inventoryItemId: null,
          itemName: newConsumableItem.itemName.trim(),
          quantity: newConsumableItem.quantity,
          unitCost: newConsumableItem.unitCost || "0",
          itemUnit: newConsumableItem.itemUnit || "pcs",
          isManual: true,
        }]);
        setNewConsumableItem({
          inventoryItemId: 0,
          itemName: "",
          quantity: 1,
          unitCost: "",
          itemUnit: "",
          isManual: false,
        });
      }
    } catch (error) {
      console.error("Error adding consumable item:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding the item",
        variant: "destructive",
      });
    }
  };

  const removeConsumableItem = (index: number) => {
    setConsumablesItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleConsumablesSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!consumablesData.date) {
        toast({
          title: "Error",
          description: "Please select a date",
          variant: "destructive",
        });
        return;
      }

      if (consumablesItems.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one item",
          variant: "destructive",
        });
        return;
      }

      // Show confirmation dialog
      const itemsList = consumablesItems.map(item => `• ${item.itemName}: ${item.quantity}${item.isManual ? ' (Manual)' : ''}`).join('\n');
      const hasInventoryItems = consumablesItems.some(item => !item.isManual);
      const confirmMessage = `Are you sure you want to record the following consumables usage for ${formatDate(consumablesData.date)}?\n\n${itemsList}${hasInventoryItems ? '\n\nInventory items will reduce stock levels and cannot be undone.' : ''}`;

      if (!confirm(confirmMessage)) {
        return;
      }

      const submitData = {
        date: consumablesData.date,
        items: consumablesItems.map(item => {
          if (item.isManual) {
            return {
              itemName: item.itemName,
              quantity: Number(item.quantity),
              unitCost: item.unitCost || "0",
              itemUnit: item.itemUnit || "pcs",
            };
          }
          return {
            inventoryItemId: Number(item.inventoryItemId),
            quantity: Number(item.quantity),
          };
        }),
      };

      recordConsumablesMutation.mutate(submitData);
    } catch (error) {
      console.error("Error in consumables form submission:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while submitting the form",
        variant: "destructive",
      });
    }
  };

  const handleDeletePhotoGroup = (groupId: number) => {
    if (confirm("Are you sure you want to delete this photo group? This action cannot be undone.")) {
      deletePhotoGroupMutation.mutate(groupId);
    }
  };

  const handleEditProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjectData.title.trim()) {
      toast({
        title: "Error",
        description: "Project title is required",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();


    // Helper to append if value is not null or undefined
    const appendIfExists = (key: string, value: string | number | null | undefined) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    };


    appendIfExists("title", editProjectData.title);
    appendIfExists("description", editProjectData.description);
    appendIfExists("vesselName", editProjectData.vesselName);
    appendIfExists("vesselImoNumber", editProjectData.vesselImoNumber);
    appendIfExists("status", editProjectData.status);
    appendIfExists("startDate", editProjectData.startDate);
    appendIfExists("plannedEndDate", editProjectData.plannedEndDate);
    appendIfExists("actualEndDate", editProjectData.actualEndDate);
    appendIfExists("ridgingCrewNos", editProjectData.ridgingCrewNos);
    if (isCustomContractMode) {
      appendIfExists("modeOfContract", customContractMode);
    } else {
      appendIfExists("modeOfContract", editProjectData.modeOfContract);
    }
    appendIfExists("workingHours", editProjectData.workingHours);
    appendIfExists("ppe", editProjectData.ppe);
    appendIfExists("additionalField1Title", editProjectData.additionalField1Title);
    appendIfExists("additionalField1Description", editProjectData.additionalField1Description);
    appendIfExists("additionalField2Title", editProjectData.additionalField2Title);
    appendIfExists("additionalField2Description", editProjectData.additionalField2Description);
    appendIfExists("additionalField3Title", editProjectData.additionalField3Title);
    appendIfExists("additionalField3Description", editProjectData.additionalField3Description);
    appendIfExists("additionalField4Title", editProjectData.additionalField4Title);
    appendIfExists("additionalField4Description", editProjectData.additionalField4Description);
    appendIfExists("additionalField5Title", editProjectData.additionalField5Title);
    appendIfExists("additionalField5Description", editProjectData.additionalField5Description);
    appendIfExists("additionalField6Title", editProjectData.additionalField6Title);
    appendIfExists("additionalField6Description", editProjectData.additionalField6Description);
    appendIfExists("surfaceTemperature", editProjectData.surfaceTemperature);
    appendIfExists("airTemperature", editProjectData.airTemperature);
    appendIfExists("relativeHumidity", editProjectData.relativeHumidity);
    appendIfExists("dewPointTemperature", editProjectData.dewPointTemperature);
    appendIfExists("dewPointSurfaceDiff", editProjectData.dewPointSurfaceDiff);
    appendIfExists("customerId", editProjectData.customerId);


    if (vesselImageFile) {
      formData.append("vesselImage", vesselImageFile);
    }


    editProjectMutation.mutate(formData);
  };

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated (only after loading is complete)
  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      in_progress: "status-in-progress",
      completed: "status-completed",
      on_hold: "status-on-hold",
      not_started: "status-not-started",
    };

    const statusLabels = {
      in_progress: "In Progress",
      completed: "Completed",
      on_hold: "On Hold",
      not_started: "Not Started",
    };

    return (
      <Badge className={`status-badge ${statusClasses[status as keyof typeof statusClasses] || 'status-not-started'}`}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AED',
    }).format(parseFloat(amount));
  };

  const formatDate = (date: string | Date) => {
    return formatDisplayDate(date);
  };

  const canEdit = user?.role === "admin" || user?.role === "project_manager";

  // Filter activities based on date range
  const filteredActivities = activities?.filter(activity => {
    if (!activity.date) return true;

    const activityDate = new Date(activity.date).toISOString().split('T')[0];
    const { startDate, endDate } = activityDateFilter;

    if (startDate && activityDate < startDate) return false;
    if (endDate && activityDate > endDate) return false;

    return true;
  }) || [];

  // Activity records a photo group still points at. Those records cannot be
  // deleted while the link exists (foreign key on project_photo_groups).
  const activityIdsWithPhotos = new Set(
    (photoGroups || [])
      .map(group => (group as any).dailyActivityId)
      .filter((activityId): activityId is number => typeof activityId === "number")
  );

  // Group the activities on the current page by day, newest first, matching the
  // order the server returns them in.
  const activitiesByDay = Object.entries(
    filteredActivities.reduce((days, activity) => {
      const dayKey = activity.date ? new Date(activity.date).toISOString().split('T')[0] : "unknown";
      if (!days[dayKey]) days[dayKey] = [];
      days[dayKey].push(activity);
      return days;
    }, {} as Record<string, typeof filteredActivities>)
  ).sort(([dayA], [dayB]) => new Date(dayB).getTime() - new Date(dayA).getTime());

  // A day's records can straddle a pagination boundary, so the rows shown for a
  // day are only the ones on this page. Anything that acts on the day as a whole
  // — editing it, deleting it, or describing it — has to read the whole day
  // instead, or it silently works on part of it.
  const activitiesForDay = (dayKey: string) =>
    (allActivities || []).filter(
      a => a.date && new Date(a.date).toISOString().split('T')[0] === dayKey,
    );

  const handleDeleteDay = async (dayActivities: typeof filteredActivities) => {
    const blocked = dayActivities.filter(a => activityIdsWithPhotos.has(a.id));
    if (blocked.length > 0) {
      toast({
        title: "Cannot delete this day",
        description: "Photos are linked to this day's activities. Delete the photo group first, then delete the day.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm(`Are you sure you want to delete all ${dayActivities.length} ${dayActivities.length === 1 ? "activity" : "activities"} for this day?`)) {
      return;
    }
    try {
      for (const activity of dayActivities) {
        await apiRequest(`/api/projects/${id}/activities/${activity.id}`, {
          method: "DELETE",
        });
      }
      toast({
        title: "Day Deleted",
        description: "The day's activities have been deleted successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete the day's activities",
        variant: "destructive",
      });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "activities"] });
    }
  };

  const handleAddWorkRemainingRow = () => {
    const lastRow = newWorkRemainingRows[newWorkRemainingRows.length - 1];
    if (lastRow && (!lastRow.location.trim() || !lastRow.days.trim())) {
      toast({
        title: "Empty Fields",
        description: "Please fill in both location and days before adding a new row.",
        variant: "destructive",
      });
      return;
    }
    setNewWorkRemainingRows(prev => [...prev, { location: "", days: "" }]);
  };

  const handleRemoveWorkRemainingRow = (index: number) => {
    if (newWorkRemainingRows.length === 1) {
      setNewWorkRemainingRows([{ location: "", days: "" }]);
    } else {
      setNewWorkRemainingRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleWorkRemainingChange = (index: number, field: 'location' | 'days', value: string) => {
    setNewWorkRemainingRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const saveWorkRemainingMutation = useMutation({
    mutationFn: async (data: { workRemainingDays: Array<{ location: string; days: string }>, isAddition?: boolean }) => {
      const response = await apiRequest(`/api/projects/${id}`, {
        method: "PUT",
        body: { workRemainingDays: data.workRemainingDays },
      });
      if (!response.ok) throw new Error("Failed to save work remaining days");
      return { data: await response.json(), isAddition: data.isAddition };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      if (result.isAddition) {
        setNewWorkRemainingRows([{ location: "", days: "" }]);
      }
      toast({
        title: "Success",
        description: result.isAddition ? "Work remaining days updated successfully" : "Record deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update work remaining days",
        variant: "destructive",
      });
    },
  });

  const handleDeleteSavedWorkRemaining = (index: number) => {
    if (confirm("Are you sure you want to delete this record?")) {
      const updated = (project?.workRemainingDays || []).filter((_, i) => i !== index);
      saveWorkRemainingMutation.mutate({ workRemainingDays: updated, isAddition: false });
    }
  };

  const handleSaveWorkRemaining = () => {
    // Filter out rows where both fields are empty
    const validNewRows = newWorkRemainingRows.filter(row => row.location.trim() !== "" || row.days.trim() !== "");

    // Check if any partially filled rows exist
    const hasIncompleteRow = validNewRows.some(row => !row.location.trim() || !row.days.trim());
    if (hasIncompleteRow) {
      toast({
        title: "Incomplete Fields",
        description: "Please fill in both location and days for all rows.",
        variant: "destructive",
      });
      return;
    }

    if (validNewRows.length === 0) {
      toast({
        title: "No Data",
        description: "Please add at least one location and days.",
        variant: "destructive",
      });
      return;
    }

    const updated = [...(project?.workRemainingDays || []), ...validNewRows];
    saveWorkRemainingMutation.mutate({ workRemainingDays: updated, isAddition: true });
  };


  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <Ship className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">Project not found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              The requested project could not be found.
            </p>
            <Button onClick={() => setLocation("/projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="space-y-4 mb-6 sm:mb-8">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/projects")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Back to Projects</span>
            <span className="sm:hidden">Back</span>
          </Button>
          {canEdit && (
            <Dialog open={isEditProjectDialogOpen} onOpenChange={setIsEditProjectDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Edit Project</span>
                  <span className="sm:hidden">Edit</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEditProject} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editTitle">Project Title *</Label>
                      <Input
                        id="editTitle"
                        value={editProjectData.title}
                        onChange={(e) => setEditProjectData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter project title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editVesselName">Vessel Name</Label>
                      <Input
                        id="editVesselName"
                        value={editProjectData.vesselName}
                        onChange={(e) => setEditProjectData(prev => ({ ...prev, vesselName: e.target.value }))}
                        placeholder="Enter vessel name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editVesselImoNumber">Vessel IMO Number</Label>
                    <Input
                      id="editVesselImoNumber"
                      value={editProjectData.vesselImoNumber}
                      onChange={(e) => setEditProjectData(prev => ({ ...prev, vesselImoNumber: e.target.value }))}
                      placeholder="Enter vessel IMO number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editVesselImage">Vessel Image</Label>
                    <Input
                      id="editVesselImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setVesselImageFile(file);
                          const imageUrl = URL.createObjectURL(file);
                          setEditProjectData(prev => ({ ...prev, vesselImage: imageUrl }));
                        }
                      }}
                    />
                    {(editProjectData.vesselImage || (project?.vesselImage && !vesselImageFile)) && (
                      <div className="mt-2">
                        <img
                          src={vesselImageFile ? editProjectData.vesselImage : project?.vesselImage}
                          alt="Vessel preview"
                          className="h-32 w-48 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editDescription">Description</Label>
                    <ReactQuill
                      theme="snow"
                      value={editProjectData.description}
                      onChange={(value) => setEditProjectData(prev => ({ ...prev, description: value }))}
                      placeholder="Detailed project description..."
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                          [{ 'color': [] }, { 'background': [] }],
                          ['link'],
                          ['clean']
                        ],
                      }}
                      formats={[
                        'header',
                        'bold', 'italic', 'underline', 'strike',
                        'list', 'bullet',
                        'color', 'background',
                        'link'
                      ]}
                      style={{
                        minHeight: '120px'
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="editCustomer">Customer</Label>
                      <Select
                        value={editProjectData.customerId}
                        onValueChange={(value) => setEditProjectData(prev => ({ ...prev, customerId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id.toString()}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editStatus">Status</Label>
                      <Select
                        value={editProjectData.status}
                        onValueChange={(value) => setEditProjectData(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editStartDate">Start Date</Label>
                      <Input
                        id="editStartDate"
                        type="date"
                        value={editProjectData.startDate}
                        onChange={(e) => setEditProjectData(prev => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editPlannedEndDate">Planned End Date</Label>
                      <Input
                        id="editPlannedEndDate"
                        type="date"
                        value={editProjectData.plannedEndDate}
                        min={editProjectData.startDate || undefined}
                        onChange={(e) => setEditProjectData(prev => ({ ...prev, plannedEndDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editActualEndDate">Actual End Date</Label>
                      <Input
                        id="editActualEndDate"
                        type="date"
                        value={editProjectData.actualEndDate}
                        min={editProjectData.startDate || undefined}
                        onChange={(e) => setEditProjectData(prev => ({ ...prev, actualEndDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* New Fields Section */}
                  <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Additional Project Details</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editRidgingCrewNos">Riding Crew Numbers</Label>
                        <Input
                          id="editRidgingCrewNos"
                          value={editProjectData.ridgingCrewNos}
                          onChange={(e) => setEditProjectData(prev => ({ ...prev, ridgingCrewNos: e.target.value }))}
                          placeholder="Enter crew numbers..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="editModeOfContract">Mode of Contract</Label>
                        <Select
                          value={editProjectData.modeOfContract}
                          onValueChange={(value) => {
                            if (value === "custom") {
                              setIsCustomContractMode(true);
                              setEditProjectData(prev => ({ ...prev, modeOfContract: "custom" }));
                            } else {
                              setIsCustomContractMode(false);
                              setEditProjectData(prev => ({ ...prev, modeOfContract: value }));
                              setCustomContractMode("");
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select contract mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed_price">Fixed Price</SelectItem>
                            <SelectItem value="time_and_materials">Time & Materials</SelectItem>
                            <SelectItem value="cost_plus">Cost Plus</SelectItem>
                            <SelectItem value="day_rate">Day Rate</SelectItem>
                            <SelectItem value="lump_sum">Lump Sum</SelectItem>
                            <SelectItem value="custom">Custom (Enter below)</SelectItem>
                            <SelectItem value="monthly_contract">Monthly Contract</SelectItem>
                          </SelectContent>
                        </Select>
                        {(isCustomContractMode || !["fixed_price", "time_and_materials", "cost_plus", "day_rate", "lump_sum", "monthly_contract", "custom", ""].includes(editProjectData.modeOfContract)) && (
                          <Input
                            className="mt-2"
                            value={customContractMode}
                            onChange={(e) => setCustomContractMode(e.target.value)}
                            placeholder="Enter custom contract mode"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="editWorkingHours">Working Hours</Label>
                        <Input
                          id="editWorkingHours"
                          value={editProjectData.workingHours}
                          onChange={(e) => setEditProjectData(prev => ({ ...prev, workingHours: e.target.value }))}
                          placeholder="e.g., 8 hours/day, 5 days/week"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="editPpe">PPE Requirements</Label>
                        <Input
                          id="editPpe"
                          value={editProjectData.ppe}
                          onChange={(e) => setEditProjectData(prev => ({ ...prev, ppe: e.target.value }))}
                          placeholder="Personal protective equipment requirements..."
                        />
                      </div>
                    </div>

                    {/* Environmental Conditions */}
                    <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Environmental Conditions</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Surface Temperature</Label>
                          <Textarea
                            value={editProjectData.surfaceTemperature}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, surfaceTemperature: e.target.value }))}
                            placeholder="Enter surface temperature..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Air Temperature</Label>
                          <Textarea
                            value={editProjectData.airTemperature}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, airTemperature: e.target.value }))}
                            placeholder="Enter air temperature..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Relative Humidity (RH)</Label>
                          <Textarea
                            value={editProjectData.relativeHumidity}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, relativeHumidity: e.target.value }))}
                            placeholder="Enter relative humidity..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dew Point Temperature</Label>
                          <Textarea
                            value={editProjectData.dewPointTemperature}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, dewPointTemperature: e.target.value }))}
                            placeholder="Enter dew point temperature..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Difference (Dew Point & Surface)</Label>
                          <Textarea
                            value={editProjectData.dewPointSurfaceDiff}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, dewPointSurfaceDiff: e.target.value }))}
                            placeholder="Enter difference..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Additional Custom Fields */}
                    <div className="space-y-6">
                      <h4 className="text-md font-medium text-slate-900 dark:text-slate-100">Custom Fields</h4>

                      {/* Additional Field 1 */}
                      <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField1Title">Field 1 Title</Label>
                          <Input
                            id="editAdditionalField1Title"
                            value={editProjectData.additionalField1Title}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, additionalField1Title: e.target.value }))}
                            placeholder="Enter field title..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField1Description">Field 1 Description</Label>
                          <div className="border border-input rounded-md">
                            <ReactQuill
                              theme="snow"
                              value={editProjectData.additionalField1Description}
                              onChange={(value) => setEditProjectData(prev => ({ ...prev, additionalField1Description: value }))}
                              placeholder="Enter detailed description..."
                              modules={{
                                toolbar: [
                                  [{ 'header': [1, 2, 3, false] }],
                                  ['bold', 'italic', 'underline', 'strike'],
                                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                  [{ 'color': [] }, { 'background': [] }],
                                  ['link'],
                                  ['clean']
                                ],
                              }}
                              formats={[
                                'header',
                                'bold', 'italic', 'underline', 'strike',
                                'list', 'bullet',
                                'color', 'background',
                                'link'
                              ]}
                              style={{
                                minHeight: '120px'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Additional Field 2 */}
                      <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField2Title">Field 2 Title</Label>
                          <Input
                            id="editAdditionalField2Title"
                            value={editProjectData.additionalField2Title}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, additionalField2Title: e.target.value }))}
                            placeholder="Enter field title..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField2Description">Field 2 Description</Label>
                          <div className="border border-input rounded-md">
                            <ReactQuill
                              theme="snow"
                              value={editProjectData.additionalField2Description}
                              onChange={(value) => setEditProjectData(prev => ({ ...prev, additionalField2Description: value }))}
                              placeholder="Enter detailed description..."
                              modules={{
                                toolbar: [
                                  [{ 'header': [1, 2, 3, false] }],
                                  ['bold', 'italic', 'underline', 'strike'],
                                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                  [{ 'color': [] }, { 'background': [] }],
                                  ['link'],
                                  ['clean']
                                ],
                              }}
                              formats={[
                                'header',
                                'bold', 'italic', 'underline', 'strike',
                                'list', 'bullet',
                                'color', 'background',
                                'link'
                              ]}
                              style={{
                                minHeight: '120px'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Additional Field 3 */}
                      <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField3Title">Field 3 Title</Label>
                          <Input
                            id="editAdditionalField3Title"
                            value={editProjectData.additionalField3Title}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, additionalField3Title: e.target.value }))}
                            placeholder="Enter field title..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField3Description">Field 3 Description</Label>
                          <div className="border border-input rounded-md">
                            <ReactQuill
                              theme="snow"
                              value={editProjectData.additionalField3Description}
                              onChange={(value) => setEditProjectData(prev => ({ ...prev, additionalField3Description: value }))}
                              placeholder="Enter detailed description..."
                              modules={{
                                toolbar: [
                                  [{ 'header': [1, 2, 3, false] }],
                                  ['bold', 'italic', 'underline', 'strike'],
                                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                  [{ 'color': [] }, { 'background': [] }],
                                  ['link'],
                                  ['clean']
                                ],
                              }}
                              formats={[
                                'header',
                                'bold', 'italic', 'underline', 'strike',
                                'list', 'bullet',
                                'color', 'background',
                                'link'
                              ]}
                              style={{
                                minHeight: '120px'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Additional Field 4 */}
                      <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField4Title">Field 4 Title</Label>
                          <Input
                            id="editAdditionalField4Title"
                            value={editProjectData.additionalField4Title}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, additionalField4Title: e.target.value }))}
                            placeholder="Enter field title..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField4Description">Field 4 Description</Label>
                          <div className="border border-input rounded-md">
                            <ReactQuill
                              theme="snow"
                              value={editProjectData.additionalField4Description}
                              onChange={(value) => setEditProjectData(prev => ({ ...prev, additionalField4Description: value }))}
                              placeholder="Enter detailed description..."
                              modules={{
                                toolbar: [
                                  [{ 'header': [1, 2, 3, false] }],
                                  ['bold', 'italic', 'underline', 'strike'],
                                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                  [{ 'color': [] }, { 'background': [] }],
                                  ['link'],
                                  ['clean']
                                ],
                              }}
                              formats={[
                                'header',
                                'bold', 'italic', 'underline', 'strike',
                                'list', 'bullet',
                                'color', 'background',
                                'link'
                              ]}
                              style={{
                                minHeight: '120px'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Additional Field 5 */}
                      <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField5Title">Field 5 Title</Label>
                          <Input
                            id="editAdditionalField5Title"
                            value={editProjectData.additionalField5Title}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, additionalField5Title: e.target.value }))}
                            placeholder="Enter field title..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField5Description">Field 5 Description</Label>
                          <div className="border border-input rounded-md">
                            <ReactQuill
                              theme="snow"
                              value={editProjectData.additionalField5Description}
                              onChange={(value) => setEditProjectData(prev => ({ ...prev, additionalField5Description: value }))}
                              placeholder="Enter detailed description..."
                              modules={{
                                toolbar: [
                                  [{ 'header': [1, 2, 3, false] }],
                                  ['bold', 'italic', 'underline', 'strike'],
                                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                  [{ 'color': [] }, { 'background': [] }],
                                  ['link'],
                                  ['clean']
                                ],
                              }}
                              formats={[
                                'header',
                                'bold', 'italic', 'underline', 'strike',
                                'list', 'bullet',
                                'color', 'background',
                                'link'
                              ]}
                              style={{
                                minHeight: '120px'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Additional Field 6 */}
                      <div className="space-y-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField6Title">Field 6 Title</Label>
                          <Input
                            id="editAdditionalField6Title"
                            value={editProjectData.additionalField6Title}
                            onChange={(e) => setEditProjectData(prev => ({ ...prev, additionalField6Title: e.target.value }))}
                            placeholder="Enter field title..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="editAdditionalField6Description">Field 6 Description</Label>
                          <div className="border border-input rounded-md">
                            <ReactQuill
                              theme="snow"
                              value={editProjectData.additionalField6Description}
                              onChange={(value) => setEditProjectData(prev => ({ ...prev, additionalField6Description: value }))}
                              placeholder="Enter detailed description..."
                              modules={{
                                toolbar: [
                                  [{ 'header': [1, 2, 3, false] }],
                                  ['bold', 'italic', 'underline', 'strike'],
                                  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                  [{ 'color': [] }, { 'background': [] }],
                                  ['link'],
                                  ['clean']
                                ],
                              }}
                              formats={[
                                'header',
                                'bold', 'italic', 'underline', 'strike',
                                'list', 'bullet',
                                'color', 'background',
                                'link'
                              ]}
                              style={{
                                minHeight: '120px'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditProjectDialogOpen(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={editProjectMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {editProjectMutation.isPending ? "Updating..." : "Update Project"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 break-words">{project.title}</h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Project #{project.id}</p>
        </div>
      </div>

      {/* Project Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  {project.vesselImage && (
                    <img
                      src={project.vesselImage}
                      alt={project.vesselName || 'Vessel'}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <CardTitle className="text-xl mb-2">{project.vesselName || "Unknown Vessel"}</CardTitle>
                    {project.vesselImoNumber && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        IMO: {project.vesselImoNumber}
                      </p>
                    )}
                    <div className="flex items-center space-x-4">
                      {getStatusBadge(project.status)}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {project.description && (
                <div className="mb-6">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Description</h4>
                  <div className="text-slate-600 dark:text-slate-400" dangerouslySetInnerHTML={{ __html: project.description }} />
                </div>
              )}

              {/* Additional Project Details */}
              {(project.customerName && project.ridgingCrewNos || project.modeOfContract || project.workingHours || project.ppe) && (
                <div className="mb-6 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">Project Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {project.customerName && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Customer Name</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{project.customerName}</p>
                      </div>
                    )}
                    {project.ridgingCrewNos && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Riding Crew Numbers</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{project.ridgingCrewNos}</p>
                      </div>
                    )}
                    {project.modeOfContract && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Mode of Contract</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                          {project.modeOfContract.replace('_', ' ')}
                        </p>
                      </div>
                    )}
                    {project.workingHours && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Working Hours</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{project.workingHours}</p>
                      </div>
                    )}
                    {project.ppe && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">PPE Requirements</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{project.ppe}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Environmental Conditions */}
              {(project.surfaceTemperature || project.airTemperature || project.relativeHumidity || project.dewPointTemperature || project.dewPointSurfaceDiff) && (
                <div className="mb-6 space-y-4 border-t pt-4">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">Environmental Conditions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {project.surfaceTemperature && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Surface Temperature</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{project.surfaceTemperature}</p>
                      </div>
                    )}
                    {project.airTemperature && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Air Temperature</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{project.airTemperature}</p>
                      </div>
                    )}
                    {project.relativeHumidity && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Relative Humidity (RH)</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{project.relativeHumidity}</p>
                      </div>
                    )}
                    {project.dewPointTemperature && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Dew Point Temperature</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{project.dewPointTemperature}</p>
                      </div>
                    )}
                    {project.dewPointSurfaceDiff && (
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Difference (Dew Point & Surface)</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{project.dewPointSurfaceDiff}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Custom Fields */}
              {(project.additionalField1Title || project.additionalField2Title || project.additionalField3Title ||
                project.additionalField4Title || project.additionalField5Title || project.additionalField6Title) && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Additional Information</h4>

                    {project.additionalField1Title && (
                      <div className="border-l-4 border-blue-500 pl-4">
                        <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {project.additionalField1Title}
                        </h5>
                        {project.additionalField1Description && (
                          <div
                            className="text-sm text-slate-600 dark:text-slate-400"
                            dangerouslySetInnerHTML={{ __html: project.additionalField1Description }}
                          />
                        )}
                      </div>
                    )}

                    {project.additionalField2Title && (
                      <div className="border-l-4 border-green-500 pl-4">
                        <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {project.additionalField2Title}
                        </h5>
                        {project.additionalField2Description && (
                          <div
                            className="text-sm text-slate-600 dark:text-slate-400"
                            dangerouslySetInnerHTML={{ __html: project.additionalField2Description }}
                          />
                        )}
                      </div>
                    )}

                    {project.additionalField3Title && (
                      <div className="border-l-4 border-purple-500 pl-4">
                        <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {project.additionalField3Title}
                        </h5>
                        {project.additionalField3Description && (
                          <div
                            className="text-sm text-slate-600 dark:text-slate-400"
                            dangerouslySetInnerHTML={{ __html: project.additionalField3Description }}
                          />
                        )}
                      </div>
                    )}

                    {project.additionalField4Title && (
                      <div className="border-l-4 border-orange-500 pl-4">
                        <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {project.additionalField4Title}
                        </h5>
                        {project.additionalField4Description && (
                          <div
                            className="text-sm text-slate-600 dark:text-slate-400"
                            dangerouslySetInnerHTML={{ __html: project.additionalField4Description }}
                          />
                        )}
                      </div>
                    )}

                    {project.additionalField5Title && (
                      <div className="border-l-4 border-red-500 pl-4">
                        <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {project.additionalField5Title}
                        </h5>
                        {project.additionalField5Description && (
                          <div
                            className="text-sm text-slate-600 dark:text-slate-400"
                            dangerouslySetInnerHTML={{ __html: project.additionalField5Description }}
                          />
                        )}
                      </div>
                    )}

                    {project.additionalField6Title && (
                      <div className="border-l-4 border-yellow-500 pl-4">
                        <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                          {project.additionalField6Title}
                        </h5>
                        {project.additionalField6Description && (
                          <div
                            className="text-sm text-slate-600 dark:text-slate-400"
                            dangerouslySetInnerHTML={{ __html: project.additionalField6Description }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.startDate && (
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Start Date</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(project.startDate)}</p>
                </div>
              )}
              {project.plannedEndDate && (
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Planned End</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(project.plannedEndDate)}</p>
                </div>
              )}
              {project.actualEndDate && (
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Actual End</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(project.actualEndDate)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Card - Only for admin and finance users */}
          {(user?.role === "admin" || user?.role === "finance") && projectRevenue && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    {/* <DollarSign className="h-5 w-5 mr-2" /> */}
                    Revenue & Profit
                  </CardTitle>
                  {user?.role === "admin" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRecalculateCost}
                      disabled={recalculateCostMutation.isPending}
                      className="flex items-center gap-1 text-xs"
                    >
                      <RefreshCw className={`h-3 w-3 ${recalculateCostMutation.isPending ? "animate-spin" : ""}`} />
                      {recalculateCostMutation.isPending ? "Recalculating..." : "Recalculate Cost"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Total Revenue</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(projectRevenue.totalRevenue)}
                    </p>
                  </div>
                  {projectRevenue.invoicePayments.length > 0 && (
                    <RevenueDetailsDialog
                      payments={projectRevenue.invoicePayments}
                      totalRevenue={projectRevenue.totalRevenue}
                      formatCurrency={formatCurrency}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Total Cost</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(projectRevenue.totalCost)}
                    </p>
                  </div>
                  {projectRevenue.expenses && parseFloat(projectRevenue.totalCost) > 0 && (
                    <ExpenseDetailsDialog
                      expenses={projectRevenue.expenses}
                      formatCurrency={formatCurrency}
                    />)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Net Profit/Loss</p>
                  <p className={`text-lg font-bold ${parseFloat(projectRevenue.profit) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                    }`}>
                    {formatCurrency(projectRevenue.profit)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Tabs for Activities, Photos, etc. */}
      <Tabs defaultValue="activities" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 h-auto">
          <TabsTrigger value="activities" className="flex items-center justify-center text-xs sm:text-sm p-2">
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Daily Activities</span>
            <span className="sm:hidden">Daily</span>
          </TabsTrigger>
          <TabsTrigger value="planned" className="flex items-center justify-center text-xs sm:text-sm p-2">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Planned Activities</span>
            <span className="sm:hidden">Planned</span>
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex items-center justify-center text-xs sm:text-sm p-2">
            <Camera className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center justify-center text-xs sm:text-sm p-2">
            <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center justify-center text-xs sm:text-sm p-2">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex items-center justify-center text-xs sm:text-sm p-2">
            <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="consumables" className="flex items-center justify-center text-xs sm:text-sm p-2">
            <Package className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Consumables
          </TabsTrigger>
          <TabsTrigger value="live-location" className="flex items-center justify-center text-xs sm:text-sm p-2">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            Live Location
          </TabsTrigger>
          <TabsTrigger value="work-remaining" className="flex items-center justify-center text-xs sm:text-sm p-2">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Work Remaining</span>
            <span className="sm:hidden">Work</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <CardTitle>Daily Activities</CardTitle>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="activityStartDateFilter" className="text-xs">From Date</Label>
                      <Input
                        id="activityStartDateFilter"
                        type="date"
                        value={activityDateFilter.startDate}
                        onChange={(e) => setActivityDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full text-sm"
                        placeholder="Start date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="activityEndDateFilter" className="text-xs">To Date</Label>
                      <Input
                        id="activityEndDateFilter"
                        type="date"
                        value={activityDateFilter.endDate}
                        onChange={(e) => setActivityDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full text-sm"
                        placeholder="End date"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActivityDateFilter({
                          startDate: project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
                          endDate: project?.actualEndDate
                            ? new Date(project.actualEndDate).toISOString().split('T')[0]
                            : project?.plannedEndDate
                              ? new Date(project.plannedEndDate).toISOString().split('T')[0]
                              : "",
                        });
                      }}
                      className="w-full sm:w-auto"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {filteredActivities.length} of {activities?.length || 0} activities
                  {(activityDateFilter.startDate || activityDateFilter.endDate) && (
                    <span className="ml-2">
                      (filtered
                      {activityDateFilter.startDate && ` from ${formatDate(activityDateFilter.startDate)}`}
                      {activityDateFilter.endDate && ` to ${formatDate(activityDateFilter.endDate)}`})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCompletionReportOpen(true)}
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/30"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Completion Report
                  </Button>
                {canEdit && (
                  <Dialog open={isActivityDialogOpen} onOpenChange={(isOpen) => {
                    setIsActivityDialogOpen(isOpen);
                    if (isOpen) {
                      setIsCustomCompletedLocation(true);
                      setNewCompletedActivity({ location: "", tasks: "" });
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Activity
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingActivityId ? 'Edit Daily Activity' : 'Log Daily Activity'}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleActivitySubmit} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="date">Date *</Label>
                            <Input
                              id="date"
                              type="date"
                              value={activityData.date}
                              onChange={(e) => setActivityData(prev => ({ ...prev, date: e.target.value }))}
                              required
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hbmDailyRunningHours">HBM Daily Running Hours</Label>
                            <Input
                              id="hbmDailyRunningHours"
                              type="number"
                              step="any"
                              value={activityData.hbmDailyRunningHours}
                              onChange={(e) => setActivityData(prev => ({ ...prev, hbmDailyRunningHours: e.target.value }))}
                              placeholder="Enter running hours..."
                              className="w-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-medium">Completed Activities *</Label>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {completedActivities.length} activities added
                            </span>
                          </div>

                          {/* Add new completed activity */}
                          <div ref={completedActivityFormRef} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 space-y-4">
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Location</Label>
                                <Select
                                  value={isCustomCompletedLocation ? "" : newCompletedActivity.location}
                                  onValueChange={(value) => {
                                    if (value === "custom") {
                                      setIsCustomCompletedLocation(true);
                                      setNewCompletedActivity(prev => ({ ...prev, location: "" }));
                                    } else {
                                      setIsCustomCompletedLocation(false);
                                      setNewCompletedActivity(prev => ({ ...prev, location: value }));
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select location" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {project?.locations && project.locations.length > 0 && (
                                      <>
                                        {project.locations.map((location, index) => (
                                          <SelectItem key={index} value={location}>
                                            {location}
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="custom">Other (Enter custom)</SelectItem>
                                      </>
                                    )}
                                    {(!project?.locations || project.locations.length === 0) && (
                                      <SelectItem value="custom">Enter custom location</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>

                                {isCustomCompletedLocation && (
                                  <Input
                                    value={newCompletedActivity.location}
                                    onChange={(e) => setNewCompletedActivity(prev => ({ ...prev, location: e.target.value }))}
                                    placeholder="Enter location"
                                    className="w-full mt-2"
                                  />
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label>Completed Tasks *</Label>
                                <Textarea
                                  ref={completedTasksRef}
                                  value={newCompletedActivity.tasks}
                                  onChange={(e) => setNewCompletedActivity(prev => ({ ...prev, tasks: e.target.value }))}
                                  placeholder="Describe what was completed..."
                                  rows={3}
                                  className="w-full"
                                />
                              </div>

                              <div className="flex flex-col sm:flex-row justify-end gap-2">
                                {editingCompletedActivityIndex !== null && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={cancelEditCompletedActivity}
                                    className="w-full sm:w-auto"
                                    data-testid="button-cancel-edit-activity"
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                                <Button type="button" onClick={addCompletedActivity} size="sm" className="w-full sm:w-auto">
                                  {editingCompletedActivityIndex === null ? (
                                    <>
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add Activity
                                    </>
                                  ) : (
                                    <>
                                      <Pencil className="h-4 w-4 mr-1" />
                                      Update Activity
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* List of completed activities */}
                          {completedActivities.length > 0 && (
                            <div className="space-y-2">
                              {completedActivities.map((activity, index) => (
                                <div
                                  key={index}
                                  className={`flex items-start justify-between p-3 border rounded-lg ${
                                    editingCompletedActivityIndex === index
                                      ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950"
                                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                  }`}
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-1">
                                      {activity.location && (
                                        <Badge variant="outline" className="text-xs">
                                          <MapPin className="h-3 w-3 mr-1" />
                                          {activity.location}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{activity.tasks}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => startEditCompletedActivity(index)}
                                      title="Edit activity"
                                      aria-label="Edit activity"
                                      data-testid={`button-edit-activity-${index}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeCompletedActivity(index)}
                                      className="text-red-500 hover:text-red-700"
                                      title={
                                        editingCompletedActivityIndex !== null
                                          ? "Finish or cancel the current edit first"
                                          : "Remove activity"
                                      }
                                      aria-label="Remove activity"
                                      disabled={editingCompletedActivityIndex !== null}
                                      data-testid={`button-remove-activity-${index}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="remarks">Remarks</Label>
                          <Textarea
                            id="remarks"
                            value={activityData.remarks}
                            onChange={(e) => setActivityData(prev => ({ ...prev, remarks: e.target.value }))}
                            placeholder="Any additional notes or observations..."
                            rows={3}
                            className="w-full"
                          />
                        </div>

                        {/* Stoppage Day Toggle */}
                        <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50 dark:bg-amber-950/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                              <Label className="text-sm font-medium text-amber-700 dark:text-amber-400">Stoppage Day</Label>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={activityData.isStoppage}
                              onClick={() => setActivityData(prev => ({ ...prev, isStoppage: !prev.isStoppage, stoppageReason: prev.isStoppage ? "" : prev.stoppageReason }))}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${activityData.isStoppage ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${activityData.isStoppage ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                          </div>
                          {activityData.isStoppage && (
                            <div className="space-y-1">
                              <Label htmlFor="stoppageReason" className="text-xs text-amber-700 dark:text-amber-400">Stoppage Reason</Label>
                              <Input
                                id="stoppageReason"
                                value={activityData.stoppageReason}
                                onChange={(e) => setActivityData(prev => ({ ...prev, stoppageReason: e.target.value }))}
                                placeholder="Enter reason for stoppage..."
                                className="w-full border-amber-300 focus:border-amber-500"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6 border-t border-slate-200 dark:border-slate-700">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsActivityDialogOpen(false)}
                            className="w-full sm:w-auto"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createActivityMutation.isPending}
                            className="w-full sm:w-auto"
                          >
                            {createActivityMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!activities || activities.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No activities logged yet</p>
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No activities found for the selected date range</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActivityDateFilter({
                        startDate: project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
                        endDate: project?.actualEndDate
                          ? new Date(project.actualEndDate).toISOString().split('T')[0]
                          : project?.plannedEndDate
                            ? new Date(project.plannedEndDate).toISOString().split('T')[0]
                            : "",
                      });
                    }}
                    className="mt-4"
                  >
                    Reset Filter
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activitiesByDay.map(([dayKey, pagedActivities]) => {
                    // pagedActivities are this page's rows for the day; dayActivities
                    // is the whole day. Everything below the row list is day-level and
                    // must use the latter, including the guards on the two buttons.
                    const dayActivities = activitiesForDay(dayKey);
                    const dayLoaded = dayActivities.length > 0;
                    // Remarks, HBM hours and the stoppage flag are day-level values:
                    // the same value is written to every record of that day.
                    const dayRemark = dayActivities.find(a => a.remarks)?.remarks || "";
                    const dayHbm = dayActivities.find(a => a.hbmDailyRunningHours)?.hbmDailyRunningHours;
                    const stoppageRecord = dayActivities.find(a => (a as any).isStoppage);
                    const dayHasPhotos = dayActivities.some(a => activityIdsWithPhotos.has(a.id));
                    return (
                    <div key={dayKey} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {pagedActivities[0]?.date ? formatDate(pagedActivities[0].date) : "Unknown Date"}
                            </p>
                            {stoppageRecord && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700 text-xs flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Stoppage Day
                                {(stoppageRecord as any).stoppageReason && (
                                  <span className="font-normal">– {(stoppageRecord as any).stoppageReason}</span>
                                )}
                              </Badge>
                            )}
                          </div>
                          {dayHbm && (
                            <div className="flex items-center text-sm text-ocean-600 dark:text-ocean-400 font-medium">
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              HBM Hours: {dayHbm}
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-ocean-600"
                              disabled={!dayLoaded}
                              title="Edit this day"
                              onClick={() => openEditDayDialog(dayActivities)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              disabled={dayHasPhotos || !dayLoaded}
                              title={dayHasPhotos
                                ? "Photos are linked to this day. Delete the photo group first."
                                : "Delete this day"}
                              onClick={() => handleDeleteDay(dayActivities)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {pagedActivities.map((activity) => (
                          <div key={activity.id} className="space-y-2">
                            {activity.location && (
                              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center">
                                <MapPin className="h-4 w-4 mr-2" />
                                {activity.location}
                              </div>
                            )}
                            {activity.completedTasks && (
                              <div className="space-y-3">
                                {(() => {
                                  // Check if it's a legacy combined record or a new separate record
                                  const isCombined = activity.completedTasks.includes('\n') || activity.completedTasks.match(/^\[([^\]]+)\]\s*(.*)$/);

                                  if (isCombined) {
                                    // Parse completed tasks that are in format "[Location] Task\n[Location] Task"
                                    const tasks = activity.completedTasks.split('\n').filter(task => task.trim());
                                    return tasks.map((task, index) => {
                                      const locationMatch = task.match(/^\[([^\]]+)\]\s*(.*)$/);
                                      if (locationMatch) {
                                        const [, location, taskText] = locationMatch;
                                        return (
                                          <div key={index} className="space-y-2">
                                            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center">
                                              <MapPin className="h-4 w-4 mr-2" />
                                              {location}
                                            </div>
                                            <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                                              {taskText}
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        // Task without location
                                        return (
                                          <div key={index} className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                                            {task}
                                          </div>
                                        );
                                      }
                                    });
                                  } else {
                                    // New format: direct task display (location is already shown above)
                                    return (
                                      <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                                        {activity.completedTasks}
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                            {(activity as any).photoGroups && (activity as any).photoGroups.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {(activity as any).photoGroups.map((group: any) => (
                                  <Badge key={group.id} variant="secondary" className="flex items-center gap-1 cursor-default">
                                    <Camera className="h-3 w-3" />
                                    {group.title} ({group.photoCount})
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {dayRemark && (
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Remarks</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 italic">{dayRemark}</p>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Controls */}
              {activitiesTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4 mt-6">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Page {activitiesPage} of {activitiesTotalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivitiesPage(p => Math.max(1, p - 1))}
                      disabled={activitiesPage === 1}
                      data-testid="button-activities-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivitiesPage(p => Math.min(activitiesTotalPages, p + 1))}
                      disabled={activitiesPage === activitiesTotalPages}
                      data-testid="button-activities-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planned">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Planned Activities</CardTitle>
                {canEdit && (
                  <Dialog open={isPlannedActivityDialogOpen} onOpenChange={(isOpen) => {
                    setIsPlannedActivityDialogOpen(isOpen);
                    if (isOpen) {
                      setIsCustomPlannedLocation(true);
                      setNewPlannedActivity({ location: "", tasks: "", date: new Date().toISOString().split('T')[0] });
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Planned Activity
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Planned Activity</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="plannedDate">Planned Date *</Label>
                          <Input
                            id="plannedDate"
                            type="date"
                            value={newPlannedActivity.date}
                            onChange={(e) => setNewPlannedActivity(prev => ({ ...prev, date: e.target.value }))}
                            required
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-medium">Planned Activities</Label>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {plannedActivities.length} activities added
                            </span>
                          </div>

                          {/* Add new planned activity */}
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 space-y-4">
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Location</Label>
                                <Select
                                  value={isCustomPlannedLocation ? "" : newPlannedActivity.location}
                                  onValueChange={(value) => {
                                    if (value === "custom") {
                                      setIsCustomPlannedLocation(true);
                                      setNewPlannedActivity(prev => ({ ...prev, location: "" }));
                                    } else {
                                      setIsCustomPlannedLocation(false);
                                      setNewPlannedActivity(prev => ({ ...prev, location: value }));
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select location" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {project?.locations && project.locations.length > 0 && (
                                      <>
                                        {project.locations.map((location, index) => (
                                          <SelectItem key={index} value={location}>
                                            {location}
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="custom">Other (Enter custom)</SelectItem>
                                      </>
                                    )}
                                    {(!project?.locations || project.locations.length === 0) && (
                                      <SelectItem value="custom">Enter custom location</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>

                                {isCustomPlannedLocation && (
                                  <Input
                                    value={newPlannedActivity.location}
                                    onChange={(e) => setNewPlannedActivity(prev => ({ ...prev, location: e.target.value }))}
                                    placeholder="Enter location"
                                    className="w-full mt-2"
                                  />
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label>Planned Tasks *</Label>
                                <Textarea
                                  value={newPlannedActivity.tasks}
                                  onChange={(e) => setNewPlannedActivity(prev => ({ ...prev, tasks: e.target.value }))}
                                  placeholder="Describe planned tasks..."
                                  rows={3}
                                  className="w-full"
                                />
                              </div>

                              <div className="flex justify-end">
                                <Button type="button" onClick={addPlannedActivity} size="sm" className="w-full sm:w-auto">
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Activity
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* List of planned activities */}
                          {plannedActivities.length > 0 && (
                            <div className="space-y-2">
                              {plannedActivities.map((activity, index) => (
                                <div key={index} className="flex flex-col sm:flex-row items-start justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 gap-3">
                                  <div className="flex-1 w-full">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <Badge variant="outline" className="text-xs">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {formatDate(activity.date)}
                                      </Badge>
                                      {activity.location && (
                                        <Badge variant="outline" className="text-xs">
                                          <MapPin className="h-3 w-3 mr-1" />
                                          {activity.location}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 break-words">{activity.tasks}</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removePlannedActivity(index)}
                                    className="text-red-500 hover:text-red-700 w-full sm:w-auto shrink-0"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6 border-t border-slate-200 dark:border-slate-700">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsPlannedActivityDialogOpen(false)}
                            className="w-full sm:w-auto"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={handleSavePlannedActivities}
                            disabled={savePlannedActivitiesMutation.isPending || plannedActivities.length === 0}
                            className="w-full sm:w-auto"
                          >
                            {savePlannedActivitiesMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(!savedPlannedActivities || savedPlannedActivities.length === 0) && plannedActivities.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No planned activities yet</p>
                  {canEdit && (
                    <Dialog open={isPlannedActivityDialogOpen} onOpenChange={setIsPlannedActivityDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="mt-4" size="sm">
                          <Calendar className="h-4 w-4 mr-2" />
                          Add First Planned Activity
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Saved Planned Activities */}
                  {savedPlannedActivities && savedPlannedActivities.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
                        Saved Planned Activities
                      </h4>
                      {(() => {
                        // Group activities by date
                        const groupedActivities = savedPlannedActivities.reduce((groups, activity) => {
                          const date = activity.date;
                          if (!groups[date]) {
                            groups[date] = [];
                          }
                          groups[date].push(activity);
                          return groups;
                        }, {} as Record<string, typeof savedPlannedActivities>);

                        // Sort dates and render grouped activities
                        return Object.entries(groupedActivities)
                          .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
                          .map(([date, activities]) => (
                            <div key={date} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                              <div className="flex items-center mb-4">
                                <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400 mr-2" />
                                <h5 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                  {formatDate(date)}
                                </h5>
                              </div>

                              <div className="space-y-3">
                                {activities.map((activity, index) => (
                                  <div key={index} className="space-y-2">
                                    {activity.location && (
                                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center">
                                        <MapPin className="h-4 w-4 mr-2" />
                                        {activity.location}
                                      </div>
                                    )}
                                    <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                                      {activity.tasks}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Show one remark per day (first non-empty) */}
                              {(() => {
                                const dayRemark = activities.find(a => a.remarks)?.remarks;
                                return dayRemark ? (
                                  <div className="mt-4 pt-3 border-t border-slate-300 dark:border-slate-600">
                                    <h6 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Remarks:</h6>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 italic">{dayRemark}</p>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          ));
                      })()}
                    </div>
                  )}

                  {/* New Planned Activities (not yet saved) */}
                  {plannedActivities.length > 0 && (
                    <div className="space-y-4">
                      {savedPlannedActivities && savedPlannedActivities.length > 0 && (
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
                          New Planned Activities (Not Saved)
                        </h4>
                      )}
                      {(() => {
                        // Group new activities by date
                        const groupedNewActivities = plannedActivities.reduce((groups, activity, originalIndex) => {
                          const date = activity.date;
                          if (!groups[date]) {
                            groups[date] = [];
                          }
                          groups[date].push({ ...activity, originalIndex });
                          return groups;
                        }, {} as Record<string, Array<typeof plannedActivities[0] & { originalIndex: number }>>);

                        // Sort dates and render grouped activities
                        return Object.entries(groupedNewActivities)
                          .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
                          .map(([date, activities]) => (
                            <div key={date} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 border-dashed bg-slate-50/50 dark:bg-slate-800/50">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400 mr-2" />
                                  <h5 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                    {formatDate(date)}
                                  </h5>
                                  <Badge variant="secondary" className="text-xs ml-2">
                                    Not Saved
                                  </Badge>
                                </div>
                              </div>

                              <div className="space-y-3">
                                {activities.map((activity, index) => (
                                  <div key={index} className="flex items-start justify-between">
                                    <div className="flex-1 space-y-2">
                                      {activity.location && (
                                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center">
                                          <MapPin className="h-4 w-4 mr-2" />
                                          {activity.location}
                                        </div>
                                      )}
                                      <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                                        {activity.tasks}
                                      </div>
                                    </div>
                                    {canEdit && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removePlannedActivity(activity.originalIndex)}
                                        className="text-red-500 hover:text-red-700 ml-2 shrink-0"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Show remarks if any activity has them */}
                              {activities.some(activity => activity.remarks) && (
                                <div className="mt-4 pt-3 border-t border-slate-300 dark:border-slate-600">
                                  <h6 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Remarks:</h6>
                                  {activities
                                    .filter(activity => activity.remarks)
                                    .map((activity, index) => (
                                      <div key={index} className="text-sm text-slate-600 dark:text-slate-400 italic mb-2 last:mb-0">
                                        {activity.location && (
                                          <span className="font-medium">[{activity.location}] </span>
                                        )}
                                        {activity.remarks}
                                      </div>
                                    ))
                                  }
                                </div>
                              )}
                            </div>
                          ));
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Pagination Controls */}
              {plannedActivitiesTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4 mt-6">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Page {plannedActivitiesPage} of {plannedActivitiesTotalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlannedActivitiesPage(p => Math.max(1, p - 1))}
                      disabled={plannedActivitiesPage === 1}
                      data-testid="button-planned-activities-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlannedActivitiesPage(p => Math.min(plannedActivitiesTotalPages, p + 1))}
                      disabled={plannedActivitiesPage === plannedActivitiesTotalPages}
                      data-testid="button-planned-activities-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Project Photos</CardTitle>
                {canEdit && (
                  <Dialog
                    open={isPhotoGroupDialogOpen}
                    onOpenChange={(open) => {
                      setIsPhotoGroupDialogOpen(open);
                      // Closing without saving must not leave an edited group
                      // loaded, or the next Create would reopen on top of it.
                      if (!open) resetPhotoGroupForm();
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Photo Group
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>
                          {editingPhotoGroupId !== null ? "Edit Photo Group" : "Create Photo Group"}
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handlePhotoGroupSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="photoGroupTitle">Title *</Label>
                          <Input
                            id="photoGroupTitle"
                            value={photoGroupData.title}
                            onChange={(e) => setPhotoGroupData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Hull Inspection, Deck Work, etc."
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="photoGroupDate">Date *</Label>
                          <Input
                            id="photoGroupDate"
                            type="date"
                            value={photoGroupData.date}
                            onChange={(e) => setPhotoGroupData(prev => ({ ...prev, date: e.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="photoGroupDescription">Description</Label>
                          <Textarea
                            id="photoGroupDescription"
                            value={photoGroupData.description}
                            onChange={(e) => setPhotoGroupData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Brief description of the photos..."
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="dailyActivity">Link to Daily Activity</Label>
                            {/* The Autocomplete only reports a value when an option
                                is picked, so clearing its text cannot unlink. */}
                            {photoGroupData.dailyActivityId && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-auto py-0 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                                onClick={() => setPhotoGroupData(prev => ({ ...prev, dailyActivityId: "" }))}
                              >
                                Remove link
                              </Button>
                            )}
                          </div>
                          <Autocomplete
                            options={(allActivities || []).map(activity => ({
                              value: activity.id.toString(),
                              label: `${formatDate(activity.date)} - ${activity.location || "No Location"}`,
                              description: activity.completedTasks || "",
                              searchText: `${formatDate(activity.date)} ${activity.location || ""} ${activity.completedTasks || ""}`
                            }))}
                            value={photoGroupData.dailyActivityId}
                            onValueChange={(value) => setPhotoGroupData(prev => ({ ...prev, dailyActivityId: value }))}
                            placeholder="Search daily activity by date, location or tasks..."
                          />
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Optional. Leave empty to keep this group unlinked.
                          </p>
                        </div>

                        {editingPhotoGroupId === null && (
                          <div className="space-y-2">
                            <Label htmlFor="photos">Select Photos *</Label>
                            <Input
                              id="photos"
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => setSelectedFiles(e.target.files)}
                            />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              You can select multiple photos. Supported formats: JPG, PNG, GIF
                            </p>
                            {selectedFiles && selectedFiles.length > 0 && (
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsPhotoGroupDialogOpen(false)}>
                            Cancel
                          </Button>
                          {editingPhotoGroupId !== null ? (
                            <Button type="submit" disabled={updatePhotoGroupMutation.isPending}>
                              {updatePhotoGroupMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          ) : (
                            <Button type="submit" disabled={createPhotoGroupMutation.isPending}>
                              {createPhotoGroupMutation.isPending ? "Creating..." : "Create Group"}
                            </Button>
                          )}
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!photoGroups || photoGroups.length === 0 ? (
                <div className="text-center py-8">
                  <Camera className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No photo groups created yet</p>
                  {canEdit && (
                    <Dialog open={isPhotoGroupDialogOpen} onOpenChange={setIsPhotoGroupDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="mt-4" size="sm">
                          <Camera className="h-4 w-4 mr-2" />
                          Create First Photo Group
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {photoGroups
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((group) => (
                      <div key={group.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{group.title}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                              <span>{formatDate(group.date)}</span>
                              <span>{group.photos.length} photo{group.photos.length !== 1 ? 's' : ''}</span>
                              {group.dailyActivity?.id && (
                                <div className="flex flex-col gap-1 w-full mt-2">
                                  <Badge variant="outline" className="text-xs self-start">
                                    <Activity className="h-3 w-3 mr-1" />
                                    {formatDate(group.dailyActivity.date)} - {group.dailyActivity.location || "No Location"}
                                  </Badge>
                                  {group.dailyActivity.completedTasks && (
                                    <p className="text-xs text-slate-500 italic pl-1 whitespace-pre-wrap">
                                      {group.dailyActivity.completedTasks}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            {group.description && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{group.description}</p>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditPhotoGroupDialog(group)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePhotoGroup(group.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {group.photos.length > 0 ? (
                          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                            {group.photos.map((photo) => (
                              <div
                                key={photo.id}
                                className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 group cursor-pointer"
                                onClick={() => setSelectedImageForPreview(photo)}
                              >
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg h-24 sm:h-32 flex items-center justify-center overflow-hidden relative">
                                  {photo.filePath ? (
                                    <img
                                      src={photo.filePath}
                                      alt={photo.originalName}
                                      className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform duration-200"
                                      onError={(e) => {
                                        // Fallback to camera icon if image fails to load
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = target.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className="absolute inset-0 flex items-center justify-center" style={{ display: photo.filePath ? 'none' : 'flex' }}>
                                    <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400" />
                                  </div>
                                  {/* Overlay for hover effect */}
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                                    <div className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium transition-opacity duration-200">
                                      View
                                    </div>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate" title={photo.originalName}>
                                  {photo.originalName}
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                  {photo.fileSize ? `${Math.round(photo.fileSize / 1024)} KB` : 'Unknown size'}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <Camera className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">No photos in this group</p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Project Team</CardTitle>
                {canEdit && (
                  <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Users className="h-4 w-4 mr-2" />
                        {projectEmployees && projectEmployees.length > 0 ? "Manage Team" : "Assign Employees"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader className="pb-4 sticky top-0 bg-white dark:bg-slate-900 z-10">
                        <DialogTitle className="text-lg sm:text-xl">Assign Team Members</DialogTitle>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                          Select employees to assign to this project and set their assignment dates
                        </p>
                      </DialogHeader>

                      <form onSubmit={handleTeamAssignment} className="space-y-4">
                        <div>
                          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <Label className="text-sm sm:text-base font-medium">Available Employees</Label>
                            {selectedEmployees.length > 0 && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 self-start sm:self-auto">
                                {selectedEmployees.length} selected
                              </Badge>
                            )}
                          </div>

                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg">
                            <div className="max-h-80 sm:max-h-96 overflow-y-auto">
                              {employees?.map((employee) => {
                                const isSelected = selectedEmployees.includes(employee.id);
                                const assignment = employeeAssignments.find(a => a.employeeId === employee.id);
                                const isCurrentlyAssigned = projectEmployees?.some(emp => emp.id === employee.id);

                                return (
                                  <div key={employee.id} className={`border-b border-slate-200 dark:border-slate-700 last:border-b-0 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-slate-900'}`}>
                                    <div className="p-4">
                                      <label className="flex items-start space-x-3 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedEmployees(prev => [...prev, employee.id]);
                                              setEmployeeAssignments(prev => [
                                                ...prev.filter(a => a.employeeId !== employee.id),
                                                {
                                                  employeeId: employee.id,
                                                  startDate: project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
                                                  endDate: project?.plannedEndDate ? new Date(project.plannedEndDate).toISOString().split('T')[0] : ""
                                                }
                                              ]);
                                            } else {
                                              setSelectedEmployees(prev => prev.filter(id => id !== employee.id));
                                              setEmployeeAssignments(prev => prev.filter(a => a.employeeId !== employee.id));
                                            }
                                          }}
                                          className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                  {employee.firstName} {employee.lastName}
                                                </h4>
                                                {isCurrentlyAssigned && (
                                                  <Badge variant="outline" className="text-xs text-green-600 border-green-600 self-start">
                                                    Currently Assigned
                                                  </Badge>
                                                )}
                                              </div>
                                              <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                {employee.position && (
                                                  <span className="flex items-center">
                                                    <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                                                    <span className="truncate">{employee.position}</span>
                                                  </span>
                                                )}
                                                {employee.department && (
                                                  <span className="truncate">{employee.department}</span>
                                                )}
                                                {employee.email && (
                                                  <span className="truncate">{employee.email}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </label>

                                      {isSelected && (
                                        <div className="mt-4 pl-3 sm:pl-7 border-t border-slate-200 dark:border-slate-700 pt-4">
                                          <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                                            <div className="space-y-2">
                                              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                Assignment Start Date
                                              </Label>
                                              <Input
                                                type="date"
                                                value={assignment?.startDate || ""}
                                                onChange={(e) => {
                                                  setEmployeeAssignments(prev => [
                                                    ...prev.filter(a => a.employeeId !== employee.id),
                                                    {
                                                      employeeId: employee.id,
                                                      startDate: e.target.value,
                                                      endDate: assignment?.endDate || ""
                                                    }
                                                  ]);
                                                }}
                                                className="h-9 w-full"
                                                placeholder={project?.startDate ? `Default: ${formatDisplayDate(project.startDate)}` : "Select start date"}
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                Assignment End Date
                                              </Label>
                                              <Input
                                                type="date"
                                                value={assignment?.endDate || ""}
                                                onChange={(e) => {
                                                  setEmployeeAssignments(prev => [
                                                    ...prev.filter(a => a.employeeId !== employee.id),
                                                    {
                                                      employeeId: employee.id,
                                                      startDate: assignment?.startDate || "",
                                                      endDate: e.target.value
                                                    }
                                                  ]);
                                                }}
                                                className="h-9 w-full"
                                                min={assignment?.startDate || ""}
                                                placeholder={project?.plannedEndDate ? `Default: ${formatDisplayDate(project.plannedEndDate)}` : "Select end date"}
                                              />
                                            </div>
                                          </div>
                                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                            Leave end date empty for ongoing assignment
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {(!employees || employees.length === 0) && (
                            <div className="text-center py-8 border border-slate-200 dark:border-slate-700 rounded-lg">
                              <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                              <p className="text-slate-500 dark:text-slate-400">No employees found</p>
                            </div>
                          )}
                        </div>

                        <div className="sticky bottom-0 bg-white dark:bg-slate-900 pt-4 border-t border-slate-200 dark:border-slate-700 mt-6">
                          <div className="flex flex-col gap-3">
                            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-center">
                              {selectedEmployees.length === 0 ? (
                                "No employees selected"
                              ) : (
                                <>
                                  {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''} will be assigned to this project
                                </>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setIsTeamDialogOpen(false);
                                  // Reset to current project employees
                                  setSelectedEmployees(projectEmployees?.map(emp => emp.id) || []);
                                  setEmployeeAssignments([]);
                                }}
                                className="w-full sm:w-auto order-2 sm:order-1"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={assignTeamMutation.isPending}
                                className="w-full sm:w-auto order-1 sm:order-2"
                              >
                                {assignTeamMutation.isPending ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    <span className="hidden sm:inline">Updating Team...</span>
                                    <span className="sm:hidden">Updating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Users className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Update Team Assignment</span>
                                    <span className="sm:hidden">Update Team</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!projectEmployees || projectEmployees.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No team members assigned yet</p>
                  {canEdit && (
                    <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="mt-4" size="sm">
                          <Users className="h-4 w-4 mr-2" />
                          Assign First Employee
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projectEmployees.map((employee) => (
                    <div key={employee.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 dark:text-slate-100">
                            {employee.firstName} {employee.lastName}
                          </h4>
                          {employee.position && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {employee.position}
                            </p>
                          )}
                          {employee.department && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {employee.department}
                            </p>
                          )}
                          {employee.email && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {employee.email}
                            </p>
                          )}
                          {(employee.startDate || employee.endDate) && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {employee.startDate && (
                                <span>From: {formatDisplayDate(employee.startDate)}</span>
                              )}
                              {employee.startDate && employee.endDate && <span> • </span>}
                              {employee.endDate && (
                                <span>To: {formatDisplayDate(employee.endDate)}</span>
                              )}
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEmployeeMutation.mutate(employee.id)}
                            disabled={removeEmployeeMutation.isPending}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle>Project Locations</CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {project.locations?.length || 0} locations total
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Input
                      placeholder="Search locations..."
                      value={locationSearchTerm}
                      onChange={(e) => setLocationSearchTerm(e.target.value)}
                      className="pr-8"
                    />
                    {locationSearchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                        onClick={() => setLocationSearchTerm("")}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex space-x-2 w-full sm:w-auto">
                      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="flex-1 sm:flex-none">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Location
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add New Location</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleAddLocation} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="newLocation">Location Name</Label>
                              <Input
                                id="newLocation"
                                value={newLocation}
                                onChange={(e) => setNewLocation(e.target.value)}
                                placeholder="Enter location name..."
                                required
                              />
                            </div>

                            <div className="flex justify-end space-x-2">
                              <Button type="button" variant="outline" onClick={() => setIsLocationDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button type="submit" disabled={addLocationMutation.isPending}>
                                {addLocationMutation.isPending ? "Adding..." : "Add Location"}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={isBulkLocationDialogOpen} onOpenChange={setIsBulkLocationDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
                            <Upload className="h-4 w-4 mr-2" />
                            Bulk Upload
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Bulk Upload Locations</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleBulkAddLocations} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="bulkLocations">Locations (one per line)</Label>
                              <Textarea
                                id="bulkLocations"
                                value={bulkLocations}
                                onChange={(e) => setBulkLocations(e.target.value)}
                                placeholder="Location 1&#10;Location 2&#10;Location 3&#10;..."
                                rows={8}
                                required
                              />
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Enter each location on a new line. Duplicate locations will be automatically filtered out.
                              </p>
                            </div>

                            <div className="flex justify-end space-x-2">
                              <Button type="button" variant="outline" onClick={() => setIsBulkLocationDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button type="submit" disabled={addBulkLocationsMutation.isPending}>
                                {addBulkLocationsMutation.isPending ? "Uploading..." : "Upload Locations"}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!project.locations || project.locations.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No locations assigned yet</p>
                  {canEdit && (
                    <div className="flex justify-center space-x-2 mt-4">
                      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <MapPin className="h-4 w-4 mr-2" />
                            Add First Location
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                      <Dialog open={isBulkLocationDialogOpen} onOpenChange={setIsBulkLocationDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Upload className="h-4 w-4 mr-2" />
                            Bulk Upload
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {(() => {
                    const filtered = project.locations.filter(loc =>
                      loc.toLowerCase().includes(locationSearchTerm.toLowerCase())
                    );

                    if (filtered.length === 0 && locationSearchTerm) {
                      return (
                        <div className="text-center py-12 border border-dashed rounded-lg">
                          <MapPin className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                          <p className="text-slate-500 dark:text-slate-400">
                            No locations match "{locationSearchTerm}"
                          </p>
                          <Button
                            variant="link"
                            onClick={() => setLocationSearchTerm("")}
                            className="mt-2"
                          >
                            Clear search
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {filtered.map((location, index) => (
                          <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                              <div className="flex items-center space-x-2 min-w-0 flex-1">
                                <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                  {location}
                                </span>
                              </div>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveLocation(location)}
                                  disabled={removeLocationMutation.isPending}
                                  className="w-full sm:w-auto shrink-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assigned Assets</CardTitle>
                {canEdit && (
                  <Dialog open={isAssetAssignmentDialogOpen} onOpenChange={setIsAssetAssignmentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-assign-asset">
                        <Plus className="h-4 w-4 mr-2" />
                        Assign Asset
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Assign Asset Instance to Project</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAssetAssignmentSubmit} className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="assetInstance">Asset Instance *</Label>
                          <Select
                            value={assetAssignmentData.instanceId?.toString() || ""}
                            onValueChange={(value) => {
                              setAssetAssignmentData(prev => ({
                                ...prev,
                                instanceId: parseInt(value)
                              }));
                            }}
                          >
                            <SelectTrigger className="w-full" data-testid="select-asset-instance">
                              <SelectValue placeholder="Select asset instance" />
                            </SelectTrigger>
                            <SelectContent>
                              {assets?.filter(asset => asset.status === 'available').map((asset) => (
                                <SelectItem key={asset.id} value={asset.id.toString()}>
                                  {asset.assetTypeName || 'Unknown'} - {asset.tag}
                                  {asset.serialNumber && ` (SN: ${asset.serialNumber})`}
                                  {asset.monthlyRentalAmount && ` - ${asset.rentalCurrency} ${parseFloat(asset.monthlyRentalAmount).toFixed(2)}/month`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Only available asset instances are shown
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="assetStartDate">Start Date *</Label>
                            <Input
                              id="assetStartDate"
                              type="date"
                              value={assetAssignmentData.startDate}
                              onChange={(e) => setAssetAssignmentData(prev => ({ ...prev, startDate: e.target.value }))}
                              required
                              className="w-full"
                              data-testid="input-asset-start-date"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="assetEndDate">End Date</Label>
                            <Input
                              id="assetEndDate"
                              type="date"
                              value={assetAssignmentData.endDate}
                              onChange={(e) => setAssetAssignmentData(prev => ({ ...prev, endDate: e.target.value }))}
                              min={assetAssignmentData.startDate}
                              className="w-full"
                              data-testid="input-asset-end-date"
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Leave empty for ongoing assignment
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="monthlyRate">Monthly Rent *</Label>
                          <Input
                            id="monthlyRate"
                            type="number"
                            value={assetAssignmentData.monthlyRate}
                            onChange={(e) => setAssetAssignmentData(prev => ({ ...prev, monthlyRate: e.target.value }))}
                            placeholder="Enter monthly rent"
                            required
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="assetNotes">Notes</Label>
                          <Textarea
                            id="assetNotes"
                            value={assetAssignmentData.notes}
                            onChange={(e) => setAssetAssignmentData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Any notes about this asset assignment..."
                            rows={3}
                            className="w-full"
                            data-testid="input-asset-notes"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6 border-t border-slate-200 dark:border-slate-700">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAssetAssignmentDialogOpen(false)}
                            className="w-full sm:w-auto"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={assignAssetMutation.isPending}
                            className="w-full sm:w-auto"
                            data-testid="button-submit-asset-assignment"
                          >
                            {assignAssetMutation.isPending ? "Assigning..." : "Assign Asset"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!projectAssets || projectAssets.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No assets assigned yet</p>
                  {canEdit && (
                    <Button
                      size="sm"
                      onClick={() => setIsAssetAssignmentDialogOpen(true)}
                      className="mt-4"
                      data-testid="button-assign-first-asset"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Assign First Asset
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {projectAssets.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                      data-testid={`asset-assignment-${assignment.id}`}
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start gap-2">
                            <Package className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-medium text-slate-900 dark:text-slate-100">
                                {assignment.assetTypeName || 'Unknown Asset'}
                              </h4>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  Tag: {assignment.tag}
                                </Badge>
                                {assignment.serialNumber && (
                                  <Badge variant="outline" className="text-xs">
                                    SN: {assignment.serialNumber}
                                  </Badge>
                                )}
                                {assignment.barcode && (
                                  <Badge variant="outline" className="text-xs">
                                    Barcode: {assignment.barcode}
                                  </Badge>
                                )}
                                <Badge
                                  variant={assignment.status === 'active' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {assignment.status}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-400 ml-7">
                            <div>
                              <span className="font-medium">Start:</span> {formatDate(assignment.startDate)}
                            </div>
                            {assignment.endDate && (
                              <div>
                                <span className="font-medium">End:</span> {formatDate(assignment.endDate)}
                              </div>
                            )}
                            {!assignment.endDate && (
                              <div>
                                <span className="font-medium">Status:</span> Ongoing
                              </div>
                            )}
                          </div>

                          {assignment.monthlyRate && (
                            <div className="text-sm text-slate-600 dark:text-slate-400 ml-7">
                              <span className="font-medium">Monthly Rate:</span> {assignment.currency || 'AED'} {parseFloat(assignment.monthlyRate).toFixed(2)}
                              {assignment.totalCost && (
                                <span className="ml-2">
                                  | <span className="font-medium">Total Cost:</span> {assignment.currency || 'AED'} {parseFloat(assignment.totalCost).toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}

                          {assignment.notes && (
                            <div className="text-sm text-slate-600 dark:text-slate-400 ml-7">
                              <span className="font-medium">Notes:</span> {assignment.notes}
                            </div>
                          )}
                        </div>

                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAssetMutation.mutate(assignment.id)}
                            disabled={removeAssetMutation.isPending}
                            className="text-red-500 hover:text-red-700 shrink-0"
                            data-testid={`button-remove-asset-${assignment.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumables">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Consumables Usage</CardTitle>
                <div className="flex items-center gap-2">
                  {(user?.role === "admin" || user?.role === "project_manager") && consumablesHistory && consumablesHistory.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedConsumableIds([]);
                        setIsReviewConsumablesOpen(true);
                      }}
                    >
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Review & Issue
                    </Button>
                  )}
                  {canEdit && (
                  <Dialog open={isConsumablesDialogOpen} onOpenChange={setIsConsumablesDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Record Usage
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Record Consumables Usage</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleConsumablesSubmit} className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="consumablesDate">Date *</Label>
                          <Input
                            id="consumablesDate"
                            type="date"
                            value={consumablesData.date}
                            onChange={(e) => setConsumablesData(prev => ({ ...prev, date: e.target.value }))}
                            required
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-medium">Items Used</Label>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {consumablesItems.length} items added
                            </span>
                          </div>

                          {/* Entry type toggle */}
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={consumableEntryType === "inventory" ? "default" : "outline"}
                              onClick={() => setConsumableEntryType("inventory")}
                              className="flex-1"
                            >
                              From Inventory
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={consumableEntryType === "manual" ? "default" : "outline"}
                              onClick={() => setConsumableEntryType("manual")}
                              className="flex-1"
                            >
                              Manual Entry
                            </Button>
                          </div>

                          {/* Add new consumable item */}
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 space-y-4">
                            {consumableEntryType === "inventory" ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Inventory Item</Label>
                                  <Select
                                    value={newConsumableItem.inventoryItemId?.toString() || ""}
                                    onValueChange={(value) => {
                                      const itemId = parseInt(value);
                                      const item = inventoryItems?.find(item => item.id === itemId);
                                      setNewConsumableItem(prev => ({
                                        ...prev,
                                        inventoryItemId: itemId,
                                        itemName: item?.name || ""
                                      }));
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select item" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {inventoryItems?.filter(item => item.category === 'consumables').map((item) => (
                                        <SelectItem key={item.id} value={item.id.toString()}>
                                          {item.name} (Stock: {item.currentStock} {item.unit})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label>Quantity Used *</Label>
                                  <Input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    placeholder="Qty used"
                                    value={newConsumableItem.quantity}
                                    max={(() => {
                                      const selectedItem = inventoryItems?.find(item => item.id === newConsumableItem.inventoryItemId);
                                      return selectedItem ? selectedItem.currentStock : undefined;
                                    })()}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      const selectedItem = inventoryItems?.find(item => item.id === newConsumableItem.inventoryItemId);
                                      if (selectedItem && value > selectedItem.currentStock) {
                                        toast({
                                          title: "Warning",
                                          description: `Quantity exceeds available stock (${selectedItem.currentStock} ${selectedItem.unit})`,
                                          variant: "destructive",
                                        });
                                      }
                                      setNewConsumableItem(prev => ({ ...prev, quantity: value }));
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Item Name *</Label>
                                    <Input
                                      type="text"
                                      placeholder="Enter item name"
                                      value={newConsumableItem.itemName}
                                      onChange={(e) => setNewConsumableItem(prev => ({ ...prev, itemName: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Quantity Used *</Label>
                                    <Input
                                      type="number"
                                      min="0.1"
                                      step="0.1"
                                      placeholder="Qty used"
                                      value={newConsumableItem.quantity}
                                      onChange={(e) => setNewConsumableItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Unit</Label>
                                    <Input
                                      type="text"
                                      placeholder="e.g. pcs, kg, liters"
                                      value={newConsumableItem.itemUnit}
                                      onChange={(e) => setNewConsumableItem(prev => ({ ...prev, itemUnit: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Unit Cost (AED)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="Cost per unit"
                                      value={newConsumableItem.unitCost}
                                      onChange={(e) => setNewConsumableItem(prev => ({ ...prev, unitCost: e.target.value }))}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end">
                              <Button type="button" onClick={addConsumableItem} size="sm" className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-1" />
                                Add Item
                              </Button>
                            </div>
                          </div>

                          {/* List of consumable items */}
                          {consumablesItems.length > 0 && (
                            <div className="space-y-2">
                              {consumablesItems.map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                                      {item.itemName}
                                      {item.isManual && (
                                        <Badge variant="outline" className="text-xs">Manual</Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                      Quantity: {item.quantity}{item.itemUnit ? ` ${item.itemUnit}` : ''}
                                      {item.isManual && item.unitCost && parseFloat(item.unitCost) > 0 ? ` | Cost: AED ${item.unitCost}/unit` : ''}
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeConsumableItem(index)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-6 border-t border-slate-200 dark:border-slate-700">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsConsumablesDialogOpen(false)}
                            className="w-full sm:w-auto"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={recordConsumablesMutation.isPending}
                            className="w-full sm:w-auto"
                          >
                            {recordConsumablesMutation.isPending ? "Recording..." : "Record Usage"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!consumablesHistory || consumablesHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">No consumables usage recorded yet</p>
                  {canEdit && (
                    <Dialog open={isConsumablesDialogOpen} onOpenChange={setIsConsumablesDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="mt-4" size="sm">
                          <Package className="h-4 w-4 mr-2" />
                          Record First Usage
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Dialog open={!!editingManualItem} onOpenChange={(open) => !open && setEditingManualItem(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Edit Manual Consumable Item</DialogTitle>
                        <DialogDescription>
                          Update details for this manual entry. Inventory items cannot be edited here.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Item Name</Label>
                          <Input
                            value={editManualItemForm.itemName}
                            onChange={(e) => setEditManualItemForm({ ...editManualItemForm, itemName: e.target.value })}
                            placeholder="e.g. Masking Tape"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={editManualItemForm.quantity}
                              onChange={(e) => setEditManualItemForm({ ...editManualItemForm, quantity: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Unit</Label>
                            <Input
                              value={editManualItemForm.itemUnit}
                              onChange={(e) => setEditManualItemForm({ ...editManualItemForm, itemUnit: e.target.value })}
                              placeholder="e.g. rolls, pcs"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Cost</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editManualItemForm.unitCost}
                            onChange={(e) => setEditManualItemForm({ ...editManualItemForm, unitCost: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setEditingManualItem(null)}>Cancel</Button>
                        <Button
                          onClick={() => {
                            if (!editManualItemForm.itemName || !editManualItemForm.quantity || Number(editManualItemForm.quantity) <= 0) {
                              toast({
                                title: "Invalid Data",
                                description: "Please provide a valid name and quantity.",
                                variant: "destructive"
                              });
                              return;
                            }
                            updateConsumableItemMutation.mutate({
                              itemId: editingManualItem.id,
                              data: {
                                itemName: editManualItemForm.itemName,
                                quantity: Number(editManualItemForm.quantity),
                                itemUnit: editManualItemForm.itemUnit,
                                unitCost: editManualItemForm.unitCost ? Number(editManualItemForm.unitCost) : 0
                              }
                            });
                          }}
                          disabled={updateConsumableItemMutation.isPending}
                        >
                          {updateConsumableItemMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {consumablesHistory
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((record) => (
                      <div key={record.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-medium text-slate-900 dark:text-slate-100">
                              {formatDate(record.date)}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {record.items?.length || 0} item{(record.items?.length || 0) !== 1 ? 's' : ''} consumed
                            </p>
                          </div>
                        </div>

                        {record.items && record.items.length > 0 && (
                          <div className="space-y-2">
                            {record.items.map((item: any, index: number) => (
                              <div key={index} className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded group">
                                <div className="flex-1 flex items-center gap-2">
                                  <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {item.itemName || `Item #${item.inventoryItemId}`}
                                  </span>
                                  {!item.inventoryItemId && (
                                    <>
                                      <Badge variant="outline" className="text-xs">Manual</Badge>
                                      {(user?.role === "admin" || user?.role === "project_manager") && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => {
                                            setEditingManualItem(item);
                                            setEditManualItemForm({
                                              itemName: item.itemName || "",
                                              quantity: item.quantity?.toString() || "",
                                              itemUnit: item.itemUnit || "pcs",
                                              unitCost: item.unitCost?.toString() || "0"
                                            });
                                          }}
                                          title="Edit Manual Item"
                                        >
                                          <Pencil className="h-3 w-3 text-slate-500" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                  Qty: {item.quantity}{item.itemUnit ? ` ${item.itemUnit}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Review Consumables Usage Dialog */}
        <Dialog open={isReviewConsumablesOpen} onOpenChange={setIsReviewConsumablesOpen}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                Review Consumables Usage
              </DialogTitle>
              <DialogDescription>
                Select consumable records to formally issue as a Goods Issue. Inventory was already deducted when usage was recorded.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              {/* Select all */}
              {consumablesHistory && consumablesHistory.filter((r: any) => !r.goodsIssueRef).length > 0 && (
                <div className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const unissued = (consumablesHistory || []).filter((r: any) => !r.goodsIssueRef).map((r: any) => r.id);
                        setSelectedConsumableIds(prev =>
                          prev.length === unissued.length ? [] : unissued
                        );
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800"
                    >
                      {selectedConsumableIds.length === (consumablesHistory || []).filter((r: any) => !r.goodsIssueRef).length
                        ? <CheckSquare className="h-5 w-5" />
                        : <Square className="h-5 w-5" />
                      }
                    </button>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Select all pending</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedConsumableIds.length} of {(consumablesHistory || []).filter((r: any) => !r.goodsIssueRef).length} selected
                  </span>
                </div>
              )}

              {/* List of consumable records */}
              {(consumablesHistory || [])
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((record: any) => {
                  const isIssued = !!record.goodsIssueRef;
                  const isSelected = selectedConsumableIds.includes(record.id);
                  const inventoryItems = (record.items || []).filter((i: any) => i.inventoryItemId);

                  return (
                    <div
                      key={record.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        isIssued
                          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
                          : isSelected
                          ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {!isIssued && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedConsumableIds(prev =>
                                prev.includes(record.id)
                                  ? prev.filter(id => id !== record.id)
                                  : [...prev, record.id]
                              );
                            }}
                            className="mt-0.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 flex-shrink-0"
                          >
                            {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {formatDisplayDate(record.date)}
                            </span>
                            {isIssued ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-xs font-mono">
                                {record.goodsIssueRef}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                                Pending Issue
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 space-y-1">
                            {(record.items || []).map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm group">
                                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  {item.itemName || `Item #${item.inventoryItemId}`}
                                  {!item.inventoryItemId && (
                                    <>
                                      <Badge variant="outline" className="text-xs py-0">Manual</Badge>
                                      {(user?.role === "admin" || user?.role === "project_manager") && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => {
                                            setEditingManualItem(item);
                                            setEditManualItemForm({
                                              itemName: item.itemName || "",
                                              quantity: item.quantity?.toString() || "",
                                              itemUnit: item.itemUnit || "pcs",
                                              unitCost: item.unitCost?.toString() || "0"
                                            });
                                          }}
                                          title="Edit Manual Item"
                                        >
                                          <Pencil className="h-3 w-3 text-slate-500" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 text-xs">
                                  Qty: {item.quantity}{item.itemUnit ? ` ${item.itemUnit}` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                          {inventoryItems.length === 0 && !isIssued && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                              No inventory items — only manual entries (no GI transaction needed)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {consumablesHistory && consumablesHistory.filter((r: any) => !r.goodsIssueRef).length === 0 && (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400">
                  <ClipboardCheck className="h-10 w-10 mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">All records have been issued</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsReviewConsumablesOpen(false);
                  setSelectedConsumableIds([]);
                }}
              >
                Close
              </Button>
              <Button
                disabled={selectedConsumableIds.length === 0 || createConsumablesGoodIssueMutation.isPending}
                onClick={() => createConsumablesGoodIssueMutation.mutate(selectedConsumableIds)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                {createConsumablesGoodIssueMutation.isPending
                  ? "Creating..."
                  : `Create Goods Issue (${selectedConsumableIds.length} record${selectedConsumableIds.length !== 1 ? "s" : ""})`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <TabsContent value="live-location">
          <Card>
            <CardHeader>
              <CardTitle>Live Vessel Location</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Real-time tracking of {project.vesselName || 'vessel'} using AIS data
                {project.vesselImoNumber && ` (IMO: ${project.vesselImoNumber})`}
              </p>
            </CardHeader>
            <CardContent>
              {!project.vesselImoNumber ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">IMO number is required for vessel tracking</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Please add the vessel IMO number in project settings to enable live location tracking
                  </p>
                </div>
              ) : (
                <VesselLocationTracker imoNumber={project.vesselImoNumber} vesselName={project.vesselName || 'Unknown Vessel'} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work-remaining">
          <Card>
            <CardHeader>
              <CardTitle>Work Remaining Days</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Manage remaining work days for each location.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Saved Data Section */}
                {project?.workRemainingDays && project.workRemainingDays.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Saved Data</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {project?.workRemainingDays.map((row, index) => (
                        <div key={index} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 relative group">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Location</p>
                            <p className="font-semibold">{row.location}</p>
                          </div>
                          <div className="space-y-1 mt-3">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Remaining Days</p>
                            <p className="font-semibold">{row.days}</p>
                          </div>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSavedWorkRemaining(index)}
                              className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Entries Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Add New Entries</h3>
                  <div className="space-y-4">
                    {newWorkRemainingRows.map((row, index) => (
                      <div key={index} className="flex flex-col sm:flex-row items-end gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="w-full sm:flex-1 space-y-2">
                          <Label>Location</Label>
                          <Autocomplete
                            options={(project?.locations || []).map(loc => ({ value: loc, label: loc }))}
                            value={row.location}
                            onValueChange={(val) => handleWorkRemainingChange(index, 'location', val)}
                            placeholder="Select location..."
                          />
                        </div>
                        <div className="w-full sm:flex-1 space-y-2">
                          <Label>Remaining Work Days</Label>
                          <Input
                            type="text"
                            value={row.days}
                            onChange={(e) => handleWorkRemainingChange(index, 'days', e.target.value)}
                            placeholder="Enter days..."
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveWorkRemainingRow(index)}
                          className="text-red-500 hover:text-red-700 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddWorkRemainingRow}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Row
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-200 dark:border-slate-700 pt-6">
                  <Button
                    onClick={handleSaveWorkRemaining}
                    disabled={saveWorkRemainingMutation.isPending}
                    size="sm"
                  >
                    {saveWorkRemainingMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImageForPreview} onOpenChange={() => setSelectedImageForPreview(null)}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {selectedImageForPreview?.originalName}
                </DialogTitle>
                <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400 mt-1">
                  <span>
                    {selectedImageForPreview?.fileSize
                      ? `${Math.round(selectedImageForPreview.fileSize / 1024)} KB`
                      : 'Unknown size'}
                  </span>
                  <span>{selectedImageForPreview?.mimeType}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImageForPreview(null)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
              {selectedImageForPreview?.filePath ? (
                <img
                  src={selectedImageForPreview.filePath}
                  alt={selectedImageForPreview.originalName}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  onError={(e) => {
                    // Fallback to camera icon if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="flex items-center justify-center h-96"
                style={{ display: selectedImageForPreview?.filePath ? 'none' : 'flex' }}
              >
                <Camera className="h-16 w-16 text-slate-400" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Completion Report Dialog ── */}
      <Dialog open={isCompletionReportOpen} onOpenChange={setIsCompletionReportOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Project Completion Report
            </DialogTitle>
            <DialogDescription>
              Select which sections to include and choose photos for the gallery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Report Title */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Report Title</label>
              <input
                type="text"
                value={completionReportTitle}
                onChange={e => setCompletionReportTitle(e.target.value)}
                placeholder={project?.title || "Project Completion Report"}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500">Defaults to the project name if left blank.</p>
            </div>

            {/* Section toggles */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Report Sections</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { key: "totalDays", label: "Total Days Breakdown Chart" },
                  { key: "locationBreakdown", label: "Location Breakdown Chart" },
                  { key: "photoGallery", label: "Photo Gallery" },
                  { key: "consumables", label: "Consumables List" },
                ] as const).map(({ key, label }) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      completionReportSections[key]
                        ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => setCompletionReportSections(prev => ({ ...prev, [key]: !prev[key] }))}
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                    <button
                      type="button"
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                        completionReportSections[key] ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        completionReportSections[key] ? "translate-x-5" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Photo picker */}
            {completionReportSections.photoGallery && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Select Photos
                    {selectedCompletionPhotoIds.length > 0 && (
                      <span className="ml-2 text-blue-600 font-normal">({selectedCompletionPhotoIds.length} selected)</span>
                    )}
                  </p>
                  {selectedCompletionPhotoIds.length > 0 && (
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedCompletionPhotoIds([])}>
                      Clear All
                    </Button>
                  )}
                </div>

                {!completionReportPhotoGroups ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Loading photo groups...</p>
                ) : completionReportPhotoGroups.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No photo groups found for this project.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {(() => {
                      // Group by location
                      const byLocation = new Map<string, any[]>();
                      for (const g of completionReportPhotoGroups) {
                        const loc = g.dailyActivity?.location || "__GENERAL__";
                        if (!byLocation.has(loc)) byLocation.set(loc, []);
                        byLocation.get(loc)!.push(g);
                      }

                      // Helper: move a photo earlier or later within its group's selected subset
                      const movePhotoInGroup = (photoId: number, direction: 'prev' | 'next', groupPhotoIds: number[]) => {
                        // Get the global indices of selected photos from this group, in selection order
                        const groupSelectedEntries = selectedCompletionPhotoIds
                          .map((id, globalIdx) => ({ id, globalIdx }))
                          .filter(({ id }) => groupPhotoIds.includes(id));
                        const posInGroup = groupSelectedEntries.findIndex(({ id }) => id === photoId);
                        const targetPos = direction === 'prev' ? posInGroup - 1 : posInGroup + 1;
                        if (posInGroup === -1 || targetPos < 0 || targetPos >= groupSelectedEntries.length) return;
                        const newOrder = [...selectedCompletionPhotoIds];
                        const idxA = groupSelectedEntries[posInGroup].globalIdx;
                        const idxB = groupSelectedEntries[targetPos].globalIdx;
                        [newOrder[idxA], newOrder[idxB]] = [newOrder[idxB], newOrder[idxA]];
                        setSelectedCompletionPhotoIds(newOrder);
                      };

                      return Array.from(byLocation.entries()).map(([loc, groups]) => {
                        const locLabel = loc === "__GENERAL__" ? "General / No Location" : loc;
                        const isExpanded = expandedLocations.has(loc);
                        const allPhotoIds = groups.flatMap((g: any) => (g.photos || []).map((p: any) => p.id));
                        const selectedCount = allPhotoIds.filter((pid: number) => selectedCompletionPhotoIds.includes(pid)).length;
                        return (
                          <div key={loc} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            {/* Location header */}
                            <div
                              className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                              onClick={() => {
                                const next = new Set(expandedLocations);
                                if (isExpanded) next.delete(loc);
                                else next.add(loc);
                                setExpandedLocations(next);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{locLabel}</span>
                                {selectedCount > 0 && (
                                  <Badge className="text-xs h-4 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                                    {selectedCount}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const allSelected = allPhotoIds.every((pid: number) => selectedCompletionPhotoIds.includes(pid));
                                    if (allSelected) {
                                      setSelectedCompletionPhotoIds(prev => prev.filter(id => !allPhotoIds.includes(id)));
                                    } else {
                                      const toAdd = allPhotoIds.filter((pid: number) => !selectedCompletionPhotoIds.includes(pid));
                                      setSelectedCompletionPhotoIds(prev => [...prev, ...toAdd]);
                                    }
                                  }}
                                >
                                  {allPhotoIds.every((pid: number) => selectedCompletionPhotoIds.includes(pid)) ? "Deselect all" : "Select all"}
                                </button>
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                              </div>
                            </div>
                            {/* Groups */}
                            {isExpanded && (
                              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {groups.map((group: any) => {
                                  const groupPhotoIds = (group.photos || []).map((p: any) => p.id);
                                  const groupSelectedCount = groupPhotoIds.filter((pid: number) => selectedCompletionPhotoIds.includes(pid)).length;
                                  // Ordered selected photos within this group
                                  const groupSelectedInOrder = selectedCompletionPhotoIds.filter(id => groupPhotoIds.includes(id));
                                  return (
                                    <div key={group.id} className="p-2">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <Image className="h-3 w-3 text-slate-400" />
                                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-36">{group.title}</span>
                                          {groupSelectedCount > 0 && (
                                            <span className="text-xs text-blue-600 dark:text-blue-400">({groupSelectedCount}/{groupPhotoIds.length})</span>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                          onClick={() => {
                                            const allSelected = groupPhotoIds.every((pid: number) => selectedCompletionPhotoIds.includes(pid));
                                            if (allSelected) {
                                              setSelectedCompletionPhotoIds(prev => prev.filter(id => !groupPhotoIds.includes(id)));
                                            } else {
                                              const toAdd = groupPhotoIds.filter((pid: number) => !selectedCompletionPhotoIds.includes(pid));
                                              setSelectedCompletionPhotoIds(prev => [...prev, ...toAdd]);
                                            }
                                          }}
                                        >
                                          {groupPhotoIds.every((pid: number) => selectedCompletionPhotoIds.includes(pid)) ? "Deselect" : "Select all"}
                                        </button>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {(group.photos || []).map((photo: any) => {
                                          const isSelected = selectedCompletionPhotoIds.includes(photo.id);
                                          const posInGroup = groupSelectedInOrder.indexOf(photo.id);
                                          const isFirst = posInGroup === 0;
                                          const isLast = posInGroup === groupSelectedInOrder.length - 1;
                                          return (
                                            <div key={photo.id} className="flex flex-col items-center gap-0.5">
                                              <HoverCard openDelay={300} closeDelay={100}>
                                                <HoverCardTrigger asChild>
                                                  <div
                                                    className={`relative cursor-pointer rounded overflow-hidden border-2 transition-all ${
                                                      isSelected
                                                        ? "border-blue-500 shadow-sm"
                                                        : "border-transparent opacity-70 hover:opacity-100"
                                                    }`}
                                                    onClick={() => {
                                                      if (selectedCompletionPhotoIds.includes(photo.id)) {
                                                        setSelectedCompletionPhotoIds(prev => prev.filter(id => id !== photo.id));
                                                      } else {
                                                        setSelectedCompletionPhotoIds(prev => [...prev, photo.id]);
                                                      }
                                                    }}
                                                  >
                                                    <img
                                                      src={photo.filePath}
                                                      alt={photo.originalName}
                                                      className="w-24 h-24 object-cover"
                                                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                    />
                                                    {isSelected && (
                                                      <div className="absolute inset-0 bg-blue-500/20 flex items-start justify-end p-0.5">
                                                        <span className="bg-blue-600 text-white text-[11px] font-bold rounded px-1.5 leading-tight">
                                                          {posInGroup + 1}
                                                        </span>
                                                      </div>
                                                    )}
                                                    <button
                                                      type="button"
                                                      title="Preview"
                                                      className="absolute bottom-0.5 right-0.5 h-5 w-5 flex items-center justify-center rounded bg-black/50 text-white hover:bg-black/70 transition-colors"
                                                      onClick={(e) => { e.stopPropagation(); setSelectedImageForPreview(photo); }}
                                                    >
                                                      <Eye className="h-3 w-3" />
                                                    </button>
                                                  </div>
                                                </HoverCardTrigger>
                                                <HoverCardContent side="top" className="w-auto p-1">
                                                  <img
                                                    src={photo.filePath}
                                                    alt={photo.originalName}
                                                    className="max-w-xs max-h-72 object-contain rounded"
                                                  />
                                                </HoverCardContent>
                                              </HoverCard>
                                              {isSelected && (
                                                <div className="flex gap-0.5">
                                                  <button
                                                    type="button"
                                                    disabled={isFirst}
                                                    className="w-7 h-5 flex items-center justify-center rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                    title="Move earlier"
                                                    onClick={(e) => { e.stopPropagation(); movePhotoInGroup(photo.id, 'prev', groupPhotoIds); }}
                                                  >
                                                    ‹
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={isLast}
                                                    className="w-7 h-5 flex items-center justify-center rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                    title="Move later"
                                                    onClick={(e) => { e.stopPropagation(); movePhotoInGroup(photo.id, 'next', groupPhotoIds); }}
                                                  >
                                                    ›
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="outline" onClick={() => setIsCompletionReportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={completionReportSubmitting}
              onClick={async () => {
                setCompletionReportSubmitting(true);
                try {
                  const response = await fetch("/api/print/project-completion", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      projectId: parseInt(id!),
                      selectedPhotoIds: selectedCompletionPhotoIds,
                      sections: completionReportSections,
                      reportTitle: completionReportTitle.trim() || undefined,
                    }),
                  });
                  if (!response.ok) {
                    const err = await response.json().catch(() => ({ message: "Failed to generate report" }));
                    throw new Error(err.message);
                  }
                  const html = await response.text();
                  const win = window.open("", "_blank");
                  if (win) {
                    win.document.write(html);
                    win.document.close();
                  }
                  setIsCompletionReportOpen(false);
                } catch (error: any) {
                  toast({ title: "Error", description: error.message || "Failed to generate completion report", variant: "destructive" });
                } finally {
                  setCompletionReportSubmitting(false);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileText className="h-4 w-4 mr-2" />
              {completionReportSubmitting ? "Generating..." : "Generate & Print"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}