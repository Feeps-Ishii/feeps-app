import React from "react";
import {
  Attendance, ClientHome, Curriculum, ElearningView, GoalsView, InstructorHome, Karte, Materials, Reports,
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
  dailyMessage,
  setDailyMessage,
}) {
  if (karte) return <Karte trainee={karte} back={() => setKarte(null)} role={role} />;
  if (view === "home") {
    if (role === "trainee") return <TraineeHome go={go} done={taskDone} toggle={toggle} dailyMessage={dailyMessage} goals={goals} />;
    if (role === "instructor") return <InstructorHome go={go} openKarte={setKarte} dailyMessage={dailyMessage} setDailyMessage={setDailyMessage} />;
    if (role === "client") return <ClientHome openKarte={setKarte} go={go} />;
    return null;
  }
  if (view === "curriculum") return <Curriculum role={role} />;
  if (view === "companies") return <ReadOnlyCompanies role={role} />;
  if (view === "courses") return <ReadOnlyCourses role={role} />;
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
