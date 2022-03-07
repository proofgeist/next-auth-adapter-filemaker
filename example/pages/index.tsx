import { useSession, signIn, signOut } from "next-auth/react";
import Header from "../components/Header";

export default function Page() {
  return (
    <>
      <Header />
    </>
  );
}
