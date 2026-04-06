/**
 * Feature Flags Admin Component
 * 
 * Allows administrators to view and manage feature flags
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Alert, AlertDescription } from '../ui/alert';
import type { FeatureFlag } from '../../../../shared/featureFlags';

interface FeatureFlagsAdminProps {
  onUpdate?: () => void;
}

export function FeatureFlagsAdmin({ onUpdate }: FeatureFlagsAdminProps) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/feature-flags');
      if (!response.ok) {
        throw new Error('Failed to fetch feature flags');
      }
      const data = await response.json();
      setFlags(data.flags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  const updateFlag = async (flagName: string, updates: { enabled?: boolean; rolloutPercentage?: number }) => {
    try {
      setUpdating(flagName);
      setError(null);

      const response = await fetch(`/api/feature-flags/${flagName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update feature flag');
      }

      await fetchFlags();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feature flag');
    } finally {
      setUpdating(null);
    }
  };

  const toggleFlag = async (flagName: string, enabled: boolean) => {
    await updateFlag(flagName, { enabled });
  };

  const updateRollout = async (flagName: string, percentage: number) => {
    await updateFlag(flagName, { rolloutPercentage: percentage });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>Loading feature flags...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>
            Manage feature flags for rollback capability. Disable features to roll back changes without redeployment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {flags.map((flag) => (
              <div key={flag.name} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor={`flag-${flag.name}`} className="text-base font-semibold">
                      {flag.name}
                    </Label>
                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                  </div>
                  <Switch
                    id={`flag-${flag.name}`}
                    checked={flag.enabled}
                    onCheckedChange={(checked) => toggleFlag(flag.name, checked)}
                    disabled={updating === flag.name}
                  />
                </div>

                {flag.enabled && flag.rolloutPercentage !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`rollout-${flag.name}`} className="text-sm">
                        Rollout Percentage
                      </Label>
                      <span className="text-sm font-medium">{flag.rolloutPercentage}%</span>
                    </div>
                    <Slider
                      id={`rollout-${flag.name}`}
                      value={[flag.rolloutPercentage]}
                      onValueChange={([value]) => updateRollout(flag.name, value)}
                      max={100}
                      step={5}
                      disabled={updating === flag.name}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Gradually roll out this feature to a percentage of users
                    </p>
                  </div>
                )}

                {updating === flag.name && (
                  <p className="text-sm text-muted-foreground">Updating...</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t">
            <Button onClick={fetchFlags} variant="outline" size="sm">
              Refresh Flags
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rollback Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Quick Rollback</h4>
            <p className="text-sm text-muted-foreground mb-2">
              To quickly disable a feature that's causing issues:
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Toggle the feature flag off using the switch above</li>
              <li>The change takes effect immediately for new requests</li>
              <li>Users may need to refresh their browser to see changes</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Gradual Rollout</h4>
            <p className="text-sm text-muted-foreground mb-2">
              To gradually roll out a feature:
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Set the rollout percentage to a low value (e.g., 10%)</li>
              <li>Monitor metrics and error rates</li>
              <li>Gradually increase the percentage if everything looks good</li>
              <li>Roll back by setting to 0% if issues are detected</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Environment Variables</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Feature flags can also be controlled via environment variables:
            </p>
            <code className="text-xs bg-muted p-2 rounded block">
              FEATURE_LOADINGSTATES=false<br />
              FEATURE_ANALYTICSTRACKING=false<br />
              FEATURE_BACKGROUNDJOBS=false
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
