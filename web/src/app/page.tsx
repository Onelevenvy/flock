"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    router.push("/login");
  }, [router]);

  return null;
}

export default Dashboard;
