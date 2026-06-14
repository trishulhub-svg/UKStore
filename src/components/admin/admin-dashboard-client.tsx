'use client'

import Link from 'next/link'
import { Package, ShoppingBag, Users, Key, Settings, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/vat'
import type { Order } from '@/types'

interface AdminDashboardClientProps {
  stats: {
    products: number
    orders: number
    customers: number
    configuredKeys: number
    totalKeys: number
  }
  recentOrders: Order[]
}

const statusColors: Record<string, string> = {
  placed: 'bg-blue-50 text-blue-700',
  picking: 'bg-amber-50 text-amber-700',
  ready: 'bg-purple-50 text-purple-700',
  out_for_delivery: 'bg-orange-50 text-orange-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
}

export function AdminDashboardClient({ stats, recentOrders }: AdminDashboardClientProps) {
  const allKeysConfigured = stats.configuredKeys === stats.totalKeys
  const needsAttention = stats.configuredKeys < stats.totalKeys

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage your store, API keys, and configuration</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Products</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.products}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Orders</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.orders}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Customers</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.customers}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={needsAttention ? 'border-amber-200' : 'border-green-200'}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">API Keys</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                  {stats.configuredKeys}/{stats.totalKeys}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                needsAttention ? 'bg-amber-50' : 'bg-green-50'
              }`}>
                {needsAttention ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
              </div>
            </div>
            {needsAttention && (
              <p className="text-xs text-amber-600 mt-2 font-medium">
                {stats.totalKeys - stats.configuredKeys} key{stats.totalKeys - stats.configuredKeys !== 1 ? 's' : ''} need configuration
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Integration Status Alert */}
      {needsAttention && (
        <Card className="mb-8 border-amber-200 bg-amber-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 flex-wrap">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-amber-800">API Keys Need Configuration</p>
                <p className="text-sm text-amber-700 mt-1">
                  Some integrations are not yet configured. Go to{' '}
                  <Link href="/admin/settings" className="font-medium underline hover:text-amber-900">
                    API Keys &amp; Settings
                  </Link>{' '}
                  to add your Stripe, Google OAuth, and other API keys. Payment processing will remain in demo mode until Stripe keys are added.
                </p>
              </div>
              <Link href="/admin/settings">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                  <Settings className="h-3.5 w-3.5 mr-1" />
                  Configure
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Recent Orders</CardTitle>
          {recentOrders.length > 0 && (
            <span className="text-sm text-gray-500">{recentOrders.length} most recent</span>
          )}
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No orders yet</p>
            </div>
          ) : (
            <>
              {/* Mobile Card List */}
              <div className="md:hidden space-y-3">
                {recentOrders.map((order) => (
                  <div key={order.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-gray-700">#{order.id.substring(0, 8).toUpperCase()}</span>
                      <Badge variant="secondary" className={`text-xs ${statusColors[order.status] || ''}`}>
                        {order.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{formatPrice(order.total)}</span>
                      <span className="text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-medium text-gray-500">Order</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-500">Total</th>
                      <th className="text-left py-3 px-2 font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <span className="font-mono text-xs">#{order.id.substring(0, 8).toUpperCase()}</span>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="secondary" className={`text-xs ${statusColors[order.status] || ''}`}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 font-medium">{formatPrice(order.total)}</td>
                        <td className="py-3 px-2 text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
