"use client";

import { useState } from "react";
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
import { ThemeSelector } from "@/components/ThemeSelector";
import { ImageUpload } from "@/components/ImageUpload";

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
    quizTitle,
    setQuizTitle,
    quizDescription,
    setQuizDescription,
    quizTimeLimit,
    setQuizTimeLimit,
    quizIsPublic,
    setQuizIsPublic,
    addCategory,
    removeCategory,
    saveQuizToDB,
    isSaving,
    hasUnsavedChanges,
  } = useGameStore();
  const router = useRouter();
  const [timerEnabled, setTimerEnabled] = useState(quizTimeLimit !== null);
  const [timerValue, setTimerValue] = useState<number | "">(
    quizTimeLimit || 60
  );

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
    field: "question" | "answer" | "imageUrl" | "isJoker" | "jokerTask" | "jokerTimer" | "points",
    value: string | boolean | number
  ) => {
    const newCategories = [...categories];
    const question = newCategories[categoryIndex].questions[questionIndex];

    // Create a new question object with the updated field
    const updatedQuestion = {
      ...question,
      [field]: value,
    };

    // If we're turning off the joker, clear the task and reset timer
    if (field === "isJoker" && !value) {
      updatedQuestion.jokerTask = "";
      updatedQuestion.jokerTimer = 10;
    }

    // If turning on joker, set default timer if not set
    if (field === "isJoker" && value && !updatedQuestion.jokerTimer) {
      updatedQuestion.jokerTimer = 10;
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
            <div className="glass p-6 rounded-b-lg space-y-8">
              <div>
                <Label className="text-xl font-semibold text-accent">
                  Spilltittel
                </Label>
                <Input
                  type="text"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="mt-2"
                  placeholder="Navnet på quizen din"
                />
              </div>
              <div>
                <Label className="text-xl font-semibold text-accent">
                  Spillbeskrivelse
                </Label>
                <Textarea
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  className="mt-2"
                  placeholder="En kort beskrivelse av quizen"
                  rows={3}
                />
              </div>

              <div className="border-t border-border pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xl font-semibold text-accent">
                        Tidsbegrensning
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Aktiver nedtelling på alle spørsmål
                      </p>
                    </div>
                    <Switch
                      checked={timerEnabled}
                      onCheckedChange={(checked) => {
                        setTimerEnabled(checked);
                        const valueToSet = timerValue === "" ? 60 : timerValue;
                        if (checked && timerValue === "") {
                          setTimerValue(60);
                        }
                        setQuizTimeLimit(checked ? valueToSet : null);
                      }}
                    />
                  </div>

                  {timerEnabled && (
                    <div className="space-y-3">
                      <Label>Antall sekunder</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          min="10"
                          max="300"
                          value={timerValue}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            // Allow empty string while typing
                            if (inputValue === "") {
                              setTimerValue("");
                              return;
                            }
                            const value = parseInt(inputValue);
                            if (!isNaN(value)) {
                              setTimerValue(value);
                              setQuizTimeLimit(value);
                            }
                          }}
                          onBlur={(e) => {
                            // If empty on blur, set to default 60
                            if (e.target.value === "") {
                              setTimerValue(60);
                              setQuizTimeLimit(60);
                            }
                          }}
                          className="max-w-xs"
                        />
                        <div className="flex gap-2">
                          {[30, 60, 90, 120].map((seconds) => (
                            <Button
                              key={seconds}
                              type="button"
                              variant={
                                timerValue === seconds ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => {
                                setTimerValue(seconds);
                                setQuizTimeLimit(seconds);
                              }}
                            >
                              {seconds}s
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <ThemeSelector />
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xl font-semibold text-accent">
                      Offentlig Quiz
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Gjør quizen synlig for alle brukere i det offentlige
                      galleriet
                    </p>
                  </div>
                  <Switch
                    checked={quizIsPublic}
                    onCheckedChange={(checked) => setQuizIsPublic(checked)}
                  />
                </div>
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
                    <Button variant="destructive">Nullstill</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Er du helt sikker?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dette nullstiller **poeng** og **svar** på alle
                        spørsmål. Lag, kategorier og spørsmål beholdes. Kan ikke
                        angres.
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
                      <Label className="text-xl font-semibold text-accent">
                        Kategorinavn
                      </Label>
                      <Input
                        type="text"
                        value={category.name}
                        onChange={(e) =>
                          handleCategoryNameChange(e, categoryIndex)
                        }
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
                          <AlertDialogTitle>
                            Fjerne kategorien &ldquo;{category.name}&rdquo;?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Dette vil slette kategorien og alle tilhørende
                            spørsmål permanent. Handlingen kan ikke angres.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeCategory(categoryIndex)}
                          >
                            Slett
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {category.questions.map((question, questionIndex) => (
                      <div
                        key={questionIndex}
                        className={`tile p-4 space-y-3 transition-all duration-300 ${
                          question.isJoker
                            ? "ring-2 ring-yellow-400 bg-gradient-to-br from-yellow-500/10 via-red-500/10 to-purple-500/10"
                            : ""
                        }`}
                      >
                        {/* JOKER badge og bilde når aktivert */}
                        {question.isJoker && (
                          <div className="flex items-center gap-3 pb-3 border-b border-yellow-400/50">
                            <img
                              src="/JOKER.jpg"
                              alt="JOKER"
                              className="w-12 h-12 object-cover rounded-lg border-2 border-yellow-400 shadow-md"
                            />
                            <div className="bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 text-white px-4 py-1 rounded-full text-sm font-black tracking-wider shadow-md">
                              JOKER
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <Label className="text-sm font-semibold">Poeng:</Label>
                          <Input
                            type="number"
                            min={0}
                            step={50}
                            value={question.points}
                            onChange={(e) =>
                              handleQuestionChange(
                                categoryIndex,
                                questionIndex,
                                "points",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-24 h-8"
                          />
                        </div>

                        {/* Skjul spørsmål/svar/bilde for joker-oppgaver */}
                        {!question.isJoker && (
                          <>
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

                            <ImageUpload
                              value={question.imageUrl}
                              onChange={(url) =>
                                handleQuestionChange(
                                  categoryIndex,
                                  questionIndex,
                                  "imageUrl",
                                  url
                                )
                              }
                              label="Bilde"
                            />
                          </>
                        )}
                        <div className="space-y-3 pt-3 border-t border-border">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor={`joker-switch-${categoryIndex}-${questionIndex}`}
                            >
                              Joker
                            </Label>
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
                            <div className="space-y-4 p-3 bg-gradient-to-br from-yellow-500/5 via-red-500/5 to-purple-500/5 rounded-lg border border-yellow-400/30">
                              <div>
                                <Label className="text-yellow-600 dark:text-yellow-400 font-semibold">
                                  Joker-oppgave
                                </Label>
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
                              <div>
                                <Label className="text-yellow-600 dark:text-yellow-400 font-semibold">
                                  Timer (sekunder)
                                </Label>
                                <div className="flex items-center gap-3 mt-1">
                                  <Input
                                    type="number"
                                    min={3}
                                    max={60}
                                    value={question.jokerTimer || ""}
                                    onChange={(e) => {
                                      const inputValue = e.target.value;
                                      // Allow empty string (will be treated as undefined)
                                      if (inputValue === "") {
                                        handleQuestionChange(
                                          categoryIndex,
                                          questionIndex,
                                          "jokerTimer",
                                          0 // Use 0 to represent "not set"
                                        );
                                        return;
                                      }
                                      const value = parseInt(inputValue);
                                      if (!isNaN(value)) {
                                        handleQuestionChange(
                                          categoryIndex,
                                          questionIndex,
                                          "jokerTimer",
                                          value
                                        );
                                      }
                                    }}
                                    placeholder="Standard"
                                    className="w-20"
                                  />
                                  <div className="flex gap-1">
                                    {[5, 10, 15, 20].map((sec) => (
                                      <Button
                                        key={sec}
                                        type="button"
                                        variant={
                                          question.jokerTimer === sec
                                            ? "default"
                                            : "outline"
                                        }
                                        size="sm"
                                        onClick={() =>
                                          handleQuestionChange(
                                            categoryIndex,
                                            questionIndex,
                                            "jokerTimer",
                                            sec
                                          )
                                        }
                                        className="px-2 py-1 text-xs"
                                      >
                                        {sec}s
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Tom = bruker global standard (10s)
                                </p>
                              </div>
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
