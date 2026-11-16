import { Schema } from "mongoose";

/**
 * Recycle bin for a model: deletedAt / deletedBy (+ deletedWith when binned together with a parent,
 * e.g. a hotel's rooms). Binned documents are invisible to every find / count / update / aggregate
 * unless the query opts in with .setOptions({ withDeleted: true }) or filters on deletedAt itself.
 */
export function softDeletePlugin(schema: Schema) {
  schema.add({
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedWith: { type: Schema.Types.ObjectId },
  });
  schema.index({ deletedAt: 1 });

  type BinAware = { getOptions(): { withDeleted?: boolean }; getFilter(): Record<string, unknown>; where(f: Record<string, unknown>): unknown };
  function hideBinned(this: BinAware) {
    if (this.getOptions().withDeleted) return;
    if (!("deletedAt" in this.getFilter())) this.where({ deletedAt: null });
  }
  for (const op of ["find", "findOne", "findOneAndUpdate", "countDocuments", "updateMany", "updateOne", "distinct"] as const) {
    schema.pre(op, hideBinned as never);
  }
  schema.pre("aggregate", function () {
    const opts = this.options as { withDeleted?: boolean };
    if (!opts.withDeleted) this.pipeline().unshift({ $match: { deletedAt: null } });
  });
}
