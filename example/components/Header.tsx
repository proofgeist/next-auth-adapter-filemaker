import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";

/* This example requires Tailwind CSS v2.0+ */
const navigation = [
  { name: "Solutions", href: "#" },
  { name: "Pricing", href: "#" },
  { name: "Docs", href: "#" },
  { name: "Company", href: "#" },
];

export default function Header() {
  const { data: session, status } = useSession();
  console.log(session);

  if (status === "loading") return <></>;

  return (
    <header className="bg-primary-600">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="w-full py-6 flex items-center justify-between border-b border-primary-500 lg:border-none">
          <div className="flex items-center">
            <a href="#" className="text-white">
              <span className="sr-only">Workflow</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-10 w-auto" src="/logo.svg" alt="" />
            </a>
            <div className="hidden ml-10 space-x-8 lg:block">
              {navigation.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-base font-medium text-white hover:text-primary-50"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
          {session ? (
            <div className="ml-10 space-x-4 text-white flex items-center">
              <p className="text-white">Welcome {session.user.name}</p>
              {session?.user?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="inline-block h-10 w-10 rounded-full"
                  src={session.user.image}
                  alt="Profile photo"
                />
              )}
              <a
                onClick={() => signOut({ redirect: false })}
                className="inline-block bg-white py-2 px-4 border border-transparent rounded-md text-base font-medium text-primary-600 hover:bg-primary-50"
              >
                Logout
              </a>
            </div>
          ) : (
            <div className="ml-10 space-x-4">
              <a
                onClick={() => signIn()}
                className="inline-block bg-primary-500 py-2 px-4 border border-transparent rounded-md text-base font-medium text-white hover:bg-opacity-75"
              >
                Sign in
              </a>
              <a
                onClick={() => signIn()}
                className="inline-block bg-white py-2 px-4 border border-transparent rounded-md text-base font-medium text-primary-600 hover:bg-primary-50"
              >
                Sign up
              </a>
            </div>
          )}
        </div>
        <div className="py-4 flex flex-wrap justify-center space-x-6 lg:hidden">
          {navigation.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-base font-medium text-white hover:text-primary-50"
            >
              {link.name}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
