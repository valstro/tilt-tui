// Log Search Modal - simple text input for filtering logs
// Supports string match and regex search (using /pattern/ syntax)

import { TextAttributes } from "@opentui/core";
import type { InputRenderable } from "@opentui/core";
import { createEffect, createSignal } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { defaultTheme } from "../theme/theme";
import type { LogSearchFilter } from "./log-buffer";
import { parseSearchQuery } from "../utils/log-search-utils";

interface LogSearchModalProps {
  onClose: () => void;
  onSearch: (filter: LogSearchFilter | null) => void;
  initialQuery?: string;
}

export function LogSearchModal(props: LogSearchModalProps) {
  const theme = defaultTheme;
  const [query, setQuery] = createSignal(props.initialQuery ?? "");
  const [error, setError] = createSignal<string | null>(null);

  let inputRef: InputRenderable | undefined;

  function handleSearch() {
    const filter = parseSearchQuery(query());
    if (filter?.isRegex && !filter.regex) {
      setError("Invalid regex pattern");
      return;
    }
    setError(null);
    props.onSearch(filter);
    props.onClose();
  }

  // Keyboard handling
  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault();
      props.onClose();
      return;
    }

    if (evt.name === "return") {
      evt.preventDefault();
      handleSearch();
      return;
    }
  });

  // Focus input on mount
  createEffect(() => {
    setTimeout(() => inputRef?.focus(), 10);
  });

  return (
    <box
      position="absolute"
      top={2}
      left="50%"
      marginLeft={-25}
      width={50}
      backgroundColor={theme.contentPane}
      border={false}
      flexDirection="column"
    >
      {/* Header */}
      <box
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Search Logs
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      {/* Help text */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg={theme.textMuted}>Use /regex/ for regex search</text>
      </box>

      {/* Search input */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
        <input
          ref={(r) => (inputRef = r)}
          value={query()}
          onInput={(e) => {
            setQuery(e);
            setError(null);
          }}
          focusedBackgroundColor={theme.background}
          cursorColor={theme.primary}
          focusedTextColor={theme.text}
          placeholder="Search..."
        />
      </box>

      {/* Error message */}
      {error() && (
        <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
          <text fg={theme.error}>{error()}</text>
        </box>
      )}

      {/* Footer hint */}
      <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
        <text fg={theme.textMuted}>Enter to search</text>
      </box>
    </box>
  );
}

export { parseSearchQuery } from "../utils/log-search-utils";
export type { LogSearchFilter };
