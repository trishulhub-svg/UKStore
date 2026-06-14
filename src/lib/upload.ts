/**
 * Upload Utility — Base64 encoding for file storage
 *
 * Temporary solution: stores files as base64 data URLs directly in the database.
 * Production would use cloud storage (S3, R2, etc.)
 */

/**
 * Convert a File object to a base64 data URL string
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Validate a file for image upload
 * Returns error message or null if valid
 */
export function validateImageFile(file: File, maxSizeMb: number = 2): string | null {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return 'Only JPG, PNG, and WebP images are allowed'
  }
  const maxSize = maxSizeMb * 1024 * 1024
  if (file.size > maxSize) {
    return `Image must be less than ${maxSizeMb}MB`
  }
  return null
}

/**
 * Validate a file for document upload
 * Returns error message or null if valid
 */
export function validateDocumentFile(file: File, maxSizeMb: number = 5): string | null {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return 'Only JPG, PNG, WebP images and PDF files are allowed'
  }
  const maxSize = maxSizeMb * 1024 * 1024
  if (file.size > maxSize) {
    return `Document must be less than ${maxSizeMb}MB`
  }
  return null
}

/**
 * Check if a string is a base64 data URL
 */
export function isDataUrl(str: string): boolean {
  return str.startsWith('data:')
}

/**
 * Get file type from data URL
 */
export function getDataUrlMimeType(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;]+);/)
  return match ? match[1] : null
}
