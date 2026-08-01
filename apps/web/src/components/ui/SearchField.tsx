import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

export function SearchField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="search-field">
      <input className="form-control" type="search" {...props} />
      <Search size={18} aria-hidden="true" />
    </div>
  );
}
