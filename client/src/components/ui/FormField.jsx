export default function FormField({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
