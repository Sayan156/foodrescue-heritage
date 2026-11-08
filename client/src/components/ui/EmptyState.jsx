import { Leaf } from 'lucide-react';

export default function EmptyState({ title, message }) {
  return <div className="empty"><Leaf size={32}/><h3>{title}</h3><p>{message}</p></div>;
}
