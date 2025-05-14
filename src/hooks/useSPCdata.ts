import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  ShiftData, 
  MaterialData, 
  OperationData, 
  GuageData
} from "@/types/spc";

interface UseSPCDataParams {
  startDate: Date;
  endDate: Date;
  selectedShifts: number[];
  material: string;
  operation: string;
}

const BASE_URL = "http://10.10.1.7:8304";

export function useSPCData({ 
  startDate, 
  endDate, 
  selectedShifts, 
  material, 
  operation 
}: UseSPCDataParams) {
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [materials, setMaterials] = useState<MaterialData[]>([]);
  const [operations, setOperations] = useState<OperationData[]>([]);
  const [gauges, setGauges] = useState<GuageData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch shifts
  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/commonappservices/getshiftdatalist`);
        if (!response.ok) throw new Error("Failed to fetch shifts");
        const data = await response.json();
        setShifts(data.data || []);
        setError(null);
      } catch (err) {
        setError("Failed to load shifts");
        console.error(err);
      }
    };

    fetchShifts();
  }, []);

  // Fetch materials
  useEffect(() => {
    const fetchMaterials = async () => {
      if (!startDate || !endDate || !selectedShifts.length) {
        setMaterials([]);
        return;
      }

      try {
        const params = new URLSearchParams({
          FromDate: format(startDate, "dd/MM/yyyy"),
          ToDate: format(endDate, "dd/MM/yyyy"),
          ShiftId: selectedShifts.join(",")
        });

        const response = await fetch(
          `${BASE_URL}/api/productionappservices/getspcmateriallist?${params}`
        );

        if (!response.ok) throw new Error("Failed to fetch materials");
        const data = await response.json();
        setMaterials(data || []);
        setError(null);
      } catch (err) {
        setError("Failed to load materials");
        console.error(err);
      }
    };

    fetchMaterials();
  }, [startDate, endDate, selectedShifts]);

  // Fetch operations
  useEffect(() => {
    const fetchOperations = async () => {
      if (!material || !startDate || !endDate || !selectedShifts.length) {
        setOperations([]);
        return;
      }

      try {
        const params = new URLSearchParams({
          FromDate: format(startDate, "dd/MM/yyyy"),
          ToDate: format(endDate, "dd/MM/yyyy"),
          MaterialCode: material,
          ShiftId: selectedShifts.join(",")
        });

        const response = await fetch(
          `${BASE_URL}/api/productionappservices/getspcoperationlist?${params}`
        );

        if (!response.ok) throw new Error("Failed to fetch operations");
        const data = await response.json();
        setOperations(data || []);
        setError(null);
      } catch (err) {
        setError("Failed to load operations");
        console.error(err);
      }
    };

    fetchOperations();
  }, [material, startDate, endDate, selectedShifts]);

  // Fetch gauges
  useEffect(() => {
    const fetchGauges = async () => {
      if (!operation || !material || !startDate || !endDate || !selectedShifts.length) {
        setGauges([]);
        return;
      }

      try {
        const params = new URLSearchParams({
          FromDate: format(startDate, "dd/MM/yyyy"),
          ToDate: format(endDate, "dd/MM/yyyy"),
          MaterialCode: material,
          OperationCode: operation,
          ShiftId: selectedShifts.join(",")
        });

        const response = await fetch(
          `${BASE_URL}/api/productionappservices/getspcguagelist?${params}`
        );

        if (!response.ok) throw new Error("Failed to fetch gauges");
        const data = await response.json();
        setGauges(data || []);
        setError(null);
      } catch (err) {
        setError("Failed to load gauges");
        console.error(err);
      }
    };

    fetchGauges();
  }, [operation, material, startDate, endDate, selectedShifts]);

  return {
    shifts,
    materials,
    operations,
    gauges,
    error
  };
}