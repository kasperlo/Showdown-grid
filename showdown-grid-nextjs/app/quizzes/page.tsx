"use client";

import { useEffect, useState, useCallback } from "react";
import { useGameStore } from "@/utils/store";
import { useRouter } from "next/navigation";
import { usePublicQuizzes } from "@/hooks/usePublicQuizzes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Check, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { QuizMetadata } from "@/utils/types";

export default function QuizzesPage() {
  const router = useRouter();
  const {
    quizzesList,
    activeQuizId,
    loadQuizzesList,
    switchQuiz,
    loadPublicQuiz,
    createNewQuiz,
    deleteQuiz,
  } = useGameStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [newQuizDescription, setNewQuizDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Use custom hook for public quizzes
  const { publicQuizzes, isLoadingPublic } = usePublicQuizzes();

  // Load user's quizzes on mount
  useEffect(() => {
    loadQuizzesList();
  }, [loadQuizzesList]);

  // Stable callback for creating quiz
  const handleCreateQuiz = useCallback(async () => {
    if (!newQuizTitle.trim()) {
      toast({
        title: "Feil",
        description: "Quizzen må ha en tittel",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      await createNewQuiz(newQuizTitle, newQuizDescription || undefined);
      setIsCreateDialogOpen(false);
      setNewQuizTitle("");
      setNewQuizDescription("");
      toast({
        title: "Suksess!",
        description: "Ny quiz opprettet",
      });
    } catch (error) {
      toast({
        title: "Feil",
        description: "Kunne ikke opprette quiz",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }, [createNewQuiz, newQuizTitle, newQuizDescription]);

  // Stable callback for activating quiz
  const handleActivateQuiz = useCallback(async (quizId: string, isPublic: boolean = false) => {
    if (quizId === activeQuizId) return;

    try {
      if (isPublic) {
        // Load public quiz without activating it in the database
        await loadPublicQuiz(quizId);
        toast({
          title: "Lastet quiz!",
          description: "Klar til å spille",
        });
      } else {
        // Activate user's own quiz
        await switchQuiz(quizId);
        toast({
          title: "Byttet quiz!",
          description: "Den valgte quizzen er nå aktiv",
        });
      }
      router.push("/");
    } catch (error) {
      toast({
        title: "Feil",
        description: isPublic ? "Kunne ikke laste quiz" : "Kunne ikke bytte quiz",
        variant: "destructive",
      });
    }
  }, [activeQuizId, loadPublicQuiz, switchQuiz, router]);

  // Stable callback for deleting quiz
  const handleDeleteQuiz = useCallback(async (quizId: string) => {
    try {
      await deleteQuiz(quizId);
      toast({
        title: "Slettet!",
        description: "Quizzen ble slettet",
      });
    } catch (error) {
      toast({
        title: "Feil",
        description: "Kunne ikke slette quiz",
        variant: "destructive",
      });
    }
  }, [deleteQuiz]);

  // Stable callback for rendering quiz cards
  const renderQuizCard = useCallback((quiz: QuizMetadata, isPublic: boolean = false) => (
    <Card
      key={quiz.id}
      className={`relative group cursor-pointer transition-all hover:shadow-lg ${
        quiz.id === activeQuizId ? "border-primary shadow-md" : ""
      }`}
      onClick={() => handleActivateQuiz(quiz.id, isPublic)}
    >
      {quiz.id === activeQuizId && (
        <div className="absolute top-2 right-2">
          <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <Check className="h-3 w-3" />
            Aktiv
          </span>
        </div>
      )}
      {isPublic && quiz.is_public && (
        <div className="absolute top-2 left-2">
          <span className="bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Offentlig
          </span>
        </div>
      )}
      <CardHeader>
        <CardTitle className="pr-16 group-hover:text-primary transition-colors">
          {quiz.title}
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {quiz.description}
        </CardDescription>
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <span className="capitalize">{quiz.theme}</span>
          {quiz.time_limit && <span>• {quiz.time_limit}s timer</span>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end">
          {!isPublic && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Dette vil permanent slette quizzen "{quiz.title}".
                    Denne handlingen kan ikke angres.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteQuiz(quiz.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Slett
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  ), [activeQuizId, handleActivateQuiz, handleDeleteQuiz]);

  return (
    <main className="stage min-h-screen">
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              aria-label="Tilbake"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Quizzer</h1>
              <p className="text-muted-foreground">
                Bla gjennom offentlige quizzer eller administrer dine egne
              </p>
            </div>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Ny Quiz
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Opprett ny quiz</DialogTitle>
                <DialogDescription>
                  Gi quizzen din en tittel og beskrivelse
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-medium">
                    Tittel
                  </label>
                  <Input
                    id="title"
                    placeholder="Min Quiz"
                    value={newQuizTitle}
                    onChange={(e) => setNewQuizTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Beskrivelse
                  </label>
                  <Textarea
                    id="description"
                    placeholder="En Jeopardy-stil quiz"
                    value={newQuizDescription}
                    onChange={(e) => setNewQuizDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Avbryt
                </Button>
                <Button onClick={handleCreateQuiz} disabled={isCreating}>
                  {isCreating ? "Oppretter..." : "Opprett"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="public" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-popover mb-6">
            <TabsTrigger value="public">
              <Globe className="h-4 w-4 mr-2" />
              Offentlige
            </TabsTrigger>
            <TabsTrigger value="mine">Mine Quizzer</TabsTrigger>
          </TabsList>

          {/* Public Quizzes Tab */}
          <TabsContent value="public">
            {isLoadingPublic ? (
              <div className="text-center p-12">
                <p className="text-muted-foreground">Laster offentlige quizzer...</p>
              </div>
            ) : publicQuizzes.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {publicQuizzes.map((quiz) => renderQuizCard(quiz, true))}
              </div>
            ) : (
              <Card className="text-center p-12">
                <CardContent>
                  <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Ingen offentlige quizzer tilgjengelig ennå
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Quizzes Tab */}
          <TabsContent value="mine">
            {quizzesList.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {quizzesList.map((quiz) => renderQuizCard(quiz, false))}
              </div>
            ) : (
              <Card className="text-center p-12">
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Du har ingen quizzer ennå
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Opprett din første quiz
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
