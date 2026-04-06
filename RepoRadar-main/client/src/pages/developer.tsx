import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Code, Key, Webhook, Copy, Trash2, Plus, Check, AlertCircle, Book, Rocket, Shield, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Developer() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDescription, setNewKeyDescription] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["read"]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(["repository.analyzed"]);

  // Fetch API keys
  const { data: apiKeys = [], isLoading: keysLoading } = useQuery({
    queryKey: ["/api/developer/keys"],
  });

  // Fetch webhooks
  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery({
    queryKey: ["/api/developer/webhooks"],
  });

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/developer/keys", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/keys"] });
      toast({ title: "API key created successfully" });
      setNewKeyName("");
      setNewKeyDescription("");
    },
    onError: () => {
      toast({ title: "Failed to create API key", variant: "destructive" });
    },
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: number) => {
      return await apiRequest("DELETE", `/api/developer/keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/keys"] });
      toast({ title: "API key deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete API key", variant: "destructive" });
    },
  });

  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/developer/webhooks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/webhooks"] });
      toast({ title: "Webhook created successfully" });
      setNewWebhookUrl("");
    },
    onError: () => {
      toast({ title: "Failed to create webhook", variant: "destructive" });
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: number) => {
      return await apiRequest("DELETE", `/api/developer/webhooks/${webhookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/webhooks"] });
      toast({ title: "Webhook deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete webhook", variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Developer API
        </h1>
        <p className="text-muted-foreground">
          Integrate RepoAnalyzer into your applications with our powerful API
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-2">
                    <span className="font-semibold">1.</span>
                    Create an API key in the API Keys tab
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold">2.</span>
                    Include the key in your request headers
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold">3.</span>
                    Make requests to our API endpoints
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold">4.</span>
                    Monitor usage and set up webhooks
                  </li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    Never expose API keys in client-side code
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    Use environment variables for key storage
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    Rotate keys regularly for security
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">•</span>
                    Use webhook signatures for verification
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>API Base URL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-muted rounded-md font-mono text-sm">
                  {window.location.origin}/api/v1
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(`${window.location.origin}/api/v1`, "base-url")}
                >
                  {copied === "base-url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage your API keys for programmatic access to RepoAnalyzer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create API Key</DialogTitle>
                      <DialogDescription>
                        Generate a new API key for accessing RepoAnalyzer API
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="key-name">Key Name</Label>
                        <Input
                          id="key-name"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          placeholder="Production API Key"
                        />
                      </div>
                      <div>
                        <Label htmlFor="key-description">Description (Optional)</Label>
                        <Textarea
                          id="key-description"
                          value={newKeyDescription}
                          onChange={(e) => setNewKeyDescription(e.target.value)}
                          placeholder="Used for production deployments"
                        />
                      </div>
                      <div>
                        <Label>Permissions</Label>
                        <Select
                          value={newKeyPermissions.join(",")}
                          onValueChange={(value) => setNewKeyPermissions(value.split(","))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="read">Read Only</SelectItem>
                            <SelectItem value="read,write">Read & Write</SelectItem>
                            <SelectItem value="read,write,delete">Full Access</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          createKeyMutation.mutate({
                            name: newKeyName,
                            description: newKeyDescription,
                            permissions: newKeyPermissions,
                          });
                        }}
                        disabled={!newKeyName || createKeyMutation.isPending}
                      >
                        Create Key
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {keysLoading ? (
                  <div className="text-center py-8">Loading API keys...</div>
                ) : apiKeys.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No API keys yet. Create your first key to get started.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {apiKeys.map((key: any) => (
                      <Card key={key.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{key.name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {key.permissions?.join(", ") || "read"}
                                </Badge>
                              </div>
                              {key.description && (
                                <p className="text-sm text-muted-foreground">{key.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Created: {formatDate(key.createdAt)}</span>
                                <span>Last used: {formatDate(key.lastUsedAt)}</span>
                                {key.expiresAt && (
                                  <span className="text-orange-500">
                                    Expires: {formatDate(key.expiresAt)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <code className="p-2 bg-muted rounded text-xs font-mono flex-1">
                                  {key.key}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(key.key, `key-${key.id}`)}
                                >
                                  {copied === `key-${key.id}` ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteKeyMutation.mutate(key.id)}
                              disabled={deleteKeyMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>
                Receive real-time notifications when events occur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Webhook
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Webhook</DialogTitle>
                      <DialogDescription>
                        Configure a webhook endpoint to receive event notifications
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="webhook-url">Endpoint URL</Label>
                        <Input
                          id="webhook-url"
                          type="url"
                          value={newWebhookUrl}
                          onChange={(e) => setNewWebhookUrl(e.target.value)}
                          placeholder="https://api.example.com/webhook"
                        />
                      </div>
                      <div>
                        <Label>Events</Label>
                        <Select
                          value={newWebhookEvents.join(",")}
                          onValueChange={(value) => setNewWebhookEvents(value.split(","))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="repository.analyzed">Repository Analyzed</SelectItem>
                            <SelectItem value="repository.tracked">Repository Tracked</SelectItem>
                            <SelectItem value="analysis.shared">Analysis Shared</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          createWebhookMutation.mutate({
                            url: newWebhookUrl,
                            events: newWebhookEvents,
                          });
                        }}
                        disabled={!newWebhookUrl || createWebhookMutation.isPending}
                      >
                        Add Webhook
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {webhooksLoading ? (
                  <div className="text-center py-8">Loading webhooks...</div>
                ) : webhooks.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No webhooks configured. Add a webhook to receive event notifications.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {webhooks.map((webhook: any) => (
                      <Card key={webhook.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono">{webhook.url}</code>
                                <Badge variant={webhook.active ? "default" : "secondary"}>
                                  {webhook.active ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {webhook.events?.map((event: string) => (
                                  <Badge key={event} variant="outline" className="text-xs">
                                    {event}
                                  </Badge>
                                ))}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span>Secret: </span>
                                <code className="font-mono">{webhook.secret}</code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="ml-2 h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(webhook.secret, `webhook-${webhook.id}`)}
                                >
                                  {copied === `webhook-${webhook.id}` ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                              disabled={deleteWebhookMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5" />
                API Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-8">
                  {/* Authentication */}
                  <section>
                    <h3 className="text-lg font-semibold mb-3">Authentication</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      All API requests require authentication using an API key in the request headers.
                    </p>
                    <div className="bg-muted p-3 rounded-md">
                      <code className="text-sm">
                        X-API-Key: your_api_key_here
                      </code>
                    </div>
                  </section>

                  {/* Endpoints */}
                  <section>
                    <h3 className="text-lg font-semibold mb-3">Endpoints</h3>
                    
                    {/* Search Repositories */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800">GET</Badge>
                        <code className="text-sm font-mono">/api/v1/repositories/search</code>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Search for repositories by query string
                      </p>
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-xs font-semibold mb-2">Query Parameters:</p>
                        <ul className="text-xs space-y-1">
                          <li><code>q</code> - Search query (required)</li>
                          <li><code>limit</code> - Number of results (default: 10)</li>
                        </ul>
                      </div>
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-xs font-semibold mb-2">Example Request:</p>
                        <code className="text-xs">
                          curl -H "X-API-Key: your_key" \<br />
                          "{window.location.origin}/api/v1/repositories/search?q=react"
                        </code>
                      </div>
                    </div>

                    {/* Get Repository */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800">GET</Badge>
                        <code className="text-sm font-mono">/api/v1/repositories/:id</code>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Get detailed information about a specific repository
                      </p>
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-xs font-semibold mb-2">Path Parameters:</p>
                        <ul className="text-xs">
                          <li><code>id</code> - Repository ID</li>
                        </ul>
                      </div>
                    </div>

                    {/* Get Analysis */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800">GET</Badge>
                        <code className="text-sm font-mono">/api/v1/repositories/:id/analysis</code>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Get analysis results for a repository
                      </p>
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-xs font-semibold mb-2">Response Example:</p>
                        <pre className="text-xs overflow-x-auto">{`{
  "data": {
    "originality": 85,
    "completeness": 92,
    "marketability": 78,
    "monetization": 65,
    "usefulness": 88,
    "overallScore": 82,
    "summary": "Analysis summary...",
    "strengths": ["..."],
    "weaknesses": ["..."],
    "recommendations": ["..."]
  }
}`}</pre>
                      </div>
                    </div>

                    {/* Analyze Repository */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800">POST</Badge>
                        <code className="text-sm font-mono">/api/v1/repositories/analyze</code>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Analyze a new repository (requires write permission)
                      </p>
                      <div className="bg-muted p-3 rounded-md">
                        <p className="text-xs font-semibold mb-2">Request Body:</p>
                        <pre className="text-xs">{`{
  "repositoryUrl": "https://github.com/owner/repo"
}`}</pre>
                      </div>
                    </div>
                  </section>

                  {/* Rate Limiting */}
                  <section>
                    <h3 className="text-lg font-semibold mb-3">Rate Limiting</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      API requests are rate limited based on your subscription tier:
                    </p>
                    <ul className="text-sm space-y-2">
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Free tier: 100 requests/hour
                      </li>
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Pro tier: 1,000 requests/hour
                      </li>
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Enterprise tier: 10,000 requests/hour
                      </li>
                    </ul>
                  </section>

                  {/* Webhooks */}
                  <section>
                    <h3 className="text-lg font-semibold mb-3">Webhook Events</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Webhooks send POST requests to your endpoint with event data:
                    </p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold">repository.analyzed</p>
                        <p className="text-xs text-muted-foreground">
                          Triggered when a repository analysis is completed
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">repository.tracked</p>
                        <p className="text-xs text-muted-foreground">
                          Triggered when a repository is added to tracking
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">analysis.shared</p>
                        <p className="text-xs text-muted-foreground">
                          Triggered when an analysis is shared with a team
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Error Handling */}
                  <section>
                    <h3 className="text-lg font-semibold mb-3">Error Handling</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      API errors are returned with appropriate HTTP status codes:
                    </p>
                    <ul className="text-sm space-y-2">
                      <li><code>400</code> - Bad Request (invalid parameters)</li>
                      <li><code>401</code> - Unauthorized (invalid API key)</li>
                      <li><code>403</code> - Forbidden (insufficient permissions)</li>
                      <li><code>404</code> - Not Found</li>
                      <li><code>429</code> - Too Many Requests (rate limit exceeded)</li>
                      <li><code>500</code> - Internal Server Error</li>
                    </ul>
                  </section>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}