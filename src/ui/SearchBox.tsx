import { useState } from 'preact/hooks';
import { STRINGS } from './strings.ts';

const HAS_TOKEN = /[\p{L}\p{N}]/u;

export function SearchBox({ onSearch, disabled }: { onSearch: (q: string) => void; disabled: boolean }) {
  const [value, setValue] = useState('');
  const [hint, setHint] = useState('');
  const submit = (e: Event) => {
    e.preventDefault();
    if (!HAS_TOKEN.test(value)) {
      setHint(STRINGS.emptyQuery);
      return;
    }
    setHint([...value.trim()].length > 512 ? STRINGS.truncated : '');
    onSearch(value.trim());
  };
  return (
    <form class="search" onSubmit={submit} role="search">
      <input
        data-testid="search-input"
        type="search"
        value={value}
        placeholder={STRINGS.searchPlaceholder}
        aria-label={STRINGS.searchPlaceholder}
        onInput={(e) => setValue((e.target as HTMLInputElement).value)}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        {STRINGS.searchButton}
      </button>
      {hint && <p class="hint" data-testid="search-hint">{hint}</p>}
    </form>
  );
}
