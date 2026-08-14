"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * `Field` groups a label, a control, its description and its error. Base UI
 * wires the accessible naming and `aria-describedby` between the parts, so a
 * description and an error message reach a screen reader without any
 * hand-managed ids — which is exactly where hand-rolled forms go wrong.
 */
function Field({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Text as well as colour: an error says what is wrong, it is not only red. */
function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn("text-xs font-medium text-danger", className)}
      {...props}
    />
  );
}

const inputClassName =
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-xs transition-[color,box-shadow,border-color] duration-(--duration-fast) outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/25 data-invalid:border-danger data-invalid:ring-3 data-invalid:ring-danger/25 dark:bg-input/20 file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium";

/**
 * Inside a `<Field>` this renders the field's control; standalone it renders a
 * plain `<input>` and takes its accessible name from a `<label htmlFor>` or an
 * `aria-label` as usual.
 */
function Input({
  className,
  type = "text",
  ...props
}: FieldPrimitive.Control.Props & { type?: React.ComponentProps<"input">["type"] }) {
  return (
    <FieldPrimitive.Control
      data-slot="input"
      type={type}
      className={cn(inputClassName, className)}
      {...props}
    />
  );
}

export { Field, FieldDescription, FieldError, Input, inputClassName };
