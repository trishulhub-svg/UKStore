'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Upload,
  Car,
  FileText,
  AlertCircle,
  CheckCircle2,
  Save,
  User,
  Mail,
  Eye,
  KeyRound,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface DriverProfileData {
  id: string
  vehicleType: string | null
  vehicleReg: string | null
  nationalInsuranceNumber: string | null
  rightToWorkUrl: string | null
  drivingLicenseUrl: string | null
  verificationStatus: string
  rejectionReason: string | null
  verifiedAt: string | null
}

export function DriverProfileClient() {
  const [profile, setProfile] = useState<DriverProfileData | null>(null)
  const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [vehicleType, setVehicleType] = useState('')
  const [vehicleReg, setVehicleReg] = useState('')
  const [saved, setSaved] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<'rightToWorkUrl' | 'drivingLicenseUrl' | null>(null)
  const [previewDoc, setPreviewDoc] = useState<'rightToWorkUrl' | 'drivingLicenseUrl' | null>(null)
  const rightToWorkRef = useRef<HTMLInputElement>(null)
  const drivingLicenseRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/driver/profile')
      .then((res) => res.json())
      .then((data) => {
        setProfile(data.profile)
        setUserInfo(data.user)
        setVehicleType(data.profile?.vehicleType || '')
        setVehicleReg(data.profile?.vehicleReg || '')
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/driver/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleType, vehicleReg }),
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
        setEditMode(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDocumentUpload = async (type: 'rightToWorkUrl' | 'drivingLicenseUrl', file: File) => {
    const { validateDocumentFile, fileToDataUrl } = await import('@/lib/upload')
    const err = validateDocumentFile(file)
    if (err) {
      toast.error(err)
      return
    }

    setUploadingDoc(type)
    try {
      const dataUrl = await fileToDataUrl(file)
      const res = await fetch('/api/driver/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [type]: dataUrl }),
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
        toast.success(`${type === 'rightToWorkUrl' ? 'Right to Work' : 'Driving License'} uploaded`)
      } else {
        toast.error('Failed to upload document')
      }
    } catch (err) {
      console.error('Failed to upload document:', err)
      toast.error('Failed to upload document')
    } finally {
      setUploadingDoc(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32" />
        ))}
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Failed to load profile</p>
      </div>
    )
  }

  const verificationIcon = {
    approved: <ShieldCheck className="h-5 w-5 text-[#16a34a]" />,
    pending: <ShieldAlert className="h-5 w-5 text-amber-500" />,
    rejected: <ShieldX className="h-5 w-5 text-red-500" />,
  }[profile.verificationStatus] || <ShieldAlert className="h-5 w-5 text-amber-500" />

  const verificationBadge = {
    approved: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-800',
    rejected: 'bg-red-100 text-red-800',
  }[profile.verificationStatus] || 'bg-amber-100 text-amber-800'

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>

      {/* Verification Status Banner */}
      {profile.verificationStatus === 'pending' && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 text-sm">Verification Pending</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Your documents are being reviewed. You can still pick orders while waiting.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {profile.verificationStatus === 'rejected' && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldX className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-900 text-sm">Verification Rejected</p>
              {profile.rejectionReason && (
                <p className="text-xs text-red-700 mt-0.5">Reason: {profile.rejectionReason}</p>
              )}
              <p className="text-xs text-red-600 mt-1">
                Please re-upload your documents to submit for review again.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {profile.verificationStatus === 'approved' && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-[#16a34a] mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-green-900 text-sm">Verified Driver</p>
              <p className="text-xs text-green-700 mt-0.5">
                Your account has been verified. You&apos;re all set!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Info */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-900">{userInfo?.name || 'Not set'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-900">{userInfo?.email || 'Not set'}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {verificationIcon}
            <Badge className={verificationBadge}>
              {profile.verificationStatus.charAt(0).toUpperCase() + profile.verificationStatus.slice(1)}
            </Badge>
            {profile.verifiedAt && (
              <span className="text-xs text-gray-400">
                on {new Date(profile.verifiedAt).toLocaleDateString('en-GB')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password & Account Settings */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Password &amp; Account Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-gray-500 mb-3">
            Change your password or update your full profile details (name, phone).
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href="/auth/reset-password" className="flex-1">
              <Button variant="outline" className="w-full h-10">
                <KeyRound className="h-4 w-4 mr-1" /> Change Password
              </Button>
            </Link>
            <Link href="/account/profile" className="flex-1">
              <Button variant="outline" className="w-full h-10">
                <User className="h-4 w-4 mr-1" /> Full Profile
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Info */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Car className="h-4 w-4" />
              Vehicle Information
            </CardTitle>
            {!editMode && (
              <Button variant="ghost" size="sm" onClick={() => setEditMode(true)} className="h-9 text-xs">
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {editMode ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="vehicleType" className="text-xs">Vehicle Type</Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger id="vehicleType" className="mt-1">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bicycle">Bicycle</SelectItem>
                    <SelectItem value="motorcycle">Motorcycle</SelectItem>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="vehicleReg" className="text-xs">Vehicle Registration</Label>
                <Input
                  id="vehicleReg"
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value)}
                  placeholder="e.g. AB12 CDE"
                  className="mt-1 uppercase"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setVehicleType(profile.vehicleType || '')
                    setVehicleReg(profile.vehicleReg || '')
                    setEditMode(false)
                  }}
                  className="flex-1 h-10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white h-10"
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Type</span>
                <span className="text-sm font-medium text-gray-900 capitalize">
                  {profile.vehicleType || 'Not set'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Registration</span>
                <span className="text-sm font-medium text-gray-900 uppercase">
                  {profile.vehicleReg || 'Not set'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Right to Work */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {profile.rightToWorkUrl ? (
                  <CheckCircle2 className="h-4 w-4 text-[#16a34a]" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-700">Right to Work</span>
              </div>
              <div className="flex items-center gap-2">
                {profile.rightToWorkUrl && profile.rightToWorkUrl.startsWith('data:') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewDoc('rightToWorkUrl')}
                    className="h-9 text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rightToWorkRef.current?.click()}
                  disabled={uploadingDoc === 'rightToWorkUrl'}
                  className="h-9 text-xs"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {uploadingDoc === 'rightToWorkUrl' ? 'Uploading...' : profile.rightToWorkUrl ? 'Re-upload' : 'Upload'}
                </Button>
                <input
                  type="file"
                  ref={rightToWorkRef}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleDocumentUpload('rightToWorkUrl', file)
                    if (rightToWorkRef.current) rightToWorkRef.current.value = ''
                  }}
                />
              </div>
            </div>
            {profile.rightToWorkUrl && profile.rightToWorkUrl.startsWith('data:image') && (
              <div className="mt-2 ml-6">
                <div className="w-20 h-14 rounded border border-gray-200 overflow-hidden bg-gray-50">
                  <img
                    src={profile.rightToWorkUrl}
                    alt="Right to Work document"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Driving License */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {profile.drivingLicenseUrl ? (
                  <CheckCircle2 className="h-4 w-4 text-[#16a34a]" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-700">Driving License</span>
              </div>
              <div className="flex items-center gap-2">
                {profile.drivingLicenseUrl && profile.drivingLicenseUrl.startsWith('data:') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewDoc('drivingLicenseUrl')}
                    className="h-9 text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => drivingLicenseRef.current?.click()}
                  disabled={uploadingDoc === 'drivingLicenseUrl'}
                  className="h-9 text-xs"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  {uploadingDoc === 'drivingLicenseUrl' ? 'Uploading...' : profile.drivingLicenseUrl ? 'Re-upload' : 'Upload'}
                </Button>
                <input
                  type="file"
                  ref={drivingLicenseRef}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleDocumentUpload('drivingLicenseUrl', file)
                    if (drivingLicenseRef.current) drivingLicenseRef.current.value = ''
                  }}
                />
              </div>
            </div>
            {profile.drivingLicenseUrl && profile.drivingLicenseUrl.startsWith('data:image') && (
              <div className="mt-2 ml-6">
                <div className="w-20 h-14 rounded border border-gray-200 overflow-hidden bg-gray-50">
                  <img
                    src={profile.drivingLicenseUrl}
                    alt="Driving license document"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document Preview Modal */}
      {previewDoc && profile && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
              onClick={() => setPreviewDoc(null)}
            >
              Close ✕
            </Button>
            {profile[previewDoc]?.startsWith('data:image') ? (
              <img
                src={profile[previewDoc]!}
                alt={previewDoc === 'rightToWorkUrl' ? 'Right to Work' : 'Driving License'}
                className="max-w-full max-h-[80vh] rounded-lg"
              />
            ) : (
              <div className="bg-white rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  {previewDoc === 'rightToWorkUrl' ? 'Right to Work' : 'Driving License'} document uploaded
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save notification */}
      {saved && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#16a34a] text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 z-50">
          <Save className="h-4 w-4" />
          Profile saved!
        </div>
      )}
    </div>
  )
}
