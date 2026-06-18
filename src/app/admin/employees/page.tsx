'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Edit2, Loader2, AlertTriangle, Package, Truck, UserPlus, Copy, Check, Mail, KeyRound, AlertCircle } from 'lucide-react'
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
import { apiFetch } from '@/lib/api-fetch'

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
  mustResetPassword?: boolean
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

  // Create employee dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newRole, setNewRole] = useState<'DRIVER' | 'PICKER' | 'MANAGER'>('PICKER')
  const [creating, setCreating] = useState(false)
  const [createdResult, setCreatedResult] = useState<{
    email: string
    tempPassword: string
    name: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  // Edit form state
  const [editSalary, setEditSalary] = useState('')
  const [editWageRate, setEditWageRate] = useState('')
  const [editWageType, setEditWageType] = useState('')
  const [editBankName, setEditBankName] = useState('')
  const [editBankAccountNo, setEditBankAccountNo] = useState('')
  const [editBankSortCode, setEditBankSortCode] = useState('')
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editRole, setEditRole] = useState('')

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/employees')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEmployees(data.employees || [])
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to load employees')
      }

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
    setEditName(employee.name || '')
    setEditPhone(employee.phone || '')
    setEditEmail(employee.email)
    setEditIsActive(employee.isActive)
    setEditRole(employee.role)
    setEditDialogOpen(true)
  }

  const handleCreateEmployee = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Name and email are required')
      return
    }
    setCreating(true)
    try {
      const res = await apiFetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim() || undefined,
          role: newRole,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      const data = await res.json()
      setCreatedResult({
        email: data.employee.email,
        tempPassword: data.tempPassword,
        name: data.employee.name || '',
      })
      toast.success('Employee created — share the temp password')
      fetchEmployees()
      // Reset form fields but keep dialog open to show the temp password
      setNewName('')
      setNewEmail('')
      setNewPhone('')
      setNewRole('PICKER')
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to create employee')
      }

    } finally {
      setCreating(false)
    }
  }

  const handleCopyCredentials = async () => {
    if (!createdResult) return
    const text = `Welcome to Fresh Mart!\n\nYour employee account has been created.\n\nEmail: ${createdResult.email}\nTemporary password: ${createdResult.tempPassword}\n\nPlease log in at ${window.location.origin}/auth/login and set a new password when prompted.`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Credentials copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error('Failed to copy')
      }

    }
  }

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false)
    setCreatedResult(null)
    setCopied(false)
  }

  const handleSave = async () => {
    if (!editEmployee) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        salary: editSalary || null,
        wageRate: editWageRate || null,
        wageType: editWageType || null,
        bankName: editBankName || null,
        bankAccountNo: editBankAccountNo || null,
        bankSortCode: editBankSortCode || null,
        name: editName,
        phone: editPhone,
      }
      // Only send email if it changed (owner-only — backend enforces)
      if (editEmail !== editEmployee.email) {
        body.email = editEmail
      }
      if (editRole !== editEmployee.role) {
        body.role = editRole
      }
      if (editIsActive !== editEmployee.isActive) {
        body.isActive = editIsActive
      }

      const res = await apiFetch(`/api/admin/employees/${editEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }

      toast.success(`${editEmployee.name || 'Employee'} details updated`)
      setEditDialogOpen(false)
      fetchEmployees()
    } catch (err: any) {
      if (err?.message !== 'Session expired — redirecting to login') {
        toast.error(err.message || 'Failed to update employee details')
      }

    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm">
            {employees.length} staff members &middot; Salary & wage management
          </p>
        </div>
        <Button
          onClick={() => {
            setCreatedResult(null)
            setCreateDialogOpen(true)
          }}
          className="bg-[#16a34a] hover:bg-[#15803d] text-white"
        >
          <UserPlus className="h-4 w-4 mr-1" /> Add Employee
        </Button>
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
                          {emp.mustResetPassword && (
                            <Badge className="ml-2 text-xs bg-amber-100 text-amber-700">Password Reset Required</Badge>
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
                      {emp.mustResetPassword && (
                        <Badge className="mt-1 text-xs bg-amber-100 text-amber-700">Password Reset Required</Badge>
                      )}
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
                    <Edit2 className="h-4 w-4 mr-1" /> Edit Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Edit Employee Dialog — Personal + Salary + Bank */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Employee — {editEmployee?.name || 'Employee'}
            </DialogTitle>
          </DialogHeader>

          {editEmployee && (
            <div className="space-y-4 py-2">
              {/* Personal Details */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Personal Details</h4>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Full Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Phone</Label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="e.g., +44 7123 456789"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">
                    Email {editEmployee.role === 'OWNER' ? '(owner-only field)' : ''}
                  </Label>
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                  <p className="text-xs text-gray-400">
                    Only the store owner can change email addresses.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Role</Label>
                    <Select
                      value={editRole}
                      onValueChange={setEditRole}
                      disabled={editEmployee.role === 'OWNER'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OWNER" disabled>Owner</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="DRIVER">Driver</SelectItem>
                        <SelectItem value="PICKER">Picker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Account Status</Label>
                    <Select
                      value={editIsActive ? 'active' : 'inactive'}
                      onValueChange={(v) => setEditIsActive(v === 'active')}
                      disabled={editEmployee.role === 'OWNER'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {editEmployee.mustResetPassword && (
                  <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>This employee must reset their password on next login.</span>
                  </div>
                )}
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

      {/* Create Employee Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) handleCloseCreateDialog() }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Employee</DialogTitle>
          </DialogHeader>

          {createdResult ? (
            // ─── Success state — show temp password ─────────────
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2 text-green-700 font-medium text-sm mb-2">
                  <AlertCircle className="h-4 w-4" />
                  Account created for {createdResult.name}
                </div>
                <p className="text-xs text-green-700">
                  Share these credentials with the employee. They will be required to set a new password on first login.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Email</Label>
                <div className="flex items-center gap-2">
                  <Input value={createdResult.email} readOnly className="bg-gray-50 font-mono text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Temporary Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={createdResult.tempPassword}
                    readOnly
                    className="bg-gray-50 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCredentials}
                    title="Copy credentials"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Important:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>This password is shown only once.</li>
                    <li>When the employee logs in, they'll be forced to set a new password.</li>
                    <li>Copy and share it securely — do not email it in plain text.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreatedResult(null)
                    // Keep dialog open to allow creating another employee
                  }}
                >
                  Create Another
                </Button>
                <Button
                  onClick={handleCloseCreateDialog}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            // ─── Form state ────────────────────────────────────
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="newName">Full Name *</Label>
                <Input
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newEmail">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="employee@example.com"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  The temp password will be sent here once email is configured.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPhone">Phone (optional)</Label>
                <Input
                  id="newPhone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g., +44 7123 456789"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select
                  value={newRole}
                  onValueChange={(v: 'DRIVER' | 'PICKER' | 'MANAGER') => setNewRole(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PICKER">Picker (warehouse)</SelectItem>
                    <SelectItem value="DRIVER">Driver (deliveries)</SelectItem>
                    <SelectItem value="MANAGER">Manager (admin access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                <KeyRound className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-0.5">What happens next:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>A secure temp password is generated automatically.</li>
                    <li>The employee must log in with their email + temp password.</li>
                    <li>They'll be immediately prompted to set their own password.</li>
                  </ol>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleCloseCreateDialog} disabled={creating}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateEmployee}
                  disabled={creating || !newName.trim() || !newEmail.trim()}
                  className="bg-[#16a34a] hover:bg-[#15803d] text-white"
                >
                  {creating ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating...</>
                  ) : (
                    <><UserPlus className="h-4 w-4 mr-1.5" /> Create Employee</>
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
