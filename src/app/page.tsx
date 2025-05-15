"use client";

import { useRef, useState } from "react";
import { addDays, format } from "date-fns";
import AnalysisForm from "./AnalysisForm";
import { useReactToPrint } from 'react-to-print';
import AnalysisResults from "./AnalysisResults";
import { calculateAnalysisData } from "./spcUtils";
import { FormState, InspectionData, AnalysisData } from "@/types";

const BASE_URL = "http://10.10.1.7:8304";

export default function SPCAnalysisPage() {
  // State management
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  const componentRef = useRef<HTMLDivElement>(null);
  // Form state
  const [formState, setFormState] = useState<FormState>({
    selectedShifts: [],
    material: "",
    operation: "",
    gauge: "",
    sampleSize: "1",
    startDate: new Date(),
    endDate: addDays(new Date(), 7),
  });

  // Handle analysis action
  const handleAnalyze = async (formData: FormState) => {
    setLoading(true);
    setError(null);
    setAnalysisData(null);

    try {
      // Fetch inspection data from API
      const params = new URLSearchParams({
        FromDate: format(formData.startDate, "dd/MM/yyyy"),
        ToDate: format(formData.endDate, "dd/MM/yyyy"),
        MaterialCode: formData.material,
        OperationCode: formData.operation,
        GuageCode: formData.gauge,
        ShiftId: formData.selectedShifts.join(",")
      });

      const response = await fetch(
        `${BASE_URL}/api/productionappservices/getspcpirinspectiondatalist?${params}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch inspection data: ${response.statusText}`);
      }

      const inspectionData: InspectionData[] = await response.json();

      if (!inspectionData || inspectionData.length === 0) {
        throw new Error("No data found for the selected criteria");
      }

      if (inspectionData.length < parseInt(formData.sampleSize)) {
        throw new Error(
          `Insufficient data: ${inspectionData.length} measurements found, but ${formData.sampleSize} required`
        );
      }

      // Process the data using our utility function
      const analysisResults = calculateAnalysisData(
        inspectionData,
        parseInt(formData.sampleSize)
      );
      setAnalysisData(analysisResults);
    } catch (err) {
      setError(
        err instanceof Error ? `Error analyzing data: ${err.message}` : "Unknown error"
      );
      console.error("Analysis error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle report download
  const handleDownload = useReactToPrint({
    contentRef: componentRef,
    documentTitle: "SPC_Analysis_Report",
    onAfterPrint: () => setDownloading(false),
    onPrintError: async () => {
      setError("Error generating PDF report");
      setDownloading(false);
    },
  });

  return (
    <div className="container max-w-screen-xl mx-auto p-4 space-y-8">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">SPC Analysis</h1>
          <p className="text-gray-600">Statistical Process Control</p>
        </div>

        <AnalysisForm
          formState={formState}
          setFormState={setFormState}
          onAnalyze={handleAnalyze}
          loading={loading}
          error={error}
        />
      </div>

      {analysisData && (
        <div className="bg-white shadow-sm rounded-lg p-6 mt-8"
          ref={componentRef}>
          <AnalysisResults
            analysisData={analysisData}
            onDownload={handleDownload}
            downloading={downloading}
          />
        </div>
      )}
    </div>
  );
}
