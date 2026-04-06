import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  GitBranch, Slack, Github, Gitlab, 
  MessageCircle, Calendar, Users, Zap,
  Settings, Check, X, AlertCircle, ExternalLink,
  Monitor, Package, Database, Cloud
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Integration {
  id: string;
  name: string;
  icon: any;
  description: string;
  category: string;
  connected: boolean;
  configurable: boolean;
  premium?: boolean;
}

const availableIntegrations: Integration[] = [
  {
    id: "github",
    name: "GitHub",
    icon: Github,
    description: "Sync repositories and automate analysis workflows",
    category: "version-control",
    connected: false,
    configurable: true,
  },
  {
    id: "gitlab",
    name: "GitLab",
    icon: Gitlab,
    description: "Integrate with GitLab repositories and CI/CD",
    category: "version-control",
    connected: false,
    configurable: true,
  },
  {
    id: "slack",
    name: "Slack",
    icon: Slack,
    description: "Get analysis notifications in your Slack channels",
    category: "communication",
    connected: false,
    configurable: true,
  },
  {
    id: "discord",
    name: "Discord",
    icon: MessageCircle,
    description: "Share analysis results to Discord servers",
    category: "communication",
    connected: false,
    configurable: true,
  },
  {
    id: "jira",
    name: "Jira",
    icon: Package,
    description: "Create issues from analysis recommendations",
    category: "project-management",
    connected: false,
    configurable: true,
    premium: true,
  },
  {
    id: "jenkins",
    name: "Jenkins",
    icon: Monitor,
    description: "Trigger analysis from Jenkins pipelines",
    category: "ci-cd",
    connected: false,
    configurable: true,
  },
  {
    id: "circleci",
    name: "CircleCI",
    icon: Zap,
    description: "Integrate with CircleCI workflows",
    category: "ci-cd",
    connected: false,
    configurable: true,
  },
  {
    id: "aws",
    name: "AWS CodeCommit",
    icon: Cloud,
    description: "Analyze AWS CodeCommit repositories",
    category: "cloud",
    connected: false,
    configurable: true,
    premium: true,
  },
];

