'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Car, Lock, User, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function LoginPage() {
  const [userId, setUserId] = useState('admin');
  const [password, setPassword] = useState('City123');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) return;

    setIsLoading(true);
    const email = userId.includes('@') ? userId.trim() : `${userId.trim()}@citydriving.in`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (error: any) {
      let errorMessage = 'Invalid credentials. Please check your ID and Password.';
      
      if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/Password login is not enabled in your Firebase Console.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Account not found or incorrect password. Please ensure you have created this user in the Firebase Console.';
      }

      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
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
          <CardTitle className="text-2xl font-bold">Citydrive Login</CardTitle>
          <CardDescription>
            Management Portal
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle className="text-sm font-semibold">Required Setup</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                <p className="mb-2">Please create these users in your <b>Firebase Console</b> (Authentication) with password <b>City123</b>:</p>
                <ScrollArea className="h-24 rounded border p-2 bg-background/50">
                  <ul className="space-y-1 list-disc list-inside">
                    <li>admin@citydriving.in</li>
                    <li>Branch1@citydriving.in</li>
                    <li>Branch2@citydriving.in</li>
                    <li>Branch3@citydriving.in</li>
                    <li>Branch4@citydriving.in</li>
                    <li>Branch5@citydriving.in</li>
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="userId">User ID / Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="userId"
                  placeholder="admin or Branch1"
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
              {isLoading ? 'Signing in...' : 'Sign In'}
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
