import React from "react";
import InstructorWorkspace from "../workspace/InstructorWorkspace.jsx";
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
  taskDone,
  toggle,
  goals,
  setGoals,
  displayName,
}) {
  if (karte) return <Karte trainee={karte} back={() => setKarte(null)} role={role} />;
  if (view === "home") {
    if (role === "trainee") return <TraineeHome go={go} done={taskDone} toggle={toggle} goals={goals} />;
    if (role === "instructor") return <InstructorWorkspace go={go} displayName={displayName} />;
    if (role === "client") return <ClientHome openKarte={setKarte} go={go} />;
    return null;
  }
  if (view === "curriculum") return <Curriculum role={role} go={go} />;
  if (view === "companies") return <ReadOnlyCompanies role={role} />;
  if (view === "courses") return <ReadOnlyCourses role={role} go={go} />;
  if (view === "users") return <ReadOnlyInstructors />;
  if (view === "goals") return <GoalsView role={role} done={taskDone} toggle={toggle} goals={goals} setGoals={setGoals} go={go} openKarte={setKarte} />;
  if (view === "elearning") return <ElearningView go={go} />;
  if (view === "materials") return <Materials role={role} />;
  if (view === "tests") return <Tests role={role} />;
  if (view === "attendance") return <Attendance role={role} />;
  if (view === "reports") return <Reports role={role} />;
  if (view === "trainees") return <TraineeList role={role} openKarte={setKarte} />;
  return null;
}
