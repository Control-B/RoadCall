'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Settings, Shield, HelpCircle, LogOut, ChevronRight } from 'lucide-react'

export default function ProfilePage() {
  const profile = {
    name: 'James Anderson',
    email: 'james.anderson@example.com',
    phone: '+1-201-555-0100',
    joinDate: 'March 2023',
    vehicle: '2020 Honda Civic - Blue',
    licensePlate: 'NJ-45A-123',
    rating: 4.8,
    reviews: 12,
  }

  const menuItems = [
    {
      icon: User,
      label: 'Personal Information',
      description: 'Update your profile details',
      href: '#',
    },
    {
      icon: Settings,
      label: 'Preferences',
      description: 'Notification and app settings',
      href: '#',
    },
    {
      icon: Shield,
      label: 'Payment Methods',
      description: 'Manage payment information',
      href: '#',
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      description: 'Get help or contact support',
      href: '#',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="md:hidden sticky top-16 z-30 bg-black p-4 border-b border-gray-800">
        <h1 className="text-white text-2xl font-bold">Profile</h1>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block mb-6">
        <h1 className="text-3xl font-bold">My Profile</h1>
      </div>

      {/* Profile Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-0 md:max-w-2xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">{profile.name}</h2>
              <p className="text-sm text-gray-600">Member since {profile.joinDate}</p>
            </div>
            <Badge className="bg-yellow-600">
              ⭐ {profile.rating}
            </Badge>
          </div>

          {/* Contact Info */}
          <div className="space-y-3 border-t pt-4">
            <div>
              <p className="text-xs text-gray-600">Email</p>
              <p className="font-medium text-gray-900">{profile.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Phone</p>
              <p className="font-medium text-gray-900">{profile.phone}</p>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="mt-4 pt-4 border-t space-y-3">
            <p className="font-semibold text-gray-900">Registered Vehicle</p>
            <div>
              <p className="text-sm text-gray-600">{profile.vehicle}</p>
              <p className="text-sm font-medium text-gray-900">{profile.licensePlate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <div className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm md:text-base text-gray-900">{item.label}</h3>
                    <p className="text-xs md:text-sm text-gray-600">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Stats Section */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-4 md:p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Your Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-blue-600">24</p>
              <p className="text-xs text-gray-600 mt-1">Total Incidents</p>
            </div>
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-green-600">4.8</p>
              <p className="text-xs text-gray-600 mt-1">Avg Rating</p>
            </div>
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-purple-600">$1.2K</p>
              <p className="text-xs text-gray-600 mt-1">Total Spent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-orange-600">15m</p>
              <p className="text-xs text-gray-600 mt-1">Avg Response</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Security Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-blue-900 mb-2">🔒 Your Data is Secure</p>
          <p className="text-xs text-blue-800 leading-relaxed">
            RoadCall uses encryption to protect your personal and payment information. Your location is only shared with assigned service providers.
          </p>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button 
        variant="outline" 
        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>

      {/* Mobile spacing */}
      <div className="md:hidden h-20"></div>
    </div>
  )
}
