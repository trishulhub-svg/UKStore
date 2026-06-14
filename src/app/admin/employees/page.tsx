'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Edit2, Loader2, AlertTriangle, Package, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/vat'

interface EmployeeProfile {
  id: string
  salary: number | null
  wageRate: number | null
  wageType: string | null
  bankName: string | null
  bankAccountNo: string | null
  bankSortCode: string | null
}

interface DriverProfile {
  vehicleType: string | null
  verificationStatus: string
}

interface Employee {
  id: string
  name: string | null
  email: string
  phone: string | null
  role: string
  isActive: boolean
  createdAt: string
  employeeProfile: EmployeeProfile | null
  driverProfile: DriverProfile | null
  todayOrderCount: number
}

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  DRIVER: 'Driver',
  PICKER: 'Picker',
}

const roleColors: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  DRIVER: 'bg-orange-100 text-orange-700',
  PICKER: 'bg-green-100 text-green-700',
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [editSalary, setEditSalary] = useState('')
  const [editWageRate, setEditWageRate] = useState('')
  const [editWageType, setEditWageType] = useState('')
  const [editBankName, setEditBankName] = useState('')
  const [editBankAccountNo, setEditBankAccountNo] = useState('')
  const [editBankSortCode, setEditBankSortCode] = useState('')

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/employees')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEmployees(data.employees || [])
    } catch {
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const handleEdit = (employee: Employee) => {
    setEditEmployee(employee)
    setEditSalary(employee.employeeProfile?.salary?.toString() || '')
    setEditWageRate(employee.employeeProfile?.wageRate?.toString() || '')
    setEditWageType(employee.employeeProfile?.wageType || 'hourly')
    setEditBankName(employee.employeeProfile?.bankName || '')
    setEditBankAccountNo(employee.employeeProfile?.bankAccountNo || '')
    setEditBankSortCode(employee.employeeProfile?.bankSortCode || '')
    setEditDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editEmployee) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/employees/${editEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salary: editSalary || null,
          wageRate: editWageRate || null,
          wageType: editWageType || null,
          bankName: editBankName || null,
          bankAccountNo: editBankAccountNo || null,
          bankSortCode: editBankSortCode || null,
        }),
      })
      if (!res.ok) throw new Error()

      toast.success(`${editEmployee.name || 'Employee'} salary details updated`)
      setEditDialogOpen(false)
      fetchEmployees()
    } catch {
      toast.error('Failed to update employee details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <p className="text-gray-500 text-sm">
          {employees.length} staff members &middot; Salary & wage management
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No employees found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Phone</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Salary / Wage</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Today&apos;s Orders</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {emp.name || 'N/A'}
                          {!emp.isActive && (
                            <Badge variant="outline" className="ml-2 text-xs text-gray-400">Inactive</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500">{emp.email}</td>
                        <td className="py-3 px-4 text-gray-500">{emp.phone || '—'}</td>
                        <td className="py-3 px-4">
                          <Badge className={`text-xs ${roleColors[emp.role] || 'bg-gray-100 text-gray-700'}`}>
                            {roleLabels[emp.role] || emp.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {emp.employeeProfile ? (
                            <div>
                              {emp.employeeProfile.salary ? (
                                <span className="font-medium">{formatPrice(emp.employeeProfile.salary)}/mo</span>
                              ) : emp.employeeProfile.wageRate ? (
                                <span className="font-medium">
                                  {formatPrice(emp.employeeProfile.wageRate)}/{emp.employeeProfile.wageType === 'hourly' ? 'hr' : emp.employeeProfile.wageType === 'daily' ? 'day' : 'hr'}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">Not set</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">No profile</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {emp.role === 'DRIVER' ? (
                              <Truck className="h-3.5 w-3.5 text-orange-500" />
                            ) : (
                              <Package className="h-3.5 w-3.5 text-green-500" />
                            )}
                            <span className="font-medium">{emp.todayOrderCount}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(emp)}
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {employees.map((emp) => (
              <Card key={emp.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{emp.name || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{emp.email}</p>
                    </div>
                    <Badge className={`text-xs ${roleColors[emp.role] || 'bg-gray-100 text-gray-700'}`}>
                      {roleLabels[emp.role] || emp.role}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Phone</span>
                      <span>{emp.phone || '—'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Salary / Wage</span>
                      {emp.employeeProfile ? (
                        emp.employeeProfile.salary ? (
                          <span className="font-medium">{formatPrice(emp.employeeProfile.salary)}/mo</span>
                        ) : emp.employeeProfile.wageRate ? (
                          <span className="font-medium">
                            {formatPrice(emp.employeeProfile.wageRate)}/{emp.employeeProfile.wageType === 'hourly' ? 'hr' : 'day'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not set</span>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">No profile</span>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Today&apos;s Orders</span>
                      <div className="flex items-center gap-1">
                        {emp.role === 'DRIVER' ? (
                          <Truck className="h-3.5 w-3.5 text-orange-500" />
                        ) : (
                          <Package className="h-3.5 w-3.5 text-green-500" />
                        )}
                        <span className="font-medium">{emp.todayOrderCount}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full min-h-10"
                    onClick={() => handleEdit(emp)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" /> Edit Salary Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Edit Salary Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit Salary Details — {editEmployee?.name || 'Employee'}
            </DialogTitle>
          </DialogHeader>

          {editEmployee && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Role</span>
                  <Badge className={`text-xs ${roleColors[editEmployee.role]}`}>
                    {roleLabels[editEmployee.role]}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium">{editEmployee.email}</span>
                </div>
              </div>

              <Separator />

              {/* Salary / Wage Type */}
              <div className="space-y-2">
                <Label>Wage Type</Label>
                <Select value={editWageType} onValueChange={setEditWageType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly Wage</SelectItem>
                    <SelectItem value="daily">Daily Wage</SelectItem>
                    <SelectItem value="monthly">Monthly Salary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional fields based on wage type */}
              {editWageType === 'monthly' ? (
                <div className="space-y-2">
                  <Label>Monthly Salary (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 2500"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>
                    {editWageType === 'hourly' ? 'Hourly' : 'Daily'} Wage Rate (£)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={editWageType === 'hourly' ? 'e.g., 12.50' : 'e.g., 100'}
                    value={editWageRate}
                    onChange={(e) => setEditWageRate(e.target.value)}
                  />
                </div>
              )}

              <Separator />

              {/* Bank Details */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Bank Details</Label>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">Bank Name</Label>
                    <Input
                      placeholder="e.g., Barclays"
                      value={editBankName}
                      onChange={(e) => setEditBankName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Account Number</Label>
                      <Input
                        placeholder="12345678"
                        value={editBankAccountNo}
                        onChange={(e) => setEditBankAccountNo(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Sort Code</Label>
                      <Input
                        placeholder="00-00-00"
                        value={editBankSortCode}
                        onChange={(e) => setEditBankSortCode(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...</>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
