import { Redirect } from 'expo-router';

// "my groups" now lives on home (/circles): the title dropdown lists every coop.
export default function CoopsRedirect() {
  return <Redirect href="/circles" />;
}
