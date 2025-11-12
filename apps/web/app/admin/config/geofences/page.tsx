'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Plus, Trash2, Edit, Save, X } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GeofenceConfig {
  geofenceId: string;
  name: string;
  description?: string;
  polygon: {
    coordinates: Array<[number, number]>;
  };
  region: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function GeofencesPage() {
  const [geofences, setGeofences] = useState<GeofenceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<GeofenceConfig | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    region: '',
    active: true,
  });
  const [drawingMode, setDrawingMode] = useState(false);
  const [coordinates, setCoordinates] = useState<Array<[number, number]>>([]);
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGeofences();
  }, []);

  const fetchGeofences = async () => {
    try {
      const response = await fetch('/api/config/geofences');
      const data = await response.json();
      
      if (data.config?.geofences) {
        setGeofences(data.config.geofences);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load geofences',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGeofence = () => {
    setEditingGeofence(null);
    setFormData({
      name: '',
      description: '',
      region: '',
      active: true,
    });
    setCoordinates([]);
    setShowDialog(true);
  };

  const handleSaveGeofence = async () => {
    if (!formData.name || !formData.region) {
      toast({
        title: 'Validation Error',
        description: 'Name and region are required',
        variant: 'destructive',
      });
      return;
    }

    if (coordinates.length < 4) {
      toast({
        title: 'Validation Error',
        description: 'Geofence must have at least 3 points (polygon must be closed)',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/config/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          region: formData.region,
          active: formData.active,
          polygon: {
            coordinates,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save geofence');
      }

      toast({
        title: 'Success',
        description: 'Geofence created successfully',
      });

      setShowDialog(false);
      fetchGeofences();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save geofence',
        variant: 'destructive',
      });
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingMode) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert pixel coordinates to lat/lon (simplified - in production use proper map library)
    const lon = ((x / rect.width) * 360) - 180;
    const lat = 90 - ((y / rect.height) * 180);

    setCoordinates([...coordinates, [lon, lat]]);
  };

  const handleClosePolygon = () => {
    if (coordinates.length >= 3) {
      // Close the polygon by adding the first point at the end
      setCoordinates([...coordinates, coordinates[0]]);
      setDrawingMode(false);
    }
  };

  const handleClearDrawing = () => {
    setCoordinates([]);
    setDrawingMode(false);
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
            <h1 className="text-3xl font-bold">Geofence Management</h1>
            <p className="text-muted-foreground mt-1">
              Define service coverage areas and regions
            </p>
          </div>
        </div>
        <Button onClick={handleCreateGeofence}>
          <Plus className="h-4 w-4 mr-2" />
          Create Geofence
        </Button>
      </div>

      {/* Geofences List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {geofences.map((geofence) => (
          <Card key={geofence.geofenceId}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{geofence.name}</CardTitle>
                  <CardDescription>{geofence.region}</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {geofence.description && (
                  <p className="text-muted-foreground">{geofence.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={geofence.active ? 'text-green-600' : 'text-gray-500'}>
                    {geofence.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Points:</span>
                  <span>{geofence.polygon.coordinates.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {geofences.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No geofences defined yet</p>
              <Button onClick={handleCreateGeofence}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Geofence
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingGeofence ? 'Edit Geofence' : 'Create New Geofence'}
            </DialogTitle>
            <DialogDescription>
              Draw a polygon on the map to define the service coverage area
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Downtown Service Area"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Region *</Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="e.g., Northeast"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="active">Active</Label>
              </div>

              <div className="space-y-2">
                <Label>Coordinates ({coordinates.length} points)</Label>
                <div className="flex gap-2">
                  <Button
                    variant={drawingMode ? 'default' : 'outline'}
                    onClick={() => setDrawingMode(!drawingMode)}
                    className="flex-1"
                  >
                    {drawingMode ? 'Drawing...' : 'Start Drawing'}
                  </Button>
                  {coordinates.length >= 3 && !coordinates[0].every((v, i) => v === coordinates[coordinates.length - 1][i]) && (
                    <Button onClick={handleClosePolygon} variant="outline">
                      Close Polygon
                    </Button>
                  )}
                  {coordinates.length > 0 && (
                    <Button onClick={handleClearDrawing} variant="outline" size="icon">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Click on the map to add points. Need at least 3 points to form a polygon.
                </p>
              </div>
            </div>

            {/* Map */}
            <div className="space-y-2">
              <Label>Map</Label>
              <div
                ref={mapRef}
                onClick={handleMapClick}
                className="w-full h-96 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 relative cursor-crosshair"
              >
                {/* Simplified map visualization - in production, use MapLibre GL JS */}
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  {drawingMode ? 'Click to add points' : 'Click "Start Drawing" to begin'}
                </div>
                
                {/* Draw points */}
                {coordinates.map((coord, index) => (
                  <div
                    key={index}
                    className="absolute w-3 h-3 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${((coord[0] + 180) / 360) * 100}%`,
                      top: `${((90 - coord[1]) / 180) * 100}%`,
                    }}
                  />
                ))}

                {/* Draw lines between points */}
                {coordinates.length > 1 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {coordinates.slice(0, -1).map((coord, index) => {
                      const nextCoord = coordinates[index + 1];
                      return (
                        <line
                          key={index}
                          x1={`${((coord[0] + 180) / 360) * 100}%`}
                          y1={`${((90 - coord[1]) / 180) * 100}%`}
                          x2={`${((nextCoord[0] + 180) / 360) * 100}%`}
                          y2={`${((90 - nextCoord[1]) / 180) * 100}%`}
                          stroke="blue"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGeofence}>
              <Save className="h-4 w-4 mr-2" />
              Save Geofence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
