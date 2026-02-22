
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { FileVideo, FileText, Link as LinkIcon, PlusCircle, Trash2, ExternalLink, GraduationCap, PlayCircle, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'Video' | 'PDF' | 'Link';
  url: string;
  createdAt: any;
}

export default function ResourcesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const resourcesQuery = useMemoFirebase(() => (db ? collection(db, "resources") : null), [db]);
  const { data: resources, isLoading } = useCollection<Resource>(resourcesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "Video" as 'Video' | 'PDF' | 'Link',
    url: ""
  });

  const handleSaveResource = () => {
    if (!formData.title || !formData.url) {
      toast({ variant: "destructive", title: "Required", description: "Title and URL are mandatory." });
      return;
    }

    const id = `RES-${Date.now()}`;
    const resourceRef = doc(db, "resources", id);
    setDocumentNonBlocking(resourceRef, {
      ...formData,
      id,
      createdAt: serverTimestamp(),
      createdBy: user?.uid
    }, { merge: true });

    setIsDialogOpen(false);
    setFormData({ title: "", description: "", type: "Video", url: "" });
    toast({ title: "Resource Added", description: "Material is now available for students." });
  };

  const handleDeleteResource = (id: string) => {
    deleteDocumentNonBlocking(doc(db, "resources", id));
    toast({ variant: "destructive", title: "Resource Removed" });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Video': return <PlayCircle className="h-10 w-10 text-red-500" />;
      case 'PDF': return <BookOpen className="h-10 w-10 text-blue-500" />;
      default: return <LinkIcon className="h-10 w-10 text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Learning Resources</h2>
          <p className="text-muted-foreground text-sm">Study materials, tutorial videos, and reference guides.</p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Material
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Study Material</DialogTitle>
                <DialogDescription>Link your Drive videos, PDFs, or external guides.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input placeholder="e.g. Traffic Signs Guide" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Resource Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Video">Video Tutorial (Drive/YouTube)</SelectItem>
                      <SelectItem value="PDF">PDF Guide/Document</SelectItem>
                      <SelectItem value="Link">External Website Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>URL (Link)</Label>
                  <Input placeholder="https://drive.google.com/..." value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Description (Optional)</Label>
                  <Textarea placeholder="Brief summary of the content..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveResource} className="w-full">Upload Resource</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>
      ) : resources?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-3xl bg-muted/5">
          <GraduationCap className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-xl font-bold">No Resources Yet</h3>
          <p className="text-muted-foreground max-w-sm">Materials uploaded by administrators will appear here for student learning.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources?.map((res) => (
            <Card key={res.id} className="group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-primary/10 overflow-hidden">
              <CardHeader className="flex flex-row items-start gap-4 pb-4">
                <div className="p-3 bg-muted rounded-2xl group-hover:bg-primary/5 transition-colors">
                  {getIcon(res.type)}
                </div>
                <div className="grid flex-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="mb-1 text-[9px] uppercase font-bold">{res.type}</Badge>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteResource(res.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CardTitle className="text-lg leading-tight line-clamp-1">{res.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                  {res.description || "No description provided."}
                </p>
                <Button asChild className="w-full shadow-lg" size="lg">
                  <a href={res.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Material
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
