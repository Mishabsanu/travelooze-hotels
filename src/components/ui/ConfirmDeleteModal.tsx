"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDeleteModalProps {
  open: boolean;
  entityLabel: string;
  itemName?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({ open, entityLabel, itemName, loading, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`Delete ${entityLabel}?`}
      size="sm"
      icon={<Trash2 className="w-4 h-4" />}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Yes, Delete
          </Button>
        </>
      }
    >
      <div className="flex gap-3 text-xs text-slate-600">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <div className="space-y-2">
          <p>
            Are you sure you want to delete this {entityLabel.toLowerCase()}? This action cannot be undone.
          </p>
          {itemName && (
            <p className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 rounded px-2 py-1 inline-block">
              {itemName}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
