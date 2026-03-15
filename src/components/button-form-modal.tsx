// Button Form Modal - collects input values before executing a button action
// Renders text fields, checkboxes, and choice selects driven by APIInputSpec

import { TextAttributes } from "@opentui/core";
import type { InputRenderable } from "@opentui/core";
import { createEffect, createSignal, createMemo, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { useKeyboard } from "@opentui/solid";
import { useTheme } from "@/hooks/useTheme";
import type { APIButton } from "../tilt/api-types";
import type { APIInputSpec } from "../tilt/api-types";

interface ButtonFormModalProps {
  button: APIButton;
  onClose: () => void;
  onSubmit: (
    button: APIButton,
    inputValues: Record<string, string | boolean>,
  ) => void;
}

// Only visible (non-hidden) inputs are rendered as form fields
function isVisibleInput(spec: APIInputSpec): boolean {
  return !!(spec.text || spec.bool || spec.choice);
}

function getInputType(spec: APIInputSpec): "text" | "bool" | "choice" {
  if (spec.bool) return "bool";
  if (spec.choice) return "choice";
  return "text";
}

function getDefaultValue(spec: APIInputSpec): string | boolean {
  if (spec.bool) return spec.bool.defaultValue ?? false;
  if (spec.choice) return spec.choice.choices?.[0] ?? "";
  if (spec.text) return spec.text.defaultValue ?? "";
  return "";
}

export function ButtonFormModal(props: ButtonFormModalProps) {
  const theme = useTheme();
  const allInputs = () => props.button.spec.inputs ?? [];
  const visibleInputs = createMemo(() => allInputs().filter(isVisibleInput));
  const isConfirmationOnly = createMemo(
    () =>
      visibleInputs().length === 0 && props.button.spec.requiresConfirmation,
  );

  // Track which field is focused (index into visibleInputs)
  const [focusIndex, setFocusIndex] = createSignal(0);

  // Store form values keyed by input name
  const initialValues: Record<string, string | boolean> = {};
  for (const spec of allInputs()) {
    if (spec.hidden) {
      initialValues[spec.name] = spec.hidden.value ?? "";
    } else {
      initialValues[spec.name] = getDefaultValue(spec);
    }
  }
  const [values, setValues] = createStore(initialValues);

  // Track choice selection indices for keyboard navigation
  const choiceIndices: Record<string, number> = {};
  for (const spec of allInputs()) {
    if (spec.choice) {
      choiceIndices[spec.name] = 0;
    }
  }
  const [choiceIdx, setChoiceIdx] = createStore(choiceIndices);

  // Refs for text inputs so we can manage focus
  const inputRefs: Record<string, InputRenderable> = {};

  function focusField(index: number) {
    const fields = visibleInputs();
    if (fields.length === 0) return;
    const clamped = ((index % fields.length) + fields.length) % fields.length;
    setFocusIndex(clamped);

    // If the target field is a text input, focus its renderable
    const field = fields[clamped];
    if (field.text) {
      setTimeout(() => inputRefs[field.name]?.focus(), 10);
    }
  }

  // Focus first text field on mount
  createEffect(() => {
    focusField(0);
  });

  function handleSubmit() {
    // Collect all values (visible + hidden) and submit
    const result: Record<string, string | boolean> = {};
    for (const spec of allInputs()) {
      result[spec.name] = values[spec.name];
    }
    props.onSubmit(props.button, result);
  }

  // Get the currently focused field's spec
  const focusedField = createMemo(() => visibleInputs()[focusIndex()]);

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault();
      props.onClose();
      return;
    }

    // Tab / Shift+Tab to cycle fields
    if (evt.name === "tab") {
      evt.preventDefault();
      if (evt.shift) {
        focusField(focusIndex() - 1);
      } else {
        focusField(focusIndex() + 1);
      }
      return;
    }

    // Enter submits the form (for confirmation-only, this is the confirm action)
    if (evt.name === "return") {
      evt.preventDefault();
      handleSubmit();
      return;
    }

    const field = focusedField();
    if (!field) return;

    // Space toggles bool fields
    if (evt.name === "space" && field.bool) {
      evt.preventDefault();
      setValues(field.name, !values[field.name]);
      return;
    }

    // Up/Down cycle through choice options
    if (field.choice && field.choice.choices && field.choice.choices.length > 0) {
      const choices = field.choice.choices;
      const currentIdx = choiceIdx[field.name] ?? 0;

      if (evt.name === "up" || (evt.ctrl && evt.name === "k")) {
        evt.preventDefault();
        const next =
          ((currentIdx - 1) % choices.length + choices.length) %
          choices.length;
        setChoiceIdx(field.name, next);
        setValues(field.name, choices[next]);
        return;
      }
      if (evt.name === "down" || (evt.ctrl && evt.name === "j")) {
        evt.preventDefault();
        const next = (currentIdx + 1) % choices.length;
        setChoiceIdx(field.name, next);
        setValues(field.name, choices[next]);
        return;
      }
    }
  });

  // Render a single form field based on its type
  function renderField(spec: APIInputSpec, index: number) {
    const isFocused = () => focusIndex() === index;
    const label = spec.label || spec.name;
    const type = getInputType(spec);

    return (
      <box flexDirection="column" paddingLeft={2} paddingRight={2}>
        {/* Field label */}
        <text
          fg={isFocused() ? theme.primary : theme.textMuted}
          attributes={isFocused() ? TextAttributes.BOLD : undefined}
        >
          {label}
        </text>

        {/* Field widget */}
        <Show when={type === "text"}>
          <box>
            <input
              ref={(r: InputRenderable) => {
                inputRefs[spec.name] = r;
              }}
              value={values[spec.name] as string}
              onInput={(v: string) => setValues(spec.name, v)}
              focused={isFocused()}
              focusedBackgroundColor={theme.background}
              cursorColor={theme.primary}
              focusedTextColor={theme.text}
              placeholder={spec.text?.placeholder ?? ""}
            />
          </box>
        </Show>

        <Show when={type === "bool"}>
          <text
            fg={isFocused() ? theme.text : theme.textMuted}
            attributes={isFocused() ? TextAttributes.BOLD : undefined}
          >
            {values[spec.name] ? "[x]" : "[ ]"}{" "}
            {values[spec.name] ? "enabled" : "disabled"}
            {isFocused() ? "  (space to toggle)" : ""}
          </text>
        </Show>

        <Show when={type === "choice"}>
          <box flexDirection="row">
            <For each={spec.choice?.choices ?? []}>
              {(choice) => {
                const isChosen = () => values[spec.name] === choice;
                return (
                  <box
                    backgroundColor={
                      isChosen()
                        ? isFocused()
                          ? theme.primary
                          : theme.border
                        : undefined
                    }
                  >
                    <text
                      fg={
                        isChosen()
                          ? isFocused()
                            ? theme.background
                            : theme.text
                          : theme.textMuted
                      }
                      attributes={isChosen() ? TextAttributes.BOLD : undefined}
                    >
                      {" "}
                      {choice}{" "}
                    </text>
                  </box>
                );
              }}
            </For>
            <Show when={isFocused()}>
              <text fg={theme.textMuted}> (up/down)</text>
            </Show>
          </box>
        </Show>
      </box>
    );
  }

  // Confirmation-only modal (no visible inputs)
  if (isConfirmationOnly()) {
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
        <box
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          flexDirection="row"
          justifyContent="space-between"
        >
          <text fg={theme.warning} attributes={TextAttributes.BOLD}>
            Confirm: {props.button.spec.text}
          </text>
          <text fg={theme.textMuted}>esc</text>
        </box>

        <box paddingLeft={2} paddingRight={2} paddingTop={1}>
          <text fg={theme.text}>Are you sure you want to run this action?</text>
        </box>

        <box
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          flexDirection="row"
          justifyContent="space-between"
        >
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            Enter to confirm
          </text>
          <text fg={theme.textMuted}>Esc to cancel</text>
        </box>
      </box>
    );
  }

  // Full form modal
  return (
    <box
      position="absolute"
      top={2}
      left="50%"
      marginLeft={-30}
      width={60}
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
          {props.button.spec.text}
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      {/* Form fields */}
      <For each={visibleInputs()}>
        {(spec, i) => (
          <box paddingTop={1}>{renderField(spec, i())}</box>
        )}
      </For>

      {/* Footer */}
      <box
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          Enter to submit
        </text>
        <text fg={theme.textMuted}>Tab to cycle fields</text>
      </box>
    </box>
  );
}
