import React from 'react';
/** Plain text with http(s) links made clickable (opens in a new tab). */
export const Linkify: React.FC<{ text: string }> = ({ text }) => (
  <>{text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) => (/^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a> : <React.Fragment key={i}>{part}</React.Fragment>))}</>
);
