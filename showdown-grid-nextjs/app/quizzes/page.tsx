"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useGameStore } from "@/utils/store";
import {
  usePublicQuizzes,
  useQuizzesList,
  quizKeys,
} from "@/hooks/queries/useQuizzes";
import {
  useCreateQuiz,
  useActivateQuiz,
  useDeleteQuiz,
} from "@/hooks/mutations/useQuizMutations";
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
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Check,
  Copy,
  Globe,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { UserMenu } from "@/components/UserMenu";
import { rememberPublicPlay } from "@/utils/live-snapshot";
import type { QuizMetadata } from "@/utils/types";

export default function QuizzesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeQuizId = useGameStore((s) => s.activeQuizId);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [search, setSearch] = useState("");
  const [quizToDelete, setQuizToDelete] = useState<QuizMetadata | null>(null);

  const { data: myQuizzes = [], isLoading: isLoadingMine } = useQuizzesList();
  const { data: publicQuizzes = [], isLoading: isLoadingPublic } =
    usePublicQuizzes();
  const createQuiz = useCreateQuiz();
  const activateQuiz = useActivateQuiz();
  const deleteQuiz = useDeleteQuiz();

  const filter = useCallback(
    (quizzes: QuizMetadata[]) => {
      const needle = search.trim().toLowerCase();
      if (!needle) return quizzes;
      return quizzes.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(needle) ||
          (quiz.description ?? "").toLowerCase().includes(needle)
      );
    },
    [search]
  );

  const filteredMine = useMemo(() => filter(myQuizzes), [filter, myQuizzes]);
  const hasActiveQuiz = Boolean(activeQuizId) || myQuizzes.some((q) => q.is_active);
  const filteredPublic = useMemo(
    () => filter(publicQuizzes),
    [filter, publicQuizzes]
  );

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast({
        title: "Tittel mangler",
        description: "Quizzen må ha et navn.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Straight into the editor: a new quiz is empty, and the only useful next
      // step is filling it in. It used to land you back on this list.
      const quiz = await createQuiz.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        setAsActive: true,
      });
      rememberPublicPlay(null);
      useGameStore.setState({ isHydrated: false, activeQuizId: null });
      queryClient.invalidateQueries({ queryKey: quizKeys.active() });
      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      toast({ title: "Quiz opprettet", description: quiz.title });
      router.push("/setup");
    } catch (error) {
      toast({
        title: "Kunne ikke opprette quiz",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const openOwnQuiz = async (quizId: string, destination: "/" | "/setup") => {
    try {
      rememberPublicPlay(null);
      await activateQuiz.mutateAsync(quizId);
      // Forces useQuizBootstrap to fetch the newly activated quiz instead of
      // keeping whatever is already in the store.
      useGameStore.setState({
        isHydrated: false,
        activeQuizId: null,
        isPlayingPublicQuiz: false,
      });
      router.push(destination);
    } catch {
      toast({
        title: "Kunne ikke åpne quizzen",
        variant: "destructive",
      });
    }
  };

  const playPublicQuiz = (quizId: string) => {
    rememberPublicPlay(quizId);
    useGameStore.setState({
      isHydrated: false,
      activeQuizId: null,
      isPlayingPublicQuiz: true,
    });
    router.push("/");
  };

  const copyQuiz = async (quiz: QuizMetadata) => {
    try {
      await createQuiz.mutateAsync({
        title: `${quiz.title} (kopi)`,
        description: quiz.description,
        copyFromQuizId: quiz.id,
      });
      toast({
        title: "Kopi laget",
        description: "Du finner den under Mine quizzer.",
      });
    } catch (error) {
      toast({
        title: "Kunne ikke kopiere",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    }
  };

  const renderCard = (quiz: QuizMetadata, isPublicList: boolean) => {
    // is_active comes from the list endpoint: this page does not load a quiz,
    // so the store does not know which one is active on a fresh visit.
    const isActive = quiz.is_active ?? quiz.id === activeQuizId;
    const isMine = !isPublicList || quiz.isOwnedByCurrentUser;

    return (
      <Card key={quiz.id} className="flex flex-col">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            {/* The badge used to sit on top of the title and cut it in half. */}
            <CardTitle className="min-w-0 break-words text-lg leading-snug">
              {quiz.title}
            </CardTitle>
            {isActive && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">
                <Check className="h-3 w-3" />
                Aktiv
              </span>
            )}
          </div>
          <CardDescription className="line-clamp-2">
            {quiz.description || "Ingen beskrivelse"}
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {quiz.is_public && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
                <Globe className="h-3 w-3" />
                Offentlig
              </span>
            )}
            <span className="capitalize">{quiz.theme}</span>
            {typeof quiz.category_count === "number" && (
              <span>
                {quiz.category_count} kat. / {quiz.question_count ?? 0} spm.
              </span>
            )}
            {quiz.time_limit && <span>{quiz.time_limit}s per spørsmål</span>}
          </div>
        </CardHeader>

        <CardContent className="mt-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="gap-1"
            onClick={() =>
              isPublicList && !isMine
                ? playPublicQuiz(quiz.id)
                : openOwnQuiz(quiz.id, "/")
            }
          >
            <Play className="h-4 w-4" />
            Spill
          </Button>

          {isMine ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => openOwnQuiz(quiz.id, "/setup")}
            >
              <Pencil className="h-4 w-4" />
              Rediger
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => copyQuiz(quiz)}
              disabled={createQuiz.isPending}
            >
              <Copy className="h-4 w-4" />
              Kopier
            </Button>
          )}

          {!isPublicList && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => copyQuiz(quiz)}
                disabled={createQuiz.isPending}
                title="Lag en kopi"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={() => setQuizToDelete(quiz)}
                title={`Slett ${quiz.title}`}
                aria-label={`Slett ${quiz.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const skeletons = (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );

  return (
    <main className="stage min-h-screen">
      <div className="container mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Only shown when there is somewhere to go back TO. Without an
                active quiz, "/" bounces straight back here, so the arrow looked
                broken. */}
            {hasActiveQuiz && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/")}
                aria-label="Tilbake til brettet"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Bibliotek</h1>
              <p className="text-sm text-muted-foreground">
                Spill en offentlig quiz, eller lag din egen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Ny quiz
            </Button>
            {/* A guest with no quizzes always lands here, and this used to be
                the one page with no way to sign out or sign in. */}
            <UserMenu />
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i quizzer"
            className="pl-9"
            aria-label="Søk i quizzer"
          />
        </div>

        <Tabs defaultValue="mine" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-2 bg-popover">
            <TabsTrigger value="mine">
              Mine quizzer
              {myQuizzes.length > 0 && ` (${myQuizzes.length})`}
            </TabsTrigger>
            <TabsTrigger value="public">
              <Globe className="mr-2 h-4 w-4" />
              Offentlige
              {publicQuizzes.length > 0 && ` (${publicQuizzes.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mine">
            {isLoadingMine ? (
              skeletons
            ) : filteredMine.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredMine.map((quiz) => renderCard(quiz, false))}
              </div>
            ) : (
              <Card className="p-10 text-center">
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    {myQuizzes.length === 0
                      ? "Du har ingen quizzer enda."
                      : "Ingen treff på søket."}
                  </p>
                  {myQuizzes.length === 0 && (
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Lag din første quiz
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="public">
            {isLoadingPublic ? (
              skeletons
            ) : filteredPublic.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPublic.map((quiz) => renderCard(quiz, true))}
              </div>
            ) : (
              <Card className="p-10 text-center">
                <CardContent>
                  <Globe className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {publicQuizzes.length === 0
                      ? "Ingen offentlige quizzer enda."
                      : "Ingen treff på søket."}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny quiz</DialogTitle>
            <DialogDescription>
              Du får et tomt brett med fem kategorier og fem spørsmål i hver.
            </DialogDescription>
          </DialogHeader>
          {/* A real form, so Enter submits the way it does in every other
              dialog. A keydown handler on the input only looked like it did. */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <label htmlFor="new-title" className="text-sm font-medium">
                  Tittel
                </label>
                <Input
                  id="new-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Julequiz 2026"
                  // The dialog opens with the cursor here, so the name can be
                  // typed without aiming at the field first.
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-description" className="text-sm font-medium">
                  Beskrivelse (valgfritt)
                </label>
                <Textarea
                  id="new-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={createQuiz.isPending}>
                {createQuiz.isPending ? "Oppretter…" : "Opprett og rediger"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!quizToDelete}
        onOpenChange={(open) => !open && setQuizToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Slette «{quizToDelete?.title}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Quizzen og historikken fra øktene som er spilt på den blir borte.
              Kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const target = quizToDelete;
                setQuizToDelete(null);
                if (!target) return;
                try {
                  await deleteQuiz.mutateAsync(target.id);
                  toast({ title: "Slettet", description: target.title });
                } catch {
                  toast({
                    title: "Kunne ikke slette",
                    variant: "destructive",
                  });
                }
              }}
            >
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
