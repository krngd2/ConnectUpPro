"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Bell, Save, CheckCircle, ArrowLeft } from "lucide-react";
import {
  getUserData,
  updatePreferences,
  type UserPreferences,
} from "@/app/actions/user.actions";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [userProfile, setUserProfile] = useState<Awaited<
    ReturnType<typeof getUserData>
  > | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    emailUpdates: false,
    notifyAnalysisComplete: false,
    weeklySummary: false,
  });
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesChanged, setPreferencesChanged] = useState(false);

  // Load user profile and preferences on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const profile = await getUserData();
        setUserProfile(profile);

        const prefs = await getUserData();
        if (prefs?.preferences) {
          setPreferences(prefs.preferences as unknown as UserPreferences);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();
  }, []);

  const handlePreferenceChange = (key: keyof UserPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setPreferencesChanged(true);
  };

  const handleSavePreferences = async () => {
    setPreferencesLoading(true);
    try {
      await updatePreferences(preferences);
      setPreferencesChanged(false);
      // Show success feedback
      const successEl = document.getElementById("preferences-success");
      if (successEl) {
        successEl.style.display = "block";
        setTimeout(() => {
          successEl.style.display = "none";
        }, 3000);
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      alert("Failed to save preferences. Please try again.");
    } finally {
      setPreferencesLoading(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6 pl-4 md:pl-8">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage this local workspace and its notification preferences
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-3">
            <Card>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-none first:rounded-t-lg last:rounded-b-lg transition-colors ${
                          activeTab === tab.id
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {(() => {
                    const currentTab = tabs.find((tab) => tab.id === activeTab);
                    if (currentTab) {
                      const Icon = currentTab.icon;
                      return (
                        <>
                          <Icon className="h-5 w-5" />
                          {currentTab.label}
                        </>
                      );
                    }
                    return null;
                  })()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {activeTab === "profile" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={userProfile?.name || ""}
                          disabled
                          className="w-full px-3 py-2 border border-input bg-muted text-foreground rounded-md cursor-not-allowed"
                          placeholder="Local workspace name"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          This is the workspace name used by this installation.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={userProfile?.email || ""}
                          disabled
                          className="w-full px-3 py-2 border border-input bg-muted text-foreground rounded-md cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          This is the local workspace identifier; no login is required.
                        </p>
                      </div>
                    </div>
                    <div className="pt-4">
                      <p className="text-sm text-muted-foreground">
                        Member since{" "}
                        {userProfile?.createdAt
                          ? new Date(userProfile.createdAt).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "notifications" && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Control how you receive notifications.
                    </p>

                    {/* Success Message */}
                    <div
                      id="preferences-success"
                      style={{ display: "none" }}
                      className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3"
                    >
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <p className="text-green-700 dark:text-green-200 text-sm">
                        Preferences saved successfully!
                      </p>
                    </div>

                    <div className="space-y-3 border rounded-lg p-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.emailUpdates}
                          onChange={() =>
                            handlePreferenceChange("emailUpdates")
                          }
                          className="rounded w-4 h-4"
                        />
                        <span className="font-medium">
                          Email updates about new features
                        </span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.notifyAnalysisComplete}
                          onChange={() =>
                            handlePreferenceChange("notifyAnalysisComplete")
                          }
                          className="rounded w-4 h-4"
                        />
                        <span className="font-medium">
                          Notify when analysis is complete
                        </span>
                      </label>
                    </div>

                    {preferencesChanged && (
                      <Button
                        onClick={handleSavePreferences}
                        disabled={preferencesLoading}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {preferencesLoading ? "Saving..." : "Save Preferences"}
                      </Button>
                    )}
                  </div>
                )}

              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
