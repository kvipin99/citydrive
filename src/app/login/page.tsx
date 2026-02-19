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
import { Car, Lock, User, Info, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const STAFF_IDS = ['admin', 'Branch1', 'Branch2', 'Branch3', 'Branch4', 'Branch5'];
const DEFAULT_PASSWORD = 'City123';

export default function LoginPage() {
  const [userId, setUserId] = useState('admin');
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) return;

    setIsLoading(true);
    const email = userId.includes('@') ? userId.trim() : `${userId.trim()}@citydriving.in`;

    try {
      // 1. Attempt standard login
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (error: any) {
      // 2. Auto-provisioning logic: If it's a known staff ID and login fails, try to create it automatically
      if (STAFF_IDS.includes(userId) && password === DEFAULT_PASSWORD) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const uid = userCredential.user.uid;
          
          // Create the user profile document required for security rules
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
          // If creation fails (e.g. user already exists but password was wrong), show standard error
          console.error("Auto-provisioning failed:", createError);
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
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Car className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Citydrive Portal</CardTitle>
          <CardDescription>
            Enter your User ID to manage your branch
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <Alert className="bg-primary/5 border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertTitle className="text-sm font-semibold">Instant Access Enabled</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                System accounts (admin, Branch1-5) are automatically created on first login with password <b>{DEFAULT_PASSWORD}</b>.
              </AlertDescription>
            </Alert>
            
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