export default function Integrations() {
  const { toast } = useToast();
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configData, setConfigData] = useState<Record<string, any>>({});
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // Fetch connected integrations
  const { data: connectedIntegrations = [], isLoading } = useQuery({
    queryKey: ["/api/integrations"],
  });

  // Connect integration mutation
  const connectMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/integrations/${data.id}/connect`, data.config);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ 
        title: "Integration connected", 
        description: `${variables.name} has been connected successfully` 
      });
      setSelectedIntegration(null);
      setConfigData({});
    },
    onError: (error: any) => {
      toast({ 
        title: "Connection failed", 
        description: error.message || "Failed to connect integration",
        variant: "destructive" 
      });
    },
  });

  // Disconnect integration mutation
  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/integrations/${id}/disconnect`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration disconnected" });
    },
    onError: () => {
      toast({ 
        title: "Failed to disconnect", 
        variant: "destructive" 
      });
    },
  });

  // Test connection
  const testConnection = async (integration: Integration) => {
    setTestingConnection(integration.id);
    try {
      await apiRequest("POST", `/api/integrations/${integration.id}/test`, configData[integration.id]);
      toast({ 
        title: "Connection successful", 
        description: "The integration is configured correctly" 
      });
    } catch (error) {
      toast({ 
        title: "Connection test failed", 
        description: "Please check your configuration",
        variant: "destructive" 
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const isConnected = (id: string) => {
    return connectedIntegrations.some((int: any) => int.id === id);
  };

  const getIntegrationsByCategory = (category: string) => {
    return availableIntegrations.filter(int => int.category === category);
  };

  const categories = [
    { id: "version-control", name: "Version Control", icon: GitBranch },
    { id: "communication", name: "Communication", icon: MessageCircle },
    { id: "project-management", name: "Project Management", icon: Calendar },
    { id: "ci-cd", name: "CI/CD", icon: Zap },
    { id: "cloud", name: "Cloud Providers", icon: Cloud },
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Integration Hub
        </h1>
        <p className="text-muted-foreground">
          Connect RepoAnalyzer with your favorite development tools
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl">{connectedIntegrations.length}</CardTitle>
            <CardDescription>Active Integrations</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl">{availableIntegrations.length}</CardTitle>
            <CardDescription>Available Integrations</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl">Real-time</CardTitle>
            <CardDescription>Sync Status</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map(cat => (
            <TabsTrigger key={cat.id} value={cat.id}>
              <cat.icon className="h-4 w-4 mr-1" />
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableIntegrations.map(integration => {
              const Icon = integration.icon;
              const connected = isConnected(integration.id);
              
              return (
                <Card key={integration.id} className="relative overflow-hidden">
                  {integration.premium && (
                    <Badge className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-pink-500">
                      Premium
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {integration.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {integration.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant={connected ? "default" : "secondary"}>
                        {connected ? "Connected" : "Not Connected"}
                      </Badge>
                      {connected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => disconnectMutation.mutate(integration.id)}
                          disabled={disconnectMutation.isPending}
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              onClick={() => setSelectedIntegration(integration)}
                            >
                              Connect
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Icon className="h-5 w-5" />
                                Connect {integration.name}
                              </DialogTitle>
                              <DialogDescription>
                                Configure your {integration.name} integration
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              {integration.id === "github" && (
                                <>
                                  <div>
                                    <Label htmlFor="github-token">Personal Access Token</Label>
                                    <Input
                                      id="github-token"
                                      type="password"
                                      placeholder="ghp_..."
                                      value={configData.github?.token || ""}
                                      onChange={(e) => setConfigData({
                                        ...configData,
                                        github: { ...configData.github, token: e.target.value }
                                      })}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Generate a token at GitHub Settings → Developer settings
                                    </p>
                                  </div>
                                  <div>
                                    <Label htmlFor="github-org">Organization (Optional)</Label>
                                    <Input
                                      id="github-org"
                                      placeholder="my-org"
                                      value={configData.github?.organization || ""}
                                      onChange={(e) => setConfigData({
                                        ...configData,
                                        github: { ...configData.github, organization: e.target.value }
                                      })}
                                    />
                                  </div>
                                </>
                              )}
                              {integration.id === "slack" && (
                                <>
                                  <div>
                                    <Label htmlFor="slack-webhook">Webhook URL</Label>
                                    <Input
                                      id="slack-webhook"
                                      type="url"
                                      placeholder="https://hooks.slack.com/services/..."
                                      value={configData.slack?.webhookUrl || ""}
                                      onChange={(e) => setConfigData({
                                        ...configData,
                                        slack: { ...configData.slack, webhookUrl: e.target.value }
                                      })}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Create an incoming webhook in your Slack workspace
                                    </p>
                                  </div>
                                  <div>
                                    <Label htmlFor="slack-channel">Default Channel</Label>
                                    <Input
                                      id="slack-channel"
                                      placeholder="#repo-analysis"
                                      value={configData.slack?.channel || ""}
                                      onChange={(e) => setConfigData({
                                        ...configData,
                                        slack: { ...configData.slack, channel: e.target.value }
                                      })}
                                    />
                                  </div>
                                </>
                              )}
                              {integration.id === "jira" && (
                                <>
                                  <div>
                                    <Label htmlFor="jira-url">Jira URL</Label>
                                    <Input
                                      id="jira-url"
                                      type="url"
                                      placeholder="https://yourcompany.atlassian.net"
                                      value={configData.jira?.url || ""}
                                      onChange={(e) => setConfigData({
                                        ...configData,
                                        jira: { ...configData.jira, url: e.target.value }
                                      })}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="jira-email">Email</Label>
                                    <Input
                                      id="jira-email"
                                      type="email"
                                      placeholder="you@company.com"
                                      value={configData.jira?.email || ""}
                                      onChange={(e) => setConfigData({
                                        ...configData,
                                        jira: { ...configData.jira, email: e.target.value }
                                      })}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="jira-token">API Token</Label>
                                    <Input
                                      id="jira-token"
                                      type="password"
                                      placeholder="Your API token"
                                      value={configData.jira?.token || ""}
                                      onChange={(e) => setConfigData({
                                        ...configData,
                                        jira: { ...configData.jira, token: e.target.value }
                                      })}
                                    />
                                  </div>
                                </>
                              )}
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="notifications"
                                  checked={configData[integration.id]?.notifications || false}
                                  onCheckedChange={(checked) => setConfigData({
                                    ...configData,
                                    [integration.id]: { 
                                      ...configData[integration.id], 
                                      notifications: checked 
                                    }
                                  })}
                                />
                                <Label htmlFor="notifications">
                                  Enable notifications
                                </Label>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => testConnection(integration)}
                                disabled={testingConnection === integration.id}
                              >
                                {testingConnection === integration.id ? "Testing..." : "Test Connection"}
                              </Button>
                              <Button
                                onClick={() => connectMutation.mutate({
                                  id: integration.id,
                                  name: integration.name,
                                  config: configData[integration.id]
                                })}
                                disabled={connectMutation.isPending}
                              >
                                Connect
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {categories.map(category => (
          <TabsContent key={category.id} value={category.id}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getIntegrationsByCategory(category.id).map(integration => {
                const Icon = integration.icon;
                const connected = isConnected(integration.id);
                
                return (
                  <Card key={integration.id} className="relative overflow-hidden">
                    {integration.premium && (
                      <Badge className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-pink-500">
                        Premium
                      </Badge>
                    )}
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        {integration.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {integration.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant={connected ? "default" : "secondary"}>
                          {connected ? "Connected" : "Not Connected"}
                        </Badge>
                        {connected ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => disconnectMutation.mutate(integration.id)}
                          >
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setSelectedIntegration(integration)}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Integration Activity</CardTitle>
          <CardDescription>Recent integration events and webhooks</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {i % 2 === 0 ? "Webhook" : "Sync"}
                    </Badge>
                    <span className="text-sm">
                      {i % 2 === 0 
                        ? "Analysis result sent to Slack #dev-team" 
                        : "GitHub repository sync completed"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {i} minutes ago
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}