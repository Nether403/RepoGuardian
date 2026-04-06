import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  User, Settings, Bookmark, Tag, Brain, 
  Edit, Calendar, Sparkles, Lock, Crown, Camera, Key
} from "lucide-react";
import { Link } from "wouter";
import { BookmarksTab } from "@/components/profile/bookmarks-tab";
import { TagsTab } from "@/components/profile/tags-tab";
import { PreferencesTab } from "@/components/profile/preferences-tab";
import { RecommendationsTab } from "@/components/profile/recommendations-tab";
import { UpgradePrompt } from "@/components/upgrade-prompt";

export default function Profile() {
  const { user, isLoading: authLoading, refetchUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  
  // Basic profile editing states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl || "");
  const [githubToken, setGithubToken] = useState((user as any)?.githubToken || "");
  
  // Password change states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Check if user has Pro or Enterprise subscription
  const isPremium = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'enterprise';
  
  // Update local state when user data changes
  useEffect(() => {
    if (user) {
      console.log('[Profile] User data received:', user);
      console.log('[Profile] GitHub token from user:', (user as any).githubToken);
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setBio((user as any).bio || "");
      setProfileImageUrl(user.profileImageUrl || "");
      setGithubToken((user as any).githubToken || "");
    }
  }, [user]);


  
  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; bio: string; profileImageUrl: string; githubToken?: string }) => {
      console.log('[Profile] Sending update:', data);
      const response = await apiRequest('PUT', '/api/user/profile', data);
      const result = await response.json();
      console.log('[Profile] Update response:', result);
      return result;
    },
    onSuccess: async (updatedUser) => {
      console.log('[Profile] Update successful, refetching user...');
      // Refetch user data from the auth context
      await refetchUser();
      
      // Invalidate any other queries that might cache user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      setIsEditingProfile(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('[Profile] Update error:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });
  
  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest('POST', '/api/user/change-password', data);
    },
    onSuccess: () => {
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password Changed",
        description: "Your password has been changed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });
  
  const handleProfileUpdate = () => {
    updateProfileMutation.mutate({
      firstName,
      lastName,
      bio,
      profileImageUrl,
      githubToken: githubToken || undefined,
    });
  };
  
  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirmation do not match",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }
    
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to view your profile.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/handler/sign-in";
      }, 500);
    }
  }, [user, authLoading, toast]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-32">
        <div className="max-w-7xl mx-auto">
        {/* User Header */}
        <Card className="mb-8 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                {profileImageUrl ? (
                  <img 
                    src={profileImageUrl} 
                    alt={firstName || "Profile"} 
                    className="w-20 h-20 rounded-full object-cover border-4 border-primary/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-10 h-10 text-primary" />
                  </div>
                )}
                {isEditingProfile && (
                  <div className="absolute -bottom-2 -right-2 flex gap-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="profile-image-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // For now, we'll use a simple file reader to convert to base64
                          // In production, you'd want to upload to a proper image service
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            setProfileImageUrl(result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full w-8 h-8 p-0"
                      onClick={() => document.getElementById('profile-image-upload')?.click()}
                      title="Upload from device"
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full w-8 h-8 p-0"
                      onClick={() => {
                        const url = prompt("Enter profile image URL:");
                        if (url) setProfileImageUrl(url);
                      }}
                      title="Enter URL"
                    >
                      <span className="text-xs">🔗</span>
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-bold">
                    {firstName} {lastName}
                  </h1>
                  {user?.subscriptionTier && user.subscriptionTier !== 'free' && (
                    <Badge variant="default">
                      {user.subscriptionTier === 'enterprise' ? 'Enterprise' : user.subscriptionTier === 'pro' ? 'Pro' : 'Free'}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{user?.email}</p>
                {((user as any)?.bio || bio) && !isEditingProfile && (
                  <p className="text-sm mt-2 text-muted-foreground">{(user as any)?.bio || bio}</p>
                )}
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </span>

                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant={isEditingProfile ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (isEditingProfile) {
                      handleProfileUpdate();
                    } else {
                      setIsEditingProfile(true);
                    }
                  }}
                  disabled={updateProfileMutation.isPending}
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  {isEditingProfile ? "Save Profile" : "Edit Profile"}
                </Button>
                {isEditingProfile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setFirstName(user?.firstName || "");
                      setLastName(user?.lastName || "");
                      setBio((user as any)?.bio || "");
                      setProfileImageUrl(user?.profileImageUrl || "");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            
            {isEditingProfile && (
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="githubToken" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    GitHub Personal Access Token
                  </Label>
                  <Input
                    id="githubToken"
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for Code Review features. Get one from{" "}
                    <a 
                      href="https://github.com/settings/tokens" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      GitHub Settings
                    </a>
                    {" "}(requires 'repo' scope)
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Status Card */}
        <Card className="mb-6 border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Subscription Details
              </span>
              <Link href="/pricing">
                <Button variant="outline" size="sm">
                  Manage Subscription
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-lg font-semibold capitalize">
                  {user?.subscriptionTier || 'Free'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-lg font-semibold">
                  {user?.subscriptionStatus === 'active' ? (
                    <span className="text-green-500">Active</span>
                  ) : user?.subscriptionStatus === 'past_due' ? (
                    <span className="text-orange-500">Past Due</span>
                  ) : user?.subscriptionStatus === 'cancelled' ? (
                    <span className="text-red-500">Cancelled</span>
                  ) : (
                    <span className="text-gray-500">Active</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Daily Analyses</p>
                <p className="text-lg font-semibold">
                  {user?.subscriptionTier === 'enterprise' ? 'Unlimited' : user?.subscriptionTier === 'pro' ? '50 per day' : 'Unlimited'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">API Access</p>
                <p className="text-lg font-semibold">
                  {user?.subscriptionTier === 'enterprise' ? '10K/hour' : '1K/hour'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue={isPremium ? "recommendations" : "settings"} className="space-y-6">
          <ScrollArea className="w-full whitespace-nowrap pb-2">
            <TabsList className={`inline-flex w-auto ${isPremium ? 'grid-cols-5' : 'grid-cols-2'} min-w-max`}>
              {isPremium ? (
                <>
                  <TabsTrigger value="recommendations" className="gap-2 min-w-[44px] min-h-[44px] px-4">
                    <Brain className="w-4 h-4" />
                    <span className="hidden sm:inline">AI Recommendations</span>
                    <span className="sm:hidden">Recommendations</span>
                  </TabsTrigger>
                  <TabsTrigger value="bookmarks" className="gap-2 min-w-[44px] min-h-[44px] px-4">
                    <Bookmark className="w-4 h-4" />
                    <span className="hidden xs:inline">Bookmarks</span>
                  </TabsTrigger>
                  <TabsTrigger value="tags" className="gap-2 min-w-[44px] min-h-[44px] px-4">
                    <Tag className="w-4 h-4" />
                    <span className="hidden xs:inline">Tags</span>
                  </TabsTrigger>
                  <TabsTrigger value="preferences" className="gap-2 min-w-[44px] min-h-[44px] px-4">
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">AI Preferences</span>
                    <span className="hidden xs:inline sm:hidden">Preferences</span>
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="gap-2 min-w-[44px] min-h-[44px] px-4">
                    <Settings className="w-4 h-4" />
                    <span className="hidden xs:inline">Settings</span>
                  </TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="settings" className="gap-2 min-w-[44px] min-h-[44px] px-4">
                    <User className="w-4 h-4" />
                    My Profile
                  </TabsTrigger>
                  <TabsTrigger value="intelligent" className="gap-2 min-w-[44px] min-h-[44px] px-4">
                    <Brain className="w-4 h-4" />
                    Intelligent Profile
                    <Lock className="w-3 h-3 ml-1" />
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </ScrollArea>
          
          {/* Settings Tab (Basic Profile) */}
          <TabsContent value="settings">
            <div className="grid gap-6">
              {/* Account Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>
                    Manage your account details and email address
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Email Address</Label>
                    <Input value={user?.email || ""} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Contact support to change your email address
                    </p>
                  </div>
                  <div>
                    <Label>Account ID</Label>
                    <Input value={user?.id || ""} disabled className="bg-muted font-mono text-xs" />
                  </div>
                </CardContent>
              </Card>
              
              {/* Password Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Password & Security
                  </CardTitle>
                  <CardDescription>
                    Change your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={isChangingPassword} onOpenChange={setIsChangingPassword}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Key className="w-4 h-4" />
                        Change Password
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                          Enter your current password and choose a new one
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="currentPassword">Current Password</Label>
                          <Input
                            id="currentPassword"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                          />
                        </div>
                        <div>
                          <Label htmlFor="newPassword">New Password</Label>
                          <Input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 8 characters)"
                          />
                        </div>
                        <div>
                          <Label htmlFor="confirmPassword">Confirm New Password</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsChangingPassword(false);
                            setCurrentPassword("");
                            setNewPassword("");
                            setConfirmPassword("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handlePasswordChange}
                          disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                        >
                          {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Intelligent Profile Tab (Premium Upsell for Free Users) */}
          {!isPremium && (
            <TabsContent value="intelligent">
              <UpgradePrompt />
            </TabsContent>
          )}

          {/* AI Recommendations Tab */}
          <TabsContent value="recommendations">
            <RecommendationsTab />
          </TabsContent>

          {/* Bookmarks Tab */}
          <TabsContent value="bookmarks">
            <BookmarksTab />
          </TabsContent>
          
          {/* Tags Tab */}
          <TabsContent value="tags">
            <TagsTab />
          </TabsContent>
          
          {/* AI Preferences Tab */}
          <TabsContent value="preferences">
            <PreferencesTab />
          </TabsContent>


        </Tabs>
        </div>
      </div>
    </div>
  );
}