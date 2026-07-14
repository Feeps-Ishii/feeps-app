import React from "react";
import Modal from "../../../components/common/Modal.jsx";

// Thin compatibility wrapper over the shared Modal (portal, focus management,
// scroll lock, ESC/overlay close, animation). Keeps the historical
// `open`/`width`/`danger` call-site API used across Learning admin.
export default function AdminModal({ open, title, desc, children, onClose, danger = false, width = 720 }) {
  if (!open) return null;
  const size = width >= 900 ? "xl" : width >= 700 ? "lg" : width >= 500 ? "md" : "sm";
  return (
    <Modal title={title} desc={desc} onClose={onClose} size={size} danger={danger}>
      {children}
    </Modal>
  );
}
