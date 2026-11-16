export type Phase = "setup" | "racing" | "won" | "lost";

/** A race allows at most this many hops before it is lost. */
export const HOP_CAP = 50;

export type State = {
  phase: Phase;
  start: string;
  end: string;
  /** Canonical titles; the current page is the last one. Empty before a race. */
  path: string[];
  /** True once the first follow happened — the shell arms its clock then. */
  armed: boolean;
};

export type Action =
  | { type: "start"; start: string; end: string }
  | { type: "follow"; title: string }
  | { type: "back" };

export function initial(): State {
  return { phase: "setup", start: "", end: "", path: [], armed: false };
}

export function step(state: State, action: Action): State {
  switch (action.type) {
    case "start": {
      if (state.phase !== "setup") return state;
      const { start, end } = action;
      if (!start || !end || start === end) return state;
      return { phase: "racing", start, end, path: [start], armed: false };
    }
    case "follow": {
      if (state.phase !== "racing" || !action.title) return state;
      const path = [...state.path, action.title];
      const phase =
        action.title === state.end ? "won" : path.length - 1 >= HOP_CAP ? "lost" : "racing";
      return { ...state, path, armed: true, phase };
    }
    case "back": {
      if (state.phase !== "racing" || state.path.length <= 1) return state;
      return { ...state, path: state.path.slice(0, -1) };
    }
  }
}

export function hops(state: State): number {
  return Math.max(0, state.path.length - 1);
}

export function current(state: State): string | undefined {
  return state.path[state.path.length - 1];
}
