export default function Alert({ title, children, variant = 'default' }) {
  const cls = ['alert']
  if (variant === 'danger') cls.push('alertDanger')
  if (variant === 'success') cls.push('alertSuccess')

  return (
    <div className={cls.join(' ')} role={variant === 'danger' ? 'alert' : 'status'}>
      {title ? <div className="alertTitle">{title}</div> : null}
      <div className="muted">{children}</div>
    </div>
  )
}
