import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Settings, Share2, Shield, Activity, ChevronRight, Mail, Clock, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };
  joinedAt: string;
}

export default function Teams() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
    enabled: isAuthenticated,
  });

  const { data: teamMembers, isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/teams', selectedTeam?.id, 'members'],
    enabled: !!selectedTeam,
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest('POST', '/api/teams', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setCreateDialogOpen(false);
      setNewTeamName("");
      setNewTeamDescription("");
      toast({
        title: "Team Created",
        description: "Your new team has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create team. Please try again.",
        variant: "destructive",
      });
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: async (data: { teamId: string; email: string; role: string }) => {
      return await apiRequest('POST', `/api/teams/${data.teamId}/invite`, {
        email: data.email,
        role: data.role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', selectedTeam?.id, 'members'] });
      setInviteDialogOpen(false);
      setInviteEmail("");
      toast({
        title: "Invitation Sent",
        description: "Team invitation has been sent successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { teamId: string; memberId: string; role: string }) => {
      return await apiRequest('PATCH', `/api/teams/${data.teamId}/members/${data.memberId}`, {
        role: data.role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', selectedTeam?.id, 'members'] });
      toast({
        title: "Role Updated",
        description: "Member role has been updated successfully.",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (data: { teamId: string; memberId: string }) => {
      return await apiRequest('DELETE', `/api/teams/${data.teamId}/members/${data.memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', selectedTeam?.id, 'members'] });
      toast({
        title: "Member Removed",
        description: "Team member has been removed successfully.",
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-7xl mx-auto px-6">
          <Card className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-4">Team Collaboration</h2>
            <p className="text-muted-foreground mb-6">
              Sign in to create teams and collaborate on repository analysis
            </p>
            <Button asChild>
              <a href="/api/login">Sign In</a>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (teamsLoading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-7xl mx-auto px-6">
          <SkeletonLoader />
        </div>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-500';
      case 'admin': return 'bg-blue-500';
      case 'member': return 'bg-green-500';
      case 'viewer': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 pt-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-4">
              Team Collaboration
            </h1>
            <p className="text-muted-foreground">
              Create teams and collaborate on repository analysis
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-scale">
                <UserPlus className="w-4 h-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="team-name">Team Name</Label>
                  <Input
                    id="team-name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                    className="input-focus"
                    data-testid="input-team-name"
                  />
                </div>
                <div>
                  <Label htmlFor="team-description">Description</Label>
                  <Input
                    id="team-description"
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="Enter team description"
                    className="input-focus"
                    data-testid="input-team-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createTeamMutation.mutate({ name: newTeamName, description: newTeamDescription })}
                  disabled={!newTeamName || createTeamMutation.isPending}
                  className="btn-scale"
                  data-testid="button-create-team"
                >
                  {createTeamMutation.isPending ? "Creating..." : "Create Team"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Your Teams</h2>
            {teams && teams.length > 0 ? (
              teams.map((team) => (
                <Card
                  key={team.id}
                  className={`p-4 cursor-pointer hover:shadow-lg transition-all duration-300 card-lift ${
                    selectedTeam?.id === team.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedTeam(team)}
                  data-testid={`team-card-${team.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{team.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getRoleBadgeColor(team.role)}>
                        {team.role}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <Users className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No teams yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create your first team to start collaborating
                </p>
              </Card>
            )}
          </div>

          {/* Team Details */}
          <div className="lg:col-span-2">
            {selectedTeam ? (
              <Card className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{selectedTeam.name}</h2>
                    <p className="text-muted-foreground">{selectedTeam.description}</p>
                    <div className="flex items-center mt-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 mr-1" />
                      Created {new Date(selectedTeam.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {(selectedTeam.role === 'owner' || selectedTeam.role === 'admin') && (
                      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="btn-scale">
                            <Mail className="w-4 h-4 mr-2" />
                            Invite
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invite Team Member</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label htmlFor="invite-email">Email Address</Label>
                              <Input
                                id="invite-email"
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="Enter email address"
                                className="input-focus"
                                data-testid="input-invite-email"
                              />
                            </div>
                            <div>
                              <Label htmlFor="invite-role">Role</Label>
                              <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                                <SelectTrigger data-testid="select-invite-role">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setInviteDialogOpen(false)}
                              data-testid="button-cancel-invite"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() =>
                                inviteMemberMutation.mutate({
                                  teamId: selectedTeam.id,
                                  email: inviteEmail,
                                  role: inviteRole,
                                })
                              }
                              disabled={!inviteEmail || inviteMemberMutation.isPending}
                              className="btn-scale"
                              data-testid="button-send-invite"
                            >
                              {inviteMemberMutation.isPending ? "Sending..." : "Send Invite"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    {selectedTeam.role === 'owner' && (
                      <Button variant="outline" className="btn-scale">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                    )}
                  </div>
                </div>

                <Tabs defaultValue="members" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="members">Members</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="shared">Shared Analyses</TabsTrigger>
                  </TabsList>

                  <TabsContent value="members" className="space-y-4">
                    {membersLoading ? (
                      <SkeletonLoader />
                    ) : teamMembers && teamMembers.length > 0 ? (
                      teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                          data-testid={`member-${member.id}`}
                        >
                          <div className="flex items-center space-x-3">
                            <Avatar>
                              <AvatarImage src={member.user.profileImageUrl} />
                              <AvatarFallback>
                                {member.user.firstName?.[0] || member.user.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {member.user.firstName && member.user.lastName
                                  ? `${member.user.firstName} ${member.user.lastName}`
                                  : member.user.email}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Joined {new Date(member.joinedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {member.role === 'owner' ? (
                              <Badge className={getRoleBadgeColor(member.role)}>
                                <Crown className="w-3 h-3 mr-1" />
                                {member.role}
                              </Badge>
                            ) : (
                              <>
                                {(selectedTeam.role === 'owner' || selectedTeam.role === 'admin') &&
                                  member.userId !== user?.id ? (
                                  <Select
                                    value={member.role}
                                    onValueChange={(value) =>
                                      updateRoleMutation.mutate({
                                        teamId: selectedTeam.id,
                                        memberId: member.id,
                                        role: value,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-32" data-testid={`select-role-${member.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="member">Member</SelectItem>
                                      <SelectItem value="viewer">Viewer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge className={getRoleBadgeColor(member.role)}>
                                    {member.role}
                                  </Badge>
                                )}
                                {selectedTeam.role === 'owner' && member.userId !== user?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      removeMemberMutation.mutate({
                                        teamId: selectedTeam.id,
                                        memberId: member.id,
                                      })
                                    }
                                    data-testid={`button-remove-${member.id}`}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No team members yet
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="activity" className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="w-12 h-12 mx-auto mb-4" />
                      <p>Team activity will appear here</p>
                      <p className="text-sm mt-2">
                        Track shared analyses, comments, and collaboration
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="shared" className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      <Share2 className="w-12 h-12 mx-auto mb-4" />
                      <p>No shared analyses yet</p>
                      <p className="text-sm mt-2">
                        Analyses shared with this team will appear here
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Select a Team</h3>
                <p className="text-muted-foreground">
                  Choose a team from the list to view details and manage members
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}