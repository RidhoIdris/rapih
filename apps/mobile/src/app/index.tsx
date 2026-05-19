import { Redirect } from 'expo-router';

/** Entry point → the branded splash screen. */
export default function Index() {
  return <Redirect href="/(auth)/splash" />;
}
