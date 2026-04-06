import type { FormEvent } from "react";

type RepoInputFormProps = {
  errorMessage: string | null;
  helperText: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  value: string;
};

export function RepoInputForm({
  errorMessage,
  helperText,
  isLoading,
  onChange,
  onSubmit,
  value
}: RepoInputFormProps) {
  return (
    <form className="analyze-form" onSubmit={onSubmit}>
      <label className="field-label" htmlFor="repo-input">
        Repository input
      </label>
      <div className="input-row">
        <input
          autoComplete="off"
          className="repo-input"
          disabled={isLoading}
          id="repo-input"
          name="repoInput"
          onChange={(event) => onChange(event.target.value)}
          placeholder="openai/openai-node"
          spellCheck={false}
          type="text"
          value={value}
        />
        <button className="submit-button" disabled={isLoading} type="submit">
          {isLoading ? "Analyzing..." : "Analyze Repository"}
        </button>
      </div>
      <p className="field-help">
        Accepted forms: full GitHub URL, `github.com/owner/repo`, or `owner/repo`.
      </p>
      <p
        aria-live="polite"
        className={errorMessage ? "form-message form-message-error" : "form-message"}
        role={errorMessage ? "alert" : "status"}
      >
        {errorMessage ?? helperText}
      </p>
    </form>
  );
}
