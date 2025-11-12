'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Save, RotateCcw, DollarSign } from 'lucide-react';
import Link from 'next/link';

interface PricingConfig {
  baseRates: {
    tire: number;
    engine: number;
    tow: number;
  };
  perMileRate: number;
  currency: string;
}

const DEFAULT_CONFIG: PricingConfig = {
  baseRates: {
    tire: 150,
    engine: 200,
    tow: 250,
  },
  perMileRate: 3.5,
  currency: 'USD',
};

export default function PricingConfigPage() {
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config/pricing');
      const data = await response.json();
      
      if (data.config) {
        setConfig(data.config);
        setVersion(data.version);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (config.baseRates.tire <= 0 || config.baseRates.engine <= 0 || config.baseRates.tow <= 0) {
      toast({
        title: 'Validation Error',
        description: 'All base rates must be positive numbers',
        variant: 'destructive',
      });
      return;
    }

    if (config.perMileRate <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Per mile rate must be a positive number',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/config/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          reason: 'Updated via admin UI',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save configuration');
      }

      const data = await response.json();
      setVersion(data.version);

      toast({
        title: 'Success',
        description: 'Pricing configuration saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
  };

  const updateBaseRate = (service: keyof PricingConfig['baseRates'], value: number) => {
    setConfig({
      ...config,
      baseRates: {
        ...config.baseRates,
        [service]: value,
      },
    });
  };

  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/config">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Pricing Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Version {version} • Configure base rates and pricing structure
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Base Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Base Service Rates</CardTitle>
            <CardDescription>
              Set the base price for each service type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tire Service */}
            <div className="space-y-2">
              <Label htmlFor="tire">Tire Service</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tire"
                  type="number"
                  value={config.baseRates.tire}
                  onChange={(e) => updateBaseRate('tire', Number(e.target.value))}
                  className="pl-9"
                  min={0}
                  step={5}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Base rate for tire repair and replacement services
              </p>
            </div>

            {/* Engine Service */}
            <div className="space-y-2">
              <Label htmlFor="engine">Engine Service</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="engine"
                  type="number"
                  value={config.baseRates.engine}
                  onChange={(e) => updateBaseRate('engine', Number(e.target.value))}
                  className="pl-9"
                  min={0}
                  step={5}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Base rate for engine diagnostics and repair services
              </p>
            </div>

            {/* Tow Service */}
            <div className="space-y-2">
              <Label htmlFor="tow">Towing Service</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tow"
                  type="number"
                  value={config.baseRates.tow}
                  onChange={(e) => updateBaseRate('tow', Number(e.target.value))}
                  className="pl-9"
                  min={0}
                  step={5}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Base rate for towing services
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Rates</CardTitle>
            <CardDescription>
              Configure distance-based and other pricing factors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Per Mile Rate */}
            <div className="space-y-2">
              <Label htmlFor="perMileRate">Per Mile Rate</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="perMileRate"
                  type="number"
                  step="0.25"
                  value={config.perMileRate}
                  onChange={(e) => setConfig({ ...config, perMileRate: Number(e.target.value) })}
                  className="pl-9"
                  min={0}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Additional charge per mile traveled by vendor
              </p>
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={config.currency}
                onChange={(e) => setConfig({ ...config, currency: e.target.value.toUpperCase() })}
                placeholder="USD"
                maxLength={3}
              />
              <p className="text-xs text-muted-foreground">
                ISO 4217 currency code (e.g., USD, EUR, GBP)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Examples */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pricing Examples</CardTitle>
            <CardDescription>
              See how pricing is calculated with current configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tire Example */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Tire Service (10 miles)</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Rate:</span>
                    <span>${config.baseRates.tire.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance (10 mi):</span>
                    <span>${(config.perMileRate * 10).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Total:</span>
                    <span>${(config.baseRates.tire + config.perMileRate * 10).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Engine Example */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Engine Service (25 miles)</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Rate:</span>
                    <span>${config.baseRates.engine.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance (25 mi):</span>
                    <span>${(config.perMileRate * 25).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Total:</span>
                    <span>${(config.baseRates.engine + config.perMileRate * 25).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Tow Example */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Towing Service (50 miles)</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Rate:</span>
                    <span>${config.baseRates.tow.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance (50 mi):</span>
                    <span>${(config.perMileRate * 50).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Total:</span>
                    <span>${(config.baseRates.tow + config.perMileRate * 50).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Final pricing may be adjusted based on SLA tier multipliers, 
                vendor-specific rates, and other factors. These examples show base calculations only.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
