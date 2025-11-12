import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone: string): string {
  // Format E.164 to (XXX) XXX-XXXX
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const match = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/)
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`
    }
  }
  return phone
}

export function formatDistance(miles: number): string {
  if (miles < 1) {
    return `${Math.round(miles * 5280)} ft`
  }
  return `${miles.toFixed(1)} mi`
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export function getIncidentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    tire: 'Tire Issue',
    engine: 'Engine Problem',
    tow: 'Towing Needed',
  }
  return labels[type] || type
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    created: 'bg-yellow-500',
    vendor_assigned: 'bg-blue-500',
    vendor_en_route: 'bg-indigo-500',
    vendor_arrived: 'bg-purple-500',
    work_in_progress: 'bg-orange-500',
    work_completed: 'bg-green-500',
    payment_pending: 'bg-amber-500',
    closed: 'bg-gray-500',
    cancelled: 'bg-red-500',
  }
  return colors[status] || 'bg-gray-500'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    created: 'Created',
    vendor_assigned: 'Vendor Assigned',
    vendor_en_route: 'En Route',
    vendor_arrived: 'Arrived',
    work_in_progress: 'In Progress',
    work_completed: 'Completed',
    payment_pending: 'Payment Pending',
    closed: 'Closed',
    cancelled: 'Cancelled',
  }
  return labels[status] || status
}
