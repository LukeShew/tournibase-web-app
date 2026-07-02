import type { TicketTypeFormState } from "@/lib/form-states";

export type TicketTypeDefaults = {
  description?: string;
  name?: string;
  price?: string;
  quantityLimit?: string;
  status?: "active" | "inactive";
  validFrom: string;
  validUntil: string;
};

type TicketTypeFieldsProps = {
  defaults: TicketTypeDefaults;
  disabled: boolean;
  errors: TicketTypeFormState["errors"];
  idPrefix: string;
};

const inputClassName =
  "mt-2 h-11 w-full rounded-xl border border-border bg-black/20 px-3 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-wait disabled:opacity-70";

export function TicketTypeFields({
  defaults,
  disabled,
  errors,
  idPrefix,
}: TicketTypeFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        id={`${idPrefix}-name`}
        label="Ticket name"
        error={errors.name}
        className="sm:col-span-2"
      >
        <input
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={defaults.name}
          required
          maxLength={80}
          disabled={disabled}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined}
          className={inputClassName}
          placeholder="Saturday Pass"
        />
      </FormField>

      <FormField
        id={`${idPrefix}-price`}
        label="Price"
        error={errors.price}
      >
        <div className="mt-2 flex h-11 overflow-hidden rounded-xl border border-border bg-black/20 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
          <span className="flex items-center border-r border-border bg-white/5 px-3 text-sm text-slate-500">
            $
          </span>
          <input
            id={`${idPrefix}-price`}
            name="price"
            type="text"
            inputMode="decimal"
            defaultValue={defaults.price}
            required
            disabled={disabled}
            aria-invalid={Boolean(errors.price)}
            aria-describedby={
              errors.price ? `${idPrefix}-price-error` : undefined
            }
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none disabled:cursor-wait disabled:opacity-70"
            placeholder="12.00"
          />
        </div>
      </FormField>

      <FormField
        id={`${idPrefix}-quantityLimit`}
        label="Quantity limit"
        error={errors.quantityLimit}
      >
        <input
          id={`${idPrefix}-quantityLimit`}
          name="quantityLimit"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          step={1}
          defaultValue={defaults.quantityLimit}
          disabled={disabled}
          aria-invalid={Boolean(errors.quantityLimit)}
          aria-describedby={
            errors.quantityLimit
              ? `${idPrefix}-quantityLimit-error`
              : undefined
          }
          className={inputClassName}
          placeholder="Unlimited"
        />
      </FormField>

      <FormField
        id={`${idPrefix}-validFrom`}
        label="Valid from"
        error={errors.validFrom}
      >
        <input
          id={`${idPrefix}-validFrom`}
          name="validFrom"
          type="date"
          defaultValue={defaults.validFrom}
          required
          disabled={disabled}
          aria-invalid={Boolean(errors.validFrom)}
          aria-describedby={
            errors.validFrom ? `${idPrefix}-validFrom-error` : undefined
          }
          className={inputClassName}
        />
      </FormField>

      <FormField
        id={`${idPrefix}-validUntil`}
        label="Valid until"
        error={errors.validUntil}
      >
        <input
          id={`${idPrefix}-validUntil`}
          name="validUntil"
          type="date"
          defaultValue={defaults.validUntil}
          required
          disabled={disabled}
          aria-invalid={Boolean(errors.validUntil)}
          aria-describedby={
            errors.validUntil ? `${idPrefix}-validUntil-error` : undefined
          }
          className={inputClassName}
        />
      </FormField>

      <FormField
        id={`${idPrefix}-status`}
        label="Status"
        error={errors.status}
        className="sm:col-span-2"
      >
        <select
          id={`${idPrefix}-status`}
          name="status"
          defaultValue={defaults.status ?? "active"}
          disabled={disabled}
          aria-invalid={Boolean(errors.status)}
          aria-describedby={
            errors.status ? `${idPrefix}-status-error` : undefined
          }
          className={inputClassName}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </FormField>

      <FormField
        id={`${idPrefix}-description`}
        label="Description"
        error={errors.description}
        className="sm:col-span-2"
      >
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={3}
          maxLength={400}
          defaultValue={defaults.description}
          disabled={disabled}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={
            errors.description ? `${idPrefix}-description-error` : undefined
          }
          className="mt-2 w-full resize-y rounded-xl border border-border bg-black/20 px-3 py-3 text-sm leading-6 text-white placeholder:text-slate-600 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-wait disabled:opacity-70"
          placeholder="What this pass includes and who it is for."
        />
      </FormField>
    </div>
  );
}

function FormField({
  children,
  className = "",
  error,
  id,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  error?: string;
  id: string;
  label: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-sm text-red-300" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
