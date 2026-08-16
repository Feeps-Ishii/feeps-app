import React from "react";
import { AdminCompanies, AdminCourses, AdminHome, AdminUsers } from "./AdminComponents.jsx";

export default function AdminProduct({ view, go, goProduct, goSub }) {
  if (view === "home") return <AdminHome go={go} goProduct={goProduct} openRisk={goProduct && goSub ? () => { goProduct("analytics"); goSub("an_risk"); } : null} />;
  if (view === "companies") return <AdminCompanies />;
  if (view === "courses") return <AdminCourses go={go} />;
  if (view === "users") return <AdminUsers />;
  return null;
}
