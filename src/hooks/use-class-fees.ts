import { useEffect, useMemo, useState } from 'react';
import type { ClassFee } from '../lib/types';

export function useClassFees(schoolYear: string) {
  const [fees, setFees] = useState<ClassFee[]>([]);

  useEffect(() => {
    if (!schoolYear) {
      setFees([]);
      return;
    }
    let cancelled = false;
    void window.api.classFees.listForYear(schoolYear).then((list) => {
      if (!cancelled) setFees(list);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolYear]);

  return fees;
}

export function resolveListedClassFee(
  fees: ClassFee[],
  classLevelId: string,
  section: string,
): number | null {
  if (!classLevelId) return null;
  const forClass = fees.filter(
    (fee) => String(fee.class_level_id) === classLevelId,
  );
  if (forClass.length === 0) return null;
  const exact = section
    ? forClass.find((fee) => fee.section === section)
    : undefined;
  return (exact ?? forClass[0])?.annual_fee ?? null;
}

export function useResolvedClassFee(
  schoolYear: string,
  classLevelId: string,
  section: string,
) {
  const fees = useClassFees(schoolYear);
  return useMemo(
    () => resolveListedClassFee(fees, classLevelId, section),
    [fees, classLevelId, section],
  );
}