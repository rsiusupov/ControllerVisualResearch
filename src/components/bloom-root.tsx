"use client";

import { useEffect } from "react";
import { attachBloom } from "@/src/lib/bloom";

export function BloomRoot() {
  useEffect(() => attachBloom(document), []);
  return null;
}
