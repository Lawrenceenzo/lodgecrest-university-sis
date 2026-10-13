import { useId } from 'react'

// Label above the input, optional leading icon / trailing control, error text under it.
export default function TextField({ label, error, startIcon, endAdornment, className = '', inputClassName = '', id, ...props }) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink">
          {label}
        </label>
      )}
      <div
        className={`flex items-center rounded border bg-white transition-shadow focus-within:ring-2 focus-within:ring-gold-500/40 ${
          error ? 'border-red-600' : 'border-slate-300 focus-within:border-navy-700'
        }`}
      >
        {startIcon && <span className="pl-3 text-slate-500 [&_svg]:size-5">{startIcon}</span>}
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 ${inputClassName}`}
          {...props}
        />
        {endAdornment && <span className="pr-2">{endAdornment}</span>}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
