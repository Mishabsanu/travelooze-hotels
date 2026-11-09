"use client";

import { Form, Formik } from "formik";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";
import { TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { loginSchema } from "@/lib/validation/user.schema";
import { apiRequest, ApiError } from "@/services/apiClient";

export function LoginForm({ next }: { next: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  return (
    <Formik
      initialValues={{ email: "", password: "", remember: true }}
      validationSchema={loginSchema}
      onSubmit={async (values, { setSubmitting }) => {
        setError("");
        try {
          await apiRequest("/api/auth/login", "POST", values);
          // Full navigation so the server layout loads with the new session cookie
          window.location.href = next;
        } catch (e) {
          setError(e instanceof ApiError ? e.message : "Unable to sign in");
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting, values, setFieldValue }) => (
        <Form noValidate className="space-y-4">
          {error && (
            <div role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <TextField name="email" label="Email or Mobile" required autoComplete="username" placeholder="admin@hotel.local" />
          <div className="relative">
            <TextField
              name="password"
              label="Password"
              required
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-[30px] text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={values.remember}
              onChange={(e) => setFieldValue("remember", e.target.checked)}
              className="w-3.5 h-3.5 accent-brand"
            />
            Keep me signed in for 30 days
          </label>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={<LogIn className="w-4 h-4" />}>
            Sign In
          </Button>
        </Form>
      )}
    </Formik>
  );
}
