import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Share2, 
  MessageSquare, 
  Star, 
  Eye, 
  UserPlus, 
  UserMinus,
  Mail,
  Link,
  Clock,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
  lastActive: string;
}

interface SharedAnalysis {
  id: string;
  repositoryName: string;
  sharedBy: string;
  sharedAt: string;
  permissions: 'view' | 'comment' | 'edit';
  comments: Comment[];
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  isResolved: boolean;
}

interface CollaborationFeaturesProps {
  analysisId?: string;
  repositoryName?: string;
}

export default function CollaborationFeatures({ 
  analysisId, 
  repositoryName 
}: CollaborationFeaturesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('team');
  const [inviteEmail, setInviteEmail] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [newComment, setNewComment] = useState('');
  
  // Mock data - in real app, this would come from API
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'owner',
      joinedAt: '2024-01-15',
      lastActive: '2024-01-20'
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'admin',
      joinedAt: '2024-01-16',
      lastActive: '2024-01-19'
    }
  ]);

  const [sharedAnalyses, setSharedAnalyses] = useState<SharedAnalysis[]>([
    {
      id: '1',
      repositoryName: 'facebook/react',
      sharedBy: 'John Doe',
      sharedAt: '2024-01-20',
      permissions: 'comment',
      comments: [
        {
          id: '1',
          userId: '2',
          userName: 'Jane Smith',
          content: 'Great analysis! The marketability score seems accurate.',
          createdAt: '2024-01-20T10:30:00Z',
          isResolved: false
        }
      ]
    }
  ]);

  const generateShareLink = () => {
    const link = `${window.location.origin}/shared-analysis/${analysisId}?token=${Math.random().toString(36).substr(2, 9)}`;
    setShareLink(link);
    navigator.clipboard.writeText(link);
    toast({
      title: 'Share link generated',
      description: 'Link copied to clipboard',
    });
  };

  const inviteTeamMember = async () => {
    if (!inviteEmail.trim()) return;

    // Mock API call
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: 'member',
      joinedAt: new Date().toISOString().split('T')[0],
      lastActive: new Date().toISOString().split('T')[0]
    };

    setTeamMembers(prev => [...prev, newMember]);
    setInviteEmail('');
    
    toast({
      title: 'Invitation sent',
      description: `Invitation sent to ${inviteEmail}`,
    });
  };

  const removeTeamMember = (memberId: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== memberId));
    toast({
      title: 'Member removed',
      description: 'Team member has been removed',
    });
  };

  const updateMemberRole = (memberId: string, newRole: TeamMember['role']) => {
    setTeamMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, role: newRole } : m
    ));
    toast({
      title: 'Role updated',
      description: 'Team member role has been updated',
    });
  };

  const addComment = () => {
    if (!newComment.trim() || !analysisId) return;

    const comment: Comment = {
      id: Date.now().toString(),
      userId: user?.id || '1',
      userName: user?.name || 'Current User',
      userAvatar: user?.avatar,
      content: newComment,
      createdAt: new Date().toISOString(),
      isResolved: false
    };

    setSharedAnalyses(prev => prev.map(analysis => 
      analysis.id === analysisId 
        ? { ...analysis, comments: [...analysis.comments, comment] }
        : analysis
    ));

    setNewComment('');
    toast({
      title: 'Comment added',
      description: 'Your comment has been added',
    });
  };

  const resolveComment = (commentId: string) => {
    setSharedAnalyses(prev => prev.map(analysis => ({
      ...analysis,
      comments: analysis.comments.map(comment =>
        comment.id === commentId 
          ? { ...comment, isResolved: true }
          : comment
      )
    })));
  };

  const getRoleColor = (role: TeamMember['role']) => {
    switch (role) {
      case 'owner': return 'bg-purple-500';
      case 'admin': return 'bg-red-500';
      case 'member': return 'bg-blue-500';
      case 'viewer': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Team Collaboration
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="sharing">Sharing</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Team Management */}
          <TabsContent value="team" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter email to invite..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && inviteTeamMember()}
                className="flex-1"
              />
              <Button 
                onClick={inviteTeamMember}
                disabled={!inviteEmail.trim()}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite
              </Button>
            </div>

            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.name}</span>
                        <Badge className={`${getRoleColor(member.role)} text-white`}>
                          {member.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">{member.email}</p>
                      <p className="text-xs text-gray-500">
                        Joined {formatDate(member.joinedAt)} • Last active {formatDate(member.lastActive)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {member.role !== 'owner' && (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.id, e.target.value as TeamMember['role'])}
                          className="px-2 py-1 text-xs border border-border rounded bg-dark"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeamMember(member.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Sharing */}
          <TabsContent value="sharing" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Share Analysis</h3>
                <Button onClick={generateShareLink}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Generate Link
                </Button>
              </div>
              
              {shareLink && (
                <div className="p-3 bg-dark border border-border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Link className="w-4 h-4" />
                    <span className="text-sm font-medium">Shareable Link</span>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      value={shareLink} 
                      readOnly 
                      className="flex-1 text-xs"
                    />
                    <Button 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(shareLink);
                        toast({ title: 'Copied to clipboard' });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Anyone with this link can view the analysis
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4" />
                    <span className="font-medium text-sm">View Only</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Can view analysis results and charts
                  </p>
                </Card>
                
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4" />
                    <span className="font-medium text-sm">Comment</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Can view and add comments
                  </p>
                </Card>
                
                <Card className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4" />
                    <span className="font-medium text-sm">Collaborate</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Can edit and re-analyze
                  </p>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Comments */}
          <TabsContent value="comments" className="space-y-4">
            {analysisId && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1 min-h-[80px]"
                  />
                  <Button 
                    onClick={addComment}
                    disabled={!newComment.trim()}
                    className="self-end"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Comment
                  </Button>
                </div>

                <div className="space-y-3">
                  {sharedAnalyses
                    .find(a => a.id === analysisId)
                    ?.comments.map((comment) => (
                    <div key={comment.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={comment.userAvatar} />
                            <AvatarFallback>
                              {comment.userName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{comment.userName}</span>
                              <span className="text-xs text-gray-500">
                                {formatDate(comment.createdAt)}
                              </span>
                              {comment.isResolved && (
                                <Badge variant="secondary" className="text-xs">
                                  <Check className="w-3 h-3 mr-1" />
                                  Resolved
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        </div>
                        
                        {!comment.isResolved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resolveComment(comment.id)}
                            className="text-green-400 hover:text-green-300"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Activity Feed */}
          <TabsContent value="activity" className="space-y-4">
            <div className="space-y-3">
              {[
                {
                  id: '1',
                  type: 'analysis',
                  user: 'John Doe',
                  action: 'completed analysis for',
                  target: 'facebook/react',
                  time: '2 hours ago'
                },
                {
                  id: '2',
                  type: 'comment',
                  user: 'Jane Smith',
                  action: 'commented on',
                  target: 'microsoft/typescript',
                  time: '4 hours ago'
                },
                {
                  id: '3',
                  type: 'share',
                  user: 'John Doe',
                  action: 'shared analysis for',
                  target: 'vercel/next.js',
                  time: '1 day ago'
                }
              ].map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    {activity.type === 'analysis' && <Star className="w-4 h-4 text-primary" />}
                    {activity.type === 'comment' && <MessageSquare className="w-4 h-4 text-primary" />}
                    {activity.type === 'share' && <Share2 className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user}</span> {activity.action} <span className="font-medium">{activity.target}</span>
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}