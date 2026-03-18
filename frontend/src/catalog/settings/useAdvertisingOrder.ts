import { useCallback, useMemo, useState } from "react";
import type { PlacementType } from "./advertising.types";
import type { PlacementOrderState } from "./advertising.types";
import { advertisingPlacements } from "./advertising.data";
import {
  calcDays,
  calcCost,
  validatePlacement,
  getMinStartDate,
} from "./advertising.utils";

function createInitialState(): Record<PlacementType, PlacementOrderState> {
  const state = {} as Record<PlacementType, PlacementOrderState>;
  for (const config of advertisingPlacements) {
    state[config.placementType] = {
      placementType: config.placementType,
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
  const [placements, setPlacements] = useState<Record<PlacementType, PlacementOrderState>>(
    createInitialState
  );

  const updatePlacement = useCallback(
    (type: PlacementType, patch: Partial<PlacementOrderState>) => {
      setPlacements((prev) => {
        const next = { ...prev[type], ...patch };
        if ("startDate" in patch || "endDate" in patch) {
          const start = next.startDate;
          let end = next.endDate;
          if (start && end && new Date(end) < new Date(start)) {
            end = start;
            next.endDate = start;
          }
          next.days = calcDays(start, end);
          next.totalCost = calcCost(start, end, type);
          next.includedInOrder = false;
        }
        return { ...prev, [type]: next };
      });
    },
    []
  );

  const addToOrder = useCallback(
    (type: PlacementType): { success: boolean; message?: string } => {
      const p = placements[type];
      const config = advertisingPlacements.find((c) => c.placementType === type);
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
        [type]: { ...prev[type], includedInOrder: true },
      }));
      return { success: true };
    },
    [placements]
  );

  const removeFromOrder = useCallback((type: PlacementType) => {
    setPlacements((prev) => ({
      ...prev,
      [type]: { ...prev[type], includedInOrder: false },
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
