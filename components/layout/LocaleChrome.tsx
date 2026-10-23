"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function LocaleChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname.includes("/admin");
  const isLogin = pathname.includes("/connexion-admin");
  const hideChrome = isAdmin || isLogin;

  return (
    <>
      {!hideChrome && header}
      {isAdmin || isLogin ? children : <main>{children}</main>}
      {!hideChrome && footer}
    </>
  );
}
