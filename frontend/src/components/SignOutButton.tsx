export default function SignOutButton({ onSignOut, className, iconOnly = false, compactOnMobile = false }: {
  onSignOut: () => void
  className: string
  iconOnly?: boolean
  compactOnMobile?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSignOut}
      title="Sign out"
      aria-label="Sign out"
      className={className}
    >
      <span aria-hidden="true">↪</span>
      {!iconOnly && <span className={compactOnMobile ? 'hidden sm:inline' : undefined}>Sign out</span>}
    </button>
  )
}
