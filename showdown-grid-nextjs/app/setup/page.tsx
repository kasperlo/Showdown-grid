"use client";

import { useRef, useState } from "react";
import { useGameStore } from "@/utils/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
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
import AdminAdjust from "@/components/AdminAdjust";

export default function Setup() {
  const {
    categories,
    setCategories,
    teams,
    addTeam,
    removeTeam,
    updateTeamName,
    updateTeamPlayers,
    resetGame,
    gameTitle,
    setGameTitle,
    gameDescription,
    setGameDescription,
    addCategory,
    removeCategory,
    saveQuizToDB,
    isSaving,
    hasUnsavedChanges,
  } = useGameStore();
  const router = useRouter();

  const handleCategoryNameChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    categoryIndex: number
  ) => {
    const newCategories = [...categories];
    newCategories[categoryIndex].name = e.target.value;
    setCategories(newCategories);
  };

  const handleQuestionChange = (
    categoryIndex: number,
    questionIndex: number,
    field: "question" | "answer" | "imageUrl" | "isJoker" | "jokerTask",
    value: string | boolean
  ) => {
    const newCategories = [...categories];
    const question = newCategories[categoryIndex].questions[questionIndex];

    // Create a new question object with the updated field
    const updatedQuestion = {
      ...question,
      [field]: value,
    };

    // If we're turning off the joker, clear the task
    if (field === "isJoker" && !value) {
      updatedQuestion.jokerTask = "";
    }

    newCategories[categoryIndex].questions[questionIndex] = updatedQuestion;
    setCategories(newCategories);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="container mx-auto max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="display-lg text-accent">Oppsett</h1>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => saveQuizToDB()}
              disabled={!hasUnsavedChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lagrer...
                </>
              ) : (
                "Lagre"
              )}
            </Button>
            <Button onClick={() => router.push("/")}>Til spillet</Button>
          </div>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-popover">
            <TabsTrigger value="general">Generelt</TabsTrigger>
            <TabsTrigger value="teams">Lag</TabsTrigger>
            <TabsTrigger value="questions">Spørsmål</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>

          {/* Generelt */}
          <TabsContent value="general">
            <div className="glass p-6 rounded-b-lg space-y-6">
              <div>
                <Label className="text-xl font-semibold text-accent">Spilltittel</Label>
                <Input
                  type="text"
                  value={gameTitle}
                  onChange={(e) => setGameTitle(e.target.value)}
                  className="mt-2"
                  placeholder="Navnet på quizen din"
                />
              </div>
              <div>
                <Label className="text-xl font-semibold text-accent">Spillbeskrivelse</Label>
                <Textarea
                  value={gameDescription}
                  onChange={(e) => setGameDescription(e.target.value)}
                  className="mt-2"
                  placeholder="En kort beskrivelse av quizen"
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>

          {/* Lag */}
          <TabsContent value="teams">
            <div className="glass p-6 rounded-b-lg">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Administrer lag</h2>
                <Button onClick={addTeam}>Legg til lag</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {teams.map((team) => (
                  <div key={team.id} className="tile p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-lg font-semibold">Lagnavn</Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTeam(team.id)}
                        className="text-destructive hover:text-destructive/90"
                        title="Fjern lag"
                        aria-label="Fjern lag"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                    <Input
                      type="text"
                      value={team.name}
                      onChange={(e) => updateTeamName(team.id, e.target.value)}
                    />
                    <div>
                      <Label>Spillere (komma-separert)</Label>
                      <Input
                        type="text"
                        value={team.players.join(", ")}
                        onChange={(e) =>
                          updateTeamPlayers(
                            team.id,
                            e.target.value.split(",").map((p) => p.trim())
                          )
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-border text-center">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Reset Game State</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Er du helt sikker?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dette nullstiller **score** og **answered** på alle spørsmål.
                        Lag og egendefinerte kategorier beholdes. Kan ikke angres.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Avbryt</AlertDialogCancel>
                      <AlertDialogAction onClick={() => resetGame()}>
                        Fortsett
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </TabsContent>

          {/* Spørsmål */}
          <TabsContent value="questions">
            <div className="space-y-8 p-1">
              <div className="flex justify-end p-4">
                <Button onClick={() => addCategory()}>Legg til kategori</Button>
              </div>
              {categories.map((category, categoryIndex) => (
                <div key={categoryIndex} className="tile p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <Label className="text-xl font-semibold text-accent">Kategorinavn</Label>
                      <Input
                        type="text"
                        value={category.name}
                        onChange={(e) => handleCategoryNameChange(e, categoryIndex)}
                        className="mt-2"
                      />
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/90 -mt-2 -mr-2"
                          title="Fjern kategori"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Fjerne kategorien "{category.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Dette vil slette kategorien og alle tilhørende spørsmål permanent. Handlingen kan ikke angres.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeCategory(categoryIndex)}>
                            Slett
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {category.questions.map((question, questionIndex) => (
                      <div key={questionIndex} className="tile p-4 space-y-3">
                        <h3 className="font-bold text-lg">
                          Spørsmål for {question.points} poeng
                        </h3>

                        <div>
                          <Label>Spørsmål</Label>
                          <Input
                            type="text"
                            value={question.question}
                            onChange={(e) =>
                              handleQuestionChange(
                                categoryIndex,
                                questionIndex,
                                "question",
                                e.target.value
                              )
                            }
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>Svar</Label>
                          <Input
                            type="text"
                            value={question.answer}
                            onChange={(e) =>
                              handleQuestionChange(
                                categoryIndex,
                                questionIndex,
                                "answer",
                                e.target.value
                              )
                            }
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>Bilde-URL</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="text"
                              placeholder="Lim inn URL til bilde"
                              value={question.imageUrl || ""}
                              onChange={(e) =>
                                handleQuestionChange(
                                  categoryIndex,
                                  questionIndex,
                                  "imageUrl",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          {question.imageUrl && (
                            <div className="mt-2 relative">
                              <img
                                src={question.imageUrl}
                                alt="Forhåndsvisning"
                                className="rounded-lg max-h-32 w-full object-contain border bg-muted/30"
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => handleQuestionChange(categoryIndex, questionIndex, "imageUrl", "")}
                                title="Fjern bilde"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-3 pt-3 border-t border-border">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`joker-switch-${categoryIndex}-${questionIndex}`}>Joker</Label>
                            <Switch
                              id={`joker-switch-${categoryIndex}-${questionIndex}`}
                              checked={question.isJoker}
                              onCheckedChange={(checked) =>
                                handleQuestionChange(
                                  categoryIndex,
                                  questionIndex,
                                  "isJoker",
                                  checked
                                )
                              }
                            />
                          </div>
                          {question.isJoker && (
                            <div>
                              <Label>Joker-oppgave</Label>
                              <Textarea
                                value={question.jokerTask}
                                onChange={(e) =>
                                  handleQuestionChange(
                                    categoryIndex,
                                    questionIndex,
                                    "jokerTask",
                                    e.target.value
                                  )
                                }
                                placeholder="Beskriv oppgaven som må løses..."
                                className="mt-1"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Admin */}
          <TabsContent value="admin">
            <div className="glass p-6 rounded-b-lg">
              <p className="text-sm text-muted-foreground mb-4">
                Manuelle justeringer skjer utenfor runder og loggføres.
              </p>
              <AdminAdjust />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
