import React from "react";
import { T } from "./theme.js";

export default function Card({ children, className = "", style = {}, hover, onClick }) {
  return <div onClick={onClick}
    className={"rounded-2xl bg-white transition " + (hover ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md " : "") + className}
    style={{ border: `1px solid ${T.border}`, boxShadow: "0 1px 2px rgba(21,38,47,.04)", ...style }}>{children}</div>;
}
