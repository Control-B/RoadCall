'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface MatchingConfig {
  weights: {
    distance: number;
    capability: number;
    availability: number;
    acceptanceRate: number;
    rating: number;
  };
  defaultRadius: number;
  maxRadius: number;
  radiusExpansionFactor: number;
  maxExpansionAttempts: number;
  offerTimeoutSeconds: number;
  maxOffersPerIncident: number;
}

const DEFAULT_CONFIG: MatchingConfig = {
  weights: {
    distance: 0.30,
    capability: 0.25,
    availability: 0.20,
    acceptanceRate: 0.15,
    rating: 0.10,
  },
  defaultRadius: 50,
  maxRadius: 200,
  radiusExpansionFactor: 0.25,
  maxExpansionAttempts: 3,
  offerTimeoutSeconds: 120,
  maxOffersPerIncident: 3,
};

export default function MatchingConfigPage() {
  const [config, setConfig] = useState<MatchingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config/matching');
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
    // Validate weights sum to 1
    const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      toast({
        title: 'Validation Error',
        description: `Weights must sum to 1.0 (current sum: ${sum.toFixed(3)})`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/config/matching', {
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
        description: 'Configuration saved successfully',
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

  const updateWeight = (key: keyof MatchingConfig['weights'], value: number) => {
    setConfig({
      ...config,
      weights: {
        ...config.weights,
        [key]: value,
      },
    });
  };

  const weightsSum = Object.values(config.weights).reduce((a, b) => a + b, 0);

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
            <h1 className="text-3xl font-bold">Matching Algorithm Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Version {version} • Configure vendor matching weights and parameters
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
        {/* Matching Weights */}
        <Card>
          <CardHeader>
            <CardTitle>Matching Weights</CardTitle>
            <CardDescription>
              Adjust the importance of each factor in vendor matching
              <br />
              <span className={weightsSum === 1 ? 'text-green-600' : 'text-red-600'}>
                Current sum: {weightsSum.toFixed(3)} {weightsSum === 1 ? '✓' : '(must equal 1.0)'}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Distance Weight */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Distance ({(config.weights.distance * 100).toFixed(0)}%)</Label>
                <span className="text-sm text-muted-foreground">{config.weights.distance.toFixed(2)}</span>
              </div>
              <Slider
                value={[config.weights.distance * 100]}
                onValueChange={([value]) => updateWeight('distance', value / 100)}
                max={100}
                step={1}
              />
            </div>

            {/* Capability Weight */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Capability Match ({(config.weights.capability * 100).toFixed(0)}%)</Label>
                <span className="text-sm text-muted-foreground">{config.weights.capability.toFixed(2)}</span>
              </div>
              <Slider
                value={[config.weights.capability * 100]}
                onValueChange={([value]) => updateWeight('capability', value / 100)}
                max={100}
                step={1}
              />
            </div>

            {/* Availability Weight */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Availability ({(config.weights.availability * 100).toFixed(0)}%)</Label>
                <span className="text-sm text-muted-foreground">{config.weights.availability.toFixed(2)}</span>
              </div>
              <Slider
                value={[config.weights.availability * 100]}
                onValueChange={([value]) => updateWeight('availability', value / 100)}
                max={100}
                step={1}
              />
            </div>

            {/* Acceptance Rate Weight */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Acceptance Rate ({(config.weights.acceptanceRate * 100).toFixed(0)}%)</Label>
                <span className="text-sm text-muted-foreground">{config.weights.acceptanceRate.toFixed(2)}</span>
              </div>
              <Slider
                value={[config.weights.acceptanceRate * 100]}
                onValueChange={([value]) => updateWeight('acceptanceRate', value / 100)}
                max={100}
                step={1}
              />
            </div>

            {/* Rating Weight */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Rating ({(config.weights.rating * 100).toFixed(0)}%)</Label>
                <span className="text-sm text-muted-foreground">{config.weights.rating.toFixed(2)}</span>
              </div>
              <Slider
                value={[config.weights.rating * 100]}
                onValueChange={([value]) => updateWeight('rating', value / 100)}
                max={100}
                step={1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Radius Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Radius Settings</CardTitle>
            <CardDescription>
              Configure search radius and expansion behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defaultRadius">Default Radius (miles)</Label>
              <Input
                id="defaultRadius"
                type="number"
                value={config.defaultRadius}
                onChange={(e) => setConfig({ ...config, defaultRadius: Number(e.target.value) })}
                min={1}
                max={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRadius">Maximum Radius (miles)</Label>
              <Input
                id="maxRadius"
                type="number"
                value={config.maxRadius}
                onChange={(e) => setConfig({ ...config, maxRadius: Number(e.target.value) })}
                min={1}
                max={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="radiusExpansionFactor">Radius Expansion Factor</Label>
              <Input
                id="radiusExpansionFactor"
                type="number"
                step="0.05"
                value={config.radiusExpansionFactor}
                onChange={(e) => setConfig({ ...config, radiusExpansionFactor: Number(e.target.value) })}
                min={0.1}
                max={0.9}
              />
              <p className="text-xs text-muted-foreground">
                Percentage to expand radius on each attempt (e.g., 0.25 = 25% expansion)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxExpansionAttempts">Max Expansion Attempts</Label>
              <Input
                id="maxExpansionAttempts"
                type="number"
                value={config.maxExpansionAttempts}
                onChange={(e) => setConfig({ ...config, maxExpansionAttempts: Number(e.target.value) })}
                min={1}
                max={10}
              />
            </div>
          </CardContent>
        </Card>

        {/* Offer Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Offer Settings</CardTitle>
            <CardDescription>
              Configure offer timeout and distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="offerTimeoutSeconds">Offer Timeout (seconds)</Label>
              <Input
                id="offerTimeoutSeconds"
                type="number"
                value={config.offerTimeoutSeconds}
                onChange={(e) => setConfig({ ...config, offerTimeoutSeconds: Number(e.target.value) })}
                min={30}
                max={600}
              />
              <p className="text-xs text-muted-foreground">
                Time vendors have to accept an offer before it expires
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxOffersPerIncident">Max Offers Per Incident</Label>
              <Input
                id="maxOffersPerIncident"
                type="number"
                value={config.maxOffersPerIncident}
                onChange={(e) => setConfig({ ...config, maxOffersPerIncident: Number(e.target.value) })}
                min={1}
                max={10}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of vendors to send offers to simultaneously
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
