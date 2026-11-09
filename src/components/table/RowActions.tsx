"use client";

import { Edit2, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { apiRequest, ApiError } from "@/services/apiClient";

interface RowActionsProps {
  viewHref?: string;
  editHref?: string;
  /** API endpoint to DELETE, e.g. /api/customers/<id> */
  deleteUrl?: string;
  entityLabel: string;
  itemName: string;
}

const iconBtn = "p-1 rounded text-slate-400 transition-colors";

/** View / edit / delete buttons; only rendered for the actions the caller passes in. */
export function RowActions({ viewHref, editHref, deleteUrl, entityLabel, itemName }: RowActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteUrl) return;
    setDeleting(true);
    try {
      await apiRequest(deleteUrl, "DELETE");
      toast.success(`${entityLabel} deleted`);
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5">
      {viewHref && (
        <Link href={viewHref} title={`View ${entityLabel}`} className={`${iconBtn} hover:text-brand hover:bg-brand-light`}>
          <Eye className="w-3.5 h-3.5" />
        </Link>
      )}
      {editHref && (
        <Link href={editHref} title={`Edit ${entityLabel}`} className={`${iconBtn} hover:text-brand hover:bg-brand-light`}>
          <Edit2 className="w-3.5 h-3.5" />
        </Link>
      )}
      {deleteUrl && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          title={`Delete ${entityLabel}`}
          className={`${iconBtn} hover:text-red-600 hover:bg-red-50`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <ConfirmDeleteModal
        open={confirmOpen}
        entityLabel={entityLabel}
        itemName={itemName}
        loading={deleting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
