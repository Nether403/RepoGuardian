export type ParsedPythonRequirement = {
  name: string;
  version: string | null;
};

function stripInlineComment(line: string): string {
  const commentIndex = line.indexOf(" #");
  return commentIndex >= 0 ? line.slice(0, commentIndex).trim() : line.trim();
}

export function parsePythonRequirement(
  declaration: string
): ParsedPythonRequirement | null {
  const withoutMarker = stripInlineComment(declaration.split(";")[0] ?? declaration);

  if (!withoutMarker) {
    return null;
  }

  const match = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[A-Za-z0-9_,.-]+\])?\s*(.*)$/.exec(
    withoutMarker
  );

  if (!match) {
    return null;
  }

  const name = match[1];
  const rawVersion = match[2]?.trim() ?? "";

  if (!name) {
    return null;
  }

  if (rawVersion.length === 0) {
    return {
      name,
      version: null
    };
  }

  if (!/^(===|==|~=|!=|<=|>=|<|>).+/.test(rawVersion)) {
    return null;
  }

  return {
    name,
    version: rawVersion.replace(/\s+/g, "")
  };
}
