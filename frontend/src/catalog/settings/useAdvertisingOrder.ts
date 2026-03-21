import { useCallback, useMemo, useState } from "react";
import type { AdvertisingSlotKey } from "./advertising.types";
import type { PlacementOrderState } from "./advertising.types";
import { advertisingPlacements } from "./advertising.data";
import {
  calcDays,
  calcCost,
  validatePlacement,
  getMinStartDate,
  isEndBeforeStartIso,
} from "./advertising.utils";

function createInitialState(): Record<AdvertisingSlotKey, PlacementOrderState> {
  const state = {} as Record<AdvertisingSlotKey, PlacementOrderState>;
  for (const config of advertisingPlacements) {
    state[config.slotKey] = {
      slotKey: config.slotKey,
      startDate: "",
      endDate: "",
      targetId: null,
      pricePerDay: config.pricePerDay,
      days: 0,
      totalCost: 0,
      includedInOrder: false,
    };
  }
  return state;
}

export function useAdvertisingOrder() {
  const [placements, setPlacements] = useState<
    Record<AdvertisingSlotKey, PlacementOrderState>
  >(createInitialState);

  const updatePlacement = useCallback(
    (slotKey: AdvertisingSlotKey, patch: Partial<PlacementOrderState>) => {
      setPlacements((prev) => {
        const next = { ...prev[slotKey], ...patch };
        if ("startDate" in patch || "endDate" in patch) {
          const start = next.startDate;
          let end = next.endDate;
          if (start && end && isEndBeforeStartIso(start, end)) {
            end = start;
            next.endDate = start;
          }
          next.days = calcDays(start, end);
          next.totalCost = calcCost(start, end, slotKey);
          next.includedInOrder = false;
        }
        return { ...prev, [slotKey]: next };
      });
    },
    []
  );

  const addToOrder = useCallback(
    (slotKey: AdvertisingSlotKey): { success: boolean; message?: string } => {
      const p = placements[slotKey];
      const config = advertisingPlacements.find((c) => c.slotKey === slotKey);
      const hasTarget = Boolean(config?.filterType);

      const result = validatePlacement(
        p.startDate,
        p.endDate,
        p.targetId,
        hasTarget
      );

      if (!result.valid) {
        return { success: false, message: result.message };
      }

      setPlacements((prev) => ({
        ...prev,
        [slotKey]: { ...prev[slotKey], includedInOrder: true },
      }));
      return { success: true };
    },
    [placements]
  );

  const removeFromOrder = useCallback((slotKey: AdvertisingSlotKey) => {
    setPlacements((prev) => ({
      ...prev,
      [slotKey]: { ...prev[slotKey], includedInOrder: false },
    }));
  }, []);

  const totalCost = useMemo(() => {
    return Object.values(placements).reduce(
      (sum, p) => sum + (p.includedInOrder ? p.totalCost : 0),
      0
    );
  }, [placements]);

  const orderedPlacements = useMemo(() => {
    return Object.values(placements).filter((p) => p.includedInOrder);
  }, [placements]);

  const minStartDate = getMinStartDate();

  return {
    placements,
    updatePlacement,
    addToOrder,
    removeFromOrder,
    totalCost,
    orderedPlacements,
    minStartDate,
  };
}
