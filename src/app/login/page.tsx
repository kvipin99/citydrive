
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
import { Car, Lock, User, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const [userId, setUserId] = useState('admin@citydriving.in');
  const [password, setPassword] = useState('Cityadm');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) return;

    setIsLoading(true);
    // Automatically append domain if user only entered the ID part
    const email = userId.includes('@') ? userId.trim() : `${userId.trim()}@citydriving.in`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Login error:", error.code, error.message);
      
      let errorMessage = 'Invalid credentials. Please check your ID and Password.';
      
      if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/Password login is not enabled in your Firebase Console. Please enable it in the Auth section.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        errorMessage = 'User not found or incorrect password. Ensure the user exists in your Firebase project.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
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
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Car className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Citydrive Login</CardTitle>
          <CardDescription>
            Access your driving school management portal
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-800 dark:text-blue-300">Setup Required</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs">
                Ensure <strong>Email/Password</strong> is enabled in your Firebase Console and the admin user is created.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="userId">User ID / Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="userId"
                  placeholder="e.g., admin"
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
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
            <div className="text-xs text-center text-muted-foreground space-y-1 border-t pt-4 w-full">
              <p>Admin Email: <span className="font-mono font-bold text-primary">admin@citydriving.in</span></p>
              <p>Admin Password: <span className="font-mono font-bold text-primary">Cityadm</span></p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
