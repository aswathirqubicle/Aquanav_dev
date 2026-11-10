import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { PENDING_APPROVALS_KEY } from "@/lib/queryClient";
import { hasPermission, roleDisplayNames } from "@/lib/auth";
import {
  BarChart3,
  Users,
  Settings,
  FileText,
  Package,
  Wrench,
  Calendar,
  User,
  Shield,
  TrendingUp,
  MapPin,
  Camera,
  DollarSign,
  Archive,
  Receipt,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  ChevronRight,
  ChevronDown,
  Building2,
  Clipboard,
  ShoppingCart,
  Briefcase,
  Home,
  AlertTriangle,
  FileX,
  BookOpen,
  LayoutDashboard,
  Ship,
  QrCode,
} from "lucide-react";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  title: string;
  href?: string;
  icon: any;
  roles: string[];
  subItems?: NavItem[];
}

// Which menu entry each pending-approval count belongs to (the keys of
// GET /api/approvals/pending-counts).
type PendingCounts = {
  purchaseRequests: number;
  purchaseOrders: number;
  purchaseInvoices: number;
  salesQuotations: number;
  salesInvoices: number;
  reimbursements: number;
  /** Months with payroll entries still to approve, not entries. */
  payroll: number;
};

const PENDING_COUNT_BY_TITLE: Record<string, keyof PendingCounts> = {
  "Purchase Requests": "purchaseRequests",
  "Purchase Orders": "purchaseOrders",
  "Purchase Invoices": "purchaseInvoices",
  "Sales Quotations": "salesQuotations",
  "Sales Invoices": "salesInvoices",
  Reimbursements: "reimbursements",
  // The sub-item, not the group of the same name: groups only get the dot.
  Payroll: "payroll",
};

// Only these roles approve anything; see server/routes/approvals.routes.ts.
const APPROVER_ROLES = ["admin", "finance"];

/** A count on a menu entry. */
const CountBadge = ({ count }: { count: number }) => (
  <span
    className="ml-auto shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-5 text-center tabular-nums"
    aria-label={`${count} waiting for your approval`}
  >
    {count > 99 ? "99+" : count}
  </span>
);

/** A plain mark on a group heading whose sub-items have something waiting. */
const PendingDot = () => (
  <span
    className="ml-auto h-2 w-2 rounded-full bg-red-500"
    aria-label="Approvals waiting"
  />
);

const navigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
    roles: ["admin", "project_manager", "finance", "customer", "employee"],
  },
  {
    title: "All Projects",
    href: "/projects",
    icon: Ship,
    roles: ["admin", "project_manager", "finance"],
  },
  // Same page; the API already narrows it to the projects the employee is
  // assigned to, so for them it is "theirs", not "all".
  {
    title: "My Projects",
    href: "/projects",
    icon: Ship,
    roles: ["employee"],
  },
  {
    title: "Daily Report",
    href: "/daily-report",
    icon: Calendar,
    roles: ["admin", "project_manager"],
  },
  {
    title: "Consume Report",
    href: "/consume-report",
    icon: Calendar,
    roles: ["admin", "project_manager"],
  },
  // {
  //   title: "Photo Management",
  //   href: "/projects/photos",
  //   icon: Camera,
  //   roles: ["admin", "project_manager", "employee"],
  // },
  {
    title: "Sales",
    icon: FileText,
    roles: ["admin", "finance", "project_manager"],
    subItems: [
      {
        title: "Sales Quotations",
        href: "/sales-quotations",
        icon: FileText,
        // Quotations only for a project manager, and only their own. Invoices,
        // proforma invoices and credit notes stay admin and finance.
        roles: ["admin", "finance", "project_manager"],
      },
      {
        title: "Sales Invoices",
        href: "/sales-invoices",
        icon: FileText,
        roles: ["admin", "finance"],
      },
      {
        title: "Proforma Invoices",
        href: "/proforma-invoices",
        icon: FileText,
        roles: ["admin", "finance"],
      },
      {
        title: "Credit Notes",
        href: "/credit-notes",
        icon: FileX,
        roles: ["admin", "finance"],
      },
    ],
  },
  {
    title: "Purchase",
    icon: ShoppingCart,
    roles: ["admin", "project_manager", "finance"],
    subItems: [
      {
        title: "Purchase Requests",
        href: "/purchase-requests",
        icon: ShoppingCart,
        roles: ["admin", "project_manager", "finance",],
      },
      {
        title: "Purchase Orders",
        href: "/purchase-orders",
        icon: FileText,
        roles: ["admin", "finance", "project_manager"],
      },
      {
        title: "Purchase Invoices",
        href: "/purchase-invoices",
        icon: FileText,
        roles: ["admin", "finance"],
      },
    ],
  },
  {
    title: "Payroll",
    icon: DollarSign,
    roles: ["admin", "project_manager", "finance", "employee"],
    subItems: [
      {
        title: "Payroll",
        href: "/payroll",
        icon: DollarSign,
        roles: ["admin", "finance"],
      },
      {
        title: "My Payslips",
        href: "/my-payslips",
        icon: FileText,
        roles: ["admin", "finance", "project_manager", "employee"],
      },
      {
        title: "Reimbursements",
        href: "/reimbursements",
        icon: Receipt,
        roles: ["admin", "finance", "project_manager", "employee", "customer"],
      },
    ],
  },
  {
    title: "Goods Receipt",
    href: "/inventory/goods-receipt",
    icon: ArrowDownLeft,
    roles: ["admin", "finance", "project_manager"],
  },
  {
    title: "Goods Issue",
    href: "/inventory/goods-issue",
    icon: ArrowUpRight,
    roles: ["admin", "finance", "project_manager"],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    roles: ["admin", "finance", "project_manager"],
  },

  {
    title: "Asset Inventory",
    href: "/asset-inventory",
    icon: QrCode,
    roles: ["admin"],
  },
  {
    title: "Employee Management",
    href: "/employees",
    icon: Users,
    roles: ["admin", "project_manager"],
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    roles: ["admin", "finance", "project_manager"],
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Users,
    roles: ["admin", "finance", "project_manager"],
  },
  {
    title: "General Ledger",
    icon: BookOpen,
    roles: ["admin", "finance"],
    subItems: [
      {
        title: "All Entries",
        href: "/general-ledger",
        icon: BookOpen,
        roles: ["admin", "finance"],
      },
      {
        title: "Accounts Receivable",
        href: "/general-ledger/receivable",
        icon: TrendingUp,
        roles: ["admin", "finance"],
      },
      {
        title: "Accounts Payable",
        href: "/general-ledger/payable",
        icon: TrendingUp,
        roles: ["admin", "finance"],
      },
    ],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: TrendingUp,
    roles: ["admin", "project_manager", "finance"],
  },
  {
    title: "User Management",
    href: "/users",
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["admin"],
  },
  {
    title: "Error Logs",
    href: "/error-logs",
    icon: AlertTriangle,
    roles: ["admin"],
  },
];

