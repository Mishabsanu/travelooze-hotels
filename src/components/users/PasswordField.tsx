"use client";

import { useField } from "formik";
import { Eye, EyeOff } from "lucide-react";
import { FormField, inputClass } from "@/components/ui/FormField";

interface PasswordFieldProps {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
  visible: boolean;
  onToggle: () => void;
}

/** Password input bound to Formik, with a show/hide toggle controlled by the parent. */
export function PasswordField({ name, label, required, hint, placeholder, autoComplete, visible, onToggle }: PasswordFieldProps) {
  const [field, meta] = useField<string>(name);
  const error = meta.touched ? meta.error : undefined;
  return (
    <FormField label={label} htmlFor={name} required={required} error={error} hint={hint}>
      <div className="relative">
        <input
          id={name}
          {...field}
          value={field.value ?? ""}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={`${inputClass(Boolean(error))} pr-9`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-400 hover:text-brand transition"
        >
          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </FormField>
  );
}
