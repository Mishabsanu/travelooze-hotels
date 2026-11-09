"use client";

import type { FormikHelpers } from "formik";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/services/apiClient";

interface Options<V, R> {
  request: (values: V) => Promise<R>;
  successMessage: string;
  /** Where to go after saving; omit to stay on the page. */
  redirectTo?: string | ((result: R) => string);
  onSuccess?: (result: R) => void;
}

/**
 * Standard Formik submit: calls the API, toasts the result, maps server field errors
 * back onto the form, then navigates and refreshes server-rendered data.
 */
export function useApiSubmit<V, R = unknown>({ request, successMessage, redirectTo, onSuccess }: Options<V, R>) {
  const router = useRouter();

  return async (values: V, helpers: FormikHelpers<V>) => {
    try {
      const result = await request(values);
      toast.success(successMessage);
      onSuccess?.(result);
      if (redirectTo) {
        router.push(typeof redirectTo === "function" ? redirectTo(result) : redirectTo);
      }
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors) helpers.setErrors(error.fieldErrors as never);
        toast.error(error.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      helpers.setSubmitting(false);
    }
  };
}
