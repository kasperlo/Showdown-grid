"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Editing lives on the board now. The route is kept so old links and the old
 * gear icon still land somewhere sensible instead of a 404.
 */
export default function SetupRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?mode=edit");
  }, [router]);

  return null;
}
