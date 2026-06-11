'use client';

import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Bike,
  Users,
  Tag,
  Settings,
  Leaf,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '#', isActive: true },
  { label: 'Products', icon: Package, href: '#' },
  { label: 'Orders', icon: ShoppingCart, href: '#' },
  { label: 'Delivery', icon: Truck, href: '#' },
  { label: 'Riders', icon: Bike, href: '#' },
  { label: 'Customers', icon: Users, href: '#' },
  { label: 'Promotions', icon: Tag, href: '#' },
  { label: 'Settings', icon: Settings, href: '#' },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="size-6 shrink-0 text-fresh-green" />
          <span className="text-base font-bold text-fresh-green group-data-[collapsible=icon]:hidden">
            UK Grocery
          </span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-warm-gray">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.isActive}
                    tooltip={item.label}
                    className={
                      item.isActive
                        ? 'bg-fresh-green/10 text-fresh-green font-medium hover:bg-fresh-green/15 hover:text-fresh-green'
                        : 'text-warm-gray hover:bg-surface hover:text-charcoal'
                    }
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <SidebarSeparator />
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <div className="flex size-8 items-center justify-center rounded-full bg-fresh-green text-xs font-bold text-white">
            AD
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-medium text-charcoal">Admin User</p>
            <p className="text-xs text-warm-gray">admin@ukgrocery.co.uk</p>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
