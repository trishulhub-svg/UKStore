'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  Leaf,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCartStore } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';

const navLinks = [
  { label: 'Shop', href: '#' },
  { label: 'Categories', href: '#' },
  { label: 'Offers', href: '#' },
  { label: 'About', href: '#' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const itemCount = useCartStore((s) => s.itemCount());
  const { isAuthenticated, user } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5 text-charcoal" />
        </Button>

        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-1.5">
          <Leaf className="size-6 text-fresh-green" />
          <span className="text-lg font-bold text-fresh-green">
            UK Grocery
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-surface hover:text-fresh-green"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Search bar */}
        <div className="relative ml-auto hidden w-full max-w-sm sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-warm-gray" />
          <Input
            type="search"
            placeholder="Search groceries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 pr-3 text-sm"
          />
        </div>

        {/* Cart button */}
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Shopping cart"
        >
          <ShoppingCart className="size-5 text-charcoal" />
          {itemCount > 0 && (
            <Badge className="absolute -right-1 -top-1 flex size-5 items-center justify-center bg-warm-orange px-0 text-[10px] font-bold text-white border-0">
              {itemCount > 99 ? '99+' : itemCount}
            </Badge>
          )}
        </Button>

        {/* User menu */}
        {isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="User menu"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-fresh-green text-white text-xs">
                    {user.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium text-charcoal">
                  {user.full_name}
                </p>
                <p className="text-xs text-warm-gray">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>My Orders</DropdownMenuItem>
              <DropdownMenuItem>My Addresses</DropdownMenuItem>
              <DropdownMenuItem>Account Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="hidden shrink-0 sm:flex"
          >
            <User className="mr-1.5 size-4" />
            Login
          </Button>
        )}

        {/* Mobile search button */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 sm:hidden"
          aria-label="Search"
        >
          <Search className="size-5 text-charcoal" />
        </Button>
      </div>

      {/* Mobile nav sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-1.5 text-left">
              <Leaf className="size-5 text-fresh-green" />
              <span className="font-bold text-fresh-green">UK Grocery</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col py-2">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-surface hover:text-fresh-green"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="border-t px-4 py-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-fresh-green text-white text-xs">
                    {user.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-charcoal">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-warm-gray">{user.email}</p>
                </div>
              </div>
            ) : (
              <Button className="w-full bg-fresh-green text-white hover:bg-forest-green">
                <User className="mr-1.5 size-4" />
                Login / Register
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
