import { create } from 'zustand';

/**
 * Signup wizard state — shared across the 3 register steps so a back/next
 * navigation keeps what the user entered. UI-only build: there is no API
 * call. The store is seeded with the design's example content so screens
 * render exactly like the mock; clear these defaults to '' when wiring real
 * <TextInput>s.
 */

export type IncomeRange =
  | 'lt3'
  | '3to7'
  | '7to15'
  | '15to30'
  | 'gt30'
  | 'variable';

export type PrimaryGoal =
  | 'save'
  | 'track'
  | 'goal'
  | 'invest'
  | 'debt'
  | 'bills';

type SignupState = {
  email: string;
  password: string;
  agreeTos: boolean;
  nickname: string;
  income: IncomeRange | null;
  goal: PrimaryGoal | null;
  set: <K extends keyof SignupState>(key: K, value: SignupState[K]) => void;
  reset: () => void;
};

const SEED = {
  email: 'adelia.rahmadini@gmail.com',
  password: '',
  agreeTos: true,
  nickname: 'Adelia',
  income: '7to15' as IncomeRange,
  goal: 'save' as PrimaryGoal,
};

export const useSignupStore = create<SignupState>((set) => ({
  ...SEED,
  set: (key, value) => set({ [key]: value } as Pick<SignupState, typeof key>),
  reset: () => set(SEED),
}));
