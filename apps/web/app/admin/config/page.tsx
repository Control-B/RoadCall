'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Map, Clock, DollarSign } from 'lucide-react';

export default function ConfigPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">System Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Manage system-wide settings and rules
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Matching Configuration */}
        <Link href="/admin/config/matching">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Settings className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Matching Algorithm</CardTitle>
                  <CardDescription>
                    Configure vendor matching weights and parameters
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Adjust distance, capability, availability, acceptance rate, and rating weights
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* SLA Tiers */}
        <Link href="/admin/config/sla-tiers">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>SLA Tiers</CardTitle>
                  <CardDescription>
                    Define service level agreements and response times
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure Standard, Priority, and Emergency service tiers
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Geofences */}
        <Link href="/admin/config/geofences">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Map className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Geofences</CardTitle>
                  <CardDescription>
                    Manage service coverage areas and regions
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Draw and manage geofence polygons on an interactive map
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Pricing */}
        <Link href="/admin/config/pricing">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Pricing</CardTitle>
                  <CardDescription>
                    Configure base rates and pricing multipliers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Set base rates for tire, engine, and tow services
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
