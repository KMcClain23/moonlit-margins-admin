import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * True only once NetInfo has actually confirmed there's no connection --
 * starts (and stays) false while the very first check is still pending
 * (isConnected starts out `null`), so screens don't flash an offline
 * banner for a moment on every mount before NetInfo has reported anything.
 */
export function useNetworkStatus(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  return isOffline;
}
