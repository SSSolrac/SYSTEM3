import type { Dispatch, SetStateAction } from "react";
import type { MemberData } from "./loyalty";

export interface AppOutletContext {
  user: MemberData;
  setUser: Dispatch<SetStateAction<MemberData>>;
  refreshUser: () => Promise<void>;
  completedTaskIds: string[];
  setCompletedTaskIds: Dispatch<SetStateAction<string[]>>;
}

