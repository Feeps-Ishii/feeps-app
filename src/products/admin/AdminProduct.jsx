import React from "react";
import { AdminCompanies, AdminCourses, AdminHome, AdminUsers } from "./AdminComponents.jsx";

export default function AdminProduct({ view, go }) {
  if (view === "home") return <AdminHome go={go} />;
  if (view === "companies") return <AdminCompanies />;
  if (view === "courses") return <AdminCourses go={go} />;
  if (view === "users") return <AdminUsers />;
  return null;
}
