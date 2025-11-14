'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [role, setRole] = useState(searchParams.get('role') || 'driver');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    email: '',
    companyName: '',
    businessLicense: '',
    capabilities: [] as string[],
  });

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam) {
      setRole(roleParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // TODO: Implement registration API call
      console.log('Registering:', { ...formData, role });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Move to OTP verification
      router.push(`/auth/verify-otp?phone=${encodeURIComponent(formData.phone)}`);
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const toggleCapability = (capability: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter(c => c !== capability)
        : [...prev.capabilities, capability]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-lg p-8">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🚗</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              RoadCall
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Create Account</h1>
        <p className="text-gray-600 text-center mb-6">Join RoadCall today</p>

        {/* Role Selection */}
        <Tabs value={role} onValueChange={setRole} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="driver">Driver</TabsTrigger>
            <TabsTrigger value="vendor">Service Provider</TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">We'll send you a verification code</p>
              </div>

              <div>
                <Label htmlFor="name">{role === 'driver' ? 'Full Name' : 'Contact Name'}</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              {role === 'vendor' && (
                <>
                  <div>
                    <Label htmlFor="companyName">Business Name</Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      type="text"
                      placeholder="ABC Towing Services"
                      value={formData.companyName}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div>
                    <Label>Services Offered</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['Towing', 'Tire Change', 'Jump Start', 'Fuel Delivery', 'Lockout', 'Winch Out'].map(service => (
                        <button
                          key={service}
                          type="button"
                          onClick={() => toggleCapability(service.toLowerCase().replace(' ', '_'))}
                          className={`p-2 rounded-lg border text-sm ${
                            formData.capabilities.includes(service.toLowerCase().replace(' ', '_'))
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-purple-600'
                          }`}
                        >
                          {service}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Continue'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-purple-600 hover:underline font-semibold">
            Sign In
          </Link>
        </div>

        <div className="mt-4 text-center text-xs text-gray-500">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="underline">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline">Privacy Policy</Link>
        </div>
      </Card>
    </div>
  );
}
