import { useId, useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

export default function PasswordField({ label = 'Password', id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  return <div className="field">
    <label htmlFor={inputId}>{label}</label>
    <div className="password-input">
      <LockKeyhole className="password-lock" size={18} strokeWidth={1.6} aria-hidden="true"/>
      <input {...props} id={inputId} type={visible ? 'text' : 'password'} autoCapitalize="none" spellCheck={false}/>
      <button type="button" className="password-toggle" aria-controls={inputId}
        aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        title={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        data-visible={visible} disabled={props.disabled}
        onMouseDown={event => event.preventDefault()}
        onClick={() => setVisible(current => !current)}>
        {visible ? <EyeOff size={19} strokeWidth={1.7} aria-hidden="true"/> : <Eye size={19} strokeWidth={1.7} aria-hidden="true"/>}
      </button>
    </div>
  </div>;
}
