'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface SLATier {
  name: string;
  responseTimeMinutes: number;
  arrivalTimeMinutes: number;
  pricingMultiplier: number;
  priority: number;
}

interface SLAConfig {
  tiers: SLATier[];
  defaultTier: string;
}

const DEFAULT_CONFIG: SLAConfig = {
  tiers: [
    {
      name: 'Standard',
      responseTimeMinutes: 15,
      arrivalTimeMinutes: 60,
      pricingMultiplier: 1.0,
      priority: 1,
    },
    {
      name: 'Priority',
      responseTimeMinutes: 10,
      arrivalTimeMinutes: 45,
      pricingMultiplier: 1.25,
      priority: 2,
    },
    {
      name: 'Emergency',
      responseTimeMinutes: 5,
      arrivalTimeMinutes: 30,
      pricingMultiplier: 1.5,
      priority: 3,
    },
  ],
  defaultTier: 'Standard',
};

export default function SLATiersPage() {
  const [config, setConfig] = useState<SLAConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config/sla-tiers');
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
    if (config.tiers.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one SLA tier is required',
        variant: 'destructive',
      });
      return;
    }

    if (!config.tiers.some(t => t.name === config.defaultTier)) {
      toast({
        title: 'Validation Error',
        description: 'Default tier must exist in tiers list',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/config/sla-tiers', {
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
        description: 'SLA configuration saved successfully',
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

  const handleAddTier = () => {
    const newTier: SLATier = {
      name: `Tier ${config.tiers.length + 1}`,
      responseTimeMinutes: 10,
      arrivalTimeMinutes: 45,
      pricingMultiplier: 1.0,
      priority: config.tiers.length + 1,
    };
    setConfig({
      ...config,
      tiers: [...config.tiers, newTier],
    });
  };

  const handleRemoveTier = (index: number) => {
    const newTiers = config.tiers.filter((_, i) => i !== index);
    setConfig({
      ...config,
      tiers: newTiers,
    });
  };

  const handleUpdateTier = (index: number, field: keyof SLATier, value: string | number) => {
    const newTiers = [...config.tiers];
    newTiers[index] = {
      ...newTiers[index],
      [field]: value,
    };
    setConfig({
      ...config,
      tiers: newTiers,
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
            <h1 className="text-3xl font-bold">SLA Tiers Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Version {version} • Define service level agreements and response times
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

      <div className="space-y-6">
        {/* Default Tier Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Default Tier</CardTitle>
            <CardDescription>
              Select the default SLA tier for new incidents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="defaultTier">Default Tier</Label>
              <select
                id="defaultTier"
                value={config.defaultTier}
                onChange={(e) => setConfig({ ...config, defaultTier: e.target.value })}
                className="w-full p-2 border rounded-md"
              >
                {config.tiers.map((tier) => (
                  <option key={tier.name} value={tier.name}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* SLA Tiers */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Service Tiers</h2>
          <Button onClick={handleAddTier} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Tier
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {config.tiers.map((tier, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tier {index + 1}</CardTitle>
                  {config.tiers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveTier(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${index}`}>Name</Label>
                    <Input
                      id={`name-${index}`}
                      value={tier.name}
                      onChange={(e) => handleUpdateTier(index, 'name', e.target.value)}
                      placeholder="e.g., Standard"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`response-${index}`}>Response Time (min)</Label>
                    <Input
                      id={`response-${index}`}
                      type="number"
                      value={tier.responseTimeMinutes}
                      onChange={(e) => handleUpdateTier(index, 'responseTimeMinutes', Number(e.target.value))}
                      min={1}
                      max={120}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`arrival-${index}`}>Arrival Time (min)</Label>
                    <Input
                      id={`arrival-${index}`}
                      type="number"
                      value={tier.arrivalTimeMinutes}
                      onChange={(e) => handleUpdateTier(index, 'arrivalTimeMinutes', Number(e.target.value))}
                      min={1}
                      max={240}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`multiplier-${index}`}>Pricing Multiplier</Label>
                    <Input
                      id={`multiplier-${index}`}
                      type="number"
                      step="0.05"
                      value={tier.pricingMultiplier}
                      onChange={(e) => handleUpdateTier(index, 'pricingMultiplier', Number(e.target.value))}
                      min={0.1}
                      max={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`priority-${index}`}>Priority</Label>
                    <Input
                      id={`priority-${index}`}
                      type="number"
                      value={tier.priority}
                      onChange={(e) => handleUpdateTier(index, 'priority', Number(e.target.value))}
                      min={1}
                      max={10}
                    />
                  </div>
                </div>

                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Response:</span>
                      <span className="ml-2 font-medium">{tier.responseTimeMinutes} min</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Arrival:</span>
                      <span className="ml-2 font-medium">{tier.arrivalTimeMinutes} min</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price:</span>
                      <span className="ml-2 font-medium">{tier.pricingMultiplier}x</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Priority:</span>
                      <span className="ml-2 font-medium">{tier.priority}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
