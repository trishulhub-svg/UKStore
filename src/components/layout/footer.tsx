import Link from 'next/link';
import { Leaf, Phone, Mail, MapPin } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const quickLinks = [
  { label: 'Categories', href: '#' },
  { label: 'About Us', href: '#' },
  { label: 'Help & FAQ', href: '#' },
  { label: 'Terms & Conditions', href: '#' },
  { label: 'Privacy Policy', href: '#' },
  { label: 'Delivery Info', href: '#' },
];

const categories = [
  { label: 'Fruits & Veg', href: '#' },
  { label: 'Dairy & Eggs', href: '#' },
  { label: 'Meat & Fish', href: '#' },
  { label: 'Bakery', href: '#' },
  { label: 'Frozen', href: '#' },
  { label: 'Drinks', href: '#' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-off-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Store info */}
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              <Leaf className="size-5 text-fresh-green" />
              <span className="text-lg font-bold text-fresh-green">
                UK Grocery
              </span>
            </div>
            <p className="text-sm leading-relaxed text-warm-gray">
              Your local grocery delivery service, bringing fresh produce and
              everyday essentials straight to your door. Supporting local
              communities across the United Kingdom.
            </p>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-fresh-green/10 px-3 py-1 text-xs font-semibold text-fresh-green">
              <Leaf className="size-3" />
              Fresh Local
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-charcoal">
              Categories
            </h3>
            <ul className="space-y-2">
              {categories.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-warm-gray transition-colors hover:text-fresh-green"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-charcoal">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-warm-gray transition-colors hover:text-fresh-green"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-charcoal">
              Contact Us
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-fresh-green" />
                <span className="text-sm text-warm-gray">
                  123 High Street
                  <br />
                  London, UK
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-fresh-green" />
                <a
                  href="tel:+442012345678"
                  className="text-sm text-warm-gray transition-colors hover:text-fresh-green"
                >
                  020 1234 5678
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-fresh-green" />
                <a
                  href="mailto:hello@ukgrocery.co.uk"
                  className="text-sm text-warm-gray transition-colors hover:text-fresh-green"
                >
                  hello@ukgrocery.co.uk
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-warm-gray">
            &copy; {new Date().getFullYear()} UK Grocery Store. All rights
            reserved.
          </p>
          <p className="text-xs text-warm-gray">
            VAT Registered &middot; UK Food Standards Compliant
          </p>
        </div>
      </div>
    </footer>
  );
}
