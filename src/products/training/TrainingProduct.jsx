import React from "react";
import InstructorWorkspace from "../workspace/InstructorWorkspace.jsx";
import { PrismErrorRetryCard, SkeletonRows } from "../../components/common";
import {
  Attendance, ClientHome, Curriculum, ElearningView, GoalsView, Karte, Materials, Reports,
  ReadOnlyCompanies, ReadOnlyCourses, ReadOnlyInstructors, Tests, TraineeHome, TraineeList
} from "./TrainingComponents.jsx";

export default function TrainingProduct({
  view,
  role,
  karte,
  setKarte,
  go,
  goProduct,
  goSub,
  taskDone,
  taskDataState,
  onTaskRetry,
  taskSaveState,
  toggle,
  goals,
  setGoals,
  displayName,
}) {
  if (karte) return <Karte trainee={karte} back={() => setKarte(null)} role={role} />;
  if (view === "home") {
    if (role === "trainee") return <TraineeHome go={go} goProduct={goProduct} goSub={goSub} done={taskDone} taskDataState={taskDataState} onTaskRetry={onTaskRetry} taskSaveState={taskSaveState} toggle={toggle} goals={goals} />;
    if (role === "instructor") return <InstructorWorkspace go={go} displayName={displayName} />;
    if (role === "client") return <ClientHome openKarte={setKarte} go={go} />;
    return null;
  }
  if (view === "curriculum") return <Curriculum role={role} go={go} />;
  if (view === "companies") return <ReadOnlyCompanies role={role} />;
  if (view === "courses") return <ReadOnlyCourses role={role} go={go} />;
  if (view === "users") return <ReadOnlyInstructors />;
  if (view === "goals" && role === "trainee" && taskDataState !== "ready") return <div className="p-4">{taskDataState === "error" ? <PrismErrorRetryCard message="目標・タスクを取得できませんでした。データ保護のため、編集を停止しています。" onRetry={onTaskRetry} /> : <SkeletonRows rows={5} />}</div>;
  if (view === "goals") return <GoalsView role={role} done={taskDone} taskSaveState={taskSaveState} toggle={toggle} goals={goals} setGoals={setGoals} go={go} goProduct={goProduct} goSub={goSub} openKarte={setKarte} />;
  if (view === "elearning") return <ElearningView go={go} />;
  if (view === "materials") return <Materials role={role} />;
  if (view === "tests") return <Tests role={role} />;
  if (view === "attendance") return <Attendance role={role} />;
  if (view === "reports") return <Reports role={role} />;
  if (view === "trainees") return <TraineeList role={role} openKarte={setKarte} />;
  return null;
}
