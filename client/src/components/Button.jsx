import React from 'react';
import { sfx, unlockAudio } from '../audio.js';

export default function Button({ children, onClick, variant = 'primary', disabled, sound = 'click', className = '', ...rest }) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={disabled}
      onMouseEnter={() => !disabled && sfx.hover()}
      onClick={(e) => { unlockAudio(); if (sound) sfx[sound]?.(); onClick?.(e); }}
      {...rest}
    >
      <span>{children}</span>
    </button>
  );
}
