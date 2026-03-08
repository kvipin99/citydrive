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
import { Lock, User, AlertCircle, Car, ShieldCheck, KeyRound, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STAFF_IDS = ['admin', 'master', 'Branch1', 'Branch2', 'Branch3', 'Branch4', 'Branch5'];
const DEFAULT_PASSWORD = 'City123';
const MASTER_USER_PASSWORD = '9744001735';
const MASTER_SECRET = '9744001735';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [inputSecret, setInputSecret] = useState('');

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
      // Auto-provisioning logic for default staff accounts
      const isStandardStaff = STAFF_IDS.some(id => id.toLowerCase() === userId.toLowerCase()) && password === DEFAULT_PASSWORD;
      const isMasterAccount = userId.toLowerCase() === 'master' && password === MASTER_USER_PASSWORD;

      if (isStandardStaff || isMasterAccount) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const uid = userCredential.user.uid;
          
          const branchNum = userId.match(/\d+/);
          const formattedBranch = branchNum ? `Branch ${branchNum[0]}` : 'HeadOffice';

          await setDoc(doc(db, 'users', uid), {
            id: uid,
            email: email,
            name: userId.charAt(0).toUpperCase() + userId.slice(1),
            role: (userId.toLowerCase() === 'admin' || userId.toLowerCase() === 'master') ? 'Admin' : 'BranchManager',
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
        description: 'Invalid User ID or Password. If you are a new branch, use the default credentials.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySecret = () => {
    if (!resetUserId || !inputSecret) {
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Username and Secret Code are required.' });
      return;
    }

    if (inputSecret === MASTER_SECRET) {
      const uIdLower = resetUserId.toLowerCase();
      const targetPassword = uIdLower === 'master' ? MASTER_USER_PASSWORD : DEFAULT_PASSWORD;
      
      setUserId(resetUserId);
      setPassword(targetPassword);
      setIsResetOpen(false);
      
      toast({
        title: 'Identity Verified',
        description: `System credentials for ${resetUserId} have been restored. You can now log in using the pre-filled fields.`,
      });
      
      setResetUserId('');
      setInputSecret('');
    } else {
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: 'Incorrect Master Secret Code. Please contact Head Office.',
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="space-y-1 text-center bg-primary/5 pb-8 pt-10">
          <div className="flex justify-center mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xl border-4 border-background transform -rotate-6 animate-in fade-in zoom-in duration-500">
              <Car className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black tracking-tighter text-primary uppercase">CITYDRIVE</CardTitle>
          <CardDescription className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
            Driving School Management Portal
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pt-6">
            {setupError && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>System Alert</AlertTitle>
                <AlertDescription className="text-[10px] font-medium">
                  Authentication service is currently restricted. Please enable Email/Password provider in the Firebase Console.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="userId" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">User ID / Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-primary/40" />
                <Input
                  id="userId"
                  placeholder="e.g. master, admin or Branch1"
                  className="pl-9 h-12 font-bold border-primary/10 bg-background focus:border-primary/30"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" title="Enter your secure password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Security Password</Label>
                <Button 
                  type="button" 
                  variant="link" 
                  className="px-0 font-bold text-primary h-auto text-[10px] uppercase tracking-tighter hover:no-underline"
                  onClick={() => setIsResetOpen(true)}
                >
                  Forgot Password?
                </Button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-primary/40" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9 h-12 font-bold border-primary/10 bg-background focus:border-primary/30"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-10 pt-2">
            <Button className="w-full h-14 text-base font-black shadow-lg uppercase tracking-widest" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Verifying Identity...
                </>
              ) : 'Sign In to Portal'}
            </Button>
            <div className="text-[9px] text-center text-muted-foreground uppercase tracking-[0.2em] font-black opacity-30 mt-4">
              &copy; {new Date().getFullYear()} Citydrive Management Systems
            </div>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-6 text-primary-foreground">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <ShieldCheck className="h-6 w-6" />
                Account Recovery
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/80 font-medium">
                Verify identity via Master Secret to restore default credentials.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-4 m-0">
            <p className="text-[11px] text-muted-foreground font-medium leading-relaxed bg-primary/5 p-3 rounded-lg border border-primary/10">
              Enter your User ID and the <span className="font-bold text-primary">Master Secret Code</span> provided by the Head Office to restore default login credentials.
            </p>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Your User ID</Label>
                <Input 
                  placeholder="e.g. Branch1" 
                  className="h-11 font-bold"
                  value={resetUserId} 
                  onChange={(e) => setResetUserId(e.target.value)} 
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Master Secret Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground opacity-50" />
                  <Input 
                    type="password" 
                    placeholder="Enter Secret Key" 
                    className="h-11 font-bold pl-9"
                    value={inputSecret} 
                    onChange={(e) => setInputSecret(e.target.value)} 
                  />
                </div>
              </div>
              <Button onClick={handleVerifySecret} className="w-full h-11 font-bold uppercase text-xs tracking-widest mt-2 shadow-md">
                Verify & Restore Defaults
              </Button>
            </div>
          </div>
          
          <div className="p-4 bg-muted/30 border-t flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => setIsResetOpen(false)} className="text-[10px] font-bold uppercase text-muted-foreground">
              Back to Login
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
