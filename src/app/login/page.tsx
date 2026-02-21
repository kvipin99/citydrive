
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
import { Lock, User, Sparkles, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

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
  const logo = PlaceHolderImages.find(p => p.id === 'app-logo');

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
          
          await setDoc(doc(db, 'users', uid), {
            id: uid,
            email: email,
            role: userId === 'admin' ? 'Admin' : 'BranchManager',
            branch: userId.startsWith('Branch') ? userId : 'HeadOffice',
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
        description: error.code === 'auth/operation-not-allowed' 
          ? 'System configuration required: Enable Email/Password in Firebase Console.'
          : 'Invalid User ID or Password. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-background border shadow-sm overflow-hidden p-2">
              {logo && (
                <Image 
                  src={logo.imageUrl} 
                  alt="Citydrive Logo" 
                  width={64} 
                  height={64} 
                  className="object-contain"
                  data-ai-hint={logo.imageHint}
                />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Citydrive Portal</CardTitle>
          <CardDescription>
            Enter your User ID
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {setupError && (
              <Alert variant="destructive" className="bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Configuration Required</AlertTitle>
                <AlertDescription className="text-xs">
                  Please go to <b>Firebase Console</b> &rarr; <b>Authentication</b> &rarr; <b>Sign-in method</b> and enable <b>Email/Password</b> to allow auto-creation of accounts.
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
                  className="pl-9"
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
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full h-11 text-base" type="submit" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Sign In'}
            </Button>
            <div className="text-[10px] text-center text-muted-foreground opacity-70">
              &copy; {new Date().getFullYear()} Citydrive Management System
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
