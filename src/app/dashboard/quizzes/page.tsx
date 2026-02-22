"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { PlusCircle, Trash2, ExternalLink, ClipboardCheck, BookOpen, Car, GraduationCap, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuizLink {
  id: string;
  title: string;
  category: 'Learners' | 'Heavy' | 'General' | 'Other';
  url: string;
  description: string;
  createdAt: any;
}

export default function QuizzesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const quizzesQuery = useMemoFirebase(() => (db ? collection(db, "quizLinks") : null), [db]);
  const { data: quizzes, isLoading } = useCollection<QuizLink>(quizzesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "Learners" as QuizLink['category'],
    url: "",
    description: ""
  });

  const handleSaveQuiz = () => {
    if (!formData.title || !formData.url) {
      toast({ variant: "destructive", title: "Required", description: "Title and Quiz URL are mandatory." });
      return;
    }

    const id = `QUIZ-${Date.now()}`;
    const quizRef = doc(db, "quizLinks", id);
    setDocumentNonBlocking(quizRef, {
      ...formData,
      id,
      createdAt: serverTimestamp(),
      createdBy: user?.uid
    }, { merge: true });

    setIsDialogOpen(false);
    setFormData({ title: "", category: "Learners", url: "", description: "" });
    toast({ title: "Quiz Added", description: "The quiz link has been published for students." });
  };

  const handleDeleteQuiz = (id: string) => {
    deleteDocumentNonBlocking(doc(db, "quizLinks", id));
    toast({ variant: "destructive", title: "Quiz Removed" });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Learners': return <GraduationCap className="h-10 w-10 text-primary" />;
      case 'Heavy': return <Car className="h-10 w-10 text-orange-600" />;
      default: return <BookOpen className="h-10 w-10 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Practice Quizzes</h2>
          <p className="text-muted-foreground text-sm">Prepare for your driving tests with these curated quizzes.</p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Quiz Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Quiz</DialogTitle>
                <DialogDescription>Enter the details and the external link for the practice test.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Quiz Title</Label>
                  <Input placeholder="e.g. Learners License Mock Test #1" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Learners">Learners License</SelectItem>
                      <SelectItem value="Heavy">Heavy Vehicle</SelectItem>
                      <SelectItem value="General">General Traffic Rules</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Quiz URL</Label>
                  <Input placeholder="https://external-quiz-portal.com/test..." value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Short Description (Optional)</Label>
                  <Input placeholder="What does this quiz cover?" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveQuiz} className="w-full">Publish Quiz</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
      ) : quizzes?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-3xl bg-muted/5">
          <ClipboardCheck className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-xl font-bold">No Quizzes Available</h3>
          <p className="text-muted-foreground max-w-sm">Administration has not added any practice tests yet. Please check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes?.map((quiz) => (
            <Card key={quiz.id} className="group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-primary/10 overflow-hidden">
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="p-3 bg-muted rounded-2xl group-hover:bg-primary/5 transition-colors">
                  {getCategoryIcon(quiz.category)}
                </div>
                <div className="grid flex-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="mb-1 text-[9px] uppercase font-bold text-primary border-primary/20">{quiz.category}</Badge>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteQuiz(quiz.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CardTitle className="text-lg leading-tight line-clamp-1">{quiz.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                  {quiz.description || "Practice your skills with this specialized driving quiz."}
                </p>
                <Button asChild className="w-full shadow-md" size="lg" variant="default">
                  <a href={quiz.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Start Quiz
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}