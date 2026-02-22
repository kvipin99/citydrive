'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, User, AlertCircle, Car } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const STAFF_IDS = ['admin', 'Branch1', 'Branch2', 'Branch3', 'Branch4', 'Branch5'];
const DEFAULT_PASSWORD = 'City123';

export default function LoginPage() {
  const [userId, setUserId] = useState('admin');
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [isLoading, setIsLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) return;

    setIsLoading(true);
    setSetupError(null);
    const email = userId.includes('@') ? userId.trim() : `${userId.trim()}@citydriving.in`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (error: any) {
      if (STAFF_IDS.includes(userId) && password === DEFAULT_PASSWORD) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const uid = userCredential.user.uid;
          
          // Uniform branch naming: "Branch 1", "Branch 2", etc.
          const branchNum = userId.match(/\d+/);
          const formattedBranch = branchNum ? `Branch ${branchNum[0]}` : 'HeadOffice';

          await setDoc(doc(db, 'users', uid), {
            id: uid,
            email: email,
            role: userId === 'admin' ? 'Admin' : 'BranchManager',
            branch: formattedBranch,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          toast({
            title: 'Account Provisioned',
            description: `Auto-created system account for ${userId}.`,
          });
          router.push('/dashboard');
          return;
        } catch (createError: any) {
          if (createError.code === 'auth/operation-not-allowed') {
            setSetupError('Email/Password provider is not enabled in Firebase Console.');
          }
        }
      }

      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid User ID or Password. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="space-y-1 text-center bg-primary/5 pb-8 pt-10">
          <div className="flex justify-center mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xl border-4 border-background transform -rotate-6">
              <Car className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black tracking-tighter text-primary">CITYDRIVE</CardTitle>
          <CardDescription className="font-medium text-muted-foreground">
            Driving School Management Portal
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pt-6">
            {setupError && (
              <Alert variant="destructive" className="bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Configuration Required</AlertTitle>
                <AlertDescription className="text-xs">
                  Please enable Email/Password login in the Firebase Console.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="userId"
                  placeholder="e.g. admin or Branch1"
                  className="pl-9 h-11"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  className="pl-9 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-10">
            <Button className="w-full h-12 text-base font-bold shadow-lg" type="submit" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Sign In to Portal'}
            </Button>
            <div className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold opacity-50">
              &copy; {new Date().getFullYear()} Citydrive Systems
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
