"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "@/lib/utils";

/**
 * A control's label. Inside a `<Field>` the association with the control is
 * made by Base UI, so no `htmlFor`/`id` pair has to be maintained by hand;
 * outside one it still renders a plain `<label>`.
 */
function Label({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="label"
      className={cn(
        "flex items-center gap-1.5 text-sm leading-none font-medium select-none data-disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
