'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, FileText, CheckCircle, Clock } from 'lucide-react';

interface OffboardingRun {
  run_id: string;
  user_id: string;
  user_email: string;
  status: 'collecting' | 'processing' | 'completed';
  created_at: string;
  updated_at: string;
  candidate_files: Array<{
    id: string;
    name: string;
    space_name: string;
    space_type: string;
    created_at: string;
    bytes: number;
    mime: string;
  }>;
  transition_space?: {
    id: string;
    name: string;
    type: string;
    created_at: string;
  };
  artifacts?: Record<string, any>;
}

export default function OffboardingPage() {
  const [userEmail, setUserEmail] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [runs, setRuns] = useState<OffboardingRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data for demo - i produksjon ville dette komme fra API
  useEffect(() => {
    // Simuler lastning av eksisterende runs
    setTimeout(() => {
      setRuns([
        {
          run_id: 'demo-run-1',
          user_id: 'user-1',
          user_email: 'demo@example.com',
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          candidate_files: [
            {
              id: 'file-1',
              name: 'dokument.pdf',
              space_name: 'Personal',
              space_type: 'personal',
              created_at: new Date().toISOString(),
              bytes: 1024000,
              mime: 'application/pdf'
            }
          ],
          transition_space: {
            id: 'space-1',
            name: 'Transition-demo@example.com-2025-01-27',
            type: 'transition',
            created_at: new Date().toISOString()
          }
        }
      ]);
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleStartOffboarding = async () => {
    if (!userEmail.trim()) {
      setError('Vennligst oppgi e-postadresse');
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      // I produksjon: kall POST /api/offboarding/start
      // const response = await fetch('/api/offboarding/start', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ user_email: userEmail })
      // });
      
      // Simuler API-kall
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newRun: OffboardingRun = {
        run_id: `run-${Date.now()}`,
        user_id: `user-${Date.now()}`,
        user_email: userEmail,
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        candidate_files: []
      };
      
      setRuns(prev => [newRun, ...prev]);
      setUserEmail('');
    } catch (err) {
      setError('Kunne ikke starte offboarding');
    } finally {
      setIsStarting(false);
    }
  };

  const handleFinalize = async (runId: string) => {
    try {
      // I produksjon: kall POST /api/offboarding/{runId}/finalize
      // const response = await fetch(`/api/offboarding/${runId}/finalize`, {
      //   method: 'POST'
      // });
      
      // Simuler API-kall
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setRuns(prev => prev.map(run => 
        run.run_id === runId 
          ? { ...run, status: 'completed' as const, updated_at: new Date().toISOString() }
          : run
      ));
    } catch (err) {
      setError('Kunne ikke fullføre offboarding');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      collecting: 'secondary',
      processing: 'default',
      completed: 'success'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Offboarding</h1>
          <p className="text-muted-foreground">
            Administrer kunnskapsoverføring ved avslutning
          </p>
        </div>
      </div>

      {/* Start ny offboarding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Start ny offboarding
          </CardTitle>
          <CardDescription>
            Oppgi e-postadresse for å starte offboarding-prosessen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              type="email"
              placeholder="bruker@example.com"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleStartOffboarding}
              disabled={isStarting || !userEmail.trim()}
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starter...
                </>
              ) : (
                'Start offboarding'
              )}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-500 mt-2">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Eksisterende runs */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Offboarding-prosesser</h2>
        
        {runs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Ingen offboarding-prosesser funnet
            </CardContent>
          </Card>
        ) : (
          runs.map((run) => (
            <Card key={run.run_id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(run.status)}
                    <div>
                      <CardTitle className="text-lg">{run.user_email}</CardTitle>
                      <CardDescription>
                        Startet: {new Date(run.created_at).toLocaleString('no-NO')}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(run.status)}
                    {run.status === 'processing' && (
                      <Button
                        size="sm"
                        onClick={() => handleFinalize(run.run_id)}
                      >
                        Fullfør
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>{run.candidate_files.length} kandidatfiler</span>
                  </div>
                  
                  {run.transition_space && (
                    <div className="text-sm text-muted-foreground">
                      Transition Space: {run.transition_space.name}
                    </div>
                  )}
                  
                  {run.artifacts && Object.keys(run.artifacts).length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Artefakter: {Object.keys(run.artifacts).length} generert
                    </div>
                  )}
                  
                  {run.candidate_files.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Kandidatfiler:</p>
                      <div className="space-y-1">
                        {run.candidate_files.slice(0, 3).map((file) => (
                          <div key={file.id} className="text-xs text-muted-foreground">
                            • {file.name} ({file.space_name})
                          </div>
                        ))}
                        {run.candidate_files.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            ... og {run.candidate_files.length - 3} flere
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
