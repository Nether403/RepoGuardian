import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Folder, Plus, X, Edit2, Trash2, BookmarkPlus } from 'lucide-react';

interface Collection {
  id: number;
  name: string;
  description: string;
  color: string;
  repositoryCount: number;
  createdAt: string;
}

interface CollectionsManagerProps {
  repositoryId?: string;
  userId: string;
  showCreateButton?: boolean;
}

export function CollectionsManager({ repositoryId, userId, showCreateButton = true }: CollectionsManagerProps) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAddToCollectionOpen, setIsAddToCollectionOpen] = useState(false);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    color: '#FF6B6B'
  });

  const { data: collections = [], isLoading } = useQuery<Collection[]>({
    queryKey: ['/api/collections', userId],
    enabled: !!userId
  });

  const createCollectionMutation = useMutation({
    mutationFn: async (data: typeof newCollection) => {
      return await apiRequest('POST', '/api/collections', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      toast({
        title: 'Collection Created',
        description: 'Your new collection has been created successfully.'
      });
      setIsCreateOpen(false);
      setNewCollection({ name: '', description: '', color: '#FF6B6B' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create collection. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const addToCollectionMutation = useMutation({
    mutationFn: async ({ collectionId, repoId }: { collectionId: number; repoId: string }) => {
      return await apiRequest('POST', `/api/collections/${collectionId}/repositories`, { repositoryId: repoId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      toast({
        title: 'Added to Collection',
        description: 'Repository has been added to the collection.'
      });
      setIsAddToCollectionOpen(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add repository to collection.',
        variant: 'destructive'
      });
    }
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async (collectionId: number) => {
      return await apiRequest('DELETE', `/api/collections/${collectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      toast({
        title: 'Collection Deleted',
        description: 'Collection has been deleted successfully.'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete collection.',
        variant: 'destructive'
      });
    }
  });

  const handleCreateCollection = () => {
    if (!newCollection.name.trim()) {
      toast({
        title: 'Error',
        description: 'Collection name is required.',
        variant: 'destructive'
      });
      return;
    }
    createCollectionMutation.mutate(newCollection);
  };

  const handleAddToCollection = (collectionId: number) => {
    if (repositoryId) {
      addToCollectionMutation.mutate({ collectionId, repoId: repositoryId });
    }
  };

  return (
    <div className="space-y-4">
      {/* Create Collection Button */}
      {showCreateButton && (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary">
              <Plus className="mr-2 h-4 w-4" />
              Create New Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border border-border">
            <DialogHeader>
              <DialogTitle>Create New Collection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Collection Name</label>
                <Input
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  placeholder="My Awesome Collection"
                  className="bg-dark border-border"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={newCollection.description}
                  onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                  placeholder="Describe your collection..."
                  className="bg-dark border-border"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Color</label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="color"
                    value={newCollection.color}
                    onChange={(e) => setNewCollection({ ...newCollection, color: e.target.value })}
                    className="w-20 h-10 bg-dark border-border"
                  />
                  <Input
                    value={newCollection.color}
                    onChange={(e) => setNewCollection({ ...newCollection, color: e.target.value })}
                    placeholder="#FF6B6B"
                    className="flex-1 bg-dark border-border"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCollection}
                  disabled={createCollectionMutation.isPending}
                  className="bg-primary hover:bg-primary/80"
                >
                  {createCollectionMutation.isPending ? 'Creating...' : 'Create Collection'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add to Collection Button (for repository pages) */}
      {repositoryId && (
        <Dialog open={isAddToCollectionOpen} onOpenChange={setIsAddToCollectionOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="hover-lift">
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Add to Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border border-border">
            <DialogHeader>
              <DialogTitle>Add to Collection</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-4">Loading collections...</div>
              ) : collections.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-4">No collections yet</p>
                  <Button onClick={() => { setIsAddToCollectionOpen(false); setIsCreateOpen(true); }}>
                    Create Your First Collection
                  </Button>
                </div>
              ) : (
                collections.map((collection) => (
                  <Card
                    key={collection.id}
                    className="bg-dark border-border hover:border-primary/30 transition-all cursor-pointer hover-lift"
                    onClick={() => handleAddToCollection(collection.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: collection.color }}
                          />
                          <div>
                            <h4 className="font-medium">{collection.name}</h4>
                            <p className="text-xs text-gray-400">
                              {collection.repositoryCount} repositories
                            </p>
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Collections List */}
      {!repositoryId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : collections.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No collections yet</p>
              <p className="text-sm text-gray-500">Create your first collection to organize repositories</p>
            </div>
          ) : (
            collections.map((collection) => (
              <Card
                key={collection.id}
                className="bg-card border border-border hover:border-primary/30 transition-all group card-hover"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: collection.color }}
                      />
                      <h3 className="font-semibold text-lg">{collection.name}</h3>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={() => deleteCollectionMutation.mutate(collection.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {collection.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-dark">
                      {collection.repositoryCount} repositories
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Created {new Date(collection.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}