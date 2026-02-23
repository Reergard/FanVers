import { useSyncExternalStore } from "react";
import {
  getHideAdultContent,
  setHideAdultContent,
  subscribeHideAdultContent,
} from "./adultContentStore";

export function useAdultContent() {
  const hideAdultContent = useSyncExternalStore(
    subscribeHideAdultContent,
    getHideAdultContent,
    getHideAdultContent
  );

  return {
    hideAdultContent,
    setHideAdultContent,
  };
}

