import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
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
    roles: ["admin", "project_manager", "customer", "employee"],
  },
  {
    title: "Daily Activities",
    href: "/projects/activities",
    icon: Calendar,
    roles: ["admin", "project_manager", "employee"],
  },
  {
    title: "Photo Management",
    href: "/projects/photos",
    icon: Camera,
    roles: ["admin", "project_manager", "employee"],
  },
  {
    title: "Sales",
    icon: FileText,
    roles: ["admin", "project_manager", "finance"],
    subItems: [
      {
        title: "Sales & Invoicing",
        href: "/sales",
        icon: FileText,
        roles: ["admin", "project_manager", "finance"],
      },
      {
        title: "Proforma Invoices",
        href: "/proforma-invoices",
        icon: FileText,
        roles: ["admin", "project_manager", "finance"],
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
    title: "Payroll",
    href: "/payroll",
    icon: DollarSign,
    roles: ["admin", "finance"],
  },
  {
    title: "Purchase",
    icon: ShoppingCart,
    roles: ["admin", "project_manager", "finance", "employee"],
    subItems: [
      {
        title: "Purchase Requests",
        href: "/purchase-requests",
        icon: ShoppingCart,
        roles: ["admin", "project_manager", "finance", "employee"],
      },
      {
        title: "Purchase Orders",
        href: "/purchase-orders",
        icon: FileText,
        roles: ["admin", "project_manager", "finance"],
      },
      {
        title: "Purchase Invoices",
        href: "/purchase-invoices",
        icon: FileText,
        roles: ["admin", "project_manager", "finance"],
      },
    ],
  },
  {
    title: "Goods Receipt",
    href: "/inventory/goods-receipt",
    icon: ArrowDownLeft,
    roles: ["admin", "project_manager", "finance"],
  },
  {
    title: "Goods Issue",
    href: "/inventory/goods-issue",
    icon: ArrowUpRight,
    roles: ["admin", "project_manager", "finance"],
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    roles: ["admin", "project_manager", "finance"],
  },

  {
    title: "Asset Inventory",
    href: "/asset-inventory",
    icon: QrCode,
    roles: ["admin", "project_manager"],
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
    roles: ["admin", "project_manager", "finance"],
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Users,
    roles: ["admin", "project_manager", "finance"],
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
      "Daily Activities",
      "Photo Management",
    ],
  },
  {
    title: "Operations",
    items: [
      "Sales",
      "Payroll",
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
                <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
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
                            <span>{subItem.title}</span>
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