const sections = [
  {
    title: "Projects",
    items: [
      "Dashboard",
      "All Projects",
      "My Projects",
      "Daily Report",
      "Consume Report",
    ],
  },
  {
    title: "Operations",
    items: [
      "Sales",
      "Payroll",
      "My Payslips",
      "Reimbursements",
      "Purchase",
      "Goods Receipt",
      "Goods Issue",
    ],
  },
  {
    title: "Resources",
    items: ["Inventory", "Assets", "Asset Inventory", "Enhanced Asset Inventory", "Employee Management"],
  },
  {
    title: "Business Partners",
    items: ["Customers", "Suppliers"],
  },
  {
    title: "Administration",
    items: ["General Ledger", "Reports", "User Management", "Settings", "Error Logs"],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const isApprover = !!user?.role && APPROVER_ROLES.includes(user.role);
  const { data: pendingCounts } = useQuery<PendingCounts>({
    queryKey: PENDING_APPROVALS_KEY,
    enabled: isApprover,
    // Other users submit things too, so poll as well as refreshing after
    // this user's own changes.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const pendingFor = (item: NavItem) => {
    const key = PENDING_COUNT_BY_TITLE[item.title];
    return key && pendingCounts ? pendingCounts[key] ?? 0 : 0;
  };

  const filteredNavigation = navigation.filter(
    (item) => user?.role && hasPermission(user.role, item.roles),
  );

  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderNavigationItem = (item: NavItem) => {
    const Icon = item.icon;

    // Handle items with submenus
    if (item.subItems) {
      const groupHasPending = item.subItems.some(
        (subItem) =>
          !!user?.role &&
          hasPermission(user.role, subItem.roles) &&
          pendingFor(subItem) > 0,
      );
      const hasActiveSubItem = item.subItems.some(
        (subItem) =>
          location === subItem.href ||
          (subItem.href && location.startsWith(subItem.href + "/")),
      );

      return (
        <Collapsible key={item.title} defaultOpen={hasActiveSubItem}>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton>
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
                {groupHasPending && <PendingDot />}
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90",
                    groupHasPending ? "ml-2" : "ml-auto",
                  )}
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.subItems
                  .filter(
                    (subItem) =>
                      user?.role && hasPermission(user.role, subItem.roles),
                  )
                  .map((subItem) => {
                    const isSubActive =
                      location === subItem.href ||
                      (subItem.href && location.startsWith(subItem.href + "/"));
                    const SubIcon = subItem.icon;

                    return (
                      <SidebarMenuSubItem key={subItem.href}>
                        <SidebarMenuSubButton asChild isActive={isSubActive}>
                          <Link href={subItem.href!} onClick={handleNavigation}>
                            <SubIcon className="h-4 w-4" />
                            <span className="truncate">{subItem.title}</span>
                            {pendingFor(subItem) > 0 && (
                              <CountBadge count={pendingFor(subItem)} />
                            )}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    // Handle regular menu items
    const isActive =
      location === item.href ||
      (item.href && location.startsWith(item.href + "/"));

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={item.href!} onClick={handleNavigation}>
            <Icon className="h-4 w-4" />
            <span>{item.title}</span>
            {pendingFor(item) > 0 && <CountBadge count={pendingFor(item)} />}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarRoot variant="inset">
      <SidebarHeader>
        <div className="bg-ocean-50 dark:bg-ocean-900/20 border border-ocean-200 dark:border-ocean-800 rounded-lg p-3">
          <div className="flex items-center">
            <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-ocean-800 dark:text-ocean-400">
              {user?.role ? roleDisplayNames[user.role] : "Unknown Role"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => {
          const sectionItems = filteredNavigation.filter((item) =>
            section.items.includes(item.title),
          );

          if (sectionItems.length === 0) return null;

          return (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sectionItems.map(renderNavigationItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarRail />
    </SidebarRoot>
  );
}