import { GithubProfile } from "@workspace/api-client-react";
import { format } from "date-fns";
import { MapPin, Building2, Calendar, Users, Link as LinkIcon, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ProfileCard({ profile }: { profile: GithubProfile }) {
  return (
    <Card className="glass-panel border-white/5 overflow-hidden border-t-primary/20 relative">
      {/* Decorative gradient blob */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-background shadow-2xl relative z-10">
              <img src={profile.avatar_url} alt={profile.login} className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-primary to-accent rounded-2xl -m-1 blur opacity-50 -z-10" />
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-3xl font-bold text-foreground">{profile.name || profile.login}</h2>
              <a 
                href={profile.html_url} 
                target="_blank" 
                rel="noreferrer"
                className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 transition-colors"
              >
                @{profile.login} <LinkIcon className="w-3 h-3" />
              </a>
            </div>
            
            {profile.bio && (
              <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl">
                {profile.bio}
              </p>
            )}
            
            <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
              {profile.company && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4 text-primary/70" />
                  {profile.company}
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary/70" />
                  {profile.location}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary/70" />
                Joined {format(new Date(profile.created_at), 'MMM yyyy')}
              </div>
            </div>
          </div>

          <div className="flex md:flex-col gap-4 self-stretch justify-center pt-6 md:pt-0 md:pl-8 md:border-l border-border/50 min-w-[200px]">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{profile.followers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Followers</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10 text-accent">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{profile.public_repos.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Public Repos</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
