"use client";

import { usePathname, useRouter } from "next/navigation";
import type { BoardView } from "@/lib/board-view";
import { Board, type BoardProps } from "./board";

// Router glue for the Board (issue #9). The Board itself takes `onViewChange`
// as a prop rather than calling `useRouter` internally, so it stays renderable
// in a test without a Next router; this is the one place that knows about
// navigation.
//
// `replace`, not `push`: flipping between kanban and calendar is changing how
// you are looking at the same Posts, so it should not stack up back-button
// history. `scroll: false` keeps the operator's place in a long board.

export function BoardClient(props: Omit<BoardProps, "onViewChange">) {
  const router = useRouter();
  const pathname = usePathname();

  const putViewInUrl = (view: BoardView) => {
    router.replace(`${pathname}?view=${view}`, { scroll: false });
  };

  return <Board {...props} onViewChange={putViewInUrl} />;
}
