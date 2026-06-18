'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Eye, AlertTriangle, CheckCircle2, XCircle, Clock, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { exportTableToPdf } from '@/lib/client-pdf'
import { apiFetch } from '@/lib/api-fetch'

const verificationColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
}

const verificationIcons: Record<string, any> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
}

interface Driver {
  id: string
  name: string | null
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
  driverProfile: {
    id: string
    vehicleType: string | null
    vehicleReg: string | null
    nationalInsuranceNumber: string | null
    rightToWorkUrl: string | null
    drivingLicenseUrl: string | null
    verificationStatus: string
    rejectionReason: string | null
    verifiedAt: string | null
  } | null
  _count: { drivenOrders: number }
}

interface DriverDetail {
  id: string
  name: string | null
  email: string
  phone: string | null
  isActive: boolean
  createdAt: string
  driverProfile: any
  drivenOrders: Array<{
    id: string
    status: string
    total: number
    createdAt: string
    customer: { name: string | null }
  }>
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [selectedDriver, setSelectedDriver] = useState<DriverDetail | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // Reject dialog
  const [rejectDriverId, setRejectDriverId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const fetchDrivers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await apiFetch(`/api/admin/drivers?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDrivers(data.drivers)
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to load drivers')
      }

    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchDrivers()
  }, [fetchDrivers])

  const handleViewDetail = async (driverId: string) => {
    setDetailLoading(true)
    setSheetOpen(true)
    try {
      const res = await apiFetch(`/api/admin/drivers/${driverId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSelectedDriver(data.driver)
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to load driver details')
      }

    } finally {
      setDetailLoading(false)
    }
  }

