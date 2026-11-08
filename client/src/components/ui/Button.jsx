export default function Button({ variant = 'primary', size, className = '', type = 'button', children, ...props }) {
  const variantClass = variant === 'outline' ? 'outline-btn' : variant === 'icon' ? 'icon-btn' : 'button';
  const sizeClass = size === 'small' ? ' small' : size === 'wide' ? ' wide' : '';
  return <button type={type} className={`${variantClass}${sizeClass}${className ? ` ${className}` : ''}`} {...props}>{children}</button>;
}
