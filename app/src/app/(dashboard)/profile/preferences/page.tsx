"use client"

import { FontSizeSettings } from '@/components/settings/FontSizeSettings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Preferences</h1>
        <p className="text-muted-foreground mt-2">
          Customize your application preferences and display settings
        </p>
      </div>

      <div className="space-y-6">
        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Display</CardTitle>
            <CardDescription>
              Customize how the application looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FontSizeSettings />
          </CardContent>
        </Card>

        {/* Future settings sections can be added here */}
        {/* Example:
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Manage your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationSettings />
          </CardContent>
        </Card>
        */}
      </div>
    </div>
  )
}