  const handleApprove = async (driverId: string) => {
    try {
      const res = await apiFetch('/api/admin/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, verificationStatus: 'approved' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Driver approved')
      fetchDrivers()
      if (selectedDriver?.id === driverId) handleViewDetail(driverId)
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to approve driver')
      }

    }
  }

  const handleReject = async () => {
    if (!rejectDriverId) return
    setRejecting(true)
    try {
      const res = await apiFetch('/api/admin/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: rejectDriverId, verificationStatus: 'rejected', rejectionReason }),
      })
      if (!res.ok) throw new Error()
      toast.success('Driver rejected')
      setRejectDriverId(null)
      setRejectionReason('')
      fetchDrivers()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to reject driver')
      }

    } finally {
      setRejecting(false)
    }
  }

  const handleToggleActive = async (driverId: string, isActive: boolean) => {
    try {
      const res = await apiFetch('/api/admin/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(isActive ? 'Driver activated' : 'Driver deactivated')
      fetchDrivers()
      if (selectedDriver?.id === driverId) handleViewDetail(driverId)
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to update driver')
      }

    }
  }

  const handleExportPdf = async () => {
    if (drivers.length === 0) {
      toast.error('No drivers to export')
      return
    }
    try {
      await exportTableToPdf({
        title: 'Drivers',
        subtitle: `${drivers.length} driver${drivers.length === 1 ? '' : 's'}`,
        filename: `drivers-${new Date().toISOString().split('T')[0]}.pdf`,
        columns: ['Name', 'Email', 'Vehicle', 'Verification', 'Deliveries', 'Status', 'Joined'],
        rows: drivers.map((d) => [
          d.name || '—',
          d.email,
          d.driverProfile?.vehicleType || '—',
          d.driverProfile?.verificationStatus || 'pending',
          d._count.drivenOrders,
          d.isActive ? 'Active' : 'Inactive',
          new Date(d.createdAt).toLocaleDateString('en-GB'),
        ]),
        footer: `Total deliveries by listed drivers: ${drivers.reduce((s, d) => s + d._count.drivenOrders, 0)}`,
      })
      toast.success('PDF exported')
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to export PDF')
      }

    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-500 text-sm">{drivers.length} drivers</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportPdf}
          disabled={drivers.length === 0}
          className="border-gray-300"
        >
          <FileDown className="h-4 w-4 mr-1" /> Export PDF
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No drivers found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Vehicle</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Verification</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Deliveries</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => {
                      const VIcon = verificationIcons[d.driverProfile?.verificationStatus || 'pending'] || Clock
                      return (
                        <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">{d.name || 'N/A'}</td>
                          <td className="py-3 px-4 text-gray-500">{d.email}</td>
                          <td className="py-3 px-4 text-gray-500 capitalize">{d.driverProfile?.vehicleType || '-'}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="secondary"
                              className={`text-xs ${verificationColors[d.driverProfile?.verificationStatus || 'pending']}`}
                            >
                              <VIcon className="h-3 w-3 mr-1" />
                              {d.driverProfile?.verificationStatus || 'pending'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">{d._count.drivenOrders}</td>
                          <td className="py-3 px-4">
                            <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-xs">
                              {d.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewDetail(d.id)}>
                                <Eye className="h-4 w-4 mr-1" /> View
                              </Button>
                              {d.driverProfile?.verificationStatus === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-[#16a34a] hover:bg-[#15803d] text-white h-8"
                                    onClick={() => handleApprove(d.id)}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8"
                                    onClick={() => setRejectDriverId(d.id)}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {drivers.map((d) => {
                  const VIcon = verificationIcons[d.driverProfile?.verificationStatus || 'pending'] || Clock
                  return (
                    <Card key={d.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-gray-900">{d.name || 'N/A'}</p>
                            <p className="text-xs text-gray-500">{d.email}</p>
                          </div>
                          <Badge variant={d.isActive ? 'default' : 'secondary'} className="text-xs">
                            {d.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Vehicle</span>
                            <span className="font-medium text-sm capitalize">{d.driverProfile?.vehicleType || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Verification</span>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${verificationColors[d.driverProfile?.verificationStatus || 'pending']}`}
                            >
                              <VIcon className="h-3 w-3 mr-1" />
                              {d.driverProfile?.verificationStatus || 'pending'}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Deliveries</span>
                            <span className="font-medium">{d._count.drivenOrders}</span>
                          </div>
                        </div>
                        {d.driverProfile?.verificationStatus === 'pending' && (
                          <div className="flex items-center gap-2 mb-3">
                            <Button
                              size="sm"
                              className="flex-1 min-h-10 bg-[#16a34a] hover:bg-[#15803d] text-white"
                              onClick={() => handleApprove(d.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1 min-h-10"
                              onClick={() => setRejectDriverId(d.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button variant="outline" size="sm" className="flex-1 min-h-10" onClick={() => handleViewDetail(d.id)}>
                            <Eye className="h-4 w-4 mr-1" /> View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Driver Details</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="py-8 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : selectedDriver ? (
            <div className="py-4 space-y-6">
              {/* Driver Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-1">
                <p className="font-medium">{selectedDriver.name || 'N/A'}</p>
                <p className="text-sm text-gray-500">{selectedDriver.email}</p>
                {selectedDriver.phone && <p className="text-sm text-gray-500">{selectedDriver.phone}</p>}
                <Separator className="my-2" />
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Status:</span>{' '}
                    <Badge variant={selectedDriver.isActive ? 'default' : 'secondary'} className="text-xs">
                      {selectedDriver.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-500">Deliveries:</span>{' '}
                    <span className="font-medium">{selectedDriver.drivenOrders.length}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant={selectedDriver.isActive ? 'destructive' : 'default'}
                    className={selectedDriver.isActive ? '' : 'bg-[#16a34a] hover:bg-[#15803d]'}
                    onClick={() => handleToggleActive(selectedDriver.id, !selectedDriver.isActive)}
                  >
                    {selectedDriver.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>

              {/* Vehicle & Verification */}
              {selectedDriver.driverProfile && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Vehicle & Verification</h4>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                    <p><strong>Vehicle:</strong> {selectedDriver.driverProfile.vehicleType || 'Not specified'}</p>
                    {selectedDriver.driverProfile.vehicleReg && (
                      <p><strong>Reg:</strong> {selectedDriver.driverProfile.vehicleReg}</p>
                    )}
                    <p>
                      <strong>Verification:</strong>{' '}
                      <Badge variant="secondary" className={`text-xs ${verificationColors[selectedDriver.driverProfile.verificationStatus]}`}>
                        {selectedDriver.driverProfile.verificationStatus}
                      </Badge>
                    </p>
                    {selectedDriver.driverProfile.verifiedAt && (
                      <p className="text-xs text-gray-500">
                        Verified: {new Date(selectedDriver.driverProfile.verifiedAt).toLocaleDateString('en-GB')}
                      </p>
                    )}
                    {selectedDriver.driverProfile.rejectionReason && (
                      <p className="text-xs text-red-600">
                        Rejection reason: {selectedDriver.driverProfile.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Verification Documents */}
                  <h4 className="font-medium text-sm mt-4">Documents</h4>
                  <div className="space-y-2">
                    {selectedDriver.driverProfile.rightToWorkUrl && (
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg text-sm">
                        <span>Right to Work</span>
                        <a href={selectedDriver.driverProfile.rightToWorkUrl} target="_blank" rel="noopener noreferrer" className="text-[#16a34a] text-xs font-medium">View</a>
                      </div>
                    )}
                    {selectedDriver.driverProfile.drivingLicenseUrl && (
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg text-sm">
                        <span>Driving License</span>
                        <a href={selectedDriver.driverProfile.drivingLicenseUrl} target="_blank" rel="noopener noreferrer" className="text-[#16a34a] text-xs font-medium">View</a>
                      </div>
                    )}
                    {!selectedDriver.driverProfile.rightToWorkUrl && !selectedDriver.driverProfile.drivingLicenseUrl && (
                      <p className="text-sm text-gray-500">No documents uploaded</p>
                    )}
                  </div>

                  {/* Approve/Reject buttons */}
                  {selectedDriver.driverProfile.verificationStatus === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1 bg-[#16a34a] hover:bg-[#15803d]"
                        onClick={() => handleApprove(selectedDriver.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => setRejectDriverId(selectedDriver.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Recent Deliveries */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Recent Deliveries</h4>
                {selectedDriver.drivenOrders.length === 0 ? (
                  <p className="text-sm text-gray-500">No deliveries yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedDriver.drivenOrders.map((o) => (
                      <div key={o.id} className="bg-gray-50 p-3 rounded-lg text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs">#{o.id.substring(0, 8).toUpperCase()}</span>
                          <Badge variant="secondary" className="text-xs">{o.status}</Badge>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500">{o.customer.name || 'Customer'}</span>
                          <span className="text-xs font-medium">£{o.total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Reject Dialog */}
      <AlertDialog open={!!rejectDriverId} onOpenChange={(open) => { if (!open) setRejectDriverId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this driver&apos;s verification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="rejectionReason">Rejection Reason</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={rejecting} className="bg-red-600 hover:bg-red-700">
              {rejecting ? 'Rejecting...' : 'Reject Driver'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
