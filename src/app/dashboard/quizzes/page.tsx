
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, orderBy, where } from "firebase/firestore";
import { ClipboardCheck, PlusCircle, Trash2, PlayCircle, Clock, CheckCircle2, AlertTriangle, Sparkles, RefreshCw, Trophy, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateQuizQuestions } from "@/ai/flows/generate-quiz-flow";

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  timeLimit: number;
  passingMarks: number;
  questions: Question[];
  createdAt: any;
}

export default function QuizzesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const quizzesQuery = useMemoFirebase(() => (db ? query(collection(db, "quizzes"), orderBy("createdAt", "desc")) : null), [db]);
  const { data: quizzes, isLoading: isQuizzesLoading } = useCollection<Quiz>(quizzesQuery);

  const attemptsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null; // Ensure profile is loaded before querying
    if (isAdmin) return query(collection(db, "quizAttempts"), orderBy("completedAt", "desc"));
    return query(collection(db, "quizAttempts"), where("studentUid", "==", user.uid), orderBy("completedAt", "desc"));
  }, [db, user, profile, isAdmin]);
  const { data: attempts } = useCollection(attemptsQuery);

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isGenerating, setIsAIGenerating] = useState(false);

  // New Quiz Form
  const [newQuiz, setNewQuiz] = useState<Partial<Quiz>>({
    title: "",
    description: "",
    timeLimit: 10,
    passingMarks: 5,
    questions: []
  });

  const handleAddQuiz = () => {
    if (!newQuiz.title || newQuiz.questions!.length === 0) {
      toast({ variant: "destructive", title: "Incomplete", description: "Add a title and at least one question." });
      return;
    }
    const id = `QUIZ-${Date.now()}`;
    const quizRef = doc(db, "quizzes", id);
    setDocumentNonBlocking(quizRef, { ...newQuiz, id, createdAt: serverTimestamp() }, { merge: true });
    setIsCreateOpen(false);
    setNewQuiz({ title: "", description: "", timeLimit: 10, passingMarks: 5, questions: [] });
    toast({ title: "Quiz Created" });
  };

  const handleAIQuestions = async () => {
    if (!newQuiz.title) {
      toast({ variant: "destructive", title: "Topic Required", description: "Enter a title to guide the AI generation." });
      return;
    }
    setIsAIGenerating(true);
    try {
      const generated = await generateQuizQuestions({ topic: newQuiz.title, count: 5 });
      setNewQuiz({ ...newQuiz, questions: [...(newQuiz.questions || []), ...generated] });
      toast({ title: "Questions Generated", description: "Added 5 AI questions to your quiz." });
    } catch (e) {
      toast({ variant: "destructive", title: "AI Error", description: "Failed to generate questions. Try again." });
    } finally {
      setIsAIGenerating(false);
    }
  };

  if (activeQuiz) {
    return <QuizPlayer quiz={activeQuiz} onComplete={() => setActiveQuiz(null)} user={user} db={db} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Examinations & Quizzes</h2>
          <p className="text-muted-foreground text-sm">Test your knowledge of road signs and safety rules.</p>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create New Quiz
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-6 border-b">
                <DialogTitle>Management Quiz Builder</DialogTitle>
                <DialogDescription>Define questions manually or use AI to generate them.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6 pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Quiz Title (Required)</Label>
                      <Input placeholder="e.g. Mandatory Road Signs" value={newQuiz.title} onChange={(e) => setNewQuiz({...newQuiz, title: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Time Limit (Minutes)</Label>
                      <Input type="number" value={newQuiz.timeLimit} onChange={(e) => setNewQuiz({...newQuiz, timeLimit: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Short Description</Label>
                    <Textarea placeholder="What will students learn from this test?" value={newQuiz.description} onChange={(e) => setNewQuiz({...newQuiz, description: e.target.value})} />
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-lg font-bold">Questions ({newQuiz.questions?.length || 0})</Label>
                      <Button variant="outline" size="sm" onClick={handleAIQuestions} disabled={isGenerating} className="bg-primary/5 border-primary/20 hover:bg-primary/10">
                        {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2 text-primary" />}
                        Generate with AI
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {newQuiz.questions?.map((q, idx) => (
                        <div key={idx} className="p-4 rounded-xl border bg-muted/20 relative group">
                          <p className="text-sm font-bold pr-8">{idx + 1}. {q.question}</p>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className={`text-xs p-2 rounded border ${opt === q.correctAnswer ? 'bg-green-50 border-green-200 font-bold' : 'bg-background'}`}>
                                {opt}
                              </div>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setNewQuiz({...newQuiz, questions: newQuiz.questions?.filter((_, i) => i !== idx)})}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 border-t bg-muted/30">
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleAddQuiz}>Publish Quiz</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            Available Quizzes
          </h3>
          {isQuizzesLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : quizzes?.length === 0 ? (
            <Card className="border-dashed flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 opacity-10 mb-4" />
              <p>No tests published yet.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quizzes?.map((quiz) => (
                <Card key={quiz.id} className="group hover:border-primary/20 transition-all hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest">{quiz.questions.length} Qns</Badge>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => deleteDocumentNonBlocking(doc(db, "quizzes", quiz.id))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{quiz.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {quiz.timeLimit} Min</div>
                    <div className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Passing: {quiz.passingMarks}</div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full rounded-xl" onClick={() => setActiveQuiz(quiz)}>
                      Start Quiz Attempt
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {isAdmin ? "Global Performance" : "My Attempts"}
          </h3>
          <div className="space-y-4">
            {attempts?.slice(0, 10).map((att: any) => (
              <Card key={att.id} className="p-4 bg-muted/20 border-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">{att.quizTitle}</span>
                  <Badge className={att.passed ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                    {att.passed ? "Passed" : "Failed"}
                  </Badge>
                </div>
                {isAdmin && <p className="text-[10px] font-bold text-primary mb-1">Student: {att.userName}</p>}
                <div className="flex items-center justify-between text-sm">
                  <div className="font-black text-lg">{att.score} / {att.total}</div>
                  <span className="text-[10px] text-muted-foreground">{att.completedAt?.seconds ? new Date(att.completedAt.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                </div>
              </Card>
            ))}
            {(!attempts || attempts.length === 0) && <p className="text-xs text-muted-foreground italic text-center py-8">No attempts recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizPlayer({ quiz, onComplete, user, db }: { quiz: Quiz, onComplete: () => void, user: any, db: any }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(quiz.timeLimit * 60);
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) { finishQuiz(); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const finishQuiz = async () => {
    if (isFinished) return;
    setIsFinished(true);
    setIsSubmitting(true);

    let score = 0;
    quiz.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) score++;
    });

    const passed = score >= quiz.passingMarks;
    const attemptId = `ATT-${Date.now()}`;
    const attemptRef = doc(db, "quizAttempts", attemptId);

    setDocumentNonBlocking(attemptRef, {
      id: attemptId,
      studentUid: user.uid, // Use studentUid for consistent security rules
      userName: user.email?.split('@')[0] || 'Unknown',
      quizId: quiz.id,
      quizTitle: quiz.title,
      score,
      total: quiz.questions.length,
      passed,
      completedAt: serverTimestamp()
    }, { merge: true });

    setIsSubmitting(false);
  };

  const progress = ((currentIdx + 1) / quiz.questions.length) * 100;
  const currentQ = quiz.questions[currentIdx];

  if (isFinished) {
    let score = 0;
    quiz.questions.forEach((q, idx) => { if (answers[idx] === q.correctAnswer) score++; });
    const passed = score >= quiz.passingMarks;

    return (
      <div className="max-w-2xl mx-auto py-12 flex flex-col items-center text-center space-y-8">
        <div className={`h-24 w-24 rounded-full flex items-center justify-center shadow-xl ${passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
          {passed ? <Trophy className="h-12 w-12" /> : <AlertTriangle className="h-12 w-12" />}
        </div>
        <div className="space-y-2">
          <h2 className="text-4xl font-black">{passed ? "Congratulations!" : "Keep Practicing"}</h2>
          <p className="text-muted-foreground">You completed the {quiz.title} test.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 w-full max-w-sm">
          <Card className="p-6 bg-muted/30">
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Your Score</p>
            <p className="text-3xl font-black">{score} / {quiz.questions.length}</p>
          </Card>
          <Card className="p-6 bg-muted/30">
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Result</p>
            <p className={`text-xl font-black ${passed ? 'text-green-600' : 'text-red-600'}`}>{passed ? "PASSED" : "FAILED"}</p>
          </Card>
        </div>
        <Button size="lg" className="w-full max-w-xs" onClick={onComplete}>Back to Quizzes</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black">{quiz.title}</h2>
          <p className="text-sm text-muted-foreground">Question {currentIdx + 1} of {quiz.questions.length}</p>
        </div>
        <div className="flex items-center gap-3 bg-muted px-4 py-2 rounded-2xl border">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-mono font-bold text-lg">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
        <div className="p-8 bg-primary/5 border-b">
          <h3 className="text-xl font-bold leading-relaxed">{currentQ.question}</h3>
        </div>
        <CardContent className="p-8">
          <RadioGroup value={answers[currentIdx]} onValueChange={(val) => setAnswers({...answers, [currentIdx]: val})} className="grid gap-4">
            {currentQ.options.map((opt, i) => (
              <Label key={i} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${answers[currentIdx] === opt ? 'border-primary bg-primary/5' : 'hover:border-primary/20'}`}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={opt} id={`opt-${i}`} />
                  <span className="font-medium">{opt}</span>
                </div>
                {answers[currentIdx] === opt && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
        <CardFooter className="p-8 border-t bg-muted/10 flex justify-between">
          <Button variant="ghost" onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))} disabled={currentIdx === 0}>Previous</Button>
          {currentIdx === quiz.questions.length - 1 ? (
            <Button size="lg" className="px-8 shadow-lg" onClick={finishQuiz} disabled={!answers[currentIdx] || isSubmitting}>
              Finish Attempt
            </Button>
          ) : (
            <Button size="lg" className="px-8" onClick={() => setCurrentIdx(prev => prev + 1)} disabled={!answers[currentIdx]}>
              Next Question
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
