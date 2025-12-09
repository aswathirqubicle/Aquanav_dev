import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <Navbar />
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}