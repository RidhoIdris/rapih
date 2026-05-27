import type { IncomeRange, PrimaryGoal } from '@rapih/shared';
import { create } from 'zustand';

/**
 * Onboarding draft state — held in memory across the 3 onboarding screens
 * (name → income → done). Submitted to PATCH /me/onboarding when user finishes.
 */

export type { IncomeRange, PrimaryGoal };

type SignupState = {
  nickname: string;
  income: IncomeRange | null;
  goal: PrimaryGoal | null;
  set: <K extends keyof SignupState>(key: K, value: SignupState[K]) => void;
  reset: () => void;
};

const SEED: Omit<SignupState, 'set' | 'reset'> = {
  nickname: '',
  income: null,
  goal: null,
};

export const useSignupStore = create<SignupState>((set) => ({
  ...SEED,
  set: (key, value) => set({ [key]: value } as Pick<SignupState, typeof key>),
  reset: () => set(SEED),
}));
