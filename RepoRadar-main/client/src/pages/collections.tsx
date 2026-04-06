import { useAuth } from "@/hooks/useAuth";
import { CollectionsManager } from "@/components/collections-manager";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Folder } from "lucide-react";

export default function Collections() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark text-white">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-dark text-white">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Card className="bg-card border border-border p-8 max-w-md w-full">
            <CardContent className="text-center">
              <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Sign in Required</h2>
              <p className="text-gray-400 mb-6">
                You need to be signed in to create and manage collections.
              </p>
              <Button
                onClick={() => window.location.href = '/api/login'}
                className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary"
                data-testid="button-sign-in"
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-white">
      <Header />
      
      <div className="max-w-6xl mx-auto px-6 py-8 pt-32">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">My Collections</h1>
          <p className="text-gray-400">
            Organize your favorite repositories into themed collections for easy access and management.
          </p>
        </div>

        {/* Collections Manager */}
        <CollectionsManager 
          userId={user.id}
          showCreateButton={true}
        />
      </div>
    </div>
  );
}